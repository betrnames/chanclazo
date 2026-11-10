// Chancla Crash SFX: all synthesized with WebAudio (no files).
import { isMuted } from '../game/sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let comp: DynamicsCompressorNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const last: Record<string, number> = {};

export function unlockCrashAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = 0.8;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { ctx = null; }
}

function c(): AudioContext | null {
  if (!ctx || isMuted()) return null;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
/** Rate-limit a sound type so piles of collisions don't turn into mush. */
function gate(key: string, ms: number): boolean {
  const n = performance.now();
  if (n - (last[key] || 0) < ms) return false;
  last[key] = n; return true;
}

function tone(f0: number, f1: number, type: OscillatorType, t: number, dur: number, peak: number, pan = 0): void {
  const a = c(); if (!a || !master) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = g;
  if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  o.connect(g); out.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function burst(t: number, dur: number, peak: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1, pan = 0): void {
  const a = c(); if (!a || !master || !noiseBuf) return;
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.01, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = g;
  if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  s.connect(f); f.connect(g); out.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const now = () => (ctx ? ctx.currentTime : 0);

/** Launch: low thump + air release. */
export function sfxFire(): void {
  const a = c(); if (!a) return; const t = now();
  tone(140, 55, 'sine', t, 0.18, 0.7);
  burst(t, 0.12, 0.35, 'lowpass', 1800, 400);
}
/** Spinning chancla cutting the air: a few pulsing sweeps. */
export function sfxWhoosh(): void {
  const a = c(); if (!a) return; const t = now();
  for (let i = 0; i < 4; i++) burst(t + 0.05 + i * 0.09, 0.14, 0.22 - i * 0.04, 'bandpass', 700 + i * 300, 2600, 2.5);
}
/** Chancla smacks something. */
export function sfxThwack(strength = 1): void {
  if (!gate('thwack', 60)) return;
  const a = c(); if (!a) return; const t = now(); const s = Math.min(1, strength);
  tone(180, 60, 'sine', t, 0.16, 0.75 * s);
  burst(t, 0.05, 0.6 * s, 'highpass', 1200, 1200, 0.7);
  burst(t, 0.12, 0.35 * s, 'lowpass', 900, 300);
}
/** Wooden crate / beam knock. */
export function sfxWood(strength = 1, pan = 0): void {
  if (!gate('wood', 45)) return;
  const a = c(); if (!a) return; const t = now(); const s = Math.min(1, strength);
  const f = 260 + Math.random() * 160;
  tone(f, f * 0.8, 'triangle', t, 0.09, 0.35 * s, pan);
  burst(t, 0.06, 0.4 * s, 'bandpass', 900 + Math.random() * 600, 700, 3, pan);
  if (s > 0.7) burst(t + 0.02, 0.08, 0.3 * s, 'bandpass', 1800, 1200, 4, pan); // splinter crack
}
/** Clay pot / sugar skull shattering: crunch + glassy tinkles. */
export function sfxClay(pan = 0): void {
  if (!gate('clay', 50)) return;
  const a = c(); if (!a) return; const t = now();
  burst(t, 0.16, 0.55, 'highpass', 2500, 1500, 0.8, pan);
  burst(t, 0.1, 0.4, 'bandpass', 700, 400, 2, pan);
  for (let i = 0; i < 6; i++) tone(1600 + Math.random() * 2400, 1400 + Math.random() * 1800, 'sine', t + 0.03 + Math.random() * 0.25, 0.08 + Math.random() * 0.1, 0.09, pan);
}
/** Skeleton bones rattling. */
export function sfxRattle(pan = 0): void {
  if (!gate('rattle', 90)) return;
  const a = c(); if (!a) return; const t = now();
  for (let i = 0; i < 9; i++) {
    const tt = t + i * 0.035 + Math.random() * 0.02;
    burst(tt, 0.025, 0.35, 'bandpass', 2200 + Math.random() * 1600, 2000, 6, pan);
    tone(700 + Math.random() * 500, 500, 'square', tt, 0.02, 0.05, pan);
  }
}
/** Piñata bursting: paper rip + candy rain. */
export function sfxPinata(pan = 0): void {
  const a = c(); if (!a) return; const t = now();
  burst(t, 0.22, 0.6, 'bandpass', 1500, 4000, 1.2, pan);
  tone(300, 900, 'triangle', t, 0.18, 0.3, pan);
  for (let i = 0; i < 10; i++) tone(2000 + Math.random() * 2000, 1800, 'sine', t + 0.1 + i * 0.04, 0.05, 0.08, pan);
}
/** Pan dulce squish: soft doughy thump + sugar crumble. */
export function sfxSquish(strength = 1): void {
  if (!gate('squish', 70)) return;
  const a = c(); if (!a) return; const t = now(); const s = Math.min(1, strength);
  tone(260, 90, 'sine', t, 0.14, 0.45 * s);
  burst(t + 0.01, 0.12, 0.25 * s, 'bandpass', 3200, 1800, 1.5);
}
/** Papel picado tearing. */
export function sfxPaper(): void {
  const a = c(); if (!a) return; const t = now();
  for (let i = 0; i < 4; i++) burst(t + i * 0.04, 0.07, 0.3, 'highpass', 3000 + i * 600, 5000, 0.7);
}
/** Candle tink. */
export function sfxTink(pan = 0): void {
  if (!gate('tink', 70)) return;
  const a = c(); if (!a) return; const t = now();
  tone(1900 + Math.random() * 400, 1700, 'sine', t, 0.18, 0.12, pan);
}
/** Deflector boing. */
export function sfxBoing(): void {
  if (!gate('boing', 80)) return;
  const a = c(); if (!a) return; const t = now();
  tone(220, 660, 'sine', t, 0.25, 0.5);
  tone(330, 990, 'triangle', t + 0.02, 0.2, 0.2);
}
/** Point pickup blip (score popups). */
export function sfxPoint(n = 0): void {
  if (!gate('point', 40)) return;
  const a = c(); if (!a) return; const t = now();
  const f = 880 * Math.pow(2, Math.min(n, 8) / 12);
  tone(f, f, 'square', t, 0.07, 0.07);
  tone(f * 1.5, f * 1.5, 'square', t + 0.05, 0.08, 0.06);
}
/** Combo sting: rising mariachi-ish arpeggio, longer for bigger combos. */
export function sfxCombo(level: number): void {
  const a = c(); if (!a) return; const t = now();
  const notes = [523, 659, 784, 1047, 1319, 1568];
  const n = Math.min(notes.length, 2 + level);
  for (let i = 0; i < n; i++) {
    tone(notes[i], notes[i], 'square', t + i * 0.07, 0.14, 0.12);
    tone(notes[i] / 2, notes[i] / 2, 'triangle', t + i * 0.07, 0.16, 0.18);
  }
  if (level >= 3) burst(t + n * 0.07, 0.35, 0.25, 'highpass', 5000, 8000, 0.5); // cymbal
}
/** Level clear fanfare. */
export function sfxWin(): void {
  const a = c(); if (!a) return; const t = now();
  const seq = [392, 523, 659, 784, 0, 659, 784, 1047];
  seq.forEach((f, i) => { if (f) { tone(f, f, 'square', t + i * 0.09, 0.2, 0.12); tone(f / 2, f / 2, 'sawtooth', t + i * 0.09, 0.2, 0.05); } });
  [523, 659, 784, 1047].forEach((f) => tone(f, f, 'triangle', t + 0.8, 0.9, 0.12));
  burst(t + 0.8, 0.8, 0.18, 'highpass', 6000, 9000, 0.5);
}
export function sfxStar(i: number): void {
  const a = c(); if (!a) return; const t = now();
  const f = [1047, 1319, 1568][i] || 1568;
  tone(f, f, 'square', t, 0.15, 0.1); tone(f * 2, f * 2, 'sine', t + 0.03, 0.25, 0.08);
}
/** Out of chanclas: sad trombone. */
export function sfxLose(): void {
  const a = c(); if (!a) return; const t = now();
  [[392, 370], [370, 349], [349, 330], [330, 247]].forEach(([f0, f1], i) => tone(f0, f1, 'sawtooth', t + i * 0.32, i === 3 ? 0.9 : 0.3, 0.12));
}
export function sfxClick(): void {
  const a = c(); if (!a) return; const t = now();
  tone(1200, 900, 'square', t, 0.04, 0.06);
}
/** Reload: chancla back in hand. */
export function sfxReload(): void {
  const a = c(); if (!a) return; const t = now();
  burst(t, 0.05, 0.15, 'bandpass', 2400, 2400, 3);
  tone(600, 900, 'triangle', t + 0.02, 0.06, 0.08);
}

/** RAPID FIRE power-up: rising sweep + sparkly arpeggio + cymbal. */
export function sfxRapid(): void {
  const a = c(); if (!a) return; const t = now();
  tone(220, 1760, 'sawtooth', t, 0.45, 0.09);
  [784, 988, 1175, 1568, 1976].forEach((f, i) => { tone(f, f, 'square', t + 0.08 + i * 0.055, 0.12, 0.1); tone(f * 2, f * 2, 'sine', t + 0.1 + i * 0.055, 0.14, 0.05); });
  burst(t + 0.35, 0.5, 0.22, 'highpass', 5000, 9000, 0.5);
}
/** One rapid-fire shot: short punchy thump (rate-limited). */
export function sfxRapidShot(): void {
  if (!gate('rshot', 60)) return;
  const a = c(); if (!a) return; const t = now();
  tone(260 + Math.random() * 60, 90, 'square', t, 0.08, 0.16);
  burst(t, 0.07, 0.22, 'bandpass', 2600, 900, 1.5);
}
/** Power-up running out: two descending blips. */
export function sfxRapidEnd(): void {
  const a = c(); if (!a) return; const t = now();
  tone(988, 740, 'square', t, 0.1, 0.08); tone(740, 494, 'square', t + 0.11, 0.14, 0.08);
}

/** Haptics (Android/Chrome; iOS ignores navigator.vibrate). */
export function buzz(p: number | number[]): void {
  try { if ('vibrate' in navigator) navigator.vibrate(p); } catch { /* ignore */ }
}
