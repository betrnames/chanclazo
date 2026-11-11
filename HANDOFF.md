# Chanclazo – handoff for Chief of Staff

Self-contained takeover notes. Read this first. Owner and approver: **Gabe (GitHub: betrnames)**. Repo: https://github.com/betrnames/chanclazo

## Current state (2026-11-11, afternoon PT)
- Active branch: **`feat/chancla-waves`**. Production: **`main` → https://chanclazo.com**.
- **Live right now is v1.1.7.** Footer stamp on chanclazo.com: `v1.1.7 · 41da599` (main). The matching feature commit is `4daed0c` ("concha lands in front of its row and gets eaten in bites").
- Preview of the feature branch: https://feat-chancla-waves.chanclazo.pages.dev (`/`, `/choose`, `/waves`, `/chancla-strike`, `/slots`). Crash is parked but still at `/crash`.
- **Do not push or merge to `main` unless Gabe says "push it live" in that turn.** He did say that for v1.1.7. He has not said it for the work below.

## Not on production yet (working tree, ship only when Gabe says push)
These files are the latest playtest build. They are newer than `4daed0c` / `41da599`.

1. **Boy eating pose.** Gabe sent `IMG_7894.GIF` (8 frames, 120ms, white background, hands at his mouth). Keyed and saved as `public/waves/eat-boy.webp` (8 cells, 168×278, feet on the bottom). In `waves.ts`, `showEater()` swaps **boy and jefe only** onto that strip while they eat the concha (`?` cache `eat-boy.webp?v=1`). Girl, little skeleton, and luchador still use the old chew (body squash + a tiny bite sprite). Do not put this pose on the girl.
2. **Concha crumbles into small bits.** Gabe does not need another sprite sheet. The loaf in the lane is the whole `snack-concha.webp`, and it shrinks smoothly on each bite (no spreading wedges). Each bite bursts many small crumbs, textured from that same concha art (pink sugar and golden bread). The bits fall, split into even smaller crumbs when they land, and fade out so nothing piles on the floor. Sprites are pooled (cap 96) to stay cheap on phones. Five bites, ~0.38s each, `sfxSquish`; a second concha in the same lane still refills up to 5. The throw in the air is still the whole concha. `public/waves/concha-bits.webp` is leftover from the old wedge look — leave the file, do not wire it back in.
3. **Girl fall is no longer the old sticker.** The 3D video (`attachments/…39e99233…mp4`, 10s) is a **run only**. It has no hit and no fall. The hit/KO rows in `catrina-girl-atlas.webp` were an older flat drawing, so she changed costumes when a chancla landed. Those two rows were rebuilt by tipping the 3D walk cell (same girl, flower crown). Sheet is still 3360×1770, cell 420×590, anchor 210,587, walk 8 / hit 3 / ko 4, loaded as `?v=7`. She is still a flat card in the scene, like every other character. A real 3D tumble needs a new clip of **this** girl falling. Do not paste the old sticker frames back.
4. **Do not use `public/waves/snack-elote.webp`.** It is an unused leftover. Gabe removed elote. Leave it untracked. Pan dulce / concha is the only snack.

## Concha rules (Gabe, 2026-11-11) — already in v1.1.7, pieces are the extra
- Lands on the cobbles **in front of one row** (the lane of `threat()`), not in the air on a kid.
- That row slows down (`holdZ`, speed ×0.32) and **cannot walk past** the concha. Kids stack behind the one who is eating.
- Other lanes are not blocked.
- It is eaten in bites (~0.38s each, `sfxSquish`). When the pieces are gone the row walks again.

## What v1.1.7 already has (do not redo)
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
- Hooks: `window.__waves` → `ready`, `start`, `state`, `kids`, `conchas`, `crumbs`, `placeConcha(lane)`, `giveSnack`, `snack`, `wave(n)`, `spawn(kind, lane, z, speed)`, `clearWave`, `hurt`, `bomb`, `giveBomb`, `rapid`, `pause`, `abuela`, `abuelaLines`. Params: `?start=1`, `?wave=N`, `?bombs=N`.
- Atlases load before the first frame (`texLoads`).

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

## Open
- Girl hit/KO is the 3D render tipped in the cell, not a new fall video. Ask Gabe before replacing it again.
- Concha crumb burst (counts, sizes, split-on-land, fade) was tuned in the preview. Phone playtest still needed.
- WAVE CLEAR banner can overlap the papel picado. Cosmetic.
- Strike level map on a short landscape phone can touch the footer.
- `snack-elote.webp` is junk. Do not add it.
- Boss and `waveSpec` numbers are playtest values. Don't retune unless Gabe says the waves are too easy or too hard.

## Next, only if Gabe asks
- Push the eating pose, concha crumble, and 3D girl fall live (that is a `main` release, v1.1.8).
- A real fall clip of the flower-crown girl, if he wants the knockdown to stop being a tipped card.
- Crash as a kart racer, with a cabinet, when he asks.
