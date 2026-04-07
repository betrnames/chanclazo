import type { InputState } from './types';

// ─── Touch State (shared between controls and React touch HUD) ─────────────────
export interface TouchInputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  strikeQueued: boolean;
}

export function createTouchState(): TouchInputState {
  return { left: false, right: false, jump: false, duck: false, strikeQueued: false };
}

// ─── Controls Manager ──────────────────────────────────────────────────────────
// Tracks keyboard state and exposes a clean InputState snapshot each frame.
// Also handles the edge-triggered "strikePressed" signal so it fires exactly
// once per key-down / click, not every frame.
// Accepts an optional external touchState ref so the React touch HUD can inject
// mobile inputs without going through the engine.

export function createControls(touchState?: TouchInputState): {
  getInput: () => InputState;
  destroy: () => void;
} {
  const keys: Record<string, boolean> = {};
  let strikeQueued = false;

  // ─── Key Down ─────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    keys[e.code] = true;

    if (e.code === 'Space') {
      e.preventDefault();
      strikeQueued = true;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function onClick() {
    strikeQueued = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('click', onClick);

  // ─── Read Input (called once per frame) ───────────────────────────────────
  function getInput(): InputState {
    const touchLeft   = touchState?.left   ?? false;
    const touchRight  = touchState?.right  ?? false;
    const touchJump   = touchState?.jump   ?? false;
    const touchDuck   = touchState?.duck   ?? false;
    const touchStrike = touchState?.strikeQueued ?? false;

    if (touchState) touchState.strikeQueued = false;

    const input: InputState = {
      left:          keys['ArrowLeft']  || keys['KeyA'] || touchLeft,
      right:         keys['ArrowRight'] || keys['KeyD'] || touchRight,
      jump:          keys['ArrowUp']    || keys['KeyW'] || touchJump,
      duck:          keys['ArrowDown']  || keys['KeyS'] || touchDuck,
      strikePressed: strikeQueued || touchStrike,
    };
    strikeQueued = false;
    return input;
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('click', onClick);
  }

  return { getInput, destroy };
}
