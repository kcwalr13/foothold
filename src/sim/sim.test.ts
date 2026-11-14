import { describe, expect, it } from 'vitest';
import { fight } from '../../lab/arena';
import { playMatch } from '../../lab/match';
import { Bot } from '../ai/bot';
import { DEFS, RULES, def } from './data';
import { twinRidges } from './map';
import { canPlace, createGame, hash, schedule, tileIndex } from './state';
import { step } from './step';
import { makeView } from './view';
import { K, O, TILE } from './types';

const run = (g: ReturnType<typeof createGame>, n: number) => { for (let i = 0; i < n; i++) step(g); };

describe('the map', () => {
  it('is the same turned half a circle', () => {
    const m = twinRidges();
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      expect(m.rock[y * m.w + x]).toBe(m.rock[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
    }
    expect(m.bases.filter((b) => b.side === 0).length).toBe(m.bases.filter((b) => b.side === 1).length);
  });

  it('lets a Worker walk from every base to every other', () => {
    const g = createGame(1);
    const from = g.map.bases[0]!;
    const field = g.nav.field(99999, () => [(from.hy + 5) * g.map.w + from.hx + 5]);
    for (const b of g.map.bases) expect(field[(b.hy + 5 > g.map.h - 1 ? b.hy - 1 : b.hy + 5) * g.map.w + b.hx + 1]).toBeLessThan(0xffff);
  });
});

describe('economy', () => {
  it('Workers haul Blocks without being told', () => {
    const g = createGame(1);
    run(g, 300);
    expect(g.players[0]!.blocks).toBeGreaterThan(200);
    expect(g.players[0]!.blocks).toBe(g.players[1]!.blocks);
  });

  it('a base has work for about 12 Workers', () => {
    const rate = (workers: number) => {
      const g = createGame(1);
      for (let i = 8; i < workers; i++) schedule(g, { t: 'train', p: 0, kind: K.Worker });
      g.players[0]!.blocks = 5000;
      run(g, 1500);
      const before = g.players[0]!.stats.gathered;
      run(g, 600);
      return g.players[0]!.stats.gathered - before;
    };
    const twelve = rate(12), twenty = rate(20);
    expect(twelve).toBeGreaterThan(600);
    expect(twenty).toBeLessThan(twelve * 1.25);
  });

  it('training costs Blocks and supply, and a full cap refuses', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 100000;
    for (let i = 0; i < 60; i++) {
      schedule(g, { t: 'train', p: 0, kind: K.Worker });
      run(g, 110);
    }
    expect(g.players[0]!.supply).toBe(g.players[0]!.cap);
    expect(g.players[0]!.cap).toBe(def(K.HQ).provides);
  });
});

describe('building', () => {
  it('goes anywhere on open ground, blocks movement, and can be cancelled for a refund', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 1000;
    expect(canPlace(g, 0, K.Barracks, 13, 34)).toBe(true);
    expect(canPlace(g, 0, K.Barracks, 5, 36)).toBe(false); // on the Headquarters
    expect(canPlace(g, 0, K.Barracks, 22, 34)).toBe(false); // on the cliff
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 34 });
    run(g, 2);
    const site = g.ents.find((e) => e.kind === K.Barracks)!;
    expect(site.built).toBe(false);
    expect(g.nav.isBlocked(14, 35)).toBe(true);
    expect(g.players[0]!.blocks).toBe(1000 - def(K.Barracks).cost);
    schedule(g, { t: 'cancel', p: 0, id: site.id });
    run(g, 2);
    expect(g.players[0]!.blocks).toBe(1000);
    expect(g.nav.isBlocked(14, 35)).toBe(false);
  });

  it('a Worker walks over and finishes it, then goes back to hauling', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 1000;
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 34 });
    run(g, def(K.Barracks).time + 80);
    const b = g.ents.find((e) => e.kind === K.Barracks)!;
    expect(b.built).toBe(true);
    expect(b.hp).toBe(def(K.Barracks).hp);
    run(g, 100);
    expect(g.ents.filter((e) => e.owner === 0 && e.kind === K.Worker && e.site !== 0).length).toBe(0);
  });

  it('a Turret needs a Barracks first, and a wall of buildings closes a ramp', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 5000;
    schedule(g, { t: 'build', p: 0, kind: K.Turret, tx: 15, ty: 40 });
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Turret)).toBe(false);
    // The ramp is four tiles tall: two Barracks side by side in front of it leave no way through.
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 20, ty: 36 });
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 20, ty: 39 });
    run(g, 2);
    const inside = 39 * g.map.w + 10, outside = 39 * g.map.w + 30;
    const field = g.nav.field(88888, () => [inside]);
    expect(field[outside]).toBe(0xffff);
  });
});

describe('orders', () => {
  it('a group attack-moves across the map and arrives', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 5000;
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 34 });
    run(g, def(K.Barracks).time + 80);
    for (let i = 0; i < 4; i++) schedule(g, { t: 'train', p: 0, kind: K.Trooper });
    run(g, def(K.Trooper).time * 4 + 20);
    const troopers = () => g.ents.filter((e) => e.owner === 0 && e.kind === K.Trooper);
    expect(troopers().length).toBe(4);
    schedule(g, { t: 'order', p: 0, group: 0, mode: O.Move, x: 48 * TILE, y: 42 * TILE });
    run(g, 500);
    for (const u of troopers()) {
      expect(Math.abs(u.x - 48 * TILE)).toBeLessThan(3 * TILE);
      expect(Math.abs(u.y - 42 * TILE)).toBeLessThan(3 * TILE);
      expect(u.arrived).toBe(true);
    }
  });

  it('bad commands are ignored', () => {
    const g = createGame(1);
    const before = hash(g);
    schedule(g, { t: 'order', p: 0, group: 9, mode: O.Attack, x: 0, y: 0 });
    schedule(g, { t: 'order', p: 0, group: 0, mode: O.Attack, x: NaN, y: 0 });
    schedule(g, { t: 'build', p: 0, kind: K.Trooper, tx: 13, ty: 34 });
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: -3, ty: 900 });
    schedule(g, { t: 'train', p: 1, kind: K.HQ });
    schedule(g, { t: 'cancel', p: 0, id: 1 });
    schedule(g, { t: 'assign', p: 0, from: 0, to: 0, kind: 0, count: 0 });
    const h = createGame(1);
    step(g);
    step(h);
    expect(hash(g)).toBe(hash(h));
    expect(before).not.toBe(0);
  });
});

describe('the unit table', () => {
  const beats = (a: [number, number], b: [number, number]) => {
    const r = fight([{ kind: a[0] as never, n: a[1] }], [{ kind: b[0] as never, n: b[1] }]);
    const s = fight([{ kind: b[0] as never, n: b[1] }], [{ kind: a[0] as never, n: a[1] }]);
    return r.left[0] > 0 && r.left[1] === 0 && s.left[1] > 0 && s.left[0] === 0;
  };
  it('Troopers beat Runners at equal cost', () => expect(beats([K.Trooper, 6], [K.Runner, 5])).toBe(true));
  it('Troopers beat Lancers at equal cost', () => expect(beats([K.Trooper, 6], [K.Lancer, 4])).toBe(true));
  it('Runners beat Lancers at equal cost', () => expect(beats([K.Runner, 5], [K.Lancer, 4])).toBe(true));
  it('a Turret beats its cost in Troopers and in Runners', () => {
    expect(fight([{ kind: K.Trooper, n: 2 }], [{ kind: K.Turret, n: 1 }], 1).left[0]).toBe(0);
    expect(fight([{ kind: K.Runner, n: 2 }], [{ kind: K.Turret, n: 1 }], 1).left[0]).toBe(0);
  });
  it('Lancers outrange a Turret and take it down without a loss', () => {
    const r = fight([{ kind: K.Lancer, n: 2 }], [{ kind: K.Turret, n: 1 }], 1);
    expect(r.left[1]).toBe(0);
    expect(r.left[0]).toBe(2 * def(K.Lancer).cost);
  });
});

describe('fog of war', () => {
  it('the opponent is shown only what its own units can see', () => {
    const g = createGame(3);
    const bots = [new Bot(0, 3, { plan: 'standard' }), new Bot(1, 4, { plan: 'rush' })];
    for (let i = 0; i < 2600; i++) {
      for (const b of bots) for (const c of b.think(makeView(g, b.p))) schedule(g, c);
      step(g);
      if (i % 50 !== 0) continue;
      for (const p of [0, 1]) {
        const v = makeView(g, p);
        for (const e of v.enemies) expect(g.players[p]!.vis[tileIndex(g, e.x, e.y)]).toBe(1);
        for (const e of v.own) expect(e.owner).toBe(p);
        expect(v.ghosts.every((gh) => gh.owner !== p)).toBe(true);
      }
    }
  });

  it('nothing is seen at the start but your own base', () => {
    const g = createGame(1);
    const v = makeView(g, 0);
    expect(v.enemies.length).toBe(0);
    expect(v.ghosts.length).toBe(0);
  });
});

describe('determinism', () => {
  it('the same seed and commands give the identical match', () => {
    const a = playMatch(42, { plan: 'standard' }, { plan: 'greedy' }, 4000);
    const b = playMatch(42, { plan: 'standard' }, { plan: 'greedy' }, 4000);
    expect(a.hash).toBe(b.hash);
    expect(a.ticks).toBe(b.ticks);
    expect(a.commands).toBe(b.commands);
  });

  it('a match replays exactly from its command log', () => {
    const g = createGame(9);
    const bots = [new Bot(0, 9), new Bot(1, 10)];
    for (let i = 0; i < 2500; i++) {
      for (const b of bots) for (const c of b.think(makeView(g, b.p))) schedule(g, c);
      step(g);
    }
    const replay = createGame(9);
    const log = [...g.log];
    let k = 0;
    for (let i = 0; i < 2500; i++) {
      while (k < log.length && log[k]!.tick === replay.tick + 1) replay.pending.push({ tick: replay.tick + 1, cmd: log[k++]!.cmd });
      step(replay);
    }
    expect(hash(replay)).toBe(hash(g));
  });

  it('uses whole numbers only', () => {
    const g = createGame(5);
    const bots = [new Bot(0, 5), new Bot(1, 6)];
    for (let i = 0; i < 1500; i++) {
      for (const b of bots) for (const c of b.think(makeView(g, b.p))) schedule(g, c);
      step(g);
    }
    for (const e of g.ents) {
      expect(Number.isInteger(e.x) && Number.isInteger(e.y) && Number.isInteger(e.hp)).toBe(true);
    }
    expect(Number.isInteger(g.players[0]!.blocks)).toBe(true);
  });
});

describe('content', () => {
  it('every unit has a place to be trained and sane numbers', () => {
    for (const d of Object.values(DEFS)) {
      if (!d.building && d.kind !== K.Pile) {
        expect(d.madeAt).toBeDefined();
        expect(d.speed).toBeGreaterThan(0);
      }
      expect(d.hp).toBeGreaterThan(0);
    }
    expect(RULES.groups).toBe(4);
  });
});
