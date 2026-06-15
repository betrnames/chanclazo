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

## Deployment (for the custom domain site)
**Important for new Netlify site / "new build"**:
- The GitHub Action deploys using `netlify-cli` to the site specified by the `NETLIFY_SITE_ID` secret.
- If you created a *new* Netlify site and connected the repo + domain there:
  1. Get the new Site ID: Netlify dashboard > your site (the one showing chanclazo.com in domains) > Site settings > General > "Site information" > copy "Site ID".
  2. In GitHub repo > Settings > Secrets and variables > Actions: set `NETLIFY_SITE_ID` to that value (update it every time you use a new Netlify site).
  3. `NETLIFY_AUTH_TOKEN` is your Netlify personal access token (create in Netlify account settings if needed, scope "Deploy").
- Then `git push` (push.bat) or trigger the Action manually from the Actions tab.
- The Action will fail if SITE_ID is wrong/old or token invalid — check the log of the failed run for the exact error.

Simple alternative (recommended if Action is confusing):
- Since you connected the GitHub repo in the Netlify site UI, Netlify can auto-deploy on push.
- In Netlify site: Site settings > Build & deploy > Continuous deployment > Build settings:
  - Build command: `npm run build`
  - Publish directory: `dist`
- Just push code, Netlify builds and deploys automatically (the custom Action is optional extra).

See NETLIFY_CUSTOM_DOMAIN.md for full details, the deploy-netlify.ps1 local helper, and troubleshooting.

- **Worker only**: `npm run deploy:worker` (or wrangler deploy) when changing the API.

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
