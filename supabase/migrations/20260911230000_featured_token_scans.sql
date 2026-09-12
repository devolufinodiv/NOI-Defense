-- Featured token scans, driven by what people actually scan.
--
-- The dashboard section used to render fixtures from src/mock, including a
-- fabricated price sparkline. Everything here is measured instead: how often a
-- token was scanned on this app, and the figures the scan itself recorded.

-- How many times this token has been scanned, and when last.
alter table public.tokens
  add column if not exists scan_count      bigint not null default 0,
  add column if not exists last_scanned_at timestamptz;

comment on column public.tokens.scan_count is
  'Times this token has been scanned on the app, counted server-side. Cache hits count: the user still asked for it.';

-- Every row in this table got here by being scanned at least once, so a row
-- that predates the counter is worth exactly 1, not 0.
update public.tokens
   set scan_count = 1,
       last_scanned_at = coalesce(last_scanned_at, indexed_at, updated_at)
 where scan_count = 0;

create index if not exists tokens_most_scanned_idx
  on public.tokens (scan_count desc, last_scanned_at desc nulls last);

/*
 * Atomic increment, called by the scan edge function on every request.
 *
 * Revoked from anon and authenticated: a counter that decides what the whole
 * app features must only be writable by the server, never by whoever wants to
 * see their own token on the dashboard.
 */
create or replace function public.record_token_scan(
  p_chain_id integer,
  p_address  public.evm_address
)
returns void language sql security definer set search_path = '' as $$
  insert into public.tokens (chain_id, address, scan_count, last_scanned_at)
  values (p_chain_id, p_address, 1, now())
  on conflict (chain_id, address) do update
    set scan_count      = public.tokens.scan_count + 1,
        last_scanned_at = now();
$$;

revoke execute on function public.record_token_scan(integer, public.evm_address)
  from public, anon, authenticated;
grant execute on function public.record_token_scan(integer, public.evm_address)
  to service_role;

/*
 * Admin pins.
 *
 * The foreign key to tokens is deliberate: an address can only be featured once
 * it has actually been scanned, so a featured card always has real data behind
 * it rather than an empty shell someone pasted in.
 */
create table if not exists public.featured_tokens (
  chain_id   integer            not null,
  address    public.evm_address not null,
  position   integer            not null default 0,
  note       text,
  added_by   uuid               references auth.users (id) on delete set null,
  created_at timestamptz        not null default now(),
  primary key (chain_id, address),
  foreign key (chain_id, address)
    references public.tokens (chain_id, address) on delete cascade
);

alter table public.featured_tokens enable row level security;

drop policy if exists "public read featured"   on public.featured_tokens;
drop policy if exists "admins manage featured" on public.featured_tokens;

create policy "public read featured" on public.featured_tokens
  for select using (true);

create policy "admins manage featured" on public.featured_tokens
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

/*
 * The resolved featured list: admin pins first, in their own order, then the
 * most-scanned tokens filling the remaining slots.
 *
 * security invoker — tokens, token_metrics, token_safety and featured_tokens
 * are all public-read, so this needs no elevated rights and adds no new
 * surface. `pinned` is returned so the UI can say why a card is there.
 *
 * Auto-filled entries need a symbol to render as a card at all; a token the
 * market has never named would show as a blank tile. An admin pin always shows,
 * because that is an explicit choice rather than a ranking artefact.
 */
create or replace function public.featured_token_scans(p_limit integer default 6)
returns table (
  chain_id        integer,
  address         public.evm_address,
  name            text,
  symbol          text,
  verified        boolean,
  pinned          boolean,
  scan_count      bigint,
  last_scanned_at timestamptz,
  price_usd       numeric,
  change_24h      numeric,
  liquidity_usd   numeric,
  volume_24h_usd  numeric,
  pair_count      integer,
  is_honeypot     boolean,
  sell_tax        numeric,
  source_verified boolean,
  checked_at      timestamptz
)
language sql stable security invoker set search_path = '' as $$
  with ranked as (
    select
      t.chain_id, t.address, t.name, t.symbol, t.verified,
      f.chain_id is not null as pinned,
      t.scan_count, t.last_scanned_at,
      row_number() over (
        order by (f.chain_id is not null) desc,
                 coalesce(f.position, 2147483647) asc,
                 t.scan_count desc,
                 t.last_scanned_at desc nulls last,
                 t.indexed_at desc nulls last
      ) as rn
    from public.tokens t
    left join public.featured_tokens f
      on f.chain_id = t.chain_id and f.address = t.address
    where t.index_status = 'ready'
      and (f.chain_id is not null or t.symbol <> '')
  )
  select
    r.chain_id, r.address, r.name, r.symbol, r.verified, r.pinned,
    r.scan_count, r.last_scanned_at,
    m.price_usd, m.change_24h, m.liquidity_usd, m.volume_24h_usd, m.pair_count,
    s.is_honeypot, s.sell_tax, s.source_verified, s.checked_at
  from ranked r
  left join public.token_metrics m on m.chain_id = r.chain_id and m.address = r.address
  left join public.token_safety  s on s.chain_id = r.chain_id and s.address = r.address
  where r.rn <= least(greatest(coalesce(p_limit, 6), 0), 24)
  order by r.rn;
$$;

revoke execute on function public.featured_token_scans(integer) from public;
grant  execute on function public.featured_token_scans(integer) to anon, authenticated;
