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

- **Netlify** (you said it's working):
  ```powershell
  npm run deploy:frontend
  ```
  Requires `netlify-cli` (`npm i -g netlify-cli`) + `netlify link` to your site.
  Auto-deploys on Git push if repo connected in Netlify dashboard.
  Add `netlify.toml` for SPA redirects (already present).

- **Cloudflare Pages** (stays in CF ecosystem, great with your Worker/D1):
  ```powershell
  npm run deploy:pages
  ```
  Or connect GitHub repo in Cloudflare Pages dashboard. Set build: `npm run build`, output: `dist`.
  Can route custom domain easily (you likely use Cloudflare DNS for chanclazo.com).

- **Vercel** (excellent DX, previews, reliable):
  ```powershell
  npm run deploy:vercel
  ```
  Requires `vercel` CLI. Connect repo for Git-based deploys. Add `vercel.json` (present).

All these handle the SPA (client-side routing) with the provided config files.

For custom domain + Bolt issues: Netlify/Vercel/Pages make custom domains trivial. Point DNS to them (or use CF proxy if needed).

## Background
Pivoted from Clawatron concept (April 2026) to chanclazo theme for cultural flavor + Vibejam 2026 submission (May).

Built with bolt.new + Claude AI iteration.

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
