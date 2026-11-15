// Frenzy, the computer in all four corners. Every way of seating two Green Armies and two Dino Packs, each
// opponent choosing its own bent as it would against you: who wins, from which seat, how long it takes.
// Then one-unit armies against three ordinary opponents, Easy and Normal at one table, and a player who
// never touches the screen.
// Run: npx tsx lab/frenzy.ts [seeds] [level] [--mixed]
// --mixed plays only the mixed tables, for a headline on more seeds: 36 seeds is 216 rounds.
import { BENTS } from '../src/ai/frenzy';
import { K, type Faction, type Kind } from '../src/sim/types';
import { def } from '../src/sim/data';
import type { FrenzyResult } from './frenzymatch';
import { mmss } from './match';
import { playAllFrenzy, type FrenzyJob } from './pool';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const seeds = Number(args[0] ?? 12);
const level = Number(args[1] ?? 1);
const mixedOnly = process.argv.includes('--mixed');
const LIMIT = 15000;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] ?? 0;
const pct = (n: number, d: number) => (d === 0 ? '-' : `${Math.round((100 * n) / d)}%`);

const G: Faction = 'green', D: Faction = 'dino';
// Two of each, in all six seatings: every faction sits in every seat equally often, beside its own and across from it.
const TABLES: Faction[][] = [[G, G, D, D], [G, D, G, D], [G, D, D, G], [D, G, G, D], [D, G, D, G], [D, D, G, G]];

function report(name: string, rs: FrenzyResult[]): void {
  const done = rs.filter((r) => r.winner >= 0);
  const len = done.map((r) => r.ticks);
  console.log(`\n${name}: ${rs.length} matches, ${rs.length - done.length} unfinished at ${mmss(LIMIT)}`);
  console.log(`  length: median ${mmss(median(len))}; one in ten under ${mmss(quantile(len, 0.1))}; nine in ten under ${mmss(quantile(len, 0.9))}`);
  const firstOut = rs.map((r) => Math.min(...r.outAt.filter((t) => t >= 0), LIMIT));
  console.log(`  first side out: median ${mmss(median(firstOut))}; one in ten before ${mmss(quantile(firstOut, 0.1))}`);
  const seat = [0, 1, 2, 3].map((p) => done.filter((r) => r.winner === p).length);
  console.log(`  wins by seat: ${seat.map((n, p) => `${p}: ${pct(n, done.length)}`).join('  ')}`);
  for (const f of [G, D]) {
    const seats = done.reduce((s, r) => s + r.factions.filter((x) => x === f).length, 0);
    const wins = done.filter((r) => r.factions[r.winner] === f).length;
    const first = rs.filter((r) => r.factions[r.place.indexOf(4)] === f).length;
    if (seats > 0 && seats < done.length * 4) console.log(`  ${f === G ? 'Green Army' : 'Dino Pack'}: wins ${pct(wins, done.length)} of matches from ${pct(seats, done.length * 4)} of the seats; is the first side out in ${pct(first, rs.length)}`);
  }
  for (const b of BENTS) {
    const seats = done.reduce((s, r) => s + r.bents.filter((x) => x === b).length, 0);
    const wins = done.filter((r) => r.bents[r.winner] === b).length;
    const first = done.filter((r) => r.bents[r.place.indexOf(4)] === b).length;
    console.log(`  ${b.padEnd(6)} wins ${pct(wins, seats).padStart(4)} of the seats it takes (a fair share is 25%); first out in ${pct(first, seats)}`);
  }
  const lvl5 = rs.flatMap((r) => r.lvlAt5), lvlEnd = done.map((r) => r.heroLvl[r.winner]!);
  console.log(`  hero level: median ${median(lvl5)} at 5:00; the winner ends at ${median(lvlEnd)}`);
  const march = rs.flatMap((r) => r.firstMarch.filter((t) => t >= 0));
  console.log(`  first march from home: median ${mmss(median(march))}`);
  for (const f of [G, D]) {
    // What one side of this faction turns out in a round, averaged over every seat the faction took.
    const made: Record<string, number> = {};
    let sides = 0;
    for (const r of rs) r.made.forEach((m, p) => {
      if (r.factions[p] !== f) return;
      sides++;
      for (const [k, v] of Object.entries(m)) made[k] = (made[k] ?? 0) + v;
    });
    if (sides > 0) console.log(`  a ${f === G ? 'Green Army' : 'Dino Pack'} makes, per round: ` + Object.entries(made).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / sides).toFixed(1)}`).join(', '));
  }
}

const jobs: FrenzyJob[] = [];
for (let s = 0; s < seeds; s++) for (const factions of TABLES) jobs.push({ seed: 1000 + s, factions, opts: [0, 1, 2, 3].map(() => ({ level })), maxTicks: LIMIT });
const t0 = Date.now();
const mixed = await playAllFrenzy(jobs);
report(`Two Green Armies and two Dino Packs, every seating (level ${level})`, mixed);
if (mixedOnly) {
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(0);
}

for (const f of [G, D]) {
  const mono: FrenzyJob[] = [];
  for (let s = 0; s < seeds * 2; s++) mono.push({ seed: 2000 + s, factions: [f, f, f, f], opts: [0, 1, 2, 3].map(() => ({ level })), maxTicks: LIMIT });
  report(`Four ${f === G ? 'Green Armies' : 'Dino Packs'}`, await playAllFrenzy(mono));
}

// One-unit armies: a side that only ever makes one thing, against three ordinary opponents of mixed factions.
const TRICKS: [Faction, Kind][] = [[G, K.Trooper], [G, K.Lancer], [G, K.Tank], [G, K.Gunship], [D, K.Raptor], [D, K.Spitter], [D, K.Horn], [D, K.Ptero]];
console.log('\nOne-unit armies against three ordinary opponents (a fair share of wins is 25%)');
for (const [f, kind] of TRICKS) {
  const trick: FrenzyJob[] = [];
  for (let s = 0; s < seeds * 2; s++) {
    const seat = s % 4;
    const factions = [0, 1, 2, 3].map((p) => (p === seat ? f : (p + s) % 2 === 0 ? G : D));
    trick.push({ seed: 3000 + s, factions, opts: [0, 1, 2, 3].map((p) => (p === seat ? { level, only: kind } : { level })), maxTicks: LIMIT });
  }
  const rs = await playAllFrenzy(trick);
  const done = rs.filter((r) => r.winner >= 0);
  const wins = done.filter((r, i) => r.winner === trick[rs.indexOf(r)]!.opts!.findIndex((o) => o.only !== undefined) && i >= 0).length;
  const firstOut = rs.filter((r) => r.place[trick[rs.indexOf(r)]!.opts!.findIndex((o) => o.only !== undefined)] === 4).length;
  console.log(`  all ${def(kind).plural.padEnd(9)} wins ${pct(wins, done.length).padStart(4)} of ${done.length}; first out in ${pct(firstOut, rs.length)}`);
}

// Easy and Normal at one table. The odd one out sits in each seat in turn, at mixed tables.
console.log('\nEasy and Normal at one table (a fair share of wins is 25%)');
for (const [name, odd, rest] of [['One Normal among three Easy', 1, 0], ['One Easy among three Normal', 0, 1]] as const) {
  const table: FrenzyJob[] = [];
  for (let s = 0; s < seeds * 4; s++) table.push({ seed: 4000 + s, factions: TABLES[s % TABLES.length]!, opts: [0, 1, 2, 3].map((p) => ({ level: p === s % 4 ? odd : rest })), maxTicks: LIMIT });
  const rs = await playAllFrenzy(table);
  const wins = rs.filter((r, i) => r.winner === i % 4).length, first = rs.filter((r, i) => r.place[i % 4] === 4).length;
  console.log(`  ${name.padEnd(28)} wins ${pct(wins, rs.length).padStart(4)} of ${rs.length}; first out in ${pct(first, rs.length)}`);
}

// A player who never touches the screen: the base makes its first unit and the hero stands where it is.
console.log('\nAn idle player in seat 0, against three opponents');
for (const lvl of [1, 0]) for (const f of [G, D]) {
  const idle: FrenzyJob[] = [];
  for (let s = 0; s < seeds * 2; s++) idle.push({ seed: 5000 + s, factions: [f, ...TABLES[s % TABLES.length]!.slice(1)], opts: [0, 1, 2, 3].map(() => ({ level: lvl })), maxTicks: LIMIT, idle: 0 });
  const rs = await playAllFrenzy(idle);
  const hit = rs.map((r) => (r.firstHit[0]! < 0 ? LIMIT : r.firstHit[0]!)), gone = rs.map((r) => (r.outAt[0]! < 0 ? LIMIT : r.outAt[0]!));
  const places = [1, 2, 3, 4].map((k) => rs.filter((r) => r.place[0] === k).length);
  console.log(`  ${(f === G ? 'Green Army' : 'Dino Pack').padEnd(10)} against ${lvl === 1 ? 'Normal' : 'Easy  '}: first hit at ${mmss(median(hit))} (median), out at ${mmss(median(gone))}; wins ${places[0]}, second ${places[1]}, third ${places[2]}, first out ${places[3]} of ${rs.length}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
