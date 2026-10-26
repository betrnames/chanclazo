/**
 * Shared "stable world" physics setup for every Chanclazo game (Matter.js 0.20).
 *
 * What it guarantees:
 *  - Higher-accuracy solver (more position/velocity iterations).
 *  - Sleeping enabled, so settled stacks stay perfectly still.
 *  - Pieces spawned resting exactly on their support, high friction, low bounce, at rest and asleep.
 *  - A fixed 60 Hz physics clock (accumulator), independent of the screen's refresh rate.
 *  - An "armed" gate: no collision damage and no un-pinning (setStatic(false)) until the first launch.
 */
import Matter from 'matter-js';

export const STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 5;

export const RESTING_MATERIAL = { friction: 0.9, frictionStatic: 1.5, restitution: 0.1, frictionAir: 0.004 } as const;

export function createStableEngine(options: Matter.IEngineDefinition = {}): Matter.Engine {
  return Matter.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8, ...options });
}

/** Apply the resting material without moving the body (friction ≥ given, restitution ≤ 0.1). */
export function applyRestingMaterial(body: Matter.Body): void {
  body.friction = Math.max(body.friction, RESTING_MATERIAL.friction);
  body.frictionStatic = Math.max(body.frictionStatic, RESTING_MATERIAL.frictionStatic);
  body.restitution = Math.min(body.restitution, RESTING_MATERIAL.restitution);
  body.frictionAir = RESTING_MATERIAL.frictionAir;
}

/**
 * Place `body` so it rests exactly on top of `support` (a body, or a ground y in world units),
 * keep its x, zero its motion, give it the resting material and put it to sleep.
 * With no support it is left where it is (already exactly placed) and just put to rest.
 */
export function spawnResting(body: Matter.Body, support?: Matter.Body | number): Matter.Body {
  if (support !== undefined) {
    const top = typeof support === 'number' ? support : support.bounds.min.y;
    const bottom = body.bounds.max.y - body.position.y; // centre to bottom edge
    Matter.Body.setPosition(body, { x: body.position.x, y: top - bottom });
  }
  applyRestingMaterial(body);
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(body, 0);
  if (!body.isStatic) Matter.Sleeping.set(body, true);
  return body;
}

/** Fixed-timestep stepper. Call stepFixed(engine, frameMs) once per animation frame. */
export function createFixedStepper(maxSteps = MAX_STEPS_PER_FRAME) {
  let acc = 0;
  return {
    /** Advances the engine by whole 1000/60 ms steps; returns how many steps ran. */
    step(engine: Matter.Engine, frameMs: number, timeScale = 1): number {
      acc += Math.max(0, Math.min(frameMs, STEP_MS * maxSteps)) * timeScale;
      let n = 0;
      while (acc >= STEP_MS && n < maxSteps) { Matter.Engine.update(engine, STEP_MS); acc -= STEP_MS; n++; }
      if (n >= maxSteps) acc = 0; // drop backlog rather than spiral
      return n;
    },
    reset() { acc = 0; },
  };
}
const defaultStepper = createFixedStepper();
export function stepFixed(engine: Matter.Engine, frameMs: number, timeScale = 1): number {
  return defaultStepper.step(engine, frameMs, timeScale);
}

/** Gate for damage and un-pinning until the player's first launch. */
export function createArmGate() {
  let armed = false;
  return {
    get armed() { return armed; },
    arm() { armed = true; },
    disarm() { armed = false; },
    /** setStatic(false) only once armed. Returns whether it unpinned. */
    unpin(body: Matter.Body): boolean {
      if (!armed || !body.isStatic) return false;
      Matter.Body.setStatic(body, false);
      return true;
    },
  };
}
export type ArmGate = ReturnType<typeof createArmGate>;
