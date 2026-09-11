-- Records whether the market lookup actually completed for this scan.
-- Without it the cached verdict cannot tell "we checked and found no pools"
-- apart from "the lookup timed out", and replayed the former for both.
-- NULL means the row predates this column: unknown, which is the honest answer.
alter table public.token_safety
  add column if not exists market_checked boolean;

comment on column public.token_safety.market_checked is
  'True when the market lookup completed. NULL = unknown (row predates the column).';
