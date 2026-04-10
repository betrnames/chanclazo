import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { GamePhase, Lang, CharacterGender } from './game/types';
import { LEVELS } from './game/types';
import { createGame } from './game/engine';
import type { GameInstance } from './game/types';
import { getTexts } from './game/i18n';
import { initAudio } from './game/sound';
import { createTouchState } from './game/controls';
import type { TouchInputState } from './game/controls';
import MobileTouchControls from './components/MobileTouchControls';
import { submitScore, fetchLeaderboard, pingPresence, leavePresence } from './api';
import type { LeaderboardEntry } from './api';
import LorePage from './LorePage';

// Route to lore page if on /lore
if (typeof window !== 'undefined' && window.location.pathname === '/lore') {
  // handled below in default export
}

const isMobileDevice = () =>
  'ontouchstart' in window || navigator.maxTouchPoints > 0;

interface PopupEntry {
  id: number;
  text: string;
  top: number;
  left: number;
}

let popupCounter = 0;

// ─── Level color palettes for screens ────────────────────────────────────────
const LEVEL_BG_GRADIENTS = [
  'linear-gradient(135deg, #FFD580 0%, #FFAA44 50%, #FF8C42 100%)',
  'linear-gradient(135deg, #FFBB55 0%, #FF9933 50%, #FF7722 100%)',
  'linear-gradient(135deg, #FF9944 0%, #FF6622 50%, #EE4411 100%)',
  'linear-gradient(135deg, #FF7733 0%, #EE3311 50%, #CC1100 100%)',
  'linear-gradient(135deg, #CC2200 0%, #991100 50%, #660000 100%)',
];

const LEVEL_ACCENT_CLASSES = [
  'text-orange-700',
  'text-orange-800',
  'text-red-700',
  'text-red-800',
  'text-red-900',
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  if (window.location.pathname === '/lore') return <LorePage />;
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const langRef = useRef<Lang>(
    (localStorage.getItem('chanclazo-lang') as Lang) ?? 'en'
  );
  const touchStateRef = useRef<TouchInputState>(createTouchState());
  const [isMobile] = useState(() => isMobileDevice());
  const [canStrike, setCanStrike] = useState(false);
  const sessionId = useRef<string>(Math.random().toString(36).slice(2));
  const [playerCount, setPlayerCount] = useState(0);

  const [phase, setPhase] = useState<GamePhase>('start');
  const [gender, setGender] = useState<CharacterGender>('boy');
  const [handle, setHandle] = useState<string>(() => localStorage.getItem('chanclazo-handle') ?? '');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [, setSubmitting] = useState(false);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('chanclazo-highscore') ?? '0', 10);
  });
  const [webglError, setWebglError] = useState(false);
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('chanclazo-lang') as Lang) ?? 'en'
  );
  const [currentLevel, setCurrentLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [survivalSeconds, setSurvivalSeconds] = useState(0);
  const [health, setHealth] = useState(3);
  const [shielded, setShielded] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalSurvival, setFinalSurvival] = useState(0);
  const [levelCompleteData, setLevelCompleteData] = useState({ level: 1, score: 0, timeBonus: 0 });
  const [popups, setPopups] = useState<PopupEntry[]>([]);

  const texts = getTexts(lang);
  const levelConfig = LEVELS[currentLevel - 1];

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    langRef.current = l;
    localStorage.setItem('chanclazo-lang', l);
  }, []);

  // ── Game Callbacks ────────────────────────────────────────────────────────
  const onScoreUpdate = useCallback((s: number, c: number, t: number, h: number, sh: boolean) => {
    setScore(s);
    setCombo(c);
    setSurvivalSeconds(t);
    setHealth(h);
    setShielded(sh);
  }, []);

  const onPopup = useCallback((text: string) => {
    const id = ++popupCounter;
    const top = 20 + Math.random() * 35;
    const left = 25 + Math.random() * 50;
    setPopups((prev) => [...prev.slice(-6), { id, text, top, left }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1700);
  }, []);

  const onGameOver = useCallback((s: number, totalSec: number) => {
    setFinalScore(s);
    setFinalSurvival(totalSec);
    setHighScore(prev => {
      const next = Math.max(prev, s);
      localStorage.setItem('chanclazo-highscore', String(next));
      return next;
    });
    setPhase('gameover');
    if (handle.trim()) {
      setSubmitting(true);
      submitScore(handle.trim(), s, 1).finally(() => setSubmitting(false));
    }
  }, [handle]);

  const onLevelComplete = useCallback((level: number, s: number, timeBonus: number) => {
    setFinalScore(s);
    setLevelCompleteData({ level, score: s, timeBonus });
    setHighScore(prev => {
      const next = Math.max(prev, s);
      localStorage.setItem('chanclazo-highscore', String(next));
      return next;
    });
    setPhase('level_complete');
  }, []);

  const onVictory = useCallback((s: number, totalSec: number) => {
    setFinalScore(s);
    setFinalSurvival(totalSec);
    setHighScore(prev => {
      const next = Math.max(prev, s);
      localStorage.setItem('chanclazo-highscore', String(next));
      return next;
    });
    setPhase('victory');
    if (handle.trim()) {
      setSubmitting(true);
      submitScore(handle.trim(), s, 5).finally(() => setSubmitting(false));
    }
  }, [handle]);

  const onStrikeAvailable = useCallback((available: boolean) => {
    setCanStrike(available);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const data = await fetchLeaderboard();
    setLeaderboard(data);
    setShowLeaderboard(true);
  }, []);

  const getLang = useCallback((): Lang => langRef.current, []);

  // ── Presence heartbeat — ping every 15s, leave on unmount ─────────────────
  useEffect(() => {
    const sid = sessionId.current;
    pingPresence(sid).then(setPlayerCount);
    const interval = setInterval(() => pingPresence(sid).then(setPlayerCount), 15000);
    const onUnload = () => leavePresence(sid);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
      leavePresence(sid);
    };
  }, []);

  // ── Fetch ghosts when a level starts ──────────────────────────────────────
  useEffect(() => {
    // ghosts are loaded directly inside engine.ts
  }, [phase, currentLevel]);

  // ── Start level ───────────────────────────────────────────────────────────
  const startLevel = useCallback((level: number) => {
    setCurrentLevel(level);
    setScore(0);
    setCombo(0);
    setSurvivalSeconds(0);
    setHealth(3);
    setShielded(false);
    setPopups([]);
    setPhase('playing');
  }, []);

  // ── Engine lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!containerRef.current) return;

    gameRef.current?.destroy();

    let instance: GameInstance;
    try {
      instance = createGame(containerRef.current, {
        onScoreUpdate,
        onPopup,
        onGameOver,
        onLevelComplete,
        onVictory,
        getLang,
        onStrikeAvailable,
      }, currentLevel, touchStateRef.current, gender);
    } catch {
      setWebglError(true);
      setPhase('start');
      return;
    }
    gameRef.current = instance;
    instance.start();

    return () => { instance.destroy(); gameRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ── Level progress bar value ───────────────────────────────────────────────
  const levelProgress = Math.min(100, (survivalSeconds / levelConfig.surviveSecs) * 100);

  // ── Language toggle ────────────────────────────────────────────────────────
  const LangToggle = ({ dark = false }: { dark?: boolean }) => (
    <div className="absolute top-3 right-3 z-50 flex gap-1">
      {(['en', 'es'] as const).map((l) => (
        <Button
          key={l}
          size="sm"
          variant={lang === l ? 'default' : 'outline'}
          className={`text-xs font-black px-2.5 py-1 h-7 ${
            lang === l
              ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
              : dark
                ? 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                : 'border-orange-300 text-orange-700 hover:bg-orange-50'
          }`}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-amber-50">

      {/* Three.js canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ display: phase === 'playing' ? 'block' : 'none' }}
        onClick={() => gameRef.current?.triggerStrike()}
      />

      {/* ════════════════════════════════════════════════════════════════
          START SCREEN — Hero title card
      ════════════════════════════════════════════════════════════════ */}
      {phase === 'start' && (
        <div className="absolute inset-0 overflow-y-auto bg-amber-50">
          <div className="min-h-full" style={{ background: LEVEL_BG_GRADIENTS[0] }}>
          <img src="/hero5.jpg" alt="" aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center opacity-30 mix-blend-multiply" />
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, #b5704a 0, #b5704a 1px, transparent 0, transparent 30px),' +
                'repeating-linear-gradient(90deg, #b5704a 0, #b5704a 1px, transparent 0, transparent 30px)',
              backgroundSize: '30px 30px',
            }} />

          <LangToggle />

          {/* ── Scroll content ── */}
          <div className="relative z-10 min-h-full flex flex-col items-center justify-between px-3 py-6">

            {/* ── Body ── */}
            <div className="w-full max-w-sm flex flex-col gap-1 flex-1 justify-center">

            {/* Logo + Title */}
            <div className="text-center flex flex-col items-center gap-0">
              <img src="/logo_chancla.png" alt="Chanclazo logo"
                className="w-20 h-20 md:w-24 md:h-24 object-contain"
                style={{
                  filter: 'drop-shadow(0px 3px 6px rgba(0,0,0,0.5))',
                  animation: 'floatLogo 2.5s ease-in-out infinite',
                }} />
              <h1 className="text-4xl font-black tracking-tight text-white leading-none"
                style={{ textShadow: '3px 4px 0 rgba(0,0,0,0.3)' }}>
                CHANCLAZO
              </h1>
              <p className="text-xs font-bold text-white/90">{texts.ui.subtitle}</p>
              <p className="text-xs text-white/65 italic">{texts.ui.tagline}</p>
            </div>

            {/* Card */}
            <Card className="border-2 border-orange-300/60 shadow-2xl bg-amber-50/95 backdrop-blur-sm">
              <CardContent className="pt-2 pb-2 space-y-1.5">

                {/* Level pills */}
                <div className="space-y-1">
                  <p className="font-black text-orange-700 text-xs text-center">Levels</p>
                  <div className="grid grid-cols-5 gap-1">
                  {[['1','Irritated'],['2','Angry'],['3','Furious'],['4','Raging'],['5','Final Boss']].map(([num, name]) => (
                    <div key={num} className="rounded-md p-1 text-center border border-orange-200 bg-orange-50">
                      <div className="text-sm font-black text-orange-700">{num}</div>
                      <div className="text-[8px] font-bold text-orange-600 leading-tight">{name}</div>
                    </div>
                  ))}
                  </div>
                </div>

                {/* Controls */}
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 space-y-1">
                  <p className="font-black text-orange-700 text-xs text-center">{texts.ui.howToPlay}</p>
                  {isMobile ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        ['← →', texts.ui.move],
                        ['↑', texts.ui.jump],
                        ['↓', texts.ui.duck],
                        ['⚡', texts.ui.strike],
                      ].map(([arrow, label]) => (
                        <div key={label} className="flex flex-col items-center gap-0.5 bg-orange-100 rounded-lg py-3 px-2">
                          <span className="text-xs font-black text-orange-700 text-center leading-tight">{arrow}</span>
                          <span className="text-[10px] font-medium text-orange-600 text-center leading-tight">{label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        ['A / D', texts.ui.move],
                        ['W / ↑', texts.ui.jump],
                        ['S / ↓', texts.ui.duck],
                        ['SPACE', texts.ui.strike],
                      ].map(([key, label]) => (
                        <div key={key} className="flex flex-col items-center gap-1 bg-orange-100 rounded-lg py-1.5 px-1">
                          <span className="text-xs font-black text-orange-700 text-center leading-tight">{key}</span>
                          <span className="text-[10px] font-medium text-orange-600 text-center leading-tight">{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-center text-[10px] font-semibold text-orange-600 pt-1">{texts.ui.ringHint}</p>
                </div>



                {webglError && (
                  <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 text-center">
                    <p className="text-xs font-black text-destructive">WebGL Not Available</p>
                    <p className="text-[10px] text-muted-foreground">Open in a full browser tab to play.</p>
                  </div>
                )}

                {/* X Handle input */}
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 bg-white rounded-lg border border-orange-200 px-2 py-1">
                    <span className="text-orange-400 font-bold text-sm">@</span>
                    <input
                      type="text"
                      value={handle}
                      placeholder="xhandle"
                      maxLength={30}
                      onChange={(e) => {
                        const val = e.target.value.replace(/^@/, '').replace(/\s/g, '');
                        setHandle(val);
                        localStorage.setItem('chanclazo-handle', val);
                      }}
                      className="flex-1 text-sm font-bold outline-none bg-transparent text-orange-800 placeholder:text-orange-300"
                    />
                  </div>
                </div>

                {/* Character select */}
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 space-y-1.5">
                  <p className="font-black text-orange-700 text-xs text-center">{texts.ui.pickChar}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGender('boy')}
                      className={`flex flex-col items-center gap-1 rounded-lg py-2 border-2 transition-all ${
                        gender === 'boy'
                          ? 'bg-blue-100 border-blue-400 scale-105'
                          : 'bg-orange-50 border-orange-200 opacity-60'
                      }`}
                    >
                      <span className="text-lg font-black text-blue-600">♂</span>
                      <span className="text-xs font-black text-orange-700">{texts.ui.boy}</span>
                    </button>
                    <button
                      onClick={() => setGender('girl')}
                      className={`flex flex-col items-center gap-1 rounded-lg py-2 border-2 transition-all ${
                        gender === 'girl'
                          ? 'bg-pink-100 border-pink-400 scale-105'
                          : 'bg-orange-50 border-orange-200 opacity-60'
                      }`}
                    >
                      <span className="text-lg font-black text-pink-600">♀</span>
                      <span className="text-xs font-black text-orange-700">{texts.ui.girl}</span>
                    </button>
                  </div>
                </div>

                <Button
                  size="lg"
                  disabled={webglError}
                  className="w-full text-xl font-black py-7 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
                  onClick={() => { initAudio(); startLevel(1); }}
                >
                  {texts.ui.play}
                </Button>

                {/* Live player count on start screen */}
                {playerCount > 0 && (
                  <p className="text-center text-xs font-black text-purple-600 animate-pulse">
                    👥 {playerCount} {playerCount === 1 ? 'player' : 'players'} dodging right now!
                  </p>
                )}

                {/* Ghost mode badge */}
                <p className="text-center text-xs font-bold text-blue-400 opacity-80 tracking-wide">
                  👻 Ghost Mode — race the shadows of past players
                </p>

                <button
                  onClick={loadLeaderboard}
                  className="w-full text-xs font-black text-orange-700 opacity-70 hover:opacity-100 py-1 transition-opacity"
                  style={{ cursor: 'pointer' }}
                >
                  View Leaderboard
                </button>
                <a
                  href="/lore"
                  className="block w-full text-center text-xs font-black text-orange-700 opacity-70 hover:opacity-100 py-1 transition-opacity"
                >
                  What is a Chanclazo?
                </a>

                {/* Footer */}
                <div className="pt-2 border-t border-orange-200/60 flex flex-col items-center gap-1">
                  <a href="https://x.com/ChanclaStrike" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-orange-600/60 hover:text-orange-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{width:'12px',height:'12px'}}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    <span className="text-[10px] font-bold">@ChanclaStrike</span>
                  </a>
                  <div className="flex items-center gap-1 text-[10px] text-orange-500/60 font-medium">
                    <span>Powered by</span>
                    <a href="https://bolt.new" target="_blank" rel="noopener noreferrer" className="font-black hover:text-orange-700 transition-colors">bolt.new</a>
                    <span>&amp;</span>
                    <span className="font-black">Claude AI</span>
                  </div>
                  <p className="text-[9px] text-orange-500/50">© 2026 Chanclazo. All rights reserved.</p>
                </div>

              </CardContent>
            </Card>
          </div> {/* max-w-sm body */}

          </div> {/* scroll content */}
          </div> {/* min-h-full background */}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PLAYING HUD
      ════════════════════════════════════════════════════════════════ */}
      {phase === 'playing' && (
        <>
          {/* Top bar — fixed so it stays visible on vertical scroll */}
          <div
            className="fixed top-0 left-0 right-0 flex items-start justify-between px-2 pt-2 gap-2 pointer-events-none"
            style={{ zIndex: 30 }}
          >
            {/* Left: score + time + live player count */}
            <div className="flex flex-col gap-1">
              <Badge className="text-sm font-black px-2 py-1 bg-orange-500/90 text-white shadow-lg backdrop-blur-sm border-orange-400 w-fit">
                🏆 {score.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 shadow backdrop-blur-sm w-fit">
                ⏱ {formatTime(survivalSeconds)}
              </Badge>
              {playerCount > 1 && (
                <Badge className="text-[10px] font-bold px-2 py-0.5 bg-purple-600/90 text-white shadow backdrop-blur-sm border-purple-400 w-fit animate-pulse">
                  👥 {playerCount} playing
                </Badge>
              )}
            </div>

            {/* Center: level + health + progress */}
            <div className="flex flex-col items-center gap-1 flex-1 max-w-[150px] mx-auto">
              <Badge className="text-[10px] font-black px-2 py-0.5 bg-black/40 text-white backdrop-blur-sm border-white/20 w-fit">
                {texts.ui.level} {currentLevel} / {LEVELS.length}
              </Badge>
              <div className="flex gap-0.5 text-base leading-none">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={i < health ? '' : 'opacity-20'}
                    style={{ filter: shielded && i < health ? 'drop-shadow(0 0 4px #88DDFF)' : undefined, transition: 'opacity 0.2s' }}>
                    {shielded && i < health ? '💙' : '❤️'}
                  </span>
                ))}
              </div>
              <div className="w-full">
                <Progress value={levelProgress} className="h-1 bg-black/30 [&>div]:bg-orange-400" />
              </div>
            </div>

            {/* Right: combo + lang toggle */}
            <div className="flex flex-col items-end gap-1">
              {combo >= 2 && (
                <Badge className="text-sm font-black px-2 py-1 bg-red-500/90 text-white shadow-xl backdrop-blur-sm border-red-400">
                  🔥 x{combo}
                </Badge>
              )}
              <div className="flex gap-1 pointer-events-auto">
                {(['en', 'es'] as const).map((l) => (
                  <Button key={l} size="sm" variant={lang === l ? 'default' : 'outline'}
                    className={`text-[10px] font-black px-2 py-0.5 h-6 ${
                      lang === l
                        ? 'bg-orange-500/90 hover:bg-orange-600 text-white border-orange-500'
                        : 'bg-black/30 border-white/40 text-white hover:bg-black/50'
                    }`}
                    onClick={() => setLang(l)}>
                    {l.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom hints — only show on desktop, mobile has touch controls */}
          {!isMobile && (
            <div
              className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none"
              style={{ zIndex: 10 }}
            >
              <div className="flex gap-2 flex-wrap justify-center px-4">
                {[
                  { key: `← → ${texts.ui.move}`, highlight: false },
                  { key: `↑ ${texts.ui.jump}`, highlight: false },
                  { key: `↓ ${texts.ui.duck}`, highlight: false },
                  { key: `SPACE — ${texts.ui.strike} 🩴`, highlight: true },
                ].map(({ key, highlight }) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className={`text-xs backdrop-blur-sm ${
                      highlight
                        ? 'bg-orange-500/75 text-white border-orange-400'
                        : 'bg-black/30 text-white border-white/30'
                    }`}
                  >
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Know Your Enemy blurb — hidden */}
          {false && survivalSeconds < 6 && (
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: isMobile ? '140px' : '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 15,
                width: '90%',
                maxWidth: '380px',
                opacity: survivalSeconds < 4.5 ? 1 : Math.max(0, 1 - (survivalSeconds - 4.5) * 2),
                transition: 'opacity 0.3s ease',
              }}
            >
              <div className="rounded-xl border border-orange-400/60 bg-black/55 backdrop-blur-sm px-4 py-3 text-center space-y-1 shadow-2xl">
                <p className="text-yellow-300 font-black text-xs tracking-widest uppercase">⚠️ Know Your Enemy</p>
                <p className="text-white font-black text-sm leading-snug">
                  chanclazo <span className="text-orange-300 font-normal italic text-xs">[chan-claw-so]</span>
                </p>
                <p className="text-orange-200 text-[11px] leading-relaxed">
                  The OG heat-seeking missile. Supernatural accuracy. Zero warning. Delivered by moms, abuelas &amp; tías since the beginning of time.
                </p>
                <p className="text-yellow-400 font-black text-[10px] animate-pulse">
                  🩴 She's winding up... GET READY!
                </p>
              </div>
            </div>
          )}

          {/* Level goal hint (first 5s) */}
          {survivalSeconds < 5 && (
            <div
              style={{
                position: 'absolute',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                animation: 'popupFloat 4s ease-out forwards',
                width: 'auto',
                maxWidth: '80%',
                whiteSpace: 'nowrap',
              }}
            >
              <div className="px-4 py-2 rounded-full bg-black/50 text-yellow-300 backdrop-blur-sm border border-yellow-500/40 shadow-xl text-sm font-black">
                🎯 {texts.ui.levelGoal(levelConfig.surviveSecs, levelConfig.minScore)}
              </div>
            </div>
          )}

          {/* Floating popups */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            {popups.map((p) => (
              <div
                key={p.id}
                className="absolute font-black text-2xl leading-none"
                style={{
                  top: `${p.top}%`,
                  left: `${p.left}%`,
                  transform: 'translate(-50%, -50%)',
                  color: getPopupColor(p.text),
                  textShadow: '2px 3px 0 rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.6)',
                  animation: 'popupFloat 1.7s ease-out forwards',
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                }}
              >
                {p.text}
              </div>
            ))}
          </div>

          {/* Arcade controls — mobile only */}
          {isMobile && (
            <MobileTouchControls
              touchState={touchStateRef.current}
              canStrike={canStrike}
              onStrike={() => gameRef.current?.triggerStrike()}
            />
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LEVEL COMPLETE SCREEN
      ════════════════════════════════════════════════════════════════ */}
      {phase === 'level_complete' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{ background: LEVEL_BG_GRADIENTS[Math.min(levelCompleteData.level - 1, 4)] }}
          />
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          <LangToggle />

          <Card className="relative z-10 w-full max-w-md mx-4 border-4 border-yellow-400 shadow-2xl bg-amber-50/97">
            <CardHeader className="text-center pb-3">
              <div className="text-6xl text-center mb-1 select-none" aria-hidden>🎉</div>
              <CardTitle className={`text-4xl font-black tracking-tight leading-none ${LEVEL_ACCENT_CLASSES[Math.min(levelCompleteData.level - 1, 4)]}`}>
                {texts.ui.levelComplete(levelCompleteData.level)}
              </CardTitle>
              {levelCompleteData.level < LEVELS.length && (
                <p className="text-sm font-bold text-muted-foreground mt-1">
                  {texts.ui.levels[levelCompleteData.level]?.name}
                </p>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 space-y-2 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{texts.ui.score}</p>
                <p className="text-5xl font-black text-orange-600">{levelCompleteData.score.toLocaleString()}</p>
                <div className="flex justify-center gap-3 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{texts.ui.timeBonus}</p>
                    <p className="font-bold text-green-600">+{levelCompleteData.timeBonus}</p>
                  </div>
                </div>
              </div>

              {/* Next level preview */}
              {levelCompleteData.level < LEVELS.length && (
                <div className="rounded-lg border-2 border-orange-200 bg-orange-50/50 px-4 py-3">
                  <p className="text-xs font-black text-orange-700 uppercase tracking-wider mb-1">
                    Next: Level {levelCompleteData.level + 1}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {texts.ui.levels[levelCompleteData.level].desc}
                  </p>
                  <p className="text-xs text-orange-600 font-medium mt-1">
                    🎯 {texts.ui.levelGoal(
                      LEVELS[levelCompleteData.level].surviveSecs,
                      LEVELS[levelCompleteData.level].minScore
                    )}
                  </p>
                </div>
              )}

              <Button
                size="lg"
                className="w-full text-xl font-black py-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
                onClick={() => startLevel(levelCompleteData.level + 1)}
              >
                {texts.ui.nextLevel}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => setPhase('start')}
              >
                {texts.ui.menu}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VICTORY SCREEN
      ════════════════════════════════════════════════════════════════ */}
      {phase === 'victory' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #1a472a 0%, #2d5a27 40%, #4a7c3f 100%)' }}
          />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, #ffd700 0, #ffd700 1px, transparent 0, transparent 40px),' +
                'repeating-linear-gradient(90deg, #ffd700 0, #ffd700 1px, transparent 0, transparent 40px)',
              backgroundSize: '40px 40px',
            }}
          />

          <LangToggle dark />

          <Card className="relative z-10 w-full max-w-md mx-4 border-4 border-yellow-400 shadow-2xl bg-green-950 text-white">
            <CardHeader className="text-center pb-3">
              <div className="text-6xl text-center mb-2 select-none" style={{ animation: 'heroFloat 1.5s ease-in-out infinite' }} aria-hidden>🏆</div>
              <CardTitle className="text-3xl font-black text-yellow-400 tracking-tight leading-none">
                {texts.ui.victoryTitle}
              </CardTitle>
              <p className="text-green-300 font-bold mt-1 text-lg">{texts.ui.victory}</p>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="rounded-xl border-2 border-yellow-600 bg-green-900/60 p-5 text-center space-y-3">
                <p className="text-yellow-300/80 text-xs uppercase tracking-widest">{texts.ui.finalScore}</p>
                <p className="text-6xl font-black text-yellow-400 leading-none">{finalScore.toLocaleString()}</p>
                <div className="flex justify-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-green-300/70 text-xs uppercase tracking-wider">{texts.ui.totalSurvival}</p>
                    <p className="font-bold text-white">{formatTime(finalSurvival)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-green-300/70 text-xs uppercase tracking-wider">{texts.ui.level}</p>
                    <p className="font-bold text-yellow-400">5 / 5 ✓</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-center">
                <p className="font-bold text-yellow-200 text-sm leading-snug">
                  {texts.ui.rank.legend}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full text-xl font-black py-6 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
                  onClick={() => { initAudio(); startLevel(1); }}
                >
                  PLAY AGAIN
                </Button>
                <Button
                  size="lg"
                  className="w-full font-black py-4 bg-black hover:bg-zinc-800 text-white rounded-xl shadow-lg"
                  onClick={() => shareOnX(finalScore)}
                >
                  Share on 𝕏
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full font-bold border-yellow-600 text-yellow-300 hover:bg-yellow-900/20"
                  onClick={loadLeaderboard}
                >
                  🏆 Leaderboard
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full font-bold border-green-600 text-green-300 hover:bg-green-900/60 hover:text-green-200"
                  onClick={() => setPhase('start')}
                >
                  {texts.ui.menu}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          GAME OVER SCREEN
      ════════════════════════════════════════════════════════════════ */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md" />

          {/* Flying chancla animation on game over */}
          <div
            className="absolute pointer-events-none select-none"
            style={{
              fontSize: '120px',
              top: '5%',
              left: '-15%',
              animation: 'chanclaFly 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
              zIndex: 20,
              filter: 'drop-shadow(0 0 30px #FF4400) drop-shadow(0 0 60px #FF000088)',
            }}
            aria-hidden
          >
            🩴
          </div>
          {/* Screen flash */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, #FF220088 0%, transparent 70%)',
              animation: 'hitFlash 1.0s ease-out forwards',
              zIndex: 5,
            }}
          />

          <LangToggle dark />

          <Card className="relative z-10 w-full max-w-md mx-4 border-4 border-red-500 shadow-2xl bg-red-950 text-white">
            <CardHeader className="text-center pb-3">

              <CardTitle className="text-4xl font-black text-red-400 tracking-tight leading-none">
                {texts.ui.gameOver}
              </CardTitle>
              <p className="text-orange-300 font-bold mt-1">
                {texts.ui.gameLost}
              </p>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="rounded-xl border-2 border-red-700 bg-red-900/60 p-5 text-center space-y-3">
                <p className="text-red-300/80 text-xs uppercase tracking-widest">{texts.ui.finalScore}</p>
                <p className="text-6xl font-black text-yellow-400 leading-none">{finalScore.toLocaleString()}</p>
                <div className="flex justify-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-red-300/70 text-xs uppercase tracking-wider">{texts.ui.time}</p>
                    <p className="font-bold text-white">{formatTime(finalSurvival)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-300/70 text-xs uppercase tracking-wider">{texts.ui.level}</p>
                    <p className="font-bold text-orange-300">{currentLevel} / {LEVELS.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-center">
                <p className="font-bold text-orange-200 text-sm leading-snug">
                  {getMomQuote(finalScore, lang)}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full text-xl font-black py-6 bg-orange-500 hover:bg-orange-400 text-white rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
                  onClick={() => { initAudio(); startLevel(currentLevel); }}
                >
                  PLAY AGAIN
                </Button>
                <Button
                  size="lg"
                  className="w-full font-black py-4 bg-black hover:bg-zinc-800 text-white rounded-xl shadow-lg"
                  onClick={() => shareOnX(finalScore)}
                >
                  Share on 𝕏
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full font-bold border-white/20 text-white/70 hover:bg-white/10"
                  onClick={loadLeaderboard}
                >
                  🏆 Leaderboard
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full font-bold border-red-600 text-red-300 hover:bg-red-900/60 hover:text-red-200"
                  onClick={() => setPhase('start')}
                >
                  {texts.ui.menu}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* ════════════════════════════════════════════════════════════════
          LEADERBOARD MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showLeaderboard && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowLeaderboard(false)} />
          <Card className="relative z-10 w-full max-w-sm mx-4 border-2 border-yellow-400 shadow-2xl bg-amber-950 text-white">
            <CardHeader className="text-center pb-2">
              <div className="text-4xl mb-1">🏆</div>
              <CardTitle className="text-2xl font-black text-yellow-400">Leaderboard</CardTitle>
              <p className="text-xs text-yellow-300/60">Top 10 Chanclazo Players</p>
              {highScore > 0 && (
                <div className="w-fit mx-auto px-3 py-1 rounded-full bg-black/30 border border-yellow-400/50 text-yellow-300 text-xs font-black">
                  🏅 Your Best: {highScore.toLocaleString()} pts
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {leaderboard.length === 0 ? (
                <p className="text-center text-white/50 text-sm py-4">No scores yet — be the first!</p>
              ) : (
                <div className="space-y-1.5">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/40' : i === 1 ? 'bg-zinc-400/10 border border-zinc-400/20' : i === 2 ? 'bg-orange-800/20 border border-orange-700/20' : 'bg-white/5'}`}>
                      <span className="text-lg w-6 text-center">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </span>
                      <span className="flex-1 font-black text-sm text-white">@{entry.handle}</span>
                      <span className="font-black text-yellow-400 text-sm">{entry.score.toLocaleString()}</span>
                      <span className="text-[10px] text-white/40">Lvl {entry.level}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowLeaderboard(false)}
                className="w-full mt-2 py-2 text-sm font-black text-white/60 hover:text-white transition-colors"
              >
                Close ✕
              </button>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}

function shareOnX(score: number) {
  const text = `🩴 I scored ${score.toLocaleString()} pts dodging chanclas in CHANCLAZO! Can you beat me? #Chanclazo #gaming`;
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getPopupColor(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('combo') || t.includes('racha') || t.includes('imparable') || t.includes('unstoppable') || t.includes('streak')) return '#FFD700';
  if (t.includes('shield') || t.includes('escudo') || t.includes('invincible') || t.includes('invencible')) return '#88DDFF';
  if (t.includes('heart') || t.includes('heal') || t.includes('vida') || t.includes('recuper')) return '#FF69B4';
  if (t.includes('strike') || t.includes('reversal') || t.includes('regresa') || t.includes('cacé') || t.includes('returning') || t.includes('take that')) return '#4FC3F7';
  if (t.includes('pan') || t.includes('sartén') || t.includes('sarten') || t.includes('duck') || t.includes('agáchate') || t.includes('frito')) return '#FF8C00';
  if (t.includes('diste') || t.includes('golazo') || t.includes('bullseye') || t.includes('down') || t.includes('headshot') || t.includes('direct')) return '#81C784';
  if (t.includes('esquiv') || t.includes('dodge') || t.includes('close') || t.includes('poco') || t.includes('lucky') || t.includes('matrix') || t.includes('whew')) return '#FFD93D';
  return '#FFFFFF';
}



const MOM_QUOTES_EN = [
  '🩴 "The chanclazo: precision-guided since before GPS existed."',
  '🩴 "Supernatural accuracy. Zero warning. No appeals."',
  '🩴 "The OG heat-seeking missile — invented by abuelas."',
  '🩴 "No armor can stop a chancla thrown with amor y coraje."',
  '🩴 "She didn\'t miss. She never misses. It\'s physically impossible."',
  '🩴 "Ancient technique. Certified by every tía on the block."',
  '🩴 "The chanclazo does not negotiate. It corrects."',
  '🩴 "Faster than sound. More accurate than a laser."',
];

const MOM_QUOTES_ES = [
  '🩴 "El chanclazo: precisión guiada antes que existiera el GPS."',
  '🩴 "Puntería sobrenatural. Sin aviso. Sin apelaciones."',
  '🩴 "El misil original teledirigido — inventado por las abuelas."',
  '🩴 "Ninguna armadura detiene una chancla lanzada con amor y coraje."',
  '🩴 "No falló. Nunca falla. Es físicamente imposible."',
  '🩴 "Técnica ancestral. Certificada por cada tía del barrio."',
  '🩴 "El chanclazo no negocia. Corrige."',
  '🩴 "Más rápida que el sonido. Más precisa que un láser."',
];

function getMomQuote(score: number, lang: Lang): string {
  const quotes = lang === 'es' ? MOM_QUOTES_ES : MOM_QUOTES_EN;
  // Use score to pick a quote so it feels different each game
  return quotes[score % quotes.length];
}
