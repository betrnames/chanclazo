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

### Cloudflare Worker (API + D1 only - frontend now on Netlify)
```powershell
npm run deploy:worker
```

(Use the legacy `npm run deploy` only if you want the worker to also serve static assets.)

See updated wrangler.toml (assets section removed for API-only).

### Alternatives for frontend (static Vite SPA)
Since the API lives on the Cloudflare Worker (`WORKER_URL` in `src/api.ts`), you can host the frontend anywhere static:

- **Netlify** (recommended - you said it's working, now fully automated on push):
  1. In Netlify dashboard, import your GitHub repo (betrnames/chanclazo).
  2. It will detect Vite via netlify.toml (build: `npm run build`, publish: `dist`).
  3. Add custom domain chanclazo.com (and www if desired). Netlify gives DNS instructions (CNAME record usually). If using Cloudflare DNS (likely, since your Worker), enable "CNAME flattening" or use the provided records. It may take a few minutes for DNS + SSL to propagate.
  4. With the proxy redirects in netlify.toml (for /score, /leaderboard, /ghost, /presence/*), **the entire site (frontend + all API calls) now lives cleanly under https://chanclazo.com**. No more separate workers.dev domain in browser, no CORS issues.
  5. The code uses relative paths (when VITE_WORKER_URL is empty, which is default) + the proxies handle forwarding to your Cloudflare Worker. See src/api.ts and netlify.toml.
  6. (Optional) You can also add a custom domain directly to your Worker in Cloudflare dashboard if you ever want a api.chanclazo.com etc., and set VITE_WORKER_URL accordingly.

  To trigger deploys on every `git push` (including via your push.bat), just connect the repo. No manual steps needed.

  Local dev: `npm run dev` (vite proxy handles API calls to the worker).

  Local deploy test: `npm run deploy:frontend` (after `npm i -g netlify-cli` and `netlify link`).

- **Cloudflare Pages** (native with your Worker/D1):
  ```powershell
  npm run deploy:pages
  ```
  Or dashboard connect. Use the same Git push flow.

- **Vercel**:
  Similar Git import, uses vercel.json.

## Netlify Automation (Recommended - you already have it working)

### Easiest way (Native Netlify GitHub integration - no secrets or Actions needed)
1. Go to https://app.netlify.com/ and log in (use the account where your working site is).
2. Click "Add new site" > "Import an existing project".
3. Connect GitHub (authorize if needed) and select the "betrnames/chanclazo" repo.
4. Netlify will auto-detect the `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click "Deploy site".
6. Once deployed, go to **Site configuration > Domain management** and add your custom domain `chanclazo.com` (or whatever).
7. **That's it.** Every time you `git push` (or run your push.bat), Netlify will automatically build and deploy the frontend. The API stays on your Cloudflare Worker.

This is the simplest "set it and forget it" automation.

### Alternative: Full GitHub Actions control (using the workflow I added)
I've created `.github/workflows/deploy-netlify.yml` that runs on every push.

**One-time setup (copy these exact steps):**
1. Log into Netlify (https://app.netlify.com).
2. Find your existing site (the one that's "working").
3. Click the site name > **Site configuration** (left sidebar) > **General** > **Site details**.
4. Scroll to "Site information" and copy the value next to **API ID** (e.g. something like "12345678-1234-1234-1234-123456789abc"). This is your `NETLIFY_SITE_ID`.
5. At the top right, click your avatar > **User settings** (or go to https://app.netlify.com/user/settings).
6. In the left menu, click **Applications**.
7. Under "Personal access tokens", click **New access token**.
8. Give it a name like "Grok Chanclazo Deploy", choose "No expiry" or 1 year, then click **Generate token**.
9. **Copy the token immediately** (you won't see it again). This is your `NETLIFY_AUTH_TOKEN`.
10. Now go to your GitHub repo: https://github.com/betrnames/chanclazo/settings/secrets/actions
11. Click **New repository secret** twice:
    - First secret:
      - Name: `NETLIFY_AUTH_TOKEN`
      - Secret: paste the token from step 9
    - Second secret:
      - Name: `NETLIFY_SITE_ID`
      - Secret: paste the API ID from step 4
12. Save them.

**Now it works:**
- Just run your normal `push.bat` (or git push).
- Go to the "Actions" tab in GitHub to watch the "Deploy to Netlify" workflow run.
- It will build and deploy to your Netlify site automatically.
- You can also click "Run workflow" manually in the Actions tab.

The workflow file is fully commented if you want to tweak it later (e.g. add Worker deploy too).

This fully automates publishing on every commit/push using "Grok build" (the Actions + Netlify).

If you run into any error in the Actions logs (e.g. permission issues), paste the error here and I'll fix the workflow.

### Setting up the custom domain `chanclazo.com` on your Netlify site
After the site is deployed via the automation:

1. In the Netlify dashboard for your site, go to **Domain management** (left menu under "Site configuration" or search for "Domains").
2. Under "Custom domains", click "Add custom domain".
3. Enter `chanclazo.com` (and optionally `www.chanclazo.com`).
4. Follow the on-screen instructions for DNS records. Netlify will tell you exactly what to add (usually a CNAME record pointing to a Netlify hostname like `your-site.netlify.app`).

**If you get the error "it has a conflicting custom domain in another account":**
- This is very common after using Bolt.new (Bolt uses Netlify under the hood, so it "claims" the domain in a separate Netlify account/team).
- **Step A (if possible):** Log back into bolt.new, open your old project, go to the hosting/deploy settings, and remove `chanclazo.com` from any custom domains.
- **Step B (most reliable):** Submit a support ticket from **your current Netlify account** (the one with the working site):
  - In Netlify dashboard, click the help "?" icon (bottom right).
  - Choose "Contact support" or go directly to https://www.netlify.com/support/
  - Create a ticket with:
    - Subject: "Release conflicting custom domain `chanclazo.com` from another account (Bolt.new)"
    - Description: 
      "I was using Bolt.new for hosting which associated `chanclazo.com` with another Netlify account. I have now removed the DNS from Bolt and want to use the domain with my primary Netlify site. Please release the domain so I can add it here. 

      Domain ownership proof:
      - DNS managed in Cloudflare (account email: [your CF email])
      - Zone for chanclazo.com shows I control it.

      My current site: [link to your Netlify site]
      Requested domain: chanclazo.com

      I have removed all references from Bolt."
    - Attach: Screenshot of your Cloudflare DNS dashboard showing the chanclazo.com zone (with any existing records).
  - Netlify support usually resolves this within 1-2 business days (sometimes faster).
- Once released, retry adding the custom domain in your main site.
- After adding, update your Cloudflare DNS with the exact records Netlify provides. Use "Proxied" (orange cloud) if possible.
- Netlify auto-provisions a free SSL certificate.
- Propagation can take 5-60 minutes. Test with `https://chanclazo.com`
- Your GitHub Actions will continue to deploy updates automatically to the custom domain.

If support takes time, switch to **Cloudflare Pages** (see section above) — no "conflicting account" issues because it's all in your Cloudflare account/DNS. You can keep using the same GitHub repo and automation (I can help adapt the workflow to `wrangler pages deploy` if needed). The proxy setup in `netlify.toml` would be replaced by equivalent in CF (or use a subdomain for the API Worker).

Once the domain is active on Netlify:
- The frontend SPA will be served from `https://chanclazo.com`
- API calls (via the proxies in `netlify.toml`) will also resolve under the same domain (pointing to your Cloudflare Worker).
- Update `src/api.ts` `WORKER_URL` only if you switch to a custom subdomain for the Worker (e.g. `api.chanclazo.com`).

Let me know the exact error message or screenshot (if comfortable) if you get stuck on the support ticket or DNS step!

For the Cloudflare Worker part (the backend), you can still run `npm run deploy` manually, or I can add it to the same workflow if you give me a Cloudflare API token secret name.

Your netlify.toml and the build are already correct for SPA + your current setup.

### Quick alternative: Cloudflare Pages (avoids Netlify account conflicts entirely)
Since your DNS and backend are already on Cloudflare, this is often the cleanest for `chanclazo.com`:

1. Cloudflare dashboard → Pages → "Create a project" → "Connect to Git" → select "betrnames/chanclazo".
2. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Save & Deploy (first build will happen).
4. In the new Pages project → **Custom domains** → "Add domain" → `chanclazo.com`.
5. CF will guide you (and since DNS is in CF, it often auto-adds the necessary record and verifies quickly).
6. Set as primary domain.
7. For API: 
   - Keep using the current worker.dev URL (CORS is `*` so cross-origin calls from chanclazo.com work).
   - Or add a custom domain to your Worker (Workers & Pages → your worker → Triggers → Custom domains → add e.g. `api.chanclazo.com`), then update `VITE_WORKER_URL` in your Netlify/CF env or code to `https://api.chanclazo.com`.
8. For automation: Add GitHub secret `CLOUDFLARE_API_TOKEN` (create in CF → Profile → API Tokens, with Pages:Edit permissions).
   - I've added `.github/workflows/deploy-pages.yml` that will auto-deploy on push using wrangler (similar to the Netlify one). It uses the secret.

Once set, `git push` (via push.bat) will build and deploy the frontend to Pages on `chanclazo.com`. The proxy setup isn't needed here — just point DNS to Pages.

This should get you on the custom domain without the conflicting account error. If you choose this, we can remove or ignore the Netlify-specific files.

Let me know which path you take (sticking with Netlify + support, or switching to Pages) and paste any errors! I'll refine the workflows/docs immediately.

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
