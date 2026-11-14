// Plays whole matches with no screen attached: the computer opponent on both sides.
import { Bot, type BotOptions } from '../src/ai/bot';
import { createGame, hash, schedule, type Game } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import { def } from '../src/sim/data';
import { K } from '../src/sim/types';

export interface Result {
  seed: number;
  winner: number;
  ticks: number;
  plans: [string, string];
  techs: [string, string];
  /** Supply in fighting units at the end, and the most each side ever had. */
  peak: [number, number];
  /** What each side trained, by unit name. */
  made: [Record<string, number>, Record<string, number>];
  gathered: [number, number];
  batteries: [number, number];
  research: [number, number];
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
  const peak: [number, number] = [0, 0];
  const made: [Record<string, number>, Record<string, number>] = [{}, {}];
  const known = new Set<number>();
  while (g.winner < 0 && g.tick < maxTicks) {
    for (const bot of bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
    watch?.(g);
    if (g.tick % 20 === 0) {
      const army = [0, 0];
      for (const e of g.ents) {
        if (e.owner < 0 || e.kind === K.Worker || def(e.kind).building) continue;
        army[e.owner]! += def(e.kind).supply;
        if (!known.has(e.id)) {
          known.add(e.id);
          const name = def(e.kind).short;
          made[e.owner as 0 | 1][name] = (made[e.owner as 0 | 1][name] ?? 0) + 1;
        }
      }
      peak[0] = Math.max(peak[0], army[0]!);
      peak[1] = Math.max(peak[1], army[1]!);
    }
  }
  const count = (p: number) => g.ents.filter((e) => e.owner === p && e.kind === K.HQ).length;
  return {
    seed, winner: g.winner, ticks: g.tick,
    plans: [a.trick ?? bots[0]!.plan, b.trick ?? bots[1]!.plan],
    techs: [bots[0]!.tech, bots[1]!.tech],
    peak, made,
    gathered: [g.players[0]!.stats.gathered, g.players[1]!.stats.gathered],
    batteries: [g.players[0]!.stats.gathered2, g.players[1]!.stats.gathered2],
    research: [g.players[0]!.weapons + g.players[0]!.armour, g.players[1]!.weapons + g.players[1]!.armour],
    hash: hash(g),
    firstHit: [g.players[0]!.stats.firstAttackTick, g.players[1]!.stats.firstAttackTick],
    hqs: [count(0), count(1)],
    trained: [g.players[0]!.stats.trained, g.players[1]!.stats.trained],
    lost: [g.players[0]!.stats.lostUnits, g.players[1]!.stats.lostUnits],
    commands: g.log.length,
  };
}

export const mmss = (ticks: number) => `${Math.floor(ticks / 600)}:${String(Math.floor((ticks % 600) / 10)).padStart(2, '0')}`;
