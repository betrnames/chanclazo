// Chancla Waves: a Plants-vs-Zombies-style lane defence (three.js).
// The sugar-skull boy and Catrina girl march on the ofrenda in waves; throw the gold chancla to knock them out.
// Tap / drag at a kid to throw (aim follows the finger, release throws), or tap the gold chancla button to auto-aim.
// Each kid that crosses the marigold line costs a heart. Waves get bigger and faster; there is no last wave.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { $, autoUnlockAudio, wireMute, report } from './common';
import { markGameStart, markFirstAction, track } from '../analytics';
import { makeChancla, makeCandle, buildBackdrop, glowTex, dotTex } from './crashArt';
import * as sfx from './crashAudio';
import { FX, HitStop } from './fx3d';

const G = 16;
const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
const LANES = [-2.25, -0.75, 0.75, 2.25];
const SPAWN_Z = -9.5, LINE_Z = 2.0, HEARTS = 5;
const BEST_KEY = 'cz_waves_best_v1';
const LAUNCH = new THREE.Vector3();

// ───────────────────────── renderer / scene ─────────────────────────
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 2 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 200);
const CAM_POS = new THREE.Vector3(0, 5.0, 8.0), CAM_LOOK = new THREE.Vector3(0, 0.6, -2.6);
const camLook = CAM_LOOK.clone(); // CAM_LOOK adjusted per screen shape in resize()
camera.position.copy(CAM_POS); camera.lookAt(camLook);
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(4, 12, 6); sun.target.position.set(0, 0, -5); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 10, bottom: -8, near: 1, far: 40 }); sun.shadow.bias = -0.0008;
const fill = new THREE.PointLight(0xffa64d, 12, 16, 1.6); fill.position.set(0, 3, -1); scene.add(fill);

const backdrop = buildBackdrop('plaza');
scene.add(backdrop.group); scene.fog = backdrop.fog; scene.background = backdrop.fog.color;
hemi.color.setHex(backdrop.hemi[0]); hemi.groundColor.setHex(backdrop.hemi[1]); sun.color.setHex(backdrop.sun);

function resize(): void {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h; camera.aspect = aspect;
  // keep ~40° horizontal on narrow phones so all four lanes fit
  const hv = 46 * Math.PI / 180, vNeeded = 2 * Math.atan(Math.tan(hv / 2) / aspect) * 180 / Math.PI;
  camera.fov = Math.max(68, Math.min(84, vNeeded)); camera.updateProjectionMatrix();
  // the relic floats ~80% down the screen, a little in front of the ofrenda
  // Tilt the view so the front of the ofrenda table sits just above the bottom buttons.
  // On tall phones this removes the empty band under the table: the plaza and lanes fill the screen.
  const want = -1 + 2 * Math.max(96, h * 0.115) / h; // NDC y for the table's front-bottom edge
  const front = new THREE.Vector3(0, 0, LINE_Z + 1.7), pv = new THREE.Vector3();
  let lo = -2.6, hi = 3.5; // CAM_LOOK.y range: higher = look up = table lower on screen
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2; camLook.set(CAM_LOOK.x, mid, CAM_LOOK.z);
    camera.position.copy(CAM_POS); camera.lookAt(camLook); camera.updateMatrixWorld();
    if (pv.copy(front).project(camera).y > want) lo = mid; else hi = mid;
  }
  camLook.y = Math.min(CAM_LOOK.y + 2.2, Math.max(CAM_LOOK.y, (lo + hi) / 2)); // never look further down than the old framing
  camera.position.copy(CAM_POS); camera.lookAt(camLook); camera.updateMatrixWorld();
  const d = new THREE.Vector3(0, -0.58, 0.5).unproject(camera).sub(camera.position).normalize();
  LAUNCH.copy(camera.position).addScaledVector(d, 5.0);
}

// ───────────────────────── the street: lanes, marigold line, ofrenda ─────────────────────────
const lambert = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(o);
const flames: THREE.Sprite[] = [];
{
  // painted lane runners (papel-picado colours, very subtle) down the cobbles
  const cols = [0xe2197a, 0x1ec8c8, 0xff8c1a, 0x8a3cff];
  LANES.forEach((x, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, LINE_Z - SPAWN_Z + 2), new THREE.MeshLambertMaterial({ color: cols[i], transparent: true, opacity: 0.13, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, (LINE_Z + SPAWN_Z) / 2 - 1); scene.add(m);
  });
  // marigold garland = the defence line
  const mari = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.15, 0), lambert({ color: 0xff8c1a, emissive: 0x4a1c00, flatShading: true }), 140);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 70; i++) { const x = -3.4 + i * (6.8 / 69); m4.makeTranslation(x, 0.12 + Math.random() * 0.06, LINE_Z + 0.25 + (Math.random() - 0.5) * 0.18); mari.setMatrixAt(k++, m4); }
  for (let i = 0; i < 70; i++) { const x = -3.4 + i * (6.8 / 69); m4.makeTranslation(x, 0.1, LINE_Z + 0.5 + (Math.random() - 0.5) * 0.18); mari.setMatrixAt(k++, m4); }
  mari.count = k; scene.add(mari);
  // candles along the line
  for (let i = 0; i < 8; i++) {
    const c = makeCandle(0.28 + (i % 3) * 0.12, i % 2 ? 0xf7ecd0 : 0xffe0b0);
    c.group.position.set(-3.3 + i * (6.6 / 7), 0, LINE_Z + 0.85); scene.add(c.group);
    c.flame.userData.phase = i; flames.push(c.flame);
  }
  // ofrenda table behind the line (what the kids are after)
  const tbl = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.35, 0.6), lambert({ color: 0x3b1a5c })); tbl.position.set(0, 0.17, LINE_Z + 1.35); tbl.receiveShadow = true; scene.add(tbl);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.06, 0.7), lambert({ color: 0xe2197a })); cloth.position.set(0, 0.36, LINE_Z + 1.35); scene.add(cloth);
}
// ───────────────────────── art ─────────────────────────
const texLoader = new THREE.TextureLoader();
// Every atlas is loaded before the first render and before any kid clones its texture.
// (Rendering a clone whose image has not arrived yet logs "Texture marked for update but no image data found".)
const texLoads: Promise<void>[] = [];
function tex(src: string): THREE.Texture {
  let done!: () => void; texLoads.push(new Promise<void>((r) => { done = r; }));
  const t = texLoader.load(src, () => done(), undefined, () => { report(`texture failed: ${src}`); done(); });
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// ───────────────────────── art ─────────────────────────
// Enemy art registry: animated Agent Sprite Forge atlases (public/waves/sprites/<name>-atlas.webp + .json).
// Each atlas = uniform cells. Default rows: walk 8, hit 3, ko 4. Counts can be shorter (the boy sheet is 6 / 1 / 3).
// Anchor = feet point inside every cell. To swap art, drop a new atlas in and update its numbers here (copied from its JSON meta).
interface Sheet { tex: THREE.Texture; W: number; H: number; cw: number; ch: number; ax: number; ay: number; h: number; stride: number; walkN: number; hitN: number; koN: number }
const sheet = (name: string, W: number, H: number, cw: number, ch: number, ax: number, ay: number, h: number, stride: number, walkN = 8, hitN = 3, koN = 4, v = ''): Sheet =>
  ({ tex: tex(`/waves/sprites/${name}-atlas.webp${v}`), W, H, cw, ch, ax, ay, h, stride, walkN, hitN, koN });
const ANIM = { walk: { row: 0, n: 8, fps: 10 }, hit: { row: 1, n: 3, fps: 12 }, ko: { row: 2, n: 4, fps: 10 } } as const;
type AnimName = keyof typeof ANIM;
// h = world height that a 320px-tall body should be; stride = world units per walk cycle
const ART = {
  boy: sheet('calavera-boy', 3328, 1302, 416, 434, 208, 422, 1.64, 1.5, 6, 1, 3),
  girl: sheet('catrina-girl', 2576, 1086, 368, 362, 184, 354, 2.02, 1.55, 7, 1, 2, '?v=3'),
  // the little calaverita skeleton from the home-screen plaza: small, fast, hops toward the line, 1 hit
  calaca: sheet('calaverita-small', 2432, 1014, 304, 338, 155, 331, 1.2, 1.6),
  // the ORIGINAL Chanclazo luchador (red/yellow mask, shirtless, LUCHA belt; source public/play/luchador_sprite.webp) = the boss
  lucha: sheet('luchador-boss', 2744, 1038, 343, 346, 170, 339, 2.75, 2.0),
};
const pmrem = new THREE.PMREMGenerator(renderer);
const goldEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const relicStrap = new THREE.MeshStandardMaterial({ color: 0xf2b020, metalness: 0.85, roughness: 0.26, emissive: 0x4a2a00, emissiveIntensity: 0.45, envMap: goldEnv, envMapIntensity: 1.2 });
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const petalTex = canvasTex(32, 32, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(16, 16, 14, 8, 0.4, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(13, 14, 6, 3, 0.4, 0, Math.PI * 2); g.fill(); });
const blobTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const ringTex = canvasTex(128, 128, (g) => {
  g.strokeStyle = 'rgba(40,10,60,.85)'; g.lineWidth = 14; g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#ffd23f'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
});
const haloMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd27a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

// the floating gold chancla relic at the bottom centre (where throws start)
LAUNCH.set(0, 1.35, 4.9);
const relic = new THREE.Group(); const relicMesh = makeChancla();
const relicSole = new THREE.MeshStandardMaterial({ color: 0xffb21a, metalness: 1, roughness: 0.22, emissive: 0x2a1400, emissiveIntensity: 0.5, envMap: goldEnv, envMapIntensity: 1.6 });
relicMesh.children.forEach((c, i) => { (c as THREE.Mesh).material = i === 0 ? relicSole : relicStrap; }); relicMesh.scale.setScalar(0.85); relic.add(relicMesh);
const relicHalo = new THREE.Sprite(haloMat.clone()); relicHalo.scale.setScalar(1.7); relicHalo.renderOrder = -1; relic.add(relicHalo);
relic.position.copy(LAUNCH); relic.visible = false;
let relicKick = 0;

// aim preview: dotted arc + ground ring
const dotMat = new THREE.SpriteMaterial({ map: dotTex(), transparent: true, depthWrite: false, opacity: 0.9, fog: false });
const dots: THREE.Sprite[] = [];
const dotGroup = new THREE.Group(); scene.add(dotGroup);
for (let i = 0; i < 16; i++) { const d = new THREE.Sprite(dotMat); d.scale.setScalar(0.16); dotGroup.add(d); dots.push(d); }
const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, fog: false }));
ring.rotation.x = -Math.PI / 2; scene.add(ring);
dotGroup.visible = ring.visible = false;

// ───────────────────────── state ─────────────────────────
type Kind = 'boy' | 'girl' | 'jefe' | 'calaca' | 'lucha';
interface Kid {
  kind: Kind; root: THREE.Group; body: THREE.Mesh; flash: THREE.Mesh; shadow: THREE.Mesh; mat: THREE.MeshBasicMaterial; flashMat: THREE.MeshBasicMaterial;
  pips?: THREE.Sprite[]; aura?: THREE.Sprite; hpFill?: THREE.Sprite; hpBar?: THREE.Sprite; variant: number;
  sheet: Sheet; map: THREE.Texture; edgeMat: THREE.Material; anim: AnimName; animT: number; frameKey: number;
  x: number; z: number; lane: number; speed: number; hp: number; maxHp: number; h: number; w: number; golden: boolean;
  phase: number; flashT: number; stagger: number; ko: number; koSpin: number; koVy: number; koY: number; dead: boolean; wob: number; wobA: number;
}
interface Shot { obj: THREE.Group; p: THREE.Vector3; v: THREE.Vector3; spent: number; spin: number; yaw: number; target?: Kid; born: number; bomb?: boolean }
interface Petal { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; spin: number }
type State = 'title' | 'play' | 'between' | 'paused' | 'over';
let state: State = 'title', prevState: State = 'play';
let kids: Kid[] = [], shots: Shot[] = [], petals: Petal[] = [];
let wave = 0, toSpawn = 0, spawned = 0, waveTotal = 0, spawnT = 0, nextWaveAt = 0, hearts = HEARTS, score = 0, knocked = 0, thrown = 0;
let lastThrow = -1e9, combo = 0, comboT = 0, rapidUntil = 0, holding = false, shake = 0, clock = 0;
let best = (() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } })();
const kidGroup = new THREE.Group(); scene.add(kidGroup);
const fxGroup = new THREE.Group(); scene.add(fxGroup);
const fx = new FX(scene, 0), hitStop = new HitStop();
let bombs = 0, bossPending = false, boss: Kid | undefined;
const BOMB_MAX = 3, BOMB_R = 2.4, BOMB_DMG = 4;

// ───────────────────────── kids ─────────────────────────
const planeGeo = new Map<string, THREE.PlaneGeometry>();
function geoFor(kind: string, w: number, h: number, ax = 0.5, ay = 1): THREE.PlaneGeometry {
  if (!planeGeo.has(kind)) { const g = new THREE.PlaneGeometry(w, h); g.translate(-(ax - 0.5) * w, -(0.5 - ay) * h, 0); planeGeo.set(kind, g); } // feet anchor at the origin
  return planeGeo.get(kind)!;
}
const pipTex = canvasTex(32, 32, (g) => { g.fillStyle = '#3b1a5c'; g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ff3d9a'; g.beginPath(); g.arc(16, 16, 9, 0, Math.PI * 2); g.fill(); });
const hpBgTex = canvasTex(128, 24, (g) => { g.fillStyle = '#1a0826'; g.beginPath(); g.roundRect(0, 0, 128, 24, 12); g.fill(); g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.roundRect(2, 2, 124, 20, 10); g.stroke(); });
const hpFillTex = canvasTex(64, 16, (g) => { const gr = g.createLinearGradient(0, 0, 0, 16); gr.addColorStop(0, '#ff8a5c'); gr.addColorStop(1, '#d6122a'); g.fillStyle = gr; g.fillRect(0, 0, 64, 16); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 2, 64, 4); });
// luchador atlas: head centre x and the top of his head (px inside a cell, measured from the walk frames)
const BOSS_HEAD = { x: 180, top: 12 };
function bossHp(n: number): number { return 8 + Math.floor(n / 3) * 3; } // wave 3: 11, wave 6: 14, ...
function spawnKid(kind: Kind, lane: number, speed: number, golden = false): Kid {
  const variant = 0;
  const a = kind === 'girl' ? ART.girl : kind === 'calaca' ? ART.calaca : kind === 'lucha' ? ART.lucha : ART.boy;
  const scale = kind === 'jefe' ? 1.3 : 1;
  const h = a.h * scale * (a.ch / 320), w = h * (a.cw / a.ch); // plane = one atlas cell
  const map = a.tex.clone(); map.repeat.set(a.cw / a.W, a.ch / a.H); // the clone shares the image (no extra memory)
  const mat = new THREE.MeshBasicMaterial({ map, alphaTest: 0.45, side: THREE.FrontSide, fog: true });
  const flashMat = new THREE.MeshBasicMaterial({ map, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, alphaTest: 0.45, side: THREE.FrontSide, fog: false });
  const root = new THREE.Group();
  const gk = `${kind}${variant}`;
  const body = new THREE.Mesh(geoFor(gk, w, h, a.ax / a.cw, a.ay / a.ch), mat); body.castShadow = true;
  const flash = new THREE.Mesh(geoFor(gk, w, h, a.ax / a.cw, a.ay / a.ch), flashMat); flash.position.z = 0.01; body.add(flash);
  // same drawing, stacked into a thick card so the cutout has an edge instead of looking like a sticker
  const edgeMat = new THREE.MeshBasicMaterial({ map, color: 0x241028, alphaTest: 0.45, side: THREE.FrontSide, fog: true });
  for (let i = 1; i <= 4; i++) {
    const edge = new THREE.Mesh(body.geometry, edgeMat);
    edge.position.set(0, -0.012 * i, -0.028 * i);
    edge.castShadow = false; body.add(edge);
  }
  if (kind === 'jefe') mat.color.setHex(0xd8c8ff); // big brother: a touch of purple
  root.add(body);
  const bodyW = kind === 'girl' ? w * (220 / a.cw) : w;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(bodyW * 0.72, bodyW * 0.32), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.02, 0.04); root.add(shadow);
  const k: Kid = { kind, root, body, flash, shadow, mat, flashMat, x: LANES[lane], z: SPAWN_Z, lane, speed, hp: kind === 'jefe' ? 3 : kind === 'lucha' ? bossHp(wave) : 1, maxHp: kind === 'jefe' ? 3 : kind === 'lucha' ? bossHp(wave) : 1, h, w: bodyW, golden, variant, sheet: a, map, edgeMat, anim: 'walk', animT: 0, frameKey: -1,
    phase: Math.random() * 6, flashT: 0, stagger: 0, ko: -1, koSpin: 0, koVy: 0, koY: 0, dead: false, wob: 0, wobA: wave >= 4 && Math.random() < 0.35 ? 0.35 + Math.random() * 0.25 : 0 };
  if (kind === 'jefe') {
    k.pips = [];
    for (let i = 0; i < k.maxHp; i++) { const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: pipTex, depthWrite: false, fog: false })); p.scale.setScalar(0.3); p.position.set((i - (k.maxHp - 1) / 2) * 0.34, h + 0.16, 0.02); body.add(p); k.pips.push(p); }
  }
  if (kind === 'lucha') { // boss health bar centred over his head. It is a child of the body, so it follows his walk, lean and sway.
    const headX = (BOSS_HEAD.x - a.ax) / a.cw * w, headY = (a.ay - BOSS_HEAD.top) / a.ch * h + 0.22;
    k.hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpBgTex, depthWrite: false, depthTest: false, fog: false })); k.hpBar.scale.set(1.7, 0.32, 1); k.hpBar.position.set(headX, headY, 0.05); k.hpBar.renderOrder = 8;
    k.hpFill = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpFillTex, depthWrite: false, depthTest: false, fog: false })); k.hpFill.center.set(0, 0.5); k.hpFill.scale.set(1.56, 0.18, 1); k.hpFill.position.set(headX - 0.78, headY, 0.06); k.hpFill.renderOrder = 9;
    body.add(k.hpBar, k.hpFill); boss = k;
  }
  if (golden) { k.aura = new THREE.Sprite(haloMat.clone()); k.aura.scale.set(w * 2.2, h * 1.5, 1); k.aura.position.y = h * 0.5; k.aura.renderOrder = -1; root.add(k.aura); }
  root.position.set(k.x, 0, k.z);
  kidGroup.add(root); kids.push(k);
  return k;
}
function kidCenter(k: Kid, out = new THREE.Vector3()): THREE.Vector3 { return out.set(k.root.position.x, k.h * 0.55, k.root.position.z); }
function alive(k: Kid): boolean { return k.ko < 0 && !k.dead; }
function setFrame(k: Kid, anim: AnimName, i: number): void {
  const n = anim === 'walk' ? k.sheet.walkN : anim === 'hit' ? k.sheet.hitN : k.sheet.koN;
  const A = ANIM[anim], col = Math.min(n - 1, i), key = A.row * 16 + col; if (key === k.frameKey) return; k.frameKey = key;
  const sh = k.sheet; k.map.offset.set((col * sh.cw) / sh.W, 1 - ((A.row + 1) * sh.ch) / sh.H);
}
function playAnim(k: Kid, anim: AnimName): void { k.anim = anim; k.animT = 0; }

// ───────────────────────── waves ─────────────────────────
function waveSpec(n: number) {
  return {
    count: 5 + n * 3,
    speed: Math.min(2.9, 1.05 + n * 0.17),
    gap: Math.max(0.42, 1.75 - n * 0.13),
    girl: Math.min(0.55, 0.15 + n * 0.06),
    jefe: n >= 3 ? Math.min(0.22, 0.06 + (n - 3) * 0.03) : 0,
    calaca: Math.min(0.3, 0.14 + n * 0.03),
  };
}
function startWave(n: number): void {
  wave = n; const s = waveSpec(n);
  toSpawn = waveTotal = s.count; spawned = 0; spawnT = 0.4;
  bossPending = n % 3 === 0; // the luchador boss shows up every 3rd wave
  state = 'play';
  $('wave').textContent = `Wave ${n}`;
  banner(`WAVE ${n}`, n === 1 ? 'Here they come!' : bossPending ? '¡Cuidado! El Luchador is coming' : `${s.count} kids · faster!`);
  sfx.sfxRapid();
  track('wave_start', { game: 'waves', wave: n });
  updateHud();
}
let goldenThisWave = false;
function spawnTick(dt: number): void {
  if (toSpawn <= 0) return;
  spawnT -= dt; if (spawnT > 0) return;
  const s = waveSpec(wave);
  spawnT = s.gap * (0.7 + Math.random() * 0.6);
  const r = Math.random();
  const bossNow = bossPending && spawned >= Math.floor(waveTotal / 2);
  const kind: Kind = bossNow ? 'lucha' : r < s.jefe ? 'jefe' : r < s.jefe + s.calaca ? 'calaca' : r < s.jefe + s.calaca + s.girl ? 'girl' : 'boy';
  const sp = s.speed * (kind === 'girl' ? 1.3 : kind === 'jefe' ? 0.62 : kind === 'calaca' ? 1.55 : kind === 'lucha' ? 0.42 : 1) * (0.9 + Math.random() * 0.2);
  if (bossNow) { bossPending = false; banner('¡EL LUCHADOR!', 'Lots of hits · or drop a chancla BOMB 💣'); sfx.sfxCombo(3); shake = 0.5; }
  // avoid stacking two in the same lane back to back
  let lane = Math.floor(Math.random() * LANES.length);
  const recent = kids.filter((k) => alive(k) && k.z < SPAWN_Z + 1.6).map((k) => k.lane);
  for (let i = 0; i < 4 && recent.includes(lane); i++) lane = (lane + 1) % LANES.length;
  // one golden kid per wave from wave 2 (knock it out for RAPID FIRE)
  const golden = wave >= 2 && !goldenThisWave && spawned >= Math.floor(waveTotal / 3) && (kind === 'boy' || kind === 'girl');
  if (golden) goldenThisWave = true;
  spawnKid(kind, lane, sp, golden);
  toSpawn--; spawned++;
}
function checkWaveDone(): void {
  if (state !== 'play' || toSpawn > 0 || kids.some(alive)) return;
  const bonus = 250 * wave + hearts * 50;
  score += bonus; updateHud();
  state = 'between'; nextWaveAt = clock + 2.6; goldenThisWave = false;
  const gotBomb = wave >= 2 && bombs < BOMB_MAX; if (gotBomb) giveBomb(1);
  banner(`WAVE ${wave} CLEAR!`, gotBomb ? `+${bonus} bonus · +1 chancla BOMB 💣` : `+${bonus} bonus`);
  sfx.sfxWin();
  track('wave_clear', { game: 'waves', wave, hearts });
}

// ───────────────────────── throwing ─────────────────────────
const shotProto = makeChancla(); shotProto.children.forEach((c, i) => { (c as THREE.Mesh).material = i === 0 ? relicSole : relicStrap; });
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function flightTime(to: THREE.Vector3): number { return THREE.MathUtils.clamp(LAUNCH.distanceTo(to) / 17, 0.32, 0.85); }
function velFor(to: THREE.Vector3, T: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set((to.x - LAUNCH.x) / T, (to.y - LAUNCH.y + 0.5 * G * T * T) / T, (to.z - LAUNCH.z) / T);
}
/** Where a kid will be after t seconds. */
function predict(k: Kid, t: number, out: THREE.Vector3): THREE.Vector3 {
  kidCenter(k, out); out.z += k.speed * t * (k.stagger > 0 ? 0.2 : 1);
  if (k.wobA) out.x = LANES[k.lane] + Math.sin((k.wob + k.speed * t) * 1.3) * k.wobA;
  return out;
}
function leadPoint(k: Kid, out: THREE.Vector3): THREE.Vector3 {
  predict(k, 0, out); let T = flightTime(out);
  for (let i = 0; i < 3; i++) { predict(k, T, out); T = flightTime(out); }
  return out;
}
function cooldown(): number { return clock < rapidUntil ? 0.09 : 0.26; }
function canThrow(): boolean { return state === 'play' || state === 'between' ? clock - lastThrow >= cooldown() : false; }
function throwAt(to: THREE.Vector3, target?: Kid): boolean {
  if (!canThrow()) return false;
  const T = flightTime(to);
  const v = velFor(to, T, new THREE.Vector3());
  const obj = shotProto.clone(); scene.add(obj); FX.glow(obj, 1.2, 0.45);
  obj.position.copy(LAUNCH);
  shots.push({ obj, p: LAUNCH.clone(), v, spent: -1, spin: 0, yaw: Math.atan2(v.x, v.z), target, born: clock });
  lastThrow = clock; thrown++; relicKick = 1;
  if (thrown === 1) { markFirstAction('waves', 'throw'); $('hint').classList.add('gone'); }
  if (clock < rapidUntil) { sfx.sfxRapidShot(); sfx.buzz(8); } else { sfx.sfxFire(); sfx.sfxWhoosh(); sfx.buzz(14); }
  return true;
}
/** Closest kid to the line (the most dangerous one). */
function threat(): Kid | undefined {
  let bestK: Kid | undefined;
  for (const k of kids) if (alive(k) && k.z > SPAWN_Z + 0.5 && (!bestK || k.z > bestK.z)) bestK = k;
  return bestK;
}
function autoThrow(): boolean {
  const k = threat(); if (!k) return false;
  const to = leadPoint(k, new THREE.Vector3());
  if (clock < rapidUntil) { to.x += (Math.random() - 0.5) * 0.35; }
  return throwAt(to, k);
}

// ───────────────────────── input: tap / drag at a kid ─────────────────────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75);
let aiming = false, aimKid: Kid | undefined;
const aimPt = new THREE.Vector3();
function pointerAim(e: PointerEvent): void {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(kids.filter(alive).map((k) => k.body), false);
  aimKid = hits.length ? kids.find((k) => k.body === hits[0].object) : undefined;
  if (!aimKid) {
    // generous assist: snap to a kid whose screen position is near the finger
    let bestD = 0.13;
    for (const k of kids) { if (!alive(k)) continue; const s = kidCenter(k, tmpV).project(camera); const d = Math.hypot((s.x - ndc.x) * camera.aspect, s.y - ndc.y); if (d < bestD) { bestD = d; aimKid = k; } }
  }
  if (aimKid) leadPoint(aimKid, aimPt);
  else if (!ray.ray.intersectPlane(aimPlane, aimPt)) aimPt.set(0, 0.75, -6);
  aimPt.z = Math.min(aimPt.z, LINE_Z + 0.5);
}
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'play' && state !== 'between') return;
  sfx.unlockCrashAudio();
  aiming = true; holding = true; canvas.setPointerCapture?.(e.pointerId); pointerAim(e);
  if (clock < rapidUntil) throwAt(aimPt.clone(), aimKid);
});
canvas.addEventListener('pointermove', (e) => { if (aiming) pointerAim(e); });
const endAim = (e: PointerEvent) => {
  if (!aiming) return; aiming = false; holding = false; pointerAim(e);
  if (state === 'play' || state === 'between') { if (aimKid) leadPoint(aimKid, aimPt); throwAt(aimPt.clone(), aimKid); }
};
canvas.addEventListener('pointerup', endAim);
canvas.addEventListener('pointercancel', () => { aiming = false; holding = false; });

const fireBtn = $('fire') as HTMLButtonElement;
let fireHeld = false;
fireBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); sfx.unlockCrashAudio();
  fireBtn.classList.add('press'); fireHeld = true;
  if (!autoThrow() && !threat()) sfx.sfxClick();
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) fireBtn.addEventListener(ev, () => { fireBtn.classList.remove('press'); fireHeld = false; });
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { if (state === 'play' || state === 'between') { e.preventDefault(); autoThrow(); } }
  if (e.code === 'KeyB') useBomb();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});

// ───────────────────────── hits + knock-outs ─────────────────────────
function hitKid(k: Kid, s?: Shot, dmg = 1): void {
  k.hp = Math.max(0, k.hp - dmg); k.flashT = 1; shake = Math.min(0.5, shake + 0.18);
  const pan = THREE.MathUtils.clamp(k.root.position.x / 3, -1, 1);
  sfx.sfxThwack(0.9); sfx.buzz(20);
  const at = kidCenter(k, new THREE.Vector3());
  if (s) { // chancla bounces off and spins away
    s.spent = 0; s.v.set(-s.v.x * 0.25 + (Math.random() - 0.5) * 2, 5.5, Math.abs(s.v.z) * 0.18 + 1.5);
    fx.ring(at, 0.9); fx.sparks(at, 14); sfx.sfxImpact(0.7);
  }
  if (k.pips) k.pips.forEach((p, i) => { p.visible = i < k.hp; });
  if (k.hpFill) k.hpFill.scale.x = 1.56 * (k.hp / k.maxHp);
  if (k.hp > 0) {
    const big = k.kind === 'lucha'; playAnim(k, 'hit'); k.stagger = big ? 0.18 : 0.45; k.z -= big ? 0.2 : 0.55; sfx.sfxWood(0.7, pan);
    popText(k, big ? (dmg > 1 ? `BOOM −${dmg}` : `${k.hp}/${k.maxHp}`) : 'OUCH!', 'bad'); return;
  }
  // knocked out
  k.ko = 0; k.koSpin = 0; k.koVy = 2.6; k.koY = 0; playAnim(k, 'ko');
  k.mat.transparent = true; k.mat.alphaTest = 0.05; k.mat.depthWrite = false;
  sfx.sfxRattle(pan);
  knocked++;
  combo = clock - comboT < 1.3 ? combo + 1 : 1; comboT = clock;
  const base = k.kind === 'lucha' ? 1500 : k.kind === 'jefe' ? 300 : k.kind === 'girl' ? 150 : k.kind === 'calaca' ? 130 : 100;
  const far = THREE.MathUtils.clamp((LINE_Z - k.z) / (LINE_Z - SPAWN_Z), 0, 1); // earlier knock-outs pay more
  const pts = Math.round((base + far * 50) * Math.min(combo, 5) / 10) * 10;
  score += pts; updateHud(true);
  popText(k, `+${pts}`, combo >= 2 || k.kind === 'jefe' || k.kind === 'lucha' ? 'big' : '');
  sfx.sfxPoint(Math.min(combo, 8));
  if (combo >= 2) showCombo(combo);
  if (k.golden) startRapid();
  poof(at, k.kind === 'lucha' ? 70 : k.kind === 'jefe' ? 46 : 30);
  fx.sparks(at, 14, 0xffd36b, 4); fx.sparks(at, 8, 0xff8c1a, 3); sfx.sfxShimmer(k.kind === 'lucha' ? 1 : 0.6);
  if (clock >= rapidUntil) hitStop.stop(k.kind === 'lucha' ? 160 : 40);
  if (k.kind === 'lucha') { boss = undefined; shake = 1; fx.ring(at, 3.2); banner('¡LUCHADOR DOWN!', bombs < BOMB_MAX ? '+1 chancla BOMB 💣' : 'Bombs full'); if (bombs < BOMB_MAX) giveBomb(1); }
}
// ───────────────────────── chancla BOMB power-up ─────────────────────────
const bombProto = (() => {
  const g = new THREE.Group(); const m = makeChancla();
  const sole = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.2, emissive: 0x7a2a00, emissiveIntensity: 0.9, envMap: goldEnv, envMapIntensity: 1.8 });
  m.children.forEach((c, i) => { (c as THREE.Mesh).material = i === 0 ? sole : relicStrap; }); m.scale.setScalar(1.45); g.add(m);
  FX.glow(g, 2.2, 0.85); const hot = FX.glow(g, 1.1, 0.9); hot.material.color.setHex(0xff5a1a);
  return g;
})();
const bombBtn = $('bomb') as HTMLButtonElement;
function giveBomb(n: number): void {
  bombs = Math.min(BOMB_MAX, bombs + n); sfx.sfxBombReady(); updateBombBtn();
}
function updateBombBtn(): void {
  const on = bombs > 0;
  bombBtn.classList.toggle('ghost', !on);
  bombBtn.classList.toggle('ready', on);
  bombBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
  $('bombN').textContent = String(bombs);
}
/** Best spot for the bomb: the boss if he's out, else the densest, closest cluster of kids. */
function bombTarget(): THREE.Vector3 | undefined {
  const live = kids.filter((k) => alive(k) && k.z > SPAWN_Z + 0.5); if (!live.length) return undefined;
  if (boss && alive(boss)) return predict(boss, 0.8, new THREE.Vector3()).setY(0.4);
  let bestS = -1, bestK = live[0];
  for (const k of live) {
    let sc = 0; for (const o of live) { const d = Math.hypot(o.root.position.x - k.root.position.x, o.root.position.z - k.root.position.z); if (d < BOMB_R) sc += 1 + (o.z - SPAWN_Z) * 0.05; }
    sc += (k.z - SPAWN_Z) * 0.08; if (sc > bestS) { bestS = sc; bestK = k; }
  }
  return predict(bestK, 0.8, new THREE.Vector3()).setY(0.4);
}
function useBomb(): boolean {
  if (bombs <= 0 || !(state === 'play' || state === 'between')) return false;
  const to = bombTarget(); if (!to) return false;
  bombs--; updateBombBtn();
  const T = 0.8, v = velFor(to, T, new THREE.Vector3());
  const obj = bombProto.clone(); scene.add(obj); obj.position.copy(LAUNCH);
  shots.push({ obj, p: LAUNCH.clone(), v, spent: -1, spin: 0, yaw: Math.atan2(v.x, v.z), born: clock, bomb: true });
  relicKick = 1.4; sfx.sfxFire(); sfx.sfxWhoosh(); sfx.buzz(30);
  track('bomb', { game: 'waves', wave });
  return true;
}
let booms = 0;
function explode(at: THREE.Vector3): void {
  booms++;
  const c = at.clone().setY(0.5);
  for (const k of kids) {
    if (!alive(k)) continue;
    const d = Math.hypot(k.root.position.x - c.x, k.root.position.z - c.z);
    if (d < BOMB_R + k.w * 0.3) hitKid(k, undefined, k.kind === 'lucha' || k.kind === 'jefe' ? BOMB_DMG : 99);
  }
  fx.ring(c, 4.6, 0xffd36b); fx.ring(c.clone().setY(1.1), 3.0, 0xff7a2a);
  fx.sparks(c, 90, 0xffd36b, 9, 6); fx.sparks(c, 50, 0xff7a1a, 7, 5); fx.sparks(c, 20, 0xffffff, 5, 4);
  poof(c.clone().setY(1.2), 60);
  const f = $('boomflash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  shake = 1.2; hitStop.stop(120); sfx.sfxBoom(); sfx.buzz([60, 40, 90]);
}
bombBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlockCrashAudio(); bombBtn.classList.add('press'); useBomb(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) bombBtn.addEventListener(ev, () => bombBtn.classList.remove('press'));
function startRapid(): void {
  rapidUntil = clock + 5; sfx.sfxRapid(); sfx.buzz([20, 40, 20]);
  banner('RAPID FIRE!', 'Hold to spray chanclas'); $('rapid').classList.remove('hidden');
}
const PETAL_COLORS = [0xff8c1a, 0xffb000, 0xffd23f, 0xff6a00, 0xe2197a];
function poof(at: THREE.Vector3, n: number): void {
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: petalTex, color: PETAL_COLORS[i % PETAL_COLORS.length], transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m); s.scale.setScalar(0.17 + Math.random() * 0.12); s.position.copy(at);
    const a = Math.random() * Math.PI * 2, up = 2.5 + Math.random() * 4;
    const sp = 1.6 + Math.random() * 2.6;
    fxGroup.add(s);
    const max = 0.55 + Math.random() * 0.45;
    petals.push({ s, v: new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp * 0.6), life: 0, max, spin: (Math.random() - 0.5) * 12 });
  }
  // a quick glow puff
  const g = new THREE.Sprite(haloMat.clone()); g.position.copy(at); g.scale.setScalar(0.5); fxGroup.add(g);
  petals.push({ s: g, v: new THREE.Vector3(0, 0.6, 0), life: 0, max: 0.35, spin: 0 });
}
function tickPetals(dt: number): void {
  for (const p of petals) {
    p.life += dt;
    p.v.y -= 7 * dt; p.v.multiplyScalar(1 - 1.8 * dt);
    p.s.position.addScaledVector(p.v, dt);
    p.s.material.rotation += p.spin * dt;
    const k = p.life / p.max;
    if (p.spin === 0) p.s.scale.setScalar(0.5 + k * 3.2);
    // petals fade out mid-air and never land (no confetti on the floor)
    const lowFade = THREE.MathUtils.clamp((p.s.position.y - 0.35) / 0.6, 0, 1);
    p.s.material.opacity = Math.max(0, (1 - k * k)) * lowFade * (p.spin === 0 ? 0.8 : 1);
  }
  petals = petals.filter((p) => { const done = p.life >= p.max || p.s.position.y < 0.35; if (done) { fxGroup.remove(p.s); p.s.material.dispose(); } return !done; });
}
function kidReachedLine(k: Kid): void {
  k.dead = true; kidGroup.remove(k.root); k.mat.dispose(); k.flashMat.dispose(); k.edgeMat.dispose(); k.map.dispose();
  hearts = Math.max(0, hearts - (k.kind === 'lucha' ? 3 : 1)); if (k === boss) boss = undefined; updateHud();
  const hs = $('hearts').children; const lostEl = hs[hearts] as HTMLElement | undefined;
  if (lostEl) { lostEl.classList.remove('lost'); void lostEl.offsetWidth; lostEl.classList.add('lost'); }
  const h = $('hurt'); h.classList.add('on'); setTimeout(() => h.classList.remove('on'), 90);
  shake = 0.7; sfx.sfxBoing(); sfx.sfxThwack(0.5); sfx.buzz([40, 30, 60]);
  popText(k, '−❤️', 'bad');
  combo = 0;
  if (hearts <= 0) gameOver();
}

// ───────────────────────── HUD + overlays ─────────────────────────
function updateHud(bump = false): void {
  $('score').textContent = String(score);
  if (bump) { const b = $('scoreBox'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  const hs = $('hearts');
  if (hs.children.length !== HEARTS) { hs.innerHTML = ''; for (let i = 0; i < HEARTS; i++) { const e = document.createElement('i'); e.textContent = '❤️'; hs.appendChild(e); } }
  Array.from(hs.children).forEach((e, i) => e.classList.toggle('off', i >= hearts));
  const downs = waveTotal ? (spawned - kids.filter(alive).length) / waveTotal : 0;
  ($('bar') as HTMLElement).style.width = `${Math.round(THREE.MathUtils.clamp(downs, 0, 1) * 100)}%`;
}
function banner(title: string, sub: string): void {
  const b = $('banner'); b.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function showCombo(n: number): void {
  const c = $('combo'); c.textContent = n >= 4 ? `¡CHANCLAZO! x${n}` : `COMBO x${n}`;
  c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  if (n >= 3) sfx.sfxCombo(Math.min(n - 1, 4));
}
function popText(k: Kid, text: string, cls: string): void {
  const v = new THREE.Vector3(k.root.position.x, k.h + 0.2, k.root.position.z).project(camera);
  const el = document.createElement('div'); el.className = `pop ${cls}`; el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`; el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
  $('fx').appendChild(el); setTimeout(() => el.remove(), 1000);
}
function clearField(): void {
  for (const k of kids) { kidGroup.remove(k.root); k.mat.dispose(); k.flashMat.dispose(); k.edgeMat.dispose(); k.map.dispose(); }
  for (const s of shots) scene.remove(s.obj);
  for (const p of petals) { fxGroup.remove(p.s); p.s.material.dispose(); }
  kids = []; shots = []; petals = []; fx.clear(); boss = undefined;
}
function newGame(): void {
  clearField();
  hearts = HEARTS; score = 0; knocked = 0; thrown = 0; combo = 0; rapidUntil = 0; goldenThisWave = false; bombs = params.has('bombs') ? Math.min(BOMB_MAX, Number(params.get('bombs')) || 0) : 0; updateBombBtn();
  ['title', 'over', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  stage.classList.remove('on-title'); // HUD, hearts, fire and bomb buttons only show once play starts
  $('hint').classList.remove('gone');
  setTimeout(() => $('hint').classList.add('gone'), 5000);
  markGameStart('waves');
  startWave(params.has('wave') ? Math.max(1, Number(params.get('wave'))) : 1);
}
function gameOver(): void {
  state = 'over'; aiming = false;
  const isBest = score > best; if (isBest) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ } }
  $('oWave').textContent = String(wave); $('oScore').textContent = String(score);
  $('oBest').textContent = isBest && score > 0 ? '🏆 New best!' : `Best: ${best}`;
  const txt = `I held the marigold line to wave ${wave} with ${score} points in Chancla Waves 🥿💀🌼`;
  ($('share') as HTMLAnchorElement).href = `https://x.com/intent/post?text=${encodeURIComponent(txt)}&url=${encodeURIComponent('https://chanclazo.com/waves')}`;
  sfx.sfxLose();
  setTimeout(() => { if (state === 'over') $('over').classList.remove('hidden'); }, 900);
  track('game_over', { game: 'waves', wave, score, knocked, thrown });
}
function togglePause(): void {
  if (state === 'paused') { state = prevState; $('pause').classList.add('hidden'); return; }
  if (state !== 'play' && state !== 'between') return;
  prevState = state; state = 'paused'; $('pause').classList.remove('hidden');
}
let artReady = false, startWhenReady = false;
$('play').addEventListener('click', () => { sfx.unlockCrashAudio(); sfx.sfxClick(); if (artReady) newGame(); else startWhenReady = true; });
$('retry').addEventListener('click', () => { sfx.sfxClick(); newGame(); });
$('restart').addEventListener('click', () => { sfx.sfxClick(); newGame(); });
$('resume').addEventListener('click', () => { sfx.sfxClick(); togglePause(); });
$('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); sfx.sfxClick(); togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'play' || state === 'between')) togglePause(); });

// ───────────────────────── main loop ─────────────────────────
let prev = performance.now(), fpsAcc = 0, fpsN = 0, lowFps = 0, fireState = '';
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.05, (now - prev) / 1000); prev = now;
  fpsAcc += dtReal; fpsN++;
  if (fpsAcc > 2) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 45 && ++lowFps >= 2 && renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); resize(); report('quality: low'); } }
  const running = state === 'play' || state === 'between' || state === 'over';
  const dt = state === 'paused' ? 0 : dtReal * hitStop.scale();
  if (state !== 'paused') clock += dt;
  const s = now / 1000;

  if (state === 'play') spawnTick(dt);
  if (state === 'between' && clock >= nextWaveAt) startWave(wave + 1);
  // rapid fire: holding the button or the field keeps spraying
  if (clock < rapidUntil && (state === 'play' || state === 'between')) {
    if (fireHeld) autoThrow();
    else if (holding && aiming) throwAt(aimPt.clone().add(tmpV2.set((Math.random() - 0.5) * 0.4, 0, 0)), aimKid);
    ($('rapid') as HTMLElement).style.setProperty('--p', String((rapidUntil - clock) / 5));
  } else if (!$('rapid').classList.contains('hidden')) { $('rapid').classList.add('hidden'); if (rapidUntil) sfx.sfxRapidEnd(); rapidUntil = 0; }

  // kids
  for (const k of kids) {
    if (k.dead) continue;
    k.flashT = Math.max(0, k.flashT - dt * 4); k.flashMat.opacity = k.flashT * 0.95;
    if (k.ko >= 0) {
      // knock-out: small pop, the atlas KO frames do the fall, then fade
      k.ko += dt; k.koVy -= 14 * dt; k.koY = Math.max(0, k.koY + k.koVy * dt);
      k.root.position.y = k.koY;
      setFrame(k, 'ko', Math.floor(k.ko * ANIM.ko.fps)); k.body.rotation.set(0.28, 0, 0); k.body.scale.set(1, 1, 1);
      k.root.position.z -= dt * 1.2;
      k.mat.opacity = THREE.MathUtils.clamp((1.15 - k.ko) / 0.45, 0, 1);
      (k.shadow.material as THREE.MeshBasicMaterial).opacity = k.mat.opacity;
      if (k.pips) k.pips.forEach((p) => { p.visible = false; });
      if (k.aura) k.aura.visible = false;
      if (k.hpBar) { k.hpBar.visible = false; k.hpFill!.visible = false; }
      if (k.ko > 1.15) { k.dead = true; kidGroup.remove(k.root); k.mat.dispose(); k.flashMat.dispose(); k.edgeMat.dispose(); k.map.dispose(); }
      continue;
    }
    if (state === 'play' || state === 'between') {
      const sp = k.stagger > 0 ? k.speed * 0.15 : k.speed;
      k.stagger = Math.max(0, k.stagger - dt);
      k.z += sp * dt; k.wob += sp * dt;
    }
    k.x = k.wobA ? LANES[k.lane] + Math.sin(k.wob * 1.3) * k.wobA : LANES[k.lane];
    // walk frames follow distance so the planted feet in the atlas stay on the cobbles. No extra hop (that read as a skip).
    const cyc = (k.wob / (k.sheet.stride * (k.kind === 'jefe' ? 1.3 : 1)) + k.phase) % 1;
    if (k.anim === 'hit') { k.animT += dt; const i = Math.floor(k.animT * ANIM.hit.fps); if (i >= ANIM.hit.n) playAnim(k, 'walk'); else setFrame(k, 'hit', i); }
    if (k.anim === 'walk') setFrame(k, 'walk', Math.floor(cyc * k.sheet.walkN));
    if (k.hpBar) { const pulse = k.hp / k.maxHp < 0.34 ? 1 + Math.sin(s * 12) * 0.06 : 1; k.hpBar.scale.set(1.7 * pulse, 0.32 * pulse, 1); }
    k.root.position.set(k.x, 0, k.z);
    k.body.rotation.set(0.2, -k.x * 0.04, k.stagger > 0 ? Math.sin(s * 40) * 0.05 : 0);
    if (k.aura) { k.aura.material.opacity = 0.55 + Math.sin(s * 6) * 0.25; }
    if (k.z >= LINE_Z && state === 'play') kidReachedLine(k);
  }
  kids = kids.filter((k) => !k.dead);
  if (state === 'over') { for (const k of kids) if (alive(k)) { k.root.position.y = Math.abs(Math.sin(s * 9 + k.phase)) * 0.35; } }

  // chanclas in flight
  for (const sh of shots) {
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      sh.v.y -= G * h; sh.p.addScaledVector(sh.v, h);
      if (sh.spent < 0 && state !== 'over') {
        if (sh.bomb) { // the bomb goes off on the first kid it touches, or where it lands
          const touch = kids.some((k) => alive(k) && Math.abs(sh.p.x - k.root.position.x) < k.w * 0.5 && Math.abs(sh.p.z - k.root.position.z) < 0.6 && sh.p.y < k.h);
          if (touch || sh.p.y <= 0.3) { explode(sh.p); sh.spent = 0.61; sh.obj.visible = false; break; }
          continue;
        }
        for (const k of kids) {
          if (!alive(k)) continue;
          const dx = sh.p.x - k.root.position.x, dz = sh.p.z - k.root.position.z;
          if (Math.abs(dx) < k.w * 0.48 + 0.18 && Math.abs(dz) < 0.55 && sh.p.y > 0.05 && sh.p.y < k.h + 0.15) { hitKid(k, sh); break; }
        }
        if (sh.spent < 0 && sh.p.y <= 0.06) { sh.spent = 0; sh.p.y = 0.06; sh.v.set(sh.v.x * 0.3, 2.2, sh.v.z * 0.2); sfx.sfxWood(0.35, 0); }
      }
    }
    if (sh.spent >= 0) sh.spent += dt;
    sh.spin += dt * (sh.spent >= 0 ? 9 : 20);
    sh.obj.position.copy(sh.p);
    if (sh.spent < 0 && dt > 0) { if (sh.bomb) fx.sparks(sh.p, 3, 0xff8a2a, 1.2, 0.6); else if (Math.random() < 0.5) fx.trail(sh.p); }
    if (sh.spent < 0) sh.obj.rotation.set(0.25, sh.yaw + sh.spin, 0, 'YXZ');
    else { sh.obj.rotation.set(sh.spin * 0.8, sh.yaw + sh.spin * 0.4, sh.spin * 0.3, 'YXZ'); sh.obj.scale.setScalar(Math.max(0.01, 1 - sh.spent * 1.6)); }
  }
  shots = shots.filter((sh) => { const done = sh.spent > 0.6 || sh.p.z < -40 || clock - sh.born > 4; if (done) scene.remove(sh.obj); return !done; });
  tickPetals(dt); fx.update(dt, camera);
  checkWaveDone();
  if (running) updateBar();

  // relic: floats and bobs; kicks back when a chancla leaves
  relicKick = Math.max(0, relicKick - dtReal * 5);
  relic.position.set(LAUNCH.x, LAUNCH.y + Math.sin(s * 2.2) * 0.08 - relicKick * 0.18, LAUNCH.z + relicKick * 0.25);
  relicMesh.rotation.set(0.95 + Math.sin(s * 1.7) * 0.08 - relicKick * 0.6, Math.PI / 2 + Math.sin(s * 0.9) * 0.35, Math.sin(s * 1.3) * 0.1, 'YXZ');
  relicHalo.material.opacity = 0.22 + Math.sin(s * 3) * 0.08 + relicKick * 0.4;

  // aim preview while dragging
  const showAim = aiming && (state === 'play' || state === 'between');
  dotGroup.visible = ring.visible = showAim;
  if (showAim) {
    const T = flightTime(aimPt); const v = velFor(aimPt, T, tmpV);
    dots.forEach((d, i) => { const t = (i + 1) / (dots.length + 1) * T; d.position.set(LAUNCH.x + v.x * t, LAUNCH.y + v.y * t - 0.5 * G * t * t, LAUNCH.z + v.z * t); d.material.opacity = 0.9; });
    ring.position.set(aimPt.x, 0.03, aimPt.z); ring.scale.setScalar(0.9 + Math.sin(s * 8) * 0.08);
    (ring.material as THREE.MeshBasicMaterial).color.setHex(aimKid ? 0xffffff : 0xb0a0c0);
  }
  for (const f of flames) f.scale.set(0.42 + Math.sin(s * 13 + f.userData.phase) * 0.04, 0.55 + Math.sin(s * 9 + f.userData.phase) * 0.06, 1);
  backdrop.update(now);

  // gold chancla button
  const fb = clock < rapidUntil && state !== 'over' ? 'rapid' : (state === 'play' || state === 'between') ? (canThrow() ? 'ready' : 'busy') : 'off';
  if (fb !== fireState) { fireState = fb; fireBtn.classList.toggle('ready', fb === 'ready'); fireBtn.classList.toggle('busy', fb === 'busy'); fireBtn.classList.toggle('rapid', fb === 'rapid'); }

  shake = Math.max(0, shake - dtReal * 1.6);
  camera.position.set(CAM_POS.x + (Math.random() - 0.5) * shake * 0.4, CAM_POS.y + (Math.random() - 0.5) * shake * 0.3, CAM_POS.z);
  camera.lookAt(camLook);
  renderer.render(scene, camera);
}
let lastBar = -1;
function updateBar(): void { const v = spawned * 1000 + kids.filter(alive).length; if (v !== lastBar) { lastBar = v; updateHud(); } }

// ───────────────────────── boot ─────────────────────────
addEventListener('resize', resize);
resize();
autoUnlockAudio(); wireMute();
for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) addEventListener(ev, () => sfx.unlockCrashAudio(), { capture: true, passive: true });
$('hint').textContent = isTouch ? 'Tap or drag at a kid to throw · or tap the gold chancla' : 'Click or drag at a kid to throw · Space = gold chancla';
updateHud();
Promise.all(texLoads).then(() => {
  artReady = true;
  // title-screen ambience: a few kids already marching in the background
  for (let i = 0; i < 4; i++) { const k = spawnKid(i % 2 ? 'girl' : 'boy', i, 0); k.z = -7.5 + ((i * 5) % 4) * 2.0; }
  if (params.has('start') || startWhenReady) newGame();
  prev = performance.now();
  requestAnimationFrame(frame);
});

// test / screenshot hooks
(window as unknown as Record<string, unknown>).__waves = {
  ready: () => artReady,
  start: newGame,
  state: () => ({ state, wave, hearts, score, knocked, thrown, kids: kids.filter(alive).length, toSpawn, shots: shots.length, petals: petals.length, rapid: clock < rapidUntil, bombs, booms, boss: boss && alive(boss) ? { hp: boss.hp, maxHp: boss.maxHp, z: +boss.root.position.z.toFixed(2) } : null }),
  kids: () => kids.filter(alive).map((k) => ({ kind: k.kind, x: +k.root.position.x.toFixed(2), z: +k.root.position.z.toFixed(2), hp: k.hp, golden: k.golden })),
  screenOf: (i = 0) => { const k = kids.filter(alive).sort((a, b) => b.z - a.z)[i]; if (!k) return null; const v = kidCenter(k).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; },
  auto: autoThrow,
  wave: (n: number) => { clearField(); startWave(n); },
  spawn: (kind: Kind = 'boy', lane = 1, z = -6, speed = 1.2) => { const k = spawnKid(kind, lane, speed); k.z = z; return kids.length; },
  hurt: (n = 1) => { for (let i = 0; i < n; i++) { const k = spawnKid('boy', i % 4, 1); k.z = LINE_Z - 0.01; } },
  rapid: startRapid,
  bomb: useBomb,
  giveBomb: (n = 1) => giveBomb(n),
  pause: (on: boolean) => { if (on !== (state === 'paused')) togglePause(); },
};
