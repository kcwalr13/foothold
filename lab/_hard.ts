// TEMP: Hard against Normal, every pairing of factions, both seats, the plans as each picks them.
import type { Faction } from '../src/sim/types';
import { playAll, type Job } from './pool';

const seeds = Number(process.argv[2] ?? 16);
const hi = Number(process.argv[3] ?? 2), lo = Number(process.argv[4] ?? 1);
const F: Faction[] = ['green', 'dino'];
const jobs: Job[] = [];
for (const fa of F) for (const fb of F) for (let s = 1; s <= seeds; s++) {
  jobs.push({ seed: s * 31 + 5, a: { level: hi }, b: { level: lo }, factions: [fa, fb] });
  jobs.push({ seed: s * 31 + 6, a: { level: lo }, b: { level: hi }, factions: [fb, fa] });
}
const rs = await playAll(jobs);
let all = 0, n = 0;
for (let i = 0; i < 4; i++) {
  const part = rs.slice(i * seeds * 2, (i + 1) * seeds * 2);
  const w = part.filter((r, j) => r.winner === j % 2).length, d = part.filter((r) => r.winner >= 0).length;
  all += w; n += d;
  console.log(`${F[i >> 1]} level ${hi} vs ${F[i & 1]} level ${lo}: ${Math.round((100 * w) / d)}% of ${d}`);
}
console.log(`overall ${Math.round((100 * all) / n)}% of ${n}; conceded ${rs.filter((r) => r.conceded).length}`);
