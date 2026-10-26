import { initAudio, setMuted, isMuted } from '../game/sound';
export const $ = (id: string) => document.getElementById(id)!;
export function loadImg(src: string) { const i = new Image(); i.src = src; return new Promise<HTMLImageElement>((r, j) => { i.onload = () => r(i); i.onerror = j; }); }
// iOS audio: 'playback' session (plays with the silent switch on, iOS 17+), a looping silent <audio>
// fallback, and initAudio() called synchronously from touchend/pointerup/click (never touchstart).
function setSession() { try { const as = (navigator as any).audioSession; if (as && as.type !== 'playback') as.type = 'playback'; } catch { /* ignore */ } }
let silentEl: HTMLAudioElement | null = null;
function silentWavUrl() {
  const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf); const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
export function iosAudioKick() {
  setSession();
  try { if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = silentWavUrl(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01; document.body.appendChild(silentEl); }
    if (silentEl.paused) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); } } catch { /* ignore */ }
}
export function wakeAudio() { iosAudioKick(); try { initAudio(); } catch { /* ignore */ } }
export function autoUnlockAudio() {
  setSession();
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) addEventListener(ev, wakeAudio, { capture: true, passive: true });
  const re = () => { if (!document.hidden) { try { initAudio(); } catch { /* ignore */ } } };
  document.addEventListener('visibilitychange', re); addEventListener('pageshow', re);
}
export function wireMute() {
  const b = $('mute') as HTMLButtonElement;
  const draw = () => (b.textContent = isMuted() ? '🔇' : '🔊');
  b.onclick = (e) => { e.stopPropagation(); wakeAudio(); setMuted(!isMuted()); draw(); }; draw();
}
export function stars(n: number) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

// ?debug=1 shows any runtime error in a small corner box (for testing on real phones).
const DEBUG = /[?&]debug=1/.test(location.search);
let box: HTMLDivElement | null = null;
export function report(msg: string) {
  if (!DEBUG) return;
  if (!box) { box = document.createElement('div'); Object.assign(box.style, { position: 'fixed', left: '4px', bottom: '4px', maxWidth: '70vw', maxHeight: '40vh', overflow: 'auto', zIndex: '99', background: 'rgba(0,0,0,.8)', color: '#7CFC9A', font: '11px/1.3 monospace', padding: '4px 6px', borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'pre-wrap' }); document.body.appendChild(box); }
  box.textContent = (box.textContent + '\n' + msg).trim().split('\n').slice(-8).join('\n');
}
if (DEBUG) {
  addEventListener('error', (e: ErrorEvent) => report('error: ' + (e.message || e.type)));
  addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => report('rejection: ' + ((e.reason && e.reason.message) || e.reason)));
  setTimeout(() => report(`debug on · ${innerWidth}x${innerHeight} · ${navigator.userAgent.match(/OS [\d_]+|Android [\d.]+|Chrome\/\d+|Version\/[\d.]+/g)?.join(' ') || ''}`), 300);
}
