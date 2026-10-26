// Chanclazo's original hand-drawn sprites rendered as lit, camera-facing billboards
// (Paper Mario / Don't Starve style): ink outline + warm rim glow, blob shadow,
// squash-and-stretch, flip-frame sheets, hit flash. Same API the game used for 3D chars.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
function tex(url: string) {
  let t = texCache.get(url);
  if (!t) { t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(url, t); }
  return t;
}

const ramp = (() => { const d = new Uint8Array([70, 150, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toonCache = new Map<number, THREE.MeshToonMaterial>();
export function toon(color: number) {
  let m = toonCache.get(color); if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: ramp }); toonCache.set(color, m); } return m;
}

export type CharKind = 'abuela' | 'luchador' | 'calaca' | 'kid' | 'pinata';
interface Look { url: string; h: number; aspect: number; cols?: number; rows?: number; bob: number; glow: number }
const LOOK: Record<CharKind, Look> = {
  abuela:   { url: '/cruise/abuela_sprite.webp',   h: 3.3, aspect: 387 / 512, bob: 1.6, glow: 0xff8a3c },
  luchador: { url: '/cruise/luchador_sprite.webp', h: 2.3, aspect: 306 / 384, bob: 2.4, glow: 0xffc65c },
  calaca:   { url: '/cruise/calaca_sprite.webp',   h: 2.4, aspect: 225 / 472, bob: 3.0, glow: 0x9be7ff },
  pinata:   { url: '/cruise/pinata_sprite.webp',   h: 2.1, aspect: 221 / 320, bob: 1.2, glow: 0xff5fb0 },
  kid:      { url: '/cruise/kid_throw.webp',       h: 1.9, aspect: 200 / 182, cols: 5, rows: 5, bob: 2.0, glow: 0xffe1a8 },
};

const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,0.75)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

let cam: THREE.Camera | null = null;
export function setSpriteCamera(c: THREE.Camera) { cam = c; }
export function loadChars() {
  return Promise.all(Object.values(LOOK).map((l) => new Promise<void>((res, rej) => {
    const t = tex(l.url); if ((t.image as any)?.complete) return res();
    loader.load(l.url, (img) => { t.image = img.image; t.needsUpdate = true; res(); }, undefined, rej);
  }))).then(() => {});
}

export interface Char {
  root: THREE.Group; kind: CharKind;
  play(name: string, o?: { once?: boolean; fade?: number; speed?: number }): void;
  update(dt: number): void; setFlash(c: number): void; dispose(): void;
}

const tmp = new THREE.Vector3();
export function makeChar(kind: CharKind): Char {
  const L = LOOK[kind]; const w = L.h * L.aspect;
  let map = tex(L.url);
  if (L.cols) { map = map.clone(); map.repeat.set(1 / L.cols, 1 / L.rows!); map.needsUpdate = true; }
  const geo = new THREE.PlaneGeometry(w, L.h);
  const mat = new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, emissive: 0x2a1c22, side: THREE.DoubleSide });
  const ink = new THREE.MeshBasicMaterial({ map, alphaTest: 0.3, color: 0x0b0508, side: THREE.DoubleSide, fog: true });
  const glow = new THREE.MeshBasicMaterial({ map, alphaTest: 0.08, color: L.glow, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const root = new THREE.Group();
  const pivot = new THREE.Group(); root.add(pivot);          // feet pivot, billboarded
  const body = new THREE.Mesh(geo, mat); body.position.y = L.h / 2; pivot.add(body);
  const inkM = new THREE.Mesh(geo, ink); inkM.scale.setScalar(1.045); inkM.position.z = -0.025; body.add(inkM);
  const glowM = new THREE.Mesh(geo, glow); glowM.scale.setScalar(1.11); glowM.position.z = -0.05; body.add(glowM);
  const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.scale.set(w * 1.1, 1, w * 0.55); sh.position.y = 0.04; root.add(sh);
  if (kind === 'pinata') sh.visible = false;

  let state = 'idle', st = 0, speed = 1, phase = Math.random() * 6, life = 0, frame = -1;
  const setFrame = (i: number) => { if (!L.cols || i === frame) return; frame = i; const c = i % L.cols, r = Math.floor(i / L.cols); map.offset.set(c / L.cols, 1 - (r + 1) / L.rows!); };
  setFrame(0);
  const ch: Char = {
    root, kind,
    play(name, o = {}) {
      speed = o.speed ?? 1; st = 0;
      if (/Shoot|Punch/.test(name) && o.once) state = 'throw';
      else if (/Hit/.test(name)) state = 'hit';
      else if (/Death/.test(name)) state = 'die';
      else if (/Walk/.test(name)) state = 'walk';
      else state = 'idle';
    },
    update(dt) {
      life += dt; st += dt * speed; const t = life + phase;
      let sy = 1, sx = 1, rz = 0, y = 0, op = 1;
      if (state === 'idle' || state === 'walk') {
        const k = Math.sin(t * L.bob * (state === 'walk' ? 2 : 1));
        sy = 1 + k * 0.045; sx = 1 - k * 0.035; y = Math.max(0, k) * (state === 'walk' ? 0.12 : 0.04);
        rz = state === 'walk' ? Math.sin(t * L.bob) * 0.08 : 0;
        if (kind === 'pinata') { rz = Math.sin(t * 1.7) * 0.18; y = 0; }
        setFrame(0);
      } else if (state === 'throw') {
        const p = Math.min(1, st / 0.45);
        if (L.cols) setFrame(Math.min(L.cols * L.rows! - 1, Math.floor(p * L.cols * L.rows!)));
        const k = Math.sin(p * Math.PI); sy = 1 - k * 0.12; sx = 1 + k * 0.1; rz = -k * 0.12;
        if (p >= 1) state = 'idle';
      } else if (state === 'hit') {
        const p = Math.min(1, st / 0.5); const k = Math.sin(p * Math.PI * 4) * (1 - p);
        rz = k * 0.35; sy = 1 - Math.abs(k) * 0.15; sx = 1 + Math.abs(k) * 0.15;
        if (p >= 1) state = 'idle';
      } else if (state === 'die') {
        const p = Math.min(1, st / 0.9); rz = p * 1.5; sy = 1 - p * 0.4; sx = 1 + p * 0.2; y = Math.sin(p * Math.PI) * 0.6; op = 1 - p;
        sh.scale.multiplyScalar(0.98);
      }
      pivot.position.y = y; body.scale.set(sx, sy, 1); body.position.y = (L.h / 2) * sy; body.rotation.z = rz;
      if (op < 1) { mat.transparent = ink.transparent = true; mat.opacity = ink.opacity = op; glow.opacity = 0.32 * op; }
      if (cam) { root.updateWorldMatrix(true, false); pivot.getWorldPosition(tmp); pivot.lookAt(cam.position.x, tmp.y, cam.position.z); }
    },
    setFlash(c) { mat.emissive.setHex(c || 0x2a1c22); glow.color.setHex(c ? 0xff3030 : L.glow); },
    dispose() { root.removeFromParent(); geo.dispose(); mat.dispose(); ink.dispose(); glow.dispose(); if (L.cols) map.dispose(); },
  };
  return ch;
}
