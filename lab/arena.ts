// Equal-cost fights on open ground, to check the unit table.
import { def } from '../src/sim/data';
import { createGame, schedule, spawn } from '../src/sim/state';
import { step } from '../src/sim/step';
import { O, TILE, type Kind } from '../src/sim/types';

export interface Side { kind: Kind; n: number }

/**
 * Lines two forces up on the open ground between the ridges, each the other's mirror image through the middle
 * of the map, and has each attack-move into the other. Returns what is left to each, in Blocks plus Batteries.
 * Because the ground and the line-ups are mirror images, `fight(a, b)` and `fight(b, a)` are the same fight.
 */
export function fight(a: Side[], b: Side[], hold: 0 | 1 | -1 = -1): { left: [number, number]; ticks: number } {
  const g = createGame(1);
  const W = g.map.w * TILE, H = g.map.h * TILE;
  const AX = 41.5, AY = 26;
  const put = (side: Side[], owner: number) => {
    let i = 0;
    for (const s of side) for (let k = 0; k < s.n; k++) {
      const building = def(s.kind).building;
      // Units stand three abreast in rows; a building stands two tiles behind the first row, on whole tiles.
      const x = building ? Math.round(AX - 0.5) * TILE : Math.round((AX + ((i % 3) - 1) * 0.7) * TILE);
      const y = building ? (AY + 2 + 2 * i) * TILE : Math.round((AY + Math.floor(i / 3) * 0.7) * TILE);
      const u = owner === 0 ? spawn(g, s.kind, 0, x, y) : spawn(g, s.kind, 1, W - x, H - y);
      if (!building) u.group = 3;
      i++;
    }
  };
  put(a, 0);
  put(b, 1);
  const tx = Math.round(AX * TILE), ty = Math.round((AY + 1.5) * TILE);
  if (hold !== 0) schedule(g, { t: 'order', p: 0, group: 3, mode: O.Attack, x: W - tx, y: H - ty });
  if (hold !== 1) schedule(g, { t: 'order', p: 1, group: 3, mode: O.Attack, x: tx, y: ty });
  const worth = (owner: number) => g.ents
    .filter((e) => e.owner === owner && (e.group === 3 || (def(e.kind).range > 0 && def(e.kind).building)))
    .reduce((s, e) => s + Math.round(((def(e.kind).cost + def(e.kind).gas) * e.hp) / def(e.kind).hp), 0);
  let left: [number, number] = [worth(0), worth(1)];
  while (g.tick < 1500 && left[0] > 0 && left[1] > 0) {
    step(g);
    left = [worth(0), worth(1)];
  }
  return { left, ticks: g.tick };
}
