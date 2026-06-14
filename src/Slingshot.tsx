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
  type: 'dish' | 'beerbottle' | 'pinata' | 'sugarskull';
  health: number;
}

const Slingshot = ({ onBack }: SlingshotProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setShotsLeft] = useState(4);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<'aiming' | 'launched' | 'won' | 'lost' | 'ready'>('ready');
  const [projectileType, setProjectileType] = useState<'chancla' | 'sugarskull'>('chancla');

  // Matter.js refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const worldRef = useRef<Matter.World | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  // Game objects
  const blocksRef = useRef<Block[]>([]);
  const enemiesRef = useRef<Target[]>([]);
  const standsRef = useRef<Matter.Body[]>([]);
  const groundRef = useRef<Matter.Body | null>(null);
  const slingshotPos = { x: 180, y: 420 }; // left side
  const shotsLeftRef = useRef(4);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'aiming' | 'launched' | 'won' | 'lost' | 'ready'>('ready');
  const rafRef = useRef<number | null>(null);
  const spinFrameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const projectileTypeRef = useRef<'chancla' | 'sugarskull'>('chancla');

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
        imgs.dish = await loadImage('/dishes.png');
        imgs.beerbottle = await loadImage('/beerbottle.png');
        imgs.pinata = await loadImage('/pinata.png');
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

      if (levelNum === 1) {
        // Extra manual settle steps for the pure skull triangle so it is perfectly at rest
        // and does not visibly fall/shift on the very first render frames
        for (let s = 0; s < 5; s++) {
          Matter.Engine.update(engine, 1000 / 60);
        }
        // re-zero velocities after the settle passes
        enemiesRef.current.forEach(e => {
          Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(e.body, 0);
        });
      }
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

  const addCrate = (world: Matter.World, x: number, y: number, w = 48, h = 28, type: 'wood' | 'stone' | 'ice' = 'wood') => {
    let options = { restitution: 0.1, friction: 0.7, density: 0.0015 }; // lower bounce so stacks settle cleanly on ground
    if (type === 'stone') {
      options = { restitution: 0.05, friction: 0.9, density: 0.004 };
    } else if (type === 'ice') {
      options = { restitution: 0.2, friction: 0.2, density: 0.0008 };
    }
    const body = Matter.Bodies.rectangle(x, y, w, h, options);
    Matter.World.add(world, body);
    const health = type === 'stone' ? 90 : type === 'ice' ? 30 : 45;
    blocksRef.current.push({ body, type, health });
  };

  const buildLevel = (world: Matter.World, levelNum: number) => {
    // Clear previous
    blocksRef.current.forEach(b => Matter.World.remove(world, b.body));
    enemiesRef.current.forEach(e => Matter.World.remove(world, e.body));
    standsRef.current.forEach(s => Matter.World.remove(world, s));
    blocksRef.current = [];
    enemiesRef.current = [];
    standsRef.current = [];

    const baseY = 546; // resting on top of ground (ground top edge ~560)
    const baseX = 920;

    if (levelNum === 1) {
      // Elevated stand/table + triangle stack of random mix (dishes, beerbottles, one piñata on top)
      // Positioned realistically on the right side so the arc from left slingshot feels natural.
      // Stand is static platform; targets stacked on top in triangle formation.

      const standX = 950;
      const standY = 465;      // center of stand
      const standW = 230;
      const standH = 22;

      const stand = Matter.Bodies.rectangle(standX, standY, standW, standH, {
        isStatic: true,
        restitution: 0.1,
        friction: 0.8,
        label: 'stand'
      });
      Matter.World.add(world, stand);
      standsRef.current.push(stand);

      const standTopY = standY - standH / 2;  // ~454

      // Triangle positions on top of the stand (4-3-2-1)
      const positions: {x: number, y: number}[] = [
        // bottom row 4, slightly above stand
        {x: standX - 54, y: standTopY - 14},
        {x: standX - 18, y: standTopY - 14},
        {x: standX + 18, y: standTopY - 14},
        {x: standX + 54, y: standTopY - 14},
        // row 3
        {x: standX - 36, y: standTopY - 45},
        {x: standX,     y: standTopY - 45},
        {x: standX + 36, y: standTopY - 45},
        // row 2
        {x: standX - 18, y: standTopY - 76},
        {x: standX + 18, y: standTopY - 76},
        // top
        {x: standX, y: standTopY - 107},
      ];

      let pinataPlaced = false;
      positions.forEach((pos, idx) => {
        let t: 'dish' | 'beerbottle' | 'pinata';
        if (idx === positions.length - 1) {
          t = 'pinata';
          pinataPlaced = true;
        } else if (!pinataPlaced && idx >= 6 && Math.random() < 0.5) {
          t = 'pinata';
          pinataPlaced = true;
        } else {
          t = Math.random() < 0.5 ? 'dish' : 'beerbottle';
        }

        let body: Matter.Body;
        let health = 25;
        if (t === 'pinata') {
          body = Matter.Bodies.circle(pos.x, pos.y, 24, {
            restitution: 0.25, friction: 0.5, density: 0.0005, label: 'target'
          });
          health = 55;
        } else if (t === 'dish') {
          body = Matter.Bodies.rectangle(pos.x, pos.y, 44, 15, {
            restitution: 0.15, friction: 0.65, density: 0.001, label: 'target'
          });
          health = 20;
        } else {
          body = Matter.Bodies.rectangle(pos.x, pos.y, 18, 36, {
            restitution: 0.2, friction: 0.75, density: 0.0008, label: 'target'
          });
          health = 26;
        }
        Matter.World.add(world, body);
        enemiesRef.current.push({ body, type: t, health });
      });
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
      enemiesRef.current.push({ body: skull1, type: 'sugarskull', health: 18 });
      // side small stack
      addCrate(world, baseX + 140, baseY, 40, 25, 'wood');
      addCrate(world, baseX + 140, baseY - 28, 40, 25, 'stone');
      const skull2 = Matter.Bodies.circle(baseX + 140, baseY - 58, 16, {
        restitution: 0.35, friction: 0.35, density: 0.0006, label: 'sugarskull'
      });
      Matter.World.add(world, skull2);
      enemiesRef.current.push({ body: skull2, type: 'sugarskull', health: 14 });
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
      enemiesRef.current.push({ body: skull1, type: 'sugarskull', health: 16 });
      // floating small stack on right
      addCrate(world, baseX + 160, baseY - 10, 38, 24, 'stone');
      addCrate(world, baseX + 160, baseY - 38, 38, 24, 'ice');
      const skull2 = Matter.Bodies.circle(baseX + 160, baseY - 68, 15, {
        restitution: 0.4, friction: 0.3, density: 0.0005, label: 'sugarskull'
      });
      Matter.World.add(world, skull2);
      enemiesRef.current.push({ body: skull2, type: 'sugarskull', health: 12 });
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

      // Ignore collisions with the ground or stand (prevents the stacks from being destroyed by their own initial settling/fall onto the platform)
      const involvesGroundOrStand = (bodyA === groundBody || bodyB === groundBody) ||
        standsRef.current.some(s => bodyA === s || bodyB === s);

      // Damage blocks (reverse iterate for safe splice while removing)
      for (let j = blocksRef.current.length - 1; j >= 0; j--) {
        const block = blocksRef.current[j];
        if (!involvesGroundOrStand && (block.body === bodyA || block.body === bodyB)) {
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
        if (!involvesGroundOrStand && (enemy.body === bodyA || enemy.body === bodyB)) {
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

    // Animated hover for the floating ready sandal (no slingshot device)
    let hoverOffset = { x: 0, y: 0 };
    if (!dragRef.current.active && (gameStateRef.current === 'aiming' || gameStateRef.current === 'ready')) {
      const t = (now / 1000) * 1.8;
      hoverOffset.y = Math.sin(t) * 10;           // vertical bob
      hoverOffset.x = Math.sin(t * 0.6) * 4;      // gentle side-to-side
    }

    // Ground (drawn on top of bg for a solid stage floor the stack rests on)
    ctx.fillStyle = 'rgba(92, 64, 51, 0.85)';
    ctx.fillRect(0, 560, 1280, 40);
    ctx.fillStyle = 'rgba(58, 42, 31, 0.9)';
    ctx.fillRect(0, 555, 1280, 8);

    // Draw the stand/table/box for the elevated stack (realistic placement, not flat on ground)
    standsRef.current.forEach((stand) => {
      const pos = stand.position;
      const angle = stand.angle;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      // Wooden table/stand with legs (fits party theme with dishes/beer/pinata)
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(-115, -11, 230, 22); // tabletop
      ctx.fillStyle = '#3a2a1f';
      ctx.fillRect(-100, 11, 14, 55);   // left leg
      ctx.fillRect(86, 11, 14, 55);     // right leg
      ctx.strokeStyle = '#2a1f0f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-115, -11, 230, 22);
      ctx.restore();
    });

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

    // Draw targets (dishes, beerbottles, pinata - random mix in triangle)
    enemiesRef.current.forEach((target) => {
      const pos = target.body.position;
      const angle = target.body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      let img: HTMLImageElement | null = null;
      let sz = 36;
      if (target.type === 'dish') {
        img = imagesRef.current.dish || null;
        sz = 42;
      } else if (target.type === 'beerbottle') {
        img = imagesRef.current.beerbottle || null;
        sz = 32;
      } else if (target.type === 'pinata') {
        img = imagesRef.current.pinata || null;
        sz = 50;
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
      const projImg = pType === 'sugarskull' ? imagesRef.current.sugarskull : imagesRef.current.chancla;
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
      const projImg = pType === 'sugarskull' ? imagesRef.current.sugarskull : imagesRef.current.chancla;
      if (projImg) {
        if (pType === 'chancla') {
          const fw = imagesRef.current.chancla!.width / cols;
          const fh = imagesRef.current.chancla!.height / rows;
          const sx = (frame % cols) * fw;
          const sy = Math.floor(frame / cols) * fh;
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
      const projImg = pType === 'sugarskull' ? imagesRef.current.sugarskull : imagesRef.current.chancla;
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
        <div className="text-xs opacity-70">Drag your striker back • Release to launch • Limited launches</div>
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

        {/* READY screen overlay on initial page load - big start button, stage + floating sandal already visible behind */}
        {gameState === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: 'rgba(26, 20, 15, 0.55)' }}>
            <div className="text-center">
              <div className="text-[72px] font-black text-white tracking-[6px] drop-shadow-[0_4px_0_#000] mb-1">READY?</div>

              {/* Projectile choice - user picks sandal or sugarskull as the striker */}
              <div className="mb-4">
                <div className="text-orange-300 text-xs tracking-[2px] mb-1.5">CHOOSE YOUR STRIKER</div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setProjectileType('chancla'); projectileTypeRef.current = 'chancla'; }}
                    className={`px-5 py-2 text-sm font-bold rounded-xl border transition-all ${projectileType === 'chancla' ? 'bg-orange-600 border-orange-400 scale-105' : 'bg-black/40 border-orange-800 hover:border-orange-500'}`}
                  >
                    🩴 SANDAL
                  </button>
                  <button
                    onClick={() => { setProjectileType('sugarskull'); projectileTypeRef.current = 'sugarskull'; }}
                    className={`px-5 py-2 text-sm font-bold rounded-xl border transition-all ${projectileType === 'sugarskull' ? 'bg-orange-600 border-orange-400 scale-105' : 'bg-black/40 border-orange-800 hover:border-orange-500'}`}
                  >
                    💀 SKULL
                  </button>
                </div>
              </div>

              <button
                onClick={beginGame}
                className="mt-1 px-20 py-7 text-4xl font-black tracking-[3px] bg-gradient-to-b from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 active:from-orange-800 text-white rounded-3xl shadow-[0_10px_0_#7c2d12] active:shadow-[0_3px_0_#7c2d12] active:translate-y-[4px] border-[5px] border-orange-900 transition-all"
              >
                START
              </button>
              <div className="text-orange-200 text-sm mt-4 tracking-[2px] font-bold">GRAB THE STRIKER • DRAG TO AIM • RELEASE TO DESTROY THE STACK</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-black/70 text-[10px] text-orange-300 flex gap-2 justify-center">
        <div>Drag your chosen striker (sandal or skull) • Release to launch • Destroy the random stack!</div>
      </div>
    </div>
  );
};

export default Slingshot;