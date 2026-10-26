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
