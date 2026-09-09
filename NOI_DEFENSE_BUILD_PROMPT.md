# NOI DEFENSE — Claude Code Build Prompt

Use this document phase by phase. Paste one phase at a time into Claude Code as its own prompt/session. Each phase assumes the previous one is complete and committed. Do not skip ahead — each phase builds on the data/contracts from the last.

---

## PROJECT BRIEF (paste this once at the start of every new session for context)

**Product:** NOI Defense — a wallet + token intelligence and investigation platform for EVM chains. It turns raw on-chain data into human-readable insights: token health scores, wallet P&L/win-rate, early-buyer discovery, wallet relationship bubble maps, Venn-diagram overlap comparisons, wallet tagging, and transaction alerts.

**Target chain for MVP:** Base (fast, cheap, EVM-compatible, good Alchemy support). Architecture must stay chain-agnostic so more chains can be added later.

**Positioning:** NOT a typical pastel crypto dashboard. This is a security/investigation tool — think dark, precise, forensic, data-dense but legible. Ultramodern, technical, confident.

**Non-negotiables:**
- Mobile-responsive from day one (web app now, wrapped into iOS/Android later via Capacitor)
- Real wallet addresses and transaction hashes everywhere — never fabricate placeholder blockchain data; use real testnet/mainnet data or clearly marked mock data during scaffolding
- All monetary/token amounts must handle big numbers correctly (use BigInt / a decimal library — never plain JS floats for token math)

---

## GLOBAL DESIGN SYSTEM (apply in every phase, no exceptions)

Give Claude Code this design language explicitly in every phase's prompt:

```
Visual direction: "Forensic dark mode" — ultramodern security/intelligence tool aesthetic.

COLOR:
- Background: near-black, #0A0B0D base, with #12141A elevated surfaces (cards, panels)
- Primary accent: electric cyan #00E0FF (used sparingly — CTAs, active states, key data points, links)
- Secondary accent: signal red #FF3B4E ONLY for risk/danger/loss indicators (never decorative)
- Tertiary accent: signal green #00FFA3 ONLY for gains/positive/safe indicators
- Text: #E8EAED primary, #8A8F98 secondary/muted
- Borders/dividers: #1F2229, hairline only, no heavy borders
- NEVER use default Tailwind blue/purple/gradient-hero styling — this must not look like a generic SaaS template

TYPOGRAPHY:
- Headings: a technical/geometric sans — Space Grotesk or Inter Tight
- Numeric/data/addresses/hashes: a monospace font — JetBrains Mono or IBM Plex Mono (critical: all wallet addresses, tx hashes, token amounts, percentages MUST use monospace so digits align and truncated hashes read as "code," not prose)
- Tight letter-spacing on headings, generous line-height on body

LAYOUT:
- Dense information design, but with clear visual hierarchy — think Bloomberg terminal meets modern fintech, not a marketing landing page
- Cards have 1px hairline borders, subtle inner glow on hover, NOT heavy shadows
- Use grid layouts for data-heavy screens; avoid centered single-column "app" layouts for dashboards
- Micro-interactions: subtle glow/pulse on live-updating data (e.g. a wallet that just transacted), skeleton loaders that look like scanning/decoding animations, not generic shimmer bars
- Truncate addresses as 0x1234...ab90 format everywhere, always with a copy-to-clipboard icon and a "view on explorer" link
- Charts: no default recharts styling — dark background, cyan/red/green line colors matching the palette above, minimal gridlines

MOTION:
- Fast, purposeful transitions (150-200ms), no bouncy easing
- Data that updates live should have a brief flash/glow, not a jarring layout shift

DO NOT:
- Use stock crypto-dashboard clichés (neon purple gradients, generic "Web3" hero sections, cartoon mascots)
- Use light mode anywhere in MVP
- Use rounded-full pill buttons everywhere — mix sharp/slightly-rounded (4-6px radius) for a more technical feel
```

Paste this design system block into every phase prompt so the UI stays consistent across sessions.

---

## PHASE 0 — Project scaffolding & design system setup

**Goal:** Empty but fully configured project with the design system live as a component library / style guide page.

**Prompt to give Claude Code:**

```
Set up a new React + Vite + TypeScript project called "noi-defense".

Stack:
- React 18 + Vite + TypeScript
- Tailwind CSS (configure custom theme with the exact color tokens, fonts, and radius values from the design system below — do not use default Tailwind palette)
- TanStack Query for data fetching
- Zustand for global state
- wagmi v2 + viem for wallet connection and chain reads
- RainbowKit for wallet connect UI (restyle it to match our dark theme, do not ship default RainbowKit styling)
- react-router-dom for routing
- Recharts for line charts
- react-force-graph or D3 force-directed graph for the bubble map (research and pick the better-maintained option, tell me which you chose and why)

[PASTE GLOBAL DESIGN SYSTEM BLOCK HERE]

Deliverables for this phase:
1. Configure Tailwind theme.extend with our exact colors as named tokens (bg-base, bg-elevated, accent-cyan, accent-red, accent-green, text-primary, text-muted, border-hairline)
2. Set up Space Grotesk + JetBrains Mono via Google Fonts or self-hosted, wired into Tailwind fontFamily config
3. Build a /style-guide route showing: color swatches, type scale, button variants (primary/secondary/danger), card component, a mock data table with monospace addresses, a mock line chart, a loading skeleton
4. Set up base layout shell: left sidebar nav (collapsed on mobile into bottom tab bar), top bar with wallet connect button
5. Set up routing skeleton for: /dashboard, /token/:address, /wallet/:address, /compare, /alerts — pages can be empty placeholders for now
6. Configure environment variables structure for Alchemy API key, chain RPC URL, Supabase URL/key (don't hardcode any keys, use .env.example)

Do not build any real data-fetching logic yet — this phase is pure scaffolding + design system + navigation shell. Confirm the style guide page renders correctly before moving on.
```

---

## PHASE 1 — Data infrastructure (backend/indexing)

**Goal:** Working backend that can pull and store real on-chain data.

**Prompt to give Claude Code:**

```
[PASTE GLOBAL DESIGN SYSTEM BLOCK — for context only, no UI in this phase]

We're building the data layer for NOI Defense, a wallet/token intelligence tool on Base chain.

Set up:
1. Supabase project schema (write the SQL migration files) with these tables:
   - tokens (address, name, symbol, decimals, creation_block, creation_tx_hash, deployer_address, created_at)
   - wallets (address, first_seen_block, tags jsonb, notes, created_at)
   - transactions (tx_hash, block_number, timestamp, from_address, to_address, token_address, amount, price_usd_at_time, tx_type enum[buy/sell/transfer])
   - wallet_token_positions (wallet_address, token_address, total_bought, total_sold, avg_buy_price, avg_sell_price, realized_pnl, unrealized_pnl, is_open)
   - wallet_tags (wallet_address, tag_label, created_by, created_at)
   - alerts_subscriptions (wallet_address, notify_email, created_at)
   Add appropriate indexes on address columns and foreign keys.

2. A Node.js (TypeScript) worker service, separate from the frontend, that:
   - Connects to Alchemy's API for Base chain (use their Transfers API / enhanced APIs)
   - Given a token address, fetches full transfer history from creation block, paginated
   - Given a wallet address, fetches full transaction history
   - Writes normalized data into the Supabase tables above
   - Exposes this as a small internal REST API (Express or Fastify) with endpoints:
     - POST /index/token/:address — triggers full indexing of a token
     - POST /index/wallet/:address — triggers full indexing of a wallet
     - GET /token/:address/status — indexing progress
   - Include rate-limit handling and retry logic for Alchemy API calls (respect their rate limits, use exponential backoff)

3. A cost-basis P&L calculation module (pure function, unit-testable):
   - Input: chronological list of buy/sell transactions for a wallet+token pair
   - Output: realized P&L, unrealized P&L (needs current price), win/loss per closed position
   - Use FIFO accounting method
   - Use a decimal library (decimal.js) — never native JS floats for these calculations
   - Write unit tests covering: simple buy-then-sell, partial sells, multiple buys at different prices, a position that's still fully open

4. A token health score module (pure function):
   - Inputs: holder count, top-10-holder concentration %, liquidity depth, contract verified (bool), ownership renounced (bool), LP locked (bool), buy/sell tax %
   - Output: 0-100 score + a breakdown object showing each factor's contribution
   - Document your weighting logic in comments

Give me the migration SQL, the worker service code, and the P&L + health score modules with tests. Do not build frontend UI yet.
```

---

## PHASE 2 — Token Scanner UI

**Goal:** Full token detail page, wired to real indexed data.

**Prompt to give Claude Code:**

```
[PASTE GLOBAL DESIGN SYSTEM BLOCK]

Build the Token Scanner page at /token/:address for NOI Defense. This consumes the backend from Phase 1.

Layout requirements:
1. Header section: token name/symbol, truncated contract address (monospace, copy button, explorer link), current price, market cap, a large token health score (0-100) rendered as a circular gauge in cyan/red/green depending on score tier — this is the visual anchor of the page
2. Health score breakdown panel: each contributing factor (holder concentration, liquidity, ownership, tax, etc.) as its own row with a mini progress bar and pass/fail/warning icon
3. Holder distribution: a horizontal bar chart showing top 10 holders as % of supply, monospace addresses, click-through to /wallet/:address
4. "Early Buyers" panel: table of the first 20-30 buy transactions from creation block — columns: rank, wallet (truncated, clickable), buy timestamp, amount bought, buy price, current status badge (Still Holding / Sold / Partial Exit) — status badge colored green/red/amber
5. Recent transactions feed: live-updating (poll every 15s via TanStack Query, don't need websockets yet) list of latest buys/sells, each row shows tx hash (truncated, link to explorer), wallet, amount, direction (buy=green arrow up, sell=red arrow down)
6. A search bar at the top of the app shell (if not already built) that accepts a token contract address and routes here

Handle loading states with the scanning/decoding-style skeleton from our design system, and empty/error states clearly (e.g. "Token not yet indexed" with a button to trigger indexing via POST /index/token/:address).

Make this fully responsive — on mobile, the health gauge and breakdown stack vertically, tables become scrollable cards.
```

---

## PHASE 3 — Wallet Scanner UI

**Goal:** Full wallet detail page with P&L, win rate, and line chart.

**Prompt to give Claude Code:**

```
[PASTE GLOBAL DESIGN SYSTEM BLOCK]

Build the Wallet Scanner page at /wallet/:address for NOI Defense, consuming the P&L engine from Phase 1.

Layout requirements:
1. Header: truncated wallet address (monospace, copy, explorer link), wallet age (first seen date), a wallet health score gauge (reuse the gauge component pattern from the token page but restyle its factors for wallet risk — e.g. rug exposure count, diversity, activity pattern)
2. Key stats row: total realized P&L (green/red colored number), total unrealized P&L, win rate % (large stat), total positions closed, total positions open
3. Cumulative P&L line chart over time — this is the centerpiece. Use Recharts, styled per our design system (dark bg, cyan line for cumulative P&L, red/green fill under the line depending on whether it's currently positive or negative). X-axis = time, Y-axis = cumulative $ P&L. Add a horizontal zero-line marker.
4. Positions table: every token this wallet has traded — columns: token (logo+symbol, clickable to /token/:address), status (open/closed), entry price, exit price (if closed), realized/unrealized P&L, hold duration
5. A "Tag this wallet" control near the header — input + tag chips (reuse from wallet_tags table), and a "Watch for alerts" toggle that calls the alerts_subscriptions endpoint (build a simple POST endpoint for this in the Phase 1 worker service if not already there)
6. Recent activity feed similar to the token page's transaction feed, but scoped to this wallet across all tokens

Responsive behavior: stats row becomes a 2-column grid on mobile, chart stays full-width, positions table becomes stacked cards.
```

---

## PHASE 4 — Relationship mapping (bubble map + Venn compare)

**Goal:** The signature visualization feature.

**Prompt to give Claude Code:**

```
[PASTE GLOBAL DESIGN SYSTEM BLOCK]

Build two visualization features for NOI Defense:

1. BUBBLE MAP — accessible from the token page ("View wallet network" button) and as its own view.
   - Use [the force-graph library chosen in Phase 0]
   - Nodes = wallets involved in this token's trading, node radius = scaled by total volume/balance, node color = green (net profit) / red (net loss) / gray (neutral or unclear)
   - Edges = direct transfers between wallets, edge thickness = scaled by transfer volume
   - Detect and visually highlight clusters of wallets that share a funding source (e.g. all funded from the same address within N blocks of each other) — draw a subtle dashed boundary or shared color tint around clustered nodes, with a label like "Cluster: funded by 0xABC...123"
   - Clicking a node opens a small popover with wallet summary + link to full /wallet/:address page
   - Must perform reasonably with 100-300 nodes — implement basic virtualization/culling if the library doesn't handle it natively, and warn in the UI ("Showing top 200 most active wallets") if truncating
   - Dark canvas background matching our theme, cyan/red/green node colors, hairline gray edges

2. VENN COMPARE — new page at /compare
   - UI: search/select 2-3 wallet addresses to compare
   - Show a Venn diagram (use a lightweight library like venn.js, or build a simple 2-3 circle SVG overlap ourselves if venn.js styling can't match our theme) representing shared token holdings between the selected wallets
   - Below the diagram, a breakdown table: tokens held by ALL selected wallets, tokens held by exactly 2 of them, tokens unique to each
   - Also show a shared-counterparty section: wallets that ALL selected wallets have directly transacted with (useful for investigation — finding a common intermediary)
   - Style the Venn circles with our accent colors at low opacity with visible strokes, labels in monospace

Both features need clear empty/loading states and should work on mobile (bubble map can be pan/zoomable with touch; Venn compare stacks the selector above the diagram on small screens).
```

---

## PHASE 5 — Tagging system, alerts, and notifications

**Goal:** Make wallet tagging and transaction alerts fully functional end-to-end.

**Prompt to give Claude Code:**

```
[PASTE GLOBAL DESIGN SYSTEM BLOCK]

Complete the tagging and alerting system for NOI Defense.

1. Build a dedicated /alerts page:
   - List of all wallets the user is currently watching (from alerts_subscriptions), each as a card showing address, tags, last activity, and an unsubscribe button
   - A form to add a new wallet to watch by address, with optional tags applied at the same time
   - Empty state with clear CTA if nothing is being watched yet

2. Build the tag management UI as a reusable component (already stubbed on the wallet page in Phase 3):
   - Autocomplete/suggest existing tags as the user types
   - Tags render as small colored chips — assign consistent colors per tag label (hash the tag string to pick from our accent palette)
   - Allow removing tags inline

3. Backend: extend the Phase 1 worker service with a polling or webhook-based watcher:
   - If using Alchemy: set up their Notify/webhook API to receive new transactions for watched addresses in near-real-time
   - On a new transaction from/to a watched wallet: insert a notification record and send an email (use a simple transactional email service — Resend or similar; ask me which one I have an account with, or default to Resend and note the setup step) with wallet tag, tx summary, and a link back into the app
   - Build a notifications table (id, wallet_address, tx_hash, message, read boolean, created_at) and a small in-app notification bell in the top bar showing unread count, with a dropdown list

4. Make sure unsubscribing actually stops future notifications (soft-delete or status flag on alerts_subscriptions, not hard delete, so history is preserved)

This phase should feel fully functional end-to-end: tag a wallet on its detail page → it shows up in /alerts → a real transaction triggers a real notification.
```

---

## PHASE 6 — Polish, dashboard home, and top-30-wallets research view

**Goal:** Tie everything together with a home dashboard and the "top wallets" research feature.

**Prompt to give Claude Code:**

```
[PASTE GLOBAL DESIGN SYSTEM BLOCK]

Build the final pieces to complete the NOI Defense MVP:

1. /dashboard home page:
   - Global search (token or wallet address) prominent at the top
   - "Recently scanned" tokens and wallets (store in localStorage or a user_history table if we have auth by now)
   - Notification bell summary
   - Quick links into /alerts and /compare

2. "Top 30 wallets" research view, accessible from the token page ("View top holders/traders" button):
   - Table ranked by realized+unrealized P&L for that specific token (not global wallet P&L)
   - Columns: rank, wallet, total bought, total sold, current holding, P&L on this token, win/loss badge
   - Sortable columns (by P&L, by holding size, by first-buy time)
   - Each row clickable into /wallet/:address

3. Global polish pass:
   - Audit every page against the design system — fix any inconsistent spacing, colors, or font usage
   - Add a proper 404 page and error boundary matching the dark theme
   - Add a global toast/notification system for actions (tag added, alert subscribed, copy-to-clipboard confirmation) — style it minimal, bottom-right, auto-dismiss
   - Run a Lighthouse/accessibility pass: ensure color contrast on the dark theme meets WCAG AA (cyan-on-black and red/green indicators especially — verify contrast ratios, adjust shades if needed while keeping the aesthetic)
   - Confirm every page works at 375px width (mobile) with no horizontal scroll or broken layouts

Deliver a final walkthrough of all routes: /dashboard, /token/:address, /wallet/:address, /compare, /alerts, plus the bubble map and top-30 view.
```

---

## PHASE 7 — Mobile wrap (Capacitor)

**Goal:** Get the web app into an installable iOS shell.

**Prompt to give Claude Code:**

```
Wrap the existing NOI Defense React app with Capacitor for iOS (and prep for Android).

1. Install and configure @capacitor/core, @capacitor/ios, @capacitor/android
2. Configure capacitor.config.ts with app id (e.g. com.noidefense.app), app name "NOI Defense"
3. Add the @capacitor/push-notifications plugin, wire it to receive the alert notifications built in Phase 5 (APNs setup steps should be documented clearly since they require an Apple Developer account and certificates — list exactly what manual steps I need to do in the Apple Developer portal and Xcode, since Claude Code can't do those parts)
4. Handle safe-area insets properly for iOS notches/home indicator — audit the layout shell (top bar, bottom tab bar if used) against Capacitor's safe-area CSS variables
5. Test that wallet connect (RainbowKit/wagmi) still works inside the Capacitor WebView — flag if WalletConnect deep-linking needs special handling in a native wrapper (it usually does — research and document the fix)
6. Produce a build checklist for submitting to TestFlight

Give me the full list of manual steps I still need to do outside of code (Apple Developer account, certificates, Xcode signing, App Store Connect setup) since those can't be automated.
```

---

## Notes on using this document

- Run phases in order. Each phase prompt assumes the repo state left by the previous phase.
- Re-paste the **Global Design System** block at the top of every phase — Claude Code sessions don't retain memory between separate conversations unless you're in one continuous session or using CLAUDE.md-style project memory.
- After each phase, review the design system audit yourself before moving on — it's easier to catch drift early than to fix it in Phase 6.
- Phase 1 (data infrastructure) is the true bottleneck. If Claude Code struggles with Alchemy's Transfers API pagination or rate limits, that's the place to slow down and get it right — every other phase depends on clean data here.
