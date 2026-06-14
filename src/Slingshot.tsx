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

interface Enemy {
  body: Matter.Body;
  health: number;
}

const Slingshot = ({ onBack }: SlingshotProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setShotsLeft] = useState(4);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [, setGameState] = useState<'aiming' | 'launched' | 'won' | 'lost'>('aiming');

  // Matter.js refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  // Game objects
  const blocksRef = useRef<Block[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const groundRef = useRef<Matter.Body | null>(null);
  const slingshotPos = { x: 180, y: 420 }; // left side
  const shotsLeftRef = useRef(4);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'aiming' | 'launched' | 'won' | 'lost'>('aiming');
  const rafRef = useRef<number | null>(null);
  const spinFrameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

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
        // Enemy
        imgs.sugarskull = await loadImage('/sugarskull.png');
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
  const initPhysics = (levelNum: number = 1) => {
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

    // Build a simple starting structure (pyramid + enemies)
    buildLevel(world, levelNum);

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

    setGameState('aiming');
    gameStateRef.current = 'aiming';
  };

  const addCrate = (world: Matter.World, x: number, y: number, w = 48, h = 28, type: 'wood' | 'stone' | 'ice' = 'wood') => {
    let options = { restitution: 0.25, friction: 0.65, density: 0.0012 };
    if (type === 'stone') {
      options = { restitution: 0.08, friction: 0.9, density: 0.003 };
    } else if (type === 'ice') {
      options = { restitution: 0.5, friction: 0.15, density: 0.0006 };
    }
    const body = Matter.Bodies.rectangle(x, y, w, h, options);
    Matter.World.add(world, body);
    const health = type === 'stone' ? 85 : type === 'ice' ? 28 : 42;
    blocksRef.current.push({ body, type, health });
  };

  const buildLevel = (world: Matter.World, levelNum: number) => {
    // Clear previous
    blocksRef.current.forEach(b => Matter.World.remove(world, b.body));
    enemiesRef.current.forEach(e => Matter.World.remove(world, e.body));
    blocksRef.current = [];
    enemiesRef.current = [];

    const baseY = 530;
    const baseX = 920;

    if (levelNum === 1) {
      // Basic stack: 3 crates wide base, sugarskull on top
      addCrate(world, baseX, baseY, 48, 28, 'wood');
      addCrate(world, baseX + 52, baseY, 48, 28, 'wood');
      addCrate(world, baseX + 26, baseY - 32, 48, 28, 'stone');
      // sugarskull on top
      const skull = Matter.Bodies.circle(baseX + 26, baseY - 68, 19, {
        restitution: 0.35, friction: 0.35, density: 0.0008, label: 'sugarskull'
      });
      Matter.World.add(world, skull);
      enemiesRef.current.push({ body: skull, health: 22 });
    } else if (levelNum === 2) {
      // Wider pyramid-ish with 2 skulls
      for (let i = 0; i < 4; i++) {
        addCrate(world, baseX - 20 + i * 48, baseY, 45, 26, i % 2 === 0 ? 'wood' : 'stone');
      }
      addCrate(world, baseX + 4, baseY - 30, 45, 26, 'ice');
      addCrate(world, baseX + 52, baseY - 30, 45, 26, 'ice');
      const skull1 = Matter.Bodies.circle(baseX + 28, baseY - 65, 18, {
        restitution: 0.4, friction: 0.3, density: 0.0007, label: 'sugarskull'
      });
      Matter.World.add(world, skull1);
      enemiesRef.current.push({ body: skull1, health: 18 });
      // side small stack
      addCrate(world, baseX + 140, baseY, 40, 25, 'wood');
      addCrate(world, baseX + 140, baseY - 28, 40, 25, 'stone');
      const skull2 = Matter.Bodies.circle(baseX + 140, baseY - 58, 16, {
        restitution: 0.35, friction: 0.35, density: 0.0006, label: 'sugarskull'
      });
      Matter.World.add(world, skull2);
      enemiesRef.current.push({ body: skull2, health: 14 });
    } else {
      // Level 3: bigger challenge
      for (let i = 0; i < 5; i++) {
        addCrate(world, baseX - 40 + i * 46, baseY, 42, 25, 'wood');
      }
      for (let i = 0; i < 3; i++) {
        addCrate(world, baseX - 10 + i * 46, baseY - 28, 42, 25, 'stone');
      }
      addCrate(world, baseX + 15, baseY - 56, 42, 25, 'ice');
      const skull1 = Matter.Bodies.circle(baseX + 36, baseY - 88, 17, {
        restitution: 0.3, friction: 0.4, density: 0.0006, label: 'sugarskull'
      });
      Matter.World.add(world, skull1);
      enemiesRef.current.push({ body: skull1, health: 16 });
      // floating small stack on right
      addCrate(world, baseX + 160, baseY - 10, 38, 24, 'stone');
      addCrate(world, baseX + 160, baseY - 38, 38, 24, 'ice');
      const skull2 = Matter.Bodies.circle(baseX + 160, baseY - 68, 15, {
        restitution: 0.4, friction: 0.3, density: 0.0005, label: 'sugarskull'
      });
      Matter.World.add(world, skull2);
      enemiesRef.current.push({ body: skull2, health: 12 });
    }
  };



  // Simple collision handling for destruction
  const handleCollisions = (event: Matter.IEventCollision<Matter.Engine>) => {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Damage blocks (reverse iterate for safe splice while removing)
      for (let j = blocksRef.current.length - 1; j >= 0; j--) {
        const block = blocksRef.current[j];
        if (block.body === bodyA || block.body === bodyB) {
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
        if (enemy.body === bodyA || enemy.body === bodyB) {
          const force = Math.abs(pair.collision.depth * 60);
          enemy.health -= force;
          if (enemy.health <= 0) {
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

    // Check if clicking near slingshot area
    const dist = Math.hypot(x - slingshotPos.x, y - slingshotPos.y);
    if (dist < 80) {
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
    const maxPull = 120;

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

    // Launch the chancla (sandal) projectile - only one type now
    const birdBody = Matter.Bodies.circle(slingshotPos.x, slingshotPos.y, 21, {
      restitution: 0.4,
      friction: 0.5,
      density: 0.0015,
      label: 'chancla',
    });

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

    // Background - Dia de los Muertos Mexican stage (set the festive scene)
    const bgImg = imagesRef.current.bg;
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#3a2f1f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Advance chancla spin animation (~8 fps for visible spin on the 5x5 sheet)
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    spinFrameRef.current = (spinFrameRef.current + (dt / 125)) % 25;

    // Ground (drawn on top of bg for a solid stage floor the crates rest on)
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

    // Draw enemies (sugar skulls using user image)
    const skullImg = imagesRef.current.sugarskull;
    enemiesRef.current.forEach((enemy) => {
      const pos = enemy.body.position;
      const angle = enemy.body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      if (skullImg) {
        const s = 38;
        ctx.drawImage(skullImg, -s/2, -s/2, s, s);
      } else {
        // fallback simple skull
        ctx.fillStyle = '#f1e7d2';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.fillRect(-6, -5, 4, 4);
        ctx.fillRect(2, -5, 4, 4);
        ctx.beginPath();
        ctx.moveTo(-5, 6);
        ctx.lineTo(5, 6);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Draw slingshot base and rubber
    const drag = dragRef.current;
    const birdPos = drag.active 
      ? { x: drag.current.x, y: drag.current.y } 
      : { x: slingshotPos.x, y: slingshotPos.y };

    // Posts
    ctx.fillStyle = '#3a2a1f';
    ctx.fillRect(slingshotPos.x - 8, slingshotPos.y - 60, 6, 70);
    ctx.fillRect(slingshotPos.x + 2, slingshotPos.y - 60, 6, 70);

    // Rubber bands
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(slingshotPos.x - 5, slingshotPos.y - 35);
    ctx.lineTo(birdPos.x, birdPos.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(slingshotPos.x + 5, slingshotPos.y - 35);
    ctx.lineTo(birdPos.x, birdPos.y);
    ctx.stroke();

    // Draw launched projectiles (chancla_spin animated sprite sheet)
    const launchedChanclas: any[] = allBodies.filter((b: any) => {
      if (!b || b.label !== 'chancla') return false;
      const v = b.velocity || { x: 0, y: 0 };
      const spd = Math.hypot(v.x, v.y);
      return spd > 0.1;
    });
    const chanclaImg = imagesRef.current.chancla;
    const cols = 5;
    const rows = 5;
    const frame = Math.floor(spinFrameRef.current);
    launchedChanclas.forEach((body: any) => {
      const pos = body.position;
      const angle = body.angle;
      if (chanclaImg) {
        const fw = chanclaImg.width / cols;
        const fh = chanclaImg.height / rows;
        const sx = (frame % cols) * fw;
        const sy = Math.floor(frame / cols) * fh;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        const size = 42;
        ctx.drawImage(chanclaImg, sx, sy, fw, fh, -size/2, -size/2, size, size);
        ctx.restore();
      }
    });

    // Current held projectile (chancla on slingshot) - still spins for fun
    if (drag.active && chanclaImg) {
      const fw = chanclaImg.width / cols;
      const fh = chanclaImg.height / rows;
      const sx = (frame % cols) * fw;
      const sy = Math.floor(frame / cols) * fh;
      ctx.save();
      ctx.translate(birdPos.x, birdPos.y);
      const size = 42;
      ctx.drawImage(chanclaImg, sx, sy, fw, fh, -size/2, -size/2, size, size);
      ctx.restore();
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

  // Canvas click for win/lose states
  const handleCanvasClick = () => {
    if (gameStateRef.current === 'won') {
      startLevel(levelRef.current + 1);
    } else if (gameStateRef.current === 'lost') {
      startLevel(levelRef.current);
    }
  };

  // Init on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1280;
    canvas.height = 600;

    // Start first level
    startLevel(1);

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
    <div className="fixed inset-0 bg-[#1a140f] z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 text-white text-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs font-bold"
          >
            ← BACK TO MAIN GAME
          </button>
          <div className="font-bold tracking-widest">ANGRY CHANCLAS</div>
          <div className="text-orange-400">Level {level}</div>
        </div>
        <div>Score: <span className="font-mono text-yellow-400">{score}</span></div>
        <div className="text-xs opacity-70">Drag the character back on the slingshot • Release to launch • Limited launches</div>
      </div>

      <div className="flex-1 flex items-center justify-center relative bg-black/30">
        <canvas 
          ref={canvasRef} 
          width={1280}
          height={600}
          className="border border-orange-900/50 shadow-2xl cursor-crosshair"
          style={{ width: 'min(100%, 1280px)', height: 'auto' }}
          onClick={handleCanvasClick}
        />
      </div>

      <div className="px-4 py-2 bg-black/70 text-[10px] text-orange-300 flex gap-2 justify-center">
        <div>Launch the spinning chancla to knock down the crates and defeat the sugarskulls!</div>
      </div>
    </div>
  );
};

export default Slingshot;