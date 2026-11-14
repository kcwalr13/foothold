// Core types for the Foothold rules engine. Everything in src/sim is pure and deterministic:
// whole-number maths only, no DOM, no Date, no Math.random.

/** Sub-units per map tile. Positions are whole numbers of sub-units. */
export const TILE = 256;
export const TICKS_PER_SEC = 10;

export const K = {
  Worker: 1, Trooper: 2, Lancer: 3, Runner: 4,
  HQ: 20, Barracks: 21, Turret: 22,
  Pile: 40,
} as const;
export type Kind = (typeof K)[keyof typeof K];

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
  cls: Cls;
  hp: number;
  cost: number;
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
  /** Footprint in tiles (buildings and piles). */
  size: number;
  /** Building that trains this unit. */
  madeAt?: Kind;
  /** Building that must exist before this can be built or trained. */
  needs?: Kind;
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

  // Workers
  ws: number;
  carry: number;
  pile: number;
  site: number;
  timer: number;

  // Buildings
  built: boolean;
  progress: number;
  queue: Kind[];
  qprog: number;
  /** Worker id building this site. */
  builder: number;

  // Piles
  amount: number;
  busy: number;
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
  faction: 'green';
  blocks: number;
  supply: number;
  cap: number;
  /** New units join this group. */
  rally: number;
  /** Unit kinds set to keep training. */
  repeat: Kind[];
  groups: GroupState[];
  /** 1 where this player can see right now, per tile. */
  vis: Uint8Array;
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
  bases: BaseSite[];
  /** Decoration for the renderer, in tile coordinates. */
  roads: { x: number; y: number }[][];
  labels: { text: string; x: number; y: number; rot: number }[];
}
