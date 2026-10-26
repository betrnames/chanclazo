// Procedural Web Audio for Chanclazo Fling: every sound is synthesized here (no files, no licenses needed).
import { setMuted as setGameMuted } from '../game/sound';

const KEY = 'chanclazo_fling_muted';
let ctx: AudioContext | null = null, master: GainNode, sfx: GainNode, music: GainNode, noise: AudioBuffer;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })(); // default: sound ON
const MUSIC_LVL = 0.16;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return null;
    ctx = new AC() as AudioContext;
    ctx.onstatechange = () => { if ((ctx!.state as string) === 'interrupted' || ctx!.state === 'suspended') setTimeout(reResume, 300); };
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = MUSIC_LVL; music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
// iOS: 'playback' audio session plays Web Audio even with the silent switch on (iOS 17+).
function setSession() { try { const as = (navigator as any).audioSession; if (as && as.type !== 'playback') as.type = 'playback'; } catch { /* ignore */ } }
setSession();
// Fallback for older iOS: a looping silent <audio> element flips iOS into media playback mode.
let silentEl: HTMLAudioElement | null = null;
function silentWavUrl() {
  const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf); const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function playSilent() {
  try {
    if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = silentWavUrl(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('webkit-playsinline', ''); silentEl.preload = 'auto'; silentEl.volume = 0.01; document.body.appendChild(silentEl); }
    if (silentEl.paused) { const pr = silentEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
  } catch { /* ignore */ }
}
export let soundsPlayed = 0;
let blipped = false;
/** Call synchronously from touchend/pointerup/click: creates/resumes the context, nothing awaited first. */
export function unlock() {
  setSession(); playSilent();
  const c = ensure(); if (!c) return;
  try {
    if ((c.state as string) !== 'running') c.resume().catch(() => {});
    const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
    if (!blipped && !muted) { blipped = true; const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.04, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08); o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.1); }
  } catch { /* ignore */ }
}
function reResume() { if (ctx && (ctx.state as string) !== 'running' && (ctx.state as string) !== 'closed') ctx.resume().catch(() => {}); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) reResume(); });
addEventListener('pageshow', reResume); addEventListener('focus', reResume);
export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m; try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* private mode */ }
  setGameMuted(m); if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}
setGameMuted(muted);

// ── helpers ──────────────────────────────────────────────────────────────────
const now = () => ctx!.currentTime;
function env(g: GainNode, t: number, peak: number, a: number, d: number) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, out: AudioNode = sfx, freqEnd?: number) {
  soundsPlayed++; const s = ctx!.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx!.createGain(); env(g, t, peak, 0.004, dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, out: AudioNode = sfx, a = 0.004) {
  soundsPlayed++; const o = ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx!.createGain(); env(g, t, peak, a, dur); o.connect(g).connect(out); o.start(t); o.stop(t + a + dur + 0.05);
}
let duckUntil = 0;
function duck(depth = 0.35, hold = 0.5) {
  if (!ctx) return; const t = now(); duckUntil = Math.max(duckUntil, t + hold);
  music.gain.cancelScheduledValues(t); music.gain.setTargetAtTime(MUSIC_LVL * depth, t, 0.03); music.gain.setTargetAtTime(MUSIC_LVL, duckUntil, 0.4);
}
const ok = () => { if (!ensure() || ctx!.state === 'closed') return false; if ((ctx!.state as string) !== 'running') reResume(); return true; };

// ── slingshot ────────────────────────────────────────────────────────────────
let stretchNodes: { src: AudioBufferSourceNode; osc: OscillatorNode; f: BiquadFilterNode; g: GainNode; lfo: OscillatorNode } | null = null;
export function stretchStart() {
  if (!ok() || stretchNodes) return; const t = now();
  const src = ctx!.createBufferSource(); src.buffer = noise; src.loop = true;
  const f = ctx!.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; f.frequency.value = 350;
  const osc = ctx!.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70;
  const oscG = ctx!.createGain(); oscG.gain.value = 0.25;
  const g = ctx!.createGain(); g.gain.value = 0.0001;
  const lfo = ctx!.createOscillator(); lfo.frequency.value = 23; const lfoG = ctx!.createGain(); lfoG.gain.value = 0.5; // creaky rubber flutter
  const trem = ctx!.createGain(); trem.gain.value = 0.6; lfo.connect(lfoG).connect(trem.gain);
  src.connect(f); osc.connect(oscG).connect(f); f.connect(trem).connect(g).connect(sfx);
  src.start(t); osc.start(t); lfo.start(t); stretchNodes = { src, osc, f, g, lfo };
}
export function stretch(p: number) { // p: 0..1 pull distance
  if (!stretchNodes || !ctx) return; const t = now(); const k = Math.max(0, Math.min(1, p));
  stretchNodes.f.frequency.setTargetAtTime(300 + 1700 * k, t, 0.05);
  stretchNodes.osc.frequency.setTargetAtTime(60 + 160 * k, t, 0.05);
  stretchNodes.lfo.frequency.setTargetAtTime(18 + 30 * k, t, 0.05);
  stretchNodes.g.gain.setTargetAtTime(0.015 + 0.11 * k, t, 0.04);
}
export function stretchStop() {
  if (!stretchNodes || !ctx) return; const n = stretchNodes; stretchNodes = null; const t = now();
  n.g.gain.setTargetAtTime(0.0001, t, 0.02); for (const s of [n.src, n.osc, n.lfo]) s.stop(t + 0.15);
}
export function twang(power: number) {
  if (!ok()) return; const t = now();
  tone(t, 'triangle', 220 + 120 * power, 85, 0.35, 0.22); tone(t, 'sine', 440 + 200 * power, 160, 0.18, 0.08);
  noiseBurst(t, 0.05, 'highpass', 2500, 0.7, 0.25); // snap
}
export function whoosh(power: number) {
  if (!ok()) return; const t = now() + 0.03;
  noiseBurst(t, 0.6, 'bandpass', 500, 2.5, 0.12 + 0.12 * power, sfx, 1800);
  noiseBurst(t + 0.25, 0.5, 'bandpass', 1600, 2.5, 0.08, sfx, 500);
}

// ── impacts by material ──────────────────────────────────────────────────────
let lastHit = 0;
export function knock(kind: string, strength: number) { // non-breaking bump, rate-limited
  if (!ok()) return; const t = now(); if (t - lastHit < 0.06) return; lastHit = t; const v = Math.min(1, strength / 10) * 0.18;
  if (kind === 'stone') { tone(t, 'sine', 110, 60, 0.15, v); noiseBurst(t, 0.08, 'lowpass', 600, 0.7, v * 0.6); }
  else if (kind === 'picado') noiseBurst(t, 0.06, 'highpass', 3000, 0.7, v * 0.6);
  else { tone(t, 'triangle', 240, 140, 0.08, v); noiseBurst(t, 0.05, 'bandpass', 1400, 3, v * 0.7); }
}
export function breakWood() {
  if (!ok()) return; const t = now(); duck(0.5, 0.3);
  tone(t, 'sine', 180, 70, 0.18, 0.25);
  for (let i = 0; i < 5; i++) noiseBurst(t + i * 0.025 + Math.random() * 0.02, 0.05 + Math.random() * 0.05, 'bandpass', 900 + Math.random() * 1800, 4, 0.3); // crack + splinters
}
export function breakStone() {
  if (!ok()) return; const t = now(); duck(0.45, 0.45);
  tone(t, 'sine', 85, 38, 0.35, 0.45); noiseBurst(t, 0.12, 'lowpass', 900, 0.8, 0.35);
  for (let i = 0; i < 6; i++) noiseBurst(t + 0.06 + i * 0.05, 0.1, 'lowpass', 500 + Math.random() * 600, 1, 0.12); // crumble
}
export function ripPaper() {
  if (!ok()) return; const t = now();
  for (let i = 0; i < 7; i++) noiseBurst(t + i * 0.022, 0.03, 'highpass', 2500 + Math.random() * 3000, 1.5, 0.12 + Math.random() * 0.08);
}
function ay(t: number, pitch: number, peak: number) { // formant "ay!" (ah → ee)
  const o = ctx!.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch * 1.25, t); o.frequency.exponentialRampToValueAtTime(pitch * 0.8, t + 0.45);
  const g = ctx!.createGain(); env(g, t, peak, 0.03, 0.45);
  for (const [a, b] of [[800, 300], [1250, 2300]]) { const f = ctx!.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 7; f.frequency.setValueAtTime(a, t); f.frequency.linearRampToValueAtTime(b, t + 0.35); o.connect(f).connect(g); }
  g.connect(sfx); o.start(t); o.stop(t + 0.6);
}
export function knockout() {
  if (!ok()) return; const t = now(); duck(0.25, 0.9);
  noiseBurst(t, 0.45, 'lowpass', 2500, 0.8, 0.35, sfx, 200); tone(t, 'sine', 140, 45, 0.4, 0.4); // poof/boom
  ay(t + 0.06, 300, 0.22); ay(t + 0.1, 240, 0.12); ay(t + 0.14, 380, 0.09); // little crowd "ay!"
}
export function explosion() {
  if (!ok()) return; const t = now(); duck(0.15, 1.2);
  noiseBurst(t, 1.1, 'lowpass', 1400, 0.7, 0.55, sfx, 90); tone(t, 'sine', 90, 30, 0.9, 0.55);
  noiseBurst(t + 0.05, 0.25, 'bandpass', 3000, 1, 0.15);
}

// ── music: quiet A-minor marimba + bells + wind, scheduled ahead ─────────────
let musicOn = false, nextT = 0, step = 0, windSrc: AudioBufferSourceNode | null = null;
const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [[57, 60, 64], [53, 57, 60], [52, 56, 59], [57, 60, 64], [50, 53, 57], [53, 57, 60], [52, 56, 59], [52, 56, 59]]; // Am F E Am Dm F E E (harmonic minor)
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
function marimba(t: number, f: number, v: number) { tone(t, 'sine', f, f * 0.995, 0.45, v, music, 0.003); tone(t, 'sine', f * 4, f * 4, 0.08, v * 0.25, music, 0.002); }
function bell(t: number, f: number, v: number) { tone(t, 'triangle', f, f, 2.4, v, music, 0.005); tone(t, 'sine', f * 2.76, f * 2.76, 1.2, v * 0.3, music, 0.005); }
function schedule() {
  if (!musicOn || !ctx) return; const spb = 60 / 72 / 2; // eighth notes at 72 bpm
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8) % CHORDS.length, i = step % 8, ch = CHORDS[bar];
    marimba(nextT, NOTE(ch[ARP[i]] + 12), i === 0 ? 0.32 : 0.2);
    if (i === 0) tone(nextT, 'sine', NOTE(ch[0] - 12), NOTE(ch[0] - 12), 1.6, 0.28, music, 0.02);
    if (i === 4 && Math.random() < 0.4) bell(nextT, NOTE(ch[Math.floor(Math.random() * 3)] + 24), 0.07);
    nextT += spb; step++;
  }
}
export function startMusic() {
  if (!ok() || musicOn) return; musicOn = true; nextT = ctx!.currentTime + 0.1; step = 0;
  setInterval(schedule, 120);
  // wind: looped noise through a slowly wandering band-pass
  windSrc = ctx!.createBufferSource(); windSrc.buffer = noise; windSrc.loop = true;
  const f = ctx!.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.value = 500;
  const lfo = ctx!.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx!.createGain(); lg.gain.value = 300; lfo.connect(lg).connect(f.frequency);
  const g = ctx!.createGain(); g.gain.value = 0.18; windSrc.connect(f).connect(g).connect(music); windSrc.start(); lfo.start();
}

export function wireMute(btn: HTMLButtonElement) {
  const draw = () => (btn.textContent = muted ? '🔇' : '🔊');
  btn.onclick = (e) => { e.stopPropagation(); unlock(); setMuted(!muted); draw(); }; draw();
}
// iOS: unlock on the first gesture anywhere.
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
(window as any).__flingAudio = { get state() { return ctx?.state; }, get gain() { return ctx ? master.gain.value : null; }, get played() { return soundsPlayed; }, get session() { return (navigator as any).audioSession?.type ?? 'n/a'; }, get musicOn() { return musicOn; }, get muted() { return muted; } };
