# Chanclazo – handoff for Chief of Staff

Self-contained takeover notes. Read this first. Owner and approver: **Gabe (GitHub: betrnames)**. Repo: https://github.com/betrnames/chanclazo

## Current state (2026-11-11, evening PT)
- Active branch: **`feat/chancla-waves`**. Production: **`main` → https://chanclazo.com**.
- **Live right now is v1.1.9.** Gabe said "Looks better push live" at 5:36 PM PT on 11 Nov 2026. Footer stamp on chanclazo.com: `v1.1.9 ·` plus the short SHA of the Release v1.1.9 commit on `main`. The matching feature commit is the Release v1.1.9 commit on `feat/chancla-waves` (same tree as `main`). Previous production was `v1.1.8 · 9b07298`.
- Preview of the feature branch: https://feat-chancla-waves.chanclazo.pages.dev (`/`, `/choose`, `/waves`, `/chancla-strike`, `/slots`). Crash is parked but still at `/crash`.
- **On preview only, not live (11 Nov 2026, evening PT):** WAVE CLEAR sits in the mid-plaza below the papel picado; the Strike level map clears the footer on short landscape phones; a "Player 1 Ready" intro plays when Waves, Strike, or Slots starts. Live is still v1.1.9 until Gabe says to push it live.
- **Do not push or merge to `main` unless Gabe says "push it live" in that turn.** He did say that for v1.1.7, v1.1.8, and v1.1.9.

## What v1.1.9 shipped (2026-11-11)
Playtested on `feat/chancla-waves` (`5e6672a`) and now on production.

- **Girl fall is a full character, not a cropped card.** The atlas KO cells (`catrina-girl-atlas.webp`, still 3360×1770, cell 420×590, `?v=7`) were made by tipping her walk frame inside that box; the rotation ran off the right edge, so a hard flat crop showed as she fell. She still walks on the same card as everyone else. When she is knocked out, that card is hidden and a camera-facing sprite plays her complete, uncropped hit frames, tumbling with a 2D screen-space rotation (about 80°, feet-anchored) and a small slide. Timing (1.15s, fade, hop, marigold petals) is unchanged. Do not paste the old sticker frames back. Do not tip the 3D plane edge-on. Other characters still use their atlas KO rows.

## What v1.1.8 shipped (2026-11-11)
These were playtested on `feat/chancla-waves` (`05e1080` and the work leading to it) and are on production as of v1.1.8.

1. **Eating is a natural bite, not a flattened head.** The old chew squashed the body (`scale.y *= 0.88`) and tipped the card to 0.42–0.64 rad, which foreshortened faces into a flat angle. That squash and extra tilt are gone.
   - **Boy:** Gabe's `eat-boy.webp` (8 cells, 168×278, from `IMG_7894.GIF`) is the right sheet and is wired as-is, correct aspect, feet on the cobbles, the same mild 0.2 card tilt as walking. It is not stretched or used on anyone else.
   - **Jefe:** his own 6-frame strip `eat-jefe.webp` (168×278), derived from the boy's eat art with the same purple tint as his walk body. Sequence: reach, lean-in, bite, chew, chew, swallow. Head leans toward the concha; the jaw opens and closes.
   - **Girl:** her own 6-frame strip `eat-girl.webp` (420×590, same cell as her walk), derived from her flower-crown walk frames. Same reach–lean–bite–chew–swallow sequence, same palette and costume. Her hit/KO rows are untouched.
   - Little skeleton and luchador have no eat sheet: they hold a walk frame with a mild nod and a tiny bite sprite, never a Y-squash or a steeper tilt.
   - `showEater()` swaps on the matching sheet while they eat. The loaf and crumb shatter are unchanged.
2. **Concha crumbles into small bits.** Gabe does not need another sprite sheet. The loaf in the lane is the whole `snack-concha.webp` (the full round bun, including the golden curved base — it used to sit too low and the cobbles clipped it into a flat bottom). It sits just above the floor (`CONCHA_LIFT + height/2`, `depthTest` off) and shrinks uniformly on each bite (no spreading wedges), so the bottom curve stays visible. Each bite bursts many small crumbs, textured from that same concha art (pink sugar and golden bread). The bits fall, split into even smaller crumbs when they land, and fade out so nothing piles on the floor. Sprites are pooled (cap 96) to stay cheap on phones. Five bites, ~0.38s each, `sfxSquish`; a second concha in the same lane still refills up to 5. The throw in the air is still the whole concha. `public/waves/concha-bits.webp` is leftover from the old wedge look — leave the file, do not wire it back in.
3. **Do not use `public/waves/snack-elote.webp`.** It is an unused leftover. Gabe removed elote. Leave it untracked. Pan dulce / concha is the only snack.

## Concha rules (Gabe, 2026-11-11) — in v1.1.7; crumb shatter and the round loaf are the v1.1.8 extra
- Lands on the cobbles **in front of one row** (the lane of `threat()`), not in the air on a kid.
- That row slows down (`holdZ`, speed ×0.32) and **cannot walk past** the concha. Kids stack behind the one who is eating.
- Other lanes are not blocked.
- It is eaten in bites (~0.38s each, `sfxSquish`). When the pieces are gone the row walks again.

## What v1.1.7 already had (still true in v1.1.9; do not redo)
- Homepage: lowered logo, tagline centered under the logo, gold chancla floating in the middle, PLAY NOW under it going to `/choose`. No trio. No loading screen. PLAY NOW must not flash in the header. **Do not put a promo video on `/`.** Gabe is cutting the X video in another app. `vite.config.ts` `/` must stay `home.html`.
- Día de los Muertos title is a card: game name, one rotating chanclazo quote (`#titleQuote`), TAP TO PLAY. No character lineup on that card.
- Waves are hard from wave 1 (`waveSpec` in `waves.ts`).
- Slots piñata bonus uses the HD standing llama. Back control is the gold chevron, same as Waves. No "Games" button.
- Chancla Strike is vertical again. No rotate button. No pan-zoom.
- Music starts on load. `arcade.ts` **dynamically imports** `initLanderMusic`. A static import breaks the Cloudflare build (`location is not defined`). Keep the dynamic import.
- Flower-crown girl walk, new little skeleton (`calaverita-small`, `?v=7` on that sheet), concha snack graphic.

## Gabe's rules (non-negotiable)
1. Feature work stays on `feat/chancla-waves`. **Never push `main` / chanclazo.com without Gabe saying to push it live.** No force pushes.
2. **3D games use three.js** (cannon-es in Crash; Strike is Matter.js 2D). Phones are 390×844. No console errors.
3. **Abuela appears in exactly one place:** the between-wave cameo in Día de los Muertos. Nowhere else.
4. **No slingshot, Y-fork, or bands.** The thrower is the floating gold relic chancla.
5. **Chancla Crash is parked.** Not on the picker. Keep `/crash`. Maybe later a car / Mario Kart racer.
6. The waves game is **Día de los Muertos**. URL stays `/waves`. One constant: `WAVES_NAME` in `src/gameNames.ts`.
7. Day of the Dead palette. No floor confetti. Marigold petals are fine if they fade.
8. Rapid fire = hold the gold chancla. Banner, timer ring, flames, sound.
9. Free assets only. No paid APIs. Sounds are Web Audio, no audio files.
10. Pause and game-over are button-only (no panel). The waves **title** is the quote card described above.

## Game name constant
`src/gameNames.ts` → `export const WAVES_NAME = 'Día de los Muertos'`. That one line feeds the arcade marquee, choose meta, `waves.html` via `%%WAVES_NAME%%` (`htmlEnv` in `vite.config.ts`), and the share text. Paths and `window.__waves` stay "waves".

## Games and files
| Game | URL | Files | Notes |
|---|---|---|---|
| Chancla Crash (PARKED) | `/crash` | `crash.html`, `src/play/crash.ts` | Not on the picker. Hooks: `window.__crash`. |
| Día de los Muertos | `/waves` | `waves.html`, `src/play/waves.ts`, `public/waves/` | Lane defence. Concha + bomb on the left, ghosted until ready, must not jump. Gold chancla throws. See the concha and eating notes above. |
| Chancla Strike | `/chancla-strike` (`/fling` redirects) | `chancla-strike.html`, `src/play/fling.ts` | Matter.js fort topple. Vertical. No rotate control. Hooks: `window.__fling`. |
| Piñata Slots | `/slots` | `slots.html`, `src/play/slots.ts` | HD llama in the bonus. Gold chevron back, no Games button. |
| Landing | `/` | `astro/pages/index.astro` (production), `home.html` (vite) | Gold chancla, PLAY NOW → `/choose`. |
| Picker | `/choose` | `src/choose/arcade.ts` | Three cabinets: Día de los Muertos, Chancla Strike, Piñata Slots. No Crash, no Abuela. |

### Día de los Muertos, short
- Abuela after each cleared wave, slides in from the left, `ABUELA_LINES` shuffle bag, hold 2.5s, tap her to skip. Pause freezes her clock.
- Boss luchador every 3rd wave. `bossHp`, `BOSS_DMG` 4, `BOSS_RAGE` 1.4.
- Hooks: `window.__waves` → `ready`, `start`, `state`, `kids`, `conchas`, `crumbs`, `placeConcha(lane)`, `giveSnack`, `snack`, `wave(n)`, `spawn(kind, lane, z, speed)`, `clearWave`, `hurt`, `bomb`, `giveBomb`, `rapid`, `pause`, `abuela`, `abuelaLines`. Params: `?start=1` (skips the intro), `?wave=N`, `?bombs=N`, `?intro=1` (force the full intro), `?nointro=1`.
- Wave atlases load in parallel with the Player 1 Ready intro; `newGame` waits for both. `?start=1` still begins only once textures are ready.

## Build and deploy
```bash
npm ci
npx tsc --noEmit -p tsconfig.app.json
npm run build
```
- Dev preview for this sandbox is `npm run dev:games` (Vite on 8080). `/` rewrites to `home.html`.
- Cloudflare Pages project `chanclazo`. Pushing `feat/chancla-waves` builds https://feat-chancla-waves.chanclazo.pages.dev. Pushing `main` builds https://chanclazo.com.
- Footer stamp is `v<package.json version> · <short sha>` from `scripts/merge-dist.mjs`. Bump `package.json` when Gabe says to ship.
- `arcade.ts` must keep the dynamic import of `initLanderMusic`.

## Player 1 Ready intro (preview only, 2026-11-11)
A ~4s three.js cinematic plays the first time a game starts in a session; later starts in the same session get a ~1s cut. Tap (or Space / Enter / Escape) skips. `prefers-reduced-motion` skips entirely. `?start=1` and `?nointro=1` skip so playtests and hooks still work; `?intro=1` forces the full cut.

Sequence: wide pan over the cempasúchil-lit plaza at dusk (papel swaying, candles flickering) → tilt and zoom onto the chosen arcade cabinet, whose CRT flickers on → the gold chancla relic twirls in, hovers and glows → big marigold "PLAYER 1 READY", a synthesized coin-drop, then 3-2-1 straight into the game. Per-game final beat: a luchador for Waves (`chibi_luchador_crossed.webp`), a swinging piñata for Slots, a concentric target for Strike. Existing art and three.js only; SFX in `crashAudio.ts` (`sfxCoin`, `sfxCount`). No new paid assets.

Module: `src/play/player1Intro.ts`. Wired from `waves.ts`, `fling.ts`, and `slots.ts`. Crash is still parked, no intro. Test hook: `window.__p1intro.play(game, onDone)` always runs the full cut (clears the session flag); `.seek(u)` scrubs for stills. Session flag: `sessionStorage['cz-p1-intro']`. Demo clip of the full intro: `/workspace/chz-demo/player1-intro.mp4`.

## Open
- Girl knock-out is a billboard tumble of her complete hit frames (the atlas KO row is cropped and is not drawn). Shipped in v1.1.9. Phone playtest on 11 Nov (390×844 and 375×667): the fall is a complete character, not a cropped card. A real fall clip of this girl is still welcome if Gabe wants one. Ask before replacing the art again.
- Concha crumb burst, natural bite poses, and the whole round loaf — shipped in v1.1.8. Phone playtest on 11 Nov (390×844 and 375×667): the concha is the full round bun with a golden curved base on the cobbles; the girl leans in with a natural bite (no flattened head); crumbs burst as small pink and gold bits and do not pile. No new bugs worth a code change.
- WAVE CLEAR banner overlapping the papel picado — **fixed on preview, not live.** Anchored from mid-screen (`bottom: 46%`, 44% / 48% breakpoints); the settle animation rises from below, never up into the bunting. Clean at 390×844, 375×667, and desktop. Before/after: `/workspace/chz-shots/polish-before-waves-clear-*.png` and `polish-after-waves-clear-*.png`.
- Strike level map touching the footer on short landscape phones — **fixed on preview, not live.** Short landscape (`max-height: 500px`) map card can scroll, and padding keeps "All games" and the content above the fixed copyright stamp. Gaps: ~14px at 667×375, ~22px at 844×390. Portrait and desktop unchanged. After stills: `/workspace/chz-shots/polish-after-strike-map-*.png`.
- On 375×667 the hearts still sit on the papel picado (pre-existing, not this work). Cosmetic.
- `snack-elote.webp` is junk. Do not add it.
- Boss and `waveSpec` numbers are playtest values. Don't retune unless Gabe says the waves are too easy or too hard.
- The Player 1 Ready intro is preview-only. Do not ship it to `main` until Gabe says to.

## Next, only if Gabe asks
- A real fall clip of the flower-crown girl, if he wants the knockdown to stop being a tipped card.
- Crash as a kart racer, with a cabinet, when he asks.
