// Green Army against Dino Pack, the computer on both sides: every opening against every other and every tech
// path against every other, with each faction taking each seat. The design's target is that neither faction
// wins more than 55% of these. Then each faction's one-trick builds against the other faction's Normal opponent.
// Run: npx tsx lab/factions.ts [seeds] [level]
import { PLANS, TECHS, TRICKS } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
import { mmss, type Result } from './match';
import { playAll, type Job } from './pool';

// Numbers and names are read in order; flags such as --quiet can go anywhere.
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const seeds = Number(args[0] ?? 12);
const level = Number(args[1] ?? 1);
const quiet = process.argv.includes('--quiet');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] ?? 0;
const pct = (n: number, d: number) => (d === 0 ? '  -' : `${Math.round((100 * n) / d)}%`.padStart(4));

interface Played { dino: string; green: string; dinoSeat: number; r: Result }

/** One match with the Dino Pack in the given seat. */
function job(seed: number, dinoSeat: number, dino: object, green: object): Job {
  return dinoSeat === 0
    ? { seed, a: dino, b: green, maxTicks: 18000, factions: ['dino', 'green'] }
    : { seed, a: green, b: dino, maxTicks: 18000, factions: ['green', 'dino'] };
}
const dinoWon = (x: Played) => x.r.winner === x.dinoSeat;

function grid(title: string, keys: readonly string[], rs: Played[]): void {
  console.log(`\n${title}`);
  console.log('Dino \\ Green'.padEnd(13) + keys.map((k) => k.padStart(9)).join('') + '   overall');
  for (const a of keys) {
    const row = rs.filter((x) => x.dino === a && x.r.winner >= 0);
    const cells = keys.map((b) => {
      const cell = row.filter((x) => x.green === b);
      return pct(cell.filter(dinoWon).length, cell.length).padStart(9);
    });
    console.log(a.padEnd(13) + cells.join('') + '   ' + pct(row.filter(dinoWon).length, row.length));
  }
  const cols = keys.map((b) => {
    const col = rs.filter((x) => x.green === b && x.r.winner >= 0);
    return pct(col.filter(dinoWon).length, col.length).padStart(9);
  });
  console.log('overall'.padEnd(13) + cols.join(''));
}

function summary(name: string, rs: Played[]): void {
  const done = rs.filter((x) => x.r.winner >= 0);
  const len = done.map((x) => x.r.ticks);
  const won = done.filter(dinoWon).length;
  console.log(`\n${name}: ${rs.length} matches, ${rs.length - done.length} unfinished at the 30-minute limit`);
  console.log(`  the Dino Pack wins ${pct(won, done.length).trim()} (${won} of ${done.length}); from seat 0 ${pct(done.filter((x) => x.dinoSeat === 0 && dinoWon(x)).length, done.filter((x) => x.dinoSeat === 0).length).trim()}, from seat 1 ${pct(done.filter((x) => x.dinoSeat === 1 && dinoWon(x)).length, done.filter((x) => x.dinoSeat === 1).length).trim()}`);
  console.log(`  length: median ${mmss(median(len))}, one in ten under ${mmss(quantile(len, 0.1))}, nine in ten under ${mmss(quantile(len, 0.9))}, longest ${mmss(Math.max(...len))}`);
  for (const f of ['dino', 'green'] as const) {
    const seat = (x: Played) => (f === 'dino' ? x.dinoSeat : 1 - x.dinoSeat);
    const hits = rs.map((x) => x.r.firstHit[seat(x)]!).filter((t) => t >= 0);
    const made: Record<string, number> = {};
    for (const x of rs) for (const [k, v] of Object.entries(x.r.made[seat(x)]!)) made[k] = (made[k] ?? 0) + v;
    const name2 = f === 'dino' ? 'Dino Pack' : 'Green Army';
    console.log(`  ${name2}: first hit at home, median ${mmss(median(hits))}; before 6:00 in ${pct(hits.filter((t) => t < 3600).length, rs.length).trim()}, before 10:00 in ${pct(hits.filter((t) => t < 6000).length, rs.length).trim()}`);
    console.log(`    trained per match: ${Object.entries(made).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / rs.length).toFixed(1)}`).join(', ')}`);
    console.log(`    research levels finished: ${(rs.reduce((s, x) => s + x.r.research[seat(x)]!, 0) / rs.length).toFixed(1)}; peak army supply, median ${median(rs.map((x) => x.r.peak[seat(x)]!))}`);
  }
}

const t0 = Date.now();
let k = 0;
// Every match gets a seed of its own, and each pairing is played from both seats in turn.
const planCells: Omit<Played, 'r'>[] = [], planJobs: Job[] = [];
for (let s = 1; s <= seeds; s++) {
  PLANS.forEach((a, i) => PLANS.forEach((b, j) => {
    const dinoSeat = (s + i + j) % 2;
    planCells.push({ dino: a, green: b, dinoSeat });
    planJobs.push(job(s * 103 + 9 + 1021 * k++, dinoSeat, { plan: a, level }, { plan: b, level }));
  }));
}
const techCells: Omit<Played, 'r'>[] = [], techJobs: Job[] = [];
for (let s = 1; s <= seeds; s++) {
  TECHS.forEach((a, i) => TECHS.forEach((b, j) => {
    const dinoSeat = (s + i + j) % 2;
    techCells.push({ dino: a, green: b, dinoSeat });
    techJobs.push(job(s * 223 + 3 + 1031 * k++, dinoSeat, { plan: 'standard', tech: a, level }, { plan: 'standard', tech: b, level }));
  }));
}
// The headline: both sides pick their own opening and tech path, as they do against a player.
const openCells: Omit<Played, 'r'>[] = [], openJobs: Job[] = [];
for (let i = 0; i < seeds * 18; i++) {
  openCells.push({ dino: '', green: '', dinoSeat: i % 2 });
  openJobs.push(job(i * 37 + 11 + 1049 * k++, i % 2, { level }, { level }));
}
const played = await playAll([...planJobs, ...techJobs, ...openJobs]);
const byPlan: Played[] = planCells.map((c, i) => ({ ...c, r: played[i]! }));
const byTech: Played[] = techCells.map((c, i) => ({ ...c, r: played[planCells.length + i]! }));
const asPlayed: Played[] = openCells.map((c, i) => {
  const r = played[planCells.length + techCells.length + i]!;
  return { dinoSeat: c.dinoSeat, dino: `${r.plans[c.dinoSeat]} ${r.techs[c.dinoSeat]}`, green: `${r.plans[1 - c.dinoSeat]} ${r.techs[1 - c.dinoSeat]}`, r };
});
summary(`Dino Pack against Green Army as the opponent plays it (each side picks its own opening and tech path), level ${level}`, asPlayed);
for (const f of ['dino', 'green'] as const) {
  const tally = new Map<string, [number, number]>();
  for (const x of asPlayed) {
    if (x.r.winner < 0) continue;
    for (const key of x[f].split(' ')) {
      const e = tally.get(key) ?? [0, 0];
      e[1]++;
      if (dinoWon(x) === (f === 'dino')) e[0]++;
      tally.set(key, e);
    }
  }
  console.log(`  ${f === 'dino' ? 'Dino Pack' : 'Green Army'} wins by its own choice: ${[...PLANS, ...TECHS].map((key) => `${key} ${pct(tally.get(key)?.[0] ?? 0, tally.get(key)?.[1] ?? 0).trim()} of ${tally.get(key)?.[1] ?? 0}`).join(', ')}`);
}
summary(`Dino Pack against Green Army, openings (tech paths at random), level ${level}`, byPlan);
grid('Win rate of the Dino Pack, by its opening (rows) and the Green Army\'s (columns):', PLANS, byPlan);
summary('Dino Pack against Green Army, tech paths (both sides open with the safe expansion)', byTech);
grid('Win rate of the Dino Pack, by its tech path (rows) and the Green Army\'s (columns):', TECHS, byTech);
const all = [...byPlan, ...byTech].filter((x) => x.r.winner >= 0);
console.log(`\nThe two grids together, ${all.length} finished matches: the Dino Pack wins ${pct(all.filter(dinoWon).length, all.length).trim()}, the Green Army ${pct(all.length - all.filter(dinoWon).length, all.length).trim()}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`);

if (!quiet) {
  console.log('\nOne-trick bots against the other faction\'s Normal opponent (win rate of the trick):');
  const rows: { f: Faction; trick: string; plan: string; first: number; n: number }[] = [];
  const jobs: Job[] = [];
  const per = Math.max(4, Math.floor(seeds / 2));
  for (const f of ['green', 'dino'] as const) {
    const foe: Faction = f === 'green' ? 'dino' : 'green';
    for (const trick of TRICKS[f]) for (const plan of PLANS) {
      rows.push({ f, trick, plan, first: jobs.length, n: per * 2 });
      for (let s = 1; s <= per; s++) {
        jobs.push({ seed: s * 59 + 3 + 1039 * k++, a: { trick, level: 1 }, b: { plan, level: 1 }, maxTicks: 18000, factions: [f, foe] });
        jobs.push({ seed: s * 59 + 4 + 1039 * k++, a: { plan, level: 1 }, b: { trick, level: 1 }, maxTicks: 18000, factions: [foe, f] });
      }
    }
  }
  const rs = await playAll(jobs);
  for (const f of ['green', 'dino'] as const) for (const trick of TRICKS[f]) {
    let w = 0, n = 0;
    const perPlan: string[] = [];
    for (const row of rows.filter((x) => x.f === f && x.trick === trick)) {
      let pw = 0;
      // The trick sits in seat 0 for even jobs and seat 1 for odd ones.
      for (let i = 0; i < row.n; i++) if (rs[row.first + i]!.winner === i % 2) pw++;
      w += pw;
      n += row.n;
      perPlan.push(`${row.plan} ${pct(pw, row.n).trim()}`);
    }
    console.log(`${trick.padEnd(9)} against ${(f === 'green' ? 'dino' : 'green').padEnd(5)} ${pct(w, n)}   (${perPlan.join(', ')})`);
  }
}
