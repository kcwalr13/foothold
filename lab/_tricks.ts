// TEMP: each one-trick build against a Normal opponent of each faction, by the opponent's plan.
import { SCHEMES, TRICKS } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
import { playAll, type Job } from './pool';

const seeds = Number(process.argv[2] ?? 6);
const level = Number(process.argv[3] ?? 1);
const only = process.argv[4];
const F: Faction[] = ['green', 'dino'];
const rows: { tf: Faction; trick: string; foe: Faction; from: number; to: number }[] = [];
const jobs: Job[] = [];
for (const tf of F) for (const trick of TRICKS[tf]) for (const foe of F) {
  if (only && trick !== only) continue;
  const from = jobs.length;
  for (const scheme of SCHEMES) for (let s = 1; s <= seeds; s++) {
    jobs.push({ seed: s * 41 + 3, a: { trick }, b: { scheme, level }, factions: [tf, foe] });
  }
  rows.push({ tf, trick, foe, from, to: jobs.length });
}
const rs = await playAll(jobs);
console.log(`trick against level ${level}, by the opponent's plan:  ${SCHEMES.map((s) => s.padStart(8)).join('')}   overall`);
for (const r of rows) {
  const part = rs.slice(r.from, r.to);
  const cells = SCHEMES.map((_, i) => part.slice(i * seeds, (i + 1) * seeds));
  const pc = (xs: typeof part) => `${Math.round((100 * xs.filter((x) => x.winner === 0).length) / xs.length)}%`.padStart(8);
  console.log(`${r.tf.padEnd(6)}${r.trick.padEnd(9)} vs ${r.foe.padEnd(6)}${cells.map(pc).join('')}  ${pc(part)}`);
}
