import * as THREE from 'three';
import type { ParticleState } from './types';

// ─── Burst of colorful particles at a world position ──────────────────────────
// Used for strike-back impact, hit flash, and chancla bounce effects

export function spawnBurst(
  scene: THREE.Scene,
  position: THREE.Vector3,
  count: number,
  colors: number[],
  speed: number = 4.0,
  lifetime: number = 0.7
): ParticleState[] {
  const particles: ParticleState[] = [];

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshLambertMaterial({ color });
    // Mix of sizes for visual interest
    const size = 0.06 + Math.random() * 0.12;
    const geo = Math.random() > 0.4
      ? new THREE.SphereGeometry(size, 4, 3)
      : new THREE.BoxGeometry(size, size, size);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    scene.add(mesh);

    // Random outward velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 0.5,   // bias upward
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.8));

    particles.push({
      mesh,
      velocity,
      life: lifetime * (0.6 + Math.random() * 0.8),
      maxLife: lifetime,
    });
  }

  return particles;
}

// ─── Star burst (for combos / big moments) ────────────────────────────────────
export function spawnStars(scene: THREE.Scene, position: THREE.Vector3): ParticleState[] {
  const starColors = [0xFFD700, 0xFF6B6B, 0x4FC3F7, 0x81C784, 0xFFAB40];
  return spawnBurst(scene, position, 16, starColors, 5.5, 0.9);
}

// ─── Strike-back impact burst ─────────────────────────────────────────────────
export function spawnStrikeImpact(scene: THREE.Scene, position: THREE.Vector3): ParticleState[] {
  const impactColors = [0xFF6B6B, 0xFFD93D, 0xFF922B, 0xFFFFFF];
  return spawnBurst(scene, position, 22, impactColors, 6.0, 0.8);
}

// ─── Mom hit effect (when struck-back chancla reaches her) ────────────────────
export function spawnMomHit(scene: THREE.Scene, position: THREE.Vector3): ParticleState[] {
  const momColors = [0xFF80AB, 0xFFCC02, 0xFF6B6B, 0xC2185B];
  return spawnBurst(scene, position, 30, momColors, 5.0, 1.0);
}

// ─── Update all particles each frame ─────────────────────────────────────────
const GRAVITY = new THREE.Vector3(0, -9.8, 0);

export function updateParticles(
  particles: ParticleState[],
  scene: THREE.Scene,
  dt: number
): ParticleState[] {
  const alive: ParticleState[] = [];

  for (const p of particles) {
    p.life -= dt;

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach(m => m.dispose());
      } else {
        (p.mesh.material as THREE.Material).dispose();
      }
      continue;
    }

    // Apply gravity to velocity
    p.velocity.addScaledVector(GRAVITY, dt * 0.6);
    p.mesh.position.addScaledVector(p.velocity, dt);

    // Bounce off floor with some energy loss
    if (p.mesh.position.y < 0.05) {
      p.mesh.position.y = 0.05;
      p.velocity.y *= -0.45;
      p.velocity.x *= 0.85;
      p.velocity.z *= 0.85;
    }

    // Fade out as life depletes
    const lifeRatio = p.life / p.maxLife;
    p.mesh.scale.setScalar(lifeRatio * 1.2);
    (p.mesh.material as THREE.MeshLambertMaterial).opacity = lifeRatio;

    alive.push(p);
  }

  return alive;
}
