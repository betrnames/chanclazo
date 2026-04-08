// ─── Chanclazo Sound Engine (Web Audio API — zero files needed) ───────────────
// All sounds are synthesized procedurally. Call initAudio() once on first user
// interaction, then call the individual play* functions anywhere in the engine.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initAudio(): void {
  if (ctx) return; // already initialized
  try {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

// ─── Low-level helpers ────────────────────────────────────────────────────────
function getCtx(): AudioContext | null {
  if (!ctx || muted) return null;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function connect(node: AudioNode): void {
  if (masterGain) node.connect(masterGain);
}

function osc(
  frequency: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  gainPeak: number,
  freqEnd?: number,
): void {
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(frequency, startTime);
  if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
  g.gain.setValueAtTime(gainPeak, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  o.connect(g); connect(g);
  o.start(startTime); o.stop(startTime + duration + 0.01);
}

function noise(startTime: number, duration: number, gainPeak: number, lowpass = 3000): void {
  const c = getCtx(); if (!c) return;
  const bufLen = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.setValueAtTime(gainPeak, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.connect(filt); filt.connect(g); connect(g);
  src.start(startTime); src.stop(startTime + duration + 0.01);
}

// ─── 1. Chancla Whoosh — called when mom throws ───────────────────────────────
export function playWhoosh(speed = 1.0): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  // Descending noise sweep — like something cutting through air
  noise(t, 0.18, 0.28 * speed, 2200);
  osc(380, 'sine', t, 0.15, 0.12, 120);
}

// ─── 2. Hit Smack — chancla connects with player ─────────────────────────────
export function playHit(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  // Meaty low thud + sharp crack
  osc(140, 'sine', t, 0.12, 0.55, 40);       // low thud body
  osc(900, 'square', t, 0.04, 0.30, 200);    // sharp slap crack
  noise(t, 0.10, 0.45, 4000);                 // skin impact noise
  // Pain sting — quick rising whine
  osc(480, 'sine', t + 0.03, 0.12, 0.18, 780);
}

// ─── 3. Strike Back — player smacks chancla back ─────────────────────────────
export function playStrike(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  // Satisfying power hit: deep punch + rising power tone
  osc(200, 'sine', t, 0.08, 0.6, 60);        // punch
  osc(600, 'sawtooth', t, 0.06, 0.35, 1200); // rising power
  noise(t, 0.08, 0.5, 5000);
  osc(220, 'sine', t + 0.07, 0.18, 0.25, 440); // reverb tail
}

// ─── 4. Mom Hit — struck-back chancla hits mom ────────────────────────────────
export function playMomHit(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  // Grunt impact — bassy thump + feminine yelp frequency
  osc(100, 'sine', t, 0.15, 0.7, 35);        // deep thump
  osc(700, 'sine', t, 0.08, 0.4, 350);       // yelp descend
  noise(t, 0.12, 0.35, 2500);
}

// ─── 5. Dodge — chancla flies past ────────────────────────────────────────────
export function playDodge(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  // Quick Doppler-like whoosh passing by
  osc(600, 'sine', t, 0.10, 0.15, 180);
  noise(t, 0.09, 0.12, 1800);
}

// ─── 6. Jump ──────────────────────────────────────────────────────────────────
export function playJump(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  osc(220, 'sine', t, 0.10, 0.18, 420);
}

// ─── 7. Level Up / Victory stinger ───────────────────────────────────────────
export function playLevelUp(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((freq, i) => {
    osc(freq, 'sine', t + i * 0.10, 0.18, 0.3);
  });
}

// ─── 8. Game Over stinger ─────────────────────────────────────────────────────
export function playGameOver(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  osc(440, 'sine', t, 0.25, 0.4, 220);
  osc(330, 'sine', t + 0.15, 0.25, 0.35, 165);
  osc(220, 'sine', t + 0.30, 0.40, 0.3, 110);
}

// ─── 9. Shield activate ───────────────────────────────────────────────────────
export function playShield(): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  osc(880, 'sine', t, 0.20, 0.25, 1320);
  osc(660, 'sine', t + 0.05, 0.20, 0.15, 990);
}

// ─── 10. Combo hit ────────────────────────────────────────────────────────────
export function playCombo(comboCount: number): void {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const freq = 440 + comboCount * 80;
  osc(freq, 'sine', t, 0.12, 0.35, freq * 1.5);
  osc(freq * 1.5, 'triangle', t + 0.03, 0.10, 0.2);
}
