import * as THREE from 'three';
import { fetchGhosts } from '../api';
import type { GhostRun, GhostSnapshot } from '../api';
import { ROOM } from './scene';

// ─── Ghost Player Visual ───────────────────────────────────────────────────────
// Semi-transparent silhouette of another player running the same level

export interface GhostPlayer {
  run: GhostRun;
  group: THREE.Group;
  elapsed: number;       // how far into this ghost's timeline we are
  done: boolean;
  label: THREE.Sprite;   // floating handle label above ghost
}

// Build a simple low-poly ghost silhouette (matches player art style, but translucent)
function buildGhostMesh(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), mat);
  body.position.y = 1.05;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.35), mat);
  head.position.y = 1.67;
  group.add(head);

  // Left leg
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.25), mat);
  leftLeg.position.set(-0.14, 0.51, 0);
  leftLeg.name = 'leftLeg';
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.25), mat);
  rightLeg.position.set(0.14, 0.51, 0);
  rightLeg.name = 'rightLeg';
  group.add(rightLeg);

  return group;
}

// Build a floating text sprite for the ghost's handle
function buildLabel(handle: string, color: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Coloured text with soft shadow
  const hex = '#' + color.toString(16).padStart(6, '0');
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = hex;
  ctx.fillText(`👻 ${handle}`, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.75 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

// Palette — up to 5 ghosts get distinct colours
const GHOST_COLORS = [0x88CCFF, 0xFF88CC, 0x88FFCC, 0xFFDD88, 0xDD88FF];

// ─── Load Ghosts ──────────────────────────────────────────────────────────────
// Call once at level start. Returns GhostPlayer array (may be empty).
export async function loadGhosts(scene: THREE.Scene, level: number): Promise<GhostPlayer[]> {
  const runs = await fetchGhosts(level);
  if (!runs.length) return [];

  return runs.slice(0, 5).map((run, i) => {
    const color = GHOST_COLORS[i % GHOST_COLORS.length];
    const group = buildGhostMesh(color);
    group.position.set(0, 0, ROOM.playerZ);
    scene.add(group);

    const label = buildLabel(run.handle, color);
    label.position.set(0, 2.3, 0);
    group.add(label);

    return { run, group, elapsed: 0, done: false, label };
  });
}

// ─── Interpolate Snapshot ─────────────────────────────────────────────────────
// Given an elapsed time, find the two nearest snapshots and lerp between them
function interpolateSnapshot(snaps: GhostSnapshot[], elapsed: number): GhostSnapshot | null {
  if (!snaps.length) return null;
  if (elapsed <= snaps[0].t) return snaps[0];
  if (elapsed >= snaps[snaps.length - 1].t) return null; // run is over

  for (let i = 0; i < snaps.length - 1; i++) {
    const a = snaps[i];
    const b = snaps[i + 1];
    if (elapsed >= a.t && elapsed <= b.t) {
      const alpha = (elapsed - a.t) / (b.t - a.t);
      return {
        t: elapsed,
        x: a.x + (b.x - a.x) * alpha,
        y: a.y + (b.y - a.y) * alpha,
        d: alpha < 0.5 ? a.d : b.d,
      };
    }
  }
  return null;
}

// ─── Update Ghosts ────────────────────────────────────────────────────────────
// Call every tick inside engine.ts, passing dt and totalSurvival elapsed time
export function updateGhosts(ghosts: GhostPlayer[], _dt: number, totalSurvival: number): void {
  for (const ghost of ghosts) {
    if (ghost.done) continue;

    ghost.elapsed = totalSurvival;
    const snap = interpolateSnapshot(ghost.run.snapshots, ghost.elapsed);

    if (!snap) {
      // Ghost run finished — fade out and hide
      ghost.done = true;
      ghost.group.visible = false;
      return;
    }

    // Position
    ghost.group.position.x = snap.x;
    ghost.group.position.y = snap.y;
    ghost.group.position.z = ROOM.playerZ;

    // Duck squish (matches player logic)
    const targetScaleY = snap.d ? 0.55 : 1.0;
    ghost.group.scale.y = THREE.MathUtils.lerp(ghost.group.scale.y, targetScaleY, 0.3);

    // Walk-cycle leg swing (simple sine based on x movement)
    const legSwing = Math.sin(totalSurvival * 10) * 0.3;
    const ll = ghost.group.getObjectByName('leftLeg') as THREE.Mesh | null;
    const rl = ghost.group.getObjectByName('rightLeg') as THREE.Mesh | null;
    if (ll) ll.rotation.x = legSwing;
    if (rl) rl.rotation.x = -legSwing;
  }
}

// ─── Destroy Ghosts ───────────────────────────────────────────────────────────
export function destroyGhosts(ghosts: GhostPlayer[], scene: THREE.Scene): void {
  for (const ghost of ghosts) {
    scene.remove(ghost.group);
  }
  ghosts.length = 0;
}
