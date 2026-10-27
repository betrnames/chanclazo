import { markGameStart, markFirstAction, markBonus } from '../analytics';
import { $, loadImg, autoUnlockAudio, wakeAudio } from './common';
import * as A from './slotsAudio';

// ── Free-play only. Credits never buy or cash anything. ─────────────────────
const START_CREDITS = 1000;
const BETS = [5, 10, 20, 50];
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
let betIdx = 1;
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
  const mute = $('mute'); mute.textContent = A.isMuted() ? '🔇' : '🔊';
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
  const top = 52;
  const bot = 22;
  const pad = 8;
  const availW = W - pad * 2;
  const availH = H - top - bot - pad;
  // taller cabinet for 4 rows
  let mh = availH, mw = mh / 0.95;
  if (mw > availW) { mw = availW; mh = mw * 0.95; }
  if (W > H) { // landscape: use width, keep height
    mw = Math.min(availW, availH * 1.55);
    mh = Math.min(availH, mw * 0.72);
  }
  return { x: (W - mw) / 2, y: top + (availH - mh) / 2, w: mw, h: mh };
}

function cellGeom(box: {x:number;y:number;w:number;h:number}) {
  const titleH = Math.max(28, box.h * 0.09);
  const btnH = Math.max(40, box.h * 0.13);
  const pad = box.w * 0.03;
  const reelGap = box.w * 0.01;
  const areaH = box.h - titleH - btnH - pad;
  const rw = (box.w - pad * 2 - reelGap * (COLS - 1)) / COLS;
  const rh = areaH / ROWS;
  const ox = box.x + pad;
  const oy = box.y + titleH;
  return { pad, reelGap, rw, rh, ox, oy, titleH, btnH };
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

function drawSym(sym: Sym, x: number, y: number, s: number, wildGlow = false) {
  const im = imgs[sym === 'pinata' ? 'pinata' : sym];
  ctx.save();
  const r = s * 0.12;
  ctx.fillStyle = wildGlow ? 'rgba(255,210,63,.35)' : 'rgba(0,0,0,.35)';
  roundRect(x - s / 2, y - s / 2, s, s, r); ctx.fill();
  if (wildGlow) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; roundRect(x - s / 2, y - s / 2, s, s, r); ctx.stroke(); }
  if (im && im.complete) {
    const max = s * 0.86;
    const sc = Math.min(max / im.width, max / im.height);
    const iw = im.width * sc, ih = im.height * sc;
    ctx.drawImage(im, x - iw / 2, y - ih / 2, iw, ih);
  }
  ctx.restore();
}

function drawBtn(x: number, y: number, w: number, h: number, label: string, primary = false) {
  ctx.save();
  if (primary) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ffd84a'); g.addColorStop(1, '#e8590c');
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#2a1548';
  roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; roundRect(x, y, w, h, 12); ctx.stroke();
  ctx.fillStyle = primary ? '#2a0a00' : '#ffd23f';
  ctx.font = `900 ${Math.max(13, h * 0.38)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawMachine(dt: number) {
  const box = machineBox();
  const g = cellGeom(box);
  ctx.save();
  const grd = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  grd.addColorStop(0, '#5c1a8a'); grd.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grd; roundRect(box.x, box.y, box.w, box.h, 16); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; roundRect(box.x, box.y, box.w, box.h, 16); ctx.stroke();

  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 ${Math.max(13, box.w * 0.04)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('PIÑATA SLOTS', box.x + box.w / 2, box.y + g.titleH * 0.42);
  ctx.font = `${Math.max(9, box.w * 0.022)}px Georgia`;
  ctx.fillStyle = 'rgba(243,233,210,.75)';
  ctx.fillText('(working title) · free play · 5×4', box.x + box.w / 2, box.y + g.titleH * 0.78);

  const winY = g.oy;
  const winH = g.rh * ROWS;
  ctx.save();
  roundRect(g.ox - 3, winY - 3, COLS * g.rw + (COLS - 1) * g.reelGap + 6, winH + 6, 8);
  ctx.clip();
  ctx.fillStyle = '#0d0618';
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
    ctx.strokeStyle = 'rgba(255,210,63,.22)'; ctx.lineWidth = 1;
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

  const btnY = box.y + box.h - g.btnH;
  const bw = box.w * 0.16;
  const spinW = box.w * 0.38;
  const spinLabel = freeSpins > 0 ? `FREE (${freeSpins})` : mode === 'spinning' ? '…' : 'SPIN';
  drawBtn(box.x + box.w * 0.08, btnY + 2, bw, g.btnH - 6, '−');
  drawBtn(box.x + box.w / 2 - spinW / 2, btnY + 2, spinW, g.btnH - 6, spinLabel, true);
  drawBtn(box.x + box.w * 0.76, btnY + 2, bw, g.btnH - 6, '+');
  ctx.restore();
  return { box, g };
}

function hitControls(x: number, y: number) {
  const box = machineBox();
  const g = cellGeom(box);
  const btnY = box.y + box.h - g.btnH;
  const bw = box.w * 0.16;
  const spinW = box.w * 0.38;
  const bh = g.btnH - 6;
  const inR = (bx: number, by: number, bw: number, bh: number) => x >= bx && x <= bx + bw && y >= by && y <= by + bh;
  if (inR(box.x + box.w * 0.08, btnY + 2, bw, bh)) {
    if (mode === 'idle' && freeSpins === 0) { betIdx = (betIdx + BETS.length - 1) % BETS.length; setHud(); }
    return;
  }
  if (inR(box.x + box.w * 0.76, btnY + 2, bw, bh)) {
    if (mode === 'idle' && freeSpins === 0) { betIdx = (betIdx + 1) % BETS.length; setHud(); }
    return;
  }
  if (inR(box.x + box.w / 2 - spinW / 2, btnY + 2, spinW, bh) && mode === 'idle') startSpin();
}

function drawBonus(dt: number) {
  ctx.fillStyle = 'rgba(10,4,24,.55)'; ctx.fillRect(0, 0, W, H);
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
  ctx.fillStyle = 'rgba(10,4,24,.7)'; ctx.fillRect(0, 0, W, H);
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
      ctx.fillStyle = 'rgba(0,0,0,.55)';
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
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    roundRect(W / 2 - bw / 2, H * 0.16, bw, bh, 12); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(toast, W / 2, H * 0.16 + bh / 2);
    ctx.restore();
  }
}

function drawBg() {
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 20, W / 2, H * 0.5, Math.max(W, H) * 0.7);
  g.addColorStop(0, '#4a1578'); g.addColorStop(0.5, '#1a0a2e'); g.addColorStop(1, '#0a0414');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.rotate(performance.now() / 20000); ctx.globalAlpha = 0.08;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(W, H), i * Math.PI / 6, i * Math.PI / 6 + 0.12); ctx.fill();
  }
  ctx.restore();
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
  $('mute').onclick = (e) => { e.stopPropagation(); A.unlock(); A.setMuted(!A.isMuted()); setHud(); };
  const loads: Promise<unknown>[] = [
    loadImg('/play/t_abuela.webp').then(i => imgs.abuela = i),
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
  $('go').onclick = () => { $('start').classList.add('hidden'); A.unlock(); wakeAudio(); startSpin(); };
  $('again').onclick = () => { $('end').classList.add('hidden'); mode = 'idle'; };
}
boot();
