// The match that plays itself: the computer on both sides, no screen. The touch tests run it in each
// browser engine and compare the result with Node's, to prove the same orders give the same match everywhere.
import { Bot } from '../ai/bot';
import { createGame, hash, schedule } from '../sim/state';
import { step } from '../sim/step';
import { makeView } from '../sim/view';
import type { Command, Faction } from '../sim/types';

export interface Played { hash: number; ticks: number; winner: number; log: { tick: number; cmd: Command }[] }

/** Plays one match between two Normal opponents on fixed plans and returns its checksum and every order given. */
export function selfPlay(seed: number, maxTicks: number, factions: readonly [Faction, Faction] = ['green', 'green']): Played {
  const g = createGame(seed, undefined, factions);
  const bots = [new Bot(0, seed, { plan: 'standard', tech: 'armour' }), new Bot(1, seed + 1, { plan: 'standard', tech: 'air' })];
  while (g.winner < 0 && g.tick < maxTicks) {
    for (const bot of bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
  }
  return { hash: hash(g), ticks: g.tick, winner: g.winner, log: g.log };
}

/** Replays a match from its seed and its list of orders alone, and returns the checksum it ends on. */
export function replay(seed: number, log: readonly { tick: number; cmd: Command }[], ticks: number, factions: readonly [Faction, Faction] = ['green', 'green']): number {
  const g = createGame(seed, undefined, factions);
  let k = 0;
  while (g.tick < ticks && g.winner < 0) {
    while (k < log.length && log[k]!.tick === g.tick + 1) g.pending.push({ tick: g.tick + 1, cmd: log[k++]!.cmd });
    step(g);
  }
  return hash(g);
}
