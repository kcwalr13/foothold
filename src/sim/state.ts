// Game state: creation, entity bookkeeping and small shared helpers.
import { DEFS, RULES, def } from './data';
import { updateFog } from './fog';
import { twinRidges } from './map';
import { Nav, dist } from './nav';
import { K, O, TILE, W, type Command, type Entity, type GameEvent, type GameMap, type Kind, type Player } from './types';

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
    id: g.nextId++, kind, owner, x, y, hp: d.hp, fx: owner === 1 ? -1 : 1, fy: 0,
    group: -1, mode: O.Idle, dx: x, dy: y, ax: x, ay: y, tgt: 0, cd: 0, los: false, losTick: -99, arrived: true,
    ws: W.Idle, carry: 0, pile: 0, site: 0, timer: 0,
    built: true, progress: 0, queue: [], qprog: 0, builder: 0,
    amount: 0, busy: 0,
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

function newPlayer(id: number, tiles: number): Player {
  return {
    id, faction: 'green', blocks: RULES.startBlocks, supply: 0, cap: 0, rally: 0, repeat: [],
    groups: Array.from({ length: RULES.groups }, () => ({ mode: O.Idle, x: 0, y: 0 })),
    vis: new Uint8Array(tiles), explored: new Uint8Array(tiles), seen: new Map(),
    stats: { gathered: 0, spent: 0, trained: 0, lostUnits: 0, lostBuildings: 0, killedUnits: 0, killedBuildings: 0, firstAttackTick: -1 },
  };
}

export function createGame(seed: number, map: GameMap = twinRidges()): Game {
  const g: Game = {
    tick: 0, seed, map, nav: new Nav(map.w, map.h, map.rock),
    ents: [], byId: new Map(), nextId: 1,
    players: [newPlayer(0, map.w * map.h), newPlayer(1, map.w * map.h)],
    pending: [], log: [], events: [], winner: -1, rebalance: -1,
  };
  for (const b of map.bases) {
    for (const p of b.piles) {
      const e = spawn(g, K.Pile, -1, p.tx * TILE + TILE / 2, p.ty * TILE + TILE / 2);
      e.amount = p.amount;
      g.nav.setRect(p.tx, p.ty, 1, 1);
    }
  }
  for (const pl of g.players) {
    const b = map.bases.find((s) => s.side === pl.id && s.tier === 0)!;
    const size = DEFS[K.HQ]!.size;
    const hq = spawn(g, K.HQ, pl.id, (b.hx + size / 2) * TILE, (b.hy + size / 2) * TILE);
    g.nav.setRect(b.hx, b.hy, size, 1);
    // Workers start in a row on the side of the Headquarters that faces the Blocks.
    const px = b.piles.reduce((s, p) => s + p.tx, 0) / b.piles.length;
    const side = px * TILE < hq.x ? -1 : 1;
    for (let i = 0; i < RULES.startWorkers; i++) {
      const wx = hq.x + side * (size / 2 + 0.6) * TILE;
      const wy = hq.y + Math.round((i - (RULES.startWorkers - 1) / 2) * 0.5 * TILE);
      spawn(g, K.Worker, pl.id, Math.round(wx), wy);
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

export function countSupply(g: Game, owner: number): number {
  let s = 0;
  for (const e of g.ents) {
    if (e.owner !== owner) continue;
    const d = def(e.kind);
    if (!d.building) s += d.supply;
    for (const q of e.queue) s += def(q).supply;
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
  for (let y = ty; y < ty + d.size; y++) for (let x = tx; x < tx + d.size; x++) {
    if (g.nav.isBlocked(x, y)) return false;
  }
  void owner;
  return true;
}

export function groupUnits(g: Game, owner: number, group: number): Entity[] {
  const out: Entity[] = [];
  for (const e of g.ents) if (e.owner === owner && e.group === group && e.hp > 0) out.push(e);
  return out;
}

export function centroid(units: readonly Entity[]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const u of units) {
    x += u.x;
    y += u.y;
  }
  const n = Math.max(1, units.length);
  return { x: Math.trunc(x / n), y: Math.trunc(y / n) };
}

export function visibleTo(g: Game, owner: number, e: Entity): boolean {
  return g.players[owner]!.vis[tileIndex(g, e.x, e.y)] === 1;
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
    mix(p.rally);
  }
  for (const e of g.ents) {
    mix(e.id);
    mix(e.kind);
    mix(e.owner + 1);
    mix(e.x);
    mix(e.y);
    mix(e.hp);
    mix(e.carry + e.ws * 8 + e.mode * 64);
    mix(e.amount);
    mix(e.progress + e.qprog * 1024);
  }
  return h >>> 0;
}
