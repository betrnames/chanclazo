# Chanclazo – handoff for Grok Build

Self-contained takeover notes. Read this first; it is the source of truth for Gabe's rules and the current state.
Owner and approver: **Gabe (GitHub: betrnames)**. Repo: https://github.com/betrnames/chanclazo

## Current state (2026-11-10, evening PT)
- Active branch: **`feat/chancla-waves`** (latest commit = the one that added this version of HANDOFF.md; run `git log -1`).
  Previous milestones on this branch: `cf9f900` (arcade picker + Abuela cameo), `6e8cd2f` (town mini map, now removed), `952ebcd` (Grok Build's Waves work).
- Preview (Cloudflare Pages, built automatically on push): https://feat-chancla-waves.chanclazo.pages.dev
  - Picker: https://feat-chancla-waves.chanclazo.pages.dev/choose
  - Día de los Muertos (the Waves game): https://feat-chancla-waves.chanclazo.pages.dev/waves
  - Strike: https://feat-chancla-waves.chanclazo.pages.dev/chancla-strike · Slots: /slots · Crash (parked, still reachable): /crash
- **Production = `main` = https://chanclazo.com.** Gabe approved shipping this branch live as **v1.1.0** on 2026-11-11. Homepage footer shows `v1.1.0 · <commit>`.

## Gabe's rules (non-negotiable)
1. **Preview only.** Work on feature branches (now `feat/chancla-waves`). **Never push, merge or deploy to `main`/production without Gabe's explicit "yes".** No force pushes; merge, don't rebase pushed branches.
2. **3D games use three.js** (cannon-es for physics in Crash; Strike is Matter.js 2D). Must run on phones (390x844 portrait; Strike also landscape) and desktop with **no console errors**.
3. **Abuela appears in exactly ONE place:** the between-wave cameo in Día de los Muertos (`/waves`). Nowhere else: not on the homepage, picker, Crash, Strike, cards, how-to text or share images.
4. **No slingshot / Y-fork / bands anywhere.** The thrower is the floating, glowing **gold relic chancla** (Raiders-of-the-Lost-Ark relic vibe).
5. **Chancla Crash is parked.** Removed from the picker; keep the `/crash` code. It may come back later as a **car / Mario Kart style racer**.
6. **The `/waves` game is called "Día de los Muertos"** (accent on the í). The URL stays `/waves`. The name is one constant: `WAVES_NAME` in `src/gameNames.ts` (see below).
7. Day of the Dead look (marigold orange, magenta, teal, purple night, papel picado, sugar skulls). **No floor confetti**; marigold petals OK if they fade before the floor.
8. Rapid fire = hold the gold chancla button (Waves/Crash), with banner, timer ring, flames and sound.
9. Free/permissive code and assets only (MIT/BSD/Apache/CC0). **No paid APIs or services**, no new paid domains/renewals. Sounds are generated in code (Web Audio), no audio files.
10. Waves pause and game-over are **button-only**: no panel, box, border or dim. The **title screen** is a popup modal: sugar-skull boy, flower-crown girl, the small skeleton, and the luchador, then the game name and TAP TO PLAY.

## Game name constant
`src/gameNames.ts` → `export const WAVES_NAME = 'Día de los Muertos'`. Changing that one line renames the game everywhere it displays:
- /choose cabinet marquee + aria label (`src/choose/arcade.ts`, `marqueeLines()` puts the last word big: "DÍA DE LOS / MUERTOS")
- /choose meta description (`astro/pages/choose.astro`)
- `waves.html` `<title>`, description, og:title, application-name, title-screen heading and TAP TO PLAY aria label, via the `%%WAVES_NAME%%` placeholder replaced in `vite.config.ts` (`htmlEnv` plugin)
- the share-on-X text in `src/play/waves.ts`
Internal ids/paths/hooks still say "waves" (`/waves`, `waves.ts`, `window.__waves`); that's intentional.

## Games and files
| Game | URL path | Files | Notes |
|---|---|---|---|
| **Chancla Crash** (PARKED) | `/crash` | `crash.html`, `src/play/crash.ts`, `crashArt.ts`, `crashAudio.ts`, `crashLevels.ts`, `public/crash/` | **Parked 2026-11-10:** removed from the /choose arcade; code and `/crash` URL kept. It may come back later reworked as a car / Mario Kart style racer. three.js + cannon-es topple game. Fires **only** from the gold chancla button (count badge) or Space/Enter. Dragging the stage only aims the dotted arc. Rapid fire on button hold. Test hooks: `window.__crash`. |
| **Día de los Muertos** (was Chancla Waves) | `/waves` | `waves.html`, `src/play/waves.ts`, `public/waves/` | three.js lane defence. **Renamed 2026-11-10 to "Día de los Muertos"** (URL stays `/waves`). The display name is ONE constant, `WAVES_NAME` in `src/gameNames.ts`, used by the arcade marquee (`marqueeLines()` puts the last word big), the /choose meta description, `waves.html` title/description/og:title/title-screen heading (the `%%WAVES_NAME%%` placeholder, replaced in `vite.config.ts` `htmlEnv`) and the share-on-X text. Rename = edit that one line. **Popups are button-only** (Gabe): title / pause / game-over overlays have no panel, box, border or dim; buttons and stroked text float over the live game. Title = game name + breathing TAP TO PLAY. Tap or drag at a kid to throw. Gold chancla button auto-aims. Golden kid = RAPID FIRE. **Girl** is the new flower-crown chibi: `catrina-girl-atlas.webp` 2576×1086, cell 368×362, anchor 184,354, walk 7 / hit 1 / ko 2, loaded as `?v=3`. The cell is wide so her fall fits; hit box and shadow use the standing body (`220 / cw`). **Boy** is `calavera-boy` 3328×1302, walk 6 / hit 1 / ko 3. **Luchador boss** every 3rd wave: 1.5x sprite (`ART.lucha` h 4.1 / stride 3.0), HP `bossHp(n)` = 14 + floor(n/3)*5 (wave 3: 19, wave 6: 24), walks faster (0.5x wave speed), barely staggers when hit, **rage** under half HP (`BOSS_RAGE` 1.4x speed, ¡FURIA! pop + banner), costs `BOSS_DMG` = 4 hearts if he reaches the line. Health bar is a child of his body at `BOSS_HEAD`, so it stays centred over his head at any size. **Difficulty ramp after wave 5** (`waveSpec`, waves 1-5 unchanged): x = wave-5; count +2x, speed ×(1+0.04x) (cap 3.4), spawn gap ×max(0.72, 1-0.05x) with a 0.32 s floor. **Abuela between waves (the only Abuela in the site):** after each cleared wave, `checkWaveDone()` shows the WAVE CLEAR banner, then 0.7 s later `#abuela` slides in from the LEFT with a speech bubble (`ABUELA_LINES`, 16 lines, shuffle-bag so no repeats until all are used, angry face `/crash/abuela-chibi-angry.webp` for scolding lines, `/crash/abuela-chibi.webp` otherwise), holds `ABUELA_HOLD` = 2.5 s, slides out, next wave starts ~0.55 s later. Driven by the game clock (`abuelaAt`/`abuelaOutAt`, `tickAbuela()` in the frame loop), so pause freezes her. Tapping her skips to the next wave; taps elsewhere still throw. Hooks: `__waves.abuela()`, `__waves.abuelaLines()`, `__waves.clearWave()`. Bomb button is fixed on the left (`#powers`), ghosted with opacity only until a bomb is ready, and must not jump when it lights. Title screen is the game name + TAP TO PLAY (button-only popups). Hooks: `window.__waves`. |
| **Chancla Strike** (main game) | `/chancla-strike` (legacy `/fling` redirects) | `chancla-strike.html`, `src/play/fling.ts`, `flingAudio.ts` | Matter.js 2D fort-topple game, 9 levels in 3 areas. Phones play it in landscape. Throw = pull back the floating gold chancla (or drag anywhere), with a power meter and dotted arc, release to fling. Level select = **Level Map** overlay (HUD button), stars unlock areas. Hooks: `window.__fling`. |
| Strike 3D (runner) | `/strike3d` | `strike3d.html`, `src/play/strike3d.ts` | Separate endless runner. Not the main Strike. |
| Landing page | `/` | `astro/pages/index.astro` (production) and `home.html` (vite preview) | Full-bleed plaza. Logo is lowered out of the header. Tagline banner is centered under the logo. Gold relic chancla spins in and floats in the middle. PLAY NOW sits just under the chancla and stays hidden until placed, so it never flashes in the header. No loading screen. No trio overlay. PLAY NOW goes to `/choose`. |
| Game picker | `/choose` | `src/choose/arcade.ts` + `src/choose/arcade.css` (rendered by `astro/pages/choose.astro`, and by `choose.html` in vite dev) | **Arcade**: a row of glowing Day of the Dead arcade cabinets, pure HTML/CSS (no canvas), night sky, moon, papel picado, falling marigold petals, neon floor grid. Three cabinets, in order: **Día de los Muertos** (`/waves`, name from `WAVES_NAME`, Sidro on screen, orange/magenta), **Chancla Strike** (`/chancla-strike?start=1`, floating gold chancla, gold/orange), **Piñata Slots** (`/slots?start=1`, Llama, magenta/teal). Each cabinet = marquee with the name (+ NEW / MAIN GAME / MINI GAME ribbon), CRT attract screen (spinning sunburst, bobbing art, scanlines, blinking TAP TO PLAY), control panel, sugar-skull kick panel with a 1 CHANCLA coin slot. Idle marquees breathe; hover/focus = brighter, lift, neon flicker; tap = screen boot flash then navigate after 260 ms. Crash is parked (no cabinet). Desktop/landscape: 3 in a row (`--h` = cabinet height drives everything). Phones (≤760px wide): horizontal scroll-snap carousel, centred cabinet gets `.lit` (same as hover), dots below. `wireArcade()` handles analytics (`choose_game`, source `arcade`), carousel `.lit`/dots. **No Abuela.** Match and Strike 3D are not in the arcade. The old town mini map (`src/choose/map.*`) was deleted. |
| Others | `/slots`, `/match`, `/lore`, `/arcade` | `slots.ts`, `match.ts`, `lore.html`, `public/arcade*.html` | Not in active work. |

### Día de los Muertos details (src/play/waves.ts)
- **Abuela cameo**: after each cleared wave, `checkWaveDone()` shows WAVE CLEAR; 0.7 s later `#abuela` slides in from the LEFT with a speech bubble, holds `ABUELA_HOLD` = 2.5 s, slides out; next wave ~0.55 s later. 16 lines in `ABUELA_LINES` (shuffle bag, no repeats until the pool is used; angry face `/crash/abuela-chibi-angry.webp` on scolding lines, `/crash/abuela-chibi.webp` otherwise). Game-clock driven (pause freezes her timer; she slides out while the pause menu is up and returns on resume). Tap her to skip; taps elsewhere still throw.
- Title screen is a popup modal (gold border, dim behind it): sugar-skull boy, flower-crown girl, the new small skeleton, and the luchador, then the game name and TAP TO PLAY. Pause and game-over stay button-only. `#stage.on-title` hides HUD/hearts/hint/fire/bomb until `newGame()`.
- Small skeleton (`calaca`) uses Gabe's new sheet: `calaverita-small-atlas.webp` 2268×1020, cell 378×340, anchor 189,332, walk 6 / hit 1 / ko 3, `?v=4`. Hit box uses standing width `170 / cw`. World height `h` 1.25 so he stays the little one.
- Test hooks: `window.__waves` → `ready()`, `start()`, `state()`, `kids()`, `wave(n)`, `spawn()`, `hurt(n)`, `bomb()`, `giveBomb()`, `rapid()`, `pause(bool)`, `abuela()`, `abuelaLines()`, `clearWave()`. URL params: `?start=1`, `?wave=N`, `?bombs=N`.

## Build, run, test
```bash
npm ci
npx tsc --noEmit -p tsconfig.app.json   # typecheck (noUnusedLocals is on)
npm run build          # vite games -> astro -> scripts/merge-dist.mjs  => dist/
cd dist && python3 -m http.server 8793  # http://localhost:8793/choose.html, /waves.html, /chancla-strike.html
```
- `npm run dev` = Astro dev server. `npm run dev:games` = Vite on 8080 (rewrites `/`→`home.html`, `/choose`→`choose.html`; keep `choose.html` and `astro/pages/choose.astro` in sync, both render `src/choose/arcade.ts`).
- Locally `/api/leaderboard` 404s (it's a Cloudflare Pages Function in `functions/`); expected. With python http.server, `/waves` (no .html) opens the `public/waves/` folder; use `/waves.html` locally. On Pages `/waves` works.
- Headless checks: Python Playwright + system Chrome (`/usr/bin/google-chrome`) with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, viewports 1280x800 desktop and 390x844 mobile (`is_mobile`, `has_touch`). Headless WebGL runs slowly, so the game clock lags real time; drive states with the `__waves` hooks. The title button "breathes", so use `click(force=True)`.

## Deploy (preview only)
- Cloudflare Pages project **`chanclazo`**, git integration: **a push to a branch builds `https://<branch-slug>.chanclazo.pages.dev`** (slug = branch name with `/`→`-`). Nothing else is needed: `git push origin feat/chancla-waves`.
- Verify: `curl -s https://feat-chancla-waves.chanclazo.pages.dev/choose | grep -o 'v1.0.0 · [0-9a-f]*'` must show the new short sha (build takes ~1 min). Every page footer has the stamp (`.cz-build`, written by `merge-dist.mjs`).
- `main` deploys production chanclazo.com. **Do not merge to main without Gabe's explicit approval.**

## Branches
| Branch | Preview | Contents |
|---|---|---|
| `feat/chancla-waves` | https://feat-chancla-waves.chanclazo.pages.dev | **Active.** Everything: picker, Día de los Muertos, Strike, (parked) Crash |
| `feat/chancla-crash` | https://feat-chancla-crash.chanclazo.pages.dev/crash | Older Crash + Strike |
| `feat/chancla-strike-sling` | https://feat-chancla-strike-sling.chanclazo.pages.dev/chancla-strike | Strike gold-chancla thrower (name is historical; no slingshot) |
| `design/astro-landing` | https://design-astro-landing.chanclazo.pages.dev/ | Landing page variant |
Merge the landing branch and game branches together before any production release (only after Gabe says yes).

## Other state worth knowing
- Homepage: lowered logo, centered tagline, floating gold chancla, PLAY NOW (→ `/choose`) under it. No trio, no loading screen; PLAY NOW must not flash in the header. Don't bring the trio back unless Gabe asks.
- Waves loads every sprite atlas before first render (`texLoads`) — keeps the console clean. Camera framing in `resize()` (`camLook.y`) keeps the ofrenda table just above the bottom buttons.
- Sprite atlases are in git (`public/waves/sprites/*-atlas.webp/json`); raw Sprite Forge sources live only on the build box (`/workspace/chanclazo_assets/sprites-forge`).

## Open issues
- Mobile Waves: the WAVE CLEAR banner overlaps the papel picado strings (pre-existing, cosmetic).
- Strike Level Map card on short landscape phones slightly overlaps the footer copyright line.
- Waves cabinet art uses `/play/v2/sidro.webp` (the masked luchador cut-out). If Gabe wants different cabinet art for Día de los Muertos, change it in `CABS` in `src/choose/arcade.ts`.
- The longer between-wave pause (~4.2 s with Abuela vs 2.6 s before) hasn't been playtested on a real phone.
- Boss/ramp numbers (`bossHp`, `BOSS_DMG`, `BOSS_RAGE`, `waveSpec`) are first-pass; tune after Gabe plays.

## Next ideas (only with Gabe's OK)
- Crash reborn as a Mario Kart style chancla racer (three.js), reusing the skull kids and gold chancla; give it a new arcade cabinet when ready.
- More Abuela lines (keep them family-friendly, mostly English with a little Spanish) — still only between waves.
- Polish pass (free assets only): impact particles, relic glow, marigold bursts (no floor confetti), better code-made sounds, smoother UI transitions, mobile perf.
- Cabinet attract screens could play a tiny looping animation of each game.
