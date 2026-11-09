// Chancla Crash: 10 handcrafted levels across 3 worlds, each 2-3 stages (~1 minute per level).
// Starred targets = pan dulce (concha) and cafecito characters. Everything else is scenery, blockers, or bonus points.
// Coordinates: throwers near z=+4.6, targets around z=-5..-11. y args are the surface an item rests on.
import type { WorldId } from './crashArt';

export const S = 0.8; // block size
export interface Builder {
  pedestal(x: number, z: number, w: number, d: number, top?: number): number;
  /** kinematic slab sliding along x */
  mover(x: number, z: number, w: number, d: number, top: number, amp: number, period: number, phase?: number): number;
  wall(x: number, z: number, w: number, h: number, d: number, y?: number): void;
  deflector(x: number, y: number, z: number, w: number, h: number, yaw: number): void;
  crate(x: number, y: number, z: number): number;
  skull(x: number, y: number, z: number): number;   // sugar-skull block (shatters)
  skel(x: number, y: number, z: number): number;    // calaca skeleton
  jar(x: number, y: number, z: number): number;
  candle(x: number, y: number, z: number, h?: number): number;
  pinata(x: number, y: number, z: number): number;
  post(x: number, y: number, z: number, h: number): number;
  plank(x: number, y: number, z: number, len: number): number;
  concha(x: number, y: number, z: number): number;  // ★ pan dulce creature
  cafe(x: number, y: number, z: number): number;    // ★ cafecito mug creature
  papel(x: number, y: number, z: number, w: number): void; // hanging papel picado (tears for bonus)
}
export interface StageDef { ammo: number; build(b: Builder): void }
export interface LevelDef { world: WorldId; name: string; stages: StageDef[] }

type B = Builder;
/** Stack a column of items from y; returns the top. */
function col(b: B, x: number, y: number, z: number, items: (keyof B)[]): number {
  for (const k of items) y = (b[k] as (x: number, y: number, z: number) => number)(x, y, z);
  return y;
}
/** Two posts + plank shelf; returns plank top. */
function shelf(b: B, x: number, y: number, z: number, w: number, h: number): number {
  b.post(x - w / 2 + 0.2, y, z, h); const t = b.post(x + w / 2 - 0.2, y, z, h);
  return b.plank(x, t, z, w);
}

export const LEVELS: LevelDef[] = [
  // ───── Plaza de los Muertos ─────
  { world: 'plaza', name: 'Merienda', stages: [
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -7, 4.2, 2);
      col(b, -1.2, t, -7, ['crate', 'concha']); b.cafe(0.2, t, -7); col(b, 1.4, t, -7, ['crate', 'crate', 'cafe']);
      b.candle(-0.5, t, -6.4, 0.4); b.candle(0.8, t, -6.4, 0.55);
      b.papel(0, 4.2, -8, 5);
    } },
    { ammo: 4, build(b) {
      const l = b.pedestal(-1.6, -8, 2, 2), r = b.pedestal(1.6, -8, 2, 2);
      col(b, -1.6, l, -8, ['crate', 'skull', 'concha']); col(b, 1.6, r, -8, ['skull', 'crate', 'cafe']);
      const t = b.pedestal(0, -6.2, 2.2, 1.4, 0.8); b.concha(-0.45, t, -6.2); b.cafe(0.45, t, -6.2);
      b.skel(-2.2, l, -7.5); b.skel(2.2, r, -7.5);
    } },
  ] },
  { world: 'plaza', name: 'La panadería', stages: [
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -7.5, 5, 2);
      const s1 = shelf(b, 0, t, -7.5, 3.4, 1.1);
      b.concha(-1.0, t, -7.5); b.concha(1.0, t, -7.5); b.jar(0, t, -7.5);
      b.concha(-0.9, s1, -7.5); b.cafe(0.1, s1, -7.5); b.concha(1.1, s1, -7.5);
    } },
    { ammo: 4, build(b) {
      const t = b.pedestal(0, -8, 5, 2.2);
      for (const x of [-1.68, -0.84, 0, 0.84, 1.68]) b.crate(x, t, -8);
      for (const x of [-1.26, -0.42, 0.42, 1.26]) b.skull(x, t + S, -8);
      b.concha(-0.84, t + 2 * S, -8); b.cafe(0, t + 2 * S, -8); b.concha(0.84, t + 2 * S, -8);
      b.pinata(0, t + 2 * S + 0.6, -8);
      b.papel(0, 4.6, -6, 4);
    } },
  ] },
  { world: 'plaza', name: 'Café de olla', stages: [
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -6.8, 4.6, 1.6, 1.0);
      for (const x of [-1.6, 0, 1.6]) col(b, x, t, -6.8, ['crate', 'cafe']);
      b.candle(-0.8, t, -6.6, 0.5); b.candle(0.8, t, -6.6, 0.6);
    } },
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -8.5, 3, 2);
      col(b, 0, t, -8.5, ['skull', 'skull', 'skull', 'cafe']);
      col(b, -1.0, t, -8.5, ['crate', 'concha']); col(b, 1.0, t, -8.5, ['crate', 'concha']);
      b.papel(0, 4.4, -7, 4.4);
    } },
    { ammo: 4, build(b) {
      const t = b.pedestal(0, -8, 5, 2);
      const pk = shelf(b, 0, t, -8, 3.2, 1.4);
      b.concha(-0.9, pk, -8); b.cafe(0.9, pk, -8); b.pinata(0, b.crate(0, t, -8), -8);
      b.skel(-2.0, t, -7.6); b.skel(2.0, t, -7.6);
      b.concha(-1.2, t, -8.4); b.cafe(1.2, t, -8.4);
    } },
  ] },
  { world: 'plaza', name: 'La fuente', stages: [
    { ammo: 4, build(b) {
      const m = b.mover(0, -6.8, 2.2, 1.4, 1.0, 1.4, 4.2);
      col(b, -0.45, m, -6.8, ['crate', 'concha']); b.cafe(0.5, m, -6.8);
      const t = b.pedestal(0, -9.6, 4, 1.4, 1.4); b.concha(-1.2, t, -9.6); b.concha(1.2, t, -9.6); b.candle(0, t, -9.6, 0.7);
    } },
    { ammo: 4, build(b) {
      const l = b.pedestal(-1.7, -8.2, 1.8, 1.8, 1.0), r = b.pedestal(1.7, -8.2, 1.8, 1.8, 1.0);
      col(b, -1.7, l, -8.2, ['crate', 'crate', 'cafe']); col(b, 1.7, r, -8.2, ['crate', 'crate', 'cafe']);
      const m = b.mover(0, -6.4, 1.6, 1.2, 1.4, 1.3, 3.2, Math.PI / 2);
      col(b, 0, m, -6.4, ['skull', 'concha']);
      b.papel(0, 4.6, -8.2, 3.6);
    } },
  ] },
  // ───── El Panteón ─────
  { world: 'cemetery', name: 'Restless slabs', stages: [
    { ammo: 3, build(b) {
      const m = b.mover(0, -7, 1.8, 1.6, 1.2, 1.5, 3.6);
      col(b, 0, m, -7, ['crate', 'cafe']);
      const t = b.pedestal(0, -10, 3.4, 1.6, 0.8);
      b.concha(-1.0, t, -10); b.candle(0, t, -10, 0.8); b.concha(1.0, t, -10);
    } },
    { ammo: 4, build(b) {
      const m1 = b.mover(0, -6.2, 1.6, 1.2, 0.9, 1.6, 3.0), m2 = b.mover(0, -9.0, 1.6, 1.2, 1.6, 1.6, 3.6, Math.PI);
      col(b, 0, m1, -6.2, ['skull', 'concha']); col(b, 0, m2, -9.0, ['crate', 'cafe']);
      b.skel(-2.6, 0, -8); b.skel(2.6, 0, -8);
    } },
  ] },
  { world: 'cemetery', name: 'Ofrenda', stages: [
    { ammo: 4, build(b) {
      const a = b.pedestal(0, -6.8, 5, 1.0, 0.7);
      for (const x of [-1.8, -0.6, 0.6, 1.8]) b.candle(x, a, -6.8, 0.35 + Math.abs(x) * 0.1);
      const m = b.pedestal(0, -7.8, 4.2, 1.0, 1.4);
      b.cafe(-1.3, m, -7.8); b.jar(0, m, -7.8); b.cafe(1.3, m, -7.8);
      const top = b.pedestal(0, -8.8, 3.2, 1.0, 2.1);
      b.concha(-0.7, top, -8.8); b.pinata(0.7, top, -8.8);
      b.papel(0, 4.8, -8.4, 4.4);
    } },
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -8.2, 4.4, 2, 1.0);
      for (const x of [-1.5, 1.5]) col(b, x, t, -8.2, ['skull', 'skull', 'concha']);
      col(b, 0, t, -8.2, ['crate', 'cafe']); b.skel(-0.75, t, -7.7); b.skel(0.75, t, -7.7);
    } },
  ] },
  { world: 'cemetery', name: 'Bank shot', stages: [
    { ammo: 4, build(b) {
      // a low wall hides the row: lob over it, or bank off a deflector to sweep the whole shelf
      b.wall(0, -5.8, 4.2, 1.6, 0.4);
      const t = b.pedestal(0, -7.4, 4.6, 1.0, 1.0);
      b.concha(-1.5, t, -7.3); b.cafe(-0.5, t, -7.3); b.concha(0.5, t, -7.3); b.cafe(1.5, t, -7.3);
      b.deflector(3.0, 1.9, -6.5, 2.4, 2.2, 0.45); b.deflector(-3.0, 1.9, -6.5, 2.4, 2.2, -0.45);
    } },
    { ammo: 3, build(b) {
      const m = b.mover(0, -7.6, 2.0, 1.4, 1.2, 1.3, 3.4);
      col(b, -0.45, m, -7.6, ['skull', 'concha']); col(b, 0.5, m, -7.6, ['crate', 'cafe']);
      b.deflector(-3.0, 1.9, -6.2, 2.4, 2.2, -0.45);
    } },
    { ammo: 4, build(b) {
      const t = b.pedestal(0, -9.5, 5.2, 2, 1.0);
      col(b, -1.8, t, -9.5, ['crate', 'crate', 'concha']); col(b, 1.8, t, -9.5, ['crate', 'crate', 'cafe']);
      const pk = shelf(b, 0, t, -9.5, 2.0, 1.2); b.concha(0, pk, -9.5);
      b.wall(0, -6.6, 2.2, 1.5, 0.4);
      b.deflector(3.0, 1.9, -6.8, 2.4, 2.2, 0.45);
    } },
  ] },
  // ───── El Mercado ─────
  { world: 'mercado', name: 'Puesto de pan', stages: [
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -7.2, 5.2, 1.8, 1.0);
      col(b, -1.7, t, -7.2, ['crate', 'crate', 'concha']); col(b, 1.7, t, -7.2, ['crate', 'crate', 'concha']);
      col(b, 0, t, -7.2, ['crate', 'cafe']); b.jar(-0.85, t, -7.0); b.jar(0.85, t, -7.0);
    } },
    { ammo: 4, build(b) {
      const t = b.pedestal(0, -8.6, 5.4, 2.2, 1.0);
      const s1 = shelf(b, 0, t, -8.6, 4.4, 1.0);
      const s2 = shelf(b, 0, s1, -8.6, 2.6, 0.9);
      b.concha(-1.6, s1, -8.6); b.cafe(1.6, s1, -8.6); b.concha(-0.6, s2, -8.6); b.cafe(0.6, s2, -8.6);
      b.pinata(0, t, -8.6);
      b.papel(0, 4.8, -7, 5);
    } },
  ] },
  { world: 'mercado', name: 'Hora pico', stages: [
    { ammo: 3, build(b) {
      const m1 = b.mover(0, -6.5, 1.8, 1.4, 1.0, 1.6, 3.0);
      col(b, 0, m1, -6.5, ['crate', 'concha']);
      const m2 = b.mover(0, -9.2, 1.8, 1.4, 1.6, 1.7, 3.4, Math.PI);
      col(b, 0, m2, -9.2, ['skull', 'cafe']);
    } },
    { ammo: 4, build(b) {
      const m = b.mover(0, -7.4, 2.4, 1.4, 1.2, 1.2, 2.8);
      col(b, -0.6, m, -7.4, ['crate', 'cafe']); col(b, 0.6, m, -7.4, ['crate', 'concha']);
      const t = b.pedestal(0, -10, 4.6, 1.4, 1.8);
      b.concha(-1.5, t, -10); b.cafe(0, t, -10); b.concha(1.5, t, -10);
      b.deflector(-3.0, 1.9, -7.2, 2.4, 2.2, -0.45);
    } },
    { ammo: 3, build(b) {
      const m1 = b.mover(-1.0, -6.4, 1.4, 1.2, 1.0, 1.2, 2.6), m2 = b.mover(1.0, -8.6, 1.4, 1.2, 1.5, 1.2, 2.6, Math.PI);
      col(b, -1.0, m1, -6.4, ['skull', 'concha']); col(b, 1.0, m2, -8.6, ['crate', 'cafe']);
      b.papel(0, 4.4, -7.4, 4);
    } },
  ] },
  { world: 'mercado', name: 'El castillo', stages: [
    { ammo: 3, build(b) {
      const t = b.pedestal(0, -7.4, 4.8, 1.8, 1.0);
      for (const x of [-1.6, 0, 1.6]) col(b, x, t, -7.4, ['skull', 'concha']);
      b.skel(-0.8, t, -7.0); b.skel(0.8, t, -7.0);
    } },
    { ammo: 4, build(b) {
      const t = b.pedestal(0, -9, 5.6, 2.2, 1.0);
      col(b, -1.9, t, -9, ['crate', 'crate', 'crate', 'cafe']); col(b, 1.9, t, -9, ['crate', 'crate', 'crate', 'cafe']);
      const pk = shelf(b, 0, t, -9, 2.0, 1.6); b.pinata(0, pk, -9);
      b.concha(0, t, -9);
      const m = b.mover(0, -6, 1.6, 1.2, 1.1, 1.4, 2.8); b.concha(0, m, -6);
      b.deflector(3.0, 1.9, -6.6, 2.4, 2.2, 0.45);
    } },
    { ammo: 4, build(b) {
      const t = b.pedestal(0, -9.4, 5.4, 2.2, 1.2);
      const s1 = shelf(b, 0, t, -9.4, 4.6, 1.1), s2 = shelf(b, 0, s1, -9.4, 3.0, 1.0);
      b.concha(-1.7, t, -9.4); b.cafe(1.7, t, -9.4);
      b.cafe(-1.5, s1, -9.4); b.concha(1.5, s1, -9.4); b.concha(-0.5, s2, -9.4); b.cafe(0.5, s2, -9.4);
      const m = b.mover(0, -6.4, 1.6, 1.2, 1.0, 1.5, 3.0); col(b, 0, m, -6.4, ['skull', 'cafe']);
      b.papel(0, 5.2, -8, 5.4);
    } },
  ] },
];
