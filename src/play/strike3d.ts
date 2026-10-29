import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------- story text table (one-line name swap) ----------
const BOY = 'Isidro';
type Panel = { bg: string; cap: string; imgs: { src: string; style: string }[]; bubbles?: { text: string; style: string; tx?: string }[]; fx?: { text: string; style: string }; glow?: boolean };
const A = '/s3d/abuela.webp', L = '/s3d/luchador.webp', P = '/s3d/llama.webp', C = '/play/calaca_sprite.webp', K = '/play/t_kid.webp', M = '/s3d/mask.webp';
const NIGHT = '/play/night_bg.webp', CATA = '/play/cata_bg.webp', MERC = '/play/mercado_bg.webp';
const STORY: Record<string, Panel[]> = {
  intro: [
    { bg: MERC, cap: `Día de los Muertos. Abuela's ofrenda waits at the end of the cemetery road.`, imgs: [{ src: A, style: 'left:6%;height:78%' }], bubbles: [{ text: `${BOY}, mijo, the road is dark tonight.`, style: 'right:6%;top:24%', tx: '20%' }] },
    { bg: NIGHT, cap: `${BOY} is scared of the dark. So he puts on his luchador mask.`, imgs: [{ src: L, style: 'right:4%;height:80%' }], bubbles: [{ text: 'With the mask, I am brave!', style: 'left:6%;top:26%', tx: '70%' }] },
    { bg: NIGHT, cap: 'Abuela hands him her chanclas. Precision targeting. Zero warning.', imgs: [{ src: A, style: 'left:2%;height:70%' }, { src: L, style: 'right:2%;height:72%' }], fx: { text: 'CHANCLAZO!', style: 'left:18%;top:40%' }, bubbles: [{ text: 'When words fail, the chanclazo speaks.', style: 'left:22%;top:20%', tx: '20%' }] },
  ],
  l2: [{ bg: CATA, cap: 'The calacas are throwing chanclas back!', imgs: [{ src: C, style: 'right:8%;height:70%' }, { src: L, style: 'left:2%;height:72%' }], bubbles: [{ text: 'Swipe left or right to dodge, mijo!', style: 'right:4%;top:22%', tx: '60%' }] }],
  l3: [{ bg: NIGHT, cap: 'The wind picks up between the graves.', imgs: [{ src: A, style: 'left:6%;height:74%' }], bubbles: [{ text: `Aim into the wind, ${BOY}.`, style: 'right:6%;top:26%', tx: '20%' }] }],
  l4: [{ bg: MERC, cap: 'A rainbow piñata blocks the road, full of candy.', imgs: [{ src: P, style: 'right:10%;height:76%' }, { src: L, style: 'left:2%;height:64%' }], fx: { text: '¡DALE!', style: 'left:16%;top:34%' } }],
  l5: [{ bg: CATA, cap: 'The ofrenda glows just ahead. One last stand.', imgs: [{ src: L, style: 'left:4%;height:78%' }], bubbles: [{ text: 'Almost there. Stay brave.', style: 'right:4%;top:24%', tx: '30%' }] }],
  outro: [
    { bg: NIGHT, cap: 'In the bright light of the ofrenda, the luchador takes off his mask…', imgs: [{ src: M, style: 'left:50%;bottom:28%;height:34%;transform:translateX(-50%) rotate(-18deg);opacity:.9' }], glow: true },
    { bg: MERC, cap: `It was ${BOY} the whole time. The mask carried him through the dark.`, imgs: [{ src: K, style: 'left:6%;height:42%' }, { src: A, style: 'right:4%;height:76%' }], glow: true, bubbles: [{ text: `Mi valiente ${BOY}. I knew it was you.`, style: 'left:8%;top:20%', tx: '75%' }] },
  ],
};

// ---------- DOM ----------
const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');
const comic = $('comic'), wrap = $('panelWrap');
const SKIP_KEY = 's3d_skipStory';
function playStory(key: string, done: () => void) {
  const panels = STORY[key];
  if (!panels || localStorage.getItem(SKIP_KEY) === '1') { done(); return; }
  let i = 0;
  comic.classList.remove('hidden');
  const show = () => {
    const p = panels[i];
    const imgs = p.imgs.map((m) => `<img src="${m.src}" alt="" style="${m.style}">`).join('');
    const bubs = (p.bubbles || []).map((b) => `<div class="bub" style="${b.style};--tx:${b.tx || '30%'}">${b.text}</div>`).join('');
    const fx = p.fx ? `<div class="fx" style="${p.fx.style}">${p.fx.text}</div>` : '';
    const glow = p.glow ? '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 55%,rgba(255,240,190,.85),rgba(255,190,80,.35) 35%,rgba(0,0,0,0) 70%)"></div>' : '';
    wrap.innerHTML = `<div class="panel" style="background-image:linear-gradient(rgba(10,3,15,.25),rgba(10,3,15,.45)),url(${p.bg})">${glow}${imgs}${fx}<div class="cap">${p.cap}</div>${bubs}</div>`;
  };
  const finish = () => { comic.classList.add('hidden'); comic.onclick = null; done(); };
  comic.onclick = (e) => { if ((e.target as HTMLElement).id === 'skip') return; i++; if (i >= panels.length) finish(); else show(); };
  $('skip').onclick = (e) => { e.stopPropagation(); localStorage.setItem(SKIP_KEY, '1'); finish(); };
  show();
}

// ---------- audio ----------
let actx: AudioContext | null = null; let muted = false;
function beep(f: number, d = 0.08, type: OscillatorType = 'square', v = 0.08) {
  if (muted) return;
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  } catch { /* no audio */ }
}
$('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; };

// ---------- three ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a0a2a, 18, 46);
const camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.1, 120);
scene.add(new THREE.HemisphereLight(0xb9a0ff, 0x1a0820, 1.2));
const moon = new THREE.DirectionalLight(0xffe2b0, 1.4); moon.position.set(-4, 10, 6); scene.add(moon);
const tl = new THREE.TextureLoader();
const tex = (u: string) => { const t = tl.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; };
const bgTex = tex(NIGHT);
const bg = new THREE.Mesh(new THREE.PlaneGeometry(80, 45), new THREE.MeshBasicMaterial({ map: bgTex, fog: false }));
bg.position.set(0, 14, -48); scene.add(bg);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), new THREE.MeshStandardMaterial({ color: 0x24122e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.z = -20; scene.add(ground);
// marigold petals path
for (let i = 0; i < 120; i++) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.07, 5), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff9f1c : 0xffd23f }));
  m.rotation.x = -Math.PI / 2; m.position.set((Math.random() - 0.5) * 3, 0.01, -Math.random() * 26); scene.add(m);
}
const spriteMats: Record<string, THREE.MeshBasicMaterial> = {};
const sMat = (u: string) => (spriteMats[u] ??= new THREE.MeshBasicMaterial({ map: tex(u), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, fog: false }));

// ---------- physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
const gBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
gBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(gBody);

type Obj = { body: CANNON.Body; mesh: THREE.Object3D; kind: 'enemy' | 'crate' | 'static'; down?: boolean; pts: number; y0: number };
type Pin = { mesh: THREE.Mesh; base: THREE.Vector3; t: number; alive: boolean };
type Shot = { body: CANNON.Body; mesh: THREE.Group; age: number; hit: boolean };
type Enemy3 = { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; lane: number };
let objs: Obj[] = [], pins: Pin[] = [], shots: Shot[] = [], incoming: Enemy3[] = [];
const candy: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];

function addBox(x: number, y: number, z: number, w: number, h: number, d: number, kind: Obj['kind'], color = 0x6b3b1f, sprite?: string): Obj {
  const body = new CANNON.Body({ mass: kind === 'static' ? 0 : kind === 'enemy' ? 1.2 : 0.8, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), position: new CANNON.Vec3(x, y, z) });
  body.sleepSpeedLimit = 0.2; body.allowSleep = true; body.sleep();
  world.addBody(body);
  let mesh: THREE.Object3D;
  if (sprite) {
    const img = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 1.1), sMat(sprite));
    mesh = new THREE.Group(); mesh.add(img);
  } else {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: kind === 'static' ? 0xb04bff : 0xffb347 }));
    b.add(e); mesh = b;
  }
  scene.add(mesh);
  const o: Obj = { body, mesh, kind, pts: kind === 'enemy' ? 100 : 25, y0: y };
  objs.push(o); return o;
}
function addPin(x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), sMat(P));
  m.position.set(x, y, z); scene.add(m);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
  rope.position.set(0, 4.3, 0); m.add(rope);
  pins.push({ mesh: m, base: new THREE.Vector3(x, y, z), t: Math.random() * 6, alive: true });
}
// tower = platform + stack
function tower(x: number, z: number, plat: number, crates: number, enemy: 'L' | 'C' | null) {
  if (plat > 0) addBox(x, plat / 2, z, 2.2, plat, 1.4, 'static', 0x3b1756);
  let y = plat;
  for (let i = 0; i < crates; i++) { addBox(x + (i % 2 ? 0.05 : -0.05), y + 0.4, z, 0.8, 0.8, 0.8, 'crate', i % 2 ? 0x7a3e18 : 0x5c2d14); y += 0.8; }
  if (enemy) addBox(x, y + 0.85, z, 0.8, 1.7, 0.5, 'enemy', 0, enemy === 'L' ? C : C);
}

// ---------- levels ----------
type Lvl = { ammo: number; wind: number; throwEvery: number; build: () => void };
const LV: Lvl[] = [
  { ammo: 6, wind: 0, throwEvery: 0, build: () => { tower(0, -13, 0, 1, 'C'); tower(-2.6, -15, 1, 0, 'C'); tower(2.6, -15, 1, 0, 'C'); } },
  { ammo: 7, wind: 0, throwEvery: 4.5, build: () => { tower(-1.8, -14, 1.2, 1, 'C'); tower(1.8, -14, 1.2, 1, 'C'); tower(0, -18, 2, 2, 'C'); } },
  { ammo: 7, wind: 1.6, throwEvery: 4, build: () => { tower(-2.4, -15, 0, 3, 'C'); tower(0, -17, 1.5, 1, 'C'); tower(2.4, -15, 0, 3, 'C'); } },
  { ammo: 8, wind: -1.2, throwEvery: 3.6, build: () => { tower(-2, -15, 1, 2, 'C'); tower(2, -15, 1, 2, 'C'); addPin(0, 4.2, -16); addPin(-3, 4.8, -19); } },
  { ammo: 9, wind: 2.2, throwEvery: 3, build: () => { tower(-2.8, -16, 2, 1, 'C'); tower(0, -19, 2.5, 2, 'C'); tower(2.8, -16, 2, 1, 'C'); addPin(1.4, 5, -14); addPin(-1.4, 5.4, -21); } },
];
let li = 0, score = 0, ammo = 0, hearts = 3, lostHeart = false, playing = false, throwT = 0, lane = 0, camX = 0;
const LANES = [-1.6, 0, 1.6];

function clearLevel() {
  for (const o of objs) { world.removeBody(o.body); scene.remove(o.mesh); }
  for (const s of shots) { world.removeBody(s.body); scene.remove(s.mesh); }
  for (const p of pins) scene.remove(p.mesh);
  for (const e of incoming) scene.remove(e.mesh);
  objs = []; shots = []; pins = []; incoming = [];
}
function startLevel(i: number) {
  li = i; clearLevel(); LV[i].build();
  ammo = LV[i].ammo; hearts = 3; lostHeart = false; throwT = 2.5; lane = 1; playing = true;
  const w = LV[i].wind;
  $('wind').textContent = w === 0 ? 'Wind: calm' : `Wind ${w > 0 ? '→' : '←'} ${Math.abs(w).toFixed(1)}`;
  $('end').classList.add('hidden'); hud();
}
function hud() { $('lvl').textContent = `${li + 1}/5`; $('score').textContent = String(score); $('ammo').textContent = String(Math.max(0, ammo)); $('hearts').textContent = '❤'.repeat(hearts) + '♡'.repeat(3 - hearts); }
const enemiesLeft = () => objs.filter((o) => o.kind === 'enemy' && !o.down).length + pins.filter((p) => p.alive).length;
function endLevel(win: boolean) {
  playing = false;
  let stars = 0;
  if (win) { score += ammo * 150; stars = 1 + (ammo >= Math.ceil(LV[li].ammo * 0.3) ? 1 : 0) + (!lostHeart ? 1 : 0); }
  hud();
  $('stars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < stars ? '' : 'off'}">★</span>`).join('');
  $('endTitle').textContent = win ? (li === 4 ? '¡Ofrenda safe!' : '¡Chanclazo!') : 'Ay, no…';
  $('endMsg').textContent = win ? `Score ${score}` : hearts <= 0 ? 'The calacas got you. Try again!' : 'Out of chanclas. Try again!';
  $('next').classList.toggle('hidden', !win);
  $('next').textContent = li === 4 ? 'Play again' : 'Next level';
  const show = () => $('end').classList.remove('hidden');
  if (win && li === 4) setTimeout(() => playStory('outro', show), 700); else setTimeout(show, 600);
}
$('retry').onclick = () => { score = 0; startLevel(li); };
$('next').onclick = () => { const n = li === 4 ? 0 : li + 1; if (n === 0) score = 0; $('end').classList.add('hidden'); playStory(`l${n + 1}`, () => startLevel(n)); };

// ---------- chancla ----------
function chanclaMesh(enemy = false) {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.72), new THREE.MeshStandardMaterial({ color: enemy ? 0x2a2a2a : 0xe2197a }));
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: enemy ? 0x777777 : 0xffd23f }));
  top.position.y = 0.04;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1ec8c8 }));
  strap.position.set(0, 0.05, 0.08); strap.rotation.y = Math.PI / 2;
  g.add(sole, top, strap); return g;
}
function throwChancla(vx: number, vy: number, vz: number) {
  if (!playing || ammo <= 0) return;
  ammo--; hud(); beep(520, 0.12, 'sawtooth', 0.05);
  const body = new CANNON.Body({ mass: 0.5, shape: new CANNON.Box(new CANNON.Vec3(0.15, 0.04, 0.36)), position: new CANNON.Vec3(camX, 1.3, -0.6) });
  body.velocity.set(vx, vy, vz);
  body.angularVelocity.set(-14, (Math.random() - 0.5) * 6, vx * 2);
  body.linearDamping = 0.02;
  const s: Shot = { body, mesh: chanclaMesh(), age: 0, hit: false };
  body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
    const o = objs.find((q) => q.body === e.body);
    if (!o || o.kind === 'static') return;
    const imp = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (!s.hit && imp > 4) { s.hit = true; shake = 0.35; slow = 0.45; beep(140, 0.18, 'square', 0.12); }
  });
  world.addBody(body); scene.add(s.mesh); shots.push(s);
}

// ---------- input ----------
let start: { x: number; y: number; t: number } | null = null, cur = { x: 0, y: 0 };
const arcPts = new THREE.BufferGeometry();
const arc = new THREE.Points(arcPts, new THREE.PointsMaterial({ color: 0xffd23f, size: 0.12 }));
arc.visible = false; scene.add(arc);
function velFrom(dx: number, dy: number) {
  const H = stage.clientHeight;
  const up = Math.min(0.6, Math.max(0, -dy / H)), side = dx / H;
  return new THREE.Vector3(side * 16, 3 + up * 8, -(7 + up * 18));
}
function updateArc() {
  if (!start) return;
  const v = velFrom(cur.x - start.x, cur.y - start.y);
  const p = new THREE.Vector3(camX, 1.3, -0.6), pts: number[] = [];
  for (let i = 0; i < 26; i++) { const t = i * 0.06; pts.push(p.x + v.x * t + 0.5 * LV[li].wind * t * t, p.y + v.y * t - 4.91 * t * t, p.z + v.z * t); }
  arcPts.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); arc.visible = -(cur.y - start.y) > 20;
}
stage.addEventListener('pointerdown', (e) => { if (!playing || (e.target as HTMLElement).closest('a,button,.screen,#comic')) return; start = { x: e.clientX, y: e.clientY, t: performance.now() }; cur = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', (e) => { if (start) { cur = { x: e.clientX, y: e.clientY }; updateArc(); } });
addEventListener('pointerup', (e) => {
  if (!start) return;
  const dx = e.clientX - start.x, dy = e.clientY - start.y; arc.visible = false;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) dodge(dx > 0 ? 1 : -1);
  else if (-dy > 30) { const v = velFrom(dx, dy); throwChancla(v.x, v.y, v.z); }
  start = null;
});
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') dodge(-1); if (e.key === 'ArrowRight' || e.key === 'd') dodge(1); });
function dodge(d: number) { if (!playing) return; lane = Math.max(0, Math.min(2, lane + d)); beep(300, 0.06, 'triangle', 0.05); }

// ---------- effects ----------
let shake = 0, slow = 0;
function burst(p: THREE.Vector3) {
  const cols = [0xff3d7f, 0xffd23f, 0x1ec8c8, 0x8ae234, 0xb04bff, 0xff9f1c];
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: cols[i % cols.length] }));
    m.position.copy(p); scene.add(m);
    candy.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9), life: 2.5 });
  }
}
function enemyThrow() {
  const alive = objs.filter((o) => o.kind === 'enemy' && !o.down);
  if (!alive.length) return;
  const src = alive[Math.floor(Math.random() * alive.length)];
  const m = chanclaMesh(true); scene.add(m);
  const from = new THREE.Vector3(src.body.position.x, src.body.position.y + 0.5, src.body.position.z);
  incoming.push({ mesh: m as unknown as THREE.Mesh, from, to: new THREE.Vector3(LANES[lane], 1.4, 0.8), t: 0, lane });
  const w = $('warn'); w.style.display = 'block'; w.textContent = lane === 0 ? 'DODGE! →' : lane === 2 ? '← DODGE!' : '← DODGE! →';
  beep(880, 0.1, 'square', 0.06);
}

// ---------- loop ----------
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 62 : 50; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now: number) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (slow > 0) { slow -= dt; dt *= 0.25; }
  world.step(1 / 120, dt, 6);
  const wind = LV[li].wind;
  for (const s of shots) { s.age += dt; s.body.applyForce(new CANNON.Vec3(wind * s.body.mass, 0, 0)); s.mesh.position.copy(s.body.position as unknown as THREE.Vector3); s.mesh.quaternion.copy(s.body.quaternion as unknown as THREE.Quaternion);
    for (const p of pins) if (p.alive && p.mesh.position.distanceTo(s.mesh.position) < 1.1) { p.alive = false; scene.remove(p.mesh); burst(p.mesh.position); score += 250; shake = 0.4; slow = 0.5; beep(660, 0.25, 'triangle', 0.1); hud(); }
  }
  shots = shots.filter((s) => { if (s.age > 5) { world.removeBody(s.body); scene.remove(s.mesh); return false; } return true; });
  for (const o of objs) {
    o.mesh.position.copy(o.body.position as unknown as THREE.Vector3);
    o.mesh.quaternion.copy(o.body.quaternion as unknown as THREE.Quaternion);
    if (o.kind !== 'static' && !o.down) {
      const up = new CANNON.Vec3(0, 1, 0); o.body.quaternion.vmult(up, up);
      if (up.y < 0.55 || o.body.position.y < o.y0 - 0.6) { o.down = true; score += o.pts; hud(); if (o.kind === 'enemy') beep(200, 0.2, 'sawtooth', 0.08); }
    }
  }
  for (const p of pins) { p.t += dt; p.mesh.position.x = p.base.x + Math.sin(p.t * 1.3) * 0.6; p.mesh.rotation.z = Math.sin(p.t * 1.3) * 0.15; }
  for (const c of candy) { c.life -= dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); if (c.m.position.y < 0.06) { c.m.position.y = 0.06; c.v.multiplyScalar(0.5); c.v.y = Math.abs(c.v.y) * 0.4; } c.m.rotation.x += dt * 5; }
  for (let i = candy.length - 1; i >= 0; i--) if (candy[i].life <= 0) { scene.remove(candy[i].m); candy.splice(i, 1); }
  if (playing) {
    if (LV[li].throwEvery > 0) { throwT -= dt; if (throwT <= 0) { throwT = LV[li].throwEvery * (0.7 + Math.random() * 0.6); enemyThrow(); } }
    for (const e of incoming) {
      e.t += dt / 1.5; const k = Math.min(1, e.t);
      e.mesh.position.lerpVectors(e.from, e.to, k); e.mesh.position.y += Math.sin(k * Math.PI) * 3; e.mesh.rotation.x += dt * 15;
      if (k >= 1) { if (lane === e.lane) { hearts--; lostHeart = true; shake = 0.5; beep(90, 0.3, 'sawtooth', 0.12); stage.style.boxShadow = 'inset 0 0 80px red'; setTimeout(() => (stage.style.boxShadow = ''), 250); hud(); } else { score += 20; hud(); } }
    }
    incoming = incoming.filter((e) => { if (e.t >= 1) { scene.remove(e.mesh); return false; } return true; });
    if (!incoming.length) $('warn').style.display = 'none';
    if (hearts <= 0) endLevel(false);
    else if (enemiesLeft() === 0) { playing = false; setTimeout(() => endLevel(true), 900); }
    else if (ammo <= 0 && shots.every((s) => s.age > 3)) endLevel(false);
  }
  camX += (LANES[lane] - camX) * Math.min(1, dt * 10 / (slow > 0 ? 0.25 : 1));
  const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.5);
  camera.position.set(camX + sx, 2.1 + sy, 2.4); camera.lookAt(camX * 0.4, 1.4, -14);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as Record<string, unknown>).__s3d = { throwChancla, dodge, shots: () => shots.map((s) => [s.body.position.x, s.body.position.y, s.body.position.z].map((n) => +n.toFixed(2))), objs: () => objs.map((o) => [o.kind, +o.body.position.x.toFixed(2), +o.body.position.y.toFixed(2), +o.body.position.z.toFixed(2), !!o.down]), state: () => ({ li, score, ammo, hearts, lane, playing, left: enemiesLeft(), incoming: incoming.length }), startLevel, enemyThrow };
playStory('intro', () => startLevel(0));
