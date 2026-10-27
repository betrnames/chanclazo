#!/usr/bin/env node
/**
 * Merge Vite game builds (dist-games/) into Astro output (dist/).
 * Keeps Astro index.html; copies fling/match/slots/lore HTML + their assets/.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const GAMES = join(ROOT, 'dist-games');
const DIST = join(ROOT, 'dist');

if (!existsSync(GAMES)) {
  console.error('merge-dist: dist-games missing — run vite build first');
  process.exit(1);
}
if (!existsSync(DIST)) {
  console.error('merge-dist: dist missing — run astro build first');
  process.exit(1);
}

const htmlFiles = ['fling.html', 'match.html', 'slots.html', 'lore.html'];
for (const f of htmlFiles) {
  const src = join(GAMES, f);
  if (!existsSync(src)) {
    console.warn('merge-dist: skip missing', f);
    continue;
  }
  cpSync(src, join(DIST, f));
  console.log('copied', f);
}

// Merge Vite assets/ (hashed JS/CSS for games) without wiping Astro _astro/
const assetsSrc = join(GAMES, 'assets');
const assetsDst = join(DIST, 'assets');
if (existsSync(assetsSrc)) {
  mkdirSync(assetsDst, { recursive: true });
  for (const name of readdirSync(assetsSrc)) {
    cpSync(join(assetsSrc, name), join(assetsDst, name), { recursive: true });
  }
  console.log('merged assets/');
}

// Ensure _redirects/_headers from public survived (Astro copies public/)
for (const f of ['_redirects', '_headers']) {
  if (!existsSync(join(DIST, f))) {
    const fromPublic = join(ROOT, 'public', f);
    if (existsSync(fromPublic)) {
      cpSync(fromPublic, join(DIST, f));
      console.log('restored', f);
    }
  }
}

console.log('merge-dist: ok');
