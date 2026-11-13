// The /waves game, now called "Día de los Muertos" (display name: WAVES_NAME in src/gameNames.ts): a Plants-vs-Zombies-style lane defence (three.js).
// The sugar-skull boy and Catrina girl march on the ofrenda in waves; throw the gold chancla to knock them out.
// Tap / drag at a kid to throw (aim follows the finger, release throws), or tap the gold chancla button to auto-aim.
// Each kid that crosses the marigold line costs a heart. Waves get bigger and faster; there is no last wave.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { $, autoUnlockAudio, wireMute, report } from './common';
import { initAudioControls } from './music';
import { setMuted } from '../game/sound';
import { WAVES_NAME } from '../gameNames';
import { markGameStart, markFirstAction, track } from '../analytics';
import { makeChancla, makeCandle, buildBackdrop, glowTex, dotTex } from './crashArt';
import * as sfx from './crashAudio';
import { FX, HitStop } from './fx3d';
import { playPlayer1Intro } from './player1Intro';

const G = 16;
const isTouch = matchMedia('(pointer: coarse)').matches;
// Phones start on the cheap path: Gabe's iPhone was dropping frames once a wave got busy.
const PREFER_LOW = isTouch;
const PETAL_CAP = PREFER_LOW ? 36 : 64;
const TRAIL_CHANCE = PREFER_LOW ? 0.18 : 0.5;
const params = new URLSearchParams(location.search);
const LANES = [-2.25, -0.75, 0.75, 2.25];
const SPAWN_Z = -9.5, LINE_Z = 2.0, HEARTS = 5;
const BEST_KEY = 'cz_waves_best_v1';
const LAUNCH = new THREE.Vector3();

// Independent UV offset/repeat, same GPU image. Texture.clone() sets source.needsUpdate,
// which re-uploads the whole atlas (the girl sheet is 3360×1770) on every spawn, eat pose, and knock-out.
function shareTex(src: THREE.Texture): THREE.Texture {
  const t = new THREE.Texture();
  t.source = src.source;
  t.colorSpace = src.colorSpace;
  t.wrapS = src.wrapS; t.wrapT = src.wrapT;
  t.magFilter = src.magFilter; t.minFilter = src.minFilter;
  t.anisotropy = src.anisotropy;
  t.flipY = src.flipY;
  t.generateMipmaps = src.generateMipmaps;
  t.premultiplyAlpha = src.premultiplyAlpha;
  t.unpackAlignment = src.unpackAlignment;
  t.format = src.format; t.type = src.type; t.mapping = src.mapping;
  t.repeat.copy(src.repeat); t.offset.copy(src.offset); t.center.copy(src.center);
  t.rotation = src.rotation;
  t.matrixAutoUpdate = src.matrixAutoUpdate; t.matrix.copy(src.matrix);
  // Initialized so Three binds the already-cached WebGL texture — do not bump source.version.
  t.version = Math.max(1, src.version);
  return t;
}

// ───────────────────────── renderer / scene ─────────────────────────
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: !PREFER_LOW, powerPreference: 'high-performance' });
let quality = PREFER_LOW ? 1 : 2; // 2 = desktop shadows + higher DPR; 1 = phone start; 0 = last-resort DPR 1
let qualityLocked = false;
function dprCap(q: number): number { return q >= 2 ? 1.75 : q >= 1 ? 1.5 : 1; }
function applyQuality(q: number): void {
  quality = Math.max(0, Math.min(2, q));
  renderer.shadowMap.enabled = quality >= 2;
  sun.castShadow = quality >= 2;
  fill.visible = quality >= 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap(quality)));
  resize();
}
renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap(quality)));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = quality >= 2;
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
sun.castShadow = quality >= 2; sun.shadow.mapSize.set(quality >= 2 ? 1024 : 256, quality >= 2 ? 1024 : 256);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 10, bottom: -8, near: 1, far: 40 }); sun.shadow.bias = -0.0008;
const fill = new THREE.PointLight(0xffa64d, 12, 16, 1.6); fill.position.set(0, 3, -1);
fill.visible = quality >= 2; scene.add(fill);

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
// Walk atlases (and the concha, which the player can throw from the first wave) gate newGame
// so kids have sheets before they spawn. Eat poses, the boss atlas, and Abuela are deferred:
// they start after that so they do not compete for bandwidth, and they do not delay play.
// (Rendering a clone whose image has not arrived yet logs "Texture marked for update but no image data found".)
const texLoads: Promise<void>[] = [];
const deferredTex: Array<() => void> = [];
function tex(src: string, gate = true): THREE.Texture {
  const t = new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = PREFER_LOW ? 1 : 4;
  const start = (done?: () => void) => {
    texLoader.load(src, (loaded) => {
      t.image = loaded.image;
      t.needsUpdate = true;
      renderer.initTexture(t); // pin the GPU texture so disposing a shareTex clone cannot evict it
      done?.();
    }, undefined, () => { report(`texture failed: ${src}`); done?.(); });
  };
  if (gate) texLoads.push(new Promise<void>((resolve) => start(resolve)));
  else deferredTex.push(() => start());
  return t;
}
// ───────────────────────── art ─────────────────────────
// Enemy art registry: animated Agent Sprite Forge atlases (public/waves/sprites/<name>-atlas.webp + .json).
// Each atlas = uniform cells. Default rows: walk 8, hit 3, ko 4. Counts can be shorter (the boy sheet is 6 / 1 / 3).
// Anchor = feet point inside every cell. To swap art, drop a new atlas in and update its numbers here (copied from its JSON meta).
interface Sheet { tex: THREE.Texture; W: number; H: number; cw: number; ch: number; ax: number; ay: number; h: number; stride: number; walkN: number; hitN: number; koN: number }
const sheet = (name: string, W: number, H: number, cw: number, ch: number, ax: number, ay: number, h: number, stride: number, walkN = 8, hitN = 3, koN = 4, v = '', gate = true): Sheet =>
  ({ tex: tex(`/waves/sprites/${name}-atlas.webp${v}`, gate), W, H, cw, ch, ax, ay, h, stride, walkN, hitN, koN });
const ANIM = { walk: { row: 0, n: 8, fps: 10 }, hit: { row: 1, n: 3, fps: 12 }, ko: { row: 2, n: 4, fps: 10 } } as const;
type AnimName = keyof typeof ANIM;
// h = world height that a 320px-tall body should be; stride = world units per walk cycle
const ART = {
  boy: sheet('calavera-boy', 3328, 1302, 416, 434, 208, 422, 1.64, 1.5, 6, 1, 3, '?v=8'),
  girl: sheet('catrina-girl', 3360, 1770, 420, 590, 210, 587, 1.38, 1.55, 8, 3, 4, '?v=7'),
  // the little calaverita skeleton from the home-screen plaza: small, fast, hops toward the line, 1 hit
  calaca: sheet('calaverita-small', 2952, 1323, 492, 441, 246, 435, 1.25, 1.6, 6, 1, 6, '?v=7'),
  // the ORIGINAL Chanclazo luchador (red/yellow mask, shirtless, LUCHA belt; source public/play/luchador_sprite.webp) = the boss
  lucha: sheet('luchador-boss', 2744, 1038, 343, 346, 170, 339, 4.1, 3.0, 8, 3, 4, '?v=1', false), // 1.5x bigger boss; deferred — first boss is wave 3
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
  pips?: THREE.Sprite[]; aura?: THREE.Sprite; hpFill?: THREE.Sprite; hpBar?: THREE.Sprite; variant: number; rage?: boolean;
  sheet: Sheet; map: THREE.Texture; edgeMat: THREE.Material; anim: AnimName; animT: number; frameKey: number;
  x: number; z: number; lane: number; speed: number; hp: number; maxHp: number; h: number; w: number; golden: boolean;
  phase: number; flashT: number; stagger: number; ko: number; koSpin: number; koVy: number; koY: number; dead: boolean; wob: number; wobA: number; eat: number; eatAnim: number;
  bite?: THREE.Sprite; eatBody?: THREE.Mesh; fallBody?: THREE.Sprite;
  soulWind: number; soulThrew: boolean; soulCharge?: THREE.Sprite; stuck: number; wasStuck: boolean;
}
interface Shot { obj: THREE.Group; p: THREE.Vector3; v: THREE.Vector3; spent: number; spin: number; yaw: number; target?: Kid; born: number; bomb?: boolean; snack?: boolean; lane?: number; fromSticky?: boolean }
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
let bombs = 0, snacks = 0, bossPending = false, boss: Kid | undefined;
const BOMB_MAX = 3, BOMB_R = 2.4, BOMB_DMG = 4;
const SNACK_MAX = 4;
const snackTex = tex('/waves/snack-concha.webp?v=3');
const CONCHA_BITS = 5;
// Eating sheets: the boy uses Gabe's eat-boy.webp (8 cells, 168×278) as-is, no squash.
// Jefe and the flower-crown girl have their own 6-frame strips derived from their walk art
// (reach, lean-in, bite, chew, chew, swallow). Head leans toward the concha; the face is never flattened.
interface EatSheet { tex: THREE.Texture; n: number; cw: number; ch: number; fps: number }
const EAT_SHEETS: Record<string, EatSheet> = {
  boy:  { tex: tex('/waves/eat-boy.webp?v=1', false),  n: 8, cw: 168, ch: 278, fps: 8.33 },
  jefe: { tex: tex('/waves/eat-jefe.webp?v=1', false), n: 6, cw: 168, ch: 278, fps: 10 },
  girl: { tex: tex('/waves/eat-girl.webp?v=1', false), n: 6, cw: 420, ch: 590, fps: 10 },
};

// ───────────────────────── soul bursts (wave 2+) & sticky chancla ─────────────────────────
// Inspired by hold-the-line pressure (enemies attacking your defence, a planted helper when
// the waves get heavy) — original Día de los Muertos art and rules, nothing copied.
const STICKY_MAX = 2, STICKY_LIFE = 8, STICKY_THROWS = 4, STICKY_STICK = 1.35, SOUL_WIND = 0.55, SOUL_SMASH_R = 0.95, SOUL_PTS = 100;
interface Soul {
  group: THREE.Group; spr: THREE.Sprite; glow: THREE.Sprite; glow2: THREE.Sprite; trail: THREE.Sprite[];
  start: THREE.Vector3; end: THREE.Vector3; p: THREE.Vector3; u: number; T: number; lane: number; dead: boolean; bob: number;
}
interface Sticky {
  group: THREE.Group; shoe: THREE.Group; halo: THREE.Sprite; resin: THREE.Mesh;
  lane: number; z: number; life: number; throws: number; fireAt: number; planted: number; alive: boolean; fading: number;
}
let souls: Soul[] = [];
let fieldStickies: Sticky[] = [];
let stickiesHeld = 0, lastSoulAt = -1e9, soulsThisWave = 0, stickyComboThisWave = false, placingSticky = false;
let aimSoul: Soul | undefined;

// Hand-drawn marigold + cyan spirit: ink outline, irregular petals, glowing cyan core.
const soulTex = canvasTex(128, 128, (g) => {
  g.clearRect(0, 0, 128, 128);
  const ink = (lw: number, col: string) => { g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; };
  const blob = (cx: number, cy: number, rx: number, ry: number, rot: number, seed: number) => {
    g.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2 + rot;
      const w = 1 + Math.sin(t * 3 + seed) * 0.18 + Math.sin(t * 5 + seed * 1.7) * 0.1;
      const x = cx + Math.cos(t) * rx * w, y = cy + Math.sin(t) * ry * w;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  // soft outer glow
  const gl = g.createRadialGradient(64, 68, 6, 64, 68, 62);
  gl.addColorStop(0, 'rgba(255,210,63,0.95)'); gl.addColorStop(0.45, 'rgba(255,140,26,0.45)'); gl.addColorStop(1, 'rgba(24,200,192,0)');
  g.fillStyle = gl; g.fillRect(0, 0, 128, 128);
  // marigold petals
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 - 0.3;
    g.save(); g.translate(64 + Math.cos(a) * 10, 66 + Math.sin(a) * 8); g.rotate(a);
    blob(0, 0, 22, 13, 0, i * 1.7);
    g.fillStyle = i % 2 ? '#ffb000' : '#ff8c1a'; g.fill();
    ink(4, '#3b1a5c'); g.stroke();
    ink(1.6, '#1a0826'); g.stroke();
    g.restore();
  }
  // cyan spirit core
  blob(64, 62, 18, 22, 0.2, 4.2);
  const core = g.createRadialGradient(60, 54, 2, 64, 64, 22);
  core.addColorStop(0, '#fffce6'); core.addColorStop(0.35, '#7ef0ee'); core.addColorStop(1, '#18c8c0');
  g.fillStyle = core; g.fill();
  ink(5, '#3b1a5c'); g.stroke();
  ink(1.8, '#0b3a3a'); g.stroke();
  // highlight scribble
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(54, 52); g.quadraticCurveTo(62, 44, 72, 54); g.stroke();
  // tiny eye dots — a friendly wisp, not a skull copy
  g.fillStyle = '#3b1a5c';
  g.beginPath(); g.arc(58, 62, 2.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(70, 61, 2.4, 0, Math.PI * 2); g.fill();
});
const resinTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,210,63,0.85)'); gr.addColorStop(0.45, 'rgba(24,200,192,0.45)'); gr.addColorStop(1, 'rgba(24,200,192,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
const lanePads: THREE.Mesh[] = [];
{
  const ring = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#3b1a5c'; g.lineWidth = 14; g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#18c8c0'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,210,63,0.45)'; g.beginPath(); g.arc(64, 64, 28, 0, Math.PI * 2); g.fill();
  });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 28),
      new THREE.MeshBasicMaterial({ map: ring, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, fog: false }),
    );
    m.rotation.x = -Math.PI / 2; m.position.set(LANES[i], 0.08, LINE_Z - 0.35); m.visible = false; m.renderOrder = 10;
    scene.add(m); lanePads.push(m);
  }
}

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
function bossHp(n: number): number { return 14 + Math.floor(n / 3) * 5; } // tougher boss: wave 3: 19, wave 6: 24, wave 9: 29 ...
const BOSS_DMG = 4; // hearts lost if the luchador reaches the marigold line (was 3)
const BOSS_RAGE = 1.4; // speed multiplier once he drops under half health
function spawnKid(kind: Kind, lane: number, speed: number, golden = false): Kid {
  const variant = 0;
  const a = kind === 'girl' ? ART.girl : kind === 'calaca' ? ART.calaca : kind === 'lucha' ? ART.lucha : ART.boy;
  const scale = kind === 'jefe' ? 1.3 : 1;
  const h = a.h * scale * (a.ch / 320), w = h * (a.cw / a.ch); // plane = one atlas cell
  const map = shareTex(a.tex); map.repeat.set(a.cw / a.W, a.ch / a.H);
  const mat = new THREE.MeshBasicMaterial({ map, alphaTest: 0.45, side: THREE.FrontSide, fog: false });
  const flashMat = new THREE.MeshBasicMaterial({ map, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, alphaTest: 0.45, side: THREE.FrontSide, fog: false });
  const root = new THREE.Group();
  const gk = `${kind}${variant}`;
  const body = new THREE.Mesh(geoFor(gk, w, h, a.ax / a.cw, a.ay / a.ch), mat); body.castShadow = quality >= 2;
  const flash = new THREE.Mesh(geoFor(gk, w, h, a.ax / a.cw, a.ay / a.ch), flashMat); flash.position.z = 0.01; body.add(flash);
  // no dark copy behind the cutout: it showed through the white faces as a black stain
  const edgeMat = new THREE.MeshBasicMaterial({ map, color: 0xffffff, alphaTest: 0.45, side: THREE.FrontSide, fog: false });
  if (kind === 'jefe') mat.color.setHex(0xd8c8ff); // big brother: a touch of purple
  root.add(body);
  const bodyW = kind === 'girl' ? w * (235 / a.cw) : kind === 'calaca' ? w * (172 / a.cw) : w;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(bodyW * 0.72, bodyW * 0.32), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.02, 0.04); root.add(shadow);
  const k: Kid = { kind, root, body, flash, shadow, mat, flashMat, x: LANES[lane], z: SPAWN_Z, lane, speed, hp: kind === 'jefe' ? 3 : kind === 'lucha' ? bossHp(wave) : 1, maxHp: kind === 'jefe' ? 3 : kind === 'lucha' ? bossHp(wave) : 1, h, w: bodyW, golden, variant, sheet: a, map, edgeMat, anim: 'walk', animT: 0, frameKey: -1,
    phase: Math.random() * 6, flashT: 0, stagger: 0, ko: -1, koSpin: 0, koVy: 0, koY: 0, dead: false, wob: 0, wobA: wave >= 2 && Math.random() < 0.45 ? 0.4 + Math.random() * 0.3 : 0, eat: 0, eatAnim: 0, soulWind: 0, soulThrew: false, stuck: 0, wasStuck: false };
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
  const x = Math.max(0, n - 4); // extra ramp from wave 4; the floor is already hot on wave 1
  return {
    count: 9 + n * 4 + x * 2, // wave 1: 13 (was 8)
    speed: Math.min(3.3, (1.55 + n * 0.18) * (1 + x * 0.045)), // wave 1: ~1.73 (was 1.22)
    gap: Math.max(0.28, (1.05 - n * 0.08) * Math.max(0.68, 1 - x * 0.04)), // wave 1: ~0.97s (was 1.62s)
    girl: Math.min(0.62, 0.28 + n * 0.05),
    jefe: Math.min(0.3, 0.1 + (n - 1) * 0.03), // big brothers from wave 1 (were wave 3+)
    calaca: Math.min(0.4, 0.22 + n * 0.03),
  };
}
function startWave(n: number): void {
  wave = n; const s = waveSpec(n); abuelaHide();
  toSpawn = waveTotal = s.count; spawned = 0; spawnT = 0.15;
  bossPending = n % 3 === 0; // the luchador boss shows up every 3rd wave
  soulsThisWave = 0; lastSoulAt = clock; stickyComboThisWave = false;
  state = 'play';
  $('wave').textContent = `Wave ${n}`;
  banner(`WAVE ${n}`, n === 1 ? 'Here they come!' : n === 2 ? 'Souls incoming · smash them with a chancla' : bossPending ? '¡Cuidado! El Luchador is coming' : `${s.count} kids · faster!`);
  sfx.sfxRapid();
  track('wave_start', { game: 'waves', wave: n });
  updateHud();
  updateStickyBtn();
}
let goldenThisWave = false;
function spawnTick(dt: number): void {
  if (toSpawn <= 0) return;
  spawnT -= dt; if (spawnT > 0) return;
  const s = waveSpec(wave);
  spawnT = s.gap * (0.7 + Math.random() * 0.6);
  const r = Math.random();
  // Hold the boss slot until the deferred luchador atlas has arrived (normal play: long before wave 3).
  if (bossPending && spawned >= Math.floor(waveTotal / 2) && !ART.lucha.tex.image) { spawnT = 0.15; return; }
  const bossNow = bossPending && spawned >= Math.floor(waveTotal / 2);
  const kind: Kind = bossNow ? 'lucha' : r < s.jefe ? 'jefe' : r < s.jefe + s.calaca ? 'calaca' : r < s.jefe + s.calaca + s.girl ? 'girl' : 'boy';
  const sp = s.speed * (kind === 'girl' ? 1.3 : kind === 'jefe' ? 0.62 : kind === 'calaca' ? 1.55 : kind === 'lucha' ? 0.5 : 1) * (0.9 + Math.random() * 0.2);
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
  if (souls.some((so) => !so.dead)) return; // wait for in-flight soul bursts
  const bonus = 250 * wave + hearts * 50;
  score += bonus; updateHud();
  state = 'between'; goldenThisWave = false;
  abuelaAt = clock + 0.7; abuelaOutAt = abuelaAt + 0.45 + ABUELA_HOLD; nextWaveAt = abuelaOutAt + 0.55; // banner first, then Abuela's line, then the next wave
  abuelaSay();
  const gotBomb = wave >= 2 && bombs < BOMB_MAX; if (gotBomb) giveBomb(1);
  const gotSnack = snacks < SNACK_MAX; if (gotSnack) giveSnack(1);
  const gotSticky = stickiesHeld < STICKY_MAX; if (gotSticky) giveSticky(1);
  const extras: string[] = [];
  if (gotBomb) extras.push('+1 bomb');
  if (gotSnack) extras.push('+1 pan dulce');
  if (gotSticky) extras.push('+1 sticky chancla');
  banner(`WAVE ${wave} CLEAR!`, `+${bonus} bonus` + (extras.length ? ' · ' + extras.join(' · ') : ''));
  sfx.sfxWin();
  track('wave_clear', { game: 'waves', wave, hearts });
}

// ───────────────────────── Abuela between waves ─────────────────────────
// The ONLY place Abuela appears in Waves (Gabe, 2026-11-10): after each cleared wave she slides in from the left with a
// one-liner, holds ~2.5 s, slides out, then the next wave starts. Shuffle-bag: no repeats until the pool is used up.
// Driven by the game clock, so pause freezes her timer (she slides out while paused). Tapping her skips straight to the next wave.
const TITLE_QUOTES = [
  'When words fail, the chanclazo speaks.',
  'One chancla. A whole parade of skulls.',
  'The ofrenda is closed. The chancla is not.',
  'Aim with love. Throw with purpose.',
  'Hold the line. The candles are watching.',
  'Abuela doesn\'t miss. Neither should you.',
  'They march. You throw. That\'s the deal.',
  'A quiet plaza is a plaza that got the chancla.',
  'Don\'t negotiate with skeletons.',
];
$('titleQuote').textContent = TITLE_QUOTES[Math.floor(Math.random() * TITLE_QUOTES.length)];
const ABUELA_HOLD = 2.5;
const ABUELA_LINES: { t: string; mad?: boolean }[] = [
  { t: '¡Mijo, I\'ve seen faster chanclas at a funeral!', mad: true },
  { t: '¡Ándale! The tamales won\'t guard themselves.' },
  { t: 'In my day we threw chanclas uphill. Both ways.' },
  { t: '¡Ay, qué bonito! Now do it again, but faster.' },
  { t: 'Did you eat? You throw like you didn\'t eat.' },
  { t: 'That\'s my grandbaby! Now sweep up those skulls.' },
  { t: 'Don\'t make me take off MY chancla, mijo.', mad: true },
  { t: '¡Mira nomás! Not one kid touched my ofrenda.' },
  { t: 'Your abuelo had better aim. And he wore bifocales.', mad: true },
  { t: 'Rest? Ten minutes. ¡No! Five. Okay, two.' },
  { t: 'Use the wrist, mijo. Like flipping tortillas.' },
  { t: '¡Cuidado! More are coming. My knees told me.' },
  { t: 'Very good. I\'m telling your tía you\'re my favorite.' },
  { t: 'If they touch my ofrenda, it\'s chancla time.', mad: true },
  { t: 'Sit up straight! Champions don\'t slouch.', mad: true },
  { t: '¡Eso! Now drink some water, you look pale.' },
];
const abuelaEl = $('abuela'), abuelaImg = $('abuelaImg') as HTMLImageElement, abuelaLine = $('abuelaLine');
const ABUELA_IMG = { calm: '/crash/abuela-chibi.webp', mad: '/crash/abuela-chibi-angry.webp' };
let abuelaBag: number[] = [], abuelaAt = Infinity, abuelaOutAt = 0, abuelaLast = -1;
function abuelaSay(): void {
  if (!abuelaBag.length) {
    abuelaBag = ABUELA_LINES.map((_, i) => i);
    for (let i = abuelaBag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [abuelaBag[i], abuelaBag[j]] = [abuelaBag[j], abuelaBag[i]]; }
    if (abuelaBag[abuelaBag.length - 1] === abuelaLast && abuelaBag.length > 1) abuelaBag.unshift(abuelaBag.pop() as number); // no back-to-back repeat across refills
  }
  const i = abuelaBag.pop() as number; abuelaLast = i;
  const L = ABUELA_LINES[i];
  $('hint').classList.add('gone'); // her bubble replaces the how-to hint
  abuelaLine.textContent = L.t; abuelaImg.src = L.mad ? ABUELA_IMG.mad : ABUELA_IMG.calm;
  track('abuela_line', { game: 'waves', wave, line: i });
}
function abuelaHide(): void { abuelaAt = Infinity; abuelaOutAt = 0; abuelaEl.classList.remove('in'); }
function tickAbuela(): void {
  const between = state === 'between'; // she steps out while paused (popups have no backdrop now) and comes back on resume
  abuelaEl.classList.toggle('in', between && clock >= abuelaAt && clock < abuelaOutAt);
}
abuelaEl.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (state !== 'between' || !abuelaEl.classList.contains('in')) return;
  abuelaOutAt = clock; nextWaveAt = Math.min(nextWaveAt, clock + 0.5); sfx.sfxClick();
});

// ───────────────────────── throwing ─────────────────────────
const shotProto = makeChancla(); shotProto.children.forEach((c, i) => { (c as THREE.Mesh).material = i === 0 ? relicSole : relicStrap; (c as THREE.Mesh).castShadow = quality >= 2; });
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
  aimSoul = undefined;
  {
    let bestD = aimKid ? 0.13 : 0.16;
    if (aimKid) {
      const sc = kidCenter(aimKid, tmpV).project(camera);
      bestD = Math.hypot((sc.x - ndc.x) * camera.aspect, sc.y - ndc.y);
    }
    for (const so of souls) {
      if (so.dead) continue;
      const sc = so.p.clone().project(camera);
      const d = Math.hypot((sc.x - ndc.x) * camera.aspect, sc.y - ndc.y);
      if (d < bestD + 0.02) { bestD = d; aimKid = undefined; aimSoul = so; }
    }
  }
  if (aimSoul) {
    const lead = Math.min(0.32, (1 - aimSoul.u) * aimSoul.T * 0.45);
    aimPt.copy(aimSoul.p).lerp(aimSoul.end, Math.min(1, lead / Math.max(0.05, (1 - aimSoul.u) * aimSoul.T)));
  } else if (aimKid) leadPoint(aimKid, aimPt);
  else if (!ray.ray.intersectPlane(aimPlane, aimPt)) aimPt.set(0, 0.75, -6);
  aimPt.z = Math.min(aimPt.z, LINE_Z + 0.5);
}
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'play' && state !== 'between') return;
  sfx.unlockCrashAudio();
  if (placingSticky) {
    e.preventDefault();
    placeSticky(laneFromEvent(e));
    return;
  }
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
  if (e.code === 'KeyF') useSnack();
  if (e.code === 'KeyS') { e.preventDefault(); beginPlaceSticky(); }
  if (e.code === 'Escape' && placingSticky) { e.preventDefault(); cancelPlaceSticky(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});

// ───────────────────────── girl knock-out: billboard, not a tipped card ─────────────────────────
// The atlas KO cells were made by tipping her walk frame inside a 420×590 box. The rotated
// character runs off the right edge, so a hard flat crop shows as she falls. During her KO we
// hide that card, put a complete face-on frame (her hit art) on a camera-facing sprite, and
// tumble in screen space with a 2D rotation. Other characters keep the atlas KO row.
function ensureGirlFall(k: Kid): void {
  if (k.fallBody || k.kind !== 'girl') return;
  const sh = k.sheet;
  const map = shareTex(sh.tex);
  map.repeat.set(sh.cw / sh.W, sh.ch / sh.H);
  map.offset.set(0, 1 - (ANIM.hit.row + 1) * sh.ch / sh.H); // hit frame 0: full character, reacting
  const mat = new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.05, depthWrite: false, depthTest: false, fog: false });
  const h = k.h, w = h * (sh.cw / sh.ch);
  const sp = new THREE.Sprite(mat);
  // feet on the cobbles, same anchor as the walk card, so she tips over rather than spinning mid-air
  sp.center.set(sh.ax / sh.cw, 1 - sh.ay / sh.ch);
  sp.scale.set(w, h, 1);
  sp.position.set(0, 0, 0.08);
  sp.renderOrder = 5;
  sp.visible = false;
  k.root.add(sp);
  k.fallBody = sp;
}
function paintGirlFall(k: Kid): void {
  ensureGirlFall(k);
  if (!k.fallBody) return;
  k.fallBody.visible = true;
  k.body.visible = false;
  k.body.rotation.set(0, 0, 0);
  k.body.scale.set(1, 1, 1);
  // Hold hit frame 0: a complete, uncropped reacting pose. (Cycling through hit 1, a lean
  // the other way, fought the tumble.) The fall is the 2D rotation, not a new costume.
  const sh = k.sheet;
  const map = (k.fallBody.material as THREE.SpriteMaterial).map!;
  map.offset.set(0, 1 - ((ANIM.hit.row + 1) * sh.ch) / sh.H);
  const t = Math.min(1, k.ko / 0.65);
  const ease = t * t * (3 - 2 * t); // smoothstep
  const dir = k.koSpin || -1;
  (k.fallBody.material as THREE.SpriteMaterial).rotation = dir * ease * 1.45; // ~83° by 0.65s, always face-on
  k.fallBody.position.x = dir * ease * -0.22;
}

function hitKid(k: Kid, s?: Shot, dmg = 1): void {
  k.hp = Math.max(0, k.hp - dmg); k.flashT = 1; shake = Math.min(0.5, shake + 0.18);
  const pan = THREE.MathUtils.clamp(k.root.position.x / 3, -1, 1);
  sfx.sfxThwack(0.9); sfx.buzz(20);
  const at = kidCenter(k, new THREE.Vector3());
  if (s) { // chancla bounces off and spins away
    s.spent = 0; s.v.set(-s.v.x * 0.25 + (Math.random() - 0.5) * 2, 5.5, Math.abs(s.v.z) * 0.18 + 1.5);
    fx.ring(at, 0.9); fx.sparks(at, PREFER_LOW ? 8 : 14); sfx.sfxImpact(0.7);
  }
  if (k.pips) k.pips.forEach((p, i) => { p.visible = i < k.hp; });
  if (k.hpFill) k.hpFill.scale.x = 1.56 * (k.hp / k.maxHp);
  if (k.hp > 0) {
    const big = k.kind === 'lucha'; playAnim(k, 'hit'); k.stagger = big ? 0.1 : 0.45; k.z -= big ? 0.1 : 0.55;
    if (big && !k.rage && k.hp <= k.maxHp / 2) { k.rage = true; k.speed *= BOSS_RAGE; shake = 0.6; popText(k, '¡FURIA!', 'bad'); banner('¡EL LUCHADOR IS MAD!', 'He\'s charging · drop a BOMB 💣'); } sfx.sfxWood(0.7, pan);
    popText(k, big ? (dmg > 1 ? `BOOM −${dmg}` : `${k.hp}/${k.maxHp}`) : 'OUCH!', 'bad'); return;
  }
  // knocked out
  k.ko = 0; k.koSpin = k.kind === 'girl' ? -1 : 0; k.koVy = 2.6; k.koY = 0; playAnim(k, 'ko');
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
  if (combo >= 4 && !stickyComboThisWave && stickiesHeld < STICKY_MAX) {
    stickyComboThisWave = true;
    giveSticky(1);
    popText(k, '+STICKY', 'big');
  }
  if (k.golden) startRapid();
  poof(at, k.kind === 'lucha' ? 70 : k.kind === 'jefe' ? 46 : 30);
  fx.sparks(at, PREFER_LOW ? 8 : 14, 0xffd36b, 4); fx.sparks(at, PREFER_LOW ? 5 : 8, 0xff8c1a, 3); sfx.sfxShimmer(k.kind === 'lucha' ? 1 : 0.6);
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
const snackBtn = $('snack') as HTMLButtonElement;
const stickyBtn = $('sticky') as HTMLButtonElement;
stickyBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlockCrashAudio(); if (stickiesHeld > 0) stickyBtn.classList.add('press'); beginPlaceSticky(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) stickyBtn.addEventListener(ev, () => stickyBtn.classList.remove('press'));
function giveSnack(n: number): void { snacks = Math.min(SNACK_MAX, snacks + n); updateSnackBtn(); }
function updateSnackBtn(): void {
  const on = snacks > 0;
  snackBtn.classList.toggle('ghost', !on);
  snackBtn.classList.toggle('ready', on);
  snackBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
  $('snackN').textContent = String(snacks);
}
function ensureEater(k: Kid): void {
  if (k.eatBody) return;
  const sheet = EAT_SHEETS[k.kind];
  if (!sheet || !sheet.tex.image) return;
  const map = shareTex(sheet.tex);
  map.repeat.set(1 / sheet.n, 1);
  map.offset.set(0, 0);
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.12, depthWrite: false, side: THREE.FrontSide, fog: false });
  // World height matches the walk body; width follows the sheet's true aspect so the face is not stretched.
  const h = k.h, w = h * (sheet.cw / sheet.ch);
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h * 0.5, 0); // feet on the cobbles
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.z = 0.06;
  mesh.visible = false;
  mesh.renderOrder = 2;
  k.root.add(mesh);
  k.eatBody = mesh;
}
function showEater(k: Kid, on: boolean): void {
  if (on) ensureEater(k);
  if (!k.eatBody) return;
  k.eatBody.visible = on;
  if (!on) return;
  const sheet = EAT_SHEETS[k.kind];
  const frame = Math.floor(k.eatAnim * sheet.fps) % sheet.n;
  const map = (k.eatBody.material as THREE.MeshBasicMaterial).map!;
  map.offset.x = frame / sheet.n;
  // The same mild card tilt as walking. A bigger rotation.x foreshortens the head into a flat angle — that was the bug.
  k.eatBody.rotation.set(0.2, -k.x * 0.04, 0);
}
function ensureBite(k: Kid): void {
  if (k.bite) return;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: snackTex, transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 6;
  k.root.add(sp);
  k.bite = sp;
}
interface Concha { lane: number; z: number; bites: number; max: number; biteT: number; loaf: THREE.Sprite; shown: number }
interface Crumb { sprite: THREE.Sprite; v: THREE.Vector3; life: number; maxLife: number; spin: number; gen: number; scale: number }
const conchas: Concha[] = [];
const crumbs: Crumb[] = [];
// Pooled pastry bits, textured from snack-concha.webp. First-gen flakes split into smaller crumbs on landing, then fade — nothing piles on the floor.
const CRUMB_COLS = 8, CRUMB_ROWS = 4, CRUMB_CELLS = 32, CRUMB_CELL = 64, CRUMB_GROUND = 0.08, CRUMB_CAP = PREFER_LOW ? 48 : 96;
const crumbPool: THREE.Sprite[] = [];
let crumbAtlas: THREE.CanvasTexture | undefined;
function ensureCrumbAtlas(): THREE.CanvasTexture {
  if (crumbAtlas) return crumbAtlas;
  const img = snackTex.image as CanvasImageSource | undefined;
  const sw = img && 'width' in img ? Number((img as { width: number }).width) : 0;
  const sh = img && 'height' in img ? Number((img as { height: number }).height) : 0;
  const src = document.createElement('canvas'); src.width = Math.max(1, sw); src.height = Math.max(1, sh);
  const sg = src.getContext('2d', { willReadFrequently: true })!;
  if (img && sw && sh) sg.drawImage(img, 0, 0);
  const data = sw && sh ? sg.getImageData(0, 0, sw, sh).data : null;
  const pink: number[] = [], bread: number[] = [];
  if (data) {
    for (let y = 10; y < sh - 10; y += 3) {
      for (let x = 10; x < sw - 10; x += 3) {
        const i = (y * sw + x) * 4; if (data[i + 3] < 200) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        ((r - b) > 60 && g > 110 && b < 130 ? bread : pink).push(x, y);
      }
    }
  }
  const cv = document.createElement('canvas'); cv.width = CRUMB_COLS * CRUMB_CELL; cv.height = CRUMB_ROWS * CRUMB_CELL;
  const g = cv.getContext('2d')!;
  const pick = (pts: number[], i: number): [number, number] => {
    if (pts.length < 2) return [sw * 0.5, sh * 0.4];
    const k = ((i * 53 + 17) % (pts.length / 2)) * 2;
    return [pts[k], pts[k + 1]];
  };
  for (let i = 0; i < CRUMB_CELLS; i++) {
    const ox = (i % CRUMB_COLS) * CRUMB_CELL, oy = Math.floor(i / CRUMB_COLS) * CRUMB_CELL;
    g.save();
    g.translate(ox + CRUMB_CELL * 0.5, oy + CRUMB_CELL * 0.5);
    g.rotate((i * 0.87) % Math.PI);
    g.beginPath();
    const sides = 5 + (i % 4);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + Math.sin(i * 1.3 + k * 2.1) * 0.28;
      const r = CRUMB_CELL * (0.26 + ((i * 17 + k * 11) % 17) / 17 * 0.2);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.clip();
    const wantBread = i % 3 === 0;
    const [sx, sy] = pick(wantBread && bread.length ? bread : pink, i);
    const ss = 54 + (i % 5) * 16;
    if (img && sw && sh) g.drawImage(img, Math.max(0, sx - ss * 0.5), Math.max(0, sy - ss * 0.5), ss, ss, -CRUMB_CELL * 0.5, -CRUMB_CELL * 0.5, CRUMB_CELL, CRUMB_CELL);
    else { g.fillStyle = wantBread ? '#e0a056' : '#f08090'; g.fillRect(-CRUMB_CELL, -CRUMB_CELL, CRUMB_CELL * 2, CRUMB_CELL * 2); }
    const shade = g.createRadialGradient(0, 0, CRUMB_CELL * 0.08, 0, 0, CRUMB_CELL * 0.48);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(70,28,16,0.3)');
    g.fillStyle = shade; g.fillRect(-CRUMB_CELL * 0.5, -CRUMB_CELL * 0.5, CRUMB_CELL, CRUMB_CELL);
    g.restore();
  }
  crumbAtlas = new THREE.CanvasTexture(cv);
  crumbAtlas.colorSpace = THREE.SRGBColorSpace;
  crumbAtlas.anisotropy = PREFER_LOW ? 1 : 4;
  renderer.initTexture(crumbAtlas);
  return crumbAtlas;
}
function takeCrumb(): THREE.Sprite | undefined {
  if (crumbs.length >= CRUMB_CAP) return undefined;
  const sp = crumbPool.pop() ?? (() => {
    const map = shareTex(ensureCrumbAtlas());
    const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat); s.renderOrder = 4; return s;
  })();
  const map = (sp.material as THREE.SpriteMaterial).map!;
  const i = Math.floor(Math.random() * CRUMB_CELLS);
  map.repeat.set(1 / CRUMB_COLS, 1 / CRUMB_ROWS);
  map.offset.set((i % CRUMB_COLS) / CRUMB_COLS, Math.floor(i / CRUMB_COLS) / CRUMB_ROWS);
  (sp.material as THREE.SpriteMaterial).opacity = 1;
  (sp.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI * 2;
  scene.add(sp);
  return sp;
}
function giveCrumb(sp: THREE.Sprite): void {
  scene.remove(sp);
  if (crumbPool.length < CRUMB_CAP) crumbPool.push(sp);
  else {
    const m = sp.material as THREE.SpriteMaterial;
    m.dispose(); // map is shareTex of the crumb atlas — leave the GPU texture alone
  }
}
function spit(x: number, y: number, z: number, scale: number, gen: number, vx: number, vy: number, vz: number, life: number): void {
  const sp = takeCrumb(); if (!sp) return;
  sp.position.set(x, y, z);
  sp.scale.set(scale, scale * (0.78 + Math.random() * 0.24), 1);
  crumbs.push({ sprite: sp, v: new THREE.Vector3(vx, vy, vz), life, maxLife: life, spin: (Math.random() - 0.5) * (gen === 0 ? 14 : 18), gen, scale });
}
function burstCrumbs(c: Concha, last: boolean): void {
  const x = LANES[c.lane], y = 0.5 + c.shown * 0.1, z = c.z;
  const n = last ? (PREFER_LOW ? 10 : 20) : (PREFER_LOW ? 8 : 14);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const kick = 1.15 + Math.random() * 1.7;
    const sc = 0.22 + Math.random() * 0.22 + (i < 3 ? 0.1 : 0);
    // spray up and toward the camera (+z) so bits aren't hidden inside the eater
    spit(
      x + Math.cos(ang) * 0.22, y + Math.random() * 0.14, z + 0.12 + Math.sin(ang) * 0.12,
      sc, 0,
      Math.cos(ang) * kick, 2.15 + Math.random() * 2.15, Math.sin(ang) * kick * 0.7 + 0.7,
      0.62 + Math.random() * 0.2,
    );
  }
  const dust = last ? 8 : 5;
  for (let i = 0; i < dust; i++) {
    const ang = Math.random() * Math.PI * 2;
    const kick = 0.7 + Math.random() * 1.2;
    spit(x, y, z + 0.08, 0.07 + Math.random() * 0.06, 1, Math.cos(ang) * kick, 1.2 + Math.random() * 1.5, Math.sin(ang) * kick * 0.7 + 0.4, 0.3 + Math.random() * 0.16);
  }
}
function splitCrumb(m: Crumb): void {
  const p = m.sprite.position;
  const n = 2 + (Math.random() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const kick = 0.55 + Math.random() * 0.95;
    spit(p.x, p.y + 0.04, p.z, m.scale * (0.4 + Math.random() * 0.22), 1, Math.cos(ang) * kick, 1.0 + Math.random() * 1.2, Math.sin(ang) * kick * 0.75 + 0.25, 0.32 + Math.random() * 0.18);
  }
}
function tickCrumbs(dt: number): void {
  for (let i = crumbs.length - 1; i >= 0; i--) {
    const m = crumbs[i];
    m.life -= dt;
    m.v.y -= 12 * dt;
    m.v.x *= 1 - 0.7 * dt;
    m.v.z *= 1 - 0.7 * dt;
    m.sprite.position.addScaledVector(m.v, dt);
    const mat = m.sprite.material as THREE.SpriteMaterial;
    mat.rotation += m.spin * dt;
    if (m.sprite.position.y < CRUMB_GROUND && m.v.y < 0) {
      m.sprite.position.y = CRUMB_GROUND;
      if (m.gen === 0 && crumbs.length < CRUMB_CAP - 3) {
        splitCrumb(m);
        giveCrumb(m.sprite);
        crumbs.splice(i, 1);
        continue;
      }
      m.v.y = 0; m.v.x *= 0.35; m.v.z *= 0.35;
      m.life = Math.min(m.life, 0.16);
    }
    const fade = Math.max(0, m.life / m.maxLife);
    mat.opacity = fade;
    const s = m.scale * (0.68 + 0.32 * fade);
    m.sprite.scale.set(s, s * 0.85, 1);
    if (m.life <= 0) { giveCrumb(m.sprite); crumbs.splice(i, 1); }
  }
}
function frontOf(lane: number): number {
  let z = SPAWN_Z + 1.4, any = false;
  for (const k of kids) if (alive(k) && k.ko < 0 && k.lane === lane) { any = true; z = Math.max(z, k.z); }
  return any ? z : SPAWN_Z + 2.2;
}
// snack-concha.webp is 959×876 and already the whole round bun (pink shell + golden curved base).
// THREE.Sprite is centered on its position, so the loaf must sit at half its height plus a small lift
// or the bottom curve goes under the cobbles and the floor's depth buffer cuts it into a flat edge.
const CONCHA_ASPECT = 959 / 876;
const CONCHA_LIFT = 0.1;
function makeLoaf(): THREE.Sprite {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: snackTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  sp.renderOrder = 3;
  scene.add(sp);
  return sp;
}
function freeLoaf(sp: THREE.Sprite): void {
  scene.remove(sp);
  (sp.material as THREE.SpriteMaterial).dispose();
}
function loafGoal(bites: number): number {
  if (bites <= 0) return 0;
  return 0.38 + (bites / CONCHA_BITS) * 0.78; // height 1.16 when whole, ~0.54 on the last bite
}
function paintConcha(c: Concha, instant = false): void {
  if (instant) c.shown = loafGoal(c.bites);
  const h = c.shown, w = h * CONCHA_ASPECT;
  c.loaf.scale.set(w, h, 1); // uniform shrink — same aspect as the graphic, both axes follow `shown`
  c.loaf.position.set(LANES[c.lane], CONCHA_LIFT + h * 0.5, c.z);
  c.loaf.visible = c.bites > 0 && h > 0.05;
}
/** Drop a concha on the cobbles, in front of whoever is leading that row. A second throw adds bites. */
function placeConcha(lane: number): void {
  const z = Math.min(LINE_Z - 0.7, frontOf(lane) + 0.9);
  const have = conchas.find((c) => c.lane === lane);
  if (have) {
    have.bites = Math.min(CONCHA_BITS, have.bites + 3);
    have.max = Math.max(have.max, have.bites);
    if (z > have.z) have.z = z;
    have.loaf.visible = true;
    paintConcha(have);
    return;
  }
  const loaf = makeLoaf();
  const c: Concha = { lane, z, bites: CONCHA_BITS, max: CONCHA_BITS, biteT: 0, loaf, shown: loafGoal(CONCHA_BITS) };
  conchas.push(c);
  paintConcha(c, true);
}
/** How far this kid may walk. Nobody in the row gets past the concha, and they stack up behind whoever is eating. */
function holdZ(k: Kid): number | undefined {
  const plate = conchas.find((c) => c.lane === k.lane && c.bites > 0);
  if (!plate || k.z > plate.z - 0.02) return undefined;
  let ahead = 0;
  for (const o of kids) {
    if (o === k || o.dead || o.ko >= 0 || o.lane !== k.lane) continue;
    if (o.z > k.z + 0.08 && o.z < plate.z + 0.02) ahead++;
  }
  return plate.z - 0.46 - ahead * 0.72;
}
function tickConchas(dt: number): void {
  for (let i = conchas.length - 1; i >= 0; i--) {
    const c = conchas[i];
    let eater: Kid | undefined;
    for (const k of kids) {
      if (k.dead || k.ko >= 0 || k.lane !== c.lane) continue;
      if (k.z < c.z - 0.9 || k.z > c.z + 0.08) continue;
      if (!eater || k.z > eater.z) eater = k;
    }
    if (eater) {
      eater.eat = Math.max(eater.eat, 0.5);
      ensureBite(eater);
      c.biteT += dt;
      if (c.biteT >= 0.38) {
        c.biteT = 0;
        c.bites -= 1;
        c.shown *= 0.78; // squash, then lerp to the smaller loaf
        burstCrumbs(c, c.bites <= 0);
        if (c.bites <= 0) c.loaf.visible = false;
        eater.eat = 1.2;
        sfx.sfxSquish(0.45);
      }
    }
    if (c.bites > 0) {
      const goal = loafGoal(c.bites);
      c.shown += (goal - c.shown) * Math.min(1, dt * 12);
      paintConcha(c);
    } else {
      freeLoaf(c.loaf);
      conchas.splice(i, 1);
    }
  }
  tickCrumbs(dt);
}
function useSnack(): void {
  if ((state !== 'play' && state !== 'between') || snacks <= 0) return;
  const k = threat(); if (!k) return;
  snacks--;
  const to = new THREE.Vector3(LANES[k.lane], 0.35, Math.min(LINE_Z - 0.7, frontOf(k.lane) + 0.9));
  const T = flightTime(to);
  const v = velFor(to, T, new THREE.Vector3());
  const obj = new THREE.Group();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: snackTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  const thrownH = 1.12;
  sp.scale.set(thrownH * CONCHA_ASPECT, thrownH, 1);
  sp.renderOrder = 5;
  obj.add(sp); scene.add(obj); obj.position.copy(LAUNCH);
  shots.push({ obj, p: LAUNCH.clone(), v, spent: -1, spin: 0, yaw: Math.atan2(v.x, v.z), target: k, born: clock, snack: true, lane: k.lane });
  updateSnackBtn(); sfx.sfxWhoosh();
}
snackBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlockCrashAudio(); if (snacks > 0) snackBtn.classList.add('press'); useSnack(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) snackBtn.addEventListener(ev, () => snackBtn.classList.remove('press'));
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
  for (const so of souls) {
    if (so.dead) continue;
    if (Math.hypot(so.p.x - c.x, so.p.z - c.z) < BOMB_R + 0.4) smashSoul(so, undefined);
  }
  fx.ring(c, 4.6, 0xffd36b); fx.ring(c.clone().setY(1.1), 3.0, 0xff7a2a);
  fx.sparks(c, 90, 0xffd36b, 9, 6); fx.sparks(c, 50, 0xff7a1a, 7, 5); fx.sparks(c, 20, 0xffffff, 5, 4);
  poof(c.clone().setY(1.2), 60);
  const f = $('boomflash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  shake = 1.2; hitStop.stop(120); sfx.sfxBoom(); sfx.buzz([60, 40, 90]);
}
bombBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlockCrashAudio(); bombBtn.classList.add('press'); useBomb(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) bombBtn.addEventListener(ev, () => bombBtn.classList.remove('press'));

function soulTravel(): number { return Math.max(0.9, 1.25 - Math.max(0, wave - 2) * 0.06); }
function soulCooldown(): number { return Math.max(2.6, 5.5 - Math.max(0, wave - 2) * 0.55); }
function soulCap(): number { return Math.min(5, 2 + Math.max(0, Math.floor((wave - 2) / 2))); }
function soulsBusy(): number {
  return souls.filter((so) => !so.dead).length + kids.filter((k) => alive(k) && k.soulWind > 0).length;
}
function freeSoul(so: Soul): void {
  scene.remove(so.group);
  for (const t of so.trail) { scene.remove(t); t.material.dispose(); }
  so.spr.material.dispose(); so.glow.material.dispose(); so.glow2.material.dispose();
}
function launchSoul(k: Kid, forcedT?: number): Soul {
  const start = kidCenter(k, new THREE.Vector3());
  const lane = k.lane;
  const end = new THREE.Vector3(LANES[lane], 0.78, LINE_Z + 0.08);
  const T = forcedT ?? soulTravel();
  const group = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffb000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 1 }));
  glow.scale.setScalar(2.4); glow.renderOrder = 8;
  const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x3de8e8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0.85 }));
  glow2.scale.setScalar(1.55); glow2.renderOrder = 8;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: soulTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  spr.scale.setScalar(1.85); spr.renderOrder = 9;
  group.add(glow, glow2, spr); group.position.copy(start); scene.add(group);
  const trail: THREE.Sprite[] = [];
  for (let i = 0; i < 12; i++) {
    const useWisp = i % 3 === 0;
    const col = i % 2 ? 0x3de8e8 : 0xffb000;
    const t = new THREE.Sprite(new THREE.SpriteMaterial({
      map: useWisp ? soulTex : glowTex(), color: useWisp ? 0xffffff : col,
      transparent: true, blending: useWisp ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, fog: false, opacity: 0,
    }));
    t.scale.setScalar(useWisp ? 0.85 : 0.7 - i * 0.03); t.renderOrder = 7; scene.add(t); trail.push(t);
  }
  const so: Soul = { group, spr, glow, glow2, trail, start: start.clone(), end, p: start.clone(), u: 0, T, lane, dead: false, bob: Math.random() * 6 };
  souls.push(so);
  soulsThisWave++;
  lastSoulAt = clock;
  k.soulThrew = true;
  if (k.soulCharge) k.soulCharge.visible = false;
  sfx.sfxSoulCast();
  fx.ring(start, 0.7, 0x3de8e8);
  return so;
}
/** Test/demo helper: place a mid-field kid at fromZ and launch a soul from their chest. */
function spawnSoul(lane = 1, fromZ = -3.2, travel?: number): Soul | undefined {
  const k = spawnKid('jefe', lane, 0.35);
  k.z = fromZ; k.x = LANES[lane]; k.root.position.set(k.x, 0, k.z);
  k.soulThrew = false;
  return launchSoul(k, travel);
}
function windSoul(lane = 1, fromZ = -3.2): Kid {
  const k = spawnKid('jefe', lane, 0.25);
  k.z = fromZ; k.x = LANES[lane]; k.root.position.set(k.x, 0, k.z);
  k.soulWind = SOUL_WIND;
  lastSoulAt = clock;
  return k;
}
function smashSoul(so: Soul, sh?: Shot): void {
  if (so.dead) return;
  so.dead = true;
  const at = so.p.clone();
  if (sh) { sh.spent = 0; sh.v.set(-sh.v.x * 0.2 + (Math.random() - 0.5) * 2, 6, Math.abs(sh.v.z) * 0.2 + 1.6); }
  score += SOUL_PTS; updateHud(true);
  combo = clock - comboT < 1.3 ? combo + 1 : 1; comboT = clock;
  popAt(at.clone().setY(at.y + 0.4), 'SOUL SMASH!', 'big');
  popAt(at.clone().setY(at.y + 0.15), `+${SOUL_PTS}`, '');
  if (combo >= 2) showCombo(combo);
  fx.ring(at, 1.15, 0xffd23f); fx.ring(at.clone().setY(at.y + 0.2), 0.7, 0x3de8e8);
  fx.sparks(at, 16, 0xffd36b, 4); fx.sparks(at, 12, 0x3de8e8, 3);
  poof(at, 18);
  sfx.sfxSoulSmash(); sfx.sfxShimmer(0.7); sfx.buzz(16);
  freeSoul(so);
}
function soulLand(so: Soul): void {
  if (so.dead) return;
  so.dead = true;
  const at = so.p.clone().setY(0.5);
  loseHeart(1, at, 'SOUL HIT!');
  sfx.sfxSoulLand();
  fx.ring(at, 1.6, 0x3de8e8); fx.ring(new THREE.Vector3(LANES[so.lane], 0.08, LINE_Z), 1.8, 0xff8c1a);
  fx.sparks(at, 20, 0x3de8e8, 4); poof(at, 14);
  // brief marigold flare on the lane
  const flare = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20),
    new THREE.MeshBasicMaterial({ color: 0x3de8e8, transparent: true, opacity: 0.7, depthWrite: false, fog: false }),
  );
  flare.rotation.x = -Math.PI / 2; flare.position.set(LANES[so.lane], 0.06, LINE_Z); flare.renderOrder = 3; scene.add(flare);
  const born = clock;
  const tickFlare = (): void => {
    const u = (clock - born) / 0.7;
    if (u >= 1 || !flare.parent) { scene.remove(flare); flare.geometry.dispose(); (flare.material as THREE.Material).dispose(); return; }
    (flare.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u);
    flare.scale.setScalar(1 + u * 0.8);
  };
  (flare as THREE.Mesh & { userData: { tickFlare?: () => void } }).userData.tickFlare = tickFlare;
  laneFlares.push(flare);
  freeSoul(so);
}
const laneFlares: THREE.Mesh[] = [];
function tickFlares(): void {
  for (let i = laneFlares.length - 1; i >= 0; i--) {
    const fn = laneFlares[i].userData.tickFlare as (() => void) | undefined;
    fn?.();
    if (!laneFlares[i].parent) laneFlares.splice(i, 1);
  }
}
function maybeStartSoul(): void {
  if (state !== 'play' || wave < 2) return;
  if (soulsThisWave >= soulCap()) return;
  if (soulsBusy() >= 2) return;
  if (clock - lastSoulAt < soulCooldown()) return;
  const mid: Kid[] = [];
  const wts: number[] = [];
  for (const k of kids) {
    if (!alive(k) || k.soulThrew || k.soulWind > 0 || k.eat > 0) continue;
    if (k.z < SPAWN_Z + 2.0 || k.z > LINE_Z - 1.85) continue;
    mid.push(k);
    wts.push(k.kind === 'lucha' ? 3.2 : k.kind === 'jefe' ? 2.2 : k.kind === 'girl' ? 1.1 : 1);
  }
  if (!mid.length) return;
  let r = Math.random() * wts.reduce((a, b) => a + b, 0), pick = mid[0];
  for (let i = 0; i < mid.length; i++) { r -= wts[i]; if (r <= 0) { pick = mid[i]; break; } }
  pick.soulWind = SOUL_WIND;
  lastSoulAt = clock; // reserve the slot so we don't wind two at once
  sfx.sfxShimmer(0.35);
}
function ensureCharge(k: Kid): void {
  if (k.soulCharge) return;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soulTex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0.95 }));
  sp.position.set(0, k.h * 0.78, 0.35); sp.renderOrder = 8; k.root.add(sp); k.soulCharge = sp;
}
function tickSouls(dt: number): void {
  for (const k of kids) {
    if (!alive(k)) {
      if (k.soulCharge) k.soulCharge.visible = false;
      continue;
    }
    if (k.soulWind > 0) {
      ensureCharge(k);
      k.soulWind -= dt;
      const u = 1 - Math.max(0, k.soulWind) / SOUL_WIND;
      if (k.soulCharge) {
        k.soulCharge.visible = true;
        const pulse = 0.9 + u * 1.15 + Math.sin(clock * 14) * 0.12;
        k.soulCharge.scale.setScalar(pulse);
        (k.soulCharge.material as THREE.SpriteMaterial).rotation = clock * 3;
        (k.soulCharge.material as THREE.SpriteMaterial).opacity = 0.7 + u * 0.3;
      }
      if (k.soulWind <= 0) launchSoul(k);
    } else if (k.soulCharge) k.soulCharge.visible = false;
  }
  for (const so of souls) {
    if (so.dead) continue;
    so.u += dt / so.T;
    const t = Math.min(1, so.u);
    const ease = t * t * (3 - 2 * t);
    so.p.lerpVectors(so.start, so.end, ease);
    so.p.y += Math.sin(t * Math.PI) * 0.58;
    so.p.x += Math.sin(clock * 5.5 + so.bob) * 0.07 * (1 - t);
    so.group.position.copy(so.p);
    const wob = 0.94 + Math.sin(clock * 8 + so.bob) * 0.08;
    so.spr.scale.setScalar(1.85 * wob);
    so.glow.scale.setScalar(2.35 + Math.sin(clock * 7) * 0.25);
    so.glow2.scale.setScalar(1.5 + Math.sin(clock * 9 + 1) * 0.18);
    so.glow.material.opacity = 0.85 + Math.sin(clock * 6) * 0.15;
    so.glow2.material.opacity = 0.7 + Math.sin(clock * 8) * 0.15;
    (so.spr.material as THREE.SpriteMaterial).rotation = Math.sin(clock * 4 + so.bob) * 0.35;
    for (let i = 0; i < so.trail.length; i++) {
      const tu = Math.max(0, t - (i + 1) * 0.038);
      const te = tu * tu * (3 - 2 * tu);
      const tp = new THREE.Vector3().lerpVectors(so.start, so.end, te);
      tp.y += Math.sin(tu * Math.PI) * 0.58;
      tp.x += Math.sin(clock * 5.5 + so.bob + i * 0.4) * 0.04;
      so.trail[i].position.copy(tp);
      const fade = Math.max(0, 0.85 - i * 0.06) * (t > 0.04 ? 1 : t / 0.04);
      so.trail[i].material.opacity = fade;
      const useWisp = i % 3 === 0;
      so.trail[i].scale.setScalar((useWisp ? 0.95 : 0.75 - i * 0.03) * (0.85 + Math.sin(clock * 10 + i) * 0.2));
    }
    if (Math.random() < 0.55) fx.trail(so.p);
    if (t >= 1) soulLand(so);
  }
  souls = souls.filter((so) => !so.dead);
  tickFlares();
}

function fieldStickyCount(): number { return fieldStickies.filter((st) => st.alive).length; }
function updateStickyBtn(): void {
  const on = stickiesHeld > 0 && (state === 'play' || state === 'between' || state === 'title' || state === 'paused' || state === 'over');
  const canPlant = stickiesHeld > 0 && fieldStickyCount() < 1 && (state === 'play' || state === 'between');
  stickyBtn.classList.toggle('ghost', !on);
  stickyBtn.classList.toggle('ready', canPlant && !placingSticky);
  stickyBtn.classList.toggle('placing', placingSticky);
  stickyBtn.setAttribute('aria-disabled', canPlant ? 'false' : 'true');
  $('stickyN').textContent = String(stickiesHeld);
  $('stickyHint').classList.toggle('on', placingSticky);
  lanePads.forEach((p) => { p.visible = placingSticky; });
}
function giveSticky(n: number): void {
  const was = stickiesHeld;
  stickiesHeld = Math.min(STICKY_MAX, stickiesHeld + n);
  if (stickiesHeld > was) sfx.sfxBombReady();
  updateStickyBtn();
}
function laneFromEvent(e: PointerEvent): number {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(aimPlane, tmpV)) tmpV.set(0, 0, LINE_Z);
  let best = 0, bestD = 1e9;
  for (let i = 0; i < 4; i++) { const d = Math.abs(tmpV.x - LANES[i]); if (d < bestD) { bestD = d; best = i; } }
  return best;
}
function beginPlaceSticky(): void {
  if ((state !== 'play' && state !== 'between') || stickiesHeld <= 0 || fieldStickyCount() >= 1) {
    if (stickiesHeld <= 0 || fieldStickyCount() >= 1) sfx.sfxClick();
    return;
  }
  if (placingSticky) { cancelPlaceSticky(); return; }
  placingSticky = true;
  aiming = false; holding = false;
  sfx.sfxClick();
  updateStickyBtn();
}
function cancelPlaceSticky(): void {
  placingSticky = false;
  updateStickyBtn();
}
function freeSticky(st: Sticky): void {
  scene.remove(st.group);
  st.halo.material.dispose();
  (st.resin.material as THREE.Material).dispose();
  st.resin.geometry.dispose();
}
function placeSticky(lane: number): Sticky | undefined {
  if (stickiesHeld <= 0 || fieldStickyCount() >= 1) { cancelPlaceSticky(); return undefined; }
  if (state !== 'play' && state !== 'between') { cancelPlaceSticky(); return undefined; }
  stickiesHeld--;
  placingSticky = false;
  const z = LINE_Z - 0.35;
  const group = new THREE.Group();
  const shoe = makeChancla();
  shoe.children.forEach((c, i) => { (c as THREE.Mesh).material = i === 0 ? relicSole : relicStrap; });
  shoe.scale.setScalar(1.05);
  shoe.rotation.set(0.15, 0.85, 0.05, 'YXZ');
  shoe.position.y = 0.22;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd23f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.85 }));
  halo.scale.set(1.8, 1.15, 1); halo.position.y = 0.35; halo.renderOrder = 3;
  const halo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x18c8c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.45 }));
  halo2.scale.set(1.3, 0.9, 1); halo2.position.y = 0.2; halo2.renderOrder = 3;
  const resin = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 22),
    new THREE.MeshBasicMaterial({ map: resinTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
  );
  resin.rotation.x = -Math.PI / 2; resin.position.y = 0.04; resin.renderOrder = 2;
  group.add(resin, halo, halo2, shoe);
  group.position.set(LANES[lane], 0, z);
  scene.add(group);
  FX.glow(shoe, 1.3, 0.6);
  const st: Sticky = { group, shoe, halo, resin, lane, z, life: STICKY_LIFE, throws: 0, fireAt: clock + 0.4, planted: clock, alive: true, fading: 0 };
  fieldStickies.push(st);
  sfx.sfxStickyPlant(); sfx.buzz(18);
  fx.ring(new THREE.Vector3(LANES[lane], 0.1, z), 1.2, 0xffd23f);
  popAt(new THREE.Vector3(LANES[lane], 1.1, z), 'STICKY!', 'big');
  updateStickyBtn();
  return st;
}
function stickyThrowAt(from: THREE.Vector3, to: THREE.Vector3, target?: Kid): void {
  const T = THREE.MathUtils.clamp(from.distanceTo(to) / 17, 0.28, 0.7);
  const v = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y + 0.5 * G * T * T) / T, (to.z - from.z) / T);
  const obj = shotProto.clone(); scene.add(obj); FX.glow(obj, 1.05, 0.55);
  obj.position.copy(from); obj.scale.setScalar(0.88);
  shots.push({ obj, p: from.clone(), v, spent: -1, spin: 0, yaw: Math.atan2(v.x, v.z), target, born: clock, fromSticky: true });
  sfx.sfxFire(); sfx.sfxWhoosh();
}
function tickStickies(dt: number): void {
  for (const st of fieldStickies) {
    if (!st.alive) continue;
    st.life -= dt;
    const s = clock;
    st.shoe.rotation.set(0.15, 0.85 + Math.sin(s * 2.2) * 0.15, 0.05 + Math.sin(s * 1.6) * 0.04, 'YXZ');
    st.shoe.position.y = 0.22 + Math.sin(s * 3.1) * 0.05;
    st.halo.material.opacity = 0.7 + Math.sin(s * 5) * 0.2;
    st.resin.scale.setScalar(1 + Math.sin(s * 3.4) * 0.07);
    (st.resin.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(s * 4) * 0.12;
    // catch kids in this lane once
    for (const k of kids) {
      if (!alive(k) || k.lane !== st.lane || k.wasStuck || k.stuck > 0) continue;
      if (Math.abs(k.z - st.z) < 0.58) {
        k.stuck = STICKY_STICK; k.wasStuck = true;
        sfx.sfxStickyCatch();
        fx.ring(new THREE.Vector3(k.root.position.x, 0.12, k.z), 0.8, 0x18c8c0);
        popText(k, 'STUCK!', '');
      }
    }
    if (st.fading > 0) {
      st.fading += dt;
      const fade = Math.max(0, 1 - st.fading / 0.45);
      st.group.scale.setScalar(0.7 + fade * 0.3);
      st.halo.material.opacity *= fade;
      (st.resin.material as THREE.MeshBasicMaterial).opacity *= fade;
      if (st.fading >= 0.45) { st.alive = false; freeSticky(st); }
      continue;
    }
    const done = st.life <= 0 || st.throws >= STICKY_THROWS;
    if (done) { st.fading = 0.001; continue; }
    if (clock >= st.fireAt && (state === 'play' || state === 'between')) {
      // prefer an incoming soul in this lane, then the closest (or stuck) kid
      const so = souls.find((x) => !x.dead && x.lane === st.lane);
      const live = kids.filter((k) => alive(k) && k.lane === st.lane && k.z > SPAWN_Z + 0.4);
      live.sort((a, b) => (b.stuck > 0 ? 2.5 : 0) + b.z - ((a.stuck > 0 ? 2.5 : 0) + a.z));
      const from = st.group.position.clone(); from.y = 0.9;
      if (so) {
        stickyThrowAt(from, so.p.clone().lerp(so.end, 0.2));
        st.throws++; st.fireAt = clock + 1.65;
      } else if (live[0]) {
        const to = predict(live[0], 0.38, new THREE.Vector3());
        stickyThrowAt(from, to, live[0]);
        st.throws++; st.fireAt = clock + 1.65;
      } else {
        st.fireAt = clock + 0.3;
      }
    }
  }
  fieldStickies = fieldStickies.filter((st) => st.alive);
  // pulse the placing pads
  if (placingSticky) {
    lanePads.forEach((p, i) => {
      (p.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(clock * 6 + i) * 0.14;
      p.scale.setScalar(1 + Math.sin(clock * 5 + i) * 0.08);
    });
  }
}

function startRapid(): void {
  rapidUntil = clock + 5; sfx.sfxRapid(); sfx.buzz([20, 40, 20]);
  banner('RAPID FIRE!', 'Hold to spray chanclas'); $('rapid').classList.remove('hidden');
}
const PETAL_COLORS = [0xff8c1a, 0xffb000, 0xffd23f, 0xff6a00, 0xe2197a];
const petalPool: Petal[] = [];
function givePetal(p: Petal): void {
  fxGroup.remove(p.s);
  if (p.spin === 0) { p.s.material.dispose(); return; } // glow puff: unique material, don't pool with petals
  if (petalPool.length < PETAL_CAP) { p.s.material.opacity = 1; petalPool.push(p); }
  else p.s.material.dispose();
}
function poof(at: THREE.Vector3, n: number): void {
  const want = Math.min(PREFER_LOW ? Math.max(8, Math.ceil(n * 0.4)) : n, 28);
  while (petals.length + want > PETAL_CAP) {
    const old = petals.shift();
    if (old) givePetal(old);
  }
  for (let i = 0; i < want; i++) {
    const p = petalPool.pop() ?? { s: new THREE.Sprite(new THREE.SpriteMaterial({ map: petalTex, transparent: true, depthWrite: false, fog: false })), v: new THREE.Vector3(), life: 0, max: 1, spin: 0 };
    p.s.material.color.setHex(PETAL_COLORS[i % PETAL_COLORS.length]);
    p.s.material.opacity = 1;
    p.s.scale.setScalar(0.17 + Math.random() * 0.12);
    p.s.position.copy(at);
    const a = Math.random() * Math.PI * 2, up = 2.5 + Math.random() * 4;
    const sp = 1.6 + Math.random() * 2.6;
    p.v.set(Math.cos(a) * sp, up, Math.sin(a) * sp * 0.6);
    p.life = 0; p.max = 0.55 + Math.random() * 0.45; p.spin = (Math.random() - 0.5) * 12 || 0.01; // never 0 (0 marks the glow puff)
    fxGroup.add(p.s);
    petals.push(p);
  }
  // a quick glow puff — skip on phones when the burst is already full
  if (!PREFER_LOW || petals.length < PETAL_CAP - 2) {
    const g = new THREE.Sprite(haloMat.clone()); g.position.copy(at); g.scale.setScalar(0.5); fxGroup.add(g);
    petals.push({ s: g, v: new THREE.Vector3(0, 0.6, 0), life: 0, max: 0.35, spin: 0 });
  }
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
  petals = petals.filter((p) => { const done = p.life >= p.max || p.s.position.y < 0.35; if (done) givePetal(p); return !done; });
}
function kidReachedLine(k: Kid): void {
  k.dead = true; kidGroup.remove(k.root); k.mat.dispose(); k.flashMat.dispose(); k.edgeMat.dispose(); /* shareTex: keep the atlas on the GPU */
  if (k.soulCharge) (k.soulCharge.material as THREE.Material).dispose();
  if (k === boss) boss = undefined;
  loseHeart(k.kind === 'lucha' ? BOSS_DMG : 1, new THREE.Vector3(k.root.position.x, k.h + 0.2, k.root.position.z));
}

// ───────────────────────── HUD + overlays ─────────────────────────
function updateHud(bump = false): void {
  $('score').textContent = String(score);
  if (bump) {
    const b = $('scoreBox');
    b.classList.remove('bump');
    requestAnimationFrame(() => b.classList.add('bump'));
  }
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
function popAt(at: THREE.Vector3, text: string, cls: string): void {
  const v = at.clone().project(camera);
  const el = document.createElement('div'); el.className = `pop ${cls}`; el.textContent = text;
  el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`; el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
  $('fx').appendChild(el); setTimeout(() => el.remove(), 1000);
}
function popText(k: Kid, text: string, cls: string): void {
  popAt(new THREE.Vector3(k.root.position.x, k.h + 0.2, k.root.position.z), text, cls);
}
function loseHeart(n: number, at?: THREE.Vector3, label = '−❤️'): void {
  const prev = hearts;
  hearts = Math.max(0, hearts - n);
  updateHud();
  const hs = $('hearts').children;
  for (let i = hearts; i < prev; i++) {
    const lostEl = hs[i] as HTMLElement | undefined;
    if (lostEl) { lostEl.classList.remove('lost'); void lostEl.offsetWidth; lostEl.classList.add('lost'); }
  }
  const h = $('hurt'); h.classList.add('on'); setTimeout(() => h.classList.remove('on'), 90);
  shake = Math.max(shake, 0.7);
  sfx.sfxBoing(); sfx.sfxThwack(0.5); sfx.buzz([40, 30, 60]);
  if (at) popAt(at, label, 'bad');
  combo = 0;
  if (hearts <= 0) gameOver();
}
function clearField(): void {
  for (const k of kids) { kidGroup.remove(k.root); k.mat.dispose(); k.flashMat.dispose(); k.edgeMat.dispose(); /* shareTex: keep the atlas on the GPU */ if (k.bite) (k.bite.material as THREE.Material).dispose(); if (k.eatBody) { const m = k.eatBody.material as THREE.MeshBasicMaterial; m.dispose(); k.eatBody.geometry.dispose(); } if (k.fallBody) { const m = k.fallBody.material as THREE.SpriteMaterial; m.dispose(); } if (k.soulCharge) (k.soulCharge.material as THREE.Material).dispose(); }
  for (const s of shots) scene.remove(s.obj);
  for (const p of petals) givePetal(p);
  for (const c of conchas) freeLoaf(c.loaf);
  for (const m of crumbs) giveCrumb(m.sprite);
  for (const so of souls) { so.dead = true; freeSoul(so); }
  for (const st of fieldStickies) { st.alive = false; freeSticky(st); }
  for (const f of laneFlares) { scene.remove(f); f.geometry.dispose(); (f.material as THREE.Material).dispose(); }
  kids = []; shots = []; petals = []; conchas.length = 0; crumbs.length = 0; souls = []; fieldStickies = []; laneFlares.length = 0; fx.clear(); boss = undefined;
  placingSticky = false;
}
function newGame(): void {
  clearField();
  hearts = HEARTS; score = 0; knocked = 0; thrown = 0; combo = 0; rapidUntil = 0; goldenThisWave = false; bombs = params.has('bombs') ? Math.min(BOMB_MAX, Number(params.get('bombs')) || 0) : 0; snacks = 2; stickiesHeld = params.has('sticky') ? Math.min(STICKY_MAX, Math.max(0, Number(params.get('sticky')) || 0)) : 0; soulsThisWave = 0; stickyComboThisWave = false; placingSticky = false; updateBombBtn(); updateSnackBtn(); updateStickyBtn();
  ['title', 'over', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  stage.classList.remove('on-title'); // HUD, hearts, fire and bomb buttons only show once play starts
  $('hint').classList.remove('gone');
  setTimeout(() => $('hint').classList.add('gone'), 5000);
  markGameStart('waves');
  startWave(params.has('wave') ? Math.max(1, Number(params.get('wave'))) : 1);
}
function gameOver(): void {
  state = 'over'; aiming = false; abuelaHide();
  const isBest = score > best; if (isBest) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ } }
  $('oWave').textContent = String(wave); $('oScore').textContent = String(score);
  $('oBest').textContent = isBest && score > 0 ? '🏆 New best!' : `Best: ${best}`;
  const txt = `I held the marigold line to wave ${wave} with ${score} points in ${WAVES_NAME} 🥿💀🌼`;
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
let artReady = false;
$('play').addEventListener('click', () => { sfx.unlockCrashAudio(); sfx.sfxClick(); if (artReady) newGame(); });
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
  if (fpsAcc > 2) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (!qualityLocked && fps < 42 && quality > 0 && ++lowFps >= 2) {
      lowFps = 0;
      applyQuality(quality - 1);
      report('quality: ' + quality);
    } else if (fps >= 50) lowFps = 0;
  }
  const running = state === 'play' || state === 'between' || state === 'over';
  const dt = state === 'paused' ? 0 : dtReal * hitStop.scale();
  if (state !== 'paused') clock += dt;
  const s = now / 1000;

  if (state === 'play') spawnTick(dt);
  if (state === 'between' && clock >= nextWaveAt) startWave(wave + 1);
  tickAbuela();
  tickConchas(dt);
  if (state === 'play' || state === 'between') {
    maybeStartSoul();
    tickSouls(dt);
    tickStickies(dt);
  } else {
    tickFlares();
  }
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
      k.root.position.z -= dt * 1.2;
      const fade = THREE.MathUtils.clamp((1.15 - k.ko) / 0.45, 0, 1);
      if (k.kind === 'girl') {
        paintGirlFall(k);
        (k.fallBody!.material as THREE.SpriteMaterial).opacity = fade;
      } else {
        setFrame(k, 'ko', Math.floor(k.ko * ANIM.ko.fps)); k.body.rotation.set(0.28, 0, 0); k.body.scale.set(1, 1, 1);
        k.mat.opacity = fade;
        k.body.visible = true;
      }
      (k.shadow.material as THREE.MeshBasicMaterial).opacity = fade;
      if (k.pips) k.pips.forEach((p) => { p.visible = false; });
      if (k.aura) k.aura.visible = false;
      if (k.hpBar) { k.hpBar.visible = false; k.hpFill!.visible = false; }
      if (k.bite) k.bite.visible = false;
      if (k.eatBody) k.eatBody.visible = false;
      if (k.ko > 1.15) { k.dead = true; kidGroup.remove(k.root); k.mat.dispose(); k.flashMat.dispose(); k.edgeMat.dispose(); /* shareTex: keep the atlas on the GPU */ if (k.bite) (k.bite.material as THREE.Material).dispose(); if (k.eatBody) { const m = k.eatBody.material as THREE.MeshBasicMaterial; m.dispose(); k.eatBody.geometry.dispose(); } if (k.fallBody) { const m = k.fallBody.material as THREE.SpriteMaterial; m.dispose(); } if (k.soulCharge) (k.soulCharge.material as THREE.Material).dispose(); }
      continue;
    }
    if (state === 'play' || state === 'between') {
      if (k.eat > 0) { k.eat = Math.max(0, k.eat - dt); k.eatAnim += dt; } else k.eatAnim = 0;
      if (k.stuck > 0) k.stuck = Math.max(0, k.stuck - dt);
      const stop = holdZ(k);
      const winding = k.soulWind > 0;
      let sp = k.stuck > 0 ? 0 : k.stagger > 0 ? k.speed * 0.15 : winding ? k.speed * 0.22 : k.speed;
      if (stop !== undefined) sp *= 0.32; // the whole row slows down before the concha
      k.stagger = Math.max(0, k.stagger - dt);
      let nz = k.z + sp * dt;
      if (stop !== undefined && nz > stop) nz = stop; // nobody in this row walks past it
      k.z = nz;
      k.wob += (k.stuck > 0 ? 0 : sp) * dt;
    }
    k.x = k.wobA ? LANES[k.lane] + Math.sin(k.wob * 1.3) * k.wobA : LANES[k.lane];
    // walk frames follow distance so the planted feet in the atlas stay on the cobbles. No extra hop (that read as a skip).
    const cyc = (k.wob / (k.sheet.stride * (k.kind === 'jefe' ? 1.3 : 1)) + k.phase) % 1;
    const eatSheet = EAT_SHEETS[k.kind];
    const plateArt = k.eat > 0 && !!eatSheet && !!eatSheet.tex.image;
    const eating = k.eat > 0 && (plateArt || !!k.bite);
    showEater(k, plateArt);
    if (plateArt) {
      k.body.visible = false;
      k.body.scale.set(1, 1, 1);
      if (k.bite) k.bite.visible = false;
    } else if (eating && k.bite) {
      // Little skeleton and luchador have no eat sheet: a planted walk frame and a mild nod,
      // never a Y-squash or a steeper card tilt (those flattened the head into a "chew" angle).
      k.body.visible = true;
      setFrame(k, 'walk', 0);
      const chew = Math.sin(s * 10 + k.phase);
      k.body.scale.set(1, 1, 1);
      k.body.rotation.set(0.2 + chew * 0.05, -k.x * 0.04, 0);
      const left = Math.min(1, k.eat / 1.2);
      const size = k.h * (0.08 + 0.06 * left) * (chew > 0 ? 0.7 : 1);
      k.bite.visible = true;
      k.bite.scale.set(size, size * 0.9, 1);
      k.bite.position.set(0, k.h * (0.64 - (chew > 0 ? 0.07 : 0)), 0.35);
      (k.bite.material as THREE.SpriteMaterial).rotation = chew > 0 ? -0.35 : 0.2;
    } else {
      k.body.visible = true;
      k.body.scale.set(1, 1, 1);
      if (k.bite) k.bite.visible = false;
      if (k.anim === 'hit') { k.animT += dt; const i = Math.floor(k.animT * ANIM.hit.fps); if (i >= k.sheet.hitN) playAnim(k, 'walk'); else setFrame(k, 'hit', i); }
      if (k.anim === 'walk') setFrame(k, 'walk', Math.floor(cyc * k.sheet.walkN));
      k.body.rotation.set(0.2, -k.x * 0.04, k.stagger > 0 ? Math.sin(s * 40) * 0.05 : 0);
    }
    if (k.hpBar) { const pulse = k.hp / k.maxHp < 0.34 ? 1 + Math.sin(s * 12) * 0.06 : 1; k.hpBar.scale.set(1.7 * pulse, 0.32 * pulse, 1); }
    k.root.position.set(k.x, 0, k.z);
    if (k.stuck > 0) {
      k.root.position.y = Math.sin(s * 16) * 0.03;
      k.body.rotation.z = Math.sin(s * 14) * 0.06;
    }
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
        if (sh.snack) {
          // it lands on the row, in front of that line. It is not eaten out of the air.
          if (sh.p.y <= 0.2) {
            placeConcha(sh.lane ?? sh.target?.lane ?? 0);
            sh.spent = 0.61; sh.obj.visible = false; break;
          }
          continue;
        }
        if (sh.spent < 0) {
          for (const so of souls) {
            if (so.dead) continue;
            if (sh.p.distanceTo(so.p) < SOUL_SMASH_R) { smashSoul(so, sh); break; }
          }
        }
        if (sh.spent < 0) for (const k of kids) {
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
    if (sh.spent < 0 && dt > 0) { if (sh.bomb) fx.sparks(sh.p, PREFER_LOW ? 2 : 3, 0xff8a2a, 1.2, 0.6); else if (Math.random() < TRAIL_CHANCE) fx.trail(sh.p); }
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
  if (quality > 0) {
    for (const f of flames) f.scale.set(0.42 + Math.sin(s * 13 + f.userData.phase) * 0.04, 0.55 + Math.sin(s * 9 + f.userData.phase) * 0.06, 1);
    backdrop.update(now);
  }

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
autoUnlockAudio(); wireMute(); initAudioControls('waves', setMuted);
for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) addEventListener(ev, () => sfx.unlockCrashAudio(), { capture: true, passive: true });
$('hint').textContent = isTouch ? 'Tap or drag at a kid to throw · smash incoming souls · plant a sticky chancla on the line' : 'Click or drag at a kid to throw · Space = gold chancla · S = sticky chancla';
updateHud();
// Plaza starts drawing at once. Walk atlases and the concha gate newGame so kids
// have their sheets, but eat poses, the boss atlas, and the between-waves Abuela
// cameo wait their turn. No intro wait and no loading screen. Abuela's start
// walk-in uses a small dedicated sprite, plays on top of the live plaza, and
// never delays throws (a tap skips).
stage.classList.add('on-title');
prev = performance.now();
requestAnimationFrame(frame);
playPlayer1Intro('waves');
Promise.all(texLoads).then(() => {
  artReady = true;
  newGame();
  // eat sheets, luchador, and Abuela are not needed on wave 1 — warm them after the first frame so they don't steal bandwidth
  const warmLater = () => {
    for (const start of deferredTex) start();
    for (const src of Object.values(ABUELA_IMG)) { const i = new Image(); i.decoding = 'async'; i.src = src; }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warmLater, { timeout: 2500 });
  else setTimeout(warmLater, 1200);
});

// test / screenshot hooks
(window as unknown as Record<string, unknown>).__waves = {
  ready: () => artReady,
  start: newGame,
  setQuality: (q: number, lock = true) => { qualityLocked = lock; applyQuality(q); },
  perf: () => {
    const i = renderer.info;
    return {
      quality, dpr: renderer.getPixelRatio(), shadows: renderer.shadowMap.enabled, fill: fill.visible,
      calls: i.render.calls, triangles: i.render.triangles, points: i.render.points,
      textures: i.memory.textures, geometries: i.memory.geometries, programs: i.programs?.length ?? 0,
      kids: kids.length, shots: shots.length, petals: petals.length, crumbs: crumbs.length,
      canvas: { w: renderer.domElement.width, h: renderer.domElement.height },
    };
  },
  state: () => ({ state, wave, hearts, score, knocked, thrown, kids: kids.filter(alive).length, toSpawn, shots: shots.length, petals: petals.length, rapid: clock < rapidUntil, bombs, booms, stickiesHeld, souls: souls.filter((so) => !so.dead).length, stickyField: fieldStickyCount(), boss: boss && alive(boss) ? { hp: boss.hp, maxHp: boss.maxHp, z: +boss.root.position.z.toFixed(2) } : null }),
  kids: () => kids.filter(alive).map((k) => ({ kind: k.kind, x: +k.root.position.x.toFixed(2), z: +k.root.position.z.toFixed(2), hp: k.hp, golden: k.golden, lane: k.lane })),
  conchas: () => conchas.map((c) => ({ lane: c.lane, z: +c.z.toFixed(2), bites: c.bites })),
  crumbs: () => crumbs.length,
  giveSnack: (n = 1) => giveSnack(n),
  snack: useSnack,
  placeConcha: (lane = 1) => placeConcha(lane),
  screenOf: (i = 0) => { const k = kids.filter(alive).sort((a, b) => b.z - a.z)[i]; if (!k) return null; const v = kidCenter(k).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; },
  auto: autoThrow,
  wave: (n: number) => { clearField(); startWave(n); },
  spawn: (kind: Kind = 'boy', lane = 1, z = -6, speed = 1.2) => { const k = spawnKid(kind, lane, speed); k.z = z; return kids.length; },
  hurt: (n = 1) => { for (let i = 0; i < n; i++) { const k = spawnKid('boy', i % 4, 1); k.z = LINE_Z - 0.01; } },
  rapid: startRapid,
  bomb: useBomb,
  giveBomb: (n = 1) => giveBomb(n),
  abuela: () => ({ on: abuelaEl.classList.contains('in'), line: abuelaLine.textContent, mad: abuelaImg.src.includes('angry'), at: abuelaAt, out: abuelaOutAt, clock, nextWaveAt }),
  abuelaLines: () => ABUELA_LINES.map((l) => l.t),
  clearWave: () => { toSpawn = 0; for (const k of kids) if (alive(k)) { kidGroup.remove(k.root); k.dead = true; } for (const so of souls) { so.dead = true; freeSoul(so); } souls = []; checkWaveDone(); },
  pause: (on: boolean) => { if (on !== (state === 'paused')) togglePause(); },
  stopSpawn: () => { toSpawn = 0; },
  clock: () => clock,


  souls: () => souls.filter((so) => !so.dead).map((so) => ({ x: +so.p.x.toFixed(2), y: +so.p.y.toFixed(2), z: +so.p.z.toFixed(2), u: +so.u.toFixed(3), T: so.T, lane: so.lane })),
  spawnSoul: (lane = 1, fromZ = -3.2, travel?: number) => spawnSoul(lane, fromZ, travel),
  windSoul: (lane = 1, fromZ = -3.2) => { windSoul(lane, fromZ); },
  throwAtSoul: () => { const so = souls.find((x) => !x.dead); if (!so) return false; lastThrow = -1e9; return throwAt(so.p.clone().lerp(so.end, 0.12)); },

  giveSticky: (n = 1) => giveSticky(n),
  placeSticky: (lane = 1) => placeSticky(lane),
  stickies: () => ({ held: stickiesHeld, placing: placingSticky, field: fieldStickies.filter((st) => st.alive).map((st) => ({ lane: st.lane, z: +st.z.toFixed(2), life: +st.life.toFixed(2), throws: st.throws })) }),
  kidsFull: () => kids.filter(alive).map((k) => ({ kind: k.kind, lane: k.lane, z: +k.z.toFixed(2), stuck: +k.stuck.toFixed(2), wasStuck: k.wasStuck, soulWind: +k.soulWind.toFixed(2), soulThrew: k.soulThrew })),
  soulScreen: () => { const so = souls.find((x) => !x.dead); if (!so) return null; const v = so.p.clone().project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, u: so.u }; },

};
