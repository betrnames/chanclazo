// Boot intro: Abuela steps in from the side of the live game scene, delivers a
// short chancla line, and steps back out. No gold-chancla fly-in, no burst, no
// "CHANCLAZO!" overlay, no camera intro, no loading screen, no voice, no SFX.
// Only the game's music plays. The game is already running underneath. A tap
// skips. The between-waves Abuela cameo in Día de los Muertos is unchanged.

export type IntroGame = 'waves' | 'strike' | 'slots';

/** Existing hand-drawn smiling chibi (holding her gold chancla), recompressed. */
const ABUELA_SRC = '/play/abuela-intro.webp';

export const INTRO_LINES: readonly string[] = [
  'Mijo, this chancla has your name on it.',
  'Órale — show me what you\'ve got.',
  '¡Ándale! The chancla doesn\'t throw itself.',
  'Ay, I brought the good one.',
  'One chancla is all I need, mijo.',
];

const IN_MS = 420;
const HOLD_MS = 1000;
const OUT_MS = 380;
const TOTAL_MS = IN_MS + HOLD_MS + OUT_MS; // 1800
const REDUCE_MS = 1200;

let forceIntro = false;
let runningCleanup: (() => void) | null = null;
let lineBag: number[] = [];
let lastLine = -1;
let currentLine = 0;

function reduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function shouldPlayIntro(): boolean {
  if (forceIntro) return true;
  // Playtests and screenshot hooks use ?start=1; ?nointro=1 is an explicit opt-out.
  if (/[?&](start=1|nointro=1)(?:&|$)/.test(location.search)) return false;
  return true;
}

/** Kept so older hooks don't break. The intro is always short and never delays start. */
export function isShortIntro(): boolean { return true; }

function nextLineIndex(): number {
  if (!lineBag.length) {
    lineBag = INTRO_LINES.map((_, i) => i);
    for (let i = lineBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lineBag[i], lineBag[j]] = [lineBag[j], lineBag[i]];
    }
    if (lineBag.length > 1 && lineBag[lineBag.length - 1] === lastLine) {
      lineBag.unshift(lineBag.pop() as number);
    }
  }
  const i = lineBag.pop() as number;
  lastLine = i;
  currentLine = i;
  return i;
}

function easeOutWalk(t: number): number { return 1 - (1 - t) ** 1.55; }
function easeInCubic(t: number): number { return t * t * t; }

/** x is percent-of-self to the left (0 on stage, -110 off). y is a step bob in px (up is negative). */
function poseAt(ms: number, reduce: boolean): { x: number; y: number; bubble: number; opacity: number; done: boolean } {
  const total = reduce ? REDUCE_MS : TOTAL_MS;
  if (ms >= total) return { x: reduce ? 0 : -110, y: 0, bubble: 0, opacity: 0, done: true };
  if (reduce) {
    const fade = 220;
    if (ms < fade) {
      const t = ms / fade;
      return { x: 0, y: 0, bubble: t, opacity: t, done: false };
    }
    if (ms < REDUCE_MS - fade) return { x: 0, y: 0, bubble: 1, opacity: 1, done: false };
    const t = (ms - (REDUCE_MS - fade)) / fade;
    return { x: 0, y: 0, bubble: 1 - t, opacity: 1 - t, done: false };
  }
  if (ms <= IN_MS) {
    const u = easeOutWalk(ms / IN_MS);
    const x = -110 + 110 * u;
    // Two footfalls while she walks in.
    const bob = Math.sin(u * Math.PI * 2) * 10 * (1 - u * 0.35);
    const bubble = Math.max(0, Math.min(1, (ms - 260) / 200));
    return { x, y: -bob, bubble, opacity: 1, done: false };
  }
  if (ms <= IN_MS + HOLD_MS) return { x: 0, y: 0, bubble: 1, opacity: 1, done: false };
  const u = easeInCubic((ms - IN_MS - HOLD_MS) / OUT_MS);
  const x = -110 * u;
  const bob = Math.sin(u * Math.PI * 2) * 8 * (1 - u);
  return { x, y: -bob, bubble: Math.max(0, 1 - u * 1.4), opacity: 1, done: false };
}

const CSS = `
#czabuela{position:absolute;inset:0;z-index:80;overflow:hidden;pointer-events:auto;background:none}
#czabuela.fixed{position:fixed}
#czabuela .abu-wrap{position:absolute;left:0;bottom:calc(22% + env(safe-area-inset-bottom,0px));
  display:flex;align-items:flex-end;transform:translateX(-110%);will-change:transform;
  filter:drop-shadow(0 10px 12px rgba(0,0,0,.55))}
#czabuela.waves .abu-wrap{bottom:calc(22% + env(safe-area-inset-bottom,0px))}
#czabuela.strike .abu-wrap{bottom:calc(13% + env(safe-area-inset-bottom,0px))}
#czabuela.slots .abu-wrap{bottom:calc(16% + env(safe-area-inset-bottom,0px))}
#czabuela img.abu{height:clamp(150px,30vh,260px);width:auto;display:block;flex:none;margin-left:-4px;
  pointer-events:none;-webkit-user-select:none;user-select:none}
#czabuela .bubble{position:relative;margin:0 0 clamp(96px,18vh,176px) 4px;max-width:min(250px,58vw);
  background:#fff8ec;color:#3b1a5c;border:4px solid #3b1a5c;border-radius:22px;padding:10px 14px 8px;
  box-shadow:0 6px 0 #3b1a5c,0 0 22px rgba(255,190,60,.45);transform-origin:12px 100%;
  opacity:0;transform:scale(.72);pointer-events:none}
#czabuela .bubble::before{content:"";position:absolute;left:-17px;bottom:16px;border:12px solid transparent;border-right:16px solid #3b1a5c;border-left:0}
#czabuela .bubble::after{content:"";position:absolute;left:-10px;bottom:19px;border:9px solid transparent;border-right:12px solid #fff8ec;border-left:0}
#czabuela .bubble p{margin:0;font:400 18px/1.2 LilitaOne,system-ui,sans-serif}
#czabuela .bubble small{display:block;margin-top:4px;font:700 9px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a07ab8;text-align:right}
@media (min-width:800px){
  #czabuela img.abu{height:clamp(180px,32vh,300px)}
  #czabuela .bubble{max-width:280px}
  #czabuela .bubble p{font-size:20px}
}
/* newGame un-hides the how-to hint; keep it off while she is saying her line. */
#stage:has(#czabuela) #hint{opacity:0!important;visibility:hidden}
`;

function injectCss(): void {
  if (document.getElementById('czabuela-css')) return;
  const s = document.createElement('style');
  s.id = 'czabuela-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// Warm the (small) intro sprite as soon as the module evaluates so she is ready
// on the first frame of the walk-in. The between-waves cameo still uses its own
// deferred /crash/abuela-chibi.webp and is not requested here.
const warm = new Image();
warm.decoding = 'async';
warm.src = ABUELA_SRC;

function applyPose(wrap: HTMLElement, bubble: HTMLElement, p: { x: number; y: number; bubble: number; opacity: number }): void {
  wrap.style.transform = `translate(${p.x}%, ${p.y}px)`;
  wrap.style.opacity = String(p.opacity);
  bubble.style.opacity = String(p.bubble);
  const s = 0.72 + 0.28 * p.bubble;
  bubble.style.transform = `scale(${s})`;
}

function runIntro(game: IntroGame, opts?: { seekable?: boolean; line?: number }): () => void {
  injectCss();
  document.getElementById('czabuela')?.remove();

  const host = document.createElement('div');
  host.id = 'czabuela';
  host.className = game;
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-label', 'Abuela says');

  const stage = document.getElementById('stage');
  if (stage) stage.appendChild(host);
  else {
    host.classList.add('fixed');
    document.body.appendChild(host);
  }

  const wrap = document.createElement('div');
  wrap.className = 'abu-wrap';
  const img = document.createElement('img');
  img.className = 'abu';
  img.src = ABUELA_SRC;
  img.alt = 'Abuela';
  img.width = 364;
  img.height = 720;
  img.decoding = 'async';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const p = document.createElement('p');
  const idx = opts?.line ?? nextLineIndex();
  currentLine = idx;
  p.textContent = INTRO_LINES[idx];
  const hint = document.createElement('small');
  hint.textContent = 'tap to skip';
  bubble.appendChild(p);
  bubble.appendChild(hint);
  // Same order as the between-waves cameo: figure on the left, bubble lifted at her shoulder on the right.
  wrap.appendChild(img);
  wrap.appendChild(bubble);
  host.appendChild(wrap);
  // The waves how-to hint sits in the same band as her bubble; tuck it away for the 2s she is on.
  const howTo = document.getElementById('hint');
  if (howTo) howTo.classList.add('gone');

  const reduce = reduced();
  // Cap frame dt so a long first rAF or a WebGL stall cannot jump the walk-in to its end.
  let last: number | null = null;
  let elapsed = 0;
  let skipElapsed = 0;
  let skipping = false;
  let skipStartX = 0;
  let skipStartBob = 0;
  let skipStartBubble = 1;
  let raf = 0;
  let finished = false;
  let frozen: number | null = opts?.seekable ? 0 : null;

  const SKIP_OUT = 280;
  const MAX_DT = 50;

  function finish(): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    host.removeEventListener('pointerdown', onSkip, true);
    document.removeEventListener('keydown', onKey, true);
    host.remove();
    if (runningCleanup === cleanup) runningCleanup = null;
  }

  function frame(now: number): void {
    if (finished) return;
    const dt = last === null ? 0 : Math.min(MAX_DT, Math.max(0, now - last));
    last = now;
    let ppose;
    if (frozen !== null) {
      ppose = poseAt(frozen, reduce);
    } else if (skipping) {
      skipElapsed += dt;
      const t = Math.min(1, skipElapsed / SKIP_OUT);
      const e = easeInCubic(t);
      ppose = {
        x: skipStartX + (-110 - skipStartX) * e,
        y: skipStartBob * (1 - e),
        bubble: skipStartBubble * (1 - e),
        opacity: reduce ? (1 - e) : 1,
        done: t >= 1,
      };
    } else {
      elapsed += dt;
      ppose = poseAt(elapsed, reduce);
    }
    applyPose(wrap, bubble, ppose);
    if (ppose.done && frozen === null) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function beginSkip(e?: Event): void {
    if (finished || skipping || frozen !== null) return;
    e?.preventDefault();
    e?.stopPropagation();
    const cur = poseAt(elapsed, reduce);
    skipStartX = cur.x;
    skipStartBob = cur.y;
    skipStartBubble = cur.bubble;
    skipping = true;
    skipElapsed = 0;
  }

  function onSkip(e: PointerEvent): void {
    beginSkip(e);
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      beginSkip(e);
    }
  }

  host.addEventListener('pointerdown', onSkip, true);
  document.addEventListener('keydown', onKey, true);

  const cleanup = (): void => { finish(); };
  runningCleanup = cleanup;

  // Expose seek on the host for the hook below.
  (host as unknown as { __seek: (u: number) => void }).__seek = (u: number) => {
    frozen = Math.max(0, Math.min(1, u)) * (reduce ? REDUCE_MS : TOTAL_MS);
  };

  applyPose(wrap, bubble, poseAt(0, reduce));
  raf = requestAnimationFrame(frame);
  return cleanup;
}

/**
 * Play the Abuela walk-in. `onDone` is called immediately — the game must start
 * with no wait. The overlay is only Abuela and her bubble (no dim, no card);
 * a tap skips her exit. There is no audio.
 */
export function playPlayer1Intro(_game: IntroGame, onDone?: () => void, opts?: { seekable?: boolean; line?: number }): void {
  const go = shouldPlayIntro();
  onDone?.();
  if (!go) return;
  // Next frame so the game's first paint is already under her walk-in.
  requestAnimationFrame(() => runIntro(_game, opts));
}

(window as unknown as { __p1intro: {
  play: (game: IntroGame, onDone?: () => void) => void;
  seek: (u: number) => void;
  skip: () => void;
  line: () => { i: number; text: string };
  lines: () => readonly string[];
} }).__p1intro = {
  play(_game: IntroGame, onDone?: () => void): void {
    runningCleanup?.();
    document.getElementById('czabuela')?.remove();
    forceIntro = true;
    const go = shouldPlayIntro();
    forceIntro = false;
    onDone?.();
    if (go) runIntro(_game);
  },
  /** Freeze the walk-in at u in [0, 1] (u * TOTAL_MS), for stills and clips. */
  seek(u: number): void {
    forceIntro = true;
    let host = document.getElementById('czabuela');
    if (!host) {
      runningCleanup?.();
      const game: IntroGame = /waves/.test(location.pathname) ? 'waves'
        : /slots/.test(location.pathname) ? 'slots' : 'strike';
      runIntro(game, { seekable: true });
      host = document.getElementById('czabuela');
    }
    forceIntro = false;
    const fn = host && (host as unknown as { __seek?: (u: number) => void }).__seek;
    fn?.(u);
  },
  skip(): void {
    const host = document.getElementById('czabuela');
    host?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  },
  line: () => ({ i: currentLine, text: INTRO_LINES[currentLine] }),
  lines: () => INTRO_LINES,
};
