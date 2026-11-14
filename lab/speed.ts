// How long one tick of the rules takes when the map is full: both sides at full supply, fighting.
// Run: npx tsx lab/speed.ts
import { Bot } from '../src/ai/bot';
import { def } from '../src/sim/data';
import { createGame, schedule, spawn } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import { K, O, TILE, type Kind } from '../src/sim/types';

const g = createGame(5);
const mix: [Kind, number][] = [[K.Trooper, 40], [K.Lancer, 16], [K.Runner, 8], [K.Tank, 8], [K.Mortar, 4], [K.Flak, 3], [K.Gunship, 6], [K.Jugger, 2]];
let n = 0;
for (const owner of [0, 1]) {
  let i = 0;
  for (const [kind, count] of mix) for (let k = 0; k < count; k++) {
    const u = spawn(g, kind, owner, Math.round(((owner === 0 ? 36 : 60) + (i % 8) * 0.8) * TILE), Math.round((38 + Math.floor(i / 8) * 0.8) * TILE));
    u.group = 0;
    i++;
    n++;
  }
}
schedule(g, { t: 'order', p: 0, group: 0, mode: O.Attack, x: 60 * TILE, y: 42 * TILE });
schedule(g, { t: 'order', p: 1, group: 0, mode: O.Attack, x: 36 * TILE, y: 42 * TILE });
const others = g.ents.length - n;
const bots = [new Bot(0, 5), new Bot(1, 6)];
const times: number[] = [], thinks: number[] = [];
for (let t = 0; t < 300; t++) {
  const a = performance.now();
  for (const b of bots) for (const c of b.think(makeView(g, b.p))) if (c.t !== 'order') schedule(g, c);
  const m = performance.now();
  step(g);
  const z = performance.now();
  thinks.push(m - a);
  times.push(z - m);
}
times.sort((x, y) => x - y);
const supply = (o: number) => g.ents.filter((e) => e.owner === o && !def(e.kind).building).reduce((s, e) => s + def(e.kind).supply, 0);
console.log(`${n} fighting units and ${others} Workers, buildings and piles at the start; army supply left at the end: ${supply(0)} and ${supply(1)}`);
console.log(`one tick of the rules: median ${times[150]!.toFixed(2)} ms, worst in twenty ${times[285]!.toFixed(2)} ms, worst ${times[299]!.toFixed(2)} ms`);
console.log(`the two opponents' thinking, per tick: mean ${(thinks.reduce((s, x) => s + x, 0) / thinks.length).toFixed(2)} ms`);
console.log('A tick comes every 100 ms, so the budget is 100 ms on the slowest phone the game is meant for.');
