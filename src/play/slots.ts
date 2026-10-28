import { markGameStart, markFirstAction, markBonus } from '../analytics';
import { $, loadImg, autoUnlockAudio, wakeAudio } from './common';
import * as A from './slotsAudio';
import { initAudioControls } from './music';

// ── Free-play only. Credits never buy or cash anything. ─────────────────────
const START_CREDITS = 3000;
const BETS = [1, 5, 10, 25, 50, 100];
const COLS = 5;
const ROWS = 4;
// Tuned for ~2% free-spin triggers and ~96% RTP (see sim). Index = scatter count.
const FREE_SPINS_ON_SCATTER = [0, 0, 0, 6, 9, 14];
const PAY: Record<string, number[]> = {
  // pay for 3 / 4 / 5 of a kind on a line (× bet / 10)
  abuela: [4.5, 16, 55],
  skull:  [3.5, 13, 45],
  lucha:  [3, 11, 36],
  chancla:[2, 7.5, 26],
  bottle: [1, 3.5, 13],
  pinata: [5.5, 20, 72],
};
const LINES: number[][] = [
  [0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2], [3,3,3,3,3],
  [0,1,2,3,3], [3,2,1,0,0],
  [0,0,1,2,3], [3,3,2,1,0],
  [1,2,3,2,1], [2,1,0,1,2],
  [0,1,2,1,0], [3,2,1,2,3],
];

type Sym = 'abuela' | 'skull' | 'lucha' | 'chancla' | 'bottle' | 'pinata';
const SYMS: Sym[] = ['abuela', 'skull', 'lucha', 'chancla', 'bottle', 'pinata'];
const WEIGHTS = [12, 14, 18, 24, 30, 3]; // pinata rarer on 5×4

type Mode = 'idle' | 'spinning' | 'resolve' | 'expand' | 'abuela' | 'pick' | 'bonus' | 'blast';

const imgs: Record<string, HTMLImageElement> = {};
const pinataVars = ['pinata_llama', 'pinata_rosa', 'pinata_azul', 'pinata_lima'];

let credits = START_CREDITS;
let startedOnce = false;
let betIdx = 2;
let lastWin = 0;
let freeSpins = 0;
let freeMult = 1;
let mode: Mode = 'idle';
let grid: Sym[][] = [];
let stopAt: number[] = [];
let spinT = 0;
let spinOffset: number[] = [];
let reelSyms: Sym[][] = [];
let reelsStopped = 0;
let flashLines: number[] = [];
let flashT = 0;
let petals: {x:number;y:number;vx:number;vy:number;r:number;a:number;c:string}[] = [];
let confetti: {x:number;y:number;vx:number;vy:number;w:number;h:number;rot:number;vr:number;c:string}[] = [];
let toast = '';
let toastT = 0;
let bigLlama: {x:number;y:number;s:number;life:number} | null = null;

// Chancla expand
let expandReel = -1;
let expandProg = 0;
let expandWilds: boolean[] = []; // per-col marked wild for eval

type Pinata = { x:number;y:number;s:number;vx:number;vy:number;kind:string;hp:number;shake:number;gone:boolean };
let bonusPins: Pinata[] = [];
let bonusMult = 1;
let bonusHits = 0;
let bonusTimer = 0;
let bonusTotal = 0;
let chanclaAngle = 0;
let pointer = { x: 0, y: 0, down: false };
let smashFx: {x:number;y:number;t:number;mult:number}[] = [];

// Pick-a-Piñata
type PickItem = { x:number;y:number;kind:string;revealed:boolean;value:number;label:string };
let pickItems: PickItem[] = [];
let pickPicksLeft = 3;
let pickTotal = 0;

// Abuela Chanclazo
let abuelaProg = 0;
let abuelaCells: {c:number;r:number}[] = [];

const canvas = $('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0, H = 0, dpr = 1;

function bet() { return BETS[betIdx]; }
function setHud() {
  $('credits').textContent = String(credits);
  $('bet').textContent = String(bet());
  const wp = $('winPill'); const fp = $('freePill');
  if (lastWin > 0) { wp.style.display = ''; $('win').textContent = String(lastWin); }
  else wp.style.display = 'none';
  if (mode === 'bonus' || mode === 'blast') {
    fp.style.display = ''; fp.querySelector('small')!.textContent = 'Bonus';
    $('free').textContent = `×${bonusMult}`;
  } else if (mode === 'pick') {
    fp.style.display = ''; fp.querySelector('small')!.textContent = 'Picks';
    $('free').textContent = String(pickPicksLeft);
  } else if (freeSpins > 0) {
    fp.style.display = ''; fp.querySelector('small')!.textContent = 'Free spins';
    $('free').textContent = `${freeSpins} ×${freeMult}`;
  } else fp.style.display = 'none';
  
}

function weighted(): Sym {
  let t = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * t;
  for (let i = 0; i < SYMS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return SYMS[i]; }
  return 'bottle';
}
function fillReel(n = 40): Sym[] { return Array.from({ length: n }, () => weighted()); }

function countScatters(g: Sym[][]) {
  let n = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r] === 'pinata') n++;
  return n;
}

function evalWin(g: Sym[][], wildCols: boolean[] = []): { payout: number; lines: number[]; scatters: number } {
  let payout = 0;
  const hit: number[] = [];
  const unit = bet() / 10;
  const at = (c: number, r: number): Sym => (wildCols[c] ? 'pinata' : g[c][r]);
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    const seq: Sym[] = line.map((row, col) => at(col, row));
    let base: Sym | null = null;
    for (const s of seq) { if (s !== 'pinata') { base = s; break; } }
    if (!base) base = 'pinata';
    let count = 0;
    for (const s of seq) {
      if (s === base || s === 'pinata') count++;
      else break;
    }
    if (count >= 3) {
      payout += PAY[base][count - 3] * unit;
      hit.push(li);
    }
  }
  const scatters = countScatters(g);
  if (scatters >= 3) payout += PAY.pinata[Math.min(2, scatters - 3)] * unit * 2;
  return { payout, lines: hit, scatters };
}

function spawnPetals(n: number, x?: number, y?: number) {
  const C = ['#ff9f1c', '#ff6b6b', '#ffd43b', '#f72585', '#c2255c'];
  for (let i = 0; i < n; i++) {
    petals.push({
      x: x ?? Math.random() * W, y: y ?? -10,
      vx: (Math.random() - .5) * 3, vy: 1 + Math.random() * 2.5,
      r: 3 + Math.random() * 5, a: Math.random() * 6, c: C[i % C.length],
    });
  }
}
function spawnConfetti(n: number, x: number, y: number) {
  const C = ['#ffd23f', '#ff6b6b', '#4cc9f0', '#7CFC00', '#f72585', '#fff'];
  for (let i = 0; i < n; i++) {
    confetti.push({
      x, y, vx: (Math.random() - .5) * 14, vy: -4 - Math.random() * 10,
      w: 4 + Math.random() * 6, h: 3 + Math.random() * 4,
      rot: Math.random() * 6, vr: (Math.random() - .5) * .4, c: C[i % C.length],
    });
  }
}

function startSpin(forceGrid?: Sym[][]) {
  if (mode !== 'idle') return;
  A.unlock(); wakeAudio();
  if (!startedOnce) { startedOnce = true; markGameStart('slots'); }
  markFirstAction('slots', 'spin');
  const cost = freeSpins > 0 ? 0 : bet();
  if (credits < cost) { toast = 'Out of free credits — tap + to top up'; toastT = 2; return; }
  if (freeSpins === 0) credits -= cost;
  else freeSpins--;
  lastWin = 0; flashLines = []; expandReel = -1; expandWilds = Array(COLS).fill(false);
  mode = 'spinning'; spinT = 0; reelsStopped = 0;
  stopAt = Array.from({ length: COLS }, (_, i) => 0.65 + i * 0.32 + Math.random() * 0.12);
  spinOffset = Array.from({ length: COLS }, () => 0);
  reelSyms = Array.from({ length: COLS }, () => fillReel(50));
  grid = forceGrid ?? Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => weighted()));
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) reelSyms[c][r] = grid[c][r];
  A.startSpinLoop();
  setHud();
}

function afterFeaturesThenPay() {
  const { payout, lines, scatters } = evalWin(grid, expandWilds);
  const inFree = freeMult > 1;
  const total = Math.round(payout * (inFree ? freeMult : 1));
  lastWin = total;
  credits += total;
  flashLines = lines;
  flashT = 1.8;
  if (total > 0) {
    spawnConfetti(Math.min(80, 20 + total / 5), W / 2, H * .4);
    spawnPetals(24);
    A.creditRoll(Math.min(12, 4 + Math.floor(total / bet())));
    if (total >= bet() * 25) { A.winBig(); toast = `BIG WIN ${total}!`; }
    else if (total >= bet() * 8) { A.winMedium(); toast = `+${total}`; }
    else { A.winSmall(); toast = `+${total}`; }
    toastT = 1.8;
  }
  // scatter dings already played during stop; award free spins
  const award = FREE_SPINS_ON_SCATTER[Math.min(scatters, 5)];
  if (award > 0) {
    freeSpins += award;
    freeMult = freeMult <= 1 ? 2 : Math.min(5, freeMult + 1);
    toast = `${award} FREE SPINS · ×${freeMult}`;
    toastT = 2.4;
    A.freeSpinsFanfare();
    spawnConfetti(80, W / 2, H * .35);
  }
  setHud();
  mode = 'resolve';

  const wantPick = scatters === 2 && Math.random() < 0.32;
  const wantSmash = scatters >= 4 || (scatters === 3 && Math.random() < 0.26) || (freeSpins > 0 && scatters >= 1 && Math.random() < 0.18);

  setTimeout(() => {
    if (wantPick) enterPick();
    else if (wantSmash) enterBonus();
    else finishToIdle();
  }, total > 0 ? 1300 : 450);
}

function finishToIdle() {
  mode = 'idle';
  if (freeSpins > 0) setTimeout(() => startSpin(), 550);
  else {
    freeMult = 1;
    if (credits <= 0) { credits = START_CREDITS; toast = 'Free credits refilled'; toastT = 2; }
    setHud();
  }
}

function maybeStartFeatures() {
  // Abuela's Chanclazo ~1.8%
  if (Math.random() < 0.015) { startAbuela(); return; }
  // Chancla expand: reel with a chancla expands as wild (~7% if any chancla)
  const candidates: number[] = [];
  for (let c = 0; c < COLS; c++) if (grid[c].some(s => s === 'chancla')) candidates.push(c);
  if (candidates.length && Math.random() < 0.065) {
    startExpand(candidates[Math.floor(Math.random() * candidates.length)]);
    return;
  }
  afterFeaturesThenPay();
}

function startExpand(col: number) {
  markBonus('slots', 'chancla_wild');
  mode = 'expand';
  expandReel = col;
  expandProg = 0;
  expandWilds = Array(COLS).fill(false);
  expandWilds[col] = true;
  toast = 'CHANCLA WILD!';
  toastT = 1.6;
  A.expandWhoosh();
  // fill reel visually with chancla; treat as wild in eval
  for (let r = 0; r < ROWS; r++) grid[col][r] = 'chancla';
}

function startAbuela() {
  markBonus('slots', 'abuela_chanclazo');
  mode = 'abuela';
  abuelaProg = 0;
  abuelaCells = [];
  const n = 5 + Math.floor(Math.random() * 4);
  const used = new Set<string>();
  while (abuelaCells.length < n) {
    const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
    const k = c + ',' + r;
    if (used.has(k)) continue;
    used.add(k); abuelaCells.push({ c, r });
  }
  toast = "ABUELA'S CHANCLAZO!";
  toastT = 1.8;
  A.abuelaStomp();
}

function enterPick() {
  markBonus('slots', 'pick_pinata');
  mode = 'pick';
  pickPicksLeft = 3;
  pickTotal = 0;
  pickItems = [];
  A.pickFanfare();
  toast = 'PICK A PIÑATA!';
  toastT = 2;
  const prizes = [
    { value: bet() * 2, label: `${bet() * 2}` },
    { value: bet() * 3, label: `${bet() * 3}` },
    { value: bet() * 5, label: `${bet() * 5}` },
    { value: bet() * 8, label: `${bet() * 8}` },
    { value: bet() * 12, label: `${bet() * 12}` },
    { value: 0, label: '×2' }, // multiplier on pick total applied at end specially
  ];
  // shuffle
  for (let i = prizes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [prizes[i], prizes[j]] = [prizes[j], prizes[i]]; }
  const cols = 3, rows = 2;
  for (let i = 0; i < 6; i++) {
    const cx = ((i % cols) + 0.5) / cols;
    const cy = (Math.floor(i / cols) + 0.55) / rows;
    const p = prizes[i];
    pickItems.push({
      x: W * (0.12 + cx * 0.76), y: H * (0.28 + cy * 0.42),
      kind: pinataVars[i % pinataVars.length],
      revealed: false,
      value: p.value,
      label: p.label,
    });
  }
  // encode ×2 as value:-1
  for (const it of pickItems) if (it.label === '×2') it.value = -1;
  setHud();
}

function pickAt(x: number, y: number) {
  if (mode !== 'pick' || pickPicksLeft <= 0) return;
  let best: PickItem | null = null; let bestD = 1e9;
  for (const it of pickItems) {
    if (it.revealed) continue;
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < 70 && d < bestD) { best = it; bestD = d; }
  }
  if (!best) return;
  best.revealed = true;
  pickPicksLeft--;
  A.pickReveal(); A.pinataPop();
  spawnConfetti(20, best.x, best.y);
  if (best.value < 0) {
    pickTotal = Math.max(pickTotal, bet()) * 2;
    toast = 'Multiplier ×2!';
  } else {
    pickTotal += best.value;
    toast = `+${best.value}`;
  }
  toastT = 1.2;
  setHud();
  if (pickPicksLeft <= 0) {
    setTimeout(() => {
      credits += pickTotal;
      lastWin = pickTotal;
      A.creditRoll(10); A.winMedium();
      toast = `Pick bonus +${pickTotal}`;
      toastT = 2;
      setHud();
      const sc = countScatters(grid);
      if (sc >= 4 || (sc === 3 && Math.random() < 0.26)) enterBonus();
      else finishToIdle();
    }, 700);
  }
}

function enterBonus() {
  markBonus('slots', 'pinata_smash');
  mode = 'bonus';
  bonusMult = 1; bonusHits = 0; bonusTotal = 0; bonusTimer = 12; smashFx = [];
  A.smashFanfare();
  bonusPins = [];
  const n = 7 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    bonusPins.push({
      x: W * (0.15 + Math.random() * 0.7), y: H * (0.25 + Math.random() * 0.45),
      s: 70 + Math.random() * 50, vx: (Math.random() - .5) * 1.2, vy: (Math.random() - .5) * .8,
      kind: pinataVars[i % pinataVars.length], hp: 1, shake: 0, gone: false,
    });
  }
  bonusPins.push({ x: W / 2, y: H * 0.42, s: 140, vx: 0, vy: 0, kind: 'pinata_llama', hp: 3, shake: 0, gone: false });
  toast = 'SMASH THE PIÑATAS!'; toastT = 2; setHud();
}

function smashAt(x: number, y: number) {
  if (mode !== 'bonus') return;
  chanclaAngle = -1.2;
  A.chanclaWhack();
  let best: Pinata | null = null; let bestD = 1e9;
  for (const p of bonusPins) {
    if (p.gone) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < p.s * 0.55 && d < bestD) { best = p; bestD = d; }
  }
  if (!best) { spawnPetals(4, x, y); return; }
  best.hp--; best.shake = 1;
  A.pinataPop();
  spawnConfetti(18, best.x, best.y); spawnPetals(10, best.x, best.y);
  bonusHits++;
  bonusMult = Math.min(20, Math.round((bonusMult + (best.kind === 'pinata_llama' ? 1 : 0.5)) * 2) / 2);
  const add = Math.round(bet() * (best.hp <= 0 ? 2 : 1) * bonusMult);
  bonusTotal += add;
  smashFx.push({ x: best.x, y: best.y - best.s * 0.4, t: 1, mult: bonusMult });
  if (best.hp <= 0) {
    best.gone = true;
    if (best.s >= 130) { startBlast(best.x, best.y); return; }
  }
  setHud();
}

function startBlast(x: number, y: number) {
  mode = 'blast';
  bigLlama = { x, y, s: 1, life: 1.8 };
  A.llamaBoom();
  spawnConfetti(160, x, y); spawnPetals(80, x, y);
  for (const p of bonusPins) if (!p.gone) { p.gone = true; spawnConfetti(20, p.x, p.y); }
  bonusTotal += Math.round(bet() * 15 * bonusMult);
  toast = `LLAMA BLAST ×${bonusMult}!`; toastT = 2.2;
  setTimeout(endBonus, 1800);
}

function endBonus() {
  credits += bonusTotal; lastWin = bonusTotal;
  toast = bonusTotal > 0 ? `Bonus +${bonusTotal}` : 'Bonus over'; toastT = 2;
  mode = 'idle'; setHud();
  if (freeSpins > 0) setTimeout(() => startSpin(), 700);
}

function fit() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit);

function machineBox() {
  const top = 50;
  const bot = 18;
  const pad = 6;
  const availW = W - pad * 2;
  const availH = H - top - bot;
  let mw: number, mh: number;
  if (W > H) { mh = availH; mw = Math.min(availW, mh * 1.18); mh = Math.min(mh, mw / 1.0); }
  else { mw = availW; mh = Math.min(availH, mw * 1.45); }
  return { x: (W - mw) / 2, y: top + (availH - mh) / 2, w: mw, h: mh };
}

function cellGeom(box: {x:number;y:number;w:number;h:number}) {
  const nicheH = box.h * 0.17;          // character heads in arched niches
  const plaqueH = Math.max(18, box.h * 0.065);
  const titleH = nicheH + plaqueH;
  const btnH = Math.max(52, box.h * 0.14); // control bar
  const pad = box.w * 0.075;            // carved frame + garlands
  const reelGap = box.w * 0.008;
  const areaH = box.h - titleH - btnH - box.h * 0.02;
  const rw = (box.w - pad * 2 - reelGap * (COLS - 1)) / COLS;
  const rh = areaH / ROWS;
  const ox = box.x + pad;
  const oy = box.y + titleH;
  return { pad, reelGap, rw, rh, ox, oy, titleH, btnH, nicheH, plaqueH };
}

// Control hit areas, refreshed every frame by drawControls.
const ctrl = { up: [0, 0, 0, 0], down: [0, 0, 0, 0], spin: [0, 0, 0] };

function marigold(x: number, y: number, r: number) {
  ctx.fillStyle = '#e8590c';
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f7a21b'; ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fill();
}

const NICHES: [string, string][] = [['abuela', 'CHANCLAZO'], ['lucha', 'CHANCLA WILD'], ['calaca', 'PIÑATA SMASH']];

// Lit face sprite (cached per size): rim highlight + radial light/shade, composited onto the face's own alpha.
const faceCache = new Map<string, HTMLCanvasElement>();
function litFace(im: HTMLImageElement, w: number, h: number) {
  const k = `${im.src}|${Math.round(w)}|${Math.round(h)}`; let c = faceCache.get(k); if (c) return c;
  const pad = 6; c = document.createElement('canvas'); c.width = Math.round(w + pad * 2); c.height = Math.round(h + pad * 2);
  const x = c.getContext('2d')!;
  // rim: warm silhouette offset up-left
  const sil = document.createElement('canvas'); sil.width = c.width; sil.height = c.height; const sx = sil.getContext('2d')!;
  sx.drawImage(im, pad, pad, w, h); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#fff1b8'; sx.fillRect(0, 0, sil.width, sil.height);
  if (im.src.includes('abuela')) { // black outline only (no light rim) for the abuela
    sx.fillStyle = '#000'; sx.fillRect(0, 0, sil.width, sil.height);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) x.drawImage(sil, dx, dy);
  } else x.drawImage(sil, -2.5, -2.5);
  x.drawImage(im, pad, pad, w, h);
  x.globalCompositeOperation = 'source-atop';
  const lg = x.createRadialGradient(pad + w * 0.32, pad + h * 0.25, 2, pad + w * 0.5, pad + h * 0.55, Math.max(w, h) * 0.75);
  lg.addColorStop(0, 'rgba(255,255,255,.38)'); lg.addColorStop(0.45, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(60,20,90,.38)');
  x.fillStyle = lg; x.fillRect(0, 0, c.width, c.height);
  faceCache.set(k, c); return c;
}
function draw3DFace(im: HTMLImageElement, cx: number, cy: number, w: number, h: number, i: number) {
  const t = performance.now() / 1000 + i * 1.3;
  const c = litFace(im, w, h);
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 1.6) * 2);
  ctx.rotate(Math.sin(t * 1.1) * 0.04);
  ctx.scale(0.95 + 0.05 * Math.cos(t * 0.9), 1); // subtle yaw (perspective turn)
  ctx.shadowColor = 'rgba(58,20,80,.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  ctx.restore();
}

function drawCabinet(box: {x:number;y:number;w:number;h:number}, g: ReturnType<typeof cellGeom>) {
  const STONE = '#7b4fb5', STONE_D = '#5a3590', STONE_L = '#9d74d6';
  const frameTop = box.y + g.nicheH;
  const frameBot = box.y + box.h - g.btnH * 0.55;
  // niches (arched) with heads
  const nw = box.w * 0.27, gap = (box.w - nw * 3) / 4;
  for (let i = 0; i < 3; i++) {
    const nx = box.x + gap + i * (nw + gap), ny = box.y;
    ctx.fillStyle = STONE_D;
    ctx.beginPath(); ctx.moveTo(nx, frameTop + 2); ctx.lineTo(nx, ny + nw * 0.5); ctx.arc(nx + nw / 2, ny + nw * 0.5, nw / 2, Math.PI, 0); ctx.lineTo(nx + nw, frameTop + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = STONE;
    const iw = nw * 0.8, ix = nx + (nw - iw) / 2;
    ctx.beginPath(); ctx.moveTo(ix, frameTop + 2); ctx.lineTo(ix, ny + nw * 0.5); ctx.arc(ix + iw / 2, ny + nw * 0.5, iw / 2, Math.PI, 0); ctx.lineTo(ix + iw, frameTop + 2); ctx.closePath(); ctx.fill();
    const im = imgs[NICHES[i][0] + '_face'];
    if (im && im.complete && im.width) {
      // 3D medallion backing inside the arch
      const mr = iw * 0.46, mx = nx + nw / 2, my = frameTop - g.nicheH * 0.46;
      const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.35, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#d9b8ff'); mg.addColorStop(0.6, '#8a5cc8'); mg.addColorStop(1, '#4a2a78');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, mr * 0.06); ctx.stroke();
      // Same visible head height in every niche, centered in the arch, capped by arch width.
      let h2 = Math.min(g.nicheH * 0.9, nw * 0.62 * 1.15), hw = im.width * (h2 / im.height);
      if (hw > iw * 0.92) { hw = iw * 0.92; h2 = im.height * (hw / im.width); }
      draw3DFace(im, nx + nw / 2, frameTop - h2 / 2 + 2, hw, h2, i);
    }
  }
  // carved frame body
  ctx.fillStyle = STONE_D; roundRect(box.x, frameTop, box.w, frameBot - frameTop, 14); ctx.fill();
  ctx.fillStyle = STONE; roundRect(box.x + 5, frameTop + 5, box.w - 10, frameBot - frameTop - 10, 11); ctx.fill();
  // stone block lines on the side pillars
  ctx.strokeStyle = STONE_D; ctx.lineWidth = 2;
  const pw = g.pad - 6;
  for (let yy = frameTop + g.plaqueH + 8; yy < frameBot - 10; yy += Math.max(18, pw * 0.9)) {
    ctx.beginPath(); ctx.moveTo(box.x + 6, yy); ctx.lineTo(box.x + pw, yy); ctx.moveTo(box.x + box.w - pw, yy); ctx.lineTo(box.x + box.w - 6, yy); ctx.stroke();
  }
  ctx.fillStyle = STONE_L; ctx.fillRect(box.x + 8, frameTop + 7, box.w - 16, 3);
  // plaques
  for (let i = 0; i < 3; i++) {
    const nx = box.x + gap + i * (nw + gap);
    const px = nx - nw * 0.04, pwid = nw * 1.08, py = frameTop + g.plaqueH * 0.12, ph = g.plaqueH * 0.8;
    ctx.fillStyle = STONE_D; roundRect(px, py, pwid, ph, 6); ctx.fill();
    ctx.strokeStyle = STONE_L; ctx.lineWidth = 2; roundRect(px + 3, py + 3, pwid - 6, ph - 6, 4); ctx.stroke();
    ctx.fillStyle = '#ffe9c2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = ph * 0.5; ctx.font = `900 ${fs}px system-ui`;
    while (ctx.measureText(NICHES[i][1]).width > pwid * 0.86 && fs > 7) { fs -= 0.5; ctx.font = `900 ${fs}px system-ui`; }
    ctx.fillText(NICHES[i][1], px + pwid / 2, py + ph / 2 + 1);
  }
  // marigold garlands down both sides
  const gr = Math.max(5, g.pad * 0.2);
  for (let yy = frameTop + g.plaqueH + gr * 2; yy < frameBot - gr * 1.5; yy += gr * 2.1) {
    marigold(box.x + g.pad * 0.48, yy, gr); marigold(box.x + box.w - g.pad * 0.48, yy, gr);
  }
}

function drawControls(box: {x:number;y:number;w:number;h:number}, g: ReturnType<typeof cellGeom>) {
  const by = box.y + box.h - g.btnH * 0.82, bh = g.btnH * 0.72;
  ctx.fillStyle = '#3b1a5c'; roundRect(box.x + 4, by, box.w - 8, bh, 12); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; roundRect(box.x + 4, by, box.w - 8, bh, 12); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const sm = Math.max(9, bh * 0.2), big = Math.max(14, bh * 0.36);
  ctx.fillStyle = '#ffd23f'; ctx.font = `800 ${sm}px system-ui`;
  ctx.fillText('FREE-PLAY BALANCE', box.x + 16, by + bh * 0.38);
  ctx.fillStyle = '#fff'; ctx.font = `900 ${big}px system-ui`;
  ctx.fillText(credits.toLocaleString('en-US'), box.x + 16, by + bh * 0.8);
  // spin button (big round, right)
  const r = Math.min(g.btnH * 0.62, box.w * 0.11);
  const sx = box.x + box.w - 12 - r, sy = by + bh / 2;
  // bet block
  const aw = Math.max(26, r * 0.62);
  const ax = sx - r - 10 - aw;
  const bx = ax - 8 - Math.max(64, box.w * 0.14);
  ctx.fillStyle = '#ffd23f'; ctx.font = `800 ${sm}px system-ui`; ctx.fillText('BET', bx, by + bh * 0.38);
  ctx.fillStyle = '#fff'; ctx.font = `900 ${big}px system-ui`; ctx.fillText(String(bet()), bx, by + bh * 0.8);
  const ah = bh / 2 - 4;
  ctrl.up = [ax, by + 3, aw, ah]; ctrl.down = [ax, by + bh / 2 + 1, aw, ah];
  const canBet = mode === 'idle' && freeSpins === 0;
  for (const [k, up] of [['up', true], ['down', false]] as const) {
    const [x, y, w, h] = ctrl[k];
    ctx.fillStyle = '#5a2d86'; roundRect(x, y, w, h, 6); ctx.fill();
    ctx.fillStyle = canBet ? '#fff' : 'rgba(255,255,255,.4)'; ctx.beginPath();
    const cx = x + w / 2, cy = y + h / 2, t = Math.min(w, h) * 0.28;
    if (up) { ctx.moveTo(cx - t, cy + t * 0.6); ctx.lineTo(cx + t, cy + t * 0.6); ctx.lineTo(cx, cy - t * 0.7); }
    else { ctx.moveTo(cx - t, cy - t * 0.6); ctx.lineTo(cx + t, cy - t * 0.6); ctx.lineTo(cx, cy + t * 0.7); }
    ctx.closePath(); ctx.fill();
  }
  ctrl.spin = [sx, sy, r];
  ctx.fillStyle = '#5a2a00'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = mode === 'idle' ? '#ffd23f' : '#f7a21b'; ctx.beginPath(); ctx.arc(sx, sy, r * 0.86, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = Math.max(3, r * 0.1);
  ctx.beginPath(); ctx.arc(sx, sy, r * 0.58, -Math.PI * 0.35, Math.PI * 1.35); ctx.stroke();
  const ea = -Math.PI * 0.35, ex = sx + Math.cos(ea) * r * 0.58, ey = sy + Math.sin(ea) * r * 0.58;
  ctx.fillStyle = '#5a2a00'; ctx.beginPath(); ctx.moveTo(ex - r * 0.2, ey - r * 0.12); ctx.lineTo(ex + r * 0.16, ey - r * 0.2); ctx.lineTo(ex + r * 0.06, ey + r * 0.2); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${Math.max(10, r * 0.3)}px system-ui`;
  ctx.fillText(freeSpins > 0 ? `FREE ${freeSpins}` : 'SPIN', sx, sy + 1);
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Solid Día de Muertos folk-art tile colors, one per symbol (no gradients).
const TILE: Record<string, string> = {
  abuela: '#f7a21b',  // marigold
  skull: '#e2197a',   // magenta
  lucha: '#18b5b0',   // turquoise
  chancla: '#8cc63f', // lime
  bottle: '#7b3fbf',  // violet
  pinata: '#ff5a36',  // chile red-orange
};

function drawSym(sym: Sym, x: number, y: number, s: number, wildGlow = false) {
  const im = imgs[sym === 'pinata' ? 'pinata' : sym];
  ctx.save();
  const r = s * 0.12;
  ctx.fillStyle = TILE[sym] || '#f7a21b';
  roundRect(x - s / 2, y - s / 2, s, s, r); ctx.fill();
  ctx.strokeStyle = 'rgba(26,10,46,.55)'; ctx.lineWidth = Math.max(1.5, s * 0.03);
  roundRect(x - s / 2, y - s / 2, s, s, r); ctx.stroke();
  if (wildGlow) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; roundRect(x - s / 2, y - s / 2, s, s, r); ctx.stroke(); }
  if (im && im.complete) {
    const max = s * 0.86;
    const sc = Math.min(max / im.width, max / im.height);
    const iw = im.width * sc, ih = im.height * sc;
    ctx.drawImage(im, x - iw / 2, y - ih / 2, iw, ih);
  }
  ctx.restore();
}

function drawMachine(dt: number) {
  const box = machineBox();
  const g = cellGeom(box);
  ctx.save();
  drawCabinet(box, g);

  const winY = g.oy;
  const winH = g.rh * ROWS;
  ctx.save();
  roundRect(g.ox - 3, winY - 3, COLS * g.rw + (COLS - 1) * g.reelGap + 6, winH + 6, 8);
  ctx.clip();
  ctx.fillStyle = '#3d1760';
  ctx.fillRect(g.ox - 3, winY - 3, COLS * g.rw + (COLS - 1) * g.reelGap + 6, winH + 6);

  for (let c = 0; c < COLS; c++) {
    const cx = g.ox + c * (g.rw + g.reelGap);
    const spinning = mode === 'spinning' && spinT < stopAt[c];
    if (spinning) {
      spinOffset[c] += (26 + c * 3) * dt * g.rh;
      const cell = g.rh;
      const off = spinOffset[c] % cell;
      for (let k = -1; k <= ROWS; k++) {
        const idx = ((Math.floor(spinOffset[c] / cell) + k) % reelSyms[c].length + reelSyms[c].length) % reelSyms[c].length;
        drawSym(reelSyms[c][idx], cx + g.rw / 2, winY + (k + 0.5) * cell - off, Math.min(g.rw, g.rh) * 0.9);
      }
    } else {
      for (let r = 0; r < ROWS; r++) {
        const wild = expandWilds[c] || (mode === 'expand' && c === expandReel && r <= expandProg * ROWS);
        drawSym(grid[c][r], cx + g.rw / 2, winY + (r + 0.5) * g.rh, Math.min(g.rw, g.rh) * 0.9, wild);
      }
    }
    ctx.strokeStyle = '#7b4fb5'; ctx.lineWidth = 1.5;
    ctx.strokeRect(cx, winY, g.rw, winH);
  }
  ctx.restore();

  if (flashT > 0 && flashLines.length) {
    flashT -= dt;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(flashT * 20);
    ctx.strokeStyle = '#7CFC00'; ctx.lineWidth = 3;
    for (const li of flashLines) {
      const line = LINES[li];
      ctx.beginPath();
      for (let c = 0; c < COLS; c++) {
        const cx = g.ox + c * (g.rw + g.reelGap) + g.rw / 2;
        const cy = winY + (line[c] + 0.5) * g.rh;
        if (c === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawControls(box, g);
  ctx.restore();
  return { box, g };
}

function hitControls(x: number, y: number) {
  const inR = (r: number[]) => x >= r[0] - 4 && x <= r[0] + r[2] + 4 && y >= r[1] - 2 && y <= r[1] + r[3] + 2;
  if (inR(ctrl.down)) { if (mode === 'idle' && freeSpins === 0 && betIdx > 0) { betIdx--; setHud(); } return; }
  if (inR(ctrl.up)) { if (mode === 'idle' && freeSpins === 0 && betIdx < BETS.length - 1) { betIdx++; setHud(); } return; }
  const [sx, sy, r] = ctrl.spin;
  if (Math.hypot(x - sx, y - sy) <= r * 1.1 && mode === 'idle') startSpin();
}

function drawBonus(dt: number) {
  ctx.fillStyle = 'rgba(122,31,79,.6)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 ${Math.max(20, W * 0.055)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('PIÑATA SMASH', W / 2, 68);
  ctx.font = `${Math.max(13, W * 0.032)}px system-ui`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`Multiplier ×${bonusMult} · ${Math.ceil(bonusTimer)}s · tap to smash`, W / 2, 94);
  for (const p of bonusPins) {
    if (p.gone) continue;
    p.x += p.vx; p.y += p.vy;
    if (p.x < p.s * .4 || p.x > W - p.s * .4) p.vx *= -1;
    if (p.y < 120 || p.y > H - 80) p.vy *= -1;
    if (p.shake > 0) p.shake -= dt * 4;
    const im = imgs[p.kind] || imgs.pinata;
    const shakeX = p.shake > 0 ? Math.sin(p.shake * 40) * 8 : 0;
    if (im && im.complete) {
      const sc = p.s / Math.max(im.width, im.height);
      const iw = im.width * sc, ih = im.height * sc;
      ctx.save(); ctx.translate(p.x + shakeX, p.y); ctx.rotate(Math.sin(performance.now() / 400 + p.x) * 0.08);
      ctx.drawImage(im, -iw / 2, -ih / 2, iw, ih); ctx.restore();
    }
  }
  for (const f of smashFx) {
    f.t -= dt; f.y -= 40 * dt;
    ctx.globalAlpha = Math.max(0, f.t);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `900 ${24 + (1 - f.t) * 10}px system-ui`;
    ctx.textAlign = 'center'; ctx.fillText(`×${f.mult}`, f.x, f.y); ctx.globalAlpha = 1;
  }
  smashFx = smashFx.filter(f => f.t > 0);
  const cim = imgs.chancla;
  if (cim && cim.complete) {
    ctx.save(); ctx.translate(pointer.x, pointer.y); ctx.rotate(chanclaAngle);
    ctx.drawImage(cim, -32, -32, 64, 64); ctx.restore();
  }
  if (chanclaAngle < 0) chanclaAngle = Math.min(0, chanclaAngle + dt * 4);
  bonusTimer -= dt;
  if (bonusTimer <= 0 && mode === 'bonus') {
    const big = bonusPins.find(p => p.s >= 130 && !p.gone);
    if (big) startBlast(big.x, big.y);
    else { for (const p of bonusPins) if (!p.gone) { p.gone = true; spawnConfetti(10, p.x, p.y); } endBonus(); }
  }
}

function drawBlast(dt: number) {
  if (!bigLlama) return;
  bigLlama.life -= dt; bigLlama.s += dt * 2.5;
  const im = imgs.pinata_llama || imgs.pinata;
  ctx.save(); ctx.translate(bigLlama.x, bigLlama.y); ctx.rotate(bigLlama.life * 8);
  ctx.globalAlpha = Math.max(0, bigLlama.life / 1.8);
  if (im && im.complete) { const s = 160 * bigLlama.s; ctx.drawImage(im, -s / 2, -s / 2, s, s); }
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 80 * bigLlama.s, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(0, 0, 120 * bigLlama.s, 0, 7); ctx.stroke();
  ctx.restore();
}

function drawPick() {
  ctx.fillStyle = 'rgba(122,31,79,.75)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 ${Math.max(20, W * 0.055)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('PICK A PIÑATA', W / 2, 68);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.max(13, W * 0.032)}px system-ui`;
  ctx.fillText(`${pickPicksLeft} picks left · total ${pickTotal}`, W / 2, 94);
  for (const it of pickItems) {
    const im = imgs[it.kind] || imgs.pinata;
    if (im && im.complete && !it.revealed) {
      const s = Math.min(100, W * 0.22);
      ctx.drawImage(im, it.x - s / 2, it.y - s / 2, s, s);
    } else if (it.revealed) {
      ctx.fillStyle = '#7a1f4f';
      roundRect(it.x - 48, it.y - 28, 96, 56, 12); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = '900 22px system-ui';
      ctx.fillText(it.label, it.x, it.y + 6);
    }
  }
}

function drawExpand(dt: number) {
  drawMachine(0);
  expandProg = Math.min(1, expandProg + dt * 1.8);
  if (expandProg >= 1) {
    // hold a beat then pay
    expandProg = 1;
    if (!(drawExpand as any)._done) {
      (drawExpand as any)._done = true;
      setTimeout(() => { (drawExpand as any)._done = false; afterFeaturesThenPay(); }, 500);
    }
  }
}

function drawAbuela(dt: number) {
  drawMachine(0);
  abuelaProg += dt;
  const n = Math.min(abuelaCells.length, Math.floor(abuelaProg * 8));
  for (let i = 0; i < n; i++) {
    const { c, r } = abuelaCells[i];
    if (grid[c][r] !== 'abuela') {
      grid[c][r] = 'abuela';
      const box = machineBox(); const g = cellGeom(box);
      spawnConfetti(8, g.ox + c * (g.rw + g.reelGap) + g.rw / 2, g.oy + (r + 0.5) * g.rh);
    }
  }
  if (n >= abuelaCells.length && abuelaProg > abuelaCells.length / 8 + 0.4) {
    afterFeaturesThenPay();
  }
}

function drawFx(dt: number) {
  for (const p of petals) {
    p.y += p.vy; p.x += p.vx + Math.sin(p.a) * .4; p.a += .05;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.fillStyle = p.c; ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  petals = petals.filter(p => p.y < H + 20);
  for (const c of confetti) {
    c.vy += 18 * dt; c.x += c.vx * dt * 60; c.y += c.vy * dt * 60; c.rot += c.vr;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
  }
  confetti = confetti.filter(c => c.y < H + 40);
  if (toastT > 0) {
    toastT -= dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, toastT * 2);
    ctx.font = `900 ${Math.max(16, W * 0.045)}px system-ui`;
    const m = ctx.measureText(toast);
    const bw = m.width + 36, bh = 42;
    ctx.fillStyle = '#5a2a00';
    roundRect(W / 2 - bw / 2, H * 0.16, bw, bh, 12); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(toast, W / 2, H * 0.16 + bh / 2);
    ctx.restore();
  }
}

function drawBg() {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ffc15e'); sky.addColorStop(0.35, '#ff8a5c'); sky.addColorStop(0.7, '#e2497a'); sky.addColorStop(1, '#8e44c9');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.arc(W * 0.85, H * 0.12, Math.min(W, H) * 0.07, 0, Math.PI * 2); ctx.fill();
  // warm buildings
  const cols = ['#f4a261', '#e76f51', '#ffcf56', '#f28482', '#2ec4b6', '#f7a21b'];
  const bw = Math.max(70, W / 9);
  for (let i = 0, x = -10; x < W; i++, x += bw) {
    const h = H * (0.38 + ((i * 37) % 5) * 0.05), y = H - h;
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x, y, bw + 1, h);
    ctx.fillStyle = '#b5523b'; ctx.fillRect(x - 3, y - 8, bw + 7, 10);
    ctx.fillStyle = '#ffe9c2';
    for (let wy = y + 22; wy < H - 50; wy += 46) for (let wx = x + bw * 0.18; wx < x + bw - 20; wx += bw * 0.42) ctx.fillRect(wx, wy, bw * 0.22, 24);
  }
  ctx.fillStyle = '#e9c46a'; ctx.fillRect(0, H - 40, W, 40);
  // papel picado bunting
  const flags = ['#e2197a', '#18b5b0', '#8cc63f', '#f7a21b', '#7b3fbf', '#ff5a36'];
  for (const [yy, amp] of [[H * 0.02, 18], [H * 0.09, 26]] as const) {
    const fw = Math.max(26, W / 22);
    ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = 0; x <= W; x += 8) { const y = yy + Math.sin((x / W) * Math.PI) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let k = 0, x = 4; x < W; k++, x += fw + 4) {
      const y = yy + Math.sin(((x + fw / 2) / W) * Math.PI) * amp;
      ctx.fillStyle = flags[(k + (yy > H * 0.05 ? 3 : 0)) % flags.length];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + fw, y); ctx.lineTo(x + fw, y + fw * 0.9); ctx.lineTo(x + fw / 2, y + fw * 1.15); ctx.lineTo(x, y + fw * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffc15e'; ctx.beginPath(); ctx.arc(x + fw / 2, y + fw * 0.45, fw * 0.14, 0, Math.PI * 2); ctx.fill();
    }
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  drawBg();

  if (mode === 'spinning') {
    spinT += dt;
    let allStopped = true;
    for (let c = 0; c < COLS; c++) {
      if (spinT < stopAt[c]) allStopped = false;
      else if (c >= reelsStopped) {
        while (reelsStopped <= c) {
          A.reelStop(reelsStopped);
          if (grid[reelsStopped].some(s => s === 'pinata')) {
            let sc = 0;
            for (let i = 0; i <= reelsStopped; i++) for (const s of grid[i]) if (s === 'pinata') sc++;
            A.scatterDing(sc);
          }
          reelsStopped++;
        }
      }
    }
    // simpler scatter ding: count pinatas on stopped reels
    drawMachine(dt);
    if (allStopped) {
      A.stopSpinLoop();
      // ding for total scatters
      const sc = countScatters(grid);
      if (sc > 0) A.scatterDing(sc);
      maybeStartFeatures();
    }
  } else if (mode === 'expand') {
    drawExpand(dt);
  } else if (mode === 'abuela') {
    drawAbuela(dt);
  } else if (mode === 'pick') {
    drawPick();
  } else if (mode === 'bonus') {
    drawBonus(dt);
  } else if (mode === 'blast') {
    drawBlast(dt);
  } else {
    drawMachine(dt);
  }
  drawFx(dt);
  requestAnimationFrame(frame);
}

function onPtr(e: PointerEvent, down: boolean) {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.down = down;
  if (down) {
    A.unlock(); wakeAudio();
    if (mode === 'bonus') smashAt(pointer.x, pointer.y);
    else if (mode === 'pick') pickAt(pointer.x, pointer.y);
    else if (mode === 'idle' || mode === 'resolve') hitControls(pointer.x, pointer.y);
  }
}
canvas.addEventListener('pointerdown', e => { e.preventDefault(); onPtr(e, true); }, { passive: false });
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX - canvas.getBoundingClientRect().left;
  pointer.y = e.clientY - canvas.getBoundingClientRect().top;
});
canvas.addEventListener('pointerup', e => onPtr(e, false));

(window as any).__slots = {
  setBet: (v: number) => { const i = BETS.indexOf(v); if (i >= 0) { betIdx = i; setHud(); } },
  spin: () => startSpin(),
  forceBonus: () => { if (mode === 'idle') enterBonus(); },
  forcePick: () => { if (mode === 'idle') enterPick(); },
  forceExpand: () => { if (mode === 'idle') { grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => 'bottle' as Sym)); grid[2][1] = 'chancla'; startExpand(2); } },
  forceAbuela: () => { if (mode === 'idle') startAbuela(); },
  forceMulti: () => {
    // force a multi-line win grid
    const g: Sym[][] = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => 'bottle' as Sym));
    for (let c = 0; c < COLS; c++) { g[c][0] = 'abuela'; g[c][1] = 'abuela'; g[c][2] = 'skull'; }
    startSpin(g);
  },
  forceScatter: () => {
    const g: Sym[][] = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => 'bottle' as Sym));
    g[0][1] = g[2][2] = g[4][1] = 'pinata';
    startSpin(g);
  },
  state: () => ({ credits, bet: bet(), freeSpins, freeMult, mode, lastWin, bonusMult, rows: ROWS, cols: COLS }),
  credits: (n: number) => { credits = n; setHud(); },
};

async function boot() {
  autoUnlockAudio();
  A.unlock();
  initAudioControls('slots', (m) => { A.setMuted(m); });
  const loads: Promise<unknown>[] = [
    loadImg('/lp/abuela_face.webp').then(i => imgs.abuela = i), // full head (tile art crops the bun)
    loadImg('/lp/calaca_face.webp').then(i => imgs.calaca_face = i),
    loadImg('/lp/abuela_face.webp').then(i => imgs.abuela_face = i),
    loadImg('/lp/lucha_face.webp').then(i => imgs.lucha_face = i),
    loadImg('/play/t_skull.webp').then(i => imgs.skull = i),
    loadImg('/play/t_lucha.webp').then(i => imgs.lucha = i),
    loadImg('/play/t_chancla.webp').then(i => imgs.chancla = i),
    loadImg('/play/t_bottle.webp').then(i => imgs.bottle = i),
    loadImg('/play/t_pinata.webp').then(i => { imgs.pinata = i; imgs.pinata_llama = i; }),
    loadImg('/play/slots/pinata_rosa.webp').then(i => imgs.pinata_rosa = i),
    loadImg('/play/slots/pinata_azul.webp').then(i => imgs.pinata_azul = i),
    loadImg('/play/slots/pinata_lima.webp').then(i => imgs.pinata_lima = i),
  ];
  await Promise.all(loads);
  grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => weighted()));
  fit(); setHud();
  requestAnimationFrame(frame);
  $('again').onclick = () => { $('end').classList.add('hidden'); mode = 'idle'; };
}
boot();
