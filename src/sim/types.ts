// Core types for the Foothold rules engine. Everything in src/sim is pure and deterministic:
// whole-number maths only, no DOM, no Date, no Math.random.

/** Sub-units per map tile. Positions are whole numbers of sub-units. */
export const TILE = 256;
export const TICKS_PER_SEC = 10;

export const K = {
  // The Green Army.
  Worker: 1, Trooper: 2, Lancer: 3, Runner: 4, Tank: 5, Mortar: 6, Flak: 7, Gunship: 8, Jugger: 9,
  HQ: 20, Barracks: 21, Turret: 22, Refinery: 23, Factory: 24, Airfield: 25, Armory: 26, Heavy: 27,
  // The Dino Pack. An Egg is a dinosaur on its way: it sits by its Nest until it hatches.
  Gatherer: 10, Raptor: 11, Spitter: 12, Horn: 13, Ptero: 14, Bronto: 15, Rex: 16, Egg: 19,
  Nest: 30, Dig: 31, Den: 32, Wallow: 33, Roost: 34, BonePit: 35, Cave: 36, Volcano: 37,
  /** Neutral things on the map: Blocks, a battery pack, a watchtower. */
  Pile: 40, Cell: 41, Tower: 42,
  /** Research, queued at the Armory or the Bone Pit like a unit. */
  Weapons: 100, Armour: 101, Claws: 102, Hide: 103,
} as const;
export type Kind = (typeof K)[keyof typeof K];

export type Faction = 'green' | 'dino';

/** Armour class. Counters work by class, so they hold across factions. */
export const C = { Light: 0, Armoured: 1, Air: 2, Structure: 3 } as const;
export type Cls = (typeof C)[keyof typeof C];

/** What a unit is doing. */
export const O = { Idle: 0, Attack: 1, Move: 2, Hold: 3 } as const;
export type OrderMode = (typeof O)[keyof typeof O];

/** Worker states. */
export const W = { Idle: 0, ToPile: 1, Harvest: 2, ToHQ: 3, ToSite: 4, Build: 5 } as const;

export interface Def {
  kind: Kind;
  name: string;
  plural: string;
  /** A name short enough for a panel button. */
  short: string;
  cls: Cls;
  hp: number;
  /** Cost in Blocks. */
  cost: number;
  /** Cost in Batteries. */
  gas: number;
  /** Ticks to train or build. */
  time: number;
  supply: number;
  /** Sub-units per tick. 0 for buildings. */
  speed: number;
  /** Body radius in sub-units. */
  radius: number;
  /** Sight in tiles. */
  sight: number;
  /** Weapon range in sub-units; 0 means unarmed. */
  range: number;
  dmg: number;
  /** Ticks between shots. */
  cooldown: number;
  /** Damage percent against Light, Armoured, Air, Structure. */
  vs: readonly [number, number, number, number];
  /** Splash radius in sub-units; 0 for a single target. Others in the blast take a share of the damage. */
  splash: number;
  /** Can't fire at anything closer than this, in sub-units. */
  minRange: number;
  /** Ticks it must stand still before firing. */
  setup: number;
  /** Flies: ignores terrain and walls, and only weapons that hit Air can touch it. */
  air: boolean;
  /** Fights with teeth, horns or feet: it must reach what it attacks, and high ground lends it no range. */
  melee: boolean;
  /** Extra speed, in sub-units per tick, while it closes on something it means to hit. */
  charge: number;
  /** Goes for Workers first. */
  raider: boolean;
  /** How many come out of one egg. */
  brood: number;
  /** Footprint in tiles (buildings and piles). */
  size: number;
  /** Building that trains this unit. */
  madeAt?: Kind;
  /** Buildings that must all exist before this can be built or trained. */
  needs: readonly Kind[];
  /** Supply cap this building provides. */
  provides: number;
  building: boolean;
}

export interface Entity {
  id: number;
  kind: Kind;
  /** 0 or 1; -1 for neutral piles. */
  owner: number;
  x: number;
  y: number;
  /** Where it stood when this tick's moves began. Every unit judges the others by this, so the order units are moved in favours no one. */
  px: number;
  py: number;
  /** How far its neighbours have pushed it this tick, added up before anyone is moved. */
  qx: number;
  qy: number;
  hp: number;
  /** Facing as a rough direction vector (render only, still whole numbers). */
  fx: number;
  fy: number;

  // Units
  /** Army group 0..3, or -1 (workers, buildings). */
  group: number;
  mode: OrderMode;
  /** Order destination (sub-units). */
  dx: number;
  dy: number;
  /** Where an idle unit returns to after chasing. */
  ax: number;
  ay: number;
  /** Attack target id, 0 for none. */
  tgt: number;
  /** Ticks until the weapon can fire again. */
  cd: number;
  /** Cached "straight line is clear" flag and the tick it was checked. */
  los: boolean;
  losTick: number;
  /** True once a unit has reached its order destination. */
  arrived: boolean;
  /** Ticks since it last moved under its own power. */
  still: number;
  /** Hundredths of a point of damage carried over to this unit's next shot. */
  frac: number;

  // Workers
  ws: number;
  carry: number;
  /** What the load is: 0 Blocks, 1 Batteries. */
  cargo: number;
  pile: number;
  site: number;
  timer: number;

  // Buildings
  built: boolean;
  progress: number;
  queue: Kind[];
  qprog: number;
  /** Worker id building this site; -1 for a Dino building, which a Gatherer has become and which grows by itself. */
  builder: number;

  // Piles
  amount: number;
  busy: number;

  // Nests
  /** Eggs laid and waiting to be hatched. */
  eggs: number;
}

export interface GroupState {
  mode: OrderMode;
  x: number;
  y: number;
}

export interface Ghost {
  id: number;
  kind: Kind;
  owner: number;
  x: number;
  y: number;
}

export interface Stats {
  gathered: number;
  gathered2: number;
  spent: number;
  trained: number;
  lostUnits: number;
  lostBuildings: number;
  killedUnits: number;
  killedBuildings: number;
  firstAttackTick: number;
}

export interface Player {
  id: number;
  faction: Faction;
  blocks: number;
  /** Batteries. */
  gas: number;
  /** Research levels: weapons and armour, 0 to 2. */
  weapons: number;
  armour: number;
  supply: number;
  cap: number;
  /** New units join this group. */
  rally: number;
  /** Unit kinds set to keep training. */
  repeat: Kind[];
  groups: GroupState[];
  /** 1 where this player can see the ground right now, per tile. High ground hides from low ground. */
  vis: Uint8Array;
  /** 1 where this player can see flyers right now: sight with height ignored. */
  visAir: Uint8Array;
  /** 1 where this player has ever seen, per tile. */
  explored: Uint8Array;
  /** Enemy buildings this player remembers. */
  seen: Map<number, Ghost>;
  stats: Stats;
}

export type Command =
  | { t: 'build'; p: number; kind: Kind; tx: number; ty: number }
  | { t: 'cancel'; p: number; id: number }
  | { t: 'train'; p: number; kind: Kind }
  | { t: 'research'; p: number; kind: Kind }
  | { t: 'repeat'; p: number; kind: Kind; on: boolean }
  | { t: 'order'; p: number; group: number; mode: OrderMode; x: number; y: number }
  | { t: 'assign'; p: number; from: number; to: number; kind: number; count: number }
  | { t: 'rally'; p: number; group: number };

export type GameEvent =
  | { t: 'shot'; from: number; to: number; kind: Kind; x1: number; y1: number; x2: number; y2: number; owner: number }
  | { t: 'death'; kind: Kind; owner: number; x: number; y: number; fx: number; fy: number }
  | { t: 'hurt'; owner: number; x: number; y: number; kind: Kind }
  | { t: 'done'; owner: number; kind: Kind; x: number; y: number }
  | { t: 'refused'; p: number; why: string };

export interface BaseSite {
  id: number;
  name: string;
  /** Top-left tile of the Headquarters footprint that fits this site. */
  hx: number;
  hy: number;
  piles: { tx: number; ty: number; amount: number }[];
  /** Battery packs: top-left tile of each two-by-two pack. */
  cells: { tx: number; ty: number; amount: number }[];
  /** 0 or 1: the side of the map this base sits on. */
  side: number;
  /** 0 main, 1 natural, 2 third, 3 rich. */
  tier: number;
}

export interface GameMap {
  name: string;
  w: number;
  h: number;
  /** 1 where terrain is impassable. */
  rock: Uint8Array;
  /** 1 where the ground is high: it outranges low ground and can't be seen from below. */
  high: Uint8Array;
  bases: BaseSite[];
  /** Watchtowers: whoever alone stands beside one sees the country around it. */
  towers: { tx: number; ty: number }[];
  /** Decoration for the renderer, in tile coordinates. */
  roads: { x: number; y: number }[][];
  labels: { text: string; x: number; y: number; rot: number; small?: boolean }[];
}
