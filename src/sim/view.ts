// What one player is allowed to know. The computer opponent reads the match only through this,
// so it plays under the same fog of war as a person.
import { def, isWorker, worth } from './data';
import { canPlace, onLayer, visibleTo, type Game } from './state';
import { K, type Entity, type Faction, type GameMap, type Ghost, type GroupState, type Kind, type Mode } from './types';

export interface View {
  mode: Mode;
  tick: number;
  p: number;
  /** What this player plays, and what the other side plays: both are known before the match starts. */
  faction: Faction;
  foe: Faction;
  blocks: number;
  /** Batteries. */
  gas: number;
  weapons: number;
  armour: number;
  supply: number;
  cap: number;
  rally: number;
  repeat: readonly Kind[];
  groups: readonly GroupState[];
  /** This player's own units and buildings. */
  own: readonly Entity[];
  /** Enemy units and buildings on tiles this player can see right now. */
  enemies: readonly Entity[];
  /** Enemy buildings this player has seen and not yet seen destroyed. */
  ghosts: readonly Ghost[];
  /** Blocks piles. The map itself is common knowledge. */
  piles: readonly Entity[];
  /** Battery packs; `site` is the Refinery standing on one, or 0. */
  cells: readonly Entity[];
  map: GameMap;
  /** Own buildings and Workers hit this tick. */
  hurt: readonly { x: number; y: number; kind: Kind }[];
  vis: Uint8Array;
  explored: Uint8Array;
  canPlace(kind: Kind, tx: number, ty: number): boolean;
  /** True where a building could not stand: rock, a pile or a building. */
  blocked(tx: number, ty: number): boolean;

  // Frenzy. Who is playing, what they play and who is out are known to everyone.
  sides: readonly { id: number; faction: Faction; out: boolean }[];
  unlocked: readonly Kind[];
  muster: number;
  heroLvl: number;
  heroXp: number;
  /** The tick this side's fallen hero returns; 0 while it stands. */
  heroBack: number;
  cds: readonly number[];
  /** Who holds the Watchtower in the middle: a side, -1 for nobody, or -2 when this side can't see it. */
  middle: number;
}

export function makeView(g: Game, p: number): View {
  const pl = g.players[p]!;
  const own: Entity[] = [], enemies: Entity[] = [], piles: Entity[] = [], cells: Entity[] = [];
  for (const e of g.ents) {
    if (e.hp <= 0) continue;
    if (e.kind === K.Pile) piles.push(e);
    else if (e.kind === K.Cell) cells.push(e);
    else if (e.owner === p) own.push(e);
    else if (e.owner >= 0 && visibleTo(g, p, e)) enemies.push(e);
  }
  let middle = -2;
  for (const e of g.ents) if (e.kind === K.Tower && onLayer(g, pl.vis, e.x, e.y)) middle = e.busy - 1;
  const hurt: { x: number; y: number; kind: Kind }[] = [];
  for (const ev of g.events) if (ev.t === 'hurt' && ev.owner === p) hurt.push({ x: ev.x, y: ev.y, kind: ev.kind });
  return {
    mode: g.mode, tick: g.tick, p, faction: pl.faction, foe: g.players[(p + 1) % g.players.length]!.faction, blocks: pl.blocks, gas: pl.gas, weapons: pl.weapons, armour: pl.armour, supply: pl.supply, cap: pl.cap, rally: pl.rally, repeat: pl.repeat, groups: pl.groups,
    own, enemies, ghosts: [...pl.seen.values()], piles, cells, map: g.map, hurt, vis: pl.vis, explored: pl.explored,
    canPlace: (kind, tx, ty) => canPlace(g, p, kind, tx, ty),
    blocked: (tx, ty) => g.nav.isBlocked(tx, ty),
    sides: g.players.map((q) => ({ id: q.id, faction: q.faction, out: q.out })),
    unlocked: pl.unlocked, muster: pl.muster, heroLvl: pl.heroLvl, heroXp: pl.heroXp, heroBack: pl.heroBack, cds: pl.cds, middle,
  };
}

/** Rough fighting worth of a unit or Turret, used by bots to size up a fight. */
export function power(e: Entity): number {
  const d = def(e.kind);
  if (d.building) return d.range > 0 && e.built ? Math.round((d.cost * 2.6 * e.hp) / d.hp) : 0;
  if (isWorker(e.kind) || e.kind === K.Egg) return 0;
  const weight = e.kind === K.Lancer ? 0.7 : e.kind === K.Runner ? 0.85 : e.kind === K.Flak ? 0.5 : 1;
  return Math.round((worth(e.kind) * weight * e.hp) / d.hp);
}
