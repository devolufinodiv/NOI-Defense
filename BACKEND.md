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

The worker lives in **`worker/`** and is built. It needs a long-running host — a
small container, a Railway/Fly service, a systemd unit — not an edge function.

```bash
cd worker
cp .env.example .env      # add SUPABASE_SERVICE_ROLE_KEY and ALCHEMY_API_KEY
npm install
npm start                 # or `npm run once` to drain a single job and exit
```

It holds the **service role key**, which bypasses RLS entirely. Never run it in
a browser and never bundle it into the frontend.

### What it does per job

1. Reads ERC-20 metadata. `name`/`symbol` are optional in the standard and some
   real tokens revert or return bytes32, so each is read independently and
   degrades to a default rather than failing the job.
2. Locates the deployment block by **binary search on `getCode`** — bytecode
   presence is monotonic, so ~25 calls pin it exactly on any chain.
3. Walks `Transfer` logs. The `eth_getLogs` span **self-tunes**: it halves on
   failure down to a single block and grows back on success. A fixed floor was
   wrong — "response too large" is a range error, and Base WETH blows the limit
   at under 400 blocks.
4. Derives holders, early buyers, health factors; writes them and marks the job
   ready.

### Concurrency and failure

`claim_index_job` uses `FOR UPDATE SKIP LOCKED`, so N workers can run without
ever being handed the same job and without one slow worker blocking the queue.
A 30s heartbeat keeps `reap_stalled_index_jobs` from reclaiming live work; a
worker that dies leaves a job that the reaper returns to `pending`, or fails
after three attempts. SIGTERM drains the job in flight rather than stranding a
half-written token.

### The honesty rule

`MAX_BLOCK_LOOKBACK` bounds each job so one ancient, busy token can't monopolise
the worker. When the walk is capped, the derived balances are **net flow over the
window, not balances** — an address that held throughout and moved nothing does
not appear at all.

So on a partial walk the worker **omits holder concentration and holder count
entirely** and says why in `data-coverage`, rather than publishing a "top 10 hold
79%" figure that is confidently wrong. Early buyers are skipped for the same
reason. Raise the lookback past the token's age to get the full picture.

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

## Deploying the frontend (Netlify)

`netlify.toml` is committed. Connect the repo in Netlify and it picks up the
build command, publish directory and Node version automatically.

**Set the environment variables in the Netlify UI** — they are build-time
(`VITE_*` is inlined by Vite), so a change needs a redeploy, not just a save:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://rzhnmtfhlpviiagrnsdo.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the publishable key |
| `VITE_ALCHEMY_API_KEY` | optional but strongly recommended |
| `VITE_CHAIN_ID` | `8453` |

Then add the deployed origin in three places, or sign-in will fail:
Supabase **URL Configuration** (Site URL + redirect), Google Cloud
**Authorized JavaScript origins**, and Google **Authorized redirect URIs**.

### Two things in netlify.toml worth knowing

**The SPA rewrite is load-bearing.** `/token/:address` and friends exist only in
the router. Without `/* → /index.html 200`, a shared scan link or a refresh
returns 404 — and shared links are the point.

**The CSP allow-lists the inline theme script by sha256.** That script must run
before first paint to avoid a wrong-theme flash, and a hash keeps
`'unsafe-inline'` out of `script-src` entirely. Editing it changes the hash, so
`npm run build` runs `scripts/check-csp-hash.mjs`, which fails the build and
prints the replacement value. A dev server sends no CSP, so without that check
the breakage would only appear in production.

`connect-src` is deliberately broad (`https:`). RPC endpoints are configurable
per chain via `VITE_RPC_URL_<chainId>`, so a hardcoded allow-list would break
chain reads the moment someone changed provider. The directives that actually
stop XSS and clickjacking stay locked down.
