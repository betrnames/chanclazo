// Shared game music + Music/SFX switches (saved in localStorage, shared across all games).
// The music is an original, code-generated ranchera-style loop (3/4 oom-pah-pah with a marimba melody).
const MK = 'chanclazo_music', SK = 'chanclazo_sfx';
const get = (k: string) => { try { return localStorage.getItem(k) !== '0'; } catch { return true; } };
const put = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* private mode */ } };
export const musicOn = () => get(MK);
export const sfxOn = () => get(SK);

type Variant = { bpm: number; key: number; seed: number };
const VARIANTS: Record<string, Variant> = { slots: { bpm: 150, key: 0, seed: 1 }, match: { bpm: 138, key: 5, seed: 2 }, fling: { bpm: 162, key: 7, seed: 3 } };
let ctx: AudioContext | null = null, out: GainNode, started = false, timer = 0, nextT = 0, step = 0, v: Variant = VARIANTS.slots;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// I - IV - V7 - I progression (major), root offsets from key, 4 bars each loop of 16 bars with a turnaround.
const PROG = [0, 0, 5, 5, 7, 7, 0, 0, 0, 0, 5, 5, 7, 7, 7, 0];
const MEL = [ // scale degrees per beat (3 beats per bar); -1 = rest. Original pattern.
  [4, 2, 4], [7, -1, 4], [5, 4, 2], [0, -1, -1], [6, 5, 4], [2, -1, 4], [4, 2, 0], [0, -1, -1],
  [7, 9, 7], [4, -1, 2], [5, 7, 5], [2, -1, 0], [6, 7, 9], [11, 9, 7], [5, 4, 2], [0, -1, -1]];

function note(t: number, f: number, dur: number, vol: number, type: OscillatorType) {
  const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function schedule() {
  if (!ctx) return;
  const spb = 60 / v.bpm;
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 3) % PROG.length, beat = step % 3, root = 48 + v.key + PROG[bar];
    const chord = PROG[bar] === 7 ? [0, 4, 7, 10] : [0, 4, 7];
    if (beat === 0) note(nextT, hz(root - 12 + (bar % 2 ? 7 : 0)), spb * 0.9, 0.5, 'triangle'); // oom (alternating bass)
    else for (const c of chord.slice(0, 3)) note(nextT, hz(root + 12 + c), spb * 0.35, 0.12, 'square'); // pah
    const d = MEL[(bar + v.seed * 4) % MEL.length][beat];
    if (d >= 0) { const sc = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19]; note(nextT, hz(60 + v.key + sc[d]), spb * 0.8, 0.28, 'sine'); note(nextT, hz(72 + v.key + sc[d]), spb * 0.3, 0.06, 'sine'); }
    nextT += spb; step++;
  }
}
function start() {
  if (started || !musicOn()) return;
  try { ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return; }
  out = out || (() => { const g = ctx!.createGain(); g.gain.value = 0.07; g.connect(ctx!.destination); return g; })(); // low, under the SFX
  ctx.resume(); started = true; nextT = ctx.currentTime + 0.1; timer = window.setInterval(schedule, 100);
}
function stop() { started = false; clearInterval(timer); ctx?.suspend(); }

/** SFX tap blip for games that lack one (respects the SFX switch). */
export function tapBlip(freq = 660) {
  if (!sfxOn()) return;
  try { ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)(); ctx.resume(); } catch { return; }
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.06);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.12);
}

/**
 * Turn the game's existing #mute button into the SFX switch and add a Music switch next to it.
 * setSfxMuted is the game's own mute function, so every existing sound follows the SFX switch.
 */
export function initAudioControls(game: keyof typeof VARIANTS, setSfxMuted: (m: boolean) => void) {
  v = VARIANTS[game];
  setSfxMuted(!sfxOn());
  const sfx = document.getElementById('mute') as HTMLButtonElement | null;
  const mus = document.createElement('button'); mus.id = 'music'; mus.type = 'button';
  if (sfx) { sfx.className = (sfx.className + ' audio-btn').trim(); mus.className = sfx.className; sfx.parentElement!.insertBefore(mus, sfx); }
  const draw = () => {
    mus.textContent = musicOn() ? '🎵 Music' : '🎵 Off'; mus.setAttribute('aria-pressed', String(musicOn())); mus.setAttribute('aria-label', 'Music on or off');
    if (sfx) { sfx.textContent = sfxOn() ? '🔊 SFX' : '🔇 SFX'; sfx.setAttribute('aria-pressed', String(sfxOn())); sfx.setAttribute('aria-label', 'Sound effects on or off'); }
    document.querySelectorAll<HTMLElement>('[data-audio="music"]').forEach((b) => (b.textContent = musicOn() ? 'Music: on' : 'Music: off'));
    document.querySelectorAll<HTMLElement>('[data-audio="sfx"]').forEach((b) => (b.textContent = sfxOn() ? 'SFX: on' : 'SFX: off'));
  };
  const toggleMusic = (e?: Event) => { e?.stopPropagation(); put(MK, !musicOn()); if (musicOn()) start(); else stop(); draw(); };
  const toggleSfx = (e?: Event) => { e?.stopPropagation(); put(SK, !sfxOn()); setSfxMuted(!sfxOn()); draw(); };
  mus.onclick = toggleMusic;
  if (sfx) { sfx.onclick = toggleSfx; new MutationObserver(() => { const want = sfxOn() ? '🔊 SFX' : '🔇 SFX'; if (sfx.textContent !== want) draw(); }).observe(sfx, { childList: true, characterData: true, subtree: true }); }
  document.querySelectorAll<HTMLElement>('[data-audio="music"]').forEach((b) => (b.onclick = toggleMusic));
  document.querySelectorAll<HTMLElement>('[data-audio="sfx"]').forEach((b) => (b.onclick = toggleSfx));
  const css = document.createElement('style');
  css.textContent = `button.audio-btn{width:auto!important;border-radius:12px!important;padding:6px 10px!important;font-size:13px!important;font-weight:800;white-space:nowrap}`;
  document.head.appendChild(css);
  draw();
  const first = () => { start(); removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); };
  addEventListener('pointerdown', first, true); addEventListener('keydown', first, true);
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) { clearInterval(timer); ctx.suspend(); } else if (started && musicOn()) { ctx.resume(); nextT = ctx.currentTime + 0.1; clearInterval(timer); timer = window.setInterval(schedule, 100); } });
  (window as any).__audio = { get music() { return musicOn(); }, get sfx() { return sfxOn(); }, get playing() { return started && ctx?.state === 'running'; } };
}
