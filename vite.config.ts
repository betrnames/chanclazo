import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // Proxy API routes to the Cloudflare Worker during local dev
      // This lets us use relative paths like /score everywhere
      '/score': 'https://chanclazo-worker.betrnames.workers.dev',
      '/leaderboard': 'https://chanclazo-worker.betrnames.workers.dev',
      '/ghost': 'https://chanclazo-worker.betrnames.workers.dev',
      '/presence': 'https://chanclazo-worker.betrnames.workers.dev',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        cruise: path.resolve(__dirname, 'cruise.html'),
        strike: path.resolve(__dirname, 'strike.html'),
        fling: path.resolve(__dirname, 'fling.html'),
        match: path.resolve(__dirname, 'match.html'),
        demos: path.resolve(__dirname, 'demos.html'),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
