# Chanclazo – handoff for Chief of Staff

Self-contained takeover notes. Read this first. Owner and approver: **Gabe (GitHub: betrnames)**. Repo: https://github.com/betrnames/chanclazo

## Latest (2026-11-12, night PT) — first wave is only the little skeletons
Gabe: "Load only the small skeletons on start first wave. Wait on larger sprite sheets until 10 secs in."

On top of the v1.1.11 deferral (which still downloaded the boy and girl walk sheets before play):
- `newGame` waits only on `calaverita-small` plus the concha loaf. Boy, girl, eat sheets, the luchador, and the between-waves Abuela art are not requested yet.
- Wave 1 spawns **only** `calaca`.
- At 10 real seconds after the first `newGame` (`performance.now() + 10000`), those larger sheets start downloading. Later waves mix in boy, girl, and jefe only after the boy and girl images have arrived. The luchador still waits for his own sheet. Wave 1 stays little skeletons even after the sheets land.
- No loading screen. The game still starts as soon as the small skeleton is ready.
- Combo callouts are short only: `COMBO x2`, `COMBO x3`, and so on. The long `¡CHANCLAZO!` pop is gone (Waves and the parked Crash).
- **Shipped live as v1.1.13** on 12 Nov 2026. Gabe said "Push live". This release also includes the phone smoothness pass (shared atlas, lower phone quality, capped petals).

## Current state (2026-11-12, night PT)
- Production: **`main` → https://chanclazo.com**. Active follow-up branch can stay **`feat/chancla-waves`**.
- **Live right now is v1.1.13** on `main`. Gabe said "Push live" on 12 Nov 2026. Previous production was **v1.1.12**.
- This release: wave 1 is only the little skeletons, larger sheets wait 10 seconds, combo text is `COMBO xN`, and the phone smoothness pass is included. Abuela's start intro and the Safari outline fix from v1.1.12 stay.
- Preview: https://feat-chancla-waves.chanclazo.pages.dev. Crash is parked but still at `/crash`.
- **Do not push or merge to `main` unless Gabe says "push it live" in that turn.** He did say that for v1.1.7 through v1.1.13.

## Abuela start intro (shipped in v1.1.12, 2026-11-12)
Gabe asked to remove the flying-in chancla and burst, and instead have Abuela come out from the side with a smart chancla quote so it looks like it is part of the scene. "No audio just music playing in start."

- The gold chancla fly-in, starburst, sparks, flash, and Lilita "CHANCLAZO!" overlay (`#czsting`) are gone from Waves (Día de los Muertos), Chancla Strike, and Slots. The gold relic in gameplay is unchanged. `/lp/chancla_burst.webp` is unused leftover — leave the file, do not wire it back in.
- Abuela steps in from the left of the live game scene (no dim, no card, no loading screen), holding her gold chancla — the existing hand-drawn smiling chibi, recompressed as `public/play/abuela-intro.webp` (55 KB). She delivers one line in a speech bubble, then steps back out. About 1.8 s (in 0.42, hold 1.0, out 0.38). A tap (or Esc / Enter / Space) skips, and she exits in 0.28 s. `prefers-reduced-motion` fades in place instead of walking.
- She stands in the stage: feet on the marigold line in Día de los Muertos, on the cemetery floor in Strike, and beside the cabinet in Slots. The between-waves Abuela cameo in Día de los Muertos is unchanged (same art, same lines, same timing).
- Five lines, shuffled with no immediate repeat:
  1. "Mijo, this chancla has your name on it."
  2. "Órale — show me what you've got."
  3. "¡Ándale! The chancla doesn't throw itself."
  4. "Ay, I brought the good one."
  5. "One chancla is all I need, mijo."
- No voice and no intro sound effects. Only the game's existing music plays at the start.
- The game still starts instantly. `playPlayer1Intro` still calls `onDone` immediately. `?start=1` and `?nointro=1` still skip the intro. Test hook: `window.__p1intro.play(game)`, `.seek(u)`, `.skip()`, `.line()`, `.lines()`. The walk-in clock caps each animation frame at 50 ms so a WebGL hitch (common on Día de los Muertos in headless Chrome) cannot jump her to the end and skip the intro.
- Load time: the 55 KB intro sprite is preloaded on the three game pages in place of `/lp/chancla_gold.webp` + `/lp/chancla_burst.webp` (~69 KB). Gold still loads from JS where the relic needs it. The 119 KB between-waves chibi is still deferred until she speaks between waves.
- Stills of the intro: `/workspace/chz-intro/`.
- Safari outline (found on preview 95da896, also present on production v1.1.11): after the intro, a thin gray rectangle sat on the left of Día de los Muertos. It is not a leftover of the start intro. It is the between-waves `#abuelaImg`, which has no `src` until she first speaks. Safari paints an empty-image frame at the HTML width (507px); that overflows the `translateX(-110%)` park and peeks onto the plaza. Fix: `#abuela img:not([src]){display:none}`. The cameo is unchanged. Chromium never showed it (it sizes the unsourced img at the CSS height, fully off-screen).


## Runtime smoothness (shipped in v1.1.13, 2026-11-12)
Gabe said Día de los Muertos was still too slow during play, maybe too many things at once. Load time was already fixed in v1.1.11; this is mid-wave frame rate on his iPhone.

**Cause.** Two big ones, plus clutter:
1. Every kid spawn (and eat pose, and knock-out) did `Texture.clone()`, which bumps `source.needsUpdate` and re-uploads the whole walk atlas to the GPU. The girl sheet is 3360×1770 (~23 MB). Disposing the clone when the kid left could evict that GPU texture, so the next spawn uploaded it again. In a phone-sized 6×-CPU profile this was **31% of CPU** (`texSubImage2D`). After the fix that function is gone from the hot list.
2. Phones started at DPR 2 with a 1024 PCF shadow map, a point light, and a full-screen `backdrop-filter: blur(6px)` over the night photo — all expensive on iOS, and the auto quality drop only kicked in after four seconds of already-bad frames. Petal bursts were also unbounded (70 sprites per luchador KO, 129 on screen in a busy wave 9).

**What changed** (gameplay rules and wave sizes are the same; Abuela intro and the Safari outline fix are unchanged; no slingshot):
- `shareTex()` shares the atlas image without re-uploading. `renderer.initTexture` pins each atlas. Clones are no longer disposed in a way that evicts the GPU texture.
- Phones start at quality 1: DPR 1.5, no real-time shadows (blob shadows under kids stay), no fill point light, no MSAA. If FPS stays under 42 for ~4 s, quality 0 freezes the papel animation and drops to DPR 1. Desktop stays at quality 2 (shadows, DPR 1.75) unless it also drops.
- Petals are pooled and capped (36 on phones, 64 on desktop); KO/bomb bursts are smaller on phones. Crumbs cap at 48 on phones (96 desktop). Fewer spark trails during rapid fire.
- Removed the `backdrop-filter` blur. Phone HUD buttons use a static glow instead of animated `box-shadow`. Score bumps no longer force a layout reflow.
- Hooks: `window.__waves.perf()`, `window.__waves.setQuality(q, lock)`.

**Before / after** (Playwright Chromium, 390×844, DPR 3, 6× CPU throttle, SwiftShader — pessimistic vs a real iPhone GPU, but the comparison is the same machine):
- Wave 1: **8.5 → 18.4 FPS**; 95% of frames over 50 ms → 35%.
- Wave 6 (busy): **11.1 → 16.9 FPS**; worst frame 400 ms → 300 ms; petals peaked at 95, now capped at 36.
- Wave 9 (busiest): **11.4 → 16.6 FPS**; worst frame 167 ms → 133 ms; 16 kids on screen. `texSubImage2D` dropped off the profile.
- Slots and the homepage were loaded at the same size; no console errors, no visual regression.
- Phone screenshot of a busy wave 9 after the fix: `/workspace/chz-perf/after2/wave9-busy-q1.png`.

**Visible tradeoffs on phones:** a slightly softer canvas (DPR 1.5 vs 2; 1.0 only if it is still struggling), no sharp contact shadows from kids or flying chanclas (the painted blob shadows are still there), fewer simultaneous marigold petals and crumbs, gold/bomb button glows are steady instead of pulsing. The hand-drawn art is the same.

## What v1.1.11 shipped (2026-11-12)
Playtested on `feat/chancla-waves` (`89bec92` + `29f437d`, preview SHA `29f437d`) and now on production. Gameplay, visuals, and start rules are unchanged: the game starts instantly with no loading screen, the intro is only the gold chancla flying in and bursting, no camera intro, no "CHANCLAZO!" stinger audio, Abuela only as a between-waves cameo, hand-drawn art.

### What changed
- **Smaller art, same look** (WebP q90, visual QA against the originals; skipped anything that softened: atlases, eat sheets, `head_llama`, gold chancla, burst, Sidro, lander backgrounds).
  - `public/lp/lander-title.webp` 516 KB → 71 KB, plus 840w (39 KB) and 1260w (64 KB) srcset. Homepage preloads the title with `fetchpriority="high"` (taken off the background).
  - `public/play/llama_choose.webp` 376 KB → 96 KB.
  - `public/play/slots/llama_hd.webp` 86 KB → 59 KB (`?v=3`).
  - `public/waves/snack-concha.webp` 188 KB → 121 KB (`?v=3`). New 256px `snack-concha-icon.webp` (17 KB) for the HUD button; the loaf in the lane still uses the full concha.
- **WOFF2 fonts** (`LilitaOne-Regular.woff2` 12 KB) preferred over TTF, with a TTF fallback. Lilita is preloaded on the landing and each game.
- **Deferred non-critical textures.** Waves `newGame` waits only on walk atlases + the concha loaf. Eat sheets, the luchador atlas, and Abuela warm after the first frame (`requestIdleCallback`, 2.5s timeout). The leftover `new Image().src = ABUELA_IMG.mad` at module load is gone. Eat/boss fallbacks still require the sheet image so kids never go invisible. Strike loads Cemetery + sprites first; Mercado and Catacombs wait the same way. Abuela's `<img>` has no `src` until she actually speaks. Walk-atlas `<link rel="preload">` tags were dropped in `29f437d` because they delayed first paint; the sheets still start from JS as soon as the module runs.
- **Preloads** for each game's critical art (night bg, gold chancla + burst, Lilita), using the **same** `?v=` as the JS so the browser does not download twice. Boy atlas is `?v=8` to match.
- **`scripts/merge-dist.mjs`** now cache-busts image and font URLs in JS and CSS as well as HTML (`/lp`, `/play`, `/waves`, `/crash`, `/fonts`).
- **`public/_headers`**: long-cache `immutable` (1 year) for `/assets`, `/_astro`, `/fonts`, `/lp`, `/play`, `/waves`, `/crash`. HTML remains no-cache.

### Preview numbers before this ship (https://feat-chancla-waves.chanclazo.pages.dev, SHA `29f437d`)
Lighthouse 13.6.0, mobile, simulated Slow 4G. Same method as the v1.1.10 live baseline. All five routes play, no console errors, no failed requests. Kids spawn on wave 1. Screenshots match the live look. Title is visible. Abuela, eat sheets, and the luchador are **not** requested until after the game is playable (they show up later in a full Lighthouse session, which is why the waves *total* transfer is still ~2.8 MB). Mercado/Catacombs wait the same way on Strike.

| Route | Perf | FCP | LCP | TBT | Transfer (LH full session) | At playable (Playwright, CF brotli) |
|---|---:|---:|---:|---:|---:|---|
| `/` | **99** (was 74) | 793 (was 951) | **1.8 s** (was **6.0 s**) | 124 (was 214) | **403 KB** (was 883) | 239 KB, title is the 38–62 KB srcset |
| `/choose` | 98 (was 97) | 923 | 923 (was 961) | 174 | **370 KB** (was 658) | 180 KB, llama 94 KB (was 368) |
| `/waves?start=1` | 45 (was 43) | 2.2 s simulated / **238 ms observed** (live was 1.0 s simulated / 245 ms observed) | **4.0 s** (was 4.8 s) | 51 s (was 53 s; 60fps game loop — expected, do not "fix") | 2841 KB full session (was 2903) | **1.56 MB** (three.js 147 KB br, no eat/lucha/Abuela yet), playable in ~2.4 s unthrottled, gated by the girl atlas 614 KB |
| `/chancla-strike?start=1` | **100** (was 94) | 1.3 s | 1.3 s (was 1.4 s) | 28 | 595 KB (was 525; gold+burst preloads over the full session) | **257 KB**, Mercado/Catacombs not yet loaded |
| `/slots?start=1` | **99** (was 72) | 1.2 s | 1.2 s (was 0.9 s) | **106** (was 2386) | 636 KB (was 593) | 197–454 KB, llama_hd 58 KB |

The homepage LCP is now **good** (<2.5 s) and is the 840w title (38 KB) instead of the old 515 KB file. Waves Lighthouse TBT/TTI will stay high because the game loop is running; observed FCP on waves is the same as live (~240 ms). Cache headers: HTML `public, max-age=0, must-revalidate`; art, fonts, and hashed JS `public, max-age=31536000, immutable`.

### What was slow (Lighthouse mobile, Slow 4G, live v1.1.10, before this release)
| Route | Perf | FCP | LCP | TBT | Transfer | Notes |
|---|---:|---:|---:|---:|---:|---|
| `/` | 74 | 951 | **6012** | 214 | 883 KB | LCP is `#ttl` (`lander-title.webp` 515 KB, displayed ~306×66). `fetchpriority` was on the background, not the title. Title stayed `visibility:hidden` until JS `place()`. |
| `/choose` | 97 | — | 961 | — | 658 KB | `llama_choose.webp` 368 KB. |
| `/waves?start=1` | 43 | 911 | 4716 | 45335 | 2903 KB | TBT/TTI are inflated by the 60fps game loop — do **not** "fix" this by delaying start. `newGame` waited on every texture, including eat sheets, the luchador atlas, and Abuela (first needed on wave 3 / first snack / between waves). HUD used the full 188 KB concha for a 52×52 button. |
| `/chancla-strike?start=1` | 94 | — | 1362 | — | 525 KB | Cemetery is level 0, but Mercado and Catacombs backgrounds also loaded immediately. |
| `/slots?start=1` | 72 | — | 872 | 2386 | 593 KB | `llama_hd.webp` was heavier than it needed to be. |

No videos on the site. three.js was already minified and code-split (589 KB raw / 147 KB brotli, only on `/waves`). Sounds are Web Audio (no audio files). GA `gtag` (~180 KB) was left in place.

### Do not
- Do not add a loading screen or delay start.
- Do not "fix" waves TBT by pausing the loop or delaying `newGame`.
- Do not recompress the character atlases, eat sheets, `head_llama`, gold chancla, or burst — those failed visual QA or were already tight.
- Do not delete unused leftovers in `public/` (e.g. large lander-mobile-1500, `snack-elote.webp`); they are not requested.

## What v1.1.10 shipped (2026-11-11)
Playtested on `feat/chancla-waves` (`126499c` and the work leading to it) and now on production.

1. **WAVE CLEAR sits in the mid-plaza, below the papel picado.** The banner is anchored from mid-screen (`bottom: 46%`, 44% / 48% breakpoints). The settle animation rises from below and never up into the bunting. Clean at 390×844, 375×667, and desktop.
2. **Strike's level map clears the footer on short landscape phones.** Short landscape (`max-height: 500px`) map card can scroll, and padding keeps "All games" and the content above the fixed copyright stamp. Gaps: ~14px at 667×375, ~22px at 844×390. Portrait and desktop unchanged.
3. **Soul bursts and a sticky chancla.** From wave 2, mid-field kids throw smashable marigold-and-cyan soul wisps at the marigold line. Smash them with a chancla for bonus points, or lose a heart if they land. A sticky chancla, earned on a wave clear or a CHANCLAZO, plants on the line, holds kids, and auto-throws. Inspiration only from Gabe's Outpost bookmark — no art or code copied. No Abuela except the between-waves cameo. No slingshot.
4. **Games start immediately with a gold-chancla logo burst.** There is no camera intro, no loading screen, and no start delay. The gold chancla (`/lp/chancla_gold.webp`) spins in, then bursts with the hand-drawn starburst, sparks, a flash, and a Lilita One "CHANCLAZO!" slam. The game is already live and playable underneath (`pointer-events: none`). There is **no announcer audio** and no audio file in the build. `?start=1` still skips the burst. Same burst on Waves, Strike, and Slots.

## What v1.1.9 shipped (2026-11-11)
Playtested on `feat/chancla-waves` (`5e6672a`) and on production as of v1.1.9.

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

## What v1.1.7 already had (still true in v1.1.11; do not redo)
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
3. **Abuela appears in two places:** the start walk-in on Waves, Strike, and Slots, and the between-wave cameo in Día de los Muertos (unchanged). No Abuela anywhere else. No AI-generated art.
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
| Día de los Muertos | `/waves` | `waves.html`, `src/play/waves.ts`, `public/waves/` | Lane defence. Concha + bomb + sticky chancla on the left, ghosted until ready, must not jump. Gold chancla throws. Soul bursts from wave 2. See the concha, eating, and soul/sticky notes. |
| Chancla Strike | `/chancla-strike` (`/fling` redirects) | `chancla-strike.html`, `src/play/fling.ts` | Matter.js fort topple. Vertical. No rotate control. Hooks: `window.__fling`. |
| Piñata Slots | `/slots` | `slots.html`, `src/play/slots.ts` | HD llama in the bonus. Gold chevron back, no Games button. |
| Landing | `/` | `astro/pages/index.astro` (production), `home.html` (vite) | Gold chancla, PLAY NOW → `/choose`. |
| Picker | `/choose` | `src/choose/arcade.ts` | Three cabinets: Día de los Muertos, Chancla Strike, Piñata Slots. No Crash, no Abuela. |

### Día de los Muertos, short
- Abuela after each cleared wave, slides in from the left, `ABUELA_LINES` shuffle bag, hold 2.5s, tap her to skip. Pause freezes her clock.
- Boss luchador every 3rd wave. `bossHp`, `BOSS_DMG` 4, `BOSS_RAGE` 1.4.
- Hooks: `window.__waves` → `ready`, `start`, `state`, `kids`, `conchas`, `crumbs`, `placeConcha(lane)`, `giveSnack`, `snack`, `wave(n)`, `spawn(kind, lane, z, speed)`, `clearWave`, `hurt`, `bomb`, `giveBomb`, `rapid`, `pause`, `abuela`, `abuelaLines`, `souls`, `spawnSoul(lane, fromZ, travel)`, `windSoul`, `throwAtSoul`, `giveSticky`, `placeSticky(lane)`, `stickies`, `stopSpawn`. Params: `?start=1` (skips the logo burst), `?wave=N`, `?bombs=N`, `?sticky=N`, `?nointro=1` (same skip). `window.__p1intro.play(game)` replays the burst.
- Wave atlases load while the plaza is already drawing. `newGame` waits only for those textures, never for the burst. `?start=1` skips the burst and still begins once textures are ready.

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

## Gold-chancla logo burst (in v1.1.10 and v1.1.11; replaced in v1.1.12 by the Abuela start intro)
Originally: Gabe rejected every pan/tilt/zoom camera intro, including the luchador pull-out, and then asked to cut the announcer audio and keep only the flying-in chancla with the burst. There is **no camera intro**, **no loading screen**, **no start delay**, and **no "CHANCLAZO!" audio stinger**. The game is live and playable from the first frame.

On boot of Waves, Strike, or Slots, the gold chancla logo (`/lp/chancla_gold.webp`) spins in (a tumbling scale-up, gold backlight), then bursts with the existing hand-drawn starburst (`/lp/chancla_burst.webp`), gold and marigold sparks, a flash, and a Lilita One "CHANCLAZO!" slam. Then it clears. The overlay is `pointer-events: none` and never blocks a throw. The plaza / machine is already running underneath. `prefers-reduced-motion` shows a brief fade instead of the spin. `?start=1` and `?nointro=1` skip the burst so playtests stay clean. Same burst on Waves, Strike, and Slots. No Abuela, no slingshot, no outside-reference copying, no new paid art, no audio file in the build. A leftover free Piper take (not shipped) is still on the box at `/workspace/chz-demo/chanclazo-stinger.mp3` (and `.ogg`, plus the WAV master).

Module: `src/play/player1Intro.ts`. Wired from `waves.ts`, `fling.ts`, and `slots.ts`. `playPlayer1Intro` calls `onDone` immediately. Crash is still parked. Test hook: `window.__p1intro.play(game)` replays the burst (even after `?start=1`). An earlier clip that included the audio is `/workspace/chz-demo/chanclazo-stinger-intro.mp4`. Older camera-intro clips (`player1-intro.mp4`, `player1-intro-v2.mp4`) are leftover and not used.


## Soul burst and sticky chancla (in v1.1.10, 2026-11-11)
Inspired by Gabe's newest X bookmark (11 Nov 2026): [Outpost — "How long can you hold the bridge?"](https://x.com/makeplayai/status/2120571405884600486) by @makeplayai, playable as [Outpost: Deadline Bridge](https://www.makeplay.ai/p/jnet66j6wp). What was cool, used as inspiration only (no art or code copied): hold-the-line pressure, enemies attacking *your* defensive line, and a planted defense when the waves get heavy.

- **Soul burst (wave 2+).** Mid-field kids (jefe and the luchador more often) wind up for ~0.55s with a glowing marigold-and-cyan charge, then throw a hand-drawn wisp (gold petals, cyan spirit core, particle trail) down their lane at the marigold line. Travel starts at ~1.25s and ramps to a floor of 0.9s. Caps stay fair: at most 2 in flight (including wind-ups), cooldown 5.5s down to 2.6s, max per wave `2 + floor((wave-2)/2)` capped at 5. One throw per kid. Smash it with a regular chancla (generous radius, aim assist) for 100 pts, "SOUL SMASH!", and a combo tick. A bomb blast also smashes nearby souls. If it lands: 1 heart, "SOUL HIT!", a cyan-gold flare on that lane. Wave clear waits for in-flight souls. Wave 2 banner: "Souls incoming · smash them with a chancla".
- **Sticky chancla.** Earned on every wave clear (from wave 1, so you have it for wave 2) and once per wave on a CHANCLAZO (combo ≥ 4), max 2 held, one on the field. Tap the cyan-gold button above the concha (or S) to enter placing — four lane pads light up on the line, tap a lane (tap again or Escape cancels). A gold chancla plants at the marigold in that lane, sits for 8s or 4 auto-throws (whichever first), then fades. Kids in that lane get stuck for ~1.35s the first time they reach it (easier to chain into a chanclazo). It auto-throws from the plant at threats in that lane (souls first), without consuming the player's throw cooldown. `?sticky=N` for tests.
- No Abuela except the between-waves cameo. No slingshot. Procedural art + existing `makeChancla` / `glowTex`. New SFX in `crashAudio.ts`: `sfxSoulCast`, `sfxSoulSmash`, `sfxSoulLand`, `sfxStickyPlant`, `sfxStickyCatch`.
- Demo clip: `/workspace/chz-demo/soulburst-sticky.mp4` (390×844).

## Open
- Girl knock-out is a billboard tumble of her complete hit frames (the atlas KO row is cropped and is not drawn). Shipped in v1.1.9. Phone playtest on 11 Nov (390×844 and 375×667): the fall is a complete character, not a cropped card. A real fall clip of this girl is still welcome if Gabe wants one. Ask before replacing the art again.
- Concha crumb burst, natural bite poses, and the whole round loaf — shipped in v1.1.8. Phone playtest on 11 Nov (390×844 and 375×667): the concha is the full round bun with a golden curved base on the cobbles; the girl leans in with a natural bite (no flattened head); crumbs burst as small pink and gold bits and do not pile. No new bugs worth a code change.
- WAVE CLEAR banner overlapping the papel picado — **fixed in v1.1.10.** Anchored from mid-screen (`bottom: 46%`, 44% / 48% breakpoints); the settle animation rises from below, never up into the bunting. Clean at 390×844, 375×667, and desktop. Before/after: `/workspace/chz-shots/polish-before-waves-clear-*.png` and `polish-after-waves-clear-*.png`.
- Strike level map touching the footer on short landscape phones — **fixed in v1.1.10.** Short landscape (`max-height: 500px`) map card can scroll, and padding keeps "All games" and the content above the fixed copyright stamp. Gaps: ~14px at 667×375, ~22px at 844×390. Portrait and desktop unchanged. After stills: `/workspace/chz-shots/polish-after-strike-map-*.png`.
- Gold-chancla logo burst (visual only, no announcer audio), soul bursts, and the sticky chancla — **shipped in v1.1.10.**
- On 375×667 the hearts still sit on the papel picado (pre-existing, not this work). Cosmetic.
- `snack-elote.webp` is junk. Do not add it.
- Boss and `waveSpec` numbers are playtest values. Don't retune unless Gabe says the waves are too easy or too hard.


## Next, only if Gabe asks
- A real fall clip of the flower-crown girl, if he wants the knockdown to stop being a tipped card.
- Crash as a kart racer, with a cabinet, when he asks.
