import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- story text table (one-line name swap) ----------
const BOY = 'Sidro';
const A = '/s3d/abuela_warm.webp', AP = '/s3d/abuela_point.webp', AS = '/s3d/abuela_shock.webp', L = '/s3d/kid.webp', P = '/s3d/llama.webp', K = '/play/t_kid.webp', M = '/s3d/kidmask.webp';
type Panel = { bg: string; cap: string; imgs?: { src: string; style: string }[]; bubbles?: { text: string; style: string; tx?: string }[]; fx?: string; glow?: boolean };
const STORY: Record<string, Panel[]> = {
  intro: [
    { bg: 'hill', cap: 'Día de los Muertos. One road down the hill to the ofrenda.', imgs: [{ src: A, style: 'left:4%;height:62%' }], bubbles: [{ text: `${BOY}. Straight down. No stopping.`, style: 'right:5%;top:22%', tx: '18%' }] },
    { bg: 'smoke', cap: `${BOY} is small, and the dark is big. So he puts on the mask.`, imgs: [{ src: L, style: 'right:3%;height:62%' }], bubbles: [{ text: "Tonight I'm somebody braver.", style: 'left:5%;top:24%', tx: '72%' }] },
    { bg: 'road', cap: 'Abuela hands over her chanclas.', imgs: [{ src: AP, style: 'left:1%;height:62%' }, { src: L, style: 'right:1%;height:62%' }], bubbles: [{ text: "You'll know when to strike!", style: 'left:8%;top:20%', tx: '25%' }] },
  ],
  l2: [{ bg: 'skull', cap: 'The skulls bite. And they spit.', imgs: [{ src: AS, style: 'left:3%;height:62%' }], bubbles: [{ text: 'Move your feet, mijo.', style: 'right:5%;top:22%', tx: '20%' }] }],
  l3: [{ bg: 'smoke', cap: 'Wind comes off the graves.', imgs: [{ src: AP, style: 'left:3%;height:62%' }], bubbles: [{ text: 'Aim into it.', style: 'right:8%;top:24%', tx: '20%' }] }],
  l4: [{ bg: 'road', cap: 'Something sweet hangs over the road.', imgs: [{ src: P, style: 'right:8%;height:62%' }, { src: A, style: 'left:2%;height:56%' }], bubbles: [{ text: "Break it. I won't tell.", style: 'left:6%;top:20%', tx: '30%' }] }],
  l5: [{ bg: 'glow', cap: 'Light at the bottom of the hill.', imgs: [{ src: L, style: 'left:4%;height:62%' }], bubbles: [{ text: 'Almost there.', style: 'right:8%;top:24%', tx: '25%' }] }],
  outro: [
    { bg: 'glow', cap: 'In the light, the mask comes off.', imgs: [{ src: M, style: 'left:50%;bottom:24%;height:32%;transform:translateX(-50%) rotate(-18deg)' }], glow: true },
    { bg: 'glow', cap: `It was ${BOY} the whole time.`, imgs: [{ src: K, style: 'left:5%;height:40%' }, { src: A, style: 'right:3%;height:62%' }], glow: true, bubbles: [{ text: 'The mask never made you brave. It just held on until you were.', style: 'left:6%;top:18%', tx: '75%' }] },
  ],
};

const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');
const comic = $('comic'), wrap = $('panelWrap');
const SKIP_KEY = 's3d_skipStory';
const comicBg: Record<string, string> = {};
function playStory(key: string, done: () => void) {
  const panels = STORY[key];
  if (!panels || localStorage.getItem(SKIP_KEY) === '1') { done(); return; }
  let i = 0; comic.classList.remove('hidden');
  const show = () => {
    const p = panels[i];
    const imgs = (p.imgs || []).map((m) => `<img src="${m.src}" alt="" style="${m.style}">`).join('');
    const bubs = (p.bubbles || []).map((b) => `<div class="bub" style="${b.style};--tx:${b.tx || '30%'}">${b.text}</div>`).join('');
    const fx = p.fx ? `<div class="fx">${p.fx}</div>` : '';
    const glow = p.glow ? '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 55%,rgba(255,240,190,.7),rgba(255,190,80,.25) 40%,rgba(0,0,0,0) 72%)"></div>' : '';
    wrap.innerHTML = `<div class="panel" style="background-image:url(${comicBg[p.bg] || ''})"><div class="dots"></div>${glow}${imgs}${fx}<div class="cap">${p.cap}</div>${bubs}</div>`;
  };
  const finish = () => { comic.classList.add('hidden'); comic.onclick = null; done(); };
  comic.onclick = (e) => { if ((e.target as HTMLElement).id === 'skip') return; if (++i >= panels.length) finish(); else show(); };
  $('skip').onclick = (e) => { e.stopPropagation(); localStorage.setItem(SKIP_KEY, '1'); finish(); };
  show();
}

// ---------- audio ----------
let actx: AudioContext | null = null; let muted = false;
function beep(f: number, d = 0.08, type: OscillatorType = 'square', v = 0.08) {
  if (muted) return;
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  } catch { /* no audio */ }
}
$('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; };

// ---------- procedural textures (code-drawn, no art files) ----------
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const COB = 512, CELLS = 9;
const cobH = new Float32Array(COB * COB);
const cobble = canvasTex(COB, COB, (c) => {
  const pts: [number, number, number][] = [];
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) pts.push([(i + 0.2 + rnd() * 0.6) / CELLS, (j + 0.2 + rnd() * 0.6) / CELLS, rnd()]);
  const im = c.createImageData(COB, COB), D = im.data;
  for (let y = 0; y < COB; y++) for (let x = 0; x < COB; x++) {
    const u = x / COB, v = y / COB; let d1 = 9, d2 = 9, id = 0;
    const ci = Math.floor(u * CELLS), cj = Math.floor(v * CELLS);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + CELLS) % CELLS, jj = (cj + dj + CELLS) % CELLS, q = pts[jj * CELLS + ii];
      const px = q[0] + Math.floor((ci + di) / CELLS) * 1 + (ci + di < 0 ? 0 : 0), py = q[1] + Math.floor((cj + dj) / CELLS);
      const dx = u - (px + (ci + di < 0 ? -1 : ci + di >= CELLS ? 1 : 0) * 0 ), dy = v - py;
      const dd = Math.hypot(dx, dy);
      if (dd < d1) { d2 = d1; d1 = dd; id = jj * CELLS + ii; } else if (dd < d2) d2 = dd;
    }
    const edge = (d2 - d1) * CELLS; // 0 at mortar
    const h = Math.min(1, Math.max(0, (edge - 0.06) / 0.35)); const dome = Math.sqrt(h);
    cobH[y * COB + x] = dome;
    const tone = pts[id][2], o = (y * COB + x) * 4;
    const base = 34 + tone * 30, n = (rnd() - 0.5) * 10;
    if (h <= 0) { D[o] = 10; D[o + 1] = 6; D[o + 2] = 14; }
    else { D[o] = base + 10 + n; D[o + 1] = base + 2 + n; D[o + 2] = base + 26 + n + tone * 10; }
    D[o + 3] = 255;
  }
  c.putImageData(im, 0, 0);
}, true);
const cobbleN = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = COB; const c = cv.getContext('2d')!; const im = c.createImageData(COB, COB), D = im.data;
  for (let y = 0; y < COB; y++) for (let x = 0; x < COB; x++) {
    const hx = cobH[y * COB + ((x + 1) % COB)] - cobH[y * COB + ((x - 1 + COB) % COB)], hy = cobH[((y + 1) % COB) * COB + x] - cobH[((y - 1 + COB) % COB) * COB + x];
    const nx = -hx * 3, ny = -hy * 3, nz = 1, l = Math.hypot(nx, ny, nz), o = (y * COB + x) * 4;
    D[o] = (nx / l * 0.5 + 0.5) * 255; D[o + 1] = (ny / l * 0.5 + 0.5) * 255; D[o + 2] = (nz / l * 0.5 + 0.5) * 255; D[o + 3] = 255;
  }
  c.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
})();
const puff = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(200,190,235,.55)'); g.addColorStop(0.5, 'rgba(150,130,200,.2)'); g.addColorStop(1, 'rgba(120,100,180,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
const flame = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.3, 'rgba(255,160,40,.7)'); g.addColorStop(1, 'rgba(255,120,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
const FOG_DARK = new THREE.Color(0x0d0618), FOG_END = new THREE.Color(0x5a2e22);
scene.background = FOG_DARK.clone();
scene.fog = new THREE.Fog(FOG_DARK.clone(), 16, 62);
const camera = new THREE.PerspectiveCamera(64, 9 / 16, 0.1, 200);
const hemi = new THREE.HemisphereLight(0x6a5cff, 0x0b1a1c, 0.55); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x5fd6d0, 0.9); moon.position.set(-20, 40, 10); scene.add(moon);
const warm = new THREE.PointLight(0xffb060, 0, 80, 1.2); scene.add(warm);
const tl = new THREE.TextureLoader();
const skTex = tl.load('/s3d/skull.webp'); skTex.colorSpace = THREE.SRGBColorSpace;
const sMats: Record<string, THREE.MeshBasicMaterial> = {};
const sMat = (u: string) => (sMats[u] ??= new THREE.MeshBasicMaterial({ map: (() => { const t = tl.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, fog: false, toneMapped: false, color: 0xffffff }));

// ---------- winding downhill road ----------
const ctrl: THREE.Vector3[] = [];
// endless run: the road is one big closed loop (~1.6k units) with periodic bends and rolling hills, so dist can grow forever
const LOOP_R = 255, LOOP_N = 120;
for (let i = 0; i < LOOP_N; i++) { const th = (i / LOOP_N) * Math.PI * 2, wig = Math.sin(th * 12) * 11 + Math.sin(th * 29 + 1) * 4, rr = LOOP_R + wig; ctrl.push(new THREE.Vector3(Math.cos(th) * rr - LOOP_R, Math.sin(th * 5) * 7 + Math.sin(th * 11 + 2) * 2.5, -Math.sin(th) * rr)); }
const curve = new THREE.CatmullRomCurve3(ctrl, true, 'catmullrom', 0.5);
const LEN = curve.getLength();
const UP = new THREE.Vector3(0, 1, 0);
function frameAt(d: number) {
  const u = (((d / LEN) % 1) + 1) % 1;
  const p = curve.getPointAt(u), t = curve.getTangentAt(u);
  const side = new THREE.Vector3().crossVectors(t, UP).normalize();
  return { p, t, side };
}
const at = (d: number, x: number, y = 0) => { const f = frameAt(d); return f.p.clone().addScaledVector(f.side, x).addScaledVector(UP, y); };
function ribbon(width: number, yOff: number, mat: THREE.Material, vScale: number) {
  const N = 700, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const d = (i / N) * LEN, f = frameAt(d);
    for (const s of [-1, 1]) { const v = f.p.clone().addScaledVector(f.side, (s * width) / 2); pos.push(v.x, v.y + yOff, v.z); uv.push(s < 0 ? 0 : width / vScale, d / vScale); }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); scene.add(m); return m;
}
ribbon(7, 0, new THREE.MeshStandardMaterial({ map: cobble, normalMap: cobbleN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.42, metalness: 0.05, color: 0xc8bce0 }), 2.6);
const lantern = new THREE.PointLight(0xffb060, 14, 14, 1.6); scene.add(lantern);
ribbon(26, -0.08, new THREE.MeshStandardMaterial({ color: 0x120a16, roughness: 1 }), 10);
// curbs
for (const s of [-1, 1]) { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 120 }, (_, i) => at((i / 119) * LEN, s * 3.6, 0.08))), 400, 0.12, 5); scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a2a44 }))); }

// ---------- roadside decor ----------
const candleMat = new THREE.MeshStandardMaterial({ color: 0xf1e3c0, emissive: 0x4a3010 });
const flameMat = new THREE.SpriteMaterial({ map: flame, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const flames: THREE.Sprite[] = [];
function candle(p: THREE.Vector3, h = 0.35) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), candleMat); c.position.copy(p).add(new THREE.Vector3(0, h / 2, 0)); scene.add(c);
  const f = new THREE.Sprite(flameMat); f.scale.set(0.35, 0.5, 1); f.position.copy(p).add(new THREE.Vector3(0, h + 0.12, 0)); scene.add(f); flames.push(f);
}
const decoSkullMat = new THREE.MeshBasicMaterial({ map: skTex, transparent: true, alphaTest: 0.3, toneMapped: false });
const ofrCols = [0x7a1d8a, 0xe2197a, 0xff9f1c];
function ofrenda(d: number, x: number) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 - k * 0.5, 0.4, 1 - k * 0.2), new THREE.MeshStandardMaterial({ color: ofrCols[k], roughness: 0.9 })); b.position.y = 0.2 + k * 0.4; g.add(b); }
  const p = at(d, x); g.position.copy(p); g.lookAt(at(d, 0)); scene.add(g);
  for (let k = 0; k < 5; k++) candle(g.localToWorld(new THREE.Vector3(-0.8 + k * 0.4, 0.4, 0.35)), 0.25);
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff9f1c })); m.position.copy(g.localToWorld(new THREE.Vector3(-0.5 + k * 0.2, 1.3, 0))); scene.add(m); }
  for (const sx of [-0.55, 0.55]) { const sk = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.57), decoSkullMat); sk.position.copy(g.localToWorld(new THREE.Vector3(sx, 0.75, 0.25))); sk.lookAt(at(d, 0, 1)); scene.add(sk); }
}
// night-toned papel picado (deep, desaturated) — was [0xe2197a, 0xff9f1c, 0x1ec8c8, 0xb04bff, 0x8ae234, 0xffd23f] x0.75
const picCols = [0x5a1838, 0x6a4418, 0x1a4a4c, 0x3e2458, 0x3a4a22, 0x5e5020];
const flagGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.2, 0.24), new THREE.Vector2(0.2, 0.24), new THREE.Vector2(0.2, -0.16), new THREE.Vector2(0.1, -0.24), new THREE.Vector2(0, -0.16), new THREE.Vector2(-0.1, -0.24), new THREE.Vector2(-0.2, -0.16)]));
const flagSpots: { p: THREE.Vector3; t: THREE.Vector3; c: number }[] = [], bulbSpots: THREE.Vector3[] = [], poleSpots: THREE.Vector3[] = [];
function papel(d: number, kind: 'flags' | 'lights', pr: () => number) {
  const a = at(d, -4.75), b = at(d, 4.75); poleSpots.push(a, b); // strung pole to pole (the town is no longer a continuous wall)
  if (kind === 'flags') { const rows = pr() < 0.5 ? 1 : 2; for (const [hgt, n, sag] of ([[6.0, 20, 0.45], [5.45, 16, 0.3]] as [number, number, number][]).slice(0, rows)) for (let k = 0; k < n; k++) {
    if (pr() < 0.12) continue; // a few torn-off flags
    const t = (k + 0.5) / n, p = a.clone().lerp(b, t); p.y += hgt - Math.sin(t * Math.PI) * sag; flagSpots.push({ p, t: frameAt(d).t, c: picCols[Math.floor(pr() * 6)] });
  } } else { const n = 10 + Math.floor(pr() * 8), sag = 0.5 + pr() * 0.6, hgt = 4.4 + pr() * 1.2; for (let k = 0; k < n; k++) { if (pr() < 0.15) continue; const t = (k + 0.5) / n, p = a.clone().lerp(b, t); p.y += hgt - Math.sin(t * Math.PI) * sag; bulbSpots.push(p); } }
}
// irregular: gap 12..38u, plus an occasional extra-long dark stretch; 40% banner rows, 60% dim bulb strings
{ let ps = 313; const pr = () => ((ps = (ps * 16807) % 2147483647) / 2147483647); for (let d = 10 + pr() * 8; d < LEN - 8;) { papel(d, pr() < 0.4 ? 'flags' : 'lights', pr); d += 12 + pr() * 26 + (pr() < 0.25 ? 18 : 0); } }
const flagIM = new THREE.InstancedMesh(flagGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), flagSpots.length);
flagSpots.forEach((f, i) => flagIM.setColorAt(i, new THREE.Color(f.c))); flagIM.frustumCulled = false; scene.add(flagIM);
const BULB = [0xb0702c, 0x9a5e24, 0xc08a44];
const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbSpots.length);
{ const m = new THREE.Matrix4(); bulbSpots.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); bulbIM.setMatrixAt(i, m); bulbIM.setColorAt(i, new THREE.Color(BULB[i % 3])); }); bulbIM.frustumCulled = false; scene.add(bulbIM); }
{ const poleIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 6.4, 5), new THREE.MeshBasicMaterial({ color: 0x1c1218 }), poleSpots.length); const m = new THREE.Matrix4(); poleSpots.forEach((p, i) => { m.makeTranslation(p.x, p.y + 3.2, p.z); poleIM.setMatrixAt(i, m); }); scene.add(poleIM); }
const fDummy = new THREE.Object3D();
function swayFlags(t: number) { flagSpots.forEach((f, i) => { fDummy.position.copy(f.p); fDummy.lookAt(tmpV.copy(f.p).add(f.t)); fDummy.rotateX(Math.sin(t * 2.2 + i * 0.6) * 0.3); fDummy.updateMatrix(); flagIM.setMatrixAt(i, fDummy.matrix); }); flagIM.instanceMatrix.needsUpdate = true; }
const tmpV = new THREE.Vector3();
for (let d = 6; d < LEN - 10; d += 7) { const s = rnd() < 0.5 ? -1 : 1; if (rnd() < 0.22) ofrenda(d, s * 4.05); else rnd(); rnd(); rnd(); } // alley: graves removed, ofrendas against the walls

// ---------- abandoned pueblo: sparse, staggered houses (instanced), empty lots w/ rubble/fences, left-behind folk-art props ----------
{
  let bs = 91; const br = () => ((bs = (bs * 16807) % 2147483647) / 2147483647); // own RNG so other props keep their layout
  const WALL = [0xe2197a, 0x1ec8c8, 0xff9f1c, 0xb04bff, 0xf25c9a, 0x2bb3a3, 0xffc23f, 0x8a4fd8];
  const TRIM = [0xd8ccb8, 0xc0a040, 0x24092f, 0x2a9a9a, 0xa8306a];
  const DUST = new THREE.Color(0x6a625c);
  const fade = (c: number, k: number) => new THREE.Color(c).lerp(DUST, k).getHex(); // abandoned: sun-bleached + dusty
  const RUB = [0x5a5048, 0x4a4038, 0x6a5a4a, 0x3a3430];
  const arch = (w: number, h: number) => { const s = new THREE.Shape(); const r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0); return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 8 }); };
  type B = { m: THREE.Matrix4; c: number };
  const walls: B[] = [], doors: THREE.Matrix4[] = [], wins: B[] = [], frames: B[] = [], rails: THREE.Matrix4[] = [];
  const o = new THREE.Object3D(), M = (fn: () => void) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); fn(); o.updateMatrix(); return o.matrix.clone(); };
  // chord placement on a line at constant offset from the road (keeps bends right: chord sits behind the arc on inside bends)
  const frameFor = (s: number, d: number, w0: number, off: number, dep: number) => {
    const wl = (dd: number) => at(dd, s * off, 0), p0 = wl(d);
    let d1 = d + w0; for (let it = 0; it < 4; it++) d1 = d + (d1 - d) * (w0 / Math.max(0.2, p0.distanceTo(wl(d1))));
    const p1 = wl(d1), w = p0.distanceTo(p1);
    const mid = p0.clone().lerp(p1, 0.5), chord = p1.clone().sub(p0).setY(0).normalize(), n = new THREE.Vector3(chord.z, 0, -chord.x);
    if (n.dot(frameAt((d + d1) / 2).side) * s < 0) n.negate();
    const base = mid.clone().addScaledVector(n, dep / 2).setY(Math.min(p0.y, p1.y) - 2.5);
    const P = new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-n.x, -n.z)), new THREE.Vector3(1, 1, 1));
    const add = (arr: { push: (x: never) => void }, m: THREE.Matrix4, c?: number) => { const g = P.clone().multiply(m); arr.push((c === undefined ? g : { m: g, c }) as never); };
    return { w, d1, add, P };
  };
  const rubble = (add: ReturnType<typeof frameFor>['add'], cx: number, cz: number, spread: number, n: number) => { for (let q = 0; q < n; q++) { const sz = 0.15 + br() * 0.4; add(walls, M(() => { o.position.set(cx + (br() - 0.5) * spread, 2.5 + sz * 0.3, cz + (br() - 0.5) * spread * 0.6); o.rotation.set(br() * 3, br() * 3, br() * 3); o.scale.set(sz * (1 + br()), sz, sz * (0.6 + br())); }), RUB[Math.floor(br() * 4)]); } };
  const counts = { intact: 0, damaged: 0, ruined: 0, lots: 0 };
  const props: { s: number; d: number; kind: number }[] = [];
  function house(s: number, d: number, w0: number) {
    const r = br(), state = r < 0.56 ? 'intact' : r < 0.84 ? 'damaged' : 'ruined'; counts[state]++;
    const dep = 2.4, { w, d1, add } = frameFor(s, d, w0, 4.95, dep), fz = dep / 2;
    const h = state === 'ruined' ? 1.2 + br() * 2.2 : 5 + br() * 3.2, H = h + 2.5;
    const wc = fade(WALL[Math.floor(br() * WALL.length)], state === 'intact' ? 0.3 : state === 'damaged' ? 0.45 : 0.6), tc = fade(TRIM[Math.floor(br() * TRIM.length)], 0.4);
    if (state === 'intact') {
      add(walls, M(() => { o.position.y = H / 2; o.scale.set(w, H, dep); }), wc);
      add(walls, M(() => { o.position.set(0, H + 0.18, fz - 0.1); o.scale.set(w + 0.2, 0.36, 0.3); }), tc);
    } else { // jagged top: wall split into vertical strips of uneven height; damaged loses a corner, ruined is a roofless shell
      const strips = 3 + Math.floor(br() * 3), sw = w / strips, collapse = Math.floor(br() * strips);
      for (let k = 0; k < strips; k++) {
        const hk = state === 'damaged' ? (k === collapse ? H * (0.45 + br() * 0.2) : H * (0.82 + br() * 0.18)) : H * (0.35 + br() * 0.65);
        const x = -w / 2 + (k + 0.5) * sw;
        if (state === 'damaged') add(walls, M(() => { o.position.set(x, hk / 2, 0); o.scale.set(sw + 0.02, hk, dep); }), wc);
        else { add(walls, M(() => { o.position.set(x, hk / 2, fz - 0.15); o.scale.set(sw + 0.02, hk, 0.3); }), wc); } // front facade only
        if (state === 'damaged' && k !== collapse && br() < 0.6) add(walls, M(() => { o.position.set(x, hk + 0.15, fz - 0.1); o.scale.set(sw * (0.5 + br() * 0.5), 0.3, 0.3); }), tc); // surviving parapet bits
      }
      if (state === 'ruined') { for (const sx of [-1, 1]) { const hs = 2.5 + br() * h * 0.7; add(walls, M(() => { o.position.set(sx * (w / 2 - 0.15), hs / 2, 0); o.scale.set(0.3, hs, dep * (0.5 + br() * 0.5)); }), wc); } rubble(add, 0, 0, w * 0.8, 10); } // side stubs, open roof, rubble inside
      rubble(add, (br() - 0.5) * w * 0.6, fz + 0.5, 1.6, 6 + Math.floor(br() * 5)); // fallen debris on the sidewalk
    }
    const doorX = (br() - 0.5) * (w - 1.6);
    add(doors, M(() => { o.position.set(doorX, 2.5, fz + (state === 'ruined' ? 0.02 : 0)); o.scale.set(1.1, 2.1, 1); }));
    if (state !== 'ruined' || br() < 0.5) add(frames, M(() => { o.position.set(doorX, 2.45, fz - 0.03); o.scale.set(1.35, 2.3, 1); }), tc);
    if (br() < (state === 'intact' ? 0.2 : 0.4)) for (let q = 0; q < 3; q++) add(walls, M(() => { o.position.set(doorX, 3.0 + q * 0.6, fz + 0.16); o.rotation.z = (br() - 0.5) * 0.4; o.scale.set(1.3, 0.16, 0.05); }), 0x3a2a1c); // boarded door
    const floors = state === 'ruined' ? (h > 2.6 ? 1 : 0) : h > 7.2 ? 3 : 2, nw = Math.max(1, Math.floor(w / 1.6));
    for (let fl = 0; fl < floors; fl++) for (let k = 0; k < nw; k++) {
      const x = -w / 2 + (k + 0.5) * (w / nw); if (fl === 0 && Math.abs(x - doorX) < 1.1) continue;
      const y = 2.5 + 1.0 + fl * 2.2, rb = br();
      // lights OFF: every window is a dark hole (was 70% warm 0xffb54a + additive glow); damaged/ruined get boarded or broken panes
      const boarded = rb < (state === 'intact' ? 0.12 : 0.35), broken = !boarded && rb < (state === 'intact' ? 0.25 : 0.75);
      add(wins, M(() => { o.position.set(x, y, fz + 0.01); o.scale.set(0.7, 0.95, 1); }), broken ? 0x020104 : 0x0b0710);
      if (!broken || br() < 0.5) add(frames, M(() => { o.position.set(x, y - 0.06, fz - 0.02); o.scale.set(0.92, 1.15, 1); }), tc);
      if (boarded) for (let q = 0; q < 2 + Math.floor(br() * 2); q++) add(walls, M(() => { o.position.set(x, y + 0.15 + q * 0.28, fz + 0.15); o.rotation.z = (br() - 0.5) * 0.6; o.scale.set(0.95, 0.12, 0.04); }), 0x3a2a1c);
      if (broken) add(walls, M(() => { o.position.set(x + (br() - 0.5) * 0.3, y + 0.2, fz + 0.14); o.rotation.z = br() * 3; o.scale.set(0.18, 0.4, 0.02); }), 0x2a3a44); // jagged pane shard left in the frame
      if (state === 'intact' && fl >= 1 && br() < 0.4) { add(walls, M(() => { o.position.set(x, y - 0.55, fz + 0.3); o.rotation.z = (br() - 0.5) * 0.15; o.scale.set(1.2, 0.1, 0.6); }), 0x2a1a1a); for (let q = 0; q < 6; q++) if (br() < 0.8) add(rails, M(() => { o.position.set(x - 0.55 + q * 0.22, y - 0.28, fz + 0.58); o.rotation.z = (br() - 0.5) * 0.3; o.scale.set(0.03, 0.5, 0.03); })); }
    }
    return d1;
  }
  function lot(s: number, d: number, len: number) { // empty lot: rubble + broken fence or a wall stub, sometimes a left-behind prop
    counts.lots++; const { w, add } = frameFor(s, d, len, 5.3, 0.4), kind = br();
    rubble(add, (br() - 0.5) * w * 0.7, 0.6, w * 0.6, 4 + Math.floor(br() * 6));
    if (kind < 0.45) { const posts = Math.max(2, Math.floor(w / 0.7)); for (let q = 0; q < posts; q++) { if (br() < 0.25) continue; const x = -w / 2 + (q + 0.5) * (w / posts), lean = (br() - 0.5) * 0.5; add(walls, M(() => { o.position.set(x, 2.5 + 0.55, 0); o.rotation.z = lean; o.scale.set(0.09, 1.1 + br() * 0.3, 0.09); }), 0x2e2218); }
      for (const ry of [0.75, 1.25]) if (br() < 0.75) add(walls, M(() => { o.position.set((br() - 0.5) * 0.4, 2.5 + ry, 0.05); o.rotation.z = (br() - 0.5) * 0.35; o.scale.set(w * (0.5 + br() * 0.45), 0.08, 0.04); }), 0x3a2a1c); }
    else if (kind < 0.8) { const sl = w * (0.3 + br() * 0.5); for (let k = 0; k < 3; k++) { const hk = 0.4 + br() * 1.2; add(walls, M(() => { o.position.set(-sl / 2 + (k + 0.5) * sl / 3 + (br() - 0.5) * 0.2, 2.5 + hk / 2, 0); o.scale.set(sl / 3 + 0.02, hk, 0.3); }), fade(WALL[Math.floor(br() * WALL.length)], 0.6)); } }
    if (br() < 0.42) props.push({ s, d: d + len * (0.3 + br() * 0.4), kind: Math.floor(br() * 6) });
  }
  // alternation: one house per slot, side flips 78% of the time; the opposite side gets an empty lot 55% / nothing; irregular gaps
  let side = br() < 0.5 ? -1 : 1;
  for (let d = 0; d < LEN - 6;) {
    const w0 = 2.6 + br() * 2.2, dEnd = house(side, d, w0);
    if (br() < 0.55) lot(-side, d + (br() - 0.5) * 1.5, w0 * (0.7 + br() * 0.6));
    const gap = 1.5 + br() * 5 + (br() < 0.2 ? 4 : 0);
    if (gap > 3.5 && br() < 0.6) lot(side, dEnd + 0.4, gap - 0.8);
    d = dEnd + gap; side = br() < 0.78 ? -side : side;
  }
  const IM = (geo: THREE.BufferGeometry, mat: THREE.Material, list: (B | THREE.Matrix4)[]) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length;
    list.forEach((b, i) => { if (b instanceof THREE.Matrix4) im.setMatrixAt(i, b); else { im.setMatrixAt(i, b.m); im.setColorAt(i, new THREE.Color(b.c)); } });
    scene.add(im); return im;
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  IM(box, new THREE.MeshBasicMaterial({ color: 0x6e6084 }), walls); // night tone
  IM(arch(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0410 }), doors); IM(arch(1, 1), new THREE.MeshBasicMaterial({ color: 0x7c6e92 }), frames);
  IM(arch(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), wins);
  IM(box, new THREE.MeshBasicMaterial({ color: 0x140a14 }), rails);
  // ---- left-behind folk-art props (merged into one vertex-colored mesh: 1 draw call). Weathered, desaturated, static, off-road. ----
  const parts: THREE.BufferGeometry[] = [];
  const W = (c: number) => new THREE.Color(c).lerp(DUST, 0.5).multiplyScalar(0.75); // weathering: 50% toward dust, 25% darker
  const piece = (g: THREE.BufferGeometry, m: THREE.Matrix4, c: number) => { g = g.toNonIndexed(); g.applyMatrix4(m); const col = W(c), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g); };
  const L = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const propLog: string[] = [];
  props.forEach((pp, i) => {
    const kinds = ['calavera', 'pinata', 'abuelita', 'luchador', 'scarecrow', 'skeleton'], kind = kinds[pp.kind];
    const off = 6.2 + br() * 1.6, p = at(pp.d, pp.s * off), f = frameAt(pp.d);
    const tilt = kind === 'pinata' ? 1.25 + br() * 0.3 : br() < 0.35 ? 0.9 + br() * 0.5 : (br() - 0.5) * 0.5; // some tipped over, others leaning
    const R = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(f.side.x * -pp.s, f.side.z * -pp.s) + (br() - 0.5) * 1.2, 0)), new THREE.Vector3(1, 1, 1)).multiply(L(0, 0, 0, 0, 0, tilt * (br() < 0.5 ? -1 : 1)));
    const P2 = (g: THREE.BufferGeometry, m: THREE.Matrix4, c: number) => piece(g, R.clone().multiply(m), c);
    if (kind === 'calavera') { // sugar-skull figure: dress cone, bone-white skull with dark sockets, flower crown
      P2(new THREE.ConeGeometry(0.45, 1.2, 8), L(0, 0.6, 0), 0x5a2a4a); P2(new THREE.SphereGeometry(0.28, 10, 8), L(0, 1.45, 0, 0, 0, 0, 1, 1.1, 1), 0xe8dcc8);
      for (const ex of [-0.1, 0.1]) P2(new THREE.SphereGeometry(0.075, 6, 5), L(ex, 1.48, 0.23), 0x0a0608); P2(new THREE.TorusGeometry(0.24, 0.05, 5, 10), L(0, 1.68, 0, Math.PI / 2), 0xc86a20);
    } else if (kind === 'pinata') { // fallen 7-point star piñata: body + cones, faded tissue colors
      P2(new THREE.SphereGeometry(0.4, 10, 8), L(0, 0.45, 0), 0xb83a7a); [0xd8a020, 0x2aa0a0, 0x8a40c0, 0xd85a20, 0x50a030, 0xc83060, 0xd8a020].forEach((c, k) => { const a = (k / 7) * Math.PI * 2; P2(new THREE.ConeGeometry(0.13, 0.6, 6), L(Math.cos(a) * 0.5, 0.45 + Math.sin(a) * 0.5, 0, 0, 0, a - Math.PI / 2), c); });
    } else if (kind === 'abuelita') { // long dark skirt, rebozo shawl, gray bun
      P2(new THREE.CylinderGeometry(0.22, 0.42, 1.0, 8), L(0, 0.5, 0), 0x2a2030); P2(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), L(0, 1.25, 0), 0x3a5a5a); P2(new THREE.BoxGeometry(0.62, 0.32, 0.36), L(0, 1.3, 0, 0, 0, 0.1), 0x6a3a4a);
      P2(new THREE.SphereGeometry(0.17, 8, 6), L(0, 1.65, 0), 0x9a6a4a); P2(new THREE.SphereGeometry(0.11, 6, 5), L(0, 1.78, -0.1), 0x8a8a8a);
    } else if (kind === 'luchador') { // generic original mask (teal w/ gold stripe), cape, boots
      for (const lx of [-0.13, 0.13]) P2(new THREE.CylinderGeometry(0.09, 0.1, 0.8, 6), L(lx, 0.4, 0), 0x2a2a40); P2(new THREE.BoxGeometry(0.5, 0.65, 0.28), L(0, 1.12, 0), 0x9a6a4a);
      P2(new THREE.BoxGeometry(0.58, 0.9, 0.04), L(0, 1.05, -0.17, 0.1), 0x6a1a3a); P2(new THREE.SphereGeometry(0.2, 10, 8), L(0, 1.62, 0), 0x1a7a7a); P2(new THREE.BoxGeometry(0.06, 0.38, 0.4), L(0, 1.64, 0), 0xc89a30);
      for (const ex of [-0.08, 0.08]) P2(new THREE.SphereGeometry(0.05, 6, 4), L(ex, 1.64, 0.17), 0xd8ccb8);
    } else if (kind === 'scarecrow') { // pole cross, sack head, tattered shirt (pure silhouette tones)
      P2(new THREE.BoxGeometry(0.08, 2.2, 0.08), L(0, 1.1, 0), 0x2a1e14); P2(new THREE.BoxGeometry(1.4, 0.07, 0.07), L(0, 1.6, 0, 0, 0, (br() - 0.5) * 0.3), 0x2a1e14);
      P2(new THREE.BoxGeometry(0.7, 0.6, 0.12), L(0, 1.4, 0.05, 0, 0, 0.08), 0x3a3424); P2(new THREE.SphereGeometry(0.2, 7, 6), L(0, 2.05, 0), 0x6a5a3a); P2(new THREE.ConeGeometry(0.35, 0.3, 8), L(0, 2.28, 0), 0x2a2418);
    } else { // skeleton silhouette: flat near-black bones, slumped against nothing
      const bk = 0x141016; P2(new THREE.BoxGeometry(0.08, 0.7, 0.04), L(0, 1.0, 0), bk); for (let q = 0; q < 4; q++) P2(new THREE.BoxGeometry(0.36 - q * 0.04, 0.04, 0.04), L(0, 1.25 - q * 0.12, 0), bk);
      P2(new THREE.SphereGeometry(0.15, 8, 6), L(0, 1.52, 0), bk); for (const sx of [-1, 1]) { P2(new THREE.BoxGeometry(0.05, 0.75, 0.04), L(sx * 0.1, 0.33, 0, 0, 0, sx * 0.12), bk); P2(new THREE.BoxGeometry(0.04, 0.6, 0.04), L(sx * 0.26, 1.05, 0, 0, 0, sx * 0.5), bk); }
    }
    propLog.push(`${kind}@d${pp.d.toFixed(0)} side${pp.s > 0 ? 'R' : 'L'} x${off.toFixed(1)} tilt${tilt.toFixed(2)}`); void i;
  });
  if (parts.length) { const g = mergeGeometries(parts); scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }))); }
  (window as unknown as Record<string, unknown>).__town = { counts, props: propLog };
}

// ---------- layered dusk sky (camera-attached planes, canvas textures, parallax via UV scroll) ----------
const skyLayers: { t: THREE.Texture; par: number; drift: number }[] = [];
const skyGrad = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshBasicMaterial({ fog: false, depthTest: false, depthWrite: false, map: canvasTex(4, 256, (c) => { const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#0d0618'); g.addColorStop(0.08, '#2a0f45'); g.addColorStop(0.16, '#5a1f5e'); g.addColorStop(0.24, '#b5476a'); g.addColorStop(0.3, '#e8834a'); g.addColorStop(0.38, '#2a1030'); g.addColorStop(1, '#0d0618'); c.fillStyle = g; c.fillRect(0, 0, 4, 256); }) }));
skyGrad.position.set(0, 0, -160); skyGrad.renderOrder = -5; camera.add(skyGrad);
function skyLayer(z: number, w: number, h: number, y: number, par: number, drift: number, order: number, draw: (c: CanvasRenderingContext2D) => void, opacity = 1) {
  const t = canvasTex(1024, 256, draw); t.wrapS = THREE.RepeatWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, fog: false, depthWrite: false }));
  m.position.set(0, y, z); m.renderOrder = order; camera.add(m); skyLayers.push({ t, par, drift }); return m;
}
const ridge = (c: CanvasRenderingContext2D, base: number, amp: number, col: string, seedK: number) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 256); for (let x = 0; x <= 1024; x += 8) { const a = (x / 1024) * Math.PI * 2; c.lineTo(x, base - amp * (0.5 * Math.sin(a * 2 + seedK) + 0.3 * Math.sin(a * 5 + seedK * 2) + 0.2 * Math.sin(a * 11 + seedK))); } c.lineTo(1024, 256); c.fill(); };
const cloudDraw = (alpha: number, n: number, sk: number) => (c: CanvasRenderingContext2D) => { let s2 = sk; const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647); for (let i = 0; i < n; i++) { const cx = r2() * 1024, cy = 60 + r2() * 120, L = 80 + r2() * 160; for (let j = 0; j < 7; j++) for (const dx of [0, -1024, 1024]) { const x = cx + dx + (j - 3) * L * 0.18, y = cy + Math.sin(j * 1.7) * 10, r = L * (0.22 + 0.12 * Math.sin(j * 2.1 + i)); const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, `rgba(190,120,170,${alpha})`); g.addColorStop(0.6, `rgba(120,60,130,${alpha * 0.6})`); g.addColorStop(1, 'rgba(80,30,100,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } } };
skyLayer(-150, 260, 50, 75, 0.0004, 0.004, -4, cloudDraw(0.8, 6, 11), 1); // high far clouds
skyLayer(-145, 260, 40, 43, 0.0008, 0, -4, (c) => ridge(c, 200, 70, '#2a1238', 1.3)); // far mountains
skyLayer(-140, 260, 50, 58, 0.0012, 0.009, -3, cloudDraw(0.7, 5, 29), 1); // mid clouds (faster)
skyLayer(-135, 260, 34, 34, 0.0018, 0, -3, (c) => { // distant pueblo rooftops + church
  ridge(c, 230, 18, '#1a0a26', 4.1); c.fillStyle = '#1a0a26'; let s3 = 5; const r3 = () => ((s3 = (s3 * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < 1024; x += 22 + r3() * 26) { const hh = 20 + r3() * 40, ww = 18 + r3() * 26; c.fillRect(x, 230 - hh, ww, hh + 30); if (r3() < 0.4) { c.fillStyle = 'rgba(255,170,70,.8)'; c.fillRect(x + ww * 0.4, 230 - hh * 0.6, 3, 4); c.fillStyle = '#1a0a26'; } }
  const cx = 600; c.fillRect(cx - 40, 120, 80, 120); c.beginPath(); c.arc(cx, 120, 40, Math.PI, 0); c.fill(); for (const tx of [cx - 62, cx + 46]) { c.fillRect(tx, 80, 16, 160); c.beginPath(); c.moveTo(tx - 2, 80); c.lineTo(tx + 8, 58); c.lineTo(tx + 18, 80); c.fill(); }
  c.fillRect(cx - 2, 62, 4, 20); c.fillRect(cx - 8, 68, 16, 4); c.fillStyle = 'rgba(255,190,90,.85)'; c.beginPath(); c.arc(cx, 150, 9, 0, Math.PI * 2); c.fill();
});
function updateSky(dt: number) { for (const l of skyLayers) l.t.offset.x = (l.t.offset.x + l.drift * dt) % 1; for (const l of skyLayers) l.t.offset.x += 0; }
let skyBase = 0;
function skyAt(d: number) { const dd = d - skyBase; skyBase = d; for (const l of skyLayers) l.t.offset.x += dd * l.par; }
// petals on road
{ const g = new THREE.CircleGeometry(0.07, 5); const m1 = new THREE.MeshBasicMaterial({ color: 0xff9f1c }), m2 = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = 0; i < 900; i++) { const m = new THREE.Mesh(g, i % 3 ? m1 : m2); m.position.copy(at(rnd() * LEN, (rnd() - 0.5) * 6.6, 0.02)); m.rotation.x = -Math.PI / 2; scene.add(m); } }
// end glow
const endP = at(LEN - 2, 0, 2);
const endGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flame, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffe0a0 }));
endGlow.scale.set(40, 30, 1); endGlow.position.copy(endP); endGlow.visible = false; // no finish line in the endless run
warm.position.copy(endP).add(new THREE.Vector3(0, 4, 0));
// distant llama pinata (Gabe's cutout, unlit, uniform scale) hanging near the light
const farLlama = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6), new THREE.MeshBasicMaterial({ map: (() => { const t = tl.load(P); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, alphaTest: 0.35, fog: false, toneMapped: false }));
farLlama.position.copy(at(LEN - 8, 0, 6.5)); scene.add(farLlama);
// faint flying-chancla motif (gold chancla sprites, untouched art)
const decoChanclas: THREE.Sprite[] = [];
for (let i = 0; i < 40; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tl.load('/s3d/chancla_gold.webp'), transparent: true, opacity: 0.35, depthWrite: false, fog: true })); const pos = at(20 + i * (LEN / 40) + rnd() * 10, (i % 2 ? 1 : -1) * (0.5 + rnd() * 2.5), 8.5 + rnd() * 3); sp.position.copy(pos); sp.userData.y = pos.y; sp.scale.set(3, 3, 1); scene.add(sp); decoChanclas.push(sp); }
// (lander hall backdrop tried and dropped: it overpowered the night sky)

// moon + stars
const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(235,240,255,1)'); g.addColorStop(0.42, 'rgba(210,220,255,.95)'); g.addColorStop(0.5, 'rgba(140,200,220,.25)'); g.addColorStop(1, 'rgba(80,120,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }), fog: false, depthWrite: false }));
// moon: same screen spot as before but pushed behind the sky layers (-150..-135) and depth-tested so clouds/buildings cover it
moonSpr.scale.set(23.9, 23.9, 1); moonSpr.position.set(-26.06, 60.8, -152); moonSpr.renderOrder = -4.5; moonSpr.material.depthWrite = false; scene.add(camera); camera.add(moonSpr);
const starGeo = new THREE.BufferGeometry(); { const a: number[] = []; for (let i = 0; i < 500; i++) { const th = rnd() * Math.PI * 2, ph = rnd() * 0.45 + 0.08; a.push(Math.cos(th) * Math.cos(ph) * 150, Math.sin(ph) * 150, Math.sin(th) * Math.cos(ph) * 150); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd6ff, size: 0.9, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.7 })); scene.add(stars);
// ---------- animated smoke ----------
const smoke: { s: THREE.Sprite; v: number; ph: number }[] = [];
for (let i = 0; i < 70; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0.5 }));
  const sc = 4 + rnd() * 5; s.scale.set(sc, sc * 0.6, 1); scene.add(s);
  smoke.push({ s, v: 0.4 + rnd() * 0.8, ph: rnd() * 100 });
}

// ---------- sugar skulls (built in code, hinged jaw) ----------
const SK_SPLIT = 124 / 160, SK_W = 1.25 * 141 / 160, SK_H = 1.25;
const skTop = skTex.clone(); skTop.repeat.set(1, 1 - SK_SPLIT + 0); skTop.offset.set(0, 1 - (SK_SPLIT)); skTop.repeat.y = SK_SPLIT; skTop.offset.y = 1 - SK_SPLIT;
const skBot = skTex.clone(); skBot.repeat.set(1, 1 - SK_SPLIT); skBot.offset.set(0, 0);
const skMat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, fog: false, toneMapped: false });
const skTopMat = skMat(skTop), skBotMat = skMat(skBot), mouthMat = new THREE.MeshBasicMaterial({ color: 0x0a0410, fog: false });
function makeSkull() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(SK_W, SK_H * SK_SPLIT), skTopMat); top.position.y = SK_H * (1 - SK_SPLIT) / 2; g.add(top);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(SK_W * 0.5, SK_H * 0.16), mouthMat); mouth.position.set(SK_W * 0.06, -SK_H * (SK_SPLIT - 0.5) + SK_H * 0.0, -0.01); g.add(mouth);
  const jawPivot = new THREE.Group(); jawPivot.position.y = SK_H / 2 - SK_H * SK_SPLIT; g.add(jawPivot);
  const jaw = new THREE.Mesh(new THREE.PlaneGeometry(SK_W, SK_H * (1 - SK_SPLIT)), skBotMat); jaw.position.y = -SK_H * (1 - SK_SPLIT) / 2; jawPivot.add(jaw);
  top.renderOrder = jaw.renderOrder = 6; mouth.renderOrder = 5;
  (jawPivot as THREE.Group & { base: number }).base = jawPivot.position.y;
  scene.add(g); return { g, jawPivot };
}
const jawOpen = (j: THREE.Group, k: number) => { j.position.y = (j as THREE.Group & { base: number }).base - k * SK_H * 0.11; };


// ---------- physics (crate barricades) ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;

type Skull = { g: THREE.Group; jaw: THREE.Group; d: number; lane: number; alive: boolean; t: number; h: number }; // collectible calavera (not an enemy); h = height it sits at
type Pickup = { g: THREE.Group; d: number; lane: number; alive: boolean; t: number };
let pickups: Pickup[] = [];
type Pin = { m: THREE.Mesh; d: number; lane: number; alive: boolean; t: number };
type Crate = { body: CANNON.Body; mesh: THREE.Mesh; home: CANNON.Vec3; down: boolean; d: number; lane: number; gone?: boolean; top: number };
const crateGeo = new THREE.BoxGeometry(1, 1, 1);
type Shot = { body: CANNON.Body; mesh: THREE.Group; age: number; prev: THREE.Vector3 };
type Spit = { m: THREE.Mesh; from: THREE.Vector3; d: number; lane: number; t: number };
let skulls: Skull[] = [], pins: Pin[] = [], crates: Crate[] = [], shots: Shot[] = [], spits: Spit[] = [], statics: { b: CANNON.Body; d: number }[] = [];
const candy: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
const LANES = [-2, 0, 2];
// procedural wooden crate faces (canvas): planks w/ grain + seams, dark edge trim, diagonal brace, nails/metal corners. Night-toned.
function crateTex(tone: number, braceDir: number) {
  return canvasTex(256, 256, (c) => {
    let sd = 13 + tone * 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const base = tone ? [104, 66, 38] : [88, 54, 30];
    for (let k = 0; k < 5; k++) { // planks
      const y0 = k * 51.2, v = (r() - 0.5) * 22; c.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.7},${base[2] + v * 0.4})`; c.fillRect(0, y0, 256, 51.2);
      for (let g = 0; g < 9; g++) { c.strokeStyle = `rgba(30,14,6,${0.18 + r() * 0.22})`; c.lineWidth = 1 + r() * 1.5; c.beginPath(); const yy = y0 + 4 + r() * 43; c.moveTo(0, yy); for (let x = 0; x <= 256; x += 16) c.lineTo(x, yy + Math.sin(x / 30 + g + k) * 2.5); c.stroke(); }
      if (r() < 0.6) { const kx = 40 + r() * 176, ky = y0 + 12 + r() * 26; c.fillStyle = 'rgba(40,18,8,.55)'; c.beginPath(); c.ellipse(kx, ky, 7, 4, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(16,7,3,.9)'; c.fillRect(0, y0 + 49.2, 256, 2.4); // seam
    }
    c.save(); c.translate(128, 128); c.rotate(braceDir * Math.PI / 4); c.fillStyle = '#3e2412'; c.fillRect(-180, -15, 360, 30); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-180, 12, 360, 3); c.restore(); // brace
    c.strokeStyle = '#2a170b'; c.lineWidth = 26; c.strokeRect(13, 13, 230, 230); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; c.strokeRect(27, 27, 202, 202); // trim
    for (const [x, y] of [[0, 0], [206, 0], [0, 206], [206, 206]]) { c.fillStyle = '#4a4f57'; c.fillRect(x, y, 50, 50); c.fillStyle = '#2c3036'; c.fillRect(x + 4, y + 4, 42, 42); c.fillStyle = '#6a707a'; c.fillRect(x + 4, y + 4, 42, 4); } // metal corners
    c.fillStyle = '#9aa0a8'; for (const [x, y] of [[25, 25], [231, 25], [25, 231], [231, 231], [128, 13], [128, 243], [13, 128], [243, 128]]) { c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill(); } // nails
  });
}
const crateMat = [crateTex(0, 1), crateTex(1, -1)].map((t) => new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0x8a7468 })); // dim self-lit so the grain reads at night
const splinterMat = [new THREE.MeshLambertMaterial({ color: 0x5a3519 }), new THREE.MeshLambertMaterial({ color: 0x3a2210 })];
const splinters: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; life: number }[] = [];
function breakCrate(c: Crate) {
  const p = c.mesh.position.clone(), sc = c.mesh.scale.x; scene.remove(c.mesh); world.removeBody(c.body);
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06 + rnd() * 0.06, 0.04, 0.3 + rnd() * 0.4).scale(sc, sc, sc), splinterMat[i % 2]); m.position.copy(p).add(new THREE.Vector3((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5)); scene.add(m); splinters.push({ m, v: new THREE.Vector3((rnd() - 0.5) * 7, 2 + rnd() * 5, (rnd() - 0.5) * 7), w: new THREE.Vector3(rnd() * 14, rnd() * 14, rnd() * 14), life: 1.6 }); }
  spark(p, 10, 4, 0.3); shake = Math.max(shake, 0.25); beep(160, 0.12, 'square', 0.08);
}

function barricade(d: number, lane: number, n: number, sz = 0.8) {
  const f = frameAt(d), p = at(d, LANES[lane]);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), f.t.clone().setY(0).normalize().negate(), UP));
  const base = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3, 0.1, 3)), position: new CANNON.Vec3(p.x, p.y - 0.1, p.z) }); world.addBody(base); statics.push({ b: base, d });
  for (let k = 0; k < n; k++) {
    const off = n === 1 ? 0 : k < 2 ? (k - 0.5) * (sz + 0.05) : 0, y = k < 2 ? sz / 2 : sz * 1.5 + (k - 2) * sz;
    const pos = p.clone().addScaledVector(f.side, off).add(new THREE.Vector3(0, y, 0));
    const body = new CANNON.Body({ mass: 0.7, shape: new CANNON.Box(new CANNON.Vec3(sz / 2, sz / 2, sz / 2)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    body.quaternion.set(q.x, q.y, q.z, q.w); body.allowSleep = true; body.sleep(); world.addBody(body);
    const mesh = new THREE.Mesh(crateGeo, crateMat[(k + lane) % 2]); mesh.scale.setScalar(sz);
    scene.add(mesh); crates.push({ body, mesh, home: body.position.clone(), down: false, d, lane, top: y + sz / 2 });
  }
}
const skullGlowMat = new THREE.SpriteMaterial({ map: flame, color: 0x9fd8ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.85 });
function addSkull(d: number, lane: number, h = 0) { const s = makeSkull(); s.g.scale.multiplyScalar(0.62); const glow = new THREE.Sprite(skullGlowMat); glow.scale.setScalar(2.1); glow.position.z = -0.05; s.g.add(glow); skulls.push({ g: s.g, jaw: s.jawPivot, d, lane, alive: true, t: rnd() * 6, h }); }
// ---------- adobe / brick wall blockers ----------
type Wall = { bricks: THREE.Mesh[]; d: number; lane: number; breakable: boolean; alive: boolean; top: number };
let walls: Wall[] = [];
const brickGeo = new THREE.BoxGeometry(1, 1, 1);
const adobeMats = [0x4a3028, 0x553628, 0x3e2a24].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: 0x24160f }));
const stoneMats = [0x262230, 0x2c2834, 0x211d29].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: 0x0d0b12 }));
const WALL = { W: 1.75, H: 2.3, T: 0.45, rows: 7, cols: 4 };
function addWall(d: number, lane: number, breakable: boolean) { // breakable = crumbling adobe (cracked, ragged top, gaps); solid = dark mortared stone, chancla bounces off
  const f = frameAt(d), p = at(d, LANES[lane]), yaw = Math.atan2(f.t.x, f.t.z), bricks: THREE.Mesh[] = [];
  const bh = WALL.H / WALL.rows, bw = WALL.W / WALL.cols;
  for (let r = 0; r < WALL.rows; r++) for (let c = 0; c < WALL.cols + (r % 2); c++) {
    const top = r === WALL.rows - 1; if (breakable && top && Math.random() < 0.45) continue; // ragged crumbling top
    let x = (c - (WALL.cols - 1) / 2 - (r % 2) * 0.5) * bw, w = bw * 0.94; if (Math.abs(x) + w / 2 > WALL.W / 2) { const e = WALL.W / 2 - (Math.abs(x) - w / 2); x = Math.sign(x) * (WALL.W / 2 - e / 2); w = e; } if (w < 0.08) continue;
    const m = new THREE.Mesh(brickGeo, pick(breakable ? adobeMats : stoneMats));
    const j = breakable ? 0.06 : 0.015; m.scale.set(w - (breakable ? Math.random() * 0.06 : 0), bh * 0.92, WALL.T * (breakable ? 0.8 + Math.random() * 0.3 : 1));
    m.position.copy(p).addScaledVector(f.side, x).add(new THREE.Vector3(0, r * bh + bh / 2, 0)); m.rotation.set((Math.random() - 0.5) * j, yaw + (Math.random() - 0.5) * j * 2, (Math.random() - 0.5) * j);
    scene.add(m); bricks.push(m);
  }
  if (!breakable) { const cap = new THREE.Mesh(brickGeo, stoneMats[2]); cap.scale.set(WALL.W + 0.1, 0.14, WALL.T + 0.12); cap.position.copy(p).add(new THREE.Vector3(0, WALL.H + 0.07, 0)); cap.rotation.y = yaw; scene.add(cap); bricks.push(cap); }
  walls.push({ bricks, d, lane, breakable, alive: true, top: WALL.H + (breakable ? 0 : 0.14) });
}
function breakWall(w: Wall) {
  w.alive = false; const f = frameAt(w.d);
  for (const m of w.bricks) { const v = f.t.clone().multiplyScalar(2 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 4, (Math.random() - 0.5) * 2)); m.scale.multiplyScalar(0.7 + Math.random() * 0.3); splinters.push({ m, v, w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 1.6 + Math.random() * 0.6 }); }
  const c = at(w.d, LANES[w.lane], 1); for (let i = 0; i < 3; i++) spark(c, 14, 3, 0.5); shake = 0.45; slow = 0.35; beep(110, 0.3, 'sawtooth', 0.12);
}
function addPin(d: number, lane: number) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), sMat(P)); scene.add(m); pins.push({ m, d, lane, alive: true, t: rnd() * 6 }); }

// ---------- endless run: procedural spawner, cars, ramps, jump, score multiplier ----------
// rusty abandoned cars (procedural): dented body (jittered box verts), cabin, dark/broken glass, flat tyres. No brands.
const rustTex = canvasTex(256, 128, (c) => {
  c.fillStyle = '#4a2c1c'; c.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 900; i++) { const r = Math.random(); c.fillStyle = r < 0.4 ? `rgba(120,58,22,${0.3 + Math.random() * 0.4})` : r < 0.7 ? `rgba(40,30,28,${0.3 + Math.random() * 0.4})` : `rgba(70,80,84,${0.25 + Math.random() * 0.3})`; const s = 2 + Math.random() * 9; c.fillRect(Math.random() * 256, Math.random() * 128, s, s * (0.4 + Math.random())); }
  c.fillStyle = 'rgba(10,6,4,.6)'; c.fillRect(0, 60, 256, 3); c.fillRect(120, 0, 3, 128); // panel seams
});
const CAR_PAINT = [0x3a4a5a, 0x5a2a2a, 0x3a4a34, 0x5a4a2a, 0x2a2a3a];
const carMatCache = CAR_PAINT.map((c) => new THREE.MeshLambertMaterial({ map: rustTex, color: c, emissiveMap: rustTex, emissive: 0x403830 }));
const glassMat = new THREE.MeshBasicMaterial({ color: 0x101820 }), tyreMat = new THREE.MeshBasicMaterial({ color: 0x0c0a0a });
const shardMat = new THREE.MeshBasicMaterial({ color: 0x8aa0b0, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
const CAR = { L: 3.6, W: 1.7, hood: 0.95, roof: 1.45, cabL: 1.9, cabOff: -0.2, hp: 3 };
type Car = { g: THREE.Group; d: number; lane: number; hp: number; alive: boolean; mat: THREE.Material };
type Ramp = { m: THREE.Mesh; d: number; lane: number };
let cars: Car[] = [], ramps: Ramp[] = [];
function dented(w: number, h: number, l: number) { const g = new THREE.BoxGeometry(w, h, l, 3, 2, 5), p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) { const k = 0.06 * (Math.random() - 0.3); p.setXYZ(i, p.getX(i) * (1 + k * 0.4), p.getY(i) + (p.getY(i) > 0 ? -Math.random() * 0.07 : 0), p.getZ(i) * (1 + k * 0.2)); } g.computeVertexNormals(); return g; }
function addCar(d: number, lane: number) {
  const g = new THREE.Group(), mat = carMatCache[Math.floor(Math.random() * carMatCache.length)];
  const body = new THREE.Mesh(dented(CAR.W, CAR.hood - 0.3, CAR.L), mat); body.position.y = 0.3 + (CAR.hood - 0.3) / 2; g.add(body);
  const cab = new THREE.Mesh(dented(CAR.W * 0.9, CAR.roof - CAR.hood, CAR.cabL), mat); cab.position.set(0, (CAR.hood + CAR.roof) / 2, CAR.cabOff); g.add(cab);
  for (const z of [CAR.cabOff + CAR.cabL / 2 + 0.01, CAR.cabOff - CAR.cabL / 2 - 0.01]) if (Math.random() < 0.75) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(CAR.W * 0.78, (CAR.roof - CAR.hood) * 0.75), glassMat); gl.position.set(0, (CAR.hood + CAR.roof) / 2, z); if (z < 0) gl.rotation.y = Math.PI; g.add(gl); }
  for (const sx of [-1, 1]) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(CAR.cabL * 0.8, (CAR.roof - CAR.hood) * 0.7), glassMat); gl.position.set(sx * (CAR.W * 0.45 + 0.01), (CAR.hood + CAR.roof) / 2, CAR.cabOff); gl.rotation.y = sx * Math.PI / 2; g.add(gl); }
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10).rotateZ(Math.PI / 2), tyreMat); t.position.set(x * CAR.W / 2, Math.random() < 0.3 ? 0.22 : 0.32, z * CAR.L * 0.32); g.add(t); }
  const f = frameAt(d); g.position.copy(at(d, LANES[lane])); g.lookAt(g.position.clone().add(f.t.clone().setY(0))); g.rotateY((Math.random() - 0.5) * 0.12); g.rotateZ((Math.random() - 0.5) * 0.04);
  scene.add(g); cars.push({ g, d, lane, hp: CAR.hp, alive: true, mat });
}
const rampGeo = (() => { const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3.2, 0), new THREE.Vector2(3.2, 1.0)]); const g = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false }); g.translate(0, 0, -0.8); g.rotateY(-Math.PI / 2); return g; })();
const RAMP = { L: 3.2, H: 1.0, W: 1.6, launchV: 10.5 };
function addRamp(d: number, lane: number) { const m = new THREE.Mesh(rampGeo, crateMat[0]); const f = frameAt(d); m.position.copy(at(d, LANES[lane])); m.lookAt(m.position.clone().add(f.t.clone().setY(0))); m.rotateY(Math.PI); scene.add(m); ramps.push({ m, d, lane }); }
function groundAt(d: number, x: number) { // height of what's under the runner: car hood/roof or ramp slope
  let g = 0, ramp = false;
  for (const c of cars) if (c.alive && Math.abs(d - c.d) < CAR.L / 2 && Math.abs(x - LANES[c.lane]) < 0.95) g = Math.max(g, Math.abs(d - c.d + CAR.cabOff) < CAR.cabL / 2 ? CAR.roof : CAR.hood);
  for (const r of ramps) { const u = d - r.d; if (u >= 0 && u <= RAMP.L && Math.abs(x - LANES[r.lane]) < 0.85) { const h = (u / RAMP.L) * RAMP.H; if (h >= g) { g = h; ramp = true; } } }
  return { g, ramp };
}
function breakCar(c: Car) {
  c.alive = false; const p = c.g.position.clone().add(new THREE.Vector3(0, 0.9, 0)); scene.remove(c.g);
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + Math.random() * 0.2, 0.1 + Math.random() * 0.2), shardMat); m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.6, (Math.random() - 0.5) * 2)); scene.add(m); splinters.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8), w: new THREE.Vector3(Math.random() * 16, Math.random() * 16, 0), life: 1.4 }); }
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5 + Math.random() * 0.6, 0.05, 0.4 + Math.random() * 0.5), c.mat); m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 3)); scene.add(m); splinters.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 5, (Math.random() - 0.5) * 6), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 1.8 }); }
  spark(p, 20, 6, 0.4); shake = Math.max(shake, 0.45); slow = 0.35; beep(110, 0.3, 'sawtooth', 0.12);
}
// ---- run state ----
let score = 0, best = +(localStorage.getItem('s3d_best') || 0), ammo = 0, playing = false, lane = 1, laneX = 0, dist = 0, kills = 0, runT = 0, mult = 1, spd = 6.8, god = false;
let throwCD = 0, heroY = 0, heroVY = 0, wasRamp = false, spawnD = 0;
const SPEED = 6.8; // base forward speed (was 5.2 before the fast-run pass)
const JUMP_V = 9.0, GRAV = 24, STEP = 0.55; // apex 1.69, airtime 0.75 s
const multAt = (t: number) => Math.min(5, 1 + 0.5 * Math.floor(t / 15)); // +0.5x every 15 s, cap 5x (reached at 2:00)
const speedAt = (t: number) => SPEED * (1 + Math.min(0.2, t / 600)); // gentle ramp: +2%/min... +20% max at 2:00
const PTS = { skull: 50, crate: 40, wall: 80, carHit: 10, car: 150, pinata: 120 }; // all × multiplier; skulls are collected, never shot
function clearRun() {
  for (const s of skulls) scene.remove(s.g); for (const p of pins) scene.remove(p.m); for (const k of pickups) scene.remove(k.g); pickups = [];
  for (const c of crates) if (!c.gone) { scene.remove(c.mesh); world.removeBody(c.body); } for (const b of statics) world.removeBody(b.b);
  for (const s of shots) { scene.remove(s.mesh); world.removeBody(s.body); } for (const s of spits) scene.remove(s.m);
  for (const c of cars) if (c.alive) scene.remove(c.g); for (const r of ramps) scene.remove(r.m);
  for (const w of walls) if (w.alive) for (const m of w.bricks) scene.remove(m);
  skulls = []; pins = []; crates = []; shots = []; spits = []; statics = []; cars = []; ramps = []; walls = [];
}
// ---- endless spawner: one pattern per gap (10-18u, scaled with speed), never more than 2 lanes blocked inside a pattern ----
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const others = (l: number) => [0, 1, 2].filter((x) => x !== l);
function trail(d: number, lane: number, n: number, gap = 2.4, h = 0) { for (let k = 0; k < n; k++) addSkull(d + k * gap, lane, h); }
let lastKind = '', forceKind = '';
const PAT: Record<string, (d: number) => void> = Object.fromEntries(['trail', 'crate', 'car', 'forced', 'route', 'onebreak', 'rampcrate', 'pin'].map((k) => [k, (d: number) => { forceKind = k; spawnPattern(d); }]));
function spawnPattern(d: number) { // small route puzzles; every pattern leaves at least one passable line (open lane, breakable blocker, or jumpable car/ramp)
  const t = runT, L = Math.floor(Math.random() * 3), o = others(L), w = Math.random();
  const table: [string, number][] = [['trail', 1.0], ['crate', 0.9], ['car', t > 6 ? 0.8 : 0.3], ['forced', t > 8 ? 1.1 : 0.4], ['route', 1.1], ['onebreak', t > 12 ? 1.0 : 0.3], ['rampcrate', 0.6], ['pin', 0.25]];
  let acc = 0; const tot = table.reduce((a, b) => a + b[1], 0); let kind = 'trail'; for (const [k, wt] of table) { acc += wt / tot; if (w < acc) { kind = k; break; } }
  if (kind === lastKind && kind !== 'trail') kind = 'trail'; lastKind = kind;
  if (forceKind) { kind = forceKind; forceKind = ''; }
  switch (kind) {
    case 'trail': { const n = 3 + Math.floor(Math.random() * 3); if (Math.random() < 0.5) trail(d, L, n); else { trail(d, L, 2); trail(d + 5, pick(o), n - 2); } return n * 2.4 + 3; } // skulls on the ground, sometimes swapping lanes
    case 'crate': barricade(d, L, pick([1, 2, 3]), pick([0.7, 0.8, 0.9])); addSkull(d + 3, L); return 5; // skull behind the crate = reward for clearing it
    case 'car': addCar(d + 1.8, L); trail(d + 0.8, L, 2, 1.4, CAR.roof); return 6; // hop on the roof to grab the skulls
    case 'forced': { // every lane blocked by something breakable: throw (or jump the car)
      const kinds = ['wall', 'wall', 'crate', 'car'].sort(() => Math.random() - 0.5).slice(0, 3);
      kinds.forEach((k, i) => { if (k === 'wall') addWall(d, i, true); else if (k === 'crate') barricade(d, i, 3, 0.8); else addCar(d + 1.2, i); });
      addSkull(d + 3.5, L); return 7; }
    case 'route': { // high road: ramp -> car roof with skulls; low road: ground lane with one skull; third lane walled off
      const [g, x] = Math.random() < 0.5 ? o : [o[1], o[0]];
      addRamp(d, L); addCar(d + RAMP.L + 3.0, L); trail(d + RAMP.L - 0.5, L, 2, 1.6, 1.9); trail(d + RAMP.L + 2.4, L, 2, 1.3, CAR.roof);
      addSkull(d + 5, g); addWall(d + 4, x, false); return RAMP.L + 8; }
    case 'onebreak': { // two solid stone walls, one crumbling adobe: find the soft one
      const soft = Math.floor(Math.random() * 3); for (let i = 0; i < 3; i++) addWall(d, i, i === soft); addSkull(d + 3, soft); addSkull(d + 5, soft); return 7; }
    case 'rampcrate': addRamp(d, L); barricade(d + RAMP.L + 2.5, L, 3, 0.8); trail(d + RAMP.L, L, 3, 1.4, 2.2); return 8; // jump it via the ramp (skulls in the air) or break it
    default: addPin(d + 2, L); return 4; // pinata = optional bonus up high, not an enemy
  }
}
function spawnAhead() {
  while (spawnD < dist + 95) { const used = spawnPattern(spawnD); spawnD += used + (10 + Math.random() * 8) * (spd / SPEED) * 0.75; }
}
function despawn() { // recycle everything that's behind the runner
  const gone = dist - 12;
  skulls = skulls.filter((k) => { if (k.d < gone) { scene.remove(k.g); return false; } return true; });
  pins = pins.filter((p) => { if (p.d < gone) { scene.remove(p.m); return false; } return true; });
  pickups = pickups.filter((p) => { if (p.d < gone) { scene.remove(p.g); return false; } return true; });
  crates = crates.filter((c) => { if (c.d < gone) { if (!c.gone) { scene.remove(c.mesh); world.removeBody(c.body); } return false; } return true; });
  statics = statics.filter((s) => { if (s.d < gone) { world.removeBody(s.b); return false; } return true; });
  cars = cars.filter((c) => { if (c.d < gone) { if (c.alive) scene.remove(c.g); return false; } return true; });
  walls = walls.filter((w) => { if (w.d < gone) { if (w.alive) for (const m of w.bricks) scene.remove(m); return false; } return true; });
  ramps = ramps.filter((r) => { if (r.d < gone) { scene.remove(r.m); return false; } return true; });
}
function startRun() {
  clearRun(); kills = 0; score = 0; runT = 0; mult = 1; spd = SPEED; heroY = 0; heroVY = 0; wasRamp = false;
  turnT = 0; runPh = 0; ammo = 10; lane = 1; laneX = 0; dist = 0; spawnD = 24; playing = true;
  spawnAhead(); $('end').classList.add('hidden'); hud();
}
function hud() { $('stat').textContent = String(score); $('mult').textContent = `×${mult.toFixed(1).replace('.0', '')}`; $('ammo').textContent = '∞'; }
function addScore(n: number) { score += Math.round(n * mult); hud(); const e = $('stat'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
function crash() { // one crash ends the run (Gabe's rule); no hearts
  if (god || !playing) return; playing = false; shake = 0.6; beep(90, 0.4, 'sawtooth', 0.14); stage.style.boxShadow = 'inset 0 0 90px red'; setTimeout(() => (stage.style.boxShadow = ''), 300);
  if (score > best) { best = score; localStorage.setItem('s3d_best', String(best)); }
  $('stars').innerHTML = ''; $('endTitle').textContent = '¡Ay, no! Game over'; $('endMsg').innerHTML = `Score <b>${score}</b> · best ${best}<br><small>survived ${Math.floor(runT)} s · reached ×${mult.toFixed(1).replace('.0', '')}</small>`;
  $('next').classList.add('hidden'); $('retry').textContent = 'Run again ⏎';
  setTimeout(() => $('end').classList.remove('hidden'), 600);
}
$('retry').onclick = () => startRun();
$('next').onclick = () => startRun();
addEventListener('keydown', (e) => { if (e.key === 'Enter' && !playing && !$('end').classList.contains('hidden')) startRun(); });
function jump() { if (!playing || turnT < TURN.order.length / 10) return; if (heroVY === 0 && Math.abs(heroY - groundAt(dist, laneX).g) < 0.05) { heroVY = JUMP_V; beep(520, 0.08, 'triangle', 0.05); } }

// ---------- chancla ----------
function chanclaMesh(dark = false) {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.72), new THREE.MeshStandardMaterial({ color: dark ? 0x3a8a3a : 0xe2197a, emissive: dark ? 0x1a4a1a : 0x300010 }));
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: 0xffd23f })); top.position.y = 0.04;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1ec8c8 })); strap.position.set(0, 0.05, 0.08); strap.rotation.y = Math.PI / 2;
  g.add(sole, top, strap); return g;
}
const goldTex = (() => { const t = tl.load('/s3d/chancla_gold.webp'); t.colorSpace = THREE.SRGBColorSpace; return t; })();
void chanclaMesh;
function goldChancla() {
  const g = new THREE.Group();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldTex, fog: false, toneMapped: false, depthWrite: false }));
  sp.scale.set(1.5, 1.5, 1); sp.name = 'gold'; g.add(sp); return g;
}
function throwChancla(side: number, up: number) {
  if (!playing || clock < throwCD) return; // the chancla is a tool: unlimited, 0.3 s cooldown
  throwCD = clock + 0.3; beep(520, 0.12, 'sawtooth', 0.05);
  const o = at(dist + 1, laneX, 1.4 + heroY), f = frameAt(dist + 1), fwd = 9 + up * 20;
  let v = f.t.clone().multiplyScalar(fwd + spd).addScaledVector(f.side, side * 16).addScaledVector(UP, 2.5 + up * 7);
  // aim assist: pick the live target closest to the swipe's line, then solve a real arc to it (scale-free: swipe is normalized to the canvas column)
  let best: THREE.Vector3 | null = null, bd = 0.22;
  const dir = new THREE.Vector3(v.x, 0, v.z).normalize();
  const cands = [...walls.filter((q) => q.alive && q.breakable).map((q) => at(q.d, LANES[q.lane], 1.0)), ...crates.filter((c) => !c.down).map((c) => c.mesh.position), ...cars.filter((c) => c.alive).map((c) => c.g.position.clone().add(new THREE.Vector3(0, 0.8, 0)))]; // only breakable blockers (adobe walls, crates, cars); no skulls, no pinatas
  for (const tp of cands) { const h = new THREE.Vector3(tp.x - o.x, 0, tp.z - o.z); const L = h.length(); if (L < 2.5 || L > 32) continue; const e = 1 - h.normalize().dot(dir); if (e < bd) { bd = e; best = tp; } }
  if (best) { const h = new THREE.Vector3(best.x - o.x, 0, best.z - o.z), L = h.length(), T = L / (fwd + spd); v = h.multiplyScalar(1 / T); v.y = (best.y - o.y + 4.91 * T * T) / T; }
  const body = new CANNON.Body({ mass: 0.5, shape: new CANNON.Box(new CANNON.Vec3(0.18, 0.06, 0.4)), position: new CANNON.Vec3(o.x, o.y, o.z) });
  body.velocity.set(v.x, v.y, v.z); body.angularVelocity.set(-14, (rnd() - 0.5) * 6, side * 4);
  body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => { if (crates.some((c) => c.body === e.body) && Math.abs(e.contact.getImpactVelocityAlongNormal()) > 4) { shake = 0.3; slow = 0.3; beep(140, 0.15, 'square', 0.1); } });
  const s: Shot = { body, mesh: goldChancla(), age: 0, prev: o.clone() }; world.addBody(body); scene.add(s.mesh); shots.push(s);
}

// ---------- input ----------
let start: { x: number; y: number } | null = null;

// Thumb controls (phones): track the last move so a browser-cancelled gesture (iOS pointercancel) still resolves;
// block native scroll/zoom with non-passive touch listeners; a quick tap throws straight ahead.
let lastP: { x: number; y: number } | null = null, startT = 0;
const uiHit = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('a,button,.screen,#comic');
stage.addEventListener('pointerdown', (e) => { if (!playing || uiHit(e.target)) return; start = lastP = { x: e.clientX, y: e.clientY }; startT = performance.now(); });
addEventListener('pointermove', (e) => { if (start) lastP = { x: e.clientX, y: e.clientY }; });
const endGesture = (x: number, y: number) => {
  if (!start) return; const dx = x - start.x, dy = y - start.y, quick = performance.now() - startT < 400; start = lastP = null;
  // swipe left/right = lane, swipe up = JUMP, quick tap = THROW (aimed toward the tapped side; aim assist snaps to the nearest target)
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.2) dodge(dx > 0 ? 1 : -1);
  else if (-dy > 25) jump();
  else if (quick && Math.abs(dx) < 14 && Math.abs(dy) < 14) { const r = stage.getBoundingClientRect(); throwChancla(((x - r.left) / r.width - 0.5) * 0.5, 0.3); }
};
addEventListener('pointerup', (e) => endGesture(e.clientX, e.clientY));
addEventListener('pointercancel', () => { if (lastP) endGesture(lastP.x, lastP.y); });
const noScroll = (e: TouchEvent) => { if (!uiHit(e.target)) e.preventDefault(); };
stage.addEventListener('touchstart', noScroll, { passive: false }); stage.addEventListener('touchmove', noScroll, { passive: false });
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') dodge(-1); if (k === 'arrowright' || k === 'd') dodge(1); if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); jump(); } if (k === 'f' || k === 'x' || k === 'arrowdown' || k === 's') throwChancla(0, 0.3); });
function dodge(d: number) { if (!playing) return; lane = Math.max(0, Math.min(2, lane + d)); beep(300, 0.06, 'triangle', 0.05); }

// ---------- effects ----------
let shake = 0, slow = 0;
const RAINBOW = [0xe2197a, 0xff9f1c, 0xffd23f, 0x1ec8c8, 0xb04bff];
const sparkMats = RAINBOW.map((c) => new THREE.SpriteMaterial({ map: flame, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
const sparks: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
function spark(p: THREE.Vector3, n: number, speed: number, size = 0.35) { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(sparkMats[(Math.random() * 5) | 0]); s.position.copy(p); s.scale.setScalar(size); scene.add(s); sparks.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.3) * speed, (Math.random() - 0.5) * speed), life: 0.6 }); } }
function burst(p: THREE.Vector3, n = 50) {
  spark(p, 24, 6, 0.5);
  const cols = [0xff3d7f, 0xffd23f, 0x1ec8c8, 0x8ae234, 0xb04bff, 0xff9f1c];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: cols[i % 6] })); m.position.copy(p); scene.add(m); candy.push({ m, v: new THREE.Vector3((rnd() - 0.5) * 8, rnd() * 6, (rnd() - 0.5) * 8), life: 2 }); }
}

// ---------- comic backgrounds rendered from this scene ----------
function inkify(src: HTMLCanvasElement) {
  const w = src.width, h = src.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!; c.drawImage(src, 0, 0); const im = c.getImageData(0, 0, w, h), d = im.data;
  const lum = new Float32Array(w * h); for (let i = 0; i < w * h; i++) lum[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = lum[i + 1] - lum[i - 1], gy = lum[i + w] - lum[i - w], e = Math.hypot(gx, gy), o = i * 4;
    for (let k = 0; k < 3; k++) d[o + k] = Math.min(255, Math.round(d[o + k] / 48) * 48 * 1.15);
    if (e > 38) { d[o] = 8; d[o + 1] = 2; d[o + 2] = 14; }
  }
  c.putImageData(im, 0, 0); return cv.toDataURL('image/jpeg', 0.85);
}
function renderComicBgs() {
  const hideables: THREE.Object3D[] = [...pins.map((p) => p.m), hero, shadow];
  hideables.forEach((o) => (o.visible = false));
  const w = 360, h = 480, cam = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  const old = new THREE.Vector2(); renderer.getSize(old); const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  const sk = makeSkull(); sk.g.position.copy(at(30, 0.8, 1.6)); jawOpen(sk.jawPivot, 1);
  const shots2: [string, THREE.Vector3, THREE.Vector3, number][] = [
    ['hill', at(0, -3, 9), at(70, 0, -6), 0], ['smoke', at(20, 2.5, 1.2), at(34, -1, 1.5), 0], ['road', at(52, 0, 2.5), at(70, 0, 0.5), 0],
    ['skull', at(27.5, -0.4, 1.4), at(30, 0.8, 1.6), 0], ['glow', at(LEN - 30, 1.5, 3), at(LEN - 2, 0, 2), 1],
  ];
  for (const [k, pos, look, bright] of shots2) { setBright(bright); cam.position.copy(pos); cam.lookAt(look); updateSmoke(pos, 0); renderer.render(scene, cam); comicBg[k] = inkify(renderer.domElement); }
  scene.remove(sk.g); setBright(0); hideables.forEach((o) => (o.visible = true));
  renderer.setPixelRatio(pr); renderer.setSize(old.x, old.y, false);
}
function setBright(k: number) {
  hemi.intensity = 0.55 + k * 1.1; moon.intensity = 0.9 - k * 0.4; warm.intensity = k * 900;
  (scene.fog as THREE.Fog).color.copy(FOG_DARK).lerp(FOG_END, k); (scene.background as THREE.Color).copy(FOG_DARK).lerp(FOG_END, k);
  (scene.fog as THREE.Fog).far = 62 + k * 50;
  skyGrad.material.color.setRGB(1, 1, 1).lerp(new THREE.Color(0xffd0a0), k * 0.6);
}
let clock = 0;
function updateSmoke(center: THREE.Vector3, dt: number) {
  smoke.forEach((sm, i) => {
    sm.ph += dt * sm.v;
    const d0 = ((dist + (i / smoke.length) * 40 - 6) % LEN + LEN) % LEN;
    const x = ((sm.ph * 1.5 + i * 3.7) % 24) - 12;
    const p = at(d0, x, 0.6 + Math.sin(sm.ph + i) * 0.4);
    sm.s.position.copy(p); sm.s.material.opacity = 0.32 + Math.sin(sm.ph * 0.7 + i) * 0.12; sm.s.material.rotation = sm.ph * 0.1;
  });
  void center;
}

// ---------- loop ----------
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now();
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), UPH = new THREE.Vector3(0, 0.8, 0);
function frame(now: number) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (paused) dt = 0;
  if (slow > 0) { slow -= dt; dt *= 0.3; }
  clock += dt;
  world.step(1 / 120, dt, 6);
  const running = heroFrame(dt);
  if (playing && running) { runT += dt; spd = speedAt(runT); dist += spd * dt; const m2 = multAt(runT); if (m2 !== mult) { mult = m2; hud(); const e = $('mult'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); beep(880, 0.15, 'triangle', 0.06); } spawnAhead(); despawn(); }
  laneX += (LANES[lane] - laneX) * Math.min(1, dt * 13); // was dt*10: snappier lane change for the faster run
  // jump / car roofs / ramps
  { const { g, ramp } = groundAt(dist, laneX), prev = heroY;
    if (wasRamp && !ramp && heroVY === 0 && playing) { heroVY = RAMP.launchV; beep(700, 0.12, 'triangle', 0.06); } // left the ramp lip: launch
    if (heroVY !== 0 || heroY > g + 0.02) { heroVY -= GRAV * dt; heroY += heroVY * dt; if (heroY <= g) { if (prev >= g - STEP) { heroY = g; heroVY = 0; } else if (playing) crash(); else { heroY = g; heroVY = 0; } } }
    else if (g > heroY + STEP) { if (playing) crash(); }
    else heroY = g;
    wasRamp = ramp && heroVY === 0 && heroY > 0.3; }
  const me = at(dist, laneX, 1.2);
  // shots
  for (const s of shots) {
    s.age += dt;
    s.mesh.position.set(s.body.position.x, s.body.position.y, s.body.position.z); { const g = s.mesh.children[0] as THREE.Sprite; g.material.rotation -= dt * 14; if (s.age > 0.12 && s.age < 2) spark(s.mesh.position, 1, 0.6, 0.28); }
    const seg = new THREE.Line3(s.prev.clone(), s.mesh.position.clone()); s.prev.copy(s.mesh.position);
    const near = (q: THREE.Vector3, r: number) => seg.closestPointToPoint(q, true, tmp).distanceTo(q) < r;
    for (const w of walls) if (w.alive && s.age < 2.5 && near(at(w.d, LANES[w.lane], 1.0), 1.1)) { s.age = 9; if (w.breakable) { kills++; breakWall(w); addScore(PTS.wall); } else { spark(at(w.d, LANES[w.lane], 1.2), 8, 3, 0.25); beep(300, 0.06, 'square', 0.05); } }
    for (const p of pins) if (p.alive && near(p.m.position, 1.2)) { p.alive = false; kills++; scene.remove(p.m); burst(p.m.position, 70); addScore(PTS.pinata); shake = 0.4; slow = 0.5; beep(660, 0.25, 'triangle', 0.1); }
    // swept test for crates too: a fast chancla (~22 u/s) can tunnel through a 0.8 crate between physics steps, so the hit never registered
    for (const c of crates) if (!c.down && s.age < 2.5 && near(c.mesh.position, 0.9)) { s.age = 9; c.body.wakeUp(); c.body.velocity.set(s.body.velocity.x * 0.4, 3, s.body.velocity.z * 0.4); c.body.position.y += 0.7; shake = 0.3; slow = 0.3; beep(140, 0.15, 'square', 0.1); }
    for (const c of cars) if (c.alive && s.age < 2.5 && near(tmp2.copy(c.g.position).add(UPH), 1.25)) { s.age = 9; c.hp--; addScore(PTS.carHit); spark(tmp2, 12, 4, 0.3); beep(240, 0.1, 'square', 0.08); c.g.position.y -= 0.05; if (c.hp <= 0) { kills++; breakCar(c); addScore(PTS.car); } }
  }
  shots = shots.filter((s) => { if (s.age > 3) { world.removeBody(s.body); scene.remove(s.mesh); return false; } return true; });
  for (const c of crates) {
    if (c.gone) continue;
    c.mesh.position.set(c.body.position.x, c.body.position.y, c.body.position.z); c.mesh.quaternion.set(c.body.quaternion.x, c.body.quaternion.y, c.body.quaternion.z, c.body.quaternion.w);
    if (!c.down && c.body.position.distanceTo(c.home) > 0.6) { c.down = true; kills++; if (playing) addScore(PTS.crate); }
    if (c.down) { c.gone = true; breakCrate(c); }
  }
  // calaveras: glowing collectibles sitting along the route (ground, car roofs, mid-air over ramps)
  for (const k of skulls) {
    if (!k.alive) continue; k.t += dt;
    k.g.position.copy(at(k.d, LANES[k.lane], k.h + 0.5 + Math.sin(k.t * 2.2) * 0.08));
    k.g.lookAt(camera.position); jawOpen(k.jaw, Math.max(0, Math.sin(k.t * 3)) * 0.4);
    if (playing && Math.abs(k.d - dist) < 0.9 && Math.abs(LANES[k.lane] - laneX) < 0.9 && k.h + 0.5 > heroY - 0.3 && k.h + 0.5 < heroY + 1.9) { k.alive = false; scene.remove(k.g); addScore(PTS.skull); spark(k.g.position, 24, 4, 0.4); beep(1180, 0.1, 'triangle', 0.07); }
  }
  for (const w of walls) if (playing && w.alive && Math.abs(w.d - dist) < 0.45 && Math.abs(LANES[w.lane] - laneX) < 1.1 && heroY < w.top - 0.1) crash();
  for (const p of pins) { if (!p.alive) continue; p.t += dt; p.m.position.copy(at(p.d, LANES[p.lane] + Math.sin(p.t * 1.3) * 0.5, 3.2)); p.m.lookAt(tmp.copy(camera.position).setY(p.m.position.y)); p.m.rotation.z = Math.sin(p.t * 1.3) * 0.15; }
  // crate collisions (jumping over a stack clears it)
  for (const c of crates) if (playing && !c.down && Math.abs(c.d - dist) < 0.6 && lane === c.lane && heroY < c.top - 0.1) crash();
  for (const sp of splinters) { sp.life -= dt; sp.v.y -= 9.8 * dt; sp.m.position.addScaledVector(sp.v, dt); sp.m.rotation.x += sp.w.x * dt; sp.m.rotation.y += sp.w.y * dt; sp.m.rotation.z += sp.w.z * dt; if (sp.m.position.y < at(dist, 0).y - 2) sp.life = 0; }
  for (let i = splinters.length - 1; i >= 0; i--) if (splinters[i].life <= 0) { scene.remove(splinters[i].m); splinters.splice(i, 1); }
  // spit projectiles
  for (const s of spits) { s.t += dt / 1.4; const k = Math.min(1, s.t); const to = at(dist + 0.5, LANES[s.lane], 1.2); s.m.position.lerpVectors(s.from, to, k); s.m.position.y += Math.sin(k * Math.PI) * 1.5; s.m.rotation.x += dt * 12;
    }
  spits = spits.filter((s) => { if (s.t >= 1) { scene.remove(s.m); return false; } return true; });
  $('warn').style.display = spits.length ? 'block' : 'none';
  for (const sp of sparks) { sp.life -= dt; sp.s.position.addScaledVector(sp.v, dt); sp.s.scale.multiplyScalar(0.97); }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) { scene.remove(sparks[i].s); sparks.splice(i, 1); }
  for (const pk of pickups) { if (!pk.alive) continue; pk.t += dt; pk.g.position.copy(at(pk.d, LANES[pk.lane], 1.1 + Math.sin(pk.t * 3) * 0.12)); (pk.g.children[1] as THREE.Sprite).material.rotation = pk.t * 2; (pk.g.children[0] as THREE.Sprite).material.color.setHex(RAINBOW[Math.floor(pk.t * 4) % 5]);
    if (playing && Math.abs(pk.d - dist) < 0.8 && Math.abs(LANES[pk.lane] - laneX) < 1) { pk.alive = false; scene.remove(pk.g); ammo += 3; hud(); spark(pk.g.position, 30, 5, 0.45); beep(990, 0.12, 'triangle', 0.08); const a = $('ammo').parentElement!; a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop'); } }
  for (const c of candy) { c.life -= dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 5; }
  for (let i = candy.length - 1; i >= 0; i--) if (candy[i].life <= 0) { scene.remove(candy[i].m); candy.splice(i, 1); }
  flames.forEach((f, i) => f.scale.set(0.35 + Math.sin(clock * 13 + i) * 0.04, 0.5 + Math.sin(clock * 17 + i * 2) * 0.07, 1));
  swayFlags(clock); updateSky(dt); skyAt(dist);
  decoChanclas.forEach((c, i) => { c.material.rotation = clock * (0.6 + i * 0.07); c.position.y = c.userData.y + Math.sin(clock + i) * 0.6; });
  lantern.position.copy(at(dist + 3, laneX * 0.5, 2.2 + heroY));
  updateSmoke(me, dt);
  // camera behind & above, looking down the hill
  const f = frameAt(dist), back = at(dist - 4.5, laneX * 0.85, 3.4 + heroY * 0.6), look = at(dist + 9, laneX * 0.5, 0.4 + heroY * 0.4);
  void f;
  const sx = shake > 0 ? (rnd() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.5);
  camera.position.copy(back).add(new THREE.Vector3(sx, sx * 0.6, 0)); camera.lookAt(look);
  if (camOverride) { const o = camOverride; camera.position.copy(at(o[0], o[1], o[2])); camera.lookAt(at(o[0] + o[3], o[4], o[5])); }
  const hp = at(dist + 0.6, laneX, 0); shadow.position.copy(hp).add(new THREE.Vector3(0, 0.03, 0)); hero.position.copy(hp).add(new THREE.Vector3(0, hero.scale.y / 2 - heroDrop + groundAt(dist + 0.6, laneX).g * 0 + heroY, 0)); hero.lookAt(tmp.copy(camera.position).setY(hero.position.y));
  stars.position.copy(camera.position); stars.material.opacity = 0.7;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// masked Sidro: Gabe's sprite sheets (unlit, original colors). Turnaround then run cycle.
function sheetMat(u: string, n: number) { const t = tl.load(u); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / n, 1); t.magFilter = THREE.LinearFilter; return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, fog: false, toneMapped: false, depthTest: false }); }
// per-frame lowest opaque foot pixel (of 492px band) -> drop each frame so the lowest foot touches the ground; per-frame durations (s)
// Gabe's 8-frame back-view run (keyed, common band; heads aligned in source so the band itself is the ground line). low = lowest foot px of 259.
// per-frame lowest foot: [256,252,254,241,253,254,254,255] -> contact 0,7 (and 5,6,2,4 near), flight 3
const RUN_GROUND = 256, RUN_DT = 0.0625;
const RUN = { n: 8, mat: sheetMat('/s3d/sidro_run8.webp', 8), w: 135 / 259 * 1.35, h: 1.35 };
const TURN = { n: 9, mat: sheetMat('/s3d/sidro_turn.webp', 9), w: 181 / 507 * 1.34, h: 1.34, order: [0, 0, 0, 1, 2, 3, 5, 6, 7, 8, 8] };
const hero = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), TURN.mat); hero.renderOrder = 10; scene.add(hero);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.55, 1); scene.add(shadow);
let camOverride: number[] | null = null;
let turnT = 0, runPh = 0, runI = 0, heroDrop = 0, paused = false;
function heroFrame(dt: number) {
  if (turnT < TURN.order.length / 10) { heroDrop = 0; turnT += dt; const i = TURN.order[Math.min(TURN.order.length - 1, Math.floor(turnT * 10))]; hero.material = TURN.mat; TURN.mat.map!.offset.x = i / TURN.n; hero.scale.set(TURN.w, TURN.h, 1); return false; }
  // all 8 frames in order, even timing: 0.5s loop (~2 cycles/s) at SPEED 5.2; no mirroring. Source band keeps the artist's ground; frame 3 is the flight phase.
  runPh += dt * (spd / 5.2) * (heroVY !== 0 ? 0.4 : 1); while (runPh >= RUN_DT) { runPh -= RUN_DT; runI = (runI + 1) % RUN.n; }
  hero.material = RUN.mat; RUN.mat.map!.offset.x = runI / RUN.n;
  hero.scale.set(RUN.w, RUN.h, 1); heroDrop = ((259 - RUN_GROUND) / 259) * RUN.h; return true;
}

(window as unknown as Record<string, unknown>).__s3d = {
  throwChancla, dodge, jump, startRun, startStage: () => startRun(), god: (v: boolean) => { god = v; }, put: (k: string, off: number, ln: number, h = 0) => { const d = dist + off; if (k === 'car') addCar(d, ln); else if (k === 'ramp') addRamp(d, ln); else if (k === 'crate') barricade(d, ln, 3, 0.8); else if (k === 'wall') addWall(d, ln, true); else if (k === 'stone') addWall(d, ln, false); else if (k in PAT) PAT[k](d); else addSkull(d, ln, h); }, clear: () => clearRun(), hold: () => { spawnD = 1e9; }, setT: (t: number) => { runT = t; }, freeze: (v: boolean) => { paused = v; }, dbg: () => ({ shots: shots.map((q) => q.mesh.position.toArray().map((n) => +n.toFixed(2))), crates: crates.filter((c) => !c.down).map((c) => c.mesh.position.toArray().map((n) => +n.toFixed(2))) }),
  state: () => ({ score, mult, spd: +spd.toFixed(2), runT: +runT.toFixed(1), heroY: +heroY.toFixed(2), walls: walls.filter((w) => w.alive).map((w) => [w.lane, +(w.d - dist).toFixed(1), w.breakable ? 1 : 0]), cars: cars.filter((c) => c.alive).map((c) => [c.lane, +(c.d - dist).toFixed(1), c.hp]), ramps: ramps.length, crates: crates.filter((c) => !c.down).length, ammo, lane, playing, dist: +dist.toFixed(1), skulls: skulls.filter((k) => k.alive).map((k) => [k.lane, +(k.d - dist).toFixed(1)]), pins: pins.filter((p) => p.alive).map((p) => [p.lane, +(p.d - dist).toFixed(1)]), kills }),
  warp: (d: number) => { dist = d; spawnD = Math.max(spawnD, d + 20); },
  story: (k: string) => { localStorage.removeItem(SKIP_KEY); playStory(k, () => {}); },
  smoke: (v: boolean) => smoke.forEach((m) => (m.s.visible = v)),
  flags: (v: boolean) => { flagIM.visible = v; },
  look: (d: number, x: number, y: number, tx: number, ty: number, tz: number) => { paused = true; camOverride = [d, x, y, tx, ty, tz]; },
  bd: (v: boolean) => { const b = camera.children.find((c) => (c as THREE.Mesh).geometry?.type === 'PlaneGeometry' && (c as THREE.Mesh).position.z === -185); if (b) b.visible = v; },
  cam: () => [camera.position.toArray(), camera.getWorldDirection(new THREE.Vector3()).toArray(), at(20, 0, 0).toArray(), camera.children.length],
  cob: () => (cobble.image as HTMLCanvasElement).toDataURL(),
  pose: (t: number) => { turnT = t; paused = true; }, unpause: () => { paused = false; }, free: () => { camOverride = null; paused = false; },
  hero: () => ({ turnT: +turnT.toFixed(2), frame: hero.material === RUN.mat ? 'run' + runI : 'turn', off: (hero.material as THREE.MeshBasicMaterial).map!.offset.x }),
  heroRect: () => { const r = stage.getBoundingClientRect(); const pts = [[-0.5, -0.5], [0.5, 0.5]].map(([x, y]) => { const v = new THREE.Vector3(x, y, 0); hero.localToWorld(v); v.project(camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }); return pts; },
};
for (let k = 0; k < 6; k++) spawnPattern(20 + k * 9);
renderComicBgs();
clearRun(); setBright(0);
requestAnimationFrame(frame);
playStory('intro', () => startRun());
