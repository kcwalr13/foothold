// TEMP: one match, minute by minute.
import { playMatch } from './match';
import { def, isHall, isWorker } from '../src/sim/data';
import { K } from '../src/sim/types';
import type { Scheme } from '../src/ai/bot';
const [a, b, seed] = [process.argv[2] as Scheme, process.argv[3] as Scheme, Number(process.argv[4] ?? 108)];
const opt = (x: string) => (x.startsWith('t:') ? { trick: x.slice(2) as never } : { scheme: x as Scheme });
const r = playMatch(seed, opt(a), opt(b), 15000, (g) => {
  if (g.tick % 300 !== 0) return;
  const line = g.players.map((pl) => {
    const own = g.ents.filter((e) => e.owner === pl.id);
    const army = own.filter((e) => !def(e.kind).building && !isWorker(e.kind) && e.kind !== K.Egg);
    const val = army.reduce((s, e) => s + def(e.kind).cost + def(e.kind).gas, 0);
    const halls = own.filter((e) => isHall(e.kind)).length, turrets = own.filter((e) => e.kind === K.Turret || e.kind === K.Volcano).length;
    const rax = own.filter((e) => e.kind === K.Barracks || e.kind === K.Den).length;
    return `w${own.filter((e) => isWorker(e.kind)).length} army ${army.length}/${val} halls ${halls} rax ${rax} tur ${turrets} lost ${pl.stats.lostUnits}/${pl.stats.lostBuildings} b${pl.blocks}`;
  });
  console.log(`${String(Math.floor(g.tick / 600)).padStart(2)}:${String((g.tick % 600) / 10).padStart(2, '0')}  ${a}: ${line[0]}  |  ${b}: ${line[1]}`);
}, [(process.argv[5] ?? 'green') as 'green', (process.argv[6] ?? 'green') as 'green']);
console.log('winner', r.winner, 'at', Math.floor(r.ticks / 600), 'min', 'first hits', r.firstHit);
