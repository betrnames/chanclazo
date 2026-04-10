import { useEffect, useRef, useState } from 'react';
import type { TouchInputState } from '@/game/controls';

interface Props {
  touchState: TouchInputState;
  canStrike: boolean;
  onStrike: () => void;
}

const leftStartX = { current: 0 };

export default function MobileTouchControls({ touchState, canStrike, onStrike }: Props) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const jumpRef     = useRef<HTMLButtonElement>(null);
  const duckRef     = useRef<HTMLButtonElement>(null);
  const strikeRef   = useRef<HTMLButtonElement>(null);

  const [knobOffset, setKnobOffset] = useState(0); // -1 to 1
  const [jumpPressed,   setJumpPressed]   = useState(false);
  const [duckPressed,   setDuckPressed]   = useState(false);
  const [strikePressed, setStrikePressed] = useState(false);

  // Joystick drag logic
  useEffect(() => {
    const el = joystickRef.current;
    if (!el) return;
    const DEAD = 18;
    const MAX  = 40;

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      leftStartX.current = e.changedTouches[0].clientX;
      setKnobOffset(0);
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = e.changedTouches[0].clientX - leftStartX.current;
      const clamped = Math.max(-MAX, Math.min(MAX, delta));
      setKnobOffset(clamped / MAX);
      touchState.left  = delta < -DEAD;
      touchState.right = delta > DEAD;
    };
    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchState.left = touchState.right = false;
      setKnobOffset(0);
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

  // Arcade button style
  const arcadeBtn = (color: string, shadow: string, pressed: boolean) => ({
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    touchAction: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    background: pressed
      ? `radial-gradient(circle at 45% 45%, ${color}cc, ${color}88)`
      : `radial-gradient(circle at 35% 30%, ${color}ff, ${color}aa 60%, ${color}66)`,
    boxShadow: pressed
      ? `0 2px 0 ${shadow}, inset 0 2px 6px rgba(0,0,0,0.4)`
      : `0 6px 0 ${shadow}, 0 8px 16px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)`,
    transform: pressed ? 'translateY(4px)' : 'translateY(0)',
    transition: 'transform 0.06s, box-shadow 0.06s',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    userSelect: 'none' as const,
  });

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 20 }} aria-hidden>

      {/* LEFT — Arcade Joystick */}
      <div className="absolute pointer-events-auto" style={{ left: 20, bottom: 130 }}>
        {/* Gate / base plate */}
        <div style={{
          width: 110, height: 110,
          borderRadius: 16,
          background: 'radial-gradient(circle, #2a2a2a, #111)',
          border: '3px solid #444',
          boxShadow: '0 6px 20px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Gate circle groove */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '2px solid #333',
            position: 'absolute',
          }} />
          {/* Joystick shaft + knob */}
          <div ref={joystickRef} style={{
            width: 80, height: 80,
            borderRadius: '50%',
            position: 'absolute',
            touchAction: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Shaft */}
            <div style={{
              width: 14, height: 38,
              background: 'linear-gradient(to bottom, #888, #444)',
              borderRadius: 6,
              position: 'absolute',
              bottom: '50%',
              left: '50%',
              transform: `translateX(-50%) translateX(${knobOffset * 18}px) rotate(${knobOffset * 22}deg)`,
              transformOrigin: 'bottom center',
              transition: knobOffset === 0 ? 'transform 0.15s' : 'none',
              boxShadow: '2px 0 4px rgba(0,0,0,0.4)',
            }} />
            {/* Ball knob */}
            <div style={{
              width: 36, height: 36,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 38% 32%, #cc3300, #881100)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,120,80,0.4)',
              position: 'absolute',
              bottom: 'calc(50% + 12px)',
              left: '50%',
              transform: `translateX(-50%) translateX(${knobOffset * 18}px)`,
              transition: knobOffset === 0 ? 'transform 0.15s' : 'none',
              zIndex: 2,
            }} />
          </div>
          {/* Left/Right hint labels */}
          <span style={{ position: 'absolute', left: 4, fontSize: 9, color: '#555', fontWeight: 700 }}>◀</span>
          <span style={{ position: 'absolute', right: 4, fontSize: 9, color: '#555', fontWeight: 700 }}>▶</span>
        </div>
        <p style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Move</p>
      </div>

      {/* RIGHT — Arcade Buttons */}
      <div className="absolute pointer-events-auto" style={{ right: 20, bottom: 130 }}>
        {/* Panel plate */}
        <div style={{
          width: 130, height: 110,
          borderRadius: 16,
          background: 'radial-gradient(circle, #2a2a2a, #111)',
          border: '3px solid #444',
          boxShadow: '0 6px 20px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Triangle layout: Jump top-center, Duck bottom-left, Strike bottom-right */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {/* Top row: Jump */}
            <button ref={jumpRef}
              style={arcadeBtn('#2266cc', '#113377', jumpPressed)}
              onTouchStart={(e) => { e.preventDefault(); touchState.jump = true; setJumpPressed(true); }}
              onTouchEnd={(e)   => { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>↑</span>
              <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Jump</span>
            </button>
            {/* Bottom row: Duck + Strike */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button ref={duckRef}
                style={arcadeBtn('#226622', '#113311', duckPressed)}
                onTouchStart={(e) => { e.preventDefault(); touchState.duck = true; setDuckPressed(true); }}
                onTouchEnd={(e)   => { e.preventDefault(); touchState.duck = false; setDuckPressed(false); }}
                onTouchCancel={(e)=> { e.preventDefault(); touchState.duck = false; setDuckPressed(false); }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>↓</span>
                <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Duck</span>
              </button>
              <button ref={strikeRef}
                style={arcadeBtn(
                  canStrike ? '#dd6600' : '#884400',
                  canStrike ? '#882200' : '#331100',
                  strikePressed
                )}
                onTouchStart={(e) => { e.preventDefault(); setStrikePressed(true); handleStrikeTouch(e); }}
                onTouchEnd={(e)   => { e.preventDefault(); setStrikePressed(false); }}
                onTouchCancel={(e)=> { e.preventDefault(); setStrikePressed(false); }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>⚡</span>
                <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Strike</span>
              </button>
            </div>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Actions</p>
      </div>

    </div>
  );
}
