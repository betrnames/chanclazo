// /choose: the Chanclazo arcade. A row of glowing Day of the Dead arcade cabinets, one per game.
// One source for both pages: astro/pages/choose.astro renders arcadeHtml() at build time; choose.html (vite dev) injects it at runtime.
// Pure HTML + CSS (src/choose/arcade.css) plus the existing character cut-outs. No Abuela here (Gabe's rule): Strike is the floating gold chancla.
//
// Chancla Crash is parked (2026-11-10, may return as a kart racer), so it has no cabinet; /crash still works.
// Desktop/landscape: three cabinets side by side. Phones (portrait): a horizontal scroll-snap carousel, one cabinet centred,
// neighbours peeking, dots underneath. The centred cabinet gets .lit (same glow as hover) so touch users see which one is "on".

import { WAVES_NAME, marqueeLines } from '../gameNames';

export interface Cab {
  id: string; href: string; name: string; line1: string; line2: string; tag?: string; attract: string;
  art: string; artW: number; artH: number; artCls: string; c: string; c2: string;
}

export const CABS: Cab[] = [
  { id: 'waves', href: '/waves', name: WAVES_NAME, line1: marqueeLines(WAVES_NAME)[0], line2: marqueeLines(WAVES_NAME)[1], tag: 'NEW', attract: 'HOLD THE LINE', art: '/play/v2/sidro.webp', artW: 306, artH: 720, artCls: 'char', c: '#ff8c1a', c2: '#e2197a' },
  { id: 'strike', href: '/chancla-strike?start=1', name: 'Chancla Strike', line1: 'CHANCLA', line2: 'STRIKE', tag: 'MAIN GAME', attract: 'FLING THE RELIC', art: '/lp/chancla_gold.webp', artW: 800, artH: 800, artCls: 'relic', c: '#ffd23f', c2: '#ff8c1a' },
  { id: 'slots', href: '/slots?start=1', name: 'Piñata Slots', line1: 'PIÑATA', line2: 'SLOTS', tag: 'MINI GAME', attract: 'SPIN TO WIN', art: '/play/llama_choose.webp', artW: 504, artH: 954, artCls: 'char', c: '#e2197a', c2: '#18c8c0' },
];

// tiny seeded random so the server and client draw the same stars
function rng(seed: number): () => number { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

const SKULL = `<svg class="skull" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5C18 5 9 15 9 28c0 8 4 13 8 16v8c0 3 2 5 5 5h20c3 0 5-2 5-5v-8c4-3 8-8 8-16C55 15 46 5 32 5z" fill="#fff4e6"/><circle cx="22" cy="29" r="7.5" fill="#2a0f3f"/><circle cx="42" cy="29" r="7.5" fill="#2a0f3f"/><circle cx="22" cy="29" r="3" fill="var(--c)"/><circle cx="42" cy="29" r="3" fill="var(--c)"/><path d="M32 36l-3.5 6h7z" fill="#2a0f3f"/><path d="M23 49v5M28 49v6M32 49v6M36 49v6M41 49v5" stroke="#2a0f3f" stroke-width="2" stroke-linecap="round"/><path d="M24 13c3 3 13 3 16 0" stroke="var(--c2)" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="32" cy="10" r="2.6" fill="var(--c)"/><circle cx="14" cy="34" r="2" fill="var(--c2)"/><circle cx="50" cy="34" r="2" fill="var(--c2)"/></svg>`;

const PAPEL_COLORS = ['#ff8c1a', '#e2197a', '#18c8c0', '#ffd23f', '#7a35ad', '#3cc85a'];
function papel(): string {
  let flags = '';
  for (let i = 0; i < 24; i++) {
    const x = i * 70, c = PAPEL_COLORS[i % PAPEL_COLORS.length];
    // a flag with cut-outs (holes are punched by the even-odd fill rule)
    flags += `<path transform="translate(${x + 6} 8)" fill="${c}" fill-rule="evenodd" d="M0 0h58v52l-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-5-6-5 6z M29 12a8 8 0 1 0 .1 0z M12 30h7v7h-7z M39 30h7v7h-7z M27 34l4 7-4 4-4-4z"/>`;
  }
  return `<svg class="papel" viewBox="0 0 1680 70" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><path d="M0 8 Q840 22 1680 8" stroke="#ffe9c2" stroke-width="2" fill="none" opacity=".6"/>${flags}</svg>`;
}

function stars(): string {
  const r = rng(42); let s = '';
  for (let i = 0; i < 46; i++) s += `<i style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 55).toFixed(1)}%;width:${(1.5 + r() * 2.5).toFixed(1)}px;animation-delay:${(-r() * 4).toFixed(1)}s"></i>`;
  return `<div class="stars" aria-hidden="true">${s}</div>`;
}

function petals(): string {
  const r = rng(7); let s = '';
  for (let i = 0; i < 12; i++) s += `<i style="left:${(r() * 100).toFixed(1)}%;animation-delay:${(-r() * 12).toFixed(1)}s;animation-duration:${(9 + r() * 7).toFixed(1)}s"></i>`;
  return `<div class="petals" aria-hidden="true">${s}</div>`;
}

function cabHtml(c: Cab, i: number): string {
  return `<a class="cab" href="${c.href}" data-game="${c.id}" style="--c:${c.c};--c2:${c.c2};--i:${i}" aria-label="Play ${c.name}">
    <div class="marquee"><span class="m1">${c.line1}</span><span class="m2">${c.line2}</span>${c.tag ? `<em class="tag">${c.tag}</em>` : ''}</div>
    <div class="body">
      <div class="bezel"><div class="screen s-${c.id}">
        <div class="sunburst" aria-hidden="true"></div>
        <img class="art ${c.artCls}" src="${c.art}" width="${c.artW}" height="${c.artH}" alt="" loading="eager" decoding="async" />
        <span class="attract">${c.attract}</span>
        <span class="press">TAP TO PLAY</span>
        <div class="scan" aria-hidden="true"></div>
      </div></div>
      <div class="panel" aria-hidden="true"><span class="stick"><b></b></span><span class="btns"><b></b><b></b><b></b></span></div>
      <div class="kick" aria-hidden="true">${SKULL}<span class="coin"><b></b>1 CHANCLA</span></div>
    </div>
    <div class="glowfloor" aria-hidden="true"></div>
  </a>`;
}

export function arcadeHtml(): string {
  return `<main class="czarcade" id="czarcade">
  ${stars()}<div class="moon" aria-hidden="true"></div>${papel()}${petals()}
  <header class="czsign"><h1><span>Pick your</span> <b>game</b></h1></header>
  <div class="row" id="czrow">${CABS.map(cabHtml).join('')}</div>
  <div class="dots" id="czdots" aria-hidden="true">${CABS.map((c, i) => `<i style="--c:${c.c}" data-i="${i}"></i>`).join('')}</div>
  <div class="floor" aria-hidden="true"></div>
  <a class="czhome" href="/" aria-label="Back"><svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M15.5 4.5 7 12l8.5 7.5" fill="none" stroke="#ffd23f" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
</main>`;
}

/** Tap = flicker + launch; carousel keeps the centred cabinet lit and the dots in sync. */
export function wireArcade(): void {
  const row = document.getElementById('czrow');
  const cabs = Array.from(document.querySelectorAll<HTMLAnchorElement>('.czarcade a.cab'));
  const dots = Array.from(document.querySelectorAll<HTMLElement>('#czdots i'));
  cabs.forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '/';
      const w = window as unknown as { gtag?: (...args: unknown[]) => void };
      w.gtag?.('event', 'choose_game', { game: a.dataset.game, source: 'arcade' });
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); a.classList.add('go');
      setTimeout(() => { location.href = href; }, 260);
    });
  });
  dots.forEach((d, i) => d.addEventListener('click', () => cabs[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })));
  if (!row) return;
  const carousel = () => row.scrollWidth > row.clientWidth + 4;
  let raf = 0;
  const update = () => {
    raf = 0;
    const on = carousel(); document.body.classList.toggle('cz-carousel', on);
    const mid = row.getBoundingClientRect().left + row.clientWidth / 2; let best = 0, bd = 1e9;
    cabs.forEach((a, i) => { const r = a.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
    cabs.forEach((a, i) => a.classList.toggle('lit', on && i === best));
    dots.forEach((d, i) => d.classList.toggle('on', i === best));
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  row.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
