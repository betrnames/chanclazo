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
  const [knobOffset, setKnobOffset]     = useState(0);
  const [jumpPressed,   setJumpPressed]   = useState(false);
  const [duckPressed,   setDuckPressed]   = useState(false);
  const [strikePressed, setStrikePressed] = useState(false);

  useEffect(() => {
    const el = joystickRef.current;
    if (!el) return;
    const DEAD = 14;
    const MAX  = 32;
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

  // Glossy vintage arcade button
  const arcadeBtn = (topColor: string, midColor: string, shadowColor: string, pressed: boolean) => ({
    width: 58,
    height: 58,
    borderRadius: '50%',
    border: 'none',
    outline: 'none',
    touchAction: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    cursor: 'pointer',
    userSelect: 'none' as const,
    position: 'relative' as const,
    background: pressed
      ? `radial-gradient(circle at 50% 60%, ${midColor}, ${shadowColor})`
      : `radial-gradient(circle at 38% 28%, #ffffff55 0%, transparent 45%),
         radial-gradient(circle at 42% 35%, ${topColor} 0%, ${midColor} 55%, ${shadowColor} 100%)`,
    boxShadow: pressed
      ? `0 2px 0 ${shadowColor}, inset 0 3px 8px rgba(0,0,0,0.45)`
      : `0 5px 0 ${shadowColor}, 0 7px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)`,
    transform: pressed ? 'translateY(4px) scale(0.96)' : 'translateY(0) scale(1)',
    transition: 'transform 0.07s ease, box-shadow 0.07s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', zIndex: 20 }} aria-hidden>

      {/* LEFT — Compact Joystick */}
      <div style={{ position: 'absolute', left: 18, bottom: 40, pointerEvents: 'auto' }}>
        {/* Base plate — smaller */}
        <div style={{
          width: 86, height: 86,
          borderRadius: 14,
          background: 'radial-gradient(circle at 40% 35%, #3a3a3a, #161616)',
          border: '2px solid #3a3a3a',
          boxShadow: '0 5px 18px rgba(0,0,0,0.75), inset 0 1px 1px rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Circular gate groove */}
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            border: '1.5px solid #2a2a2a',
            position: 'absolute',
          }} />
          {/* Drag zone */}
          <div ref={joystickRef} style={{
            width: 60, height: 60, borderRadius: '50%',
            position: 'absolute', touchAction: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Shaft */}
            <div style={{
              width: 11, height: 30,
              background: 'linear-gradient(to right, #999, #555, #888)',
              borderRadius: 5,
              position: 'absolute',
              bottom: '50%',
              left: '50%',
              transform: `translateX(-50%) translateX(${knobOffset * 14}px) rotate(${knobOffset * 18}deg)`,
              transformOrigin: 'bottom center',
              transition: knobOffset === 0 ? 'transform 0.15s' : 'none',
              boxShadow: '1px 0 4px rgba(0,0,0,0.5)',
            }} />
            {/* Ball knob — prominent red */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'radial-gradient(circle at 36% 30%, #ff6644, #cc2200 60%, #881100)',
              boxShadow: '0 3px 8px rgba(0,0,0,0.7), inset 0 1px 3px rgba(255,160,100,0.5)',
              position: 'absolute',
              bottom: 'calc(50% + 10px)',
              left: '50%',
              transform: `translateX(-50%) translateX(${knobOffset * 14}px)`,
              transition: knobOffset === 0 ? 'transform 0.15s' : 'none',
              zIndex: 2,
            }} />
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.28)', marginTop: 3, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Move</p>
      </div>

      {/* RIGHT — 3 Arcade Buttons vertical stack */}
      <div style={{ position: 'absolute', right: 18, bottom: 40, pointerEvents: 'auto' }}>
        {/* Floating buttons — no panel */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-evenly',
          gap: 10,
        }}>

          {/* JUMP — Blue */}
          <button
            style={arcadeBtn('#4488ff', '#1155cc', '#0a2f77', jumpPressed)}
            onTouchStart={(e) => { e.preventDefault(); touchState.jump = true; setJumpPressed(true); }}
            onTouchEnd={(e)   => { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}
            onTouchCancel={(e)=> { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Jump</span>
          </button>

          {/* STRIKE — Orange */}
          <button
            style={{
              ...arcadeBtn(
                canStrike ? '#ffaa22' : '#886622',
                canStrike ? '#dd6600' : '#553300',
                canStrike ? '#882200' : '#221100',
                strikePressed
              ),
              ...(canStrike && !strikePressed ? { boxShadow: '0 5px 0 #882200, 0 0 18px #ff880088, inset 0 1px 0 rgba(255,255,255,0.35)' } : {}),
            }}
            onTouchStart={(e) => { e.preventDefault(); setStrikePressed(true); handleStrikeTouch(e); }}
            onTouchEnd={(e)   => { e.preventDefault(); setStrikePressed(false); }}
            onTouchCancel={(e)=> { e.preventDefault(); setStrikePressed(false); }}>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Strike</span>
          </button>

          {/* DUCK — Green */}
          <button
            style={arcadeBtn('#44bb44', '#228822', '#114411', duckPressed)}
            onTouchStart={(e) => { e.preventDefault(); touchState.duck = true; setDuckPressed(true); }}
            onTouchEnd={(e)   => { e.preventDefault(); touchState.duck = false; setDuckPressed(false); }}
            onTouchCancel={(e)=> { e.preventDefault(); touchState.duck = false; setDuckPressed(false); }}>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Duck</span>
          </button>

        </div>
      </div>

    </div>
  );
}
