-- ─────────────────────────────────────────────────────────────────────────────
-- NOI Defense — initial schema
--
-- Conventions that matter here:
--
--  * Token amounts are NUMERIC(78,0), never bigint. A uint256 base-unit amount
--    is up to 78 digits; bigint tops out at 19 and would silently truncate
--    real balances. This mirrors the BigInt discipline on the client.
--  * Every on-chain row is keyed by (chain_id, address). The same address is a
--    different contract on a different network, so chain_id is never optional.
--  * Addresses are stored lowercase and constrained to the 0x + 40 hex shape,
--    so lookups never depend on checksum casing.
--  * USD figures are NUMERIC too — they are money, and float rounding on money
--    is a defect waiting to be filed.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Reusable domain so the shape check lives in one place.
create domain evm_address as text
  check (value ~ '^0x[0-9a-f]{40}$');

create domain evm_tx_hash as text
  check (value ~ '^0x[0-9a-f]{64}$');

create type index_status as enum ('pending', 'running', 'ready', 'failed');
create type hold_status  as enum ('holding', 'partial', 'sold');
create type trade_side   as enum ('buy', 'sell');
create type factor_status as enum ('pass', 'warn', 'fail');
create type alert_severity as enum ('critical', 'warning', 'info');
create type watch_kind as enum ('token', 'wallet');

-- ── Tokens ───────────────────────────────────────────────────────────────────

create table public.tokens (
  chain_id      integer      not null,
  address       evm_address  not null,
  symbol        text         not null default '',
  name          text         not null default '',
  decimals      smallint     not null default 18 check (decimals between 0 and 36),
  logo_url      text,
  verified      boolean      not null default false,
  created_at_block bigint,
  deployed_at   timestamptz,
  index_status  index_status not null default 'pending',
  indexed_at    timestamptz,
  index_error   text,
  inserted_at   timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  primary key (chain_id, address)
);

-- Latest computed metrics. One row per token; history lives in token_metric_history.
create table public.token_metrics (
  chain_id      integer     not null,
  address       evm_address not null,
  price_usd     numeric(38,18),
  change_24h    numeric(10,4),
  market_cap_usd numeric(38,2),
  liquidity_usd numeric(38,2),
  holder_count  integer,
  total_supply  numeric(78,0),
  health_score  smallint    check (health_score between 0 and 100),
  computed_at   timestamptz not null default now(),
  primary key (chain_id, address),
  foreign key (chain_id, address) references public.tokens (chain_id, address) on delete cascade
);

create table public.token_health_factors (
  chain_id    integer       not null,
  address     evm_address   not null,
  factor_id   text          not null,
  score       smallint      not null check (score between 0 and 100),
  status      factor_status not null,
  detail      text          not null default '',
  computed_at timestamptz   not null default now(),
  primary key (chain_id, address, factor_id),
  foreign key (chain_id, address) references public.tokens (chain_id, address) on delete cascade
);

create table public.token_holders (
  chain_id    integer     not null,
  address     evm_address not null,
  holder      evm_address not null,
  rank        smallint    not null,
  balance     numeric(78,0) not null,
  pct_supply  numeric(9,6) not null,
  label       text,
  is_contract boolean     not null default false,
  computed_at timestamptz not null default now(),
  primary key (chain_id, address, holder),
  foreign key (chain_id, address) references public.tokens (chain_id, address) on delete cascade
);

create index token_holders_rank_idx
  on public.token_holders (chain_id, address, rank);

create table public.token_early_buyers (
  chain_id      integer     not null,
  address       evm_address not null,
  rank          smallint    not null,
  wallet        evm_address not null,
  tx_hash       evm_tx_hash not null,
  bought_at     timestamptz not null,
  amount        numeric(78,0) not null,
  buy_price_usd numeric(38,18),
  status        hold_status not null,
  remaining_pct numeric(5,2) not null default 0,
  primary key (chain_id, address, rank),
  foreign key (chain_id, address) references public.tokens (chain_id, address) on delete cascade
);

create table public.token_trades (
  chain_id   integer     not null,
  address    evm_address not null,
  tx_hash    evm_tx_hash not null,
  log_index  integer     not null,
  wallet     evm_address not null,
  side       trade_side  not null,
  amount     numeric(78,0) not null,
  value_usd  numeric(38,2),
  block_number bigint    not null,
  occurred_at timestamptz not null,
  -- (tx_hash, log_index) is the only truly unique pair: one transaction can
  -- contain several trades of the same token.
  primary key (chain_id, tx_hash, log_index),
  foreign key (chain_id, address) references public.tokens (chain_id, address) on delete cascade
);

-- The live feed always reads "latest N for this token", so order the index that way.
create index token_trades_recent_idx
  on public.token_trades (chain_id, address, occurred_at desc);

-- ── Indexing jobs ────────────────────────────────────────────────────────────

-- Walking a token from its creation block is long-running work and cannot run
-- inside an edge function's request timeout. The function enqueues here and a
-- worker drains the queue.
create table public.index_jobs (
  id           uuid         primary key default gen_random_uuid(),
  chain_id     integer      not null,
  address      evm_address  not null,
  status       index_status not null default 'pending',
  requested_by uuid         references auth.users (id) on delete set null,
  attempts     smallint     not null default 0,
  error        text,
  requested_at timestamptz  not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

-- At most one live job per token: a partial unique index, so completed jobs
-- stay as history while re-queuing a busy token is rejected.
create unique index index_jobs_active_uniq
  on public.index_jobs (chain_id, address)
  where status in ('pending', 'running');

create index index_jobs_queue_idx
  on public.index_jobs (status, requested_at)
  where status = 'pending';

-- ── Per-user data ────────────────────────────────────────────────────────────

create table public.watchlist (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       watch_kind  not null,
  chain_id   integer     not null,
  address    evm_address not null,
  label      text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, chain_id, address)
);

create index watchlist_user_idx on public.watchlist (user_id, created_at desc);

create table public.alerts (
  id           uuid           primary key default gen_random_uuid(),
  user_id      uuid           not null references auth.users (id) on delete cascade,
  severity     alert_severity not null default 'info',
  title        text           not null,
  detail       text           not null default '',
  chain_id     integer        not null,
  subject      evm_address    not null,
  subject_kind watch_kind     not null,
  read_at      timestamptz,
  created_at   timestamptz    not null default now()
);

create index alerts_user_idx on public.alerts (user_id, created_at desc);
create index alerts_unread_idx on public.alerts (user_id) where read_at is null;

-- ── Row level security ───────────────────────────────────────────────────────

alter table public.tokens               enable row level security;
alter table public.token_metrics        enable row level security;
alter table public.token_health_factors enable row level security;
alter table public.token_holders        enable row level security;
alter table public.token_early_buyers   enable row level security;
alter table public.token_trades         enable row level security;
alter table public.index_jobs           enable row level security;
alter table public.watchlist            enable row level security;
alter table public.alerts               enable row level security;

-- On-chain data is public information; anyone may read it. Writes are reserved
-- for the service role (the indexer), which bypasses RLS entirely — so there is
-- deliberately no insert/update policy on these tables.
create policy "public read tokens"    on public.tokens               for select using (true);
create policy "public read metrics"   on public.token_metrics        for select using (true);
create policy "public read factors"   on public.token_health_factors for select using (true);
create policy "public read holders"   on public.token_holders        for select using (true);
create policy "public read buyers"    on public.token_early_buyers   for select using (true);
create policy "public read trades"    on public.token_trades         for select using (true);

-- Job status is public (the UI shows "indexing…"), but only the edge function
-- running as service role may enqueue.
create policy "public read jobs" on public.index_jobs for select using (true);

-- Per-user tables: owner-only, all verbs.
create policy "own watchlist" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own alerts" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Housekeeping ─────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
-- Empty search_path: an unqualified name inside a SECURITY DEFINER-style
-- function is a known privilege-escalation vector.
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tokens_touch_updated_at
  before update on public.tokens
  for each row execute function public.touch_updated_at();
