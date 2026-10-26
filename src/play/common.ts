import { initAudio, setMuted, isMuted } from '../game/sound';
export const $ = (id: string) => document.getElementById(id)!;
export function loadImg(src: string) { const i = new Image(); i.src = src; return new Promise<HTMLImageElement>((r, j) => { i.onload = () => r(i); i.onerror = j; }); }
let audioOn = false;
export function wakeAudio() { if (!audioOn) { audioOn = true; try { initAudio(); } catch { /* ignore */ } } }
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
