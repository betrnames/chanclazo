import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

function htmlEnv(): Plugin {
  const site = process.env.VITE_SITE_URL || 'https://chanclazo.com';
  let serve = false;
  return {
    name: 'html-env',
    configResolved(c) { serve = c.command === 'serve'; },
    // In a build, %%CZ_BUILD%% is left in place so scripts/merge-dist.mjs stamps it with "v<version> · <commit>"
    // (same as the Astro pages). The dev server shows "dev".
    transformIndexHtml(html: string) {
      const out = html.replaceAll('%VITE_SITE_URL%', site);
      return serve ? out.replaceAll('%%CZ_BUILD%%', 'dev') : out;
    },
  };
}

/** Dev-only clean URLs so /waves, /crash, /choose match the production paths. */
function cleanGameUrls(): Plugin {
  const map: Record<string, string> = {
    "/": "/home.html",
    "/choose": "/choose.html",
    "/waves": "/waves.html",
    "/crash": "/crash.html",
    "/chancla-strike": "/chancla-strike.html",
    "/match": "/match.html",
    "/slots": "/slots.html",
    "/lore": "/lore.html",
    "/strike3d": "/strike3d.html",
    "/fling": "/chancla-strike.html",
  };
  return {
    name: "clean-game-urls",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const q = req.url.indexOf("?");
        const pathname = q === -1 ? req.url : req.url.slice(0, q);
        const dest = map[pathname];
        if (dest) req.url = dest + (q === -1 ? "" : req.url.slice(q));
        next();
      });
    },
  };
}

// Games + lore only. Landing is Astro (see astro.config.mjs + scripts/merge-dist.mjs).
export default defineConfig({
  plugins: [cleanGameUrls(), react(), htmlEnv()],
  server: { host: true, port: 8080, strictPort: true },
  build: {
    outDir: 'dist-games',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        lore: path.resolve(__dirname, 'lore.html'),
        fling: path.resolve(__dirname, 'chancla-strike.html'),
        match: path.resolve(__dirname, 'match.html'),
        slots: path.resolve(__dirname, 'slots.html'),
        strike3d: path.resolve(__dirname, 'strike3d.html'),
        crash: path.resolve(__dirname, 'crash.html'),
        waves: path.resolve(__dirname, 'waves.html'),
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
