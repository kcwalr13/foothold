import { describe, expect, it } from 'vitest';
import { fight } from '../../lab/arena';
import { firstBreak, seatSwap } from '../../lab/fair';
import { playMatch } from '../../lab/match';
import { Bot } from '../ai/bot';
import { DEFS, FACTIONS, RULES, def, researchCost } from './data';
import { twinRidges } from './map';
import { canPlace, createGame, hash, schedule, spawn, tileIndex, visibleTo } from './state';
import { step } from './step';
import { makeView } from './view';
import { K, O, TILE, type Kind } from './types';

const run = (g: ReturnType<typeof createGame>, n: number) => { for (let i = 0; i < n; i++) step(g); };

describe('the map', () => {
  it('is the same turned half a circle', () => {
    const m = twinRidges();
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      expect(m.rock[y * m.w + x]).toBe(m.rock[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
      expect(m.high[y * m.w + x]).toBe(m.high[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
    }
    expect(m.bases.filter((b) => b.side === 0).length).toBe(m.bases.filter((b) => b.side === 1).length);
    const g = createGame(1);
    const ents = (k: number) => g.ents.filter((e) => e.kind === k).map((e) => `${e.x},${e.y},${e.amount}`).sort();
    const turned = (k: number) => g.ents.filter((e) => e.kind === k).map((e) => `${m.w * TILE - e.x},${m.h * TILE - e.y},${e.amount}`).sort();
    for (const k of [K.Pile, K.Cell, K.Tower]) expect(ents(k)).toEqual(turned(k));
    expect(ents(K.Cell).length).toBe(10);
    expect(ents(K.Tower).length).toBe(2);
  });

  it('has a ramp up onto each ridge, and a main that is high ground', () => {
    const g = createGame(1);
    const m = g.map;
    const from = m.bases[0]!;
    const field = g.nav.field(99998, () => [(from.hy + 5) * m.w + from.hx + 5]);
    const top = 16 * m.w + 37; // the middle of the north-west ridge
    expect(m.high[top]).toBe(1);
    expect(field[top]).toBeLessThan(0xffff);
    expect(field[(m.h - 1 - 16) * m.w + (m.w - 1 - 37)]).toBeLessThan(0xffff);
    expect(m.high[(from.hy + 1) * m.w + from.hx + 1]).toBe(1);
    expect(m.high[38 * m.w + 23]).toBe(0); // the ramp itself is low
    const nat = m.bases[1]!;
    expect(m.high[(nat.hy + 1) * m.w + nat.hx + 1]).toBe(0);
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

describe('Batteries', () => {
  const rich = () => {
    const g = createGame(1);
    g.players[0]!.blocks = 5000;
    g.players[0]!.gas = 5000;
    return g;
  };

  it('a Refinery goes on a battery pack and nowhere else', () => {
    const g = rich();
    expect(canPlace(g, 0, K.Refinery, 6, 43)).toBe(true);
    expect(canPlace(g, 0, K.Refinery, 13, 34)).toBe(false);
    expect(canPlace(g, 0, K.Barracks, 6, 43)).toBe(false);
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 13, ty: 34 });
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 43 });
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 43 });
    run(g, 2);
    expect(g.ents.filter((e) => e.kind === K.Refinery).length).toBe(1);
    expect(canPlace(g, 0, K.Refinery, 6, 43)).toBe(false);
  });

  it('takes three Workers and brings Batteries in', () => {
    const g = rich();
    g.players[0]!.gas = 0;
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 43 });
    run(g, def(K.Refinery).time + 400);
    const r = g.ents.find((e) => e.kind === K.Refinery)!;
    expect(r.built).toBe(true);
    expect(g.ents.filter((e) => e.kind === K.Worker && e.pile === r.id).length).toBe(RULES.perRefinery);
    const before = g.players[0]!.gas;
    expect(before).toBeGreaterThan(0);
    run(g, 600);
    // Three Workers bring in something like 180 Batteries a minute.
    const perMinute = g.players[0]!.gas - before;
    expect(perMinute).toBeGreaterThan(140);
    expect(perMinute).toBeLessThan(220);
    expect(g.players[0]!.stats.gathered2).toBe(g.players[0]!.gas);
  });

  it('the pack outlives its Refinery, cancelled or destroyed', () => {
    const g = rich();
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 43 });
    run(g, 2);
    const site = g.ents.find((e) => e.kind === K.Refinery)!;
    schedule(g, { t: 'cancel', p: 0, id: site.id });
    run(g, 2);
    expect(g.players[0]!.blocks).toBe(5000);
    expect(canPlace(g, 0, K.Refinery, 6, 43)).toBe(true);
    expect(g.nav.isBlocked(6, 43)).toBe(true);
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 43 });
    run(g, def(K.Refinery).time + 100);
    const r = g.ents.find((e) => e.kind === K.Refinery)!;
    expect(r.built).toBe(true);
    r.hp = 0;
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Refinery)).toBe(false);
    expect(canPlace(g, 0, K.Refinery, 6, 43)).toBe(true);
    run(g, 200);
    expect(g.ents.filter((e) => e.owner === 0 && e.kind === K.Worker && e.cargo === 1 && e.carry === 0).length).toBe(0);
  });

  it('new buildings and units need what comes before them, and cost Batteries', () => {
    const g = rich();
    schedule(g, { t: 'build', p: 0, kind: K.Factory, tx: 13, ty: 34 });
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Factory)).toBe(false);
    const at = (tx: number, ty: number) => [(tx + 1.5) * TILE, (ty + 1.5) * TILE] as const;
    spawn(g, K.Barracks, 0, ...at(13, 34));
    spawn(g, K.Factory, 0, ...at(17, 34));
    schedule(g, { t: 'build', p: 0, kind: K.Heavy, tx: 13, ty: 42 });
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Heavy)).toBe(false); // no Armory yet
    schedule(g, { t: 'train', p: 0, kind: K.Jugger });
    schedule(g, { t: 'train', p: 0, kind: K.Tank });
    run(g, 2);
    const f = g.ents.find((e) => e.kind === K.Factory)!;
    expect(f.queue).toEqual([K.Tank]);
    expect(g.players[0]!.gas).toBe(5000 - def(K.Tank).gas);
    g.players[0]!.gas = 0;
    schedule(g, { t: 'train', p: 0, kind: K.Tank });
    run(g, 2);
    expect(f.queue.length).toBe(1);
    spawn(g, K.Armory, 0, ...at(13, 42));
    spawn(g, K.Heavy, 0, ...at(17, 42));
    g.players[0]!.gas = 1000;
    schedule(g, { t: 'train', p: 0, kind: K.Jugger });
    run(g, 2);
    expect(f.queue).toEqual([K.Tank, K.Jugger]);
  });

  it('research is bought a level at a time at the Armory, and changes what a hit does', () => {
    const g = rich();
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, 2);
    expect(g.players[0]!.blocks).toBe(5000); // no Armory
    const lab = spawn(g, K.Armory, 0, 14.5 * TILE, 35.5 * TILE);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    schedule(g, { t: 'research', p: 0, kind: K.Trooper });
    run(g, 2);
    expect(lab.queue).toEqual([K.Weapons]);
    run(g, researchCost(K.Weapons, 0).time);
    expect(g.players[0]!.weapons).toBe(1);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, researchCost(K.Weapons, 1).time + 2);
    expect(g.players[0]!.weapons).toBe(2);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, 2);
    expect(lab.queue.length).toBe(0);
    expect(g.players[0]!.gas).toBe(5000 - researchCost(K.Weapons, 0).gas - researchCost(K.Weapons, 1).gas);

    // Ten Troopers shoot one Tank for five seconds: with research, more of it is gone; with its armour, less.
    const shot = (weapons: number, armour: number) => {
      const h = createGame(1);
      h.players[0]!.weapons = weapons;
      h.players[1]!.armour = armour;
      for (let i = 0; i < 10; i++) spawn(h, K.Trooper, 0, 45 * TILE, (38 + i * 0.6) * TILE);
      const tank = spawn(h, K.Tank, 1, 49 * TILE, 41 * TILE);
      tank.mode = O.Hold;
      run(h, 50);
      return def(K.Tank).hp - tank.hp;
    };
    const plain = shot(0, 0);
    expect(shot(2, 0)).toBeGreaterThan(plain * 1.25);
    expect(shot(0, 2)).toBeLessThan(plain * 0.85);
    expect(shot(2, 2)).toBeGreaterThan(plain * 0.95);
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
    schedule(g, { t: 'research', p: 0, kind: K.Tank });
    schedule(g, { t: 'research', p: 7, kind: K.Weapons });
    schedule(g, { t: 'repeat', p: 0, kind: K.Weapons, on: true });
    schedule(g, { t: 'train', p: 0, kind: K.Weapons });
    schedule(g, { t: 'build', p: 0, kind: K.Cell, tx: 13, ty: 34 });
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

describe('the full arsenal', () => {
  const duel = (a: Kind, na: number, b: Kind, nb: number) => {
    const r = fight([{ kind: a, n: na }], [{ kind: b, n: nb }]);
    const s = fight([{ kind: b, n: nb }], [{ kind: a, n: na }]);
    return r.left[0] > 0 && r.left[1] === 0 && s.left[1] > 0 && s.left[0] === 0;
  };
  const price = (k: Kind) => def(k).cost + def(k).gas;
  /** `a` beats `b` when both sides spend the same. */
  const beats = (a: Kind, b: Kind, budget = 1800) => duel(a, Math.round(budget / price(a)), b, Math.round(budget / price(b)));

  it('Tanks beat Troopers and Runners; Lancers beat Tanks', () => {
    expect(beats(K.Tank, K.Trooper)).toBe(true);
    expect(beats(K.Tank, K.Runner)).toBe(true);
    expect(beats(K.Lancer, K.Tank)).toBe(true);
  });
  it('Gunships beat Tanks, Lancers and Juggernauts; Flak Tracks and massed Troopers beat Gunships', () => {
    expect(beats(K.Gunship, K.Tank)).toBe(true);
    expect(beats(K.Gunship, K.Lancer)).toBe(true);
    expect(beats(K.Gunship, K.Jugger)).toBe(true);
    expect(beats(K.Flak, K.Gunship)).toBe(true);
    expect(beats(K.Trooper, K.Gunship)).toBe(true);
  });
  it('Mortars beat Lancers; Runners and Tanks beat Mortars', () => {
    expect(beats(K.Mortar, K.Lancer)).toBe(true);
    expect(beats(K.Runner, K.Mortar)).toBe(true);
    expect(beats(K.Tank, K.Mortar)).toBe(true);
  });
  it('Juggernauts beat Tanks and Troopers; massed Lancers beat Juggernauts', () => {
    expect(beats(K.Jugger, K.Tank)).toBe(true);
    expect(beats(K.Jugger, K.Trooper)).toBe(true);
    expect(beats(K.Lancer, K.Jugger)).toBe(true);
  });
  it('Mortars outrange a Turret and take it down without a loss', () => {
    const r = fight([{ kind: K.Mortar, n: 2 }], [{ kind: K.Turret, n: 1 }], 1);
    expect(r.left[1]).toBe(0);
    expect(r.left[0]).toBe(2 * price(K.Mortar));
  });

  it('a Mortar fires only after two seconds standing still, and never at what is right beside it', () => {
    const shots = (gap: number) => {
      const g = createGame(1);
      spawn(g, K.Mortar, 0, 40 * TILE, 42 * TILE);
      const t = spawn(g, K.Jugger, 1, (40 + gap) * TILE, 42 * TILE);
      t.mode = O.Hold;
      g.players[1]!.vis.fill(0);
      let first = -1;
      for (let i = 0; i < 80 && first < 0; i++) {
        step(g);
        if (g.events.some((e) => e.t === 'shot' && e.kind === K.Mortar)) first = g.tick;
      }
      return first;
    };
    expect(shots(9)).toBeGreaterThanOrEqual(def(K.Mortar).setup);
    expect(shots(9)).toBeLessThan(def(K.Mortar).setup + 8);
    expect(shots(3)).toBe(-1);
  });

  it('a Tank shell hurts the Troopers standing beside its target', () => {
    const g = createGame(1);
    const tank = spawn(g, K.Tank, 0, 44 * TILE, 42 * TILE);
    tank.mode = O.Hold;
    const a = spawn(g, K.Trooper, 1, 49 * TILE, 42 * TILE);
    const b = spawn(g, K.Trooper, 1, 49 * TILE + 140, 42 * TILE);
    const far = spawn(g, K.Trooper, 1, 49 * TILE, 45 * TILE);
    for (const u of [a, b, far]) u.mode = O.Hold;
    let fired = false;
    for (let i = 0; i < 40 && !fired; i++) {
      step(g);
      fired = g.events.some((e) => e.t === 'shot' && e.kind === K.Tank);
    }
    expect(fired).toBe(true);
    const lost = [a, b].map((u) => def(K.Trooper).hp - u.hp).sort((x, y) => x - y);
    expect(lost).toEqual([Math.trunc((def(K.Tank).dmg * RULES.splashShare) / 100), def(K.Tank).dmg]);
    expect(far.hp).toBe(def(K.Trooper).hp);
  });

  it('a Gunship flies straight over the cliff, and Lancers can do nothing about it', () => {
    const g = createGame(1);
    const ship = spawn(g, K.Gunship, 0, 12 * TILE, 35 * TILE);
    ship.group = 1;
    schedule(g, { t: 'order', p: 0, group: 1, mode: O.Move, x: 40 * TILE, y: 35 * TILE });
    let overRock = false;
    for (let i = 0; i < 120; i++) {
      step(g);
      if (g.map.rock[tileIndex(g, ship.x, ship.y)] === 1) overRock = true;
    }
    expect(overRock).toBe(true);
    expect(Math.abs(ship.x - 40 * TILE)).toBeLessThan(TILE);
    expect(Math.abs(ship.y - 35 * TILE)).toBeLessThan(TILE);
    const lancers = [0, 1, 2].map((i) => spawn(g, K.Lancer, 1, 42 * TILE, (34 + i) * TILE));
    run(g, 200);
    expect(ship.hp).toBe(def(K.Gunship).hp);
    expect(lancers.every((l) => l.hp <= 0)).toBe(true);
  });
});

describe('high ground and watchtowers', () => {
  it('from below you cannot see up; from above you see down and shoot further', () => {
    const g = createGame(1);
    const up = spawn(g, K.Trooper, 0, 21 * TILE + 128, 38 * TILE + 128);
    const down = spawn(g, K.Trooper, 1, 27 * TILE + 128, 38 * TILE + 128);
    up.mode = O.Hold;
    down.mode = O.Hold;
    run(g, 2);
    expect(visibleTo(g, 0, down)).toBe(true);
    expect(visibleTo(g, 1, up)).toBe(false);
    run(g, 40);
    // Six tiles apart: out of a Trooper's reach on the level, inside it from the high ground.
    expect(down.hp).toBeLessThan(def(K.Trooper).hp);
    expect(up.hp).toBe(def(K.Trooper).hp);
    // A flyer overhead shows the high ground to everyone below, and then they can shoot back.
    spawn(g, K.Gunship, 1, 26 * TILE, 36 * TILE).mode = O.Hold;
    run(g, 2);
    expect(visibleTo(g, 1, up)).toBe(true);
  });

  it('a flyer is seen from any height', () => {
    const g = createGame(1);
    const ship = spawn(g, K.Gunship, 1, 37 * TILE, 16 * TILE); // over the north-west ridge
    ship.mode = O.Hold;
    const below = spawn(g, K.Trooper, 0, 37 * TILE, 8 * TILE);
    below.mode = O.Hold;
    run(g, 2);
    expect(g.map.high[tileIndex(g, ship.x, ship.y)]).toBe(1);
    expect(visibleTo(g, 0, ship)).toBe(true);
    expect(g.players[0]!.vis[tileIndex(g, ship.x, ship.y)]).toBe(0);
  });

  it('a watchtower shows the road to the side that stands by it alone', () => {
    const g = createGame(1);
    const tower = g.ents.find((e) => e.kind === K.Tower)!;
    const far = tileIndex(g, tower.x + 10 * TILE, tower.y);
    run(g, 2);
    expect(g.players[0]!.vis[far]).toBe(0);
    const mine = spawn(g, K.Runner, 0, tower.x, tower.y + TILE);
    mine.mode = O.Hold;
    run(g, 2);
    expect(g.players[0]!.vis[far]).toBe(1);
    expect(tower.busy).toBe(1);
    const theirs = spawn(g, K.Jugger, 1, tower.x + TILE, tower.y + 2 * TILE);
    theirs.mode = O.Hold;
    mine.hp = 100000;
    run(g, 2);
    expect(g.players[0]!.vis[far]).toBe(0);
    expect(tower.busy).toBe(0);
  });
});

describe('fair to both sides', () => {
  it('a fight between two mirrored armies is a mirror to the last shot, whichever side was made first', () => {
    const W = 96 * TILE, H = 48 * TILE;
    for (const first of [0, 1]) {
      const g = createGame(1);
      const pairs: [ReturnType<typeof spawn>, ReturnType<typeof spawn>][] = [];
      const kinds: Kind[] = [K.Trooper, K.Trooper, K.Lancer, K.Tank, K.Runner, K.Trooper, K.Mortar, K.Trooper, K.Lancer, K.Tank, K.Jugger, K.Trooper];
      kinds.forEach((kind, i) => {
        const x = Math.round((38 + (i % 4) * 0.8) * TILE), y = Math.round((30 + Math.floor(i / 4) * 0.8) * TILE);
        const a = first === 0 ? spawn(g, kind, 0, x, y) : undefined;
        const b = spawn(g, kind, 1, W - x, H - y);
        const a2 = a ?? spawn(g, kind, 0, x, y);
        a2.group = 3;
        b.group = 3;
        pairs.push([a2, b]);
      });
      schedule(g, { t: 'order', p: 0, group: 3, mode: O.Attack, x: W - 40 * TILE, y: H - 31 * TILE });
      schedule(g, { t: 'order', p: 1, group: 3, mode: O.Attack, x: 40 * TILE, y: 31 * TILE });
      let fought = false;
      for (let t = 0; t < 600; t++) {
        step(g);
        if (g.events.some((e) => e.t === 'shot')) fought = true;
        for (const [a, b] of pairs) {
          expect([a.x, a.y, a.hp]).toEqual([W - b.x, H - b.y, b.hp]);
        }
      }
      expect(fought).toBe(true);
      expect(pairs.every(([a, b]) => (a.hp <= 0) === (b.hp <= 0))).toBe(true);
    }
  });

  it('a whole match between two copies of one opponent stays a mirror image of itself', () => {
    // Same plan, same dice, opposite ends of the map: ten minutes of building, scouting, flying and fighting
    // in which neither side may ever be a single step or hit point ahead. `npx tsx lab/fair.ts` runs all nine.
    for (const [plan, tech] of [['standard', 'infantry'], ['greedy', 'air']] as const) {
      const r = firstBreak(plan, tech, 6000);
      expect(r.tick < 0 ? 'a mirror' : `${plan}/${tech} breaks at tick ${r.tick}: ${r.detail.join('; ')}`).toBe('a mirror');
    }
  });

  it('two different opponents play the same match whichever end of the map each starts at', () => {
    // A rush against a safe expansion into Tanks, and then the same two with their seats swapped: every unit
    // of the second match must stand, tick for tick, where the first match's stands turned half a circle.
    const r = seatSwap({ plan: 'rush', tech: 'infantry', dice: 1006 }, { plan: 'standard', tech: 'armour', dice: 2006 }, 6, 7000);
    expect(r.tick < 0 ? 'the same match' : `differs at tick ${r.tick}: ${r.detail.join('; ')}`).toBe('the same match');
    expect(r.ticks).toBeGreaterThan(3000);
  });

  it('when both sides claim the same ground on the same tick, neither gets it', () => {
    const g = createGame(1);
    g.players[0]!.blocks = g.players[1]!.blocks = 1000;
    for (const p of [0, 1]) spawn(g, K.Worker, p, 48 * TILE, 24 * TILE);
    schedule(g, { t: 'build', p: 1, kind: K.Barracks, tx: 47, ty: 23 });
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 48, ty: 24 });
    step(g);
    expect(g.ents.filter((e) => e.kind === K.Barracks).length).toBe(0);
    expect(g.events.filter((e) => e.t === 'refused').length).toBe(2);
    // On their own, either is fine.
    schedule(g, { t: 'build', p: 1, kind: K.Barracks, tx: 47, ty: 23 });
    step(g);
    expect(g.ents.filter((e) => e.kind === K.Barracks).length).toBe(1);
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
        for (const e of v.enemies) expect(visibleTo(g, p, e)).toBe(true);
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

  it('a long match with Tanks, Gunships and research on the field is identical too', () => {
    const play = (seed: number) => playMatch(seed, { plan: 'standard', tech: 'armour' }, { plan: 'standard', tech: 'air' }, 7000);
    // Which seed gives a match this full shifts every time the opponent is retuned, so look for one.
    let seed = 3;
    let a = play(seed);
    const full = () => a.ticks > 5000 && (a.made[0].Tank ?? 0) > 0 && (a.made[1].Gunship ?? 0) > 0 && a.research[0]! + a.research[1]! > 0;
    while (!full() && seed < 12) a = play(++seed);
    expect(full()).toBe(true);
    const b = play(seed);
    expect(a.hash).toBe(b.hash);
    expect(a.commands).toBe(b.commands);
    expect(a.batteries[0]).toBeGreaterThan(500);
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
      expect(Number.isInteger(e.frac) && Number.isInteger(e.amount)).toBe(true);
    }
    expect(Number.isInteger(g.players[0]!.blocks) && Number.isInteger(g.players[0]!.gas)).toBe(true);
  });
});

describe('content', () => {
  it('every unit has a place to be trained and sane numbers', () => {
    for (const d of Object.values(DEFS)) expect(d.hp).toBeGreaterThan(0);
    const f = FACTIONS.green;
    for (const k of f.units) {
      const d = def(k);
      expect(d.building).toBe(false);
      expect(f.buildings).toContain(d.madeAt);
      expect(d.speed).toBeGreaterThan(0);
      expect(d.supply).toBeGreaterThan(0);
      expect(d.short.length).toBeLessThanOrEqual(8);
      for (const need of d.needs) expect(f.buildings).toContain(need);
      // Everything that fights can be hurt by something.
      expect(f.units.some((o) => def(o).vs[d.cls]! > 0 && def(o).range > 0)).toBe(true);
    }
    for (const k of f.buildings) {
      expect(def(k).building).toBe(true);
      expect(def(k).size).toBeGreaterThan(0);
      for (const need of def(k).needs) expect(f.buildings).toContain(need);
    }
    expect(f.units.length).toBe(9);
    expect(f.buildings.length).toBe(8);
    expect(RULES.groups).toBe(4);
  });
});
