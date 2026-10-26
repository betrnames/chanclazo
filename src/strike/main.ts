// Chanclazo 3D: Strike Mode (demo). Ride a winding, hilly Día de Muertos cemetery road,
// throw chanclas to break everything, and dodge the mad abuela's chanclas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadChars, makeChar, toon, type Char, type CharKind } from './chars';
import { initAudio, playWhoosh, playHit, playStrike, playMomHit, playCombo, playGameOver, playDodge, setMuted, isMuted } from '../game/sound';

const $ = (id: string) => document.getElementById(id)!;
const ROAD = 5.2, AHEAD = 78, BEST_KEY = 'chanclazo-strike-best';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
(document.body as HTMLElement).insertBefore(renderer.domElement, document.body.firstChild);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2a1846, 0.017);
scene.background = new THREE.Color(0x140a24);
const loader = new THREE.TextureLoader();
const tex = (u: string) => { const t = loader.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; };
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
scene.add(new THREE.HemisphereLight(0x8f7fe0, 0x3a2010, 1.5));
const moon = new THREE.DirectionalLight(0x9db4ff, 0.9); moon.position.set(-60, 140, 40); scene.add(moon);
const warm = new THREE.PointLight(0xff9a3c, 30, 16, 1.6); scene.add(warm); // candle glow around the player
function fitCam() { camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 74 : 58; camera.updateProjectionMatrix(); }
fitCam();

// ── The road: a closed, winding, hilly spline with banked turns ──────────────
const ctrl: THREE.Vector3[] = [];
for (let i = 0; i < 140; i++) {
  const a = (i / 140) * Math.PI * 2;
  const r = 430 + 70 * Math.sin(5 * a + 1) + 40 * Math.sin(11 * a) + 22 * Math.sin(17 * a + 2);
  const y = 30 * Math.sin(3 * a) + 14 * Math.sin(8 * a + 1) + 5 * Math.sin(19 * a);
  ctrl.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
}
const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
const LEN = Math.floor(curve.getLength());
const P = new Float32Array(LEN * 3), Tg = new Float32Array(LEN * 3), Rt = new Float32Array(LEN * 3), Up = new Float32Array(LEN * 3);
{
  const p = new THREE.Vector3(), t = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const tans: THREE.Vector3[] = [];
  for (let i = 0; i < LEN; i++) tans.push(curve.getTangentAt(i / LEN));
  for (let i = 0; i < LEN; i++) {
    curve.getPointAt(i / LEN, p); t.copy(tans[i]);
    r.crossVectors(t, Y).normalize();
    const ahead = tans[(i + 6) % LEN], behind = tans[(i - 6 + LEN) % LEN];
    const k = ahead.clone().sub(behind).dot(r) / 12;           // signed curvature (+ = turning right)
    const bank = THREE.MathUtils.clamp(k * 16, -0.3, 0.3);
    u.copy(Y).applyAxisAngle(t, bank); r.applyAxisAngle(t, bank);
    P.set([p.x, p.y, p.z], i * 3); Tg.set([t.x, t.y, t.z], i * 3); Rt.set([r.x, r.y, r.z], i * 3); Up.set([u.x, u.y, u.z], i * 3);
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function lerpArr(arr: Float32Array, s: number, out: THREE.Vector3) {
  const f = ((s % LEN) + LEN) % LEN, i = Math.floor(f), j = (i + 1) % LEN, w = f - i;
  _a.fromArray(arr, i * 3); _b.fromArray(arr, j * 3); return out.copy(_a).lerp(_b, w);
}
interface Fr { p: THREE.Vector3; t: THREE.Vector3; r: THREE.Vector3; u: THREE.Vector3 }
const mkFr = (): Fr => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() });
/** World frame at distance s along the road, x metres to the right, h metres up. */
function frame(s: number, x = 0, h = 0, out: Fr = mkFr()) {
  lerpArr(P, s, out.p); lerpArr(Tg, s, out.t).normalize(); lerpArr(Rt, s, out.r).normalize(); lerpArr(Up, s, out.u).normalize();
  out.p.addScaledVector(out.r, x).addScaledVector(out.u, h); return out;
}
function streetTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1c1420'; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
    g.fillStyle = `hsl(${260 + Math.random() * 30},12%,${20 + Math.random() * 9}%)`; g.fillRect(x + 1, y + 1, 30, 30);
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = `hsl(${28 + Math.random() * 12},100%,${50 + Math.random() * 10}%)`; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 512, 4, 2.5, Math.random() * 3, 0, 7); g.fill(); } // cempasúchil petals
  g.fillStyle = '#3b2412'; g.fillRect(0, 0, 10, 512); g.fillRect(246, 0, 10, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 18); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const roadTex = streetTex(); roadTex.repeat.set(1, 1);
function ribbon(half: number, drop: number, vScale: number, mat: THREE.Material, step = 2) {
  const rows = Math.ceil(LEN / step) + 1, pos = new Float32Array(rows * 2 * 3), uv = new Float32Array(rows * 2 * 2), idx: number[] = [];
  const f = mkFr();
  for (let k = 0; k < rows; k++) {
    const s = Math.min(k * step, LEN); frame(s, 0, -drop, f);
    for (let e = 0; e < 2; e++) { const sx = e ? half : -half; pos.set([f.p.x + f.r.x * sx, f.p.y + f.r.y * sx, f.p.z + f.r.z * sx], (k * 2 + e) * 3); uv.set([e, s / vScale], (k * 2 + e) * 2); }
    if (k < rows - 1) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  (mat as THREE.MeshLambertMaterial).side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); scene.add(m); return m;
}
const roadMesh = ribbon(ROAD + 0.5, 0, 7, new THREE.MeshLambertMaterial({ map: roadTex }));
ribbon(11, 0.06, 10, new THREE.MeshLambertMaterial({ color: 0x2a1c14 }));
ribbon(60, 0.6, 10, new THREE.MeshLambertMaterial({ color: 0x150d1c }), 4);

// ── Minimap (like Cruising Bones' route card) ───────────────────────────────
const mini = document.createElement('canvas'); mini.width = mini.height = 120;
Object.assign(mini.style, { position: 'fixed', left: '10px', top: '52px', width: '96px', height: '96px', background: 'rgba(20,10,36,.65)', border: '2px solid #ffc46b', borderRadius: '10px', pointerEvents: 'none' });
document.body.appendChild(mini);
const mg = mini.getContext('2d')!;
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
for (let i = 0; i < LEN; i++) { minX = Math.min(minX, P[i * 3]); maxX = Math.max(maxX, P[i * 3]); minZ = Math.min(minZ, P[i * 3 + 2]); maxZ = Math.max(maxZ, P[i * 3 + 2]); }
const mm = (x: number, z: number): [number, number] => [10 + (x - minX) / (maxX - minX) * 100, 10 + (z - minZ) / (maxZ - minZ) * 100];
function drawMini(s: number) {
  mg.clearRect(0, 0, 120, 120); mg.strokeStyle = '#ffc46b'; mg.lineWidth = 2; mg.beginPath();
  for (let i = 0; i <= LEN; i += 8) { const [x, y] = mm(P[(i % LEN) * 3], P[(i % LEN) * 3 + 2]); i ? mg.lineTo(x, y) : mg.moveTo(x, y); } mg.stroke();
  const i = Math.floor(((s % LEN) + LEN) % LEN), [x, y] = mm(P[i * 3], P[i * 3 + 2]); mg.fillStyle = '#ff4d6d'; mg.beginPath(); mg.arc(x, y, 5, 0, 7); mg.fill();
}

const COLORS = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xff9f1c, 0x9b5de5];
const box = new THREE.BoxGeometry(1, 1, 1);
function bakeColored(g: THREE.Group) { // papel picado: one mesh with vertex colors
  g.updateMatrixWorld(true); const geos: THREE.BufferGeometry[] = [];
  g.children.forEach(o => { const m = o as THREE.Mesh; const geo = m.geometry.clone().toNonIndexed(); geo.applyMatrix4(m.matrix); geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
    const c = (m.material as THREE.MeshBasicMaterial).color, n = geo.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geos.push(geo); });
  const out = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  out.userData = g.userData; return out;
}

// ── Cemetery dressing: tombstones, ofrendas, candles, lamps, petals, smoke (all pooled + recycled) ──
function bake(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let geo = m.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    geo = geo.index ? geo.toNonIndexed() : geo; for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const mat = m.material as THREE.Material; if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat)!.push(geo);
  });
  const out = new THREE.Group(); out.position.copy(g.position); out.rotation.copy(g.rotation); out.scale.copy(g.scale);
  for (const [mat, geos] of byMat) out.add(new THREE.Mesh(mergeGeometries(geos), mat));
  out.userData = g.userData; return out;
}
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x6b6478 });
const stoneDark = new THREE.MeshLambertMaterial({ color: 0x4a4458 });
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false });
const waxMat = new THREE.MeshLambertMaterial({ color: 0xf5ecd7, emissive: 0x332211 });
const marigoldMat = new THREE.MeshLambertMaterial({ color: 0xff8c00, emissive: 0x552200 });
const candleGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), flameGeo = new THREE.SphereGeometry(0.06, 6, 4), mariGeo = new THREE.IcosahedronGeometry(0.16, 0);
function candles(g: THREE.Object3D, n: number, w: number, y: number, z = 0) {
  for (let k = 0; k < n; k++) {
    const c = new THREE.Mesh(candleGeo, waxMat); c.position.set((Math.random() - 0.5) * w, y + 0.15, z + (Math.random() - 0.5) * 0.4); g.add(c);
    const f = new THREE.Mesh(flameGeo, flameMat); f.scale.y = 1.8; f.position.set(c.position.x, y + 0.38, c.position.z); g.add(f);
  }
}
function tomb() {
  const g = new THREE.Group();
  const h = 1.1 + Math.random() * 0.8, w = 0.8 + Math.random() * 0.4;
  const slab = new THREE.Mesh(box, Math.random() < 0.5 ? stoneMat : stoneDark); slab.scale.set(w, h, 0.25); slab.position.y = h / 2; g.add(slab);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.25, 12, 1, false, 0, Math.PI), slab.material); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = h; g.add(top);
  if (Math.random() < 0.5) { const cr = new THREE.Mesh(box, stoneMat); cr.scale.set(0.12, 0.6, 0.12); cr.position.y = h + 0.5; g.add(cr); const cb = cr.clone(); cb.scale.set(0.4, 0.12, 0.12); cb.position.y = h + 0.6; g.add(cb); }
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(mariGeo, marigoldMat); m.position.set((Math.random() - 0.5) * w, 0.12, 0.35 + Math.random() * 0.3); g.add(m); }
  candles(g, 2, w, 0, 0.45);
  g.rotation.y = (Math.random() - 0.5) * 0.3; g.rotation.z = (Math.random() - 0.5) * 0.12;
  return g;
}
function ofrenda() {
  const g = new THREE.Group();
  const cloth = [0x7b2cbf, 0xf72585, 0xff8c00];
  for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: cloth[k] })); st.scale.set(2.4 - k * 0.6, 0.45, 1.2 - k * 0.25); st.position.set(0, 0.22 + k * 0.45, -k * 0.2); g.add(st); candles(g, 4 - k, 2.2 - k * 0.6, 0.45 + k * 0.45, 0.4 - k * 0.2); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 6, 18, Math.PI), marigoldMat); arch.position.set(0, 1.3, -0.4); g.add(arch);
  for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(mariGeo, marigoldMat); m.position.set((Math.random() - 0.5) * 2.4, 0.1, 0.8 + Math.random() * 0.4); g.add(m); }
  return g;
}
const lampLights: THREE.PointLight[] = [];
function lamp(withLight: boolean) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x1a1a1a })); pole.scale.set(0.15, 4.6, 0.15); pole.position.y = 2.3; g.add(pole);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false })); glow.position.y = 4.7; g.add(glow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a3c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.setScalar(3.2); halo.position.y = 4.7; g.add(halo);
  if (withLight) { const l = new THREE.PointLight(0xffa64d, 26, 14, 1.4); l.position.y = 4.3; g.add(l); lampLights.push(l); }
  return g;
}
function radial(inner: string, outer: string) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const glowTex = radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
const smokeTex = radial('rgba(255,255,255,0.5)', 'rgba(255,255,255,0)');

// ── Pooled props placed along the spline ────────────────────────────────────
interface Prop { o: THREE.Object3D; s: number; x: number; h: number; span: number; face?: 'road' | 'along' }
const props: Prop[] = [];
function place(p: Prop) {
  const f = frame(p.s, p.x, p.h); p.o.position.copy(f.p);
  if (p.face === 'along') { p.o.up.copy(f.u); p.o.lookAt(f.p.clone().add(f.t)); }
  else { const c = frame(p.s, 0, p.h); p.o.up.set(0, 1, 0); p.o.lookAt(c.p.x, p.o.position.y, c.p.z); }
}
for (let i = 0; i < 32; i++) {
  const side = i % 2 ? 1 : -1;
  const o = i % 8 === 3 || i % 8 === 6 ? ofrenda() : tomb();
  const back = tomb(); back.position.set((Math.random() - 0.5) * 2, 0, -3); back.scale.setScalar(1.25); o.add(back);
  const b = bake(o); scene.add(b);
  props.push({ o: b, s: Math.floor(i / 2) * 7, x: side * (ROAD + 2 + Math.random() * 1.5), h: 0, span: 16 * 7 });
}
for (let i = 0; i < 8; i++) { const l = lamp(i < 4); scene.add(l); props.push({ o: l, s: i * 14, x: (i % 2 ? 1 : -1) * (ROAD + 0.8), h: 0, span: 8 * 14 }); }
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  for (let k = 0; k < 16; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshBasicMaterial({ color: COLORS[(k + i) % 7] })); const x = -ROAD - 0.5 + k * 0.72; f.position.set(x, 7.2 - Math.cos(x / ROAD) * 0.5, 0); g.add(f); }
  const b = bakeColored(g); scene.add(b); props.push({ o: b, s: 10 + i * 24, x: 0, h: 0, span: 5 * 24, face: 'along' });
}
const smokes: THREE.Sprite[] = [];
for (let i = 0; i < 12; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9a86c8, transparent: true, opacity: 0.22, depthWrite: false }));
  sp.scale.set(10 + Math.random() * 6, 3 + Math.random() * 2, 1); scene.add(sp); smokes.push(sp);
  props.push({ o: sp, s: i * 9, x: (Math.random() - 0.5) * 20, h: 0.9 + Math.random(), span: 12 * 9 });
}
function layoutProps(s0: number) { for (const p of props) { p.s = s0 - 10 + (((p.s - (s0 - 10)) % p.span) + p.span) % p.span; place(p); } }
// petals + moon ride with the camera
const rig = new THREE.Group(); scene.add(rig);
const PET = 220, petGeo = new THREE.BufferGeometry(), petPos = new Float32Array(PET * 3);
for (let i = 0; i < PET; i++) petPos.set([(Math.random() - 0.5) * 30, Math.random() * 10, -Math.random() * 60], i * 3);
petGeo.setAttribute('position', new THREE.BufferAttribute(petPos, 3));
rig.add(new THREE.Points(petGeo, new THREE.PointsMaterial({ color: 0xff9a1f, size: 0.2, map: glowTex, transparent: true, depthWrite: false })));
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xf3e9c6, fog: false }));
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8d7bd6, transparent: true, opacity: 0.6, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
moonHalo.scale.setScalar(55); const moonG = new THREE.Group(); moonG.add(moonDisc, moonHalo); scene.add(moonG);

function sheet(url: string, cols = 5, rows = 5) {
  const t = tex(url); t.repeat.set(1 / cols, 1 / rows); t.offset.set(0, (rows - 1) / rows);
  return { t, cols, rows, n: cols * rows };
}
function sprFrame(s: ReturnType<typeof sheet>, f: number) {
  const i = Math.floor(f) % s.n; s.t.offset.set((i % s.cols) / s.cols, (s.rows - 1 - Math.floor(i / s.cols)) / s.rows);
}
// Player: the Chanclazo kid, seen from behind, with the existing throw sheet
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


// ── Characters ───────────────────────────────────────────────────────────────
const mixers: Char[] = [];
const CH_SCALE: Record<CharKind, number> = { abuela: 1.9, luchador: 1.55, calaca: 1.5, kid: 1.25 };
function addChar(kind: CharKind, parent: THREE.Object3D, anim: string) {
  const c = makeChar(kind); c.root.scale.setScalar(CH_SCALE[kind]); parent.add(c.root); c.play(anim, { speed: 0.9 + Math.random() * 0.3 });
  c.update(Math.random() * 2); mixers.push(c); return c;
}
function dropChar(c?: Char) { if (!c) return; c.dispose(); const i = mixers.indexOf(c); if (i >= 0) mixers.splice(i, 1); }
const player = new THREE.Group(); scene.add(player);
let kidC: Char | null = null;
const board = new THREE.Group();
board.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 1.7), toon(0xe8590c)));
for (const [x, z] of [[-0.27, -0.55], [0.27, -0.55], [-0.27, 0.55], [0.27, 0.55]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 10), toon(0xffd166)); w.rotation.z = Math.PI / 2; w.position.set(x, -0.12, z); board.add(w); }
board.position.y = 0.2; player.add(board);
const abuela = new THREE.Group(); scene.add(abuela);
let abuelaC: Char | null = null;
const abuelaLight = new THREE.PointLight(0xff7a3c, 40, 14, 1.3); abuelaLight.position.set(0, 5, 2.5); abuela.add(abuelaLight);

// ── Targets ──────────────────────────────────────────────────────────────────
type Kind = 'luchador' | 'calaca' | 'pinata' | 'pot' | 'crate' | 'picado';
interface T { kind: Kind; obj: THREE.Object3D; ch?: Char; s: number; x: number; hp: number; pts: number; r: number; h: number; cy: number; vx: number; t: number; flash: number; dead?: boolean; dying?: number }
const targets: T[] = [];
const pinataTex = tex('/cruise/pinata.webp');
const potMat = toon(0xc2410c), potBand = toon(0x4cc9f0), crateMat = toon(0x8b5a2b);
const SPEC: Record<Kind, { hp: number; pts: number; r: number; h: number; cy: number; colors: number[] }> = {
  luchador: { hp: 2, pts: 150, r: 1.0, h: 1.7, cy: 1.5, colors: [0xd62828, 0xffd166, 0x8b1e1e] },
  calaca: { hp: 1, pts: 100, r: 0.9, h: 1.6, cy: 1.5, colors: [0xfbf6ea, 0x1b1020, 0xf72585] },
  pinata: { hp: 3, pts: 300, r: 1.2, h: 1.6, cy: 3.4, colors: [0xf72585, 0xffd166, 0x06d6a0, 0x4cc9f0, 0x9b5de5] },
  pot: { hp: 1, pts: 40, r: 0.9, h: 1.0, cy: 0.9, colors: [0xc2410c, 0x4cc9f0, 0xe8a87c] },
  crate: { hp: 1, pts: 40, r: 1.0, h: 1.0, cy: 0.9, colors: [0x8b5a2b, 0xa0703c] },
  picado: { hp: 1, pts: 60, r: 3.4, h: 0.7, cy: 4.6, colors: COLORS },
};
function spawn(kind: Kind, s: number, x: number) {
  const g = new THREE.Group(); let ch: Char | undefined;
  if (kind === 'luchador') ch = addChar('luchador', g, Math.random() < 0.5 ? 'Punch_Cross' : 'Dance_Loop');
  else if (kind === 'calaca') ch = addChar('calaca', g, 'Walk_Loop');
  else if (kind === 'pinata') {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), new THREE.MeshBasicMaterial({ map: pinataTex, transparent: true, alphaTest: 0.3 })); b.position.y = 3.4; b.userData.bb = true; g.add(b);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), toon(0xd9c49a)); rope.position.y = 6.3; g.add(rope);
  } else if (kind === 'pot') {
    const pb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), potMat); pb.position.y = 0.66; g.add(pb);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.4, 12), potMat); n.position.y = 1.35; g.add(n);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 20), potBand); band.rotation.x = Math.PI / 2; band.position.y = 0.7; g.add(band);
  } else if (kind === 'crate') { const c = new THREE.Mesh(box, crateMat); c.scale.setScalar(1.3); c.position.y = 0.65; g.add(c); }
  else { for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshBasicMaterial({ color: COLORS[k % 7], side: THREE.DoubleSide })); f.position.set(-2.8 + k * 0.7, 4.6 - Math.cos((k - 4) / 4) * 0.4, 0); g.add(f); } }
  scene.add(g);
  const sp = SPEC[kind];
  const t: T = { kind, obj: g, ch, s, x, hp: sp.hp, pts: sp.pts, r: sp.r, h: sp.h, cy: sp.cy, vx: kind === 'calaca' ? (Math.random() < 0.5 ? -1.8 : 1.8) : 0, t: Math.random() * 6, flash: 0 };
  targets.push(t); posTarget(t);
}
const tf = mkFr();
function posTarget(t: T) {
  frame(t.s, t.x, 0, tf); t.obj.position.copy(tf.p); t.obj.up.copy(tf.u);
  if (t.kind === 'picado') t.obj.lookAt(tf.p.clone().add(tf.t));
  else t.obj.lookAt(player.position.x, t.obj.position.y, player.position.z);
}

// ── Projectiles ──────────────────────────────────────────────────────────────
interface Shot { m: THREE.Mesh; v: THREE.Vector3; s: ReturnType<typeof sheet>; f: number; enemy: boolean; life: number; max: number }
const shots: Shot[] = [];
function chanclaMesh() {
  const s = sheet('/cruise/chancla_spin.webp');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: s.t, transparent: true, alphaTest: 0.3 }));
  scene.add(m); return { m, s };
}

// ── State ────────────────────────────────────────────────────────────────────
const st = { running: false, t: 0, speed: 11, s: 0, px: 0, steer: 0, score: 0, combo: 0, streak: 0, lives: 3, hurt: 0,
  cool: 0, spawnAt: 30, abuelaIn: 2.5, stun: 0, shake: 0, best: parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0 };
const input = { l: false, r: false };
$('best').textContent = `Best ${st.best.toLocaleString()}`;
const mult = () => 1 + Math.floor(st.combo / 3);
function hud() {
  $('score').textContent = `${st.score.toLocaleString()}${mult() > 1 ? `  x${mult()}` : ''}`;
  $('speed').textContent = '❤'.repeat(Math.max(0, st.lives)) + '♡'.repeat(Math.max(0, 3 - st.lives));
}
function flash(msg: string, color = '#ffd700') {
  const el = $('trick'); el.textContent = msg; el.style.color = color; el.style.opacity = '1';
  clearTimeout((flash as any).t); (flash as any).t = setTimeout(() => (el.style.opacity = '0'), 650);
}
function reset() {
  initAudio();
  for (const t of targets) { scene.remove(t.obj); dropChar(t.ch); } targets.length = 0;
  for (const s of shots) scene.remove(s.m); shots.length = 0;
  Object.assign(st, { running: true, t: 0, speed: 11, s: 0, px: 0, steer: 0, score: 0, combo: 0, streak: 0, lives: 3, hurt: 0, cool: 0, spawnAt: 30, abuelaIn: 2.5, stun: 0, shake: 0 });
  layoutProps(0); kidC?.play('Idle_Loop');
  $('start').classList.add('hidden'); $('over').classList.add('hidden'); hud();
}
function gameOver() {
  st.running = false; playGameOver(); kidC?.play('Death01', { once: true });
  if (st.score > st.best) { st.best = st.score; localStorage.setItem(BEST_KEY, String(st.score)); }
  $('best').textContent = `Best ${st.best.toLocaleString()}`;
  $('overMsg').textContent = 'The abuela got you three times. Nobody escapes the chancla.';
  $('overScore').textContent = `${st.score.toLocaleString()} pts`;
  $('over').classList.remove('hidden');
}

// ── Throwing (aim with a tap or click) ───────────────────────────────────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pf = mkFr();
function throwAt(cx: number, cy: number) {
  if (!st.running || st.cool > 0) return;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const objs: THREE.Object3D[] = [abuela]; targets.forEach(t => !t.dead && objs.push(t.obj));
  const hit = ray.intersectObjects(objs, true)[0] ?? ray.intersectObject(roadMesh, false)[0];
  const aim = hit ? hit.point.clone() : ray.ray.at(45, new THREE.Vector3());
  frame(st.s, st.px, 0, pf);
  const from = pf.p.clone().addScaledVector(pf.u, 2.2).addScaledVector(pf.t, 0.6);
  if (aim.clone().sub(from).dot(pf.t) < 3) aim.copy(from).addScaledVector(pf.t, 20);
  const T = THREE.MathUtils.clamp(from.distanceTo(aim) / 55, 0.12, 0.9);
  aim.addScaledVector(pf.t, st.speed * T * 0.0); // targets are static in the world now
  const { m, s } = chanclaMesh(); m.position.copy(from);
  const v = aim.sub(from).divideScalar(T); v.y += 0.5 * 14 * T;
  shots.push({ m, v, s, f: 0, enemy: false, life: 0, max: T * 1.35 + 0.05 });
  st.cool = 0.22; playWhoosh(1.2);
  kidC?.play('Spell_Simple_Shoot', { once: true, fade: 0.05, speed: 2.2 }); clearTimeout((throwAt as any).t); (throwAt as any).t = setTimeout(() => st.running && kidC?.play('Idle_Loop', { fade: 0.2 }), 380);
}
const af = mkFr();
function abuelaThrow() {
  if (!st.running || st.stun > 0) return;
  abuelaC?.play('Spell_Simple_Shoot', { once: true, fade: 0.1, speed: 1.6 }); setTimeout(() => st.stun <= 0 && abuelaC?.play('Idle_Loop', { fade: 0.25 }), 700);
  const { m, s } = chanclaMesh(); m.position.copy(abuela.position).y += 3.4;
  const T = Math.max(0.85, 1.45 - st.t / 70);
  const tx = THREE.MathUtils.clamp(st.px + st.steer * 1.5 + (Math.random() - 0.5) * 3, -ROAD + 0.5, ROAD - 0.5);
  frame(st.s + st.speed * T, tx, 1.4, af);
  const v = af.p.clone().sub(m.position).divideScalar(T); v.y += 0.5 * 9.8 * T;
  m.scale.setScalar(1.3); shots.push({ m, v, s, f: 0, enemy: true, life: 0, max: T + 0.6 });
}
function hitTarget(t: T, at: THREE.Vector3) {
  t.hp--; t.flash = 0.15; st.shake = Math.max(st.shake, 0.25);
  const spec = SPEC[t.kind];
  burst(at, spec.colors, 6, 4);
  if (t.hp > 0) { playHit(); t.s += 1.2; t.ch?.play('Hit_Chest', { once: true, fade: 0.05 }); setTimeout(() => t.ch && !t.dead && t.ch.play('Punch_Cross'), 600); return; }
  t.dead = true; st.combo++; st.streak++;
  const gain = t.pts * mult(); st.score += gain;
  st.shake = t.kind === 'pinata' ? 0.6 : 0.4;
  const center = t.obj.position.clone().addScaledVector(t.obj.up, t.cy);
  burst(center, spec.colors, t.kind === 'pinata' ? 40 : t.kind === 'picado' ? 26 : 20, t.kind === 'pinata' ? 11 : 7, t.kind === 'picado' || t.kind === 'pinata');
  if (t.kind === 'pinata') burst(center, [0xffd166, 0xff6b6b, 0x06d6a0], 20, 9);
  playStrike(); if (st.combo % 3 === 0) playCombo(st.combo);
  const label = t.kind === 'luchador' ? '¡KNOCKOUT!' : t.kind === 'calaca' ? '¡CALACA DOWN!' : t.kind === 'pinata' ? '¡PIÑATA!' : 'SMASH!';
  flash(`${label} +${gain}${st.streak >= 3 ? `  ${st.streak} STREAK` : ''}`);
  if (t.ch) { t.ch.play('Death01', { once: true, fade: 0.08 }); t.dying = 1.3; t.ch.setFlash(0); } else { scene.remove(t.obj); }
}

// ── Loop ─────────────────────────────────────────────────────────────────────
let last = performance.now();
const cf = mkFr(), lf = mkFr(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
let camInit = false;
function loop() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (st.running) step(dt);
  // player on the road
  frame(st.s, st.px, 0, pf); player.position.copy(pf.p); player.up.copy(pf.u); player.lookAt(pf.p.clone().add(pf.t));
  player.rotateZ(-st.steer * 0.2);
  // camera: low, behind and slightly above, following the curve and banking with it
  frame(st.s - 8.5, st.px * 0.6, 4.0, cf); frame(st.s + 9, st.px * 0.4, 1.4, lf);
  const k = camInit ? Math.min(1, dt * 6) : 1; camInit = true;
  camPos.lerp(cf.p, k); camLook.lerp(lf.p, k); camUp.lerp(cf.u, k);
  const sh = st.shake; st.shake = Math.max(0, st.shake - dt * 1.6);
  camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
  camera.up.copy(camUp); camera.lookAt(camLook);
  warm.position.copy(pf.p).addScaledVector(pf.u, 4); warm.intensity = 26 + Math.sin(now / 90) * 3;
  rig.position.copy(camera.position); rig.quaternion.copy(camera.quaternion);
  for (let i = 0; i < PET; i++) { petPos[i * 3 + 1] -= dt * 0.7; petPos[i * 3] += Math.sin(now / 900 + i) * dt * 0.4; petPos[i * 3 + 2] += dt * (st.running ? st.speed : 0) * 0.6; if (petPos[i * 3 + 1] < -4 || petPos[i * 3 + 2] > 2) { petPos[i * 3] = (Math.random() - 0.5) * 30; petPos[i * 3 + 1] = 2 + Math.random() * 8; petPos[i * 3 + 2] = -10 - Math.random() * 50; } }
  petGeo.attributes.position.needsUpdate = true;
  moonG.position.copy(camera.position).add(new THREE.Vector3(-110, 95, -160)); moonG.lookAt(camera.position);
  for (const p of parts) {
    p.life += dt; p.v.y -= 16 * dt; p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt;
    (p.m.material as THREE.MeshLambertMaterial).opacity = 1 - p.life / p.max;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life > parts[i].max) { scene.remove(parts[i].m); parts.splice(i, 1); }
  for (const c of mixers) c.update(dt);
  for (const t of targets) for (const o of t.obj.children) if (o.userData.bb) o.quaternion.copy(camera.quaternion).premultiply(t.obj.quaternion.clone().invert());
  for (const s of shots) s.m.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
  if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) drawMini(st.s);
  requestAnimationFrame(loop);
}

function step(dt: number) {
  st.t += dt;
  // speed follows the hills: faster downhill, slower uphill
  const slope = lerpArr(Tg, st.s, _b).y;
  st.speed = THREE.MathUtils.clamp(st.speed + (-slope * 14 + 0.25) * dt, 9, 13 + st.t * 0.12);
  st.speed = Math.min(st.speed, 24);
  st.s += st.speed * dt;
  st.cool -= dt; st.hurt -= dt; st.stun -= dt;
  const want = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  st.steer += (want - st.steer) * Math.min(1, dt * 10);
  st.px = THREE.MathUtils.clamp(st.px + st.steer * dt * 9, -ROAD + 0.6, ROAD - 0.6);
  if (kidC) kidC.setFlash(st.hurt > 0 && Math.floor(st.t * 20) % 2 ? 0x660000 : 0);

  for (const p of props) if (p.s < st.s - 12) { p.s += p.span; place(p); }

  // Abuela rides ahead, tracking the player's lane
  const abS = st.s + 30;
  const abX = THREE.MathUtils.lerp(abuela.userData.x ?? 0, st.px, Math.min(1, dt * 0.9)); abuela.userData.x = abX;
  frame(abS, abX, 0, af); abuela.position.copy(af.p); abuela.up.copy(af.u); abuela.lookAt(player.position.x, abuela.position.y, player.position.z);
  abuelaC?.setFlash(st.stun > 0 && Math.floor(st.t * 10) % 2 ? 0x550000 : 0);
  if (st.stun <= 0) {
    st.abuelaIn -= dt;
    if (st.abuelaIn <= 0) { abuelaThrow(); st.abuelaIn = Math.max(0.8, 2.4 - st.t / 30) * (0.7 + Math.random() * 0.6); if (st.t > 25 && Math.random() < 0.35) setTimeout(abuelaThrow, 280); }
  }

  // Spawning along the road
  if (st.s + AHEAD > st.spawnAt) {
    const s0 = st.spawnAt, r = Math.random(), x = () => (Math.random() * 2 - 1) * (ROAD - 1.2);
    if (r < 0.25) spawn('luchador', s0, x());
    else if (r < 0.48) spawn('calaca', s0, x());
    else if (r < 0.58) spawn('pinata', s0, x());
    else if (r < 0.7) spawn('picado', s0, 0);
    else { const n = 2 + Math.floor(Math.random() * 3), x0 = x(); for (let k = 0; k < n; k++) spawn(Math.random() < 0.5 ? 'pot' : 'crate', s0 + k * 0.6, THREE.MathUtils.clamp(x0 + (k - n / 2) * 1.6, -ROAD + 0.7, ROAD - 0.7)); }
    st.spawnAt += Math.max(6, 13 - st.t * 0.08);
  }
  for (const t of targets) {
    if (t.dying !== undefined) { t.dying -= dt; if (t.dying <= 0) { scene.remove(t.obj); dropChar(t.ch); t.dying = undefined; } continue; }
    if (t.dead) continue;
    t.t += dt;
    if (t.kind === 'calaca') { t.x += t.vx * dt; if (Math.abs(t.x) > ROAD - 1) t.vx *= -1; }
    if (t.kind === 'calaca' || t.kind === 'luchador') posTarget(t);
    if (t.kind === 'pinata') t.obj.children[0].position.x = Math.sin(t.t * 3) * 0.3;
    t.flash -= dt; t.ch?.setFlash(t.flash > 0 ? 0x880000 : 0);
    if (t.s < st.s - 4) { t.dead = true; scene.remove(t.obj); dropChar(t.ch); if (t.kind !== 'picado') st.streak = 0; }
  }
  for (let i = targets.length - 1; i >= 0; i--) if (targets[i].dead && targets[i].dying === undefined) targets.splice(i, 1);

  // Projectiles
  const pc = player.position.clone().addScaledVector(player.up, 1.4);
  for (const s of shots) {
    s.life += dt; s.v.y -= (s.enemy ? 9.8 : 14) * dt; s.m.position.addScaledVector(s.v, dt);
    s.f += dt * 40; sprFrame(s.s, s.f);
    const p = s.m.position;
    if (s.enemy) {
      if (p.distanceTo(pc) < 1.35 && st.hurt <= 0) {
        s.life = 99; st.lives--; st.hurt = 1.2; st.combo = 0; st.streak = 0; st.shake = 0.8; playMomHit();
        flash('¡CHANCLAZO! Ouch!', '#ff4d4d'); burst(pc.clone(), [0xffffff, 0xffd166], 10, 5); hud();
        kidC?.play('Hit_Head', { once: true, fade: 0.05 }); setTimeout(() => st.running && kidC?.play('Idle_Loop', { fade: 0.2 }), 500);
        if (st.lives <= 0) { gameOver(); return; }
      } else if (s.life > s.max - 0.62 && s.life < s.max - 0.55 && st.hurt <= 0) playDodge();
      if (s.life > s.max) s.life = 99;
      continue;
    }
    for (const t of targets) {
      if (t.dead) continue;
      const c = t.obj.position.clone().addScaledVector(t.obj.up, t.cy), d = p.clone().sub(c), dy = d.dot(t.obj.up);
      const horiz = d.addScaledVector(t.obj.up, -dy).length();
      if (horiz < t.r && Math.abs(dy) < t.h) { hitTarget(t, p.clone()); s.life = 99; break; }
    }
    if (s.life < 99 && st.stun <= 0) {
      const c = abuela.position.clone().addScaledVector(abuela.up, 2.2);
      if (p.distanceTo(c) < 2.0) {
        s.life = 99; st.stun = 1.6; abuelaC?.play('Hit_Head', { once: true, fade: 0.05 }); setTimeout(() => abuelaC?.play('Idle_Loop', { fade: 0.3 }), 1500);
        st.combo++; const gain = 250 * mult(); st.score += gain; st.shake = 0.5;
        playStrike(); burst(c, [0xf72585, 0x06d6a0, 0xffd166], 18, 7); flash(`¡ABUELA STUNNED! +${gain}`, '#7CFC00');
      }
    }
    if (s.life < 99 && s.life > s.max) { s.life = 99; st.combo = 0; st.streak = 0; } // a miss breaks the combo
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
  else if ((k === 'enter' || k === ' ') && !st.running) { e.preventDefault(); if (!goBtn.disabled) reset(); }
  else if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); throwAt(innerWidth / 2, innerHeight * 0.42); }
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
const goBtn = $('go') as HTMLButtonElement; goBtn.disabled = true; goBtn.textContent = 'Loading…';
loadChars().then(() => {
  abuelaC = addChar('abuela', abuela, 'Idle_Loop');
  kidC = addChar('kid', player, 'Idle_Loop'); kidC.root.position.y = 0.26;
  goBtn.disabled = false; goBtn.textContent = 'PLAY!';
}).catch(() => { goBtn.textContent = 'Could not load, refresh'; });
goBtn.addEventListener('click', reset); $('again').addEventListener('click', reset);
$('over').querySelector('a')!.setAttribute('href', '/');
addEventListener('resize', () => { fitCam(); renderer.setSize(innerWidth, innerHeight); });
layoutProps(0); drawMini(0);
(window as any).__strike = { st, targets, throwAt, camera, renderer, frame };
loop();
