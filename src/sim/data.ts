// Content data: every balance number lives here, not in code paths or the design doc.
import { C, K, TILE, type Def, type Kind } from './types';

const t = (tiles: number) => Math.round(tiles * TILE);

const base = {
  gas: 0, speed: 0, range: 0, dmg: 0, cooldown: 0, vs: [100, 100, 100, 100] as const, splash: 0, minRange: 0, setup: 0,
  air: false, size: 0, provides: 0, building: false, needs: [] as Kind[],
};

export const DEFS: Record<number, Def> = {
  // ---------------------------------------------------------------- Green Army units
  [K.Worker]: {
    ...base, kind: K.Worker, name: 'Worker', plural: 'Workers', short: 'Worker', cls: C.Light, hp: 40, cost: 50, time: 100, supply: 1,
    speed: 62, radius: t(0.26), sight: 6, madeAt: K.HQ,
  },
  [K.Trooper]: {
    ...base, kind: K.Trooper, name: 'Trooper', plural: 'Troopers', short: 'Trooper', cls: C.Light, hp: 45, cost: 50, time: 150, supply: 1,
    speed: 62, radius: t(0.3), sight: 8, range: t(5), dmg: 6, cooldown: 8, vs: [100, 50, 55, 50], madeAt: K.Barracks,
  },
  [K.Lancer]: {
    ...base, kind: K.Lancer, name: 'Lancer', plural: 'Lancers', short: 'Lancer', cls: C.Light, hp: 60, cost: 75, time: 170, supply: 1,
    speed: 54, radius: t(0.32), sight: 8, range: t(7.25), dmg: 24, cooldown: 22, vs: [40, 170, 0, 200], madeAt: K.Barracks,
  },
  [K.Runner]: {
    ...base, kind: K.Runner, name: 'Runner', plural: 'Runners', short: 'Runner', cls: C.Light, hp: 45, cost: 60, time: 140, supply: 1,
    speed: 100, radius: t(0.3), sight: 9, range: t(3), dmg: 4, cooldown: 5, vs: [100, 40, 0, 25], madeAt: K.Barracks,
  },
  [K.Tank]: {
    ...base, kind: K.Tank, name: 'Tank', plural: 'Tanks', short: 'Tank', cls: C.Armoured, hp: 280, cost: 125, gas: 100, time: 280, supply: 3,
    speed: 56, radius: t(0.46), sight: 8, range: t(5.5), dmg: 20, cooldown: 14, vs: [100, 70, 0, 100], splash: t(0.9), madeAt: K.Factory,
  },
  [K.Mortar]: {
    ...base, kind: K.Mortar, name: 'Mortar', plural: 'Mortars', short: 'Mortar', cls: C.Light, hp: 100, cost: 125, gas: 100, time: 300, supply: 3,
    speed: 46, radius: t(0.4), sight: 11, range: t(11), minRange: t(4.5), dmg: 34, cooldown: 32, vs: [100, 50, 0, 150], splash: t(1.1), setup: 20,
    madeAt: K.Factory,
  },
  [K.Flak]: {
    ...base, kind: K.Flak, name: 'Flak Track', plural: 'Flak Tracks', short: 'Flak', cls: C.Armoured, hp: 170, cost: 75, gas: 75, time: 220, supply: 2,
    speed: 62, radius: t(0.42), sight: 9, range: t(7), dmg: 9, cooldown: 5, vs: [0, 0, 100, 0], splash: t(0.9), madeAt: K.Factory,
  },
  [K.Gunship]: {
    ...base, kind: K.Gunship, name: 'Gunship', plural: 'Gunships', short: 'Gunship', cls: C.Air, hp: 170, cost: 150, gas: 150, time: 300, supply: 3,
    speed: 92, radius: t(0.42), sight: 9, range: t(4.5), dmg: 14, cooldown: 9, vs: [75, 160, 0, 70], air: true, madeAt: K.Airfield,
  },
  [K.Jugger]: {
    ...base, kind: K.Jugger, name: 'Juggernaut', plural: 'Juggernauts', short: 'Jugger', cls: C.Armoured, hp: 800, cost: 300, gas: 225, time: 450, supply: 6,
    speed: 42, radius: t(0.6), sight: 9, range: t(6), dmg: 42, cooldown: 18, vs: [100, 110, 0, 110], splash: t(0.9), madeAt: K.Factory, needs: [K.Heavy],
  },
  // ---------------------------------------------------------------- Green Army buildings
  [K.HQ]: {
    ...base, kind: K.HQ, name: 'Headquarters', plural: 'Headquarters', short: 'HQ', cls: C.Structure, hp: 1200, cost: 400, time: 450, supply: 0,
    radius: t(2), sight: 10, size: 4, provides: 40, building: true,
  },
  [K.Refinery]: {
    ...base, kind: K.Refinery, name: 'Refinery', plural: 'Refineries', short: 'Refinery', cls: C.Structure, hp: 400, cost: 75, time: 200, supply: 0,
    radius: t(1), sight: 6, size: 2, building: true,
  },
  [K.Barracks]: {
    ...base, kind: K.Barracks, name: 'Barracks', plural: 'Barracks', short: 'Barracks', cls: C.Structure, hp: 550, cost: 150, time: 300, supply: 0,
    radius: t(1.5), sight: 8, size: 3, building: true,
  },
  [K.Factory]: {
    ...base, kind: K.Factory, name: 'Factory', plural: 'Factories', short: 'Factory', cls: C.Structure, hp: 700, cost: 200, gas: 100, time: 350, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Barracks], building: true,
  },
  [K.Airfield]: {
    ...base, kind: K.Airfield, name: 'Airfield', plural: 'Airfields', short: 'Airfield', cls: C.Structure, hp: 600, cost: 150, gas: 100, time: 350, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Barracks], building: true,
  },
  [K.Armory]: {
    ...base, kind: K.Armory, name: 'Armory', plural: 'Armories', short: 'Armory', cls: C.Structure, hp: 600, cost: 150, gas: 75, time: 300, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Barracks], building: true,
  },
  [K.Heavy]: {
    ...base, kind: K.Heavy, name: 'Heavy Works', plural: 'Heavy Works', short: 'Heavy W.', cls: C.Structure, hp: 700, cost: 200, gas: 200, time: 400, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Factory, K.Armory], building: true,
  },
  [K.Turret]: {
    ...base, kind: K.Turret, name: 'Turret', plural: 'Turrets', short: 'Turret', cls: C.Structure, hp: 280, cost: 100, time: 200, supply: 0,
    radius: t(1), sight: 9, range: t(6.5), dmg: 14, cooldown: 8, vs: [100, 60, 100, 100], size: 2, needs: [K.Barracks], building: true,
  },
  // ---------------------------------------------------------------- neutral
  [K.Pile]: {
    ...base, kind: K.Pile, name: 'Blocks', plural: 'Blocks', short: 'Blocks', cls: C.Structure, hp: 1, cost: 0, time: 0, supply: 0,
    radius: t(0.5), sight: 0, size: 1,
  },
  [K.Cell]: {
    ...base, kind: K.Cell, name: 'Battery pack', plural: 'Battery packs', short: 'Batteries', cls: C.Structure, hp: 1, cost: 0, time: 0, supply: 0,
    radius: t(1), sight: 0, size: 2,
  },
  [K.Tower]: {
    ...base, kind: K.Tower, name: 'Watchtower', plural: 'Watchtowers', short: 'Tower', cls: C.Structure, hp: 1, cost: 0, time: 0, supply: 0,
    radius: t(0.5), sight: 0, size: 1,
  },
  // ---------------------------------------------------------------- research (cost and time are for the first level)
  [K.Weapons]: {
    ...base, kind: K.Weapons, name: 'Weapons', plural: 'Weapons', short: 'Weapons', cls: C.Structure, hp: 1, cost: 150, gas: 150, time: 600, supply: 0,
    radius: 0, sight: 0, madeAt: K.Armory,
  },
  [K.Armour]: {
    ...base, kind: K.Armour, name: 'Armour', plural: 'Armour', short: 'Armour', cls: C.Structure, hp: 1, cost: 150, gas: 150, time: 600, supply: 0,
    radius: 0, sight: 0, madeAt: K.Armory,
  },
};

export const def = (kind: number): Def => DEFS[kind]!;

export const isResearch = (kind: number): boolean => kind === K.Weapons || kind === K.Armour;

/** Faction rosters, in the order the panels show them. Version 1 ships the Green Army; the tables are shaped for more. */
export const FACTIONS = {
  green: {
    name: 'Green Army',
    hq: K.HQ as Kind,
    worker: K.Worker as Kind,
    buildings: [K.HQ, K.Refinery, K.Barracks, K.Factory, K.Airfield, K.Armory, K.Heavy, K.Turret] as Kind[],
    units: [K.Worker, K.Trooper, K.Lancer, K.Runner, K.Tank, K.Mortar, K.Flak, K.Gunship, K.Jugger] as Kind[],
    research: [K.Weapons, K.Armour] as Kind[],
  },
};

export const RULES = {
  startBlocks: 50,
  startWorkers: 8,
  /** Blocks a Worker carries per trip. */
  carry: 5,
  /** Batteries a Worker carries per trip. */
  gasCarry: 3,
  /** Ticks a Worker spends at a pile or Refinery per trip. */
  harvestTicks: 20,
  /** Workers one pile serves well. */
  perPile: 2,
  /** Workers one Refinery takes. */
  perRefinery: 3,
  /** A Headquarters within this many tiles of a pile or Refinery makes it part of that base. */
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
  /** Extra range for a ground unit on high ground shooting at low ground. */
  highRange: t(1.5),
  /** Share of a splash weapon's damage that others in the blast take, in percent. */
  splashShare: 50,
  /** How far around a held watchtower its holder sees, in tiles, and how close a unit must stand to hold it. */
  towerSight: 11,
  towerReach: t(2.5),
  /** Research: levels, damage gained and damage shed per level in percent, and what each further level adds to the price. */
  researchMax: 2,
  weaponStep: 15,
  armourStep: 10,
  researchStep: 100,
};

/** Price of the next level of a research item for a player already at `level`. */
export function researchCost(kind: number, level: number): { cost: number; gas: number; time: number } {
  const d = def(kind);
  return { cost: d.cost + level * RULES.researchStep, gas: d.gas + level * RULES.researchStep, time: d.time + level * 200 };
}
