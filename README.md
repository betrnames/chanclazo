# chanclazo

**Chancla Strike** — a fast, funny 3D survival game. Dodge the chanclas.

Play: [https://chanclazo.com](https://chanclazo.com)

> "When words fail, the chanclazo speaks!"

A love letter to Latino culture. Mom, abuela, or tía never misses.

## How to Play

- **Move**: A / D or ← →
- **Jump**: W / ↑
- **Duck**: S / ↓ (avoid low pans!)
- **Strike Back**: SPACE (or click/tap the golden ring when a chancla is close — send it back at mom for big points + chance of shield/heart)

Survive escalating waves. Complete the time + score goal to advance levels. 5 levels total. Final boss is pure chaos.

Gold chanclas = double damage. Combos on strikes. Lucky strike-backs can heal or shield you.

Live leaderboard + handle for bragging rights.

## Levels

1. Irritated Mom — 45s / 1k pts
2. Angry Mom — 55s / 2.5k pts
3. Furious Mom — 65s / 5k pts
4. Raging Mom — 75s / 9k pts
5. FINAL BOSS MOM — 90s / 15k pts (tsunami waves, everything at once)

## Tech

- React 19 + TypeScript + Vite + Tailwind + shadcn/ui
- Three.js (WebGL, billboarded sprite animations, low-poly cozy living room)
- Cloudflare Workers + D1 (leaderboard, ghosts, live presence)
- Procedural-ish audio + particles
- Bilingual (en/es)

## Local Dev

```powershell
cd Projects/chanclazo
npm install
npm run dev
```

Open http://localhost:5173 (or the port shown).

Typecheck: `npm run typecheck`

Build: `npm run build`

## Deploy

### Cloudflare (current, Worker + Assets + D1)
```powershell
npm run deploy
```
Or manually: `npm run build && wrangler deploy --assets=./dist`

See wrangler.toml.

### Alternatives for frontend (static Vite SPA)
Since the API lives on the Cloudflare Worker (`WORKER_URL` in `src/api.ts`), you can host the frontend anywhere static:

- **Netlify** (recommended - you said it's working, now fully automated on push):
  1. In Netlify dashboard, import your GitHub repo (betrnames/chanclazo).
  2. It will detect Vite via netlify.toml (build: `npm run build`, publish: `dist`).
  3. For the Worker API, your `WORKER_URL` in src/api.ts points to Cloudflare (fine, or proxy if desired).
  4. Add custom domain chanclazo.com.

  To trigger deploys on every `git push` (including via your push.bat), just connect the repo. No manual steps needed.

  Local: `npm run deploy:frontend` (after `npm i -g netlify-cli` and linking your site).

- **Cloudflare Pages** (native with your Worker/D1):
  ```powershell
  npm run deploy:pages
  ```
  Or dashboard connect. Use the same Git push flow.

- **Vercel**:
  Similar Git import, uses vercel.json.

## Full GitHub Actions Automation (for Netlify)
I've added `.github/workflows/deploy-netlify.yml` that runs on every push to main:
- Checks out code
- Builds with Node 20
- Deploys to Netlify using CLI + secrets

**Setup steps for full automation:**
1. In Netlify: Go to your site → Site configuration → General → Site details → copy "API ID" (this is NETLIFY_SITE_ID).
2. In Netlify: User settings → Applications → Personal access tokens → New access token (name it, copy it). This is NETLIFY_AUTH_TOKEN.
3. In GitHub repo (betrnames/chanclazo):
   - Settings → Secrets and variables → Actions → New repository secret:
     - Name: `NETLIFY_AUTH_TOKEN` → value from step 2
     - Name: `NETLIFY_SITE_ID` → value from step 1
4. Now, just `git push` (or use your push.bat) and the workflow will build + deploy to Netlify automatically.
5. You can also manually trigger from GitHub Actions tab.

This replaces Bolt hosting entirely. Netlify will handle the SPA hosting reliably.

See the workflow file for details. If you want to also automate the Worker deploy (`npm run deploy`), we can add a separate job/step (requires Cloudflare API token secret).

## Background
Pivoted from Clawatron concept (April 2026) to chanclazo theme for cultural flavor + Vibejam 2026 submission (May).

Built with bolt.new + Claude AI iteration.

## Credits & Links

- X: [@ChanclaStrike](https://x.com/ChanclaStrike)
- Email: contact@chanclazo.com
- Lore / backstory: [/lore](https://chanclazo.com/lore)

© 2026 Chanclazo. All rights reserved. (But the chancla belongs to every Latina mom.)

---

Made with ❤️ y coraje. No corras que te alcanzo.
