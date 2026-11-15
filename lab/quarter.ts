// The Frenzy fairness check: is the match the same seen from every corner? If the rules treat the four
// sides alike, then four sides given the same orders (each turned its own quarter circle) are, on every
// tick, each other turned a quarter circle: same units, same places, same health, same Blocks.
import { def } from '../src/sim/data';
import type { Game } from '../src/sim/state';
import { TILE } from '../src/sim/types';

/** What differs between side 0 and the others, each turned back to side 0's corner; empty when nothing does. */
export function quarterBreak(g: Game): string[] {
  const S = g.map.w * TILE, n = g.players.length;
  const odd: string[] = [];
  const home = (x: number, y: number, turns: number) => {
    // One quarter turn takes (x, y) to (S - y, x); this undoes `turns` of them.
    for (let k = 0; k < turns; k++) [x, y] = [y, S - x];
    return [x, y] as const;
  };
  const sig = (p: number) => {
    const m = new Map<string, number>();
    for (const e of g.ents) {
      if (e.owner !== p) continue;
      const [x, y] = home(e.x, e.y, g.turns[p]!);
      const k = `${def(e.kind).short} at ${(x / TILE).toFixed(3)},${(y / TILE).toFixed(3)} hp ${e.hp} lvl ${e.lvl} group ${e.group} daze ${Math.max(0, e.daze - g.tick)} haste ${Math.max(0, e.haste - g.tick)}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const a = sig(0), pa = g.players[0]!;
  for (let p = 1; p < n; p++) {
    const b = sig(p), pb = g.players[p]!;
    for (const [k, c] of a) if ((b.get(k) ?? 0) !== c) odd.push(`side 0 has ${c} × ${k}; side ${p} has ${b.get(k) ?? 0}`);
    for (const [k, c] of b) if (!a.has(k)) odd.push(`side ${p} has ${c} × ${k}; side 0 has none`);
    const money = (q: typeof pa) => `Blocks ${q.blocks} supply ${q.supply} level ${q.heroLvl} xp ${q.heroXp} bank ${q.bank} out ${q.out} back ${q.heroBack ? q.heroBack - g.tick : 0}`;
    if (money(pa) !== money(pb)) odd.push(`side 0: ${money(pa)}; side ${p}: ${money(pb)}`);
  }
  return odd;
}

/**
 * Is match `b` match `a` turned `k` quarter circles, with every side sitting `k` seats further round?
 * Returns what differs; empty when nothing does.
 */
export function turnedBreak(a: Game, b: Game, k: number): string[] {
  const S = a.map.w * TILE, n = a.players.length;
  const odd: string[] = [];
  if (a.tick !== b.tick || a.winner !== (b.winner < 0 ? b.winner : (b.winner - k + n) % n)) odd.push(`tick ${a.tick} winner ${a.winner}; turned: tick ${b.tick} winner ${b.winner}`);
  const sig = (g: Game, back: number) => {
    const m = new Map<string, number>();
    for (const e of g.ents) {
      let x = e.x, y = e.y;
      for (let i = 0; i < back; i++) [x, y] = [y, S - x];
      const owner = e.owner < 0 ? -1 : (e.owner - back + n) % n;
      const key = `side ${owner} ${def(e.kind).short} at ${(x / TILE).toFixed(3)},${(y / TILE).toFixed(3)} hp ${e.hp} lvl ${e.lvl}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  };
  const sa = sig(a, 0), sb = sig(b, k);
  for (const [key, c] of sa) if ((sb.get(key) ?? 0) !== c) odd.push(`first match has ${c} × ${key}; the turned one has ${sb.get(key) ?? 0}`);
  for (const [key, c] of sb) if (!sa.has(key)) odd.push(`the turned match has ${c} × ${key}; the first has none`);
  for (let p = 0; p < n; p++) {
    const pa = a.players[p]!, pb = b.players[(p + k) % n]!;
    const row = (q: typeof pa) => `Blocks ${q.blocks} level ${q.heroLvl} xp ${q.heroXp} out ${q.out}`;
    if (row(pa) !== row(pb)) odd.push(`side ${p}: ${row(pa)}; turned, side ${(p + k) % n}: ${row(pb)}`);
  }
  return odd;
}
