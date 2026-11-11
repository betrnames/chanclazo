// Chancla Crash: hyper-casual 3D topple game (three.js + cannon-es).
// Drag to aim (dotted arc + reticle), tap the gold chancla button to throw; topple the starred pan dulce + cafecito critters.
// The gold chancla button fires from the bottom centre. RAPID FIRE power-up: hit the floating gold pickup or land a TRIPLE.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { $, autoUnlockAudio, wireMute, wakeAudio, report } from './common';
import { initAudioControls } from './music';
import { setMuted } from '../game/sound';
import { markGameStart, markFirstAction, track } from '../analytics';
import {
  makeChancla, makeSkeleton, makePinata, makeJarrito, makeCandle, makeConcha, makeCafe, makePapelRow, buildBackdrop, boxMats, sugarSkullTex, laceTex, crateTex, woodTex,
  deflectorTex, dotTex, reticleTex, PAL, WORLD_NAMES, PAPEL_COLORS, type Backdrop, type WorldId, type Critter, type Mood,
} from './crashArt';
import { LEVELS, S, type Builder } from './crashLevels';
import * as sfx from './crashAudio';
import { FX, HitStop } from './fx3d';

const G = 18;                       // gravity (snappier than real)
const FIXED = 1 / 120;
const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// ───────────────────────── save ─────────────────────────
interface Save { level: number; coins: number; stars: number[] }
const SAVE_KEY = 'cz_crash_v1';
function loadSave(): Save { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || ''); if (s && typeof s.level === 'number') return { level: s.level, coins: s.coins || 0, stars: s.stars || [] }; } catch { /* new */ } return { level: 0, coins: 0, stars: [] }; }
const save = loadSave();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ } };

// ───────────────────────── renderer / scene ─────────────────────────
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 2 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
const fx = new FX(scene, 0), hitStop = new HitStop(); // polish: gold shockwaves, sparks, relic glow, hit-stop
const camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 200);
const CAM_POS = new THREE.Vector3(0, 3.0, 6.6), CAM_LOOK = new THREE.Vector3(0, 1.45, -7.5);
camera.position.copy(CAM_POS); camera.lookAt(CAM_LOOK);
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(4, 12, 6); sun.target.position.set(0, 0, -7); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 8, bottom: -6, near: 1, far: 40 }); sun.shadow.bias = -0.0008;
const fill = new THREE.PointLight(0xffa64d, 18, 14, 1.6); fill.position.set(0, 3, -4); scene.add(fill);

function resize(): void {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h; camera.aspect = aspect;
  // keep at least ~34° horizontal view on narrow phones, 52° vertical otherwise
  const hv = 31 * Math.PI / 180, vNeeded = 2 * Math.atan(Math.tan(hv / 2) / aspect) * 180 / Math.PI;
  camera.fov = Math.max(48, vNeeded); camera.updateProjectionMatrix();
  placeLauncher();
}

// ───────────────────────── physics ─────────────────────────
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
(world.solver as CANNON.GSSolver).iterations = 12;
const mBlock = new CANNON.Material('block'), mProj = new CANNON.Material('proj'), mDefl = new CANNON.Material('defl'), mGround = new CANNON.Material('ground');
world.defaultContactMaterial.friction = 0.45; world.defaultContactMaterial.restitution = 0.08;
world.addContactMaterial(new CANNON.ContactMaterial(mProj, mDefl, { friction: 0, restitution: 0.92 }));
world.addContactMaterial(new CANNON.ContactMaterial(mBlock, mBlock, { friction: 0.55, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(mProj, mBlock, { friction: 0.3, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(mBlock, mGround, { friction: 0.6, restitution: 0.1 }));
const RIDE_GROUP = 4;
function releaseRider(e: { rider?: MoverS; body: CANNON.Body }): void {
  if (!e.rider) return;
  const m = e.rider; e.rider = undefined; e.body.collisionFilterMask = -1;
  e.body.velocity[m.axis] += m.body.velocity[m.axis];
}
const ground = new CANNON.Body({ mass: 0, material: mGround, shape: new CANNON.Plane() });
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);

// ───────────────────────── level state ─────────────────────────
type Kind = 'crate' | 'skull' | 'skel' | 'jar' | 'candle' | 'pinata' | 'post' | 'plank' | 'concha' | 'cafe';
interface Ent { critter?: Critter; mood?: Mood; popT?: number; rider?: MoverS; body: CANNON.Body; obj: THREE.Object3D; kind: Kind; starred: boolean; done: boolean; initY: number; shatter: number; pts: number; arms?: THREE.Group[]; phase: number; flame?: THREE.Sprite }
interface MoverS { body: CANNON.Body; obj: THREE.Object3D; base: CANNON.Vec3; amp: number; w: number; ph: number; axis: 'x' | 'z'; w2: number; d2: number; top: number }
interface Proj { body: CANNON.Body; obj: THREE.Object3D; born: number; bornSim: number; hit: boolean }
interface Defl { body: CANNON.Body; center: THREE.Vector3; half: THREE.Vector3; yaw: number }
interface Papel { g: THREE.Group; body: CANNON.Body; torn: boolean }
interface StaticBox { min: THREE.Vector3; max: THREE.Vector3 }

let levelIdx = Math.max(0, Math.min(LEVELS.length - 1, params.has('level') ? Number(params.get('level')) - 1 : save.level >= LEVELS.length ? 0 : save.level));
let papels: Papel[] = [], ents: Ent[] = [], movers: MoverS[] = [], projs: Proj[] = [], defls: Defl[] = [], statics: StaticBox[] = [];
let levelGroup = new THREE.Group(); scene.add(levelGroup);
let aimables: THREE.Object3D[] = [];
let backdrop: Backdrop | null = null, backdropWorld: WorldId | null = null;
let stageIdx = 0, levelAmmoTotal = 0, critI = 0, ammo = 0, starredTotal = 0, starredDown = 0, levelScore = 0, shotsFired = 0;
let stageGen = 0, lastShotAt = -1e9, comboCount = 0, comboShot = 0, pinatas = 0;
type State = 'intro' | 'play' | 'stageclear' | 'winning' | 'won' | 'lost' | 'paused' | 'final';
let state: State = 'play';
let timeScale = 1, slowUntil = 0, shake = 0;
const removeQ: CANNON.Body[] = [];
const trace: number[][] = [];
const tearQ: Papel[] = [];

function disposeObj(o: THREE.Object3D): void {
  o.traverse((c) => { const m = c as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
}
function clearLevel(): void {
  for (const b of [...world.bodies]) if (b !== ground) world.removeBody(b);
  scene.remove(levelGroup); disposeObj(levelGroup);
  levelGroup = new THREE.Group(); scene.add(levelGroup);
  papels = []; ents = []; movers = []; projs = []; defls = []; statics = []; aimables = [];
  debris.clear(); fx.clear();
}

function setWorld(w: WorldId): void {
  if (backdropWorld === w) return;
  if (backdrop) { scene.remove(backdrop.group); disposeObj(backdrop.group); }
  backdrop = buildBackdrop(w); backdropWorld = w;
  scene.add(backdrop.group); scene.fog = backdrop.fog; scene.background = backdrop.fog.color;
  hemi.color.setHex(backdrop.hemi[0]); hemi.groundColor.setHex(backdrop.hemi[1]); sun.color.setHex(backdrop.sun);
  const fl = backdrop.group.getObjectByName('floor'); if (fl) aimables.push(fl);
}

const ACCENTS = [PAL.pink, PAL.teal, PAL.orange, PAL.purple, PAL.green];
let accentI = 0;
function addEnt(kind: Kind, shape: CANNON.Shape, mass: number, obj: THREE.Object3D, pos: CANNON.Vec3, o: Partial<Ent> = {}): Ent {
  const body = new CANNON.Body({ mass, material: mBlock, shape, position: pos, linearDamping: 0.04, angularDamping: 0.12 });
  body.sleepSpeedLimit = 0.25; body.sleepTimeLimit = 0.35;
  world.addBody(body);
  obj.position.set(pos.x, pos.y, pos.z);
  obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  levelGroup.add(obj); aimables.push(obj);
  const e: Ent = { body, obj, kind, starred: false, done: false, initY: pos.y, shatter: Infinity, pts: 10, phase: Math.random() * 6, ...o };
  body.addEventListener('collide', (ev: { body: CANNON.Body; contact: CANNON.ContactEquation }) => onHit(e, ev));
  ents.push(e);
  return e;
}
function boxMesh(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

const builder: Builder = {
  pedestal(x, z, w, d, top = 1.2) {
    const [pm, trim] = backdrop!.platformMat;
    const m = boxMesh(w, top, d, pm); m.position.set(x, top / 2, z); m.receiveShadow = true; m.castShadow = true; levelGroup.add(m); aimables.push(m);
    const lip = boxMesh(w + 0.12, 0.1, d + 0.12, trim); lip.position.set(x, top - 0.05, z); levelGroup.add(lip);
    const body = new CANNON.Body({ mass: 0, material: mGround, shape: new CANNON.Box(new CANNON.Vec3(w / 2, top / 2, d / 2)), position: new CANNON.Vec3(x, top / 2, z) });
    world.addBody(body);
    statics.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, top, z + d / 2) });
    return top;
  },
  mover(x, z, w, d, top, amp, period, phase = 0) {
    const axis = 'x' as const;
    const [pm, trim] = backdrop!.platformMat;
    const g = new THREE.Group();
    const slab = boxMesh(w, 0.3, d, pm); slab.receiveShadow = true; slab.castShadow = true; g.add(slab);
    const lip = boxMesh(w + 0.1, 0.08, d + 0.1, trim); lip.position.y = 0.13; g.add(lip);
    for (const sx of [-1, 1]) { const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), new THREE.MeshBasicMaterial({ color: 0xffd23f })); arrow.rotation.z = -sx * Math.PI / 2; arrow.position.set(sx * (w / 2 + 0.22), 0, d / 2 - 0.1); g.add(arrow); }
    g.position.set(x, top - 0.15, z); levelGroup.add(g); aimables.push(g);
    // rail on the floor shows the path
    const rail = boxMesh(amp * 2 + w, 0.06, 0.18, trim); rail.position.set(x, 0.03, z); levelGroup.add(rail);
    for (const k of [-1, 1]) { const p = boxMesh(0.14, top - 0.3, 0.14, pm); p.position.set(x + k * (amp + w / 2), (top - 0.3) / 2, z); levelGroup.add(p); }
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, collisionFilterGroup: RIDE_GROUP, material: mGround, shape: new CANNON.Box(new CANNON.Vec3(w / 2, 0.15, d / 2)), position: new CANNON.Vec3(x, top - 0.15, z) });
    world.addBody(body);
    const w0 = (Math.PI * 2) / (period * 1.6); // tuned slower so you can lead the shot
    body.position[axis] = (axis === 'x' ? x : z) + amp * Math.sin(phase);
    movers.push({ body, obj: g, base: new CANNON.Vec3(x, top - 0.15, z), amp, w: w0, ph: phase, axis, w2: w / 2, d2: d / 2, top });
    return top;
  },
  wall(x, z, w, h, d, y = 0) {
    const m = boxMesh(w, h, d, backdrop!.platformMat[0]); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; levelGroup.add(m); aimables.push(m);
    const cap = boxMesh(w + 0.15, 0.14, d + 0.15, backdrop!.platformMat[1]); cap.position.set(x, y + h, z); levelGroup.add(cap);
    world.addBody(new CANNON.Body({ mass: 0, material: mGround, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), position: new CANNON.Vec3(x, y + h / 2, z) }));
    statics.push({ min: new THREE.Vector3(x - w / 2, y, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h, z + d / 2) });
  },
  deflector(x, y, z, w, h, yaw) {
    const t = 0.3;
    const mat = new THREE.MeshLambertMaterial({ map: deflectorTex(), emissive: 0x0a5a60, emissiveIntensity: 0.7 });
    const m = boxMesh(t, h, w, mat); m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = true; levelGroup.add(m); aimables.push(m);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xbffffb })); edge.raycast = () => {}; m.add(edge);
    const stand = boxMesh(0.12, y - h / 2, 0.12, backdrop!.platformMat[1]); stand.position.set(x, (y - h / 2) / 2, z); levelGroup.add(stand);
    const body = new CANNON.Body({ mass: 0, material: mDefl, shape: new CANNON.Box(new CANNON.Vec3(t / 2, h / 2, w / 2)), position: new CANNON.Vec3(x, y, z) });
    body.quaternion.setFromEuler(0, yaw, 0); world.addBody(body);
    body.addEventListener('collide', (ev: { body: CANNON.Body }) => { if (projs.some((p) => p.body === ev.body)) { sfx.sfxBoing(); sfx.buzz(12); m.scale.set(1.25, 1.06, 1.06); setTimeout(() => m.scale.set(1, 1, 1), 110); } });
    defls.push({ body, center: new THREE.Vector3(x, y, z), half: new THREE.Vector3(t / 2, h / 2, w / 2), yaw });
  },
  crate(x, y, z) {
    const tex = crateTex();
    addEnt('crate', new CANNON.Box(new CANNON.Vec3(S / 2, S / 2, S / 2)), 1.2, boxMesh(S, S, S, new THREE.MeshLambertMaterial({ map: tex })), new CANNON.Vec3(x, y + S / 2, z), { pts: 10 });
    return y + S;
  },
  skull(x, y, z) {
    const acc = ACCENTS[accentI++ % ACCENTS.length];
    const m = boxMesh(S, S, S, boxMats(sugarSkullTex(acc), laceTex(acc)));
    addEnt('skull', new CANNON.Box(new CANNON.Vec3(S / 2, S / 2, S / 2)), 1.0, m, new CANNON.Vec3(x, y + S / 2, z), { shatter: 9, pts: 15 });
    return y + S;
  },
  skel(x, y, z) {
    const sk = makeSkeleton(ACCENTS[accentI++ % ACCENTS.length]);
    const h = 1.16, g = new THREE.Group(); sk.group.position.y = 0.0; g.add(sk.group);
    // starred marker floating above the head
    const star = new THREE.Mesh(new THREE.ConeGeometry(0.001, 0.001, 3)); star.visible = false; g.add(star);
    addEnt('skel', new CANNON.Box(new CANNON.Vec3(0.26, h / 2, 0.17)), 0.7, g, new CANNON.Vec3(x, y + h / 2 + 0.005, z), { pts: 15, arms: [sk.armL, sk.armR] });
    return y + h;
  },
  jar(x, y, z) {
    addEnt('jar', new CANNON.Cylinder(0.2, 0.2, 0.55, 10), 0.5, makeJarrito(), new CANNON.Vec3(x, y + 0.275, z), { shatter: 4.5, pts: 10 });
    return y + 0.55;
  },
  candle(x, y, z, h = 0.5) {
    const c = makeCandle(h, Math.random() < 0.2 ? 0x8a3cff : 0xf7ecd0);
    addEnt('candle', new CANNON.Cylinder(0.11, 0.11, h, 8), 0.25, c.group, new CANNON.Vec3(x, y + h / 2, z), { pts: 5, flame: c.flame });
    return y + h;
  },
  pinata(x, y, z) {
    addEnt('pinata', new CANNON.Sphere(0.42), 0.5, makePinata(), new CANNON.Vec3(x, y + 0.42, z), { shatter: 3.5, pts: 30 });
    return y + 0.84;
  },
  post(x, y, z, h) {
    addEnt('post', new CANNON.Box(new CANNON.Vec3(0.14, h / 2, 0.3)), 0.9, boxMesh(0.28, h, 0.6, new THREE.MeshLambertMaterial({ map: woodTex() })), new CANNON.Vec3(x, y + h / 2, z), { pts: 5 });
    return y + h;
  },
  concha(x, y, z) {
    const c = makeConcha(critI++); const w = new THREE.Group(); c.group.scale.setScalar(1.2); w.add(c.group); w.userData.steam = c.group.userData.steam;
    addEnt('concha', new CANNON.Cylinder(0.44, 0.44, 0.75, 12), 0.7, w, new CANNON.Vec3(x, y + 0.375, z), { starred: true, pts: 25, critter: c, shatter: 13, mood: critI % 2 ? 'happy' : 'smug' });
    return y + 0.75;
  },
  cafe(x, y, z) {
    const c = makeCafe(critI++); const w = new THREE.Group(); c.group.scale.setScalar(1.2); w.add(c.group); w.userData.steam = c.group.userData.steam;
    addEnt('cafe', new CANNON.Cylinder(0.36, 0.36, 0.75, 12), 0.7, w, new CANNON.Vec3(x, y + 0.375, z), { starred: true, pts: 25, critter: c, shatter: 8, mood: critI % 2 ? 'smug' : 'happy' });
    return y + 0.75;
  },
  papel(x, y, z, w) {
    const g = makePapelRow(w); g.position.set(x, y, z); levelGroup.add(g);
    const body = new CANNON.Body({ mass: 0, collisionResponse: false, shape: new CANNON.Box(new CANNON.Vec3(w / 2, 0.36, 0.25)), position: new CANNON.Vec3(x, y - 0.32, z) });
    world.addBody(body);
    const pp: Papel = { g, body, torn: false }; papels.push(pp);
    body.addEventListener('collide', (ev: { body: CANNON.Body }) => { if (!pp.torn && projs.some((q) => q.body === ev.body)) { pp.torn = true; tearQ.push(pp); } });
  },
  plank(x, y, z, len) {
    const tex = woodTex().clone(); tex.needsUpdate = true;
    addEnt('plank', new CANNON.Box(new CANNON.Vec3(len / 2, 0.11, 0.35)), 1.2, boxMesh(len, 0.22, 0.7, new THREE.MeshLambertMaterial({ map: tex })), new CANNON.Vec3(x, y + 0.11, z), { pts: 10 });
    return y + 0.22;
  },
};

function loadLevel(i: number): void {
  levelIdx = i;
  const L = LEVELS[i];
  setWorld(L.world);
  levelScore = 0; shotsFired = 0; pinatas = 0; ammo = 0;
  levelAmmoTotal = L.stages.reduce((n, st) => n + st.ammo, 0);
  for (const id of ['victory', 'lose', 'pause', 'final']) $(id).classList.add('hidden');
  stopPetals();
  loadStage(0);
  beginIntro();
  banner(`Level ${i + 1}`, WORLD_NAMES[L.world]);
  track('level_start', { game: 'crash', level: i + 1 });
}
function loadStage(si: number, retry = false): void {
  const L = LEVELS[levelIdx];
  stageIdx = si; stageGen++;
  clearLevel();
  const fl = backdrop!.group.getObjectByName('floor'); if (fl) aimables.push(fl);
  accentI = levelIdx + si; critI = levelIdx * 3 + si;
  pickup = null; endRapid(true); rapidEarned = false;
  L.stages[si].build(builder);
  const now = performance.now();
  // riders on sliding slabs sleep and are carried exactly (no friction jitter); everything else starts asleep = rock-solid stacks
  ents.forEach((e, k) => {
    const p = e.body.position;
    const m = movers.find((mv) => Math.abs(p.x - mv.base.x) < mv.w2 + 0.1 && Math.abs(p.z - mv.base.z) < mv.d2 + 0.1 && p.y > mv.top - 0.1);
    if (m) {
      p.x += m.body.position.x - m.base.x; p.z += m.body.position.z - m.base.z;
      e.rider = m; e.body.collisionFilterMask = ~RIDE_GROUP;
      e.body.addEventListener('wakeup', () => releaseRider(e));
    }
    e.body.sleep();
    e.popT = now + 120 + k * 35; e.obj.scale.setScalar(0.001);
  });
  for (const m of movers) m.obj.position.set(m.body.position.x, m.body.position.y, m.body.position.z);
  if (retry) ammo = 0;
  ammo += L.stages[si].ammo;
  starredTotal = ents.filter((e) => e.starred).length; starredDown = 0;
  lastShotAt = -1e9; comboCount = 0; comboShot = 0; timeScale = 1; state = 'play';
  if (params.has('rapid') || (levelIdx % 2 === 0 ? si === L.stages.length - 1 : si === 0)) spawnPickup();
  for (const id of ['lose', 'pause']) $(id).classList.add('hidden');
  const first = ents.find((e) => e.starred);
  if (first) { const v = new THREE.Vector3(first.body.position.x, first.body.position.y, first.body.position.z).project(camera); aimN.set(v.x, v.y); }
  if (si > 0) { banner(`Stage ${si + 1} of ${L.stages.length}`, `+${L.stages[si].ammo} chanclas`); sfx.sfxReload(); }
  updateHud();
}

// ───────────────────────── launcher: the gold chancla button fires from the bottom centre ─────────────────────────
const pmrem = new THREE.PMREMGenerator(renderer);
const goldEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const relicGold = new THREE.MeshStandardMaterial({ color: 0xffcc45, metalness: 0.92, roughness: 0.2, emissive: 0x6a3c00, emissiveIntensity: 0.5, envMap: goldEnv, envMapIntensity: 1.35 });
const relicStrap = new THREE.MeshStandardMaterial({ color: 0xf2b020, metalness: 0.85, roughness: 0.26, emissive: 0x4a2a00, emissiveIntensity: 0.45, envMap: goldEnv, envMapIntensity: 1.2 });
function goldChancla(): THREE.Group {
  const g = makeChancla();
  g.children.forEach((c, i) => { (c as THREE.Mesh).material = i === 0 ? relicGold : relicStrap; });
  return g;
}
function radialTex(size: number, draw: (g: CanvasRenderingContext2D, r: number) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d')!; g.translate(size / 2, size / 2); draw(g, size / 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const haloTex = radialTex(256, (g, r) => {
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, 'rgba(255,244,190,1)'); gr.addColorStop(0.25, 'rgba(255,214,90,.7)'); gr.addColorStop(0.6, 'rgba(255,150,20,.2)'); gr.addColorStop(1, 'rgba(255,140,0,0)');
  g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
});
const sparkTex = radialTex(64, (g, r) => {
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.5); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
  g.fillStyle = 'rgba(255,250,220,.95)';
  for (const rot of [0, Math.PI / 2]) { g.save(); g.rotate(rot); g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.09, 0, 0, r); g.quadraticCurveTo(-r * 0.09, 0, 0, -r); g.fill(); g.restore(); }
});
const addMat = (map: THREE.Texture, opacity: number) => new THREE.SpriteMaterial({ map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const texLoader = new THREE.TextureLoader();
const iconTex = (() => { const t = texLoader.load('/crash/chancla-btn.webp'); t.colorSpace = THREE.SRGBColorSpace; return t; })();

// throws start just above the bottom edge, centred
const launch = new THREE.Vector3();
function placeLauncher(): void { const tall = camera.aspect < 0.6; launch.set(0, tall ? 1.18 : 1.25, tall ? 3.35 : 3.1); }
function handPos(out: THREE.Vector3): THREE.Vector3 { return out.copy(launch); }

// level 1 waits for TAP TO PLAY; later levels start straight away
let started = false;
function beginIntro(): void {
  if (started) { state = 'play'; return; }
  state = 'intro';
  $('start').classList.remove('hidden'); $('hint').classList.add('gone');
}
function startGame(): void {
  if (state !== 'intro') return;
  started = true; markFirstAction('crash', 'start');
  $('start').classList.add('hidden');
  state = 'play'; if (!firedOnce) $('hint').classList.remove('gone');
  sfx.sfxReload(); sfx.buzz(10);
}

// ── RAPID FIRE power-up: a glowing gold chancla pickup floats over some stages (hit it), or land a TRIPLE ──
const RAPID_S = 5, RAPID_MS = 280;
let rapidOn = false, rapidEnd = 0, rapidEarned = false, lastRapidShot = 0, holding = false;
interface Pickup { g: THREE.Group; icon: THREE.Sprite; halo: THREE.Sprite; ring: THREE.Mesh; sparks: THREE.Sprite[]; body: CANNON.Body; taken: number; base: THREE.Vector3 }
let pickup: Pickup | null = null;
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, fog: false });
function spawnPickup(): void {
  const st = ents.filter((e) => e.starred); if (!st.length) return;
  const cx = st.reduce((n, e) => n + e.body.position.x, 0) / st.length, cz = st.reduce((n, e) => n + e.body.position.z, 0) / st.length;
  const top = Math.max(...ents.map((e) => e.body.position.y)) + 1.0;
  const base = new THREE.Vector3(Math.max(-2.2, Math.min(2.2, cx + (levelIdx % 2 ? 1.2 : -1.2))), Math.min(4.4, top + 0.4), cz + 0.6);
  const g = new THREE.Group(); g.position.copy(base);
  const halo = new THREE.Sprite(addMat(haloTex, 0.9)); halo.scale.setScalar(1.6); g.add(halo);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex, transparent: true, fog: false, depthWrite: false })); icon.scale.set(0.9, 0.9 * 144 / 256, 1); icon.renderOrder = 4; g.add(icon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), ringMat); g.add(ring);
  const sparks = Array.from({ length: 6 }, () => { const sp = new THREE.Sprite(addMat(sparkTex, 1)); sp.renderOrder = 5; g.add(sp); return sp; });
  levelGroup.add(g);
  const body = new CANNON.Body({ mass: 0, collisionResponse: false, shape: new CANNON.Sphere(0.6), position: new CANNON.Vec3(base.x, base.y, base.z) });
  world.addBody(body);
  const pk: Pickup = { g, icon, halo, ring, sparks, body, taken: 0, base };
  body.addEventListener('collide', (ev: { body: CANNON.Body }) => { if (!pk.taken && projs.some((q) => q.body === ev.body)) { pk.taken = performance.now(); removeQ2.push(pk.body); startRapid(); debris.burst(pk.base.clone(), 40, [0xffd23f, 0xfff2a8, 0xff8c1a, 0xffffff], 6, 0.07); popup('RAPID!', pk.base.clone(), true); } });
  pickup = pk;
}
const removeQ2: CANNON.Body[] = [];
function animatePickup(now: number, s: number): void {
  const pk = pickup; if (!pk) return;
  if (pk.taken) {
    const k = Math.min(1, (now - pk.taken) / 350);
    pk.g.scale.setScalar(1 + k * 0.8); (pk.halo.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - k); (pk.icon.material as THREE.SpriteMaterial).opacity = 1 - k; ringMat.opacity = 0.9 * (1 - k);
    if (k >= 1) { levelGroup.remove(pk.g); pickup = null; ringMat.opacity = 0.9; }
    return;
  }
  pk.g.position.set(pk.base.x, pk.base.y + Math.sin(s * 2.2) * 0.12, pk.base.z);
  pk.icon.material.rotation = Math.sin(s * 1.8) * 0.25;
  pk.halo.scale.setScalar(1.5 + Math.sin(s * 4) * 0.12);
  pk.ring.rotation.set(Math.sin(s * 0.9) * 0.6, s * 2.2, 0);
  pk.sparks.forEach((sp, i) => { const a = s * 1.6 + (i / pk.sparks.length) * Math.PI * 2, tw = Math.max(0, Math.sin(s * 5 + i * 1.7)); sp.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.45, 0.05); sp.scale.setScalar(0.22 * tw); });
}
function startRapid(): void {
  if (state !== 'play') return;
  rapidEnd = world.time + RAPID_S;
  if (!rapidOn) { rapidOn = true; combo('RAPID FIRE!', 4); sfx.sfxRapid(); sfx.buzz([20, 30, 20, 30, 40]); }
  $('rapid').classList.remove('hidden'); fireBtn.classList.add('rapid'); updateHud();
}
function endRapid(silent = false): void {
  if (!rapidOn) return;
  rapidOn = false; holding = false;
  $('rapid').classList.add('hidden'); fireBtn.classList.remove('rapid');
  if (!silent) sfx.sfxRapidEnd();
  updateHud();
}
function tickRapid(now: number): void {
  if (!rapidOn) return;
  const left = Math.max(0, rapidEnd - world.time);
  ($('rapid') as HTMLElement).style.setProperty('--p', String(left / RAPID_S));
  fireBtn.style.setProperty('--p', String(left / RAPID_S));
  $('rapidT').textContent = left.toFixed(1);
  if (left <= 0 || state !== 'play') { endRapid(state !== 'play'); return; }
  if (holding && now - lastRapidShot >= RAPID_MS) fire();
}

// ───────────────────────── aiming ─────────────────────────
const aimN = new THREE.Vector2(0, 0.1);
const ray = new THREE.Raycaster();
const aimPt = new THREE.Vector3();
const DOTS = 44;
const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DOTS * 3), 3));
const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ map: dotTex(), size: 0.2, sizeAttenuation: true, transparent: true, depthTest: false, depthWrite: false, fog: false }));
dots.renderOrder = 10; dots.frustumCulled = false; scene.add(dots);
const reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTex(), depthTest: false, depthWrite: false, transparent: true, fog: false }));
reticle.renderOrder = 11; reticle.scale.setScalar(0.7); scene.add(reticle);
const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 8);

function solveAim(): void {
  ray.setFromCamera(aimN, camera);
  const hits = ray.intersectObjects(aimables, true);
  if (hits.length) aimPt.copy(hits[0].point);
  else if (!ray.ray.intersectPlane(zPlane, aimPt)) aimPt.set(0, 2, -8);
}
function launchVel(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
  const dist = Math.hypot(dx, dz);
  const T = Math.min(1.2, Math.max(0.5, dist / 15 + Math.max(0, dy) * 0.03));
  return out.set(dx / T, (dy + 0.5 * G * T * T) / T, dz / T);
}
const tmpV = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(), hand = new THREE.Vector3();
function drawAim(): void {
  solveAim();
  handPos(hand);
  launchVel(hand, aimPt, tmpV);
  const T = Math.min(1.2, Math.max(0.5, Math.hypot(aimPt.x - hand.x, aimPt.z - hand.z) / 15 + Math.max(0, aimPt.y - hand.y) * 0.03));
  const pos = dotGeo.attributes.position as THREE.BufferAttribute;
  tmpP.copy(hand); const v = tmpV.clone();
  let bounced = false, t = 0, n = 0; const dt = T / 30; let endT = T;
  let skip = 2; // first dots hide behind the thrower
  while (n < DOTS && t < endT) {
    v.y -= G * dt; tmpP.addScaledVector(v, dt); t += dt;
    if (!bounced) for (const d of defls) {
      tmpL.copy(tmpP).sub(d.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -d.yaw);
      const px = d.half.x + 0.2 - Math.abs(tmpL.x), py = d.half.y + 0.1 - Math.abs(tmpL.y), pz = d.half.z + 0.2 - Math.abs(tmpL.z);
      if (px > 0 && py > 0 && pz > 0) {
        const nl = px < pz ? new THREE.Vector3(Math.sign(tmpL.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(tmpL.z));
        nl.applyAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw);
        const vn = v.dot(nl); if (vn < 0) { v.addScaledVector(nl, -1.92 * vn); bounced = true; endT = t + 0.55; }
      }
    }
    if (tmpP.y < 0) break;
    if (skip-- > 0) continue;
    if (n % 1 === 0) pos.setXYZ(n++, tmpP.x, tmpP.y, tmpP.z);
  }
  for (let i = n; i < DOTS; i++) pos.setXYZ(i, 0, -100, 0);
  pos.needsUpdate = true; dotGeo.setDrawRange(0, n);
  reticle.position.copy(bounced ? tmpP : aimPt);
}

// input: drag anywhere on the stage (not on buttons) to steer the reticle; it never throws
let dragging = false, dragId = -1, lastX = 0, lastY = 0, moved = 0, firstAim = true;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  if (state === 'intro') { wakeAudio(); sfx.unlockCrashAudio(); startGame(); return; }
  if (state !== 'play') return;
  dragging = true; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; moved = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== dragId) return;
  const r = stage.getBoundingClientRect();
  const k = isTouch ? 2.3 : 2.0;
  aimN.x = Math.max(-0.98, Math.min(0.98, aimN.x + ((e.clientX - lastX) / r.width) * k));
  aimN.y = Math.max(-0.45, Math.min(0.95, aimN.y - ((e.clientY - lastY) / r.height) * k));
  moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
  lastX = e.clientX; lastY = e.clientY;
  if (firstAim && moved > 20) { firstAim = false; }
});
const endDrag = (e: PointerEvent) => {
  if (!dragging || e.pointerId !== dragId) return;
  dragging = false; // dragging only aims; throws come from the gold chancla button (or Space / Enter)
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === dragId) dragging = false; });
const fireBtn = $('fire') as HTMLButtonElement;
fireBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); wakeAudio(); sfx.unlockCrashAudio();
  fireBtn.classList.add('press'); setTimeout(() => fireBtn.classList.remove('press'), 160);
  holding = true; try { fireBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  if (state === 'intro') startGame(); else fire();
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) fireBtn.addEventListener(ev, () => { holding = false; });
addEventListener('blur', () => { holding = false; });
$('start').addEventListener('click', (e) => { e.stopPropagation(); wakeAudio(); sfx.unlockCrashAudio(); startGame(); });
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (state === 'intro') startGame(); else if (state === 'play') fire(); else if (state === 'won') ($('continue') as HTMLButtonElement).click(); else if (state === 'lost') ($('retry') as HTMLButtonElement).click(); }
  const step = e.shiftKey ? 0.01 : 0.03;
  if (e.code === 'ArrowLeft') aimN.x = Math.max(-0.98, aimN.x - step);
  if (e.code === 'ArrowRight') aimN.x = Math.min(0.98, aimN.x + step);
  if (e.code === 'ArrowUp') aimN.y = Math.min(0.95, aimN.y + step);
  if (e.code === 'ArrowDown') aimN.y = Math.max(-0.45, aimN.y - step);
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'play' || state === 'lost')) loadStage(stageIdx, true);
});
for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) addEventListener(ev, () => sfx.unlockCrashAudio(), { capture: true, passive: true });

// ───────────────────────── throwing ─────────────────────────
const chanclaProto = goldChancla();
let firedOnce = false;
// one chancla in the air at a time (except during RAPID FIRE): the button stays dimmed until it lands (or ~1.3 s)
// measured in physics time so slow devices (where the sim runs behind the wall clock) still wait for the chancla to land
let lastShotSim = -1e9;
function busy(): boolean { if (rapidOn) return false; const t = world.time; return t - lastShotSim < 0.45 || projs.some((p) => !p.hit && t - p.bornSim < 1.3); }
function fire(): void {
  if (state !== 'play') return;
  const now = performance.now();
  if (rapidOn) {
    if (now - lastRapidShot < RAPID_MS) return;
    lastRapidShot = now; lastShotAt = now; lastShotSim = world.time;
    if (!firedOnce) { firedOnce = true; $('hint').classList.add('gone'); }
    release(true); return;
  }
  if (ammo <= 0 || busy()) return;
  if (!firedOnce) { firedOnce = true; markFirstAction('crash', 'throw'); $('hint').classList.add('gone'); }
  ammo--; shotsFired++; comboShot++; comboCount = 0; lastShotAt = now; lastShotSim = world.time;
  updateHud();
  release(false);
}
function release(rapid: boolean): void {
  solveAim(); handPos(hand);
  const tgt = aimPt.clone();
  if (rapid) { tgt.x += (Math.random() - 0.5) * 0.5; tgt.y += (Math.random() - 0.5) * 0.3; }
  const v = launchVel(hand, tgt, new THREE.Vector3());
  const obj = chanclaProto.clone(); obj.scale.setScalar(1.0); levelGroup.add(obj); FX.glow(obj, 1.25, 0.5);
  const body = new CANNON.Body({ mass: 5, material: mProj, shape: new CANNON.Sphere(0.3), position: new CANNON.Vec3(hand.x, hand.y, hand.z), linearDamping: 0.0, angularDamping: 0.4 });
  body.allowSleep = false;
  body.velocity.set(v.x, v.y, v.z);
  obj.userData.spin = 0; obj.userData.yaw = Math.atan2(v.x, v.z);
  obj.position.copy(hand);
  world.addBody(body);
  const p: Proj = { body, obj, born: performance.now(), bornSim: world.time, hit: false };
  body.addEventListener('collide', (ev: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
    const iv = Math.abs(ev.contact.getImpactVelocityAlongNormal());
    if (!p.hit && iv > 2) { p.hit = true; sfx.sfxThwack(iv / 14); sfx.sfxImpact(iv / 12); sfx.buzz(25); shake = Math.min(0.35, shake + iv * 0.012);
      const at = new THREE.Vector3(body.position.x, body.position.y, body.position.z); fx.ring(at, 0.6 + Math.min(0.8, iv * 0.06)); fx.sparks(at, 12 + Math.min(14, Math.round(iv))); }
  });
  projs.push(p);
  if (rapid) { sfx.sfxRapidShot(); sfx.buzz(8); } else { sfx.sfxFire(); sfx.sfxWhoosh(); sfx.buzz(15); setTimeout(() => { if (ammo > 0 && state === 'play') sfx.sfxReload(); }, 450); }
}

// ───────────────────────── hits, breaks, scoring ─────────────────────────
function onHit(e: Ent, ev: { body: CANNON.Body; contact: CANNON.ContactEquation }): void {
  if (e.done && e.kind !== 'crate') { /* still make noise */ }
  const iv = Math.abs(ev.contact.getImpactVelocityAlongNormal());
  if (iv < 1.2) return;
  const pan = Math.max(-1, Math.min(1, e.body.position.x / 4));
  const s = Math.min(1, iv / 9);
  if (e.kind === 'crate' || e.kind === 'post' || e.kind === 'plank') sfx.sfxWood(s, pan);
  else if (e.kind === 'skel') sfx.sfxRattle(pan);
  else if (e.kind === 'candle') sfx.sfxTink(pan);
  else if (e.kind === 'skull' || e.kind === 'jar' || e.kind === 'cafe') sfx.sfxWood(s * 0.7, pan);
  else if (e.kind === 'concha') sfx.sfxSquish(s);
  const fromProj = projs.some((p) => p.body === ev.body);
  if (iv >= e.shatter || (fromProj && iv >= e.shatter * 0.6)) { if (!removeQ.includes(e.body)) removeQ.push(e.body); }
}
function breakEnt(e: Ent): void {
  const p = e.body.position, pan = Math.max(-1, Math.min(1, p.x / 4));
  world.removeBody(e.body); levelGroup.remove(e.obj);
  aimables = aimables.filter((o) => o !== e.obj);
  const at = new THREE.Vector3(p.x, p.y, p.z);
  if (e.kind === 'jar') { sfx.sfxClay(pan); debris.burst(at, 22, [0xc8622f, 0xa64e22, 0xf6efe2], 5, 0.11); }
  if (e.kind === 'skull') { sfx.sfxClay(pan); debris.burst(at, 30, [0xf6efe2, 0xffffff, 0xe2197a, 0xffd23f, 0x1ec8c8], 6, 0.14); }
  if (e.kind === 'concha') { sfx.sfxSquish(); debris.burst(at, 26, [0xd99550, 0xffb3cf, 0xffe07a, 0xf6efe2], 5, 0.09); }
  if (e.kind === 'cafe') { sfx.sfxClay(pan); debris.burst(at, 24, [0xc8622f, 0xa64e22, 0x3a1a0c, 0x3a1a0c, 0xf6efe2], 5.5, 0.1); }
  if (e.kind === 'pinata') { sfx.sfxPinata(pan); pinatas++; debris.burst(at, 46, [0xff3d9a, 0xffd23f, 0x1ec8c8, 0xff8c1a, 0x8a3cff, 0x3cc85a], 7, 0.09); }
  sfx.buzz(30);
  shake = Math.min(0.4, shake + 0.12);
  if (!e.done) markDown(e);
}
function markDown(e: Ent): void {
  e.done = true;
  const pts = e.pts;
  levelScore += pts;
  const p = e.body.position;
  { const at = new THREE.Vector3(p.x, p.y + 0.25, p.z); fx.sparks(at, 16, 0xffd36b, 4); fx.sparks(at, 10, 0xff8c1a, 3.2, 3); fx.ring(at, e.starred ? 1.5 : 1.0); sfx.sfxShimmer(e.starred ? 1 : 0.6); if (!rapidOn) hitStop.stop(e.starred ? 90 : 45); }
  popup(`+${pts}`, new THREE.Vector3(p.x, p.y + 0.6, p.z), e.starred);
  if (e.kind === 'skel') { sfx.sfxRattle(); debris.burst(new THREE.Vector3(p.x, p.y + 0.3, p.z), 8, [0xf3ead8, 0xcfc2a8], 3, 0.07); }
  if (e.critter) { e.critter.setMood('dizzy'); sfx.sfxSquish(); }
  comboCount++;
  sfx.sfxPoint(comboCount);
  if (comboCount === 2) combo('DOUBLE!', 1); else if (comboCount === 3) { if (!rapidOn && !rapidEarned && state === 'play') { rapidEarned = true; startRapid(); } else combo('TRIPLE!', 2); } else if (comboCount === 5) combo('MEGA!', 3); else if (comboCount === 8) combo('¡CHANCLAZO!', 4);
  if (e.starred) {
    starredDown++;
    sfx.buzz(20);
    if (starredDown >= starredTotal && state === 'play') {
      slowUntil = performance.now() + 700; timeScale = 0.3;
      if (stageIdx + 1 < LEVELS[levelIdx].stages.length) {
        state = 'stageclear'; combo('STAGE CLEAR!', 2);
        setTimeout(() => { if (state === 'stageclear') loadStage(stageIdx + 1); }, 1900);
      } else { state = 'winning'; setTimeout(showVictory, 1500); }
    }
  }
  updateHud();
}

function tearPapel(pp: Papel): void {
  world.removeBody(pp.body);
  const at = new THREE.Vector3(); pp.g.getWorldPosition(at); at.y -= 0.3;
  pp.g.children.forEach((c, i) => { if (i > 0) { c.userData.fall = 1; c.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 1.5); } });
  pp.g.userData.torn = performance.now();
  debris.burst(at, 30, PAPEL_COLORS, 4, 0.08);
  sfx.sfxPaper(); sfx.buzz(15);
  levelScore += 15; popup('+15', at, false);
}

// ───────────────────────── debris (instanced, cheap) ─────────────────────────
const debris = (() => {
  const N = 400;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = true;
  scene.add(mesh);
  const P = Array.from({ length: N }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0.1 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  let next = 0;
  for (let i = 0; i < N; i++) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.setHex(0xffffff)); }
  return {
    burst(at: THREE.Vector3, n: number, colors: number[], speed: number, size: number) {
      for (let k = 0; k < n; k++) {
        const d = P[next]; mesh.setColorAt(next, col.setHex(colors[k % colors.length])); next = (next + 1) % N;
        d.life = d.max = 1.1 + Math.random() * 0.7; d.p.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4));
        d.v.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.9 + 1.5, (Math.random() - 0.5) * speed);
        d.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12); d.s = size * (0.6 + Math.random() * 0.8);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    update(dt: number) {
      for (let i = 0; i < N; i++) {
        const d = P[i];
        if (d.life <= 0) continue;
        d.life -= dt; d.v.y -= G * dt; d.p.addScaledVector(d.v, dt);
        let floorY = 0;
        for (const s of statics) if (d.p.x > s.min.x && d.p.x < s.max.x && d.p.z > s.min.z && d.p.z < s.max.z && d.p.y > s.max.y - 0.3) floorY = Math.max(floorY, s.max.y);
        if (d.p.y < floorY + d.s / 2) { d.p.y = floorY + d.s / 2; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
        d.r.x += d.w.x * dt; d.r.y += d.w.y * dt; d.r.z += d.w.z * dt;
        const k = d.life <= 0 ? 0 : Math.min(1, d.life / 0.35) * d.s;
        m4.compose(d.p, q.setFromEuler(d.r), sc.set(k, k, k)); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { for (const d of P) d.life = 0; for (let i = 0; i < N; i++) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); } mesh.instanceMatrix.needsUpdate = true; },
  };
})();

// ───────────────────────── HUD / overlays ─────────────────────────
function updateHud(): void {
  $('lvl').textContent = `Level ${levelIdx + 1}`;
  const nS = LEVELS[levelIdx].stages.length;
  ($('bar') as HTMLElement).style.width = `${((stageIdx + (starredTotal ? starredDown / starredTotal : 0)) / nS) * 100}%`;
  $('stg').textContent = `Stage ${stageIdx + 1}/${nS}`;
  $('coins').textContent = String(save.coins);
  ($('fire') as HTMLButtonElement).disabled = ammo <= 0 && !rapidOn;
  $('fireN').textContent = rapidOn ? '∞' : String(ammo);
}
const proj = new THREE.Vector3();
function toScreen(p: THREE.Vector3): [number, number] { proj.copy(p).project(camera); return [(proj.x * 0.5 + 0.5) * stage.clientWidth, (-proj.y * 0.5 + 0.5) * stage.clientHeight]; }
function popup(text: string, at: THREE.Vector3, big: boolean): void {
  const [x, y] = toScreen(at);
  const d = document.createElement('div'); d.className = 'pop' + (big ? ' big' : ''); d.textContent = text;
  d.style.left = `${x}px`; d.style.top = `${y}px`; $('fx').appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
function combo(text: string, lvl: number): void {
  const d = $('combo'); d.textContent = text; d.className = 'combo show l' + lvl; void d.offsetWidth;
  sfx.sfxCombo(lvl); sfx.buzz([25, 40, 25]);
  clearTimeout((d as unknown as { _t: number })._t); (d as unknown as { _t: number })._t = window.setTimeout(() => (d.className = 'combo'), 1100);
  const p = ents.find((e) => e.done)?.body.position;
  if (p) debris.burst(new THREE.Vector3(p.x, p.y + 1, p.z), 16 + lvl * 8, [0xffd23f, 0xfff2a8, 0xff8c1a], 6, 0.06);
}
function banner(a: string, b: string): void {
  const el = $('banner'); el.innerHTML = `<b>${a}</b><span>${b}</span>`; el.className = 'banner'; void el.offsetWidth; el.className = 'banner show';
}

function starsFor(): number { const r = shotsFired / Math.max(1, levelAmmoTotal); return r <= 0.6 ? 3 : r <= 0.85 ? 2 : 1; }
function showVictory(): void {
  if (state !== 'winning') return;
  state = 'won';
  const st = starsFor();
  const earned = Math.round(levelScore / 2) + st * 10 + ammo * 15 + pinatas * 10;
  save.coins += earned; save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, st);
  save.level = Math.max(save.level, levelIdx + 1); persist();
  track('level_complete', { game: 'crash', level: levelIdx + 1, stars: st, shots: shotsFired });
  $('vTitle').textContent = st === 3 ? 'PERFECT!' : st === 2 ? 'GREAT!' : 'PHEW!';
  $('vSub').textContent = `Level ${levelIdx + 1} · ${LEVELS[levelIdx].name}`;
  const sEl = $('vStars'); sEl.innerHTML = '';
  for (let i = 0; i < 3; i++) { const s = document.createElement('span'); s.textContent = '★'; s.className = 'st'; sEl.appendChild(s); if (i < st) setTimeout(() => { s.classList.add('on'); sfx.sfxStar(i); sfx.buzz(18); }, 350 + i * 260); }
  $('vCoins').textContent = `+${earned}`;
  $('vAmmo').textContent = ammo ? `${ammo} chancla${ammo > 1 ? 's' : ''} left` : '';
  ($('continue') as HTMLButtonElement).textContent = levelIdx + 1 >= LEVELS.length ? 'FINISH' : 'CONTINUE';
  $('victory').classList.remove('hidden');
  sfx.sfxWin(); sfx.buzz([30, 60, 30, 60, 60]);
  startPetals(); updateHud();
}
function showLose(): void {
  state = 'lost';
  $('lose').classList.remove('hidden');
  const left = starredTotal - starredDown;
  $('lSub').textContent = `${left} ${left === 1 ? 'snack is' : 'snacks are'} still standing. Retry this stage.`;
  sfx.sfxLose(); sfx.buzz([60, 80, 120]);
  track('level_fail', { game: 'crash', level: levelIdx + 1 });
}
function showFinal(): void {
  state = 'final';
  $('victory').classList.add('hidden');
  const total = save.stars.reduce((a, b) => a + (b || 0), 0);
  $('fStars').textContent = `${total} / ${LEVELS.length * 3} ★`;
  $('fCoins').textContent = String(save.coins);
  const text = `I cleared all ${LEVELS.length} levels of Chancla Crash with ${total} stars. The gold chancla never misses.`;
  ($('share') as HTMLAnchorElement).href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://chanclazo.com/crash')}&via=ChanclaStrike`;
  $('final').classList.remove('hidden');
  startPetals();
  track('game_complete', { game: 'crash', stars: total });
}
$('continue').addEventListener('click', () => { sfx.sfxClick(); stopPetals(); if (levelIdx + 1 >= LEVELS.length) showFinal(); else loadLevel(levelIdx + 1); });
$('retry').addEventListener('click', () => { sfx.sfxClick(); loadStage(stageIdx, true); });
$('again').addEventListener('click', () => { sfx.sfxClick(); save.level = 0; persist(); loadLevel(0); });
$('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
$('resume').addEventListener('click', () => togglePause());
$('restart').addEventListener('click', () => { loadLevel(levelIdx); });
let pausedFrom: State = 'play';
function togglePause(): void {
  if (state === 'paused') { state = pausedFrom; $('pause').classList.add('hidden'); return; }
  if (state !== 'play' && state !== 'winning') return;
  pausedFrom = state; state = 'paused'; $('pause').classList.remove('hidden'); sfx.sfxClick();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

// marigold petals: fall and fade out well before the bottom (no confetti on the floor)
const petalCv = $('petals') as HTMLCanvasElement;
let petals: { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number; c: string; s: number }[] = [], petalOn = false;
function startPetals(): void {
  petalOn = true; petalCv.width = stage.clientWidth; petalCv.height = stage.clientHeight; petals = [];
  for (let i = 0; i < 70; i++) spawnPetal(true);
}
function stopPetals(): void { petalOn = false; petals = []; const g = petalCv.getContext('2d')!; g.clearRect(0, 0, petalCv.width, petalCv.height); }
function spawnPetal(initial = false): void {
  const W = petalCv.width;
  petals.push({ x: Math.random() * W, y: initial ? -Math.random() * petalCv.height * 0.5 : -20, vx: (Math.random() - 0.5) * 30, vy: 60 + Math.random() * 70, r: 5 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - 0.5) * 6, c: ['#ff8c1a', '#ffb000', '#ffd23f', '#ff6a00', '#e2197a'][Math.floor(Math.random() * 5)], s: Math.random() * 6 });
}
function drawPetals(dt: number): void {
  if (!petalOn) return;
  const g = petalCv.getContext('2d')!, H = petalCv.height, fadeEnd = H * 0.62;
  g.clearRect(0, 0, petalCv.width, H);
  for (const p of petals) {
    p.s += dt; p.x += (p.vx + Math.sin(p.s * 2) * 40) * dt; p.y += p.vy * dt; p.a += p.va * dt;
    const alpha = Math.max(0, Math.min(1, 1 - p.y / fadeEnd));
    if (alpha <= 0) continue;
    g.save(); g.globalAlpha = alpha; g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c;
    g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  petals = petals.filter((p) => p.y < fadeEnd);
  while (petals.length < 60) spawnPetal();
}

// ───────────────────────── main loop ─────────────────────────
world.addEventListener('preStep', () => {
  const t = world.time + FIXED;
  for (const m of movers) {
    const target = (m.axis === 'x' ? m.base.x : m.base.z) + m.amp * Math.sin(m.w * t + m.ph);
    m.body.velocity[m.axis] = (target - m.body.position[m.axis]) / FIXED;
  }
  for (const e of ents) if (e.rider) {
    if (e.body.sleepState !== CANNON.Body.SLEEPING) { releaseRider(e); continue; }
    const m = e.rider, d = m.body.velocity[m.axis] * FIXED;
    e.body.position[m.axis] += d; e.body.aabbNeedsUpdate = true;
  }
});
const up = new THREE.Vector3(), q3 = new THREE.Quaternion();
let fireState = '';
let prev = performance.now(), fpsAcc = 0, fpsN = 0, lowFps = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.05, (now - prev) / 1000); prev = now;
  // auto quality: drop shadows + resolution if we're struggling
  fpsAcc += dtReal; fpsN++;
  if (fpsAcc > 2) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 45 && ++lowFps >= 2 && renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); resize(); report('quality: low'); } }
  if (slowUntil && now > slowUntil) { slowUntil = 0; timeScale = 1; }
  const dt = state === 'paused' ? 0 : dtReal * timeScale * hitStop.scale();
  if (dt > 0) world.step(FIXED, dt, 10);
  while (tearQ.length) tearPapel(tearQ.pop()!);
  while (removeQ.length) { const b = removeQ.pop()!; const e = ents.find((x) => x.body === b); if (e && world.bodies.includes(b)) breakEnt(e); }
  for (const m of movers) m.obj.position.set(m.body.position.x, m.body.position.y, m.body.position.z);
  const s = now / 1000;
  for (const e of ents) {
    e.obj.position.set(e.body.position.x, e.body.position.y, e.body.position.z);
    e.obj.quaternion.set(e.body.quaternion.x, e.body.quaternion.y, e.body.quaternion.z, e.body.quaternion.w);
    if (e.kind === 'skel' && e.arms && !e.done) { e.arms[0].rotation.z = -2.4 + Math.sin(s * 5 + e.phase) * 0.35; e.arms[1].rotation.z = 2.4 - Math.sin(s * 5 + e.phase + 1) * 0.35; }
    if (e.popT !== undefined) { const k = Math.max(0, Math.min(1, (now - e.popT) / 320)); const b = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); e.obj.scale.setScalar(Math.max(0.001, k >= 1 ? 1 : b)); if (k >= 1) e.popT = undefined; }
    if (e.critter && !e.done) {
      const scared = projs.some((p) => !p.hit && now - p.born < 1500);
      e.critter.setMood(scared ? 'nervous' : e.mood || 'happy');
      const steam = e.obj.userData.steam as THREE.Sprite[] | undefined;
      if (steam) steam.forEach((st) => { const k = ((s * 0.6 + st.userData.k * 0.5) % 1); st.position.y = 0.4 + k * 0.5; st.material.opacity = 0.3 * (1 - k); });
    }
    if (e.flame) { e.flame.scale.set(0.42 + Math.sin(s * 13 + e.phase) * 0.04, 0.55 + Math.sin(s * 9 + e.phase) * 0.06, 1); e.flame.visible = !e.done; }
    if (!e.done && (state === 'play' || state === 'winning')) {
      q3.set(e.body.quaternion.x, e.body.quaternion.y, e.body.quaternion.z, e.body.quaternion.w);
      up.set(0, 1, 0).applyQuaternion(q3);
      const upright = e.kind === 'pinata' || e.kind === 'plank' ? 1 : up.y;
      if (e.body.position.y < e.initY - 0.55 || upright < 0.45) markDown(e);
    }
  }
  for (const p of projs) {
    // sphere collider (predictable bounces); the chancla visual spins flat like a thrown sandal and tumbles after impact
    p.obj.position.set(p.body.position.x, p.body.position.y - 0.05, p.body.position.z);
    if (!p.hit && dt > 0 && Math.random() < 0.6) fx.trail(p.obj.position);
    const sp = p.body.velocity.length();
    p.obj.userData.spin += dt * (p.hit ? sp * 1.2 : 19);
    if (!p.hit) p.obj.rotation.set(0.25, p.obj.userData.yaw + p.obj.userData.spin, 0, 'YXZ');
    else p.obj.rotation.set(Math.min(1.2, sp * 0.1) * Math.sin(p.obj.userData.spin), p.obj.userData.yaw + p.obj.userData.spin * 0.3, 0, 'YXZ');
  }
  if (projs.length) { const b = projs[projs.length - 1].body.position; trace.push([+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)]); if (trace.length > 400) trace.shift(); }
  projs = projs.filter((p) => { if (now - p.born > 7000 || p.body.position.y < -5) { world.removeBody(p.body); levelGroup.remove(p.obj); return false; } return true; });
  debris.update(dt); fx.update(dtReal, camera);
  backdrop?.update(now);
  for (const pp of papels) {
    if (!pp.torn) { pp.g.children.forEach((c, i) => { if (i > 0) c.rotation.x = Math.sin(s * 1.6 + i) * 0.2; }); continue; }
    const age = (now - (pp.g.userData.torn || now)) / 1000;
    pp.g.children.forEach((c, i) => { if (i === 0 || !c.userData.v) return; const v = c.userData.v as THREE.Vector3; v.y -= 4 * dt; c.position.addScaledVector(v, dt); c.rotation.x += dt * 5; c.rotation.z += dt * 3; const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial; m.transparent = true; m.opacity = Math.max(0, 1 - age / 1.2); });
    pp.g.children[0].visible = false;
  }
  // lose: out of chanclas and the dust has settled
  while (removeQ2.length) { const b = removeQ2.pop()!; if (world.bodies.includes(b)) world.removeBody(b); }
  if (state === 'play' && ammo <= 0 && !rapidOn) {
    const since = now - lastShotAt;
    const moving = ents.some((e) => !e.done && e.body.sleepState !== CANNON.Body.SLEEPING && e.body.velocity.lengthSquared() > 0.09 && e.body.allowSleep);
    if ((since > 2600 && !moving) || since > 6500) showLose();
  }
  // aim preview
  const showAim = state === 'play' && (ammo > 0 || rapidOn);
  dots.visible = reticle.visible = showAim;
  if (showAim) { drawAim(); const k = 0.62 + Math.sin(s * 6) * 0.06; reticle.scale.setScalar(k * (1 + aimPt.distanceTo(camera.position) * 0.03)); }
  // thrower + the gold chancla button state
  tickRapid(now); animatePickup(now, s);
  const fb = rapidOn ? 'ready' : state === 'play' && ammo > 0 && !busy() ? 'ready' : (state === 'play' || state === 'intro') && ammo > 0 ? 'busy' : 'off';
  if (fb !== fireState) { fireState = fb; fireBtn.classList.toggle('ready', fb === 'ready'); fireBtn.classList.toggle('busy', fb === 'busy'); }
  // camera shake
  shake = Math.max(0, shake - dtReal * 1.4);
  camera.position.set(CAM_POS.x + (Math.random() - 0.5) * shake * 0.5, CAM_POS.y + (Math.random() - 0.5) * shake * 0.4, CAM_POS.z);
  camera.lookAt(CAM_LOOK);
  drawPetals(dtReal);
  renderer.render(scene, camera);
}

// ───────────────────────── boot ─────────────────────────
addEventListener('resize', resize);
resize();
autoUnlockAudio(); wireMute(); initAudioControls('crash', setMuted);
$('hint').textContent = isTouch ? 'Drag to aim · tap the gold chancla to throw' : 'Drag to aim · click the gold chancla or press Space';
markGameStart('crash');
setWorld(LEVELS[levelIdx].world);
loadLevel(levelIdx);
requestAnimationFrame(frame);

// test / screenshot hooks
(window as unknown as Record<string, unknown>).__crash = {
  level: (n: number) => loadLevel(n - 1),
  stage: (n: number) => loadStage(n - 1, true),
  aimAt(x: number, y: number, z: number) { const v = new THREE.Vector3(x, y, z).project(camera); aimN.set(v.x, v.y); },
  aimAtTarget(i = 0) { const t = ents.filter((e) => e.starred && !e.done)[i] || ents.find((e) => !e.done); if (t) { const v = new THREE.Vector3(t.body.position.x, t.body.position.y, t.body.position.z).project(camera); aimN.set(v.x, v.y); } },
  aimLead(i = 0) {
    const t = ents.filter((e) => e.starred && !e.done)[i]; if (!t) return;
    const p = new THREE.Vector3(t.body.position.x, t.body.position.y, t.body.position.z);
    handPos(hand); const T = Math.min(1.2, Math.max(0.5, Math.hypot(p.x - hand.x, p.z - hand.z) / 15 + Math.max(0, p.y - hand.y) * 0.03));
    const vx = t.rider ? t.rider.body.velocity.x : t.body.velocity.x;
    p.x += vx * T; const v = p.project(camera); aimN.set(v.x, v.y);
  },
  fire,
  start: startGame,
  rapid: () => { startRapid(); return rapidOn; },
  info: () => ({ busy: busy(), rapidOn, rapidLeft: +(rapidEnd - world.time).toFixed(2), pickup: pickup ? pickup.base.toArray().map((n) => +n.toFixed(2)) : null, launch: launch.toArray(), state }),
  hold: (on: boolean) => { holding = on; },
  aimInfo: () => { solveAim(); handPos(hand); const v = launchVel(hand, aimPt, new THREE.Vector3()); return { aimN: [aimN.x, aimN.y], aimPt: aimPt.toArray().map((n) => +n.toFixed(2)), hand: hand.toArray().map((n) => +n.toFixed(2)), v: v.toArray().map((n) => +n.toFixed(2)) }; },
  bodies: () => world.bodies.filter((b) => b.mass === 0).map((b) => ({ p: [b.position.x, b.position.y, b.position.z].map((n) => +n.toFixed(2)), q: [b.quaternion.y, b.quaternion.w].map((n) => +n.toFixed(2)), s: b.shapes.map((sh) => (sh as CANNON.Box).halfExtents ? [(sh as CANNON.Box).halfExtents.x, (sh as CANNON.Box).halfExtents.y, (sh as CANNON.Box).halfExtents.z] : sh.type), resp: b.collisionResponse })),
  trace: () => { const t = trace.slice(); trace.length = 0; return t; },
  state: () => ({ state, level: levelIdx + 1, stage: stageIdx + 1, shots: shotsFired, ammo, starredDown, starredTotal, projs: projs.length, coins: save.coins }),
  targets: () => ents.filter((e) => e.starred && !e.done).map((e) => [e.body.position.x, e.body.position.y, e.body.position.z]),
  pause: (on: boolean) => { if (on !== (state === 'paused')) togglePause(); },
  setTimeScale: (k: number) => { timeScale = k; },
};
