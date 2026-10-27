import { $, loadImg, autoUnlockAudio, wireMute, wakeAudio } from './common';

// ── Free-play only. Credits never buy or cash anything. ─────────────────────
const START_CREDITS = 1000;
const BETS = [5, 10, 20, 50];
const COLS = 5;
const ROWS = 3;
const FREE_SPINS_ON_SCATTER = [0, 0, 0, 8, 12, 20]; // index = scatter count
const PAY: Record<string, number[]> = {
  // pay for 3 / 4 / 5 of a kind on a line (× bet / 10)
  abuela: [25, 80, 250],
  skull:  [20, 60, 200],
  lucha:  [15, 45, 150],
  chancla:[10, 30, 100],
  bottle: [5,  15,  50],
  pinata: [30, 100, 400], // wild also pays as itself
};
const LINES: [number, number, number, number, number][] = [
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2],
  [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,2,2], [2,2,1,0,0],
  [1,0,0,0,1], [1,2,2,2,1],
];

type Sym = 'abuela' | 'skull' | 'lucha' | 'chancla' | 'bottle' | 'pinata';
const SYMS: Sym[] = ['abuela', 'skull', 'lucha', 'chancla', 'bottle', 'pinata'];
const WEIGHTS = [14, 16, 18, 22, 24, 6]; // pinata rarer

type Mode = 'idle' | 'spinning' | 'resolve' | 'bonus' | 'blast';

const imgs: Record<string, HTMLImageElement> = {};
const pinataVars = ['pinata_llama', 'pinata_rosa', 'pinata_azul', 'pinata_lima'];

let credits = START_CREDITS;
let betIdx = 1;
let lastWin = 0;
let freeSpins = 0;
let freeMult = 1;
let mode: Mode = 'idle';
let grid: Sym[][] = []; // [col][row]
let stopAt: number[] = [];
let spinT = 0;
let spinOffset: number[] = [];
let reelSyms: Sym[][] = [];
let flashLines: number[] = [];
let flashT = 0;
let petals: {x:number;y:number;vx:number;vy:number;r:number;a:number;c:string}[] = [];
let confetti: {x:number;y:number;vx:number;vy:number;w:number;h:number;rot:number;vr:number;c:string}[] = [];
let toast = '';
let toastT = 0;
let bigLlama: {x:number;y:number;s:number;life:number} | null = null;

// bonus smash
type Pinata = { x:number;y:number;s:number;vx:number;vy:number;kind:string;hp:number;shake:number;gone:boolean };
let bonusPins: Pinata[] = [];
let bonusMult = 1;
let bonusHits = 0;
let bonusTimer = 0;
let bonusTotal = 0;
let chanclaAngle = 0;
let pointer = { x: 0, y: 0, down: false };
let smashFx: {x:number;y:number;t:number;mult:number}[] = [];

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
    fp.style.display = '';
    fp.querySelector('small')!.textContent = 'Bonus';
    $('free').textContent = `×${bonusMult}`;
  } else if (freeSpins > 0) {
    fp.style.display = '';
    fp.querySelector('small')!.textContent = 'Free spins';
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

function evalWin(g: Sym[][]): { payout: number; lines: number[]; scatters: number } {
  let payout = 0;
  const hit: number[] = [];
  const unit = bet() / 10;
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    const seq: Sym[] = line.map((row, col) => g[col][row]);
    // wilds (pinata) substitute for anything except counting as scatter separately
    let base: Sym | null = null;
    for (const s of seq) { if (s !== 'pinata') { base = s; break; } }
    if (!base) base = 'pinata';
    let count = 0;
    for (const s of seq) {
      if (s === base || s === 'pinata') count++;
      else break;
    }
    if (count >= 3) {
      const table = PAY[base];
      const pay = table[count - 3] * unit;
      payout += pay;
      hit.push(li);
    }
  }
  let scatters = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r] === 'pinata') scatters++;
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
      rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
      c: C[i % C.length],
    });
  }
}

function startSpin(forceGrid?: Sym[][]) {
  if (mode !== 'idle') return;
  wakeAudio();
  const cost = freeSpins > 0 ? 0 : bet();
  if (credits < cost) { toast = 'Out of free credits — tap + to top up'; toastT = 2; return; }
  if (freeSpins === 0) credits -= cost;
  else freeSpins--;
  lastWin = 0;
  flashLines = [];
  mode = 'spinning';
  spinT = 0;
  stopAt = Array.from({ length: COLS }, (_, i) => 0.7 + i * 0.35 + Math.random() * 0.15);
  spinOffset = Array.from({ length: COLS }, () => 0);
  reelSyms = Array.from({ length: COLS }, () => fillReel(50));
  // plant final symbols at the end of each reel strip
  if (forceGrid) grid = forceGrid;
  else {
    grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => weighted()));
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) reelSyms[c][r] = grid[c][r];
  }
  setHud();
}

function finishSpin() {
  mode = 'resolve';
  const { payout, lines, scatters } = evalWin(grid);
  const inFree = freeMult > 1;
  const total = Math.round(payout * (inFree ? freeMult : 1));
  lastWin = total;
  credits += total;
  flashLines = lines;
  flashT = 1.6;
  if (total > 0) {
    spawnConfetti(40, W / 2, H * .4);
    spawnPetals(30);
    toast = total >= bet() * 20 ? `BIG WIN ${total}!` : `+${total}`;
    toastT = 1.8;
  }
  const award = FREE_SPINS_ON_SCATTER[Math.min(scatters, 5)];
  if (award > 0) {
    freeSpins += award;
    freeMult = freeMult <= 1 ? 2 : Math.min(5, freeMult + 1);
    toast = `${award} FREE SPINS · ×${freeMult}`;
    toastT = 2.4;
    spawnConfetti(80, W / 2, H * .35);
  }
  setHud();
  // bonus trigger: 4+ scatters, or random during free spins with a wild on screen
  const wildOn = scatters >= 1;
  const triggerBonus = scatters >= 4 || (freeSpins > 0 && wildOn && Math.random() < 0.35) || (scatters === 3 && Math.random() < 0.5);
  setTimeout(() => {
    if (triggerBonus) enterBonus();
    else {
      mode = 'idle';
      if (freeSpins > 0) setTimeout(() => startSpin(), 600);
      else {
        freeMult = 1;
        if (credits <= 0) {
          credits = START_CREDITS;
          toast = 'Free credits refilled';
          toastT = 2;
        }
        setHud();
      }
    }
  }, total > 0 ? 1400 : 500);
}

function enterBonus() {
  mode = 'bonus';
  bonusMult = 1;
  bonusHits = 0;
  bonusTotal = 0;
  bonusTimer = 12; // seconds
  smashFx = [];
  const kinds = pinataVars;
  bonusPins = [];
  const n = 7 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    bonusPins.push({
      x: W * (0.15 + Math.random() * 0.7),
      y: H * (0.25 + Math.random() * 0.45),
      s: 70 + Math.random() * 50,
      vx: (Math.random() - .5) * 1.2,
      vy: (Math.random() - .5) * .8,
      kind: kinds[i % kinds.length],
      hp: 1,
      shake: 0,
      gone: false,
    });
  }
  // one big llama in the middle as the finale target (takes 3 hits)
  bonusPins.push({
    x: W / 2, y: H * 0.42, s: 140,
    vx: 0, vy: 0, kind: 'pinata_llama', hp: 3, shake: 0, gone: false,
  });
  toast = 'SMASH THE PIÑATAS!';
  toastT = 2;
  setHud();
}

function smashAt(x: number, y: number) {
  if (mode !== 'bonus') return;
  chanclaAngle = -1.2;
  // find nearest pinata
  let best: Pinata | null = null;
  let bestD = 1e9;
  for (const p of bonusPins) {
    if (p.gone) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < p.s * 0.55 && d < bestD) { best = p; bestD = d; }
  }
  if (!best) {
    spawnPetals(4, x, y);
    return;
  }
  best.hp--;
  best.shake = 1;
  spawnConfetti(18, best.x, best.y);
  spawnPetals(10, best.x, best.y);
  bonusHits++;
  const gain = bet() * (best.hp <= 0 ? 2 : 1);
  bonusMult = Math.min(20, bonusMult + (best.kind === 'pinata_llama' ? 1 : 0.5));
  // round mult to .5 steps
  bonusMult = Math.round(bonusMult * 2) / 2;
  const add = Math.round(gain * bonusMult);
  bonusTotal += add;
  smashFx.push({ x: best.x, y: best.y - best.s * 0.4, t: 1, mult: bonusMult });
  if (best.hp <= 0) {
    best.gone = true;
    if (best.s >= 130) {
      // big llama — trigger explosion blast
      startBlast(best.x, best.y);
      return;
    }
  }
  setHud();
}

function startBlast(x: number, y: number) {
  mode = 'blast';
  bigLlama = { x, y, s: 1, life: 1.8 };
  spawnConfetti(160, x, y);
  spawnPetals(80, x, y);
  for (const p of bonusPins) if (!p.gone) { p.gone = true; spawnConfetti(20, p.x, p.y); }
  const blastPay = Math.round(bet() * 15 * bonusMult);
  bonusTotal += blastPay;
  toast = `LLAMA BLAST ×${bonusMult}!`;
  toastT = 2.2;
  setTimeout(endBonus, 1800);
}

function endBonus() {
  credits += bonusTotal;
  lastWin = bonusTotal;
  toast = bonusTotal > 0 ? `Bonus +${bonusTotal}` : 'Bonus over';
  toastT = 2;
  mode = 'idle';
  setHud();
  if (freeSpins > 0) setTimeout(() => startSpin(), 700);
}

function fit() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit);

// layout helpers — machine fills available area under HUD
function machineBox() {
  const top = 56 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0);
  const bot = 28;
  const pad = 12;
  const availW = W - pad * 2;
  const availH = H - top - bot - pad;
  // prefer 5:3-ish but clamp to screen
  let mw = availW, mh = mw * 0.72;
  if (mh > availH) { mh = availH; mw = mh / 0.72; }
  // landscape: wider machine
  if (W > H) {
    mh = Math.min(availH, availW * 0.5);
    mw = Math.min(availW, mh / 0.55);
  }
  const x = (W - mw) / 2;
  const y = top + (availH - mh) / 2;
  return { x, y, w: mw, h: mh };
}

function cellGeom(box: {x:number;y:number;w:number;h:number}) {
  const pad = box.w * 0.04;
  const reelGap = box.w * 0.012;
  const rw = (box.w - pad * 2 - reelGap * (COLS - 1)) / COLS;
  const rh = (box.h - pad * 2 - box.h * 0.18) / ROWS; // leave bottom for spin btn
  const ox = box.x + pad;
  const oy = box.y + pad;
  return { pad, reelGap, rw, rh, ox, oy, btnH: box.h * 0.16 };
}

function drawSym(sym: Sym, x: number, y: number, s: number) {
  const key = sym === 'pinata' ? 'pinata' : sym;
  const im = imgs[key];
  ctx.save();
  // tile backing
  const r = s * 0.12;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  roundRect(x - s/2, y - s/2, s, s, r);
  ctx.fill();
  if (im && im.complete) {
    const max = s * 0.86;
    const sc = Math.min(max / im.width, max / im.height);
    const iw = im.width * sc, ih = im.height * sc;
    ctx.drawImage(im, x - iw/2, y - ih/2, iw, ih);
  } else {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(x - s/3, y - s/3, s*2/3, s*2/3);
  }
  ctx.restore();
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

function drawMachine(dt: number) {
  const box = machineBox();
  const g = cellGeom(box);

  // carnival cabinet
  ctx.save();
  const grd = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  grd.addColorStop(0, '#5c1a8a'); grd.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grd;
  roundRect(box.x, box.y, box.w, box.h, 18);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
  roundRect(box.x, box.y, box.w, box.h, 18); ctx.stroke();

  // title plate
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 ${Math.max(14, box.w * 0.045)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('PIÑATA SLOTS', box.x + box.w/2, box.y + g.pad * 0.55);
  ctx.font = `${Math.max(10, box.w * 0.025)}px Georgia`;
  ctx.fillStyle = 'rgba(243,233,210,.75)';
  ctx.fillText('(working title) · free play', box.x + box.w/2, box.y + g.pad * 0.95);

  // reels window
  const winY = g.oy + g.pad * 0.6;
  const winH = g.rh * ROWS;
  ctx.save();
  roundRect(g.ox - 4, winY - 4, COLS * g.rw + (COLS-1)*g.reelGap + 8, winH + 8, 10);
  ctx.clip();
  ctx.fillStyle = '#0d0618';
  ctx.fillRect(g.ox - 4, winY - 4, COLS * g.rw + (COLS-1)*g.reelGap + 8, winH + 8);

  for (let c = 0; c < COLS; c++) {
    const cx = g.ox + c * (g.rw + g.reelGap);
    const spinning = mode === 'spinning' && spinT < stopAt[c];
    if (spinning) {
      const speed = 28 + c * 4;
      spinOffset[c] += speed * dt * g.rh;
      const cell = g.rh;
      const off = spinOffset[c] % cell;
      for (let k = -1; k <= ROWS; k++) {
        const idx = ((Math.floor(spinOffset[c] / cell) + k) % reelSyms[c].length + reelSyms[c].length) % reelSyms[c].length;
        const sym = reelSyms[c][idx];
        const cy = winY + (k + 0.5) * cell - off;
        drawSym(sym, cx + g.rw/2, cy, Math.min(g.rw, g.rh) * 0.92);
      }
    } else {
      for (let r = 0; r < ROWS; r++) {
        const cy = winY + (r + 0.5) * g.rh;
        drawSym(grid[c][r], cx + g.rw/2, cy, Math.min(g.rw, g.rh) * 0.92);
      }
    }
    // reel separators
    ctx.strokeStyle = 'rgba(255,210,63,.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, winY, g.rw, winH);
  }
  ctx.restore();

  // payline flash
  if (flashT > 0 && flashLines.length) {
    flashT -= dt;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(flashT * 20);
    ctx.strokeStyle = '#7CFC00';
    ctx.lineWidth = 3;
    for (const li of flashLines) {
      const line = LINES[li];
      ctx.beginPath();
      for (let c = 0; c < COLS; c++) {
        const cx = g.ox + c * (g.rw + g.reelGap) + g.rw/2;
        const cy = winY + (line[c] + 0.5) * g.rh;
        if (c === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // controls row
  const btnY = box.y + box.h - g.btnH - 6;
  const btnH = g.btnH - 4;
  const bw = box.w * 0.18;
  // bet -
  drawBtn(box.x + box.w * 0.08, btnY, bw, btnH, '−', () => {});
  // spin
  const spinW = box.w * 0.36;
  const spinLabel = freeSpins > 0 ? `FREE (${freeSpins})` : mode === 'spinning' ? '…' : 'SPIN';
  drawBtn(box.x + box.w/2 - spinW/2, btnY, spinW, btnH, spinLabel, () => {}, true);
  // bet +
  drawBtn(box.x + box.w * 0.74, btnY, bw, btnH, '+', () => {});

  ctx.restore();
  return { box, g, btnY, btnH, bw, spinW };
}

function drawBtn(x: number, y: number, w: number, h: number, label: string, _fn: () => void, primary = false) {
  ctx.save();
  if (primary) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ffd84a'); g.addColorStop(1, '#e8590c');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#2a1548';
  }
  roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; roundRect(x, y, w, h, 12); ctx.stroke();
  ctx.fillStyle = primary ? '#2a0a00' : '#ffd23f';
  ctx.font = `900 ${Math.max(14, h * 0.4)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w/2, y + h/2 + 1);
  ctx.restore();
}

function hitControls(x: number, y: number) {
  const box = machineBox();
  const g = cellGeom(box);
  const btnY = box.y + box.h - g.btnH - 6;
  const btnH = g.btnH - 4;
  const bw = box.w * 0.18;
  const spinW = box.w * 0.36;
  const inR = (bx: number, by: number, bw: number, bh: number) => x >= bx && x <= bx+bw && y >= by && y <= by+bh;
  if (inR(box.x + box.w * 0.08, btnY, bw, btnH)) {
    if (mode === 'idle' && freeSpins === 0) { betIdx = (betIdx + BETS.length - 1) % BETS.length; setHud(); }
    return;
  }
  if (inR(box.x + box.w * 0.74, btnY, bw, btnH)) {
    if (mode === 'idle' && freeSpins === 0) { betIdx = (betIdx + 1) % BETS.length; setHud(); }
    return;
  }
  if (inR(box.x + box.w/2 - spinW/2, btnY, spinW, btnH)) {
    if (mode === 'idle') startSpin();
  }
}

function drawBonus(dt: number) {
  // dim background with floating petals already drawn
  ctx.fillStyle = 'rgba(10,4,24,.55)';
  ctx.fillRect(0, 0, W, H);

  // banner
  ctx.fillStyle = '#ffd23f';
  ctx.font = `900 ${Math.max(22, W * 0.06)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText('PIÑATA SMASH', W/2, 70);
  ctx.font = `${Math.max(14, W * 0.035)}px system-ui`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`Multiplier ×${bonusMult} · ${Math.ceil(bonusTimer)}s · tap to smash`, W/2, 98);

  for (const p of bonusPins) {
    if (p.gone) continue;
    p.x += p.vx; p.y += p.vy;
    if (p.x < p.s*.4 || p.x > W - p.s*.4) p.vx *= -1;
    if (p.y < 120 || p.y > H - 80) p.vy *= -1;
    if (p.shake > 0) p.shake -= dt * 4;
    const im = imgs[p.kind] || imgs.pinata;
    const shakeX = p.shake > 0 ? Math.sin(p.shake * 40) * 8 : 0;
    if (im && im.complete) {
      const sc = p.s / Math.max(im.width, im.height);
      const iw = im.width * sc, ih = im.height * sc;
      ctx.save();
      ctx.translate(p.x + shakeX, p.y);
      ctx.rotate(Math.sin(performance.now()/400 + p.x) * 0.08);
      ctx.drawImage(im, -iw/2, -ih/2, iw, ih);
      ctx.restore();
    }
  }

  // floating mult popups
  for (const f of smashFx) {
    f.t -= dt;
    f.y -= 40 * dt;
    ctx.globalAlpha = Math.max(0, f.t);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `900 ${24 + (1-f.t)*10}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(`×${f.mult}`, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  smashFx = smashFx.filter(f => f.t > 0);

  // chancla cursor
  const cim = imgs.chancla;
  if (cim && cim.complete) {
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.rotate(chanclaAngle);
    const s = 64;
    ctx.drawImage(cim, -s/2, -s/2, s, s);
    ctx.restore();
  }
  if (chanclaAngle < 0) chanclaAngle = Math.min(0, chanclaAngle + dt * 4);

  bonusTimer -= dt;
  if (bonusTimer <= 0 && mode === 'bonus') {
    // time up — if big llama still there, auto-blast weakly
    const big = bonusPins.find(p => p.s >= 130 && !p.gone);
    if (big) startBlast(big.x, big.y);
    else {
      for (const p of bonusPins) if (!p.gone) { p.gone = true; spawnConfetti(10, p.x, p.y); }
      endBonus();
    }
  }
}

function drawBlast(dt: number) {
  if (!bigLlama) return;
  bigLlama.life -= dt;
  bigLlama.s += dt * 2.5;
  const im = imgs.pinata_llama || imgs.pinata;
  ctx.save();
  ctx.translate(bigLlama.x, bigLlama.y);
  ctx.rotate(bigLlama.life * 8);
  ctx.globalAlpha = Math.max(0, bigLlama.life / 1.8);
  if (im && im.complete) {
    const s = 160 * bigLlama.s;
    ctx.drawImage(im, -s/2, -s/2, s, s);
  }
  // explosion rings
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 80 * bigLlama.s, 0, 7);
  ctx.stroke();
  ctx.strokeStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(0, 0, 120 * bigLlama.s, 0, 7);
  ctx.stroke();
  ctx.restore();
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
    ctx.fillStyle = c.c; ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h);
    ctx.restore();
  }
  confetti = confetti.filter(c => c.y < H + 40);
  if (toastT > 0) {
    toastT -= dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, toastT * 2);
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.font = `900 ${Math.max(18, W * 0.05)}px system-ui`;
    const m = ctx.measureText(toast);
    const bw = m.width + 36, bh = 44;
    roundRect(W/2 - bw/2, H * 0.18, bw, bh, 12); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(toast, W/2, H * 0.18 + bh/2);
    ctx.restore();
  }
}

function drawBg() {
  const g = ctx.createRadialGradient(W/2, H*0.35, 20, W/2, H*0.5, Math.max(W,H)*0.7);
  g.addColorStop(0, '#4a1578'); g.addColorStop(0.5, '#1a0a2e'); g.addColorStop(1, '#0a0414');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft rays
  ctx.save();
  ctx.translate(W/2, H*0.3);
  ctx.rotate(performance.now()/20000);
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0, Math.max(W,H), i*Math.PI/6, i*Math.PI/6 + 0.12);
    ctx.fill();
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
    // stop reels one by one
    let allStopped = true;
    for (let c = 0; c < COLS; c++) {
      if (spinT < stopAt[c]) allStopped = false;
      else {
        // snap strip so rows 0..2 show grid
        spinOffset[c] = 0;
      }
    }
    // once a reel's stop time passed, freeze its offset
    drawMachine(dt);
    // override: for stopped reels show grid (drawMachine already handles mode spinning for all —
    // switch per-reel by temporarily using settled look)
    // Simpler: when all past stopAt, finish
    if (allStopped) finishSpin();
  } else if (mode === 'bonus') {
    drawMachine(0); // faded underneath? skip — full bonus
    // actually clear and draw bonus only
    drawBg();
    drawBonus(dt);
  } else if (mode === 'blast') {
    drawBg();
    drawBlast(dt);
  } else {
    drawMachine(dt);
  }
  drawFx(dt);
  requestAnimationFrame(frame);
}

function onPtr(e: PointerEvent, down: boolean) {
  const r = canvas.getBoundingClientRect();
  pointer.x = (e.clientX - r.left);
  pointer.y = (e.clientY - r.top);
  pointer.down = down;
  if (down) {
    wakeAudio();
    if (mode === 'bonus') smashAt(pointer.x, pointer.y);
    else if (mode === 'idle' || mode === 'resolve') hitControls(pointer.x, pointer.y);
  }
}
canvas.addEventListener('pointerdown', e => { e.preventDefault(); onPtr(e, true); }, { passive: false });
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX - canvas.getBoundingClientRect().left; pointer.y = e.clientY - canvas.getBoundingClientRect().top; });
canvas.addEventListener('pointerup', e => onPtr(e, false));

// test hooks
(window as any).__slots = {
  spin: () => startSpin(),
  forceBonus: () => { if (mode === 'idle') enterBonus(); },
  forceScatter: () => {
    const g: Sym[][] = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => 'bottle' as Sym));
    g[0][1] = g[2][1] = g[4][1] = 'pinata';
    startSpin(g);
  },
  state: () => ({ credits, bet: bet(), freeSpins, freeMult, mode, lastWin, bonusMult }),
  credits: (n: number) => { credits = n; setHud(); },
};

async function boot() {
  autoUnlockAudio();
  wireMute();
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
  // seed grid
  grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => weighted()));
  fit();
  setHud();
  requestAnimationFrame(frame);

  $('go').onclick = () => {
    $('start').classList.add('hidden');
    wakeAudio();
    startSpin();
  };
  $('again').onclick = () => {
    $('end').classList.add('hidden');
    mode = 'idle';
  };
}
boot();
