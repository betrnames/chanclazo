// Rigged low-poly characters built from Quaternius' CC0 Universal Animation Library mannequin,
// re-dressed in code as the Chanclazo abuela, a luchador and a charro calaca.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type CharKind = 'abuela' | 'luchador' | 'calaca';
export interface Char {
  root: THREE.Group; mixer: THREE.AnimationMixer;
  play: (name: string, opts?: { once?: boolean; fade?: number; speed?: number }) => THREE.AnimationAction | undefined;
  bone: (n: string) => THREE.Object3D | undefined;
  dispose: () => void;
}
let base: { scene: THREE.Object3D; clips: THREE.AnimationClip[] } | null = null;
const tl = new THREE.TextureLoader();
const T = (u: string) => { const t = tl.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; };
let faces: Record<CharKind, THREE.Texture> | null = null;

export async function loadChars() {
  const g = await new GLTFLoader().loadAsync('/cruise/mannequin.glb');
  base = { scene: g.scene, clips: g.animations };
  faces = { abuela: T('/cruise/abuela_face.webp'), luchador: T('/cruise/lucha_mask.webp'), calaca: T('/cruise/sugarskull256.webp') };
}

const lam = (c: number, o: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const LOOK: Record<CharKind, { main: number; joints: number }> = {
  abuela: { main: 0xd6337a, joints: 0xe0a77e },   // floral pink dress, skin
  luchador: { main: 0xc1121f, joints: 0xffc300 }, // red tights, gold trim
  calaca: { main: 0x16101e, joints: 0xf4efe1 },   // black charro suit, bone white
};

export function makeChar(kind: CharKind): Char {
  if (!base || !faces) throw new Error('chars not loaded');
  const root = new THREE.Group();
  const model = skClone(base.scene) as THREE.Object3D;
  root.add(model);
  const look = LOOK[kind];
  model.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(mm =>
      lam(mm.name === 'M_Joints' ? look.joints : look.main, { side: THREE.DoubleSide }));
    m.material = Array.isArray(m.material) ? mats : mats[0];
  });
  const bones: Record<string, THREE.Object3D> = {};
  const norm = (n: string) => n.replace(/[^a-z0-9]/gi, '').toLowerCase();
  model.traverse(o => { bones[norm(o.name)] = o; });
  const B = (n: string) => bones[norm(n)];
  const head = B('DEF-head'), hips = B('DEF-hips'), chest = B('DEF-spine.003'), handR = B('DEF-hand.R');
  const add = (parent: THREE.Object3D, mesh: THREE.Object3D, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
    mesh.position.set(...p); mesh.rotation.set(...r); parent.add(mesh); return mesh;
  };
  // Face decal on the front of the head (works with the head bone's local axes: +Y up the neck, +Z forward)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: faces[kind], transparent: true, alphaTest: 0.2, side: THREE.DoubleSide }));
  face.userData.face = true;
  if (kind === 'abuela') {
    add(head, face, [0, 0.12, 0.14]).scale.setScalar(0.44);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), lam(0xb8b8c0)), [0, 0.15, -0.02]).scale.set(1, 1, 0.95); // gray hair
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lam(0xa0a0aa)), [0, 0.27, -0.08]); // bun
    add(hips, new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.34, 0.7, 14, 1, true), lam(0xd6337a, { side: THREE.DoubleSide })), [0, -0.3, 0]); // skirt
    add(hips, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.35, 0.08, 14, 1, true), lam(0x06d6a0, { side: THREE.DoubleSide })), [0, -0.63, 0]); // hem
    add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 16), lam(0xffc300)), [0, 0.12, 0.03], [Math.PI / 2, 0, 0]); // gold chain
    const ch = new THREE.Group(); // the chancla in her hand
    ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.28), lam(0x2b6cb0)));
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10, Math.PI), lam(0xffd166)); strap.position.set(0, 0.01, 0.06); ch.add(strap);
    ch.scale.setScalar(1.8); add(handR, ch, [0, 0.12, 0.04], [0, 0, 0.3]);
    ch.userData.chancla = true;
  } else if (kind === 'luchador') {
    add(head, face, [0, 0.12, 0.13]).scale.setScalar(0.4);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), lam(0xc1121f)), [0, 0.12, -0.02]); // mask back
    add(hips, new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 18), lam(0xffc300)), [0, 0.05, 0], [Math.PI / 2, 0, 0]); // belt
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), lam(0xffc300, { side: THREE.DoubleSide }));
    add(chest, cape, [0, -0.2, -0.14], [0.15, 0, 0]);
  } else {
    add(head, face, [0, 0.12, 0.14]).scale.setScalar(0.38);
    const hat = new THREE.Group();
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20), lam(0x16101e)));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 14), lam(0x16101e)); crown.position.y = 0.08; hat.add(crown);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 5, 24), lam(0xffc300)); band.rotation.x = Math.PI / 2; hat.add(band);
    add(head, hat, [0, 0.27, -0.01]);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lam(0xff8c00)); flower.position.set(0.12, 0.06, 0.06); hat.add(flower);
    add(chest, new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 4), lam(0xf72585)), [0, 0.18, 0.12], [0, 0, Math.PI / 2]); // bow tie
    for (let i = 0; i < 3; i++) add(chest, new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), lam(0xffc300)), [0, 0.02 - i * 0.09, 0.14]);
      }
  if (kind === 'abuela') model.scale.set(1.08, 0.86, 1.08);
  if (kind === 'luchador') model.scale.set(1.12, 1.05, 1.12);
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
  return { root, mixer, play, bone: n => B(n), dispose: () => mixer.stopAllAction() };
}
