// Chanclazo 3D: Strike Mode (demo). Throw chanclas, break everything, dodge the mad abuela.
import * as THREE from 'three';
import { initAudio, playWhoosh, playHit, playStrike, playMomHit, playCombo, playGameOver, playDodge, setMuted, isMuted } from '../game/sound';

const $ = (id: string) => document.getElementById(id)!;
const ROAD = 5.2, SPAWN_Z = -75, BEST_KEY = 'chanclazo-strike-best';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
(document.body as HTMLElement).insertBefore(renderer.domElement, document.body.firstChild);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf4b27a, 55, 120);
const loader = new THREE.TextureLoader();
const tex = (u: string) => { const t = loader.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; };
scene.background = tex('/cruise/bg_mercado.webp');
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const CAM = new THREE.Vector3(0, 4.6, 9);
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x8a4b2a, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(6, 14, 6); scene.add(sun);
function fitCam() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 78 : 60; // portrait phones see the whole street
  camera.updateProjectionMatrix();
}
fitCam();

// ── Street ───────────────────────────────────────────────────────────────────
function streetTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c98b5a'; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
    g.fillStyle = `hsl(${20 + Math.random() * 8},45%,${46 + Math.random() * 10}%)`; g.fillRect(x + 1, y + 1, 30, 30);
  }
  g.fillStyle = '#7a3d1d'; g.fillRect(0, 0, 10, 512); g.fillRect(246, 0, 10, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 18); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const roadTex = streetTex();
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2 + 1, 200), new THREE.MeshLambertMaterial({ map: roadTex }));
road.rotation.x = -Math.PI / 2; road.position.z = -85; scene.add(road);
const walk = new THREE.Mesh(new THREE.PlaneGeometry(70, 200), new THREE.MeshLambertMaterial({ color: 0xe8c39e }));
walk.rotation.x = -Math.PI / 2; walk.position.set(0, -0.02, -85); scene.add(walk);
const COLORS = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xff9f1c, 0x9b5de5];
const houses: THREE.Mesh[] = [];
const box = new THREE.BoxGeometry(1, 1, 1);
for (let i = 0; i < 24; i++) {
  const s = i % 2 ? 1 : -1, h = 3 + Math.random() * 4;
  const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: COLORS[i % 7] }));
  m.scale.set(5, h, 9); m.position.set(s * (ROAD + 7 + Math.random() * 1.5), h / 2, -Math.floor(i / 2) * 10);
  scene.add(m); houses.push(m);
}

// ── Characters (existing Chanclazo art + a drawn calaca) ─────────────────────
function sheet(url: string, cols = 5, rows = 5) {
  const t = tex(url); t.repeat.set(1 / cols, 1 / rows); t.offset.set(0, (rows - 1) / rows);
  return { t, cols, rows, n: cols * rows };
}
function frame(s: ReturnType<typeof sheet>, f: number) {
  const i = Math.floor(f) % s.n; s.t.offset.set((i % s.cols) / s.cols, (s.rows - 1 - Math.floor(i / s.cols)) / s.rows);
}
const luchaTex = tex('/cruise/luchador.webp');
const pinataTex = tex('/cruise/pinata.webp');
const momiTex = tex('/cruise/momi512.webp');
// Calaca: skeleton in a charro suit, sugar-skull head, drawn on a canvas.
const calacaCanvas = document.createElement('canvas'); calacaCanvas.width = 256; calacaCanvas.height = 512;
const calacaTex = new THREE.CanvasTexture(calacaCanvas); calacaTex.colorSpace = THREE.SRGBColorSpace;
(() => {
  const g = calacaCanvas.getContext('2d')!;
  const bone = (x1: number, y1: number, x2: number, y2: number, w = 14) => {
    g.strokeStyle = '#1b1020'; g.lineWidth = w + 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = '#fbf6ea'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };
  // charro jacket
  g.fillStyle = '#1b1020'; g.beginPath(); g.moveTo(78, 200); g.lineTo(178, 200); g.lineTo(190, 330); g.lineTo(66, 330); g.closePath(); g.fill();
  g.strokeStyle = '#ffd166'; g.lineWidth = 5; for (let y = 220; y < 320; y += 22) { g.beginPath(); g.arc(128, y, 4, 0, 7); g.stroke(); }
  g.fillStyle = '#f72585'; g.beginPath(); g.moveTo(108, 200); g.lineTo(148, 200); g.lineTo(128, 226); g.fill(); // bow tie
  bone(80, 210, 40, 300); bone(40, 300, 30, 250); // arm waving
  bone(176, 210, 214, 300); bone(214, 300, 226, 360);
  bone(100, 330, 92, 420); bone(92, 420, 86, 490); bone(156, 330, 164, 420); bone(164, 420, 172, 490);
  g.fillStyle = '#1b1020'; g.fillRect(60, 486, 46, 18); g.fillRect(152, 486, 46, 18);
  const head = new Image();
  head.onload = () => { g.drawImage(head, 48, 30, 160, 160); calacaTex.needsUpdate = true; };
  head.src = '/cruise/sugarskull256.webp';
})();
// Player: the Chanclazo kid, seen from behind, with the existing throw sheet
const throwSheet = sheet('/cruise/boy-strike_back-v3.webp');
const kid = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: throwSheet.t, transparent: true, alphaTest: 0.3 }));
const player = new THREE.Group(); player.add(kid); kid.position.y = 1.2; scene.add(player);
// Mad abuela, ahead on the street
const abuela = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), new THREE.MeshBasicMaterial({ map: momiTex, transparent: true, alphaTest: 0.3, fog: false }));
abuela.position.set(0, 3.8, -34); scene.add(abuela);

// ── Particles ────────────────────────────────────────────────────────────────
interface P { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number; max: number }
const parts: P[] = [];
const shardGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25), flatGeo = new THREE.PlaneGeometry(0.35, 0.35);
function burst(pos: THREE.Vector3, colors: number[], n = 16, power = 7, flat = false) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(flat ? flatGeo : shardGeo, new THREE.MeshLambertMaterial({ color: colors[i % colors.length], transparent: true, side: THREE.DoubleSide }));
    m.position.copy(pos); scene.add(m);
    const s = 0.6 + Math.random() * 1.2; m.scale.setScalar(s);
    parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * power, Math.random() * power * 0.9 + 2, (Math.random() - 0.3) * power),
      spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), life: 0, max: 0.9 + Math.random() * 0.6 });
  }
}

// ── Targets ──────────────────────────────────────────────────────────────────
type Kind = 'luchador' | 'calaca' | 'pinata' | 'pot' | 'crate' | 'picado';
interface T { kind: Kind; obj: THREE.Object3D; hp: number; pts: number; r: number; h: number; vx: number; t: number; dead?: boolean; flash: number }
const targets: T[] = [];
const SC = 1.4;
const potMat = new THREE.MeshLambertMaterial({ color: 0xc2410c }), potBand = new THREE.MeshLambertMaterial({ color: 0x4cc9f0 });
const crateMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const SPEC: Record<Kind, { hp: number; pts: number; r: number; h: number; colors: number[] }> = {
  luchador: { hp: 2, pts: 150, r: 1.1, h: 3.6, colors: [0xd62828, 0xffd166, 0x8b1e1e] },
  calaca: { hp: 1, pts: 100, r: 0.9, h: 3.2, colors: [0xfbf6ea, 0x1b1020, 0xf72585] },
  pinata: { hp: 3, pts: 300, r: 1.1, h: 3.2, colors: [0xf72585, 0xffd166, 0x06d6a0, 0x4cc9f0, 0x9b5de5] },
  pot: { hp: 1, pts: 40, r: 0.7, h: 1.3, colors: [0xc2410c, 0x4cc9f0, 0xe8a87c] },
  crate: { hp: 1, pts: 40, r: 0.8, h: 1.4, colors: [0x8b5a2b, 0xa0703c] },
  picado: { hp: 1, pts: 60, r: 3.2, h: 1.6, colors: COLORS },
};
function billboard(map: THREE.Texture, w: number, h: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.3 }));
  m.position.y = h / 2; m.userData.bb = true; return m;
}
function spawn(kind: Kind, x: number, z = SPAWN_Z) {
  const g = new THREE.Group();
  if (kind === 'luchador') g.add(billboard(luchaTex, 3.8, 3.8));
  else if (kind === 'calaca') g.add(billboard(calacaTex, 1.8, 3.6));
  else if (kind === 'pinata') { const b = billboard(pinataTex, 2.3, 3.4); b.position.y = 2.8; g.add(b); }
  else if (kind === 'pot') {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), potMat); p.scale.y = 1.1; p.position.y = 0.66;
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.4, 12), potMat); n.position.y = 1.35;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 20), potBand); band.rotation.x = Math.PI / 2; band.position.y = 0.7;
    g.add(p, n, band);
  } else if (kind === 'crate') { const c = new THREE.Mesh(box, crateMat); c.scale.set(1.4, 1.4, 1.4); c.position.y = 0.7; g.add(c); }
  else {
    for (let k = 0; k < 9; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshBasicMaterial({ color: COLORS[k % 7], side: THREE.DoubleSide }));
      f.position.set(-2.8 + k * 0.7, 4.2 - Math.cos((k - 4) / 4) * 0.4, 0); g.add(f);
    }
  }
  g.position.set(x, 0, z); if (kind !== 'picado') g.scale.setScalar(SC); scene.add(g);
  const s = SPEC[kind];
  targets.push({ kind, obj: g, hp: s.hp, pts: s.pts, r: s.r, h: s.h, vx: kind === 'calaca' ? (Math.random() < 0.5 ? -2 : 2) : 0, t: Math.random() * 6, flash: 0 });
}

// ── Projectiles ──────────────────────────────────────────────────────────────
interface Shot { m: THREE.Mesh; v: THREE.Vector3; s: ReturnType<typeof sheet>; f: number; enemy: boolean; life: number }
const shots: Shot[] = [];
function chanclaMesh() {
  const s = sheet('/cruise/chancla_spin.webp');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: s.t, transparent: true, alphaTest: 0.3 }));
  scene.add(m); return { m, s };
}

// ── State ────────────────────────────────────────────────────────────────────
const st = { running: false, t: 0, speed: 10, px: 0, steer: 0, score: 0, combo: 0, streak: 0, lives: 3, hurt: 0,
  cool: 0, throwAnim: -1, spawnIn: 0, abuelaIn: 4, stun: 0, shake: 0, best: parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0 };
const input = { l: false, r: false };
$('best').textContent = `Best ${st.best.toLocaleString()}`;
const mult = () => 1 + Math.floor(st.combo / 3);
function hud() {
  $('score').textContent = `${st.score.toLocaleString()}${mult() > 1 ? `  x${mult()}` : ''}`;
  $('speed').textContent = '❤'.repeat(st.lives) + '♡'.repeat(Math.max(0, 3 - st.lives));
}
function flash(msg: string, color = '#ffd700') {
  const el = $('trick'); el.textContent = msg; el.style.color = color; el.style.opacity = '1';
  clearTimeout((flash as any).t); (flash as any).t = setTimeout(() => (el.style.opacity = '0'), 650);
}
function reset() {
  initAudio();
  for (const t of targets) scene.remove(t.obj); targets.length = 0;
  for (const s of shots) scene.remove(s.m); shots.length = 0;
  Object.assign(st, { running: true, t: 0, speed: 10, px: 0, steer: 0, score: 0, combo: 0, streak: 0, lives: 3, hurt: 0, cool: 0, throwAnim: -1, spawnIn: 0, abuelaIn: 4, stun: 0, shake: 0 });
  $('start').classList.add('hidden'); $('over').classList.add('hidden'); hud();
}
function gameOver() {
  st.running = false; playGameOver();
  if (st.score > st.best) { st.best = st.score; localStorage.setItem(BEST_KEY, String(st.score)); }
  $('best').textContent = `Best ${st.best.toLocaleString()}`;
  $('overMsg').textContent = 'The abuela got you three times. Nobody escapes the chancla.';
  $('overScore').textContent = `${st.score.toLocaleString()} pts`;
  $('over').classList.remove('hidden');
}

// ── Throwing (aim with a tap or click) ───────────────────────────────────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.4);
function throwAt(cx: number, cy: number) {
  if (!st.running || st.cool > 0) return;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const objs: THREE.Object3D[] = []; targets.forEach(t => !t.dead && objs.push(t.obj)); objs.push(abuela);
  const hit = ray.intersectObjects(objs, true)[0];
  const aim = hit ? hit.point.clone() : (ray.ray.intersectPlane(groundPlane, new THREE.Vector3()) ?? new THREE.Vector3(st.px, 1.4, -40));
  if (aim.z > -2) aim.z = -2;
  const from = new THREE.Vector3(st.px + 0.6, 2.6, -0.5);
  const dist = from.distanceTo(aim), T = THREE.MathUtils.clamp(dist / 55, 0.12, 0.9);
  if (!hit || hit.object !== abuela) aim.z += st.speed * T; // lead moving targets
  const { m, s } = chanclaMesh(); m.position.copy(from);
  const v = aim.sub(from).divideScalar(T); v.y += 0.5 * 14 * T; // arc
  shots.push({ m, v, s, f: 0, enemy: false, life: 0 });
  st.cool = 0.22; st.throwAnim = 0; playWhoosh(1.2);
}
function abuelaThrow() {
  const { m, s } = chanclaMesh(); m.position.set(abuela.position.x, 4.5, abuela.position.z + 1);
  const T = Math.max(1.1, 1.8 - st.t / 90);
  const tx = THREE.MathUtils.clamp(st.px + st.steer * 1.5 + (Math.random() - 0.5) * 3, -ROAD + 0.5, ROAD - 0.5);
  const v = new THREE.Vector3((tx - m.position.x) / T, (2 - 4.5 + 0.5 * 9.8 * T * T) / T, (0 - m.position.z) / T);
  m.scale.setScalar(1.3); shots.push({ m, v, s, f: 0, enemy: true, life: 0 });
}

function hitTarget(t: T, at: THREE.Vector3) {
  t.hp--; t.flash = 0.15; st.shake = Math.max(st.shake, 0.25);
  const spec = SPEC[t.kind];
  burst(at, spec.colors, 6, 4);
  if (t.hp > 0) { playHit(); t.obj.position.z -= 1.5; return; }
  t.dead = true; st.combo++; st.streak++;
  const gain = t.pts * mult(); st.score += gain;
  st.shake = t.kind === 'pinata' ? 0.6 : 0.4;
  const center = t.obj.position.clone(); center.y = t.kind === 'pinata' ? 2.8 : t.h * 0.5;
  burst(center, spec.colors, t.kind === 'pinata' ? 40 : t.kind === 'picado' ? 26 : 20, t.kind === 'pinata' ? 11 : 7, t.kind === 'picado' || t.kind === 'pinata');
  if (t.kind === 'pinata') burst(center, [0xffd166, 0xff6b6b, 0x06d6a0], 20, 9); // candy
  playStrike(); if (st.combo % 3 === 0) playCombo(st.combo);
  const label = t.kind === 'luchador' ? '¡KNOCKOUT!' : t.kind === 'calaca' ? '¡CALACA DOWN!' : t.kind === 'pinata' ? '¡PIÑATA!' : 'SMASH!';
  flash(`${label} +${gain}${st.streak >= 3 ? `  ${st.streak} STREAK` : ''}`);
  scene.remove(t.obj);
}

// ── Loop ─────────────────────────────────────────────────────────────────────
let last = performance.now();
function loop() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (st.running) step(dt);
  // camera + shake
  const sh = st.shake; st.shake = Math.max(0, st.shake - dt * 1.6);
  camera.position.set(CAM.x + st.px * 0.4 + (Math.random() - 0.5) * sh, CAM.y + (Math.random() - 0.5) * sh, CAM.z);
  camera.lookAt(st.px * 0.3, 1.6, -16);
  for (const p of parts) {
    p.life += dt; p.v.y -= 16 * dt; p.m.position.addScaledVector(p.v, dt); p.m.position.z += st.running ? st.speed * dt : 0;
    if (p.m.position.y < 0.1) { p.m.position.y = 0.1; p.v.multiplyScalar(0.5); p.v.y *= -0.4; }
    p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt;
    (p.m.material as THREE.MeshLambertMaterial).opacity = 1 - p.life / p.max;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life > parts[i].max) { scene.remove(parts[i].m); parts.splice(i, 1); }
  scene.traverse(o => { if (o.userData.bb) o.quaternion.copy(camera.quaternion); });
  kid.quaternion.copy(camera.quaternion); abuela.quaternion.copy(camera.quaternion);
  for (const s of shots) s.m.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function step(dt: number) {
  st.t += dt; st.speed = Math.min(22, 10 + st.t * 0.12);
  const move = st.speed * dt;
  st.cool -= dt; st.hurt -= dt; st.stun -= dt;
  const want = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  st.steer += (want - st.steer) * Math.min(1, dt * 10);
  st.px = THREE.MathUtils.clamp(st.px + st.steer * dt * 9, -ROAD + 0.6, ROAD - 0.6);
  player.position.x = st.px;
  if (st.throwAnim >= 0) { st.throwAnim += dt * 40; if (st.throwAnim >= 24) st.throwAnim = -1; }
  frame(throwSheet, st.throwAnim >= 0 ? st.throwAnim : 7);
  (kid.material as THREE.MeshBasicMaterial).opacity = st.hurt > 0 && Math.floor(st.t * 20) % 2 ? 0.3 : 1;

  roadTex.offset.y += move / (200 / 18);
  for (const h of houses) { h.position.z += move; if (h.position.z > 15) h.position.z -= 12 * 10; }

  // Abuela: tracks the player, throws, gets stunned when hit
  const ab = abuela.material as THREE.MeshBasicMaterial;
  if (st.stun > 0) { abuela.rotation.z = Math.sin(st.t * 30) * 0.2; ab.color.setHex(0xffaaaa); }
  else {
    ab.color.setHex(0xffffff);
    abuela.position.x += (st.px - abuela.position.x) * dt * 0.7;
    abuela.position.y = 3.8 + Math.abs(Math.sin(st.t * 5)) * 0.35;
    st.abuelaIn -= dt;
    if (st.abuelaIn <= 0) { abuelaThrow(); st.abuelaIn = Math.max(1.5, 3.4 - st.t / 40) * (0.7 + Math.random() * 0.6); }
  }

  // Spawning
  st.spawnIn -= move;
  if (st.spawnIn <= 0) {
    const r = Math.random(), x = () => (Math.random() * 2 - 1) * (ROAD - 1.2);
    if (r < 0.25) spawn('luchador', x());
    else if (r < 0.48) spawn('calaca', x());
    else if (r < 0.58) spawn('pinata', x());
    else if (r < 0.72) spawn('picado', 0);
    else { const n = 2 + Math.floor(Math.random() * 3), x0 = x(); for (let k = 0; k < n; k++) spawn(Math.random() < 0.5 ? 'pot' : 'crate', THREE.MathUtils.clamp(x0 + (k - n / 2) * 1.6, -ROAD + 0.7, ROAD - 0.7), SPAWN_Z - k * 0.5); }
    st.spawnIn = Math.max(6, 13 - st.t * 0.08);
  }
  for (const t of targets) {
    if (t.dead) continue;
    t.t += dt; t.obj.position.z += move;
    if (t.kind === 'calaca') { t.obj.position.x += t.vx * dt; if (Math.abs(t.obj.position.x) > ROAD - 1) t.vx *= -1; t.obj.children[0].position.y = 1.8 + Math.abs(Math.sin(t.t * 7)) * 0.4; }
    if (t.kind === 'luchador') t.obj.children[0].position.y = 1.9 + Math.abs(Math.sin(t.t * 4)) * 0.25;
    if (t.kind === 'pinata') t.obj.rotation.z = Math.sin(t.t * 3) * 0.12;
    t.flash -= dt;
    t.obj.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m?.color && o.userData.bb) m.color.setHex(t.flash > 0 ? 0xff7777 : 0xffffff); });
    if (t.obj.position.z > 6) { t.dead = true; scene.remove(t.obj); if (t.kind !== 'picado') { st.streak = 0; } }
  }
  for (let i = targets.length - 1; i >= 0; i--) if (targets[i].dead) targets.splice(i, 1);

  // Projectiles
  for (const s of shots) {
    s.life += dt; s.v.y -= (s.enemy ? 9.8 : 14) * dt; s.m.position.addScaledVector(s.v, dt);
    s.f += dt * 40; frame(s.s, s.f);
    const p = s.m.position;
    if (s.enemy) {
      if (Math.abs(p.z) < 0.9 && Math.abs(p.x - st.px) < 1.0 && p.y < 4.5 && st.hurt <= 0) {
        s.life = 99; st.lives--; st.hurt = 1.2; st.combo = 0; st.streak = 0; st.shake = 0.8; playMomHit();
        flash('¡CHANCLAZO! Ouch!', '#ff4d4d'); burst(new THREE.Vector3(st.px, 2.5, 0), [0xffffff, 0xffd166], 10, 5); hud();
        if (st.lives <= 0) { gameOver(); return; }
      } else if (p.z > 2 && p.z < 2.5 && Math.abs(p.x - st.px) < 2.5 && st.hurt <= 0) { playDodge(); }
      if (p.z > 8 || p.y < 0) s.life = 99;
      continue;
    }
    // player shot vs targets
    for (const t of targets) {
      if (t.dead) continue;
      const o = t.obj.position, k = t.kind === 'picado' ? 1 : SC, cy = (t.kind === 'picado' ? 4.1 : t.kind === 'pinata' ? 2.8 : t.h / 2) * k;
      const hy = (t.kind === 'picado' ? 0.7 : t.kind === 'pinata' ? 1.6 : t.h / 2 + 0.3) * k;
      if (Math.abs(p.z - o.z) < 1.4 && Math.abs(p.x - o.x) < t.r * k && Math.abs(p.y - cy) < hy) { hitTarget(t, p.clone()); s.life = 99; break; }
    }
    if (s.life < 99 && st.stun <= 0 && Math.abs(p.z - abuela.position.z) < 1.5 && Math.abs(p.x - abuela.position.x) < 2 && Math.abs(p.y - abuela.position.y) < 3) {
      s.life = 99; st.stun = 2.2; st.combo++; const gain = 250 * mult(); st.score += gain; st.shake = 0.5;
      playStrike(); burst(abuela.position.clone(), [0xf72585, 0x06d6a0, 0xffd166], 18, 7); flash(`¡ABUELA STUNNED! +${gain}`, '#7CFC00');
    }
    if (s.life < 99 && (p.y < 0 || p.z < SPAWN_Z || s.life > 2)) { s.life = 99; st.combo = 0; st.streak = 0; } // miss breaks the combo
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life >= 99) { scene.remove(shots[i].m); shots.splice(i, 1); }
  hud();
}

// ── Input ────────────────────────────────────────────────────────────────────
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.l = true;
  else if (k === 'arrowright' || k === 'd') input.r = true;
  else if (k === 'm') setMuted(!isMuted());
  else if ((k === 'enter' || k === ' ') && !st.running) { e.preventDefault(); reset(); }
  else if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); throwAt(innerWidth / 2, innerHeight * 0.45); }
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.l = false;
  if (k === 'arrowright' || k === 'd') input.r = false;
});
renderer.domElement.addEventListener('pointerdown', e => { e.preventDefault(); throwAt(e.clientX, e.clientY); });
function hold(id: string, on: () => void, off: () => void) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); on(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
}
hold('tL', () => (input.l = true), () => (input.l = false));
hold('tR', () => (input.r = true), () => (input.r = false));
if (matchMedia('(pointer: coarse)').matches) $('touch').classList.remove('hidden');
$('go').addEventListener('click', reset); $('again').addEventListener('click', reset);
$('over').querySelector('a')!.setAttribute('href', '/');
addEventListener('resize', () => { fitCam(); renderer.setSize(innerWidth, innerHeight); });
(window as any).__strike = { st, targets, throwAt, camera };
loop();
