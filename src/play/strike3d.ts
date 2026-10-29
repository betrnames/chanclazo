import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------- story text table (one-line name swap) ----------
const BOY = 'Isidro';
const A = '/s3d/abuela.webp', L = '/s3d/luchador.webp', P = '/s3d/llama.webp', K = '/play/t_kid.webp', M = '/s3d/mask.webp';
type Panel = { bg: string; cap: string; imgs?: { src: string; style: string }[]; bubbles?: { text: string; style: string; tx?: string }[]; fx?: string; glow?: boolean };
const STORY: Record<string, Panel[]> = {
  intro: [
    { bg: 'hill', cap: 'Día de los Muertos. One road down the hill to the ofrenda.', imgs: [{ src: A, style: 'left:4%;height:74%' }], bubbles: [{ text: `${BOY}. Straight down. No stopping.`, style: 'right:5%;top:22%', tx: '18%' }] },
    { bg: 'smoke', cap: `${BOY} is afraid of the dark. So tonight he doesn't go as ${BOY}.`, imgs: [{ src: L, style: 'right:3%;height:78%' }], bubbles: [{ text: "Tonight I'm somebody braver.", style: 'left:5%;top:24%', tx: '72%' }] },
    { bg: 'road', cap: 'Abuela hands over her chanclas.', imgs: [{ src: A, style: 'left:1%;height:66%' }, { src: L, style: 'right:1%;height:70%' }], fx: '¡CHANCLAZO!', bubbles: [{ text: "You'll know when.", style: 'left:8%;top:20%', tx: '25%' }] },
  ],
  l2: [{ bg: 'skull', cap: 'The skulls bite. And they spit.', imgs: [{ src: A, style: 'left:3%;height:62%' }], bubbles: [{ text: 'Move your feet, mijo.', style: 'right:5%;top:22%', tx: '20%' }] }],
  l3: [{ bg: 'smoke', cap: 'Wind comes off the graves.', imgs: [{ src: A, style: 'left:3%;height:62%' }], bubbles: [{ text: 'Aim into it.', style: 'right:8%;top:24%', tx: '20%' }] }],
  l4: [{ bg: 'road', cap: 'Something sweet hangs over the road.', imgs: [{ src: P, style: 'right:8%;height:70%' }, { src: A, style: 'left:2%;height:56%' }], bubbles: [{ text: "Break it. I won't tell.", style: 'left:6%;top:20%', tx: '30%' }] }],
  l5: [{ bg: 'glow', cap: 'Light at the bottom of the hill.', imgs: [{ src: L, style: 'left:4%;height:74%' }], bubbles: [{ text: 'Almost there.', style: 'right:8%;top:24%', tx: '25%' }] }],
  outro: [
    { bg: 'glow', cap: 'In the light, the mask comes off.', imgs: [{ src: M, style: 'left:50%;bottom:24%;height:32%;transform:translateX(-50%) rotate(-18deg)' }], glow: true },
    { bg: 'glow', cap: `It was ${BOY} the whole time.`, imgs: [{ src: K, style: 'left:5%;height:40%' }, { src: A, style: 'right:3%;height:74%' }], glow: true, bubbles: [{ text: 'The mask never made you brave. It just held on until you were.', style: 'left:6%;top:18%', tx: '75%' }] },
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
const cobble = canvasTex(256, 256, (c) => {
  c.fillStyle = '#0c0710'; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
    const cx = x * 44 + (y % 2) * 22 + rnd() * 6, cy = y * 32 + 16 + rnd() * 4, l = 18 + rnd() * 14;
    c.fillStyle = `rgb(${l + 14},${l + 4},${l + 26})`;
    c.beginPath(); c.ellipse(cx % 256, cy, 19 + rnd() * 3, 13 + rnd() * 2, rnd() * 0.4, 0, 7); c.fill();
    c.fillStyle = 'rgba(160,140,200,.12)'; c.beginPath(); c.ellipse(cx % 256 - 4, cy - 4, 9, 5, 0, 0, 7); c.fill();
  }
}, true);
const puff = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(200,190,235,.55)'); g.addColorStop(0.5, 'rgba(150,130,200,.2)'); g.addColorStop(1, 'rgba(120,100,180,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
const flame = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.3, 'rgba(255,160,40,.7)'); g.addColorStop(1, 'rgba(255,120,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
const skullFace = canvasTex(256, 256, (c) => {
  c.fillStyle = '#f4efe6'; c.fillRect(0, 0, 256, 256);
  const petal = (x: number, y: number, r: number, col: string) => { c.fillStyle = col; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + Math.cos(k) * r, y + Math.sin(k) * r, r * 0.7, 0, 7); c.fill(); } c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, y, r * 0.6, 0, 7); c.fill(); };
  petal(128, 40, 14, '#e2197a'); petal(92, 56, 8, '#1ec8c8'); petal(164, 56, 8, '#1ec8c8');
  c.strokeStyle = '#b04bff'; c.lineWidth = 4; for (let k = 0; k < 9; k++) { c.beginPath(); c.arc(64 + k * 16, 230, 6, 0, Math.PI); c.stroke(); }
}, false);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
const FOG_DARK = new THREE.Color(0x0d0618), FOG_END = new THREE.Color(0x5a2e22);
scene.background = FOG_DARK.clone();
scene.fog = new THREE.Fog(FOG_DARK.clone(), 8, 42);
const camera = new THREE.PerspectiveCamera(64, 9 / 16, 0.1, 200);
const hemi = new THREE.HemisphereLight(0x6a5cff, 0x0b1a1c, 0.55); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x5fd6d0, 0.9); moon.position.set(-20, 40, 10); scene.add(moon);
const warm = new THREE.PointLight(0xffb060, 0, 80, 1.2); scene.add(warm);
const tl = new THREE.TextureLoader();
const sMats: Record<string, THREE.MeshBasicMaterial> = {};
const sMat = (u: string) => (sMats[u] ??= new THREE.MeshBasicMaterial({ map: (() => { const t = tl.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, fog: false, toneMapped: false, color: 0xffffff }));

// ---------- winding downhill road ----------
const ctrl: THREE.Vector3[] = [];
for (let i = 0; i < 14; i++) ctrl.push(new THREE.Vector3(i < 2 ? 0 : Math.sin(i * 1.3) * 14 + Math.sin(i * 0.5) * 6, -i * 3.2, -i * 26));
const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
const LEN = curve.getLength();
const UP = new THREE.Vector3(0, 1, 0);
function frameAt(d: number) {
  const u = THREE.MathUtils.clamp(d / LEN, 0, 1);
  const p = curve.getPointAt(u), t = curve.getTangentAt(u);
  const side = new THREE.Vector3().crossVectors(t, UP).normalize();
  return { p, t, side };
}
const at = (d: number, x: number, y = 0) => { const f = frameAt(d); return f.p.clone().addScaledVector(f.side, x).addScaledVector(UP, y); };
function ribbon(width: number, yOff: number, mat: THREE.Material, vScale: number) {
  const N = 700, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const d = (i / N) * LEN, f = frameAt(d);
    for (const s of [-1, 1]) { const v = f.p.clone().addScaledVector(f.side, (s * width) / 2); pos.push(v.x, v.y + yOff, v.z); uv.push(s < 0 ? 0 : width / 4, d / vScale); }
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); scene.add(m); return m;
}
ribbon(7, 0, new THREE.MeshStandardMaterial({ map: cobble, bumpMap: cobble, bumpScale: 2, roughness: 0.85, color: 0xb8a8d8 }), 4);
ribbon(90, -0.08, new THREE.MeshStandardMaterial({ color: 0x120a16, roughness: 1 }), 10);
// curbs
for (const s of [-1, 1]) { const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 120 }, (_, i) => at((i / 119) * LEN, s * 3.6, 0.08))), 400, 0.12, 5); scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a2a44 }))); }

// ---------- roadside decor ----------
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5068, roughness: 0.95 });
const candleMat = new THREE.MeshStandardMaterial({ color: 0xf1e3c0, emissive: 0x4a3010 });
const flameMat = new THREE.SpriteMaterial({ map: flame, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const flames: THREE.Sprite[] = [];
function candle(p: THREE.Vector3, h = 0.35) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), candleMat); c.position.copy(p).add(new THREE.Vector3(0, h / 2, 0)); scene.add(c);
  const f = new THREE.Sprite(flameMat); f.scale.set(0.35, 0.5, 1); f.position.copy(p).add(new THREE.Vector3(0, h + 0.12, 0)); scene.add(f); flames.push(f);
}
function tomb(d: number, x: number) {
  const g = new THREE.Group(); const p = at(d, x);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.2), stoneMat); slab.position.y = 0.6; g.add(slab);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 14, 1, false, 0, Math.PI), stoneMat); top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.y = 1.2; top.rotation.set(Math.PI / 2, 0, -Math.PI / 2); g.add(top);
  if (rnd() < 0.5) { const cr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), stoneMat); cr.position.y = 1.6; g.add(cr); const cb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), stoneMat); cb.position.y = 1.7; g.add(cb); }
  g.position.copy(p); g.lookAt(at(d, 0)); g.rotateY(Math.PI); g.rotation.z += (rnd() - 0.5) * 0.2; scene.add(g);
  candle(at(d + 0.4, x + (x > 0 ? -0.6 : 0.6)));
}
const ofrCols = [0x7a1d8a, 0xe2197a, 0xff9f1c];
function ofrenda(d: number, x: number) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 - k * 0.5, 0.4, 1 - k * 0.2), new THREE.MeshStandardMaterial({ color: ofrCols[k], roughness: 0.9 })); b.position.y = 0.2 + k * 0.4; g.add(b); }
  const p = at(d, x); g.position.copy(p); g.lookAt(at(d, 0)); scene.add(g);
  for (let k = 0; k < 5; k++) candle(g.localToWorld(new THREE.Vector3(-0.8 + k * 0.4, 0.4, 0.35)), 0.25);
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff9f1c })); m.position.copy(g.localToWorld(new THREE.Vector3(-0.5 + k * 0.2, 1.3, 0))); scene.add(m); }
}
const flags: THREE.Mesh[] = [];
const picCols = [0xe2197a, 0xff9f1c, 0x1ec8c8, 0xb04bff, 0x8ae234, 0xffd23f];
function papel(d: number) {
  const a = at(d, -4.2), b = at(d, 4.2);
  for (const q of [a, b]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a1a })); post.position.copy(q).add(new THREE.Vector3(0, 2.1, 0)); scene.add(post); }
  const n = 16;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, p = a.clone().lerp(b, t); p.y += 4.1 - Math.sin(t * Math.PI) * 0.5;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.48), new THREE.MeshStandardMaterial({ color: picCols[k % 6], side: THREE.DoubleSide, emissive: picCols[k % 6], emissiveIntensity: 0.15 }));
    f.position.copy(p); f.lookAt(p.clone().add(frameAt(d).t)); scene.add(f); flags.push(f);
  }
}
for (let d = 6; d < LEN - 10; d += 7) { const s = rnd() < 0.5 ? -1 : 1; if (rnd() < 0.22) ofrenda(d, s * 6.2); else tomb(d, s * (5 + rnd() * 3)); if (rnd() < 0.5) tomb(d + 3, -s * (5.5 + rnd() * 4)); }
for (let d = 14; d < LEN - 10; d += 22) papel(d);
// petals on road
{ const g = new THREE.CircleGeometry(0.07, 5); const m1 = new THREE.MeshBasicMaterial({ color: 0xff9f1c }), m2 = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = 0; i < 900; i++) { const m = new THREE.Mesh(g, i % 3 ? m1 : m2); m.position.copy(at(rnd() * LEN, (rnd() - 0.5) * 6.6, 0.02)); m.rotation.x = -Math.PI / 2; scene.add(m); } }
// end glow
const endP = at(LEN - 2, 0, 2);
const endGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flame, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffe0a0 }));
endGlow.scale.set(40, 30, 1); endGlow.position.copy(endP); scene.add(endGlow);
warm.position.copy(endP).add(new THREE.Vector3(0, 4, 0));

// moon + stars
const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(235,240,255,1)'); g.addColorStop(0.42, 'rgba(210,220,255,.95)'); g.addColorStop(0.5, 'rgba(140,200,220,.25)'); g.addColorStop(1, 'rgba(80,120,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }), fog: false, depthWrite: false }));
moonSpr.scale.set(2.2, 2.2, 1); moonSpr.position.set(-2.4, 5.6, -14); moonSpr.renderOrder = -1; moonSpr.material.depthTest = false; scene.add(camera); camera.add(moonSpr);
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
const boneMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6, emissive: 0x221a2a });
const socketMat = new THREE.MeshBasicMaterial({ color: 0x0a0410 });
function makeSkull() {
  const g = new THREE.Group();
  const cran = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), boneMat); cran.scale.set(1, 1, 1.05); g.add(cran);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.605, 20, 16, -Math.PI / 2 - 0.9, 1.8, 0.2, 1.6), new THREE.MeshStandardMaterial({ map: skullFace, transparent: true, roughness: 0.6 })); face.rotation.y = Math.PI; face.scale.copy(cran.scale); g.add(face);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), socketMat); eye.position.set(s * 0.22, 0.02, 0.5); g.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 14), new THREE.MeshBasicMaterial({ color: s < 0 ? 0x1ec8c8 : 0xe2197a })); ring.position.set(s * 0.22, 0.02, 0.56); g.add(ring);
    const glowE = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23f })); glowE.position.set(s * 0.22, 0.02, 0.62); g.add(glowE);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 3), socketMat); nose.position.set(0, -0.16, 0.6); nose.rotation.x = Math.PI; g.add(nose);
  for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.06), boneMat); t.position.set(-0.19 + k * 0.076, -0.36, 0.48); g.add(t); }
  const jawPivot = new THREE.Group(); jawPivot.position.set(0, -0.3, -0.05); g.add(jawPivot);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), boneMat); jaw.scale.set(0.95, 0.5, 1.15); jaw.position.set(0, 0, 0.12); jawPivot.add(jaw);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), socketMat); mouth.rotation.x = -Math.PI / 2; mouth.scale.set(0.95, 1.15, 1); mouth.position.set(0, 0.005, 0.12); jawPivot.add(mouth);
  for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.06), boneMat); t.position.set(-0.19 + k * 0.076, 0.03, 0.56); jawPivot.add(t); }
  scene.add(g); return { g, jawPivot };
}

// ---------- physics (crate barricades) ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;

type Skull = { g: THREE.Group; jaw: THREE.Group; d: number; lane: number; alive: boolean; t: number; spitT: number };
type Pin = { m: THREE.Mesh; d: number; lane: number; alive: boolean; t: number };
type Crate = { body: CANNON.Body; mesh: THREE.Mesh; home: CANNON.Vec3; down: boolean; d: number; lane: number };
type Shot = { body: CANNON.Body; mesh: THREE.Group; age: number; prev: THREE.Vector3 };
type Spit = { m: THREE.Mesh; from: THREE.Vector3; d: number; lane: number; t: number };
let skulls: Skull[] = [], pins: Pin[] = [], crates: Crate[] = [], shots: Shot[] = [], spits: Spit[] = [], statics: CANNON.Body[] = [];
const candy: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
const LANES = [-2, 0, 2];
const crateMat = [new THREE.MeshStandardMaterial({ color: 0x5c2d14, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x7a3e18, roughness: 0.9 })];

function barricade(d: number, lane: number, n: number) {
  const f = frameAt(d), p = at(d, LANES[lane]);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), f.t.clone().setY(0).normalize().negate(), UP));
  const base = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3, 0.1, 3)), position: new CANNON.Vec3(p.x, p.y - 0.1, p.z) }); world.addBody(base); statics.push(base);
  for (let k = 0; k < n; k++) {
    const off = k < 2 ? (k - 0.5) * 0.85 : 0, y = k < 2 ? 0.4 : 1.2;
    const pos = p.clone().addScaledVector(f.side, off).add(new THREE.Vector3(0, y, 0));
    const body = new CANNON.Body({ mass: 0.7, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    body.quaternion.set(q.x, q.y, q.z, q.w); body.allowSleep = true; body.sleep(); world.addBody(body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat[k % 2]);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffb347 })));
    scene.add(mesh); crates.push({ body, mesh, home: body.position.clone(), down: false, d, lane });
  }
}
function addSkull(d: number, lane: number) { const s = makeSkull(); skulls.push({ g: s.g, jaw: s.jawPivot, d, lane, alive: true, t: rnd() * 6, spitT: 2 + rnd() * 3 }); }
function addPin(d: number, lane: number) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), sMat(P)); scene.add(m); pins.push({ m, d, lane, alive: true, t: rnd() * 6 }); }

// stages: each a stretch of road ending at a checkpoint
type Stage = { from: number; to: number; ammo: number; wind: number; spit: boolean; build: (a: number, b: number) => void };
const S = (k: number) => (LEN - 12) * k;
const STAGES: Stage[] = [
  { from: 0, to: S(0.2), ammo: 8, wind: 0, spit: false, build: (a, b) => { const r = b - a; addSkull(a + r * 0.4, 1); addSkull(a + r * 0.6, 0); barricade(a + r * 0.75, 2, 3); addSkull(a + r * 0.9, 1); } },
  { from: S(0.2), to: S(0.4), ammo: 9, wind: 0, spit: true, build: (a, b) => { const r = b - a; addSkull(a + r * 0.3, 0); addSkull(a + r * 0.45, 2); barricade(a + r * 0.6, 1, 3); addSkull(a + r * 0.8, 1); addSkull(a + r * 0.9, 0); } },
  { from: S(0.4), to: S(0.6), ammo: 9, wind: 1.6, spit: true, build: (a, b) => { const r = b - a; addSkull(a + r * 0.3, 2); barricade(a + r * 0.5, 0, 3); barricade(a + r * 0.5, 2, 2); addSkull(a + r * 0.7, 1); addSkull(a + r * 0.9, 0); } },
  { from: S(0.6), to: S(0.8), ammo: 10, wind: -1.2, spit: true, build: (a, b) => { const r = b - a; addPin(a + r * 0.35, 1); addSkull(a + r * 0.5, 0); addSkull(a + r * 0.6, 2); addPin(a + r * 0.75, 0); barricade(a + r * 0.85, 1, 3); } },
  { from: S(0.8), to: S(1), ammo: 11, wind: 2, spit: true, build: (a, b) => { const r = b - a; addSkull(a + r * 0.25, 0); addSkull(a + r * 0.35, 2); addPin(a + r * 0.5, 1); barricade(a + r * 0.6, 0, 3); addSkull(a + r * 0.75, 1); addSkull(a + r * 0.85, 2); addPin(a + r * 0.9, 2); } },
];
let si = 0, score = 0, stageScore = 0, ammo = 0, hearts = 3, lostHeart = false, playing = false, lane = 1, laneX = 0, dist = 0, kills = 0, total = 0;
const SPEED = 5.2;
function clearStage() {
  for (const s of skulls) scene.remove(s.g); for (const p of pins) scene.remove(p.m);
  for (const c of crates) { scene.remove(c.mesh); world.removeBody(c.body); } for (const b of statics) world.removeBody(b);
  for (const s of shots) { scene.remove(s.mesh); world.removeBody(s.body); } for (const s of spits) scene.remove(s.m);
  skulls = []; pins = []; crates = []; shots = []; spits = []; statics = [];
}
function startStage(i: number) {
  si = i; clearStage(); const st = STAGES[i]; st.build(st.from, st.to);
  total = skulls.length + pins.length + crates.length; kills = 0; stageScore = 0;
  ammo = st.ammo; hearts = 3; lostHeart = false; lane = 1; laneX = 0; dist = st.from; playing = true;
  $('wind').textContent = st.wind === 0 ? '' : `Wind ${st.wind > 0 ? '→' : '←'} ${Math.abs(st.wind).toFixed(1)}`;
  $('end').classList.add('hidden'); hud();
}
function hud() { $('stat').textContent = `${si + 1}/5 · ${score}`; $('ammo').textContent = String(Math.max(0, ammo)); $('hearts').textContent = '❤'.repeat(hearts) + '♡'.repeat(3 - hearts); }
function addScore(n: number) { score += n; stageScore += n; hud(); }
function endStage(win: boolean) {
  playing = false;
  let stars = 0;
  if (win) { addScore(ammo * 50); const k = kills / Math.max(1, total); stars = 1 + (k >= 0.6 ? 1 : 0) + (k >= 0.85 && !lostHeart ? 1 : 0); }
  $('stars').innerHTML = [0, 1, 2].map((k) => `<span class="${k < stars ? '' : 'off'}">★</span>`).join('');
  $('endTitle').textContent = win ? (si === 4 ? 'You made it.' : '¡Chanclazo!') : 'Ay, no…';
  $('endMsg').textContent = win ? `Stage ${si + 1} · +${stageScore} · Total ${score}` : 'The skulls got you. Again.';
  $('next').classList.toggle('hidden', !win); $('next').textContent = si === 4 ? 'Play again' : 'Keep going';
  const show = () => $('end').classList.remove('hidden');
  if (win && si === 4) setTimeout(() => playStory('outro', show), 600); else setTimeout(show, 500);
}
$('retry').onclick = () => { score -= stageScore; startStage(si); };
$('next').onclick = () => { const n = si === 4 ? 0 : si + 1; if (n === 0) score = 0; $('end').classList.add('hidden'); playStory(`l${n + 1}`, () => startStage(n)); };

// ---------- chancla ----------
function chanclaMesh(dark = false) {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.72), new THREE.MeshStandardMaterial({ color: dark ? 0x3a8a3a : 0xe2197a, emissive: dark ? 0x1a4a1a : 0x300010 }));
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.7), new THREE.MeshStandardMaterial({ color: 0xffd23f })); top.position.y = 0.04;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1ec8c8 })); strap.position.set(0, 0.05, 0.08); strap.rotation.y = Math.PI / 2;
  g.add(sole, top, strap); return g;
}
function throwChancla(side: number, up: number) {
  if (!playing || ammo <= 0) return;
  ammo--; hud(); beep(520, 0.12, 'sawtooth', 0.05);
  const o = at(dist + 1, laneX, 1.4), f = frameAt(dist + 1), fwd = 9 + up * 20;
  let v = f.t.clone().multiplyScalar(fwd + SPEED).addScaledVector(f.side, side * 16).addScaledVector(UP, 2.5 + up * 7);
  // aim assist: pick the live target closest to the swipe's line, then solve a real arc to it (scale-free: swipe is normalized to the canvas column)
  let best: THREE.Vector3 | null = null, bd = 0.22;
  const dir = new THREE.Vector3(v.x, 0, v.z).normalize();
  const cands = [...skulls.filter((k) => k.alive).map((k) => k.g.position), ...pins.filter((q) => q.alive).map((q) => q.m.position)];
  for (const tp of cands) { const h = new THREE.Vector3(tp.x - o.x, 0, tp.z - o.z); const L = h.length(); if (L < 2.5 || L > 32) continue; const e = 1 - h.normalize().dot(dir); if (e < bd) { bd = e; best = tp; } }
  if (best) { const h = new THREE.Vector3(best.x - o.x, 0, best.z - o.z), L = h.length(), T = L / (fwd + SPEED); v = h.multiplyScalar(1 / T); v.y = (best.y - o.y + 4.91 * T * T) / T; }
  const body = new CANNON.Body({ mass: 0.5, shape: new CANNON.Box(new CANNON.Vec3(0.18, 0.06, 0.4)), position: new CANNON.Vec3(o.x, o.y, o.z) });
  body.velocity.set(v.x, v.y, v.z); body.angularVelocity.set(-14, (rnd() - 0.5) * 6, side * 4);
  body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => { if (crates.some((c) => c.body === e.body) && Math.abs(e.contact.getImpactVelocityAlongNormal()) > 4) { shake = 0.3; slow = 0.3; beep(140, 0.15, 'square', 0.1); } });
  const s: Shot = { body, mesh: chanclaMesh(), age: 0, prev: o.clone() }; world.addBody(body); scene.add(s.mesh); shots.push(s);
}

// ---------- input ----------
let start: { x: number; y: number } | null = null;
const H = () => stage.clientHeight;
stage.addEventListener('pointerdown', (e) => { if (!playing || (e.target as HTMLElement).closest('a,button,.screen,#comic')) return; start = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', (e) => {
  if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) dodge(dx > 0 ? 1 : -1);
  else if (-dy > 30) throwChancla(dx / H(), Math.min(0.6, -dy / H()));
});
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') dodge(-1); if (e.key === 'ArrowRight' || e.key === 'd') dodge(1); if (e.key === ' ' || e.key === 'ArrowUp') throwChancla(0, 0.3); });
function dodge(d: number) { if (!playing) return; lane = Math.max(0, Math.min(2, lane + d)); beep(300, 0.06, 'triangle', 0.05); }

// ---------- effects ----------
let shake = 0, slow = 0;
function burst(p: THREE.Vector3, n = 50) {
  const cols = [0xff3d7f, 0xffd23f, 0x1ec8c8, 0x8ae234, 0xb04bff, 0xff9f1c];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: cols[i % 6] })); m.position.copy(p); scene.add(m); candy.push({ m, v: new THREE.Vector3((rnd() - 0.5) * 8, rnd() * 6, (rnd() - 0.5) * 8), life: 2 }); }
}
let invuln = 0;
function hurt() { if (clock < invuln) return; invuln = clock + 1.2; hearts--; lostHeart = true; shake = 0.5; beep(90, 0.3, 'sawtooth', 0.12); stage.style.boxShadow = 'inset 0 0 80px red'; setTimeout(() => (stage.style.boxShadow = ''), 250); hud(); }

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
  const hideables: THREE.Object3D[] = [...pins.map((p) => p.m), hero];
  hideables.forEach((o) => (o.visible = false));
  const w = 360, h = 480, cam = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  const old = new THREE.Vector2(); renderer.getSize(old); const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  const sk = makeSkull(); sk.g.position.copy(at(30, 0.8, 1.6)); sk.jawPivot.rotation.x = 0.5;
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
  (scene.fog as THREE.Fog).far = 42 + k * 50;
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
const tmp = new THREE.Vector3();
function frame(now: number) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (slow > 0) { slow -= dt; dt *= 0.3; }
  clock += dt;
  world.step(1 / 120, dt, 6);
  const st = STAGES[si];
  if (playing) dist = Math.min(st.to, dist + SPEED * dt);
  laneX += (LANES[lane] - laneX) * Math.min(1, dt * 10);
  const me = at(dist, laneX, 1.2);
  setBright(THREE.MathUtils.smoothstep(dist / LEN, 0.55, 1));
  // shots
  for (const s of shots) {
    s.age += dt; s.body.applyForce(new CANNON.Vec3(st.wind * s.body.mass, 0, 0));
    s.mesh.position.set(s.body.position.x, s.body.position.y, s.body.position.z); s.mesh.quaternion.set(s.body.quaternion.x, s.body.quaternion.y, s.body.quaternion.z, s.body.quaternion.w);
    const seg = new THREE.Line3(s.prev.clone(), s.mesh.position.clone()); s.prev.copy(s.mesh.position);
    const near = (q: THREE.Vector3, r: number) => seg.closestPointToPoint(q, true, tmp).distanceTo(q) < r;
    for (const k of skulls) if (k.alive && near(k.g.position, 0.95)) { k.alive = false; kills++; scene.remove(k.g); burst(k.g.position, 30); addScore(100); shake = 0.35; slow = 0.4; beep(200, 0.2, 'square', 0.1); }
    for (const p of pins) if (p.alive && near(p.m.position, 1.2)) { p.alive = false; kills++; scene.remove(p.m); burst(p.m.position, 70); addScore(250); shake = 0.4; slow = 0.5; beep(660, 0.25, 'triangle', 0.1); }
  }
  shots = shots.filter((s) => { if (s.age > 3) { world.removeBody(s.body); scene.remove(s.mesh); return false; } return true; });
  for (const c of crates) {
    c.mesh.position.set(c.body.position.x, c.body.position.y, c.body.position.z); c.mesh.quaternion.set(c.body.quaternion.x, c.body.quaternion.y, c.body.quaternion.z, c.body.quaternion.w);
    if (!c.down && c.body.position.distanceTo(c.home) > 0.6) { c.down = true; kills++; addScore(25); }
  }
  // skulls float toward you, jaws chomping
  for (const k of skulls) {
    if (!k.alive) continue; k.t += dt;
    if (k.d - dist < 30) k.d -= dt * 1.4;
    k.g.position.copy(at(k.d, LANES[k.lane] + Math.sin(k.t * 0.9) * 0.3, 1.5 + Math.sin(k.t * 2.2) * 0.25));
    k.g.lookAt(camera.position); k.jaw.rotation.x = 0.1 + (Math.sin(k.t * 7) * 0.5 + 0.5) * 0.55;
    if (playing && st.spit && k.d - dist > 7 && k.d - dist < 26) { k.spitT -= dt; if (k.spitT <= 0) { k.spitT = 3.5 + rnd() * 3; spit(k); } }
    if (playing && Math.abs(k.d - dist) < 0.8) { k.alive = false; scene.remove(k.g); if (Math.abs(LANES[k.lane] - laneX) < 1) hurt(); else addScore(20); }
  }
  for (const p of pins) { if (!p.alive) continue; p.t += dt; p.m.position.copy(at(p.d, LANES[p.lane] + Math.sin(p.t * 1.3) * 0.5, 3.2)); p.m.lookAt(tmp.copy(camera.position).setY(p.m.position.y)); p.m.rotation.z = Math.sin(p.t * 1.3) * 0.15; }
  // barricade collisions
  for (const c of crates) if (playing && !c.down && Math.abs(c.d - dist) < 0.6 && lane === c.lane) { c.down = true; hurt(); c.body.wakeUp(); c.body.velocity.set(0, 4, 0); }
  // spit projectiles
  for (const s of spits) { s.t += dt / 1.4; const k = Math.min(1, s.t); const to = at(dist + 0.5, LANES[s.lane], 1.2); s.m.position.lerpVectors(s.from, to, k); s.m.position.y += Math.sin(k * Math.PI) * 1.5; s.m.rotation.x += dt * 12;
    if (k >= 1) { if (Math.abs(laneX - LANES[s.lane]) < 1) hurt(); else addScore(20); } }
  spits = spits.filter((s) => { if (s.t >= 1) { scene.remove(s.m); return false; } return true; });
  $('warn').style.display = spits.length ? 'block' : 'none';
  for (const c of candy) { c.life -= dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 5; }
  for (let i = candy.length - 1; i >= 0; i--) if (candy[i].life <= 0) { scene.remove(candy[i].m); candy.splice(i, 1); }
  flames.forEach((f, i) => f.scale.set(0.35 + Math.sin(clock * 13 + i) * 0.04, 0.5 + Math.sin(clock * 17 + i * 2) * 0.07, 1));
  flags.forEach((f, i) => (f.rotation.x = Math.sin(clock * 2 + i * 0.7) * 0.25));
  updateSmoke(me, dt);
  if (playing) { if (hearts <= 0) endStage(false); else if (dist >= st.to - 0.01) endStage(true); }
  // camera behind & above, looking down the hill
  const f = frameAt(dist), back = at(dist - 4.5, laneX * 0.85, 3.4), look = at(dist + 9, laneX * 0.5, 0.4);
  void f;
  const sx = shake > 0 ? (rnd() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.5);
  camera.position.copy(back).add(new THREE.Vector3(sx, sx * 0.6, 0)); camera.lookAt(look);
  hero.position.copy(at(dist + 0.6, laneX, 0.9)); hero.lookAt(tmp.copy(camera.position).setY(hero.position.y));
  stars.position.copy(camera.position); stars.material.opacity = 0.7 * (1 - THREE.MathUtils.smoothstep(dist / LEN, 0.6, 1));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function spit(k: Skull) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7dff6a })); scene.add(m);
  spits.push({ m, from: k.g.position.clone(), d: dist, lane, t: 0 }); beep(880, 0.1, 'square', 0.06);
  $('warn').textContent = lane === 0 ? 'DODGE →' : lane === 2 ? '← DODGE' : '← DODGE →';
}
// masked Isidro (Gabe's luchador cutout, as-is) running ahead of the camera
const hero = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.25), sMat(L)); hero.renderOrder = 10; hero.material = sMat(L).clone(); (hero.material as THREE.MeshBasicMaterial).depthTest = false; scene.add(hero);

(window as unknown as Record<string, unknown>).__s3d = {
  throwChancla, dodge, startStage, spit: () => skulls.find((k) => k.alive) && spit(skulls.find((k) => k.alive)!),
  state: () => ({ si, score, ammo, hearts, lane, playing, dist: +dist.toFixed(1), to: +STAGES[si].to.toFixed(1), skulls: skulls.filter((k) => k.alive).map((k) => [k.lane, +(k.d - dist).toFixed(1)]), pins: pins.filter((p) => p.alive).map((p) => [p.lane, +(p.d - dist).toFixed(1)]), kills, total }),
  jump: (d: number) => { dist = d; },
  smoke: (v: boolean) => smoke.forEach((m) => (m.s.visible = v)),
  heroRect: () => { const r = stage.getBoundingClientRect(); const pts = [[-0.375, -0.625], [0.375, 0.625]].map(([x, y]) => { const v = new THREE.Vector3(x, y, 0); hero.localToWorld(v); v.project(camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }); return pts; },
};
STAGES[0].build(STAGES[0].from, STAGES[0].to);
renderComicBgs();
clearStage();
requestAnimationFrame(frame);
playStory('intro', () => startStage(0));
