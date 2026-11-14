// The bot league: every opening against every other, and every tech path against every other,
// on both sides of the map, over many seeds. Then the one-trick builds against the Normal opponent.
// Run: npx tsx lab/league.ts [seeds] [level]
import { PLANS, TECHS, type Trick } from '../src/ai/bot';
import { mmss, playMatch, type Result } from './match';

const seeds = Number(process.argv[2] ?? 12);
const level = Number(process.argv[3] ?? 1);
const quiet = process.argv.includes('--quiet');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] ?? 0;
const pct = (n: number, d: number) => (d === 0 ? '  -' : `${Math.round((100 * n) / d)}%`.padStart(4));

function table<T extends string>(title: string, keys: readonly T[], results: { a: T; b: T; r: Result }[]): void {
  const wins = new Map<string, { w: number; n: number }>();
  const bump = (key: string, won: boolean) => {
    const e = wins.get(key) ?? { w: 0, n: 0 };
    e.n++;
    if (won) e.w++;
    wins.set(key, e);
  };
  for (const { a, b, r } of results) {
    if (r.winner < 0) continue;
    bump(`${a}>${b}`, r.winner === 0);
    bump(`${b}>${a}`, r.winner === 1);
  }
  console.log(`\n${title}`);
  console.log(' '.repeat(10) + keys.map((p) => p.padStart(9)).join('') + '   overall');
  for (const a of keys) {
    let w = 0, n = 0;
    const cells = keys.map((b) => {
      const e = wins.get(`${a}>${b}`) ?? { w: 0, n: 0 };
      if (a !== b) {
        w += e.w;
        n += e.n;
      }
      return (a === b ? '   .' : pct(e.w, e.n)).padStart(9);
    });
    console.log(a.padEnd(10) + cells.join('') + '   ' + pct(w, n));
  }
}

function summary(name: string, rs: Result[]): void {
  const done = rs.filter((r) => r.winner >= 0);
  const len = done.map((r) => r.ticks);
  console.log(`\n${name}: ${rs.length} matches, ${rs.length - done.length} unfinished at the 30-minute limit`);
  console.log(`  length: median ${mmss(median(len))}, one in ten under ${mmss(quantile(len, 0.1))}, nine in ten under ${mmss(quantile(len, 0.9))}, longest ${mmss(Math.max(...len))}`);
  console.log(`  side 0 wins ${pct(done.filter((r) => r.winner === 0).length, done.length)}`);
  const hits = rs.flatMap((r) => r.firstHit).filter((t) => t >= 0);
  console.log(`  first hit on a side's Workers or buildings: median ${mmss(median(hits))}, earliest ${mmss(Math.min(...hits))}; before 6:00 for ${pct(hits.filter((t) => t < 3600).length, rs.length * 2)} of sides, before 10:00 for ${pct(hits.filter((t) => t < 6000).length, rs.length * 2)}`);
  const made: Record<string, number> = {};
  let fielded = 0;
  for (const r of rs) for (const m of r.made) {
    fielded++;
    for (const [k, v] of Object.entries(m)) made[k] = (made[k] ?? 0) + v;
  }
  console.log('  units trained per side, on average: ' + Object.entries(made).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / fielded).toFixed(1)}`).join(', '));
  console.log(`  research levels finished per side: ${(rs.reduce((s, r) => s + r.research[0] + r.research[1], 0) / (rs.length * 2)).toFixed(1)}; peak army supply, median ${median(rs.flatMap((r) => r.peak))}`);
}

const t0 = Date.now();
const byPlan: { a: (typeof PLANS)[number]; b: (typeof PLANS)[number]; r: Result }[] = [];
// Every match gets a seed of its own, so no two pairings share the same roll of the dice.
let k = 0;
for (let s = 1; s <= seeds; s++) {
  for (const a of PLANS) for (const b of PLANS) byPlan.push({ a, b, r: playMatch(s * 101 + 7 + 1009 * k++, { plan: a, level }, { plan: b, level }, 18000) });
}
summary(`Openings (tech paths at random), level ${level}`, byPlan.map((x) => x.r));
table('Win rate of the row opening against the column opening:', PLANS, byPlan);

const byTech: { a: (typeof TECHS)[number]; b: (typeof TECHS)[number]; r: Result }[] = [];
for (let s = 1; s <= seeds; s++) {
  for (const a of TECHS) for (const b of TECHS) byTech.push({ a, b, r: playMatch(s * 211 + 5 + 1013 * k++, { plan: 'standard', tech: a, level }, { plan: 'standard', tech: b, level }, 18000) });
}
summary('Tech paths (both sides open with the safe expansion)', byTech.map((x) => x.r));
table('Win rate of the row tech path against the column tech path:', TECHS, byTech);
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)}s)`);

if (!quiet) {
  const tricks: Trick[] = ['troopers', 'runners', 'lancers', 'turtle', 'tanks', 'gunships'];
  console.log('\nOne-trick bots against the Normal opponent (win rate of the trick):');
  for (const trick of tricks) {
    let w = 0, n = 0;
    const perPlan: string[] = [];
    for (const plan of PLANS) {
      let pw = 0, pn = 0;
      for (let s = 1; s <= Math.max(4, Math.floor(seeds / 2)); s++) {
        const a = playMatch(s * 53 + 3 + 1019 * k++, { trick, level: 1 }, { plan, level: 1 }, 18000);
        const b = playMatch(s * 53 + 4 + 1019 * k++, { plan, level: 1 }, { trick, level: 1 }, 18000);
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
