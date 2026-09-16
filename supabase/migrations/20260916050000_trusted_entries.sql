/*
 * An admin-curated trusted list.
 *
 * Admins can add a token, write a note on why, file it under a category and set
 * its order. The evidence does not go away: every row still reports whether it
 * currently passes the checks, a curated token that fails them is never
 * spotlighted on the landing page, and on the directory it is shown with a
 * warning rather than hidden — so a stale or mistaken entry is visible, not
 * silent.
 *
 * Kept separate from featured_tokens on purpose: that table orders the
 * dashboard's "most scanned" tiles, which is a different editorial decision.
 */

create table if not exists public.trusted_entries (
  chain_id      integer            not null,
  address       public.evm_address not null,
  note          text,
  category      text,
  sort_position integer            not null default 0,
  added_by      uuid               references auth.users (id) on delete set null,
  created_at    timestamptz        not null default now(),
  updated_at    timestamptz        not null default now(),
  primary key (chain_id, address),
  foreign key (chain_id, address) references public.tokens (chain_id, address) on delete cascade,
  constraint trusted_entries_note_length check (note is null or char_length(note) <= 280),
  constraint trusted_entries_category_length check (category is null or char_length(category) <= 40)
);

alter table public.trusted_entries enable row level security;

drop policy if exists "public read trusted entries" on public.trusted_entries;
drop policy if exists "admins manage trusted entries" on public.trusted_entries;

create policy "public read trusted entries" on public.trusted_entries
  for select using (true);

create policy "admins manage trusted entries" on public.trusted_entries
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop trigger if exists trusted_entries_touch on public.trusted_entries;
create trigger trusted_entries_touch
  before update on public.trusted_entries
  for each row execute function public.touch_updated_at();

/*
 * The trusted list, curated entries first. `passes_checks` is computed from the
 * latest scan on every call and never stored, so an entry that stops passing
 * flips the moment it is rescanned.
 */
drop function if exists public.trusted_tokens(integer);

create or replace function public.trusted_tokens(
  p_limit           integer default 5,
  p_include_failing boolean default false
)
returns table (
  chain_id        integer,
  address         public.evm_address,
  name            text,
  symbol          text,
  curated         boolean,
  note            text,
  category        text,
  sort_position   integer,
  passes_checks   boolean,
  price_usd       numeric,
  change_24h      numeric,
  liquidity_usd   numeric,
  sell_tax        numeric,
  is_honeypot     boolean,
  source_verified boolean,
  scan_count      bigint,
  checked_at      timestamptz
)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select
      t.chain_id, t.address, t.name, t.symbol,
      e.chain_id is not null as curated,
      e.note, e.category, e.sort_position,
      coalesce(
        s.simulation_ok is true
        and s.is_honeypot is false
        and s.sell_tax is not null
        and s.sell_tax < 10
        and m.liquidity_usd >= 50000,
        false
      ) as passes_checks,
      m.price_usd, m.change_24h, m.liquidity_usd,
      s.sell_tax, s.is_honeypot, s.source_verified,
      t.scan_count, s.checked_at
    from public.tokens t
    left join public.trusted_entries e on e.chain_id = t.chain_id and e.address = t.address
    left join public.token_safety   s on s.chain_id = t.chain_id and s.address = t.address
    left join public.token_metrics  m on m.chain_id = t.chain_id and m.address = t.address
    where t.symbol <> '' or e.chain_id is not null
  )
  select * from base b
  where (b.curated or b.passes_checks)
    and (p_include_failing or b.passes_checks)
  order by b.curated desc,
           coalesce(b.sort_position, 2147483647) asc,
           b.liquidity_usd desc nulls last
  limit least(greatest(coalesce(p_limit, 5), 0), 200);
$$;

revoke execute on function public.trusted_tokens(integer, boolean) from public;
grant  execute on function public.trusted_tokens(integer, boolean) to anon, authenticated;
