# Netlify Custom Domain Setup for chanclazo.com

**Status**: chanclazo.com is now on Netlify DNS. This doc summarizes the final config for the full site (game + API) under the custom domain.

## What works
- Frontend SPA served by Netlify at https://chanclazo.com
- All API calls (`/score`, `/leaderboard`, `/ghost`, `/presence/*`) transparently proxied by Netlify to the Cloudflare Worker (no CORS in browser, same-origin).
- Worker is API-only (D1 data); no assets served from wrangler anymore.

## Key config files
- `netlify.toml`: Proxies + SPA fallback + www → apex 301
- `src/api.ts`: `WORKER_URL = ''` (relative paths) — this is the key for custom domain
- `vite.config.ts`: dev server proxy for local `/score` etc.
- `src/worker.ts`: Updated CORS allowlist for chanclazo.com + localhost (tightened from `*`)
- `wrangler.toml`: API-only worker + D1 binding

## Deployment
1. Push to main → GitHub Action auto `npm run build` + `npx netlify-cli deploy --prod --dir=dist`
2. Worker: run `npm run deploy:worker` (or `wrangler deploy`) when worker.ts changes
3. In Netlify dashboard:
   - Site > Domain management > Custom domains: ensure `chanclazo.com` and `www.chanclazo.com` are added and "DNS verified".
   - Since "on Netlify DNS", the nameservers are pointed at Netlify. Netlify handles the records automatically once domain is added.

## Netlify DNS notes
- At registrar (Namecheap or wherever), nameservers point to Netlify's.
- Netlify automatically provisions SSL (Let's Encrypt).
- Add both apex and www in Netlify UI so the 301 redirect works.

## Testing on custom domain
- Visit https://chanclazo.com
- Play a game → check leaderboard/presence (network tab should show calls to https://chanclazo.com/score etc., which Netlify proxies).
- No "blocked by CORS" errors.

## Local dev still works
`npm run dev` — vite.config.ts proxies the API paths to the live worker.

## If issues
- Re-deploy frontend after any netlify.toml change.
- Check Netlify "Deploy log" and "Functions" (though we use redirects not Netlify Functions).
- Worker logs: `wrangler tail` or dashboard.
- DNS propagation: can take time; use https://dnschecker.org

The entire experience (game + scores + ghosts) now lives cleanly at chanclazo.com thanks to the proxy pattern.

See also README.md (deployment section) and push.bat.

## Troubleshooting: "Domain shows in Netlify DNS but I only see placeholder / no game build on chanclazo.com"

This is the most common issue when first setting up custom domain + Netlify DNS.

**Cause**: Netlify DNS / the custom domain is attached to a specific Netlify *site*. The GitHub Action (or manual deploy) may be targeting a *different* site via the `NETLIFY_SITE_ID` secret. The domain "sees" the (possibly empty or old) content of the site it is bound to.

**How to fix (automated path)**:
1. In Netlify dashboard, find the site that lists `chanclazo.com` under Domain management → Custom domains. This is the "owner" site.
2. Copy its **Site ID** (Site settings → General → Site information → "Site ID" or "API ID").
3. Go to your GitHub repo → Settings → Secrets and variables → Actions.
4. Edit `NETLIFY_SITE_ID` and paste the exact Site ID from step 1.
5. Save.
6. Go to Actions tab → "Deploy to Netlify" workflow → "Run workflow" (or just push a new commit with `push.bat`).
7. Watch the logs. The deploy step will now target the correct site. When it succeeds, the game will appear at https://chanclazo.com.

**Quick manual deploy to the correct site** (bypass secrets for testing):
- There's a helper script now: `deploy-netlify.ps1`
- Run in PowerShell (it will prompt for the ID if not set):
  ```powershell
  cd "C:\Users\gabem\Projects\chanclazo"
  .\deploy-netlify.ps1 -SiteId "paste-the-site-id-here-from-step-1"
  ```
- Or set the env var first: `$env:NETLIFY_SITE_ID = "the-id"`
- After success, hard refresh https://chanclazo.com.

**Verify the Action is using the right site**:
In the GitHub Action log for the "Deploy to Netlify" step, look for the line that shows `--site <id>` or the "Website is live" URL. It must match the site that has the domain.

Once the correct site has at least one successful production deploy after the domain was added, the DNS will serve the real build (the big JS bundle with the game).

After fixing the secret, all future `git push` (via push.bat) will automatically deploy the project build to the domain.

