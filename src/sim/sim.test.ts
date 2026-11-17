import { describe, expect, it } from 'vitest';
import { fight } from '../../lab/arena';
import { firstBreak, seatSwap } from '../../lab/fair';
import { playMatch } from '../../lab/match';
import { Bot } from '../ai/bot';
import { DEFS, FACTIONS, RULES, def, isHall, researchCost, techLevel, worth } from './data';
import { CLASSIC_MAPS, classicMap, twinRidges } from './map';
import { canPlace, createGame, hash, schedule, spawn, tileIndex, visibleTo } from './state';
import { step } from './step';
import { makeView } from './view';
import { boost, forgetBoosts, speedOf } from './tech';
import { K, O, TILE, W, type Kind, type Player } from './types';

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
    const top = 23 * m.w + 57; // the middle of the north-west ridge
    expect(m.high[top]).toBe(1);
    expect(field[top]).toBeLessThan(0xffff);
    expect(field[(m.h - 1 - 23) * m.w + (m.w - 1 - 57)]).toBeLessThan(0xffff);
    expect(m.high[(from.hy + 1) * m.w + from.hx + 1]).toBe(1);
    expect(m.high[58 * m.w + 30]).toBe(0); // the ramp itself is low
    const nat = m.bases[1]!;
    expect(m.high[(nat.hy + 1) * m.w + nat.hx + 1]).toBe(0);
  });

  it('lets a Worker walk from every base to every other', () => {
    const g = createGame(1);
    const from = g.map.bases[0]!;
    const field = g.nav.field(99999, () => [(from.hy + 5) * g.map.w + from.hx + 5]);
    for (const b of g.map.bases) expect(field[(b.hy + 5 > g.map.h - 1 ? b.hy - 1 : b.hy + 5) * g.map.w + b.hx + 1]).toBeLessThan(0xffff);
  });
  for (const { id, name, make } of CLASSIC_MAPS) {
    it(`${name}: the same turned half a circle, every base laid out whole on open ground and walkable from either main`, () => {
      const m = make();
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        expect(m.rock[y * m.w + x]).toBe(m.rock[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
        expect(m.high[y * m.w + x]).toBe(m.high[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
      }
      expect(m.bases.filter((b) => b.side === 0).length).toBe(m.bases.filter((b) => b.side === 1).length);
      const g = createGame(1, classicMap(id), ['green', 'dino']);
      // Each side's main is high ground, and a Headquarters fits on every site, its piles and packs all on open tiles.
      for (const side of [0, 1]) {
        const main = m.bases.find((b) => b.side === side && b.tier === 0)!;
        expect(m.high[(main.hy + 1) * m.w + main.hx + 1]).toBe(1);
      }
      for (const b of m.bases) {
        for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) expect(m.rock[(b.hy + dy) * m.w + b.hx + dx], `${name} ${b.name} ${b.side}`).toBe(0);
        for (const p of b.piles) expect(m.rock[p.ty * m.w + p.tx], `${name} ${b.name} pile`).toBe(0);
        for (const c of b.cells) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) expect(m.rock[(c.ty + dy) * m.w + c.tx + dx]).toBe(0);
      }
      for (const side of [0, 1]) {
        const from = m.bases.find((b) => b.side === side && b.tier === 0)!;
        const field = g.nav.field(99990 + side, () => [(from.hy + 5) * m.w + from.hx + 5]);
        for (const b of m.bases) expect(field[(b.hy + 5 > m.h - 1 ? b.hy - 1 : b.hy + 5) * m.w + b.hx + 1], `${name}: ${b.name} of side ${b.side} from side ${side}`).toBeLessThan(0xffff);
      }
      // The opponent can play the map: two copies play a few minutes and each finishes a second base (which may
      // not stand for long: it is a fight).
      const bots = [new Bot(0, 3, { faction: 'green', foe: 'dino' }), new Bot(1, 4, { faction: 'dino', foe: 'green' })];
      const bases = [0, 0];
      while (g.tick < 3000 && g.winner === -1) {
        for (const b of bots) for (const c of b.think(makeView(g, b.p))) schedule(g, c);
        step(g);
        for (const ev of g.events) if (ev.t === 'done' && isHall(ev.kind)) bases[ev.owner]!++;
      }
      expect(bases, `${name}: second bases finished`).toEqual([expect.any(Number), expect.any(Number)]);
      for (const side of [0, 1]) expect(bases[side], `${name}: side ${side}'s second base`).toBeGreaterThan(0);
    });
  }
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

describe('a Brutal opponent', () => {
  it('earns a quarter more on every load, in whole numbers with the hundredths kept, and nobody else anything', () => {
    const g = createGame(1, undefined, ['green', 'green'], [0, RULES.brutalBonus]);
    run(g, 1800);
    const [a, b] = g.players as [Player, Player];
    // Both sides hauled the same (the map and the rules are fair); only the Brutal side was paid more for it.
    expect(b.stats.gathered).toBe(a.stats.gathered);
    expect(a.stats.gathered).toBeGreaterThan(300);
    expect(a.blocks).toBe(RULES.startBlocks + a.stats.gathered);
    expect(a.bonusLeft).toEqual([0, 0]);
    const extra = (b.stats.gathered * RULES.brutalBonus - b.bonusLeft[0]) / 100;
    expect(Number.isInteger(extra)).toBe(true);
    expect(b.blocks).toBe(RULES.startBlocks + b.stats.gathered + extra);
    expect(b.bonusLeft[0]).toBeLessThan(100);
  });
  it('takes the bonus as a command would be taken: clamped to whole percents from 0 to 100', () => {
    const g = createGame(1, undefined, ['green', 'green'], [-5, 250.7]);
    expect(g.players.map((p) => p.bonus)).toEqual([0, 100]);
    expect(createGame(1).players.map((p) => p.bonus)).toEqual([0, 0]);
  });
});

describe('conceding', () => {
  it('ends a Classic match on the next tick, for the other side; two sides conceding together both lose', () => {
    const g = createGame(1);
    run(g, 50);
    schedule(g, { t: 'concede', p: 1 });
    step(g);
    expect(g.winner).toBe(0);
    const h = createGame(1);
    schedule(h, { t: 'concede', p: 0 });
    schedule(h, { t: 'concede', p: 1 });
    step(h);
    expect(h.winner).toBe(-2);
  });
  it('is not a way out of a Frenzy round, and a concession from nobody is nothing', () => {
    const g = createGame(3, undefined, ['green', 'dino', 'green', 'dino']);
    schedule(g, { t: 'concede', p: 2 });
    schedule(g, { t: 'concede', p: 7 });
    run(g, 5);
    expect(g.winner).toBe(-1);
    expect(g.players.some((p) => p.out)).toBe(false);
    const h = createGame(1);
    schedule(h, { t: 'concede', p: 2 });
    schedule(h, { t: 'concede', p: -1 });
    run(h, 5);
    expect(h.winner).toBe(-1);
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
    expect(canPlace(g, 0, K.Refinery, 6, 62)).toBe(true);
    expect(canPlace(g, 0, K.Refinery, 13, 53)).toBe(false);
    expect(canPlace(g, 0, K.Barracks, 6, 62)).toBe(false);
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 13, ty: 53 });
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 62 });
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 62 });
    run(g, 2);
    expect(g.ents.filter((e) => e.kind === K.Refinery).length).toBe(1);
    expect(canPlace(g, 0, K.Refinery, 6, 62)).toBe(false);
  });

  it('takes three Workers and brings Batteries in', () => {
    const g = rich();
    g.players[0]!.gas = 0;
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 62 });
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
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 62 });
    run(g, 2);
    const site = g.ents.find((e) => e.kind === K.Refinery)!;
    schedule(g, { t: 'cancel', p: 0, id: site.id });
    run(g, 2);
    expect(g.players[0]!.blocks).toBe(5000);
    expect(canPlace(g, 0, K.Refinery, 6, 62)).toBe(true);
    expect(g.nav.isBlocked(6, 62)).toBe(true);
    schedule(g, { t: 'build', p: 0, kind: K.Refinery, tx: 6, ty: 62 });
    run(g, def(K.Refinery).time + 100);
    const r = g.ents.find((e) => e.kind === K.Refinery)!;
    expect(r.built).toBe(true);
    r.hp = 0;
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Refinery)).toBe(false);
    expect(canPlace(g, 0, K.Refinery, 6, 62)).toBe(true);
    run(g, 200);
    expect(g.ents.filter((e) => e.owner === 0 && e.kind === K.Worker && e.cargo === 1 && e.carry === 0).length).toBe(0);
  });

  it('new buildings and units need what comes before them, and cost Batteries', () => {
    const g = rich();
    schedule(g, { t: 'build', p: 0, kind: K.Factory, tx: 13, ty: 53 });
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Factory)).toBe(false);
    const at = (tx: number, ty: number) => [(tx + 1.5) * TILE, (ty + 1.5) * TILE] as const;
    spawn(g, K.Barracks, 0, ...at(13, 53));
    spawn(g, K.Factory, 0, ...at(17, 53));
    schedule(g, { t: 'build', p: 0, kind: K.Heavy, tx: 13, ty: 61 });
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
    spawn(g, K.Armory, 0, ...at(13, 61));
    spawn(g, K.Heavy, 0, ...at(17, 61));
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
    const lab = spawn(g, K.Armory, 0, 14.5 * TILE, 54.5 * TILE);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    schedule(g, { t: 'research', p: 0, kind: K.Trooper });
    run(g, 2);
    expect(lab.studies).toEqual([K.Weapons]);
    run(g, researchCost(K.Weapons, 0).time);
    expect(g.players[0]!.weapons).toBe(1);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, researchCost(K.Weapons, 1).time + 2);
    expect(g.players[0]!.weapons).toBe(2);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, 2);
    expect(lab.studies.length).toBe(0);
    expect(g.players[0]!.gas).toBe(5000 - researchCost(K.Weapons, 0).gas - researchCost(K.Weapons, 1).gas);

    // Ten Troopers shoot one Tank for five seconds: with research, more of it is gone; with its armour, less.
    const shot = (weapons: number, armour: number) => {
      const h = createGame(1);
      h.players[0]!.weapons = weapons;
      h.players[1]!.armour = armour;
      for (let i = 0; i < 10; i++) spawn(h, K.Trooper, 0, 55 * TILE, (46 + i * 0.6) * TILE);
      const tank = spawn(h, K.Tank, 1, 59 * TILE, 49 * TILE);
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

describe('supply, recycling and the late game', () => {
  const rich = (factions: ['green' | 'dino', 'green' | 'dino'] = ['green', 'green']) => {
    const g = createGame(1, undefined, factions);
    g.players[0]!.blocks = 20000;
    g.players[0]!.gas = 20000;
    return g;
  };
  const mine = (g: ReturnType<typeof createGame>, kind: number, p = 0) => g.ents.filter((e) => e.owner === p && e.kind === kind);

  it('supply tops out at 200: five Headquarters, and a sixth adds nothing', () => {
    const g = rich();
    for (let i = 0; i < 4; i++) spawn(g, K.HQ, 0, (20 + i * 5) * TILE, 40 * TILE);
    run(g, 1);
    expect(g.players[0]!.cap).toBe(5 * def(K.HQ).provides);
    expect(g.players[0]!.cap).toBe(RULES.supplyMax);
    spawn(g, K.HQ, 0, 40 * TILE, 40 * TILE);
    run(g, 1);
    expect(g.players[0]!.cap).toBe(200);
  });

  it('a recycled Worker walks home, frees its supply at once and gives back half its price, and is no loss', () => {
    const g = rich();
    run(g, 60);
    const before = g.players[0]!.supply;
    const blocks = g.players[0]!.blocks - g.players[0]!.stats.gathered;
    schedule(g, { t: 'recycle', p: 0, n: 2 });
    run(g, 2);
    expect(g.players[0]!.supply).toBe(before - 2);
    // One already at the door is taken back at once; the rest are on their way.
    expect(mine(g, K.Worker).filter((e) => e.ws === W.Recycled).length + RULES.startWorkers - mine(g, K.Worker).length).toBe(2);
    run(g, 200);
    expect(mine(g, K.Worker).length).toBe(RULES.startWorkers - 2);
    expect(g.players[0]!.stats.lostUnits).toBe(0);
    // Half of 50 each, on top of whatever the other six and the two loads brought in.
    expect(g.players[0]!.blocks - blocks - g.players[0]!.stats.gathered).toBe(2 * Math.trunc((def(K.Worker).cost * RULES.recycleRefund) / 100));
  });

  it('the Workers with least to do go first, never one that is building, and nonsense is ignored', () => {
    const g = rich();
    // Twelve Workers on six piles: four more than the piles serve well.
    for (let i = 0; i < 4; i++) spawn(g, K.Worker, 0, 9 * TILE, 52 * TILE);
    run(g, 120);
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 53 });
    run(g, 3);
    const builder = mine(g, K.Worker).find((e) => e.ws === W.ToSite || e.ws === W.Build)!;
    expect(builder).toBeDefined();
    for (const n of [0, -1, 1.5, Number.NaN]) schedule(g, { t: 'recycle', p: 0, n });
    run(g, 2);
    expect(mine(g, K.Worker).some((e) => e.ws === W.Recycled)).toBe(false);
    schedule(g, { t: 'recycle', p: 0, n: 30 });
    run(g, 2);
    expect(builder.ws).not.toBe(W.Recycled);
    expect(mine(g, K.Worker).filter((e) => e.ws === W.Recycled).length).toBe(mine(g, K.Worker).length - 1);
    // Recycling in Frenzy is nothing: it has no Workers.
    const f = createGame(1, undefined, ['green', 'dino', 'green', 'dino']);
    const h = hash(f);
    schedule(f, { t: 'recycle', p: 0, n: 3 });
    const f2 = createGame(1, undefined, ['green', 'dino', 'green', 'dino']);
    run(f, 20);
    run(f2, 20);
    expect(hash(f)).toBe(hash(f2));
    expect(h).toBeGreaterThan(0);
  });

  it('a Gatherer is recycled at a Nest the same way', () => {
    const g = rich(['dino', 'green']);
    run(g, 60);
    schedule(g, { t: 'recycle', p: 0, n: 1 });
    run(g, 250);
    expect(mine(g, K.Gatherer).length).toBe(RULES.startWorkers - 1);
    expect(g.players[0]!.stats.lostUnits).toBe(0);
  });

  it('the Tech tab has nine items a faction, each studied at its own building once what it needs stands', () => {
    for (const f of ['green', 'dino'] as const) {
      expect(FACTIONS[f].tech.length).toBe(9);
      for (const k of FACTIONS[f].tech) {
        expect(def(k).madeAt).toBeDefined();
        expect(FACTIONS[f].buildings).toContain(def(k).madeAt);
      }
    }
    const g = rich();
    const at = (tx: number, ty: number) => [(tx + 1.5) * TILE, (ty + 1.5) * TILE] as const;
    const rax = spawn(g, K.Barracks, 0, ...at(13, 53));
    schedule(g, { t: 'research', p: 0, kind: K.LongRifles });
    run(g, 2);
    expect(rax.studies).toEqual([]); // no Armory
    spawn(g, K.Armory, 0, ...at(17, 53));
    schedule(g, { t: 'research', p: 0, kind: K.LongRifles });
    schedule(g, { t: 'research', p: 0, kind: K.AcidSpit }); // the other faction's
    run(g, 2);
    expect(rax.studies).toEqual([K.LongRifles]);
    run(g, def(K.LongRifles).time);
    expect(techLevel(g.players[0]!, K.LongRifles)).toBe(1);
    expect(boost(g, 0, K.Trooper).range).toBe(TILE);
    expect(boost(g, 1, K.Trooper).range).toBe(0);
    schedule(g, { t: 'research', p: 0, kind: K.LongRifles });
    run(g, 2);
    expect(rax.studies).toEqual([]); // one level only
  });

  it('Weapons and Armour have a third level, which waits for Heavy Works', () => {
    const g = rich();
    const lab = spawn(g, K.Armory, 0, 14.5 * TILE, 54.5 * TILE);
    g.players[0]!.weapons = 2;
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, 2);
    expect(lab.studies).toEqual([]);
    spawn(g, K.Heavy, 0, 18.5 * TILE, 54.5 * TILE);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, researchCost(K.Weapons, 2).time + 3);
    expect(g.players[0]!.weapons).toBe(3);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, 2);
    expect(lab.studies).toEqual([]);
  });

  /** Ten Troopers of side 0 shoot a Tank of side 1 that holds still, with some research set first. */
  const volley = (setup: (h: ReturnType<typeof createGame>) => void, gap = 4, kind: Kind = K.Trooper, n = 10) => {
    const h = createGame(1);
    setup(h);
    for (const pl of h.players) forgetBoosts(pl);
    for (let i = 0; i < n; i++) spawn(h, kind, 0, 55 * TILE, (46 + i * 0.6) * TILE).mode = O.Hold;
    const tank = spawn(h, K.Tank, 1, (55 + gap) * TILE + def(K.Tank).radius + def(kind).range, 49 * TILE);
    tank.mode = O.Hold;
    run(h, 50);
    return def(K.Tank).hp - tank.hp;
  };

  it('Long Rifles reach a tile further, Heavy Shells hit harder, and Thick Skulls and Concrete take less', () => {
    // Out of reach by half a tile without Long Rifles, in reach with them.
    const set = (k: Kind, p = 0) => (h: ReturnType<typeof createGame>) => { h.players[p]!.tech[k - 100] = 1; };
    expect(volley(() => {}, 0.5)).toBe(0);
    expect(volley(set(K.LongRifles), 0.5)).toBeGreaterThan(0);
    const plain = volley(() => {}, -1, K.Tank, 3);
    expect(volley(set(K.HeavyShells), -1, K.Tank, 3)).toBeGreaterThanOrEqual(Math.floor(plain * 1.18));
    // Concrete: a Turret under the same fire loses less.
    const turret = (concrete: boolean) => {
      const h = createGame(1);
      if (concrete) h.players[1]!.tech[K.Concrete - 100] = 1;
      forgetBoosts(h.players[1]!);
      for (let i = 0; i < 2; i++) spawn(h, K.Lancer, 0, 55 * TILE, (47 + i * 0.6) * TILE).mode = O.Hold;
      const t = spawn(h, K.Turret, 1, 55 * TILE + def(K.Lancer).range + def(K.Turret).radius - TILE, 48 * TILE);
      run(h, 40);
      expect(t.hp).toBeGreaterThan(0);
      return def(K.Turret).hp - t.hp;
    };
    expect(turret(true)).toBeLessThan(turret(false) * 0.75);
  });

  it('Quick March, Swift Feet and the wings make what they name faster, and nothing else', () => {
    const g = rich();
    const runner = spawn(g, K.Runner, 0, 20 * TILE, 40 * TILE), tank = spawn(g, K.Tank, 0, 22 * TILE, 40 * TILE);
    const before = speedOf(g, runner);
    g.players[0]!.tech[K.QuickMarch - 100] = 1;
    forgetBoosts(g.players[0]!);
    expect(speedOf(g, runner)).toBe(Math.trunc((def(K.Runner).speed * 115) / 100));
    expect(speedOf(g, runner)).toBeGreaterThan(before);
    expect(speedOf(g, tank)).toBe(def(K.Tank).speed);
  });

  it('Field Repair mends a unit left alone, a little each second; a unit still under fire does not mend', () => {
    const g = rich();
    const t = spawn(g, K.Tank, 0, 20 * TILE, 40 * TILE);
    t.hp = 100;
    run(g, 100);
    expect(t.hp).toBe(100);
    g.players[0]!.tech[K.FieldRepair - 100] = 1;
    forgetBoosts(g.players[0]!);
    t.hurt = g.tick;
    run(g, RULES.mendWait - 5);
    expect(t.hp).toBe(100);
    run(g, 100);
    expect(t.hp).toBeGreaterThan(100);
    expect(t.hp).toBeLessThanOrEqual(def(K.Tank).hp);
    run(g, 3000);
    expect(t.hp).toBe(def(K.Tank).hp);
  });

  it('Big Loads and Big Mouths bring in a Block more a trip', () => {
    for (const [f, k] of [['green', K.BigLoads], ['dino', K.BigMouths]] as const) {
      const take = (on: boolean) => {
        const g = createGame(1, undefined, [f, f]);
        if (on) g.players[0]!.tech[k - 100] = 1;
        forgetBoosts(g.players[0]!);
        run(g, 900);
        return g.players[0]!.stats.gathered;
      };
      expect(take(true)).toBeGreaterThan(take(false) * 1.12);
    }
  });
});

describe('building', () => {
  it('goes anywhere on open ground, blocks movement, and can be cancelled for a refund', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 1000;
    expect(canPlace(g, 0, K.Barracks, 13, 53)).toBe(true);
    expect(canPlace(g, 0, K.Barracks, 5, 55)).toBe(false); // on the Headquarters
    expect(canPlace(g, 0, K.Barracks, 29, 50)).toBe(false); // on the cliff
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 53 });
    run(g, 2);
    const site = g.ents.find((e) => e.kind === K.Barracks)!;
    expect(site.built).toBe(false);
    expect(g.nav.isBlocked(14, 54)).toBe(true);
    expect(g.players[0]!.blocks).toBe(1000 - def(K.Barracks).cost);
    schedule(g, { t: 'cancel', p: 0, id: site.id });
    run(g, 2);
    expect(g.players[0]!.blocks).toBe(1000);
    expect(g.nav.isBlocked(14, 54)).toBe(false);
  });

  it('a Worker walks over and finishes it, then goes back to hauling', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 1000;
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 53 });
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
    schedule(g, { t: 'build', p: 0, kind: K.Turret, tx: 15, ty: 59 });
    run(g, 2);
    expect(g.ents.some((e) => e.kind === K.Turret)).toBe(false);
    // The ramp is six tiles tall: three Barracks side by side in front of it leave no way through.
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 27, ty: 55 });
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 27, ty: 58 });
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 27, ty: 61 });
    run(g, 2);
    expect(g.ents.filter((e) => e.kind === K.Barracks).length).toBe(3);
    const inside = 58 * g.map.w + 12, outside = 58 * g.map.w + 38;
    const field = g.nav.field(88888, () => [inside]);
    expect(field[outside]).toBe(0xffff);
  });
});

describe('orders', () => {
  it('a group attack-moves across the map and arrives', () => {
    const g = createGame(1);
    g.players[0]!.blocks = 5000;
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 13, ty: 53 });
    run(g, def(K.Barracks).time + 80);
    for (let i = 0; i < 4; i++) schedule(g, { t: 'train', p: 0, kind: K.Trooper });
    run(g, def(K.Trooper).time * 4 + 20);
    const troopers = () => g.ents.filter((e) => e.owner === 0 && e.kind === K.Trooper);
    expect(troopers().length).toBe(4);
    schedule(g, { t: 'order', p: 0, group: 0, mode: O.Move, x: 72 * TILE, y: 40 * TILE });
    run(g, 700);
    for (const u of troopers()) {
      expect(Math.abs(u.x - 72 * TILE)).toBeLessThan(3 * TILE);
      expect(Math.abs(u.y - 40 * TILE)).toBeLessThan(3 * TILE);
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
    const ship = spawn(g, K.Gunship, 0, 12 * TILE, 54 * TILE);
    ship.group = 1;
    schedule(g, { t: 'order', p: 0, group: 1, mode: O.Move, x: 40 * TILE, y: 54 * TILE });
    let overRock = false;
    for (let i = 0; i < 120; i++) {
      step(g);
      if (g.map.rock[tileIndex(g, ship.x, ship.y)] === 1) overRock = true;
    }
    expect(overRock).toBe(true);
    expect(Math.abs(ship.x - 40 * TILE)).toBeLessThan(TILE);
    expect(Math.abs(ship.y - 54 * TILE)).toBeLessThan(TILE);
    const lancers = [0, 1, 2].map((i) => spawn(g, K.Lancer, 1, 42 * TILE, (53 + i) * TILE));
    run(g, 200);
    expect(ship.hp).toBe(def(K.Gunship).hp);
    expect(lancers.every((l) => l.hp <= 0)).toBe(true);
  });
});

describe('high ground and watchtowers', () => {
  it('from below you cannot see up; from above you see down and shoot further', () => {
    const g = createGame(1);
    const up = spawn(g, K.Trooper, 0, 28 * TILE + 128, 52 * TILE + 128);
    const down = spawn(g, K.Trooper, 1, 34 * TILE + 128, 52 * TILE + 128);
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
    spawn(g, K.Gunship, 1, 33 * TILE, 50 * TILE).mode = O.Hold;
    run(g, 2);
    expect(visibleTo(g, 1, up)).toBe(true);
  });

  it('a flyer is seen from any height', () => {
    const g = createGame(1);
    const ship = spawn(g, K.Gunship, 1, 57 * TILE, 20 * TILE); // over the north-west ridge
    ship.mode = O.Hold;
    const below = spawn(g, K.Trooper, 0, 57 * TILE, 11 * TILE);
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

describe('the Dino Pack', () => {
  const dino = () => createGame(1, undefined, ['dino', 'green']);
  const mine = (g: ReturnType<typeof createGame>, kind: number, p = 0) => g.ents.filter((e) => e.owner === p && e.kind === kind);
  const order = (g: ReturnType<typeof createGame>, cmd: Parameters<typeof schedule>[1]) => { schedule(g, cmd); step(g); };
  /** A finished Den beside the Nest, with Blocks and Batteries to spare. */
  const withDen = () => {
    const g = dino();
    g.players[0]!.blocks = 3000;
    g.players[0]!.gas = 3000;
    order(g, { t: 'build', p: 0, kind: K.Den, tx: 13, ty: 53 });
    run(g, 500);
    expect(mine(g, K.Den)[0]?.built).toBe(true);
    return g;
  };

  it('starts with a Nest and eight Gatherers, who haul Blocks as Workers do', () => {
    const g = dino();
    expect(mine(g, K.Nest).length).toBe(1);
    expect(mine(g, K.Gatherer).length).toBe(8);
    expect(mine(g, K.HQ).length + mine(g, K.Worker).length).toBe(0);
    expect(g.players[0]!.supply).toBe(8);
    expect(g.players[0]!.cap).toBe(def(K.Nest).provides);
    run(g, 300);
    expect(g.players[0]!.blocks).toBe(g.players[1]!.blocks);
    expect(g.players[0]!.blocks).toBeGreaterThan(200);
  });

  it('a Nest lays an egg every few seconds and holds three', () => {
    const g = dino();
    const nest = mine(g, K.Nest)[0]!;
    expect(nest.eggs).toBe(RULES.eggStart);
    run(g, RULES.eggTicks);
    expect(nest.eggs).toBe(RULES.eggStart + 1);
    run(g, RULES.eggTicks * 5);
    expect(nest.eggs).toBe(RULES.eggMax);
  });

  it('every unit hatches from an egg, several at once, and nothing hatches without one', () => {
    const g = dino();
    g.players[0]!.blocks = 1000;
    const nest = mine(g, K.Nest)[0]!;
    nest.eggs = 2;
    for (let i = 0; i < 3; i++) schedule(g, { t: 'train', p: 0, kind: K.Gatherer });
    step(g);
    // Two eggs, two Gatherers on the way; the third is refused and costs nothing.
    expect(nest.eggs).toBe(0);
    expect(mine(g, K.Egg).length).toBe(2);
    expect(g.players[0]!.blocks).toBe(1000 - 2 * def(K.Gatherer).cost);
    expect(g.events.some((e) => e.t === 'refused' && e.why === 'No egg ready yet')).toBe(true);
    expect(g.players[0]!.supply).toBe(10);
    // The eggs lie outside the Nest, apart from each other, and hatch together.
    const [a, b] = mine(g, K.Egg);
    expect(Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y)).toBeGreaterThan(TILE / 2);
    run(g, def(K.Gatherer).time + 1);
    expect(mine(g, K.Egg).length).toBe(0);
    expect(mine(g, K.Gatherer).length).toBe(10);
    expect(g.players[0]!.stats.lostUnits).toBe(0);
    run(g, 200);
    expect(mine(g, K.Gatherer).every((w) => w.ws !== 0)).toBe(true);
  });

  it('a Gatherer becomes the building, which then grows by itself', () => {
    const g = dino();
    g.players[0]!.blocks = 500;
    order(g, { t: 'build', p: 0, kind: K.Den, tx: 13, ty: 53 });
    const den = mine(g, K.Den)[0]!;
    expect(den.built).toBe(false);
    expect(g.players[0]!.blocks).toBe(500 - def(K.Den).cost);
    run(g, 120);
    // The Gatherer has walked over and is gone: seven left, and its supply is free again.
    expect(mine(g, K.Gatherer).length).toBe(7);
    expect(den.builder).toBe(-1);
    expect(den.progress).toBeGreaterThan(0);
    expect(g.players[0]!.supply).toBe(7);
    expect(g.players[0]!.stats.lostUnits).toBe(0);
    run(g, def(K.Den).time);
    expect(den.built).toBe(true);
    expect(den.hp).toBe(def(K.Den).hp);
    expect(mine(g, K.Gatherer).length).toBe(7);
  });

  it('cancelling a Dino building gives the Gatherer back', () => {
    const g = dino();
    g.players[0]!.blocks = 500;
    order(g, { t: 'build', p: 0, kind: K.Den, tx: 13, ty: 53 });
    run(g, 150);
    expect(mine(g, K.Gatherer).length).toBe(7);
    order(g, { t: 'cancel', p: 0, id: mine(g, K.Den)[0]!.id });
    expect(mine(g, K.Den).length).toBe(0);
    expect(mine(g, K.Gatherer).length).toBe(8);
    run(g, 100);
    expect(mine(g, K.Gatherer).every((w) => w.ws !== 0 && !g.nav.blockedAt(w.x, w.y))).toBe(true);
  });

  it('builds only on nesting ground near a finished Nest, except for a new Nest', () => {
    const g = dino();
    g.players[0]!.blocks = 5000;
    const nest = mine(g, K.Nest)[0]!;
    const near = { tx: Math.round(nest.x / TILE) + 4, ty: Math.round(nest.y / TILE) - 6 };
    expect(canPlace(g, 0, K.Den, near.tx, near.ty)).toBe(true);
    // Open ground by the natural is no good for a Den, and fine for a Nest.
    const nat = g.map.bases.find((b) => b.side === 0 && b.tier === 1)!;
    expect(canPlace(g, 0, K.Den, nat.hx - 4, nat.hy)).toBe(false);
    expect(canPlace(g, 0, K.Nest, nat.hx, nat.hy)).toBe(true);
    order(g, { t: 'build', p: 0, kind: K.Den, tx: nat.hx - 4, ty: nat.hy });
    expect(g.events.some((e) => e.t === 'refused' && e.why.includes('nesting ground'))).toBe(true);
    // The Green Army builds where it likes, and neither side can use the other's buildings.
    expect(canPlace(g, 1, K.Barracks, nat.hx - 4, nat.hy)).toBe(true);
    order(g, { t: 'build', p: 0, kind: K.Barracks, tx: near.tx, ty: near.ty });
    order(g, { t: 'train', p: 0, kind: K.Worker });
    order(g, { t: 'train', p: 1, kind: K.Raptor });
    expect(mine(g, K.Barracks).length + mine(g, K.Worker).length + mine(g, K.Egg, 1).length).toBe(0);
    // Once a Nest stands at the natural, the ground around it is nesting ground too.
    order(g, { t: 'build', p: 0, kind: K.Nest, tx: nat.hx, ty: nat.hy });
    run(g, 900);
    expect(mine(g, K.Nest).length).toBe(2);
    expect(mine(g, K.Nest).every((n) => n.built)).toBe(true);
    expect(canPlace(g, 0, K.Den, nat.hx - 4, nat.hy)).toBe(true);
    expect(g.players[0]!.cap).toBe(2 * def(K.Nest).provides);
  });

  it('dinosaurs need their Dens, and Raptors hatch two to an egg', () => {
    const g = dino();
    g.players[0]!.blocks = 3000;
    g.players[0]!.gas = 3000;
    order(g, { t: 'train', p: 0, kind: K.Raptor });
    expect(g.events.some((e) => e.t === 'refused' && e.why === 'Needs a Den')).toBe(true);
    order(g, { t: 'build', p: 0, kind: K.Wallow, tx: 13, ty: 53 });
    expect(g.events.some((e) => e.t === 'refused' && e.why === 'Needs a Den first')).toBe(true);
    const g2 = withDen();
    const supply = g2.players[0]!.supply, blocks = g2.players[0]!.blocks;
    order(g2, { t: 'train', p: 0, kind: K.Raptor });
    expect(g2.players[0]!.supply).toBe(supply + 2);
    expect(g2.players[0]!.blocks).toBe(blocks - def(K.Raptor).cost);
    run(g2, def(K.Raptor).time + 1);
    const raptors = mine(g2, K.Raptor);
    expect(raptors.length).toBe(2);
    expect(raptors.every((r) => r.group === 0)).toBe(true);
    run(g2, 30);
    expect(Math.abs(raptors[0]!.x - raptors[1]!.x) + Math.abs(raptors[0]!.y - raptors[1]!.y)).toBeGreaterThan(TILE / 4);
    order(g2, { t: 'train', p: 0, kind: K.Horn });
    expect(g2.events.some((e) => e.t === 'refused' && e.why === 'Needs a Wallow')).toBe(true);
    order(g2, { t: 'train', p: 0, kind: K.Rex });
    expect(g2.events.some((e) => e.t === 'refused' && e.why === 'Needs a Great Cave')).toBe(true);
  });

  it('a Dig on a battery pack brings Batteries in, and Claws and Hide are researched at the Bone Pit', () => {
    const g = withDen();
    const pack = g.ents.filter((e) => e.kind === K.Cell).sort((a, b) => (a.x - mine(g, K.Nest)[0]!.x) ** 2 + (a.y - mine(g, K.Nest)[0]!.y) ** 2 - (b.x - mine(g, K.Nest)[0]!.x) ** 2 - (b.y - mine(g, K.Nest)[0]!.y) ** 2)[0]!;
    order(g, { t: 'build', p: 0, kind: K.Dig, tx: pack.x / TILE - 1, ty: pack.y / TILE - 1 });
    order(g, { t: 'build', p: 0, kind: K.BonePit, tx: 9, ty: 51 });
    order(g, { t: 'research', p: 0, kind: K.Weapons });
    order(g, { t: 'research', p: 0, kind: K.Claws });
    expect(g.events.some((e) => e.t === 'refused' && e.why === 'Needs a Bone Pit')).toBe(true);
    const before = g.players[0]!.stats.gathered2;
    run(g, 700);
    expect(mine(g, K.Dig)[0]?.built).toBe(true);
    expect(g.players[0]!.stats.gathered2).toBeGreaterThan(before);
    order(g, { t: 'research', p: 0, kind: K.Claws });
    order(g, { t: 'research', p: 0, kind: K.Hide });
    run(g, researchCost(K.Claws, 0).time + researchCost(K.Hide, 0).time + 5);
    expect(g.players[0]!.weapons).toBe(1);
    expect(g.players[0]!.armour).toBe(1);
  });

  it('teeth must reach: a Raptor bites what it touches, a building at any wall, and gains no range from a cliff', () => {
    const g = createGame(1, undefined, ['dino', 'green']);
    const r = spawn(g, K.Raptor, 0, 56 * TILE, 38 * TILE);
    const t = spawn(g, K.Trooper, 1, 56 * TILE + TILE * 3, 38 * TILE);
    t.mode = O.Hold;
    r.group = 3;
    step(g);
    expect(t.hp).toBe(def(K.Trooper).hp);
    run(g, 30);
    // It closed the gap and bit; it didn't hit from three tiles off.
    expect(t.hp).toBeLessThan(def(K.Trooper).hp);
    expect(Math.abs(r.x - t.x)).toBeLessThan(TILE);
    // A Raptor at the corner of a Barracks can bite it.
    const g2 = createGame(1, undefined, ['dino', 'green']);
    g2.players[1]!.blocks = 1000;
    const b = spawn(g2, K.Barracks, 1, 57 * TILE + TILE / 2, 38 * TILE + TILE / 2);
    g2.nav.setRect(56, 37, 3, 1);
    const r2 = spawn(g2, K.Raptor, 0, 55 * TILE + TILE / 2, 36 * TILE + TILE / 2);
    r2.group = 3;
    run(g2, 40);
    expect(b.hp).toBeLessThan(def(K.Barracks).hp);
  });

  it('a Horn charges the last few steps, and a Bronto stomp hurts everything around its target', () => {
    const g = createGame(1, undefined, ['dino', 'green']);
    const h = spawn(g, K.Horn, 0, 54 * TILE, 38 * TILE);
    h.group = 3;
    const far = spawn(g, K.Trooper, 1, 59 * TILE, 38 * TILE);
    far.mode = O.Hold;
    far.hp = 9999;
    step(g);
    const x0 = h.x;
    run(g, 4);
    expect((h.x - x0) / 4).toBeGreaterThan(def(K.Horn).speed);
    const g2 = createGame(1, undefined, ['dino', 'green']);
    const br = spawn(g2, K.Bronto, 0, 56 * TILE, 38 * TILE);
    br.group = 3;
    const ts = [0, 1, 2].map((i) => spawn(g2, K.Trooper, 1, 57 * TILE + i * 150, 38 * TILE + (i - 1) * 120));
    for (const t of ts) t.mode = O.Hold;
    run(g2, 45);
    expect(ts.filter((t) => t.hp < def(K.Trooper).hp).length).toBe(3);
  });

  it('a Ptero flies, and fights flyers as well as the ground', () => {
    const g = createGame(1, undefined, ['dino', 'green']);
    const p = spawn(g, K.Ptero, 0, 30 * TILE, 12 * TILE);
    p.group = 3;
    const gs = spawn(g, K.Gunship, 1, 36 * TILE, 16 * TILE);
    gs.mode = O.Hold;
    // The Gunship is over the ridge; the Ptero goes straight at it over the rock, and the Gunship can't answer.
    schedule(g, { t: 'order', p: 0, group: 3, mode: O.Attack, x: 36 * TILE, y: 16 * TILE });
    run(g, 60);
    expect(gs.hp).toBeLessThan(def(K.Gunship).hp);
    expect(p.hp).toBe(def(K.Ptero).hp);
  });

  it('a side with no Nest left has lost, and an egg can be broken before it hatches', () => {
    const g = dino();
    g.players[0]!.blocks = 500;
    order(g, { t: 'train', p: 0, kind: K.Gatherer });
    const egg = mine(g, K.Egg)[0]!;
    egg.hp = 0;
    step(g);
    expect(mine(g, K.Egg).length).toBe(0);
    expect(g.players[0]!.stats.lostUnits).toBe(1);
    run(g, 200);
    expect(mine(g, K.Gatherer).length).toBe(8);
    mine(g, K.Nest)[0]!.hp = 0;
    step(g);
    expect(g.winner).toBe(1);
  });

  it('keeps hatching what it is told to keep coming, taking turns for the eggs', () => {
    const g = withDen();
    schedule(g, { t: 'repeat', p: 0, kind: K.Gatherer, on: true });
    schedule(g, { t: 'repeat', p: 0, kind: K.Raptor, on: true });
    run(g, 900);
    expect(mine(g, K.Gatherer).length).toBeGreaterThan(9);
    expect(mine(g, K.Raptor).length).toBeGreaterThan(3);
  });
});

describe('the Dino unit table', () => {
  const duel = (a: Kind, na: number, b: Kind, nb: number) => {
    const r = fight([{ kind: a, n: na }], [{ kind: b, n: nb }]);
    const s = fight([{ kind: b, n: nb }], [{ kind: a, n: na }]);
    return r.left[0] > 0 && r.left[1] === 0 && s.left[1] > 0 && s.left[0] === 0;
  };
  /** `a` beats `b` when both sides spend the same; a Raptor is priced as half its egg. */
  const beats = (a: Kind, b: Kind, budget = 1800) => duel(a, Math.round(budget / worth(a)), b, Math.round(budget / worth(b)));
  const alone = (kind: Kind, n: number, against: Kind) => fight([{ kind, n }], [{ kind: against, n: 1 }], 1).left;

  it('Raptors beat slow shooters; splash, flyers, Turrets and Volcanoes beat Raptors', () => {
    expect(beats(K.Raptor, K.Lancer)).toBe(true);
    expect(beats(K.Raptor, K.Mortar)).toBe(true);
    expect(beats(K.Tank, K.Raptor)).toBe(true);
    expect(beats(K.Bronto, K.Raptor)).toBe(true);
    expect(beats(K.Gunship, K.Raptor)).toBe(true);
    expect(beats(K.Ptero, K.Raptor)).toBe(true);
    // Eight Raptors are twice the price of a Turret, and still lose to one.
    expect(alone(K.Raptor, 8, K.Turret)[0]).toBe(0);
    expect(alone(K.Raptor, 8, K.Volcano)[0]).toBe(0);
  });
  it('Spitters beat flyers and Light at range, Troopers narrowly; splash, Horns and Raptors up close beat Spitters', () => {
    expect(beats(K.Spitter, K.Gunship)).toBe(true);
    expect(beats(K.Spitter, K.Ptero)).toBe(true);
    expect(beats(K.Spitter, K.Lancer)).toBe(true);
    expect(beats(K.Spitter, K.Runner)).toBe(true);
    expect(beats(K.Spitter, K.Trooper)).toBe(true);
    expect(beats(K.Tank, K.Spitter)).toBe(true);
    expect(beats(K.Horn, K.Spitter)).toBe(true);
    expect(beats(K.Raptor, K.Spitter)).toBe(true);
  });
  it('Horns beat Light and break a Turret; Lancers and flyers beat Horns', () => {
    expect(beats(K.Horn, K.Trooper)).toBe(true);
    expect(beats(K.Horn, K.Raptor)).toBe(true);
    expect(beats(K.Horn, K.Runner)).toBe(true);
    expect(alone(K.Horn, 1, K.Turret)[1]).toBe(0);
    expect(beats(K.Lancer, K.Horn)).toBe(true);
    expect(beats(K.Gunship, K.Horn)).toBe(true);
  });
  it('Pteros beat Gunships and slow shooters; Troopers, Spitters, Flak Tracks and Turrets beat Pteros', () => {
    expect(beats(K.Ptero, K.Gunship)).toBe(true);
    expect(beats(K.Ptero, K.Lancer)).toBe(true);
    expect(beats(K.Ptero, K.Mortar)).toBe(true);
    expect(beats(K.Trooper, K.Ptero)).toBe(true);
    expect(beats(K.Spitter, K.Ptero)).toBe(true);
    expect(beats(K.Flak, K.Ptero)).toBe(true);
    expect(alone(K.Ptero, 1, K.Turret)[0]).toBe(0);
  });
  it('Brontos beat massed Light and break a Turret; Lancers and flyers beat Brontos', () => {
    expect(beats(K.Bronto, K.Trooper)).toBe(true);
    expect(beats(K.Bronto, K.Spitter)).toBe(true);
    expect(alone(K.Bronto, 1, K.Turret)[1]).toBe(0);
    expect(beats(K.Lancer, K.Bronto)).toBe(true);
    expect(beats(K.Ptero, K.Bronto)).toBe(true);
  });
  it('a Rex beats everything Armoured, Juggernauts included; massed Lancers and flyers beat a Rex', () => {
    expect(beats(K.Rex, K.Tank, 2000)).toBe(true);
    expect(beats(K.Rex, K.Horn, 1500)).toBe(true);
    expect(beats(K.Rex, K.Bronto, 3500)).toBe(true);
    expect(duel(K.Rex, 4, K.Jugger, 4)).toBe(true);
    expect(beats(K.Lancer, K.Rex, 2000)).toBe(true);
    expect(beats(K.Gunship, K.Rex)).toBe(true);
  });
});

describe('fair to both sides', () => {
  it('a fight between two mirrored armies is a mirror to the last shot, whichever side was made first', () => {
    for (const first of [0, 1]) {
      const g = createGame(1);
      const W = g.map.w * TILE, H = g.map.h * TILE, cx = g.map.w / 2, cy = g.map.h / 2;
      const pairs: [ReturnType<typeof spawn>, ReturnType<typeof spawn>][] = [];
      const kinds: Kind[] = [K.Trooper, K.Trooper, K.Lancer, K.Tank, K.Runner, K.Trooper, K.Mortar, K.Trooper, K.Lancer, K.Tank, K.Jugger, K.Trooper];
      kinds.forEach((kind, i) => {
        const x = Math.round((cx - 10 + (i % 4) * 0.8) * TILE), y = Math.round((cy + 6 + Math.floor(i / 4) * 0.8) * TILE);
        const a = first === 0 ? spawn(g, kind, 0, x, y) : undefined;
        const b = spawn(g, kind, 1, W - x, H - y);
        const a2 = a ?? spawn(g, kind, 0, x, y);
        a2.group = 3;
        b.group = 3;
        pairs.push([a2, b]);
      });
      schedule(g, { t: 'order', p: 0, group: 3, mode: O.Attack, x: W - (cx - 8) * TILE, y: H - (cy + 7) * TILE });
      schedule(g, { t: 'order', p: 1, group: 3, mode: O.Attack, x: (cx - 8) * TILE, y: (cy + 7) * TILE });
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
    // in which neither side may ever be a single step or hit point ahead. `npx tsx lab/fair.ts` runs all twelve.
    for (const scheme of ['raider', 'air'] as const) {
      const r = firstBreak(scheme, 6000);
      expect(r.tick < 0 ? 'a mirror' : `${scheme} breaks at tick ${r.tick}: ${r.detail.join('; ')}`).toBe('a mirror');
    }
  });

  it('two different opponents play the same match whichever end of the map each starts at', () => {
    // A rush against a safe expansion into Tanks, and then the same two with their seats swapped: every unit
    // of the second match must stand, tick for tick, where the first match's stands turned half a circle.
    const r = seatSwap({ scheme: 'rush', dice: 1006 }, { scheme: 'armour', dice: 2006 }, 6, 7000);
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

  it('uses whole numbers only, with either faction on the field', () => {
    for (const sides of [['green', 'green'], ['dino', 'green'], ['dino', 'dino']] as const) {
      const g = createGame(5, undefined, sides);
      const bots = [new Bot(0, 5, { faction: sides[0], foe: sides[1] }), new Bot(1, 6, { faction: sides[1], foe: sides[0] })];
      for (let i = 0; i < 1500; i++) {
        for (const b of bots) for (const c of b.think(makeView(g, b.p))) schedule(g, c);
        step(g);
      }
      for (const e of g.ents) {
        expect(Number.isInteger(e.x) && Number.isInteger(e.y) && Number.isInteger(e.hp)).toBe(true);
        expect(Number.isInteger(e.frac) && Number.isInteger(e.amount) && Number.isInteger(e.eggs)).toBe(true);
      }
      for (const pl of g.players) expect(Number.isInteger(pl.blocks) && Number.isInteger(pl.gas) && Number.isInteger(pl.supply)).toBe(true);
    }
  });

  it('a match with dinosaurs on the field is identical on a re-run and on a replay from its command log', () => {
    const sides = ['dino', 'green'] as const;
    const a = playMatch(42, { plan: 'standard', tech: 'armour' }, { plan: 'standard', tech: 'armour' }, 4500, undefined, sides);
    const b = playMatch(42, { plan: 'standard', tech: 'armour' }, { plan: 'standard', tech: 'armour' }, 4500, undefined, sides);
    expect(a.hash).toBe(b.hash);
    expect(a.commands).toBe(b.commands);
    expect((a.made[0].Raptor ?? 0) + (a.made[0].Horn ?? 0)).toBeGreaterThan(20);
    // And once more from the orders alone.
    const g = createGame(9, undefined, sides);
    const bots = [new Bot(0, 9, { faction: 'dino', foe: 'green' }), new Bot(1, 10, { faction: 'green', foe: 'dino' })];
    for (let i = 0; i < 2500; i++) {
      for (const bot of bots) for (const c of bot.think(makeView(g, bot.p))) schedule(g, c);
      step(g);
    }
    const again = createGame(9, undefined, sides);
    const log = [...g.log];
    let k = 0;
    for (let i = 0; i < 2500; i++) {
      while (k < log.length && log[k]!.tick === again.tick + 1) again.pending.push({ tick: again.tick + 1, cmd: log[k++]!.cmd });
      step(again);
    }
    expect(hash(again)).toBe(hash(g));
  });
});

describe('content', () => {
  it('every unit has a place to be trained and sane numbers', () => {
    for (const d of Object.values(DEFS)) expect(d.hp).toBeGreaterThan(0);
    for (const f of [FACTIONS.green, FACTIONS.dino]) {
      for (const k of f.units) {
        const d = def(k);
        expect(d.building).toBe(false);
        expect(f.buildings).toContain(d.madeAt);
        expect(d.speed).toBeGreaterThan(0);
        expect(d.supply).toBeGreaterThan(0);
        expect(d.short.length).toBeLessThanOrEqual(8);
        for (const need of d.needs) expect(f.buildings).toContain(need);
        // Everything that fights can be hurt by something, in its own faction and in the other.
        for (const foe of [FACTIONS.green, FACTIONS.dino]) {
          expect(foe.units.some((o) => def(o).vs[d.cls]! > 0 && def(o).range > 0)).toBe(true);
        }
      }
      for (const k of f.buildings) {
        expect(def(k).building).toBe(true);
        expect(def(k).size).toBeGreaterThan(0);
        expect(def(k).short.length).toBeLessThanOrEqual(8);
        for (const need of def(k).needs) expect(f.buildings).toContain(need);
      }
      // Eight buildings fit a three-by-three panel; so do nine Green units and seven dinosaurs.
      expect(f.buildings.length).toBe(8);
      expect(f.units.length).toBeLessThanOrEqual(9);
    }
    expect(FACTIONS.green.units.length).toBe(9);
    expect(FACTIONS.dino.units.length).toBe(7);
    expect(RULES.groups).toBe(4);
  });
});
