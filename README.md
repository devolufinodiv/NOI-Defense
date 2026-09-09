# NOI Defense

Wallet and token intelligence for EVM chains. Turns raw on-chain data into
readable signal: token health scores, wallet P&L and win rate, early-buyer
discovery, relationship bubble maps, cohort overlap, tagging and alerts.

**Chains:** every supported EVM network — Ethereum, Base, Arbitrum, Optimism,
Polygon, BNB Chain, Avalanche, Scroll, zkSync, plus Sepolia testnets. The
registry in `src/config/chains.ts` is the only place a chain is named; adding one
is a single entry.

Network is chosen **at scan time**, not globally: the picker lives inside the
scan controls, and the chosen chain rides in the URL (`?chain=8453`) so a scan
link resolves to the same network for whoever opens it. Chain id is also part of
every query cache key — the same address is a different contract on a different
network.

### RPC configuration

Resolution order, per chain:

1. **`VITE_RPC_URL_<chainId>`** — per-chain override, always wins
   (`VITE_RPC_URL_1`, `VITE_RPC_URL_8453`, …). Collected by scanning the env
   object, so adding a network needs no code change.
2. **`VITE_RPC_URL`** — legacy single setting, applied to the **default chain
   only**. Pointing every network at one endpoint would serve one chain's data
   under another chain's name, which is worse than no override at all.
3. **Alchemy** — one `VITE_ALCHEMY_API_KEY` covers every network that has an
   endpoint.
4. **The chain's public RPC** — rate-limited, fine for development.

Explorers follow the same shape (`VITE_EXPLORER_URL_<chainId>`), defaulting to
each chain's own explorer from the registry.

The style guide's Environment panel prints which source each chain will actually
use — without it, a misconfigured override stays invisible until something
quietly reads the wrong network.

See **[BACKEND.md](BACKEND.md)** for the Supabase schema, edge functions and
deploy steps (written, not yet deployed).

**Status: landing page + Phase 0 (shell) + Phase 2 (token scanner).** Phase 1 — the real
indexer/Alchemy reads — is deliberately skipped for now: `src/features/token/api.ts`
is a mock adapter whose function signatures *are* the contract the real one must
satisfy, so Phase 1 is a file swap rather than a rewrite. Every figure on screen
comes from mock data and is marked with a `MOCK DATA` badge.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys; the app runs without them
npm run dev
```

Routes:

| Path | |
| --- | --- |
| `/` | Public landing page — no app chrome |
| `/dashboard` | Watchlist, alerts, featured scans — the **only** page with a top-bar search |
| `/token` · `/token/:address` | Paste-to-scan, then the scanner |
| `/wallet` · `/wallet/:address` | Paste-to-trace, then the trace |
| `/style-guide` | Visual contract for the whole product |

`/token` and `/wallet` ask for an address rather than auto-loading a sample —
dropping someone into a pre-scanned token they never asked for makes the tool
feel like a demo. The same paste-and-scan control (with its network picker) also
sits on the detail pages, so you can pivot without going back.

The top-bar search exists **only** on the dashboard. Everywhere else the scanner
owns that job, and a second, weaker search box in the chrome above it would be an
ambiguous duplicate.

| Script | |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | Types only |

> **Restart the dev server after editing `tailwind.config.js`.** Vite does not
> watch it in this setup, so new utilities silently fail to generate and you get
> unstyled elements with no error. This has bitten us twice.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite + React 18 + TypeScript |
| Styling | Tailwind CSS 3, custom theme only |
| Server state | TanStack Query |
| Client state | Zustand (persisted) |
| Chain reads | wagmi v2 + viem |
| Auth | Supabase Auth — Google OAuth |
| Routing | react-router-dom |
| Charts | Recharts, all defaults overridden |
| Graph | `react-force-graph-2d` |

### Why no wallet connect

The product signs in with **Google** (Supabase Auth), not a wallet, so RainbowKit
and WalletConnect were removed. wagmi stays for typed chain reads — the search
box calls `getCode` to tell a contract from an EOA before routing. Dropping the
wallet stack cut the bundle from 459KB to 318KB gzipped and removed the Reown
telemetry calls that logged 400/403 on every boot. Adding wallet sign-in back
later means adding connectors to `src/config/wagmi.ts`, not rewriting callers.

Sign-in degrades honestly: with no Supabase keys the button still renders and
explains what is missing rather than silently doing nothing.

### Why `react-force-graph-2d` over hand-rolled D3

Both were on the table; the deciding factors:

- **It is d3-force underneath.** Same simulation, same physics — so choosing it
  costs nothing in layout quality or control over forces.
- **Canvas, not SVG.** A counterparty map is thousands of nodes. SVG puts a DOM
  node per bubble and stops being interactive well before that; the canvas
  renderer stays smooth.
- **No loss of styling control.** `nodeCanvasObject` hands over the raw 2D
  context. Every node in `src/components/graph/BubbleMap.tsx` is drawn with our
  own design tokens — there is no library theme to fight.
- **Pan, zoom, hit-testing and drag are included**, which is most of what a
  from-scratch D3 build would actually cost.
- **Maintenance.** Actively released (1.29.x), and the maintainer owns the whole
  `force-graph` stack it sits on.

The `-2d` entrypoint is deliberate: the umbrella `react-force-graph` package
pulls three.js in for its 3D/VR renderers, which we do not want in the bundle.

## Design system

Direction: **chrome on black.** A neutral monochrome system with no hue in the
accent, so the only chromatic signals are semantic: green gain, red loss, amber
caution, plus token brand marks for identity.

- **Glass is the house surface in both modes.** `.glass-panel` layers a
  translucent gradient over a blurred backdrop with a top-lit hairline, drawn as
  a masked pseudo-element so the light falls off *down* the edge rather than
  ringing the box evenly. Light mode raises the opacity and softens the shadow —
  the same alpha that reads as depth on black reads as dirt on white. Falls back
  to a solid fill where `backdrop-filter` is unsupported.
- **Chrome type.** `.chrome-text` gives page titles a brushed-metal gradient via
  `background-clip: text`, with a solid-colour fallback so a heading can never
  vanish. Reserved for the page title — section headings stay solid, so the
  treatment marks hierarchy instead of becoming wallpaper.
- **Dropdowns are portalled.** `AnchoredPopover` renders menus into
  `document.body`. This is not over-engineering: `.glass-panel` sets
  `isolation: isolate` (required so its `z-index: -1` edge-ring stays behind the
  panel rather than behind the page), which creates a stacking context — an
  in-flow dropdown inside a glass surface gets painted over by later siblings
  and **no z-index can fix it**. Escaping to the body sidesteps every ancestor
  stacking context, transform and `overflow: hidden` at once.
- **One logo everywhere.** `src/components/brand/Logo.tsx` is a four-point chrome
  star used by the landing nav, the sidebar and the mobile top bar, so the mark
  cannot drift between marketing and app. Its gradient id is per-instance
  (`useId`) — duplicate SVG ids silently cross-wire their fills.

**Both light and dark are first-class.** Light is the `:root` default; dark
applies via `prefers-color-scheme` unless the user explicitly chose light, and
`data-theme` always wins over the OS. An inline script in `index.html` sets the
attribute before first paint so the page never flashes the wrong theme — it reads
the same `localStorage` key as `src/store/theme.ts`, so **change one, change
both**.

Tokens live in **`src/design/tokens.js`**, a single source of truth consumed by
both `tailwind.config.js` and application code (charts and the graph canvas need
raw hex at runtime). Change a colour there and it moves everywhere.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `bg-base` | `#08080A` | `#F4F4F6` | Page ground |
| `bg-surface` | `#0E0E11` | `#FFFFFF` | Sidebar, top bar |
| `bg-card` | `#131316` | `#FFFFFF` | Cards, panels |
| `bg-raised` | `#1B1B1F` | `#EDEDF1` | Hover, inputs, chips |
| `accent` | `#F5F5F7` | `#131316` | Primary action fill |
| `accent-on` | `#08080A` | `#FFFFFF` | Foreground on `accent` |
| `accent-text` | `#C9C9D1` | `#3A3A42` | Accent as text/icon |
| `positive` | `#3DD68C` | `#0F7B4F` | Gain **only** |
| `negative` | `#F2555F` | `#C0243A` | Loss **only** |
| `warning` | `#F0A93B` | `#8A5A00` | Caution **only** |
| `text-primary` | `#F5F5F7` | `#121214` | Body |
| `text-secondary` | `#A8A8B0` | `#55555E` | Supporting |
| `text-muted` | `#8A8A93` | `#67676F` | Tertiary |
| `border-hairline` | `#232327` | `#E3E3E8` | Separators |
| `chrome-0..3` | white → `#5A5A63` | `#101013` → `#9A9AA4` | Brushed-metal ramp |

Semantic colours are **re-picked per mode, never reused** — the dark-mode green
fails AA against white. **Every text/surface pairing in both modes is verified at
≥4.5:1**; the tightest is muted-on-raised (5.02 dark, 4.80 light). Re-run the
check whenever the palette changes rather than eyeballing contrast.

Tokens live in `src/design/tokens.js` and are emitted as CSS custom properties by
a small plugin in `tailwind.config.js`. Tailwind colours resolve to
`rgb(var(--c-x) / <alpha-value>)`, so opacity modifiers keep working and a theme
switch costs no re-render. Components styled with Tailwind should never import
the palette; only consumers that take colour as JS values — Recharts and the
force-graph canvas — use `useThemeTokens()`.

Type: **Inter** throughout, with tabular figures on all numeric data.
**JetBrains Mono** is reserved for hex — addresses and transaction hashes — which
must read as code and be matchable character by character. Prices are *not* mono:
they sit in the sans face at display weight, as in the reference.

Rules that are not negotiable:

- **Green, red and amber are semantic.** Gain, loss, caution. Never decoration.
- **Colour is never the only cue.** Every delta carries an arrow and an explicit
  `+`/`-` sign alongside its colour, so direction survives greyscale and
  colour-blindness.
- **Token brand colours are identity only** — never repurposed to encode
  gain/loss.
- **All numeric data is monospace and `tabular`** so digits align across rows and
  live values don't reflow when they tick.
- **Every on-chain identifier renders through `<HashRef />`** — truncated
  `0x1234…ab90`, with copy and an explorer link. No bare address strings.
- Radii: 16–20px for cards, 8–12px for controls, full round for status pills.
- **Glass is dark-mode only.** `.glass-panel` layers a translucent ash gradient
  over a blurred backdrop with a top-lit hairline (drawn as a masked
  pseudo-element so the light falls off down the edge instead of ringing the box).
  In light mode it collapses to a crisp opaque card — stacked translucency on
  white reads as muddy, not premium. It also falls back to a solid fill where
  `backdrop-filter` is unsupported.
- Backdrop blur is reserved for chrome and cards; it is a real cost on low-end
  GPUs, so it never goes on long scrolling lists.
- Depth comes from a top inner highlight, not drop shadows — surfaces read as lit
  by the page's single ambient source.
- Transitions are ~180ms and never bouncy. `prefers-reduced-motion` is honoured;
  the glow, scan and rise-in animations are all decorative and carry no meaning.
- Tables scroll inside their own container with a fade cue at the edge. The
  **page** never scrolls horizontally.
- Dark mode only in the MVP.

### Token amounts

`number` cannot hold an 18-decimal balance — `2^53` runs out around `9e15`.
So amounts are `bigint` base units end to end, and `src/lib/format.ts` does exact
integer/string math to render them. Fractions **truncate** rather than round up
(showing more than is held would be a correctness bug), and non-zero amounts that
truncate to zero render `<0.0001`. Never introduce a float into this path.

## Layout

```
src/
  design/tokens.js       design tokens — single source of truth
  config/                env, chain registry, wagmi, RainbowKit theme
  lib/                   formatting (bigint-safe) and class merging
  components/
    layout/              AppShell, Sidebar, TopBar, BottomTabBar
    ui/                  Button, Card, Badge, Stat, DataTable, HashRef, TokenMark, Skeleton
    charts/              PriceChart, Sparkline
    graph/               BubbleMap
    market/              CoinCard, TickerStrip
  components/
    auth/                SignInButton, GoogleIcon
    brand/               Logo, LogoMark — the shared chrome star
    scan/                ScanForm + ChainSelect — paste-and-scan, reused everywhere
  pages/
    landing/             Hero3D — CSS 3D parallax stage
  features/
    token/               Token scanner: types, mock adapter, query hooks,
                         HealthGauge, HealthBreakdown, HolderDistribution,
                         EarlyBuyers, LiveTrades, TokenNotIndexed
  pages/                 Dashboard, TokenDetail, WalletDetail, Compare, Alerts, StyleGuide
  store/                 Zustand stores
  mock/                  ⚠ scaffolding fixtures — delete in Phase 1
```

Responsive from day one: sidebar on `md+`, bottom tab bar below, safe-area
padding for the eventual Capacitor wrap.

## Mock data

`src/mock/` is scaffolding and is **deleted in Phase 1**. It follows strict rules
so it is never mistaken for chain truth:

- **Token contract addresses are real Base mainnet contracts** (WETH, USDC, AERO,
  DEGEN, cbETH) — verifiable on Basescan. Their *metrics* are synthetic.
- **Wallet addresses and tx hashes are synthetic** — deterministic sha256
  digests, correctly shaped but not real chain entities, so no behaviour is
  attributed to a real address.
- Anything rendering from it shows `<MockBadge />`.

## Environment

All variables are `VITE_`-prefixed, which means they are **bundled into the
client and publicly readable**. Only keys that are safe to expose (and
domain-restricted at the provider) belong in `.env.local`. Anything that must
stay secret — a Supabase `service_role` key, for instance — belongs on a server.

See `.env.example`. The app boots with an empty `.env`; the style guide's
Environment panel lists what is missing.

With no `VITE_WALLETCONNECT_PROJECT_ID`, RainbowKit still connects injected
wallets, but Reown's endpoints return 400/403 and log console noise on boot.
Setting a real project id clears it.
