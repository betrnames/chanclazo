// "Player 1 Ready" intro: a larger-than-life luchador fills the frame
// (low camera, looking up), flexes, then the camera pulls out punchily
// to the game start. Full cut (~3.7s) the first time in a session; a ~1s
// version after that. Tap to skip. Existing art and synthesised SFX only.
// No arcade cabinet, no small skeletons, no Abuela, no slingshot.
import * as THREE from 'three';
import { makeChancla, makeCandle, buildBackdrop, glowTex } from './crashArt';
import { unlockCrashAudio, sfxCoin, sfxCount, sfxGo, sfxSlam, sfxWhoosh, sfxShimmer, sfxImpact, sfxClick } from './crashAudio';

export type IntroGame = 'waves' | 'strike' | 'slots';

const SESSION_KEY = 'cz-p1-intro';
const FULL_MS = 3700;
const SHORT_MS = 1100;
const CROSSED_SRC = '/play/chibi_luchador_crossed.webp';
const FLEX_SRC = '/play/chibi_luchador_flex.webp';
// World height of the luchador. Tall enough that a close, low camera
// looking up lets him fill a 390×844 frame; still monumental after the pull-out.
const LUCHA_H = 4.85;

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

function clamp01(t: number): number { return Math.max(0, Math.min(1, t)); }
function smooth(t: number): number { const x = clamp01(t); return x * x * (3 - 2 * x); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function vlerp(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
}
/** Ease-out with a slight overshoot — snappy, not a floaty drift. */
function easeOutBack(t: number): number {
  const x = clamp01(t) - 1;
  const c1 = 1.48;
  return 1 + (c1 + 1) * x * x * x + c1 * x * x;
}

const STYLE = `
#p1intro{position:fixed;inset:0;z-index:200;background:#06021a;overflow:hidden;touch-action:none;cursor:pointer}
#p1intro canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
#p1intro .p1-ui{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;
  justify-content:flex-start;padding-top:8%;font-family:LilitaOne,system-ui,sans-serif;text-align:center}
#p1intro .p1-p1{font-weight:400;font-size:clamp(52px,16vw,108px);line-height:.88;letter-spacing:.06em;color:#ffd23f;
  -webkit-text-stroke:10px #3b1a5c;paint-order:stroke fill;text-shadow:0 8px 0 #3b1a5c,0 0 36px rgba(255,140,26,.95);
  opacity:0;transform:scale(2.15) rotate(-5deg);transition:none}
#p1intro .p1-p1.on{opacity:1;transform:scale(1) rotate(-2deg);transition:opacity .06s,transform .28s cubic-bezier(.15,1.7,.35,1)}
#p1intro .p1-ready{margin-top:4px;font-weight:400;font-size:clamp(36px,11vw,76px);line-height:.95;letter-spacing:.1em;color:#fff2a8;
  -webkit-text-stroke:8px #3b1a5c;paint-order:stroke fill;text-shadow:0 6px 0 #3b1a5c,0 0 24px rgba(255,210,63,.8);
  opacity:0;transform:scale(.55);transition:none}
#p1intro .p1-ready.on{opacity:1;transform:scale(1);transition:opacity .07s,transform .22s cubic-bezier(.2,1.75,.35,1)}
#p1intro .p1-count{margin-top:2px;font-weight:400;font-size:clamp(56px,17vw,120px);line-height:.9;color:#fff;
  -webkit-text-stroke:12px #3b1a5c;paint-order:stroke fill;text-shadow:0 8px 0 #3b1a5c,0 0 34px rgba(255,210,63,.75);
  opacity:0;transform:scale(1.65);transition:none}
#p1intro .p1-count.on{opacity:1;transform:scale(1);transition:opacity .07s,transform .16s cubic-bezier(.15,1.85,.35,1)}
#p1intro .p1-count.go{color:#ffd23f;letter-spacing:.08em;font-size:clamp(56px,17vw,120px)}
#p1intro .p1-flash{position:absolute;inset:0;background:#fff6d4;opacity:0;pointer-events:none;mix-blend-mode:screen}
#p1intro .p1-flash.on{animation:p1flash .32s ease-out forwards}
@keyframes p1flash{0%{opacity:.9}100%{opacity:0}}
#p1intro .p1-skip{position:absolute;bottom:calc(14px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;
  font:700 11px system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,233,194,.7);
  text-shadow:0 1px 3px #000;opacity:0;transition:opacity .4s}
#p1intro .p1-skip.on{opacity:1}
#p1intro.fade{opacity:0;transition:opacity .2s linear;pointer-events:none}
@media (prefers-reduced-motion:reduce){#p1intro .p1-p1,#p1intro .p1-ready,#p1intro .p1-count{transition:none}#p1intro .p1-flash.on{animation:none;opacity:0}}
`;

function loadTex(src: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      resolve(t);
    }, undefined, () => reject(new Error(src)));
  });
}
function aspectOf(t: THREE.Texture): number {
  const img = t.image as { width?: number; height?: number } | undefined;
  const w = img && img.width ? img.width : 302;
  const h = img && img.height ? img.height : 720;
  return w / h;
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
  host.innerHTML = `<div class="p1-flash"></div><div class="p1-ui"><div class="p1-p1">PLAYER 1</div><div class="p1-ready">READY?</div><div class="p1-count"></div></div><div class="p1-skip">TAP TO SKIP</div>`;
  const style = document.createElement('style'); style.textContent = STYLE;
  document.head.appendChild(style);
  document.body.appendChild(host);
  const p1El = host.querySelector('.p1-p1') as HTMLElement;
  const readyEl = host.querySelector('.p1-ready') as HTMLElement;
  const countEl = host.querySelector('.p1-count') as HTMLElement;
  const flashEl = host.querySelector('.p1-flash') as HTMLElement;
  const skipEl = host.querySelector('.p1-skip') as HTMLElement;
  requestAnimationFrame(() => skipEl.classList.add('on'));

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

  // Build the scene once both luchador poses are in memory so the opening close-up is never a blank card.
  let started = false;
  const start = (crossedTex: THREE.Texture, flexTex: THREE.Texture): void => {
    if (finished || started) return;
    started = true;
    buildScene(crossedTex, flexTex);
  };
  Promise.all([loadTex(CROSSED_SRC), loadTex(FLEX_SRC)]).then(
    ([a, b]) => start(a, b),
    () => { if (!finished) done(); },
  );

  function buildScene(crossedTex: THREE.Texture, flexTex: THREE.Texture): void {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x06021a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.insertBefore(renderer.domElement, host.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.08, 200);
    const backdrop = buildBackdrop('plaza');
    scene.add(backdrop.group);
    scene.fog = backdrop.fog; scene.background = backdrop.fog.color;
    const hemi = new THREE.HemisphereLight(0xffe0c0, 0x2a1240, 1.25); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd8a8, 1.15); sun.position.set(4, 10, 6); scene.add(sun);
    // Hero backlight: gold from behind and above, a warm fill on the chest.
    const rim = new THREE.PointLight(0xffb14a, 22, 16, 1.4); rim.position.set(-1.2, 5.6, -2.4); scene.add(rim);
    const fill = new THREE.PointLight(0xffe0a0, 10, 12, 1.6); fill.position.set(1.4, 3.2, 3.6); scene.add(fill);

    // Cempasúchil and candles at his feet — the close-up reads as a Día de los Muertos hero shot,
    // and the wide pull-out still has a ring of marigold under him. No characters but the luchador.
    const mari = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshLambertMaterial({ color: 0xff8c1a, emissive: 0x4a1c00, flatShading: true }), 160);
    const m4 = new THREE.Matrix4(); let mi = 0;
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r = 0.85 + (i % 5) * 0.28 + Math.random() * 0.1;
      m4.makeTranslation(Math.cos(a) * r, 0.1 + Math.random() * 0.06, Math.sin(a) * r * 0.72 + 0.15);
      mari.setMatrixAt(mi++, m4);
    }
    mari.count = mi; scene.add(mari);

    const flames: THREE.Sprite[] = [];
    const placeCandle = (x: number, z: number, i: number): void => {
      const c = makeCandle(0.3 + (i % 3) * 0.1, i % 2 ? 0xf7ecd0 : 0xffe0b0);
      c.group.position.set(x, 0, z);
      scene.add(c.group);
      c.flame.userData.phase = i; flames.push(c.flame);
    };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      placeCandle(Math.cos(a) * 1.55, Math.sin(a) * 1.05 + 0.2, i);
    }

    // Ground pool of gold light + a big backlight bloom behind him.
    const groundGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: 0xffb000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.85,
    }));
    groundGlow.scale.set(4.8, 1.7, 1); groundGlow.position.set(0, 0.15, 0.2); groundGlow.renderOrder = 1;
    scene.add(groundGlow);
    const backGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: 0xffc14a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9,
    }));
    backGlow.scale.set(6.4, 8.2, 1); backGlow.position.set(0, 2.6, -0.55); backGlow.renderOrder = 0;
    scene.add(backGlow);
    const rimGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: 0xff6a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.45,
    }));
    rimGlow.scale.set(3.2, 6.5, 1); rimGlow.position.set(-0.85, 2.8, -0.35); rimGlow.renderOrder = 0;
    scene.add(rimGlow);

    const luchaMat = new THREE.SpriteMaterial({
      map: crossedTex, transparent: true, depthWrite: false, depthTest: true, fog: false, color: 0xffffff,
    });
    const lucha = new THREE.Sprite(luchaMat);
    lucha.center.set(0.5, 0); // feet on the cobbles
    lucha.position.set(0, 0, 0);
    lucha.renderOrder = 4;
    const setPose = (flex: boolean, punch = 1): void => {
      const tex = flex ? flexTex : crossedTex;
      luchaMat.map = tex;
      luchaMat.needsUpdate = true;
      const h = LUCHA_H * punch;
      lucha.scale.set(h * aspectOf(tex), h, 1);
    };
    setPose(short, 1); // short cut starts already flexed in the wide shot
    scene.add(lucha);

    // Gold chancla — a supporting flourish that slams in on PLAYER 1, after the pull-out.
    const chancla = makeChancla();
    chancla.scale.setScalar(0.95);
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex(), color: 0xffd27a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(2.2); chancla.add(halo);
    chancla.visible = false; scene.add(chancla);

    // Close: worm's-eye, he fills the tall phone frame. Wide: pull back to the plaza start.
    const camClose = new THREE.Vector3(0.04, 0.58, 4.95);
    const lookClose = new THREE.Vector3(0, 2.48, 0);
    const camWide = new THREE.Vector3(0, 3.05, 11.2);
    const lookWide = new THREE.Vector3(0, 1.45, 0);
    const camStart = new THREE.Vector3(0.08, 0.78, 5.7); // a hair further; we snap in
    const lookStart = new THREE.Vector3(0, 2.4, 0);
    const tmpC = new THREE.Vector3(), tmpL = new THREE.Vector3();
    const FOV_CLOSE = 64, FOV_WIDE = 56;

    function resize(): void {
      const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    resize();
    const onResize = (): void => resize();
    addEventListener('resize', onResize);

    const dur = short ? SHORT_MS : FULL_MS;
    host.dataset.short = short ? '1' : '0';
    host.dataset.dur = String(dur);
    host.dataset.game = game;
    // Shared beat fractions; the short cut is a compressed pull-out already mid-wide.
    const T_SNAP = short ? 0.0 : 0.06;
    const T_FLEX = short ? 0.0 : 0.16;
    const T_PULL = short ? 0.0 : 0.26;
    const PULL_LEN = short ? 0.08 : 0.28;
    const T_P1 = short ? 0.18 : 0.56;
    const T_READY = short ? 0.34 : 0.64;
    const T_3 = short ? 0.48 : 0.72;
    const T_2 = short ? 0.62 : 0.80;
    const T_1 = short ? 0.74 : 0.87;
    const T_GO = short ? 0.86 : 0.93;

    let raf = 0, t0 = performance.now();
    let flexed = short, shownP1 = false, shownReady = false, shoeIn = false, ending = false;
    let lastCount = '';
    let shake = 0;
    const seekMode = /[?&]introseek=1(?:&|$)/.test(location.search);
    let forcedU: number | null = seekMode ? 0 : null;
    seekTo = (u: number): void => { forcedU = Math.max(0, u); };
    const audible = (): boolean => forcedU == null;

    function setCam(u: number, sec: number): void {
      let fov = FOV_CLOSE;
      if (u < T_SNAP) {
        const k = smooth(T_SNAP > 0 ? u / T_SNAP : 1);
        vlerp(camStart, camClose, k, tmpC); vlerp(lookStart, lookClose, k, tmpL);
        fov = FOV_CLOSE;
      } else if (u < T_PULL) {
        tmpC.copy(camClose); tmpL.copy(lookClose);
        fov = FOV_CLOSE;
      } else {
        const k = easeOutBack(Math.min(1, (u - T_PULL) / PULL_LEN));
        vlerp(camClose, camWide, k, tmpC); vlerp(lookClose, lookWide, k, tmpL);
        fov = lerp(FOV_CLOSE, FOV_WIDE, Math.min(1, k));
      }
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
      if (shake > 0) {
        tmpC.x += (Math.random() - 0.5) * shake * 0.18;
        tmpC.y += (Math.random() - 0.5) * shake * 0.12;
        tmpC.z += (Math.random() - 0.5) * shake * 0.06;
      }
      camera.position.copy(tmpC); camera.lookAt(tmpL);
      void sec;
    }

    function flash(): void {
      flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
    }

    function frame(now: number): void {
      raf = requestAnimationFrame(frame);
      const u = forcedU != null ? forcedU : Math.min(1.2, (now - t0) / dur);
      const sec = forcedU != null ? forcedU * (dur / 1000) : (now - t0) / 1000;
      host.dataset.u = u.toFixed(3);
      shake = Math.max(0, shake - (forcedU != null ? 0 : 0.045));
      // When seeking, show the residual shake of a just-fired beat so stills look punched.
      if (forcedU != null) {
        if (u >= T_P1 && u < T_P1 + 0.06) shake = 0.7;
        else if (u >= T_FLEX && u < T_FLEX + 0.05) shake = 0.35;
        else shake = 0;
      }
      setCam(u, sec);
      backdrop.update(now);
      for (const f of flames) f.scale.set(0.42 + Math.sin(sec * 13 + f.userData.phase) * 0.05, 0.55 + Math.sin(sec * 9 + f.userData.phase) * 0.07, 1);
      const pulse = 0.82 + Math.sin(sec * 3.4) * 0.14;
      backGlow.material.opacity = 0.72 + Math.sin(sec * 2.8) * 0.16;
      backGlow.scale.set(6.2 + pulse * 0.5, 8.0 + pulse * 0.5, 1);
      rimGlow.material.opacity = 0.38 + Math.sin(sec * 4.1) * 0.1;
      groundGlow.material.opacity = 0.7 + Math.sin(sec * 3.2) * 0.15;
      rim.intensity = 20 + Math.sin(sec * 3) * 4;

      // Flex beat: swap to the flexed pose with a scale punch.
      if (u >= T_FLEX && !flexed) {
        flexed = true;
        setPose(true, 1.05);
        shake = Math.max(shake, 0.45);
        if (audible()) { sfxWhoosh(); sfxImpact(0.85); }
      }
      if (flexed) {
        const pk = Math.max(0, 1.05 - Math.max(0, (u - T_FLEX) / 0.08) * 0.05);
        const breathe = 1 + Math.sin(sec * 2.2) * 0.012;
        setPose(true, Math.max(1, pk) * breathe);
      }

      if (u >= T_P1) {
        if (!shoeIn) {
          shoeIn = true;
          chancla.visible = true;
        }
        const k = smooth(Math.min(1, (u - T_P1) / 0.14));
        chancla.position.set(-1.22, 1.18 + Math.sin(sec * 3.4) * 0.07 * k, 3.7);
        chancla.scale.setScalar(0.35 + 0.7 * k);
        chancla.rotation.set(0.42, 0.88 + (1 - k) * Math.PI * 1.6 + Math.sin(sec * 1.8) * 0.12, 0.1, 'YXZ');
        haloMat.opacity = 0.35 + Math.sin(sec * 5) * 0.15 + k * 0.3;
      }

      if (u >= T_P1 && !shownP1) {
        shownP1 = true;
        p1El.classList.add('on');
        flash();
        shake = Math.max(shake, 0.85);
        if (audible()) { sfxSlam(); sfxCoin(); }
      }
      if (u >= T_READY && !shownReady) {
        shownReady = true;
        readyEl.classList.add('on');
        if (audible()) sfxShimmer(1);
      }
      // Show only the latest due number, once — calling every frame would restart the fade.
      let due = '';
      if (u >= T_GO) due = 'GO';
      else if (u >= T_1) due = '1';
      else if (u >= T_2) due = '2';
      else if (u >= T_3) due = '3';
      if (due && due !== lastCount) {
        lastCount = due;
        readyEl.classList.remove('on');
        readyEl.style.opacity = '0';
        countEl.textContent = due;
        countEl.classList.toggle('go', due === 'GO');
        countEl.classList.remove('on'); void countEl.offsetWidth; countEl.classList.add('on');
        if (audible()) {
          if (due === 'GO') sfxGo();
          else sfxCount(due === '1' ? 1 : Number(due));
        }
      }

      renderer.render(scene, camera);
      if (u >= 1 && forcedU == null) {
        if (lastCount !== 'GO') {
          lastCount = 'GO';
          countEl.textContent = 'GO';
          countEl.classList.add('go', 'on');
          if (audible()) sfxGo();
        }
        if (!ending) {
          ending = true;
          setTimeout(() => {
            host.classList.add('fade');
            setTimeout(done, 200);
          }, short ? 100 : 220);
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
              // glowTex is a shared cache — do not dispose its map
              if (mat.map && mat.map !== glowTex() && mat.map !== crossedTex && mat.map !== flexTex) mat.map.dispose?.();
              mat.dispose?.();
            }
          }
          if ((o as THREE.Sprite).isSprite) {
            const m = (o as THREE.Sprite).material;
            if (m.map && m.map !== glowTex() && m.map !== crossedTex && m.map !== flexTex) m.map.dispose?.();
            m.dispose?.();
          }
        });
        crossedTex.dispose();
        flexTex.dispose();
        mari.dispose();
        renderer.dispose();
        renderer.forceContextLoss?.();
      } catch { /* already gone */ }
      host.remove();
      style.remove();
    };

    raf = requestAnimationFrame((n) => { t0 = n; frame(n); });
    if (!seekMode) setTimeout(() => { if (!finished) done(); }, dur + 1600);
  }

  // If the user skips before the poses finish loading, still tear down the host.
  cleanup = (): void => {
    if (seekTo) seekTo = null;
    host.removeEventListener('pointerdown', onSkip);
    host.removeEventListener('keydown', onKey);
    host.remove();
    style.remove();
  };
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
