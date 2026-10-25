// Chanclazo 3D: Downhill Mode (demo). Endless downhill skate runner using the existing Chanclazo art.
import * as THREE from 'three';

const $ = (id: string) => document.getElementById(id)!;
const ROAD_HALF = 5;
const SPAWN_Z = -170;
const BEST_KEY = 'chanclazo-downhill-best';

// ── Renderer / scene ─────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
(document.body as HTMLElement).insertBefore(renderer.domElement, document.body.firstChild);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf4b27a, 60, 175);
const loader = new THREE.TextureLoader();
const bg = loader.load('/cruise/bg_mercado.webp');
bg.colorSpace = THREE.SRGBColorSpace;
scene.background = bg;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.2, 8.5);
camera.lookAt(0, 1.2, -12);

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x8a4b2a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(6, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
scene.add(sun);

// World tilted slightly so the street reads as a downhill run.
const world = new THREE.Group();
world.rotation.x = 0.07;
scene.add(world);

// ── Street (scrolling canvas texture) ────────────────────────────────────────
function streetTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c98b5a'; g.fillRect(0, 0, 256, 512); // terracotta cobbles
  for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
    g.fillStyle = `hsl(${20 + Math.random() * 8},45%,${46 + Math.random() * 10}%)`;
    g.fillRect(x + 1, y + 1, 30, 30);
  }
  g.fillStyle = '#fff3c4';
  for (let y = 0; y < 512; y += 128) g.fillRect(124, y, 8, 64); // center dashes
  g.fillStyle = '#7a3d1d'; g.fillRect(0, 0, 10, 512); g.fillRect(246, 0, 10, 512);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const roadTex = streetTexture();
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 1, 260), new THREE.MeshLambertMaterial({ map: roadTex }));
road.rotation.x = -Math.PI / 2;
road.position.z = -110;
road.receiveShadow = true;
world.add(road);
const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(60, 260), new THREE.MeshLambertMaterial({ color: 0xe8c39e }));
sidewalk.rotation.x = -Math.PI / 2;
sidewalk.position.set(0, -0.02, -110);
world.add(sidewalk);

// ── Casitas on both sides (recycled) ─────────────────────────────────────────
const HOUSE_COLORS = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xff9f1c, 0x9b5de5];
const houses: THREE.Mesh[] = [];
const houseGeo = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 28; i++) {
  const side = i % 2 ? 1 : -1;
  const h = new THREE.Mesh(houseGeo, new THREE.MeshLambertMaterial({ color: HOUSE_COLORS[i % HOUSE_COLORS.length] }));
  const hgt = 3 + Math.random() * 4;
  h.scale.set(5, hgt, 9);
  h.position.set(side * (ROAD_HALF + 6.5 + Math.random() * 1.5), hgt / 2, -Math.floor(i / 2) * 12.5);
  h.castShadow = true;
  world.add(h);
  houses.push(h);
}
// Papel picado strings across the street
const picado: THREE.Group[] = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  for (let k = 0; k < 14; k++) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9),
      new THREE.MeshBasicMaterial({ color: HOUSE_COLORS[(k + i) % HOUSE_COLORS.length], side: THREE.DoubleSide }));
    const x = -8.5 + k * 1.3;
    flag.position.set(x, 7.6 - Math.cos((x / 8.5) * 1.2) * 0.6, 0);
    g.add(flag);
  }
  g.position.z = -i * 30;
  world.add(g);
  picado.push(g);
}

// ── Sprite sheet helper (existing 5x5 sheets from the main game) ─────────────
function sheet(url: string, cols = 5, rows = 5) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / cols, 1 / rows);
  t.offset.set(0, (rows - 1) / rows);
  return { t, cols, rows, frames: cols * rows };
}
function setFrame(s: ReturnType<typeof sheet>, f: number) {
  const i = Math.floor(f) % s.frames;
  s.t.offset.set((i % s.cols) / s.cols, (s.rows - 1 - Math.floor(i / s.cols)) / s.rows);
}
function tex(url: string) { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; return t; }

// ── Player: the Chanclazo kid on a skateboard ────────────────────────────────
const runSheet = sheet('/cruise/boy-run-v2.webp');
const jumpSheet = sheet('/cruise/boy-jump-v2.webp');
const player = new THREE.Group();
const kidMat = new THREE.MeshBasicMaterial({ map: runSheet.t, transparent: true, alphaTest: 0.3 });
const kid = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), kidMat);
kid.position.y = 1.4;
const board = new THREE.Group();
const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.5), new THREE.MeshLambertMaterial({ color: 0xe8590c }));
deck.position.y = 0.3; deck.castShadow = true;
board.add(deck);
const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0xffd166 });
for (const [x, z] of [[-0.28, -0.5], [0.28, -0.5], [-0.28, 0.5], [0.28, 0.5]]) {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.rotation.z = Math.PI / 2; w.position.set(x, 0.13, z);
  board.add(w);
}
player.add(board, kid);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
world.add(player, shadow);

// ── Mamá up ahead, throwing chanclas ─────────────────────────────────────────
const momi = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: tex("/cruise/momi.webp"), transparent: true, alphaTest: 0.3, fog: false }));
momi.position.set(0, 3.5, -42);
world.add(momi);

// ── Entities ─────────────────────────────────────────────────────────────────
type Kind = 'crate' | 'cone' | 'cart' | 'skull' | 'pinata' | 'chancla';
interface Ent { kind: Kind; obj: THREE.Object3D; hw: number; h: number; vz: number; vx: number; vy: number; dead?: boolean; s?: ReturnType<typeof sheet>; f?: number }
const ents: Ent[] = [];
const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const coneMat = new THREE.MeshLambertMaterial({ color: 0xff7b00 });
const cartMat = new THREE.MeshLambertMaterial({ color: 0x2a9d8f });
const awningMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const skullTex = tex('/cruise/sugarskull.webp');
const pinataTex = tex('/cruise/pinata.webp');

function make(kind: Kind, x: number, z = SPAWN_Z): Ent {
  let obj: THREE.Object3D; let hw = 0.6, h = 1;
  if (kind === 'crate') {
    obj = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 1.3), crateMat); obj.position.y = 0.5; hw = 0.65; h = 1;
  } else if (kind === 'cone') {
    obj = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 12), coneMat); obj.position.y = 0.5; hw = 0.4; h = 1;
  } else if (kind === 'cart') {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.8), cartMat); b.position.y = 1;
    const a = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2.2), awningMat); a.position.y = 2.7;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), awningMat); p.position.set(0, 2.2, 0);
    g.add(b, a, p); obj = g; hw = 1.3; h = 3; // too tall to jump: steer around
  } else if (kind === 'skull' || kind === 'pinata') {
    const big = kind === 'pinata';
    obj = new THREE.Mesh(new THREE.PlaneGeometry(big ? 1.6 : 0.9, big ? 2.2 : 0.9),
      new THREE.MeshBasicMaterial({ map: big ? pinataTex : skullTex, transparent: true, alphaTest: 0.3 }));
    obj.position.y = big ? 1.4 : 1.1; hw = big ? 0.9 : 0.6; h = 3;
  } else {
    const s = sheet('/cruise/chancla_spin.webp');
    obj = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: s.t, transparent: true, alphaTest: 0.3 }));
    hw = 0.55; h = 0.9; obj.position.y = 4;
    const e: Ent = { kind, obj, hw, h, vz: 0, vx: 0, vy: 0, s, f: Math.random() * 25 };
    obj.position.set(x, 3, z);
    world.add(obj); ents.push(e); return e;
  }
  obj.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  obj.position.x = x; obj.position.z = z;
  world.add(obj);
  const e: Ent = { kind, obj, hw, h, vz: 0, vx: 0, vy: 0 };
  ents.push(e);
  return e;
}

// ── Game state ───────────────────────────────────────────────────────────────
const st = {
  running: false, speed: 0, dist: 0, bonus: 0, px: 0, py: 0, vy: 0, steer: 0,
  trickT: -1, combo: 0, spawnIn: 0, throwIn: 3, t: 0, best: parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0,
};
const input = { left: false, right: false };
$('best').textContent = `Best ${st.best.toLocaleString()}`;

function reset() {
  for (const e of ents) world.remove(e.obj);
  ents.length = 0;
  Object.assign(st, { running: true, speed: 16, dist: 0, bonus: 0, px: 0, py: 0, vy: 0, steer: 0, trickT: -1, combo: 0, spawnIn: 1, throwIn: 3, t: 0 });
  player.rotation.set(0, 0, 0);
  $('start').classList.add('hidden');
  $('over').classList.add('hidden');
}
const score = () => Math.floor(st.dist * 2 + st.bonus);

function flash(msg: string) {
  const el = $('trick');
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout((flash as any).t);
  (flash as any).t = setTimeout(() => (el.style.opacity = '0'), 700);
}

function jump() {
  if (!st.running) return;
  if (st.py <= 0.001) { st.vy = 11; }
}
function trick() {
  if (!st.running) return;
  if (st.py > 0.6 && st.trickT < 0) st.trickT = 0;
}

function gameOver(by: Kind) {
  st.running = false;
  const s = score();
  if (s > st.best) { st.best = s; localStorage.setItem(BEST_KEY, String(s)); }
  $('best').textContent = `Best ${st.best.toLocaleString()}`;
  $('overMsg').textContent = by === 'chancla' ? 'Mamá never misses. The chancla found you.'
    : by === 'cart' ? 'You ate the elote cart. Steer around those!' : 'Wipeout! Jump the crates and cones.';
  $('overScore').textContent = `${s.toLocaleString()} pts`;
  $('over').classList.remove('hidden');
}

// ── Spawning patterns ────────────────────────────────────────────────────────
function spawnRow() {
  const r = Math.random();
  const lanes = [-3.4, 0, 3.4];
  if (r < 0.25) {
    const open = Math.floor(Math.random() * 3);
    lanes.forEach((x, i) => { if (i !== open) make(Math.random() < 0.5 ? 'crate' : 'cone', x); else make('skull', x); });
  } else if (r < 0.45) {
    make('cart', lanes[Math.floor(Math.random() * 3)]);
  } else if (r < 0.75) {
    const x = (Math.random() * 2 - 1) * 3.6;
    for (let k = 0; k < 5; k++) make('skull', x, SPAWN_Z - k * 3);
  } else if (r < 0.95) {
    make(Math.random() < 0.5 ? 'crate' : 'cone', (Math.random() * 2 - 1) * 3.8);
    make('skull', (Math.random() * 2 - 1) * 3.8, SPAWN_Z - 6);
  } else {
    make('pinata', (Math.random() * 2 - 1) * 3.5);
  }
}
function throwChancla() {
  const e = make('chancla', momi.position.x, momi.position.z + 1);
  const T = 1.7 - Math.min(0.6, st.t / 120); // time to reach the player, shrinks over time
  const targetX = THREE.MathUtils.clamp(st.px + st.steer * 0.6 + (Math.random() - 0.5) * 1.5, -ROAD_HALF + 0.5, ROAD_HALF - 0.5);
  e.vz = (0 - e.obj.position.z) / T;
  e.vx = (targetX - e.obj.position.x) / T;
  e.vy = (1.0 - 3 + 0.5 * 9.8 * T * T) / T; // lands around head height at the player
}

// ── Loop ─────────────────────────────────────────────────────────────────────
let last = performance.now();
let animF = 0;
function tick() {
  const now = performance.now(); const dt = Math.min((now - last) / 1000, 0.05); last = now;
  animF += dt * 18;
  if (st.running) step(dt);
  // sprites face the camera
  kid.quaternion.copy(camera.quaternion);
  if (st.trickT >= 0) kid.rotateZ(st.trickT * Math.PI * 2);
  momi.quaternion.copy(camera.quaternion);
  for (const e of ents) if (e.kind === 'skull' || e.kind === 'pinata' || e.kind === 'chancla') e.obj.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function step(dt: number) {
  st.t += dt;
  st.speed = Math.min(46, st.speed + dt * 0.45);
  const move = st.speed * dt;
  st.dist += move;

  // steering with a little carve momentum
  const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  st.steer += (want - st.steer) * Math.min(1, dt * 9);
  st.px = THREE.MathUtils.clamp(st.px + st.steer * dt * (7 + st.speed * 0.12), -ROAD_HALF + 0.5, ROAD_HALF - 0.5);

  // jump + trick
  if (st.py > 0 || st.vy > 0) {
    st.vy -= 28 * dt; st.py += st.vy * dt;
    if (st.trickT >= 0) st.trickT += dt * 2.2;
    if (st.trickT >= 1) { st.combo++; st.bonus += 150 * st.combo; flash(`KICKFLIP x${st.combo}  +${150 * st.combo}`); st.trickT = -1; }
    if (st.py <= 0) {
      st.py = 0; st.vy = 0;
      if (st.trickT >= 0) { st.trickT = -1; st.combo = 0; st.speed *= 0.8; flash('Sketchy landing!'); }
    }
  }
  player.position.set(st.px, st.py, 0);
  player.rotation.z = -st.steer * 0.25;
  board.rotation.y = -st.steer * 0.3;
  if (st.trickT >= 0) board.rotation.z = st.trickT * Math.PI * 2;
  else board.rotation.z = 0;
  shadow.position.x = st.px;
  shadow.scale.setScalar(1 / (1 + st.py * 0.25));
  const airborne = st.py > 0.05;
  kidMat.map = airborne ? jumpSheet.t : runSheet.t;
  setFrame(airborne ? jumpSheet : runSheet, airborne ? Math.min(24, (1 - st.vy / 11) * 12) : animF);

  // scroll scenery
  roadTex.offset.y += move / (260 / 24);
  for (const h of houses) { h.position.z += move; if (h.position.z > 15) h.position.z -= 14 * 12.5; }
  for (const p of picado) { p.position.z += move; if (p.position.z > 15) p.position.z -= 6 * 30; }
  camera.position.x += (st.px * 0.5 - camera.position.x) * Math.min(1, dt * 4);
  camera.fov = 62 + (st.speed - 16) * 0.25; camera.updateProjectionMatrix();

  // Mamá drifts toward the player's lane and throws
  momi.position.x += (st.px - momi.position.x) * dt * 0.8;
  momi.position.y = 3.5 + Math.abs(Math.sin(st.t * 6)) * 0.3;
  st.throwIn -= dt;
  if (st.throwIn <= 0) { throwChancla(); st.throwIn = Math.max(0.9, 2.6 - st.t / 40) * (0.7 + Math.random() * 0.6); }

  // spawn street stuff
  st.spawnIn -= move;
  if (st.spawnIn <= 0) { spawnRow(); st.spawnIn = Math.max(14, 26 - st.t * 0.12); }

  // update entities + collisions
  for (const e of ents) {
    const o = e.obj.position;
    if (e.kind === 'chancla') {
      o.z += e.vz * dt; o.x += e.vx * dt; e.vy -= 9.8 * dt; o.y += e.vy * dt;
      e.f! += dt * 30; setFrame(e.s!, e.f!);
      if (o.y < 0.3) { o.y = 0.3; e.vy = 0; e.vx *= 0.9; }
    } else {
      o.z += move;
      if (e.kind === 'skull' || e.kind === 'pinata') e.obj.position.y = (e.kind === 'pinata' ? 1.4 : 1.1) + Math.sin(st.t * 4 + o.z) * 0.15;
    }
    if (o.z > 12) e.dead = true;
    if (e.dead) continue;
    // collide near the player plane
    const dz = Math.abs(o.z - 0);
    const reach = e.kind === 'cart' ? 1.2 : 0.8;
    if (dz < reach && Math.abs(o.x - st.px) < e.hw + 0.4) {
      if (e.kind === 'skull') { e.dead = true; st.bonus += 25; continue; }
      if (e.kind === 'pinata') { e.dead = true; st.bonus += 500; flash('¡PIÑATA! +500'); continue; }
      if (e.kind === 'chancla') {
        const top = o.y + 0.5, bottom = o.y - 0.5;
        if (bottom < st.py + 2.4 && top > st.py) return gameOver('chancla');
        continue;
      }
      if (st.py < e.h - 0.05) return gameOver(e.kind);
      if (e.kind !== 'cart') { st.bonus += 50; e.dead = true; flash('Ollie! +50'); }
    }
  }
  for (let i = ents.length - 1; i >= 0; i--) if (ents[i].dead) { world.remove(ents[i].obj); ents.splice(i, 1); }

  $('score').textContent = score().toLocaleString();
  $('speed').textContent = `${Math.round(st.speed * 3.6)} km/h`;
}

// ── Input ────────────────────────────────────────────────────────────────────
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = true;
  else if (k === 'arrowright' || k === 'd') input.right = true;
  else if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); if (!st.running) reset(); else jump(); }
  else if (k === 'x' || k === 'shift' || k === 'arrowdown' || k === 's') trick();
  else if (k === 'enter' && !st.running) reset();
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = false;
  if (k === 'arrowright' || k === 'd') input.right = false;
});
function hold(id: string, on: () => void, off: () => void) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); on(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => off());
}
hold('tL', () => (input.left = true), () => (input.left = false));
hold('tR', () => (input.right = true), () => (input.right = false));
hold('tJ', jump, () => {});
hold('tT', trick, () => {});
// swipe anywhere on the canvas: up = jump, down = trick, sideways = steer nudge
let sx = 0, sy = 0;
renderer.domElement.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
renderer.domElement.addEventListener('pointerup', e => {
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) (dy < 0 ? jump : trick)();
});
if (matchMedia('(pointer: coarse)').matches) $('touch').classList.remove('hidden');
$('go').addEventListener('click', reset);
$('again').addEventListener('click', reset);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
(window as any).__cruise = { st, ents };
tick();
