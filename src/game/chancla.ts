import * as THREE from 'three';
import type { ChanclaState, PlayerState, ThrowStyle } from './types';
import { createChancla, createGoldChancla, ROOM } from './scene';

// ─── Collision constants ────────────────────────────────────────────────────────
const PLAYER_HIT_RADIUS  = 0.75;  // world-units — bounding sphere around player
const STRIKE_BACK_RADIUS = 2.8;   // distance within which player can strike back

// ─── Color cycling ─────────────────────────────────────────────────────────────
let nextColorIndex = 0;

// ─── Throw-style parameter table ───────────────────────────────────────────────
// Each style defines a distinct "personality" for how mom throws.
// Values are [min, max] ranges; the engine samples within them on every throw
// to add natural variation (±~15% noise on top of the range itself).
const STYLE_TABLE: Record<ThrowStyle, {
  speedMin: number; speedMax: number;   // how fast t advances (arc travel speed)
  arcMin:   number; arcMax: number;     // peak height of the parabola
  spinMin:  number; spinMax: number;    // radians/sec rotation speed
  startXRange: number;   // mom throws from ±this offset on the X axis
  targetXSpread: number; // aim scatter radius around the player
  minDifficulty: number; // locked until this difficulty level
}> = {
  // ── Quick low-arc — fast, nearly flat trajectory, hard to react to
  quick_low: {
    speedMin: 0.90, speedMax: 1.15,
    arcMin:   0.55, arcMax: 1.30,
    spinMin:  6,    spinMax: 10,
    startXRange: 1.0, targetXSpread: 1.2,
    minDifficulty: 0,
  },

  // ── High looping arc — slow, floaty, hard to time the jump
  high_loop: {
    speedMin: 0.38, speedMax: 0.58,
    arcMin:   3.8,  arcMax: 5.8,
    spinMin:  2,    spinMax: 4,
    startXRange: 2.0, targetXSpread: 2.8,
    minDifficulty: 0,
  },

  // ── Side-angle throw — comes in from the left or right, curves inward
  side_angle: {
    speedMin: 0.72, speedMax: 1.02,
    arcMin:   1.5,  arcMax: 2.8,
    spinMin:  4,    spinMax: 8,
    startXRange: 4.5, targetXSpread: 1.8,  // launched from way off-center
    minDifficulty: 0,
  },

  // ── Rapid-fire — blistering speed, almost no arc (angry throw!)
  // Unlocks at difficulty 2 and becomes more common at higher levels
  rapid_fire: {
    speedMin: 1.45, speedMax: 1.90,
    arcMin:   0.35, arcMax: 0.80,
    spinMin:  9,    spinMax: 16,
    startXRange: 0.4, targetXSpread: 0.55,
    minDifficulty: 2,
  },
};

// ─── Pick a throw style weighted by current difficulty ─────────────────────────
export function pickThrowStyle(difficulty: number): ThrowStyle {
  const available: ThrowStyle[] = [];

  for (const [style, params] of Object.entries(STYLE_TABLE) as [ThrowStyle, typeof STYLE_TABLE[ThrowStyle]][]) {
    if (difficulty >= params.minDifficulty) {
      available.push(style);
      // Add rapid_fire again at higher difficulty to increase its probability
      if (style === 'rapid_fire' && difficulty >= 4) available.push(style);
      if (style === 'rapid_fire' && difficulty >= 7) available.push(style);
    }
  }

  return available[Math.floor(Math.random() * available.length)];
}

// ─── Compute delay before the NEXT throw (called after each launch) ────────────
// Returns seconds to wait. Decreases with difficulty; always slightly random
// so throws feel organic and unpredictable.
export function nextThrowDelay(difficulty: number): number {
  // Base window collapses from 0.4–1.8 s at diff 0 to 0.35–0.65 s at diff 10+
  const minDelay = Math.max(0.35, 1.4  - difficulty * 0.10);
  const maxDelay = Math.max(0.55, 2.2  - difficulty * 0.17);
  // Add a small extra jitter (±10%) for unpredictability
  const base = minDelay + Math.random() * (maxDelay - minDelay);
  return base * (0.9 + Math.random() * 0.2);
}

// ─── How many chanclas to throw at once (volley size) ──────────────────────────
export function pickVolleySize(difficulty: number): number {
  if (difficulty >= 8) return Math.random() < 0.5 ? 3 : 2;
  if (difficulty >= 5) return Math.random() < 0.4 ? 2 : 1;
  if (difficulty >= 3) return Math.random() < 0.2 ? 2 : 1;
  return 1;
}

// ─── Spawn one chancla with a specific throw style ────────────────────────────
export function spawnChancla(
  scene: THREE.Scene,
  player: PlayerState,
  difficulty: number,
  style: ThrowStyle,
  volleyIndex: number = 0
): ChanclaState {
  const colorIndex = nextColorIndex++;

  // 15% chance of gold chancla (increases slightly with difficulty)
  const goldChance = Math.min(0.25, 0.15 + difficulty * 0.01);
  const isGold = Math.random() < goldChance;

  const group = isGold ? createGoldChancla() : createChancla(colorIndex);
  scene.add(group);

  const p = STYLE_TABLE[style];

  // ── Mom throw origin: based on style's X range ────────────────────────────
  // side_angle picks a definite side (±); others are centered with variation
  let startX: number;
  if (style === 'side_angle') {
    // Alternate left/right based on color index for variety
    startX = (colorIndex % 2 === 0 ? 1 : -1) * (p.startXRange * (0.7 + Math.random() * 0.5));
  } else {
    startX = (Math.random() - 0.5) * 2 * p.startXRange;
  }
  const startPos = new THREE.Vector3(startX, 2.5 + Math.random() * 0.4, ROOM.momZ);

  // ── Target: player's current position + style-specific scatter ───────────
  // Clamp so it stays within the play area even with high scatter
  const targetX = THREE.MathUtils.clamp(
    player.x + (Math.random() - 0.5) * p.targetXSpread * 2,
    ROOM.playerMinX - 0.5,
    ROOM.playerMaxX + 0.5
  );
  const targetPos = new THREE.Vector3(
    targetX,
    0,
    ROOM.playerZ + (Math.random() - 0.5) * 0.9
  );

  // ── Speed: sample from style range + ±15% variation ──────────────────────
  const baseSpeed = p.speedMin + Math.random() * (p.speedMax - p.speedMin);
  const speed = baseSpeed * (0.85 + Math.random() * 0.30)  // ±15%
    + difficulty * 0.028;  // small difficulty bonus on top

  // ── Arc height: sample + variation ──────────────────────────────────────
  const arcHeight = p.arcMin + Math.random() * (p.arcMax - p.arcMin);

  // ── Spin axis: each style leans toward a particular axis ─────────────────
  let spinAxis: THREE.Vector3;
  if (style === 'quick_low' || style === 'rapid_fire') {
    // Flat chanclas spin primarily around Z (tumbling forward)
    spinAxis = new THREE.Vector3(0.1 * (Math.random() - 0.5), 0.1 * (Math.random() - 0.5), 1).normalize();
  } else if (style === 'side_angle') {
    // Side throws spin around Y (like a frisbee)
    spinAxis = new THREE.Vector3(0.15 * (Math.random() - 0.5), 1, 0.15 * (Math.random() - 0.5)).normalize();
  } else {
    // High-loop: more chaotic tumbling
    spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, 1).normalize();
  }

  const spinRate = (p.spinMin + Math.random() * (p.spinMax - p.spinMin))
    * (Math.random() > 0.5 ? 1 : -1);

  // ── Stagger subsequent volleys (t starts slightly negative = delayed) ────
  const tStart = volleyIndex * -0.12;

  group.position.copy(startPos);

  return {
    group,
    startPos,
    targetPos,
    t: tStart,
    speed,
    arcHeight,
    spinAxis,
    spinRate,
    struckBack: false,
    expired: false,
    colorIndex,
    isGold,
  };
}

// ─── Update all chanclas each frame ────────────────────────────────────────────
export function updateChanclas(chanclas: ChanclaState[], dt: number): void {
  for (const ch of chanclas) {
    if (ch.expired) continue;

    // Advance parametric time (negative t = "waiting to launch")
    ch.t += dt * ch.speed;

    if (ch.t > 1.0) {
      ch.t = 1.0;
      ch.expired = true;
      ch.group.visible = false;
      continue;
    }

    // Don't render until t >= 0 (staggered volley delay)
    if (ch.t < 0) {
      ch.group.visible = false;
      continue;
    }

    ch.group.visible = true;

    // ── Parabolic arc position ─────────────────────────────────────────────
    // When struck back, reverse direction toward mom.
    const start = ch.struckBack ? ch.targetPos : ch.startPos;
    const end   = ch.struckBack
      ? new THREE.Vector3(ch.startPos.x * 0.3, 2.5, ROOM.momZ)
      : ch.targetPos;

    const tClamped = Math.max(0, ch.t);
    const px = THREE.MathUtils.lerp(start.x, end.x, tClamped);
    const pz = THREE.MathUtils.lerp(start.z, end.z, tClamped);
    // Parabolic height: sin(t*π) peaks at t=0.5, giving a natural arc
    const arcBump = Math.sin(tClamped * Math.PI) * ch.arcHeight;
    const py = THREE.MathUtils.lerp(start.y, end.y, tClamped) + arcBump;

    ch.group.position.set(px, Math.max(0.1, py), pz);

    // ── Spin — rate can be varied by arc phase for realism ────────────────
    // Slightly faster spin at arc peak (angular momentum conservation feel)
    const peakBoost = 1.0 + Math.sin(tClamped * Math.PI) * 0.25;
    ch.group.rotateOnAxis(ch.spinAxis, ch.spinRate * peakBoost * dt);
  }
}

// ─── Collision: chancla hits player ───────────────────────────────────────────
export function checkChanclaHitsPlayer(chancla: ChanclaState, player: PlayerState): boolean {
  if (chancla.expired || chancla.struckBack || chancla.t < 0) return false;

  const playerHeight = player.isDucking ? 0.42 : 0.80;
  const playerCenter = new THREE.Vector3(player.x, player.y + playerHeight, ROOM.playerZ);
  const dist = chancla.group.position.distanceTo(playerCenter);
  const hitRadius = player.isDucking ? PLAYER_HIT_RADIUS * 0.52 : PLAYER_HIT_RADIUS;

  return dist < hitRadius;
}

// ─── Find closest strikeable chancla ──────────────────────────────────────────
export function findStrikeTarget(chanclas: ChanclaState[], player: PlayerState): ChanclaState | null {
  const playerCenter = new THREE.Vector3(player.x, player.y + 0.8, ROOM.playerZ);
  let closest: ChanclaState | null = null;
  let closestDist = STRIKE_BACK_RADIUS;

  for (const ch of chanclas) {
    if (ch.expired || ch.struckBack || ch.t < 0) continue;
    const dist = ch.group.position.distanceTo(playerCenter);
    if (dist < closestDist) { closestDist = dist; closest = ch; }
  }

  return closest;
}

// ─── Strike back: reverse the chancla toward mom ─────────────────────────────
export function strikeBackChancla(chancla: ChanclaState): void {
  chancla.targetPos.copy(chancla.group.position);  // start return from current position
  chancla.t = 0;
  // Return throw is significantly faster — fury throw!
  chancla.speed     = Math.min(2.2, chancla.speed * 2.0);
  chancla.arcHeight = 1.2 + Math.random() * 1.0;
  chancla.spinRate  *= 3.0;  // spin goes wild!
  chancla.struckBack = true;
}

// ─── Check if struck-back chancla reached mom ────────────────────────────────
export function checkChanclaHitsMom(chancla: ChanclaState): boolean {
  if (!chancla.struckBack || chancla.expired) return false;
  const momPos = new THREE.Vector3(0, 1.5, ROOM.momZ);
  return chancla.group.position.distanceTo(momPos) < 2.2 && chancla.t > 0.65;
}

// ─── Remove expired chanclas from scene + array ───────────────────────────────
export function pruneExpiredChanclas(chanclas: ChanclaState[], scene: THREE.Scene): ChanclaState[] {
  const alive: ChanclaState[] = [];
  for (const ch of chanclas) {
    if (ch.expired) {
      scene.remove(ch.group);
      ch.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    } else {
      alive.push(ch);
    }
  }
  return alive;
}
