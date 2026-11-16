// TEMP: one pairing of plans over several seeds, both seats, with how each match ended.
import { playMatch } from './match';
import type { Scheme } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
const [a, b] = [process.argv[2] as Scheme, process.argv[3] as Scheme];
const fa = (process.argv[4] ?? 'green') as Faction, fb = (process.argv[5] ?? 'green') as Faction;
let w = 0;
for (let s = 1; s <= 4; s++) for (const swap of [false, true]) {
  const seed = s * 97 + (swap ? 12 : 11);
  const r = swap ? playMatch(seed, { scheme: b }, { scheme: a }, 15000, undefined, [fb, fa]) : playMatch(seed, { scheme: a }, { scheme: b }, 15000, undefined, [fa, fb]);
  const won = r.winner === (swap ? 1 : 0);
  if (won) w++;
  const me = swap ? 1 : 0;
  console.log(`seed ${seed} ${a} in seat ${me}: ${won ? 'WIN ' : 'loss'} at ${Math.floor(r.ticks / 600)}:${String(Math.floor((r.ticks % 600) / 10)).padStart(2, '0')}; ${a} first hit at ${(r.firstHit[1 - me]! / 600).toFixed(1)} min; lost ${r.lost[me]} vs ${r.lost[1 - me]}; peak army ${r.peak[me]} vs ${r.peak[1 - me]}`);
}
console.log(`${a} wins ${w} of 8`);
