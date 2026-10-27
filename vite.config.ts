import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
function htmlEnv() {
  const site = process.env.VITE_SITE_URL || 'https://chanclazo.com';
  return {
    name: 'html-env',
    transformIndexHtml(html: string) {
      return html.replaceAll('%VITE_SITE_URL%', site);
    },
  };
}

export default defineConfig({
  plugins: [react(), htmlEnv()],
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        lore: path.resolve(__dirname, 'lore.html'),
        fling: path.resolve(__dirname, 'fling.html'),
        match: path.resolve(__dirname, 'match.html'),
        slots: path.resolve(__dirname, 'slots.html'),
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
