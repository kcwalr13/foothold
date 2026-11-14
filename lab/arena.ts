// Equal-cost fights on open ground, to check the unit table.
import { def } from '../src/sim/data';
import { createGame, schedule, spawn } from '../src/sim/state';
import { step } from '../src/sim/step';
import { O, TILE, type Kind } from '../src/sim/types';

export interface Side { kind: Kind; n: number }

/** Lines two forces up on the south road and has each attack-move into the other. Returns the Blocks' worth left to each. */
export function fight(a: Side[], b: Side[], hold: 0 | 1 | -1 = -1): { left: [number, number]; ticks: number } {
  const g = createGame(1);
  const put = (side: Side[], owner: number, x: number) => {
    let i = 0;
    for (const s of side) for (let k = 0; k < s.n; k++) {
      const building = def(s.kind).building;
      const u = spawn(g, s.kind, owner, (x + (building ? 0 : (i % 3) - 1) * 0.7) * TILE, (40.5 + Math.floor(i / 3) * 0.7 + (building ? 2 : 0)) * TILE);
      if (!building) u.group = 3;
      i++;
    }
  };
  put(a, 0, 43);
  put(b, 1, 56);
  if (hold !== 0) schedule(g, { t: 'order', p: 0, group: 3, mode: O.Attack, x: 56 * TILE, y: 42 * TILE });
  if (hold !== 1) schedule(g, { t: 'order', p: 1, group: 3, mode: O.Attack, x: 43 * TILE, y: 42 * TILE });
  const worth = (owner: number) => g.ents
    .filter((e) => e.owner === owner && (e.group === 3 || (def(e.kind).range > 0 && def(e.kind).building)))
    .reduce((s, e) => s + Math.round((def(e.kind).cost * e.hp) / def(e.kind).hp), 0);
  let left: [number, number] = [worth(0), worth(1)];
  while (g.tick < 1500 && left[0] > 0 && left[1] > 0) {
    step(g);
    left = [worth(0), worth(1)];
  }
  return { left, ticks: g.tick };
}
