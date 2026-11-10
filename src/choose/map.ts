// /choose: the Chanclazo mini map. An illustrated Day of the Dead town (night plaza) where every game is a landmark you tap.
// One source for both pages: astro/pages/choose.astro renders mapHtml() at build time; choose.html (vite dev) injects it at runtime.
// Everything is code-drawn SVG plus the existing character cut-outs. No Abuela (Gabe's rule): Strike is the floating gold chancla.
//
// Layout: two SVGs (landscape 1600x1000, portrait 800x1700). CSS shows one by screen shape. Each uses
// preserveAspectRatio="meet" + overflow:visible, so landmarks always fit on screen and the painted background
// (drawn far past the viewBox) fills any extra space, so there are never empty bands.

export interface Spot {
  id: string; href: string; name: string; place: string; tag?: string;
  art: string; artW: number; artH: number; landmark: 'ofrenda' | 'panteon' | 'mercado' | 'kiosco'; color: string;
}

export const SPOTS: Spot[] = [
  { id: 'waves', href: '/waves', name: 'Chancla Waves', place: 'La Ofrenda · Sidro', tag: 'NEW', art: '/play/v2/sidro.webp', artW: 306, artH: 720, landmark: 'ofrenda', color: '#ff8c1a' },
  { id: 'strike', href: '/chancla-strike?start=1', name: 'Chancla Strike', place: 'El Panteón', tag: 'MAIN GAME', art: '/lp/chancla_gold.webp', artW: 800, artH: 800, landmark: 'panteon', color: '#ffd23f' },
  { id: 'crash', href: '/crash', name: 'Chancla Crash', place: 'El Mercado', art: '/crash/kids-card.webp', artW: 523, artH: 440, landmark: 'mercado', color: '#18c8c0' },
  { id: 'slots', href: '/slots?start=1', name: 'Piñata Slots', place: 'El Kiosco · Llama', tag: 'MINI GAME', art: '/play/llama_choose.webp', artW: 504, artH: 954, landmark: 'kiosco', color: '#e2197a' },
];

type XY = [number, number];
interface Layout { cls: string; W: number; H: number; spots: XY[]; path: string; fountain: XY | null; title: XY; s: number }
const LAND: Layout = {
  cls: 'land', W: 1600, H: 1000, s: 1,
  spots: [[250, 610], [625, 815], [975, 610], [1350, 815]],
  path: 'M 250 660 C 380 720, 470 870, 625 865 S 840 650, 975 660 S 1220 870, 1350 865',
  fountain: null, title: [800, 96],
};
const PORT: Layout = {
  cls: 'port', W: 800, H: 1700, s: 1,
  spots: [[215, 650], [590, 845], [215, 1290], [590, 1485]],
  path: 'M 215 700 C 300 800, 470 760, 590 895 S 300 1180, 215 1340 S 470 1430, 590 1535',
  fountain: [400, 1065], title: [400, 104],
};

// tiny seeded random so the server and client draw the same stars
function rng(seed: number): () => number { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const f = (n: number) => Math.round(n * 10) / 10;

function sky(L: Layout): string {
  const r = rng(L.W + L.H); let stars = '';
  for (let i = 0; i < 70; i++) {
    const x = -L.W + r() * L.W * 3, y = -L.H * 0.6 + r() * L.H * 0.85;
    stars += `<circle class="star" cx="${f(x)}" cy="${f(y)}" r="${f(1 + r() * 2.2)}" style="animation-delay:${f(-r() * 4)}s"/>`;
  }
  const mx = L.cls === 'land' ? 1420 : 650, my = L.cls === 'land' ? 120 : 250;
  return `<rect x="${-L.W * 2}" y="${-L.H * 2}" width="${L.W * 5}" height="${L.H * 5}" fill="url(#cz-sky-${L.cls})"/>
  ${stars}
  <circle cx="${mx}" cy="${my}" r="120" fill="url(#cz-moonglow)"/><circle cx="${mx}" cy="${my}" r="46" fill="#fff4cf"/><circle cx="${mx - 12}" cy="${my - 8}" r="8" fill="#f3e2a6" opacity=".7"/><circle cx="${mx + 14}" cy="${my + 12}" r="6" fill="#f3e2a6" opacity=".6"/>`;
}

// town silhouette along the horizon with glowing windows
function town(L: Layout): string {
  const r = rng(7 + L.W); const y0 = L.cls === 'land' ? 380 : 520; let out = '';
  let x = -L.W;
  while (x < L.W * 2) {
    const w = 70 + r() * 90, h = 70 + r() * 120, c = ['#2b1148', '#331556', '#24103d', '#2a1a52'][Math.floor(r() * 4)];
    out += `<rect x="${f(x)}" y="${f(y0 - h)}" width="${f(w)}" height="${f(h + 40)}" fill="${c}"/>`;
    if (r() < 0.35) out += `<path d="M ${f(x + w * 0.2)} ${f(y0 - h)} q ${f(w * 0.3)} -48 ${f(w * 0.6)} 0 z" fill="${c}"/><rect x="${f(x + w * 0.47)}" y="${f(y0 - h - 66)}" width="6" height="22" fill="${c}"/>`;
    else out += `<path d="M ${f(x - 6)} ${f(y0 - h)} L ${f(x + w / 2)} ${f(y0 - h - 26 - r() * 20)} L ${f(x + w + 6)} ${f(y0 - h)} z" fill="#3e1a66"/>`;
    for (let wy = y0 - h + 22; wy < y0 - 18; wy += 34) for (let wx = x + 14; wx < x + w - 22; wx += 30) if (r() < 0.55) out += `<rect class="win" x="${f(wx)}" y="${f(wy)}" width="14" height="18" rx="7" style="animation-delay:${f(-r() * 6)}s"/>`;
    x += w + 4 + r() * 16;
  }
  return `<g class="town">${out}</g>`;
}

function ground(L: Layout): string {
  const y0 = L.cls === 'land' ? 380 : 520;
  const r = rng(99 + L.H); let cob = '';
  for (let i = 0; i < 260; i++) {
    const x = -L.W + r() * L.W * 3, y = y0 + 20 + r() * (L.H * 2);
    cob += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(10 + r() * 16)}" ry="${f(5 + r() * 7)}"/>`;
  }
  const [fx, fy] = L.fountain || [L.W / 2, L.H * 0.6];
  return `<rect x="${-L.W * 2}" y="${y0}" width="${L.W * 5}" height="${L.H * 4}" fill="url(#cz-ground-${L.cls})"/>
  <g class="cobbles">${cob}</g>
  <ellipse cx="${fx}" cy="${fy + 40}" rx="${L.cls === 'land' ? 520 : 360}" ry="${L.cls === 'land' ? 230 : 300}" fill="#3a2150" opacity=".55"/>
  ${L.fountain ? fountain(fx, fy) : ''}`;
}

function fountain(x: number, y: number): string {
  return `<g class="fountain" transform="translate(${x} ${y})" aria-hidden="true">
    <ellipse cx="0" cy="42" rx="150" ry="40" fill="#1a0b2a" opacity=".5"/>
    <ellipse cx="0" cy="20" rx="140" ry="40" fill="#5a3a78"/><ellipse cx="0" cy="12" rx="124" ry="32" fill="#2a8fb0"/><ellipse cx="0" cy="12" rx="124" ry="32" fill="url(#cz-water)"/>
    <rect x="-14" y="-70" width="28" height="82" rx="6" fill="#6b4a8a"/><ellipse cx="0" cy="-70" rx="56" ry="14" fill="#7a5a9a"/><ellipse cx="0" cy="-74" rx="44" ry="9" fill="#2a8fb0"/>
    <path class="spray" d="M 0 -78 C -10 -120, -40 -110, -50 -76 M 0 -78 C 10 -120, 40 -110, 50 -76 M 0 -78 L 0 -128" stroke="#bff4ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
    ${[...Array(10)].map((_, i) => { const a = (i / 10) * Math.PI * 2; return `<circle cx="${f(Math.cos(a) * 132)}" cy="${f(20 + Math.sin(a) * 36)}" r="9" fill="${i % 2 ? '#ff8c1a' : '#ffb000'}"/>`; }).join('')}
  </g>`;
}

function papel(L: Layout): string {
  const cols = ['#e2197a', '#18c8c0', '#ff8c1a', '#8a3cff', '#ffd23f', '#3cc85a'];
  const rows = L.cls === 'land' ? [[-200, 180, 1800, 210], [-200, 300, 1800, 270]] : [[-100, 210, 900, 240], [-100, 360, 900, 330]];
  let out = '';
  rows.forEach(([x1, y1, x2, y2], ri) => {
    const n = Math.round((x2 - x1) / 58), sag = 46;
    out += `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag * 2} ${x2} ${y2}" stroke="#d9c7ff" stroke-width="2" fill="none" opacity=".6"/>`;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * ((x1 + x2) / 2) + t * t * x2;
      const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * ((y1 + y2) / 2 + sag * 2) + t * t * y2;
      const c = cols[(i + ri * 3) % cols.length];
      out += `<g class="flag" style="animation-delay:${f(-i * 0.23)}s" transform="translate(${f(x)} ${f(y)})"><path d="M -20 0 H 20 V 34 L 14 40 L 7 34 L 0 40 L -7 34 L -14 40 L -20 34 Z" fill="${c}"/><circle cx="0" cy="15" r="6" fill="#000" opacity=".25"/><path d="M -10 24 h 20" stroke="#000" stroke-width="3" opacity=".2"/></g>`;
    }
  });
  return `<g class="papel" aria-hidden="true">${out}</g>`;
}

// ── landmarks (local coords: origin = ground point, y up is negative) ──
function candle(x: number, y: number, h = 26): string {
  return `<g transform="translate(${x} ${y})"><rect x="-6" y="${-h}" width="12" height="${h}" rx="3" fill="#fff1d0"/><ellipse class="flame" cx="0" cy="${-h - 10}" rx="6" ry="11" fill="url(#cz-flame)"/><circle cx="0" cy="${-h - 8}" r="20" fill="url(#cz-candleglow)"/></g>`;
}
/** A cloth edge with a zig-zag (papel picado) hem from x1 to x2 hanging under y. */
function zig(x1: number, x2: number, y: number, step: number, depth: number, fill: string): string {
  let d = `M ${x1} ${y - 2} H ${x2} V ${y}`; for (let x = x2; x > x1; x -= step) d += ` L ${f(Math.max(x1, x - step / 2))} ${y + depth} L ${f(Math.max(x1, x - step))} ${y}`;
  return `<path d="${d} Z" fill="${fill}"/>`;
}
function landmark(kind: Spot['landmark']): string {
  if (kind === 'ofrenda') return `
    <path d="M -150 0 V -40 H 150 V 0 Z" fill="#4a1f6e"/>${zig(-150, 150, -40, 16, 14, '#e2197a')}
    <rect x="-118" y="-86" width="236" height="46" fill="#5a2a86"/><rect x="-118" y="-92" width="236" height="10" fill="#ff8c1a"/>
    <rect x="-84" y="-130" width="168" height="44" fill="#6a34a0"/><rect x="-84" y="-136" width="168" height="10" fill="#18c8c0"/>
    <path d="M -132 -136 C -132 -260, 132 -260, 132 -136" stroke="#ff8c1a" stroke-width="16" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>
    <path d="M -132 -136 C -132 -260, 132 -260, 132 -136" stroke="#ffb000" stroke-width="9" fill="none" stroke-dasharray="1 9" stroke-linecap="round" stroke-dashoffset="5"/>
    ${candle(-132, -40)}${candle(132, -40)}${candle(-100, -92, 22)}${candle(100, -92, 22)}${candle(-66, -136, 18)}${candle(66, -136, 18)}
    <g transform="translate(-40 -136)"><circle r="15" cy="-14" fill="#fff6e6"/><circle cx="-5" cy="-16" r="4" fill="#2a0a3a"/><circle cx="5" cy="-16" r="4" fill="#2a0a3a"/><path d="M -5 -6 h 10" stroke="#e2197a" stroke-width="3"/></g>
    <g transform="translate(40 -136)"><ellipse rx="20" ry="9" cy="-8" fill="#d98a3a"/><ellipse rx="16" ry="6" cy="-12" fill="#f2c28a"/></g>`;
  if (kind === 'panteon') return `
    <rect x="-150" y="-18" width="300" height="18" fill="#2a1a3a"/>
    <path d="M -120 0 V -150 A 120 120 0 0 1 120 -150 V 0" stroke="#24123a" stroke-width="22" fill="none"/>
    <path d="M -120 0 V -150 A 120 120 0 0 1 120 -150 V 0" stroke="#5a4a78" stroke-width="10" fill="none"/>
    ${[-90, -60, -30, 0, 30, 60, 90].map((x) => `<path d="M ${x} 0 V ${f(-150 - Math.sqrt(Math.max(0, 120 * 120 - x * x)) + 20)}" stroke="#3a2a52" stroke-width="5"/><path d="M ${x} ${f(-150 - Math.sqrt(Math.max(0, 120 * 120 - x * x)) + 14)} l -7 12 h 14 z" fill="#5a4a78"/>`).join('')}
    <path d="M -150 0 v -64 a 26 26 0 0 1 52 0 v 64 z" fill="#6b5a8a"/><path d="M -124 -60 v -26 M -134 -74 h 20" stroke="#3a2a52" stroke-width="6" stroke-linecap="round"/>
    <path d="M 98 0 v -74 a 28 28 0 0 1 56 0 v 74 z" fill="#5f4f80"/><path d="M 126 -68 v -28 M 115 -84 h 22" stroke="#3a2a52" stroke-width="6" stroke-linecap="round"/>
    <rect x="-44" y="-44" width="88" height="44" rx="8" fill="#6b5a8a"/><text x="0" y="-15" text-anchor="middle" class="rip">R.I.P.</text>
    ${candle(-80, 0, 20)}${candle(76, 0, 18)}
    ${[...Array(8)].map((_, i) => `<circle cx="${-150 + i * 43}" cy="-4" r="8" fill="${i % 2 ? '#ff8c1a' : '#ffb000'}"/>`).join('')}`;
  if (kind === 'mercado') return `
    <rect x="-140" y="-70" width="280" height="70" fill="#7a3a2a"/><rect x="-140" y="-80" width="280" height="14" fill="#a8582e"/>
    <rect x="-136" y="-210" width="12" height="140" fill="#5a2a1a"/><rect x="124" y="-210" width="12" height="140" fill="#5a2a1a"/>
    <path d="M -160 -214 H 160 V -180 ${[...Array(10)].map(() => `a 16 16 0 0 1 -32 0`).join(' ')} Z" fill="#ff8c1a"/>
    ${[...Array(5)].map((_, i) => `<path d="M ${-160 + i * 64 + 32} -214 h 32 v 34 a 16 16 0 0 1 -32 0 z" fill="#e2197a"/>`).join('')}
    <rect x="-166" y="-226" width="332" height="16" rx="8" fill="#ffd23f"/>
    ${[[-110, '#e8322c'], [-84, '#3cc85a'], [-58, '#ffd23f'], [58, '#ff8c1a'], [84, '#e8322c'], [110, '#3cc85a']].map(([x, c]) => `<circle cx="${x}" cy="-92" r="13" fill="${c}"/>`).join('')}
    <g transform="translate(0 -40)"><ellipse rx="30" ry="12" fill="#c87a3a"/><path d="M -26 -4 q 26 -26 52 0" fill="#f2d2a0"/><path d="M -18 -8 q 18 -12 36 0 M -10 -14 q 10 -6 20 0" stroke="#c87a3a" stroke-width="3" fill="none"/></g>
    <rect x="-80" y="-268" width="160" height="40" rx="10" fill="#7a2a10" stroke="#ffd23f" stroke-width="4"/><path d="M -50 -228 v 4 M 50 -228 v 4" stroke="#5a2a1a" stroke-width="6"/>
    <text x="0" y="-239" text-anchor="middle" class="sign">MERCADO</text>`;
  return `
    <ellipse cx="0" cy="-8" rx="150" ry="22" fill="#5a3a78"/><rect x="-150" y="-30" width="300" height="22" fill="#6b4a8a"/><ellipse cx="0" cy="-30" rx="150" ry="22" fill="#7a5a9a"/>
    ${[-120, -60, 0, 60, 120].map((x) => `<rect x="${x - 6}" y="-200" width="12" height="172" fill="#d9c7ff" opacity=".9"/>`).join('')}
    <path d="M -130 -40 H 130" stroke="#3a2150" stroke-width="10" stroke-dasharray="4 8"/>
    <path d="M -170 -196 Q 0 -300 170 -196 Z" fill="#18c8c0"/><path d="M -170 -196 Q 0 -300 170 -196" stroke="#0e8a86" stroke-width="8" fill="none"/>
    ${zig(-170, 170, -196, 28, 16, '#e2197a')}
    <circle cx="0" cy="-262" r="10" fill="#ffd23f"/><rect x="-3" y="-292" width="6" height="30" fill="#ffd23f"/>
    ${[...Array(9)].map((_, i) => `<circle class="bulb" cx="${-150 + i * 37.5}" cy="${f(-178 + Math.sin((i / 8) * Math.PI) * 18)}" r="6" style="animation-delay:${f(-i * 0.3)}s"/>`).join('')}`;
}

function spotSvg(sp: Spot, [x, y]: XY, i: number): string {
  // character / icon art sits in front of its landmark
  const isRelic = sp.landmark === 'panteon';
  const artH = isRelic ? 290 : sp.id === 'crash' ? 205 : 250, artW = artH * (sp.artW / sp.artH);
  const ax = sp.id === 'waves' ? 0 : sp.id === 'slots' ? 6 : 0, ay = isRelic ? -150 : 6;
  const art = isRelic
    ? `<g transform="translate(0 -150)"><g class="relic"><g class="rays">${[...Array(12)].map((_, k) => `<path d="M 0 0 L ${f(Math.cos(k * Math.PI / 6 - 0.08) * 150)} ${f(Math.sin(k * Math.PI / 6 - 0.08) * 150)} L ${f(Math.cos(k * Math.PI / 6 + 0.08) * 150)} ${f(Math.sin(k * Math.PI / 6 + 0.08) * 150)} Z" fill="#ffe27a" opacity=".22"/>`).join('')}</g>
        <circle r="130" fill="url(#cz-goldglow)"/><image href="${sp.art}" x="${f(-artW / 2)}" y="${f(-artH / 2)}" width="${f(artW)}" height="${f(artH)}"/>
        ${[[-80, -50], [90, -30], [-60, 70], [70, 60]].map(([sx, sy], k) => `<path class="spark" style="animation-delay:${k * -0.5}s" d="M ${sx} ${sy - 10} L ${sx + 3} ${sy - 3} L ${sx + 10} ${sy} L ${sx + 3} ${sy + 3} L ${sx} ${sy + 10} L ${sx - 3} ${sy + 3} L ${sx - 10} ${sy} L ${sx - 3} ${sy - 3} Z" fill="#fff6c2"/>`).join('')}</g></g>`
    : `<image class="char" href="${sp.art}" x="${f(ax - artW / 2)}" y="${f(ay - artH)}" width="${f(artW)}" height="${f(artH)}"/>`;
  const pw = 300, ph = sp.tag ? 92 : 80;
  const tag = sp.tag ? `<g transform="translate(0 ${-ph / 2 + 2})"><rect x="${-(sp.tag.length * 7 + 18)}" y="-13" width="${sp.tag.length * 14 + 36}" height="26" rx="13" fill="${sp.color}" stroke="#3b1a5c" stroke-width="3"/><text class="tag" y="5" text-anchor="middle">${sp.tag}</text></g>` : '';
  return `<a class="spot spot-${sp.id}" href="${sp.href}" data-game="${sp.id}" aria-label="Play ${sp.name}" style="--c:${sp.color};--i:${i}">
    <g transform="translate(${x} ${y})">
      <ellipse class="glow" cx="0" cy="6" rx="190" ry="60" fill="url(#cz-spotglow)" style="color:${sp.color}"/>
      <ellipse class="pad" cx="0" cy="8" rx="168" ry="34" fill="${sp.color}" opacity=".22"/>
      <g class="lift">
        <g class="lm">${landmark(sp.landmark)}</g>
        <g class="art">${art}</g>
      </g>
      <g class="plaque" transform="translate(0 ${30 + ph / 2})">
        <rect x="${-pw / 2}" y="${-ph / 2}" width="${pw}" height="${ph}" rx="22" fill="url(#cz-plaque)" stroke="#ffd23f" stroke-width="5"/>
        <text class="name" y="${sp.tag ? 12 : 4}" text-anchor="middle">${sp.name}</text>
        <text class="place" y="${sp.tag ? 36 : 28}" text-anchor="middle">${sp.place.toUpperCase()}</text>
        ${tag}
      </g>
    </g>
  </a>`;
}

function defs(): string {
  return `<defs>
        <radialGradient id="cz-moonglow"><stop offset="0" stop-color="#fff2c8" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c8" stop-opacity="0"/></radialGradient>
    <radialGradient id="cz-goldglow"><stop offset="0" stop-color="#ffe27a" stop-opacity=".85"/><stop offset=".5" stop-color="#ffb000" stop-opacity=".35"/><stop offset="1" stop-color="#ff8c1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="cz-spotglow"><stop offset="0" stop-color="currentColor" stop-opacity=".75"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
    <radialGradient id="cz-candleglow"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".6"/><stop offset="1" stop-color="#ff8c1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="cz-flame" cy=".7"><stop offset="0" stop-color="#fff6c2"/><stop offset=".55" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5a36"/></radialGradient>
    <radialGradient id="cz-water" cy=".3"><stop offset="0" stop-color="#bff4ff" stop-opacity=".7"/><stop offset="1" stop-color="#2a8fb0" stop-opacity="0"/></radialGradient>
    <linearGradient id="cz-plaque" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a2486"/><stop offset="1" stop-color="#24092f"/></linearGradient>
  </defs>`;
}
function layoutDefs(L: Layout): string {
  const y0 = L.cls === 'land' ? 380 : 520;
  return `<defs>
    <linearGradient id="cz-sky-${L.cls}" x1="0" y1="${-L.H}" x2="0" y2="${y0}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#04010f"/><stop offset=".6" stop-color="#1b0a45"/><stop offset="1" stop-color="#4a1670"/></linearGradient>
    <linearGradient id="cz-ground-${L.cls}" x1="0" y1="${y0}" x2="0" y2="${L.H * 1.4}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2a1640"/><stop offset=".35" stop-color="#3a1f52"/><stop offset="1" stop-color="#22102e"/></linearGradient>
  </defs>`;
}

function svgFor(L: Layout): string {
  const [tx, ty] = L.title;
  return `<svg class="czmap ${L.cls}" viewBox="0 0 ${L.W} ${L.H}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Chanclazo town map. Tap a spot to play.">
    ${layoutDefs(L)}
    <g aria-hidden="true">${sky(L)}${town(L)}${ground(L)}${papel(L)}
      <path class="trail-glow" d="${L.path}"/><path class="trail" d="${L.path}"/>
    </g>
    <g class="title" transform="translate(${tx} ${ty})" aria-hidden="true">
      <rect x="-230" y="-42" width="460" height="84" rx="42" fill="url(#cz-plaque)" stroke="#ffd23f" stroke-width="5"/>
      <text class="ttl" y="16" text-anchor="middle">Pick your game</text>
    </g>
    ${SPOTS.map((sp, i) => spotSvg(sp, L.spots[i], i)).join('')}
  </svg>`;
}

export function mapHtml(): string {
  return `<main class="czworld" id="czworld">
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">${defs()}</svg>
  ${svgFor(LAND)}${svgFor(PORT)}
  <a class="czhome" href="/" aria-label="Home"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M3 11.2 12 3.5l9 7.7" fill="none" stroke="#3b1a5c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9.5h4.6v-5.6h3.8v5.6h4.6V10" fill="none" stroke="#3b1a5c" stroke-width="2.6" stroke-linejoin="round"/></svg></a>
  <noscript></noscript>
</main>`;
}

/** Analytics on spot taps + a short press bounce before leaving. */
export function wireMap(): void {
  document.querySelectorAll<SVGAElement>('.czmap a.spot').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '/';
      const w = window as unknown as { gtag?: (...args: unknown[]) => void };
      w.gtag?.('event', 'choose_game', { game: a.dataset.game, source: 'map' });
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); a.classList.add('go');
      setTimeout(() => { location.href = href; }, 160);
    });
  });
}
