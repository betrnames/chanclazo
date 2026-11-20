// Chancla Strike Vertical (preview): portrait Angry Birds-style. The gold chancla sits in a slingshot at the
// bottom center; pull down and let go to fling it UP at sugar-skull forts on balconies near the top.
// Rendering: three.js (orthographic camera, world units: 16 tall). Physics: cannon-es, locked to the x/y plane.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initAudioControls } from './music';
import * as A from './flingAudio';

// ---------- tuning ----------
const G = -12;            // gravity, world units / s^2 (toward the bottom of the screen)
const VMAX = 19;          // launch speed at full pull (apex ~15 units above the sling = the whole screen)
const PULL_MAX = 2.2;     // world units of drag for full power
const WALL = 3.4;         // side walls at x = ±WALL (levels are built inside these)
const GROUND = 0.6;       // top of the ground
const SLING = new THREE.Vector2(0, 3.1);
const STEP = 1 / 120;

const $ = (id: string) => document.getElementById(id)!;
const stage = document.getElementById('stage') as HTMLDivElement;

// ---------- renderer / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-4, 4, 16, 0, -50, 50);
cam.position.z = 10;
scene.add(new THREE.AmbientLight(0xffe8d0, 1.6));
const sun = new THREE.DirectionalLight(0xffc27a, 1.4); sun.position.set(-3, 6, 8); scene.add(sun);
let viewW = 8, viewH = 16, viewB = 0;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false);
  const asp = w / h;
  if (asp >= (WALL * 2 + 0.2) / 16) { viewH = 16; viewW = 16 * asp; viewB = 0; }
  else { viewW = WALL * 2 + 0.2; viewH = viewW / asp; viewB = -(viewH - 16) * 0.5; }
  cam.left = -viewW / 2; cam.right = viewW / 2; cam.bottom = viewB; cam.top = viewB + viewH; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const toWorld = (cx: number, cy: number) => { const r = renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(cam.left + ((cx - r.left) / r.width) * viewW, viewB + (1 - (cy - r.top) / r.height) * viewH); };
const toScreen = (x: number, y: number) => ({ x: ((x - cam.left) / viewW) * stage.clientWidth, y: (1 - (y - viewB) / viewH) * stage.clientHeight });

// ---------- textures ----------
const loader = new THREE.TextureLoader();
const tex = (src: string) => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const TX = { chancla: tex('/s3d/chancla_gold.webp'), skull: tex('/s3d/skull.webp'), lucha: tex('/play/luchador_sprite.webp'), abuela: tex('/play/v2/abuela.webp') };
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, rep = false) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
const PAL = ['#e2197a', '#ff9f1c', '#ffd23f', '#1ec8c8', '#b04bff', '#3ddc84'];
const woodTex = canvasTex(128, 128, (c) => {
  c.fillStyle = '#8a4b22'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(${40 + Math.random() * 40},${15 + Math.random() * 20},5,.45)`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); const y = Math.random() * 128; c.moveTo(0, y); c.bezierCurveTo(40, y + 6, 80, y - 6, 128, y + 2); c.stroke(); }
  c.strokeStyle = '#ff9f1c'; c.lineWidth = 8; c.strokeRect(4, 4, 120, 120); c.strokeStyle = '#3a1608'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 125, 125);
});
const stoneTex = canvasTex(128, 128, (c) => {
  c.fillStyle = '#6d6386'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${.05 + Math.random() * .08})`; c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 7, 0, 7); c.fill(); }
  c.strokeStyle = '#1ec8c8'; c.lineWidth = 6; c.strokeRect(5, 5, 118, 118); c.strokeStyle = '#231a33'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 125, 125);
  c.fillStyle = '#ffd23f'; for (const [x, y] of [[20, 20], [108, 20], [20, 108], [108, 108]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
});
const ledgeTex = canvasTex(256, 64, (c) => {
  c.fillStyle = '#4a2a5e'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#ff9f1c'; c.fillRect(0, 0, 256, 9);
  for (let x = 0; x < 256; x += 16) { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x + 8, 6, 6, 0, 7); c.fill(); c.fillStyle = '#e8590c'; c.beginPath(); c.arc(x + 8, 6, 3, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = 0; x < 256; x += 32) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x, 64); c.stroke(); }
}, true);
const picadoTex = canvasTex(256, 48, (c) => {
  for (let i = 0; i < 8; i++) { c.fillStyle = PAL[i % PAL.length]; c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32 + 32, 0); c.lineTo(i * 32 + 32, 30); c.lineTo(i * 32 + 16, 46); c.lineTo(i * 32, 30); c.closePath(); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(i * 32 + 16, 16, 6, 0, 7); c.fill(); c.fillRect(i * 32 + 6, 6, 4, 4); c.fillRect(i * 32 + 22, 6, 4, 4); c.globalCompositeOperation = 'source-over'; }
}, true);
const wallTex = canvasTex(64, 256, (c) => {
  c.fillStyle = '#2a1636'; c.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 24) for (let x = (y / 24) % 2 ? -16 : 0; x < 64; x += 32) { c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, 30, 22); }
  }, true);
const groundTex = canvasTex(256, 64, (c) => {
  const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#5a2e1a'); g.addColorStop(1, '#1e0d12'); c.fillStyle = g; c.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 40; i++) { c.fillStyle = Math.random() < .6 ? '#ff9f1c' : '#ffd23f'; c.beginPath(); c.arc(Math.random() * 256, 4 + Math.random() * 10, 3 + Math.random() * 3, 0, 7); c.fill(); }
}, true);
const dotTex = canvasTex(32, 32, (c) => { const g = c.createRadialGradient(16, 16, 2, 16, 16, 15); g.addColorStop(0, '#fff6c8'); g.addColorStop(.5, '#ffd23f'); g.addColorStop(1, 'rgba(255,160,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); });

// ---------- static scenery ----------
{
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: groundTex })); groundTex.repeat.set(10, 1);
  gm.position.set(0, GROUND - 10, -1); scene.add(gm);
  // copy the top strip (marigolds) right at the ground line
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.9), new THREE.MeshBasicMaterial({ map: groundTex, transparent: true })); strip.position.set(0, GROUND - 0.35, -0.9); scene.add(strip);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 40), new THREE.MeshBasicMaterial({ map: wallTex })); wallTex.repeat.set(6, 10);
    w.position.set(s * (WALL + 3), 10, -0.5); if (s < 0) w.scale.x = -1; scene.add(w);
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 40), new THREE.MeshBasicMaterial({ color: 0xff9f1c })); lip.position.set(s * (WALL + 0.04), 10, -0.45); scene.add(lip);
  }
  // Abuela cheering at the bottom left
  const ab = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6 * 720 / 364), new THREE.MeshBasicMaterial({ map: TX.abuela, transparent: true, alphaTest: 0.05 }));
  ab.position.set(-2.15, GROUND + 1.45, -0.2); ab.name = 'abuela'; scene.add(ab);
  // Slingshot: Y fork made of marigold-painted wood
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a4b22 }), trim = new THREE.MeshLambertMaterial({ color: 0xff9f1c });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, SLING.y - GROUND - 0.2, 8), mat); post.position.set(0, (SLING.y - 0.2 + GROUND) / 2, -0.3); scene.add(post);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 8), mat); arm.position.set(s * 0.25, SLING.y + 0.15, -0.3); arm.rotation.z = -s * 0.5; scene.add(arm);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), trim); cap.position.set(s * 0.46, SLING.y + 0.55, -0.3); scene.add(cap);
  }
}
const PRONG = [new THREE.Vector3(-0.46, SLING.y + 0.55, -0.25), new THREE.Vector3(0.46, SLING.y + 0.55, 0.25)];
const bandMat = new THREE.LineBasicMaterial({ color: 0x3a1608 });
const bands = PRONG.map(() => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(g, bandMat); scene.add(l); return l; });
function setBands(x: number, y: number) { bands.forEach((b, i) => { const p = b.geometry.attributes.position as THREE.BufferAttribute; p.setXYZ(0, PRONG[i].x, PRONG[i].y, PRONG[i].z); p.setXYZ(1, x, y, PRONG[i].z); p.needsUpdate = true; }); }

// trajectory dots
const NDOTS = 34;
const dots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false }), NDOTS);
dots.frustumCulled = false; dots.visible = false; scene.add(dots);
const dm = new THREE.Matrix4();
function showDots(ox: number, oy: number, vx: number, vy: number) {
  let n = 0;
  for (let i = 1; i <= NDOTS; i++) {
    const t = i * 0.055, x = ox + vx * t, y = oy + vy * t + 0.5 * G * t * t;
    if (y < GROUND || Math.abs(x) > WALL) break;
    const s = 0.24 - i * 0.004; dm.makeScale(s, s, 1).setPosition(x, y, 0.5); dots.setMatrixAt(i - 1, dm); n++;
  }
  dots.count = n; dots.instanceMatrix.needsUpdate = true; dots.visible = true;
}

// ---------- physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, G, 0) });
world.allowSleep = true;
(world.solver as CANNON.GSSolver).iterations = 14;
world.broadphase = new CANNON.SAPBroadphase(world);
const mDefault = new CANNON.Material('d');
world.defaultContactMaterial.friction = 0.55; world.defaultContactMaterial.restitution = 0.12;
const flat = (b: CANNON.Body) => { b.linearFactor.set(1, 1, 0); b.angularFactor.set(0, 0, 1); return b; };
function addStatic(x: number, y: number, w: number, h: number) { const b = new CANNON.Body({ mass: 0, material: mDefault, position: new CANNON.Vec3(x, y, 0) }); b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, 1))); world.addBody(b); return b; }
addStatic(0, GROUND - 2, 40, 4);
const wallBodies = [-1, 1].map((s) => addStatic(s * (WALL + 1), 10, 2, 60));
wallBodies.forEach((w) => (w.material = new CANNON.Material('wall')));
world.addContactMaterial(new CANNON.ContactMaterial(mDefault, wallBodies[0].material!, { friction: 0.2, restitution: 0.55 }));
world.addContactMaterial(new CANNON.ContactMaterial(mDefault, wallBodies[1].material!, { friction: 0.2, restitution: 0.55 }));

// ---------- level objects ----------
type Kind = 'wood' | 'stone' | 'skull' | 'boss';
type Obj = { kind: Kind; body: CANNON.Body; mesh: THREE.Object3D; hp: number; y0: number; dead?: boolean; ko?: boolean };
let objs: Obj[] = [];
let levelMeshes: THREE.Object3D[] = [];
let levelBodies: CANNON.Body[] = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 0.8);
const woodMat = new THREE.MeshLambertMaterial({ map: woodTex }), stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });
const skullMat = new THREE.MeshBasicMaterial({ map: TX.skull, transparent: true, alphaTest: 0.05 });
const luchaMat = new THREE.MeshBasicMaterial({ map: TX.lucha, transparent: true, alphaTest: 0.05 });
const ledgeMat = new THREE.MeshLambertMaterial({ map: ledgeTex }), picadoMat = new THREE.MeshBasicMaterial({ map: picadoTex, transparent: true, side: THREE.DoubleSide });

function ledge(x: number, y: number, w: number) {
  const h = 0.5, b = addStatic(x, y, w, h); levelBodies.push(b);
  const m = new THREE.Mesh(boxGeo, ledgeMat); m.scale.set(w, h, 0.9); m.position.set(x, y, 0); scene.add(m); levelMeshes.push(m);
  const t = ledgeTex.clone(); t.needsUpdate = true; t.repeat.set(w / 2, 1); (m.material as THREE.MeshLambertMaterial) = new THREE.MeshLambertMaterial({ map: t });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.38), picadoMat.clone()); const pt = picadoTex.clone(); pt.needsUpdate = true; pt.repeat.set(w / 1.2, 1); (p.material as THREE.MeshBasicMaterial).map = pt;
  p.position.set(x, y - h / 2 - 0.17, 0.46); scene.add(p); levelMeshes.push(p);
}
function block(kind: 'wood' | 'stone', x: number, y: number, w: number, h: number) {
  const dens = kind === 'stone' ? 2.2 : 0.8;
  const b = flat(new CANNON.Body({ mass: w * h * dens, material: mDefault, position: new CANNON.Vec3(x, y, 0), sleepSpeedLimit: 0.15, sleepTimeLimit: 0.6 }));
  b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, 0.4))); b.linearDamping = 0.05; b.angularDamping = 0.2; world.addBody(b);
  const m = new THREE.Mesh(boxGeo, kind === 'stone' ? stoneMat : woodMat); m.scale.set(w, h, 1); scene.add(m);
  const o: Obj = { kind, body: b, mesh: m, hp: kind === 'stone' ? 3 : 2, y0: y }; objs.push(o); hookHits(o); return o;
}
function skull(x: number, y: number) {
  const r = 0.4; const b = flat(new CANNON.Body({ mass: 0.6, material: mDefault, position: new CANNON.Vec3(x, y, 0), sleepSpeedLimit: 0.15, sleepTimeLimit: 0.6 }));
  b.addShape(new CANNON.Sphere(r)); b.angularDamping = 0.4; b.linearDamping = 0.05; world.addBody(b);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98 * 160 / 141), skullMat); m.position.z = 0.3; scene.add(m);
  const o: Obj = { kind: 'skull', body: b, mesh: m, hp: 1, y0: y }; objs.push(o); hookHits(o); return o;
}
function boss(x: number, y: number) {
  const w = 0.8, h = 1.05; const b = flat(new CANNON.Body({ mass: 1.6, material: mDefault, position: new CANNON.Vec3(x, y, 0), sleepSpeedLimit: 0.15, sleepTimeLimit: 0.6 }));
  b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, 0.4))); b.angularDamping = 0.3; world.addBody(b);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05 * 384 / 306), luchaMat); m.position.z = 0.3; scene.add(m);
  const o: Obj = { kind: 'boss', body: b, mesh: m, hp: 2, y0: y }; objs.push(o); hookHits(o); return o;
}

type Level = { name: string; shots: number; build: () => void };
// Balconies hang off the side walls, so the middle column stays open for the chancla's climb.
const LEVELS: Level[] = [
  { name: 'Panteón balcony', shots: 3, build: () => {
    const T = 10.75; ledge(2.45, T - 0.25, 1.9);
    block('wood', 1.72, T + 0.6, 0.3, 1.2); block('wood', 3.18, T + 0.6, 0.3, 1.2);
    skull(2.45, T + 0.4); block('wood', 2.45, T + 1.33, 1.8, 0.25); skull(2.45, T + 1.86);
  } },
  { name: 'Mercado rooftops', shots: 3, build: () => {
    const L = 9.45; ledge(-2.4, L - 0.25, 2.0);
    block('stone', -3.05, L + 0.5, 0.35, 1.0); block('stone', -1.75, L + 0.5, 0.35, 1.0);
    skull(-2.4, L + 0.4); block('wood', -2.4, L + 1.13, 1.6, 0.25); skull(-2.4, L + 1.66);
    const R = 12.85; ledge(2.55, R - 0.25, 1.7);
    block('stone', 1.95, R + 0.25, 0.5, 0.5); block('stone', 1.95, R + 0.75, 0.5, 0.5);
    skull(2.65, R + 0.4); block('wood', 3.22, R + 0.65, 0.3, 1.3);
  } },
  { name: 'Lucha libre fort', shots: 4, build: () => {
    const L = 11.85; ledge(-2.3, L - 0.25, 2.2);
    block('stone', -3.05, L + 0.6, 0.35, 1.2); block('stone', -1.55, L + 0.6, 0.35, 1.2);
    boss(-2.3, L + 0.53); block('wood', -2.3, L + 1.33, 1.9, 0.25); skull(-2.3, L + 1.86);
    const R = 8.25; ledge(2.45, R - 0.25, 1.9);
    skull(1.95, R + 0.4); block('wood', 2.47, R + 0.5, 0.2, 1.0); skull(3.0, R + 0.4);
    const H = 13.85; ledge(2.85, H - 0.25, 1.1); skull(2.85, H + 0.4);
  } },
];

// ---------- game state ----------
type State = 'aim' | 'drag' | 'fly' | 'end';
let state: State = 'aim', lvl = 0, score = 0, shotsLeft = 0, levelScore0 = 0, prewarm = 0, flyT = 0, slowT = 0;
let chancla: { body: CANNON.Body; mesh: THREE.Mesh } | null = null;
const spent: { body: CANNON.Body; mesh: THREE.Mesh; t: number }[] = [];
const chanclaGeo = new THREE.PlaneGeometry(1.4, 1.4);
const chanclaMat = new THREE.MeshBasicMaterial({ map: TX.chancla, transparent: true, alphaTest: 0.05 });
const ready = new THREE.Mesh(chanclaGeo, chanclaMat); ready.position.set(SLING.x, SLING.y, 0.6); scene.add(ready);
let muted = false;

const hudScore = $('score'), hudLvl = $('lvl'), hudShots = $('shots'), hint = $('hint'), banner = $('banner');
function drawHud() {
  hudScore.textContent = String(score); hudLvl.textContent = String(lvl + 1);
  const total = LEVELS[lvl].shots; hudShots.innerHTML = Array.from({ length: total }, (_, i) => `<img src="/s3d/chancla_gold.webp" alt="" class="${i < total - shotsLeft ? 'used' : ''}">`).join('');
}
function popup(x: number, y: number, text: string, color = '#fff') {
  const s = toScreen(x, y), d = document.createElement('div'); d.className = 'pop'; d.textContent = text; d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; d.style.color = color; stage.appendChild(d); setTimeout(() => d.remove(), 950);
}
let bannerT = 0;
function showBanner(t: string, ms = 1100) { banner.textContent = t; banner.classList.add('on'); clearTimeout(bannerT); bannerT = window.setTimeout(() => banner.classList.remove('on'), ms); }

// petals burst on knockouts
const petals: { m: THREE.Mesh; vx: number; vy: number; vr: number; life: number }[] = [];
const petalGeo = new THREE.PlaneGeometry(0.16, 0.16);
const petalMats = PAL.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, side: THREE.DoubleSide }));
function burst(x: number, y: number, n = 16) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(petalGeo, petalMats[i % petalMats.length].clone()); m.position.set(x, y, 0.8); scene.add(m); const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4; petals.push({ m, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 2, vr: (Math.random() - .5) * 14, life: 0.9 + Math.random() * 0.5 }); } }
let shake = 0;

function hookHits(o: Obj) {
  o.body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
    if (prewarm > 0 || o.dead || state === 'end') return;
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v < 1.2) return;
    if (o.kind === 'wood' || o.kind === 'stone') A.knock(o.kind, v * 2);
    const fromChancla = chancla && e.body === chancla.body;
    const thr = o.kind === 'skull' ? 3.0 : o.kind === 'boss' ? 3.5 : o.kind === 'wood' ? 5.5 : 8;
    if (v > thr || (fromChancla && v > thr * 0.6)) { o.hp -= v > thr * 2.4 ? 2 : 1; if (o.hp <= 0) queueMicrotask(() => kill(o)); else if (o.kind === 'boss') { popup(o.body.position.x, o.body.position.y + 0.7, '¡Ay!', '#ff4d6d'); A.clang(); } }
  });
}
function kill(o: Obj) {
  if (o.dead) return; o.dead = true;
  const { x, y } = o.body.position;
  if (o.kind === 'skull' || o.kind === 'boss') { const pts = o.kind === 'boss' ? 1500 : 500; score += pts; popup(x, y + 0.5, '+' + pts, '#ffd23f'); burst(x, y, o.kind === 'boss' ? 30 : 18); A.knockout(); shake = Math.max(shake, o.kind === 'boss' ? 0.25 : 0.12); }
  else { score += 100; popup(x, y, '+100'); burst(x, y, 8); if (o.kind === 'wood') A.breakWood(); else A.breakStone(); }
  world.removeBody(o.body); scene.remove(o.mesh); drawHud();
  if (targetsLeft() === 0 && state !== 'end') setTimeout(levelClear, 900);
}
const targetsLeft = () => objs.filter((o) => (o.kind === 'skull' || o.kind === 'boss') && !o.dead).length;

function clearLevel() {
  for (const o of objs) { world.removeBody(o.body); scene.remove(o.mesh); }
  for (const b of levelBodies) world.removeBody(b);
  for (const m of levelMeshes) scene.remove(m);
  for (const s of spent) { world.removeBody(s.body); scene.remove(s.mesh); }
  if (chancla) { world.removeBody(chancla.body); scene.remove(chancla.mesh); chancla = null; }
  objs = []; levelBodies = []; levelMeshes = []; spent.length = 0;
}
function startLevel(i: number) {
  clearLevel(); lvl = i; LEVELS[i].build(); shotsLeft = LEVELS[i].shots; levelScore0 = score;
  // let the stacks settle silently before the first shot
  prewarm = 1; for (let k = 0; k < 90; k++) world.step(STEP); prewarm = 0;
  for (const o of objs) o.y0 = o.body.position.y;
  state = 'aim'; ready.visible = true; ready.position.set(SLING.x, SLING.y, 0.6); setBands(SLING.x, SLING.y); dots.visible = false;
  $('end').classList.add('hidden'); drawHud(); showBanner(`${i + 1}. ${LEVELS[i].name}`, 1300);
}

// ---------- input ----------
let dragStart: THREE.Vector2 | null = null, pull = new THREE.Vector2();
const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  if (state !== 'aim') return; e.preventDefault(); el.setPointerCapture?.(e.pointerId);
  dragStart = toWorld(e.clientX, e.clientY); pull.set(0, 0); state = 'drag'; A.stretchStart();
});
el.addEventListener('pointermove', (e) => {
  if (state !== 'drag' || !dragStart) return; e.preventDefault();
  const p = toWorld(e.clientX, e.clientY); pull.copy(p).sub(dragStart); if (pull.length() > PULL_MAX) pull.setLength(PULL_MAX);
  if (pull.y > 0.6) pull.y = 0.6; // you pull down/back, not up
  const ox = SLING.x + pull.x, oy = Math.max(GROUND + 0.6, SLING.y + pull.y); ready.position.set(ox, oy, 0.6); setBands(ox, oy); // never pulled into the ground
  const k = pull.length() / PULL_MAX; A.stretch(k);
  if (k > 0.08) { const v = pull.clone().multiplyScalar(-VMAX / PULL_MAX); showDots(ox, oy, v.x, v.y); } else dots.visible = false;
});
const release = (e: PointerEvent) => {
  A.unlock();
  if (state !== 'drag') return; e.preventDefault(); A.stretchStop(); dots.visible = false;
  if (pull.length() < 0.3 || pull.y > -0.05) { state = 'aim'; ready.position.set(SLING.x, SLING.y, 0.6); setBands(SLING.x, SLING.y); return; }
  const v = pull.clone().multiplyScalar(-VMAX / PULL_MAX); launch(SLING.x + pull.x, Math.max(GROUND + 0.6, SLING.y + pull.y), v.x, v.y);
};
el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);

function launch(ox: number, oy: number, vx: number, vy: number) {
  if (shotsLeft <= 0) return;
  shotsLeft--; drawHud(); hint.classList.add('off');
  const b = flat(new CANNON.Body({ mass: 1.4, material: mDefault, position: new CANNON.Vec3(ox, oy, 0), allowSleep: false }));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.34, 0.13, 0.3))); b.linearDamping = 0; b.angularDamping = 0.1;
  b.velocity.set(vx, vy, 0); b.angularVelocity.set(0, 0, -Math.sign(vx || 1) * 7); world.addBody(b);
  const m = new THREE.Mesh(chanclaGeo, chanclaMat); m.position.set(ox, oy, 0.6); scene.add(m);
  chancla = { body: b, mesh: m }; ready.visible = false; setBands(SLING.x, SLING.y);
  const pw = Math.hypot(vx, vy) / VMAX; A.twang(pw); A.whoosh(pw);
  state = 'fly'; flyT = 0; slowT = 0;
}
function shotDone() {
  if (state === 'end') return;
  if (chancla) { spent.push({ ...chancla, t: 0 }); chancla = null; }
  if (targetsLeft() === 0) return; // levelClear is already queued
  if (shotsLeft > 0) { state = 'aim'; ready.visible = true; ready.position.set(SLING.x, SLING.y, 0.6); setBands(SLING.x, SLING.y); }
  else { state = 'end'; setTimeout(() => endCard(false), 400); }
}
function levelClear() {
  if (state === 'end') return; state = 'end';
  const bonus = shotsLeft * 1000; score += bonus; drawHud();
  showBanner('¡Chanclazo!', 900);
  setTimeout(() => endCard(true, bonus), 950);
}
function endCard(win: boolean, bonus = 0) {
  const total = LEVELS[lvl].shots, stars = win ? Math.min(3, 1 + shotsLeft) : 0, last = lvl === LEVELS.length - 1;
  $('endTitle').textContent = win ? (last ? '¡Todos caídos!' : 'Level clear!') : 'Out of chanclas';
  $('stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('');
  $('endMsg').textContent = win ? `${score - levelScore0} points this level${bonus ? ` (incl. ${bonus} for ${shotsLeft} spare chancla${shotsLeft > 1 ? 's' : ''})` : ''}. Total ${score}.` : `${targetsLeft()} calaca${targetsLeft() > 1 ? 's' : ''} still standing. Used ${total} of ${total}.`;
  const next = $('next') as HTMLButtonElement; next.classList.toggle('hidden', !win); next.textContent = last ? 'Play again' : 'Next level';
  $('end').classList.remove('hidden');
  (window as any).__sv.lastEnd = { win, level: lvl + 1, score };
}
$('next').onclick = () => { A.unlock(); if (lvl === LEVELS.length - 1) { score = 0; startLevel(0); } else startLevel(lvl + 1); };
$('retry').onclick = () => { A.unlock(); score = levelScore0; startLevel(lvl); };
$('restart').onclick = (e) => { e.stopPropagation(); A.unlock(); score = levelScore0; startLevel(lvl); };

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
  let n = 0; while (acc >= STEP && n < 8) { world.step(STEP); acc -= STEP; n++; }
  // fall-off knockouts
  for (const o of objs) {
    if (o.dead) continue; const p = o.body.position;
    if ((o.kind === 'skull' || o.kind === 'boss') && (p.y < o.y0 - 1.3 || p.y < GROUND + 0.2)) kill(o);
    else if (p.y < -3 || Math.abs(p.x) > WALL + 2) kill(o);
    o.mesh.position.set(p.x, p.y, o.mesh.position.z); o.mesh.quaternion.set(o.body.quaternion.x, o.body.quaternion.y, o.body.quaternion.z, o.body.quaternion.w);
  }
  if (chancla) {
    const b = chancla.body; chancla.mesh.position.set(b.position.x, b.position.y, 0.6); chancla.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    if (state === 'fly') {
      flyT += dt; slowT = b.velocity.length() < 0.6 ? slowT + dt : 0;
      if (b.position.y < -2 || slowT > 0.6 || flyT > 6) shotDone();
    }
  }
  for (let i = spent.length - 1; i >= 0; i--) { const s = spent[i]; s.t += dt; s.mesh.position.set(s.body.position.x, s.body.position.y, 0.6); s.mesh.quaternion.set(s.body.quaternion.x, s.body.quaternion.y, s.body.quaternion.z, s.body.quaternion.w);
    if (s.t > 1.2) { (s.mesh.material as THREE.MeshBasicMaterial) = chanclaMat; s.mesh.scale.setScalar(Math.max(0.01, 1 - (s.t - 1.2) * 2)); }
    if (s.t > 1.7) { world.removeBody(s.body); scene.remove(s.mesh); spent.splice(i, 1); } }
  for (let i = petals.length - 1; i >= 0; i--) { const p = petals[i]; p.life -= dt; p.vy += G * 0.35 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.rotation.z += p.vr * dt; (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life); if (p.life <= 0) { scene.remove(p.m); petals.splice(i, 1); } }
  if (state === 'aim') ready.position.y = SLING.y + Math.sin(now / 300) * 0.04;
  if (shake > 0) { shake = Math.max(0, shake - dt * 0.8); cam.position.x = (Math.random() - .5) * shake; cam.position.y = (Math.random() - .5) * shake; } else { cam.position.x = 0; cam.position.y = 0; }
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

initAudioControls('fling', (m) => { muted = m; A.setMuted(m); });
void muted;
// small test hook (headless checks): state, targets, and a scripted launch
(window as any).__sv = { get state() { return state; }, get level() { return lvl + 1; }, get score() { return score; }, get shotsLeft() { return shotsLeft; }, get ch() { return chancla ? [+chancla.body.position.x.toFixed(2), +chancla.body.position.y.toFixed(2), +chancla.body.velocity.x.toFixed(2), +chancla.body.velocity.y.toFixed(2)] : null; }, targetsLeft, targets: () => objs.filter((o) => !o.dead && (o.kind === 'skull' || o.kind === 'boss')).map((o) => [o.kind, +o.body.position.x.toFixed(2), +o.body.position.y.toFixed(2)]), launch: (vx: number, vy: number) => { if (state === 'aim') { const k = PULL_MAX / VMAX; launch(SLING.x - vx * k, Math.max(GROUND + 0.6, SLING.y - vy * k), vx, vy); } }, G, VMAX };
startLevel(0);
requestAnimationFrame(frame);
