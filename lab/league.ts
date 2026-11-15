// The bot league: every opening against every other, and every tech path against every other,
// on both sides of the map, over many seeds. Then the one-trick builds against the Normal opponent.
// Both sides play the same faction: the Green Army unless `dino` is given. Green against Dino is lab/factions.ts.
// Run: npx tsx lab/league.ts [seeds] [level] [green|dino]
import { PLANS, TECHS, TRICKS } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
import { mmss, type Result } from './match';
import { playAll, type Job } from './pool';

// Numbers and names are read in order; flags such as --quiet can go anywhere.
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const seeds = Number(args[0] ?? 12);
const level = Number(args[1] ?? 1);
const faction: Faction = args.includes('dino') ? 'dino' : 'green';
const sides = [faction, faction] as const;
const NAME = faction === 'dino' ? 'Dino Pack' : 'Green Army';
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
type Plan = (typeof PLANS)[number];
type Tech = (typeof TECHS)[number];
// Every match gets a seed of its own, so no two pairings share the same roll of the dice.
let k = 0;
const planPairs: { a: Plan; b: Plan }[] = [], techPairs: { a: Tech; b: Tech }[] = [], jobs: Job[] = [];
for (let s = 1; s <= seeds; s++) {
  for (const a of PLANS) for (const b of PLANS) {
    planPairs.push({ a, b });
    jobs.push({ seed: s * 101 + 7 + 1009 * k++, a: { plan: a, level }, b: { plan: b, level }, maxTicks: 18000, factions: sides });
  }
}
for (let s = 1; s <= seeds; s++) {
  for (const a of TECHS) for (const b of TECHS) {
    techPairs.push({ a, b });
    jobs.push({ seed: s * 211 + 5 + 1013 * k++, a: { plan: 'standard', tech: a, level }, b: { plan: 'standard', tech: b, level }, maxTicks: 18000, factions: sides });
  }
}
const played = await playAll(jobs);
const byPlan = planPairs.map((x, i) => ({ ...x, r: played[i]! }));
const byTech = techPairs.map((x, i) => ({ ...x, r: played[planPairs.length + i]! }));
summary(`${NAME} mirror. Openings (tech paths at random), level ${level}`, byPlan.map((x) => x.r));
table('Win rate of the row opening against the column opening:', PLANS, byPlan);
summary('Tech paths (both sides open with the safe expansion)', byTech.map((x) => x.r));
table('Win rate of the row tech path against the column tech path:', TECHS, byTech);
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)}s)`);

if (!quiet) {
  console.log('\nOne-trick bots against the Normal opponent (win rate of the trick):');
  const per = Math.max(4, Math.floor(seeds / 2));
  const rows: { trick: string; plan: string; first: number }[] = [], trickJobs: Job[] = [];
  for (const trick of TRICKS[faction]) for (const plan of PLANS) {
    rows.push({ trick, plan, first: trickJobs.length });
    for (let s = 1; s <= per; s++) {
      trickJobs.push({ seed: s * 53 + 3 + 1019 * k++, a: { trick, level: 1 }, b: { plan, level: 1 }, maxTicks: 18000, factions: sides });
      trickJobs.push({ seed: s * 53 + 4 + 1019 * k++, a: { plan, level: 1 }, b: { trick, level: 1 }, maxTicks: 18000, factions: sides });
    }
  }
  const rs = await playAll(trickJobs);
  for (const trick of TRICKS[faction]) {
    let w = 0, n = 0;
    const perPlan: string[] = [];
    for (const row of rows.filter((x) => x.trick === trick)) {
      let pw = 0;
      // The trick sits in seat 0 for even jobs and seat 1 for odd ones.
      for (let i = 0; i < per * 2; i++) if (rs[row.first + i]!.winner === i % 2) pw++;
      w += pw;
      n += per * 2;
      perPlan.push(`${row.plan} ${pct(pw, per * 2)}`);
    }
    console.log(`${trick.padEnd(9)} ${pct(w, n)}   (${perPlan.join(', ')})`);
  }
}
