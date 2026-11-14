// Plays whole matches with no screen attached: the computer opponent on both sides.
import { Bot, type BotOptions } from '../src/ai/bot';
import { createGame, hash, schedule, type Game } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import { K } from '../src/sim/types';

export interface Result {
  seed: number;
  winner: number;
  ticks: number;
  plans: [string, string];
  hash: number;
  /** Tick at which each side's Workers or buildings were first hit; -1 if never. */
  firstHit: [number, number];
  hqs: [number, number];
  trained: [number, number];
  lost: [number, number];
  commands: number;
}

export function playMatch(seed: number, a: BotOptions = {}, b: BotOptions = {}, maxTicks = 15000, watch?: (g: Game) => void): Result {
  const g = createGame(seed);
  const bots = [new Bot(0, seed, a), new Bot(1, seed + 1, b)];
  while (g.winner < 0 && g.tick < maxTicks) {
    for (const bot of bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
    watch?.(g);
  }
  const count = (p: number) => g.ents.filter((e) => e.owner === p && e.kind === K.HQ).length;
  return {
    seed, winner: g.winner, ticks: g.tick,
    plans: [a.trick ?? bots[0]!.plan, b.trick ?? bots[1]!.plan],
    hash: hash(g),
    firstHit: [g.players[0]!.stats.firstAttackTick, g.players[1]!.stats.firstAttackTick],
    hqs: [count(0), count(1)],
    trained: [g.players[0]!.stats.trained, g.players[1]!.stats.trained],
    lost: [g.players[0]!.stats.lostUnits, g.players[1]!.stats.lostUnits],
    commands: g.log.length,
  };
}

export const mmss = (ticks: number) => `${Math.floor(ticks / 600)}:${String(Math.floor((ticks % 600) / 10)).padStart(2, '0')}`;
