import * as THREE from 'three';
import * as CANNON from 'cannon-es';

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
scene.fog = new THREE.Fog(FOG_DARK.clone(), 8, 42);
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
for (let i = 0; i < 14; i++) ctrl.push(new THREE.Vector3(i < 2 ? 0 : Math.sin(i * 1.3) * 14 + Math.sin(i * 0.5) * 6, -i * 3.2, -i * 26));
const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
const LEN = curve.getLength();
const UP = new THREE.Vector3(0, 1, 0);
function frameAt(d: number) {
  const u = THREE.MathUtils.clamp(d / LEN, 0, 1);
  const p = curve.getPointAt(u), t = curve.getTangentAt(u);
  if (d < 0) p.addScaledVector(t, d); else if (d > LEN) p.addScaledVector(t, d - LEN);
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
const picCols = [0xe2197a, 0xff9f1c, 0x1ec8c8, 0xb04bff, 0x8ae234, 0xffd23f];
const flagGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.2, 0.24), new THREE.Vector2(0.2, 0.24), new THREE.Vector2(0.2, -0.16), new THREE.Vector2(0.1, -0.24), new THREE.Vector2(0, -0.16), new THREE.Vector2(-0.1, -0.24), new THREE.Vector2(-0.2, -0.16)]));
const flagSpots: { p: THREE.Vector3; t: THREE.Vector3; c: number }[] = [], bulbSpots: THREE.Vector3[] = [];
const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6), postMat = new THREE.MeshStandardMaterial({ color: 0x2a1a1a });
function papel(d: number) {
  const a = at(d, -4.2), b = at(d, 4.2);
  for (const q of [a, b]) { const post = new THREE.Mesh(postGeo, postMat); post.position.copy(q).add(new THREE.Vector3(0, 2.2, 0)); scene.add(post); }
  for (const [hgt, n, sag] of [[4.25, 18, 0.55], [3.7, 14, 0.4]] as [number, number, number][]) for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, p = a.clone().lerp(b, t); p.y += hgt - Math.sin(t * Math.PI) * sag; flagSpots.push({ p, t: frameAt(d).t, c: picCols[(k + Math.floor(d)) % 6] });
  }
  for (let k = 0; k < 12; k++) { const t = (k + 0.5) / 12, p = a.clone().lerp(b, t); p.y += 3.3 - Math.sin(t * Math.PI) * 0.7; bulbSpots.push(p); }
}
for (let d = 10; d < LEN - 8; d += 11) papel(d);
const flagIM = new THREE.InstancedMesh(flagGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), flagSpots.length);
flagSpots.forEach((f, i) => flagIM.setColorAt(i, new THREE.Color(f.c).multiplyScalar(0.75))); scene.add(flagIM);
const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd98a, fog: false }), bulbSpots.length);
{ const m = new THREE.Matrix4(); bulbSpots.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); bulbIM.setMatrixAt(i, m); bulbIM.setColorAt(i, new THREE.Color(picCols[i % 6]).lerp(new THREE.Color(0xfff2c0), 0.55)); }); scene.add(bulbIM); }
const fDummy = new THREE.Object3D();
function swayFlags(t: number) { flagSpots.forEach((f, i) => { fDummy.position.copy(f.p); fDummy.lookAt(tmpV.copy(f.p).add(f.t)); fDummy.rotateX(Math.sin(t * 2.2 + i * 0.6) * 0.3); fDummy.updateMatrix(); flagIM.setMatrixAt(i, fDummy.matrix); }); flagIM.instanceMatrix.needsUpdate = true; }
const tmpV = new THREE.Vector3();
for (let d = 6; d < LEN - 10; d += 7) { const s = rnd() < 0.5 ? -1 : 1; if (rnd() < 0.22) ofrenda(d, s * 6.2); else tomb(d, s * (5 + rnd() * 3)); if (rnd() < 0.5) tomb(d + 3, -s * (5.5 + rnd() * 4)); }
// petals on road
{ const g = new THREE.CircleGeometry(0.07, 5); const m1 = new THREE.MeshBasicMaterial({ color: 0xff9f1c }), m2 = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = 0; i < 900; i++) { const m = new THREE.Mesh(g, i % 3 ? m1 : m2); m.position.copy(at(rnd() * LEN, (rnd() - 0.5) * 6.6, 0.02)); m.rotation.x = -Math.PI / 2; scene.add(m); } }
// end glow
const endP = at(LEN - 2, 0, 2);
const endGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flame, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffe0a0 }));
endGlow.scale.set(40, 30, 1); endGlow.position.copy(endP); scene.add(endGlow);
warm.position.copy(endP).add(new THREE.Vector3(0, 4, 0));
// distant llama pinata (Gabe's cutout, unlit, uniform scale) hanging near the light
const farLlama = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6), new THREE.MeshBasicMaterial({ map: (() => { const t = tl.load(P); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, alphaTest: 0.35, fog: false, toneMapped: false }));
farLlama.position.copy(at(LEN - 8, 0, 6.5)); scene.add(farLlama);
// faint flying-chancla motif (gold chancla sprites, untouched art)
const decoChanclas: THREE.Sprite[] = [];
for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tl.load('/s3d/chancla_gold.webp'), transparent: true, opacity: 0.35, depthWrite: false, fog: true })); const pos = at(20 + i * 25, (i % 2 ? 1 : -1) * (12 + rnd() * 10), 7 + rnd() * 6); sp.position.copy(pos); sp.userData.y = pos.y; sp.scale.set(3, 3, 1); scene.add(sp); decoChanclas.push(sp); }
// (lander hall backdrop tried and dropped: it overpowered the night sky)

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

type Skull = { g: THREE.Group; jaw: THREE.Group; d: number; lane: number; alive: boolean; t: number; spitT: number };
type Pickup = { g: THREE.Group; d: number; lane: number; alive: boolean; t: number };
let pickups: Pickup[] = [];
function addPickup(d: number, lane: number) {
  const g = new THREE.Group();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: flame, color: 0xffd23f, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.scale.setScalar(1.5); g.add(halo);
  const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldTex, fog: false, toneMapped: false, depthWrite: false })); c.scale.setScalar(1.1); g.add(c);
  scene.add(g); pickups.push({ g, d, lane, alive: true, t: Math.random() * 3 });
}
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
  for (const s of skulls) scene.remove(s.g); for (const p of pins) scene.remove(p.m); for (const k of pickups) scene.remove(k.g); pickups = [];
  for (const c of crates) { scene.remove(c.mesh); world.removeBody(c.body); } for (const b of statics) world.removeBody(b);
  for (const s of shots) { scene.remove(s.mesh); world.removeBody(s.body); } for (const s of spits) scene.remove(s.m);
  skulls = []; pins = []; crates = []; shots = []; spits = []; statics = [];
}
function startStage(i: number) {
  si = i; clearStage(); const st = STAGES[i]; st.build(st.from, st.to); for (let q = 0; q < 3; q++) addPickup(st.from + (st.to - st.from) * (0.2 + q * 0.27), (q + i) % 3);
  total = skulls.length + pins.length + crates.length; kills = 0; stageScore = 0;
  turnT = 0; runPh = 0; ammo = st.ammo; hearts = 3; lostHeart = false; lane = 1; laneX = 0; dist = st.from; playing = true;
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
const goldTex = (() => { const t = tl.load('/s3d/chancla_gold.webp'); t.colorSpace = THREE.SRGBColorSpace; return t; })();
void chanclaMesh;
function goldChancla() {
  const g = new THREE.Group();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldTex, fog: false, toneMapped: false, depthWrite: false }));
  sp.scale.set(1.5, 1.5, 1); sp.name = 'gold'; g.add(sp); return g;
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
  const s: Shot = { body, mesh: goldChancla(), age: 0, prev: o.clone() }; world.addBody(body); scene.add(s.mesh); shots.push(s);
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
const RAINBOW = [0xe2197a, 0xff9f1c, 0xffd23f, 0x1ec8c8, 0xb04bff];
const sparkMats = RAINBOW.map((c) => new THREE.SpriteMaterial({ map: flame, color: c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
const sparks: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
function spark(p: THREE.Vector3, n: number, speed: number, size = 0.35) { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(sparkMats[(Math.random() * 5) | 0]); s.position.copy(p); s.scale.setScalar(size); scene.add(s); sparks.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.3) * speed, (Math.random() - 0.5) * speed), life: 0.6 }); } }
function burst(p: THREE.Vector3, n = 50) {
  spark(p, 24, 6, 0.5);
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
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (paused) dt = 0;
  if (slow > 0) { slow -= dt; dt *= 0.3; }
  clock += dt;
  world.step(1 / 120, dt, 6);
  const st = STAGES[si];
  const running = heroFrame(dt);
  if (playing && running) dist = Math.min(st.to, dist + SPEED * dt);
  laneX += (LANES[lane] - laneX) * Math.min(1, dt * 10);
  const me = at(dist, laneX, 1.2);
  setBright(THREE.MathUtils.smoothstep(dist / LEN, 0.55, 1));
  // shots
  for (const s of shots) {
    s.age += dt; s.body.applyForce(new CANNON.Vec3(st.wind * s.body.mass, 0, 0));
    s.mesh.position.set(s.body.position.x, s.body.position.y, s.body.position.z); { const g = s.mesh.children[0] as THREE.Sprite; g.material.rotation -= dt * 14; if (s.age > 0.12 && s.age < 2) spark(s.mesh.position, 1, 0.6, 0.28); }
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
    k.g.lookAt(camera.position); jawOpen(k.jaw, Math.max(0, Math.sin(k.t * 7)));
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
  for (const sp of sparks) { sp.life -= dt; sp.s.position.addScaledVector(sp.v, dt); sp.s.scale.multiplyScalar(0.97); }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) { scene.remove(sparks[i].s); sparks.splice(i, 1); }
  for (const pk of pickups) { if (!pk.alive) continue; pk.t += dt; pk.g.position.copy(at(pk.d, LANES[pk.lane], 1.1 + Math.sin(pk.t * 3) * 0.12)); (pk.g.children[1] as THREE.Sprite).material.rotation = pk.t * 2; (pk.g.children[0] as THREE.Sprite).material.color.setHex(RAINBOW[Math.floor(pk.t * 4) % 5]);
    if (playing && Math.abs(pk.d - dist) < 0.8 && Math.abs(LANES[pk.lane] - laneX) < 1) { pk.alive = false; scene.remove(pk.g); ammo += 2; addScore(10); spark(pk.g.position, 30, 5, 0.45); beep(990, 0.12, 'triangle', 0.08); const a = $('ammo').parentElement!; a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop'); } }
  for (const c of candy) { c.life -= dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 5; }
  for (let i = candy.length - 1; i >= 0; i--) if (candy[i].life <= 0) { scene.remove(candy[i].m); candy.splice(i, 1); }
  flames.forEach((f, i) => f.scale.set(0.35 + Math.sin(clock * 13 + i) * 0.04, 0.5 + Math.sin(clock * 17 + i * 2) * 0.07, 1));
  swayFlags(clock);
  decoChanclas.forEach((c, i) => { c.material.rotation = clock * (0.6 + i * 0.07); c.position.y = c.userData.y + Math.sin(clock + i) * 0.6; });
  lantern.position.copy(at(dist + 3, laneX * 0.5, 2.2));
  updateSmoke(me, dt);
  if (playing) { if (hearts <= 0) endStage(false); else if (dist >= st.to - 0.01) endStage(true); }
  // camera behind & above, looking down the hill
  const f = frameAt(dist), back = at(dist - 4.5, laneX * 0.85, 3.4), look = at(dist + 9, laneX * 0.5, 0.4);
  void f;
  const sx = shake > 0 ? (rnd() - 0.5) * shake : 0; shake = Math.max(0, shake - dt * 1.5);
  camera.position.copy(back).add(new THREE.Vector3(sx, sx * 0.6, 0)); camera.lookAt(look);
  if (camOverride) { const o = camOverride; camera.position.copy(at(o[0], o[1], o[2])); camera.lookAt(at(o[0] + o[3], o[4], o[5])); }
  const hp = at(dist + 0.6, laneX, 0); shadow.position.copy(hp).add(new THREE.Vector3(0, 0.03, 0)); hero.position.copy(hp).add(new THREE.Vector3(0, hero.scale.y / 2 - heroDrop, 0)); hero.lookAt(tmp.copy(camera.position).setY(hero.position.y));
  stars.position.copy(camera.position); stars.material.opacity = 0.7 * (1 - THREE.MathUtils.smoothstep(dist / LEN, 0.6, 1));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function spit(k: Skull) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7dff6a })); scene.add(m);
  spits.push({ m, from: k.g.position.clone(), d: dist, lane, t: 0 }); beep(880, 0.1, 'square', 0.06);
  $('warn').textContent = lane === 0 ? 'DODGE →' : lane === 2 ? '← DODGE' : '← DODGE →';
}
// masked Sidro: Gabe's sprite sheets (unlit, original colors). Turnaround then run cycle.
function sheetMat(u: string, n: number) { const t = tl.load(u); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / n, 1); t.magFilter = THREE.LinearFilter; return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, fog: false, toneMapped: false, depthTest: false }); }
// per-frame lowest opaque foot pixel (of 492px band) -> drop each frame so the lowest foot touches the ground; per-frame durations (s)
const RUN_LOW = [438, 447, 458, 491, 482];
const RUN = { n: 5, mat: sheetMat('/s3d/sidro_run.webp', 5), w: 292 / 492 * 1.3, h: 1.3 };
const TURN = { n: 9, mat: sheetMat('/s3d/sidro_turn.webp', 9), w: 181 / 507 * 1.34, h: 1.34, order: [0, 0, 0, 1, 2, 3, 5, 6, 7, 8, 8] };
const hero = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), TURN.mat); hero.renderOrder = 10; scene.add(hero);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 0.55, 1); scene.add(shadow);
let camOverride: number[] | null = null;
const GAITS: Record<string, { seq: [number, number][]; dt: number; steps: number }> = {
  old: { seq: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], dt: 0.078, steps: 1 },
  even: { seq: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], dt: 0.064, steps: 1 },
  pp: { seq: [[0, 0], [1, 0], [2, 0], [1, 0]], dt: 0.08, steps: 1 },
};
let gaitK = 'pp';
let turnT = 0, runPh = 0, runI = 0, heroDrop = 0, paused = false;
function heroFrame(dt: number) {
  if (turnT < TURN.order.length / 10) { heroDrop = 0; turnT += dt; const i = TURN.order[Math.min(TURN.order.length - 1, Math.floor(turnT * 10))]; hero.material = TURN.mat; TURN.mat.map!.offset.x = i / TURN.n; hero.scale.set(TURN.w, TURN.h, 1); return false; }
  // gait: [frame, mirrored] steps at even timing; one step (half stride) = 4 frames, mirrored half = other leg. Loop ~0.32s at SPEED 5.2.
  const G = GAITS[gaitK]; runPh += dt * (SPEED / 5.2); while (runPh >= G.dt) { runPh -= G.dt; runI = (runI + 1) % G.seq.length; }
  const [f, flip] = G.seq[runI % G.seq.length], mp = RUN.mat.map!;
  hero.material = RUN.mat; mp.repeat.x = flip ? -1 / RUN.n : 1 / RUN.n; mp.offset.x = (flip ? f + 1 : f) / RUN.n;
  const bob = Math.abs(Math.sin((runI + runPh / G.dt) / G.seq.length * Math.PI * G.steps)) * 0.035;
  hero.scale.set(RUN.w, RUN.h, 1); heroDrop = ((492 - RUN_LOW[f]) / 492) * RUN.h - bob; return true;
}

(window as unknown as Record<string, unknown>).__s3d = { gait: (k: string) => { gaitK = k; runI = 0; runPh = 0; },
  throwChancla, dodge, startStage, spit: () => skulls.find((k) => k.alive) && spit(skulls.find((k) => k.alive)!),
  state: () => ({ si, score, ammo, hearts, lane, playing, dist: +dist.toFixed(1), to: +STAGES[si].to.toFixed(1), skulls: skulls.filter((k) => k.alive).map((k) => [k.lane, +(k.d - dist).toFixed(1)]), pins: pins.filter((p) => p.alive).map((p) => [p.lane, +(p.d - dist).toFixed(1)]), kills, total }),
  jump: (d: number) => { dist = d; },
  story: (k: string) => { localStorage.removeItem(SKIP_KEY); playStory(k, () => {}); },
  smoke: (v: boolean) => smoke.forEach((m) => (m.s.visible = v)),
  look: (d: number, x: number, y: number, tx: number, ty: number, tz: number) => { paused = true; camOverride = [d, x, y, tx, ty, tz]; },
  bd: (v: boolean) => { const b = camera.children.find((c) => (c as THREE.Mesh).geometry?.type === 'PlaneGeometry' && (c as THREE.Mesh).position.z === -185); if (b) b.visible = v; },
  cam: () => [camera.position.toArray(), camera.getWorldDirection(new THREE.Vector3()).toArray(), at(20, 0, 0).toArray(), camera.children.length],
  cob: () => (cobble.image as HTMLCanvasElement).toDataURL(),
  pose: (t: number) => { turnT = t; paused = true; }, unpause: () => { paused = false; },
  hero: () => ({ turnT: +turnT.toFixed(2), frame: hero.material === RUN.mat ? 'run' + runI : 'turn', off: (hero.material as THREE.MeshBasicMaterial).map!.offset.x }),
  heroRect: () => { const r = stage.getBoundingClientRect(); const pts = [[-0.5, -0.5], [0.5, 0.5]].map(([x, y]) => { const v = new THREE.Vector3(x, y, 0); hero.localToWorld(v); v.project(camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }); return pts; },
};
STAGES[0].build(STAGES[0].from, STAGES[0].to);
renderComicBgs();
clearStage();
requestAnimationFrame(frame);
playStory('intro', () => startStage(0));
