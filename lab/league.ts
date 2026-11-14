// The bot league: every opening against every other, both sides, over many seeds.
// Run: npx tsx lab/league.ts [seeds] [level]
import { PLANS, type Trick } from '../src/ai/bot';
import { mmss, playMatch, type Result } from './match';

const seeds = Number(process.argv[2] ?? 12);
const level = Number(process.argv[3] ?? 1);
const quiet = process.argv.includes('--quiet');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, d: number) => (d === 0 ? '  -' : `${Math.round((100 * n) / d)}%`.padStart(4));

const results: Result[] = [];
const wins = new Map<string, { w: number; n: number }>();
const bump = (key: string, won: boolean) => {
  const e = wins.get(key) ?? { w: 0, n: 0 };
  e.n++;
  if (won) e.w++;
  wins.set(key, e);
};
const t0 = Date.now();
for (let s = 1; s <= seeds; s++) {
  for (const a of PLANS) for (const b of PLANS) {
    const r = playMatch(s * 101 + 7, { plan: a, level }, { plan: b, level });
    results.push(r);
    if (r.winner >= 0) {
      bump(`${a}>${b}`, r.winner === 0);
      bump(`${b}>${a}`, r.winner === 1);
    }
  }
}
const done = results.filter((r) => r.winner >= 0);
console.log(`\n${results.length} matches at level ${level} in ${((Date.now() - t0) / 1000).toFixed(0)}s; ${results.length - done.length} unfinished at the time limit`);
console.log(`Match length: median ${mmss(median(done.map((r) => r.ticks)))}, shortest ${mmss(Math.min(...done.map((r) => r.ticks)))}, longest ${mmss(Math.max(...done.map((r) => r.ticks)))}`);
console.log(`Side 0 wins ${pct(done.filter((r) => r.winner === 0).length, done.length)}`);
const hits = results.flatMap((r) => r.firstHit).filter((t) => t >= 0);
console.log(`First hit on a side's Workers or buildings: median ${mmss(median(hits))}, earliest ${mmss(Math.min(...hits))}; before 6:00 in ${pct(hits.filter((t) => t < 3600).length, results.length * 2)} of sides`);
console.log('\nWin rate of the row opening against the column opening:');
console.log(' '.repeat(10) + PLANS.map((p) => p.padStart(9)).join('') + '   overall');
for (const a of PLANS) {
  let w = 0, n = 0;
  const cells = PLANS.map((b) => {
    const e = wins.get(`${a}>${b}`) ?? { w: 0, n: 0 };
    if (a !== b) {
      w += e.w;
      n += e.n;
    }
    return (a === b ? '   .' : pct(e.w, e.n)).padStart(9);
  });
  console.log(a.padEnd(10) + cells.join('') + '   ' + pct(w, n));
}

if (!quiet) {
  const tricks: Trick[] = ['troopers', 'runners', 'lancers', 'turtle'];
  console.log('\nOne-trick bots against the Normal opponent (win rate of the trick):');
  for (const trick of tricks) {
    let w = 0, n = 0;
    const perPlan: string[] = [];
    for (const plan of PLANS) {
      let pw = 0, pn = 0;
      for (let s = 1; s <= Math.max(4, Math.floor(seeds / 2)); s++) {
        const a = playMatch(s * 53 + 3, { trick, level: 1 }, { plan, level: 1 });
        const b = playMatch(s * 53 + 4, { plan, level: 1 }, { trick, level: 1 });
        pn += 2;
        if (a.winner === 0) pw++;
        if (b.winner === 1) pw++;
      }
      w += pw;
      n += pn;
      perPlan.push(`${plan} ${pct(pw, pn)}`);
    }
    console.log(`${trick.padEnd(9)} ${pct(w, n)}   (${perPlan.join(', ')})`);
  }
}
