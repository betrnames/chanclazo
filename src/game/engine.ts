import * as THREE from 'three';
import type {
  GameCallbacks,
  GameInstance,
  PlayerState,
  MomState,
  ChanclaState,
  ParticleState,
  CatState,
  PanState,
  MouseState,
  CharacterGender,
} from './types';
import { LEVELS } from './types';
import { buildScene, buildCamera, createPlayer, createMom, addFurniture, ROOM, setLevelTheme, createCat, createDog, createPan, createMouse, createVibeJamPortal, animateVibeJamPortal } from './scene';
import { submitGhost } from '../api';
import type { GhostSnapshot } from '../api';
import { loadGhosts, updateGhosts, destroyGhosts } from './ghost';
import type { GhostPlayer } from './ghost';
import { loadGhosts, updateGhosts, destroyGhosts } from './ghost';
import type { GhostPlayer } from './ghost';
import { createControls } from './controls';
import type { TouchInputState } from './controls';
import {
  spawnChancla,
  updateChanclas,
  checkChanclaHitsPlayer,
  findStrikeTarget,
  strikeBackChancla,
  checkChanclaHitsMom,
  pruneExpiredChanclas,
  pickThrowStyle,
  nextThrowDelay,
  pickVolleySize,
} from './chancla';
import {
  updateParticles,
  spawnStrikeImpact,
  spawnMomHit,
  spawnBurst,
  spawnStars,
} from './particles';
import { getTexts, pickRandom } from './i18n';
import {
  initAudio,
  playWhoosh,
  playHit,
  playStrike,
  playMomHit,
  playDodge,
  playJump,
  playLevelUp,
  playGameOver,
  playShield,
  playCombo,
} from './sound';

// ─── Tunables ─────────────────────────────────────────────────────────────────
const PLAYER_SPEED = 7.0;
const JUMP_VELOCITY = 7.5;
const GRAVITY = -18.0;
const FLOOR_Y = 0.0;
const INVINCIBLE_DURATION = 1.2;
const SCORE_PER_SECOND = 8;
const SCORE_DODGE = 60;
const SCORE_STRIKE = 200;
const MAX_HEALTH = 3;
// Chance (0–1) that a mom-hit strike-back gives a heart or shield
const HEAL_CHANCE = 0.2;
const SHIELD_CHANCE = 0.25;
const SHIELD_DURATION = 3.5;

// ─── Main factory ─────────────────────────────────────────────────────────────
export function createGame(
  container: HTMLDivElement,
  callbacks: GameCallbacks,
  startLevel = 1,
  touchState?: TouchInputState,
  gender: CharacterGender = 'boy'
): GameInstance {
  // ── Three.js setup ────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = false;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  container.appendChild(renderer.domElement);

  const scene = buildScene();
  const camera = buildCamera();

  // ── Level state ───────────────────────────────────────────────────────────
  let currentLevelIndex = startLevel - 1; // 0-based
  const levelConfig = LEVELS[currentLevelIndex];
  let difficulty = levelConfig.baseDifficulty;
  let nextDifficultyTime = 15;

  // ── Game Objects ──────────────────────────────────────────────────────────
  const player: PlayerState = createPlayer(gender);
  scene.add(player.group);

  const mom: MomState = createMom();
  scene.add(mom.group);

  // Cat (levels 1-2) or Dog (levels 3+) — delayed 20s, mouse visible from level 2 onwards
  const cat: CatState = currentLevelIndex >= 2 ? createDog() : createCat();
  cat.group.visible = false; // hidden until delay expires
  scene.add(cat.group);
  const mouse: MouseState = createMouse();
  mouse.group.visible = currentLevelIndex >= 1;
  scene.add(mouse.group);

  // VibeJam 2026 portal — right wall
  const vibePortal = createVibeJamPortal(scene);
  let portalTriggered = false;
  const strikeRingGeo = new THREE.RingGeometry(0.9, 1.05, 24);
  const strikeRingMat = new THREE.MeshBasicMaterial({
    color: 0xFFD700, side: THREE.DoubleSide, transparent: true, opacity: 0,
  });
  const strikeRing = new THREE.Mesh(strikeRingGeo, strikeRingMat);
  strikeRing.rotation.x = -Math.PI / 2;
  scene.add(strikeRing);

  // Shield visual sphere around player
  const shieldGeo = new THREE.SphereGeometry(0.8, 12, 8);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x88DDFF, transparent: true, opacity: 0, wireframe: true,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  player.group.add(shieldMesh);
  shieldMesh.position.set(0, 0.8, 0);

  // ── State ─────────────────────────────────────────────────────────────────
  let chanclas: ChanclaState[] = [];
  let pans: PanState[] = [];
  let particles: ParticleState[] = [];
  let survivalTime = 0;
  let totalSurvival = 0;
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let health = MAX_HEALTH;
  let running = true;
  let rafId = 0;
  let strikeQueued = false;
  let shakeIntensity = 0;
  let momWindupTimer = 0;
  let momWindupActive = false;
  const CAT_DELAY = 20; // seconds before cat/dog appears
  let catActive = false;
  const MOM_WINDUP = 0.9;          // windup duration in seconds
  let throwCycleCount = 0;         // counts every throw
  let nextTsunamiAt = 3 + Math.floor(Math.random() * 3); // first tsunami at throw 3, 4, or 5
  let tsunamiQueued = false;       // true when next throw should be a tsunami

  // ── Ghost recording — snapshot player position every 0.5s ─────────────────
  const ghostSnapshots: GhostSnapshot[] = [];
  let ghostTimer = 0;
  const GHOST_INTERVAL = 0.5;

  // ── Ghost playback ────────────────────────────────────────────────────────
  let ghosts: GhostPlayer[] = [];
  loadGhosts(scene, currentLevelIndex + 1).then(loaded => { ghosts = loaded; });

  // Visual polish - vibrant low-poly style: apply initial theme + level clutter
  setLevelTheme(scene, currentLevelIndex);
  addFurniture(scene, currentLevelIndex);

  // First throw delay — generous grace period on Level 1
  const firstThrowGrace = currentLevelIndex === 0 ? 7.0 : 2.5;
  let nextThrowAt = firstThrowGrace;
  let nextPanAt = 8.0; // pans start appearing a bit later

  const clock = new THREE.Clock();
  const controls = createControls(touchState);
  const camTarget = new THREE.Vector3();
  const camLookTarget = new THREE.Vector3();

  // ── Resize ────────────────────────────────────────────────────────────────
  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  // ─── Main Loop ────────────────────────────────────────────────────────────
  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    survivalTime += dt;
    totalSurvival += dt;
    score += SCORE_PER_SECOND * dt;

    // ── Ghost snapshot recording ──────────────────────────────────────────
    ghostTimer += dt;
    if (ghostTimer >= GHOST_INTERVAL && ghostSnapshots.length < 300) {
      ghostSnapshots.push({
        t: Math.round(totalSurvival * 10) / 10,
        x: Math.round(player.x * 100) / 100,
        y: Math.round(player.y * 100) / 100,
        d: player.isDucking ? 1 : 0,
      });
      ghostTimer = 0;
    }

    // ── VibeJam portal: animate + proximity redirect ──────────────────────
    animateVibeJamPortal(vibePortal, totalSurvival);
    if (!portalTriggered) {
      const px = player.x;
      const pz = ROOM.playerZ;
      const portalX = 4.0;
      const portalZ = ROOM.playerZ - 1;
      const dist = Math.sqrt((px - portalX) ** 2 + (pz - portalZ) ** 2);
      if (dist < 1.5) {
        portalTriggered = true;
        const handle = localStorage.getItem('chanclazo-handle') || '';
        const url = new URL('https://vibej.am/portal/2026');
        if (handle) url.searchParams.set('username', handle);
        url.searchParams.set('ref', 'chanclazo.com');
        url.searchParams.set('color', 'orange');
        url.searchParams.set('hp', String(Math.round((health / 3) * 100)));
        window.location.href = url.toString();
      }
    }

    // ── In-level difficulty ramp ──────────────────────────────────────────
    if (survivalTime >= nextDifficultyTime) {
      difficulty++;
      nextDifficultyTime += 15;
    }

    // ── Level completion check ────────────────────────────────────────────
    const levelDone = survivalTime >= levelConfig.surviveSecs && score >= levelConfig.minScore;
    if (levelDone) {
      // Time bonus: extra 50 pts per second left (rounded)
      const timeBonus = Math.floor((levelConfig.surviveSecs - survivalTime + levelConfig.surviveSecs) * 0 + 500);
      score += timeBonus;
      running = false;
      cancelAnimationFrame(rafId);

      const handle = localStorage.getItem('chanclazo-handle') || 'ghost';
      submitGhost(handle, currentLevelIndex + 1, ghostSnapshots, Math.floor(score));
      if (currentLevelIndex >= LEVELS.length - 1) {
        playLevelUp();
        callbacks.onVictory(Math.floor(score), Math.floor(totalSurvival));
      } else {
        playLevelUp();
        callbacks.onLevelComplete(levelConfig.level, Math.floor(score), timeBonus);
      }
      return;
    }

    // ── Input ─────────────────────────────────────────────────────────────
    const input = controls.getInput();
    if (strikeQueued) { input.strikePressed = true; strikeQueued = false; }

    // ── Player ────────────────────────────────────────────────────────────
    updatePlayer(dt, input);

    // ── Cat + Mouse ───────────────────────────────────────────────────────
    updateMouse(dt);
    // Delay cat/dog appearance by CAT_DELAY seconds
    if (!catActive && survivalTime >= CAT_DELAY) {
      catActive = true;
      cat.group.visible = true;
    }
    if (catActive) updateCat(dt);

    // ── Shield timer ──────────────────────────────────────────────────────
    if (player.shieldTimer > 0) {
      player.shieldTimer -= dt;
      shieldMat.opacity = 0.25 + Math.sin(survivalTime * 8) * 0.15;
      if (player.shieldTimer <= 0) {
        shieldMat.opacity = 0;
      }
    }

    // ── Pan update ────────────────────────────────────────────────────────
    updatePans(dt);

    // ── Chancla update ────────────────────────────────────────────────────
    updateChanclas(chanclas, dt);

    // Detect dodged chanclas
    for (const ch of chanclas) {
      if (!ch.expired && !ch.struckBack && ch.group.position.z > ROOM.playerZ + 1.5) {
        ch.expired = true;
        ch.group.visible = false;
        if (Math.abs(ch.startPos.x - ch.targetPos.x) < 4) {
          score += SCORE_DODGE;
          playDodge();
          const texts = getTexts(callbacks.getLang());
          callbacks.onPopup(pickRandom(texts.dodge));
        }
      }
    }

    // Struck-back chanclas hitting mom
    for (const ch of chanclas) {
      if (checkChanclaHitsMom(ch)) {
        ch.expired = true;
        ch.group.visible = false;
        score += SCORE_STRIKE * Math.max(1, combo);
        mom.shakeTimer = 1.0;
        const hitPos = new THREE.Vector3(0, 1.5, ROOM.momZ);
        particles.push(...spawnMomHit(scene, hitPos));
        playMomHit();

        const texts = getTexts(callbacks.getLang());
        callbacks.onPopup(pickRandom(texts.momHit));

        // Chance to heal or gain shield
        const roll = Math.random();
        if (roll < HEAL_CHANCE && health < MAX_HEALTH) {
          health = Math.min(MAX_HEALTH, health + 1);
          callbacks.onPopup(pickRandom(texts.heal));
        } else if (roll < HEAL_CHANCE + SHIELD_CHANCE && player.shieldTimer <= 0) {
          player.shieldTimer = SHIELD_DURATION;
          playShield();
          callbacks.onPopup(pickRandom(texts.shield));
        }
      }
    }

    // Hit detection (skip when shielded or invincible)
    const isProtected = player.invincibleTimer > 0 || player.shieldTimer > 0;
    if (!isProtected) {
      for (const ch of chanclas) {
        if (checkChanclaHitsPlayer(ch, player)) {
          const impactPos = ch.group.position.clone();
          // Gold chancla — bigger burst, gold particles, 2x damage
          if (ch.isGold) {
            particles.push(...spawnBurst(scene, impactPos, 20, [0xFFD700, 0xFFA500, 0xFFFFFF], 6.5, 0.7));
            ch.expired = true;
            ch.group.visible = false;
            onPlayerHit();
            onPlayerHit(); // second hit = 2x damage
            callbacks.onPopup(callbacks.getLang() === 'es' ? '💛 ¡CHANCLA DORADA! -2 ❤️' : '💛 GOLD CHANCLA! -2 ❤️');
          } else {
            particles.push(...spawnBurst(scene, impactPos, 10, [0xFF6B6B, 0xFFD93D, 0xFFFFFF], 5.0, 0.5));
            ch.expired = true;
            ch.group.visible = false;
            onPlayerHit();
          }
          break;
        }
      }
    }

    // ── Strike back ───────────────────────────────────────────────────────
    if (input.strikePressed) {
      const target = findStrikeTarget(chanclas, player);
      if (target) {
        strikeBackChancla(target);
        combo++;
        comboTimer = 3.0;
        score += SCORE_STRIKE;
        shakeIntensity = 0.22;

        playStrike();

        const pos = target.group.position.clone();
        particles.push(...spawnStrikeImpact(scene, pos));

        const texts = getTexts(callbacks.getLang());
        callbacks.onPopup(pickRandom(texts.strike));
        if (combo >= 3) {
          playCombo(combo);
          // Star burst at strike position for combo flair
          particles.push(...spawnStars(scene, target.group.position.clone()));
          const comboTexts = texts.combo(combo);
          callbacks.onPopup(pickRandom(comboTexts));
        }
      }
    }

    // ── Combo timer ───────────────────────────────────────────────────────
    if (combo > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }

    // ── Particles ─────────────────────────────────────────────────────────
    particles = updateParticles(particles, scene, dt);
    chanclas = pruneExpiredChanclas(chanclas, scene);

    // ── Ghost playback ────────────────────────────────────────────────────
    updateGhosts(ghosts, dt, totalSurvival);

    // ── Strike ring ───────────────────────────────────────────────────────
    updateStrikeRing();
    callbacks.onStrikeAvailable?.(findStrikeTarget(chanclas, player) !== null);

    // ── Player flash timer ────────────────────────────────────────────────
    if (player.hitFlashTimer > 0) {
      player.hitFlashTimer -= dt;
      const flash = Math.sin(player.hitFlashTimer * 20) > 0;
      player.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj !== shieldMesh) obj.visible = flash || player.hitFlashTimer < 0.1;
      });
    } else {
      player.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj !== shieldMesh) obj.visible = true;
      });
    }
    if (player.invincibleTimer > 0) player.invincibleTimer -= dt;

    // ── Mom shake + arm + windup ──────────────────────────────────────────
    if (mom.shakeTimer > 0) {
      mom.shakeTimer -= dt;
      mom.group.position.x = Math.sin(mom.shakeTimer * 35) * 0.18;
    } else if (momWindupActive) {
      // Tsunami windup: dramatic scale pulse + rapid shake, gets more intense
      momWindupTimer -= dt;
      const progress = 1.0 - Math.max(0, momWindupTimer / MOM_WINDUP); // 0→1
      const pulse = 1.0 + Math.sin(progress * Math.PI) * 0.28;        // big scale pump
      mom.group.scale.set(pulse, pulse, 1);
      // Shake gets faster and wider as windup peaks
      const shakeSpeed = 18 + progress * 28;
      const shakeWidth = 0.08 + progress * 0.22;
      mom.group.position.x = Math.sin(survivalTime * shakeSpeed) * shakeWidth;
    } else {
      mom.group.position.x = 0;
      mom.group.scale.set(1, 1, 1);
    }
    const throwArm = mom.group.getObjectByName('throwArm');
    if (throwArm) throwArm.rotation.z = -1.1 + Math.sin(survivalTime * 3) * 0.25;

    // ── Walk cycle ────────────────────────────────────────────────────────
    if (input.left || input.right) {
      const legSwing = Math.sin(survivalTime * 10) * 0.3;
      const ll = player.group.getObjectByName('leftLeg');
      const rl = player.group.getObjectByName('rightLeg');
      if (ll) ll.rotation.x = legSwing;
      if (rl) rl.rotation.x = -legSwing;
    }

    // Visual polish - vibrant low-poly style: gentle idle bob for player and mom
    if (player.y <= 0.001 && !input.left && !input.right) {
      player.group.position.y = player.y + Math.sin(survivalTime * 2.2) * 0.018;
    }
    if (mom.shakeTimer <= 0) {
      mom.group.position.y = 0.05 + Math.sin(survivalTime * 1.8 + 1.0) * 0.022;
    }

    // ── Camera ────────────────────────────────────────────────────────────
    updateCamera(dt);

    // ── Score report ──────────────────────────────────────────────────────
    callbacks.onScoreUpdate(
      Math.floor(score),
      combo,
      Math.floor(survivalTime),
      health,
      player.shieldTimer > 0,
    );

    // ── Spawn chanclas (dynamic scheduler) ───────────────────────────────
    // Start windup animation MOM_WINDUP seconds before tsunami throw only
    if (!momWindupActive && tsunamiQueued && survivalTime >= nextThrowAt - MOM_WINDUP) {
      momWindupActive = true;
      momWindupTimer = MOM_WINDUP;
      // Warn the player!
      const texts = getTexts(callbacks.getLang());
      callbacks.onPopup(pickRandom(texts.tsunami));
    }
    if (survivalTime >= nextThrowAt) {
      throwCycleCount++;

      if (tsunamiQueued) {
        // ── TSUNAMI throw: 6–10 chanclas all at once, all styles ──────────
        const tsunamiSize = 6 + Math.floor(Math.random() * 5); // 6–10
        const styles: ReturnType<typeof pickThrowStyle>[] = ['quick_low','high_loop','side_angle','rapid_fire'];
        for (let v = 0; v < tsunamiSize; v++) {
          const style = styles[v % styles.length];
          chanclas.push(spawnChancla(scene, player, difficulty, style, v));
        }
        playWhoosh(1.8); // louder whoosh for tsunami
        tsunamiQueued = false;
        // Schedule next tsunami randomly 3–5 throws away
        nextTsunamiAt = throwCycleCount + 3 + Math.floor(Math.random() * 3);
        momWindupActive = false;
        momWindupTimer = 0;
      } else {
        // ── Normal throw ─────────────────────────────────────────────────
        const volleySize = pickVolleySize(difficulty);
        const style = pickThrowStyle(difficulty);
        for (let v = 0; v < volleySize; v++) {
          chanclas.push(spawnChancla(scene, player, difficulty, style, v));
        }
        playWhoosh(1.0 + difficulty * 0.05);
      }

      // Check if next throw should be a tsunami
      if (throwCycleCount >= nextTsunamiAt) {
        tsunamiQueued = true;
      }

      nextThrowAt = survivalTime + nextThrowDelay(difficulty);
    }

    // ── Spawn pans ────────────────────────────────────────────────────────
    if (survivalTime >= nextPanAt) {
      spawnPan();
      // Pan frequency scales with level — starts slow, gets more frequent
      const minDelay = Math.max(4.0, 12.0 - currentLevelIndex * 1.5);
      const maxDelay = Math.max(6.0, 18.0 - currentLevelIndex * 2.0);
      nextPanAt = survivalTime + minDelay + Math.random() * (maxDelay - minDelay);
    }

    renderer.render(scene, camera);
  }

  // ─── Player Update ────────────────────────────────────────────────────────
  function updatePlayer(dt: number, input: { left: boolean; right: boolean; jump: boolean; duck: boolean }) {
    if (input.left) {
      player.x = Math.max(ROOM.playerMinX, player.x - PLAYER_SPEED * dt);
      player.group.rotation.y = -0.25;
    } else if (input.right) {
      player.x = Math.min(ROOM.playerMaxX, player.x + PLAYER_SPEED * dt);
      player.group.rotation.y = 0.25;
    } else {
      player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, 0, 0.2);
    }

    const isGrounded = player.y <= 0.001;
    if (input.jump && isGrounded) { player.vy = JUMP_VELOCITY; playJump(); }

    player.isDucking = input.duck && isGrounded;
    const targetScaleY = player.isDucking ? 0.55 : 1.0;
    player.group.scale.y = THREE.MathUtils.lerp(player.group.scale.y, targetScaleY, 0.3);

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y < FLOOR_Y) { player.y = FLOOR_Y; player.vy = 0; }

    if (player.y > 0.05) {
      const stretchFactor = 1.0 + Math.abs(player.vy) * 0.015;
      player.group.scale.x = THREE.MathUtils.lerp(player.group.scale.x, 1 / stretchFactor, 0.3);
    } else {
      player.group.scale.x = THREE.MathUtils.lerp(player.group.scale.x, 1.0, 0.3);
    }
    player.group.position.x = player.x;
    player.group.position.y = player.y;
  }

  // ─── Camera Update ────────────────────────────────────────────────────────
  function updateCamera(dt: number) {
    const desiredPos = new THREE.Vector3(player.x * 0.6, 5.5 + player.y * 0.4, ROOM.playerZ + 7.5);
    const desiredLook = new THREE.Vector3(player.x * 0.3, 1.2, ROOM.playerZ - 3);
    camTarget.lerp(desiredPos, 6.0 * dt);
    camLookTarget.lerp(desiredLook, 6.0 * dt);
    camera.position.copy(camTarget);
    if (shakeIntensity > 0.001) {
      camera.position.x += (Math.random() - 0.5) * 2 * shakeIntensity;
      camera.position.y += (Math.random() - 0.5) * 2 * shakeIntensity;
      shakeIntensity *= 0.82;
    } else {
      shakeIntensity = 0;
    }
    camera.lookAt(camLookTarget);
  }

  // ─── Strike Ring ──────────────────────────────────────────────────────────
  function updateStrikeRing() {
    const target = findStrikeTarget(chanclas, player);
    if (target) {
      strikeRing.position.copy(target.group.position);
      strikeRing.position.y += 0.05;
      strikeRingMat.opacity = (0.6 + Math.sin(survivalTime * 12) * 0.4) * 0.85;
    } else {
      strikeRingMat.opacity = 0;
    }
  }

  // ─── On Player Hit ────────────────────────────────────────────────────────
  function onPlayerHit() {
    health = Math.max(0, health - 1);
    player.hitFlashTimer = 0.6;
    player.invincibleTimer = INVINCIBLE_DURATION;
    combo = 0;
    comboTimer = 0;
    shakeIntensity = 0.45; // boosted from 0.18

    playHit();

    const pos = new THREE.Vector3(player.x, player.y + 0.8, ROOM.playerZ);
    particles.push(...spawnBurst(scene, pos, 14, [0xFF6B6B, 0xFFD93D, 0xFFFFFF], 4.5, 0.6));

    const texts = getTexts(callbacks.getLang());
    callbacks.onPopup(pickRandom(texts.hit));

    if (health <= 0) {
      playGameOver();
      running = false;
      cancelAnimationFrame(rafId);
      // Submit ghost run before game over
      const handle = localStorage.getItem('chanclazo-handle') || 'ghost';
      submitGhost(handle, currentLevelIndex + 1, ghostSnapshots, Math.floor(score));
      callbacks.onGameOver(Math.floor(score), Math.floor(totalSurvival));
    }
  }

  // ─── Spawn Pan ────────────────────────────────────────────────────────────
  function spawnPan() {
    const group = createPan();
    scene.add(group);

    const startX = (Math.random() - 0.5) * 2;
    const startPos = new THREE.Vector3(startX, 0.55, ROOM.momZ); // flies LOW — must duck
    const targetX = THREE.MathUtils.clamp(
      player.x + (Math.random() - 0.5) * 1.5,
      ROOM.playerMinX, ROOM.playerMaxX
    );
    const targetPos = new THREE.Vector3(targetX, 0.55, ROOM.playerZ + 1);

    group.position.copy(startPos);

    const basePanSpeed = 0.55 + currentLevelIndex * 0.12; // gets faster each level
    const pan: PanState = {
      group,
      startPos,
      targetPos,
      t: 0,
      speed: basePanSpeed + Math.random() * 0.15,
      spinRate: 8 + Math.random() * 6,
      expired: false,
    };
    pans.push(pan);
  }

  // ─── Update Pans ──────────────────────────────────────────────────────────
  function updatePans(dt: number) {
    for (const pan of pans) {
      if (pan.expired) continue;

      pan.t += dt * pan.speed;

      if (pan.t >= 1.0) {
        pan.expired = true;
        pan.group.visible = false;
        continue;
      }

      // Flat trajectory — stays low, no arc (forces duck)
      const px = THREE.MathUtils.lerp(pan.startPos.x, pan.targetPos.x, pan.t);
      const pz = THREE.MathUtils.lerp(pan.startPos.z, pan.targetPos.z, pan.t);
      const py = 0.55; // stays at knee height the whole way
      pan.group.position.set(px, py, pz);

      // Spin flat like a frisbee
      pan.group.rotation.y += pan.spinRate * dt;

      // Hit detection — player must duck to avoid
      if (player.invincibleTimer <= 0 && player.shieldTimer <= 0) {
        const panPos = new THREE.Vector3(px, py, pz);
        const playerPos = new THREE.Vector3(player.x, player.y + 0.4, ROOM.playerZ);
        if (panPos.distanceTo(playerPos) < 0.65 && !player.isDucking) {
          pan.expired = true;
          pan.group.visible = false;
          const texts = getTexts(callbacks.getLang());
          callbacks.onPopup(pickRandom(texts.panHit));
          onPlayerHit();
        }
      }
    }

    // Prune expired pans
    pans = pans.filter((pan) => {
      if (pan.expired) { scene.remove(pan.group); return false; }
      return true;
    });
  }

  // ─── Mouse Update ─────────────────────────────────────────────────────────
  function updateMouse(dt: number) {
    // Mouse speed scales with level — faster in higher levels
    const mouseSpeed = 2.8 + currentLevelIndex * 0.35;

    // Mouse bounces off walls independently
    mouse.x += mouse.direction * mouseSpeed * dt;
    if (mouse.x > ROOM.playerMaxX + 0.3) { mouse.x = ROOM.playerMaxX + 0.3; mouse.direction = -1; }
    if (mouse.x < ROOM.playerMinX - 0.3) { mouse.x = ROOM.playerMinX - 0.3; mouse.direction = 1; }

    mouse.group.position.x = mouse.x;
    mouse.group.position.y = -0.4 + Math.abs(Math.sin(survivalTime * mouseSpeed * 2.5)) * 0.04;
    mouse.group.rotation.y = mouse.direction > 0 ? 0 : Math.PI;

    // Tail wag
    const tail = mouse.group.getObjectByName('mouseTail');
    if (tail) tail.rotation.z = 0.6 + Math.sin(survivalTime * 10) * 0.3;
  }

  // ─── Cat Update ───────────────────────────────────────────────────────────
  function updateCat(dt: number) {
    // Cat chases the mouse — always slightly slower so mouse stays ahead
    const catSpeed = 2.5 + currentLevelIndex * 0.30;
    const chaseDir = mouse.x > cat.x ? 1 : -1;
    cat.x += chaseDir * catSpeed * dt;

    // Clamp to room
    cat.x = THREE.MathUtils.clamp(cat.x, ROOM.playerMinX - 0.5, ROOM.playerMaxX + 0.5);
    cat.direction = chaseDir;

    cat.group.rotation.y = cat.direction > 0 ? 0 : Math.PI;
    cat.group.position.x = cat.x;

    // Tail wag
    const tail = cat.group.getObjectByName('tail');
    if (tail) tail.rotation.z = 0.8 + Math.sin(survivalTime * 6) * 0.4;

    // Walk bob
    cat.group.position.y = -0.4 + Math.abs(Math.sin(survivalTime * catSpeed * 2)) * 0.05;

    // Flash timer
    if (cat.hitFlashTimer > 0) {
      cat.hitFlashTimer -= dt;
      cat.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.visible = Math.sin(cat.hitFlashTimer * 20) > 0;
      });
    } else {
      cat.group.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.visible = true; });
    }

    // Hit detection vs player
    if (player.invincibleTimer <= 0 && player.shieldTimer <= 0) {
      const catPos = new THREE.Vector3(cat.x, 0.3, ROOM.playerZ + 0.5);
      const playerPos = new THREE.Vector3(player.x, player.y + 0.4, ROOM.playerZ);
      if (catPos.distanceTo(playerPos) < 0.7 && cat.hitFlashTimer <= 0) {
        onPlayerHit();
        cat.hitFlashTimer = 1.5;
      }
    }

    // Mouse hit detection vs player — mouse is tiny, smaller radius
    if (player.invincibleTimer <= 0 && player.shieldTimer <= 0) {
      const mousePos = new THREE.Vector3(mouse.x, 0.2, ROOM.playerZ + 0.5);
      const playerPos = new THREE.Vector3(player.x, player.y + 0.4, ROOM.playerZ);
      if (mousePos.distanceTo(playerPos) < 0.5 && cat.hitFlashTimer <= 0) {
        onPlayerHit();
        cat.hitFlashTimer = 1.5; // use cat flash timer to debounce both
      }
    }
  }

  // ─── Start ────────────────────────────────────────────────────────────────
  function start() {
    initAudio();
    clock.start();
    camTarget.set(0, 5.5, ROOM.playerZ + 7.5);
    camLookTarget.set(0, 1.2, ROOM.playerZ - 3);
    camera.position.copy(camTarget);
    tick();
  }

  // ─── Destroy ──────────────────────────────────────────────────────────────
  function destroy() {
    running = false;
    cancelAnimationFrame(rafId);
    controls.destroy();
    window.removeEventListener('resize', onResize);
    for (const ch of chanclas) scene.remove(ch.group);
    for (const p of particles) { scene.remove(p.mesh); p.mesh.geometry.dispose(); }
    for (const pan of pans) scene.remove(pan.group);
    scene.remove(cat.group);
    scene.remove(mouse.group);
    destroyGhosts(ghosts, scene);
    renderer.dispose();
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
  }

  function triggerStrike() { strikeQueued = true; }

  return { start, destroy, triggerStrike };
}
