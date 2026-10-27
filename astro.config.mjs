import { defineConfig } from 'astro/config';

// Landing + lore only. Games stay on Vite and are merged into dist/ after build.
export default defineConfig({
  srcDir: './astro',
  publicDir: './public',
  outDir: './dist',
  build: {
    format: 'file',
    assets: '_astro',
  },
  vite: {
    envPrefix: ['VITE_', 'PUBLIC_'],
  },
});
