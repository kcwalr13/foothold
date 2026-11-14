// How the difficulty levels stack up: each level against the others, and simple one-trick play against each.
// Run: npx tsx lab/levels.ts [seeds]
import { type Trick } from '../src/ai/bot';
import { mmss, playMatch } from './match';

const seeds = Number(process.argv[2] ?? 8);
const NAMES = ['Easy', 'Normal'];
const pct = (n: number, d: number) => `${Math.round((100 * n) / d)}%`.padStart(4);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

console.log('Win rate of the row level against the column level (random openings):');
console.log(' '.repeat(8) + NAMES.map((n) => n.padStart(8)).join(''));
for (let a = 0; a < NAMES.length; a++) {
  const cells: string[] = [];
  for (let b = 0; b < NAMES.length; b++) {
    if (a === b) { cells.push('.'.padStart(8)); continue; }
    let w = 0, n = 0;
    for (let s = 1; s <= seeds; s++) {
      const r1 = playMatch(s * 31 + 5, { level: a }, { level: b });
      const r2 = playMatch(s * 31 + 6, { level: b }, { level: a });
      n += 2;
      if (r1.winner === 0) w++;
      if (r2.winner === 1) w++;
    }
    cells.push(pct(w, n).padStart(8));
  }
  console.log(NAMES[a]!.padEnd(8) + cells.join(''));
}
console.log('\nA player who does nothing at all: when the opponent first hits them, and when the match ends.');
for (let level = 0; level < NAMES.length; level++) {
  const hits: number[] = [], ends: number[] = [];
  for (let s = 1; s <= seeds; s++) {
    const r = playMatch(s * 17 + 2, { trick: 'turtle', level: -1 }, { level }, 18000);
    if (r.firstHit[0] >= 0) hits.push(r.firstHit[0]);
    ends.push(r.ticks);
  }
  console.log(`${NAMES[level]!.padEnd(7)} first hit: median ${mmss(median(hits))}, earliest ${mmss(Math.min(...hits))}; match over: median ${mmss(median(ends))}`);
}
const tricks: Trick[] = ['troopers', 'runners', 'lancers', 'turtle', 'tanks', 'gunships'];
console.log('\nOne-trick bots (win rate of the trick) against each level:');
for (const trick of tricks) {
  const row: string[] = [];
  for (let level = 0; level < NAMES.length; level++) {
    let w = 0, n = 0;
    for (let s = 1; s <= seeds; s++) {
      const a = playMatch(s * 53 + 3, { trick, level: 1 }, { level });
      const b = playMatch(s * 53 + 4, { level }, { trick, level: 1 });
      n += 2;
      if (a.winner === 0) w++;
      if (b.winner === 1) w++;
    }
    row.push(`${NAMES[level]} ${pct(w, n)}`);
  }
  console.log(`${trick.padEnd(9)} ${row.join('   ')}`);
}
