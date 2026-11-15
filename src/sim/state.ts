// Game state: creation, entity bookkeeping and small shared helpers.
import { DEFS, FACTIONS, RULES, def, isHall, isRefinery } from './data';
import { updateFog } from './fog';
import { twinRidges } from './map';
import { Nav, dist } from './nav';
import { K, O, TILE, W, type Command, type Entity, type Faction, type GameEvent, type GameMap, type Kind, type Player } from './types';

export interface Game {
  tick: number;
  seed: number;
  map: GameMap;
  nav: Nav;
  /** Every entity, in id order. */
  ents: Entity[];
  byId: Map<number, Entity>;
  nextId: number;
  players: Player[];
  /** Commands waiting for their tick. */
  pending: { tick: number; cmd: Command }[];
  /** Every command that ran, with its tick: a match is its seed plus this list. */
  log: { tick: number; cmd: Command }[];
  /** What happened this tick, for the screen and the bots. Not part of the rules. */
  events: GameEvent[];
  /** -1 while the match runs, else the winner's id. */
  winner: number;
  /** Players whose Workers should be shared out again because a Headquarters of theirs just opened: bit 0, bit 1. */
  rebalance: number;
}

export function tileOf(v: number): number {
  return Math.floor(v / TILE);
}

export function tileIndex(g: Game, x: number, y: number): number {
  const tx = Math.max(0, Math.min(g.map.w - 1, tileOf(x)));
  const ty = Math.max(0, Math.min(g.map.h - 1, tileOf(y)));
  return ty * g.map.w + tx;
}

export function spawn(g: Game, kind: Kind, owner: number, x: number, y: number): Entity {
  const d = def(kind);
  const e: Entity = {
    id: g.nextId++, kind, owner, x, y, px: x, py: y, qx: 0, qy: 0, hp: d.hp, fx: owner === 1 ? -1 : 1, fy: 0,
    group: -1, mode: O.Idle, dx: x, dy: y, ax: x, ay: y, tgt: 0, cd: 0, los: false, losTick: -99, arrived: true,
    still: 0, frac: 0,
    ws: W.Idle, carry: 0, cargo: 0, pile: 0, site: 0, timer: 0,
    built: true, progress: 0, queue: [], qprog: 0, builder: 0,
    amount: 0, busy: 0, eggs: 0,
  };
  g.ents.push(e);
  g.byId.set(e.id, e);
  return e;
}

/** Top-left tile of a building or pile's footprint. */
export function footprint(e: Entity): { tx: number; ty: number; size: number } {
  const size = def(e.kind).size;
  return { tx: tileOf(e.x - (size * TILE) / 2), ty: tileOf(e.y - (size * TILE) / 2), size };
}

export function footprintTiles(g: Game, e: Entity): number[] {
  const f = footprint(e);
  const out: number[] = [];
  for (let y = f.ty; y < f.ty + f.size; y++) for (let x = f.tx; x < f.tx + f.size; x++) out.push(y * g.map.w + x);
  return out;
}

function newPlayer(id: number, tiles: number, faction: Faction): Player {
  return {
    id, faction, blocks: RULES.startBlocks, gas: 0, weapons: 0, armour: 0, supply: 0, cap: 0, rally: 0, repeat: [],
    groups: Array.from({ length: RULES.groups }, () => ({ mode: O.Idle, x: 0, y: 0 })),
    vis: new Uint8Array(tiles), visAir: new Uint8Array(tiles), explored: new Uint8Array(tiles), seen: new Map(),
    stats: { gathered: 0, gathered2: 0, spent: 0, trained: 0, lostUnits: 0, lostBuildings: 0, killedUnits: 0, killedBuildings: 0, firstAttackTick: -1 },
  };
}

/** A new match. `factions` says what each side plays: the Green Army unless told otherwise. */
export function createGame(seed: number, map: GameMap = twinRidges(), factions: readonly [Faction, Faction] = ['green', 'green']): Game {
  const g: Game = {
    tick: 0, seed, map, nav: new Nav(map.w, map.h, map.rock),
    ents: [], byId: new Map(), nextId: 1,
    players: [newPlayer(0, map.w * map.h, factions[0]), newPlayer(1, map.w * map.h, factions[1])],
    pending: [], log: [], events: [], winner: -1, rebalance: 0,
  };
  for (const b of map.bases) {
    for (const p of b.piles) {
      const e = spawn(g, K.Pile, -1, p.tx * TILE + TILE / 2, p.ty * TILE + TILE / 2);
      e.amount = p.amount;
      g.nav.setRect(p.tx, p.ty, 1, 1);
    }
    for (const c of b.cells) {
      const e = spawn(g, K.Cell, -1, (c.tx + 1) * TILE, (c.ty + 1) * TILE);
      e.amount = c.amount;
      g.nav.setRect(c.tx, c.ty, 2, 1);
    }
  }
  for (const t of map.towers) {
    spawn(g, K.Tower, -1, t.tx * TILE + TILE / 2, t.ty * TILE + TILE / 2);
    g.nav.setRect(t.tx, t.ty, 1, 1);
  }
  for (const pl of g.players) {
    const b = map.bases.find((s) => s.side === pl.id && s.tier === 0)!;
    const f = FACTIONS[pl.faction];
    const size = DEFS[f.hall]!.size;
    const hq = spawn(g, f.hall, pl.id, (b.hx + size / 2) * TILE, (b.hy + size / 2) * TILE);
    if (f.hall === K.Nest) hq.eggs = RULES.eggStart;
    g.nav.setRect(b.hx, b.hy, size, 1);
    // Workers start in a row on the side of the Headquarters that faces the Blocks.
    const px = b.piles.reduce((s, p) => s + p.tx, 0) / b.piles.length;
    const side = px * TILE < hq.x ? -1 : 1;
    for (let i = 0; i < RULES.startWorkers; i++) {
      // The far side's row is made in the opposite order, so the two rows are mirror images Worker for Worker.
      const k = pl.id === 1 ? RULES.startWorkers - 1 - i : i;
      const wx = hq.x + side * (size / 2 + 0.6) * TILE;
      const wy = hq.y + Math.round((k - (RULES.startWorkers - 1) / 2) * 0.5 * TILE);
      spawn(g, f.worker, pl.id, Math.round(wx), wy);
    }
  }
  updateFog(g);
  for (const pl of g.players) {
    pl.supply = countSupply(g, pl.id);
    pl.cap = supplyCap(g, pl.id);
  }
  return g;
}

export function schedule(g: Game, cmd: Command): void {
  g.pending.push({ tick: g.tick + 1, cmd });
}

export function hasBuilt(g: Game, owner: number, kind: number): boolean {
  for (const e of g.ents) if (e.owner === owner && e.kind === kind && e.built) return true;
  return false;
}

/** True when this player has finished every building in the list. */
export function hasAll(g: Game, owner: number, kinds: readonly number[]): boolean {
  for (const k of kinds) if (!hasBuilt(g, owner, k)) return false;
  return true;
}

/** The first building in the list this player has not finished, or 0. */
export function missing(g: Game, owner: number, kinds: readonly number[]): number {
  for (const k of kinds) if (!hasBuilt(g, owner, k)) return k;
  return 0;
}

/** The free battery pack whose corner is this tile, if there is one. */
export function cellAt(g: Game, tx: number, ty: number): Entity | undefined {
  for (const e of g.ents) {
    if (e.kind === K.Cell && e.site === 0 && tileOf(e.x - TILE) === tx && tileOf(e.y - TILE) === ty) return e;
  }
  return undefined;
}

export function countSupply(g: Game, owner: number): number {
  let s = 0;
  for (const e of g.ents) {
    if (e.owner !== owner) continue;
    const d = def(e.kind);
    if (!d.building) s += d.supply;
    // Whatever is on its way counts already: a queued unit, or everything inside an egg.
    for (const q of e.queue) s += def(q).supply * (e.kind === K.Egg ? def(q).brood : 1);
  }
  return s;
}

export function supplyCap(g: Game, owner: number): number {
  let c = 0;
  for (const e of g.ents) if (e.owner === owner && e.built) c += def(e.kind).provides;
  return Math.min(RULES.supplyMax, c);
}

/** Can this player put this building with its top-left corner on this tile? */
export function canPlace(g: Game, owner: number, kind: number, tx: number, ty: number): boolean {
  const d = DEFS[kind];
  if (!d || !d.building) return false;
  // A Refinery or a Dig stands on a battery pack and nowhere else.
  if (isRefinery(kind)) return cellAt(g, tx, ty) !== undefined;
  for (let y = ty; y < ty + d.size; y++) for (let x = tx; x < tx + d.size; x++) {
    if (g.nav.isBlocked(x, y)) return false;
  }
  // The Dino Pack builds on nesting ground: near a finished Nest. Only a new Nest can go anywhere.
  if (FACTIONS.dino.buildings.includes(kind as Kind) && !isHall(kind)) {
    return onNestingGround(g, owner, tx * TILE + (d.size * TILE) / 2, ty * TILE + (d.size * TILE) / 2);
  }
  return true;
}

/** Is this point within reach of one of this player's finished Nests? */
export function onNestingGround(g: Game, owner: number, x: number, y: number): boolean {
  for (const e of g.ents) {
    if (e.owner === owner && e.kind === K.Nest && e.built && e.hp > 0 && dist(e.x, e.y, x, y) <= RULES.nestGround * TILE) return true;
  }
  return false;
}

export function groupUnits(g: Game, owner: number, group: number): Entity[] {
  const out: Entity[] = [];
  for (const e of g.ents) if (e.owner === owner && e.group === group && e.hp > 0) out.push(e);
  return out;
}

/**
 * The middle of a set of units, in whole sub-units. Rounded away from the middle of the map, so that the
 * middle of a mirrored set is the mirror image of this one (plain rounding always leans the same way).
 */
export function centroid(units: readonly Entity[], map?: GameMap): { x: number; y: number } {
  let x = 0, y = 0;
  for (const u of units) {
    x += u.x;
    y += u.y;
  }
  const n = Math.max(1, units.length);
  const cx = map ? (map.w * TILE) / 2 : 0, cy = map ? (map.h * TILE) / 2 : 0;
  const away = (v: number, c: number) => (v >= c ? c + Math.floor(v - c + 0.5) : c - Math.floor(c - v + 0.5));
  return { x: away(x / n, cx), y: away(y / n, cy) };
}

/**
 * Is a point on a tile where `layer` is set? A point exactly on the line between tiles counts if any tile
 * touching it does: the line belongs to neither side, so the answer is the same seen from either end of the map.
 */
export function onLayer(g: Game, layer: Uint8Array, x: number, y: number): boolean {
  const w = g.map.w, h = g.map.h;
  const tx = Math.max(0, Math.min(w - 1, tileOf(x))), ty = Math.max(0, Math.min(h - 1, tileOf(y)));
  if (layer[ty * w + tx] === 1) return true;
  const onX = x % TILE === 0 && tx > 0, onY = y % TILE === 0 && ty > 0;
  if (onX && layer[ty * w + tx - 1] === 1) return true;
  if (onY && layer[(ty - 1) * w + tx] === 1) return true;
  return onX && onY && layer[(ty - 1) * w + tx - 1] === 1;
}

/** Can this player see this thing right now? Flyers are seen from any height; the ground is not. */
export function visibleTo(g: Game, owner: number, e: Entity): boolean {
  const pl = g.players[owner]!;
  return onLayer(g, def(e.kind).air ? pl.visAir : pl.vis, e.x, e.y);
}

/** The same, judged by where the thing stood when this tick's moves began. */
export function wasVisibleTo(g: Game, owner: number, e: Entity): boolean {
  const pl = g.players[owner]!;
  return onLayer(g, def(e.kind).air ? pl.visAir : pl.vis, e.px, e.py);
}

export function distEnt(a: Entity, b: Entity): number {
  return dist(a.x, a.y, b.x, b.y);
}

/** A checksum of everything the rules depend on. Two runs that agree on this agree on the match. */
export function hash(g: Game): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= v & 0xffff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xffff;
    h = Math.imul(h, 0x01000193);
  };
  mix(g.tick);
  mix(g.winner + 1);
  for (const p of g.players) {
    mix(p.blocks);
    mix(p.gas);
    mix(p.rally + p.weapons * 8 + p.armour * 64 + (p.faction === 'dino' ? 512 : 0));
  }
  for (const e of g.ents) {
    mix(e.id);
    mix(e.kind);
    mix(e.owner + 1);
    mix(e.x);
    mix(e.y);
    mix(e.hp);
    mix(e.carry + e.ws * 8 + e.mode * 64 + e.cargo * 512);
    mix(e.still + e.frac * 1024);
    mix(e.amount + e.eggs * 65536);
    mix(e.progress + e.qprog * 1024);
  }
  return h >>> 0;
}
