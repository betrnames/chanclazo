// ─── Chanclazo Sound Engine (Web Audio API — zero files needed) ───────────────
// All sounds are synthesized procedurally. Call initAudio() once on first user
// interaction, then call the individual play* functions anywhere in the engine.
// Mobile note: AudioContext requires a user gesture (tap/click) to start.
// We also attach a global touchstart listener as a safety net for iOS Safari.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let unlocked = false;

// ─── iOS Safari unlock helper ─────────────────────────────────────────────────
// iOS suspends AudioContext even after creation. We play a silent buffer on
// the first touch to force it into 'running' state.
function unlockAudio(): void {
  if (unlocked || !ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => { unlocked = true; });
  }
  // Play a zero-length silent buffer — forces iOS to unlock
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    src.stop(0.001);
    unlocked = true;
  } catch { /* ignore */ }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initAudio(): void {
  if (ctx) {
    // Already created — just make sure it's running (iOS may have suspended it)
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    // Use prefixed version for older iOS Safari
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);

    // Attach global touch/click listeners as safety net for iOS Safari
    const unlock = () => {
      unlockAudio();
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
    };
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('touchend', unlock, true);
    document.addEventListener('click', unlock, true);

    // Try to resume immediately if context starts suspended
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

// ─── Low-level helpers ────────────────────────────────────────────────────────
function getCtx(): AudioContext | null {
  if (!ctx || muted) return null;
  // Always try to resume — iOS Safari suspends frequently
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BACKGROUND MUSIC ENGINE ─────────────────────────────────────────────────
// Procedural Latin-flavored loop: reggaeton-ish dembow beat, syncopated bass,
// melodic hooks, and a cumbia-style güira shimmer. Intensity scales 1–5.
// Zero files — pure Web Audio synthesis.
// ═══════════════════════════════════════════════════════════════════════════════

let musicPlaying = false;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicIntensity = 1; // 1–5, set externally
let musicBPM = 95;
let loopCount = 0;

// ─── Note helpers ─────────────────────────────────────────────────────────────
const NOTE = (semi: number) => 110 * Math.pow(2, semi / 12); // A2 = 110 Hz base

// Reggaeton / Latin scale — A minor pentatonic + blues note
// A2 C3 D3 Eb3 E3 G3 A3 C4 D4 E4 G4 A4
const BASS_NOTES = [NOTE(0), NOTE(3), NOTE(5), NOTE(7), NOTE(10), NOTE(12)]; // A C D E G A
const MELODY_NOTES = [
  NOTE(12), NOTE(15), NOTE(17), NOTE(19), NOTE(22), NOTE(24), // A3–A4
  NOTE(26), NOTE(27), NOTE(29), NOTE(31), NOTE(34),           // higher ornaments
];

// ─── Dembow rhythm pattern (16th notes per beat, 4 beats) ─────────────────────
// Classic dembow: kick on 1, snare on 2-and, kick 3, snare 4-and
// 16 slots = 4 beats × 4 sixteenths
const KICK_PATTERN  = [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0]; // boom--boom---
const SNARE_PATTERN = [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1]; // ----clap----clap
const HAT_PATTERN   = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]; // steady 8ths
const GUIRA_PATTERN = [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1]; // offbeat shimmer

// ─── Synth percussion ─────────────────────────────────────────────────────────
function playKick(time: number, vol: number): void {
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, time);
  o.frequency.exponentialRampToValueAtTime(35, time + 0.12);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  o.connect(g); connect(g);
  o.start(time); o.stop(time + 0.22);
  // Click transient
  noise(time, 0.015, vol * 0.4, 6000);
}

function playSnare(time: number, vol: number): void {
  const c = getCtx(); if (!c) return;
  // Noise body
  noise(time, 0.1, vol * 0.6, 5500);
  // Tonal ping
  osc(220, 'triangle', time, 0.05, vol * 0.3, 120);
}

function playHiHat(time: number, vol: number, open = false): void {
  const c = getCtx(); if (!c) return;
  const dur = open ? 0.12 : 0.04;
  noise(time, dur, vol * 0.2, open ? 9000 : 12000);
}

function playGuira(time: number, vol: number): void {
  // Güira / shaker — high metallic shimmer
  const c = getCtx(); if (!c) return;
  noise(time, 0.03, vol * 0.12, 14000);
  osc(8000, 'square', time, 0.02, vol * 0.04, 12000);
}

// ─── Bass synth ───────────────────────────────────────────────────────────────
function playBass(time: number, freq: number, dur: number, vol: number): void {
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  // Sub + slightly detuned square for grit
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, time);
  o2.type = 'square';
  o2.frequency.setValueAtTime(freq * 1.002, time); // slight detune
  const g2 = c.createGain();
  g2.gain.value = 0.15; // square much quieter
  g.gain.setValueAtTime(vol, time);
  g.gain.setValueAtTime(vol * 0.8, time + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(g); connect(g);
  o2.connect(g2); g2.connect(g); // route square through same gain
  o.start(time); o.stop(time + dur + 0.01);
  o2.start(time); o2.stop(time + dur + 0.01);
}

// ─── Melody synth (plucky, slightly resonant) ─────────────────────────────────
function playMelody(time: number, freq: number, dur: number, vol: number): void {
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const filt = c.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, time);
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(freq * 4, time);
  filt.frequency.exponentialRampToValueAtTime(freq * 1.2, time + dur * 0.8);
  filt.Q.value = 3;
  g.gain.setValueAtTime(vol, time);
  g.gain.setValueAtTime(vol * 0.5, time + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(filt); filt.connect(g); connect(g);
  o.start(time); o.stop(time + dur + 0.01);
}

// ─── Bass patterns (syncopated, one per bar) ──────────────────────────────────
// Each pattern is an array of [16th-note slot, note index, duration in 16ths]
type BassHit = [number, number, number]; // [slot, noteIdx, durSlots]
const BASS_PATTERNS: BassHit[][] = [
  // Pattern A: root groove
  [[0,0,3], [4,2,2], [8,0,3], [13,4,2]],
  // Pattern B: climbing
  [[0,0,2], [3,1,2], [6,2,2], [10,3,3], [14,4,2]],
  // Pattern C: syncopated bounce
  [[0,0,2], [3,0,1], [6,2,3], [10,4,2], [14,3,2]],
  // Pattern D: minimal (low intensity)
  [[0,0,4], [8,0,4]],
];

// ─── Melody phrases (short 1-bar riffs) ───────────────────────────────────────
type MelodyHit = [number, number, number]; // [slot, noteIdx, durSlots]
const MELODY_PHRASES: MelodyHit[][] = [
  // Phrase A: descending hook
  [[0,4,2], [2,3,2], [4,2,2], [8,1,2], [12,0,4]],
  // Phrase B: call & response
  [[0,5,2], [3,4,1], [8,2,2], [11,3,1], [14,5,2]],
  // Phrase C: rhythmic stab
  [[0,6,1], [2,6,1], [4,4,2], [8,6,1], [10,6,1], [12,3,4]],
  // Phrase D: sparse (low intensity)
  [[0,4,4], [8,2,4]],
  // Phrase E: soaring
  [[0,3,2], [4,5,2], [8,7,2], [12,8,4]],
];

// ─── Schedule one bar ─────────────────────────────────────────────────────────
function scheduleBar(): void {
  const c = getCtx(); if (!c) return;
  if (!musicPlaying) return;

  const now = c.currentTime + 0.05; // small lookahead
  const beatDur = 60 / musicBPM;
  const sixteenthDur = beatDur / 4;
  const barDur = beatDur * 4;

  const vol = 0.3 + musicIntensity * 0.06; // 0.36 – 0.60
  const drumVol = vol * (0.5 + musicIntensity * 0.1);

  // ── Drums ───────────────────────────────────────────────────────────────
  for (let i = 0; i < 16; i++) {
    const t = now + i * sixteenthDur;
    if (KICK_PATTERN[i])  playKick(t, drumVol);
    if (SNARE_PATTERN[i]) playSnare(t, drumVol * 0.8);
    if (HAT_PATTERN[i])   playHiHat(t, drumVol, i % 8 === 6); // open hat on "and of 2" and "and of 4"
    if (GUIRA_PATTERN[i] && musicIntensity >= 2) playGuira(t, drumVol);
  }

  // ── Extra percussion at higher intensity ────────────────────────────────
  if (musicIntensity >= 3) {
    // Syncopated rimshot ghost notes
    const rimSlots = [3, 7, 11, 15];
    for (const slot of rimSlots) {
      if (Math.random() < 0.5) {
        osc(1200, 'square', now + slot * sixteenthDur, 0.02, drumVol * 0.15, 800);
      }
    }
  }

  if (musicIntensity >= 4) {
    // Timbale-like fills on beat 4
    osc(900, 'square', now + 12 * sixteenthDur, 0.04, drumVol * 0.25, 600);
    osc(1100, 'square', now + 13 * sixteenthDur, 0.04, drumVol * 0.2, 700);
    if (loopCount % 4 === 3) {
      // Every 4th bar: fill across beat 4
      osc(800, 'square', now + 14 * sixteenthDur, 0.03, drumVol * 0.25, 500);
      osc(1000, 'square', now + 15 * sixteenthDur, 0.03, drumVol * 0.25, 600);
    }
  }

  // ── Bass ────────────────────────────────────────────────────────────────
  const bassIdx = musicIntensity <= 1
    ? 3 // minimal pattern for low intensity
    : (loopCount % (BASS_PATTERNS.length - 1)); // cycle A, B, C
  const bassPattern = BASS_PATTERNS[bassIdx];
  const bassVol = vol * 0.5;

  for (const [slot, noteIdx, durSlots] of bassPattern) {
    const note = BASS_NOTES[noteIdx % BASS_NOTES.length];
    playBass(now + slot * sixteenthDur, note, durSlots * sixteenthDur, bassVol);
  }

  // ── Melody (only at intensity 2+) ───────────────────────────────────────
  if (musicIntensity >= 2) {
    const melIdx = musicIntensity <= 2
      ? 3 // sparse phrase
      : (loopCount % (MELODY_PHRASES.length - 1));
    const melPhrase = MELODY_PHRASES[melIdx];
    const melVol = vol * (0.12 + musicIntensity * 0.04); // subtle at first, brighter later

    for (const [slot, noteIdx, durSlots] of melPhrase) {
      const note = MELODY_NOTES[noteIdx % MELODY_NOTES.length];
      playMelody(now + slot * sixteenthDur, note, durSlots * sixteenthDur, melVol);
    }
  }

  // ── Accent chord stab on beat 1 at intensity 5 ─────────────────────────
  if (musicIntensity >= 5 && loopCount % 2 === 0) {
    const chordNotes = [NOTE(12), NOTE(15), NOTE(19)]; // A minor triad
    for (const n of chordNotes) {
      playMelody(now, n, beatDur * 0.8, vol * 0.15);
    }
  }

  loopCount++;

  // ── Schedule next bar ───────────────────────────────────────────────────
  // Use setTimeout for scheduling; the actual audio is sample-accurate via
  // Web Audio's time parameter.
  musicTimer = setTimeout(scheduleBar, barDur * 1000 * 0.9); // overlap slightly
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startMusic(): void {
  if (musicPlaying) return;
  const c = getCtx(); if (!c) return;
  musicPlaying = true;
  loopCount = 0;
  scheduleBar();
}

export function stopMusic(): void {
  musicPlaying = false;
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

/** Set music intensity 1–5. Higher = more layers, faster feel. */
export function setMusicIntensity(level: number): void {
  musicIntensity = Math.max(1, Math.min(5, Math.round(level)));
  // Subtly increase BPM with intensity
  musicBPM = 92 + musicIntensity * 3; // 95 → 107
}

export function isMusicPlaying(): boolean { return musicPlaying; }
