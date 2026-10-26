import './play.css';
import Matter from 'matter-js';
import { playLevelUp, playGameOver } from '../game/sound';
import { $, loadImg, wakeAudio, stars, report } from './common';
import * as A from './flingAudio';

const { Engine, Bodies, Composite, Body, Events, Vector } = Matter;
const W = 1100, H = 1000, GROUND = 920;            // world units; fits portrait & landscape
const SLING = { x: 130, y: 760 };
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
    // Portrait: zoom onto slingshot + fort and lift the ground to ~78% height.
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
const names = { bg: '/play/night_bg.webp', abuela: '/play/abuela_sprite.webp', lucha: '/play/luchador_sprite.webp', calaca: '/play/calaca_sprite.webp', chancla: '/play/t_chancla.webp', pinata: '/play/t_pinata.webp' };

type BKind = 'wood' | 'stone' | 'picado' | 'lucha' | 'calaca' | 'pinata';
interface Meta { kind: BKind; w: number; h: number; hp: number; color?: string; dead?: boolean }
const meta = new Map<number, Meta>();

// Levels: [kind, x, yFromGround(center), w, h]
type Piece = [BKind, number, number, number, number];
const LEVELS: { shots: number; pieces: Piece[] }[] = [
  { shots: 3, pieces: [
    ['pinata', 1010, 37, 52, 74], ['wood', 820, 60, 24, 120], ['wood', 940, 60, 24, 120], ['wood', 880, 132, 170, 22],
    ['lucha', 880, 40, 56, 80], ['stone', 880, 175, 60, 64], ['calaca', 880, 245, 44, 76],
  ] },
  { shots: 4, pieces: [
    ['pinata', 905, 37, 52, 74], ['stone', 760, 45, 50, 90], ['stone', 860, 45, 50, 90], ['wood', 810, 101, 160, 22], ['lucha', 810, 152, 56, 80],
    ['wood', 940, 75, 24, 150], ['wood', 1040, 75, 24, 150], ['picado', 990, 162, 140, 20], ['calaca', 990, 40, 44, 76],
    ['picado', 990, 190, 30, 36], ['calaca', 990, 212, 44, 76],
  ] },
  { shots: 4, pieces: [
    ['pinata', 885, 37, 52, 74], ['stone', 730, 40, 40, 80], ['stone', 830, 40, 40, 80], ['wood', 780, 91, 150, 22],
    ['wood', 740, 152, 22, 100], ['wood', 820, 152, 22, 100], ['picado', 780, 213, 120, 22], ['lucha', 780, 142, 50, 72],
    ['stone', 940, 60, 50, 120], ['stone', 1040, 60, 50, 120], ['wood', 990, 131, 170, 22], ['calaca', 990, 40, 44, 76],
    ['wood', 950, 192, 22, 100], ['wood', 1030, 192, 22, 100], ['picado', 990, 253, 130, 22], ['lucha', 990, 182, 50, 72],
    ['calaca', 780, 262, 40, 70],
  ] },
];
const PICADO = ['#f72585', '#4cc9f0', '#ffd166', '#06d6a0', '#9b5de5'];

const engine = Engine.create(); engine.gravity.y = 1.1;
const world = engine.world;
let level = 0, score = 0, shotsLeft = 0, shot: Matter.Body | null = null, shotAt = 0, ended = false, playing = false;
let aiming = false, pull = { x: 0, y: 0 }, abuelaKick = 0, shake = 0;
interface Part { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number }
const parts: Part[] = [];
interface Pop { x: number; y: number; t: string; life: number }
const pops: Pop[] = [];

function burst(x: number, y: number, colors: string[], n = 16) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8, life: 1, c: colors[i % colors.length], s: 4 + Math.random() * 6 });
}
function hud() { $('lvl').textContent = String(level + 1); $('score').textContent = String(score); $('left').textContent = String(shotsLeft); }

function build(n: number) {
  Composite.clear(world, false); meta.clear(); parts.length = 0; pops.length = 0;
  const ground = Bodies.rectangle(W / 2, GROUND + 60, W * 3, 120, { isStatic: true, friction: 0.9 });
  Composite.add(world, ground);
  for (const [kind, x, yg, w, h] of LEVELS[n].pieces) {
    const villain = kind === 'lucha' || kind === 'calaca';
    const opts: Matter.IChamferableBodyDefinition = {
      friction: 0.8, restitution: 0.05,
      density: kind === 'stone' ? 0.004 : kind === 'picado' ? 0.0006 : villain ? 0.0012 : 0.0015,
      chamfer: kind === 'stone' ? { radius: [Math.min(w, h) / 2.2, Math.min(w, h) / 2.2, 2, 2] } : villain ? { radius: 10 } : undefined,
    };
    const b = Bodies.rectangle(x, GROUND - yg, w, h, opts);
    meta.set(b.id, { kind, w, h, hp: kind === 'stone' ? 9 : kind === 'wood' ? 5 : kind === 'picado' ? 1.5 : kind === 'pinata' ? 1.2 : 2.2, color: PICADO[(x + yg) % PICADO.length | 0] });
    Composite.add(world, b);
  }
  shotsLeft = LEVELS[n].shots; shot = null; ended = false; hud();
}

function villainsLeft() { let k = 0; for (const b of Composite.allBodies(world)) { const m = meta.get(b.id); if (m && !m.dead && (m.kind === 'lucha' || m.kind === 'calaca')) k++; } return k; }
let combo = 0;
function damage(b: Matter.Body, amt: number) {
  const m = meta.get(b.id); if (!m || m.dead) return;
  m.hp -= amt; if (m.hp > 0) return;
  m.dead = true; Composite.remove(world, b);
  if (m.kind === 'pinata') { pinataBoom(b); return; }
  const villain = m.kind === 'lucha' || m.kind === 'calaca';
  const pts = villain ? 5000 : m.kind === 'stone' ? 800 : 500; score += pts; combo++;
  pops.push({ x: b.position.x, y: b.position.y - 20, t: `+${pts}`, life: 1.2 });
  if (villain) { A.knockout(); if (combo > 1 || amt > 8) A.explosion(); shake = 10; burst(b.position.x, b.position.y, m.kind === 'lucha' ? ['#d62828', '#ffd166', '#fff'] : ['#fbf6ea', '#f72585', '#ffc300'], 26); }
  else { if (m.kind === 'wood') A.breakWood(); else if (m.kind === 'stone') A.breakStone(); else A.ripPaper(); if (amt > 12) A.explosion(); burst(b.position.x, b.position.y, m.kind === 'wood' ? ['#8b5a2b', '#c08a4f'] : m.kind === 'stone' ? ['#8a8597', '#5d5868'] : PICADO, 12); }
  hud();
}
// Piñata: big candy/confetti/papel picado burst, strong shake, radial shove + damage, bonus points.
const CANDY = ['#f72585', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5', '#ff6b35', '#fff'];
function pinataBoom(b: Matter.Body) {
  const { x, y } = b.position; score += 3000; combo++;
  pops.push({ x, y: y - 30, t: '¡PIÑATA! +3000', life: 1.6 });
  for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 12; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5, life: 1.3 + Math.random() * 0.6, c: CANDY[i % CANDY.length], s: i % 3 === 0 ? 12 : 5 + Math.random() * 6 }); }
  shake = 26; flashT = 0.25; A.explosion(); A.ripPaper(); setTimeout(() => A.knockout(), 120);
  for (const o of Composite.allBodies(world)) {
    if (o.isStatic || o === b) continue; const dx = o.position.x - x, dy = o.position.y - y, d = Math.hypot(dx, dy);
    if (d > 260) continue; const k = (1 - d / 260);
    Body.applyForce(o, o.position, { x: (dx / (d || 1)) * 0.06 * o.mass * k, y: ((dy / (d || 1)) * 0.06 - 0.05) * o.mass * k });
    const mo = meta.get(o.id); if (mo && !mo.dead && k > 0.25) setTimeout(() => damage(o, 6 * k), 30);
  }
  hud();
}
let flashT = 0;
Events.on(engine, 'collisionStart', (e) => {
  for (const p of e.pairs) {
    const rel = Vector.magnitude(Vector.sub(p.bodyA.velocity, p.bodyB.velocity));
    if (rel < 2.2) continue;
    const km = meta.get(p.bodyA.id) || meta.get(p.bodyB.id); if (km && rel > 3) A.knock(km.kind, rel);
    const massF = (b: Matter.Body) => (b.isStatic ? 3 : Math.min(3, b.mass / 2));
    damage(p.bodyA, (rel - 1.5) * 0.45 * massF(p.bodyB));
    damage(p.bodyB, (rel - 1.5) * 0.45 * massF(p.bodyA));
  }
});

// ── Input: drag back anywhere to aim ─────────────────────────────────────────
function isPortraitPhone() { return portraitNow; }
const toWorld = (cx: number, cy: number) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });
let dragStart = { x: 0, y: 0 };
cv.addEventListener('pointerdown', (e) => {
  wakeAudio(); if (isPortraitPhone() || !playing || ended || shot || shotsLeft <= 0) return;
  aiming = true; dragStart = toWorld(e.clientX, e.clientY); pull = { x: 0, y: 0 }; A.unlock(); A.stretchStart(); A.stretch(0); cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!aiming) return; const p = toWorld(e.clientX, e.clientY);
  let dx = p.x - dragStart.x, dy = p.y - dragStart.y; const d = Math.hypot(dx, dy);
  if (d > MAXPULL) { dx *= MAXPULL / d; dy *= MAXPULL / d; } pull = { x: dx, y: dy }; A.stretch(Math.hypot(dx, dy) / MAXPULL);
});
const release = () => {
  if (!aiming) return; aiming = false; A.stretchStop();
  if (Math.hypot(pull.x, pull.y) < 25) { pull = { x: 0, y: 0 }; return; }
  const b = Bodies.circle(SLING.x + pull.x, SLING.y + pull.y, 18, { density: 0.006, restitution: 0.3, friction: 0.5, frictionAir: 0.004 });
  Composite.add(world, b); Body.setVelocity(b, { x: -pull.x * POWER, y: -pull.y * POWER }); Body.setAngularVelocity(b, 0.35);
  shot = b; shotAt = performance.now(); shotsLeft--; combo = 0; abuelaKick = 1; { const pw = Math.hypot(pull.x, pull.y) / MAXPULL; A.twang(pw); A.whoosh(pw); } pull = { x: 0, y: 0 }; hud();
};
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);

// ── Level flow ───────────────────────────────────────────────────────────────
function settled() { return Composite.allBodies(world).every((b) => b.isStatic || b.speed < 0.25); }
function finish(win: boolean) {
  ended = true; const s = win ? (shotsLeft >= 2 ? 3 : shotsLeft >= 1 ? 2 : 1) : 0;
  if (win) { score += shotsLeft * 2000; hud(); playLevelUp(); } else playGameOver();
  $('endTitle').textContent = win ? (level === 2 ? 'Cemetery cleared!' : 'Level clear!') : 'Out of chanclas!';
  $('endStars').textContent = stars(s);
  $('endMsg').textContent = win ? `Score ${score}${shotsLeft ? ` (includes +${shotsLeft * 2000} for unused chanclas)` : ''}` : 'Some villains are still standing. Try another angle.';
  const next = $('next') as HTMLButtonElement;
  next.textContent = win ? (level === 2 ? 'Play again' : 'Next level') : 'Try again';
  next.onclick = () => { $('end').classList.add('hidden'); if (win) { level = level === 2 ? 0 : level + 1; if (level === 0) score = 0; } build(level); };
  ($('retry') as HTMLAnchorElement).onclick = (e) => { e.preventDefault(); $('end').classList.add('hidden'); build(level); };
  setTimeout(() => $('end').classList.remove('hidden'), 700);
}
function checkFlow() {
  if (ended) return;
  if (villainsLeft() === 0 && settled()) return finish(true);
  if (shot) {
    const age = performance.now() - shotAt;
    const p = shot.position;
    if ((age > 1500 && settled()) || age > 7000 || p.x > W + 200 || p.x < -200) {
      Composite.remove(world, shot); shot = null;
      if (villainsLeft() === 0) finish(true); else if (shotsLeft <= 0) finish(false);
    }
  }
  // villains knocked off the edge
  for (const b of Composite.allBodies(world)) if (!b.isStatic && (b.position.y > GROUND + 200 || b.position.x > W + 300)) damage(b, 99);
}

// ── Render ───────────────────────────────────────────────────────────────────
function drawImg(img: HTMLImageElement, x: number, y: number, h: number, ang = 0, flip = false) {
  const w = h * (img.width / img.height);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}
function trajectory() {
  if (!aiming || Math.hypot(pull.x, pull.y) < 25) return;
  let x = SLING.x + pull.x, y = SLING.y + pull.y, vx = -pull.x * POWER, vy = -pull.y * POWER;
  const g = engine.gravity.y * 0.001 * (1000 / 60) ** 2; // matter's per-step gravity
  ctx.fillStyle = 'rgba(255,214,140,.8)';
  for (let i = 0; i < 40; i++) { for (let k = 0; k < 2; k++) { vy += g; x += vx; y += vy; } ctx.globalAlpha = 1 - i / 40; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
let last = performance.now(), t = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  try { frameBody(now); } catch (err) { report('frame: ' + ((err as Error)?.message || err)); }
}
function frameBody(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now; t += dt;
  const portrait = isPortraitPhone();
  if (playing && !portrait) { Engine.update(engine, dt * 1000); checkFlow(); }
  abuelaKick = Math.max(0, abuelaKick - dt * 3); shake = Math.max(0, shake - dt * 34);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#140a24'; ctx.fillRect(0, 0, VW, VH);
  const bg = IMG.bg; if (bg) { const s = Math.max(VW / bg.width, VH / bg.height); ctx.globalAlpha = 0.9; ctx.drawImage(bg, (VW - bg.width * s) / 2, (VH - bg.height * s) / 2, bg.width * s, bg.height * s); ctx.globalAlpha = 1; }
  { const v = ctx.createLinearGradient(0, 0, 0, VH); v.addColorStop(0, 'rgba(10,4,30,.72)'); v.addColorStop(1, 'rgba(25,8,40,.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH); }
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));
  // ground
  const gg = ctx.createLinearGradient(0, GROUND, 0, H); gg.addColorStop(0, '#3b2346'); gg.addColorStop(1, '#1a0f22');
  ctx.fillStyle = gg; ctx.fillRect(-W, GROUND, W * 3, H - GROUND + 200);
  ctx.fillStyle = '#ff9f1c'; for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc((i * 97) % (W + 200) - 100, GROUND + 8 + (i * 37) % 60, 4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  // candles glow on ground
  for (const cx of [60, 420, 1080]) { const r = ctx.createRadialGradient(cx, GROUND - 10, 2, cx, GROUND - 10, 60 + Math.sin(t * 7 + cx) * 4); r.addColorStop(0, 'rgba(255,170,60,.55)'); r.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = r; ctx.fillRect(cx - 70, GROUND - 80, 140, 140); ctx.fillStyle = '#fbf3d5'; ctx.fillRect(cx - 4, GROUND - 22, 8, 22); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(cx, GROUND - 28, 4, 7, 0, 0, 7); ctx.fill(); }
  // slingshot (back fork)
  ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(SLING.x, GROUND); ctx.lineTo(SLING.x, SLING.y + 60); ctx.lineTo(SLING.x - 22, SLING.y); ctx.moveTo(SLING.x, SLING.y + 60); ctx.lineTo(SLING.x + 22, SLING.y); ctx.stroke();
  // abuela beside the slingshot
  if (IMG.abuela) drawImg(IMG.abuela, SLING.x - 62, GROUND - 95 + Math.sin(t * 2) * 2, 190, -0.08 - abuelaKick * 0.25);
  // bands + loaded chancla
  const lp = { x: SLING.x + pull.x, y: SLING.y + pull.y };
  const loaded = playing && !ended && !shot && shotsLeft > 0;
  if (loaded) {
    ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(SLING.x - 22, SLING.y); ctx.lineTo(lp.x, lp.y); ctx.lineTo(SLING.x + 22, SLING.y); ctx.stroke();
    if (IMG.chancla) drawImg(IMG.chancla, lp.x, lp.y, 34, -0.4);
    if (!aiming) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); ctx.strokeStyle = '#ffd68c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(SLING.x, SLING.y, 50, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  trajectory();
  // bodies
  for (const b of Composite.allBodies(world)) {
    if (b.isStatic) continue;
    if (b === shot) { if (IMG.chancla) drawImg(IMG.chancla, b.position.x, b.position.y, 40, b.angle); continue; }
    const m = meta.get(b.id); if (!m) continue;
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    const dmg = m.kind === 'stone' ? 1 - m.hp / 9 : m.kind === 'wood' ? 1 - m.hp / 5 : 0;
    if (m.kind === 'wood') {
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h);
      ctx.strokeStyle = 'rgba(40,20,8,.55)'; ctx.lineWidth = 2;
      const along = m.w > m.h; for (let i = 1; i < 4; i++) { ctx.beginPath(); if (along) { ctx.moveTo(-m.w / 2, -m.h / 2 + (m.h * i) / 4); ctx.lineTo(m.w / 2, -m.h / 2 + (m.h * i) / 4); } else { ctx.moveTo(-m.w / 2 + (m.w * i) / 4, -m.h / 2); ctx.lineTo(-m.w / 2 + (m.w * i) / 4, m.h / 2); } ctx.stroke(); }
      ctx.strokeStyle = '#1b0d05'; ctx.lineWidth = 3; ctx.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h);
    } else if (m.kind === 'stone') {
      const r = Math.min(m.w, m.h) / 2.2; ctx.fillStyle = '#7b7589';
      ctx.beginPath(); ctx.moveTo(-m.w / 2, m.h / 2); ctx.lineTo(-m.w / 2, -m.h / 2 + r); ctx.quadraticCurveTo(-m.w / 2, -m.h / 2, -m.w / 2 + r, -m.h / 2); ctx.lineTo(m.w / 2 - r, -m.h / 2); ctx.quadraticCurveTo(m.w / 2, -m.h / 2, m.w / 2, -m.h / 2 + r); ctx.lineTo(m.w / 2, m.h / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2633'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#4a4556'; ctx.fillRect(-2, -m.h / 2 + r * 0.6, 4, Math.min(m.h * 0.45, 30)); ctx.fillRect(-9, -m.h / 2 + r * 0.6 + 7, 18, 4);
      if (dmg > 0.3) { ctx.strokeStyle = '#2a2633'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-m.w / 3, -m.h / 4); ctx.lineTo(0, 0); ctx.lineTo(m.w / 4, m.h / 3); ctx.stroke(); }
    } else if (m.kind === 'picado') {
      ctx.fillStyle = m.color!; ctx.globalAlpha = 0.85; ctx.fillRect(-m.w / 2, -m.h / 2, m.w, m.h); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(20,10,36,.6)'; for (let x = -m.w / 2 + 8; x < m.w / 2 - 4; x += 14) { ctx.beginPath(); ctx.arc(x, 0, 3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h);
    } else if (m.kind === 'pinata') {
      ctx.shadowColor = 'rgba(255,95,176,.9)'; ctx.shadowBlur = 16;
      if (IMG.pinata) { const h = m.h * 1.1, w = h * (IMG.pinata.width / IMG.pinata.height); ctx.rotate(Math.sin(t * 2.2 + b.id) * 0.05); ctx.drawImage(IMG.pinata, -w / 2, -h / 2, w, h); }
    } else {
      const img = m.kind === 'lucha' ? IMG.lucha : IMG.calaca;
      ctx.shadowColor = m.kind === 'lucha' ? 'rgba(255,190,90,.8)' : 'rgba(160,230,255,.8)'; ctx.shadowBlur = 14;
      if (img) { const h = m.h * 1.12, w = h * (img.width / img.height); ctx.drawImage(img, -w / 2, -h / 2 + Math.sin(t * 3 + b.id) * 1.5, w, h); }
    }
    ctx.restore();
  }
  // particles + score pops
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.life -= dt * 1.4; if (p.life <= 0) { parts.splice(i, 1); continue; } ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1; ctx.font = '900 30px system-ui'; ctx.textAlign = 'center';
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.life -= dt; p.y -= dt * 40; if (p.life <= 0) { pops.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, p.life); ctx.lineWidth = 5; ctx.strokeStyle = '#1a0c2c'; ctx.strokeText(p.t, p.x, p.y); ctx.fillStyle = '#ffd166'; ctx.fillText(p.t, p.x, p.y); }
  ctx.globalAlpha = 1;
  if (flashT > 0) { flashT -= dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = Math.max(0, flashT * 2.4); ctx.fillStyle = '#fff3d6'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
}

// ── Start flow (iOS-safe) ────────────────────────────────────────────────────
// The Play button is never disabled: the game draws whatever art has loaded so far.
// Start is idempotent, nothing in it is awaited, and every risky call is isolated.
const go = $('go') as HTMLButtonElement; const startScreen = $('start');
let started = false, countdown: number | null = null;
function safe(label: string, fn: () => void) { try { fn(); } catch (err) { report(`${label}: ${(err as Error)?.message || err}`); } }
function startGame() {
  if (started) return; started = true;
  if (countdown !== null) { clearInterval(countdown); countdown = null; }
  safe('ui', () => { startScreen.classList.add('hidden'); startScreen.style.display = 'none'; });
  safe('level', () => { level = 0; score = 0; build(0); });
  playing = true; last = performance.now();
  safe('audio', () => { wakeAudio(); A.unlock(); A.startMusic(); });
  safe('fullscreen', () => { // Android Chrome only; iOS has no element fullscreen. Fire-and-forget.
    const el = document.documentElement as any; const req = el.requestFullscreen;
    if (typeof req === 'function' && !document.fullscreenElement) {
      const pr = req.call(el); if (pr && typeof pr.then === 'function') pr.then(() => { const lk = (screen.orientation as any)?.lock?.('landscape'); if (lk?.catch) lk.catch(() => {}); }, () => {});
    }
  });
}
// Bind with touchend + pointerup + click; startGame is idempotent so duplicates are harmless.
function onTap(el: Element, fn: () => void) {
  const h = (e: Event) => { e.stopPropagation(); if (e.cancelable && e.type === 'touchend') e.preventDefault(); fn(); };
  el.addEventListener('touchend', h, { passive: false }); el.addEventListener('pointerup', h); el.addEventListener('click', h);
}
onTap(startScreen, startGame);
onTap(go, startGame);
startScreen.querySelector('a')?.addEventListener('touchend', (e) => e.stopPropagation()); startScreen.querySelector('a')?.addEventListener('click', (e) => e.stopPropagation()); startScreen.querySelector('a')?.addEventListener('pointerup', (e) => e.stopPropagation());
let lastAny = 0;
onTap($('playAnyway'), () => { const n = performance.now(); if (n - lastAny < 600) return; lastAny = n; forcePlay = true; onLayout(); startGame(); scheduleLayout(); report('play anyway → started'); });
if (/[?&]debug=1/.test(location.search)) { let taps = 0; const card = $('rotate'); for (const ev of ['touchstart', 'touchend']) card.addEventListener(ev, (e) => { taps++; report(`taps ${taps}: ${ev} on ${(e.target as HTMLElement).id || (e.target as HTMLElement).tagName}`); }, { capture: true, passive: true }); }
// Once sideways (or after Play anyway), auto-start after a short visible countdown.
function maybeCountdown() {
  if (started || countdown !== null || portraitNow) return;
  let n = 3; go.textContent = `PLAY! (${n})`;
  countdown = window.setInterval(() => { if (portraitNow) { clearInterval(countdown!); countdown = null; go.textContent = 'PLAY!'; return; } n--; if (n <= 0) startGame(); else go.textContent = `PLAY! (${n})`; }, 1000);
}
setInterval(maybeCountdown, 500);
Promise.all(Object.entries(names).map(([k, v]) => loadImg(v).then((im) => { IMG[k] = im; }).catch(() => report(`image failed: ${v}`))));
document.getElementById('a2hsX')?.addEventListener('click', () => { a2hsOff = true; try { localStorage.setItem('chanclazo_a2hs_off', '1'); } catch { /* ignore */ } updateA2hs(); });
safe('wireMute', () => A.wireMute($('mute') as HTMLButtonElement));
build(0);
onLayout(); scheduleLayout();
requestAnimationFrame(frame);
(window as any).__fling = { engine, world, meta, boom: (b: Matter.Body) => damage(b, 99), get state() { return { level, score, shotsLeft, ended, villains: villainsLeft() }; } };
