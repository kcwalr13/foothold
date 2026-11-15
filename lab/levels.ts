// How the difficulty levels stack up, for each faction: each level against the others, an idle player against
// each, and simple one-trick play against each.
// Run: npx tsx lab/levels.ts [seeds]
import { TRICKS } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
import { mmss } from './match';
import { playAll, type Job } from './pool';

const seeds = Number(process.argv[2] ?? 8);
const NAMES = ['Easy', 'Normal', 'Hard', 'Brutal'];
/** Each level against the one below it. */
const LADDER: [number, number][] = [[1, 0], [2, 1], [3, 2]];
const FACTIONS: Faction[] = ['green', 'dino'];
const LABEL = { green: 'Green Army', dino: 'Dino Pack' } as const;
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`.padStart(4);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

// Every match is listed first and played together; each line of the report then reads its own slice.
const jobs: Job[] = [];
const slice = (make: () => void): [number, number] => {
  const from = jobs.length;
  make();
  return [from, jobs.length];
};

const levelRows = LADDER.flatMap(([hi, lo]) => FACTIONS.flatMap((fn) => FACTIONS.map((fe) => ({
  hi, lo, fn, fe,
  at: slice(() => {
    for (let s = 1; s <= seeds; s++) {
      jobs.push({ seed: s * 31 + 5, a: { level: hi }, b: { level: lo }, factions: [fn, fe] });
      jobs.push({ seed: s * 31 + 6, a: { level: lo }, b: { level: hi }, factions: [fe, fn] });
    }
  }),
}))));
const idleRows = FACTIONS.flatMap((me) => FACTIONS.flatMap((foe) => NAMES.map((_, level) => ({
  me, foe, level,
  at: slice(() => {
    for (let s = 1; s <= seeds; s++) jobs.push({ seed: s * 17 + 2, a: { level: -1 }, b: { level }, maxTicks: 18000, factions: [me, foe] });
  }),
}))));
const trickRows = FACTIONS.flatMap((f) => TRICKS[f].flatMap((trick) => NAMES.map((_, level) => ({
  f, trick, level,
  at: slice(() => {
    for (let s = 1; s <= seeds; s++) {
      jobs.push({ seed: s * 53 + 3, a: { trick, level: 1 }, b: { level }, factions: [f, f] });
      jobs.push({ seed: s * 53 + 4, a: { level }, b: { trick, level: 1 }, factions: [f, f] });
    }
  }),
}))));
const rs = await playAll(jobs);
/** Wins for the side that sits in seat 0 on even matches of a slice and seat 1 on odd ones. */
const wins = ([from, to]: [number, number]) => {
  let w = 0;
  for (let i = from; i < to; i++) if (rs[i]!.winner === (i - from) % 2) w++;
  return w;
};

console.log('Win rate of each level against the one below it (random openings), by who plays what:');
for (const row of levelRows) {
  console.log(`  ${NAMES[row.hi]!.padEnd(6)} ${LABEL[row.fn].padEnd(10)} against ${NAMES[row.lo]!.padEnd(6)} ${LABEL[row.fe].padEnd(10)} ${pct(wins(row.at), row.at[1] - row.at[0])}`);
}
console.log('\nA player who does nothing at all: when the opponent first hits them, and when the match ends.');
for (const row of idleRows) {
  const mine = rs.slice(row.at[0], row.at[1]);
  const hits = mine.map((r) => r.firstHit[0]).filter((t) => t >= 0), ends = mine.map((r) => r.ticks);
  console.log(`  idle ${LABEL[row.me].padEnd(10)} against ${NAMES[row.level]!.padEnd(6)} ${LABEL[row.foe].padEnd(10)} first hit: median ${mmss(median(hits))}, earliest ${mmss(Math.min(...hits))}; match over: median ${mmss(median(ends))}`);
}
console.log('\nOne-trick bots (win rate of the trick) against each level of their own faction:');
for (const f of FACTIONS) for (const trick of TRICKS[f]) {
  const cells = trickRows.filter((x) => x.f === f && x.trick === trick).map((row) => `${NAMES[row.level]} ${pct(wins(row.at), row.at[1] - row.at[0])}`);
  console.log(`  ${trick.padEnd(9)} ${cells.join('   ')}`);
}
