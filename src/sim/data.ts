// Content data: every balance number lives here, not in code paths or the design doc.
import { C, K, TILE, type Def, type Faction, type Kind } from './types';

const t = (tiles: number) => Math.round(tiles * TILE);

const base = {
  gas: 0, speed: 0, range: 0, dmg: 0, cooldown: 0, vs: [100, 100, 100, 100] as const, splash: 0, minRange: 0, setup: 0,
  air: false, melee: false, charge: 0, raider: false, brood: 1, size: 0, provides: 0, building: false, needs: [] as Kind[],
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
    speed: 100, radius: t(0.3), sight: 9, range: t(3), dmg: 4, cooldown: 5, vs: [100, 40, 0, 25], raider: true, madeAt: K.Barracks,
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
    speed: 92, radius: t(0.42), sight: 9, range: t(4.5), dmg: 14, cooldown: 9, vs: [75, 160, 0, 70], air: true, raider: true, madeAt: K.Airfield,
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
  // ---------------------------------------------------------------- Dino Pack units
  // Every one of them hatches from an egg at a Nest; `time` is how long the egg takes.
  [K.Gatherer]: {
    ...base, kind: K.Gatherer, name: 'Gatherer', plural: 'Gatherers', short: 'Gatherer', cls: C.Light, hp: 40, cost: 50, time: 80, supply: 1,
    speed: 62, radius: t(0.26), sight: 6, madeAt: K.Nest,
  },
  [K.Raptor]: {
    ...base, kind: K.Raptor, name: 'Raptor', plural: 'Raptors', short: 'Raptor', cls: C.Light, hp: 24, cost: 50, time: 110, supply: 1,
    speed: 96, radius: t(0.26), sight: 8, range: t(0.55), dmg: 5, cooldown: 6, vs: [100, 50, 0, 50], melee: true, raider: true, brood: 2,
    madeAt: K.Nest, needs: [K.Den],
  },
  [K.Spitter]: {
    ...base, kind: K.Spitter, name: 'Spitter', plural: 'Spitters', short: 'Spitter', cls: C.Light, hp: 50, cost: 60, time: 130, supply: 1,
    speed: 64, radius: t(0.3), sight: 8, range: t(5), dmg: 7, cooldown: 7, vs: [100, 50, 50, 50], madeAt: K.Nest, needs: [K.Den],
  },
  [K.Horn]: {
    ...base, kind: K.Horn, name: 'Horn', plural: 'Horns', short: 'Horn', cls: C.Armoured, hp: 230, cost: 100, gas: 50, time: 220, supply: 2,
    speed: 60, radius: t(0.44), sight: 8, range: t(0.6), dmg: 16, cooldown: 10, vs: [110, 70, 0, 150], melee: true, charge: 44,
    madeAt: K.Nest, needs: [K.Wallow],
  },
  [K.Ptero]: {
    ...base, kind: K.Ptero, name: 'Ptero', plural: 'Pteros', short: 'Ptero', cls: C.Air, hp: 110, cost: 100, gas: 75, time: 240, supply: 2,
    speed: 110, radius: t(0.38), sight: 9, range: t(1.4), dmg: 9, cooldown: 7, vs: [100, 100, 100, 50], air: true, raider: true,
    madeAt: K.Nest, needs: [K.Roost],
  },
  [K.Bronto]: {
    ...base, kind: K.Bronto, name: 'Bronto', plural: 'Brontos', short: 'Bronto', cls: C.Armoured, hp: 650, cost: 200, gas: 150, time: 320, supply: 4,
    speed: 40, radius: t(0.62), sight: 8, range: t(0.8), dmg: 40, cooldown: 20, vs: [100, 60, 0, 220], splash: t(1.3), melee: true,
    madeAt: K.Nest, needs: [K.Wallow],
  },
  [K.Rex]: {
    ...base, kind: K.Rex, name: 'Rex', plural: 'Rexes', short: 'Rex', cls: C.Armoured, hp: 850, cost: 275, gas: 225, time: 400, supply: 6,
    speed: 58, radius: t(0.6), sight: 9, range: t(0.75), dmg: 55, cooldown: 14, vs: [80, 180, 0, 100], melee: true, charge: 20,
    madeAt: K.Nest, needs: [K.Cave],
  },
  [K.Egg]: {
    ...base, kind: K.Egg, name: 'Egg', plural: 'Eggs', short: 'Egg', cls: C.Structure, hp: 60, cost: 0, time: 0, supply: 0,
    radius: t(0.3), sight: 2,
  },
  // ---------------------------------------------------------------- Dino Pack buildings
  // Each costs its price and the Gatherer that becomes it, and all but the Nest and the Dig go on nesting ground.
  [K.Nest]: {
    ...base, kind: K.Nest, name: 'Nest', plural: 'Nests', short: 'Nest', cls: C.Structure, hp: 1100, cost: 300, time: 400, supply: 0,
    radius: t(2), sight: 10, size: 4, provides: 40, building: true,
  },
  [K.Dig]: {
    ...base, kind: K.Dig, name: 'Dig', plural: 'Digs', short: 'Dig', cls: C.Structure, hp: 350, cost: 50, time: 180, supply: 0,
    radius: t(1), sight: 6, size: 2, building: true,
  },
  [K.Den]: {
    ...base, kind: K.Den, name: 'Den', plural: 'Dens', short: 'Den', cls: C.Structure, hp: 500, cost: 100, time: 280, supply: 0,
    radius: t(1.5), sight: 8, size: 3, building: true,
  },
  [K.Wallow]: {
    ...base, kind: K.Wallow, name: 'Wallow', plural: 'Wallows', short: 'Wallow', cls: C.Structure, hp: 600, cost: 150, gas: 100, time: 330, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Den], building: true,
  },
  [K.Roost]: {
    ...base, kind: K.Roost, name: 'Roost', plural: 'Roosts', short: 'Roost', cls: C.Structure, hp: 550, cost: 100, gas: 100, time: 330, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Den], building: true,
  },
  [K.BonePit]: {
    ...base, kind: K.BonePit, name: 'Bone Pit', plural: 'Bone Pits', short: 'Bone Pit', cls: C.Structure, hp: 550, cost: 100, gas: 75, time: 280, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Den], building: true,
  },
  [K.Cave]: {
    ...base, kind: K.Cave, name: 'Great Cave', plural: 'Great Caves', short: 'Cave', cls: C.Structure, hp: 650, cost: 150, gas: 200, time: 400, supply: 0,
    radius: t(1.5), sight: 8, size: 3, needs: [K.Wallow, K.BonePit], building: true,
  },
  [K.Volcano]: {
    ...base, kind: K.Volcano, name: 'Volcano', plural: 'Volcanoes', short: 'Volcano', cls: C.Structure, hp: 260, cost: 50, time: 200, supply: 0,
    radius: t(1), sight: 9, range: t(6.5), dmg: 14, cooldown: 8, vs: [100, 60, 100, 100], size: 2, needs: [K.Den], building: true,
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
  [K.Claws]: {
    ...base, kind: K.Claws, name: 'Claws', plural: 'Claws', short: 'Claws', cls: C.Structure, hp: 1, cost: 150, gas: 150, time: 600, supply: 0,
    radius: 0, sight: 0, madeAt: K.BonePit,
  },
  [K.Hide]: {
    ...base, kind: K.Hide, name: 'Hide', plural: 'Hide', short: 'Hide', cls: C.Structure, hp: 1, cost: 150, gas: 150, time: 600, supply: 0,
    radius: 0, sight: 0, madeAt: K.BonePit,
  },
};

export const def = (kind: number): Def => DEFS[kind]!;

export const isResearch = (kind: number): boolean => kind >= K.Weapons && kind <= K.Hide;
/** Which of a player's two research levels an item raises. */
export const researchOf = (kind: number): 'weapons' | 'armour' => (kind === K.Weapons || kind === K.Claws ? 'weapons' : 'armour');

/** What one unit or building is worth, in Blocks plus Batteries: an egg's price is shared by all that hatch from it. */
export const worth = (kind: number): number => Math.round((DEFS[kind]!.cost + DEFS[kind]!.gas) / DEFS[kind]!.brood);

/** The things every faction has one of, whatever it calls them. */
export const isWorker = (kind: number): boolean => kind === K.Worker || kind === K.Gatherer;
/** A Headquarters or a Nest: where Workers deliver, what gives supply, and what a side must keep one of. */
export const isHall = (kind: number): boolean => kind === K.HQ || kind === K.Nest;
/** A Refinery or a Dig: what stands on a battery pack. */
export const isRefinery = (kind: number): boolean => kind === K.Refinery || kind === K.Dig;

export interface Roster {
  name: string;
  hall: Kind;
  worker: Kind;
  refinery: Kind;
  /** Fixed defence. */
  turret: Kind;
  /** Where research is done. */
  lab: Kind;
  /** The first building that makes an army possible. */
  first: Kind;
  buildings: Kind[];
  units: Kind[];
  research: Kind[];
}

/** Faction rosters, in the order the panels show them. */
export const FACTIONS: Record<Faction, Roster> = {
  green: {
    name: 'Green Army', hall: K.HQ, worker: K.Worker, refinery: K.Refinery, turret: K.Turret, lab: K.Armory, first: K.Barracks,
    buildings: [K.HQ, K.Refinery, K.Barracks, K.Factory, K.Airfield, K.Armory, K.Heavy, K.Turret],
    units: [K.Worker, K.Trooper, K.Lancer, K.Runner, K.Tank, K.Mortar, K.Flak, K.Gunship, K.Jugger],
    research: [K.Weapons, K.Armour],
  },
  dino: {
    name: 'Dino Pack', hall: K.Nest, worker: K.Gatherer, refinery: K.Dig, turret: K.Volcano, lab: K.BonePit, first: K.Den,
    buildings: [K.Nest, K.Dig, K.Den, K.Wallow, K.Roost, K.BonePit, K.Cave, K.Volcano],
    units: [K.Gatherer, K.Raptor, K.Spitter, K.Horn, K.Ptero, K.Bronto, K.Rex],
    research: [K.Claws, K.Hide],
  },
};
export const FACTION_LIST: Faction[] = ['green', 'dino'];
/** Every kind of unit that fights, both factions. */
export const FIGHTERS: Kind[] = FACTION_LIST.flatMap((f) => FACTIONS[f].units.filter((k) => !isWorker(k)));

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
  /** How far a unit that fights hand to hand notices enemies, beyond its reach: it has to see them coming to get there. */
  meleeNotice: t(7),
  /** A Nest lays an egg this often, in ticks, and holds this many. */
  eggTicks: 50,
  eggMax: 3,
  /** Eggs a Nest starts the match with. */
  eggStart: 1,
  /** Dino buildings go within this many tiles of a finished Nest. */
  nestGround: 10,
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
