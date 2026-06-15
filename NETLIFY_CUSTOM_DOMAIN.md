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
