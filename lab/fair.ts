// The fairness checks. If the rules and the opponent treat the two ends of the map alike, then
//  1. a match in which both sides run the same opponent with the same dice stays an exact mirror image
//     of itself for ever, and
//  2. any match, replayed with the two opponents in each other's seats, is the same match turned half a
//     circle: same length, same winner, every unit in the mirror-image spot on every tick.
// Prints the first tick at which either stops being true, and what differs.
// Run: npx tsx lab/fair.ts            (all nine mirrors, then eighteen seat swaps)
//      npx tsx lab/fair.ts mirror [plan] [tech] [ticks]
//      npx tsx lab/fair.ts swap [matches] [ticks]
import { Bot, type BotOptions, type Plan, type Tech } from '../src/ai/bot';
import { def } from '../src/sim/data';
import { createGame, schedule } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import { TILE, type Faction } from '../src/sim/types';
import { mmss } from './match';

export function firstBreak(plan: Plan, tech: Tech, maxTicks: number, dice = 99, faction: Faction = 'green'): { tick: number; detail: string[] } {
  const g = createGame(1, undefined, [faction, faction]);
  const W = g.map.w * TILE, H = g.map.h * TILE;
  const bots = [new Bot(0, 1, { plan, tech, dice }), new Bot(1, 1, { plan, tech, dice })];
  // The two bots think on the same ticks only if they share a phase, which the shared dice give them.
  while (g.winner < 0 && g.tick < maxTicks) {
    for (const bot of bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
    const key = (kind: number, x: number, y: number, hp: number, extra: number) => `${kind}:${x}:${y}:${hp}:${extra}`;
    const mine = new Map<string, number>();
    for (const e of g.ents) if (e.owner === 0) mine.set(key(e.kind, e.x, e.y, e.hp, e.carry), (mine.get(key(e.kind, e.x, e.y, e.hp, e.carry)) ?? 0) + 1);
    const odd: string[] = [];
    for (const e of g.ents) {
      if (e.owner !== 1) continue;
      const k = key(e.kind, W - e.x, H - e.y, e.hp, e.carry);
      const n = mine.get(k) ?? 0;
      if (n > 0) mine.set(k, n - 1);
      else odd.push(`side 1 has a ${def(e.kind).name} at ${(e.x / TILE).toFixed(2)},${(e.y / TILE).toFixed(2)} hp ${e.hp} whose mirror image (${((W - e.x) / TILE).toFixed(2)},${((H - e.y) / TILE).toFixed(2)}) side 0 lacks`);
    }
    for (const [k, n] of mine) if (n > 0) odd.push(`side 0 has ${k} (kind:x:y:hp:load) with no mirror image`);
    const p0 = g.players[0]!, p1 = g.players[1]!;
    if (p0.blocks !== p1.blocks || p0.gas !== p1.gas) odd.push(`Blocks ${p0.blocks} and ${p1.blocks}, Batteries ${p0.gas} and ${p1.gas}`);
    if (odd.length > 0) return { tick: g.tick, detail: odd.slice(0, 6) };
  }
  return { tick: -1, detail: [`still a mirror after ${mmss(g.tick)}${g.winner >= 0 ? ` (winner ${g.winner})` : ''}`] };
}

/**
 * Plays `a` against `b`, and at the same time `b` against `a`, each opponent keeping its own dice.
 * Returns the first tick at which the second match is not the first turned half a circle, or -1.
 */
export function seatSwap(
  a: BotOptions, b: BotOptions, seed: number, maxTicks: number, fa: Faction = 'green', fb: Faction = 'green',
): { tick: number; ticks: number; winner: number; detail: string[] } {
  const X = createGame(seed, undefined, [fa, fb]), Y = createGame(seed, undefined, [fb, fa]);
  const W = X.map.w * TILE, H = X.map.h * TILE;
  const A = { ...a, faction: fa, foe: fb }, B = { ...b, faction: fb, foe: fa };
  const bx = [new Bot(0, seed, A), new Bot(1, seed, B)], by = [new Bot(0, seed, B), new Bot(1, seed, A)];
  while (X.winner < 0 && X.tick < maxTicks) {
    for (const bot of bx) for (const cmd of bot.think(makeView(X, bot.p))) schedule(X, cmd);
    for (const bot of by) for (const cmd of bot.think(makeView(Y, bot.p))) schedule(Y, cmd);
    step(X);
    step(Y);
    const there = new Map<string, number>();
    for (const e of X.ents) {
      if (e.owner < 0) continue;
      const k = `${e.owner === 0 ? 'first' : 'second'} opponent's ${def(e.kind).name} at ${e.x},${e.y} hp ${e.hp} load ${e.carry}`;
      there.set(k, (there.get(k) ?? 0) + 1);
    }
    const odd: string[] = [];
    for (const e of Y.ents) {
      if (e.owner < 0) continue;
      const k = `${e.owner === 1 ? 'first' : 'second'} opponent's ${def(e.kind).name} at ${W - e.x},${H - e.y} hp ${e.hp} load ${e.carry}`;
      const n = there.get(k) ?? 0;
      if (n > 0) there.set(k, n - 1);
      else odd.push(`only with seats swapped: ${k}`);
    }
    for (const [k, n] of there) if (n > 0) odd.push(`only as first seated: ${k}`);
    if (X.winner !== (Y.winner < 0 ? -1 : 1 - Y.winner)) odd.push(`winner ${X.winner} and, swapped, ${Y.winner}`);
    if (odd.length > 0) return { tick: X.tick, ticks: X.tick, winner: X.winner, detail: odd.slice(0, 6) };
  }
  return { tick: -1, ticks: X.tick, winner: X.winner, detail: [] };
}

if (process.argv[1]?.endsWith('fair.ts')) {
  const mode = process.argv[2] ?? 'all';
  const allPlans: Plan[] = ['rush', 'standard', 'greedy'], allTechs: Tech[] = ['infantry', 'armour', 'air'];
  if (mode !== 'swap') {
    const plans = (process.argv[3] ? [process.argv[3]] : allPlans) as Plan[];
    const techs = (process.argv[4] ? [process.argv[4]] : allTechs) as Tech[];
    const ticks = Number(process.argv[5] ?? 9000);
    for (const faction of ['green', 'dino'] as const) for (const plan of plans) for (const tech of techs) {
      const r = firstBreak(plan, tech, ticks, 99, faction);
      console.log(`mirror ${faction} ${plan}/${tech}: ${r.tick < 0 ? r.detail[0] : `breaks at ${mmss(r.tick)} (tick ${r.tick})`}`);
      if (r.tick >= 0) for (const d of r.detail) console.log('   ' + d);
    }
  }
  if (mode !== 'mirror') {
    const n = Number(mode === 'swap' ? process.argv[3] ?? 18 : 18), ticks = Number(mode === 'swap' ? process.argv[4] ?? 12000 : 12000);
    let same = 0;
    for (let i = 0; i < n; i++) {
      // Every opening meets every opening, the tech paths turning as they go; every third match is against a one-trick or an Easy opponent.
      const a: BotOptions = { plan: allPlans[i % 3]!, tech: allTechs[(i * 2 + Math.floor(i / 9)) % 3]!, dice: 1000 + i };
      const b: BotOptions = { plan: allPlans[Math.floor(i / 3) % 3]!, tech: allTechs[(i + 1) % 3]!, dice: 2000 + i };
      // The first six are Green against Green as before; then Dino against Green, and Dino against Dino.
      const fa: Faction = i < 6 ? 'green' : 'dino', fb: Faction = i < 12 ? 'green' : 'dino';
      if (i % 3 === 2) Object.assign(b, i % 2 === 0 && fb === 'green' ? { trick: (['tanks', 'gunships', 'turtle'] as const)[Math.floor(i / 3) % 3] } : { level: 0 });
      const r = seatSwap(a, b, 50 + i, ticks, fa, fb);
      const name0 = (o: BotOptions) => `${o.plan}/${o.tech}${o.trick ? ` (${o.trick})` : ''}${o.level === 0 ? ' (Easy)' : ''}`;
      const name = (o: BotOptions) => `${o === a ? fa : fb} ${name0(o)}`;
      if (r.tick < 0) same++;
      console.log(`swap ${name(a)} v ${name(b)}: ${r.tick < 0 ? `the same match to ${mmss(r.ticks)}${r.winner >= 0 ? `, won by the ${r.winner === 0 ? 'first' : 'second'}` : ', unfinished'}` : `differs from ${mmss(r.tick)} (tick ${r.tick})`}`);
      for (const d of r.detail) console.log('   ' + d);
    }
    console.log(`${same} of ${n} seat-swapped matches are the same match`);
  }
}
