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
- **No Abuela anywhere**: Crash, Waves, Strike, their cards, how-to text and share images.
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
| **Chancla Waves** | `/waves` | `waves.html`, `src/play/waves.ts`, `public/waves/` | three.js lane defence. Tap or drag at a kid to throw. Gold chancla button auto-aims. Golden kid = RAPID FIRE. **Girl** is the new flower-crown chibi: `catrina-girl-atlas.webp` 2576×1086, cell 368×362, anchor 184,354, walk 7 / hit 1 / ko 2, loaded as `?v=3`. The cell is wide so her fall fits; hit box and shadow use the standing body (`220 / cw`). **Boy** is `calavera-boy` 3328×1302, walk 6 / hit 1 / ko 3. Luchador boss every 3rd wave. Bomb button is fixed on the left (`#powers`), ghosted with opacity only until a bomb is ready, and must not jump when it lights. Title screen is only the gold chancla and TAP TO PLAY. Hooks: `window.__waves`. |
| **Chancla Strike** (main game) | `/chancla-strike` (legacy `/fling` redirects) | `chancla-strike.html`, `src/play/fling.ts`, `flingAudio.ts` | Matter.js 2D fort-topple game, 9 levels in 3 areas. Phones play it in landscape. Throw = pull back the floating gold chancla (or drag anywhere), with a power meter and dotted arc, release to fling. Level select = **Level Map** overlay (HUD button), stars unlock areas. Hooks: `window.__fling`. |
| Strike 3D (runner) | `/strike3d` | `strike3d.html`, `src/play/strike3d.ts` | Separate endless runner. Not the main Strike. |
| Landing page | `/` | `astro/pages/index.astro` (production) and `home.html` (vite preview) | Full-bleed plaza. Logo is lowered out of the header. Tagline banner is centered under the logo. Gold relic chancla spins in and floats in the middle. PLAY NOW sits just under the chancla and stays hidden until placed, so it never flashes in the header. No loading screen. No trio overlay. PLAY NOW goes to `/choose`. |
| Game picker | `/choose` | `astro/pages/choose.astro` and `choose.html` | Character map, not a carousel. Tap Abuela → Chancla Strike, Llama → Piñata Slots, Sidro → Chancla Waves. Crash is not on this screen (still at `/crash`). |
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
- `/choose` is the character map (Abuela, Llama, Sidro). Do not put Crash back on it unless Gabe asks.
- Waves title screen is only the gold chancla and TAP TO PLAY.
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
- The old Day-of-the-Dead **town map** `/choose` (commit `1d0af71`, Oct 28) was replaced by the carousel in `57f61ba`.
  Neither production nor the previews has it. Restore it only if Gabe asks.
- Landing branch `design/astro-landing` and the game branches are separate. Merge them together before any production release.
