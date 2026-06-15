# chanclazo

**Chancla Strike** — a 3D browser survival game. Dodge the chanclas (flip-flops) in escalating waves of mom rage. A Latino culture love letter built with Three.js, React, Matter.js physics (for bonus slingshot mode), and Cloudflare (D1 + Worker).

Live at: **https://chanclazo.com**

## Features
- Main 3D game (Three.js): multiple characters (luchador default), random Mexican/Dia de los Muertos inspired full-screen backgrounds, escalating difficulty, score/ghost replays.
- Bonus 2D slingshot game (Matter.js + Canvas): pinata targets in formation, exploding particles on hit, 3 strikers (chancla, sugarskull, luchador head), "out of strikes", levels.
- Persistent leaderboard, ghost replays (other players' runs), live presence count.
- Mobile-first, full-screen, sideways prompt for bonus game, nice hover/glow animations, no black screens.

## Stack
- Frontend: React 19 + TypeScript + Vite + Three.js + Tailwind
- Bonus game physics: Matter.js (2D)
- Backend: Cloudflare Workers + D1 (scores, ghosts, presence)
- Hosting: Netlify (frontend + custom domain chanclazo.com) + Cloudflare Worker (API)
- Automation: GitHub Actions → Netlify deploy on push

## Development
```powershell
cd "C:\Users\gabem\Projects\chanclazo"
npm install
npm run dev
```

- Typecheck: `npm run typecheck`
- Build: `npm run build`

Local API calls use Vite proxy (see vite.config.ts).

## Deployment
- **Frontend + full site**: `git push` (or run `push.bat`). GitHub Action builds and deploys to Netlify using `netlify-cli`.
  - Secrets needed on the repo: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
- **Worker only** (when worker.ts or wrangler.toml changes): `npm run deploy:worker`

See **NETLIFY_CUSTOM_DOMAIN.md** for the final custom domain (chanclazo.com) + Netlify DNS setup, proxy rules, CORS tightening, and verification steps.

The site is now fully on chanclazo.com (frontend + proxied API) with no CORS issues thanks to the relative URL + netlify.toml redirects pattern.

## Custom Domain (Finished)
- chanclazo.com is configured on Netlify DNS.
- www.chanclazo.com redirects to apex.
- All game features (scores, leaderboard, ghosts, presence) work under the custom domain.
- See NETLIFY_CUSTOM_DOMAIN.md for exact steps, troubleshooting, and how the proxy + allowlist was finalized.

## Other scripts
- `npm run deploy:frontend` — manual Netlify deploy of dist/
- `npm run deploy:pages` — Cloudflare Pages alternative
- Various .bat helpers for Windows (pullpush, test_api, d1list, etc.)

## Data / Attribution
- Backgrounds and assets are custom / public domain inspired by Mexican culture and Dia de los Muertos.
- Game is free to play, scores are public.

## Contributing / Contact
contact@chanclazo.com

---

Built iteratively with Grok. All major polish (full-screen backgrounds, pinata explosions, glow strikes, out-of-strikes text, lama easter egg, custom domain automation) completed per user feedback.
