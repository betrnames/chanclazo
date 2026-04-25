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

  // CSS virtual button — layered border + glow to match thumbstick
  const virtualBtn = (pressed: boolean, color: string, glowColor: string, active: boolean = true): React.CSSProperties => ({
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: pressed
      ? `rgba(${color},0.35)`
      : `rgba(${color},0.12)`,
    border: `2px solid rgba(${color},${active ? (pressed ? '0.9' : '0.55') : '0.2'})`,
    boxShadow: active
      ? pressed
        ? `0 0 0 4px rgba(${color},0.12), 0 0 14px 3px rgba(${glowColor},0.35)`
        : `0 0 0 4px rgba(${color},0.07), 0 0 18px 4px rgba(${glowColor},0.2)`
      : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    cursor: 'pointer',
    userSelect: 'none' as const,
    transform: pressed ? 'scale(0.88)' : 'scale(1)',
    transition: pressed
      ? 'transform 0.05s ease-in, background 0.05s, box-shadow 0.05s'
      : 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.12s, box-shadow 0.12s',
    opacity: active ? 1 : 0.35,
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', zIndex: 20 }} aria-hidden>

      {/* LEFT — Virtual Thumbstick zone */}
      <div ref={zoneRef} style={{
        position: 'absolute', left: 0, bottom: 0,
        width: '45%', height: '55%',
        pointerEvents: 'auto', touchAction: 'none',
      }}>
        {/* Ghost hint — always visible so player knows where to touch */}
        {!stickVisible && (
          <div style={{
            position: 'absolute',
            left: 52, bottom: 52,
            width: 80, height: 80,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.12)',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute', inset: 10,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.07)',
            }}/>
            {/* Tiny center dot */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 8, height: 8, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
            }}/>
          </div>
        )}

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
              <div style={{
                position: 'absolute', inset: 8,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.12)',
              }}/>
            </div>

            {/* Knob */}
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

      {/* RIGHT — Virtual action buttons */}
      <div style={{ position: 'absolute', right: 18, bottom: 24, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

          {/* JUMP — yellow/amber */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={virtualBtn(jumpPressed, '255,210,80', '255,220,100')}
              onTouchStart={(e) => { e.preventDefault(); touchState.jump = true; setJumpPressed(true); }}
              onTouchEnd={(e)   => { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); touchState.jump = false; setJumpPressed(false); }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" style={{ pointerEvents: 'none' }}>
                <path d="M11 3L11 14M6 8L11 3L16 8" stroke="rgba(255,220,100,0.95)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <rect x="5" y="17" width="12" height="2.5" rx="1.25" fill="rgba(255,220,100,0.7)"/>
              </svg>
            </div>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,220,100,0.45)' }}>Jump</span>
          </div>

          {/* STRIKE — red/coral, dims when on cooldown */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={virtualBtn(strikePressed, '255,90,90', '255,120,100', canStrike)}
              onTouchStart={(e) => { e.preventDefault(); setStrikePressed(true); if (canStrike) handleStrikeTouch(e); }}
              onTouchEnd={(e)   => { e.preventDefault(); setStrikePressed(false); }}
              onTouchCancel={(e)=> { e.preventDefault(); setStrikePressed(false); }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" style={{ pointerEvents: 'none' }}>
                <path d="M12.5 2L5 12.5H10.5L9.5 20L17 9.5H11.5L12.5 2Z" stroke="rgba(255,100,90,0.95)" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,90,90,0.25)"/>
              </svg>
            </div>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,100,90,0.45)' }}>Strike</span>
          </div>

        </div>
      </div>

    </div>
  );
}
