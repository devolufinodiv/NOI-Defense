-- Postgres grants EXECUTE to PUBLIC by default, which PostgREST turns into a
-- callable /rpc/ endpoint for every function in the exposed schema. Trigger
-- functions have no business being reachable that way, and admin reports should
-- not be callable by anonymous visitors at all — the internal is_admin() check
-- is a second line of defence, not the only one.

revoke execute on function public.handle_new_user()    from public, anon, authenticated;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;
revoke execute on function public.touch_updated_at()   from public, anon, authenticated;

revoke execute on function public.admin_overview()                                        from public, anon;
revoke execute on function public.admin_top_subjects(public.watch_kind, integer, integer) from public, anon;
revoke execute on function public.admin_activity_daily(integer)                           from public, anon;
revoke execute on function public.admin_recent_activity(integer)                          from public, anon;
revoke execute on function public.admin_users(integer)                                    from public, anon;

grant execute on function public.admin_overview()                                        to authenticated;
grant execute on function public.admin_top_subjects(public.watch_kind, integer, integer) to authenticated;
grant execute on function public.admin_activity_daily(integer)                           to authenticated;
grant execute on function public.admin_recent_activity(integer)                          to authenticated;
grant execute on function public.admin_users(integer)                                    to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;
