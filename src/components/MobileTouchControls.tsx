import { useEffect, useRef } from 'react';
import type { TouchInputState } from '@/game/controls';

interface Props {
  touchState: TouchInputState;
  canStrike: boolean;
  onStrike: () => void;
}

const BTN = 64;
const BTN_MOVE = 88;
const leftStartX = { current: 0 };

export default function MobileTouchControls({ touchState, canStrike, onStrike }: Props) {
  const moveRef   = useRef<HTMLButtonElement>(null);
  const jumpRef   = useRef<HTMLButtonElement>(null);
  const duckRef   = useRef<HTMLButtonElement>(null);
  const strikeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = moveRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      leftStartX.current = e.changedTouches[0].clientX;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = e.changedTouches[0].clientX - leftStartX.current;
      touchState.left  = delta < -18;
      touchState.right = delta > 18;
    };
    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchState.left = touchState.right = false;
    };
    el.addEventListener('touchstart',  onStart as EventListener, { passive: false });
    el.addEventListener('touchmove',   onMove  as EventListener, { passive: false });
    el.addEventListener('touchend',    onEnd   as EventListener, { passive: false });
    el.addEventListener('touchcancel', onEnd   as EventListener, { passive: false });
    return () => {
      el.removeEventListener('touchstart',  onStart as EventListener);
      el.removeEventListener('touchmove',   onMove  as EventListener);
      el.removeEventListener('touchend',    onEnd   as EventListener);
      el.removeEventListener('touchcancel', onEnd   as EventListener);
    };
  }, [touchState]);

  function handleStrikeTouch(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    touchState.strikeQueued = true;
    onStrike();
  }

  const base = 'flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 text-white select-none';
  const size = { width: BTN, height: BTN, touchAction: 'none' as const, WebkitTapHighlightColor: 'transparent' };
  const dim  = 'bg-black/20 border-white/25';

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 20 }} aria-hidden>

      {/* Left: Move only — larger */}
      <div className="absolute left-3 bottom-36 flex flex-col gap-2 pointer-events-auto">
        <button ref={moveRef} className={`${base} ${dim}`}
          style={{ width: BTN_MOVE, height: BTN_MOVE, touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}>
          <span className="text-lg leading-none opacity-70">⟵ ⟶</span>
          <span className="text-[9px] font-bold tracking-wider uppercase opacity-60">Move</span>
        </button>
      </div>

      {/* Right: Jump + Strike + Duck — stacked, lower */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-2 pointer-events-auto">
        <button ref={jumpRef} className={`${base} ${dim}`} style={size}
          onTouchStart={(e) => { e.preventDefault(); touchState.jump = true; }}
          onTouchEnd={(e) => { e.preventDefault(); touchState.jump = false; }}
          onTouchCancel={(e) => { e.preventDefault(); touchState.jump = false; }}>
          <span className="text-base leading-none opacity-70">↑</span>
          <span className="text-[8px] font-bold tracking-wider uppercase opacity-60">Jump</span>
        </button>
        <button ref={strikeRef} onTouchStart={handleStrikeTouch}
          className={[base, 'font-black shadow-xl transition-all duration-150',
            canStrike
              ? 'bg-orange-500/90 border-yellow-400 shadow-yellow-400/50 scale-105 animate-pulse'
              : 'bg-orange-500/35 border-orange-400/30 opacity-50',
          ].join(' ')} style={size}>
          <span className="text-xl leading-none">⚡</span>
          <span className="text-[8px] tracking-widest uppercase leading-none">Strike</span>
        </button>
        <button ref={duckRef} className={`${base} ${dim}`} style={size}
          onTouchStart={(e) => { e.preventDefault(); touchState.duck = true; }}
          onTouchEnd={(e) => { e.preventDefault(); touchState.duck = false; }}
          onTouchCancel={(e) => { e.preventDefault(); touchState.duck = false; }}>
          <span className="text-base leading-none opacity-70">↓</span>
          <span className="text-[8px] font-bold tracking-wider uppercase opacity-60">Duck</span>
        </button>
      </div>

    </div>
  );
}
