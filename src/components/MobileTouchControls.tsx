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

  // Image button style — smash scale on press
  const imgBtn = (pressed: boolean, active: boolean = true) => ({
    width: 70,
    height: 70,
    border: 'none',
    outline: 'none',
    background: 'none',
    padding: 0,
    touchAction: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    cursor: 'pointer',
    userSelect: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: pressed ? 'scale(0.82) translateY(4px)' : 'scale(1) translateY(0)',
    transition: pressed ? 'transform 0.05s ease-in' : 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
    filter: pressed
      ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.5)) brightness(0.85)'
      : active
        ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.6)) brightness(1)'
        : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4)) brightness(0.5) saturate(0.3)',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', zIndex: 20 }} aria-hidden>

      {/* LEFT — Joystick (image only, no base) */}
      <div style={{ position: 'absolute', left: 18, bottom: 70, pointerEvents: 'auto' }}>
        {/* Drag zone — invisible, same size as image */}
        <div ref={joystickRef} style={{
          width: 72, height: 72,
          position: 'relative', touchAction: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img
            src="/joystickRed.png"
            alt="joystick"
            draggable={false}
            style={{
              width: 72, height: 72,
              transform: `translateX(${knobOffset * 18}px) rotate(${knobOffset * 14}deg)`,
              transition: knobOffset === 0 ? 'transform 0.15s ease-out' : 'none',
              pointerEvents: 'none',
              userSelect: 'none',
              filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.6))',
            }}
          />
        </div>
        <p style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.28)', marginTop: 3, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Move</p>
      </div>

      {/* RIGHT — 3 Arcade Buttons vertical stack */}
      <div style={{ position: 'absolute', right: 18, bottom: 70, pointerEvents: 'auto' }}>
        {/* Floating buttons — no panel */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-evenly',
          gap: 10,
        }}>

          {/* JUMP — buttons.png */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              style={imgBtn(jumpPressed)}
              onTouchStart={(e) => { e.preventDefault(); touchState.jump = true; setJumpPressed(true); }}
              onTouchEnd={(e)   => { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}>
              <img src="/buttons.png" alt="Jump" draggable={false}
                style={{ width: 70, height: 70, pointerEvents: 'none', userSelect: 'none' }} />
            </button>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Jump</span>
          </div>

          {/* STRIKE — buttons.png */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              style={imgBtn(strikePressed, canStrike)}
              onTouchStart={(e) => { e.preventDefault(); setStrikePressed(true); handleStrikeTouch(e); }}
              onTouchEnd={(e)   => { e.preventDefault(); setStrikePressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); setStrikePressed(false); }}>
              <img src="/buttons.png" alt="Strike" draggable={false}
                style={{ width: 70, height: 70, pointerEvents: 'none', userSelect: 'none' }} />
            </button>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Strike</span>
          </div>



        </div>
      </div>

    </div>
  );
}
