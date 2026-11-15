// The fairness checks for Frenzy. If the rules and the opponent treat the four corners alike, then
//  1. a match in which all four sides run the same opponent with the same dice stays, on every tick, the
//     same seen from every corner, and
//  2. any match, replayed with every opponent moved one seat round the table, is the same match turned a
//     quarter circle: same length, same winner, every unit in the turned spot on every tick.
// Prints the first tick at which either stops being true, and what differs.
// Run: npx tsx lab/fairfrenzy.ts           (six same-dice matches, then eight seat turns)
import { BENTS, FrenzyBot, type Bent, type FrenzyBotOptions } from '../src/ai/frenzy';
import { createGame, schedule } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import type { Faction } from '../src/sim/types';
import { mmss } from './match';
import { quarterBreak, turnedBreak } from './quarter';

/** Four copies of one opponent with the same dice. The first tick at which the corners differ, or -1. */
export function firstCornerBreak(faction: Faction, bent: Bent, maxTicks: number, dice = 77, level = 1): { tick: number; ticks: number; detail: string[] } {
  const g = createGame(1, undefined, [faction, faction, faction, faction]);
  const bots = [0, 1, 2, 3].map((p) => new FrenzyBot(p, 1, { bent, dice, level }));
  while (g.winner === -1 && g.tick < maxTicks) {
    for (const bot of bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
    const odd = quarterBreak(g);
    if (odd.length > 0) return { tick: g.tick, ticks: g.tick, detail: odd.slice(0, 6) };
  }
  return { tick: -1, ticks: g.tick, detail: [] };
}

/** Plays a table, and the same table with everyone moved `k` seats round. The first tick at which the second is not the first turned, or -1. */
export function seatTurn(factions: readonly Faction[], opts: readonly FrenzyBotOptions[], seed: number, k: number, maxTicks: number): { tick: number; ticks: number; winner: number; detail: string[] } {
  const n = factions.length;
  const moved = <T>(xs: readonly T[]) => xs.map((_, p) => xs[(p - k + n) % n]!);
  const X = createGame(seed, undefined, factions), Y = createGame(seed, undefined, moved(factions));
  // Each opponent keeps its own dice wherever it sits.
  const dice = factions.map((_, p) => seed * 31 + p * 977 + 5);
  const bx = factions.map((_, p) => new FrenzyBot(p, seed, { ...opts[p], dice: dice[p]! }));
  const by = factions.map((_, p) => new FrenzyBot(p, seed, { ...opts[(p - k + n) % n], dice: dice[(p - k + n) % n]! }));
  while (X.winner === -1 && X.tick < maxTicks) {
    for (const bot of bx) for (const cmd of bot.think(makeView(X, bot.p))) schedule(X, cmd);
    for (const bot of by) for (const cmd of bot.think(makeView(Y, bot.p))) schedule(Y, cmd);
    step(X);
    step(Y);
    const odd = turnedBreak(X, Y, k);
    if (odd.length > 0) return { tick: X.tick, ticks: X.tick, winner: X.winner, detail: odd.slice(0, 6) };
  }
  return { tick: -1, ticks: X.tick, winner: X.winner, detail: [] };
}

if (process.argv[1]?.endsWith('fairfrenzy.ts')) {
  const ticks = Number(process.argv[2] ?? 6000);
  let bad = 0;
  for (const faction of ['green', 'dino'] as const) for (const bent of BENTS) {
    const r = firstCornerBreak(faction, bent, ticks);
    if (r.tick >= 0) bad++;
    console.log(`four ${faction} ${bent}: ${r.tick < 0 ? `the same from every corner for ${mmss(r.ticks)}` : `DIFFERS at tick ${r.tick}\n  ${r.detail.join('\n  ')}`}`);
  }
  const tables: Faction[][] = [['green', 'dino', 'green', 'dino'], ['green', 'green', 'dino', 'dino'], ['dino', 'green', 'green', 'green'], ['dino', 'dino', 'dino', 'green']];
  for (let i = 0; i < 8; i++) {
    const factions = tables[i % tables.length]!, k = 1 + (i % 3);
    const r = seatTurn(factions, [], 40 + i, k, ticks);
    if (r.tick >= 0) bad++;
    console.log(`${factions.join(' ')} moved ${k} round: ${r.tick < 0 ? `the same match turned, ${mmss(r.ticks)}${r.winner >= 0 ? `, side ${r.winner} wins` : ''}` : `DIFFERS at tick ${r.tick}\n  ${r.detail.join('\n  ')}`}`);
  }
  console.log(bad === 0 ? 'Fair to every corner.' : `${bad} checks failed.`);
  if (bad > 0) process.exit(1);
}
