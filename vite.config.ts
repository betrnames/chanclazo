import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

function htmlEnv() {
  const site = process.env.VITE_SITE_URL || 'https://chanclazo.com';
  return {
    name: 'html-env',
    transformIndexHtml(html: string) {
      return html.replaceAll('%VITE_SITE_URL%', site);
    },
  };
}

// Games + lore only. Landing is Astro (see astro.config.mjs + scripts/merge-dist.mjs).
export default defineConfig({
  plugins: [react(), htmlEnv()],
  server: { host: true },
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
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
