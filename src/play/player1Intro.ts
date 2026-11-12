// Boot sting: the gold chancla spins in and bursts, a "CHANCLAZO!" announcer
// plays, and the game is already live underneath. No camera intro, no loading
// wait, no blocking overlay. Free Piper-generated audio in /play/sfx/.
import { isMuted } from '../game/sound';

export type IntroGame = 'waves' | 'strike' | 'slots';

const MP3 = '/play/sfx/chanclazo-stinger.mp3';
const LOGO = '/lp/chancla_gold.webp';
const BURST = '/lp/chancla_burst.webp';
const TOTAL_MS = 1250;
const BURST_AT = 0.50;

let forceIntro = false;
let audioEl: HTMLAudioElement | null = null;
let armed = false;
let played = false;
let pending = false;
let runningCleanup: (() => void) | null = null;

export function shouldPlayIntro(): boolean {
  if (forceIntro) return true;
  // Playtests and screenshot hooks use ?start=1; ?nointro=1 is an explicit opt-out.
  if (/[?&](start=1|nointro=1)(?:&|$)/.test(location.search)) return false;
  return true;
}

/** Kept so older hooks don't break. The sting is always short and never blocks. */
export function isShortIntro(): boolean { return true; }

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  const a = document.createElement('audio');
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  (a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  a.setAttribute('webkit-playsinline', '');
  a.src = MP3;
  a.load();
  audioEl = a;
  return a;
}

function disarm(): void {
  armed = false;
  pending = false;
}

function tryPlayAudio(): boolean {
  if (isMuted() || played) return true;
  try {
    const a = ensureAudio();
    a.currentTime = 0;
    a.volume = 1;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { played = true; disarm(); }).catch(() => { pending = true; armGesture(); });
    } else {
      played = true; disarm();
    }
    return true;
  } catch {
    pending = true;
    armGesture();
    return false;
  }
}

/** If autoplay is blocked, play on the first tap without eating the gesture or blocking play. */
function armGesture(): void {
  if (armed) return;
  armed = true;
  pending = true;
  const evs: Array<keyof WindowEventMap> = ['pointerdown', 'touchend', 'click', 'keydown'];
  const on = (): void => {
    if (!pending || played) { evs.forEach((e) => removeEventListener(e, on, true)); disarm(); return; }
    if (isMuted()) return;
    try {
      const a = ensureAudio();
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { played = true; evs.forEach((e) => removeEventListener(e, on, true)); disarm(); }).catch(() => {});
      } else {
        played = true; evs.forEach((e) => removeEventListener(e, on, true)); disarm();
      }
    } catch { /* keep armed */ }
  };
  evs.forEach((e) => addEventListener(e, on, { capture: true, passive: true }));
}

const CSS = `
@font-face{font-family:LilitaOne;src:url(/fonts/LilitaOne-Regular.ttf) format("truetype");font-display:swap}
#czsting{position:fixed;inset:0;z-index:200;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden}
#czsting .glow{position:absolute;width:min(80vw,380px);height:min(80vw,380px);border-radius:50%;
  background:radial-gradient(circle,rgba(255,210,63,.55) 0%,rgba(255,140,26,.18) 40%,transparent 70%);
  transform:scale(.2);opacity:0;animation:czglow 1.15s ease-out forwards}
#czsting .burst{position:absolute;width:min(120vw,640px);height:min(120vw,640px);object-fit:contain;
  transform:scale(.2) rotate(-12deg);opacity:0;animation:czburst 0.7s ${BURST_AT}s cubic-bezier(.15,1.55,.35,1) forwards}
#czsting .logo{position:absolute;width:min(140vw,620px);height:min(140vw,620px);object-fit:contain;
  filter:drop-shadow(0 0 22px rgba(255,210,63,.95)) drop-shadow(0 14px 22px rgba(0,0,0,.45));
  animation:czspin .5s cubic-bezier(.14,1.55,.32,1) both, czout .62s ${BURST_AT}s cubic-bezier(.2,.7,.3,1) forwards}
#czsting .word{position:absolute;top:56%;left:10px;right:10px;text-align:center;font:400 clamp(34px,11.2vw,72px)/.92 LilitaOne,system-ui,sans-serif;
  color:#ffd23f;letter-spacing:.02em;-webkit-text-stroke:5px #3b1a5c;paint-order:stroke fill;
  text-shadow:0 5px 0 #2a1040,0 0 22px rgba(255,200,60,.8);transform:scale(0);opacity:0;
  animation:czslam .7s ${BURST_AT - 0.02}s cubic-bezier(.15,1.8,.35,1) forwards}
#czsting .flash{position:absolute;inset:0;background:#fff6d4;opacity:0;mix-blend-mode:screen;animation:czflash .38s ${BURST_AT}s ease-out forwards}
#czsting .sparks{position:absolute;inset:0;overflow:hidden}
#czsting .spark{position:absolute;left:50%;top:48%;width:var(--s,10px);height:var(--s,10px);margin:0;padding:0;
  background:var(--c,#ffd23f);border:2px solid #3b1a5c;border-radius:var(--br,2px);
  transform:rotate(var(--r)) translateY(0) scale(0);opacity:0;
  animation:czspark .7s ${BURST_AT}s ease-out forwards}
@keyframes czspin{
  0%{transform:perspective(800px) rotateZ(-700deg) rotateX(26deg) scale(.08);opacity:0}
  70%{transform:perspective(800px) rotateZ(14deg) rotateX(-8deg) scale(1.16);opacity:1}
  100%{transform:perspective(800px) rotateZ(0deg) rotateX(0deg) scale(1);opacity:1}
}
@keyframes czout{
  0%{transform:perspective(800px) scale(1) rotate(0);opacity:1;filter:drop-shadow(0 0 22px rgba(255,210,63,.95))}
  28%{transform:perspective(800px) scale(1.32) rotate(16deg);opacity:1}
  100%{transform:perspective(800px) scale(2.35) rotate(48deg);opacity:0;filter:drop-shadow(0 0 4px rgba(255,210,63,0))}
}
@keyframes czburst{
  0%{transform:scale(.25) rotate(-18deg);opacity:0}
  35%{transform:scale(1.05) rotate(4deg);opacity:1}
  100%{transform:scale(1.85) rotate(12deg);opacity:0}
}
@keyframes czslam{
  0%{transform:scale(2.6) rotate(-10deg);opacity:0}
  22%{transform:scale(1.08) rotate(-2deg);opacity:1}
  68%{transform:scale(1) rotate(-2deg);opacity:1}
  100%{transform:scale(1.12) rotate(-2deg);opacity:0}
}
@keyframes czflash{0%{opacity:.5}35%{opacity:.22}100%{opacity:0}}
@keyframes czglow{
  0%{transform:scale(.15);opacity:0}
  35%{transform:scale(.85);opacity:.7}
  55%{transform:scale(1.15);opacity:.55}
  100%{transform:scale(2.2);opacity:0}
}
@keyframes czspark{
  0%{transform:rotate(var(--r)) translateY(0) scale(.35);opacity:1}
  100%{transform:rotate(var(--r)) translateY(var(--d)) scale(.15);opacity:0}
}

#czsting.seek .glow{animation-delay:calc(0s - var(--t));animation-play-state:paused;animation-fill-mode:both}
#czsting.seek .logo{animation-delay:calc(0s - var(--t)),calc(.50s - var(--t));animation-play-state:paused,paused;animation-fill-mode:both,forwards}
#czsting.seek .burst{animation-delay:calc(.50s - var(--t));animation-play-state:paused;animation-fill-mode:forwards}
#czsting.seek .word{animation-delay:calc(.48s - var(--t));animation-play-state:paused;animation-fill-mode:forwards}
#czsting.seek .flash{animation-delay:calc(.50s - var(--t));animation-play-state:paused;animation-fill-mode:forwards}
#czsting.seek .spark{animation-delay:calc(.50s - var(--t));animation-play-state:paused;animation-fill-mode:forwards}
#czsting.reduce .logo,#czsting.reduce .burst,#czsting.reduce .word,#czsting.reduce .glow,#czsting.reduce .flash,#czsting.reduce .spark{animation:none}
#czsting.reduce .logo{transform:scale(1);opacity:1;transition:opacity .35s ease .25s}
#czsting.reduce .word{opacity:1;transform:scale(1);transition:opacity .35s ease .4s}
#czsting.reduce.out .logo,#czsting.reduce.out .word{opacity:0}
`;

function injectCss(): void {
  if (document.getElementById('czsting-css')) return;
  const s = document.createElement('style');
  s.id = 'czsting-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function sparks(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'sparks';
  const colors = ['#ffd23f', '#ffd23f', '#ff8a2a', '#fff2a8', '#f4a000', '#ffe56a'];
  for (let i = 0; i < 22; i++) {
    const e = document.createElement('i');
    e.className = 'spark';
    const ang = (i / 22) * 360 + (i % 3) * 9 - 8;
    const dist = 130 + (i % 5) * 28 + (i % 2) * 18;
    const size = i % 4 === 0 ? 14 : i % 3 === 0 ? 7 : 10;
    e.style.setProperty('--r', `${ang}deg`);
    e.style.setProperty('--d', `${dist}px`);
    e.style.setProperty('--s', `${size}px`);
    e.style.setProperty('--c', colors[i % colors.length]);
    e.style.setProperty('--br', i % 2 === 0 ? '1px' : '50%');
    e.style.animationDelay = `${BURST_AT + (i % 6) * 0.012}s`;
    wrap.appendChild(e);
  }
  return wrap;
}

function reduced(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runBurst(opts?: { silent?: boolean; seekable?: boolean }): void {
  runningCleanup?.();
  injectCss();
  // Preload art so the close-up isn't a blank box, but never hold the game.
  const host = document.createElement('div');
  host.id = 'czsting';
  host.setAttribute('aria-hidden', 'true');
  if (reduced()) host.classList.add('reduce');

  const glow = document.createElement('div'); glow.className = 'glow';
  const burst = document.createElement('img'); burst.className = 'burst'; burst.src = BURST; burst.alt = '';
  const logo = document.createElement('img'); logo.className = 'logo'; logo.src = LOGO; logo.alt = '';
  const word = document.createElement('div'); word.className = 'word'; word.textContent = 'CHANCLAZO!';
  const flash = document.createElement('div'); flash.className = 'flash';

  for (const n of [glow, burst, sparks(), logo, word, flash]) host.appendChild(n);
  document.body.appendChild(host);

  if (opts?.seekable) host.classList.add('seek');
  if (!opts?.silent) {
    played = false;
    pending = false;
    tryPlayAudio();
  }

  // Seek mode stays on screen until the next play() or a later seek-cleanup.
  const t = opts?.seekable ? 0 : window.setTimeout(() => { cleanup(); }, reduced() ? 800 : TOTAL_MS + 80);
  const cleanup = (): void => {
    if (runningCleanup !== cleanup) return;
    runningCleanup = null;
    if (t) window.clearTimeout(t);
    if (reduced()) host.classList.add('out');
    host.remove();
  };
  runningCleanup = cleanup;
}

/**
 * Fire the sting and logo burst. `onDone` is called immediately — the game
 * must start with no wait. The overlay is pointer-events: none.
 */
export function playPlayer1Intro(_game: IntroGame, onDone?: () => void, opts?: { silent?: boolean; seekable?: boolean }): void {
  const go = shouldPlayIntro();
  onDone?.();
  if (!go) return;
  ensureAudio();
  // Next frame so the game's first paint is already under the burst.
  requestAnimationFrame(() => runBurst(opts));
}

// Warm the file as soon as the module loads (does not play).
try { ensureAudio(); } catch { /* ignore */ }

(window as unknown as { __p1intro: {
  play: (game: IntroGame, onDone?: () => void) => void;
  seek: (u: number) => void;
} }).__p1intro = {
  play(_game: IntroGame, onDone?: () => void): void {
    runningCleanup?.();
    document.getElementById('czsting')?.remove();
    forceIntro = true;
    played = false;
    pending = false;
    const go = shouldPlayIntro();
    forceIntro = false;
    onDone?.();
    if (go) { ensureAudio(); runBurst(); }
  },
  /** Freeze the burst at u in [0, 1] (u * TOTAL_MS). Silent, for stills and clips. */
  seek(u: number): void {
    forceIntro = true;
    let host = document.getElementById('czsting');
    if (!host) {
      runningCleanup?.();
      runBurst({ silent: true, seekable: true });
      host = document.getElementById('czsting');
    }
    forceIntro = false;
    if (!host) return;
    host.classList.add('seek');
    const t = Math.max(0, Math.min(1, u)) * (TOTAL_MS / 1000);
    host.style.setProperty('--t', `${t}s`);
    host.dataset.u = String(Math.max(0, Math.min(1, u)));
  },
};
