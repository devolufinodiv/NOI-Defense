# Backend

Supabase: Postgres + Auth (Google) + Edge Functions.

**Status: deployed.**

| | |
| --- | --- |
| Project | `noi-defense` (`rzhnmtfhlpviiagrnsdo`) |
| Org / region | `finodiv` / `eu-west-1` |
| URL | `https://rzhnmtfhlpviiagrnsdo.supabase.co` |
| Functions | `token-scan` (anon), `index-token` (JWT) |

Credentials are already in `.env.local` (gitignored).

### Two things still to do by hand

1. **Enable Google auth.** Dashboard → Authentication → Providers → Google.
   Add your Google OAuth client id/secret and list `http://localhost:5173` and
   your production origin as redirect URLs. Nothing can sign in until this is on.
2. **Make yourself an admin.** No admin exists yet, and a user cannot promote
   themselves — `guard_profile_role` raises if a non-admin changes a role. Sign
   in once, then run this in the SQL editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

### Tightening CORS before production

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-domain,http://localhost:5173
```

With this unset the functions answer `*`, which is fine for anon reads and local
work but should be pinned before launch.

## Shape

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /token-scan` | anon | Scanner payload. `section=` narrows it so the 15s trade poll doesn't refetch holders. |
| `POST /index-token` | signed in | Enqueues a job, returns `202` + job id. |

`token-scan` returns `404 { code: 'not_indexed' }` for an unknown contract. That
is a **terminal** answer, not a transient failure — the client already treats it
that way and shows the "Index this token" action instead of retrying.

## Why indexing is a queue, not a function

`index-token` enqueues and returns immediately. It does not do the work.

Walking a contract from its creation block takes minutes; an edge function has a
wall-clock limit measured in seconds. Doing it inline would fail on exactly the
tokens people most want scanned — the old, busy ones. A worker drains
`index_jobs` instead, and `index_jobs_active_uniq` (a partial unique index over
`status in ('pending','running')`) guarantees one live job per token while
letting completed jobs remain as history.

**The worker is the next piece to build** and is not written yet. It needs a
long-running host — a small container, a Railway/Fly service, or a scheduled
GitHub Action — not an edge function.

## Analytics and admin

Every interaction lands in `activity_events`: `token_scan`, `wallet_trace`,
`search`, `index_request`, `sign_in`, and watchlist changes. Signed-out visitors
are counted too, via a random per-browser `anon_id` in localStorage — it groups
sessions without attaching a name to anyone.

The client tracker is fire-and-forget by design. Analytics must never delay or
break the action it is measuring, so every failure path is swallowed: a dropped
metric is an acceptable loss, a broken scan is not.

`/admin` reads five SECURITY DEFINER RPCs — `admin_overview`,
`admin_top_subjects`, `admin_activity_daily`, `admin_recent_activity`,
`admin_users`. Each re-checks `is_admin()` internally, so hiding the nav link is
presentation only; unhiding it still yields `42501` from every query.

Leaderboards count **distinct people**, not distinct rows. One user refreshing
fifty times is one interested party, and conflating them would rank noise to the
top of "most searched".

## Data rules

- **Amounts are `NUMERIC(78,0)`, never `bigint`.** A uint256 base-unit amount is
  up to 78 digits; `bigint` tops out at 19 and would silently truncate real
  balances. USD figures are `NUMERIC` too — float rounding on money is a defect
  waiting to be filed. Values arrive at the client as strings and are parsed to
  `BigInt`, never through a float.
- **Every on-chain row is keyed by `(chain_id, address)`.** The same address is a
  different contract on a different network.
- **Addresses are stored lowercase**, shape-checked by the `evm_address` domain.
  Checksum casing is a transport hint, not part of the address.

## RLS

On-chain tables are world-readable (it is public information) with **no write
policy at all** — the indexer writes as service role, which bypasses RLS. That
is deliberate: there is no path for a browser client to write token data.

`watchlist` and `alerts` are owner-only via `auth.uid() = user_id` on both
`using` and `with check`.
