import * as THREE from 'three';
import type { PlayerState, MomState, CatState, MouseState } from './types';

// ─── Chancla Color Palette ─────────────────────────────────────────────────────
export const CHANCLA_COLORS = [0xFF6B6B, 0xFFD93D, 0x6BCB77, 0x4D96FF, 0xFF922B];
export const CHANCLA_STRAP_COLORS = [0xE63946, 0xF4A261, 0x2D9E4A, 0x2563EB, 0xC05621];

// ─── Room Dimensions ───────────────────────────────────────────────────────────
export const ROOM = {
  width: 18,
  depth: 22,
  height: 8,
  floorY: 0,
  playerMinX: -4.5,
  playerMaxX: 4.5,
  playerZ: 6,
  momZ: -7,
};

// ─── Scene Setup ───────────────────────────────────────────────────────────────
export function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  // Visual polish - vibrant low-poly style: warm peach sky background
  scene.background = new THREE.Color(0xFFE0A0);
  scene.fog = new THREE.Fog(0xFFE0A0, 22, 44);

  addLighting(scene);
  addRoom(scene);
  addFurniture(scene, 0);

  return scene;
}

// ─── Lighting ──────────────────────────────────────────────────────────────────
// Visual polish - vibrant low-poly style: warm cozy multi-source lighting
function addLighting(scene: THREE.Scene) {
  // Soft warm ambient fill
  const ambient = new THREE.AmbientLight(0xFFEDD0, 0.75);
  ambient.name = 'ambientLight';
  scene.add(ambient);

  // Main directional "sunlight" from upper left window
  const sun = new THREE.DirectionalLight(0xFFD060, 1.3);
  sun.position.set(-4, 12, 6);
  sun.name = 'sunLight';
  scene.add(sun);

  // Warm lamp glow from right side (like a floor lamp)
  const lamp = new THREE.PointLight(0xFF9933, 1.2, 18);
  lamp.position.set(6, 4.5, -3);
  lamp.name = 'lampLight';
  scene.add(lamp);

  // Soft TV blue fill from back wall
  const tvGlow = new THREE.PointLight(0x4488DD, 0.7, 14);
  tvGlow.position.set(5, 2, -7);
  tvGlow.name = 'tvGlow';
  scene.add(tvGlow);

  // Hemisphere sky/ground bounce
  const hemi = new THREE.HemisphereLight(0xFFCC88, 0xD4845A, 0.45);
  hemi.name = 'hemiLight';
  scene.add(hemi);
}

// ─── Room Geometry ─────────────────────────────────────────────────────────────
// Visual polish - vibrant low-poly style: warm walls, terracotta tile floor, wallpaper stripe
function addRoom(scene: THREE.Scene) {
  const { width, depth, height } = ROOM;

  // --- Floor: terracotta tile base ---
  const floorGeo = new THREE.PlaneGeometry(width, depth);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xD4845A });
  floorMat.name = 'floorMat';
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = ROOM.floorY;
  floor.name = 'floorMesh';
  scene.add(floor);

  // Tile grout grid in darker terracotta
  const grid = new THREE.GridHelper(width, 9, 0xB0622A, 0xB0622A);
  grid.position.y = 0.01;
  grid.name = 'floorGrid';
  scene.add(grid);

  // Darker tile cross-hatch accent (every other row offset)
  const accentGrid = new THREE.GridHelper(width, 18, 0xC07040, 0xC07040);
  accentGrid.position.y = 0.012;
  accentGrid.name = 'floorAccentGrid';
  scene.add(accentGrid);

  // --- Back wall: warm yellow-orange ---
  const backWallMat = new THREE.MeshLambertMaterial({ color: 0xFFCC55 });
  backWallMat.name = 'backWallMat';
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), backWallMat);
  backWall.position.set(0, height / 2, -depth / 2);
  backWall.name = 'backWall';
  scene.add(backWall);

  // Decorative horizontal wallpaper stripes on back wall
  const stripeColors = [0xFFAA22, 0xFF9911, 0xFFAA22];
  for (let i = 0; i < stripeColors.length; i++) {
    const stripeMat = new THREE.MeshLambertMaterial({ color: stripeColors[i] });
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.35), stripeMat);
    stripe.position.set(0, 1.2 + i * 1.9, -depth / 2 + 0.02);
    stripe.name = `wallStripe${i}`;
    scene.add(stripe);
  }

  // --- Back wall rug/tapestry image ---
  const textureLoader = new THREE.TextureLoader();
  const rugTex = textureLoader.load('/rug.png');
  const rugWallMat = new THREE.MeshLambertMaterial({ map: rugTex, transparent: true });
  const rugWall = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.0), rugWallMat);
  rugWall.position.set(0, 3.5, -depth / 2 + 0.05);
  rugWall.name = 'wallRug';
  scene.add(rugWall);

  // --- Wall art on left and right walls ---
  const wallArtTex = textureLoader.load('/wall_art.png');
  const artMatL = new THREE.MeshLambertMaterial({ map: wallArtTex, transparent: true });
  const wallArtL = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), artMatL);
  wallArtL.rotation.y = Math.PI / 2;
  wallArtL.position.set(-width / 2 + 0.05, 3.5, -2);
  wallArtL.name = 'wallArtLeft';
  scene.add(wallArtL);

  const artMatR = new THREE.MeshLambertMaterial({ map: wallArtTex, transparent: true });
  const wallArtR = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), artMatR);
  wallArtR.rotation.y = -Math.PI / 2;
  wallArtR.position.set(width / 2 - 0.05, 3.5, -2);
  wallArtR.name = 'wallArtRight';
  scene.add(wallArtR);

  // Baseboard trim on back wall
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xE8B870 });
  const baseBack = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.32, 0.1), baseMat);
  baseBack.position.set(0, 0.16, -depth / 2 + 0.06);
  baseBack.name = 'baseboard';
  scene.add(baseBack);

  // Crown molding at top of back wall
  const crownMat = new THREE.MeshLambertMaterial({ color: 0xF0D090 });
  const crown = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.2, 0.1), crownMat);
  crown.position.set(0, height - 0.1, -depth / 2 + 0.06);
  crown.name = 'crownMolding';
  scene.add(crown);

  // --- Side walls ---
  const sideWallMat = new THREE.MeshLambertMaterial({ color: 0xFFBB44 });
  sideWallMat.name = 'sideWallMat';
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), sideWallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-width / 2, height / 2, 0);
  leftWall.name = 'leftWall';
  scene.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(width / 2, height / 2, 0);
  rightWall.name = 'rightWall';
  scene.add(rightWall);

  // --- Ceiling: slightly off-white warm cream ---
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0xFFF5E0 });
  ceilMat.name = 'ceilMat';
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, height, 0);
  ceil.name = 'ceilingMesh';
  scene.add(ceil);
}

// ─── Furniture ─────────────────────────────────────────────────────────────────
// Visual polish - vibrant low-poly style: richer furniture with details and level clutter
export function addFurniture(scene: THREE.Scene, levelIndex: number) {
  // Core furniture
  addCouch(scene, -3, 0, -8);
  addTVStand(scene, 5, 0, -8.5);
  addCoffeeTable(scene, 0, 0, 0);
  addPlant(scene, -7.5, 0, -9);
  addRug(scene, 0, 0.01, 1);
  addFloorLamp(scene, 7, 0, -2);

  // Family photos on back wall
  addPictureFrame(scene, -5.5, 4.2, -10.8, 0xFF8A65, 0.9, 0.7);
  addPictureFrame(scene, -3.5, 3.5, -10.8, 0xFFCC80, 0.6, 0.8);
  addPictureFrame(scene, 1.5, 4.5, -10.8, 0xA5D6A7, 0.75, 0.6);
  addPictureFrame(scene, 3.5, 3.8, -10.8, 0xFF8A65, 0.5, 0.65);

  // Level-based clutter (more mess = higher level)
  addLevelClutter(scene, levelIndex);
}

function addCouch(scene: THREE.Scene, x: number, y: number, z: number) {
  // Visual polish - vibrant low-poly style: softer couch with color variety and details
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B4040 }); // deep red-brown
  const cushionColors = [0xCC5555, 0xBB4444, 0xDD6655];
  const legMat = new THREE.MeshLambertMaterial({ color: 0x5C2A1E });
  const pillowMat = new THREE.MeshLambertMaterial({ color: 0xFFAA44 }); // orange accent pillow

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.3), bodyMat);
  body.position.set(x, y + 0.5, z);
  scene.add(body);

  // Back rest (slightly rounded top via scale)
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 0.38), bodyMat);
  back.position.set(x, y + 1.35, z - 0.47);
  scene.add(back);

  // Seat cushions (3) with varying colors
  for (let i = -1; i <= 1; i++) {
    const cMat = new THREE.MeshLambertMaterial({ color: cushionColors[i + 1] });
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.28, 1.1), cMat);
    cushion.position.set(x + i * 1.3, y + 1.08, z + 0.06);
    scene.add(cushion);
  }

  // Back cushions (matching seat)
  for (let i = -1; i <= 1; i++) {
    const cMat = new THREE.MeshLambertMaterial({ color: cushionColors[i + 1] });
    const bCushion = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.22), cMat);
    bCushion.position.set(x + i * 1.3, y + 1.05, z - 0.39);
    scene.add(bCushion);
  }

  // Decorative orange throw pillow on left seat
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.22), pillowMat);
  pillow.position.set(x - 1.3, y + 1.25, z - 0.1);
  pillow.rotation.z = 0.15;
  scene.add(pillow);

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.32, 1.35, 1.3);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(x - 2.26, y + 0.68, z);
  scene.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = x + 2.26;
  scene.add(rightArm);

  // Couch legs
  const legGeo = new THREE.BoxGeometry(0.16, 0.28, 0.16);
  for (const [lx, lz] of [[-1.9, -0.5], [1.9, -0.5], [-1.9, 0.5], [1.9, 0.5]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x + lx, y + 0.14, z + lz);
    scene.add(leg);
  }
}

function addTVStand(scene: THREE.Scene, x: number, y: number, z: number) {
  const standMat = new THREE.MeshLambertMaterial({ color: 0x2E1A0E });
  const screenMat = new THREE.MeshLambertMaterial({ color: 0x0A0A12 });
  const screenGlowMat = new THREE.MeshLambertMaterial({
    color: 0x1A3A88,
    emissive: new THREE.Color(0x0D1D55),
    emissiveIntensity: 0.6
  });
  const shelfMat = new THREE.MeshLambertMaterial({ color: 0x3E2314 });

  // TV stand body with shelves
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 0.65), standMat);
  stand.position.set(x, y + 0.43, z);
  scene.add(stand);

  // Middle shelf
  const mShelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.55), shelfMat);
  mShelf.position.set(x, y + 0.45, z);
  scene.add(mShelf);

  // TV frame (black border)
  const tv = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.13), screenMat);
  tv.position.set(x, y + 1.7, z);
  scene.add(tv);

  // TV screen glow
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.06), screenGlowMat);
  screen.position.set(x, y + 1.7, z + 0.06);
  scene.add(screen);

  // TV stand legs
  const tvLegMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const lx of [-0.6, 0.6]) {
    const tvLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), tvLegMat);
    tvLeg.position.set(x + lx, y + 0.85, z);
    scene.add(tvLeg);
  }
}

function addCoffeeTable(scene: THREE.Scene, x: number, y: number, z: number) {
  const tableMat = new THREE.MeshLambertMaterial({ color: 0xC08A50 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x7A5220 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x88CCCC, transparent: true, opacity: 0.55 });

  // Glass table top
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.1), glassMat);
  top.position.set(x, y + 0.62, z);
  scene.add(top);

  // Wood frame under glass
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.1), tableMat);
  frame.position.set(x, y + 0.57, z);
  scene.add(frame);

  // Lower shelf
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.9), tableMat);
  shelf.position.set(x, y + 0.22, z);
  scene.add(shelf);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.09, 0.55, 0.09);
  for (const [lx, lz] of [[-0.98, -0.42], [0.98, -0.42], [-0.98, 0.42], [0.98, 0.42]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x + lx, y + 0.34, z + lz);
    scene.add(leg);
  }

  // Remote control on table
  const remoteMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const remote = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.35), remoteMat);
  remote.position.set(x - 0.5, y + 0.68, z - 0.1);
  remote.rotation.y = 0.3;
  scene.add(remote);

  // Magazine / book
  const bookMat = new THREE.MeshLambertMaterial({ color: 0xFF7043 });
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.4), bookMat);
  book.position.set(x + 0.4, y + 0.68, z + 0.1);
  book.rotation.y = -0.2;
  scene.add(book);

  // Small decorative bowl
  const bowlMat = new THREE.MeshLambertMaterial({ color: 0x1E88E5 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.12, 10), bowlMat);
  bowl.position.set(x, y + 0.72, z);
  scene.add(bowl);
}

function addPlant(scene: THREE.Scene, x: number, y: number, z: number) {
  // Visual polish - vibrant low-poly style: lush plant with more leaves
  const potMat = new THREE.MeshLambertMaterial({ color: 0xE07040 });
  const potRimMat = new THREE.MeshLambertMaterial({ color: 0xC85020 });
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x5D3A1A });
  const leafColors = [0x2E8B57, 0x3CB371, 0x228B22, 0x4CAF50, 0x1B7A3E];
  const stalkMat = new THREE.MeshLambertMaterial({ color: 0x4A7A30 });

  // Pot body (tapered cylinder)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.55, 8), potMat);
  pot.position.set(x, y + 0.275, z);
  scene.add(pot);

  // Pot rim
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.35, 0.07, 8), potRimMat);
  rim.position.set(x, y + 0.57, z);
  scene.add(rim);

  // Soil top
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 8), soilMat);
  soil.position.set(x, y + 0.58, z);
  scene.add(soil);

  // Main stalk
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 6), stalkMat);
  stalk.position.set(x, y + 1.0, z);
  scene.add(stalk);

  // Leaves: central cluster + wide spread
  const leafPositions = [
    [0, 0, 0, 0.32],       // center top
    [0.32, -0.12, 0.1, 0.28],
    [-0.28, -0.08, 0.05, 0.26],
    [0.15, -0.18, -0.25, 0.24],
    [-0.22, -0.15, -0.2, 0.25],
    [0.08, 0.08, 0.28, 0.22],
    [-0.1, 0.05, -0.28, 0.20],
    [0.35, 0.1, -0.1, 0.18],
    [-0.35, 0.08, 0.15, 0.19],
  ];
  for (let i = 0; i < leafPositions.length; i++) {
    const [lx, ly, lz, r] = leafPositions[i];
    const leafMat = new THREE.MeshLambertMaterial({ color: leafColors[i % leafColors.length] });
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), leafMat);
    leaf.position.set(x + lx, y + 1.2 + ly, z + lz);
    leaf.scale.set(1, 0.7, 0.85);
    scene.add(leaf);
  }
}

function addPictureFrame(
  scene: THREE.Scene, x: number, y: number, z: number,
  picColor: number, w: number, h: number
) {
  // Visual polish - vibrant low-poly style: gold frames with colorful family photo fills
  const frameMat = new THREE.MeshLambertMaterial({ color: 0xD4A020 });
  const picMat = new THREE.MeshLambertMaterial({ color: picColor });
  const matMat = new THREE.MeshLambertMaterial({ color: 0xFFFAF0 });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.06), frameMat);
  frame.position.set(x, y, z);
  scene.add(frame);

  const mat = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.05), matMat);
  mat.position.set(x, y, z + 0.01);
  scene.add(mat);

  const pic = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.04), picMat);
  pic.position.set(x, y, z + 0.03);
  scene.add(pic);
}

function addRug(scene: THREE.Scene, x: number, y: number, z: number) {
  // Visual polish - vibrant low-poly style: layered rug with border and center diamond
  const rugMat = new THREE.MeshLambertMaterial({ color: 0xB03020 });
  const borderMat = new THREE.MeshLambertMaterial({ color: 0xE8A030 });
  const innerMat = new THREE.MeshLambertMaterial({ color: 0xCC4030 });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xFFCC44 });

  // Main rug
  const rug = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.04, 4), rugMat);
  rug.position.set(x, y, z);
  scene.add(rug);

  // Outer border
  for (const [bx, bz, bw, bh] of [
    [x, z - 1.75, 5.5, 0.28],
    [x, z + 1.75, 5.5, 0.28],
    [x - 2.61, z, 0.28, 4],
    [x + 2.61, z, 0.28, 4],
  ] as [number,number,number,number][]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.045, bh), borderMat);
    b.position.set(bx, y + 0.002, bz);
    scene.add(b);
  }

  // Inner panel
  const inner = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.043, 3.1), innerMat);
  inner.position.set(x, y + 0.001, z);
  scene.add(inner);

  // Center diamond accent
  const diamond = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.046, 1.4), accentMat);
  diamond.position.set(x, y + 0.003, z);
  diamond.rotation.y = Math.PI / 4;
  scene.add(diamond);
}

function addFloorLamp(scene: THREE.Scene, x: number, y: number, z: number) {
  // Visual polish - vibrant low-poly style: decorative floor lamp
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x6B5335 });
  const shadeMat = new THREE.MeshLambertMaterial({ color: 0xFFEECC, emissive: new THREE.Color(0xFFCC66), emissiveIntensity: 0.3 });

  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.1, 8), baseMat);
  base.position.set(x, y + 0.05, z);
  scene.add(base);

  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.5, 7), poleMat);
  pole.position.set(x, y + 2.4, z);
  scene.add(pole);

  // Shade
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.6, 8), shadeMat);
  shade.position.set(x, y + 4.9, z);
  scene.add(shade);
}

function addLevelClutter(scene: THREE.Scene, levelIndex: number) {
  // Visual polish - vibrant low-poly style: progressive clutter per level
  if (levelIndex < 1) return;

  const toyMat = new THREE.MeshLambertMaterial({ color: 0xFF5252 });
  const toy2Mat = new THREE.MeshLambertMaterial({ color: 0x40C4FF });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
  const paperMat = new THREE.MeshLambertMaterial({ color: 0xFFF9C4 });

  // Level 2+: scattered toys on floor
  if (levelIndex >= 1) {
    const toy1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), toyMat);
    toy1.position.set(-3, 0.13, 3);
    toy1.rotation.y = 0.7;
    scene.add(toy1);

    const toy2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), toy2Mat);
    toy2.position.set(2.5, 0.18, 2.5);
    scene.add(toy2);
  }

  // Level 3+: shoes, more clutter
  if (levelIndex >= 2) {
    const shoe1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.42), shoeMat);
    shoe1.position.set(-1.5, 0.06, 4);
    shoe1.rotation.y = 1.2;
    scene.add(shoe1);

    const shoe2 = shoe1.clone();
    shoe2.position.set(-1.1, 0.06, 4.3);
    shoe2.rotation.y = 0.5;
    scene.add(shoe2);

    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.55), paperMat);
    paper.position.set(3, 0.01, 1.5);
    paper.rotation.y = 0.3;
    scene.add(paper);
  }

  // Level 4+: more spread chaos
  if (levelIndex >= 3) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.2, 7), new THREE.MeshLambertMaterial({ color: 0xFF8F00 }));
    cup.position.set(1.2, 0.1, 3.5);
    scene.add(cup);

    const toy3 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.22), toyMat);
    toy3.position.set(-2.8, 0.11, 1.5);
    toy3.rotation.y = 1.8;
    scene.add(toy3);

    const book = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.48), new THREE.MeshLambertMaterial({ color: 0x7B1FA2 }));
    book.position.set(2, 0.02, 3.8);
    book.rotation.y = -0.8;
    scene.add(book);
  }

  // Level 5: maximum chaos
  if (levelIndex >= 4) {
    const toy4 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), new THREE.MeshLambertMaterial({ color: 0xFFD600 }));
    toy4.position.set(-3.5, 0.22, 2.8);
    scene.add(toy4);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), new THREE.MeshLambertMaterial({ color: 0xF5F5F5 }));
    plate.position.set(1.8, 0.02, 4.5);
    scene.add(plate);

    const cushionFloor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.7), new THREE.MeshLambertMaterial({ color: 0xCC5555 }));
    cushionFloor.position.set(-1.5, 0.08, 2.2);
    cushionFloor.rotation.y = 0.6;
    scene.add(cushionFloor);
  }
}

// ─── Player Character ──────────────────────────────────────────────────────────
export function createPlayer(gender: 'boy' | 'girl' = 'boy'): PlayerState {
  const group = new THREE.Group();

  const texturePath = gender === 'girl' ? '/girl.png' : '/boy.png';
  const tex = new THREE.TextureLoader().load(texturePath);
  const spriteMat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.FrontSide });
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), spriteMat);
  sprite.position.set(0, 1.5, 1.5);
  sprite.renderOrder = 2;
  sprite.name = 'playerSprite';
  group.add(sprite);

  group.position.set(0, -1.5, ROOM.playerZ);

  return {
    group,
    x: 0,
    y: 0,
    vy: 0,
    isDucking: false,
    hitFlashTimer: 0,
    invincibleTimer: 0,
    shieldTimer: 0,
  };
}

// ─── Mom Character ─────────────────────────────────────────────────────────────
export function createMom(): MomState {
  const group = new THREE.Group();

  const tex = new THREE.TextureLoader().load('/momi.png');
  const spriteMat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.FrontSide });
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), spriteMat);
  sprite.position.set(0, 2.0, 1.5);
  sprite.renderOrder = 2;
  sprite.name = 'momSprite';
  group.add(sprite);

  group.position.set(0, 0.05, ROOM.momZ);
  group.rotation.y = 0;

  return {
    group,
    shakeTimer: 0,
    nextThrowTime: 2.0,
  };
}

// ─── Gold Chancla Mesh — logo_chancla.png as a glowing sprite billboard ────────
export function createGoldChancla(): THREE.Group {
  const group = new THREE.Group();

  // Load logo texture — used as a large flat sprite so it's clearly visible in flight
  const loader = new THREE.TextureLoader();
  const logoTex = loader.load('/logo_chancla.png');
  logoTex.colorSpace = THREE.SRGBColorSpace;

  // Large flat sprite using the logo — always faces camera (billboard)
  const spriteMat = new THREE.SpriteMaterial({
    map: logoTex,
    color: 0xFFD700,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.4, 1.4, 1.4); // big enough to see clearly mid-flight
  sprite.name = 'logoSprite';
  group.add(sprite);

  // Gold sole underneath the sprite for 3D depth
  const goldMat  = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: new THREE.Color(0xAA8800), emissiveIntensity: 0.7 });
  const strapMat = new THREE.MeshLambertMaterial({ color: 0xFFA500, emissive: new THREE.Color(0x885500), emissiveIntensity: 0.5 });

  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 1.05), goldMat);
  group.add(sole);

  const frontStrap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.09), strapMat);
  frontStrap.position.set(0, 0.1, -0.18);
  group.add(frontStrap);

  const leftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.32), strapMat);
  leftStrap.position.set(-0.21, 0.1, -0.03);
  group.add(leftStrap);

  const rightStrap = leftStrap.clone();
  rightStrap.position.x = 0.21;
  group.add(rightStrap);

  // Bright gold glow point light
  const glow = new THREE.PointLight(0xFFD700, 2.5, 5.0);
  glow.name = 'goldGlow';
  group.add(glow);

  group.scale.set(1.6, 1.6, 1.6);
  return group;
}

// ─── Chancla Mesh ──────────────────────────────────────────────────────────────
export function createChancla(colorIndex: number): THREE.Group {
  const group = new THREE.Group();
  const soleColor = CHANCLA_COLORS[colorIndex % CHANCLA_COLORS.length];
  const strapColor = CHANCLA_STRAP_COLORS[colorIndex % CHANCLA_STRAP_COLORS.length];

  const soleMat = new THREE.MeshLambertMaterial({ color: soleColor });
  const strapMat = new THREE.MeshLambertMaterial({ color: strapColor });

  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 1.05), soleMat);
  group.add(sole);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 1.1), soleMat);
  rim.position.y = -0.04;
  group.add(rim);

  const frontStrap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.09), strapMat);
  frontStrap.position.set(0, 0.1, -0.18);
  group.add(frontStrap);

  const leftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.32), strapMat);
  leftStrap.position.set(-0.21, 0.1, -0.03);
  group.add(leftStrap);

  const rightStrap = leftStrap.clone();
  rightStrap.position.x = 0.21;
  group.add(rightStrap);

  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), strapMat);
  peg.position.set(0, 0.12, 0.1);
  group.add(peg);

  group.scale.set(1.3, 1.3, 1.3);
  return group;
}

// ─── Level Theme ───────────────────────────────────────────────────────────────
export interface LevelTheme {
  floorColor: number;
  wallColor: number;
  sideWallColor: number;
  ceilColor: number;
  fogColor: number;
  ambientColor: number;
  sunColor: number;
  lampColor: number;
  tvGlowColor: number;
  bgColor: number;
}

// Visual polish - vibrant low-poly style: richer per-level palettes
export const LEVEL_THEMES: LevelTheme[] = [
  // Level 1: Bright cozy afternoon
  { floorColor: 0xD4845A, wallColor: 0xFFCC55, sideWallColor: 0xFFBB44,
    ceilColor: 0xFFF5E0, fogColor: 0xFFE0A0, ambientColor: 0xFFEDD0,
    sunColor: 0xFFD060, lampColor: 0xFF9933, tvGlowColor: 0x4488DD, bgColor: 0xFFE0A0 },
  // Level 2: Late afternoon golden hour
  { floorColor: 0xC47040, wallColor: 0xFFAA33, sideWallColor: 0xFF9F22,
    ceilColor: 0xFFE8C0, fogColor: 0xFFCC88, ambientColor: 0xFFDDBB,
    sunColor: 0xFFAA44, lampColor: 0xFF7700, tvGlowColor: 0x3366CC, bgColor: 0xFFCC88 },
  // Level 3: Sunset tense orange
  { floorColor: 0xAA5A30, wallColor: 0xFF8833, sideWallColor: 0xFF7722,
    ceilColor: 0xFFCC88, fogColor: 0xFFAA66, ambientColor: 0xFFCCA0,
    sunColor: 0xFF8822, lampColor: 0xFF5500, tvGlowColor: 0x2244AA, bgColor: 0xFFAA66 },
  // Level 4: Red rage dusk
  { floorColor: 0x883322, wallColor: 0xFF5522, sideWallColor: 0xEE4411,
    ceilColor: 0xFFAA77, fogColor: 0xFF8855, ambientColor: 0xFFAA99,
    sunColor: 0xFF5511, lampColor: 0xFF2200, tvGlowColor: 0x1133AA, bgColor: 0xFF8855 },
  // Level 5: BOSS — deep crimson chaos
  { floorColor: 0x661111, wallColor: 0xBB1100, sideWallColor: 0xAA0D00,
    ceilColor: 0xFF5533, fogColor: 0xCC3311, ambientColor: 0xFF9966,
    sunColor: 0xFF2200, lampColor: 0xFF0000, tvGlowColor: 0x8811AA, bgColor: 0xCC3311 },
];

export function setLevelTheme(scene: THREE.Scene, levelIndex: number) {
  const theme = LEVEL_THEMES[Math.min(levelIndex, LEVEL_THEMES.length - 1)];

  scene.background = new THREE.Color(theme.bgColor);
  scene.fog = new THREE.Fog(theme.fogColor, 22, 44);

  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshLambertMaterial;
      if (!mat?.color) return;
      const hex = mat.color.getHex();

      // Floor
      if (['floorMesh'].includes(obj.name) ||
        [0xD4845A, 0xC47040, 0xAA5A30, 0x883322, 0x661111].includes(hex)) {
        mat.color.setHex(theme.floorColor);
      }
      // Back wall
      else if (obj.name === 'backWall' ||
        [0xFFCC55, 0xFFAA33, 0xFF8833, 0xFF5522, 0xBB1100].includes(hex)) {
        mat.color.setHex(theme.wallColor);
      }
      // Side walls
      else if (['leftWall', 'rightWall'].includes(obj.name) ||
        [0xFFBB44, 0xFF9F22, 0xFF7722, 0xEE4411, 0xAA0D00].includes(hex)) {
        mat.color.setHex(theme.sideWallColor);
      }
      // Ceiling
      else if (obj.name === 'ceilingMesh' ||
        [0xFFF5E0, 0xFFE8C0, 0xFFCC88, 0xFFAA77, 0xFF5533].includes(hex)) {
        mat.color.setHex(theme.ceilColor);
      }
    }

    if (obj instanceof THREE.AmbientLight) obj.color.setHex(theme.ambientColor);
    if (obj instanceof THREE.DirectionalLight) obj.color.setHex(theme.sunColor);

    if (obj instanceof THREE.PointLight) {
      if (obj.name === 'lampLight') obj.color.setHex(theme.lampColor);
      else if (obj.name === 'tvGlow') obj.color.setHex(theme.tvGlowColor);
    }

    if (obj instanceof THREE.HemisphereLight) obj.color.setHex(theme.ambientColor);
  });
}

// ─── Pan Mesh ──────────────────────────────────────────────────────────────────
export function createPan(): THREE.Group {
  const group = new THREE.Group();

  const panMat    = new THREE.MeshLambertMaterial({ color: 0x444444 }); // dark iron
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // wood handle
  const rimMat    = new THREE.MeshLambertMaterial({ color: 0x666666 });

  // Pan body (flat cylinder)
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.08, 10), panMat);
  pan.position.set(0, 0, 0);
  group.add(pan);

  // Pan rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 6, 16), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.04, 0);
  group.add(rim);

  // Handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), handleMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.44, 0, 0);
  group.add(handle);

  group.scale.set(1.2, 1.2, 1.2);
  return group;
}

// ─── Mouse Mesh ────────────────────────────────────────────────────────────────
export function createMouse(): MouseState {
  const group = new THREE.Group();

  const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xAAAAAA }); // light grey
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const noseMat  = new THREE.MeshLambertMaterial({ color: 0xFF9999 });
  const eyeMat   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const earMat   = new THREE.MeshLambertMaterial({ color: 0xFFCCCC });

  // Body — small oval
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), bodyMat);
  body.scale.set(1.4, 0.9, 1.0);
  body.position.set(0, 0.14, 0);
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), bodyMat);
  head.position.set(0.18, 0.16, 0);
  group.add(head);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), darkMat);
    ear.position.set(0.18, 0.27, side * 0.07);
    ear.scale.set(0.6, 1, 0.6);
    group.add(ear);
    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), earMat);
    innerEar.position.set(0.18, 0.27, side * 0.07);
    group.add(innerEar);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), eyeMat);
    eye.position.set(0.26, 0.19, side * 0.05);
    group.add(eye);
  }

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), noseMat);
  nose.position.set(0.28, 0.15, 0);
  group.add(nose);

  // Tail — thin curved cylinder
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.30, 5), darkMat);
  tail.position.set(-0.22, 0.18, 0);
  tail.rotation.z = 0.6;
  tail.name = 'mouseTail';
  group.add(tail);

  // Legs (4 tiny ones)
  const legGeo = new THREE.BoxGeometry(0.05, 0.10, 0.04);
  for (const [lx, lz] of [[0.08, 0.06], [0.08, -0.06], [-0.08, 0.06], [-0.08, -0.06]]) {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(lx, 0.06, lz);
    group.add(leg);
  }

  group.scale.set(1.3, 1.3, 1.3);
  group.position.set(-2, -0.4, ROOM.playerZ + 0.5);

  return { group, x: -2, direction: 1 };
}

// ─── Dog Mesh (appears level 3+, bigger/faster than cat) ──────────────────────
export function createDog(): CatState {
  const group = new THREE.Group();

  const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xC8A46E }); // tan/brown
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x8B6240 }); // dark brown
  const eyeMat   = new THREE.MeshLambertMaterial({ color: 0x3B2A1A }); // dark eyes
  const noseMat  = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const tongueMat = new THREE.MeshLambertMaterial({ color: 0xFF6B8A });

  // Body — bigger and longer than cat
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.38), bodyMat);
  body.position.set(0, 0.32, 0);
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.36), bodyMat);
  head.position.set(0.44, 0.52, 0);
  group.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.28), darkMat);
  snout.position.set(0.60, 0.44, 0);
  group.add(snout);

  // Floppy ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.10), darkMat);
    ear.position.set(0.36, 0.65, side * 0.16);
    ear.rotation.z = side * 0.15;
    group.add(ear);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), eyeMat);
    eye.position.set(0.62, 0.54, side * 0.10);
    group.add(eye);
  }

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), noseMat);
  nose.position.set(0.68, 0.48, 0);
  group.add(nose);

  // Tongue
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), tongueMat);
  tongue.position.set(0.70, 0.36, 0);
  tongue.rotation.z = 0.2;
  group.add(tongue);

  // Tail — stubby wagging tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.38, 6), darkMat);
  tail.position.set(-0.48, 0.48, 0);
  tail.rotation.z = -0.9;
  tail.name = 'tail';
  group.add(tail);

  // Legs — 4 stocky ones
  const legGeo = new THREE.BoxGeometry(0.13, 0.28, 0.13);
  const legPositions: [number, number, number][] = [
    [0.26, 0.14, 0.13], [0.26, 0.14, -0.13],
    [-0.26, 0.14, 0.13], [-0.26, 0.14, -0.13],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  }

  group.scale.set(1.4, 1.4, 1.4); // bigger than cat
  group.position.set(3, -0.4, ROOM.playerZ + 0.5);

  return {
    group,
    x: 3,
    direction: -1,
    speed: 3.2, // faster than cat
    hitFlashTimer: 0,
  };
}

// ─── Cat Mesh ──────────────────────────────────────────────────────────────────
export function createCat(): CatState {
  const group = new THREE.Group();

  const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xE8C97A }); // warm sandy
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0xC8A855 }); // stripe
  const eyeMat   = new THREE.MeshLambertMaterial({ color: 0x22BB44 }); // green eyes
  const noseMat  = new THREE.MeshLambertMaterial({ color: 0xFF9999 });
  const earMat   = new THREE.MeshLambertMaterial({ color: 0xFFB6C1 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.32), bodyMat);
  body.position.set(0, 0.28, 0);
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.30), bodyMat);
  head.position.set(0.32, 0.48, 0);
  group.add(head);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.07, 0.12, 4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, darkMat);
    ear.position.set(0.32, 0.70, side * 0.10);
    ear.rotation.z = side * 0.2;
    group.add(ear);
    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 4), earMat);
    innerEar.position.set(0.32, 0.70, side * 0.10);
    innerEar.rotation.z = side * 0.2;
    group.add(innerEar);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), eyeMat);
    eye.position.set(0.47, 0.50, side * 0.09);
    group.add(eye);
  }

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), noseMat);
  nose.position.set(0.49, 0.44, 0);
  group.add(nose);

  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.45, 6);
  const tail = new THREE.Mesh(tailGeo, darkMat);
  tail.position.set(-0.38, 0.42, 0);
  tail.rotation.z = 0.8;
  tail.name = 'tail';
  group.add(tail);

  // Legs (4)
  const legGeo = new THREE.BoxGeometry(0.10, 0.20, 0.10);
  const legPositions: [number, number, number][] = [
    [0.18, 0.10, 0.11], [0.18, 0.10, -0.11],
    [-0.18, 0.10, 0.11], [-0.18, 0.10, -0.11],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  }

  // Stripe markings on body
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.33), darkMat);
  stripe.position.set(0, 0.34, 0);
  group.add(stripe);

  group.position.set(-3, -0.4, ROOM.playerZ + 0.5);

  return {
    group,
    x: -3,
    direction: 1,
    speed: 2.5,
    hitFlashTimer: 0,
  };
}

// ─── Camera Setup ──────────────────────────────────────────────────────────────
export function buildCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 80);
  cam.position.set(0, 6, ROOM.playerZ + 7);
  cam.lookAt(0, 0.5, 0);
  return cam;
}
