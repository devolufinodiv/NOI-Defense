/*
 * The hero's trusted list.
 *
 * "Trusted" here is a claim we have to be able to back, so membership is earned
 * by evidence rather than chosen by hand:
 *   - a sale was actually simulated and went through (simulation_ok + not a honeypot)
 *   - the sell fee is known and small
 *   - there is real depth to trade against
 * An admin pin can move a qualifying token to the front, but cannot put a token
 * in the list that has not met the bar — otherwise a pin would launder trust
 * onto something we never verified.
 *
 * Each row carries its own evidence so the UI can show why a token is listed
 * instead of asking people to take the label on faith.
 */
create or replace function public.trusted_tokens(p_limit integer default 5)
returns table (
  chain_id        integer,
  address         public.evm_address,
  name            text,
  symbol          text,
  pinned          boolean,
  price_usd       numeric,
  change_24h      numeric,
  liquidity_usd   numeric,
  sell_tax        numeric,
  source_verified boolean,
  scan_count      bigint,
  checked_at      timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select
    t.chain_id, t.address, t.name, t.symbol,
    f.chain_id is not null as pinned,
    m.price_usd, m.change_24h, m.liquidity_usd,
    s.sell_tax, s.source_verified, t.scan_count, s.checked_at
  from public.tokens t
  join public.token_safety  s on s.chain_id = t.chain_id and s.address = t.address
  join public.token_metrics m on m.chain_id = t.chain_id and m.address = t.address
  left join public.featured_tokens f
    on f.chain_id = t.chain_id and f.address = t.address
  where t.symbol <> ''
    and s.simulation_ok is true
    and s.is_honeypot is false
    and s.sell_tax is not null
    and s.sell_tax < 10
    and m.liquidity_usd >= 50000
  order by (f.chain_id is not null) desc,
           coalesce(f.position, 2147483647) asc,
           m.liquidity_usd desc
  limit least(greatest(coalesce(p_limit, 5), 0), 12);
$$;

revoke execute on function public.trusted_tokens(integer) from public;
grant  execute on function public.trusted_tokens(integer) to anon, authenticated;
