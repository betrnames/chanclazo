# Chanclazo – handoff notes

This file explains the repo's current state so another coding agent can pick up the work.
Owner and approver: **Gabe (betrnames)**. Repo: https://github.com/betrnames/chanclazo

## Golden rules
- **`main` = production (https://chanclazo.com).** Never push or merge to `main` without Gabe's explicit "yes".
  Production is currently on `49eed2c`.
- Work only on feature branches. Every pushed branch gets its own Cloudflare Pages preview.
- Use free and permissive (MIT/BSD/Apache/CC0) code and assets only. No paid APIs or services (no Higgsfield etc.).
- Generate sounds in code with Web Audio. There are no audio files.

## Design rules (current, from Gabe)
- **No Abuela anywhere, with ONE exception (Gabe, 2026-11-10):** the between-wave cameo in Chancla Waves (see below). Nowhere else: not in Crash, Strike, the picker, cards, how-to text or share images.
- **No slingshot / Y-fork / bands** anywhere. The thrower is the **gold relic chancla**: a floating, glowing
  gold chancla (bob, rays, halo, sparkles). The style reference is a Raiders-of-the-Lost-Ark relic.
- **Rapid fire** = hold the gold chancla button (Crash, Waves). It is a power-up with a banner, a timer ring, flames and a sound.
- **No floor confetti.** Marigold petals are OK if they fade before reaching the floor.
- Day of the Dead look. 3D games use **three.js** (plus cannon-es for physics in Crash).
- Must work on phones (390x844 portrait, and landscape for Strike) and on desktop with no console errors.

## Games and files
| Game | URL path | Files | Notes |
|---|---|---|---|
| **Chancla Crash** | `/crash` | `crash.html`, `src/play/crash.ts`, `crashArt.ts`, `crashAudio.ts`, `crashLevels.ts`, `public/crash/` | three.js + cannon-es topple game. Fires **only** from the gold chancla button (count badge) or Space/Enter. Dragging the stage only aims the dotted arc. Rapid fire on button hold. Test hooks: `window.__crash`. |
| **Chancla Waves** | `/waves` | `waves.html`, `src/play/waves.ts`, `public/waves/` | three.js lane defence. Tap or drag at a kid to throw. Gold chancla button auto-aims. Golden kid = RAPID FIRE. **Girl** is the new flower-crown chibi: `catrina-girl-atlas.webp` 2576×1086, cell 368×362, anchor 184,354, walk 7 / hit 1 / ko 2, loaded as `?v=3`. The cell is wide so her fall fits; hit box and shadow use the standing body (`220 / cw`). **Boy** is `calavera-boy` 3328×1302, walk 6 / hit 1 / ko 3. Luchador boss every 3rd wave. **Abuela between waves (the only Abuela in the site):** after each cleared wave, `checkWaveDone()` shows the WAVE CLEAR banner, then 0.7 s later `#abuela` slides in from the LEFT with a speech bubble (`ABUELA_LINES`, 16 lines, shuffle-bag so no repeats until all are used, angry face `/crash/abuela-chibi-angry.webp` for scolding lines, `/crash/abuela-chibi.webp` otherwise), holds `ABUELA_HOLD` = 2.5 s, slides out, next wave starts ~0.55 s later. Driven by the game clock (`abuelaAt`/`abuelaOutAt`, `tickAbuela()` in the frame loop), so pause freezes her. Tapping her skips to the next wave; taps elsewhere still throw. Hooks: `__waves.abuela()`, `__waves.abuelaLines()`, `__waves.clearWave()`. Bomb button is fixed on the left (`#powers`), ghosted with opacity only until a bomb is ready, and must not jump when it lights. Title screen is only the gold chancla and TAP TO PLAY. Hooks: `window.__waves`. |
| **Chancla Strike** (main game) | `/chancla-strike` (legacy `/fling` redirects) | `chancla-strike.html`, `src/play/fling.ts`, `flingAudio.ts` | Matter.js 2D fort-topple game, 9 levels in 3 areas. Phones play it in landscape. Throw = pull back the floating gold chancla (or drag anywhere), with a power meter and dotted arc, release to fling. Level select = **Level Map** overlay (HUD button), stars unlock areas. Hooks: `window.__fling`. |
| Strike 3D (runner) | `/strike3d` | `strike3d.html`, `src/play/strike3d.ts` | Separate endless runner. Not the main Strike. |
| Landing page | `/` | `astro/pages/index.astro` (production) and `home.html` (vite preview) | Full-bleed plaza. Logo is lowered out of the header. Tagline banner is centered under the logo. Gold relic chancla spins in and floats in the middle. PLAY NOW sits just under the chancla and stays hidden until placed, so it never flashes in the header. No loading screen. No trio overlay. PLAY NOW goes to `/choose`. |
| Game picker | `/choose` | `src/choose/arcade.ts` + `src/choose/arcade.css` (rendered by `astro/pages/choose.astro`, and by `choose.html` in vite dev) | **Arcade**: a row of glowing Day of the Dead arcade cabinets, pure HTML/CSS (no canvas), night sky, moon, papel picado, falling marigold petals, neon floor grid. One cabinet per game, in order: **Chancla Waves** (`/waves`, Sidro on screen, orange/magenta), **Chancla Strike** (`/chancla-strike?start=1`, floating gold chancla, gold/orange), **Chancla Crash** (`/crash`, sugar-skull kids, teal/purple), **Piñata Slots** (`/slots?start=1`, Llama, magenta/teal). Each cabinet = marquee with the name (+ NEW / MAIN GAME / MINI GAME ribbon), CRT attract screen (spinning sunburst, bobbing art, scanlines, blinking TAP TO PLAY), control panel, sugar-skull kick panel with a 1 CHANCLA coin slot. Idle marquees breathe; hover/focus = brighter, lift, neon flicker; tap = screen boot flash then navigate after 260 ms. Desktop/landscape: 4 in a row (`--h` = cabinet height drives everything). Phones (≤760px wide): horizontal scroll-snap carousel, centred cabinet gets `.lit` (same as hover), dots below. `wireArcade()` handles analytics (`choose_game`, source `arcade`), carousel `.lit`/dots. **No Abuela.** Match and Strike 3D are not in the arcade. The old town mini map (`src/choose/map.*`) was deleted. |
| Others | `/slots`, `/match`, `/lore`, `/arcade` | `slots.ts`, `match.ts`, `lore.html`, `public/arcade*.html` | Not in active work. |

## Build and run locally
```bash
npm ci
npm run build          # vite games -> astro -> scripts/merge-dist.mjs  => dist/
npx tsc --noEmit -p tsconfig.app.json   # typecheck (noUnusedLocals is on)
cd dist && python3 -m http.server 8793  # http://localhost:8793/waves.html, /crash.html, /chancla-strike.html
```
`npm run dev` is the Astro server. The sandbox preview is Vite on port 8080 (`vite.config.ts`, strictPort). It rewrites `/` to `home.html` and `/choose` to `choose.html`. Keep those files in sync with the Astro pages. `npm run build` is still vite games, then astro, then `scripts/merge-dist.mjs`, into `dist/`.
The `/api/leaderboard` request 404s locally because it is a Cloudflare Pages Function (`functions/`). That is expected.

## Where things stand (2026-11-10)
Saved on `feat/chancla-waves`. Not merged to `main`. Gabe has not approved production.

- Homepage: lowered logo, centered tagline, floating gold chancla, PLAY NOW under the chancla. No trio. No loading screen. The play button must not appear in the header on first paint.
- `/choose` is now the **arcade cabinet row** (Gabe didn't like the town mini map). Four cabinets: Waves, Strike, Crash, Slots (see the table). Abuela is not on it.
- Waves: Abuela slides in from the left between waves with a witty one-liner (see the table). This is the only place Abuela is allowed.
- Waves title screen is only the gold chancla and TAP TO PLAY. `#stage.on-title` hides the HUD, hearts, hint, fire and bomb buttons until `newGame()` removes the class.
- Waves boss health bar is a child of the luchador's body mesh, centred on his head (`BOSS_HEAD` in `waves.ts`), so it follows his walk and lean.
- Waves framing: `resize()` tilts the camera (`camLook.y`) so the front of the ofrenda table sits just above the bottom buttons. No empty band under the table on tall phones.
- Waves loads every sprite atlas before the first render and before any kid is spawned (`texLoads` in `waves.ts`). That removed the ~100 "Texture marked for update but no image data" warnings. `__waves.ready()` tells tests when art is in.
- Build stamp: `vite.config.ts` no longer replaces `%%CZ_BUILD%%` with "preview" in builds, so `merge-dist.mjs` stamps every vite game page (Waves, Crash, Strike, Slots...) with `v1.0.0 · <sha>` like the Astro pages. The dev server shows "dev".
- Waves bomb button stays fixed on the left and ghosted until a bomb is ready.
- Waves sugar-skull girl is the new flower-crown chibi, cut from Gabe's sprite sheet (keyed, scaled, feet aligned). The video was not used. Boy is the newer chibi sheet.

Do not put the trio back on the homepage unless Gabe asks. Do not merge to `main` without Gabe's explicit yes.

## Open TODOs

Headless check (from earlier sessions): Python Playwright with system Chrome and
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, 390x844 mobile with touch via CDP
`Input.dispatchTouchEvent`, and 1440x900 desktop.

## Deploys (Cloudflare Pages, git integration)
- A push to any branch builds a preview at `https://<branch-slug>.chanclazo.pages.dev`. The slug is the branch name with `/` changed to `-`.
- Every page footer has a build stamp `v1.0.0 · <short sha>` (`.cz-build`). Check a deploy with
  `curl -s URL | grep -o 'v1.0.0 · [0-9a-f]*'`.
- `main` deploys to production chanclazo.com. **Do not merge to main without Gabe's explicit approval.**

## Branches and previews
| Branch | Preview | Contents |
|---|---|---|
| `feat/chancla-waves` | https://feat-chancla-waves.chanclazo.pages.dev/waves | Waves + everything below (Crash, Strike) |
| `feat/chancla-crash` | https://feat-chancla-crash.chanclazo.pages.dev/crash | Crash + Strike |
| `feat/chancla-strike-sling` | https://feat-chancla-strike-sling.chanclazo.pages.dev/chancla-strike | Strike gold-chancla thrower (the name is historical; there is no slingshot now) |
| `design/astro-landing` | https://design-astro-landing.chanclazo.pages.dev/ | Landing page (kids removed, mobile logo + relic centred) |

The flow so far: Strike work lands on `feat/chancla-strike-sling`, is fast-forwarded into `feat/chancla-crash`, then merged into
`feat/chancla-waves`. Merge, don't rebase pushed branches (no force pushes).

## Open TODOs
- **Character sprites (Agent Sprite Forge)**: the Waves atlases are in git (`public/waves/sprites/*-atlas.webp/json`). The source work folder
  `/workspace/chanclazo_assets/sprites-forge` (raw sheets, GIFs, the calavera-boss test) lives on the build box only, not in git. Crash still uses the static kid art.
- **Polish pass, partly done**: `src/play/fx3d.ts` (rings, sparks, glow, hit-stop) is wired into Crash and Waves. Strike has its own 2D canvas polish (gold trail, impact rings, marigold petals, hit-stop). Remaining (free/permissive only) across Crash, Waves and Strike: impact particles, relic glow, marigold petal bursts
  on hits (no floor confetti), screen shake/hit-stop, better code-generated sounds, smooth UI transitions, mobile performance.
- The Strike Level Map card on short landscape phones slightly overlaps the footer copyright line.
- Landing branch `design/astro-landing` and the game branches are separate. Merge them together before any production release.
