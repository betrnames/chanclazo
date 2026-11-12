// "Player 1 Ready" arcade intro: a short three.js cinematic that plays when a
// game starts. Full cut (~3.6s) the first time in a session; a ~1s version
// after that. Tap to skip. No new paid assets — existing art and synthesised SFX.
import * as THREE from 'three';
import { makeChancla, makeCandle, makePinata, buildBackdrop, glowTex } from './crashArt';
import { unlockCrashAudio, sfxCoin, sfxCount, sfxWhoosh, sfxShimmer, sfxClick } from './crashAudio';

export type IntroGame = 'waves' | 'strike' | 'slots';

const SESSION_KEY = 'cz-p1-intro';
const FULL_MS = 4000;
const SHORT_MS = 1000;

let forceIntro = false;
let seekTo: ((u: number) => void) | null = null;
export function shouldPlayIntro(): boolean {
  if (forceIntro) return true;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (/[?&]intro=1(?:&|$)/.test(location.search)) return true;
  // Playtests and screenshot hooks use ?start=1; ?nointro=1 is an explicit opt-out.
  if (/[?&](start=1|nointro=1)(?:&|$)/.test(location.search)) return false;
  return true;
}
export function isShortIntro(): boolean {
  if (forceIntro) return false;
  if (/[?&]intro=1(?:&|$)/.test(location.search)) return false;
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function markSeen(): void {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* private mode */ }
}

function smooth(t: number): number { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function vlerp(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
}

const STYLE = `
#p1intro{position:fixed;inset:0;z-index:200;background:#06021a;overflow:hidden;touch-action:none;cursor:pointer}
#p1intro canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
#p1intro .p1-ui{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:LilitaOne,system-ui,sans-serif}
#p1intro .p1-ready{font-weight:400;font-size:clamp(36px,11vw,72px);line-height:.95;letter-spacing:.04em;color:#ffd23f;text-align:center;
  -webkit-text-stroke:8px #3b1a5c;paint-order:stroke fill;text-shadow:0 6px 0 #3b1a5c,0 0 28px rgba(255,140,26,.85);
  opacity:0;transform:scale(.7) rotate(-4deg);transition:opacity .18s,transform .28s cubic-bezier(.2,1.6,.4,1)}
#p1intro .p1-ready.on{opacity:1;transform:none}
#p1intro .p1-count{margin-top:10px;font-weight:400;font-size:clamp(64px,22vw,140px);line-height:1;color:#fff;
  -webkit-text-stroke:10px #3b1a5c;paint-order:stroke fill;text-shadow:0 8px 0 #3b1a5c,0 0 30px rgba(255,210,63,.7);
  opacity:0;transform:scale(1.4);transition:none}
#p1intro .p1-count.on{opacity:1;transform:scale(1);transition:opacity .08s,transform .16s cubic-bezier(.2,1.7,.4,1)}
#p1intro .p1-skip{position:absolute;bottom:calc(14px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;
  font:700 11px system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,233,194,.7);
  text-shadow:0 1px 3px #000;opacity:0;transition:opacity .4s}
#p1intro .p1-skip.on{opacity:1}
#p1intro.fade{opacity:0;transition:opacity .2s linear;pointer-events:none}
@media (prefers-reduced-motion:reduce){#p1intro .p1-ready,#p1intro .p1-count{transition:none}}
`;

function crtCanvas(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#0a0214'; g.fillRect(0, 0, 256, 320);
  return cv;
}
function paintCrt(cv: HTMLCanvasElement, game: IntroGame, t: number, on: number, beat: number): void {
  const g = cv.getContext('2d')!;
  const w = cv.width, h = cv.height;
  g.fillStyle = '#070114'; g.fillRect(0, 0, w, h);
  // turn-on: a bright horizontal line that opens into the picture
  if (on < 0.08) {
    const y = h * 0.5, thick = 2 + on * 80;
    g.fillStyle = `rgba(255,230,160,${0.9 - on * 4})`;
    g.fillRect(0, y - thick / 2, w, thick);
    return;
  }
  const flick = 0.85 + Math.sin(t * 37) * 0.06 + (Math.random() - 0.5) * 0.04;
  const col = game === 'waves' ? '#e2197a' : game === 'slots' ? '#18c8c0' : '#ff8c1a';
  const rad = g.createRadialGradient(w * 0.5, h * 0.7, 10, w * 0.5, h * 0.55, w * 0.85);
  rad.addColorStop(0, col); rad.addColorStop(0.55, '#2a0f3f'); rad.addColorStop(1, '#0d0318');
  g.globalAlpha = Math.min(1, (on - 0.08) / 0.25) * flick;
  g.fillStyle = rad; g.fillRect(0, 0, w, h);
  // sunburst
  g.save(); g.translate(w / 2, h * 0.58); g.rotate(t * 0.4);
  g.fillStyle = 'rgba(255,255,255,.08)';
  for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w, i * 0.2, i * 0.2 + 0.12); g.fill(); }
  g.restore();
  // attract copy
  g.globalAlpha = (0.92 + Math.sin(t * 6) * 0.08) * Math.min(1, on);
  g.fillStyle = '#fff2a8';
  g.font = '700 26px LilitaOne,system-ui,sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = '#2a0f3f'; g.lineWidth = 6; g.lineJoin = 'round';
  const line = game === 'waves' ? 'HOLD THE LINE' : game === 'slots' ? 'SPIN TO WIN' : 'FLING IT';
  g.strokeText(line, w / 2, 36); g.fillText(line, w / 2, 36);
  g.font = 'bold 16px system-ui,sans-serif';
  g.fillStyle = '#fff';
  g.globalAlpha = (Math.sin(t * 8) > 0 ? 0.95 : 0.15) * Math.min(1, on);
  g.fillText('PRESS START', w / 2, h - 28);
  // per-game beat on the CRT
  g.globalAlpha = Math.min(1, beat) * flick;
  if (beat > 0) {
    g.fillStyle = game === 'waves' ? 'rgba(20,4,10,.35)' : 'rgba(10,8,4,.3)';
    g.fillRect(20, 58, w - 40, h - 120);
  }
  // scanlines + vignette
  g.globalAlpha = 0.22 * Math.min(1, on);
  g.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  const vig = g.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vig; g.fillRect(0, 0, w, h);
}

function makeCabinet(game: IntroGame, screenMap: THREE.CanvasTexture): THREE.Group {
  const cab = new THREE.Group();
  const purple = new THREE.MeshLambertMaterial({ color: 0x3a1258 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c0830 });
  const accent = new THREE.MeshLambertMaterial({
    color: game === 'waves' ? 0xff8c1a : game === 'slots' ? 0x18c8c0 : 0xe2197a,
    emissive: game === 'waves' ? 0xff8c1a : game === 'slots' ? 0x18c8c0 : 0xe2197a,
    emissiveIntensity: 0.45,
  });
  const gold = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x5a3a00, emissiveIntensity: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.15, 0.85), purple);
  body.position.y = 1.075; cab.add(body);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), accent); sideL.position.set(-0.64, 1.15, 0.42); cab.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = 0.64; cab.add(sideR);
  // marquee
  const marq = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.38, 0.7), accent);
  marq.position.set(0, 2.32, 0.05); cab.add(marq);
  const title = document.createElement('canvas'); title.width = 512; title.height = 128;
  { const g = title.getContext('2d')!;
    g.fillStyle = game === 'waves' ? '#ff8c1a' : game === 'slots' ? '#18c8c0' : '#e2197a'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#fff'; g.font = '700 54px LilitaOne,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = '#2a0f3f'; g.lineWidth = 12; g.lineJoin = 'round';
    const t = game === 'waves' ? 'DÍA DE LOS MUERTOS' : game === 'slots' ? 'PIÑATA SLOTS' : 'CHANCLA STRIKE';
    g.strokeText(t, 256, 68); g.fillText(t, 256, 68);
  }
  const ttex = new THREE.CanvasTexture(title); ttex.colorSpace = THREE.SRGBColorSpace;
  const frontMarq = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.3), new THREE.MeshBasicMaterial({ map: ttex }));
  frontMarq.position.set(0, 2.32, 0.41); cab.add(frontMarq);
  // bezel + CRT
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.22, 0.08), dark);
  bezel.position.set(0, 1.42, 0.44); cab.add(bezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), new THREE.MeshBasicMaterial({ map: screenMap, toneMapped: false }));
  screen.position.set(0, 1.42, 0.49); cab.add(screen);
  // control shelf
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.55), gold);
  shelf.position.set(0, 0.72, 0.35); cab.add(shelf);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), dark);
  stick.position.set(-0.32, 0.92, 0.42); cab.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), accent);
  ball.position.set(-0.32, 1.04, 0.42); cab.add(ball);
  const btnCols = [0xffd23f, 0x18c8c0, 0xe2197a];
  btnCols.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 }));
    b.position.set(0.08 + i * 0.18, 0.86, 0.48); cab.add(b);
  });
  // kick plate
  const kick = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.7), dark);
  kick.position.set(0, 0.28, 0); cab.add(kick);
  return cab;
}

function makeTarget(): THREE.Group {
  const g = new THREE.Group();
  const rings: [number, number, number][] = [[0.55, 0xffd23f, 0.08], [0.38, 0xe2197a, 0.08], [0.22, 0xff8c1a, 0.08]];
  for (const [r, c, tube] of rings) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 32), new THREE.MeshBasicMaterial({ color: c }));
    g.add(m);
  }
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  g.add(core);
  return g;
}

/**
 * Play the intro, then `onDone`. Safe to call when the intro should be skipped
 * (returns synchronously). Always calls `onDone` exactly once.
 */
export function playPlayer1Intro(game: IntroGame, onDone: () => void): void {
  let finished = false;
  let cleanup: () => void = () => { /* filled in after the scene is built */ };
  const done = (): void => {
    if (finished) return; finished = true;
    cleanup();
    onDone();
  };
  if (!shouldPlayIntro()) { finished = true; onDone(); return; }

  const short = isShortIntro();
  markSeen();
  unlockCrashAudio();

  const host = document.createElement('div');
  host.id = 'p1intro';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-label', 'Player 1 Ready');
  host.innerHTML = `<div class="p1-ui"><div class="p1-ready">PLAYER 1 READY</div><div class="p1-count"></div></div><div class="p1-skip">TAP TO SKIP</div>`;
  const style = document.createElement('style'); style.textContent = STYLE;
  document.head.appendChild(style);
  document.body.appendChild(host);
  const readyEl = host.querySelector('.p1-ready') as HTMLElement;
  const countEl = host.querySelector('.p1-count') as HTMLElement;
  const skipEl = host.querySelector('.p1-skip') as HTMLElement;
  requestAnimationFrame(() => skipEl.classList.add('on'));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x06021a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 200);
  const backdrop = buildBackdrop('plaza');
  scene.add(backdrop.group);
  scene.fog = backdrop.fog; scene.background = backdrop.fog.color;
  const hemi = new THREE.HemisphereLight(0xffe0c0, 0x2a1240, 1.35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd8a8, 1.25); sun.position.set(4, 10, 6); scene.add(sun);
  const glow = new THREE.PointLight(0xffa64d, 8, 14, 1.6); glow.position.set(0, 2.4, 5.2); scene.add(glow);

  // cempasúchil along the street (for the opening pan) and a denser row at the cabinet's feet
  const mari = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshLambertMaterial({ color: 0xff8c1a, emissive: 0x4a1c00, flatShading: true }), 200);
  const m4 = new THREE.Matrix4(); let mi = 0;
  const plant = (x: number, z: number): void => {
    m4.makeTranslation(x, 0.1 + Math.random() * 0.05, z); mari.setMatrixAt(mi++, m4);
  };
  for (let row = 0; row < 3; row++) {
    const z = -2.2 - row * 2.8;
    for (let i = 0; i < 36; i++) plant(-6 + i * (12 / 35), z + (Math.random() - 0.5) * 0.2);
  }
  for (let i = 0; i < 92; i++) {
    const x = -5 + (i % 46) * (10 / 45), z = (i < 46 ? 5.15 : 5.45) + (Math.random() - 0.5) * 0.14;
    plant(x, z);
  }
  mari.count = mi; scene.add(mari);

  const flames: THREE.Sprite[] = [];
  const placeCandle = (x: number, z: number, i: number): void => {
    const c = makeCandle(0.28 + (i % 3) * 0.1, i % 2 ? 0xf7ecd0 : 0xffe0b0);
    c.group.position.set(x, 0, z);
    scene.add(c.group);
    c.flame.userData.phase = i; flames.push(c.flame);
  };
  for (let i = 0; i < 8; i++) placeCandle(-4.4 + i * (8.8 / 7), -3.4, i);
  for (let i = 0; i < 8; i++) placeCandle(-4.4 + i * (8.8 / 7), -6.4, i + 8);
  for (let i = 0; i < 8; i++) placeCandle(-4.2 + i * (8.4 / 7), 5.0, i + 16);

  const crt = crtCanvas();
  const screenMap = new THREE.CanvasTexture(crt); screenMap.colorSpace = THREE.SRGBColorSpace;
  const cab = makeCabinet(game, screenMap);
  // Sit in the foreground for the close-up; behind the opening camera so the first beat is pure street.
  cab.position.set(0, 0, 4.0); cab.rotation.y = 0;
  scene.add(cab);

  const chancla = makeChancla();
  chancla.scale.setScalar(0.92);
  const haloMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd27a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(2.4); chancla.add(halo);
  chancla.visible = false; scene.add(chancla);

  // per-game final beat — parked just right of the CRT, in front of the cabinet, so it stays
  // in the tall-phone frame (narrow horizontal FOV).
  const BEAT_X = 0.50, BEAT_Z = 5.22;
  let beatObj: THREE.Object3D | undefined;
  if (game === 'waves') {
    // luchador silhouette — textured with the chibi if it loads, else a dark cutout
    const sil = new THREE.Group();
    const sprMat = new THREE.SpriteMaterial({ color: 0x120418, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const spr = new THREE.Sprite(sprMat);
    spr.scale.set(1.02, 1.78, 1); spr.position.set(0, 0, 0);
    sil.add(spr);
    sil.position.set(BEAT_X, 1.42, BEAT_Z);
    new THREE.TextureLoader().load('/play/chibi_luchador_crossed.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      sprMat.map = tex; sprMat.color.setHex(0xffffff); sprMat.needsUpdate = true;
    }, undefined, () => { /* keep the solid silhouette */ });
    sil.visible = false; scene.add(sil); beatObj = sil;
  } else if (game === 'slots') {
    const hanger = new THREE.Group();
    hanger.position.set(BEAT_X, 2.85, BEAT_Z);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.05, 6), new THREE.MeshBasicMaterial({ color: 0xffe9c2 }));
    str.position.set(0, -0.52, 0); hanger.add(str);
    const p = makePinata(); p.scale.setScalar(1.25); p.position.set(0, -1.12, 0); hanger.add(p);
    hanger.visible = false; scene.add(hanger); beatObj = hanger;
  } else {
    const tgt = makeTarget(); tgt.position.set(BEAT_X, 1.62, BEAT_Z); tgt.scale.setScalar(0.01);
    tgt.visible = false; scene.add(tgt); beatObj = tgt;
  }

  // Opening: stand in the plaza looking down the cempasúchil-lit street (cabinet is behind us).
  // Mid: pan across the flags and candles. Close: swing around, tilt and zoom onto the cabinet.
  const camA = new THREE.Vector3(-6.5, 4.6, -0.5);
  const lookA = new THREE.Vector3(1.5, 2.2, -12);
  const camB = new THREE.Vector3(7.6, 4.0, -1.2);
  const lookB = new THREE.Vector3(-0.8, 1.7, -9.5);
  const camTurn = new THREE.Vector3(5.8, 3.15, 3.6);
  const lookTurn = new THREE.Vector3(0.15, 1.55, 3.7);
  const camC = new THREE.Vector3(0, 1.86, 8.65);
  const lookC = new THREE.Vector3(0, 1.48, 4.1);
  const tmpC = new THREE.Vector3(), tmpL = new THREE.Vector3();

  function resize(): void {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  const onResize = () => resize();
  addEventListener('resize', onResize);

  const dur = short ? SHORT_MS : FULL_MS;
  host.dataset.short = short ? '1' : '0';
  host.dataset.dur = String(dur);
  // event times as fractions of duration (full and short share the same beats, compressed)
  const T_ZOOM = short ? 0.08 : 0.38;     // start turning toward the cabinet
  const T_CRT = short ? 0.12 : 0.48;      // CRT flickers on
  const T_SHOE = short ? 0.22 : 0.58;     // chancla twirls in
  const T_READY = short ? 0.42 : 0.70;    // PLAYER 1 READY + coin
  const T_3 = short ? 0.58 : 0.79;
  const T_2 = short ? 0.72 : 0.86;
  const T_1 = short ? 0.86 : 0.93;

  let raf = 0, t0 = performance.now();
  let shownReady = false, shoeIn = false, ending = false;
  let lastCount = '';
  // ?introseek=1 (and __p1intro.seek) freeze/scrub the clock for recording and stills.
  const seekMode = /[?&]introseek=1(?:&|$)/.test(location.search);
  let forcedU: number | null = seekMode ? 0 : null;
  seekTo = (u: number): void => { forcedU = Math.max(0, u); };

  const FOV_WIDE = 72, FOV_CLOSE = 54;
  function setCam(u: number): void {
    // Wide street pan, then a two-beat turn + dolly/tilt onto the cabinet so the swing isn't a 180° snap.
    let fov = FOV_WIDE;
    const turnAt = T_ZOOM;
    const turnLen = short ? 0.10 : 0.13;
    const zoomLen = short ? 0.14 : 0.13;
    if (u < turnAt) {
      const k = smooth(turnAt > 0 ? u / turnAt : 1);
      vlerp(camA, camB, k, tmpC); vlerp(lookA, lookB, k, tmpL);
    } else if (u < turnAt + turnLen) {
      const k = smooth((u - turnAt) / turnLen);
      vlerp(camB, camTurn, k, tmpC); vlerp(lookB, lookTurn, k, tmpL);
      fov = lerp(FOV_WIDE, (FOV_WIDE + FOV_CLOSE) * 0.5, k);
    } else {
      const k = smooth(Math.min(1, (u - turnAt - turnLen) / zoomLen));
      vlerp(camTurn, camC, k, tmpC); vlerp(lookTurn, lookC, k, tmpL);
      fov = lerp((FOV_WIDE + FOV_CLOSE) * 0.5, FOV_CLOSE, k);
    }
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.position.copy(tmpC); camera.lookAt(tmpL);
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const u = forcedU != null ? forcedU : Math.min(1.15, (now - t0) / dur);
    const sec = forcedU != null ? forcedU * (dur / 1000) : (now - t0) / 1000;
    host.dataset.u = u.toFixed(3);
    setCam(u);
    backdrop.update(now);
    for (const f of flames) f.scale.set(0.42 + Math.sin(sec * 13 + f.userData.phase) * 0.05, 0.55 + Math.sin(sec * 9 + f.userData.phase) * 0.07, 1);
    glow.intensity = 7 + Math.sin(sec * 4) * 1.6;

    const crtOn = smooth(Math.max(0, (u - T_CRT) / 0.12));
    const beat = smooth(Math.max(0, (u - T_READY) / 0.08));
    paintCrt(crt, game, sec, crtOn, beat);
    screenMap.needsUpdate = true;

    if (u >= T_SHOE) {
      if (!shoeIn) { shoeIn = true; chancla.visible = true; sfxWhoosh(); }
      const k = smooth(Math.min(1, (u - T_SHOE) / (short ? 0.16 : 0.12)));
      // twirl in from above-right, then settle into a gold 3/4 hero pose in front of the upper CRT
      chancla.position.set(lerp(1.8, -0.12, k), lerp(3.4, 2.08, k) + Math.sin(sec * 3.2) * 0.05 * k, lerp(6.2, 5.55, k));
      const twirl = sec * 8.5;
      const restY = 0.85 + Math.sin(sec * 1.7) * 0.14;
      chancla.rotation.set(lerp(1.15, 0.42, k), lerp(twirl, restY, k), Math.sin(sec * 2.2) * 0.14 * (1 - 0.55 * k), 'YXZ');
      haloMat.opacity = 0.35 + Math.sin(sec * 5) * 0.15 + k * 0.25;
    }

    if (beatObj) {
      if (u >= T_READY) {
        beatObj.visible = true;
        if (game === 'slots') {
          beatObj.rotation.z = Math.sin(sec * 4.2) * 0.48;
        } else if (game === 'strike') {
          const k = smooth(Math.min(1, (u - T_READY) / 0.1));
          beatObj.scale.setScalar(0.2 + k * 0.95);
          beatObj.rotation.z = sec * 0.8;
        } else {
          const k = smooth(Math.min(1, (u - T_READY) / 0.12));
          beatObj.traverse((o) => {
            const m = (o as THREE.Sprite).material as THREE.SpriteMaterial | undefined;
            if (m && 'opacity' in m) m.opacity = k;
          });
        }
      }
    }

    if (u >= T_READY && !shownReady) {
      shownReady = true;
      readyEl.classList.add('on');
      sfxCoin();
      sfxShimmer(0.9);
    }
    // Show only the latest due number, once — calling 3 then 2 then 1 every
    // frame after T_1 would restart the fade and leave 2 and 1 at opacity 0.
    let due = '';
    if (u >= T_1) due = '1';
    else if (u >= T_2) due = '2';
    else if (u >= T_3) due = '3';
    if (due && due !== lastCount) {
      lastCount = due;
      countEl.textContent = due;
      countEl.classList.remove('on'); void countEl.offsetWidth; countEl.classList.add('on');
      sfxCount(due === '1' ? 1 : Number(due));
    }

    renderer.render(scene, camera);
    if (u >= 1 && forcedU == null) {
      if (lastCount !== '1') {
        lastCount = '1';
        countEl.textContent = '1';
        countEl.classList.add('on');
        sfxCount(1);
      }
      if (!ending) {
        ending = true;
        // Hold the final '1' on screen briefly, then fade into the game.
        setTimeout(() => {
          host.classList.add('fade');
          setTimeout(done, 200);
        }, short ? 120 : 280);
      }
    }
  }

  cleanup = (): void => {
    if (seekTo) seekTo = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    removeEventListener('resize', onResize);
    host.removeEventListener('pointerdown', onSkip);
    host.removeEventListener('keydown', onKey);
    try {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const mat = m as THREE.MeshBasicMaterial;
            mat.map?.dispose?.();
            mat.dispose?.();
          }
        }
        if ((o as THREE.Sprite).isSprite) {
          const m = (o as THREE.Sprite).material;
          m.map?.dispose?.(); m.dispose?.();
        }
      });
      mari.dispose();
      screenMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    } catch { /* already gone */ }
    host.remove();
    style.remove();
  };

  const onSkip = (e: Event): void => {
    e.preventDefault(); e.stopPropagation();
    sfxClick();
    host.classList.add('fade');
    setTimeout(done, 120);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') onSkip(e);
  };
  host.addEventListener('pointerdown', onSkip);
  host.addEventListener('keydown', onKey);
  host.tabIndex = 0; host.focus({ preventScroll: true });

  raf = requestAnimationFrame((n) => { t0 = n; frame(n); });

  // safety: never hang if rAF stalls (disabled while seeking, so a recording can scrub)
  if (!seekMode) setTimeout(() => { if (!finished) done(); }, dur + 1500);
}

// test / demo hook. `.play` always runs the full intro (clears the session flag).
(window as unknown as { __p1intro: {
  play: (game: IntroGame, onDone?: () => void) => void;
  seek: (u: number) => void;
} }).__p1intro = {
  play(game: IntroGame, onDone?: () => void): void {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* */ }
    document.getElementById('p1intro')?.remove();
    forceIntro = true;
    playPlayer1Intro(game, () => { forceIntro = false; onDone?.(); });
  },
  seek(u: number): void { seekTo?.(u); },
};
