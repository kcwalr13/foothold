// How long one tick of the rules takes when the map is full: both sides at full supply, fighting. Once with two
// Green Armies, and once with a Green Army against a Dino Pack swarm, which puts more bodies on the field.
// Then Frenzy: four sides at full supply meeting in the middle, heroes and all, four opponents thinking.
// Run: npx tsx lab/speed.ts
import { Bot } from '../src/ai/bot';
import { FrenzyBot } from '../src/ai/frenzy';
import { heroOf } from '../src/sim/frenzy';
import { def } from '../src/sim/data';
import { createGame, schedule, spawn } from '../src/sim/state';
import { step } from '../src/sim/step';
import { makeView } from '../src/sim/view';
import { K, O, TILE, type Faction, type Kind } from '../src/sim/types';

type Mix = [Kind, number][];
const GREEN: Mix = [[K.Trooper, 40], [K.Lancer, 16], [K.Runner, 8], [K.Tank, 8], [K.Mortar, 4], [K.Flak, 3], [K.Gunship, 6], [K.Jugger, 2]];
const DINO: Mix = [[K.Raptor, 60], [K.Spitter, 22], [K.Horn, 8], [K.Ptero, 4], [K.Bronto, 2], [K.Rex, 1]];

function battle(name: string, factions: readonly [Faction, Faction], mixes: readonly [Mix, Mix]): void {
  const g = createGame(5, undefined, factions);
  let n = 0;
  for (const owner of [0, 1]) {
    let i = 0;
    for (const [kind, count] of mixes[owner]!) for (let k = 0; k < count; k++) {
      const u = spawn(g, kind, owner, Math.round(((owner === 0 ? 36 : 60) + (i % 8) * 0.8) * TILE), Math.round((38 + Math.floor(i / 8) * 0.8) * TILE));
      u.group = 0;
      i++;
      n++;
    }
  }
  schedule(g, { t: 'order', p: 0, group: 0, mode: O.Attack, x: 60 * TILE, y: 42 * TILE });
  schedule(g, { t: 'order', p: 1, group: 0, mode: O.Attack, x: 36 * TILE, y: 42 * TILE });
  const others = g.ents.length - n;
  const bots = [new Bot(0, 5, { faction: factions[0], foe: factions[1] }), new Bot(1, 6, { faction: factions[1], foe: factions[0] })];
  const times: number[] = [], thinks: number[] = [];
  for (let t = 0; t < 300; t++) {
    const a = performance.now();
    for (const b of bots) for (const c of b.think(makeView(g, b.p))) if (c.t !== 'order') schedule(g, c);
    const m = performance.now();
    step(g);
    const z = performance.now();
    thinks.push(m - a);
    times.push(z - m);
  }
  times.sort((x, y) => x - y);
  const supply = (o: number) => g.ents.filter((e) => e.owner === o && !def(e.kind).building).reduce((s, e) => s + def(e.kind).supply, 0);
  console.log(`${name}: ${n} fighting units and ${others} Workers, buildings and piles at the start; army supply left at the end: ${supply(0)} and ${supply(1)}`);
  console.log(`  one tick of the rules: median ${times[150]!.toFixed(2)} ms, worst in twenty ${times[285]!.toFixed(2)} ms, worst ${times[299]!.toFixed(2)} ms`);
  console.log(`  the two opponents' thinking, per tick: mean ${(thinks.reduce((s, x) => s + x, 0) / thinks.length).toFixed(2)} ms`);
}

/** Frenzy at its fullest: every side's forty supply and its hero in one fight around the Watchtower. */
function frenzy(name: string, factions: readonly Faction[]): void {
  const g = createGame(5, undefined, factions);
  const FULL: Record<Faction, Mix> = {
    green: [[K.Bayonet, 10], [K.Trooper, 6], [K.Lancer, 6], [K.Tank, 2], [K.Flak, 1], [K.Gunship, 2], [K.Jugger, 1]],
    dino: [[K.Raptor, 22], [K.Spitter, 10], [K.Horn, 2], [K.Ptero, 1], [K.Rex, 1]],
  };
  const mid = (g.map.w * TILE) / 2;
  let n = 0;
  for (const pl of g.players) {
    const cx = 31.5 + [-6, -6, 6, 6][pl.id]!, cy = 31.5 + [6, -6, -6, 6][pl.id]!;
    let i = 0;
    for (const [kind, count] of FULL[pl.faction]) for (let k = 0; k < count; k++) {
      const u = spawn(g, kind, pl.id, Math.round((cx + (i % 7) * 0.8 - 2.4) * TILE), Math.round((cy + Math.floor(i / 7) * 0.8 - 2.4) * TILE));
      u.group = 0;
      i++;
      n++;
    }
    const h = heroOf(g, pl)!;
    h.x = h.px = h.ax = h.dx = Math.round(cx * TILE);
    h.y = h.py = h.ay = h.dy = Math.round(cy * TILE);
    pl.heroLvl = h.lvl = 6;
    for (const group of [0, 3]) schedule(g, { t: 'order', p: pl.id, group, mode: O.Attack, x: mid, y: mid });
  }
  const bots = g.players.map((pl) => new FrenzyBot(pl.id, 5 + pl.id));
  const times: number[] = [], thinks: number[] = [];
  for (let t = 0; t < 300; t++) {
    const a = performance.now();
    // The opponents use their heroes and run their bases; the armies are left to the fight they were sent to.
    for (const b of bots) for (const c of b.think(makeView(g, b.p))) if (c.t !== 'order' && c.t !== 'assign' && c.t !== 'rally') schedule(g, c);
    const m = performance.now();
    step(g);
    const z = performance.now();
    thinks.push(m - a);
    times.push(z - m);
  }
  times.sort((x, y) => x - y);
  const left = g.players.map((pl) => g.ents.filter((e) => e.owner === pl.id && !def(e.kind).building && e.hp > 0).length);
  console.log(`${name}: ${n} fighting units and four heroes at the start; units left at the end: ${left.join(', ')}`);
  console.log(`  one tick of the rules: median ${times[150]!.toFixed(2)} ms, worst in twenty ${times[285]!.toFixed(2)} ms, worst ${times[299]!.toFixed(2)} ms`);
  console.log(`  the four opponents' thinking, per tick: mean ${(thinks.reduce((s, x) => s + x, 0) / thinks.length).toFixed(2)} ms`);
}

battle('Green Army against Green Army', ['green', 'green'], [GREEN, GREEN]);
battle('Green Army against Dino Pack', ['green', 'dino'], [GREEN, DINO]);
battle('Dino Pack against Dino Pack', ['dino', 'dino'], [DINO, DINO]);
frenzy('Frenzy, two Green Armies and two Dino Packs', ['green', 'dino', 'green', 'dino']);
frenzy('Frenzy, four Dino Packs', ['dino', 'dino', 'dino', 'dino']);
console.log('A tick comes every 100 ms, so the budget is 100 ms on the slowest phone the game is meant for.');
