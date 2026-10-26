import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        lore: path.resolve(__dirname, 'lore.html'),
        strike: path.resolve(__dirname, 'strike.html'),
        fling: path.resolve(__dirname, 'fling.html'),
        match: path.resolve(__dirname, 'match.html'),
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
