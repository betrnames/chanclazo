// Rigged low-poly caricature characters: Quaternius' CC0 Universal Animation Library mannequin (rig + animations)
// with big code-sculpted bobblehead heads, toon shading and ink outlines.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CharKind = 'abuela' | 'luchador' | 'calaca' | 'kid';
export interface Char {
  root: THREE.Group; mixer: THREE.AnimationMixer; head: THREE.Group;
  play: (name: string, opts?: { once?: boolean; fade?: number; speed?: number }) => THREE.AnimationAction | undefined;
  update: (dt: number) => void;
  setFlash: (hex: number) => void;
  dispose: () => void;
}
let base: { scene: THREE.Object3D; clips: THREE.AnimationClip[] } | null = null;
export async function loadChars() {
  const g = await new GLTFLoader().loadAsync('/cruise/mannequin.glb');
  base = { scene: g.scene, clips: g.animations };
}

// ── Toon look ────────────────────────────────────────────────────────────────
const ramp = (() => {
  const d = new Uint8Array([70, 150, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}, shared = true) {
  const key = color + JSON.stringify(Object.keys(extra));
  if (shared && !Object.keys(extra).length && toonCache.has(key)) return toonCache.get(key)!;
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  if (shared && !Object.keys(extra).length) toonCache.set(key, m);
  return m;
}
const INK = 0x140c10;
function outlineMat(width: number) {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${width.toFixed(4)};`); };
  return m;
}
const OUT_HEAD = outlineMat(0.025), OUT_BODY = outlineMat(0.012);
/** Add an inked outline shell to every mesh under `o` (inverted hull). */
function ink(o: THREE.Object3D, mat = OUT_HEAD) {
  const ms: THREE.Mesh[] = []; o.traverse(x => { if ((x as THREE.Mesh).isMesh && !x.userData.noInk) ms.push(x as THREE.Mesh); });
  for (const m of ms) { const sh = new THREE.Mesh(m.geometry, mat); sh.userData.noInk = true; sh.userData.shell = true; m.add(sh); }
}
const S = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number] = [0, 0, 0], sc: [number, number, number] = [1, 1, 1], r: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.scale.set(...sc); m.rotation.set(...r); return m;
}

// ── Caricature heads (built facing +Z, origin at the neck) ───────────────────
const WHITE = toon(0xffffff), BLACK = toon(0x120a0e), GOLD = toon(0xffc300);
function eyes(h: THREE.Group, y: number, spread: number, z: number, size: number, angry: boolean) {
  for (const sx of [-1, 1]) {
    h.add(mesh(S(size, 10, 8), WHITE, [sx * spread, y, z], [1, 1.15, 0.6]));
    h.add(mesh(S(size * 0.45, 10, 8), BLACK, [sx * spread * 0.92, y - size * 0.15, z + size * 0.45]));
    if (angry) h.add(mesh(new THREE.BoxGeometry(size * 2.4, size * 0.55, size * 0.6), BLACK, [sx * spread, y + size * 1.25, z + size * 0.2], [1, 1, 1], [0, 0, sx * 0.45]));
  }
}
function mouthArc(h: THREE.Group, y: number, z: number, w: number, frown: boolean, mat = BLACK) {
  const m = mesh(new THREE.TorusGeometry(w, w * 0.22, 6, 16, Math.PI), mat, [0, y, z], [1, 0.7, 0.5], [0, 0, frown ? 0 : Math.PI]);
  h.add(m); return m;
}
function skullTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, 512, 256);
  const cols = ['#f72585', '#4cc9f0', '#ffd166', '#06d6a0', '#9b5de5', '#ff6b6b'];
  // forehead flower + swirls painted onto the skull's UVs (front of sphere is u≈0.75)
  const fx = 384; g.lineWidth = 6;
  for (let k = 0; k < 8; k++) { g.fillStyle = cols[k % 6]; g.beginPath(); g.ellipse(fx + Math.cos(k * 0.785) * 22, 60 + Math.sin(k * 0.785) * 14, 12, 7, k * 0.785, 0, 7); g.fill(); }
  g.fillStyle = '#ffd166'; g.beginPath(); g.arc(fx, 60, 10, 0, 7); g.fill();
  for (let k = 0; k < 9; k++) { g.strokeStyle = cols[k % 6]; g.beginPath(); g.arc(fx - 120 + k * 30, 128 + (k % 2) * 30, 14, 0, Math.PI); g.stroke(); }
  for (let k = 0; k < 40; k++) { g.fillStyle = cols[k % 6]; g.beginPath(); g.arc(Math.random() * 512, 10 + Math.random() * 236, 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let skullTex: THREE.Texture | null = null;

function makeHead(kind: CharKind): THREE.Group {
  const h = new THREE.Group();
  if (kind === 'abuela') {
    const skin = toon(0xe9b48f);
    h.add(mesh(S(0.5, 16, 12), skin, [0, 0.48, 0], [1, 0.95, 0.92]));                 // head
    h.add(mesh(S(0.14, 12, 10), toon(0xd98d6c), [0, 0.4, 0.48], [1, 0.95, 1.1]));      // big nose
    h.add(mesh(S(0.1), skin, [-0.47, 0.45, 0], [0.5, 1, 0.8])); h.add(mesh(S(0.1), skin, [0.47, 0.45, 0], [0.5, 1, 0.8])); // ears
    h.add(mesh(S(0.035, 8, 6), GOLD, [-0.5, 0.33, 0.02])); h.add(mesh(S(0.035, 8, 6), GOLD, [0.5, 0.33, 0.02]));
    eyes(h, 0.6, 0.18, 0.4, 0.085, true);
    for (const sx of [-1, 1]) h.add(mesh(new THREE.TorusGeometry(0.13, 0.022, 5, 14), BLACK, [sx * 0.18, 0.6, 0.47])); // glasses
    h.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), BLACK, [0, 0.62, 0.5]));
    mouthArc(h, 0.17, 0.42, 0.13, true, toon(0x7a1f2b));                             // big frown
    h.add(mesh(S(0.53, 14, 10), toon(0xbfc2c9), [0, 0.6, -0.06], [1, 0.82, 0.95]));   // hair cap
    h.add(mesh(S(0.22, 14, 10), toon(0xaeb1b9), [0, 1.02, -0.18]));                     // bun
    h.add(mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 14), toon(0xd6337a), [0, 0.95, -0.16], [1, 1, 1], [1.2, 0, 0])); // bun band
    h.children.forEach(c => { if ((c as THREE.Mesh).material === skin && c.position.y === 0.48) (c as THREE.Mesh).scale.z = 0.92; });
  } else if (kind === 'luchador') {
    const red = toon(0xc1121f);
    h.add(mesh(S(0.5, 16, 12), red, [0, 0.5, 0], [1, 1.05, 0.95]));                  // mask
    h.add(mesh(S(0.34, 16, 12), toon(0xb07a55), [0, 0.12, 0.2], [1.05, 0.6, 0.8]));   // big jaw (skin)
    for (const sx of [-1, 1]) {
      h.add(mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 18), GOLD, [sx * 0.19, 0.6, 0.42], [1.25, 0.85, 1], [0, sx * 0.3, sx * 0.5])); // raised eye trims
      h.add(mesh(S(0.11, 12, 10), WHITE, [sx * 0.19, 0.6, 0.42], [1.2, 0.75, 0.5]));
      h.add(mesh(S(0.05, 8, 6), BLACK, [sx * 0.17, 0.58, 0.47]));
      h.add(mesh(new THREE.ConeGeometry(0.06, 0.32, 6), GOLD, [sx * 0.12, 0.92, 0.3], [1, 1, 0.5], [-0.5, 0, sx * -0.35])); // forehead flames
    }
    h.add(mesh(new THREE.ConeGeometry(0.07, 0.4, 6), GOLD, [0, 0.98, 0.3], [1, 1, 0.5], [-0.5, 0, 0]));
    h.add(mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 16), GOLD, [0, 0.26, 0.42], [1.3, 0.8, 1]));   // mouth trim
    mouthArc(h, 0.22, 0.45, 0.08, true, toon(0x5a0a0a));
    h.add(mesh(S(0.16, 12, 10), toon(0xa06a48), [0, 0.42, 0.47], [0.8, 0.7, 0.8]));   // nose
  } else if (kind === 'calaca') {
    skullTex ??= skullTexture();
    const bone = toon(0xffffff, { map: skullTex });
    h.add(mesh(S(0.5, 18, 12), bone, [0, 0.58, 0], [1, 1.05, 0.95], [0, -Math.PI / 2, 0])); // cranium (texture front faces +Z)
    h.add(mesh(new THREE.BoxGeometry(0.5, 0.24, 0.42), toon(0xf6f1e4), [0, 0.2, 0.14])); // jaw
    for (const sx of [-1, 1]) {
      h.add(mesh(S(0.15, 14, 10), BLACK, [sx * 0.19, 0.58, 0.38], [1, 1.1, 0.6]));       // deep sockets
      h.add(mesh(S(0.04, 8, 6), toon(0xff4d6d, { emissive: 0xff2050 }), [sx * 0.19, 0.58, 0.46])); // glowing pupils
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; h.add(mesh(S(0.04, 6, 5), toon([0xf72585, 0x4cc9f0, 0xffd166, 0x06d6a0][k % 4]), [sx * 0.19 + Math.cos(a) * 0.2, 0.58 + Math.sin(a) * 0.2, 0.4 + (Math.sin(a) > 0 ? -0.02 : 0)])); }
    }
    h.add(mesh(new THREE.ConeGeometry(0.07, 0.14, 3), BLACK, [0, 0.4, 0.47], [1, 1, 0.5], [Math.PI, 0, 0])); // nose hole
    h.add(mesh(new THREE.BoxGeometry(0.44, 0.13, 0.05), BLACK, [0, 0.22, 0.38]));
    for (let k = 0; k < 6; k++) h.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), WHITE, [-0.18 + k * 0.072, 0.23, 0.4])); // teeth
    // little charro sombrero
    const hat = new THREE.Group(); hat.position.set(0, 1.02, -0.02); hat.rotation.z = 0.15;
    hat.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 22), BLACK));
    hat.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.32, 16), BLACK, [0, 0.17, 0]));
    hat.add(mesh(new THREE.TorusGeometry(0.71, 0.025, 5, 26), GOLD, [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
    hat.add(mesh(new THREE.TorusGeometry(0.29, 0.03, 5, 18), GOLD, [0, 0.06, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
    hat.add(mesh(S(0.07, 8, 6), toon(0xff8c00), [0.24, 0.1, 0.12]));
    h.add(hat);
  } else { // kid
    const skin = toon(0xf1c09a);
    h.add(mesh(S(0.5, 16, 12), skin, [0, 0.48, 0], [1, 0.95, 0.95]));
    for (const sx of [-1, 1]) h.add(mesh(S(0.12), skin, [sx * 0.5, 0.45, 0], [0.5, 1, 0.8]));
    eyes(h, 0.55, 0.17, 0.42, 0.08, false);
    h.add(mesh(S(0.08, 10, 8), toon(0xe39a7a), [0, 0.42, 0.48]));
    mouthArc(h, 0.27, 0.42, 0.1, false, toon(0x7a1f2b));
    const hair = toon(0x4a2a17);
    h.add(mesh(S(0.53, 14, 10), hair, [0, 0.66, -0.05], [1, 0.75, 1]));
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; h.add(mesh(S(0.17, 10, 8), hair, [Math.cos(a) * 0.32, 0.92 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.32 - 0.05])); }
    h.add(mesh(S(0.2, 10, 8), hair, [0, 1.02, 0.05]));
  }
  return mergeByMaterial(h);
}
/** Merge a static group's meshes into one mesh per material (far fewer draw calls), then ink it. */
const headCache = new Map<CharKind, THREE.Group>();
function mergeByMaterial(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; let geo = m.geometry.clone().applyMatrix4(m.matrixWorld); if (geo.index) geo = geo.toNonIndexed(); if (!geo.attributes.uv) return; const mat = m.material as THREE.Material; if (!by.has(mat)) by.set(mat, []); by.get(mat)!.push(geo); });
  const out = new THREE.Group();
  for (const [mat, geos] of by) out.add(new THREE.Mesh(mergeGeometries(geos), mat));
  ink(out); return out;
}
function headFor(kind: CharKind) { if (!headCache.has(kind)) headCache.set(kind, makeHead(kind)); return headCache.get(kind)!.clone(); }

// ── Body looks ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function stripes(a: string, b: string) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d')!;
  for (let y = 0; y < 64; y += 16) { g.fillStyle = a; g.fillRect(0, y, 8, 8); g.fillStyle = b; g.fillRect(0, y + 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const LOOK: Record<CharKind, { main: () => THREE.Material; joints: number; head: number; scale: [number, number, number] }> = {
  abuela: { main: () => toon(0xd6337a), joints: 0xe9b48f, head: 1.85, scale: [1.12, 0.8, 1.12] },
  luchador: { main: () => toon(0xc1121f), joints: 0xffc300, head: 1.7, scale: [1.18, 0.95, 1.18] },
  calaca: { main: () => toon(0x1d1626), joints: 0xf6f1e4, head: 1.75, scale: [0.95, 0.92, 0.95] },
  kid: { main: () => toon(0x2b8fd6), joints: 0xf1c09a, head: 1.95, scale: [0.95, 0.72, 0.95] },
};

export function makeChar(kind: CharKind): Char {
  if (!base) throw new Error('chars not loaded');
  const root = new THREE.Group();
  const model = skClone(base.scene) as THREE.Object3D;
  root.add(model);
  model.scale.set(...LOOK[kind].scale);
  const look = LOOK[kind];
  const flashables: THREE.MeshToonMaterial[] = [];
  model.traverse(o => {
    const m = o as THREE.SkinnedMesh; if (!m.isMesh) return;
    m.frustumCulled = false;
    const mk = (mm: THREE.Material) => { const t = (mm.name === 'M_Joints' ? toon(look.joints, {}, false) : look.main().clone()) as THREE.MeshToonMaterial; t.side = THREE.DoubleSide; flashables.push(t); return t; };
    m.material = Array.isArray(m.material) ? m.material.map(mk) : mk(m.material);
  });
  const bones: Record<string, THREE.Object3D> = {};
  const norm = (n: string) => n.replace(/[^a-z0-9]/gi, '').toLowerCase();
  model.traverse(o => { bones[norm(o.name)] = o; });
  const B = (n: string) => bones[norm(n)];
  const headBone = B('DEF-head'), hips = B('DEF-hips'), chest = B('DEF-spine.003'), handR = B('DEF-hand.R');
  // Shrink the mannequin head into the neck and mount the caricature head on the bone instead.
  const HB = 0.25;
  const head = headFor(kind); const hs = (look.head * 0.34) / HB;
  head.scale.set(hs / look.scale[0] * look.scale[1] * 1.0, hs, hs / look.scale[2] * look.scale[1]);
  head.position.y = 0.02 / HB; headBone.add(head);
  head.traverse(o => { const mm = (o as THREE.Mesh).material as THREE.MeshToonMaterial; if (mm?.isMeshToonMaterial && !flashables.includes(mm)) { const c = mm.clone(); (o as THREE.Mesh).material = c; flashables.push(c); } });
  const add = (parent: THREE.Object3D, o: THREE.Object3D, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => { o.position.set(...p); o.rotation.set(...r); parent.add(o); ink(o, OUT_BODY); return o; };
  if (kind === 'abuela') {
    add(hips, mesh(new THREE.CylinderGeometry(0.2, 0.38, 0.62, 16, 1, true), toon(0xd6337a, { side: THREE.DoubleSide }), [0, -0.28, 0]), [0, -0.28, 0]);
    add(hips, mesh(new THREE.CylinderGeometry(0.38, 0.39, 0.08, 16, 1, true), toon(0x06d6a0, { side: THREE.DoubleSide })), [0, -0.6, 0]);
    add(chest, mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.18, 14, 1, true), toon(0x7b2cbf, { side: THREE.DoubleSide })), [0, 0.2, 0]); // rebozo shawl
    const ch = new THREE.Group();
    ch.add(mesh(new THREE.BoxGeometry(0.13, 0.03, 0.32), toon(0x2b6cb0)));
    ch.add(mesh(new THREE.TorusGeometry(0.05, 0.014, 5, 10, Math.PI), toon(0xffd166), [0, 0.01, 0.07]));
    ch.scale.setScalar(1.6); add(handR, ch, [0, 0.12, 0.04], [0, 0, 0.3]);
  } else if (kind === 'luchador') {
    add(hips, mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 18), GOLD), [0, 0.05, 0], [Math.PI / 2, 0, 0]);
    add(chest, mesh(new THREE.PlaneGeometry(0.55, 0.7), toon(0xffc300, { side: THREE.DoubleSide })), [0, -0.2, -0.16], [0.15, 0, 0]);
  } else if (kind === 'calaca') {
    add(chest, mesh(new THREE.ConeGeometry(0.07, 0.13, 4), toon(0xf72585)), [0, 0.2, 0.13], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 3; i++) add(chest, mesh(S(0.028, 6, 5), GOLD), [0, 0.03 - i * 0.09, 0.15]);
  } else {
    add(hips, mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.24, 14), toon(0xd62828)), [0, -0.05, 0]); // red shorts
    for (let i = 0; i < 3; i++) add(chest, mesh(new THREE.TorusGeometry(0.165 - i * 0.01, 0.022, 5, 18), WHITE), [0, 0.1 - i * 0.12, 0], [Math.PI / 2, 0, 0]); // white stripes
  }
  const mixer = new THREE.AnimationMixer(model);
  let cur: THREE.AnimationAction | undefined;
  const play: Char['play'] = (name, o = {}) => {
    const clip = base!.clips.find(c => c.name === name); if (!clip) return;
    const a = mixer.clipAction(clip);
    a.reset(); a.timeScale = o.speed ?? 1;
    if (o.once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.play(); if (cur && cur !== a) cur.crossFadeTo(a, o.fade ?? 0.15, false);
    cur = a; return a;
  };
  const update = (dt: number) => { mixer.update(dt); headBone.scale.setScalar(HB); };
  let lastFlash = -1;
  const setFlash = (hex: number) => { if (hex === lastFlash) return; lastFlash = hex; for (const m of flashables) m.emissive.setHex(hex); };
  return { root, mixer, head, play, update, setFlash, dispose: () => mixer.stopAllAction() };
}
