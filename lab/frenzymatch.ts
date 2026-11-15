// Plays whole Frenzy matches with no screen attached: four computer opponents, every side for itself.
import { FrenzyBot, type FrenzyBotOptions } from '../src/ai/frenzy';
import { def } from '../src/sim/data';
import { createGame, hash, schedule, type Game } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import type { Faction } from '../src/sim/types';

export interface FrenzyResult {
  seed: number;
  factions: Faction[];
  bents: string[];
  winner: number;
  ticks: number;
  /** The tick each side went out; -1 for one that never did. */
  outAt: number[];
  /** Where each side finished: 1 for the winner, 4 for the first out. */
  place: number[];
  heroLvl: number[];
  kills: number[];
  spent: number[];
  /** Hero level of each side at five minutes. */
  lvlAt5: number[];
  /** What each side's base turned out, by unit name. */
  made: Record<string, number>[];
  firstMarch: number[];
  /** The tick each side's base or Turrets were first hit; -1 if they never were. */
  firstHit: number[];
  hash: number;
  commands: number;
}

export function playFrenzy(
  seed: number, factions: readonly Faction[], opts: readonly FrenzyBotOptions[] = [], maxTicks = 12000, watch?: (g: Game) => void, idle = -1,
): FrenzyResult {
  const g = createGame(seed, undefined, factions);
  // A seat can be left idle: a player who never touches the screen, whose base still makes its first unit.
  const all = factions.map((_, p) => new FrenzyBot(p, seed, opts[p] ?? {}));
  const bots = all.filter((b) => b.p !== idle);
  const outAt = factions.map(() => -1), lvlAt5 = factions.map(() => 1);
  const made: Record<string, number>[] = factions.map(() => ({}));
  const known = new Set<number>();
  while (g.winner === -1 && g.tick < maxTicks) {
    for (const bot of bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
    watch?.(g);
    for (const ev of g.events) if (ev.t === 'out' && outAt[ev.owner]! < 0) outAt[ev.owner] = g.tick;
    if (g.tick === 3000) g.players.forEach((pl, i) => { lvlAt5[i] = pl.heroLvl; });
    if (g.tick % 20 === 0) {
      for (const e of g.ents) {
        if (e.owner < 0 || known.has(e.id) || def(e.kind).building || def(e.kind).hero || e.ttl !== 0) continue;
        known.add(e.id);
        const name = def(e.kind).short;
        made[e.owner]![name] = (made[e.owner]![name] ?? 0) + 1;
      }
    }
  }
  // Placing: the winner first, then the others in the reverse of the order they went out; those still in
  // when time ran out share the best places left.
  const order = factions.map((_, p) => p).sort((a, b) => (outAt[a]! < 0 ? 1e9 : outAt[a]!) - (outAt[b]! < 0 ? 1e9 : outAt[b]!));
  const place = factions.map(() => 0);
  order.forEach((p, i) => { place[p] = factions.length - i; });
  const alive = order.filter((p) => outAt[p]! < 0);
  for (const p of alive) place[p] = g.winner === p ? 1 : alive.length > 1 ? 1 : place[p]!;
  return {
    seed, factions: [...factions], bents: all.map((b) => b.bent), winner: g.winner, ticks: g.tick, outAt, place,
    heroLvl: g.players.map((p) => p.heroLvl), kills: g.players.map((p) => p.stats.killedUnits), spent: g.players.map((p) => p.stats.spent),
    lvlAt5, made, firstMarch: all.map((b) => b.firstMarch), firstHit: g.players.map((p) => p.stats.firstAttackTick), hash: hash(g), commands: g.log.length,
  };
}
