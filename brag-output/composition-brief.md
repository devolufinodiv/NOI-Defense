# Hyperframes Composition Brief: NOI Defense

## Objective
A short launch-style brag video for NOI Defense.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920×1080, 30fps
- Duration: 21.83s

## Source Material
- Project root: this repository
- Primary files read: `src/pages/Landing.tsx`, `src/pages/TokenDetail.tsx`,
  `src/pages/WalletDetail.tsx`, `src/design/tokens.js`, `tailwind.config.js`,
  `src/index.css`, `README.md`, `package.json`
- Product name: NOI Defense
- Strongest claim: it tells you what it could **not** check
- Key UI to recreate: the scan input, the verdict tile with its green rail and
  lit edge, and the wallet trace's four glass stat tiles — all rebuilt from the
  project's own tokens rather than screenshotted
- Copy that must appear verbatim:
  - `Is this token safe?`
  - `Looks OK`
  - `A test buy and a test sale both went through.`
  - `— and what we could not check.`
  - `Who is behind this address?`
  - `Check before you buy.`
  - `Free · no account needed`

## Creative Direction
- Tone preset: `polished`
- Creative direction: a quiet instrument film — one held idea, long holds,
  nothing shouted
- Interpretation: 6 scenes, slow fades and dips rather than wipes, generous
  empty space, one claim per scene. The turn at scene 4 gets the longest hold
  in the film and no motion but the aurora.
- Angle: every scanner shows a green tick; this one tells you where its own
  knowledge stops. The film spends three scenes earning the right to say that
  and one scene saying it.
- Hook: an address typing itself into a glass input on near-black.
- Outro: `Check before you buy.` with `you buy.` beam-lit.
- Avoid: generic SaaS language, abstract filler, any redesign of the product's
  real look.

## Visual Identity
- Background: `#08080A`
- Tile: `#131316`, hairline `#232327`
- Text: `#F5F5F7` primary, `#A8A8B0` secondary, `#8A8A93` muted
- Semantic: positive `#3DD68C`, negative `#F2555F`, warning `#F0A93B`
- Beam (atmosphere only): `#4CE3FF` into `#8B7BFF`
- Display + body font: Inter. Hex and addresses: JetBrains Mono.
- References: the `.bento-tile` glass treatment (masked 1px lit edge over an ash
  gradient), the `.aurora-field` two-light drift, the `.beam-text` heading
  gradient, and the verdict card's green rail.

## Storyboard
`brag-output/brag-plan.md` is the creative contract. Retimed onto the track's
cue grid:

1. Hook — 0.00→3.55 — an address types into the glass input
2. Question — 3.55→6.28 — `Is this token safe?` in chrome type
3. Verdict — 6.28→11.46 — the verdict tile, `Looks OK`, one real finding
4. The turn — 11.46→15.82 — `— and what we could not check.` beam-lit, held
5. Wallet — 15.82→18.55 — four glass stat tiles land one per beat
6. Outro — 18.55→21.83 — wordmark, `Check before you buy.`, `Free · no account needed`

## Audio
- Audio role: cinematic support — a low bed, not a driver
- Audio arc: bed enters under the typing, lifts into the verdict, drops almost
  to nothing under the turn so the line sits in space, returns for the wallet
  tiles, resolves and fades under the outro
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` — the calmest
  and slowest of the bundled set (109.96 BPM), played low
- Music treatment: `data-volume` low throughout with a fade-in at the head and a
  fade-out under the outro
- Music cue guidance: bundled preset
  `assets/music/cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`
- Beat locks (3, within the 1–3 guidance), all on `strongCues`:
  - `6.281` — the verdict tile lands
  - `11.459` — the turn
  - `15.824` — the wallet block
- Beat grid: the four wallet stat tiles at `15.82, 16.38, 16.93, 17.47`, then the
  full set holds until 18.55 so the labels can be read rather than outrun
- Audio-reactive treatment: subtle. The aurora glow behind the frame breathes on
  the track's own beat grid. Driven by the bundled cue timestamps rather than
  per-frame RMS extraction — deterministic, which the render requires, and it
  keeps the coupling musical without adding a waveform or a pulse to any figure.
- SFX: restrained, chosen against `assets/sfx/sfx-analysis.md`, preferring
  low high-frequency-risk files for the repeated key ticks.

## Hyperframes Instructions
Single paused root timeline on `window.__timelines["main"]`. Every timed element
carries `data-start`, a duration and `class="clip"`. Deterministic only — no
`Date.now()`, no `Math.random()`, no network. `npm run check` is the gate before
render.
