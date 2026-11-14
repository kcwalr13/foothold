// Content data: every balance number lives here, not in code paths or the design doc.
import { C, K, TILE, type Def, type Kind } from './types';

const t = (tiles: number) => Math.round(tiles * TILE);

const base = { speed: 0, range: 0, dmg: 0, cooldown: 0, vs: [100, 100, 100, 100] as const, size: 0, provides: 0, building: false };

export const DEFS: Record<number, Def> = {
  [K.Worker]: {
    ...base, kind: K.Worker, name: 'Worker', plural: 'Workers', cls: C.Light, hp: 40, cost: 50, time: 100, supply: 1,
    speed: 62, radius: t(0.26), sight: 6, madeAt: K.HQ,
  },
  [K.Trooper]: {
    ...base, kind: K.Trooper, name: 'Trooper', plural: 'Troopers', cls: C.Light, hp: 45, cost: 50, time: 150, supply: 1,
    speed: 62, radius: t(0.3), sight: 8, range: t(5), dmg: 6, cooldown: 8, vs: [100, 50, 100, 50], madeAt: K.Barracks,
  },
  [K.Lancer]: {
    ...base, kind: K.Lancer, name: 'Lancer', plural: 'Lancers', cls: C.Light, hp: 60, cost: 75, time: 170, supply: 1,
    speed: 54, radius: t(0.32), sight: 8, range: t(7.25), dmg: 24, cooldown: 22, vs: [40, 200, 0, 200], madeAt: K.Barracks,
  },
  [K.Runner]: {
    ...base, kind: K.Runner, name: 'Runner', plural: 'Runners', cls: C.Light, hp: 45, cost: 60, time: 140, supply: 1,
    speed: 100, radius: t(0.3), sight: 9, range: t(3), dmg: 4, cooldown: 5, vs: [100, 40, 0, 25], madeAt: K.Barracks,
  },
  [K.HQ]: {
    ...base, kind: K.HQ, name: 'Headquarters', plural: 'Headquarters', cls: C.Structure, hp: 1200, cost: 400, time: 450, supply: 0,
    radius: t(2), sight: 10, size: 4, provides: 40, building: true,
  },
  [K.Barracks]: {
    ...base, kind: K.Barracks, name: 'Barracks', plural: 'Barracks', cls: C.Structure, hp: 550, cost: 150, time: 300, supply: 0,
    radius: t(1.5), sight: 8, size: 3, building: true,
  },
  [K.Turret]: {
    ...base, kind: K.Turret, name: 'Turret', plural: 'Turrets', cls: C.Structure, hp: 280, cost: 100, time: 200, supply: 0,
    radius: t(1), sight: 9, range: t(6.5), dmg: 14, cooldown: 8, size: 2, needs: K.Barracks, building: true,
  },
  [K.Pile]: {
    ...base, kind: K.Pile, name: 'Blocks', plural: 'Blocks', cls: C.Structure, hp: 1, cost: 0, time: 0, supply: 0,
    radius: t(0.5), sight: 0, size: 1,
  },
};

export const def = (kind: number): Def => DEFS[kind]!;

/** Faction rosters. Version 1 ships the Green Army; the tables are shaped for more. */
export const FACTIONS = {
  green: {
    name: 'Green Army',
    hq: K.HQ as Kind,
    worker: K.Worker as Kind,
    buildings: [K.HQ, K.Barracks, K.Turret] as Kind[],
    units: [K.Worker, K.Trooper, K.Lancer, K.Runner] as Kind[],
  },
};

export const RULES = {
  startBlocks: 50,
  startWorkers: 8,
  /** Blocks a Worker carries per trip. */
  carry: 5,
  /** Ticks a Worker spends at a pile per trip. */
  harvestTicks: 20,
  /** Workers one pile serves well. */
  perPile: 2,
  /** A Headquarters within this many tiles of a pile makes the pile part of that base. */
  baseReach: 10,
  supplyMax: 120,
  queueMax: 5,
  /** Refund share for cancelling a building once work has begun. */
  cancelRefund: 75,
  /** How far beyond weapon range an idle unit notices enemies, in sub-units. */
  notice: t(2.5),
  /** How far an idle unit chases before turning back. */
  leash: t(7),
  groups: 4,
};
