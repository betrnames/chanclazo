import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

// Simple Angry Birds style slingshot mini-game
// Using Chanclazo characters as "birds" (projectiles)
// Structures protect sugar skull enemies
// Limited "sandals" (launches)

interface SlingshotProps {
  onBack: () => void;
}

interface Block {
  body: Matter.Body;
  type: 'wood' | 'stone' | 'ice';
  health: number;
}

interface Target {
  body: Matter.Body;
  type: 'pinata' | 'sugarskull';
  health: number;
  visualSize?: number;
}

const Slingshot = ({ onBack }: SlingshotProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setShotsLeft] = useState(4);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<'aiming' | 'launched' | 'won' | 'lost' | 'ready'>('ready');
  const [projectileType, setProjectileType] = useState<'chancla' | 'sugarskull' | 'luchador'>('chancla');

  // Matter.js refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  // Game objects
  const blocksRef = useRef<Block[]>([]);
  const enemiesRef = useRef<Target[]>([]);
  const groundRef = useRef<Matter.Body | null>(null);
  const slingshotPos = { x: 180, y: 420 }; // left side
  const shotsLeftRef = useRef(4);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'aiming' | 'launched' | 'won' | 'lost' | 'ready'>('ready');
  const rafRef = useRef<number | null>(null);
  const spinFrameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const projectileTypeRef = useRef<'chancla' | 'sugarskull' | 'luchador'>('chancla');
  const bgThemeRef = useRef<'original'|'casa'|'mercado'|'plaza'|'arena'|'lasalla'>('casa');

  // Drag state
  const dragRef = useRef<{ active: boolean; start: {x:number,y:number}; current: {x:number,y:number} }>({
    active: false,
    start: {x:0,y:0},
    current: {x:0,y:0}
  });

  const imagesRef = useRef<Record<string, HTMLImageElement | null>>({});

  // Load character sprites for projectiles
  useEffect(() => {
    const loadImage = (src: string) => {
      return new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn('Failed to load image:', src);
          resolve(null);
        };
        img.src = src;
      });
    };

    const loadAll = async () => {
      const imgs: Record<string, HTMLImageElement | null> = {};
      try {
        // Background for the stage - Mexican Dia de los Muertos inspired
        imgs.bg = await loadImage('/slingshot_bg.jpg');
        // Projectile: chancla_spin sprite sheet (5x5 animated spins)
        imgs.chancla = await loadImage('/chancla_spin.png');
        // Enemy / old
        imgs.sugarskull = await loadImage('/sugarskull.png');
        // New stack targets
        imgs.pinata = await loadImage('/pinata.png');
        // Luchador head for striker
        imgs.luchadorHead = await loadImage('/luchadorHead.png');
        // 5+ backgrounds for different themes
        imgs.bg = await loadImage('/slingshot_bg.jpg');
        imgs.bgCasa = await loadImage('/bg_casa.jpg');
        imgs.bgMercado = await loadImage('/bg_mercado.jpg');
        imgs.bgPlaza = await loadImage('/bg_plaza.jpg');
        imgs.bgArena = await loadImage('/bg_arena.jpg');
        imgs.bgLasalla = await loadImage('/bg_lasalla.jpg');
        // Fallbacks for other images if needed elsewhere
        imgs.boy = await loadImage('/boy.png');
        imgs.girl = await loadImage('/girl.png');
        imgs.luchador = await loadImage('/luchador.png');
      } catch (e) {
        console.warn('Some sprites failed to load, using fallbacks');
      }
      imagesRef.current = imgs;
    };

    loadAll();
  }, []);

  // Initialize Matter.js world and level
  const initPhysics = (levelNum: number = 1, shouldBuildStack = true) => {
    const engine = Matter.Engine.create();
    const world = engine.world;
    engineRef.current = engine;
    worldRef.current = world;

    // Gravity - similar to original game feel
    engine.gravity.y = 1.2;

    // Ground
    const ground = Matter.Bodies.rectangle(640, 580, 1280, 40, {
      isStatic: true,
      restitution: 0.1,
      friction: 0.8,
    });
    Matter.World.add(world, ground);
    groundRef.current = ground;

    // Left wall
    const leftWall = Matter.Bodies.rectangle(20, 300, 40, 600, { isStatic: true });
    // Right wall
    const rightWall = Matter.Bodies.rectangle(1260, 300, 40, 600, { isStatic: true });
    Matter.World.add(world, [leftWall, rightWall]);

    if (shouldBuildStack) {
      buildLevel(world, levelNum);

      // Extra manual settle steps for the floating pinata grid so it is perfectly at rest
      // and does not visibly fall/shift on the very first render frames
      for (let s = 0; s < 5; s++) {
        Matter.Engine.update(engine, 1000 / 60);
      }
      // re-zero velocities after the settle passes
      enemiesRef.current.forEach(e => {
        Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(e.body, 0);
      });
    } else {
      blocksRef.current = [];
      enemiesRef.current = [];
    }

    // Reset shots
    shotsLeftRef.current = levelNum <= 2 ? 4 : 3;
    setShotsLeft(shotsLeftRef.current);

    // Mouse drag for slingshot (custom, not full mouse constraint for rubber band feel)
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.onmousedown = handleMouseDown;
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = handleMouseUp;
    canvas.onmouseleave = handleMouseUp;

    // Touch support
    canvas.ontouchstart = (e) => {
      e.preventDefault();
      handleMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
    };
    canvas.ontouchmove = (e) => {
      e.preventDefault();
      handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
    };
    canvas.ontouchend = (e) => {
      e.preventDefault();
      handleMouseUp();
    };

    // Collision handling for destruction (no Runner - we drive updates in renderLoop)
    Matter.Events.on(engine, 'collisionStart', (event) => {
      handleCollisions(event);
    });

    if (shouldBuildStack) {
      setGameState('aiming');
      gameStateRef.current = 'aiming';
    } else {
      setGameState('ready');
      gameStateRef.current = 'ready';
    }
  };

  const buildLevel = (world: Matter.World, levelNum: number) => {
    // Clear previous
    blocksRef.current.forEach(b => Matter.World.remove(world, b.body));
    enemiesRef.current.forEach(e => Matter.World.remove(world, e.body));
    blocksRef.current = [];
    enemiesRef.current = [];

    // Square or vertical rectangle formation of pinatas on the right side as a focused target.
    // Smaller, tighter for mobile-first, not too big. Square for lower levels, taller vertical rect for higher.
    // Spans roughly the right 40% of the screen, positioned for good slingshot targeting.
    const gridLeft = 780;   // right side
    const gridRight = 1200;
    const gridTop = 100;
    const gridBottom = 500;

    let cols = 3;  // vertical rectangle feel
    let rows;
    if (levelNum === 1) { rows = 4; }      // small square-ish 3x4
    else if (levelNum === 2) { rows = 5; }
    else if (levelNum === 3) { rows = 6; }
    else if (levelNum === 4) { rows = 7; }
    else { rows = 8; }                     // taller vertical for challenge

    const spacingX = (gridRight - gridLeft) / (cols - 1);
    const spacingY = (gridBottom - gridTop) / (rows - 1);
    const pinataR = Math.min(spacingX, spacingY) * 0.42;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gridLeft + c * spacingX;
        const y = gridTop + r * spacingY;
        const body = Matter.Bodies.circle(x, y, pinataR, {
          isStatic: true,
          restitution: 0.35, friction: 0.4, density: 0.0006, label: 'target'
        });
        Matter.World.add(world, body);
        const visualSize = pinataR * 2.3;
        enemiesRef.current.push({ body, type: 'pinata', health: 80 + levelNum * 5, visualSize });
      }
    }

    // Zero any initial velocities so the stacks rest completely still on spawn (no pre-launch wobble or drop)
    blocksRef.current.forEach(b => {
      Matter.Body.setVelocity(b.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(b.body, 0);
    });
    enemiesRef.current.forEach(e => {
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(e.body, 0);
    });
  };



  // Simple collision handling for destruction
  const handleCollisions = (event: Matter.IEventCollision<Matter.Engine>) => {
    const pairs = event.pairs;
    const groundBody = groundRef.current;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Ignore collisions with the ground (prevents the pinatas from being destroyed by their own initial settling/fall)
      const involvesGround = (bodyA === groundBody || bodyB === groundBody);

      // Damage blocks (reverse iterate for safe splice while removing)
      for (let j = blocksRef.current.length - 1; j >= 0; j--) {
        const block = blocksRef.current[j];
        if (!involvesGround && (block.body === bodyA || block.body === bodyB)) {
          const force = Math.abs(pair.collision.depth * 80);
          block.health -= force;
          if (block.health <= 0) {
            Matter.World.remove(worldRef.current!, block.body);
            blocksRef.current.splice(j, 1);
            setScore(s => {
              const ns = s + 50;
              scoreRef.current = ns;
              return ns;
            });
          }
        }
      }

      // Damage enemies (reverse iterate for safe splice)
      for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
        const enemy = enemiesRef.current[j];
        if (!involvesGround && (enemy.body === bodyA || enemy.body === bodyB)) {
          const force = Math.min(Math.abs(pair.collision.depth * 55), 45); // cap direct hit damage
          enemy.health -= force;
          if (enemy.body.isStatic) {
            Matter.Body.setStatic(enemy.body, false);
          }
          if (enemy.health <= 0) {
            // Explode and destroy around it (chain reaction for nearby pinatas)
            if (enemy.type === 'pinata') {
              const deadPos = enemy.body.position;
              const expRadius = 55;  // smaller: only affects immediate neighbors in the grid
              const expDmg = 18;     // mild area damage so it softens but doesn't one-shot the whole cluster
              for (let k = enemiesRef.current.length - 1; k >= 0; k--) {
                const other = enemiesRef.current[k];
                if (other.body === enemy.body) continue;
                const dvec = Matter.Vector.sub(other.body.position, deadPos);
                const dist = Matter.Vector.magnitude(dvec);
                if (dist > 0 && dist < expRadius) {
                  if (other.body.isStatic) {
                    Matter.Body.setStatic(other.body, false);
                  }
                  other.health -= expDmg * (1 - dist / expRadius);
                  // push nearby (main "explode" effect)
                  const dir = Matter.Vector.normalise(dvec);
                  const f = 0.9 * (1 - dist / expRadius);
                  Matter.Body.applyForce(other.body, other.body.position, Matter.Vector.mult(dir, f));
                  if (other.health <= 0) {
                    Matter.World.remove(worldRef.current!, other.body);
                    enemiesRef.current.splice(k, 1);
                    setScore(s => {
                      const ns = s + 150;
                      scoreRef.current = ns;
                      return ns;
                    });
                  }
                }
              }
            }
            Matter.World.remove(worldRef.current!, enemy.body);
            enemiesRef.current.splice(j, 1);
            setScore(s => {
              const ns = s + 150;
              scoreRef.current = ns;
              return ns;
            });
          }
        }
      }

      // Grandma special ability: extra push on impact (leftover, harmless since no 'grandma' labels now)
      const isGrandmaHit = (bodyA.label && bodyA.label.includes('grandma')) || (bodyB.label && bodyB.label.includes('grandma'));
      if (isGrandmaHit) {
        const hitBody = bodyA.label && bodyA.label.includes('grandma') ? bodyB : bodyA;
        const hitPos = hitBody.position;
        [...blocksRef.current, ...enemiesRef.current].forEach(item => {
          const otherBody = item.body;
          const dist = Matter.Vector.magnitude(Matter.Vector.sub(otherBody.position, hitPos));
          if (dist < 140 && dist > 5) {
            const dir = Matter.Vector.normalise(Matter.Vector.sub(otherBody.position, hitPos));
            const extraForce = 0.01 / (dist / 40 + 1);
            Matter.Body.applyForce(otherBody, otherBody.position, Matter.Vector.mult(dir, extraForce));
          }
        });
      }
    }
  };

  // Mouse handlers for slingshot
  const handleMouseDown = (e: React.MouseEvent | MouseEvent) => {
    if (gameStateRef.current !== 'aiming' || shotsLeftRef.current <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (('clientX' in e ? e.clientX : 0) - rect.left) * scaleX;
    const y = (('clientY' in e ? e.clientY : 0) - rect.top) * scaleY;

    // Check if clicking near the floating sandal (larger hit area for bigger graphic)
    const dist = Math.hypot(x - slingshotPos.x, y - slingshotPos.y);
    if (dist < 110) {
      dragRef.current.active = true;
      dragRef.current.start = { x, y };
      dragRef.current.current = { x, y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!dragRef.current.active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (('clientX' in e ? e.clientX : 0) - rect.left) * scaleX;
    const y = (('clientY' in e ? e.clientY : 0) - rect.top) * scaleY;

    // Constrain pull distance
    const dx = x - slingshotPos.x;
    const dy = y - slingshotPos.y;
    const dist = Math.hypot(dx, dy);
    const maxPull = 140; // a bit more room since sandal is bigger and floating

    let finalX = x;
    let finalY = y;

    if (dist > maxPull) {
      const ratio = maxPull / dist;
      finalX = slingshotPos.x + dx * ratio;
      finalY = slingshotPos.y + dy * ratio;
    }

    dragRef.current.current = { x: finalX, y: finalY };
  };

  const handleMouseUp = () => {
    if (!dragRef.current.active || shotsLeftRef.current <= 0) {
      dragRef.current.active = false;
      return;
    }

    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) {
      dragRef.current.active = false;
      return;
    }
    const drag = dragRef.current;

    const dx = slingshotPos.x - drag.current.x;
    const dy = slingshotPos.y - drag.current.y;
    const power = Math.min(Math.hypot(dx, dy) * 0.18, 22); // power scaling

    const vx = dx * power / 12;
    const vy = dy * power / 12;

    // Launch the chancla (sandal) projectile from the current dragged position (no more fixed pouch)
    const releaseX = drag.current.x;
    const releaseY = drag.current.y;
    const birdBody = Matter.Bodies.circle(releaseX, releaseY, 30, {
      restitution: 0.4,
      friction: 0.5,
      density: 0.0015,
      label: 'projectile',
    });
    (birdBody as any).projectileType = projectileTypeRef.current;

    Matter.Body.setVelocity(birdBody, { x: vx, y: vy });

    Matter.World.add(world, birdBody);

    shotsLeftRef.current--;
    setShotsLeft(shotsLeftRef.current);

    dragRef.current.active = false;
    setGameState('launched');
    gameStateRef.current = 'launched';

    // Check win/lose after physics settles
    setTimeout(() => {
      checkWinLose();
    }, 1400);
  };

  const checkWinLose = () => {
    const livingEnemies = enemiesRef.current.length;

    if (livingEnemies === 0) {
      setGameState('won');
      gameStateRef.current = 'won';
      setScore(s => {
        const ns = s + 400;
        scoreRef.current = ns;
        return ns;
      });
    } else if (shotsLeftRef.current <= 0) {
      setGameState('lost');
      gameStateRef.current = 'lost';
    } else {
      setGameState('aiming');
      gameStateRef.current = 'aiming';
    }
  };

  // Main render + physics loop (drives the Matter updates + custom 2D draw)
  const renderLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current || !worldRef.current) {
      // Keep the loop alive in case refs get set shortly after (defensive)
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true })!;
    const engine = engineRef.current;
    const world = worldRef.current;

    // Update physics (single source of truth; no Runner used)
    Matter.Engine.update(engine, 1000 / 60);

    // Prune stopped or out of bounds projectiles to keep world clean
    const allBodies: any[] = (world as any).bodies || [];
    for (let i = allBodies.length - 1; i >= 0; i--) {
      const b = allBodies[i];
      if (b && b.label === 'chancla') {
        const v = b.velocity || { x: 0, y: 0 };
        const spd = Math.hypot(v.x, v.y);
        if ((spd < 0.05 && b.position.y > 520) || b.position.y > 650 || b.position.x < -50 || b.position.x > 1330) {
          Matter.World.remove(world, b);
        }
      }
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background drawn full screen inside the canvas (which is now 100% viewport).
    // Uses cover to fill the logical 1280x600 (then CSS stretches the whole to full screen).
    const theme = bgThemeRef.current;
    let bgKey = 'bg';
    if (theme === 'casa') bgKey = 'bgCasa';
    else if (theme === 'mercado') bgKey = 'bgMercado';
    else if (theme === 'plaza') bgKey = 'bgPlaza';
    else if (theme === 'arena') bgKey = 'bgArena';
    else if (theme === 'lasalla') bgKey = 'bgLasalla';
    const bgImg = imagesRef.current[bgKey] || imagesRef.current.bg;
    if (bgImg) {
      const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
      const dw = bgImg.width * scale;
      const dh = bgImg.height * scale;
      const dx = (canvas.width - dw) / 2;
      const dy = (canvas.height - dh) / 2;
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#3a2f1f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Advance chancla spin animation (~8 fps for visible spin on the 5x5 sheet)
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    spinFrameRef.current = (spinFrameRef.current + (dt / 125)) % 25;

    // Animated hover for the floating ready sandal (no slingshot device)
    let hoverOffset = { x: 0, y: 0 };
    if (!dragRef.current.active && (gameStateRef.current === 'aiming' || gameStateRef.current === 'ready')) {
      const t = (now / 1000) * 1.8;
      hoverOffset.y = Math.sin(t) * 10;           // vertical bob
      hoverOffset.x = Math.sin(t * 0.6) * 4;      // gentle side-to-side
    }

    // Ground (drawn on top of bg; pinatas will fall here if knocked down)
    ctx.fillStyle = 'rgba(92, 64, 51, 0.85)';
    ctx.fillRect(0, 560, 1280, 40);
    ctx.fillStyle = 'rgba(58, 42, 31, 0.9)';
    ctx.fillRect(0, 555, 1280, 8);

    // Draw blocks
    blocksRef.current.forEach((block) => {
      const pos = block.body.position;
      const angle = block.body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      let color = '#8B5A2B'; // wood default
      if (block.type === 'stone') color = '#555';
      if (block.type === 'ice') color = '#7dd3fc';

      ctx.fillStyle = color;
      ctx.fillRect(-22, -12, 44, 24);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.strokeRect(-22, -12, 44, 24);

      // Simple damage lines for fun
      if (block.health < 20) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-15, -8);
        ctx.lineTo(12, 6);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw targets (floating square grid of pinatas/llama pinatas on right)
    enemiesRef.current.forEach((target) => {
      const pos = target.body.position;
      const angle = target.body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      let img: HTMLImageElement | null = null;
      let sz = 50;
      if (target.type === 'pinata') {
        img = imagesRef.current.pinata || null;
        // visual damage feedback: pinatas shrink as they take damage
        const baseSz = target.visualSize || 50;
        const maxHealth = 80 + (levelRef.current || 1) * 5;
        const healthRatio = Math.max(0.35, target.health / maxHealth);
        sz = baseSz * healthRatio;
      } else {
        img = imagesRef.current.sugarskull || null;
        sz = 36;
      }

      if (img) {
        ctx.drawImage(img, -sz/2, -sz/2, sz, sz);
      } else {
        // fallback
        ctx.fillStyle = '#f1e7d2';
        ctx.beginPath();
        ctx.arc(0, 0, sz/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw slingshot base and rubber  -- REMOVED per request (no more sling device)
    const drag = dragRef.current;
    const birdPos = drag.active 
      ? { x: drag.current.x, y: drag.current.y } 
      : { x: slingshotPos.x, y: slingshotPos.y };

    // Draw launched projectiles (chancla or sugarskull depending on user choice)
    const launchedProjectiles: any[] = allBodies.filter((b: any) => {
      if (!b || (b.label !== 'chancla' && b.label !== 'projectile')) return false;
      const v = b.velocity || { x: 0, y: 0 };
      const spd = Math.hypot(v.x, v.y);
      return spd > 0.1;
    });
    const cols = 5;
    const rows = 5;
    const frame = Math.floor(spinFrameRef.current);
    launchedProjectiles.forEach((body: any) => {
      const pos = body.position;
      const angle = body.angle;
      const pType = (body as any).projectileType || 'chancla';
      let projImg = imagesRef.current.chancla;
      if (pType === 'sugarskull') projImg = imagesRef.current.sugarskull;
      else if (pType === 'luchador') projImg = imagesRef.current.luchadorHead;
      if (projImg) {
        if (pType === 'chancla') {
          const fw = imagesRef.current.chancla!.width / cols;
          const fh = imagesRef.current.chancla!.height / rows;
          const sx = (frame % cols) * fw;
          const sy = Math.floor(frame / cols) * fh;
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(angle);
          const size = 60;
          ctx.drawImage(imagesRef.current.chancla!, sx, sy, fw, fh, -size/2, -size/2, size, size);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(angle);
          const size = 60;
          ctx.drawImage(projImg, -size/2, -size/2, size, size);
          ctx.restore();
        }
      }
    });

    // Ready floating striker (chancla or sugarskull based on choice, with hover)
    if (!drag.active && (gameStateRef.current === 'aiming' || gameStateRef.current === 'ready')) {
      const pType = projectileTypeRef.current;
      let projImg = imagesRef.current.chancla;
      if (pType === 'sugarskull') projImg = imagesRef.current.sugarskull;
      else if (pType === 'luchador') projImg = imagesRef.current.luchadorHead;
      if (projImg) {
        if (pType === 'chancla') {
          const fw = imagesRef.current.chancla!.width / cols;
          const fh = imagesRef.current.chancla!.height / rows;
          const sx = 0; // idle frame only (first frame of sheet)
          const sy = 0;
          const readyX = slingshotPos.x + hoverOffset.x;
          const readyY = slingshotPos.y + hoverOffset.y;
          ctx.save();
          ctx.translate(readyX, readyY);
          ctx.rotate(Math.sin((now / 1000) * 1.5) * 0.12);
          const size = 60;
          ctx.drawImage(imagesRef.current.chancla!, sx, sy, fw, fh, -size/2, -size/2, size, size);
          ctx.restore();
        } else {
          const readyX = slingshotPos.x + hoverOffset.x;
          const readyY = slingshotPos.y + hoverOffset.y;
          ctx.save();
          ctx.translate(readyX, readyY);
          const size = 60;
          ctx.drawImage(projImg, -size/2, -size/2, size, size);
          ctx.restore();
        }
      }
    }

    // Currently pulled / aiming striker (bigger, follows drag)
    if (drag.active) {
      const pType = projectileTypeRef.current;
      let projImg = imagesRef.current.chancla;
      if (pType === 'sugarskull') projImg = imagesRef.current.sugarskull;
      else if (pType === 'luchador') projImg = imagesRef.current.luchadorHead;
      if (projImg) {
        if (pType === 'chancla') {
          const fw = imagesRef.current.chancla!.width / cols;
          const fh = imagesRef.current.chancla!.height / rows;
          const sx = (frame % cols) * fw;
          const sy = Math.floor(frame / cols) * fh;
          ctx.save();
          ctx.translate(birdPos.x, birdPos.y);
          const size = 60;
          ctx.drawImage(imagesRef.current.chancla!, sx, sy, fw, fh, -size/2, -size/2, size, size);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(birdPos.x, birdPos.y);
          const size = 60;
          ctx.drawImage(projImg, -size/2, -size/2, size, size);
          ctx.restore();
        }
      }
    }

    // Curved dotted trajectory preview (line of sight) while the sandal is grabbed
    // Shows the approximate direction of travel + gravity arc flowing towards the enemy stacks
    if (drag.active) {
      // Compute the velocity that will be used on release (exact same calc as handleMouseUp)
      const dx = slingshotPos.x - birdPos.x;
      const dy = slingshotPos.y - birdPos.y;
      const dist = Math.hypot(dx, dy);
      const maxPullLocal = 140;
      let pdx = dx;
      let pdy = dy;
      if (dist > maxPullLocal) {
        const ratio = maxPullLocal / dist;
        pdx *= ratio;
        pdy *= ratio;
      }
      const power = Math.min(Math.hypot(pdx, pdy) * 0.18, 22);
      let simVX = pdx * power / 12;
      let simVY = pdy * power / 12;

      // Forward simulation for the curved arc (tuned approx to match the actual Matter physics arc)
      let simX = birdPos.x;
      let simY = birdPos.y;
      const g = 0.72; // gravity per preview step

      ctx.fillStyle = 'rgba(255, 240, 160, 0.75)'; // soft yellow/gold dots, good contrast on the bg
      for (let i = 0; i < 75; i++) {
        if (i % 3 === 0 && i > 1) {
          // dotted line of sight style
          ctx.beginPath();
          ctx.arc(simX, simY, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
        simX += simVX * 0.62;
        simY += simVY * 0.62;
        simVY += g;

        if (simY > 565 || simX > 1260 || simX < 30) break;
      }
    }

    // UI overlay text (use refs so live values even if closure was from previous render)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(`Level ${levelRef.current}`, 40, 40);
    ctx.fillText(`Score: ${scoreRef.current}`, 40, 65);
    ctx.fillText(`Chanclas left: ${shotsLeftRef.current}`, 40, 90);

    if (gameStateRef.current === 'won') {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 32px system-ui';
      ctx.fillText('STRUCTURE DESTROYED!', 380, 280);
      ctx.font = '18px system-ui';
      ctx.fillText('Click anywhere to continue', 420, 320);
    }
    if (gameStateRef.current === 'lost') {
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 32px system-ui';
      ctx.fillText('OUT OF SANDALS!', 420, 280);
      ctx.font = '18px system-ui';
      ctx.fillText('Click to retry level', 470, 320);
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  };

  // Start / restart level
  const startLevel = (newLevel = 1) => {
    // Cancel any previous animation frame to prevent multiple loops or stale ones
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (engineRef.current && worldRef.current) {
      // Clear previous world
      Matter.World.clear(worldRef.current, false);
      Matter.Engine.clear(engineRef.current);
    }

    setLevel(newLevel);
    levelRef.current = newLevel;
    // Only reset score for brand new game (level 1); advancing levels carries score + win bonus
    if (newLevel === 1) {
      setScore(0);
      scoreRef.current = 0;
    }
    setGameState('aiming');
    gameStateRef.current = 'aiming';

    initPhysics(newLevel);

    // Start render loop (after refs are set in init)
    rafRef.current = requestAnimationFrame(renderLoop);
  };

  // Start from the READY screen (called by the big button on page load)
  const beginGame = () => {
    projectileTypeRef.current = projectileType;
    // Random background each play (no user choice)
    const themes: ('original'|'casa'|'mercado'|'plaza'|'arena'|'lasalla')[] = ['original','casa','mercado','plaza','arena','lasalla'];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    bgThemeRef.current = randomTheme;
    startLevel(1);
  };

  // Canvas click for win/lose states
  const handleCanvasClick = () => {
    if (gameStateRef.current === 'won') {
      startLevel(levelRef.current + 1);
    } else if (gameStateRef.current === 'lost') {
      startLevel(levelRef.current);
    }
  };

  // Init on mount - setup stage but show READY button first (no stack until clicked)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1280;
    canvas.height = 600;

    // Setup engine/ground/walls + render loop, but do NOT build the enemy stack yet
    initPhysics(1, false);

    // Random background for ready preview (and re-random on start for the game)
    const themes: ('original'|'casa'|'mercado'|'plaza'|'arena'|'lasalla')[] = ['original','casa','mercado','plaza','arena','lasalla'];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    bgThemeRef.current = randomTheme;

    // Start render loop immediately so background + floating sandal are visible on ready screen
    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      // Cleanup
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (runnerRef.current && engineRef.current) {
        Matter.Runner.stop(runnerRef.current);
      }
      if (worldRef.current && engineRef.current) {
        Matter.World.clear(worldRef.current, false);
        Matter.Engine.clear(engineRef.current);
      }
      if (canvas) {
        canvas.onmousedown = null;
        canvas.onmousemove = null;
        canvas.onmouseup = null;
        canvas.ontouchstart = null;
        canvas.ontouchmove = null;
        canvas.ontouchend = null;
      }
      engineRef.current = null;
      worldRef.current = null;
      runnerRef.current = null;
    };
  }, []);



  return (
    <div className="fixed inset-0 bg-[#1a140f] z-50 relative">
      {/* Canvas is now absolute inset-0 full screen, no container limiting it.
          Background is drawn full screen inside the canvas using cover.
          Header and footer are overlaid on top (semi-transparent so bg shows through).
          Mobile-first: full viewport on any device, content stretches to fill. */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={600}
        className="absolute inset-0 z-0 cursor-crosshair"
        style={{ width: '100%', height: '100%' }}
        onClick={handleCanvasClick}
      />

      {/* Header overlaid */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-black/60 text-white text-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs font-bold"
          >
            BACK TO MAIN GAME
          </button>
          <div className="font-bold tracking-widest">CHANCLA STRIKE</div>
          <div className="text-orange-400">Level {level}</div>
        </div>
        <div>Score: <span className="font-mono text-yellow-400">{score}</span></div>
        <div className="text-xs opacity-70">Pull back • Release to launch • Limited strikes</div>
      </div>

      {/* Footer overlaid */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-2 bg-black/70 text-[10px] text-orange-300 flex gap-2 justify-center">
        <div>Pull back • Release to launch • Limited strikes</div>
      </div>

      {/* READY overlay - full screen on top for the choose UI */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ background: 'rgba(0, 0, 0, 0.75)' }}>
          <div className="text-center">
            <div className="text-[72px] font-black text-white tracking-[6px] drop-shadow-[0_4px_0_#000] mb-1">READY?</div>

            {/* Striker selector only - background is now random per play */}
            <div className="mb-3">
              <p className="font-black text-orange-200 text-[10px] tracking-wide text-center mb-1">CHOOSE</p>
              <div className="flex items-end justify-center gap-2 py-1">
                {(() => {
                  const order: ('chancla' | 'sugarskull' | 'luchador')[] = ['chancla', 'sugarskull', 'luchador'];
                  const idx = order.indexOf(projectileType);
                  const leftId = order[(idx - 1 + 3) % 3];
                  const centerId = projectileType;
                  const rightId = order[(idx + 1) % 3];

                  const getStriker = (id: 'chancla' | 'sugarskull' | 'luchador') => {
                    if (id === 'chancla') return { name: 'SANDAL', avatar: '/chancla_spin.png' };
                    if (id === 'sugarskull') return { name: 'SKULL', avatar: '/sugarskull.png' };
                    return { name: 'LUCHADOR', avatar: '/luchadorHead.png' };
                  };

                  const left = getStriker(leftId);
                  const center = getStriker(centerId);
                  const right = getStriker(rightId);

                  return (
                    <>
                      <button
                        onClick={() => { setProjectileType(leftId); projectileTypeRef.current = leftId; }}
                        className="flex flex-col items-center transition-all opacity-40 hover:opacity-70 active:scale-95"
                      >
                        <div className="h-14 w-14 flex items-center justify-center overflow-hidden" style={
                          leftId === 'chancla' ? {
                            backgroundImage: `url(${left.avatar})`,
                            backgroundSize: '500% 500%',
                            backgroundPosition: '0% 0%',
                            imageRendering: 'pixelated',
                            backgroundRepeat: 'no-repeat'
                          } : {}
                        }>
                          {leftId !== 'chancla' && <img src={left.avatar} alt={left.name} className="max-h-12 max-w-12 object-contain" style={{ imageRendering: 'pixelated' }} />}
                        </div>
                        <span className="text-[7px] font-black text-orange-200 mt-0.5 tracking-wider">{left.name}</span>
                      </button>

                      <button
                        onClick={() => { /* current */ }}
                        className="flex flex-col items-center transition-all scale-[1.15]"
                      >
                        <div className="h-20 w-20 flex items-center justify-center overflow-hidden -mt-2" style={
                          centerId === 'chancla' ? {
                            backgroundImage: `url(${center.avatar})`,
                            backgroundSize: '500% 500%',
                            backgroundPosition: '0% 0%',
                            imageRendering: 'pixelated',
                            backgroundRepeat: 'no-repeat'
                          } : {}
                        }>
                          {centerId !== 'chancla' && <img src={center.avatar} alt={center.name} className="max-h-20 max-w-20 object-contain drop-shadow-lg" style={{ imageRendering: 'pixelated' }} />}
                        </div>
                        <span className="text-[9px] font-black text-orange-100 -mt-1 tracking-wider">{center.name}</span>
                      </button>

                      <button
                        onClick={() => { setProjectileType(rightId); projectileTypeRef.current = rightId; }}
                        className="flex flex-col items-center transition-all opacity-40 hover:opacity-70 active:scale-95"
                      >
                        <div className="h-14 w-14 flex items-center justify-center overflow-hidden" style={
                          rightId === 'chancla' ? {
                            backgroundImage: `url(${right.avatar})`,
                            backgroundSize: '500% 500%',
                            backgroundPosition: '0% 0%',
                            imageRendering: 'pixelated',
                            backgroundRepeat: 'no-repeat'
                          } : {}
                        }>
                          {rightId !== 'chancla' && <img src={right.avatar} alt={right.name} className="max-h-12 max-w-12 object-contain" style={{ imageRendering: 'pixelated' }} />}
                        </div>
                        <span className="text-[7px] font-black text-orange-200 mt-0.5 tracking-wider">{right.name}</span>
                      </button>
                    </>
                  );
                })()}
              </div>

              <div className="flex justify-center gap-2 pt-0.5">
                <button
                  onClick={() => {
                    const order: ('chancla' | 'sugarskull' | 'luchador')[] = ['chancla', 'sugarskull', 'luchador'];
                    const idx = order.indexOf(projectileType);
                    const next = order[(idx - 1 + 3) % 3];
                    setProjectileType(next);
                    projectileTypeRef.current = next;
                  }}
                  className="text-orange-400 hover:text-orange-200 text-base font-black px-1 leading-none"
                >
                  ←
                </button>
                <button
                  onClick={() => {
                    const order: ('chancla' | 'sugarskull' | 'luchador')[] = ['chancla', 'sugarskull', 'luchador'];
                    const idx = order.indexOf(projectileType);
                    const next = order[(idx + 1) % 3];
                    setProjectileType(next);
                    projectileTypeRef.current = next;
                  }}
                  className="text-orange-400 hover:text-orange-200 text-base font-black px-1 leading-none"
                >
                  →
                </button>
              </div>
            </div>

            <button
              onClick={beginGame}
              className="mt-1 px-20 py-7 text-4xl font-black tracking-[3px] bg-gradient-to-b from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 active:from-orange-800 text-white rounded-3xl shadow-[0_10px_0_#7c2d12] active:shadow-[0_3px_0_#7c2d12] active:translate-y-[4px] border-[5px] border-orange-900 transition-all"
            >
              START
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Slingshot;