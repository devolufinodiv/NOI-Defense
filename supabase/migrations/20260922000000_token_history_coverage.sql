/*
 * What we actually hold for one token.
 *
 * The deep-history panel used to be served by a mock adapter, which meant a
 * real contract got a confident, entirely invented holder breakdown. This is
 * the replacement: a function that reports what has genuinely been ingested,
 * so the UI can say "we have not read this token's history" instead of
 * inventing one.
 *
 * It deliberately returns coverage rather than derived figures. Balances
 * computed from a partial transfer history are wrong in a way that looks
 * entirely plausible, so holder and early-buyer derivation waits until a
 * backfill can establish that the history is complete.
 */

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
  tracked     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::bigint,
    min(t.block_number),
    max(t.block_number),
    min(t.block_time),
    max(t.block_time),
    exists (
      select 1 from public.tracked_tokens(p_chain_id) k
       where k.address = lower(p_address)
    )
  from public.token_transfers t
  where t.chain_id = p_chain_id
    and t.token = lower(p_address);
$$;

comment on function public.token_history_coverage(integer, text) is
  'How much transfer history exists for one token, and whether it is being streamed. Reports coverage only — never derived balances.';

revoke execute on function public.token_history_coverage(integer, text) from public;
grant execute on function public.token_history_coverage(integer, text)
  to anon, authenticated, service_role;
