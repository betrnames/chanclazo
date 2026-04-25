import { useEffect, useRef, useState } from 'react';
import type { TouchInputState } from '@/game/controls';

interface Props {
  touchState: TouchInputState;
  canStrike: boolean;
  onStrike: () => void;
}

export default function MobileTouchControls({ touchState, canStrike, onStrike }: Props) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [dpadActive, setDpadActive] = useState<'left'|'right'|'up'|'down'|null>(null);
  const [jumpPressed,   setJumpPressed]   = useState(false);
  const [strikePressed, setStrikePressed] = useState(false);

  useEffect(() => {
    const el = joystickRef.current;
    if (!el) return;

    const getDir = (e: TouchEvent): 'left'|'right'|'up'|'down'|null => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = e.changedTouches[0].clientX - cx;
      const dy = e.changedTouches[0].clientY - cy;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return null;
      return Math.abs(dx) >= Math.abs(dy)
        ? (dx < 0 ? 'left' : 'right')
        : (dy < 0 ? 'up'   : 'down');
    };

    const applyDir = (dir: 'left'|'right'|'up'|'down'|null) => {
      touchState.left  = dir === 'left';
      touchState.right = dir === 'right';
      setDpadActive(dir);
    };

    const onStart = (e: TouchEvent) => { e.preventDefault(); applyDir(getDir(e)); };
    const onMove  = (e: TouchEvent) => { e.preventDefault(); applyDir(getDir(e)); };
    const onEnd   = (e: TouchEvent) => { e.preventDefault(); applyDir(null); };

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

      {/* LEFT — CSS D-Pad */}
      <div style={{ position: 'absolute', left: 18, bottom: 70, pointerEvents: 'auto' }}>
        <div ref={joystickRef} style={{
          width: 96, height: 96,
          position: 'relative', touchAction: 'none',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.35)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {/* UP */}
          <div style={{
            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
            width: 32, height: 32, borderRadius: 7,
            background: dpadActive === 'up' ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.07s',
          }}>
            <svg width="13" height="11" viewBox="0 0 13 11"><path d="M6.5 1L12 10H1Z" fill="rgba(255,255,255,0.88)"/></svg>
          </div>
          {/* DOWN */}
          <div style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            width: 32, height: 32, borderRadius: 7,
            background: dpadActive === 'down' ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.07s',
          }}>
            <svg width="13" height="11" viewBox="0 0 13 11"><path d="M6.5 10L1 1H12Z" fill="rgba(255,255,255,0.88)"/></svg>
          </div>
          {/* LEFT */}
          <div style={{
            position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: 7,
            background: dpadActive === 'left' ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.07s',
          }}>
            <svg width="11" height="13" viewBox="0 0 11 13"><path d="M1 6.5L10 1V12Z" fill="rgba(255,255,255,0.88)"/></svg>
          </div>
          {/* RIGHT */}
          <div style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: 7,
            background: dpadActive === 'right' ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.07s',
          }}>
            <svg width="11" height="13" viewBox="0 0 11 13"><path d="M10 6.5L1 1V12Z" fill="rgba(255,255,255,0.88)"/></svg>
          </div>
          {/* CENTER circle */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: '1.5px solid rgba(255,255,255,0.25)',
          }}/>
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
