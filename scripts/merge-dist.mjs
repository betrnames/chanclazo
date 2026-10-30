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

const htmlFiles = ['fling.html', 'match.html', 'slots.html', 'strike3d.html', 'lore.html'];
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

// Build stamp: package version + short commit (Cloudflare Pages env, else git, else 'dev')
{
  const { readFileSync, writeFileSync, readdirSync, statSync } = await import('node:fs');
  const { execSync } = await import('node:child_process');
  const ver = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  let sha = (process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7);
  if (!sha) { try { sha = execSync('git rev-parse --short=7 HEAD', { cwd: ROOT }).toString().trim(); } catch { sha = 'dev'; } }
  const stamp = `v${ver} · ${sha}`;
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  let n = 0;
  for (const f of walk(DIST)) if (/\.(html|js)$/.test(f)) { const t = readFileSync(f, 'utf8'); if (t.includes('%%CZ_BUILD%%')) { writeFileSync(f, t.split('%%CZ_BUILD%%').join(stamp)); n++; } }
  console.log('build stamp', stamp, 'in', n, 'files');
}

// Cache-bust static images referenced from built HTML: /lp/* and /play/* get ?v=<content md5 (8)>
{
  const { readFileSync, writeFileSync, readdirSync, statSync, existsSync: ex } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const memo = new Map();
  const hashOf = (rel) => { if (!memo.has(rel)) { const fp = join(DIST, rel); memo.set(rel, ex(fp) ? createHash('md5').update(readFileSync(fp)).digest('hex').slice(0, 8) : null); } return memo.get(rel); };
  let n = 0;
  for (const f of walk(DIST)) if (f.endsWith('.html')) {
    const t = readFileSync(f, 'utf8');
    const u = t.replace(/(["'\s,(])(\/(?:lp|play)\/[\w.\-\/]+\.(?:webp|png|jpe?g|gif|svg))(?![?\w])/g, (m, pre, path) => { const h = hashOf(path.slice(1)); return h ? `${pre}${path}?v=${h}` : m; });
    if (u !== t) { writeFileSync(f, u); n++; }
  }
  console.log('cache-bust images in', n, 'html files');
}
console.log('merge-dist: ok');
