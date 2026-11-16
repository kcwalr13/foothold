// The six named plans against each other, for each pairing of factions: who beats whom, and how long it takes.
// The design doc's target: no plan wins more than 60% of its matches, and every plan loses to at least one other.
// Run: npx tsx lab/plans.ts [seeds] [level] [green-green | dino-dino | green-dino]
import { SCHEMES, SCHEME_NAMES, type Scheme } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
import { mmss } from './match';
import { playAll, type Job } from './pool';

const seeds = Number(process.argv[2] ?? 4);
const level = Number(process.argv[3] ?? 1);
const ALL_PAIRS: [Faction, Faction][] = [['green', 'green'], ['dino', 'dino'], ['green', 'dino']];
// A third argument such as dino-dino plays only that pairing.
const PAIRS = process.argv[4] ? ALL_PAIRS.filter(([a, b]) => `${a}-${b}` === process.argv[4]) : ALL_PAIRS;
const LABEL = { green: 'Green Army', dino: 'Dino Pack' } as const;
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-').padStart(5);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

// Every match, both seats each way: row plan for the first faction against column plan for the second.
const jobs: Job[] = [];
const cell = new Map<string, [number, number]>();
for (const [fa, fb] of PAIRS) for (const a of SCHEMES) for (const b of SCHEMES) {
  const from = jobs.length;
  for (let s = 1; s <= seeds; s++) {
    jobs.push({ seed: s * 97 + 11, a: { scheme: a, level }, b: { scheme: b, level }, factions: [fa, fb] });
    jobs.push({ seed: s * 97 + 12, a: { scheme: b, level }, b: { scheme: a, level }, factions: [fb, fa] });
  }
  cell.set(`${fa}${fb}${a}${b}`, [from, jobs.length]);
}
const rs = await playAll(jobs);
/** Wins for the row plan: it sits in seat 0 on even matches of a cell and in seat 1 on odd ones. */
const wins = ([from, to]: [number, number]) => {
  let w = 0, n = 0;
  for (let i = from; i < to; i++) {
    const r = rs[i]!;
    if (r.winner < 0) continue;
    n++;
    if (r.winner === (i - from) % 2) w++;
  }
  return [w, n] as const;
};

const name = (f: Faction, k: Scheme) => SCHEME_NAMES[f][k].padEnd(12);
for (const [fa, fb] of PAIRS) {
  console.log(`\n${LABEL[fa]} (rows) against ${LABEL[fb]} (columns), win rate of the row plan, level ${level}:`);
  console.log(`${' '.repeat(13)}${SCHEMES.map((k) => SCHEME_NAMES[fb][k].slice(0, 9).padStart(10)).join('')}   overall  first hit   loses to`);
  for (const a of SCHEMES) {
    let tw = 0, tn = 0;
    const row: string[] = [], beatenBy: string[] = [];
    for (const b of SCHEMES) {
      const [w, n] = wins(cell.get(`${fa}${fb}${a}${b}`)!);
      if (fa === fb && a === b) { row.push('      -   '.slice(0, 10)); continue; }
      tw += w;
      tn += n;
      row.push(pct(w, n).padStart(10));
      if (n > 0 && w / n < 0.5) beatenBy.push(SCHEME_NAMES[fb][b]);
    }
    // When the row plan first hits the other side's Workers or buildings, median over all its matches.
    const hits = SCHEMES.flatMap((b) => {
      const [from, to] = cell.get(`${fa}${fb}${a}${b}`)!;
      return rs.slice(from, to).map((r, i) => r.firstHit[1 - (i % 2)]!).filter((t) => t >= 0);
    });
    console.log(`  ${name(fa, a)}${row.join('')}   ${pct(tw, tn)}   ${mmss(median(hits)).padStart(7)}   ${beatenBy.join(', ') || 'nobody'}`);
  }
  const all = SCHEMES.flatMap((a) => SCHEMES.flatMap((b) => {
    const [from, to] = cell.get(`${fa}${fb}${a}${b}`)!;
    return rs.slice(from, to);
  }));
  const len = all.filter((r) => r.winner >= 0).map((r) => r.ticks);
  const unfinished = all.filter((r) => r.winner === -1).length;
  console.log(`  length: median ${mmss(median(len))}; nine in ten over by ${mmss([...len].sort((x, y) => x - y)[Math.floor(len.length * 0.9)] ?? 0)}; unfinished at 25:00: ${unfinished} of ${all.length}; conceded: ${all.filter((r) => r.conceded).length}`);
}
