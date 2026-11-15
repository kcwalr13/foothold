// The counter table: every unit against every other at equal cost (Blocks plus Batteries), both sides attack-moving.
// A cell is how much of its army the row keeps (positive) or the column keeps (negative), in percent.
import { FIGHTERS, def, worth } from '../src/sim/data';
import type { Kind } from '../src/sim/types';
import { fight } from './arena';

const budget = Number(process.argv[2] ?? 1800);
const units: Kind[] = FIGHTERS;
const price = (k: Kind) => worth(k);
const count = (k: Kind) => Math.max(1, Math.round(budget / price(k)));

export function cell(a: Kind, b: Kind): number {
  const na = count(a), nb = count(b);
  const r = fight([{ kind: a, n: na }], [{ kind: b, n: nb }]);
  const sa = na * price(a), sb = nb * price(b);
  if (r.left[0] > 0 && r.left[1] === 0) return Math.round((100 * r.left[0]) / sa);
  if (r.left[1] > 0 && r.left[0] === 0) return -Math.round((100 * r.left[1]) / sb);
  return 0;
}

if (process.argv[1]?.endsWith('matrix.ts')) {
  const pad = (s: string | number, n = 8) => String(s).padStart(n);
  console.log(`budget ${budget}: ` + units.map((u) => `${count(u)} ${def(u).short}`).join(', '));
  console.log(pad('', 10) + units.map((u) => pad(def(u).short)).join(''));
  for (const a of units) {
    console.log(pad(def(a).short, 10) + units.map((b) => pad(a === b ? '·' : cell(a, b))).join(''));
  }
}
