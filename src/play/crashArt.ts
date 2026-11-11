// Chancla Crash: every 3D prop, texture, and backdrop is built in code (canvas textures + low-poly meshes).
import * as THREE from 'three';

type Ctx = CanvasRenderingContext2D;
function canvasTex(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!; draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const cache = new Map<string, THREE.Texture>();
function cached<T extends THREE.Texture>(k: string, f: () => T): T { if (!cache.has(k)) cache.set(k, f()); return cache.get(k) as T; }

let seed = 7;
export function rnd(): number { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function reseed(s: number): void { seed = s; }

export const PAL = { pink: '#e2197a', orange: '#ff8c1a', gold: '#ffd23f', teal: '#1ec8c8', purple: '#8a3cff', green: '#3cc85a', blue: '#3b6dff', red: '#e8322c', cream: '#f6efe2' };

function flower(g: Ctx, x: number, y: number, r: number, petal: string, center: string, n = 6): void {
  g.fillStyle = petal;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.28, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = center; g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill();
}

/** Sugar skull face (front of skull blocks + skeleton heads). */
export function sugarSkullTex(accent: string, bg = PAL.cream): THREE.CanvasTexture {
  return cached('ss' + accent + bg, () => canvasTex(256, 256, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
    // eye sockets with petal rims
    for (const ex of [82, 174]) {
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.fillStyle = i % 2 ? accent : PAL.gold; g.beginPath(); g.arc(ex + Math.cos(a) * 34, 112 + Math.sin(a) * 34, 10, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#1a0a1f'; g.beginPath(); g.arc(ex, 112, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 8, 104, 6, 0, Math.PI * 2); g.fill();
    }
    // forehead flower + dots
    flower(g, 128, 44, 30, accent, PAL.gold, 8);
    g.fillStyle = PAL.teal; for (const dx of [-60, -44, 44, 60]) { g.beginPath(); g.arc(128 + dx, 50 + Math.abs(dx) * 0.2, 5, 0, Math.PI * 2); g.fill(); }
    // nose: upside-down heart
    g.fillStyle = '#1a0a1f'; g.beginPath(); g.moveTo(128, 172); g.bezierCurveTo(108, 156, 112, 140, 122, 142); g.lineTo(128, 150); g.lineTo(134, 142); g.bezierCurveTo(144, 140, 148, 156, 128, 172); g.fill();
    // stitched smile
    g.strokeStyle = '#1a0a1f'; g.lineWidth = 5; g.beginPath(); g.moveTo(66, 200); g.quadraticCurveTo(128, 236, 190, 200); g.stroke();
    g.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = 76 + i * 13; const y = 200 + Math.sin((i / 8) * Math.PI) * 17; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke(); }
    // cheek swirls
    g.strokeStyle = accent; g.lineWidth = 4;
    for (const cx of [44, 212]) { g.beginPath(); g.arc(cx, 176, 12, 0, Math.PI * 1.6); g.stroke(); }
  }));
}
/** Sides of sugar-skull blocks: bright colour with dotted lace. */
export function laceTex(color: string): THREE.CanvasTexture {
  return cached('lace' + color, () => canvasTex(128, 128, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let y = 10; y < 128; y += 22) for (let x = (y / 22) % 2 ? 21 : 10; x < 128; x += 22) { g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.strokeRect(4, 4, 120, 120);
    flower(g, 64, 64, 22, PAL.gold, '#fff', 6);
  }));
}
export function crateTex(): THREE.CanvasTexture {
  return cached('crate', () => canvasTex(128, 128, (g) => {
    g.fillStyle = '#a86a32'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#b77a3e' : '#9c5f2b'; g.fillRect(0, i * 32, 128, 30); g.fillStyle = 'rgba(60,30,10,.5)'; g.fillRect(0, i * 32 + 30, 128, 2); }
    g.strokeStyle = '#6b3f17'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
    g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 118); g.stroke();
    flower(g, 64, 64, 26, PAL.orange, '#c2410c', 10); flower(g, 64, 64, 14, PAL.gold, '#c2410c', 8);
  }));
}
export function woodTex(): THREE.CanvasTexture {
  return cached('wood', () => canvasTex(128, 32, (g) => {
    g.fillStyle = '#8f5427'; g.fillRect(0, 0, 128, 32);
    g.strokeStyle = 'rgba(50,25,8,.45)'; g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 4 + i * 5); g.bezierCurveTo(40, 2 + i * 5, 80, 7 + i * 5, 128, 4 + i * 5); g.stroke(); }
    g.strokeStyle = '#5a3212'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 29);
  }));
}
export function deflectorTex(): THREE.CanvasTexture {
  return cached('defl', () => canvasTex(128, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#5ff7f0'); gr.addColorStop(1, '#0f8f9a');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#fff'; g.lineWidth = 10; g.lineJoin = 'round';
    for (const x of [30, 62, 94]) { g.beginPath(); g.moveTo(x - 10, 38); g.lineTo(x + 10, 64); g.lineTo(x - 10, 90); g.stroke(); }
    g.strokeStyle = '#d6fffd'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  }));
}
export function glowTex(): THREE.CanvasTexture {
  return cached('glow', () => canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,220,140,.8)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }));
}
export function dotTex(): THREE.CanvasTexture {
  return cached('dot', () => canvasTex(32, 32, (g) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,10,60,.9)'; g.lineWidth = 3; g.stroke();
  }));
}
export function reticleTex(): THREE.CanvasTexture {
  return cached('ret', () => canvasTex(128, 128, (g) => {
    g.strokeStyle = 'rgba(40,10,60,.85)'; g.lineWidth = 16; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
    g.fillStyle = PAL.gold; g.beginPath(); g.arc(64, 64, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 7;
    for (const [a, b, c2, d] of [[64, 4, 64, 26], [64, 102, 64, 124], [4, 64, 26, 64], [102, 64, 124, 64]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); }
  }));
}

// ───────────────────────── props ─────────────────────────
const lambert = (o: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(o);
const mats = {
  bone: lambert({ color: 0xf3ead8 }),
  boneDark: lambert({ color: 0xcfc2a8 }),
  dark: lambert({ color: 0x1a0a1f }),
  clay: lambert({ color: 0xc8622f }),
  cream: lambert({ color: 0xf7ecd0, emissive: 0x2a1a00 }),
};
export function boxMats(front: THREE.Texture, side: THREE.Texture): THREE.Material[] {
  const s = lambert({ map: side }), f = lambert({ map: front });
  return [s, s, s, s, f, s]; // +x -x +y -y +z(front) -z
}

/** Gold chancla (flip-flop), length along +z, lying flat. ~0.9 long. */
export function makeChancla(): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.45);
  s.bezierCurveTo(0.17, -0.45, 0.17, -0.22, 0.15, -0.05);
  s.bezierCurveTo(0.14, 0.12, 0.21, 0.28, 0.19, 0.38);
  s.bezierCurveTo(0.16, 0.48, -0.16, 0.48, -0.19, 0.38);
  s.bezierCurveTo(-0.21, 0.28, -0.14, 0.12, -0.15, -0.05);
  s.bezierCurveTo(-0.17, -0.22, -0.17, -0.45, 0, -0.45);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(Math.PI / 2); geo.translate(0, 0.05, 0);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.65, roughness: 0.28, emissive: 0x5a3a00, emissiveIntensity: 0.6 });
  const sole = new THREE.Mesh(geo, gold); sole.castShadow = true; g.add(sole);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0xe8a514, metalness: 0.5, roughness: 0.35, emissive: 0x3a2400 });
  const toe = new THREE.Vector3(0, 0.08, 0.26);
  for (const side of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(toe, new THREE.Vector3(side * 0.12, 0.2, 0.08), new THREE.Vector3(side * 0.16, 0.08, -0.08));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.028, 6), strapMat); m.castShadow = true; g.add(m);
  }
  return g;
}

export function makeSkeleton(accent: string): { group: THREE.Group; armL: THREE.Group; armR: THREE.Group } {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), [mats.bone]);
  head.scale.set(1, 0.95, 0.92); head.position.y = 0.36; g.add(head);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), lambert({ map: sugarSkullTex(accent), transparent: false }));
  face.position.set(0, 0.36, 0.215); g.add(face);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), mats.bone); jaw.position.set(0, 0.15, 0.06); g.add(jaw);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), mats.boneDark); spine.position.y = -0.07; g.add(spine);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.12 - i * 0.015, 0.025, 5, 12, Math.PI * 1.4), mats.bone);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.3 + Math.PI); rib.position.set(0, 0.05 - i * 0.08, 0.02); g.add(rib);
  }
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.12), mats.bone); pelvis.position.y = -0.29; g.add(pelvis);
  const limb = (len: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, len, 6), mats.bone); m.position.y = -len / 2; m.castShadow = true; return m; };
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.add(limb(0.27)); leg.position.set(sx * 0.08, -0.31, 0); leg.rotation.z = sx * 0.08; g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.14), mats.bone); foot.position.set(sx * 0.1, -0.58, 0.03); g.add(foot);
  }
  const arm = (sx: number) => { const a = new THREE.Group(); const l = limb(0.3); a.add(l); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mats.bone); hand.position.y = -0.31; a.add(hand); a.position.set(sx * 0.15, 0.06, 0); a.rotation.z = sx * 2.4; g.add(a); return a; };
  const armL = arm(-1), armR = arm(1);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { group: g, armL, armR };
}

export function makePinata(): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), lambert({ color: 0xff3d9a, flatShading: true }));
  g.add(core);
  const cols = [0xffd23f, 0x1ec8c8, 0xff8c1a, 0x8a3cff, 0x3cc85a, 0xe8322c, 0xffd23f];
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0.7, 0.7, 0], [-0.7, 0.7, 0]];
  dirs.forEach((d, i) => {
    const v = new THREE.Vector3(...(d as [number, number, number])).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8), lambert({ color: cols[i], flatShading: true }));
    cone.position.copy(v.clone().multiplyScalar(0.3)); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); g.add(cone);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), lambert({ color: cols[(i + 2) % cols.length] }));
    tassel.position.copy(v.clone().multiplyScalar(0.48)); tassel.quaternion.copy(cone.quaternion); tassel.rotateX(Math.PI); g.add(tassel);
  });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
}

export function jarritoTex(): THREE.CanvasTexture {
  return cached('jarrito', () => canvasTex(256, 64, (g) => {
    g.fillStyle = '#c8622f'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#f6efe2'; g.fillRect(0, 22, 256, 4); g.fillRect(0, 44, 256, 3);
    for (let x = 8; x < 256; x += 32) { flower(g, x + 8, 35, 9, '#f6efe2', PAL.gold, 5); }
    g.fillStyle = '#2b6b4a'; for (let x = 0; x < 256; x += 16) { g.beginPath(); g.arc(x + 8, 12, 3, 0, Math.PI * 2); g.fill(); }
  }));
}
/** Clay jarrito (cup/pot): ~0.55 tall, origin at centre. */
export function makeJarrito(): THREE.Group {
  const g = new THREE.Group();
  const pts = [[0, -0.27], [0.15, -0.27], [0.2, -0.2], [0.24, -0.05], [0.22, 0.1], [0.17, 0.2], [0.19, 0.27], [0.17, 0.28]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), lambert({ map: jarritoTex(), side: THREE.DoubleSide }));
  g.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10, Math.PI * 1.2), mats.clay);
  handle.position.set(0.23, 0.04, 0); handle.rotation.z = -Math.PI * 0.6; g.add(handle);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
}
export function makeCandle(h: number, color = 0xf7ecd0): { group: THREE.Group; flame: THREE.Sprite } {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, h, 10), lambert({ color, emissive: 0x2a1500 }));
  wax.castShadow = true; g.add(wax);
  const drip = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 4, 10), lambert({ color })); drip.rotation.x = Math.PI / 2; drip.position.y = h / 2 - 0.02; g.add(drip);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); core.position.y = h / 2 + 0.07; g.add(core);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffb347, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.scale.set(0.42, 0.55, 1); flame.position.y = h / 2 + 0.1; g.add(flame);
  return { group: g, flame };
}

// ───────────────────────── backdrops ─────────────────────────
export type WorldId = 'plaza' | 'cemetery' | 'mercado';
export const WORLD_NAMES: Record<WorldId, string> = { plaza: 'Plaza de los Muertos', cemetery: 'El Panteón', mercado: 'El Mercado' };

function skyTex(top: string, mid: string, bottom: string, stars: number): THREE.CanvasTexture {
  return canvasTex(512, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < stars; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; const r = rnd() * 1.4 + 0.3; g.beginPath(); g.arc(rnd() * 512, rnd() * 300, r, 0, Math.PI * 2); g.fill(); }
  });
}
function facadeTex(wall: string, glowA: string, glowB: string, cols: number, rows: number): THREE.CanvasTexture {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.18})`; g.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 30, 3 + rnd() * 10); }
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c2 = 0; c2 < cols; c2++) {
      if (rnd() < 0.15) continue;
      const x = c2 * cw + cw * 0.28, y = r * rh + rh * 0.22, ww = cw * 0.44, hh = rh * 0.6;
      const lit = rnd() < 0.8; const col = rnd() < 0.55 ? glowA : glowB;
      g.save(); g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x, y + ww / 2); g.arc(x + ww / 2, y + ww / 2, ww / 2, Math.PI, 0); g.lineTo(x + ww, y + hh); g.closePath();
      g.shadowColor = lit ? col : 'transparent'; g.shadowBlur = lit ? 26 : 0;
      const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, lit ? '#fff' : '#120818'); gr.addColorStop(0.35, lit ? col : '#1a0d26'); gr.addColorStop(1, lit ? '#1a0a40' : '#0c0612');
      g.fillStyle = gr; g.fill(); g.restore();
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + ww / 2, y + 4); g.lineTo(x + ww / 2, y + hh); g.moveTo(x, y + hh * 0.55); g.lineTo(x + ww, y + hh * 0.55); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let r = 1; r < rows; r++) g.fillRect(0, r * rh - 4, w, 8);
  });
}
function floorTex(base: string, line: string, kind: 'cobble' | 'dirt' | 'tile'): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    if (kind === 'tile') {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#a5502a' : '#b85e30'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
      return;
    }
    if (kind === 'dirt') { for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.25)' : 'rgba(80,120,60,.18)'; g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 5, 2 + rnd() * 4); } return; }
    g.strokeStyle = line; g.lineWidth = 4;
    // irregular flagstones: jittered grid
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 32 + 16 + (rnd() - 0.5) * 6, cy = y * 32 + 16 + (rnd() - 0.5) * 6, r = 12 + rnd() * 3;
      g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.05})`; g.beginPath(); g.ellipse(cx, cy, r, r * (0.8 + rnd() * 0.2), rnd() * 3, 0, Math.PI * 2); g.fill();
    }
  }, [18, 18]);
}
function papelTex(color: string): THREE.CanvasTexture {
  return cached('papel' + color, () => canvasTex(96, 128, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 96, 112);
    for (let x = 0; x < 96; x += 12) { g.beginPath(); g.moveTo(x, 112); g.lineTo(x + 6, 126); g.lineTo(x + 12, 112); g.fill(); }
    g.globalCompositeOperation = 'destination-out';
    flower(g, 48, 52, 26, '#000', '#000', 8);
    for (const [x, y] of [[14, 16], [82, 16], [14, 92], [82, 92]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
    g.fillRect(30, 92, 36, 6);
  }));
}
function stripeTex(a: string, b: string): THREE.CanvasTexture {
  return canvasTex(128, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 16, 0, 16, 32); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 26, 128, 6); });
}

export interface Backdrop { group: THREE.Group; update(t: number): void; fog: THREE.Fog; platformMat: THREE.Material[]; hemi: [number, number]; sun: number; }

function papelString(group: THREE.Group, x0: number, x1: number, y: number, z: number, sag: number, anim: THREE.Object3D[]): void {
  const n = Math.floor(Math.abs(x1 - x0) / 0.62);
  const colors = [PAL.pink, PAL.orange, PAL.teal, PAL.purple, PAL.gold, PAL.green, PAL.blue];
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, y, z), new THREE.Vector3((x0 + x1) / 2, y - sag * 2, z), new THREE.Vector3(x1, y, z)), 20, 0.012, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  group.add(line);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, yy = y - sag * 4 * t * (1 - t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshBasicMaterial({ map: papelTex(colors[(i + Math.floor(z)) % colors.length]), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, fog: true }));
    m.geometry.translate(0, -0.33, 0); m.position.set(x, yy, z); m.userData.phase = rnd() * 6; group.add(m); anim.push(m);
  }
}
function lightString(group: THREE.Group, x0: number, x1: number, y: number, z: number, sag: number, anim: THREE.Object3D[]): void {
  const n = Math.floor(Math.abs(x1 - x0) / 0.5);
  const cols = [0xffd23f, 0xff8c1a, 0xff3d9a, 0x1ec8c8];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: cols[i % cols.length], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z); s.scale.setScalar(0.35); s.userData.phase = i; group.add(s); anim.push(s);
  }
}

export function buildBackdrop(world: WorldId): Backdrop {
  reseed(world === 'plaza' ? 11 : world === 'cemetery' ? 23 : 37);
  const group = new THREE.Group();
  const papel: THREE.Object3D[] = [], lights: THREE.Object3D[] = [];
  const cfg = {
    plaza: { sky: ['#06021a', '#1b0a45', '#3a1260'], fog: 0x1a0a33, floor: floorTex('#2a1f2e', '#140c18', 'cobble'), wall: '#241038', ga: '#3b6dff', gb: '#a04bff', plat: 0x4a2a66, trim: 0xffb347, hemi: [0x9a7aff, 0x2a1240], sun: 0xc8b0ff },
    cemetery: { sky: ['#020812', '#0b1d3a', '#1c2f4a'], fog: 0x0e1a2c, floor: floorTex('#1d2a1f', '#000', 'dirt'), wall: '#18202e', ga: '#ff9f1c', gb: '#ffd23f', plat: 0x5b6070, trim: 0xff8c1a, hemi: [0x8fb0ff, 0x1a2a20], sun: 0xa8c4ff },
    mercado: { sky: ['#2a0b3d', '#a2346a', '#ff9a4a'], fog: 0x5a2a4a, floor: floorTex('#9c4a26', '#000', 'tile'), wall: '#6b2f4f', ga: '#ffd23f', gb: '#ff8c1a', plat: 0x8f5427, trim: 0xffd23f, hemi: [0xffc4a0, 0x4a1a3a], sun: 0xffd8a8 },
  }[world];
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(cfg.sky[0], cfg.sky[1], cfg.sky[2], world === 'mercado' ? 40 : 260), side: THREE.BackSide, fog: false }));
  group.add(sky);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), lambert({ map: cfg.floor }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; group.add(floor);

  if (world === 'plaza' || world === 'mercado') {
    // building facades with glowing arched windows (the lander look)
    const fac = facadeTex(cfg.wall, cfg.ga, cfg.gb, 8, 3);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(36, 13), new THREE.MeshBasicMaterial({ map: fac, fog: true, color: world === 'plaza' ? 0xb8a8d8 : 0xd8b0b0 }));
    back.position.set(0, 6.5, -22); group.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(26, 11), new THREE.MeshBasicMaterial({ map: facadeTex(cfg.wall, cfg.ga, cfg.gb, 6, 3), fog: true, color: 0x9a8ab8 }));
      side.position.set(sx * 13, 5.5, -9); side.rotation.y = -sx * Math.PI * 0.42; group.add(side);
    }
    // arches/columns between buildings
    for (const x of [-6, 6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 7, 8), lambert({ color: world === 'plaza' ? 0x3a2350 : 0x7a3a50 })); col.position.set(x, 3.5, -16); group.add(col);
    }
  }
  if (world === 'plaza') {
    papelString(group, -7, 7, 7.2, -4, 0.5, papel);
    papelString(group, -8, 8, 7.8, -10, 0.6, papel);
    papelString(group, -9, 9, 9.2, -16, 0.7, papel);
    // fountain silhouette in the back
    const f = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.8, 16), lambert({ color: 0x3a2a48 })); f.position.set(0, 0.4, -18); group.add(f);
  }
  if (world === 'cemetery') {
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff2c8, fog: false, transparent: true, depthWrite: false })); moon.scale.setScalar(9); moon.position.set(6, 16, -40); group.add(moon);
    const moonCore = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false })); moonCore.position.set(6, 16, -39.8); group.add(moonCore);
    const stone = lambert({ color: 0x6b7080 }), stoneD = lambert({ color: 0x4a4f5e });
    for (let i = 0; i < 34; i++) {
      const x = (rnd() - 0.5) * 30, z = -14 - rnd() * 14; if (Math.abs(x) < 4 && z > -16) continue;
      const tg = new THREE.Group();
      const h = 0.9 + rnd() * 0.8; const slab = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.18), rnd() < 0.5 ? stone : stoneD); slab.position.y = h / 2; tg.add(slab);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 12, 1, false, 0, Math.PI), slab.material as THREE.Material); top.rotation.set(Math.PI / 2, 0, -Math.PI / 2); top.position.y = h; tg.add(top);
      if (rnd() < 0.4) { const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), stoneD); cross.position.y = h + 0.6; tg.add(cross); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), stoneD); arm.position.y = h + 0.7; tg.add(arm); }
      tg.position.set(x, 0, z); tg.rotation.set(0, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.15); group.add(tg);
    }
    // ofrenda arch of marigolds behind the targets
    const mari = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), lambert({ color: 0xff8c1a, emissive: 0x401800, flatShading: true }), 160);
    const m4 = new THREE.Matrix4(); let k = 0;
    for (let i = 0; i < 90; i++) { const a = Math.PI * (i / 89); m4.makeTranslation(Math.cos(a) * 5.2, 0.2 + Math.sin(a) * 6.2, -15 + (rnd() - 0.5) * 0.2); mari.setMatrixAt(k++, m4); }
    for (let i = 0; i < 70; i++) { m4.makeTranslation((rnd() - 0.5) * 2.2 + (rnd() < 0.5 ? -3.2 : 3.2), 0.12, 2 - rnd() * 14); mari.setMatrixAt(k++, m4); }
    mari.count = k; group.add(mari);
    // ofrenda candles glow
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set((rnd() - 0.5) * 9, 0.3 + rnd() * 0.3, -14 + rnd() * 2); s.scale.setScalar(0.6); s.userData.phase = rnd() * 6; group.add(s); lights.push(s); }
    papelString(group, -6, 6, 7, -9, 0.6, papel);
  }
  if (world === 'mercado') {
    const awn = [stripeTex('#ff3d9a', '#fff2d0'), stripeTex('#1ec8c8', '#fff2d0'), stripeTex('#ffd23f', '#e2197a'), stripeTex('#3cc85a', '#fff2d0')];
    const postM = lambert({ color: 0x5a3212 });
    const stalls: [number, number, number][] = [[-7.5, -12, 0.5], [7.5, -12, -0.5], [-4.5, -19, 0], [4.5, -19, 0], [-9, -5, 0.9], [9, -5, -0.9]];
    stalls.forEach(([x, z, ry], i) => {
      const st = new THREE.Group();
      for (const px of [-1.4, 1.4]) for (const pz of [-0.8, 0.8]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), postM); p.position.set(px, 1.3, pz); st.add(p); }
      const t = awn[i % awn.length].clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 2.2), lambert({ map: t })); roof.position.y = 2.7; roof.rotation.x = 0.18; st.add(roof);
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 1.5), lambert({ map: woodTex() })); table.position.y = 0.45; st.add(table);
      for (let j = 0; j < 9; j++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lambert({ color: [0xff8c1a, 0xe8322c, 0x3cc85a, 0xffd23f][j % 4] })); fr.position.set(-1.1 + (j % 5) * 0.55, 1.0, -0.3 + Math.floor(j / 5) * 0.5); st.add(fr); }
      st.position.set(x, 0, z); st.rotation.y = ry; group.add(st);
    });
    lightString(group, -8, 8, 6.2, -6, 0.6, lights);
    lightString(group, -9, 9, 7, -13, 0.7, lights);
    papelString(group, -7, 7, 7.6, -3, 0.5, papel);
  }
  const t0 = performance.now();
  return {
    group,
    fog: new THREE.Fog(cfg.fog, 18, world === 'cemetery' ? 46 : 58),
    platformMat: [lambert({ color: cfg.plat }), lambert({ color: cfg.trim, emissive: new THREE.Color(cfg.trim).multiplyScalar(0.15) })],
    hemi: cfg.hemi as [number, number], sun: cfg.sun,
    update(t: number) {
      const s = (t - t0) / 1000;
      for (const p of papel) p.rotation.x = Math.sin(s * 1.6 + p.userData.phase) * 0.22;
      for (const l of lights) { const k = 0.85 + Math.sin(s * 3 + l.userData.phase * 1.7) * 0.15; (l as THREE.Sprite).material.opacity = k; }
    },
  };
}

// ───────────────────────── starred characters (pan dulce + cafecito) ─────────────────────────
export type Mood = 'happy' | 'smug' | 'nervous' | 'dizzy';
/** Big-eyed cartoon face decal (transparent), Chanclazo HD vector look: thick outlines, glossy highlights, blush. */
export function faceTex(mood: Mood): THREE.CanvasTexture {
  return cached('face' + mood, () => canvasTex(256, 256, (g) => {
    const ink = '#2a0f22';
    g.lineCap = 'round'; g.lineJoin = 'round';
    const eye = (x: number) => {
      if (mood === 'dizzy') { g.strokeStyle = ink; g.lineWidth = 12; g.beginPath(); g.moveTo(x - 22, 88); g.lineTo(x + 22, 132); g.moveTo(x + 22, 88); g.lineTo(x - 22, 132); g.stroke(); return; }
      g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 8;
      g.beginPath(); g.ellipse(x, 110, 34, 40, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      const px = x + (mood === 'nervous' ? (x < 128 ? -6 : 6) : 4), py = mood === 'smug' ? 120 : 114;
      g.fillStyle = ink; g.beginPath(); g.ellipse(px, py, 18, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px - 7, py - 9, 7, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(px + 6, py + 7, 3.5, 0, Math.PI * 2); g.fill();
      if (mood === 'smug') { g.fillStyle = 'rgba(0,0,0,0)'; g.strokeStyle = ink; g.lineWidth = 9; g.beginPath(); g.moveTo(x - 34, 100); g.lineTo(x + 34, 100); g.stroke(); }
    };
    eye(84); eye(172);
    // brows
    g.strokeStyle = ink; g.lineWidth = 10;
    if (mood === 'smug') { g.beginPath(); g.moveTo(54, 56); g.lineTo(108, 66); g.moveTo(148, 66); g.lineTo(202, 56); g.stroke(); }
    if (mood === 'nervous') { g.beginPath(); g.moveTo(58, 66); g.lineTo(104, 52); g.moveTo(152, 52); g.lineTo(198, 66); g.stroke(); }
    if (mood === 'happy') { g.beginPath(); g.arc(84, 70, 26, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); g.beginPath(); g.arc(172, 70, 26, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
    // blush
    g.fillStyle = 'rgba(255,90,140,.55)'; g.beginPath(); g.ellipse(46, 168, 20, 12, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(210, 168, 20, 12, 0, 0, Math.PI * 2); g.fill();
    // mouth
    g.strokeStyle = ink; g.lineWidth = 8;
    if (mood === 'happy' || mood === 'dizzy') {
      g.fillStyle = '#7a1630'; g.beginPath(); g.moveTo(96, 160); g.quadraticCurveTo(128, 215, 160, 160); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff6f8f'; g.beginPath(); g.ellipse(128, 188, 14, 8, 0, 0, Math.PI * 2); g.fill();
    } else if (mood === 'smug') { g.beginPath(); g.moveTo(100, 176); g.quadraticCurveTo(140, 190, 164, 162); g.stroke(); }
    else { g.fillStyle = '#7a1630'; g.beginPath(); g.ellipse(128, 178, 16, 20, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#7fd4ff'; g.beginPath(); g.ellipse(214, 74, 8, 13, 0, 0, Math.PI * 2); g.fill(); }
  }));
}
/** Concha sugar topping: scored shell pattern. */
function conchaTex(top: string, line: string): THREE.CanvasTexture {
  return cached('concha' + top, () => canvasTex(256, 256, (g) => {
    g.fillStyle = top; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.35})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    // scored arcs radiating from the crown (sphere UV: v=0 top) -> horizontal-ish grooves in UV space become shell shells
    g.strokeStyle = line; g.lineWidth = 7;
    for (let u = 0; u < 256; u += 32) { g.beginPath(); for (let v = 0; v <= 256; v += 8) g.lineTo(u + Math.sin(v / 40) * 10, v); g.stroke(); }
    for (let v = 40; v < 256; v += 52) { g.beginPath(); g.moveTo(0, v); g.lineTo(256, v); g.stroke(); }
  }));
}
/** Inverted-hull outline for the cartoon look. */
function outline(m: THREE.Mesh, k = 1.06): THREE.Mesh {
  const o = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: 0x2a0f22, side: THREE.BackSide }));
  o.scale.setScalar(k); m.add(o); return o;
}
const CONCHA_TOPS: [string, string][] = [['#ff9ec4', '#e0658f'], ['#ffe07a', '#d9a62e'], ['#8a5236', '#5e321c'], ['#f6efe2', '#cdbb9a']];
export interface Critter { group: THREE.Group; face: THREE.Mesh; setMood(m: Mood): void }
function faceDecal(r: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(r, r), new THREE.MeshBasicMaterial({ map: faceTex('happy'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}
/** Pan dulce concha creature: ~0.66 tall, 0.78 wide, origin at centre. */
export function makeConcha(i: number): Critter {
  const g = new THREE.Group();
  const [top, line] = CONCHA_TOPS[i % CONCHA_TOPS.length];
  const bread = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.33, 0.32, 20), lambert({ color: 0xd99550 }));
  bread.position.y = -0.17; g.add(bread); outline(bread, 1.05);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.39, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), lambert({ map: conchaTex(top, line) }));
  dome.scale.y = 0.85; dome.position.y = -0.02; g.add(dome); outline(dome, 1.05);
  const face = faceDecal(0.42); face.position.set(0, -0.08, 0.36); face.rotation.x = -0.05; g.add(face);
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lambert({ color: 0xa8692f })); foot.scale.set(1.2, 0.6, 1.4); foot.position.set(sx * 0.15, -0.33, 0.12); g.add(foot);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 3, 6), lambert({ color: 0xd99550 })); arm.position.set(sx * 0.4, -0.14, 0.05); arm.rotation.z = sx * 0.9; g.add(arm);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== face) (o as THREE.Mesh).castShadow = true; });
  return { group: g, face, setMood(m) { (face.material as THREE.MeshBasicMaterial).map = faceTex(m); } };
}
/** Cafecito (café de olla clay mug) creature: ~0.62 tall, origin at centre. */
export function makeCafe(i: number): Critter {
  const g = new THREE.Group();
  const pts = [[0, -0.31], [0.22, -0.31], [0.27, -0.24], [0.31, -0.06], [0.3, 0.12], [0.27, 0.24], [0.3, 0.3], [0.27, 0.31]].map(([x, y]) => new THREE.Vector2(x, y));
  const mug = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), lambert({ map: jarritoTex(), side: THREE.DoubleSide }));
  g.add(mug); outline(mug, 1.05);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.265, 20), lambert({ color: 0x3a1a0c })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.27; g.add(coffee);
  const foam = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 18), lambert({ color: 0xc89060 })); foam.rotation.x = Math.PI / 2; foam.position.y = 0.275; g.add(foam);
  const cinn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), lambert({ color: 0x7a3f1a })); cinn.position.set(0.1, 0.36, -0.04); cinn.rotation.z = -0.4; g.add(cinn);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12, Math.PI * 1.25), lambert({ color: 0xb4572a })); handle.position.set(0.31, 0.02, 0); handle.rotation.z = -Math.PI * 0.62; g.add(handle);
  const face = faceDecal(0.4); face.position.set(0, -0.02, 0.315); g.add(face);
  const steam: THREE.Sprite[] = [];
  for (let k = 0; k < 2; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })); s.scale.setScalar(0.25); s.position.set(-0.08 + k * 0.14, 0.45, 0); s.userData.k = k; g.add(s); steam.push(s); }
  g.userData.steam = steam; g.userData.i = i;
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== face) (o as THREE.Mesh).castShadow = true; });
  return { group: g, face, setMood(m) { (face.material as THREE.MeshBasicMaterial).map = faceTex(m); } };
}
/** Hanging papel picado row (a breakable bonus target): returns the group of flags. */
export function makePapelRow(w: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [PAL.pink, PAL.orange, PAL.teal, PAL.purple, PAL.gold, PAL.green];
  const n = Math.max(3, Math.round(w / 0.55));
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, w, 4), new THREE.MeshBasicMaterial({ color: 0x222222 })); rope.rotation.z = Math.PI / 2; g.add(rope);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.64), new THREE.MeshBasicMaterial({ map: papelTex(colors[i % colors.length]), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.geometry.translate(0, -0.32, 0); m.position.x = -w / 2 + (i + 0.5) * (w / n); m.userData.phase = i; g.add(m);
  }
  return g;
}
export const PAPEL_COLORS = [0xe2197a, 0xff8c1a, 0x1ec8c8, 0x8a3cff, 0xffd23f, 0x3cc85a];
