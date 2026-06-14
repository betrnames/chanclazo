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
import { initAudio, setMuted, startMusic, stopMusic, setMusicIntensity } from './game/sound';
import { createTouchState } from './game/controls';
import type { TouchInputState } from './game/controls';
import MobileTouchControls from './components/MobileTouchControls';
import { submitScore, fetchLeaderboard, pingPresence, leavePresence } from './api';
import Slingshot from './Slingshot';
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

  // ── Portal detection: skip start screen if arriving from Vibe Jam webring ──
  const [portalRef] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      isPortal: params.get('portal') === 'true',
      ref: params.get('ref') || '',
      username: params.get('username') || '',
    };
  });

  const [phase, setPhase] = useState<GamePhase>(() =>
    portalRef.isPortal ? 'playing' : 'start'
  );
  const [gender, setGender] = useState<CharacterGender>('boy');
  const [handle, setHandle] = useState<string>(() => {
    if (portalRef.isPortal && portalRef.username) {
      localStorage.setItem('chanclazo-handle', portalRef.username);
      return portalRef.username;
    }
    return localStorage.getItem('chanclazo-handle') ?? '';
  });
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
  const [musicMuted, setMusicMuted] = useState(false);
  const homeMusicStarted = useRef(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [survivalSeconds, setSurvivalSeconds] = useState(0);
  const [health, setHealth] = useState(3);
  const [shielded, setShielded] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalSurvival, setFinalSurvival] = useState(0);
  const [levelCompleteData, setLevelCompleteData] = useState({ level: 1, score: 0, timeBonus: 0 });
  const [showNextLevelBtn, setShowNextLevelBtn] = useState(false);
  const [popups, setPopups] = useState<PopupEntry[]>([]);

  const texts = getTexts(lang);
  const levelConfig = LEVELS[currentLevel - 1];

  // ── Homepage background music (starts on first click/tap) ─────────────────
  useEffect(() => {
    if (phase !== 'start' || homeMusicStarted.current) return;
    const startHomeMusic = () => {
      if (homeMusicStarted.current) return;
      homeMusicStarted.current = true;
      initAudio();
      setMusicIntensity(2);
      startMusic();
    };
    document.addEventListener('click', startHomeMusic, { once: true });
    document.addEventListener('touchstart', startHomeMusic, { once: true });
    return () => {
      document.removeEventListener('click', startHomeMusic);
      document.removeEventListener('touchstart', startHomeMusic);
    };
  }, [phase]);

  // Stop homepage music when game starts (engine takes over)
  useEffect(() => {
    if (phase === 'playing') {
      stopMusic();
      homeMusicStarted.current = false;
    }
  }, [phase]);

  // ── Live presence (player count) — ping while playing, leave otherwise ─────
  useEffect(() => {
    if (phase !== 'playing') return;
    let iv: ReturnType<typeof setInterval> | null = null;
    const ping = async () => {
      const count = await pingPresence(sessionId.current);
      setPlayerCount(count);
    };
    ping();
    iv = setInterval(ping, 14000);
    return () => { if (iv) clearInterval(iv); };
  }, [phase]);

  // Leave presence on phase change away from playing or on unmount
  useEffect(() => {
    if (phase === 'playing') return;
    leavePresence(sessionId.current).catch(() => {});
    setPlayerCount(0);
  }, [phase]);

  // Ensure leave on full unmount
  useEffect(() => {
    const sid = sessionId.current;
    return () => {
      leavePresence(sid).catch(() => {});
    };
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !musicMuted;
    setMusicMuted(newMuted);
    setMuted(newMuted);
    if (newMuted) {
      stopMusic();
    } else if (phase === 'start') {
      initAudio();
      setMusicIntensity(2);
      startMusic();
    }
  }, [musicMuted, phase]);

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

  // ── Delay next level button on level complete ──────────────────────────────
  useEffect(() => {
    if (phase !== 'level_complete') {
      setShowNextLevelBtn(false);
      return;
    }
    setShowNextLevelBtn(false);
    const timer = setTimeout(() => {
      setShowNextLevelBtn(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [phase]);

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

          {/* Small fluorescent yellow CTA in header for bonus game (removed from card below) */}
          <button
            onClick={() => setPhase('slingshot')}
            className="absolute top-3 left-3 z-50 px-2 py-0.5 text-[9px] font-black tracking-wider bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-black rounded shadow border border-yellow-500 transition-all active:scale-[0.97]"
          >
            BONUS GAME
          </button>

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
              <CardContent className="pt-2 pb-2 space-y-2">

                {/* 3-tier character selector - center focused like pricing tiers, sides smaller/ghosted */}
                <div className="px-3 py-8 space-y-5"> {/* more padding top and bottom of the characters */}
                  <p className="font-black text-orange-800 text-sm tracking-wide text-center">
                    🎮 {texts.ui.pickChar.toUpperCase()}
                  </p>

                  <div className="flex items-end justify-center gap-3 py-3"> {/* more vertical padding around characters */}
                    {(() => {
                      const order: CharacterGender[] = ['boy', 'girl', 'luchador'];
                      const idx = order.indexOf(gender);
                      const leftId = order[(idx - 1 + 3) % 3];
                      const centerId = gender;
                      const rightId = order[(idx + 1) % 3];

                      const getChar = (id: CharacterGender) => {
                        if (id === 'boy') return { name: texts.ui.boy, avatar: '/boy.png' };
                        if (id === 'girl') return { name: texts.ui.girl, avatar: '/girl.png' };
                        return { name: texts.ui.luchador || 'Luchador', avatar: '/luchador.png' };
                      };

                      const left = getChar(leftId);
                      const center = getChar(centerId);
                      const right = getChar(rightId);

                      return (
                        <>
                          {/* Left - smaller, ghosted */}
                          <button
                            onClick={() => setGender(leftId)}
                            className="flex flex-col items-center transition-all opacity-35 hover:opacity-60 active:scale-95"
                          >
                            <div className="h-22 w-22 flex items-center justify-center overflow-hidden">
                              <img
                                src={left.avatar}
                                alt={left.name}
                                className="max-h-20 max-w-20 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            </div>
                            <span className="text-[9px] font-black text-orange-600 mt-0.5 tracking-wider">{left.name}</span>
                          </button>

                          {/* Center - main focus, noticeably taller */}
                          <button
                            onClick={() => { /* already selected */ }}
                            className="flex flex-col items-center transition-all scale-[1.15]"
                          >
                            <div className="h-40 w-40 flex items-center justify-center overflow-hidden -mt-7">
                              <img
                                src={center.avatar}
                                alt={center.name}
                                className="max-h-40 max-w-40 object-contain drop-shadow-xl"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            </div>
                            <span className="text-sm font-black text-orange-800 -mt-1 tracking-wider">{center.name}</span>
                          </button>

                          {/* Right - smaller, ghosted */}
                          <button
                            onClick={() => setGender(rightId)}
                            className="flex flex-col items-center transition-all opacity-35 hover:opacity-60 active:scale-95"
                          >
                            <div className="h-22 w-22 flex items-center justify-center overflow-hidden">
                              <img
                                src={right.avatar}
                                alt={right.name}
                                className="max-h-20 max-w-20 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            </div>
                            <span className="text-[9px] font-black text-orange-600 mt-0.5 tracking-wider">{right.name}</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex justify-center gap-3 pt-0.5">
                    <button
                      onClick={() => {
                        const order: CharacterGender[] = ['boy', 'girl', 'luchador'];
                        const idx = order.indexOf(gender);
                        setGender(order[(idx - 1 + 3) % 3]);
                      }}
                      className="text-orange-600 hover:text-orange-800 text-lg font-black px-1 leading-none"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => {
                        const order: CharacterGender[] = ['boy', 'girl', 'luchador'];
                        const idx = order.indexOf(gender);
                        setGender(order[(idx + 1) % 3]);
                      }}
                      className="text-orange-600 hover:text-orange-800 text-lg font-black px-1 leading-none"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* High score tease - game feel (using allowed heart icon) */}
                {highScore > 0 && (
                  <div className="text-center">
                    <span className="inline-block text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                      ❤️ YOUR BEST: {highScore.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* X Handle input - styled as player tag (no extra icons) */}
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 space-y-1">
                  <div className="text-[10px] font-black text-orange-600 text-center">PLAYER TAG FOR LEADERBOARD</div>
                  <div className="flex items-center gap-1.5 bg-white rounded-lg border-2 border-orange-300 px-2 py-1">
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

                {webglError && (
                  <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 text-center">
                    <p className="text-xs font-black text-destructive">WebGL Not Available</p>
                    <p className="text-[10px] text-muted-foreground">Open in a full browser tab to play.</p>
                  </div>
                )}

                {/* Big juicy PLAY button - more arcade (no sandal icons) */}
                <Button
                  size="lg"
                  disabled={webglError}
                  className="w-full text-2xl font-black py-8 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl shadow-[0_6px_0_#9a3412] active:shadow-[0_2px_0_#9a3412] active:translate-y-1 transition-all border-b-4 border-orange-800"
                  onClick={() => { initAudio(); startLevel(1); }}
                >
                  {texts.ui.play}
                </Button>

                {/* Live player count - more prominent (no icon) */}
                {playerCount > 0 && (
                  <div className="text-center py-1">
                    <span className="text-sm font-black text-purple-600 bg-purple-100 px-3 py-0.5 rounded-full border border-purple-200 animate-pulse">
                      {playerCount} {playerCount === 1 ? 'player' : 'players'} dodging RIGHT NOW
                    </span>
                  </div>
                )}

                {/* Community actions - tighter, fun menu style (no extra icons) */}
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    onClick={loadLeaderboard}
                    className="w-full text-sm font-black text-orange-700 hover:text-orange-900 bg-orange-100 hover:bg-orange-200 py-1.5 rounded-lg transition-colors border border-orange-200"
                  >
                    {texts.ui.leaderboard}
                  </button>
                  <a
                    href="/lore"
                    className="block w-full text-center text-sm font-black text-orange-700 hover:text-orange-900 bg-orange-100 hover:bg-orange-200 py-1.5 rounded-lg transition-colors border border-orange-200"
                  >
                    {texts.ui.whatIsChanclazo}
                  </a>
                </div>

                {/* Music toggle - compact (keep sound icons) */}
                <button
                  onClick={toggleMute}
                  className="w-full text-xs font-black text-orange-600 hover:text-orange-800 py-1 flex items-center justify-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
                >
                  {musicMuted ? '🔇 Turn Music On' : '🔊 Turn Music Off'}
                </button>

                {/* Footer - smaller, less dominant */}
                <div className="pt-1 border-t border-orange-200/60 text-[9px] text-orange-500/60 flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-2">
                    <a href="https://x.com/ChanclaStrike" target="_blank" rel="noopener noreferrer" className="hover:text-orange-700">@ChanclaStrike</a>
                    <span>•</span>
                    <a href="mailto:contact@chanclazo.com" className="hover:text-orange-700">Contact</a>
                  </div>
                  <div>
                    Made with ❤️ + bolt.new
                  </div>
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

              {showNextLevelBtn && levelCompleteData.level < LEVELS.length && (
                <Button
                  size="lg"
                  className="w-full text-xl font-black py-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
                  onClick={() => startLevel(levelCompleteData.level + 1)}
                >
                  {texts.ui.nextLevel}
                </Button>
              )}
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
          CHANCLA STRIKE (Slingshot Bonus Mode)
      ════════════════════════════════════════════════════════════════ */}
      {phase === 'slingshot' && (
        <Slingshot onBack={() => setPhase('start')} />
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
