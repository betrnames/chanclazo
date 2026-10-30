import { markGameStart, markFirstAction, markBonus } from '../analytics';
import './play.css';
import { showLeaderboard, hideLeaderboard } from './leaderboard';
import { initAudioControls } from './music';
import Matter from 'matter-js';
import { playLevelUp, playGameOver } from '../game/sound';
import { $, loadImg, wakeAudio, report } from './common';
import * as A from './flingAudio';

const { Engine, Bodies, Composite, Body, Events, Vector, Sleeping } = Matter;
const W = 1100, H = 1000, GROUND = 920;            // world units; fits portrait & landscape
// Abuela throws by hand (no slingshot). HAND = her throwing hand in the release pose; launch + aim guide originate here.
const ABU = { x: 68, ground: 920 };                 // feet centre (same spot the old sprite stood)
const WIND = { h: 193, hand: { x: 22, y: 739 } }, REL = { h: 190 };
const HAND = { x: 105, y: 775 };
const MAXPULL = 140, POWER = 0.21;

const cv = document.createElement('canvas'); (document.body as HTMLElement).insertBefore(cv, document.body.firstChild);
const ctx = cv.getContext('2d')!;
let scale = 1, ox = 0, oy = 0, dpr = 1;
// Visible-area sizing: iOS 100vh/innerHeight can include space under the browser bars, so use
// visualViewport when it is smaller, size the canvas to it, and respect safe-area insets (notch/home bar).
let VW = window.innerWidth, VH = window.innerHeight;
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.appendChild(safeProbe);
function fit() {
  const vv = window.visualViewport;
  VW = Math.round(vv ? Math.min(window.innerWidth, vv.width) : window.innerWidth);
  VH = Math.round(vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight);
  document.documentElement.style.setProperty('--vh', VH + 'px');
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  dpr = Math.min(2, devicePixelRatio || 1); cv.width = VW * dpr; cv.height = VH * dpr;
  const cs = getComputedStyle(safeProbe); const sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0, sb = parseFloat(cs.paddingBottom) || 0;
  const VIEW_H = 560, avW = VW - sl - sr, avH = VH - sb;
  if (VH > VW * 1.15) {
    // Portrait: zoom onto abuela + fort and lift the ground to ~78% height.
    scale = VW / 1060; ox = VW / 2 - (W / 2) * scale; oy = VH * 0.78 - GROUND * scale;
  } else { scale = Math.min(avW / W, (avH - 46) / VIEW_H); ox = sl + (avW - W * scale) / 2; oy = avH - (GROUND + 30) * scale; }
}
// Orientation: iOS Safari reports the new size late, so re-check a few times after any rotate/resize.
let forcePlay = false, portraitNow = false;
function readPortrait() {
  // VW/VH are the most reliable across Safari, Chrome for iOS (CriOS) and in-app views;
  // visualViewport can lag/zoom in CriOS, and the address bar changes height, so use it only as a tie-break.
  if (forcePlay) return false;
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const w = window.innerWidth, h = window.innerHeight;
  let portrait = h > w;
  if (Math.abs(w - h) < 40) { const mq = matchMedia('(orientation: portrait)').matches; const vv = window.visualViewport; portrait = vv ? vv.height > vv.width : mq; }
  return portrait && Math.min(w, h) < 900;
}
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STANDALONE = (navigator as any).standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
let a2hsOff = (() => { try { return localStorage.getItem('chanclazo_a2hs_off') === '1'; } catch { return false; } })();
setTimeout(() => { a2hsOff = true; updateA2hs(); }, 9000); // auto-hide (not remembered)
function updateA2hs() { const el = document.getElementById('a2hs'); if (el) el.classList.toggle('hidden', !(IS_IOS && !STANDALONE && !a2hsOff && !portraitNow && window.innerWidth > window.innerHeight)); }
function onLayout() {
  portraitNow = readPortrait(); document.body.classList.toggle('portrait', portraitNow); fit(); updateA2hs(); last = performance.now();
}
function scheduleLayout() { onLayout(); for (const d of [120, 300, 650, 1200, 2000]) setTimeout(onLayout, d); }
setInterval(() => { if (readPortrait() !== portraitNow) onLayout(); }, 700); // safety net if a rotate event is missed
addEventListener('resize', scheduleLayout); addEventListener('orientationchange', scheduleLayout);
window.visualViewport?.addEventListener('resize', scheduleLayout);
matchMedia('(orientation: landscape)').addEventListener?.('change', scheduleLayout);
document.addEventListener('visibilitychange', scheduleLayout);
fit();

const IMG: Record<string, HTMLImageElement> = {};
const names = { bg: '/play/night_bg.webp', bgMercado: '/play/mercado_bg.webp', bgCata: '/play/cata_bg.webp', abuela: '/play/abuela_windup.webp?v=9724bca5', abuelaRel: '/play/abuela_release.webp?v=f47e24e0', lucha: '/play/t_lucha.webp', calaca: '/play/t_skull.webp', chancla: '/play/t_chancla.webp', pinata: '/play/t_pinata.webp' };
const TINT: Record<string, HTMLCanvasElement> = {};
function tintImg(img: HTMLImageElement, color: string, a: number) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c;
}

// ── Content ──────────────────────────────────────────────────────────────────
type BKind = 'wood' | 'stone' | 'picado' | 'lucha' | 'calaca' | 'pinata' | 'armor' | 'ghost' | 'tnt';
const VILLAIN = new Set<BKind>(['lucha', 'calaca', 'armor', 'ghost']);
interface Meta { kind: BKind; w: number; h: number; hp: number; maxHp: number; color?: string; dead?: boolean; cracked?: boolean; crackT?: number; baseY?: number; phase?: number }
const meta = new Map<number, Meta>();
interface Piece { k: BKind; x: number; b: number; w: number; h: number } // b = bottom height above the ground
const DIM: Partial<Record<BKind, [number, number]>> = { lucha: [54, 54], calaca: [50, 50], armor: [58, 58], ghost: [50, 50], pinata: [60, 84], tnt: [46, 46] };
class Lv { // builder: every piece is placed exactly resting on the one below (no overlaps, no gaps)
  p: Piece[] = [];
  add(k: BKind, x: number, b: number, w?: number, h?: number) { const d = DIM[k] || [40, 40]; const pw = w ?? d[0], ph = h ?? d[1]; this.p.push({ k, x, b, w: pw, h: ph }); return b + ph; }
  bridge(x: number, span: number, postH: number, b = 0, post: BKind = 'wood', beam: BKind = 'wood') { this.add(post, x - span / 2, b, 22, postH); this.add(post, x + span / 2, b, 22, postH); return this.add(beam, x, b + postH, span + 40, 20); }
  stack(x: number, b: number, ks: [BKind, number?, number?][]) { let y = b; for (const [k, w, h] of ks) y = this.add(k, x, y, w, h); return y; }
}
type ShotType = 'chancla' | 'boot' | 'triple';
const SHOT_INFO: Record<ShotType, { label: string; r: number; density: number; from: number }> = {
  chancla: { label: 'Chancla', r: 18, density: 0.006, from: 0 },
  boot: { label: 'Heavy boot', r: 22, density: 0.016, from: 3 },
  triple: { label: 'Triple (tap to split)', r: 15, density: 0.005, from: 6 },
};
const AREAS = [
  { name: 'Cemetery', bg: 'bg', tint: ['rgba(10,4,30,.72)', 'rgba(25,8,40,.45)'], need: 0 },
  { name: 'Night Market', bg: 'bgMercado', tint: ['rgba(14,4,26,.66)', 'rgba(40,10,30,.45)'], need: 5 },
  { name: 'Catacombs', bg: 'bgCata', tint: ['rgba(2,6,18,.75)', 'rgba(6,16,28,.55)'], need: 12 },
];
interface Level { area: number; shots: number; tip: string; build: (l: Lv) => void }
const LEVELS: Level[] = [
  { area: 0, shots: 3, tip: 'Knock out the luchador and the calacas.', build: (l) => { const t = l.bridge(880, 120, 110); l.add('lucha', 880, 0); const s = l.add('stone', 880, t, 60, 64); l.add('calaca', 880, s); l.add('calaca', 1010, 0); l.add('pinata', 740, 0); } },
  { area: 0, shots: 3, tip: 'Topple the tombstone to drop the calaca.', build: (l) => { const t = l.bridge(830, 110, 100); const s = l.add('stone', 830, t, 56, 60); l.add('calaca', 830, s); const t2 = l.bridge(1000, 100, 90, 0, 'stone', 'picado'); l.add('lucha', 1000, t2); l.add('pinata', 920, 0); } },
  { area: 0, shots: 4, tip: 'Ghost calacas float. Hit them directly!', build: (l) => { const t1 = l.bridge(820, 110, 90); const t2 = l.bridge(820, 110, 80, t1); l.add('calaca', 820, t2); l.add('lucha', 820, 0); l.add('ghost', 1000, 230); l.add('stone', 1000, 0, 50, 80); l.add('pinata', 940, 0); } },
  { area: 1, shots: 3, tip: 'New: Heavy boot! Firework crates explode in a chain.', build: (l) => { l.add('tnt', 800, 0); const s = l.stack(880, 0, [['wood', 90, 24], ['wood', 70, 24]]); l.add('lucha', 880, s); l.add('tnt', 950, 0); const s2 = l.add('stone', 1020, 0, 60, 70); l.add('calaca', 1020, s2); } },
  { area: 1, shots: 4, tip: 'Armored luchadores take two hits.', build: (l) => { const t = l.bridge(860, 120, 100, 0, 'stone', 'stone'); l.add('armor', 860, t); l.add('tnt', 860, 0); l.add('calaca', 1030, 0); l.add('pinata', 760, 0); } },
  { area: 1, shots: 4, tip: 'Light the fireworks to chain the blast.', build: (l) => { for (const x of [880, 930, 980]) l.add('tnt', x, 0); const p = l.add('picado', 930, 46, 170, 16); l.add('lucha', 890, p); l.add('calaca', 970, p); l.add('ghost', 790, 200); l.add('ghost', 1050, 260); } },
  { area: 2, shots: 4, tip: 'New: Triple chancla! Tap mid-air to split it.', build: (l) => { for (const x of [780, 900, 1020]) { const t = l.stack(x, 0, [['stone', 40, 90], ['wood', 80, 20]]); l.add('calaca', x, t); } } },
  { area: 2, shots: 4, tip: 'Break the walls to reach the armored heads.', build: (l) => { l.add('stone', 820, 0, 30, 140); l.add('armor', 880, 0); l.add('stone', 940, 0, 30, 140); const t = l.add('wood', 880, 140, 170, 20); l.add('tnt', 880, t); l.add('armor', 1030, 0); l.add('ghost', 960, 290); } },
  { area: 2, shots: 5, tip: 'The final fortress. ¡Ándale, Abuela!', build: (l) => { const a = l.bridge(800, 110, 100, 0, 'stone', 'wood'); l.add('lucha', 800, 0); l.add('armor', 800, a); const b = l.bridge(970, 120, 120, 0, 'wood', 'stone'); l.add('tnt', 970, 0); l.add('calaca', 970, b); l.add('pinata', 885, 0); l.add('ghost', 1060, 300); l.add('tnt', 1050, 0); } },
];
const PICADO = ['#f72585', '#4cc9f0', '#ffd166', '#06d6a0', '#9b5de5'];

// ── Save data ────────────────────────────────────────────────────────────────
const SAVE_KEY = 'chanclazo_fling_v3';
const save: { stars: number[]; best: number[] } = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && Array.isArray(s.stars)) return s; } catch { /* ignore */ } return { stars: [], best: [] }; })();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };
const totalStars = () => save.stars.reduce((a, b) => a + (b || 0), 0);
const unlocked = (i: number) => i === 0 || ((save.stars[i - 1] || 0) > 0 && totalStars() >= AREAS[LEVELS[i].area].need);
const vib = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

// ── Physics: sleeping start, more solver iterations, fixed timestep ──────────
const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 }); engine.gravity.y = 1.1;
const world = engine.world;
let level = 0, score = 0, shotsLeft = 0, flying: Matter.Body[] = [], shotAt = 0, ended = false, playing = false, armed = false, split = false;
let shotType: ShotType = 'chancla', throwKOs = 0, slowT = 0, focus = { x: 880, y: 800 }, zoom = 1, levelT = 0;
let aiming = false, pull = { x: 0, y: 0 }, abuelaKick = 0, relT = 0, shake = 0, flashT = 0;
interface Part { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number }
const parts: Part[] = [];
interface Pop { x: number; y: number; t: string; life: number; big?: boolean }
const pops: Pop[] = [];
const ghosts: Matter.Body[] = [];

function burst(x: number, y: number, colors: string[], n = 16) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8, life: 1, c: colors[i % colors.length], s: 4 + Math.random() * 6 });
}
function hud() { $('lvl').textContent = String(level + 1); $('score').textContent = String(score); $('left').textContent = String(shotsLeft); }
function available(): ShotType[] { return (Object.keys(SHOT_INFO) as ShotType[]).filter((k) => level >= SHOT_INFO[k].from); }
function drawShotBar() {
  const bar = $('shots'); const av = available(); bar.innerHTML = '';
  bar.classList.toggle('hidden', av.length < 2);
  for (const k of av) { const b = document.createElement('button'); b.type = 'button'; b.className = k === shotType ? 'on' : ''; b.textContent = SHOT_INFO[k].label; b.onclick = (e) => { e.stopPropagation(); shotType = k; drawShotBar(); }; bar.appendChild(b); }
}

function build(n: number) {
  Composite.clear(world, false); meta.clear(); parts.length = 0; pops.length = 0; ghosts.length = 0; flying = [];
  level = n; score = 0; armed = false; split = false; slowT = 0; zoom = 1; levelT = 0; ended = false;
  const ground = Bodies.rectangle(W / 2, GROUND + 60, W * 3, 120, { isStatic: true, friction: 1, frictionStatic: 2 });
  Composite.add(world, ground);
  const l = new Lv(); LEVELS[n].build(l);
  for (const { k, x, b: base, w, h } of l.p) {
    const cy = GROUND - base - h / 2; let body: Matter.Body;
    if (VILLAIN.has(k)) {
      body = Bodies.circle(x, cy, w / 2, { friction: 0.9, frictionStatic: 2, frictionAir: 0.004, restitution: 0.1, density: k === 'armor' ? 0.0024 : 0.0014, isStatic: k === 'ghost' });
    } else {
      body = Bodies.rectangle(x, cy, w, h, { friction: 0.9, frictionStatic: 1.5, restitution: 0.04, density: k === 'stone' ? 0.004 : k === 'picado' ? 0.0006 : 0.0015,
        chamfer: k === 'stone' ? { radius: [Math.min(w, h) / 2.2, Math.min(w, h) / 2.2, 2, 2] } : undefined });
    }
    const hp = k === 'stone' ? 9 : k === 'wood' ? 5 : k === 'picado' ? 1.5 : k === 'pinata' ? 1.2 : k === 'tnt' ? 1.5 : 2.2;
    meta.set(body.id, { kind: k, w, h, hp, maxHp: hp, color: PICADO[(x + base) % PICADO.length | 0], baseY: cy, phase: Math.random() * 6 });
    Composite.add(world, body);
    if (k === 'ghost') ghosts.push(body); else Sleeping.set(body, true); // rest solidly until disturbed
  }
  shotsLeft = LEVELS[n].shots; if (!available().includes(shotType)) shotType = 'chancla';
  if (n === SHOT_INFO.boot.from) shotType = 'boot'; if (n === SHOT_INFO.triple.from) shotType = 'triple';
  hud(); drawShotBar();
  pops.push({ x: W / 2 + 120, y: GROUND - 380, t: LEVELS[n].tip, life: 3.2 });
  $('end').classList.add('hidden'); $('map').classList.add('hidden');
}

function villainsLeft() { let k = 0; for (const [, m] of meta) if (!m.dead && VILLAIN.has(m.kind)) k++; return k; }
const isShot = (b: Matter.Body) => flying.includes(b);
function damage(b: Matter.Body, amt: number) {
  const m = meta.get(b.id); if (!m || m.dead || !armed) return;
  if (m.kind === 'armor' && !m.cracked) { // first solid hit only cracks the helmet
    if (amt < 1.2) return; m.cracked = true; m.crackT = performance.now(); A.clang(); vib(25); burst(b.position.x, b.position.y, ['#cfd3dc', '#8a8f9c', '#fff'], 14); pops.push({ x: b.position.x, y: b.position.y - 30, t: 'CRACK!', life: 0.9 }); return;
  }
  if (m.kind === 'armor' && performance.now() - (m.crackT || 0) < 250) return;
  m.hp -= amt; if (m.hp > 0) return;
  m.dead = true; Composite.remove(world, b);
  if (m.kind === 'pinata') { pinataBoom(b); return; }
  if (m.kind === 'tnt') { fireworkBoom(b); return; }
  const villain = VILLAIN.has(m.kind);
  const pts = m.kind === 'armor' ? 8000 : m.kind === 'ghost' ? 6000 : villain ? 5000 : m.kind === 'stone' ? 800 : 500; score += pts;
  pops.push({ x: b.position.x, y: b.position.y - 20, t: `+${pts}`, life: 1.2 });
  if (villain) {
    throwKOs++; vib(30);
    if (m.kind === 'ghost') A.wail(); else A.knockout();
    if (throwKOs > 1) { const bonus = 1000 * (throwKOs - 1); score += bonus; pops.push({ x: b.position.x, y: b.position.y - 70, t: `COMBO ×${throwKOs}  +${bonus}`, life: 1.6, big: true }); A.explosion(); }
    shake = 10; burst(b.position.x, b.position.y, m.kind === 'lucha' || m.kind === 'armor' ? ['#d62828', '#ffd166', '#fff'] : ['#fbf6ea', '#9be7ff', '#f72585'], 26);
    if (villainsLeft() === 0) { slowT = 1.5; focus = { x: b.position.x, y: b.position.y }; vib([40, 40, 80]); }
  } else { if (m.kind === 'wood') A.breakWood(); else if (m.kind === 'stone') A.breakStone(); else A.ripPaper(); burst(b.position.x, b.position.y, m.kind === 'wood' ? ['#8b5a2b', '#c08a4f'] : m.kind === 'stone' ? ['#8a8597', '#5d5868'] : PICADO, 12); }
  hud();
}
function blast(x: number, y: number, radius: number, force: number, dmgBlocks: number, dmgVillains: number, src?: Matter.Body) {
  for (const o of Composite.allBodies(world)) {
    if (o.isStatic && !ghosts.includes(o)) continue; if (o === src) continue;
    const dx = o.position.x - x, dy = o.position.y - y, d = Math.hypot(dx, dy); if (d > radius) continue;
    const k = 1 - d / radius; Sleeping.set(o, false);
    if (!o.isStatic) Body.applyForce(o, o.position, { x: (dx / (d || 1)) * force * o.mass * k, y: ((dy / (d || 1)) * force - force * 0.8) * o.mass * k });
    const mo = meta.get(o.id); if (!mo || mo.dead) continue;
    const amt = VILLAIN.has(mo.kind) ? Math.min(dmgVillains, dmgVillains * k * 1.5) : dmgBlocks * k;
    if (amt > 0.05) setTimeout(() => damage(o, amt), 40 + Math.random() * 60);
  }
}
// Piñata (rebalanced): big candy burst + shake, but a smaller shove that cannot KO villains on its own.
const CANDY = ['#f72585', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5', '#ff6b35', '#fff'];
function pinataBoom(b: Matter.Body) {
  const { x, y } = b.position; score += 3000;
  pops.push({ x, y: y - 30, t: '¡PIÑATA! +3000', life: 1.6, big: true });
  for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 12; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5, life: 1.3 + Math.random() * 0.6, c: CANDY[i % CANDY.length], s: i % 3 === 0 ? 12 : 5 + Math.random() * 6 }); }
  shake = 22; flashT = 0.2; A.explosion(); A.ripPaper(); vib([60, 40, 60]);
  blast(x, y, 150, 0.03, 4, 1.0, b); hud();
}
// Firework crate: explodes and chains into nearby crates.
function fireworkBoom(b: Matter.Body) {
  const { x, y } = b.position; score += 300; pops.push({ x, y: y - 20, t: '¡PUM!', life: 1, big: true });
  for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 10; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 0.9 + Math.random() * 0.5, c: ['#ffd166', '#ff6b35', '#fff', '#f72585'][i % 4], s: 3 + Math.random() * 5 }); }
  shake = Math.max(shake, 16); flashT = Math.max(flashT, 0.12); A.firework(); vib(50);
  blast(x, y, 135, 0.045, 9, 2.6, b); hud();
}
Events.on(engine, 'collisionStart', (e) => {
  for (const p of e.pairs) {
    const rel = Vector.magnitude(Vector.sub(p.bodyA.velocity, p.bodyB.velocity));
    if (rel < 2.4) continue; // ignore resting/settle contacts
    const km = meta.get(p.bodyA.id) || meta.get(p.bodyB.id); if (km && rel > 3) A.knock(km.kind === 'armor' ? 'stone' : km.kind, rel);
    const massF = (b: Matter.Body) => (b.isStatic ? 3 : Math.min(isShot(b) ? 4 : 3, b.mass / 2));
    for (const [a, o] of [[p.bodyA, p.bodyB], [p.bodyB, p.bodyA]] as const) {
      const ma = meta.get(a.id); if (!ma) continue;
      if (ma.kind === 'ghost' && !isShot(o) && !o.isStatic && o.speed < 3) continue; // ghosts need a real hit
      damage(a, (rel - 1.6) * 0.45 * massF(o));
    }
  }
});

// ── Input: drag back anywhere to aim; tap mid-air to split the triple ────────
function isPortraitPhone() { return portraitNow; }
const toWorld = (cx: number, cy: number) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });
let dragStart = { x: 0, y: 0 };
cv.addEventListener('pointerdown', (e) => {
  wakeAudio(); if (isPortraitPhone() || !playing || ended) return;
  if (flying.length && shotType === 'triple' && !split && performance.now() - shotAt < 2500) { doSplit(); return; }
  if (flying.length || shotsLeft <= 0) return;
  aiming = true; dragStart = toWorld(e.clientX, e.clientY); pull = { x: 0, y: 0 }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!aiming) return; const p = toWorld(e.clientX, e.clientY);
  let dx = p.x - dragStart.x, dy = p.y - dragStart.y; const d = Math.hypot(dx, dy);
  if (d > MAXPULL) { dx *= MAXPULL / d; dy *= MAXPULL / d; } pull = { x: dx, y: dy };
});
function makeShot(x: number, y: number, vx: number, vy: number) { markFirstAction('fling', 'throw');
  const si = SHOT_INFO[shotType];
  const b = Bodies.circle(x, y, si.r, { density: si.density, restitution: 0.25, friction: 0.5, frictionAir: 0.004 });
  Composite.add(world, b); Body.setVelocity(b, { x: vx, y: vy }); Body.setAngularVelocity(b, 0.35); flying.push(b); return b;
}
const release = () => {
  if (!aiming) return; aiming = false;
  if (Math.hypot(pull.x, pull.y) < 25) { pull = { x: 0, y: 0 }; return; }
  makeShot(HAND.x, HAND.y, -pull.x * POWER, -pull.y * POWER); relT = 0.45;
  armed = true; split = false; shotAt = performance.now(); shotsLeft--; throwKOs = 0; abuelaKick = 1; vib(15);
  { const pw = Math.hypot(pull.x, pull.y) / MAXPULL; A.whoosh(pw); } pull = { x: 0, y: 0 }; hud();
};
function doSplit() { markBonus('fling', 'triple_split');
  const s = flying[0]; if (!s) return; split = true; A.split(); vib(10);
  const v = s.velocity, sp = Math.hypot(v.x, v.y), ang = Math.atan2(v.y, v.x);
  for (const da of [-0.2, 0.2]) makeShot(s.position.x, s.position.y, Math.cos(ang + da) * sp, Math.sin(ang + da) * sp);
  burst(s.position.x, s.position.y, ['#9be7ff', '#fff'], 10);
}
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);

// ── Level flow ───────────────────────────────────────────────────────────────
function settled() { return Composite.allBodies(world).every((b) => b.isStatic || b.isSleeping || b.speed < 0.25); }
function starsFor() { const used = LEVELS[level].shots - shotsLeft; return used <= Math.max(1, LEVELS[level].shots - 2) ? 3 : used <= LEVELS[level].shots - 1 ? 2 : 1; }
function finish(win: boolean) {
  if (ended) return; ended = true;
  let s = 0;
  if (win) { const bonus = shotsLeft * 2000; score += bonus; s = starsFor(); hud(); playLevelUp(); if (s > (save.stars[level] || 0)) save.stars[level] = s; if (score > (save.best[level] || 0)) save.best[level] = score; persist(); }
  else playGameOver();
  const last = level === LEVELS.length - 1;
  $('endTitle').textContent = win ? (last ? '¡Campeona! All levels cleared!' : 'Level clear!') : 'Out of chanclas!';
  const st = $('endStars'); st.innerHTML = '';
  for (let i = 0; i < 3; i++) { const sp = document.createElement('span'); sp.className = 'star' + (i < s ? ' on' : ''); sp.textContent = '★'; sp.style.animationDelay = `${0.25 + i * 0.3}s`; st.appendChild(sp); }
  if (win) setTimeout(() => { for (let i = 0; i < s; i++) setTimeout(() => A.twang(0.3 + i * 0.3), i * 300); }, 250);
  $('endMsg').textContent = win ? `Score ${score}${shotsLeft ? ` (+${shotsLeft * 2000} for unused chanclas)` : ''} · Best ${save.best[level] || score}` : 'Some villains are still standing. Try another angle!';
  const next = $('next') as HTMLButtonElement;
  const canNext = win && !last && unlocked(level + 1);
  next.textContent = win ? (last ? 'Level map' : canNext ? 'Next level' : 'Level map') : 'Retry';
  next.onclick = (e) => { e.stopPropagation(); if (!win) build(level); else if (canNext) build(level + 1); else openMap(); };
  ($('retry') as HTMLAnchorElement).onclick = (e) => { e.preventDefault(); e.stopPropagation(); build(level); };
  ($('toMap') as HTMLAnchorElement).onclick = (e) => { e.preventDefault(); e.stopPropagation(); openMap(); };
  // X handle + Share on X only on game over (out of chanclas) or after clearing the final level.
  if (!win || last) showLeaderboard('fling', 'Chancla Strike', score, level + 1, '/chancla-strike'); else hideLeaderboard();
  setTimeout(() => $('end').classList.remove('hidden'), win ? 300 : 600);
}
function checkFlow() {
  if (ended) return;
  for (const b of Composite.allBodies(world)) if (!b.isStatic && (b.position.y > GROUND + 200 || b.position.x > W + 300 || b.position.x < -300)) { if (isShot(b)) { Composite.remove(world, b); flying = flying.filter((f) => f !== b); } else damage(b, 99); }
  if (villainsLeft() === 0) { if (slowT <= 0 && settledFor > 0.4) finish(true); return; }
  if (flying.length) {
    const age = performance.now() - shotAt;
    if ((age > 1600 && settled()) || age > 8000) {
      for (const f of flying) Composite.remove(world, f); flying = [];
      if (shotsLeft <= 0) finish(false);
    }
  }
}
let settledFor = 0;

// ── Level map ────────────────────────────────────────────────────────────────
function openMap() {
  playing = true; ended = true; const m = $('mapList'); m.innerHTML = '';
  $('mapStars').textContent = `${totalStars()} / ${LEVELS.length * 3} ★`;
  AREAS.forEach((ar, ai) => {
    const row = document.createElement('div'); row.className = 'area';
    const locked = totalStars() < ar.need;
    row.innerHTML = `<div class="aname">${ar.name}${locked ? ` <small>🔒 ${ar.need} ★ needed</small>` : ''}</div>`;
    const lv = document.createElement('div'); lv.className = 'lvls';
    LEVELS.forEach((L, i) => {
      if (L.area !== ai) return; const b = document.createElement('button'); b.type = 'button'; const ok = unlocked(i);
      b.className = ok ? '' : 'locked'; b.innerHTML = `<b>${i + 1}</b><span>${ok ? '★'.repeat(save.stars[i] || 0) + '☆'.repeat(3 - (save.stars[i] || 0)) : '🔒'}</span>`;
      if (ok) b.onclick = (e) => { e.stopPropagation(); build(i); };
      lv.appendChild(b);
    });
    row.appendChild(lv); m.appendChild(row);
  });
  $('end').classList.add('hidden'); $('map').classList.remove('hidden');
}

// ── Render ───────────────────────────────────────────────────────────────────
function drawImg(img: CanvasImageSource & { width: number; height: number }, x: number, y: number, h: number, ang = 0) {
  const w = h * (img.width / img.height);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}
function shotImg(): (CanvasImageSource & { width: number; height: number }) | undefined { return shotType === 'boot' ? TINT.boot : shotType === 'triple' ? TINT.triple : IMG.chancla; }
function trajectory() {
  if (!aiming || Math.hypot(pull.x, pull.y) < 25) return;
  let x = HAND.x, y = HAND.y, vx = -pull.x * POWER, vy = -pull.y * POWER;
  const g = engine.gravity.y * 0.001 * (1000 / 60) ** 2;
  ctx.fillStyle = 'rgba(255,214,140,.8)';
  for (let i = 0; i < 40; i++) { for (let k = 0; k < 2; k++) { vy += g; x += vx; y += vy; } ctx.globalAlpha = 1 - i / 40; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
const STEP = 1000 / 60; let acc = 0;
let last = performance.now(), t = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  try { frameBody(now); } catch (err) { report('frame: ' + ((err as Error)?.message || err)); }
}
function frameBody(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt; // clamp hitches (resize/rotate)
  const portrait = isPortraitPhone();
  slowT = Math.max(0, slowT - dt); const timeScale = slowT > 0 ? 0.3 : 1;
  zoom += ((slowT > 0 ? 1.35 : 1) - zoom) * Math.min(1, dt * 4);
  if (playing && !portrait && !ended) {
    levelT += dt; acc = Math.min(acc + dt * 1000 * timeScale, STEP * 4);
    while (acc >= STEP) {
      for (const gb of ghosts) { const m = meta.get(gb.id); if (m && !m.dead) Body.setPosition(gb, { x: gb.position.x, y: m.baseY! + Math.sin(levelT * 1.6 + m.phase!) * 14 }); }
      Engine.update(engine, STEP); acc -= STEP;
    }
    settledFor = settled() ? settledFor + dt : 0;
    checkFlow();
  }
  abuelaKick = Math.max(0, abuelaKick - dt * 3); relT = Math.max(0, relT - dt); shake = Math.max(0, shake - dt * 34);
  const area = AREAS[LEVELS[level].area];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#140a24'; ctx.fillRect(0, 0, VW, VH);
  const bg = IMG[area.bg] || IMG.bg; if (bg) { const s = Math.max(VW / bg.width, VH / bg.height); ctx.globalAlpha = 0.9; ctx.drawImage(bg, (VW - bg.width * s) / 2, (VH - bg.height * s) / 2, bg.width * s, bg.height * s); ctx.globalAlpha = 1; }
  { const v = ctx.createLinearGradient(0, 0, 0, VH); v.addColorStop(0, area.tint[0]); v.addColorStop(1, area.tint[1]); ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH); }
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  const s2 = scale * zoom, fx = focus.x, fy = focus.y;
  const ex = ox + fx * scale - fx * s2, ey = oy + fy * scale - fy * s2;
  ctx.setTransform(dpr * s2, 0, 0, dpr * s2, dpr * (ex + sx), dpr * (ey + sy));
  const gg = ctx.createLinearGradient(0, GROUND, 0, H); gg.addColorStop(0, '#3b2346'); gg.addColorStop(1, '#1a0f22');
  ctx.fillStyle = gg; ctx.fillRect(-W, GROUND, W * 3, H - GROUND + 200);
  ctx.fillStyle = '#ff9f1c'; for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc((i * 97) % (W + 200) - 100, GROUND + 8 + (i * 37) % 60, 4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  for (const cx of [60, 420, 1080]) { const r = ctx.createRadialGradient(cx, GROUND - 10, 2, cx, GROUND - 10, 60 + Math.sin(t * 7 + cx) * 4); r.addColorStop(0, 'rgba(255,170,60,.55)'); r.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = r; ctx.fillRect(cx - 70, GROUND - 80, 140, 140); ctx.fillStyle = '#fbf3d5'; ctx.fillRect(cx - 4, GROUND - 22, 8, 22); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(cx, GROUND - 28, 4, 7, 0, 0, 7); ctx.fill(); }
  { // Abuela: wind-up pose while loaded/aiming, release pose right after a throw
    const rel = (relT > 0 || flying.length > 0) && IMG.abuelaRel, im = rel ? IMG.abuelaRel! : IMG.abuela;
    if (im) { const h = rel ? REL.h : WIND.h, w = h * (im.width / im.height), bob = rel ? 0 : Math.sin(t * 2) * 1.5; ctx.drawImage(im, ABU.x - w / 2, ABU.ground - h + bob, w, h); }
  }
  const loaded = playing && !ended && !flying.length && shotsLeft > 0;
  if (loaded && relT <= 0) {
    // special shots: show the loaded ammo in her raised hand (the gold chancla is already in the art)
    if (shotType !== 'chancla') { const si = shotImg(); if (si) drawImg(si, WIND.hand.x, WIND.hand.y, SHOT_INFO[shotType].r * 1.9, -0.4); }
    if (!aiming) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); ctx.strokeStyle = '#ffd68c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(HAND.x, HAND.y, 50, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  trajectory();
  for (const b of Composite.allBodies(world)) {
    if (b.isStatic && !ghosts.includes(b)) continue;
    if (isShot(b)) { const si = shotImg(); if (si) drawImg(si, b.position.x, b.position.y, SHOT_INFO[shotType].r * 2.2, b.angle); continue; }
    const m = meta.get(b.id); if (!m || m.dead) continue;
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    const dmg = 1 - m.hp / m.maxHp;
    if (m.kind === 'wood') {
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h);
      ctx.strokeStyle = 'rgba(40,20,8,.55)'; ctx.lineWidth = 2;
      const along = m.w > m.h; for (let i = 1; i < 4; i++) { ctx.beginPath(); if (along) { ctx.moveTo(-m.w / 2, -m.h / 2 + (m.h * i) / 4); ctx.lineTo(m.w / 2, -m.h / 2 + (m.h * i) / 4); } else { ctx.moveTo(-m.w / 2 + (m.w * i) / 4, -m.h / 2); ctx.lineTo(-m.w / 2 + (m.w * i) / 4, m.h / 2); } ctx.stroke(); }
      ctx.strokeStyle = '#1b0d05'; ctx.lineWidth = 3; ctx.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h);
    } else if (m.kind === 'stone') {
      const r = Math.min(m.w, m.h) / 2.2; ctx.fillStyle = '#7b7589';
      ctx.beginPath(); ctx.moveTo(-m.w / 2, m.h / 2); ctx.lineTo(-m.w / 2, -m.h / 2 + r); ctx.quadraticCurveTo(-m.w / 2, -m.h / 2, -m.w / 2 + r, -m.h / 2); ctx.lineTo(m.w / 2 - r, -m.h / 2); ctx.quadraticCurveTo(m.w / 2, -m.h / 2, m.w / 2, -m.h / 2 + r); ctx.lineTo(m.w / 2, m.h / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2633'; ctx.lineWidth = 3; ctx.stroke();
      if (m.h > 50) { ctx.fillStyle = '#4a4556'; ctx.fillRect(-2, -m.h / 2 + r * 0.6, 4, Math.min(m.h * 0.45, 30)); ctx.fillRect(-9, -m.h / 2 + r * 0.6 + 7, 18, 4); }
      if (dmg > 0.3) { ctx.strokeStyle = '#2a2633'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-m.w / 3, -m.h / 4); ctx.lineTo(0, 0); ctx.lineTo(m.w / 4, m.h / 3); ctx.stroke(); }
    } else if (m.kind === 'picado') {
      ctx.fillStyle = m.color!; ctx.globalAlpha = 0.85; ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(20,10,36,.6)'; for (let x = -m.w / 2 + 8; x < m.w / 2 - 4; x += 14) { ctx.beginPath(); ctx.arc(x, 0, 3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h);
    } else if (m.kind === 'tnt') {
      ctx.fillStyle = '#b5172b'; ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(-m.w / 2, -6, m.w, 12);
      ctx.strokeStyle = '#3a0610'; ctx.lineWidth = 3; ctx.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h);
      for (const rx of [-12, 0, 12]) { ctx.fillStyle = ['#4cc9f0', '#f72585', '#06d6a0'][(rx + 12) / 12]; ctx.fillRect(rx - 3, -m.h / 2 - 14, 6, 14); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(rx - 4, -m.h / 2 - 14); ctx.lineTo(rx, -m.h / 2 - 21); ctx.lineTo(rx + 4, -m.h / 2 - 14); ctx.fill(); }
      ctx.fillStyle = `rgba(255,220,120,${0.5 + Math.sin(t * 10 + b.id) * 0.5})`; ctx.beginPath(); ctx.arc(12, -m.h / 2 - 23, 2.5, 0, 7); ctx.fill();
    } else if (m.kind === 'pinata') {
      ctx.shadowColor = 'rgba(255,95,176,.9)'; ctx.shadowBlur = 16;
      if (IMG.pinata) { const h = m.h * 1.1, w = h * (IMG.pinata.width / IMG.pinata.height); ctx.rotate(Math.sin(t * 2.2 + b.id) * 0.05); ctx.drawImage(IMG.pinata, -w / 2, -h / 2, w, h); }
    } else {
      const img = m.kind === 'lucha' || m.kind === 'armor' ? IMG.lucha : IMG.calaca;
      if (m.kind === 'ghost') { ctx.globalAlpha = 0.72 + Math.sin(t * 3 + b.id) * 0.12; ctx.fillStyle = 'rgba(200,240,255,.35)'; ctx.beginPath(); ctx.moveTo(-m.w * 0.4, 0); for (let i = 0; i <= 6; i++) ctx.lineTo(-m.w * 0.4 + (i * m.w * 0.8) / 6, m.h * 0.55 + (i % 2 ? 10 : 0) + Math.sin(t * 6 + i) * 3); ctx.lineTo(m.w * 0.4, 0); ctx.fill(); }
      ctx.shadowColor = m.kind === 'ghost' ? 'rgba(150,240,255,1)' : m.kind === 'lucha' || m.kind === 'armor' ? 'rgba(255,190,90,.8)' : 'rgba(160,230,255,.8)'; ctx.shadowBlur = m.kind === 'ghost' ? 22 : 14;
      if (img) { const k = (m.h * 1.18) / Math.max(img.width, img.height), w = img.width * k, h = img.height * k; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
      ctx.shadowBlur = 0;
      if (m.kind === 'armor') { // steel helmet band + rivets; cracks after the first hit
        ctx.strokeStyle = m.cracked ? '#8a8f9c' : '#d7dbe4'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 2, m.w * 0.47, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = '#eef0f5'; for (const a of [1.2, 1.5, 1.8]) { ctx.beginPath(); ctx.arc(Math.cos(Math.PI * a) * m.w * 0.47, 2 + Math.sin(Math.PI * a) * m.w * 0.47, 2.5, 0, 7); ctx.fill(); }
        if (m.cracked) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -m.h * 0.42); ctx.lineTo(-2, -m.h * 0.2); ctx.lineTo(-10, -m.h * 0.05); ctx.lineTo(-3, m.h * 0.12); ctx.moveTo(-2, -m.h * 0.2); ctx.lineTo(9, -m.h * 0.12); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.life -= dt * 1.4; if (p.life <= 0) { parts.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center';
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.life -= dt; p.y -= dt * (p.big ? 24 : 40); if (p.life <= 0) { pops.splice(i, 1); continue; } ctx.font = p.big ? '900 38px system-ui' : p.t.length > 14 ? '800 26px system-ui' : '900 30px system-ui'; ctx.globalAlpha = Math.min(1, p.life); ctx.lineWidth = 6; ctx.strokeStyle = '#1a0c2c'; ctx.strokeText(p.t, p.x, p.y); ctx.fillStyle = p.big ? '#ffe36e' : '#ffd166'; ctx.fillText(p.t, p.x, p.y); }
  ctx.globalAlpha = 1;
  if (flashT > 0) { flashT -= dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = Math.max(0, flashT * 2.4); ctx.fillStyle = '#fff3d6'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
}

// ── Start flow (iOS-safe) ────────────────────────────────────────────────────
const DIRECT = /[?&]start=1/.test(location.search);
const go = $('go') as HTMLButtonElement; const startScreen = $('start');
if (DIRECT) { startScreen.classList.add('hidden'); startScreen.style.display = 'none'; }
let started = false, countdown: number | null = null;
function safe(label: string, fn: () => void) { try { fn(); } catch (err) { report(`${label}: ${(err as Error)?.message || err}`); } }
function startGame() {
  if (started) return; started = true;
  markGameStart('fling');
  if (countdown !== null) { clearInterval(countdown); countdown = null; }
  safe('ui', () => { startScreen.classList.add('hidden'); startScreen.style.display = 'none'; });
  playing = true; last = performance.now();
  safe('level', () => {
    if (DIRECT) { let i = 0; for (let k = 0; k < LEVELS.length; k++) if (unlocked(k)) { i = k; if (!(save.stars[k] > 0)) break; } build(i); } // from /choose: straight into the next unplayed level
    else if (totalStars() === 0) build(0); else openMap();
  });
  safe('audio', () => { wakeAudio(); A.unlock(); });
  safe('fullscreen', () => {
    const el = document.documentElement as any; const req = el.requestFullscreen;
    if (typeof req === 'function' && !document.fullscreenElement) { const pr = req.call(el); if (pr && typeof pr.then === 'function') pr.then(() => { const lk = (screen.orientation as any)?.lock?.('landscape'); if (lk?.catch) lk.catch(() => {}); }, () => {}); }
  });
}
function onTap(el: Element, fn: () => void) {
  const h = (e: Event) => { e.stopPropagation(); if (e.cancelable && e.type === 'touchend') e.preventDefault(); fn(); };
  el.addEventListener('touchend', h, { passive: false }); el.addEventListener('pointerup', h); el.addEventListener('click', h);
}
onTap(startScreen, startGame);
onTap(go, startGame);
for (const ev of ['touchend', 'click', 'pointerup']) startScreen.querySelector('a')?.addEventListener(ev, (e) => e.stopPropagation());
let lastAny = 0;
onTap($('playAnyway'), () => { const n = performance.now(); if (n - lastAny < 600) return; lastAny = n; forcePlay = true; onLayout(); startGame(); scheduleLayout(); report('play anyway → started'); });
onTap($('restart'), () => { if (playing && started) build(level); });
onTap($('mapBtn'), () => { if (playing && started) openMap(); });
if (/[?&]debug=1/.test(location.search)) { let taps = 0; const card = $('rotate'); for (const ev of ['touchstart', 'touchend']) card.addEventListener(ev, (e) => { taps++; report(`taps ${taps}: ${ev} on ${(e.target as HTMLElement).id || (e.target as HTMLElement).tagName}`); }, { capture: true, passive: true }); }
function maybeCountdown() {
  if (started || countdown !== null || portraitNow) return;
  let n = 3; go.textContent = `PLAY! (${n})`;
  countdown = window.setInterval(() => { if (portraitNow) { clearInterval(countdown!); countdown = null; go.textContent = 'PLAY!'; return; } n--; if (n <= 0) startGame(); else go.textContent = `PLAY! (${n})`; }, 1000);
}
setInterval(maybeCountdown, 500);
Promise.all(Object.entries(names).map(([k, v]) => loadImg(v).then((im) => { IMG[k] = im; if (k === 'chancla') { TINT.boot = tintImg(im, '#3b2210', 0.62); TINT.triple = tintImg(im, '#29c4e0', 0.5); } }).catch(() => report(`image failed: ${v}`))));
document.getElementById('a2hsX')?.addEventListener('click', () => { a2hsOff = true; try { localStorage.setItem('chanclazo_a2hs_off', '1'); } catch { /* ignore */ } updateA2hs(); });
if (/[?&]debug=1/.test(location.search)) setInterval(() => { const a = (window as any).__flingAudio; report(`audio ${a.state} · session ${a.session} · gain ${a.gain === null ? '-' : a.gain.toFixed(2)} · muted ${a.muted} · sounds ${a.played}`); }, 2000);
safe('wireMute', () => { A.wireMute($('mute') as HTMLButtonElement); initAudioControls('fling', (m) => A.setMuted(m)); });
build(0);
onLayout(); scheduleLayout();
if (DIRECT) setTimeout(startGame, 0); // rotate-to-landscape prompt still shows on portrait phones
requestAnimationFrame(frame);
(window as any).__fling = {
  engine, world, meta, LEVELS, build, openMap, boom: (b: Matter.Body) => { armed = true; damage(b, 99); },
  snapshot: () => Composite.allBodies(world).filter((b) => meta.has(b.id) && !meta.get(b.id)!.dead && meta.get(b.id)!.kind !== 'ghost').map((b) => ({ id: b.id, x: b.position.x, y: b.position.y, a: b.angle })),
  fire: (px: number, py: number, type?: ShotType) => { if (type) shotType = type; aiming = true; pull = { x: px, y: py }; release(); },
  split: () => doSplit(),
  finish: (win: boolean) => { ended = false; finish(win); },
  get state() { return { level, score, shotsLeft, ended, villains: villainsLeft(), alive: [...meta.values()].filter((m) => !m.dead).length, shotType }; },
};
