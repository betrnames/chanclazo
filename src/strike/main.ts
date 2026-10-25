// Chanclazo 3D: Strike Mode (demo). Throw chanclas, break everything, dodge the mad abuela.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadChars, makeChar, type Char, type CharKind } from './chars';
import { initAudio, playWhoosh, playHit, playStrike, playMomHit, playCombo, playGameOver, playDodge, setMuted, isMuted } from '../game/sound';

const $ = (id: string) => document.getElementById(id)!;
const ROAD = 5.2, SPAWN_Z = -75, BEST_KEY = 'chanclazo-strike-best';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
(document.body as HTMLElement).insertBefore(renderer.domElement, document.body.firstChild);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2a1846, 0.016);
const loader = new THREE.TextureLoader();
const tex = (u: string) => { const t = loader.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; };
scene.background = new THREE.Color(0x140a24);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const CAM = new THREE.Vector3(0, 4.6, 9);
scene.add(new THREE.HemisphereLight(0x8f7fe0, 0x3a2010, 1.5));
const moon = new THREE.DirectionalLight(0x9db4ff, 0.9); moon.position.set(-6, 14, 4); scene.add(moon);
const warm = new THREE.PointLight(0xff9a3c, 30, 16, 1.6); warm.position.set(0, 4, 2); scene.add(warm); // candle glow around the player
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
  g.fillStyle = '#1c1420'; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
    g.fillStyle = `hsl(${260 + Math.random() * 30},12%,${20 + Math.random() * 9}%)`; g.fillRect(x + 1, y + 1, 30, 30);
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = `hsl(${28 + Math.random() * 12},100%,${50 + Math.random() * 10}%)`; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 512, 4, 2.5, Math.random() * 3, 0, 7); g.fill(); } // cempasúchil petals
  g.fillStyle = '#3b2412'; g.fillRect(0, 0, 10, 512); g.fillRect(246, 0, 10, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 18); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const roadTex = streetTex();
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2 + 1, 200), new THREE.MeshLambertMaterial({ map: roadTex }));
road.rotation.x = -Math.PI / 2; road.position.z = -85; scene.add(road);
const walk = new THREE.Mesh(new THREE.PlaneGeometry(70, 200), new THREE.MeshLambertMaterial({ color: 0x2a1c14 }));
walk.rotation.x = -Math.PI / 2; walk.position.set(0, -0.02, -85); scene.add(walk);
const COLORS = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xff9f1c, 0x9b5de5];
const box = new THREE.BoxGeometry(1, 1, 1);
// ── Cemetery dressing: tombstones, ofrendas, candles, lamps, petals, smoke (all pooled + recycled) ──
const scenery: THREE.Object3D[] = [];
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
// side rows: tombstones + ofrendas + lamps (only 4 real lights in total, for phones)
for (let i = 0; i < 30; i++) {
  const side = i % 2 ? 1 : -1, z = -Math.floor(i / 2) * 7;
  const o = i % 10 === 4 || i % 10 === 9 ? ofrenda() : tomb();
  const back = tomb(); back.position.set(side * 2.7, 0, -3.5); back.scale.setScalar(1.2); o.add(back); // second row rides along
  if (side > 0) back.position.x = 2.7; else back.position.x = -2.7;
  const b = bake(o); b.position.set(side * (ROAD + 1.8 + Math.random() * 1.2), 0, z); scene.add(b); scenery.push(b);
}
for (let i = 0; i < 8; i++) { const l = lamp(i < 4); l.userData.span = 104; l.position.set((i % 2 ? 1 : -1) * (ROAD + 0.7), 0, -i * 13); scene.add(l); scenery.push(l); }
// papel picado overhead (dimly lit, reads against the night)
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  for (let k = 0; k < 16; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshBasicMaterial({ color: COLORS[(k + i) % 7], side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); const x = -ROAD - 0.5 + k * 0.72; f.position.set(x, 7.8 - Math.cos(x / ROAD) * 0.5, 0); g.add(f); }
  g.userData.span = 5 * 22; const b = bakeColored(g); b.position.z = -i * 22; scene.add(b); scenery.push(b);
}
function bakeColored(g: THREE.Group) { // papel picado: one mesh with vertex colors
  g.updateMatrixWorld(true); const geos: THREE.BufferGeometry[] = [];
  g.children.forEach(o => { const m = o as THREE.Mesh; const geo = m.geometry.clone().toNonIndexed(); geo.applyMatrix4(m.matrix); geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
    const c = (m.material as THREE.MeshBasicMaterial).color, n = geo.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geos.push(geo); });
  const out = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  out.userData = g.userData; return out;
}
// drifting marigold petals (one Points draw call)
const PET = 260, petGeo = new THREE.BufferGeometry(), petPos = new Float32Array(PET * 3);
for (let i = 0; i < PET; i++) { petPos[i * 3] = (Math.random() - 0.5) * 26; petPos[i * 3 + 1] = Math.random() * 8; petPos[i * 3 + 2] = -Math.random() * 90 + 8; }
petGeo.setAttribute('position', new THREE.BufferAttribute(petPos, 3));
const petals = new THREE.Points(petGeo, new THREE.PointsMaterial({ color: 0xff9a1f, size: 0.18, map: glowTex, transparent: true, depthWrite: false }));
scene.add(petals);
// low smoke / fog banks (few big additive sprites)
const smokes: THREE.Sprite[] = [];
for (let i = 0; i < 14; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9a86c8, transparent: true, opacity: 0.22, depthWrite: false }));
  sp.scale.set(10 + Math.random() * 6, 3 + Math.random() * 2, 1); sp.position.set((Math.random() - 0.5) * 22, 0.8 + Math.random(), -Math.random() * 90 + 5); sp.userData.v = (Math.random() - 0.5) * 0.6;
  scene.add(sp); smokes.push(sp);
}
// moon
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(5, 24), new THREE.MeshBasicMaterial({ color: 0xf3e9c6, fog: false }));
moonDisc.position.set(-28, 30, -130); scene.add(moonDisc);
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8d7bd6, transparent: true, opacity: 0.6, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
moonHalo.scale.setScalar(30); moonHalo.position.copy(moonDisc.position); scene.add(moonHalo);

// ── Characters (existing Chanclazo art + a drawn calaca) ─────────────────────
function sheet(url: string, cols = 5, rows = 5) {
  const t = tex(url); t.repeat.set(1 / cols, 1 / rows); t.offset.set(0, (rows - 1) / rows);
  return { t, cols, rows, n: cols * rows };
}
function frame(s: ReturnType<typeof sheet>, f: number) {
  const i = Math.floor(f) % s.n; s.t.offset.set((i % s.cols) / s.cols, (s.rows - 1 - Math.floor(i / s.cols)) / s.rows);
}
const pinataTex = tex('/cruise/pinata.webp');
// Player: the Chanclazo kid, seen from behind, with the existing throw sheet
const throwSheet = sheet('/cruise/boy-strike_back-v3.webp');
const kid = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: throwSheet.t, transparent: true, alphaTest: 0.3, fog: false, toneMapped: false }));
const player = new THREE.Group(); player.add(kid); kid.position.y = 1.2; scene.add(player);
// Mad abuela (rigged 3D), waiting at the end of the cemetery street
const abuela = new THREE.Group(); abuela.position.set(0, 0, -30); scene.add(abuela);
const abuelaLight = new THREE.PointLight(0xff7a3c, 40, 14, 1.3); abuelaLight.position.set(0, 5, 3); abuela.add(abuelaLight); // candlelit so she reads in the dark
let abuelaC: Char | null = null;
const mixers: Char[] = [];
const CH_SCALE: Record<CharKind, number> = { abuela: 2.7, luchador: 2.3, calaca: 2.3 };
function addChar(kind: CharKind, parent: THREE.Object3D, anim: string) {
  const c = makeChar(kind); c.root.scale.setScalar(CH_SCALE[kind]); parent.add(c.root); c.play(anim, { speed: 0.9 + Math.random() * 0.3 });
  c.mixer.update(Math.random() * 2); mixers.push(c); return c;
}
function dropChar(c?: Char) { if (!c) return; c.dispose(); const i = mixers.indexOf(c); if (i >= 0) mixers.splice(i, 1); }
function tint(o: THREE.Object3D, hex: number) {
  o.traverse(x => { const m = (x as THREE.Mesh).material as THREE.MeshLambertMaterial | THREE.MeshLambertMaterial[]; (Array.isArray(m) ? m : [m]).forEach(mm => mm?.emissive?.setHex(hex)); });
}

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
interface T { ch?: Char; dying?: number; kind: Kind; obj: THREE.Object3D; hp: number; pts: number; r: number; h: number; vx: number; t: number; dead?: boolean; flash: number }
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
  let ch: Char | undefined;
  if (kind === 'luchador') ch = addChar('luchador', g, Math.random() < 0.5 ? 'Punch_Cross' : 'Dance_Loop');
  else if (kind === 'calaca') ch = addChar('calaca', g, 'Walk_Loop');
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
  targets.push({ ch, kind, obj: g, hp: s.hp, pts: s.pts, r: s.r, h: s.h, vx: kind === 'calaca' ? (Math.random() < 0.5 ? -2 : 2) : 0, t: Math.random() * 6, flash: 0 });
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
  cool: 0, throwAnim: -1, spawnIn: 0, abuelaIn: 2.5, stun: 0, shake: 0, best: parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0 };
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
  for (const t of targets) { scene.remove(t.obj); dropChar(t.ch); } targets.length = 0;
  for (const s of shots) scene.remove(s.m); shots.length = 0;
  Object.assign(st, { running: true, t: 0, speed: 10, px: 0, steer: 0, score: 0, combo: 0, streak: 0, lives: 3, hurt: 0, cool: 0, throwAnim: -1, spawnIn: 0, abuelaIn: 2.5, stun: 0, shake: 0 });
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
  if (!hit || !abuela.getObjectById(hit.object.id)) aim.z += st.speed * T; // lead moving targets
  const { m, s } = chanclaMesh(); m.position.copy(from);
  const v = aim.sub(from).divideScalar(T); v.y += 0.5 * 14 * T; // arc
  shots.push({ m, v, s, f: 0, enemy: false, life: 0 });
  st.cool = 0.22; st.throwAnim = 0; playWhoosh(1.2);
}
function abuelaThrow() {
  if (!st.running) return;
  abuelaC?.play('Spell_Simple_Shoot', { once: true, fade: 0.1, speed: 1.6 }); setTimeout(() => st.stun <= 0 && abuelaC?.play('Idle_Loop', { fade: 0.25 }), 700);
  const { m, s } = chanclaMesh(); m.position.set(abuela.position.x, 4.5, abuela.position.z + 1);
  const T = Math.max(0.85, 1.5 - st.t / 70);
  const tx = THREE.MathUtils.clamp(st.px + st.steer * 1.5 + (Math.random() - 0.5) * 3, -ROAD + 0.5, ROAD - 0.5);
  const v = new THREE.Vector3((tx - m.position.x) / T, (2 - 4.5 + 0.5 * 9.8 * T * T) / T, (0 - m.position.z) / T);
  m.scale.setScalar(1.3); shots.push({ m, v, s, f: 0, enemy: true, life: 0 });
}

function hitTarget(t: T, at: THREE.Vector3) {
  t.hp--; t.flash = 0.15; st.shake = Math.max(st.shake, 0.25);
  const spec = SPEC[t.kind];
  burst(at, spec.colors, 6, 4);
  if (t.hp > 0) { playHit(); t.obj.position.z -= 1.5; t.ch?.play('Hit_Chest', { once: true, fade: 0.05 }); setTimeout(() => t.ch && !t.dead && t.ch.play('Punch_Cross'), 600); return; }
  t.dead = true; st.combo++; st.streak++;
  const gain = t.pts * mult(); st.score += gain;
  st.shake = t.kind === 'pinata' ? 0.6 : 0.4;
  const center = t.obj.position.clone(); center.y = t.kind === 'pinata' ? 2.8 : t.h * 0.5;
  burst(center, spec.colors, t.kind === 'pinata' ? 40 : t.kind === 'picado' ? 26 : 20, t.kind === 'pinata' ? 11 : 7, t.kind === 'picado' || t.kind === 'pinata');
  if (t.kind === 'pinata') burst(center, [0xffd166, 0xff6b6b, 0x06d6a0], 20, 9); // candy
  playStrike(); if (st.combo % 3 === 0) playCombo(st.combo);
  const label = t.kind === 'luchador' ? '¡KNOCKOUT!' : t.kind === 'calaca' ? '¡CALACA DOWN!' : t.kind === 'pinata' ? '¡PIÑATA!' : 'SMASH!';
  flash(`${label} +${gain}${st.streak >= 3 ? `  ${st.streak} STREAK` : ''}`);
  if (t.ch) { t.ch.play('Death01', { once: true, fade: 0.08 }); t.dying = 1.3; tint(t.obj, 0x000000); } else scene.remove(t.obj);
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
  kid.quaternion.copy(camera.quaternion);
  for (const c of mixers) c.mixer.update(dt);
  warm.intensity = 26 + Math.sin(now / 90) * 3;
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
  for (const o of scenery) { o.position.z += move; if (o.position.z > 14) o.position.z -= o.userData.span ?? 105; if (o.userData.span === 110) o.visible = o.position.z < 1; }
  for (let i = 0; i < PET; i++) { petPos[i * 3 + 2] += move + dt * 1.5; petPos[i * 3 + 1] -= dt * 0.6; petPos[i * 3] += Math.sin(st.t + i) * dt * 0.5;
    if (petPos[i * 3 + 2] > 10 || petPos[i * 3 + 1] < 0) { petPos[i * 3 + 2] = -80 - Math.random() * 10; petPos[i * 3 + 1] = 3 + Math.random() * 6; } }
  petGeo.attributes.position.needsUpdate = true;
  for (const sp of smokes) { sp.position.z += move; sp.position.x += sp.userData.v * dt; if (sp.position.z > 10) sp.position.z -= 95; }

  // Abuela: tracks the player, throws, gets stunned when hit
  if (st.stun > 0) { tint(abuela, Math.floor(st.t * 10) % 2 ? 0x550000 : 0); }
  else {
    tint(abuela, 0);
    abuela.position.x += (st.px - abuela.position.x) * dt * 0.9;
    st.abuelaIn -= dt;
    if (st.abuelaIn <= 0) { abuelaThrow(); st.abuelaIn = Math.max(0.8, 2.4 - st.t / 30) * (0.7 + Math.random() * 0.6); if (st.t > 25 && Math.random() < 0.35) setTimeout(abuelaThrow, 280); } // double throws later
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
    if (t.dying !== undefined) { t.dying -= dt; t.obj.position.z += move; if (t.dying <= 0) { scene.remove(t.obj); dropChar(t.ch); t.dying = undefined; } continue; }
    if (t.dead) continue;
    t.t += dt; t.obj.position.z += move;
    if (t.kind === 'calaca') { t.obj.position.x += t.vx * dt; if (Math.abs(t.obj.position.x) > ROAD - 1) t.vx *= -1; t.obj.rotation.y = t.vx > 0 ? 0.9 : -0.9; }
    if (t.kind === 'pinata') t.obj.rotation.z = Math.sin(t.t * 3) * 0.12;
    t.flash -= dt;
    if (t.ch) tint(t.obj, t.flash > 0 ? 0x880000 : 0); else t.obj.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m?.color && o.userData.bb) m.color.setHex(t.flash > 0 ? 0xff7777 : 0xffffff); });
    if (t.obj.position.z > 6) { t.dead = true; scene.remove(t.obj); dropChar(t.ch); if (t.kind !== 'picado') { st.streak = 0; } }
  }
  for (let i = targets.length - 1; i >= 0; i--) if (targets[i].dead && targets[i].dying === undefined) targets.splice(i, 1);

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
    if (s.life < 99 && st.stun <= 0 && Math.abs(p.z - abuela.position.z) < 1.5 && Math.abs(p.x - abuela.position.x) < 1.6 && p.y > 0.3 && p.y < 4.8) {
      s.life = 99; st.stun = 1.6; abuelaC?.play('Hit_Head', { once: true, fade: 0.05 }); setTimeout(() => abuelaC?.play('Idle_Loop', { fade: 0.3 }), 1500); st.combo++; const gain = 250 * mult(); st.score += gain; st.shake = 0.5;
      playStrike(); burst(abuela.position.clone().setY(3.5), [0xf72585, 0x06d6a0, 0xffd166], 18, 7); flash(`¡ABUELA STUNNED! +${gain}`, '#7CFC00');
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
const goBtn = $('go') as HTMLButtonElement; goBtn.disabled = true; goBtn.textContent = 'Loading…';
loadChars().then(() => { abuelaC = addChar('abuela', abuela, 'Idle_Loop'); goBtn.disabled = false; goBtn.textContent = 'PLAY!'; })
  .catch(() => { goBtn.textContent = 'Could not load, refresh'; });
goBtn.addEventListener('click', reset); $('again').addEventListener('click', reset);
$('over').querySelector('a')!.setAttribute('href', '/');
addEventListener('resize', () => { fitCam(); renderer.setSize(innerWidth, innerHeight); });
(window as any).__strike = { st, targets, throwAt, camera, renderer };
loop();
