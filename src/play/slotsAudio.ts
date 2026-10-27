// Procedural Web Audio for Piñata Slots — synthesized only (no sample files).
// Festive marimba / trumpet-ish stingers. Free to use; nothing licensed from elsewhere.
import { isMuted as gameMuted, setMuted as setGameMuted } from '../game/sound';

const KEY = 'chanclazo_slots_muted';
let ctx: AudioContext | null = null, master: GainNode, sfx: GainNode, music: GainNode, noise: AudioBuffer;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
let spinLoop: { stop: () => void } | null = null;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return null;
    ctx = new AC() as AudioContext;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.95; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0.12; music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
function setSession() { try { const as = (navigator as any).audioSession; if (as && as.type !== 'playback') as.type = 'playback'; } catch { /* */ } }
setSession();
let silentEl: HTMLAudioElement | null = null;
function silentWavUrl() {
  const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function playSilent() {
  try {
    if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = silentWavUrl(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01; document.body.appendChild(silentEl); }
    if (silentEl.paused) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); }
  } catch { /* */ }
}
export function unlock() {
  setSession(); playSilent();
  const c = ensure(); if (!c) return;
  try {
    if (c.state !== 'running') c.resume().catch(() => {});
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
  } catch { /* */ }
}
export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m; try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* */ }
  setGameMuted(m); if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05);
  if (m) stopSpinLoop();
}
setGameMuted(muted);

const now = () => ctx!.currentTime;
function ok() { return !!ensure() && !muted && !gameMuted(); }
function env(g: GainNode, t: number, peak: number, a: number, d: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, out: AudioNode = sfx, a = 0.004) {
  if (!ok()) return;
  const o = ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx!.createGain(); env(g, t, peak, a, dur); o.connect(g).connect(out); o.start(t); o.stop(t + a + dur + 0.05);
}
function noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number) {
  if (!ok()) return;
  const s = ctx!.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx!.createGain(); env(g, t, peak, 0.004, dur);
  s.connect(f).connect(g).connect(sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
/** Bright marimba-ish bar (FM-ish via two osc). */
function marimba(t: number, freq: number, peak = 0.22, dur = 0.35) {
  if (!ok()) return;
  const o1 = ctx!.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
  const o2 = ctx!.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 3.9;
  const g2 = ctx!.createGain(); g2.gain.value = 0.35;
  const g = ctx!.createGain(); env(g, t, peak, 0.002, dur);
  o2.connect(g2).connect(o1.frequency); o1.connect(g).connect(sfx);
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function trumpetHit(t: number, freq: number, peak = 0.18) {
  if (!ok()) return;
  tone(t, 'sawtooth', freq, freq * 1.02, 0.22, peak * 0.6);
  tone(t, 'square', freq * 0.5, freq * 0.5, 0.18, peak * 0.25);
  const f = ctx!.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 4;
}

export function startSpinLoop() {
  stopSpinLoop(); if (!ok()) return;
  const c = ctx!; const t0 = c.currentTime;
  const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
  const lfo = c.createOscillator(); lfo.frequency.value = 14;
  const lfoG = c.createGain(); lfoG.gain.value = 18;
  lfo.connect(lfoG).connect(osc.frequency);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 2.5;
  const g = c.createGain(); g.gain.value = 0.05;
  osc.connect(f).connect(g).connect(sfx);
  osc.start(t0); lfo.start(t0);
  // soft tick layer
  let alive = true;
  const tick = () => {
    if (!alive || !ok()) return;
    noiseBurst(now(), 0.03, 'highpass', 2000, 0.7, 0.04);
    setTimeout(tick, 90 + Math.random() * 40);
  };
  setTimeout(tick, 80);
  spinLoop = { stop() { alive = false; try { osc.stop(); lfo.stop(); } catch { /* */ } } };
}
export function stopSpinLoop() { if (spinLoop) { spinLoop.stop(); spinLoop = null; } }

export function reelStop(reelIndex: number) {
  if (!ok()) return;
  const t = now();
  tone(t, 'triangle', 180 - reelIndex * 8, 90, 0.08, 0.2);
  noiseBurst(t, 0.05, 'lowpass', 800, 1, 0.15);
  marimba(t + 0.02, 330 + reelIndex * 40, 0.12, 0.2);
}
export function scatterDing(count: number) {
  if (!ok()) return;
  const base = 520 + count * 90;
  marimba(now(), base, 0.2 + count * 0.04, 0.4);
  tone(now(), 'sine', base * 2, base * 2.2, 0.25, 0.08);
}
export function winSmall() { if (!ok()) return; const t = now(); marimba(t, 523, 0.18); marimba(t + 0.1, 659, 0.16); }
export function winMedium() {
  if (!ok()) return; const t = now();
  [523, 659, 784, 1046].forEach((f, i) => marimba(t + i * 0.09, f, 0.2));
  trumpetHit(t + 0.35, 392, 0.15);
}
export function winBig() {
  if (!ok()) return; const t = now();
  [392, 523, 659, 784, 1046, 1318].forEach((f, i) => marimba(t + i * 0.08, f, 0.22));
  trumpetHit(t + 0.2, 523, 0.2); trumpetHit(t + 0.45, 659, 0.18); trumpetHit(t + 0.7, 784, 0.16);
  noiseBurst(t + 0.5, 0.3, 'bandpass', 1200, 2, 0.1);
}
export function creditRoll(steps = 8) {
  if (!ok()) return;
  for (let i = 0; i < steps; i++) tone(now() + i * 0.045, 'square', 900 + i * 30, 900 + i * 30, 0.04, 0.06);
}
export function freeSpinsFanfare() {
  if (!ok()) return; const t = now();
  [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => { marimba(t + i * 0.1, f, 0.24); trumpetHit(t + i * 0.1, f / 2, 0.1); });
}
export function smashFanfare() {
  if (!ok()) return; const t = now();
  trumpetHit(t, 349, 0.2); trumpetHit(t + 0.12, 440, 0.18); trumpetHit(t + 0.24, 523, 0.2);
  marimba(t + 0.3, 784, 0.22); marimba(t + 0.4, 1046, 0.2);
}
export function chanclaWhack() {
  if (!ok()) return; const t = now();
  noiseBurst(t, 0.08, 'lowpass', 600, 1, 0.3);
  tone(t, 'triangle', 220, 80, 0.1, 0.25);
}
export function pinataPop() {
  if (!ok()) return; const t = now();
  noiseBurst(t, 0.12, 'bandpass', 1400, 1.5, 0.25);
  marimba(t, 880 + Math.random() * 200, 0.2, 0.25);
  tone(t, 'sine', 1200, 600, 0.15, 0.1);
}
export function llamaBoom() {
  if (!ok()) return; const t = now();
  tone(t, 'sine', 80, 40, 0.6, 0.4, sfx, 0.01);
  noiseBurst(t, 0.5, 'lowpass', 300, 0.8, 0.35);
  noiseBurst(t + 0.05, 0.3, 'bandpass', 800, 1, 0.2);
  trumpetHit(t + 0.1, 262, 0.22); marimba(t + 0.2, 523, 0.2);
}
export function expandWhoosh() {
  if (!ok()) return; const t = now();
  noiseBurst(t, 0.25, 'bandpass', 600, 1, 0.2);
  tone(t, 'sawtooth', 200, 600, 0.3, 0.12);
  marimba(t + 0.15, 659, 0.18);
}
export function pickReveal() {
  if (!ok()) return; marimba(now(), 700 + Math.random() * 400, 0.22, 0.35);
}
export function pickFanfare() {
  if (!ok()) return; const t = now();
  [440, 554, 659, 880].forEach((f, i) => marimba(t + i * 0.11, f, 0.2));
  trumpetHit(t + 0.4, 440, 0.18);
}
export function abuelaStomp() {
  if (!ok()) return; const t = now();
  tone(t, 'square', 100, 60, 0.15, 0.2);
  noiseBurst(t, 0.1, 'lowpass', 400, 1, 0.25);
  marimba(t + 0.08, 392, 0.18);
  trumpetHit(t + 0.15, 311, 0.15);
}
