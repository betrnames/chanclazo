import * as THREE from 'three';

// ─── Game Phase ────────────────────────────────────────────────────────────────
export type GamePhase = 'start' | 'playing' | 'level_complete' | 'victory' | 'gameover';

// ─── Level Config ──────────────────────────────────────────────────────────────
export interface LevelConfig {
  level: number;           // 1-5
  surviveSecs: number;     // seconds to survive
  minScore: number;        // minimum score to clear
  baseDifficulty: number;  // starting difficulty offset for chancla system
}

export const LEVELS: LevelConfig[] = [
  { level: 1, surviveSecs: 45,  minScore: 1000,  baseDifficulty: 0 },
  { level: 2, surviveSecs: 55,  minScore: 2500,  baseDifficulty: 2 },
  { level: 3, surviveSecs: 65,  minScore: 5000,  baseDifficulty: 4 },
  { level: 4, surviveSecs: 75,  minScore: 9000,  baseDifficulty: 6 },
  { level: 5, surviveSecs: 90,  minScore: 15000, baseDifficulty: 8 },
];

// ─── Chancla State ─────────────────────────────────────────────────────────────
export interface ChanclaState {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  t: number;
  speed: number;
  arcHeight: number;
  spinAxis: THREE.Vector3;
  spinRate: number;
  struckBack: boolean;
  expired: boolean;
  colorIndex: number;
}

// ─── Particle ──────────────────────────────────────────────────────────────────
export interface ParticleState {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

// ─── Player State ──────────────────────────────────────────────────────────────
export interface PlayerState {
  group: THREE.Group;
  x: number;
  y: number;
  vy: number;
  isDucking: boolean;
  hitFlashTimer: number;
  invincibleTimer: number;
  /** Shield (brief full invincibility from lucky strike-back) */
  shieldTimer: number;
}

// ─── Mom State ─────────────────────────────────────────────────────────────────
export interface MomState {
  group: THREE.Group;
  shakeTimer: number;
  nextThrowTime: number;
}

// ─── Input Snapshot ────────────────────────────────────────────────────────────
export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  strikePressed: boolean;
}

// ─── Character ────────────────────────────────────────────────────────────────
export type CharacterGender = 'boy' | 'girl';

// ─── Pan State ────────────────────────────────────────────────────────────────
export interface PanState {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  t: number;
  speed: number;
  spinRate: number;
  expired: boolean;
}

// ─── Mouse State ──────────────────────────────────────────────────────────────
export interface MouseState {
  group: THREE.Group;
  x: number;
  direction: number;
}

// ─── Cat State ────────────────────────────────────────────────────────────────
export interface CatState {
  group: THREE.Group;
  x: number;
  direction: number; // 1 = right, -1 = left
  speed: number;
  hitFlashTimer: number;
}

// ─── Language ──────────────────────────────────────────────────────────────────
export type Lang = 'en' | 'es';

// ─── Throw Styles ──────────────────────────────────────────────────────────────
export type ThrowStyle = 'quick_low' | 'high_loop' | 'side_angle' | 'rapid_fire';

// ─── Callbacks from engine → React ─────────────────────────────────────────────
export interface GameCallbacks {
  onScoreUpdate: (score: number, combo: number, survivalSeconds: number, health: number, shielded: boolean) => void;
  onPopup: (text: string) => void;
  onGameOver: (finalScore: number, totalSurvival: number) => void;
  onLevelComplete: (level: number, score: number, timeBonus: number) => void;
  onVictory: (finalScore: number, totalSurvival: number) => void;
  getLang: () => Lang;
  onStrikeAvailable?: (available: boolean) => void;
}

// ─── Game Engine Instance ─────────────────────────────────────────────────────
export interface GameInstance {
  start: () => void;
  destroy: () => void;
  triggerStrike: () => void;
}
