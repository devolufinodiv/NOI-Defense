-- A bare auth.uid() in a policy is re-evaluated per row. Wrapping it in a
-- scalar subquery lets the planner hoist it to an InitPlan and evaluate it once
-- per statement — the difference shows up as soon as a user has a few thousand
-- rows. Flagged by the Supabase performance linter (0003_auth_rls_initplan).
drop policy "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy "own alerts" on public.alerts;
create policy "own alerts" on public.alerts
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- index_jobs.requested_by had no covering index; deleting an auth user would
-- otherwise force a sequential scan here to enforce the FK.
create index index_jobs_requested_by_idx on public.index_jobs (requested_by);
