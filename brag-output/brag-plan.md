# /brag plan — NOI Defense

Tone preset: `polished`, with the user's freeform direction: *polished and a
little cinematic*. Read it as a quiet premium instrument film — one held idea,
big empty space, no hype. Format: landscape 1920×1080, 30fps. Target: ~21s.

## Rubric

**1. What is the app?**
NOI Defense reads any EVM token or wallet address live off the chain and tells
you, in plain English, what it found — and what it could not check.

**2. The most impressive claim.**
The second half of that sentence. Every scanner on the market shows a green
tick; almost none distinguish *"we checked and it is fine"* from *"we could not
check"*. The app is built around that distinction — its deep-history panel
refuses to show a holder breakdown until it has read the token's whole history,
and says so. That refusal is the product.

**3. The visual hook.**
The headline `you buy.` lit by the beam gradient — chrome into cyan into violet
— on near-black, and the glass bento tiles with their lit top edge.

**4. What to show from the real UI.**
The scan input, the verdict tile with its green rail, and the wallet trace's
four stat tiles. All real components, real copy, real colours.

**5. Shortest satisfying cut.**
~21s. The turn at scene 4 is the whole point and needs room to land.

**6. Tone.**
`polished`. Direction: a quiet instrument film. Long holds, slow fades, one
claim per scene, nothing shouted.

**7. Audio.**
Cinematic low bed from the bundled music. Restrained, motion-matched: soft key
ticks under the typing, one low swell into the verdict, three small ticks on the
staggered rows, a single dry hit on the turn, then the bed alone under the
outro. Nothing spiky; effects sit under the music.

**8. Share caption.**
Drafted in `share-copy.txt` at delivery.

**9. The flow worth showing.**
Entry → key action → result: paste an address → read a plain-English verdict →
see the app tell you where its own knowledge stops.

## Identity (exact, from `src/design/tokens.js`)

| Role | Value |
|---|---|
| Background | `#08080A` |
| Card / tile | `#131316` |
| Raised | `#1B1B1F` |
| Hairline | `#232327` |
| Text primary | `#F5F5F7` |
| Text secondary | `#A8A8B0` |
| Text muted | `#8A8A93` |
| Positive | `#3DD68C` |
| Negative | `#F2555F` |
| Warning | `#F0A93B` |
| Beam (atmosphere only) | `#4CE3FF` |
| Beam alt | `#8B7BFF` |
| Chrome ramp | `#FFFFFF → #D6D6DE → #8C8C97 → #5A5A63` |

Display and body: **Inter**. Hex and addresses: **JetBrains Mono**.

Beam is atmosphere only in the product — edges, glow, focus — and never sits
next to a number. The video keeps that rule: the only chromatic accents on a
figure are the semantic green and red.

## Substitutions — nothing real on screen

Per the secrets rule, and because a launch video must not read as a verdict on
a real asset:

- The token in the scan scenes is a **fictional stand-in** (`MERIDIAN / MRDN`)
  with plausible figures. The product's own claims and copy are real and
  unchanged; only the sample asset is invented.
- The wallet address is **fictional**. The real one used while testing belongs
  to a person.
- No Supabase URL, no project host, no localhost, no keys anywhere on screen.

## Storyboard

Durations sum to **21.0s**. Reading time budgeted at ~0.3s/word from the moment
a line is fully settled, per the readability law.

| # | t | Dur | On screen | Motion | Audio |
|---|---|---|---|---|---|
| 1 | 0.0 | 3.0 | Glass input, empty. A `0x…` address types itself in, JetBrains Mono, caret blinking. | Aurora drifts behind. Input's lit edge brightens as the line fills. | Soft key ticks; low sub on the last character. |
| 2 | 3.0 | 2.6 | `Is this token safe?` — chrome gradient, large. The input shrinks to a thin line beneath. | Type settles, holds. | Low swell begins. |
| 3 | 5.6 | 4.4 | Verdict tile: green rail, **Looks OK**, and under it `A test buy and a test sale both went through.` | Tile rises 12px into place, lit edge catching. Line fades in, holds 3.0s settled. | Swell peaks and drops; one soft tick as the tile lands. |
| 4 | 10.0 | 4.6 | Everything dims to background. Centred, beam-lit: `— and what we could not check.` | Nothing moves but the aurora. The longest hold in the film. | One dry low hit on entry, then bed alone. |
| 5 | 14.6 | 3.2 | Wallet trace: `Who is behind this address?` small above four glass stat tiles — Balance, Transactions sent, First activity, Last activity — landing one by one. | Tiles stagger in 120ms apart, numbers counting up. | Three light ticks on the first three tiles. |
| 6 | 17.8 | 3.2 | Wordmark, then `Check before you buy.` with `you buy.` beam-lit. Below, muted: `Free · no account needed`. | Slow fade up; beam bloom breathes once. | Bed resolves and fades. |

Shape: hook (1) → reveal (2–3) → the turn (4) → proof (5) → outro (6).

Scene 4 is the film. Everything before it earns the right to say it; everything
after it is the address of the place that does it.

## Music cue guidance

Bundled tracks live in `assets/music/` with cue presets in `assets/music/cues/`.
Pick the calmest of the set for a `polished` read and use its cues as *timing
guidance only* — the verdict landing at scene 3 and the dry hit at scene 4 are
story beats first. If a cue fights the hold on scene 4, the hold wins.
