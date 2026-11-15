// Content data: every balance number lives here, not in code paths or the design doc.
import { C, K, TILE, type Def, type Faction, type Kind } from './types';

const t = (tiles: number) => Math.round(tiles * TILE);

const base = {
  gas: 0, speed: 0, range: 0, dmg: 0, cooldown: 0, vs: [100, 100, 100, 100] as const, splash: 0, minRange: 0, setup: 0,
  air: false, melee: false, charge: 0, raider: false, brood: 1, size: 0, provides: 0, building: false, hero: false, needs: [] as Kind[],
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
  // ---------------------------------------------------------------- Frenzy's heroes
  // One a side. `hp` and `dmg` are for level 1 and grow with level (`FRENZY.hpPer`, `dmgPer`).
  [K.Captain]: {
    ...base, kind: K.Captain, name: 'Captain', plural: 'Captains', short: 'Captain', cls: C.Armoured, hp: 520, cost: 0, time: 0, supply: 0,
    speed: 70, radius: t(0.36), sight: 10, range: t(5.5), dmg: 20, cooldown: 8, vs: [100, 100, 60, 100], hero: true,
  },
  [K.Alpha]: {
    ...base, kind: K.Alpha, name: 'Alpha', plural: 'Alphas', short: 'Alpha', cls: C.Armoured, hp: 1000, cost: 0, time: 0, supply: 0,
    speed: 84, radius: t(0.44), sight: 10, range: t(0.7), dmg: 30, cooldown: 9, vs: [100, 110, 0, 110], melee: true, charge: 30, hero: true,
  },
  // ---------------------------------------------------------------- Frenzy's own
  // The Green Army's free unit in Frenzy: a foot soldier with a fixed bayonet. Tougher than a Trooper and
  // quick on its feet, because it has to cross the ground a Trooper shoots over. It can't reach a flyer.
  [K.Bayonet]: {
    ...base, kind: K.Bayonet, name: 'Bayonet', plural: 'Bayonets', short: 'Bayonet', cls: C.Light, hp: 80, cost: 50, time: 150, supply: 1,
    speed: 72, radius: t(0.3), sight: 8, range: t(0.55), dmg: 9, cooldown: 8, vs: [100, 60, 0, 60], melee: true, charge: 22,
  },
  // Two stand behind every base. Each brings in Blocks by itself, and upgrades are bought while one stands.
  // Its price is never paid: it sets what bringing one down is worth.
  [K.Collector]: {
    ...base, kind: K.Collector, name: 'Collector', plural: 'Collectors', short: 'Collector', cls: C.Structure, hp: 2500, cost: 600, time: 0, supply: 0,
    radius: t(1), sight: 7, size: 2, building: true,
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
  [K.Muster]: {
    ...base, kind: K.Muster, name: 'Muster', plural: 'Muster', short: 'Muster', cls: C.Structure, hp: 1, cost: 150, time: 0, supply: 0,
    radius: 0, sight: 0,
  },
  [K.Haul]: {
    ...base, kind: K.Haul, name: 'Haul', plural: 'Haul', short: 'Haul', cls: C.Structure, hp: 1, cost: 200, time: 0, supply: 0,
    radius: 0, sight: 0,
  },
  [K.Might]: {
    ...base, kind: K.Might, name: 'Might', plural: 'Might', short: 'Might', cls: C.Structure, hp: 1, cost: 200, time: 0, supply: 0,
    radius: 0, sight: 0,
  },
  [K.Grit]: {
    ...base, kind: K.Grit, name: 'Grit', plural: 'Grit', short: 'Grit', cls: C.Structure, hp: 1, cost: 200, time: 0, supply: 0,
    radius: 0, sight: 0,
  },
  [K.Tempo]: {
    ...base, kind: K.Tempo, name: 'Tempo', plural: 'Tempo', short: 'Tempo', cls: C.Structure, hp: 1, cost: 200, time: 0, supply: 0,
    radius: 0, sight: 0,
  },
};

export const def = (kind: number): Def => DEFS[kind]!;

/** Research that is studied at a lab. (Muster is Frenzy's own, bought on the spot.) */
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
  /** Frenzy: who leads it, and the units its base can make, in panel order. The first comes free. */
  hero: Kind;
  frenzy: Kind[];
}

/** Faction rosters, in the order the panels show them. */
export const FACTIONS: Record<Faction, Roster> = {
  green: {
    name: 'Green Army', hall: K.HQ, worker: K.Worker, refinery: K.Refinery, turret: K.Turret, lab: K.Armory, first: K.Barracks,
    buildings: [K.HQ, K.Refinery, K.Barracks, K.Factory, K.Airfield, K.Armory, K.Heavy, K.Turret],
    units: [K.Worker, K.Trooper, K.Lancer, K.Runner, K.Tank, K.Mortar, K.Flak, K.Gunship, K.Jugger],
    research: [K.Weapons, K.Armour], hero: K.Captain,
    frenzy: [K.Bayonet, K.Trooper, K.Lancer, K.Runner, K.Tank, K.Mortar, K.Flak, K.Gunship, K.Jugger],
  },
  dino: {
    name: 'Dino Pack', hall: K.Nest, worker: K.Gatherer, refinery: K.Dig, turret: K.Volcano, lab: K.BonePit, first: K.Den,
    buildings: [K.Nest, K.Dig, K.Den, K.Wallow, K.Roost, K.BonePit, K.Cave, K.Volcano],
    units: [K.Gatherer, K.Raptor, K.Spitter, K.Horn, K.Ptero, K.Bronto, K.Rex],
    research: [K.Claws, K.Hide], hero: K.Alpha,
    frenzy: [K.Raptor, K.Spitter, K.Horn, K.Ptero, K.Bronto, K.Rex],
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

// ---------------------------------------------------------------- Frenzy

/** Frenzy's numbers: four corners, bases that make their own units, a hero each. */
export const FRENZY = {
  startBlocks: 100,
  /**
   * Blocks each standing Collector brings in every second, what each level of Haul adds to that, and what
   * holding the middle Watchtower alone adds. A base has two Collectors, so it starts on 4 a second.
   */
  collect: 2,
  haulPer: 1,
  middle: 4,
  /** Supply a base can keep in the field. */
  supply: 40,
  /**
   * A base's health, and its Turrets': far more than in Classic, where they are buildings among many and can
   * be built again. A base should outlast an army at its door by long enough for its own to come home.
   */
  hallHp: 5500,
  turretHp: 1500,
  /** A base's Turrets also reach further than Classic ones, so that Lancers can't pick them off from out of range. */
  turretReach: t(1.5),
  /**
   * And they hit harder, in percent of a Classic Turret's shot: on level ground, standing beside the base and
   * not in front of it, two Classic Turrets would not slow an early rush at all.
   */
  turretPower: 300,
  /**
   * Work a base does each tick, by Muster level. What each unit takes is in `WORK`. A base starts slowly (a
   * Bayonet every 7 seconds, a pair of Raptors every 5.7), so the first armies are small and the first Muster
   * is worth buying: it gives two thirds as much again.
   */
  musterRate: [6, 10, 14, 18] as readonly number[],
  /**
   * Price of each Muster level, and of each level of Weapons and Armour (Blocks only: Frenzy has no Batteries).
   * Frenzy has four levels of each where Classic has two: late in a round Blocks must still buy something.
   */
  musterCost: [150, 300, 450] as readonly number[],
  researchCost: [150, 300, 450, 600] as readonly number[],
  /**
   * Haul pays for itself: each level adds 2 Blocks a second to a base with both Collectors standing, so the
   * first is back in a minute and three quarters and the last in five and a half. Greed, bought early.
   */
  haulCost: [200, 350, 500, 650] as readonly number[],
  /**
   * The hero's own upgrades, three levels of each: somewhere for late Blocks to go. Might: the hero's hits
   * and its abilities' damage. Grit: its health. Tempo: how soon an ability is ready again. All in percent a level.
   */
  gearCost: [200, 400, 600] as readonly number[],
  mightPer: 15,
  gritPer: 20,
  tempoPer: 12,
  /** What a kill pays the side that made it: this share of the fallen unit's worth, in percent. */
  bounty: 25,
  /** A hero is worth this, and this more for each of its levels. A base is worth a flat sum. */
  heroBounty: 60,
  heroBountyPer: 15,
  hallBounty: 300,
  /** Experience: the same shape. A hero learns from whatever falls within reach of it. */
  xp: 20,
  heroXp: 80,
  heroXpPer: 20,
  hallXp: 250,
  xpReach: t(9),
  levelMax: 10,
  /** Experience to go from level n to n + 1 is this times n. */
  levelXp: 100,
  /** What each level adds to a hero's health and damage, in percent of level 1. */
  hpPer: 14,
  dmgPer: 12,
  /** A fallen hero is back after this many ticks, and this many more for each of its levels. */
  respawn: 100,
  respawnPer: 30,
  /** Beside its own base a hero mends this share of its health every second, in percent. */
  healReach: t(6),
  heal: 3,
  /** Rallied units fire and move this fast, in percent. */
  hasteFire: 130,
  hasteMove: 125,
  /** A blast does this share of its damage to a building, in percent. A Roar holds a hero for this share of the time. */
  blastVsBuilding: 50,
  dazeHero: 50,
  /** The group that is the hero and nothing else. */
  heroGroup: 3,
  /**
   * Overtime: from this tick on every base crumbles, losing this much health a second, except the base of
   * whoever holds the middle Watchtower alone. A round that armies can't settle is settled by the middle.
   */
  overtime: 6000,
  crumble: 20,
};

/** What it costs to unlock a unit for the mix. The first fighter of each faction comes free. */
export const UNLOCK: Record<number, number> = {
  [K.Trooper]: 100, [K.Lancer]: 100, [K.Runner]: 100, [K.Flak]: 200, [K.Tank]: 400, [K.Mortar]: 400, [K.Gunship]: 500, [K.Jugger]: 800,
  [K.Spitter]: 100, [K.Horn]: 300, [K.Ptero]: 350, [K.Bronto]: 500, [K.Rex]: 800,
};

/**
 * The work a base does to turn out one unit (for Raptors, the pair). A bigger unit takes longer, but not in
 * proportion to its price: a base making Juggernauts puts nearly twice the worth on the field each second
 * that one making Troopers does, which is what unlocking them buys. The Dino Pack's are quicker than their
 * prices would give: with no eggs to bank in Frenzy, numbers are how it keeps up.
 */
export const WORK: Record<number, number> = {
  [K.Bayonet]: 396, [K.Trooper]: 400, [K.Lancer]: 570, [K.Runner]: 480, [K.Flak]: 1000, [K.Tank]: 1330, [K.Mortar]: 1330, [K.Gunship]: 1660, [K.Jugger]: 2570,
  [K.Raptor]: 340, [K.Spitter]: 420, [K.Horn]: 800, [K.Ptero]: 1050, [K.Bronto]: 1650, [K.Rex]: 2450,
};

/** The units a faction can field in Frenzy, in panel order. */
export const frenzyUnits = (f: Faction): Kind[] => FACTIONS[f].frenzy;

/** Everything a Collector sells, in panel order: the army's, the base's, the hero's. */
export const frenzyUpgrades = (f: Faction): Kind[] => [...FACTIONS[f].research, K.Muster, K.Haul, K.Might, K.Grit, K.Tempo];

/** The levels a side holds, as far as upgrades go. */
export interface Levels { weapons: number; armour: number; muster: number; haul: number; might: number; grit: number; tempo: number }
type LevelKey = keyof Levels;

/** Which of a side's levels an upgrade raises. */
export function upgradeKey(kind: number): LevelKey {
  switch (kind) {
    case K.Muster: return 'muster';
    case K.Haul: return 'haul';
    case K.Might: return 'might';
    case K.Grit: return 'grit';
    case K.Tempo: return 'tempo';
    default: return researchOf(kind);
  }
}

/** What each level of an upgrade costs in Frenzy, first level first. Its length is how many levels there are. */
export function upgradeCosts(kind: number): readonly number[] {
  switch (kind) {
    case K.Muster: return FRENZY.musterCost;
    case K.Haul: return FRENZY.haulCost;
    case K.Might: case K.Grit: case K.Tempo: return FRENZY.gearCost;
    default: return FRENZY.researchCost;
  }
}

/** One line on what an upgrade does, for the panel. */
export function upgradeBlurb(kind: number): string {
  switch (kind) {
    case K.Weapons: case K.Claws: return 'Your units hit harder';
    case K.Armour: case K.Hide: return 'Your units take less';
    case K.Muster: return 'The base makes units faster';
    case K.Haul: return 'Each Collector brings in more Blocks';
    case K.Might: return 'Your hero and its abilities hit harder';
    case K.Grit: return 'Your hero has more health';
    default: return "Your hero's abilities are ready sooner";
  }
}

/** Blocks a side's Collectors bring in each second: nothing with none standing. */
export const income = (collectors: number, haul: number): number => collectors * (FRENZY.collect + haul * FRENZY.haulPer);

export interface Ability {
  name: string;
  /** What the button says under its picture. */
  short: string;
  /** One line for the panel. */
  blurb: string;
  /** The hero level that opens it. */
  level: number;
  /** Ticks before it can be used again. */
  cd: number;
  /**
   * blast: damage in a circle at a point. leap: the hero jumps to a point and lands as a blast.
   * haste: the hero's own units nearby move and fire faster. daze: enemies nearby are stunned.
   * pack: units hatch around the hero and fight for a while.
   */
  kind: 'blast' | 'leap' | 'haste' | 'daze' | 'pack';
  /** How far the hero can point it, in sub-units; 0 for one that works where the hero stands. */
  range: number;
  radius: number;
  /** Ticks between the order and the effect. */
  delay: number;
  /** Damage, or how many are called up; and what each hero level past the one that opens it adds. */
  power: number;
  per: number;
  /** How long the effect lasts, in ticks. */
  time: number;
  /** pack: what is called up. */
  calls?: Kind;
}

export const ABILITIES: Record<number, readonly Ability[]> = {
  [K.Captain]: [
    { name: 'Grenade', short: 'Grenade', blurb: 'A blast where you point', level: 1, cd: 100, kind: 'blast', range: t(6.5), radius: t(1.6), delay: 6, power: 55, per: 9, time: 0 },
    { name: 'Rally', short: 'Rally', blurb: 'Your units nearby move and fire faster', level: 3, cd: 250, kind: 'haste', range: 0, radius: t(6), delay: 0, power: 0, per: 0, time: 80 },
    { name: 'Air strike', short: 'Strike', blurb: 'A heavy blast over a wide area', level: 6, cd: 600, kind: 'blast', range: t(9), radius: t(2.8), delay: 15, power: 170, per: 25, time: 0 },
  ],
  [K.Alpha]: [
    { name: 'Pounce', short: 'Pounce', blurb: 'Leaps where you point and lands hard', level: 1, cd: 100, kind: 'leap', range: t(6), radius: t(1.4), delay: 3, power: 50, per: 8, time: 0 },
    { name: 'Roar', short: 'Roar', blurb: 'Stuns enemies nearby', level: 3, cd: 250, kind: 'daze', range: 0, radius: t(4.5), delay: 0, power: 0, per: 0, time: 25 },
    { name: 'Call the Pack', short: 'Pack', blurb: 'Raptors hatch around it for a while', level: 6, cd: 600, kind: 'pack', range: 0, radius: t(1.4), delay: 1, power: 6, per: 1, time: 250, calls: K.Raptor },
  ],
};

/**
 * How strong an ability is in the hands of a hero of this level: its damage, which Might raises, or for one
 * that calls units up, how many (which Might does not).
 */
export function abilityPower(a: Ability, level: number, might = 0): number {
  const p = a.power + a.per * Math.max(0, level - a.level);
  return a.kind === 'pack' ? p : Math.trunc((p * (100 + FRENZY.mightPer * might)) / 100);
}

/** Ticks before an ability can be used again, by a hero with this much Tempo. */
export const abilityCd = (a: Ability, tempo = 0): number => Math.max(10, Math.trunc((a.cd * (100 - FRENZY.tempoPer * tempo)) / 100));

/**
 * A hero's full health and the damage of one of its hits, at a level, with what Grit and Might add.
 * Everything else has what its Def says.
 */
export const heroHp = (kind: number, level: number, grit = 0): number =>
  Math.trunc((Math.trunc((DEFS[kind]!.hp * (100 + FRENZY.hpPer * Math.max(0, level - 1))) / 100) * (100 + FRENZY.gritPer * grit)) / 100);
export const heroDmg = (kind: number, level: number, might = 0): number =>
  Math.trunc((Math.trunc((DEFS[kind]!.dmg * (100 + FRENZY.dmgPer * Math.max(0, level - 1))) / 100) * (100 + FRENZY.mightPer * might)) / 100);

/** Experience a hero of this level needs for the next one. */
export const levelNeeds = (level: number): number => FRENZY.levelXp * level;
/** Ticks a hero of this level stays down. */
export const respawnTicks = (level: number): number => FRENZY.respawn + FRENZY.respawnPer * level;

