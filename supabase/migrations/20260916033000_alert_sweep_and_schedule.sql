/*
 * Turning the watchlist into something that actually warns people.
 *
 * The alert rules have existed in the worker since the start, with tests, and
 * have never once run: the worker needs a service-role key and somewhere to
 * live. This puts the same thresholds where they can run today, against the
 * reading history that now exists, driven by pg_cron and pg_net.
 *
 * Thresholds are kept identical to worker/src/rules.ts on purpose, and that
 * file carries a pointer back here so the two cannot drift silently.
 */

create table if not exists public.alert_state (
  chain_id   integer            not null,
  address    public.evm_address not null,
  rule       text               not null,
  fired_at   timestamptz        not null default now(),
  primary key (chain_id, address, rule)
);
alter table public.alert_state enable row level security;
-- No policy: internal bookkeeping, never read through the API.

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
-- No policy. Read only by security-definer functions running as the owner.

comment on table public.app_config is
  'Internal settings for scheduled jobs. Holds no secret beyond the publishable key, which is public by design.';

/**
 * Compares the two most recent readings for every watched token and raises an
 * alert where something material changed.
 *
 * Only the single most serious finding per token is raised. Firing three alerts
 * for one event — price fell, liquidity fell, volume spiked — describes one rug
 * three times and buries the useful sentence.
 */
create or replace function public.sweep_alerts(p_quiet_hours integer default 6)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  watched    record;
  cur        record;
  prev       record;
  has_cur    boolean;
  has_prev   boolean;
  v_rule     text;
  v_severity public.alert_severity;
  v_title    text;
  v_detail   text;
  v_change   numeric;
  v_ratio    numeric;
  v_inserted integer;
  created    integer := 0;
begin
  for watched in
    select distinct w.chain_id, w.address from public.watchlist w where w.kind = 'token'
  loop
    select h.price_usd, h.liquidity_usd, h.volume_24h_usd, h.recorded_at into cur
      from public.token_metric_history h
     where h.chain_id = watched.chain_id and h.address = watched.address
     order by h.recorded_at desc limit 1;
    has_cur := found;
    if not has_cur then continue; end if;

    select h.price_usd, h.liquidity_usd, h.volume_24h_usd, h.recorded_at into prev
      from public.token_metric_history h
     where h.chain_id = watched.chain_id and h.address = watched.address
       and h.recorded_at < cur.recorded_at
     order by h.recorded_at desc limit 1;
    has_prev := found;

    -- One reading is a baseline, not a change. Say nothing.
    if not has_prev then continue; end if;

    v_rule := null;

    -- Liquidity leaving is the most serious thing we can see, so it wins outright.
    if coalesce(prev.liquidity_usd, 0) > 0 then
      v_change := (cur.liquidity_usd - prev.liquidity_usd) / prev.liquidity_usd;
      if v_change <= -0.30 then
        v_rule := 'liquidity_drop';
        v_severity := 'critical';
        v_title := 'Money is leaving this token';
        v_detail := format(
          'The pool you would sell into shrank %s%%, from $%s to $%s. This is what a rug pull looks like as it happens.',
          abs(round(v_change * 100)),
          to_char(round(prev.liquidity_usd), 'FM999,999,999,999'),
          to_char(round(cur.liquidity_usd), 'FM999,999,999,999'));
      end if;
    end if;

    if v_rule is null and coalesce(prev.price_usd, 0) > 0 and coalesce(cur.price_usd, 0) > 0 then
      v_change := (cur.price_usd - prev.price_usd) / prev.price_usd;
      if v_change <= -0.25 then
        v_rule := 'price_drop';
        v_severity := 'warning';
        v_title := 'Price dropped sharply';
        v_detail := format('Down %s%% since we last checked.', abs(round(v_change * 100)));
      elsif v_change >= 0.50 then
        v_rule := 'price_spike';
        v_severity := 'info';
        v_title := 'Price jumped';
        v_detail := format('Up %s%% since we last checked. Sudden spikes often reverse just as fast.',
          round(v_change * 100));
      end if;
    end if;

    if v_rule is null
       and coalesce(prev.volume_24h_usd, 0) > 0
       and coalesce(cur.volume_24h_usd, 0) > 10000 then
      v_ratio := cur.volume_24h_usd / prev.volume_24h_usd;
      if v_ratio >= 3 then
        v_rule := 'volume_spike';
        v_severity := 'info';
        v_title := 'Trading suddenly picked up';
        v_detail := format('Volume is %sx what it was, at $%s.',
          round(v_ratio), to_char(round(cur.volume_24h_usd), 'FM999,999,999,999'));
      end if;
    end if;

    if v_rule is null then continue; end if;

    -- The same rule on the same token stays quiet for a while, so a token
    -- bleeding out slowly does not alert on every sweep.
    if exists (
      select 1 from public.alert_state s
       where s.chain_id = watched.chain_id and s.address = watched.address
         and s.rule = v_rule
         and s.fired_at > now() - make_interval(hours => greatest(coalesce(p_quiet_hours, 6), 1))
    ) then continue; end if;

    insert into public.alerts (user_id, severity, title, detail, chain_id, subject, subject_kind)
    select w.user_id, v_severity, v_title, v_detail, watched.chain_id, watched.address, 'token'
      from public.watchlist w
     where w.kind = 'token' and w.chain_id = watched.chain_id and w.address = watched.address;

    get diagnostics v_inserted = row_count;
    created := created + v_inserted;

    insert into public.alert_state (chain_id, address, rule)
    values (watched.chain_id, watched.address, v_rule)
    on conflict (chain_id, address, rule) do update set fired_at = now();
  end loop;

  return created;
end;
$$;

revoke execute on function public.sweep_alerts(integer) from public, anon, authenticated;
grant execute on function public.sweep_alerts(integer) to service_role;

/**
 * Asks the scan endpoint for a fresh reading of every watched token.
 *
 * Readings otherwise only appear when somebody happens to scan a token, which
 * is precisely not true of a token quietly being drained at three in the
 * morning — the case the watchlist exists for.
 *
 * The locals are prefixed because an unprefixed `key` resolves to
 * app_config.key inside the query and Postgres rejects the ambiguity.
 */
create or replace function public.refresh_watched_tokens()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_base  text;
  v_key   text;
  watched record;
  fired   integer := 0;
begin
  select c.value into v_base from public.app_config c where c.key = 'functions_url';
  select c.value into v_key  from public.app_config c where c.key = 'publishable_key';
  if v_base is null or v_key is null then
    raise warning 'refresh_watched_tokens: app_config is incomplete';
    return 0;
  end if;

  for watched in
    select distinct w.chain_id, w.address from public.watchlist w where w.kind = 'token'
  loop
    perform net.http_get(
      url := v_base || '/scan?chainId=' || watched.chain_id || '&address=' || watched.address || '&refresh=1',
      headers := jsonb_build_object('apikey', v_key, 'Authorization', 'Bearer ' || v_key),
      timeout_milliseconds := 20000
    );
    fired := fired + 1;
  end loop;

  return fired;
end;
$$;

revoke execute on function public.refresh_watched_tokens() from public, anon, authenticated;
grant execute on function public.refresh_watched_tokens() to service_role;

-- Refresh, then compare a few minutes later so the readings have landed.
select cron.unschedule('noi-refresh-watched') where exists (select 1 from cron.job where jobname = 'noi-refresh-watched');
select cron.unschedule('noi-sweep-alerts')    where exists (select 1 from cron.job where jobname = 'noi-sweep-alerts');
select cron.unschedule('noi-prune-history')   where exists (select 1 from cron.job where jobname = 'noi-prune-history');

select cron.schedule('noi-refresh-watched', '*/15 * * * *',    $job$ select public.refresh_watched_tokens() $job$);
select cron.schedule('noi-sweep-alerts',    '5-59/15 * * * *', $job$ select public.sweep_alerts() $job$);
select cron.schedule('noi-prune-history',   '17 4 * * *',      $job$ select public.prune_token_metric_history(30) $job$);
