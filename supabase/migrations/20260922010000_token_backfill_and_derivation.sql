/*
 * Phase 2: complete history, and the figures you can only derive from it.
 *
 * The webhook gives us transfers from the moment a token starts being watched.
 * Holder balances and first buyers need every transfer the token has ever had,
 * so this adds the walk that fetches the rest, a record of whether that walk
 * finished, and derivations that refuse to answer until it did.
 *
 * The refusal is the point. A balance computed from a partial history is not a
 * rough balance, it is a wrong one, and it looks exactly as authoritative as a
 * right one.
 */

/* ---------------------------------------------------------------- coverage */

create table if not exists public.token_coverage (
  chain_id     integer            not null,
  address      public.evm_address not null,
  -- 'complete' is a claim: block 0 through to_block has been walked and
  -- stored. Nothing else may set it.
  status       text               not null default 'pending'
                 check (status in ('pending', 'running', 'complete', 'failed')),
  -- Alchemy's pagination cursor, so a walk that runs out of time resumes
  -- rather than starting again and paying for the same pages twice.
  page_key     text,
  pages        integer            not null default 0,
  transfers    bigint             not null default 0,
  -- The chain head when the walk began. Everything after it is the webhook's
  -- job, which is why a token must be watched before it is backfilled.
  to_block     bigint,
  requested_by uuid,
  started_at   timestamptz        not null default now(),
  updated_at   timestamptz        not null default now(),
  completed_at timestamptz,
  error        text,
  primary key (chain_id, address)
);

comment on table public.token_coverage is
  'Whether a token''s full transfer history has been walked. status = complete is what licenses every derived figure.';

alter table public.token_coverage enable row level security;
-- Read through token_history_coverage, write through the backfill functions.

/* --------------------------------------------------------------- the walk */

/**
 * Claim a backfill.
 *
 * Returns the row the caller should act on. An already-complete token is
 * returned untouched — re-walking it would spend credits to rediscover what we
 * have. A walk someone else started in the last five minutes is left alone;
 * past that it is assumed dead and taken over.
 *
 * A resumed walk keeps its page key. A restarted one drops it: a stale cursor
 * is worse than paying to walk again, because it silently skips the pages in
 * between and the result still calls itself complete.
 */
create or replace function public.start_token_backfill(
  p_chain_id integer,
  p_address  text,
  p_to_block bigint,
  p_user     uuid default null
)
returns public.token_coverage
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.token_coverage;
begin
  select * into v_row from public.token_coverage
   where chain_id = p_chain_id and address = lower(p_address);

  if found and v_row.status = 'complete' then
    return v_row;
  end if;

  if found and v_row.status = 'running' and v_row.updated_at > now() - interval '5 minutes' then
    return v_row;
  end if;

  insert into public.token_coverage
    (chain_id, address, status, to_block, requested_by, started_at, updated_at)
  values
    (p_chain_id, lower(p_address), 'running', p_to_block, p_user, now(), now())
  on conflict (chain_id, address) do update
     set status       = 'running',
         to_block     = excluded.to_block,
         requested_by = coalesce(excluded.requested_by, public.token_coverage.requested_by),
         -- Only a resume keeps the cursor; a takeover starts clean.
         page_key     = case when public.token_coverage.status = 'running'
                             then public.token_coverage.page_key else null end,
         pages        = case when public.token_coverage.status = 'running'
                             then public.token_coverage.pages else 0 end,
         -- Reset alongside pages, or a restarted walk counts the pages it
         -- re-reads on top of the ones it already counted.
         transfers    = case when public.token_coverage.status = 'running'
                             then public.token_coverage.transfers else 0 end,
         error        = null,
         updated_at   = now()
  returning * into v_row;

  return v_row;
end;
$$;

/**
 * Store one page of the walk and move the cursor.
 *
 * `p_done` is what promotes a token to complete, and it is only true when
 * Alchemy returned no further page key — never on a timeout, never on an
 * error, never because enough looked like enough.
 */
create or replace function public.record_backfill_page(
  p_chain_id integer,
  p_address  text,
  p_events   jsonb,
  p_page_key text,
  p_done     boolean
)
returns table (received integer, inserted integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_received integer := 0;
  v_inserted integer := 0;
begin
  if p_events is not null and jsonb_typeof(p_events) = 'array' then
    select count(*)::int into v_received from jsonb_array_elements(p_events);

    with incoming as (
      select
        p_chain_id                                            as chain_id,
        e->>'txHash'                                          as tx_hash,
        (e->>'logIndex')::int                                 as log_index,
        (e->>'blockNumber')::bigint                           as block_number,
        case when e->>'blockTime' is null then null
             else (e->>'blockTime')::timestamptz end          as block_time,
        lower(e->>'token')                                    as token,
        lower(e->>'from')                                     as from_address,
        lower(e->>'to')                                       as to_address,
        (e->>'value')::numeric                                as value
      from jsonb_array_elements(p_events) as e
    ),
    saved as (
      insert into public.token_transfers
        (chain_id, tx_hash, log_index, block_number, block_time,
         token, from_address, to_address, value)
      select chain_id, tx_hash, log_index, block_number, block_time,
             token, from_address, to_address, value
      from incoming
      -- The webhook may already have delivered some of these. Same key, no-op.
      on conflict (chain_id, tx_hash, log_index) do nothing
      returning 1
    )
    select count(*)::int into v_inserted from saved;
  end if;

  update public.token_coverage
     set pages        = pages + 1,
         transfers    = transfers + v_received,
         page_key     = case when p_done then null else p_page_key end,
         status       = case when p_done then 'complete' else 'running' end,
         completed_at = case when p_done then now() else null end,
         updated_at   = now()
   where chain_id = p_chain_id and address = lower(p_address);

  return query select v_received, v_inserted;
end;
$$;

/** Record a walk that did not finish, so the UI stops claiming one is running. */
create or replace function public.fail_token_backfill(
  p_chain_id integer,
  p_address  text,
  p_error    text
)
returns void
language sql security definer set search_path = '' as $$
  update public.token_coverage
     set status = 'failed', error = left(p_error, 500), updated_at = now()
   where chain_id = p_chain_id and address = lower(p_address);
$$;

revoke execute on function public.start_token_backfill(integer, text, bigint, uuid) from public, anon, authenticated;
revoke execute on function public.record_backfill_page(integer, text, jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public.fail_token_backfill(integer, text, text) from public, anon, authenticated;
grant execute on function public.start_token_backfill(integer, text, bigint, uuid) to service_role;
grant execute on function public.record_backfill_page(integer, text, jsonb, text, boolean) to service_role;
grant execute on function public.fail_token_backfill(integer, text, text) to service_role;

/* ----------------------------------------------------------- derivations */

/** The burn address. Balances here are destroyed supply, not somebody's holding. */
create or replace function public.zero_address() returns text
language sql immutable as $$ select '0x0000000000000000000000000000000000000000'::text $$;

/**
 * Every positive balance, summed from transfer history.
 *
 * Internal: correct only over a complete history, and nothing here enforces
 * that. The public functions below do.
 */
create or replace function public.token_balances(p_chain_id integer, p_address text)
returns table (holder public.evm_address, balance numeric)
language sql stable security definer set search_path = '' as $$
  select f.addr, sum(f.delta)
    from (
      select t.to_address as addr, t.value as delta
        from public.token_transfers t
       where t.chain_id = p_chain_id and t.token = lower(p_address)
      union all
      select t.from_address, -t.value
        from public.token_transfers t
       where t.chain_id = p_chain_id and t.token = lower(p_address)
    ) f
   where f.addr <> public.zero_address()
   group by f.addr
  having sum(f.delta) > 0;
$$;

revoke execute on function public.token_balances(integer, text) from public, anon, authenticated;

/** True only when the whole history has been walked. */
create or replace function public.token_is_complete(p_chain_id integer, p_address text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.token_coverage c
     where c.chain_id = p_chain_id
       and c.address = lower(p_address)
       and c.status = 'complete'
  );
$$;

/**
 * Largest holders, as a share of what is actually held.
 *
 * The denominator is the sum of positive balances rather than a declared total
 * supply: tokens sitting at the burn address are gone, and counting them would
 * quietly shrink every percentage below its real value.
 *
 * Returns nothing at all when the history is incomplete.
 */
create or replace function public.token_holders(
  p_chain_id integer,
  p_address  text,
  p_limit    integer default 10
)
returns table (rank integer, address public.evm_address, balance numeric, percent numeric)
language sql stable security definer set search_path = '' as $$
  with b as (
    select * from public.token_balances(p_chain_id, p_address)
     where public.token_is_complete(p_chain_id, p_address)
  ),
  total as (select sum(balance) as s from b)
  select (row_number() over (order by b.balance desc))::integer,
         b.holder,
         b.balance,
         round(b.balance * 100 / nullif((select s from total), 0), 4)
    from b
   order by b.balance desc
   limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

/** How many addresses hold any of it. Nothing when the history is incomplete. */
create or replace function public.token_holder_count(p_chain_id integer, p_address text)
returns bigint
language sql stable security definer set search_path = '' as $$
  select case
    when public.token_is_complete(p_chain_id, p_address)
    then (select count(*) from public.token_balances(p_chain_id, p_address))
    else null
  end;
$$;

/**
 * The first addresses ever to receive the token, and what became of them.
 *
 * "Peak" is the highest balance each one ever held, taken as a running total
 * over their own flows. Comparing today's balance against the peak is what
 * distinguishes someone who sold from someone who simply bought less than the
 * person above them.
 *
 * Returns nothing at all when the history is incomplete.
 */
create or replace function public.token_early_buyers(
  p_chain_id integer,
  p_address  text,
  p_limit    integer default 25
)
returns table (
  rank        integer,
  address     public.evm_address,
  tx_hash     text,
  bought_at   timestamptz,
  block_number bigint,
  amount      numeric,
  peak        numeric,
  current     numeric
)
language sql stable security definer set search_path = '' as $$
  with scoped as (
    select t.* from public.token_transfers t
     where t.chain_id = p_chain_id
       and t.token = lower(p_address)
       and public.token_is_complete(p_chain_id, p_address)
  ),
  first_in as (
    select distinct on (s.to_address)
           s.to_address as addr, s.tx_hash, s.block_time, s.block_number,
           s.log_index, s.value
      from scoped s
     where s.to_address <> public.zero_address()
     order by s.to_address, s.block_number, s.log_index
  ),
  earliest as (
    select * from first_in
     order by block_number, log_index
     limit greatest(1, least(coalesce(p_limit, 25), 100))
  ),
  flows as (
    select f.addr, f.block_number, f.log_index, f.delta
      from (
        select s.to_address as addr, s.block_number, s.log_index, s.value as delta
          from scoped s
        union all
        select s.from_address, s.block_number, s.log_index, -s.value
          from scoped s
      ) f
     where f.addr in (select addr from earliest)
  ),
  running as (
    select addr,
           sum(delta) over (
             partition by addr order by block_number, log_index
             rows between unbounded preceding and current row
           ) as bal
      from flows
  ),
  summary as (
    select addr, max(bal) as peak from running group by addr
  ),
  final_balance as (
    select addr, sum(delta) as bal from flows group by addr
  )
  select (row_number() over (order by e.block_number, e.log_index))::integer,
         e.addr,
         e.tx_hash,
         e.block_time,
         e.block_number,
         e.value,
         s.peak,
         greatest(fb.bal, 0)
    from earliest e
    join summary s using (addr)
    join final_balance fb using (addr)
   order by e.block_number, e.log_index;
$$;

grant execute on function public.token_is_complete(integer, text) to anon, authenticated, service_role;
grant execute on function public.token_holders(integer, text, integer) to anon, authenticated, service_role;
grant execute on function public.token_holder_count(integer, text) to anon, authenticated, service_role;
grant execute on function public.token_early_buyers(integer, text, integer) to anon, authenticated, service_role;

/* --------------------------------------------------- coverage, with status */

/**
 * Replaces the phase-1 version: same coverage figures, plus where the backfill
 * has got to. The UI needs both — "we hold 400 transfers" and "that is not all
 * of them" are the two halves of an honest answer.
 */
-- Adding columns changes the return type, which a replace cannot do.
drop function if exists public.token_history_coverage(integer, text);

create or replace function public.token_history_coverage(
  p_chain_id integer,
  p_address  text
)
returns table (
  transfers   bigint,
  first_block bigint,
  last_block  bigint,
  first_seen  timestamptz,
  last_seen   timestamptz,
  tracked     boolean,
  status      text,
  pages       integer,
  complete    boolean,
  holders     bigint,
  error       text
)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::bigint from public.token_transfers t
      where t.chain_id = p_chain_id and t.token = lower(p_address)),
    (select min(t.block_number) from public.token_transfers t
      where t.chain_id = p_chain_id and t.token = lower(p_address)),
    (select max(t.block_number) from public.token_transfers t
      where t.chain_id = p_chain_id and t.token = lower(p_address)),
    (select min(t.block_time) from public.token_transfers t
      where t.chain_id = p_chain_id and t.token = lower(p_address)),
    (select max(t.block_time) from public.token_transfers t
      where t.chain_id = p_chain_id and t.token = lower(p_address)),
    exists (select 1 from public.tracked_tokens(p_chain_id) k
             where k.address = lower(p_address)),
    coalesce((select c.status from public.token_coverage c
               where c.chain_id = p_chain_id and c.address = lower(p_address)), 'none'),
    coalesce((select c.pages from public.token_coverage c
               where c.chain_id = p_chain_id and c.address = lower(p_address)), 0),
    public.token_is_complete(p_chain_id, p_address),
    public.token_holder_count(p_chain_id, p_address),
    (select c.error from public.token_coverage c
      where c.chain_id = p_chain_id and c.address = lower(p_address));
$$;

revoke execute on function public.token_history_coverage(integer, text) from public;
grant execute on function public.token_history_coverage(integer, text)
  to anon, authenticated, service_role;
