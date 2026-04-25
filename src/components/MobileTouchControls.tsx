import { useEffect, useRef, useState } from 'react';
import type { TouchInputState } from '@/game/controls';

interface Props {
  touchState: TouchInputState;
  canStrike: boolean;
  onStrike: () => void;
}

export default function MobileTouchControls({ touchState, canStrike, onStrike }: Props) {
  const zoneRef   = useRef<HTMLDivElement>(null);
  const [stickVisible, setStickVisible] = useState(false);
  const [stickBase,    setStickBase]    = useState({ x: 0, y: 0 });
  const [knobPos,      setKnobPos]      = useState({ x: 0, y: 0 });
  const [jumpPressed,   setJumpPressed]   = useState(false);
  const [strikePressed, setStrikePressed] = useState(false);

  const STICK_MAX  = 36; // max knob travel in px
  const DEAD       = 10; // dead zone

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = el.getBoundingClientRect();
      setStickBase({ x: t.clientX - rect.left, y: t.clientY - rect.top });
      setKnobPos({ x: 0, y: 0 });
      setStickVisible(true);
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = el.getBoundingClientRect();
      const bx = stickBaseRef.current.x + rect.left;
      const by = stickBaseRef.current.y + rect.top;
      const dx = t.clientX - bx;
      const dy = t.clientY - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, STICK_MAX);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * clamped;
      const ky = Math.sin(angle) * clamped;
      setKnobPos({ x: kx, y: ky });
      touchState.left  = dx < -DEAD;
      touchState.right = dx > DEAD;
    };

    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      setStickVisible(false);
      setKnobPos({ x: 0, y: 0 });
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

  // Ref to keep stickBase accessible inside closure without re-binding
  const stickBaseRef = useRef({ x: 0, y: 0 });
  useEffect(() => { stickBaseRef.current = stickBase; }, [stickBase]);

  function handleStrikeTouch(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    touchState.strikeQueued = true;
    onStrike();
  }

  // Wrapper style — handles only the press/bounce animation, no color filter here
  const btnWrapper = (pressed: boolean) => ({
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
  });

  const imgStyle = (colorFilter: string, pressed: boolean, active: boolean = true) => {
    const base = colorFilter ? `${colorFilter} ` : '';
    return {
      width: 70,
      height: 70,
      pointerEvents: 'none' as const,
      userSelect: 'none' as const,
      filter: !active
        ? `${base}brightness(0.4) saturate(0.2) drop-shadow(0 2px 4px rgba(0,0,0,0.4))`
        : pressed
          ? `${base}brightness(0.75) drop-shadow(0 1px 3px rgba(0,0,0,0.5))`
          : `${base}drop-shadow(0 4px 10px rgba(0,0,0,0.5))`,
    };
  };

  const NO_FILTER     = '';
  const YELLOW_FILTER = 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.2)';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', zIndex: 20 }} aria-hidden>

      {/* LEFT — Virtual Thumbstick zone */}
      <div ref={zoneRef} style={{
        position: 'absolute', left: 0, bottom: 0,
        width: '45%', height: '55%',
        pointerEvents: 'auto', touchAction: 'none',
      }}>
        {stickVisible && (
          <>
            {/* Outer ring — layered borders + subtle glow */}
            <div style={{
              position: 'absolute',
              left: stickBase.x - 52, top: stickBase.y - 52,
              width: 104, height: 104,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '2px solid rgba(255,255,255,0.28)',
              boxShadow: '0 0 0 4px rgba(255,255,255,0.07), 0 0 18px 4px rgba(180,210,255,0.18)',
              pointerEvents: 'none',
            }}>
              {/* Inner decorative ring */}
              <div style={{
                position: 'absolute', inset: 8,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.12)',
              }}/>
            </div>

            {/* Knob — inner thumb circle */}
            <div style={{
              position: 'absolute',
              left: stickBase.x - 22 + knobPos.x,
              top:  stickBase.y - 22 + knobPos.y,
              width: 44, height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.22)',
              border: '2px solid rgba(255,255,255,0.55)',
              boxShadow: '0 0 0 3px rgba(255,255,255,0.08), 0 0 12px 2px rgba(180,210,255,0.25)',
              pointerEvents: 'none',
              transition: 'none',
            }}/>
          </>
        )}
      </div>

      {/* RIGHT — 3 Arcade Buttons vertical stack */}
      <div style={{ position: 'absolute', right: 18, bottom: 70, pointerEvents: 'auto' }}>
        {/* Floating buttons — no panel */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-evenly',
          gap: 10,
        }}>

          {/* JUMP — yellow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              style={btnWrapper(jumpPressed)}
              onTouchStart={(e) => { e.preventDefault(); touchState.jump = true; setJumpPressed(true); }}
              onTouchEnd={(e)   => { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}>
              <img src="/button.png" alt="Jump" draggable={false} style={imgStyle(YELLOW_FILTER, jumpPressed)} />
            </button>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Jump</span>
          </div>

          {/* STRIKE — red */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              style={btnWrapper(strikePressed)}
              onTouchStart={(e) => { e.preventDefault(); setStrikePressed(true); handleStrikeTouch(e); }}
              onTouchEnd={(e)   => { e.preventDefault(); setStrikePressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); setStrikePressed(false); }}>
              <img src="/button.png" alt="Strike" draggable={false} style={imgStyle(NO_FILTER, strikePressed, canStrike)} />
            </button>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Strike</span>
          </div>



        </div>
      </div>

    </div>
  );
}
