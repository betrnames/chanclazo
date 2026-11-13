// Lightweight three.js hit effects shared by Chancla Crash and Chancla Waves (no extra libraries):
// gold shockwave rings, additive spark bursts (one pooled Points object), soft relic glow sprites, and a tiny hit-stop clock.
import * as THREE from 'three';

function radialTex(inner: string, outer: string, size = 64): THREE.Texture {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d')!, r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)')); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = radialTex('rgba(255,236,160,1)', 'rgba(255,170,40,0)');
const sparkTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 32);

interface Ring { m: THREE.Mesh; life: number; max: number; size: number }
const MAXP = 320;

export class FX {
  readonly group = new THREE.Group();
  private rings: Ring[] = [];
  private ringGeo = new THREE.RingGeometry(0.78, 1, 40);
  private pos = new Float32Array(MAXP * 3);
  private col = new Float32Array(MAXP * 3);
  private vel = new Float32Array(MAXP * 3);
  private life = new Float32Array(MAXP);
  private max = new Float32Array(MAXP);
  private base = new Float32Array(MAXP * 3);
  private next = 0;
  private pts: THREE.Points;
  private floorY: number;
  constructor(scene: THREE.Object3D, floorY = 0) {
    this.floorY = floorY;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < MAXP; i++) this.pos[i * 3 + 1] = -999;
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: sparkTex, size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 5;
    this.group.add(this.pts); scene.add(this.group);
  }
  /** Expanding gold shockwave ring that faces the camera. */
  ring(at: THREE.Vector3, size = 1.2, color = 0xffd36b): void {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.position.copy(at); m.scale.setScalar(0.05); m.renderOrder = 6; this.group.add(m);
    this.rings.push({ m, life: 0, max: 0.38, size });
    if (this.rings.length > 12) this.kill(this.rings.shift()!);
  }
  /** Burst of additive sparks (gold by default); they fade out mid-air and never settle on the floor. */
  sparks(at: THREE.Vector3, n = 18, color = 0xffd36b, speed = 4.5, up = 2.5): void {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % MAXP;
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.5, sp = speed * (0.35 + Math.random() * 0.65);
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up * Math.random(), Math.sin(a) * Math.cos(e) * sp], i * 3);
      const w = 0.75 + Math.random() * 0.25; this.base.set([c.r * w, c.g * w, c.b * w], i * 3);
      this.life[i] = 0; this.max[i] = 0.35 + Math.random() * 0.4;
    }
  }
  /** A few slow sparkles left behind a flying chancla. */
  trail(at: THREE.Vector3): void { this.sparks(at, 1, 0xffe39a, 0.4, 0.3); }
  /** Soft additive glow halo, attached to an object (e.g. the gold chancla). */
  static glow(obj: THREE.Object3D, scale = 1.4, opacity = 0.7): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.scale.setScalar(scale); s.renderOrder = 4; obj.add(s); return s;
  }
  update(dt: number, camera: THREE.Camera): void {
    for (const r of this.rings) {
      r.life += dt; const k = Math.min(1, r.life / r.max), e = 1 - (1 - k) * (1 - k);
      r.m.scale.setScalar(0.05 + e * r.size); (r.m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      r.m.quaternion.copy(camera.quaternion);
    }
    this.rings = this.rings.filter((r) => { if (r.life < r.max) return true; this.kill(r); return false; });
    for (let i = 0; i < MAXP; i++) {
      if (this.life[i] >= this.max[i]) { if (this.pos[i * 3 + 1] > -900) { this.pos[i * 3 + 1] = -999; this.col.fill(0, i * 3, i * 3 + 3); } continue; }
      this.life[i] += dt; const j = i * 3;
      this.vel[j + 1] -= 9 * dt; this.vel[j] *= 0.97; this.vel[j + 2] *= 0.97;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const f = Math.max(0, 1 - this.life[i] / this.max[i]) * (this.pos[j + 1] < this.floorY + 0.25 ? 0 : 1); // gone before the floor
      if (f === 0) this.life[i] = this.max[i];
      this.col[j] = this.base[j] * f; this.col[j + 1] = this.base[j + 1] * f; this.col[j + 2] = this.base[j + 2] * f;
    }
    const g = this.pts.geometry;
    // skip the 320-point buffer upload when nothing is moving (still true after a burst ends: last frame already hid them)
    if (this.rings.length || this.life.some((l, i) => l < this.max[i])) {
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    }
  }
  clear(): void { for (const r of this.rings) this.kill(r); this.rings = []; this.life.fill(0); this.max.fill(0); for (let i = 0; i < MAXP; i++) this.pos[i * 3 + 1] = -999; this.col.fill(0); }
  private kill(r: Ring): void { this.group.remove(r.m); (r.m.material as THREE.Material).dispose(); }
}

/** Hit-stop: freeze the simulation for a few frames on big hits (call stop(ms), multiply sim dt by scale(now)). */
export class HitStop {
  private until = 0;
  stop(ms: number): void { this.until = Math.max(this.until, performance.now() + ms); }
  scale(now = performance.now()): number { return now < this.until ? 0.06 : 1; }
}
