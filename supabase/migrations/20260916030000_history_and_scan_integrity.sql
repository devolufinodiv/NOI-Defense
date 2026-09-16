/*
 * Two things the app has been missing.
 *
 * 1. History. `token_metrics` has only ever held the latest reading, so there
 *    was nothing to compare against: the watchlist could not say liquidity had
 *    been pulled, and any price curve drawn in the UI would have been invented.
 *    Readings are appended here whenever a scan actually reads upstream.
 *
 * 2. Scan counts that cannot be inflated. `tokens.scan_count` counted raw
 *    requests, so anyone could loop the endpoint and put their own token at the
 *    top of the dashboard. It now counts distinct people.
 */

create table if not exists public.token_metric_history (
  chain_id       integer            not null,
  address        public.evm_address not null,
  recorded_at    timestamptz        not null default now(),
  price_usd      numeric,
  liquidity_usd  numeric,
  volume_24h_usd numeric,
  fdv_usd        numeric,
  primary key (chain_id, address, recorded_at),
  foreign key (chain_id, address)
    references public.tokens (chain_id, address) on delete cascade
);

comment on table public.token_metric_history is
  'Append-only readings, written when a scan actually reads upstream. Density follows scan traffic, so this is a series of observations and not a continuous feed.';

create index if not exists token_metric_history_recent_idx
  on public.token_metric_history (chain_id, address, recorded_at desc);

alter table public.token_metric_history enable row level security;

drop policy if exists "public read metric history" on public.token_metric_history;
create policy "public read metric history" on public.token_metric_history
  for select using (true);

/*
 * Who has scanned a token, one row per person per token.
 *
 * The actor key is already hashed by the caller — a signed-in user's id, or a
 * digest of the request's network identity salted with the token. Raw addresses
 * are never stored, and the table holds no column that could reconstruct one.
 */
create table if not exists public.token_scan_actors (
  chain_id   integer            not null,
  address    public.evm_address not null,
  actor_key  text               not null,
  first_seen timestamptz        not null default now(),
  last_seen  timestamptz        not null default now(),
  primary key (chain_id, address, actor_key)
);

alter table public.token_scan_actors enable row level security;
-- No policy: nobody reads this through the API. It exists to make the count
-- honest, not to be reported on.

/*
 * Counts a scan, and says whether it was this person's first look at the token.
 *
 * A null actor key keeps the old behaviour so nothing breaks between this
 * migration and the function deploy that starts sending one.
 */
create or replace function public.record_token_scan(
  p_chain_id  integer,
  p_address   public.evm_address,
  p_actor_key text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  is_new boolean := true;
begin
  insert into public.tokens (chain_id, address, scan_count, last_scanned_at)
  values (p_chain_id, p_address, 0, now())
  on conflict (chain_id, address) do update set last_scanned_at = now();

  if p_actor_key is not null then
    insert into public.token_scan_actors (chain_id, address, actor_key)
    values (p_chain_id, p_address, p_actor_key)
    on conflict (chain_id, address, actor_key)
      do update set last_seen = now()
    returning (xmax = 0) into is_new;
  end if;

  -- Only a person's first scan of a token moves the counter, so looping the
  -- endpoint cannot buy a place on the dashboard.
  if is_new then
    update public.tokens
       set scan_count = scan_count + 1
     where chain_id = p_chain_id and address = p_address;
  end if;
end;
$$;

revoke execute on function public.record_token_scan(integer, public.evm_address, text)
  from public, anon, authenticated;
grant execute on function public.record_token_scan(integer, public.evm_address, text)
  to service_role;

/** Appends one reading. Service-role only, like the counter. */
create or replace function public.record_token_metrics(
  p_chain_id       integer,
  p_address        public.evm_address,
  p_price_usd      numeric,
  p_liquidity_usd  numeric,
  p_volume_24h_usd numeric,
  p_fdv_usd        numeric
)
returns void language sql security definer set search_path = '' as $$
  insert into public.token_metric_history
    (chain_id, address, price_usd, liquidity_usd, volume_24h_usd, fdv_usd)
  values
    (p_chain_id, p_address, p_price_usd, p_liquidity_usd, p_volume_24h_usd, p_fdv_usd)
  on conflict (chain_id, address, recorded_at) do nothing;
$$;

revoke execute on function public.record_token_metrics(integer, public.evm_address, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.record_token_metrics(integer, public.evm_address, numeric, numeric, numeric, numeric)
  to service_role;

/**
 * The readings for one token, oldest first.
 *
 * Returns the observations themselves rather than a smoothed line, so the
 * caller can decline to draw a two-point "chart" as if it were a trend.
 */
create or replace function public.token_metric_series(
  p_chain_id integer,
  p_address  public.evm_address,
  p_hours    integer default 168
)
returns table (
  recorded_at    timestamptz,
  price_usd      numeric,
  liquidity_usd  numeric,
  volume_24h_usd numeric
)
language sql stable security invoker set search_path = '' as $$
  select h.recorded_at, h.price_usd, h.liquidity_usd, h.volume_24h_usd
  from public.token_metric_history h
  where h.chain_id = p_chain_id
    and h.address = p_address
    and h.recorded_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 168), 1), 720))
  order by h.recorded_at asc
  limit 500;
$$;

revoke execute on function public.token_metric_series(integer, public.evm_address, integer) from public;
grant  execute on function public.token_metric_series(integer, public.evm_address, integer) to anon, authenticated;

/** Keeps the table from growing without bound. Run on a schedule. */
create or replace function public.prune_token_metric_history(p_keep_days integer default 30)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.token_metric_history
   where recorded_at < now() - make_interval(days => greatest(coalesce(p_keep_days, 30), 1));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.prune_token_metric_history(integer) from public, anon, authenticated;
grant execute on function public.prune_token_metric_history(integer) to service_role;
