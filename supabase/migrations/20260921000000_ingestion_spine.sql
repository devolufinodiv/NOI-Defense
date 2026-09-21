/*
 * Phase 1: the ingestion spine.
 *
 * One stream of token transfers is what every later signal is derived from —
 * holder changes, whale movements, early-buyer sells, wash-trade loops. Storing
 * it once means those become queries rather than seven separate pipelines.
 *
 * Deliveries arrive by webhook, which means they can arrive twice, out of
 * order, or not at all. The schema answers all three: the primary key makes a
 * repeat delivery a no-op, ordering never matters because nothing is derived at
 * write time, and a cursor per chain lets a reconciliation pass find the gaps.
 */

create table if not exists public.token_transfers (
  chain_id     integer            not null,
  tx_hash      text               not null,
  log_index    integer            not null,
  block_number bigint             not null,
  block_time   timestamptz,
  token        public.evm_address not null,
  from_address public.evm_address not null,
  to_address   public.evm_address not null,
  -- uint256. NUMERIC(78,0) because a token amount overflows bigint, and a
  -- float would quietly round balances that people are about to act on.
  value        numeric(78,0)      not null,
  observed_at  timestamptz        not null default now(),
  -- One row per log. A webhook redelivery collides here and is discarded,
  -- which is what makes the whole pipeline safe to retry.
  primary key (chain_id, tx_hash, log_index)
);

comment on table public.token_transfers is
  'Raw ERC-20 Transfer logs. Append-only, idempotent on (chain_id, tx_hash, log_index).';

create index if not exists token_transfers_token_idx
  on public.token_transfers (chain_id, token, block_number desc);
create index if not exists token_transfers_from_idx
  on public.token_transfers (chain_id, from_address, block_number desc);
create index if not exists token_transfers_to_idx
  on public.token_transfers (chain_id, to_address, block_number desc);

alter table public.token_transfers enable row level security;
-- No policy: read through security-definer functions, never straight from the
-- client. Raw logs are an internal substrate, not a public endpoint.

/*
 * How far each chain has been ingested. `last_block` only ever moves forward,
 * and only over blocks actually stored, so a cursor can never claim more than
 * was written and hide a permanent hole.
 */
create table if not exists public.chain_cursors (
  chain_id    integer     primary key,
  last_block  bigint      not null default 0,
  last_event  timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.chain_cursors enable row level security;

/* Every accepted delivery, for diagnosing gaps. An operational trail, not a
   second copy of the data. */
create table if not exists public.ingest_deliveries (
  id           text        primary key,
  chain_id     integer     not null,
  events       integer     not null default 0,
  inserted     integer     not null default 0,
  first_block  bigint,
  last_block   bigint,
  received_at  timestamptz not null default now()
);
alter table public.ingest_deliveries enable row level security;

/**
 * Stores a batch of transfers and advances the chain cursor.
 *
 * Takes already-decoded events, because turning hex into a uint256 belongs in
 * the function that has BigInt, not in SQL where it would pass through a float.
 * Returns how many rows were new, so a redelivery reads as zero rather than
 * looking like fresh activity.
 */
create or replace function public.ingest_token_transfers(
  p_chain_id    integer,
  p_delivery_id text,
  p_events      jsonb
)
returns table (received integer, inserted integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_received integer := 0;
  v_inserted integer := 0;
  v_first    bigint;
  v_last     bigint;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return query select 0, 0;
    return;
  end if;

  select count(*)::int into v_received from jsonb_array_elements(p_events);

  with incoming as (
    select
      p_chain_id                                            as chain_id,
      e->>'txHash'                                          as tx_hash,
      (e->>'logIndex')::int                                 as log_index,
      (e->>'blockNumber')::bigint                           as block_number,
      case when e->>'blockTime' is null then null
           else to_timestamp((e->>'blockTime')::bigint) end as block_time,
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
    -- The whole point: a repeated delivery changes nothing.
    on conflict (chain_id, tx_hash, log_index) do nothing
    returning block_number
  )
  select count(*)::int, min(block_number), max(block_number)
    into v_inserted, v_first, v_last
  from saved;

  if v_last is not null then
    insert into public.chain_cursors (chain_id, last_block, last_event)
    values (p_chain_id, v_last, now())
    on conflict (chain_id) do update
      set last_block = greatest(public.chain_cursors.last_block, excluded.last_block),
          last_event = now(),
          updated_at = now();
  end if;

  if p_delivery_id is not null then
    insert into public.ingest_deliveries
      (id, chain_id, events, inserted, first_block, last_block)
    values (p_delivery_id, p_chain_id, v_received, v_inserted, v_first, v_last)
    on conflict (id) do nothing;
  end if;

  return query select v_received, v_inserted;
end;
$$;

revoke execute on function public.ingest_token_transfers(integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_token_transfers(integer, text, jsonb)
  to service_role;

/**
 * The addresses a webhook should be watching: everything anyone actually
 * follows, so the set the chain streams matches the set the product cares about.
 */
create or replace function public.tracked_tokens(p_chain_id integer default null)
returns table (chain_id integer, address public.evm_address)
language sql stable security definer set search_path = '' as $$
  select distinct w.chain_id, w.address
    from public.watchlist w
   where w.kind = 'token'
     and (p_chain_id is null or w.chain_id = p_chain_id)
  union
  select distinct e.chain_id, e.address
    from public.trusted_entries e
   where (p_chain_id is null or e.chain_id = p_chain_id);
$$;

revoke execute on function public.tracked_tokens(integer) from public, anon;
grant execute on function public.tracked_tokens(integer) to authenticated, service_role;
