// What a side's research adds to each kind of its units, added up once and kept until the next item is
// finished. Nothing here is state: it is worked out again from `Player.tech` whenever it is asked for.
import { DEFS, FACTIONS, TECH, techLevel } from './data';
import type { Game } from './state';
import type { Entity, Player } from './types';

export interface Boost {
  /** Sub-units more reach. */
  range: number;
  /** Percent faster. */
  speed: number;
  /** Percent harder hits. */
  dmg: number;
  /** Percent less damage taken. */
  taken: number;
  /** Blocks more a trip. */
  carry: number;
  /** Percent of full health a second, once left alone a while. */
  mend: number;
}

const NONE: Readonly<Boost> = Object.freeze({ range: 0, speed: 0, dmg: 0, taken: 0, carry: 0, mend: 0 });
const CACHE = new WeakMap<Player, Boost[]>();

function build(pl: Player): Boost[] {
  const out: Boost[] = [];
  for (const k of FACTIONS[pl.faction].tech) {
    const fx = TECH[k];
    if (!fx || techLevel(pl, k) === 0) continue;
    for (const u of fx.units) {
      const b = (out[u] ??= { ...NONE });
      b.range += fx.range ?? 0;
      b.speed += fx.speed ?? 0;
      b.dmg += fx.dmg ?? 0;
      b.taken += fx.taken ?? 0;
      b.carry += fx.carry ?? 0;
      b.mend += fx.mend ?? 0;
    }
  }
  return out;
}

/** What this side's research does for this kind of unit or building. Nothing in Frenzy, and nothing for neutral things. */
export function boost(g: Game, owner: number, kind: number): Readonly<Boost> {
  if (owner < 0 || g.mode !== 'classic') return NONE;
  const pl = g.players[owner]!;
  let table = CACHE.get(pl);
  if (!table) {
    table = build(pl);
    CACHE.set(pl, table);
  }
  return table[kind] ?? NONE;
}

/** Called when a side finishes an item (or a test sets one): its sums are worked out again on the next ask. */
export function forgetBoosts(pl: Player): void {
  CACHE.delete(pl);
}

/** How fast a unit moves, research included, in sub-units a tick. */
export function speedOf(g: Game, e: Entity): number {
  const base = DEFS[e.kind]!.speed;
  const up = boost(g, e.owner, e.kind).speed;
  return up === 0 ? base : Math.trunc((base * (100 + up)) / 100);
}
