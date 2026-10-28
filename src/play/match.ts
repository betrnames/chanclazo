import { markGameStart, markFirstAction, markBonus } from '../analytics';
import './play.css';
import { showLeaderboard } from './leaderboard';
import { playHit, playStrike, playCombo, playLevelUp, playGameOver, playDodge, playShield } from '../game/sound';
import { $, loadImg, wakeAudio, wireMute, stars, autoUnlockAudio } from './common';

const N = 8, TYPES = 5;
// Level ladder: level 1 is the original (20 moves / 9000). Later levels raise the goal and trim moves.
const LEVELS = [
  { moves: 20, goal: 9000 }, { moves: 20, goal: 12000 }, { moves: 19, goal: 15000 }, { moves: 18, goal: 18000 },
  { moves: 17, goal: 21000 }, { moves: 16, goal: 24000 }, { moves: 15, goal: 27000 }, { moves: 15, goal: 32000 },
];
let level = Math.min(LEVELS.length, Math.max(1, parseInt(new URLSearchParams(location.search).get('level') || '1', 10) || 1));
let MOVES = LEVELS[level - 1].moves, GOAL = LEVELS[level - 1].goal;
// Regular tiles reuse the original art; specials: chancla = line clear, sugar skull = bomb, piñata = color clear
const TILE_SRC = ['/play/t_abuela.webp', '/play/t_lucha.webp', '/play/t_skull.webp', '/play/t_bottle.webp', '/play/abuela_sprite.webp'];
// Solid folk-art tile colors: abuela marigold, luchador turquoise, sugar skull magenta, bottle red-orange, marigold flower lime.
const TILE_BG = ['#f7a21b', '#18b5b0', '#e2197a', '#ff5a36', '#8cc63f'];
const SP = { none: 0, lineH: 1, lineV: 2, bomb: 3, color: 4 } as const;
type Sp = (typeof SP)[keyof typeof SP];
interface Tile { t: number; sp: Sp; x: number; y: number; scale: number; id: number; sq?: number; land?: number; fall?: boolean; glare?: number }
let uid = 1;
const grid: (Tile | null)[][] = [];
const IMG: HTMLImageElement[] = []; let chanclaImg: HTMLImageElement, skullImg: HTMLImageElement, pinataImg: HTMLImageElement, bgImg: HTMLImageElement;
// tile 4 uses the full-body abuela sprite? keep faces only: swap to a marigold drawn in code
const MARIGOLD = 4;

const cv = document.createElement('canvas'); (document.body as HTMLElement).insertBefore(cv, document.body.firstChild);
const ctx = cv.getContext('2d')!;
let dpr = 1, cell = 40, bx = 0, by = 0;
function fit() {
  dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cell = Math.floor(Math.min((innerWidth - 24) / N, (innerHeight - 130) / N, 130));
  bx = (innerWidth - cell * N) / 2; by = Math.max(80, (innerHeight - cell * N) / 2 + 20);
}
fit(); addEventListener('resize', fit);

let score = 0, moves = MOVES, busy = false, playing = false, combo = 0;
interface Part { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number }
const parts: Part[] = []; const pops: { x: number; y: number; t: string; life: number }[] = [];
const sparks: { x: number; y: number; life: number; s: number }[] = [];
let lastAct = performance.now(), nextGlare = 0, hintPair: [number, number, number, number] | null = null;
function findMove(): [number, number, number, number] | null {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
    if (grid[r][c]?.sp === SP.color || grid[r2][c2]?.sp === SP.color) return [r, c, r2, c2];
    swapCells(r, c, r2, c2); const ok = findRuns().length > 0; swapCells(r, c, r2, c2); if (ok) return [r, c, r2, c2]; }
  return null;
}
const beams: { r?: number; c?: number; life: number }[] = [];
function hud() { $('moves').textContent = String(moves); $('score').textContent = String(score); $('goal').textContent = String(GOAL); $('level').textContent = `${level}/${LEVELS.length}`; }

const rnd = () => Math.floor(Math.random() * TYPES);
const mk = (t: number, r: number, c: number, sp: Sp = SP.none): Tile => ({ t, sp, x: c, y: r, scale: 1, id: uid++ });
function newBoard() {
  for (let r = 0; r < N; r++) { grid[r] = []; for (let c = 0; c < N; c++) {
    let t: number; do { t = rnd(); } while ((c >= 2 && grid[r][c - 1]!.t === t && grid[r][c - 2]!.t === t) || (r >= 2 && grid[r - 1][c]!.t === t && grid[r - 2][c]!.t === t));
    grid[r][c] = mk(t, r - N - 1, c); } }
  if (!hasMove()) newBoard();
}
const same = (a: Tile | null, b: Tile | null) => !!a && !!b && a.sp !== SP.color && b.sp !== SP.color && a.t === b.t;

interface Run { cells: [number, number][]; dir: 'h' | 'v' }
function findRuns(): Run[] {
  const runs: Run[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N;) { let e = c + 1; while (e < N && same(grid[r][c], grid[r][e])) e++; if (e - c >= 3) runs.push({ dir: 'h', cells: Array.from({ length: e - c }, (_, k) => [r, c + k] as [number, number]) }); c = e; }
  for (let c = 0; c < N; c++) for (let r = 0; r < N;) { let e = r + 1; while (e < N && same(grid[r][c], grid[e][c])) e++; if (e - r >= 3) runs.push({ dir: 'v', cells: Array.from({ length: e - r }, (_, k) => [r + k, c] as [number, number]) }); r = e; }
  return runs;
}
function hasMove() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
    if (grid[r][c]?.sp === SP.color || grid[r2][c2]?.sp === SP.color) return true;
    swapCells(r, c, r2, c2); const ok = findRuns().length > 0; swapCells(r, c, r2, c2); if (ok) return true;
  }
  return false;
}
function swapCells(r1: number, c1: number, r2: number, c2: number) { const a = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = a; }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function burstAt(r: number, c: number, color: string, n = 8) {
  const x = bx + (c + 0.5) * cell, y = by + (r + 0.5) * cell;
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.8) * 7, life: 1, c: i % 3 ? color : '#ffd166', s: 3 + Math.random() * 5 });
  for (let i = 0; i < 4; i++) sparks.push({ x: x + (Math.random() - 0.5) * cell * 0.8, y: y + (Math.random() - 0.5) * cell * 0.8, life: 0.5 + Math.random() * 0.3, s: cell * (0.12 + Math.random() * 0.1) });
}

// Clear a set of cells, firing any specials inside (chains), then create new specials.
function clearCells(set: Set<string>, creates: { r: number; c: number; t: number; sp: Sp }[]) { if (creates.length) markBonus('match', 'special_tile');
  const queue = [...set]; const seen = new Set<string>(set);
  const add = (r: number, c: number) => { if (r < 0 || c < 0 || r >= N || c >= N) return; const k = r + ',' + c; if (!seen.has(k) && grid[r][c]) { seen.add(k); queue.push(k); } };
  while (queue.length) {
    const [r, c] = queue.shift()!.split(',').map(Number); const tl = grid[r][c]; if (!tl) continue;
    if (tl.sp === SP.lineH) { beams.push({ r, life: 0.35 }); for (let k = 0; k < N; k++) add(r, k); playShield(); }
    else if (tl.sp === SP.lineV) { beams.push({ c, life: 0.35 }); for (let k = 0; k < N; k++) add(k, c); playShield(); }
    else if (tl.sp === SP.bomb) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc); playStrike(); }
    else if (tl.sp === SP.color) { const t = rnd(); for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) if (grid[rr][cc]?.t === t) add(rr, cc); playStrike(); }
  }
  let n = 0;
  for (const k of seen) { const [r, c] = k.split(',').map(Number); const tl = grid[r][c]; if (!tl) continue; burstAt(r, c, TILE_BG[tl.t] || '#fff'); grid[r][c] = null; n++; }
  for (const cr of creates) grid[cr.r][cr.c] = Object.assign(mk(cr.t, cr.r, cr.c, cr.sp), { scale: 1.6 });
  return n;
}

async function resolve(swapA?: [number, number], swapB?: [number, number]) {
  combo = 0;
  for (;;) {
    const runs = findRuns(); if (!runs.length) break;
    combo++;
    const set = new Set<string>(); const creates: { r: number; c: number; t: number; sp: Sp }[] = []; const used = new Set<string>();
    const count = new Map<string, number>();
    for (const run of runs) for (const [r, c] of run.cells) { const k = r + ',' + c; set.add(k); count.set(k, (count.get(k) || 0) + 1); }
    const pick = (cells: [number, number][]) => { for (const p of [swapA, swapB]) if (p && cells.some(([r, c]) => r === p[0] && c === p[1])) return p; return cells[Math.floor(cells.length / 2)]; };
    // L/T: a cell in both an h and v run
    for (const [k, v] of count) if (v > 1 && !used.has(k)) { const [r, c] = k.split(',').map(Number); creates.push({ r, c, t: grid[r][c]!.t, sp: SP.bomb }); used.add(k); }
    for (const run of runs) {
      if (run.cells.some(([r, c]) => used.has(r + ',' + c))) continue;
      if (run.cells.length >= 5) { const [r, c] = pick(run.cells); creates.push({ r, c, t: -1, sp: SP.color }); used.add(r + ',' + c); }
      else if (run.cells.length === 4) { const [r, c] = pick(run.cells); creates.push({ r, c, t: grid[r][c]!.t, sp: run.dir === 'h' ? SP.lineH : SP.lineV }); used.add(r + ',' + c); }
    }
    const n = clearCells(set, creates);
    const pts = n * 60 * combo; score += pts;
    const [pr, pc] = runs[0].cells[Math.floor(runs[0].cells.length / 2)];
    pops.push({ x: bx + (pc + 0.5) * cell, y: by + (pr + 0.5) * cell, t: combo > 1 ? `+${pts}  x${combo}` : `+${pts}`, life: 1 });
    if (combo > 1) playCombo(combo); else playHit();
    hud(); await sleep(180); await gravity(); swapA = swapB = undefined;
  }
  if (!hasMove()) { pops.push({ x: innerWidth / 2, y: by + cell * N / 2, t: 'Shuffle!', life: 1.2 }); await sleep(500); newBoard(); await sleep(500); }
}
async function gravity() {
  for (let c = 0; c < N; c++) {
    let w = N - 1;
    for (let r = N - 1; r >= 0; r--) if (grid[r][c]) { if (w !== r) { grid[w][c] = grid[r][c]; grid[r][c] = null; } w--; }
    for (let r = w, k = 1; r >= 0; r--, k++) grid[r][c] = mk(rnd(), -k, c);
  }
  await sleep(260);
}
async function fireSpecialPair(r1: number, c1: number, r2: number, c2: number) {
  const a = grid[r1][c1]!, b = grid[r2][c2]!;
  const set = new Set<string>();
  if (a.sp === SP.color && b.sp === SP.color) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) set.add(r + ',' + c); }
  else { const col = a.sp === SP.color ? a : b, other = col === a ? b : a; const [cr, cc] = col === a ? [r1, c1] : [r2, c2];
    set.add(cr + ',' + cc); grid[cr][cc] = Object.assign(col, { sp: SP.none, t: other.t });
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c]?.t === other.t) { set.add(r + ',' + c); if (other.sp && other.sp !== SP.color) grid[r][c]!.sp = other.sp; } }
  playStrike(); const n = clearCells(set, []); score += n * 80; hud(); await sleep(200); await gravity();
}

async function trySwap(r1: number, c1: number, r2: number, c2: number) { markFirstAction('match', 'swap');
  if (busy || !playing || r2 < 0 || c2 < 0 || r2 >= N || c2 >= N) return;
  busy = true; lastAct = performance.now(); swapCells(r1, c1, r2, c2); for (const tt of [grid[r1][c1], grid[r2][c2]]) if (tt) tt.sq = 1; playDodge(); await sleep(170);
  const a = grid[r2][c2]!, b = grid[r1][c1]!;
  if (a.sp === SP.color || b.sp === SP.color) { moves--; hud(); await fireSpecialPair(r2, c2, r1, c1); await resolve(); }
  else if (a.sp && b.sp) { moves--; hud(); const set = new Set([r1 + ',' + c1, r2 + ',' + c2]); clearCells(set, []); await sleep(200); await gravity(); await resolve(); }
  else if (findRuns().length) { moves--; hud(); await resolve([r2, c2], [r1, c1]); }
  else { swapCells(r1, c1, r2, c2); await sleep(170); }
  busy = false; checkEnd();
}
function checkEnd() {
  if (!playing) return;
  if (score >= GOAL || moves <= 0) {
    playing = false; const win = score >= GOAL; const s = !win ? 0 : moves >= 6 ? 3 : moves >= 3 ? 2 : 1;
    win ? playLevelUp() : playGameOver();
    $('endTitle').textContent = win ? (level < LEVELS.length ? `Level ${level} cleared!` : 'All levels cleared!') : 'Out of moves!';
    ($('again') as HTMLButtonElement).textContent = win && level < LEVELS.length ? `Next: level ${level + 1}` : win ? 'Play again from level 1' : 'Retry level';
    if (win) level = level < LEVELS.length ? level + 1 : 1;
    $('endStars').textContent = stars(s);
    $('endMsg').textContent = win ? `Score ${score} with ${moves} moves to spare.` : `Score ${score}. The goal was ${GOAL}. Try making more chanclas and bombs!`;
    showLeaderboard('match', 'Chanclazo Match', score, win ? level - 1 || LEVELS.length : level, '/match');
    setTimeout(() => $('end').classList.remove('hidden'), 500);
  }
}

// ── Input: swipe/drag from a tile toward a neighbor ──────────────────────────
let down: { r: number; c: number; x: number; y: number } | null = null;
cv.addEventListener('pointerdown', (e) => {
  lastAct = performance.now(); const c = Math.floor((e.clientX - bx) / cell), r = Math.floor((e.clientY - by) / cell);
  if (r < 0 || c < 0 || r >= N || c >= N) return; down = { r, c, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.35) return;
  const d = down; down = null;
  if (Math.abs(dx) > Math.abs(dy)) trySwap(d.r, d.c, d.r, d.c + Math.sign(dx)); else trySwap(d.r, d.c, d.r + Math.sign(dy), d.c);
});
const up = () => (down = null); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

// ── Render ───────────────────────────────────────────────────────────────────
function marigold(x: number, y: number, s: number) {
  for (let ring = 0; ring < 3; ring++) { const rr = s * (0.42 - ring * 0.12); ctx.fillStyle = ['#ff8c00', '#ffa62b', '#ffd166'][ring];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + ring * 0.3; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rr * 0.55, y + Math.sin(a) * rr * 0.55, rr * 0.45, rr * 0.28, a, 0, 7); ctx.fill(); } }
  ctx.fillStyle = '#b5520a'; ctx.beginPath(); ctx.arc(x, y, s * 0.08, 0, 7); ctx.fill();
}
function fitImg(img: HTMLImageElement, x: number, y: number, s: number, rot = 0) {
  const k = s / Math.max(img.width, img.height), w = img.width * k, h = img.height * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}
let last = performance.now(), T = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#8fd3f4'; ctx.fillRect(0, 0, innerWidth, innerHeight);
  if (bgImg && false) { const s = Math.max(innerWidth / bgImg.width, innerHeight / bgImg.height); ctx.globalAlpha = 0.75; ctx.drawImage(bgImg, (innerWidth - bgImg.width * s) / 2, (innerHeight - bgImg.height * s) / 2, bgImg.width * s, bgImg.height * s); ctx.globalAlpha = 1; }
  { const fl = ['#e2197a', '#18b5b0', '#8cc63f', '#f7a21b', '#7b3fbf', '#ff5a36']; const fw = Math.max(26, innerWidth / 22); for (let k = 0, x = 4; x < innerWidth; k++, x += fw + 4) { const y = 4 + Math.sin(((x + fw / 2) / innerWidth) * Math.PI) * 14; ctx.fillStyle = fl[k % fl.length]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + fw, y); ctx.lineTo(x + fw, y + fw * 0.9); ctx.lineTo(x + fw / 2, y + fw * 1.15); ctx.lineTo(x, y + fw * 0.9); ctx.closePath(); ctx.fill(); } ctx.fillStyle = '#f7a21b'; ctx.fillRect(0, innerHeight * 0.55, innerWidth, innerHeight * 0.45); }
  // board
  ctx.fillStyle = '#7b4fb5'; ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(bx - 8, by - 8, cell * N + 16, cell * N + 16, 16); ctx.fill(); ctx.stroke();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx + c * cell, by + r * cell, cell, cell); }
  ctx.save(); ctx.beginPath(); ctx.rect(bx - 4, by - 4, cell * N + 8, cell * N + 8); ctx.clip();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const tl = grid[r]?.[c]; if (!tl) continue;
    const k = Math.min(1, dt * 14); tl.x += (c - tl.x) * k;
    const dy = r - tl.y; if (dy > 0.08) tl.fall = true; tl.y += dy * Math.min(1, dt * 11);
    if (tl.fall && dy < 0.03) { tl.fall = false; tl.land = 1; }   // landed: bounce
    tl.scale += (1 - tl.scale) * Math.min(1, dt * 8);
    const x = bx + (tl.x + 0.5) * cell, y = by + (tl.y + 0.5) * cell, s = cell * 0.86 * tl.scale;
    // alive: staggered breathing, swap squash, landing bounce, hint pulse
    let sx = 1 + Math.sin(T * 2.1 + tl.id * 1.7) * 0.025, sy = 1 + Math.sin(T * 2.1 + tl.id * 1.7 + 1.2) * 0.025;
    if (tl.sq) { const q = Math.sin((1 - tl.sq) * Math.PI) * 0.22; sx += q; sy -= q; tl.sq = Math.max(0, tl.sq - dt * 4.5); }
    if (tl.land) { const q = Math.sin((1 - tl.land) * Math.PI * 2) * tl.land * 0.2; sx += q; sy -= q; tl.land = Math.max(0, tl.land - dt * 3.5); }
    const hinted = hintPair && ((hintPair[0] === r && hintPair[1] === c) || (hintPair[2] === r && hintPair[3] === c));
    if (hinted) { const q = (Math.sin(T * 6) + 1) * 0.06; sx += q; sy += q; }
    ctx.save(); ctx.translate(x, y + s * (1 - sy) / 2); ctx.scale(sx, sy); ctx.translate(-x, -y);
    if (hinted) { ctx.strokeStyle = `rgba(255,246,199,${0.5 + Math.sin(T * 6) * 0.35})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4, s * 0.28); ctx.stroke(); }
    if (tl.sp === SP.color) {
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 16 + Math.sin(T * 6) * 6; fitImg(pinataImg, x, y, s * (1.05 + Math.sin(T * 5) * 0.05), Math.sin(T * 3) * 0.12); ctx.shadowBlur = 0; ctx.restore(); continue;
    }
    ctx.fillStyle = TILE_BG[tl.t]; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.26); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s * 0.3, s * 0.2); ctx.fill();
    if (tl.t === MARIGOLD) marigold(x, y, s * 0.95); else fitImg(IMG[tl.t], x, y, s * 0.82);
    if (tl.sp === SP.lineH || tl.sp === SP.lineV) {
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 12; fitImg(chanclaImg, x + s * 0.18, y + s * 0.2, s * 0.55, tl.sp === SP.lineH ? 0 : Math.PI / 2); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath();
      if (tl.sp === SP.lineH) { ctx.moveTo(x - s / 2 + 4, y - s * 0.32); ctx.lineTo(x + s / 2 - 4, y - s * 0.32); } else { ctx.moveTo(x - s * 0.32, y - s / 2 + 4); ctx.lineTo(x - s * 0.32, y + s / 2 - 4); }
      ctx.stroke();
    } else if (tl.sp === SP.bomb) { // round fuse bomb badge (drawn), distinct from the sugar skull tile
      const bxx = x + s * 0.22, byy = y + s * 0.22, br = s * (0.2 + Math.sin(T * 6) * 0.015);
      ctx.fillStyle = '#3b1a5c'; ctx.beginPath(); ctx.arc(bxx, byy, br, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(bxx - br * 0.35, byy - br * 0.35, br * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bxx + br * 0.5, byy - br * 0.8); ctx.quadraticCurveTo(bxx + br, byy - br * 1.5, bxx + br * 1.3, byy - br * 1.3); ctx.stroke();
      ctx.fillStyle = Math.sin(T * 20) > 0 ? '#ff5a36' : '#ffd23f'; ctx.beginPath(); ctx.arc(bxx + br * 1.3, byy - br * 1.3, br * 0.32, 0, Math.PI * 2); ctx.fill(); }
    if (tl.sp) { ctx.globalAlpha = 0.25 + Math.sin(T * 4 + tl.id) * 0.15; ctx.strokeStyle = tl.sp === SP.bomb ? '#ff4d6d' : '#ffd166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.26); ctx.stroke(); ctx.globalAlpha = 1; }
    if (tl.glare !== undefined) { // diagonal shimmer sweep
      const g = (performance.now() - tl.glare) / 650; if (g > 1) tl.glare = undefined; else if (g > 0) {
        ctx.save(); ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.26); ctx.clip();
        const gx = x - s + g * s * 2; const gr = ctx.createLinearGradient(gx - s * 0.3, y - s / 2, gx + s * 0.3, y + s / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - s / 2, y - s / 2, s, s); ctx.restore(); } }
    ctx.restore();
  }
  ctx.restore();
  for (let i = beams.length - 1; i >= 0; i--) { const b = beams[i]; b.life -= dt; if (b.life <= 0) { beams.splice(i, 1); continue; } ctx.globalAlpha = b.life / 0.35; ctx.fillStyle = '#fff6c7';
    if (b.r !== undefined) ctx.fillRect(bx, by + b.r * cell + cell * 0.3, cell * N, cell * 0.4); else ctx.fillRect(bx + b.c! * cell + cell * 0.3, by, cell * 0.4, cell * N); }
  ctx.globalAlpha = 1;
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.life -= dt * 1.6; if (p.life <= 0) { parts.splice(i, 1); continue; } ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
  const nowMs = performance.now();
  if (nowMs > nextGlare) { nextGlare = nowMs + 1500 + Math.random() * 1500; const n = 3 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const tt = grid[Math.floor(Math.random() * N)]?.[Math.floor(Math.random() * N)]; if (tt) tt.glare = nowMs + i * 90; } }
  if (playing && !busy && nowMs - lastAct > 5000) { if (!hintPair) hintPair = findMove(); } else hintPair = null;
  for (let i = sparks.length - 1; i >= 0; i--) { const sp = sparks[i]; sp.life -= dt; if (sp.life <= 0) { sparks.splice(i, 1); continue; } const a = Math.min(1, sp.life * 3), z = sp.s * (0.6 + Math.sin(sp.life * 12) * 0.4);
    ctx.globalAlpha = a; ctx.fillStyle = '#fff8d6'; ctx.beginPath(); ctx.moveTo(sp.x, sp.y - z); ctx.lineTo(sp.x + z * 0.25, sp.y - z * 0.25); ctx.lineTo(sp.x + z, sp.y); ctx.lineTo(sp.x + z * 0.25, sp.y + z * 0.25); ctx.lineTo(sp.x, sp.y + z); ctx.lineTo(sp.x - z * 0.25, sp.y + z * 0.25); ctx.lineTo(sp.x - z, sp.y); ctx.lineTo(sp.x - z * 0.25, sp.y - z * 0.25); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(cell * 0.45)}px system-ui`;
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.life -= dt; p.y -= dt * 30; if (p.life <= 0) { pops.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, p.life * 2); ctx.lineWidth = 5; ctx.strokeStyle = '#5a2a00'; ctx.strokeText(p.t, p.x, p.y); ctx.fillStyle = '#ffd166'; ctx.fillText(p.t, p.x, p.y); }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

autoUnlockAudio(); wireMute(); hud();
const go = $('go') as HTMLButtonElement; go.disabled = true; go.textContent = 'Loading…';
Promise.all([...TILE_SRC.slice(0, 4).map(loadImg), loadImg('/play/t_chancla.webp'), loadImg('/play/t_skull.webp'), loadImg('/play/t_pinata.webp'), loadImg('/play/night_bg.webp')]).then((a) => {
  IMG.push(...a.slice(0, 4)); [chanclaImg, skullImg, pinataImg, bgImg] = a.slice(4) as HTMLImageElement[];
  go.disabled = false; go.textContent = 'PLAY!'; newBoard(); requestAnimationFrame(frame);
});
const start = () => { wakeAudio(); markGameStart('match'); $('start').classList.add('hidden'); $('end').classList.add('hidden'); MOVES = LEVELS[level - 1].moves; GOAL = LEVELS[level - 1].goal; score = 0; moves = MOVES; hud(); newBoard(); playing = true; busy = false; };
go.onclick = start; $('again').onclick = start;
(window as any).__match = { grid, trySwap, findRuns, get state() { return { score, moves, playing, busy }; }, cellPos: (r: number, c: number) => ({ x: bx + (c + 0.5) * cell, y: by + (r + 0.5) * cell }) };
void skullImg; // kept loaded for future use
