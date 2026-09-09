-- Profiles, activity tracking, and the admin reporting surface.
-- Applied to project rzhnmtfhlpviiagrnsdo as `profiles_activity_and_admin`.

create type app_role as enum ('user', 'admin');

create table public.profiles (
  id           uuid      primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  avatar_url   text,
  role         app_role  not null default 'user',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Mirror new auth users into profiles. SECURITY DEFINER because the trigger
-- fires as the signing-up user, who has no rights on public.profiles.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create type activity_kind as enum (
  'sign_in', 'page_view', 'search',
  'token_scan', 'wallet_trace', 'index_request',
  'watchlist_add', 'watchlist_remove'
);

create table public.activity_events (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users (id) on delete set null,
  -- Signed-out sessions still count. A client-generated id measures unique
  -- anonymous sessions without attaching a name to them.
  anon_id      text,
  kind         activity_kind not null,
  chain_id     integer,
  subject      evm_address,
  subject_kind watch_kind,
  path         text,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index activity_recent_idx  on public.activity_events (created_at desc);
create index activity_kind_idx    on public.activity_events (kind, created_at desc);
create index activity_user_idx    on public.activity_events (user_id, created_at desc);
create index activity_subject_idx on public.activity_events (subject_kind, chain_id, subject)
  where subject is not null;

-- SECURITY DEFINER so it reads profiles without the caller needing rights,
-- which is also what stops the policy on profiles recursing into itself.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles        enable row level security;
alter table public.activity_events enable row level security;

create policy "read own profile" on public.profiles
  for select using ((select auth.uid()) = id or public.is_admin());

create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- A user may edit their own profile but must never promote themselves. RLS
-- cannot express "any column except role", so the guard is a trigger.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin may change a role';
  end if;
  return new;
end; $$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Anyone records their own activity, signed-out visitors included. The check
-- stops a client attributing events to somebody else.
create policy "insert own activity" on public.activity_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- The activity log is a record of what every user looked at, so ordinary users
-- get no select policy at all.
create policy "admins read activity" on public.activity_events
  for select using (public.is_admin());

-- Admin reporting lives in SECURITY DEFINER functions rather than views: each
-- re-checks is_admin() itself, so the aggregates are unreachable without it.
-- (Bodies as applied — see the project migration history for the full text.)
