import { describe, expect, it } from 'vitest';
import { quarterBreak } from '../../lab/quarter';
import { ABILITIES, FACTIONS, FRENZY, UNLOCK, WORK, abilityCd, abilityPower, def, frenzyUnits, frenzyUpgrades, heroDmg, heroHp, income, levelNeeds, respawnTicks, upgradeCosts, worth } from './data';
import { collectorsOf, heroOf, hallOf, middleHolder } from './frenzy';
import { fourCorners } from './map';
import { INF } from './nav';
import { createGame, hash, maxHp, schedule, spawn, visibleTo, type Game } from './state';
import { land, step } from './step';
import { makeView } from './view';
import { K, O, TILE, type Command, type Entity, type Faction, type Kind } from './types';

const GREEN: Faction[] = ['green', 'green', 'green', 'green'];
const DINO: Faction[] = ['dino', 'dino', 'dino', 'dino'];
const MIXED: Faction[] = ['green', 'dino', 'dino', 'green'];
const run = (g: Game, n: number) => { for (let i = 0; i < n; i++) step(g); };
const mine = (g: Game, p: number, kind: Kind) => g.ents.filter((e) => e.owner === p && e.kind === kind && e.hp > 0);
const hero = (g: Game, p: number) => heroOf(g, g.players[p]!)!;
/** A quiet patch of open ground, well away from every base and from the middle. */
const FIELD = { x: 31 * TILE + 128, y: 45 * TILE + 128 };
/** Puts a hero somewhere and tells it that is where it belongs. */
const stand = (h: Entity, x: number, y: number) => { h.x = h.ax = h.dx = x; h.y = h.ay = h.dy = y; };
const refusals = (g: Game) => g.events.filter((e) => e.t === 'refused').map((e) => (e.t === 'refused' ? e.why : ''));

describe('Frenzy: the map', () => {
  it('is the same turned a quarter circle, bases, Turrets, Collectors and heroes included', () => {
    const m = fourCorners();
    expect(m.w).toBe(m.h);
    expect(m.seats).toBe(4);
    const n = m.w;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      expect(m.rock[y * n + x]).toBe(m.rock[x * n + (n - 1 - y)]);
      expect(m.high[y * n + x]).toBe(m.high[x * n + (n - 1 - y)]);
    }
    const g = createGame(1, undefined, GREEN);
    expect(quarterBreak(g)).toEqual([]);
    // One Watchtower, on the middle tile, which a quarter turn leaves where it is.
    const towers = g.ents.filter((e) => e.kind === K.Tower);
    expect(towers.length).toBe(1);
    expect([towers[0]!.x, towers[0]!.y]).toEqual([(n * TILE) / 2, (n * TILE) / 2]);
  });

  it('lets every base walk to the middle and to every other base', () => {
    const g = createGame(1, undefined, GREEN);
    const m = g.map, mid = 30 * m.w + 30;
    const field = g.nav.field(77777, () => [mid]);
    for (const p of m.posts) {
      const i = Math.floor(p.hero.y / TILE) * m.w + Math.floor(p.hero.x / TILE);
      expect(field[i]).toBeLessThan(0xffff);
    }
  });

  it('stands each base on level ground inside walls, its Turrets in line either side of it and its Collectors behind', () => {
    const g = createGame(1, undefined, MIXED);
    const m = g.map, mid = (m.w * TILE) / 2;
    // No high ground anywhere: nothing to hide behind, nothing that outranges from above.
    expect(m.high.every((v) => v === 0)).toBe(true);
    // Walls: side 0's corner is closed along its top and its right side, with one gap toward the middle.
    const n = m.w, rockAt = (x: number, y: number) => m.rock[y * n + x] === 1;
    for (let x = 0; x <= 10; x++) expect(rockAt(x, 46)).toBe(true);
    for (let y = 52; y < n; y++) expect(rockAt(16, y)).toBe(true);
    for (let x = 11; x <= 16; x++) expect(rockAt(x, 46)).toBe(false);
    for (let y = 46; y <= 51; y++) expect(rockAt(16, y)).toBe(false);
    // Everything of a base's stands inside them, and a walker from the base reaches the middle through the gap.
    for (const e of g.ents) if (e.owner === 0) expect(e.x < 16 * TILE && e.y > 47 * TILE).toBe(true);
    const d = g.nav.field(-1, () => [31 * n + 31]);
    for (let k = 0; k < 4; k++) {
      // The hero's post, in front of each base: reachable, but only the long way, out through the gap.
      const post = m.posts[k]!.hero, tx = Math.trunc(post.x / TILE), ty = Math.trunc(post.y / TILE);
      expect(d[ty * n + tx]!).toBeLessThan(INF);
    }
    // From side 0's base, a step past its right-hand wall is a long walk round by the gap.
    const home = g.nav.field(-2, () => [52 * n + 11]);
    expect(home[56 * n + 17]! - home[56 * n + 15]!).toBeGreaterThan(40);
    const far = (e: Entity) => Math.hypot(e.x - mid, e.y - mid);
    for (const pl of g.players) {
      const hall = hallOf(g, pl.id)!;
      const turrets = mine(g, pl.id, FACTIONS[pl.faction].turret), collectors = mine(g, pl.id, K.Collector);
      expect(turrets.length).toBe(2);
      expect(collectors.length).toBe(2);
      // In line: each Turret is as far from the middle as the base is, to within a tile, and they stand on
      // opposite sides of the line from the base to the middle.
      for (const t of turrets) expect(Math.abs(far(t) - far(hall))).toBeLessThan(TILE);
      const side = (e: Entity) => Math.sign((e.x - hall.x) * (mid - hall.y) - (e.y - hall.y) * (mid - hall.x));
      expect(side(turrets[0]!) * side(turrets[1]!)).toBe(-1);
      // Behind: each Collector is further from the middle than the base, close by it, and inside both Turrets' reach.
      for (const c of collectors) {
        expect(far(c)).toBeGreaterThan(far(hall) + 3 * TILE);
        expect(Math.hypot(c.x - hall.x, c.y - hall.y)).toBeLessThan(8 * TILE);
        const guns = turrets.filter((t) => Math.hypot(c.x - t.x, c.y - t.y) - def(K.Collector).radius <= def(t.kind).range + FRENZY.turretReach);
        expect(guns.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('Frenzy: the base', () => {
  it('starts each side with a base, two Turrets, two Collectors, a hero and no Workers', () => {
    const g = createGame(1, undefined, MIXED);
    expect(g.mode).toBe('frenzy');
    for (const pl of g.players) {
      const f = FACTIONS[pl.faction];
      expect(mine(g, pl.id, f.hall).length).toBe(1);
      expect(mine(g, pl.id, f.turret).length).toBe(2);
      expect(mine(g, pl.id, K.Collector).length).toBe(2);
      expect(mine(g, pl.id, K.Collector).every((c) => c.hp === def(K.Collector).hp && maxHp(c) === def(K.Collector).hp)).toBe(true);
      expect(mine(g, pl.id, f.worker).length).toBe(0);
      const h = hero(g, pl.id);
      expect(h.kind).toBe(f.hero);
      expect([h.lvl, h.group, h.hp]).toEqual([1, FRENZY.heroGroup, def(f.hero).hp]);
      // A Frenzy base is far tougher than a Classic one.
      expect(hallOf(g, pl.id)!.hp).toBe(FRENZY.hallHp);
      expect(maxHp(hallOf(g, pl.id)!)).toBe(FRENZY.hallHp);
      expect(mine(g, pl.id, f.turret).every((t) => t.hp === FRENZY.turretHp && maxHp(t) === FRENZY.turretHp)).toBe(true);
      expect(pl.blocks).toBe(FRENZY.startBlocks);
      expect(pl.cap).toBe(FRENZY.supply);
      expect(pl.unlocked).toEqual(pl.repeat);
    }
    expect(g.ents.filter((e) => e.kind === K.Pile || e.kind === K.Cell).length).toBe(0);
  });

  it('makes its first fighter by itself: Bayonets one at a time, Raptors two at a time, and both fight hand to hand', () => {
    // The free unit of each faction is the one that has to close with its enemy.
    expect(frenzyUnits('green')[0]).toBe(K.Bayonet);
    expect(frenzyUnits('dino')[0]).toBe(K.Raptor);
    expect(def(K.Bayonet).melee && def(K.Raptor).melee).toBe(true);
    const g = createGame(1, undefined, MIXED);
    const each = WORK[K.Bayonet]! / FRENZY.musterRate[0]!, pair = WORK[K.Raptor]! / FRENZY.musterRate[0]!;
    run(g, each - 1);
    expect(mine(g, 0, K.Bayonet).length).toBe(0);
    run(g, 1);
    expect(mine(g, 0, K.Bayonet).length).toBe(1);
    expect(mine(g, 1, K.Raptor).length).toBe(2 * Math.floor(each / pair));
    run(g, each);
    expect(mine(g, 0, K.Bayonet).length).toBe(2);
    expect(mine(g, 1, K.Raptor).length).toBe(2 * Math.floor((2 * each) / pair));
    // New units join the group new units are set to join, and stand a few steps out from the base.
    expect(mine(g, 0, K.Bayonet).every((u) => u.group === g.players[0]!.rally)).toBe(true);
    // Classic knows nothing of the Bayonet: it is Frenzy's own.
    expect(FACTIONS.green.units.includes(K.Bayonet)).toBe(false);
    expect(mine(createGame(1), 0, K.Bayonet).length).toBe(0);
  });

  it('a Bayonet has to reach what it fights, and cannot touch a flyer; Troopers, who can, are unlocked with Blocks', () => {
    const g = createGame(1, undefined, GREEN);
    const b = spawn(g, K.Bayonet, 0, FIELD.x, FIELD.y), t = spawn(g, K.Trooper, 1, FIELD.x + 5 * TILE, FIELD.y);
    t.mode = O.Hold;
    t.cd = 99999;
    run(g, 8);
    // Seen, and charged at, but not yet hurt: nothing it carries reaches five tiles.
    expect(t.hp).toBe(def(K.Trooper).hp);
    expect(b.x).toBeGreaterThan(FIELD.x + TILE / 2);
    let ticks = 0;
    while (t.hp === def(K.Trooper).hp && ticks++ < 100) step(g);
    expect(t.hp).toBeLessThan(def(K.Trooper).hp);
    expect(Math.hypot(b.x - t.x, b.y - t.y)).toBeLessThanOrEqual(def(K.Bayonet).range + def(K.Trooper).radius + 2);
    // A Gunship right overhead is out of its reach for good.
    t.hp = 0;
    const ship = spawn(g, K.Gunship, 1, b.x + TILE / 2, b.y);
    ship.mode = O.Hold;
    ship.cd = 99999;
    run(g, 40);
    expect(ship.hp).toBe(def(K.Gunship).hp);
    expect(UNLOCK[K.Trooper]).toBeGreaterThan(0);
    expect(frenzyUnits('green')).toContain(K.Trooper);
  });

  it('stops at its supply, and the unit it was working on waits at the door', () => {
    const g = createGame(1, undefined, GREEN);
    run(g, (WORK[K.Bayonet]! / FRENZY.musterRate[0]!) * FRENZY.supply + 200);
    expect(g.players[0]!.supply).toBe(FRENZY.supply);
    expect(mine(g, 0, K.Bayonet).length).toBe(FRENZY.supply);
    const full = WORK[K.Bayonet]!;
    expect(g.players[0]!.bank).toBe(full);
    // Room for one: it comes out on the very next tick, and only one.
    mine(g, 0, K.Bayonet)[0]!.hp = 0;
    run(g, 2);
    expect(mine(g, 0, K.Bayonet).length).toBe(FRENZY.supply);
    expect(g.players[0]!.bank).toBeLessThan(full);
  });

  it('sends what it makes after the group it joins, even when that group has just lost its last unit', () => {
    const g = createGame(1, undefined, GREEN);
    run(g, 60);
    const at = { x: 20 * TILE + 128, y: 44 * TILE + 128 };
    schedule(g, { t: 'order', p: 0, group: 0, mode: O.Attack, x: at.x, y: at.y });
    run(g, 2);
    for (const e of mine(g, 0, K.Bayonet)) e.hp = 0;
    run(g, 2);
    expect(mine(g, 0, K.Bayonet).length).toBe(0);
    run(g, 260);
    const made = mine(g, 0, K.Bayonet).sort((a, b) => a.id - b.id);
    expect(made.length).toBeGreaterThanOrEqual(3);
    // The first ones out are there by now, and nobody was left standing at the door.
    for (const e of made.slice(0, 2)) expect(Math.hypot(e.x - at.x, e.y - at.y)).toBeLessThan(3 * TILE);
    const hall = hallOf(g, 0)!;
    for (const e of made.slice(0, -1)) expect(Math.hypot(e.x - hall.x, e.y - hall.y)).toBeGreaterThan(4 * TILE);
    // A group told to hold, or never sent anywhere, keeps its new units at home as before.
    const h = createGame(1, undefined, GREEN);
    run(h, 200);
    for (const e of mine(h, 1, K.Bayonet)) expect(Math.hypot(e.x - hallOf(h, 1)!.x, e.y - hallOf(h, 1)!.y)).toBeLessThan(9 * TILE);
  });

  it('is paid by its Collectors every second, and more for holding the middle alone', () => {
    const g = createGame(1, undefined, GREEN);
    run(g, 100);
    expect(g.players[0]!.blocks).toBe(FRENZY.startBlocks + 10 * income(2, 0));
    const mid = (g.map.w * TILE) / 2;
    const u = spawn(g, K.Trooper, 2, mid + TILE, mid + TILE);
    u.mode = O.Hold;
    run(g, 100);
    expect(middleHolder(g)).toBe(2);
    expect(g.players[2]!.blocks - g.players[0]!.blocks).toBeGreaterThanOrEqual(9 * FRENZY.middle);
    // Two sides at the tower: nobody holds it.
    const v = spawn(g, K.Trooper, 0, mid - TILE, mid - TILE);
    v.mode = O.Hold;
    u.hp = v.hp = 100000;
    run(g, 4);
    expect(middleHolder(g)).toBe(-1);
  });

  it('loses half its income with one Collector down and all of it with both, and Haul raises what each brings in', () => {
    const g = createGame(1, undefined, GREEN);
    const pl = g.players[0]!;
    const [a, b] = mine(g, 0, K.Collector) as [Entity, Entity];
    pl.blocks = 0;
    run(g, 100);
    expect(pl.blocks).toBe(10 * 2 * FRENZY.collect);
    a.hp = 0;
    run(g, 100);
    expect(collectorsOf(g, 0)).toBe(1);
    expect(pl.blocks).toBe(10 * 2 * FRENZY.collect + 10 * FRENZY.collect);
    // Haul: each Collector still standing brings in more. It costs what the table says and no more.
    pl.blocks = 1000;
    schedule(g, { t: 'research', p: 0, kind: K.Haul });
    run(g, 1);
    expect([pl.haul, pl.blocks]).toEqual([1, 1000 - FRENZY.haulCost[0]!]);
    run(g, 99);
    expect(pl.blocks).toBe(1000 - FRENZY.haulCost[0]! + 10 * (FRENZY.collect + FRENZY.haulPer));
    expect(income(2, 4)).toBe(2 * (FRENZY.collect + 4 * FRENZY.haulPer));
    // With none standing nothing comes in, and there is nowhere to buy an upgrade; units can still be unlocked.
    const before = pl.blocks;
    b.hp = 0;
    run(g, 100);
    expect(collectorsOf(g, 0)).toBe(0);
    expect(pl.blocks).toBe(before);
    schedule(g, { t: 'research', p: 0, kind: K.Weapons });
    run(g, 1);
    expect(refusals(g)).toEqual(['Upgrades are bought at a Collector, and yours are down']);
    expect([pl.weapons, pl.blocks]).toEqual([0, before]);
    schedule(g, { t: 'unlock', p: 0, kind: K.Lancer });
    run(g, 1);
    expect(pl.unlocked).toContain(K.Lancer);
    // What was bought before is kept.
    expect(pl.haul).toBe(1);
  });

  it('unlocks a unit once, for Blocks, and makes the mix in turn', () => {
    const g = createGame(1, undefined, GREEN);
    const pl = g.players[0]!;
    schedule(g, { t: 'unlock', p: 0, kind: K.Tank });
    run(g, 1);
    expect(pl.unlocked).toEqual([K.Bayonet]);
    expect(refusals(g)).toEqual(['Not enough Blocks']);
    schedule(g, { t: 'repeat', p: 0, kind: K.Tank, on: true });
    run(g, 1);
    expect(pl.repeat).toEqual([K.Bayonet]);
    pl.blocks = 1000;
    schedule(g, { t: 'unlock', p: 0, kind: K.Lancer });
    schedule(g, { t: 'unlock', p: 0, kind: K.Raptor });
    run(g, 1);
    expect(pl.blocks).toBe(1000 - UNLOCK[K.Lancer]!);
    expect(pl.unlocked).toEqual([K.Bayonet, K.Lancer]);
    expect(pl.repeat).toEqual([K.Bayonet, K.Lancer]);
    schedule(g, { t: 'unlock', p: 0, kind: K.Lancer });
    run(g, 1);
    expect(pl.blocks).toBe(1000 - UNLOCK[K.Lancer]!);
    run(g, 400);
    const t = mine(g, 0, K.Bayonet).length, l = mine(g, 0, K.Lancer).length;
    expect(l).toBeGreaterThanOrEqual(2);
    expect(Math.abs(t - l)).toBeLessThanOrEqual(2);
    // Out of the mix again; but the base must always make something.
    schedule(g, { t: 'repeat', p: 0, kind: K.Bayonet, on: false });
    run(g, 1);
    expect(pl.repeat).toEqual([K.Lancer]);
    schedule(g, { t: 'repeat', p: 0, kind: K.Lancer, on: false });
    run(g, 1);
    expect(pl.repeat).toEqual([K.Lancer]);
    expect(refusals(g)).toEqual(['The base must make something']);
  });

  it('buys Weapons, Armour and Muster on the spot, and Muster makes the base work faster', () => {
    const g = createGame(1, undefined, MIXED);
    const pl = g.players[0]!, dino = g.players[1]!;
    pl.blocks = dino.blocks = 5000;
    for (const kind of [K.Weapons, K.Armour, K.Muster, K.Muster, K.Muster, K.Weapons, K.Weapons, K.Weapons]) schedule(g, { t: 'research', p: 0, kind });
    schedule(g, { t: 'research', p: 1, kind: K.Claws });
    schedule(g, { t: 'research', p: 1, kind: K.Weapons });
    run(g, 1);
    // Four levels of Weapons and Armour in Frenzy, where Classic has two.
    expect([pl.weapons, pl.armour, pl.muster]).toEqual([4, 1, 3]);
    expect([dino.weapons, dino.armour]).toEqual([1, 0]);
    const spent = FRENZY.researchCost.reduce((a, b) => a + b, 0) + FRENZY.researchCost[0]! + FRENZY.musterCost.reduce((a, b) => a + b, 0);
    expect(pl.blocks).toBe(5000 - spent);
    for (const kind of [K.Muster, K.Weapons]) schedule(g, { t: 'research', p: 0, kind });
    run(g, 1);
    expect(refusals(g)).toEqual(['Muster is at its top level', 'Weapons is at its top level']);
    // Three times the work a tick at the top level: three times the Bayonets, give or take the one under way.
    const slow = createGame(1, undefined, GREEN);
    run(g, 499);
    run(slow, 500);
    const fast = mine(g, 0, K.Bayonet).length, plain = mine(slow, 0, K.Bayonet).length;
    const ratio = FRENZY.musterRate[3]! / FRENZY.musterRate[0]!;
    expect(ratio).toBeGreaterThanOrEqual(2);
    expect(Math.abs(fast - plain * ratio)).toBeLessThanOrEqual(1.5);
  });

  it('sells the same list to both factions: the army\'s, the base\'s and the hero\'s own, each with its levels and prices', () => {
    for (const f of ['green', 'dino'] as const) {
      const list = frenzyUpgrades(f);
      expect(list.slice(0, 2)).toEqual(FACTIONS[f].research);
      expect(list.slice(2)).toEqual([K.Muster, K.Haul, K.Might, K.Grit, K.Tempo]);
    }
    expect(upgradeCosts(K.Weapons)).toBe(FRENZY.researchCost);
    expect(upgradeCosts(K.Hide)).toBe(FRENZY.researchCost);
    expect(upgradeCosts(K.Muster)).toBe(FRENZY.musterCost);
    expect(upgradeCosts(K.Haul)).toBe(FRENZY.haulCost);
    for (const k of [K.Might, K.Grit, K.Tempo]) expect(upgradeCosts(k)).toBe(FRENZY.gearCost);
    // Every level of everything costs more than the one before: there is always something dearer to save for.
    for (const k of frenzyUpgrades('green')) {
      const costs = upgradeCosts(k);
      for (let i = 1; i < costs.length; i++) expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    }
    // Haul pays for itself within the round: its first level is back in under two minutes with both Collectors up.
    expect(FRENZY.haulCost[0]! / (2 * FRENZY.haulPer)).toBeLessThan(120);
  });

  it('the hero\'s own upgrades: Grit is health at once, Might is harder hits and abilities, Tempo is abilities sooner', () => {
    const g = createGame(1, undefined, MIXED);
    const pl = g.players[0]!, h = hero(g, 0), a = ABILITIES[K.Captain]![0]!;
    pl.blocks = 5000;
    stand(h, FIELD.x, FIELD.y);
    h.cd = 99999;
    h.hp -= 100;
    for (const kind of [K.Grit, K.Might, K.Tempo]) schedule(g, { t: 'research', p: 0, kind });
    run(g, 1);
    expect([pl.grit, pl.might, pl.tempo]).toEqual([1, 1, 1]);
    expect(pl.blocks).toBe(5000 - 3 * FRENZY.gearCost[0]!);
    // Grit: the standing hero is the better for it at once, wounds and all.
    expect(maxHp(h)).toBe(heroHp(K.Captain, 1, 1));
    expect(heroHp(K.Captain, 1, 1)).toBe(Math.trunc((def(K.Captain).hp * (100 + FRENZY.gritPer)) / 100));
    expect(h.hp).toBe(heroHp(K.Captain, 1, 1) - 100);
    // Might: each hit and each ability; not how many answer a call.
    expect(heroDmg(K.Captain, 1, 1)).toBe(Math.trunc((def(K.Captain).dmg * (100 + FRENZY.mightPer)) / 100));
    expect(abilityPower(a, 1, 1)).toBe(Math.trunc((a.power * (100 + FRENZY.mightPer)) / 100));
    const pack = ABILITIES[K.Alpha]![2]!;
    expect(abilityPower(pack, 6, 3)).toBe(abilityPower(pack, 6, 0));
    const tank = spawn(g, K.Tank, 1, FIELD.x + 4 * TILE, FIELD.y);
    tank.mode = O.Hold;
    tank.cd = 99999;
    schedule(g, { t: 'cast', p: 0, slot: 0, x: tank.x, y: tank.y });
    run(g, 1);
    // Tempo: the Grenade is ready again sooner than its listed wait.
    expect(abilityCd(a, 1)).toBe(Math.trunc((a.cd * (100 - FRENZY.tempoPer)) / 100));
    expect(pl.cds[0]).toBe(g.tick + abilityCd(a, 1));
    run(g, a.delay);
    expect(tank.hp).toBe(def(K.Tank).hp - abilityPower(a, 1, 1));
    // A hit from the hero's own rifle is the harder for Might, too.
    const before = tank.hp;
    h.cd = 0;
    h.tgt = tank.id;
    h.mode = O.Hold;
    let ticks = 0;
    while (tank.hp === before && ticks++ < 30) step(g);
    expect(before - tank.hp).toBe(Math.trunc((heroDmg(K.Captain, 1, 1) * def(K.Captain).vs[def(K.Tank).cls]!) / 100));
    // Three levels of each, and a hero that falls comes back with its Grit.
    for (let i = 0; i < 3; i++) for (const kind of [K.Grit, K.Might, K.Tempo]) schedule(g, { t: 'research', p: 0, kind });
    run(g, 1);
    expect([pl.grit, pl.might, pl.tempo]).toEqual([3, 3, 3]);
    expect(refusals(g)).toEqual(['Grit is at its top level', 'Might is at its top level', 'Tempo is at its top level']);
    expect(pl.stats.spent).toBe(3 * FRENZY.gearCost.reduce((x, y) => x + y, 0));
    h.hp = 0;
    run(g, 2);
    while (!heroOf(g, pl) && g.tick < 2000) step(g);
    const back = hero(g, 0);
    expect([back.grit, back.hp]).toEqual([3, heroHp(K.Captain, 1, 3)]);
    // The Dino Pack's Alpha is sold the same three.
    g.players[1]!.blocks = 1000;
    schedule(g, { t: 'research', p: 1, kind: K.Grit });
    run(g, 1);
    expect(maxHp(hero(g, 1))).toBe(heroHp(K.Alpha, 1, 1));
  });

  it('takes no orders to build, train or cancel, and none at all from a side that is out', () => {
    const g = createGame(1, undefined, GREEN);
    g.players[0]!.blocks = 5000;
    const before = g.ents.length;
    schedule(g, { t: 'build', p: 0, kind: K.Barracks, tx: 20, ty: 55 });
    schedule(g, { t: 'train', p: 0, kind: K.Trooper });
    schedule(g, { t: 'cancel', p: 0, id: hallOf(g, 0)!.id });
    run(g, 1);
    expect(g.ents.length).toBe(before);
    expect(g.players[0]!.blocks).toBe(5000);
    g.players[1]!.out = true;
    g.players[1]!.blocks = 5000;
    schedule(g, { t: 'research', p: 1, kind: K.Muster });
    run(g, 1);
    expect(g.players[1]!.muster).toBe(0);
  });
});

describe('Frenzy: the base holds, until overtime', () => {
  it('has Turrets that outreach a Lancer, so they cannot be picked off from safety', () => {
    const g = createGame(1, undefined, GREEN);
    const gun = mine(g, 1, K.Turret)[0]!;
    // Just beyond a Classic Turret's range and inside a Lancer's own: the Turret still answers.
    const gap = def(K.Turret).range + def(K.Turret).radius + TILE / 2;
    expect(gap).toBeLessThan(def(K.Lancer).range + def(K.Turret).radius);
    const lancer = spawn(g, K.Lancer, 0, gun.x + gap, gun.y);
    lancer.mode = O.Hold;
    lancer.cd = 9999;
    run(g, 12);
    expect(lancer.hp).toBeLessThan(def(K.Lancer).hp);
  });

  it('in overtime every base crumbles but the one whose side holds the middle alone, and nobody is paid for it', () => {
    const g = createGame(1, undefined, GREEN);
    const mid = (g.map.w * TILE) / 2;
    const u = spawn(g, K.Jugger, 2, mid + TILE, mid + TILE);
    u.mode = O.Hold;
    u.hp = 1e6;
    while (g.tick < FRENZY.overtime - 1) step(g);
    expect(g.events.some((e) => e.t === 'overtime')).toBe(false);
    expect(hallOf(g, 0)!.hp).toBe(FRENZY.hallHp);
    step(g);
    expect(g.events.some((e) => e.t === 'overtime')).toBe(true);
    run(g, 100);
    expect(hallOf(g, 0)!.hp).toBe(FRENZY.hallHp - 11 * FRENZY.crumble);
    expect(hallOf(g, 2)!.hp).toBe(FRENZY.hallHp);
    // Left alone, the three that crumble fall together and the holder wins, richer by no bounty at all.
    const before = g.players[2]!.blocks, t0 = g.tick;
    while (g.winner === -1 && g.tick < FRENZY.overtime + 4000) step(g);
    expect(g.winner).toBe(2);
    const seconds = Math.floor(g.tick / 10) - Math.floor(t0 / 10);
    expect(g.players[2]!.blocks - before).toBe(seconds * (income(2, 0) + FRENZY.middle));
    expect(g.players[2]!.stats.killedBuildings).toBe(0);
  });
});

describe('Frenzy: Collectors under attack', () => {
  it('to an attacker a Collector is a building like any other: a Turret that shoots back comes first', () => {
    const g = createGame(1, undefined, GREEN);
    const hall = hallOf(g, 0)!, c = mine(g, 0, K.Collector)[0]!;
    const at = { x: Math.round((hall.x * 3 + c.x * 2) / 5), y: Math.round((hall.y * 2 + c.y * 3) / 5) + TILE };
    hero(g, 0).hp = 0;
    run(g, 2);
    const lancer = spawn(g, K.Lancer, 1, at.x, at.y);
    lancer.hp = 100000;
    run(g, 6);
    expect(g.byId.get(lancer.tgt)?.kind).toBe(K.Turret);
    // And a base's Turret hits three times as hard as a Classic one.
    const shot = Math.trunc((Math.trunc((def(K.Turret).dmg * FRENZY.turretPower) / 100) * def(K.Turret).vs[def(K.Lancer).cls]!) / 100);
    expect(FRENZY.turretPower).toBeGreaterThan(100);
    expect((100000 - lancer.hp) % shot).toBe(0);
    expect(100000 - lancer.hp).toBeGreaterThanOrEqual(shot);
  });

  it('bringing one down pays a quarter of its worth, and its side is the poorer every second after', () => {
    const g = createGame(1, undefined, GREEN);
    const c = mine(g, 1, K.Collector)[0]!;
    c.hp = 5;
    const before = g.players[0]!.blocks;
    land(g, [{ t: c, dmg: 10, by: 0 }]);
    run(g, 1);
    const bounty = Math.trunc((worth(K.Collector) * FRENZY.bounty) / 100);
    expect(bounty).toBeGreaterThanOrEqual(100);
    expect(g.events.some((e) => e.t === 'bounty' && e.owner === 0 && e.amount === bounty)).toBe(true);
    expect(g.players[0]!.blocks).toBeGreaterThanOrEqual(before + bounty);
    expect(g.players[0]!.stats.killedBuildings).toBe(1);
    expect(collectorsOf(g, 1)).toBe(1);
    // The ground it stood on is open again.
    expect(g.nav.blockedAt(c.x, c.y)).toBe(false);
  });
});

describe('Frenzy: kills pay', () => {
  it('pays a bounty to the side that did the harm, and teaches every hero that was near', () => {
    const g = createGame(1, undefined, GREEN);
    // A Tank of side 1 out in the open, a Lancer of side 0 to shoot it, and two heroes: one near, one far.
    const tank = spawn(g, K.Tank, 1, FIELD.x, FIELD.y);
    tank.hp = 5;
    tank.mode = O.Hold;
    const lancer = spawn(g, K.Lancer, 0, FIELD.x - 4 * TILE, FIELD.y);
    lancer.mode = O.Hold;
    stand(hero(g, 2), FIELD.x + 5 * TILE, FIELD.y);
    hero(g, 2).mode = O.Hold;
    hero(g, 2).cd = 9999;
    const b0 = g.players[0]!.blocks, b2 = g.players[2]!.blocks;
    run(g, 9);
    expect(g.byId.has(tank.id)).toBe(false);
    const bounty = Math.trunc((worth(K.Tank) * FRENZY.bounty) / 100), xp = Math.trunc((worth(K.Tank) * FRENZY.xp) / 100);
    expect(g.players[0]!.blocks).toBe(b0 + bounty);
    expect(g.players[2]!.blocks).toBe(b2);
    expect(g.players[0]!.stats.killedUnits).toBe(1);
    expect(g.players[1]!.stats.lostUnits).toBe(1);
    // Side 2's hero stood within reach and learns from it; side 0's was at home and does not.
    expect(g.players[2]!.heroXp).toBe(xp);
    expect(g.players[0]!.heroXp).toBe(0);
    expect(g.players[1]!.heroXp).toBe(0);
  });

  it('credits whoever did the most harm on the tick, whatever order the shooters are looked at in', () => {
    for (const first of [0, 2]) {
      const g = createGame(1, undefined, GREEN);
      const victim = spawn(g, K.Tank, 1, FIELD.x, FIELD.y);
      victim.mode = O.Hold;
      victim.hp = 30;
      // One Lancer of one side, three Troopers of another: the Lancer does far more to a Tank.
      const make = (p: number) => {
        if (p === 0) spawn(g, K.Lancer, 0, FIELD.x - 4 * TILE, FIELD.y).mode = O.Hold;
        else for (let i = 0; i < 3; i++) spawn(g, K.Trooper, 2, FIELD.x + 3 * TILE, FIELD.y + (i - 1) * TILE).mode = O.Hold;
      };
      make(first);
      make(2 - first);
      const b0 = g.players[0]!.blocks, b2 = g.players[2]!.blocks;
      run(g, 12);
      expect(g.byId.has(victim.id)).toBe(false);
      expect(g.players[0]!.blocks - b0).toBeGreaterThan(g.players[2]!.blocks - b2);
    }
  });
});

describe('Frenzy: the hero', () => {
  it('is a group of its own: it goes where it is sent and nothing can join it', () => {
    const g = createGame(1, undefined, GREEN);
    run(g, 120);
    const h = hero(g, 0), from = { x: h.x, y: h.y };
    schedule(g, { t: 'order', p: 0, group: FRENZY.heroGroup, mode: O.Move, x: h.x + 4 * TILE, y: h.y - 4 * TILE });
    schedule(g, { t: 'assign', p: 0, from: 0, to: FRENZY.heroGroup, kind: 0, count: 0 });
    schedule(g, { t: 'assign', p: 0, from: FRENZY.heroGroup, to: 1, kind: 0, count: 0 });
    schedule(g, { t: 'rally', p: 0, group: FRENZY.heroGroup });
    run(g, 80);
    expect(h.x).toBeGreaterThan(from.x + 3 * TILE);
    expect(h.group).toBe(FRENZY.heroGroup);
    expect(mine(g, 0, K.Trooper).every((u) => u.group === 0)).toBe(true);
    expect(g.players[0]!.rally).toBe(0);
  });

  it('grows with experience: tougher and harder-hitting each level, up to level ten', () => {
    const g = createGame(1, undefined, MIXED);
    const pl = g.players[0]!, h = hero(g, 0);
    h.hp -= 100;
    // Enough falls beside it for exactly one level.
    const need = levelNeeds(1), each = Math.trunc((worth(K.Tank) * FRENZY.xp) / 100);
    stand(h, FIELD.x, FIELD.y);
    h.cd = 9999;
    for (let i = 0; i < Math.ceil(need / each); i++) {
      const t = spawn(g, K.Tank, 1, FIELD.x + 2 * TILE, FIELD.y);
      t.hp = 0;
      t.by = 2;
    }
    run(g, 1);
    expect(pl.heroLvl).toBe(2);
    expect(h.lvl).toBe(2);
    expect(pl.heroXp).toBe(Math.ceil(need / each) * each - need);
    expect(maxHp(h)).toBe(heroHp(K.Captain, 2));
    // What it had lost stays lost; the new level's extra health is added on top.
    expect(h.hp).toBe(heroHp(K.Captain, 2) - 100);
    expect(heroDmg(K.Captain, 2)).toBeGreaterThan(heroDmg(K.Captain, 1));
    expect(g.events.some((e) => e.t === 'level' && e.owner === 0 && e.level === 2)).toBe(true);
    // A great deal more, and it stops at ten.
    for (let i = 0; i < 400; i++) {
      const t = spawn(g, K.Jugger, 1, FIELD.x + 2 * TILE, FIELD.y);
      t.hp = 0;
    }
    run(g, 1);
    expect(pl.heroLvl).toBe(FRENZY.levelMax);
    expect(h.hp).toBe(heroHp(K.Captain, FRENZY.levelMax) - 100);
  });

  it('hits harder at a higher level', () => {
    const dealt = (level: number) => {
      const g = createGame(1, undefined, GREEN);
      const h = hero(g, 0);
      g.players[0]!.heroLvl = h.lvl = level;
      stand(h, FIELD.x, FIELD.y);
      h.mode = O.Hold;
      const t = spawn(g, K.HQ, 1, FIELD.x + 5 * TILE, FIELD.y);
      const hp0 = t.hp;
      run(g, 30);
      return hp0 - t.hp;
    };
    expect(dealt(1)).toBeGreaterThan(0);
    expect(dealt(5)).toBeGreaterThan(dealt(1));
  });

  it('falls, pays whoever felled it, and comes back at its base after a wait that grows with its level', () => {
    const g = createGame(1, undefined, GREEN);
    const pl = g.players[0]!, h = hero(g, 0);
    pl.heroLvl = h.lvl = 3;
    h.hp = 0;
    h.by = 1;
    const b1 = g.players[1]!.blocks;
    run(g, 1);
    expect(pl.hero).toBe(0);
    expect(pl.heroBack).toBe(g.tick + respawnTicks(3));
    expect(g.players[1]!.blocks).toBe(b1 + FRENZY.heroBounty + 3 * FRENZY.heroBountyPer);
    expect(g.events.some((e) => e.t === 'hero' && !e.up && e.owner === 0)).toBe(true);
    schedule(g, { t: 'cast', p: 0, slot: 0, x: FIELD.x, y: FIELD.y });
    run(g, 1);
    expect(refusals(g)).toEqual(['Your hero is down']);
    run(g, respawnTicks(3) - 2);
    expect(pl.hero).toBe(0);
    run(g, 1);
    const back = hero(g, 0);
    expect([back.lvl, back.hp, back.group]).toEqual([3, heroHp(K.Captain, 3), FRENZY.heroGroup]);
    expect(pl.heroBack).toBe(0);
    const post = g.map.posts[0]!.hero;
    // At its post (give or take a nudge from a unit standing beside it on the tick it arrives).
    expect(Math.abs(back.x - post.x) + Math.abs(back.y - post.y)).toBeLessThanOrEqual(TILE / 4);
    expect(respawnTicks(6)).toBeGreaterThan(respawnTicks(3));
  });

  it('mends beside its own base and nowhere else', () => {
    const g = createGame(1, undefined, GREEN);
    const home = hero(g, 0), away = hero(g, 1);
    home.hp = away.hp = 100;
    stand(away, FIELD.x, FIELD.y);
    run(g, 50);
    expect(home.hp).toBe(100 + 5 * Math.trunc((heroHp(K.Captain, 1) * FRENZY.heal) / 100));
    expect(away.hp).toBe(100);
  });
});

describe('Frenzy: abilities', () => {
  const cast = (g: Game, p: number, slot: number, x = 0, y = 0): Command => ({ t: 'cast', p, slot, x, y });
  const level = (g: Game, p: number, lvl: number) => { g.players[p]!.heroLvl = hero(g, p).lvl = lvl; hero(g, p).hp = maxHp(hero(g, p)); };

  it('Grenade: a blast where the Captain points, after a moment; buildings take half; then it must cool', () => {
    const g = createGame(1, undefined, GREEN);
    const h = hero(g, 0), a = ABILITIES[K.Captain]![0]!;
    stand(h, FIELD.x, FIELD.y);
    h.cd = 9999;
    const at = { x: FIELD.x + 5 * TILE, y: FIELD.y };
    const inside = spawn(g, K.Tank, 1, at.x + TILE, at.y), edge = spawn(g, K.Tank, 2, at.x, at.y - a.radius - def(K.Tank).radius);
    const outside = spawn(g, K.Tank, 1, at.x + a.radius + def(K.Tank).radius + 8, at.y), friend = spawn(g, K.Tank, 0, at.x, at.y + TILE);
    const flyer = spawn(g, K.Gunship, 1, at.x, at.y), wall = spawn(g, K.Turret, 3, at.x - TILE, at.y - TILE);
    for (const e of [inside, edge, outside, friend, flyer, wall]) { e.mode = O.Hold; e.cd = 9999; }
    schedule(g, cast(g, 0, 0, at.x, at.y));
    run(g, a.delay);
    expect(inside.hp).toBe(def(K.Tank).hp);
    expect(g.events.some((e) => e.t === 'cast' && e.owner === 0 && e.slot === 0)).toBe(false);
    run(g, 1);
    const dmg = abilityPower(a, 1);
    expect(inside.hp).toBe(def(K.Tank).hp - dmg);
    expect(edge.hp).toBe(def(K.Tank).hp - dmg);
    expect(outside.hp).toBe(def(K.Tank).hp);
    expect(friend.hp).toBe(def(K.Tank).hp);
    expect(flyer.hp).toBe(def(K.Gunship).hp);
    expect(wall.hp).toBe(def(K.Turret).hp - Math.trunc((dmg * FRENZY.blastVsBuilding) / 100));
    expect(g.events.some((e) => e.t === 'blast' && e.x === at.x && e.y === at.y)).toBe(true);
    schedule(g, cast(g, 0, 0, at.x, at.y));
    run(g, 1);
    expect(refusals(g)).toEqual(['Grenade is not ready yet']);
    run(g, a.cd - a.delay - 2);
    schedule(g, cast(g, 0, 0, at.x, at.y));
    run(g, a.delay + 1);
    expect(inside.hp).toBe(def(K.Tank).hp - 2 * dmg);
  });

  it('refuses what is out of reach, what the hero has yet to learn, and nonsense', () => {
    const g = createGame(1, undefined, MIXED);
    const h = hero(g, 0), a = ABILITIES[K.Captain]![0]!;
    schedule(g, cast(g, 0, 0, h.x + a.range + 40, h.y));
    schedule(g, cast(g, 0, 1));
    schedule(g, cast(g, 0, 2, h.x, h.y));
    schedule(g, cast(g, 0, 7));
    schedule(g, cast(g, 0, 0, 0.5, 3));
    schedule(g, cast(g, 0, 0, -5, h.y));
    schedule(g, cast(g, 9, 0, h.x, h.y));
    // The Alpha can't land on rock or on a building.
    const hall = hallOf(g, 1)!;
    stand(hero(g, 1), hall.x + 3 * TILE, hall.y + 3 * TILE);
    schedule(g, cast(g, 1, 0, hall.x, hall.y));
    run(g, 1);
    expect(refusals(g).sort()).toEqual(["Can't land there", 'Air strike opens at level 6', 'Out of reach', 'Rally opens at level 3'].sort());
    expect(g.casts.length).toBe(0);
    expect(g.players[0]!.cds).toEqual([0, 0, 0]);
  });

  it('Rally: the Captain\'s own units nearby move and fire faster for a while', () => {
    const g = createGame(1, undefined, GREEN);
    level(g, 0, 3);
    const h = hero(g, 0), a = ABILITIES[K.Captain]![1]!;
    stand(h, FIELD.x, FIELD.y);
    const near = spawn(g, K.Trooper, 0, FIELD.x + TILE, FIELD.y), far = spawn(g, K.Trooper, 0, FIELD.x, FIELD.y + a.radius + 60);
    const other = spawn(g, K.Trooper, 1, FIELD.x - TILE, FIELD.y + 9 * TILE);
    schedule(g, cast(g, 0, 1));
    run(g, 1);
    expect(near.haste).toBe(g.tick + a.time);
    expect(h.haste).toBe(g.tick + a.time);
    expect(far.haste).toBe(0);
    expect(other.haste).toBe(0);
    // A rallied Trooper covers more ground than one that is not, and fires more often.
    const walk = (u: Entity) => { const x0 = u.x; u.group = 1; return x0; };
    const a0 = walk(near), b0 = walk(far);
    far.x = near.x;
    far.y = near.y + 3 * TILE;
    schedule(g, { t: 'order', p: 0, group: 1, mode: O.Move, x: near.x + 12 * TILE, y: near.y + TILE });
    run(g, 30);
    expect(near.x - a0).toBeGreaterThan(far.x - Math.max(b0, a0) + 20);
    const shots = (rallied: boolean) => {
      const f = createGame(1, undefined, GREEN);
      const s = spawn(f, K.Trooper, 0, FIELD.x, FIELD.y);
      s.mode = O.Hold;
      if (rallied) s.haste = 9999;
      spawn(f, K.HQ, 1, FIELD.x + 5 * TILE, FIELD.y);
      let n = 0;
      for (let i = 0; i < 80; i++) { step(f); n += f.events.filter((e) => e.t === 'shot' && e.from === s.id).length; }
      return n;
    };
    expect(shots(true)).toBeGreaterThan(shots(false));
  });

  it('Air strike: a heavy blast over a wide area, later than a Grenade', () => {
    const g = createGame(1, undefined, GREEN);
    level(g, 0, 6);
    const h = hero(g, 0), a = ABILITIES[K.Captain]![2]!;
    stand(h, FIELD.x, FIELD.y);
    h.cd = 9999;
    const at = { x: FIELD.x + 8 * TILE, y: FIELD.y };
    const ts = [0, 1, 2].map((i) => spawn(g, K.Jugger, 1, at.x + (i - 1) * 2 * TILE, at.y));
    for (const t of ts) { t.mode = O.Hold; t.cd = 9999; }
    schedule(g, cast(g, 0, 2, at.x, at.y));
    run(g, a.delay);
    expect(ts.every((t) => t.hp === def(K.Jugger).hp)).toBe(true);
    run(g, 1);
    expect(ts.every((t) => t.hp === def(K.Jugger).hp - abilityPower(a, 6))).toBe(true);
    expect(abilityPower(a, 8)).toBeGreaterThan(abilityPower(a, 6));
  });

  it('Pounce: the Alpha leaps to where it is pointed and lands hard', () => {
    const g = createGame(1, undefined, DINO);
    const h = hero(g, 0), a = ABILITIES[K.Alpha]![0]!;
    stand(h, FIELD.x, FIELD.y);
    h.mode = O.Hold;
    const at = { x: FIELD.x + 5 * TILE, y: FIELD.y + 2 * TILE };
    const prey = spawn(g, K.Spitter, 1, at.x + TILE, at.y), safe = spawn(g, K.Spitter, 1, at.x + 4 * TILE, at.y);
    for (const e of [prey, safe]) { e.mode = O.Hold; e.cd = 9999; e.hp = 500; }
    schedule(g, cast(g, 0, 0, at.x, at.y));
    run(g, a.delay);
    expect([h.x, h.y]).toEqual([FIELD.x, FIELD.y]);
    run(g, 1);
    expect(Math.abs(h.x - at.x) + Math.abs(h.y - at.y)).toBeLessThan(TILE);
    expect(prey.hp).toBeLessThanOrEqual(500 - abilityPower(a, 1));
    expect(safe.hp).toBe(500);
    // A leap that never happens (the Alpha falls first) hurts nobody.
    run(g, a.cd);
    schedule(g, cast(g, 0, 0, at.x + 3 * TILE, at.y));
    run(g, 1);
    h.hp = 0;
    run(g, a.delay + 2);
    expect(safe.hp).toBe(500);
  });

  it('Roar: enemies nearby are stunned, heroes for half as long; the stunned neither move nor fight nor cast', () => {
    const g = createGame(1, undefined, MIXED);
    level(g, 1, 3);
    const h = hero(g, 1), a = ABILITIES[K.Alpha]![1]!;
    stand(h, FIELD.x, FIELD.y);
    h.mode = O.Hold;
    h.cd = 9999;
    const foe = spawn(g, K.Trooper, 0, FIELD.x + 3 * TILE, FIELD.y), far = spawn(g, K.Trooper, 0, FIELD.x, FIELD.y - a.radius - TILE);
    const friend = spawn(g, K.Raptor, 1, FIELD.x - TILE, FIELD.y), turret = spawn(g, K.Turret, 0, FIELD.x - 3 * TILE, FIELD.y + 3 * TILE);
    const cap = hero(g, 0);
    stand(cap, FIELD.x + 2 * TILE, FIELD.y + 2 * TILE);
    h.hp = cap.hp = 100000;
    schedule(g, cast(g, 1, 1));
    // The Captain's Grenade, thrown on the same tick as the Roar, still flies: both were judged as the tick began.
    schedule(g, cast(g, 0, 0, h.x, h.y));
    run(g, 1);
    expect(foe.daze).toBe(g.tick + a.time);
    expect(cap.daze).toBe(g.tick + Math.trunc((a.time * FRENZY.dazeHero) / 100));
    expect([far.daze, friend.daze, turret.daze, h.daze]).toEqual([0, 0, 0, 0]);
    expect(g.casts.length).toBe(1);
    const x0 = foe.x, hp0 = h.hp;
    schedule(g, { t: 'order', p: 0, group: -1, mode: O.Move, x: 0, y: 0 });
    foe.group = 1;
    schedule(g, { t: 'order', p: 0, group: 1, mode: O.Move, x: foe.x + 8 * TILE, y: foe.y });
    schedule(g, cast(g, 0, 0, h.x, h.y));
    run(g, 2);
    expect(refusals(g)).toEqual([]);
    schedule(g, cast(g, 0, 0, h.x, h.y));
    run(g, 1);
    expect(refusals(g)).toEqual(['Grenade is not ready yet']);
    run(g, 6);
    expect(foe.x).toBe(x0);
    // Only the Grenade and the Turret have touched the Alpha: nobody stunned fired.
    const shots = g.events.filter((e) => e.t === 'shot' && (e.from === foe.id || e.from === cap.id));
    expect(shots.length).toBe(0);
    expect(h.hp).toBeLessThan(hp0);
    run(g, a.time);
    expect(foe.x).toBeGreaterThan(x0);
  });

  it('Call the Pack: Raptors hatch around the Alpha, take no supply, run with it, and go home', () => {
    const g = createGame(1, undefined, DINO);
    level(g, 0, 6);
    const pl = g.players[0]!, h = hero(g, 0), a = ABILITIES[K.Alpha]![2]!;
    stand(h, FIELD.x, FIELD.y);
    const supply = pl.supply;
    schedule(g, cast(g, 0, 2));
    run(g, 1 + a.delay);
    const pack = g.ents.filter((e) => e.owner === 0 && e.ttl > 0);
    expect(pack.length).toBe(abilityPower(a, 6));
    expect(pack.every((u) => u.kind === K.Raptor && u.group === FRENZY.heroGroup)).toBe(true);
    expect(new Set(pack.map((u) => `${u.x},${u.y}`)).size).toBe(pack.length);
    expect(pl.supply).toBe(supply);
    schedule(g, { t: 'order', p: 0, group: FRENZY.heroGroup, mode: O.Move, x: FIELD.x + 6 * TILE, y: FIELD.y });
    run(g, 60);
    expect(pack.every((u) => u.x > FIELD.x + 3 * TILE)).toBe(true);
    // One that falls pays nothing and teaches nothing; the rest leave when their time is up.
    const b1 = g.players[1]!.blocks;
    pack[0]!.hp = 0;
    pack[0]!.by = 1;
    stand(hero(g, 1), h.x, h.y + 3 * TILE);
    hero(g, 1).mode = h.mode = O.Hold;
    hero(g, 1).cd = h.cd = 99999;
    run(g, 10);
    expect(g.players[1]!.blocks).toBe(b1 + income(2, 0));
    expect(g.players[1]!.heroXp).toBe(0);
    expect(g.players[0]!.stats.lostUnits).toBe(0);
    run(g, a.time);
    expect(g.ents.filter((e) => e.ttl > 0).length).toBe(0);
    expect(abilityPower(a, 10)).toBeGreaterThan(abilityPower(a, 6));
  });
});

describe('Frenzy: out means out', () => {
  it('a side whose base falls is out, its army and hero with it; whoever did it is paid; the last one standing wins', () => {
    const g = createGame(1, undefined, MIXED);
    run(g, 200);
    const fall = (p: number, by: number) => {
      const hall = hallOf(g, p)!;
      hall.hp = 0;
      hall.by = by;
      step(g);
    };
    const b0 = g.players[0]!.blocks;
    expect(g.ents.filter((e) => e.owner === 1).length).toBeGreaterThan(5);
    fall(1, 0);
    expect(g.players[1]!.out).toBe(true);
    expect(g.ents.filter((e) => e.owner === 1).length).toBe(0);
    expect(g.players[0]!.blocks).toBeGreaterThanOrEqual(b0 + FRENZY.hallBounty);
    expect(g.events.some((e) => e.t === 'out' && e.owner === 1 && e.by === 0)).toBe(true);
    // The army that went with it counts for nobody: no kills, no bounty beyond the base itself.
    expect(g.players[0]!.stats.killedUnits).toBe(0);
    expect(g.players[0]!.stats.killedBuildings).toBe(1);
    // Where its base and Turrets stood can be walked over again.
    const site = g.map.bases[1]!;
    expect(g.nav.isBlocked(site.hx + 1, site.hy + 1)).toBe(false);
    expect(g.winner).toBe(-1);
    run(g, 300);
    expect(g.ents.filter((e) => e.owner === 1).length).toBe(0);
    expect(g.players[1]!.heroBack).toBe(0);
    fall(2, 0);
    expect(g.winner).toBe(-1);
    fall(3, 0);
    expect(g.winner).toBe(0);
    const h = hash(g), t = g.tick;
    step(g);
    expect([hash(g), g.tick]).toEqual([h, t]);
  });

  it('should the last sides fall together, nobody wins', () => {
    const g = createGame(1, undefined, GREEN);
    for (const p of [0, 1, 2, 3]) hallOf(g, p)!.hp = 0;
    step(g);
    expect(g.winner).toBe(-2);
  });
});

// A script every side follows from its own corner: march on the middle, spend, and use every ability.
function scripted(g: Game, upTo: number, each?: (g: Game) => void): void {
  const S = g.map.w * TILE, mid = Math.trunc(S / 2);
  const turn = (p: number, x: number, y: number) => { for (let k = 0; k < g.turns[p]!; k++) [x, y] = [S - y, x]; return { x, y }; };
  while (g.tick < upTo && g.winner === -1) {
    const t = g.tick + 1;
    for (const pl of g.players) {
      if (pl.out) continue;
      const dino = pl.faction === 'dino';
      if (t === 250) schedule(g, { t: 'unlock', p: pl.id, kind: dino ? K.Spitter : K.Lancer });
      if (t === 700) schedule(g, { t: 'research', p: pl.id, kind: K.Muster });
      if (t === 900) schedule(g, { t: 'unlock', p: pl.id, kind: dino ? K.Horn : K.Tank });
      if (t === 1300) schedule(g, { t: 'research', p: pl.id, kind: dino ? K.Claws : K.Weapons });
      if (t === 1500) schedule(g, { t: 'unlock', p: pl.id, kind: dino ? K.Ptero : K.Gunship });
      if (t % 300 === 0) {
        // The middle for the first four and a half minutes; then the base of the neighbour on the left, seen
        // from each side's own corner.
        const to = t >= 2700 ? turn(pl.id, 8 * TILE, 14 * TILE) : { x: mid, y: mid };
        schedule(g, { t: 'order', p: pl.id, group: 0, mode: O.Attack, x: to.x, y: to.y });
        schedule(g, { t: 'order', p: pl.id, group: FRENZY.heroGroup, mode: O.Attack, x: to.x, y: to.y });
      }
      const h = heroOf(g, pl);
      if (h && t % 110 === 0) {
        const dx = Math.sign(mid - h.x) * 3 * TILE, dy = Math.sign(mid - h.y) * 3 * TILE;
        for (const slot of [0, 1, 2]) schedule(g, { t: 'cast', p: pl.id, slot, x: h.x + dx, y: h.y + dy });
      }
    }
    step(g);
    each?.(g);
  }
}

describe('Frenzy: fair to every corner', () => {
  for (const [name, factions] of [['Green Armies', GREEN], ['Dino Packs', DINO]] as const) {
    it(`four ${name} given the same orders fight a match that is the same seen from every corner`, () => {
      const g = createGame(3, undefined, factions);
      let broke: string[] = [];
      scripted(g, 4200, (m) => { if (broke.length === 0) broke = quarterBreak(m).map((s) => `tick ${m.tick}: ${s}`); });
      expect(broke.slice(0, 4)).toEqual([]);
      // And it was a real fight: heroes levelled and armies died.
      expect(g.players[0]!.heroLvl).toBeGreaterThanOrEqual(2);
      expect(g.players[0]!.stats.killedUnits).toBeGreaterThan(25);
    }, 60_000);
  }

  it('with two factions at the table, each pair of opposite corners still mirrors the other', () => {
    const g = createGame(3, undefined, ['green', 'dino', 'green', 'dino']);
    const S = g.map.w * TILE;
    scripted(g, 2400, (m) => {
      for (const [a, b] of [[0, 2], [1, 3]] as const) {
        const sig = (p: number, flip: boolean) => m.ents.filter((e) => e.owner === p).map((e) => `${e.kind}:${flip ? S - e.x : e.x}:${flip ? S - e.y : e.y}:${e.hp}`).sort().join(' ');
        if (sig(a, false) !== sig(b, true)) throw new Error(`sides ${a} and ${b} differ at tick ${m.tick}`);
      }
    });
    expect(g.players[0]!.blocks).toBe(g.players[2]!.blocks);
    expect(g.players[1]!.heroLvl).toBe(g.players[3]!.heroLvl);
  }, 60_000);
});

describe('Frenzy: fog of war and determinism', () => {
  it('each side is shown only what its own units can see, with four at the table', () => {
    const g = createGame(2, undefined, MIXED);
    scripted(g, 900);
    for (const pl of g.players) {
      const v = makeView(g, pl.id);
      expect(v.mode).toBe('frenzy');
      expect(v.own.every((e) => e.owner === pl.id)).toBe(true);
      expect(v.enemies.every((e) => e.owner !== pl.id && e.owner >= 0 && visibleTo(g, pl.id, e))).toBe(true);
      const hidden = g.ents.filter((e) => e.owner >= 0 && e.owner !== pl.id && !visibleTo(g, pl.id, e));
      expect(hidden.length).toBeGreaterThan(0);
      for (const e of hidden) expect(v.enemies.includes(e)).toBe(false);
      expect(v.sides.map((s) => s.faction)).toEqual(MIXED);
      expect(v.unlocked).toEqual(pl.unlocked);
    }
    // At the start nobody can see the middle, so nobody is told who holds it.
    expect(makeView(createGame(2, undefined, MIXED), 0).middle).toBe(-2);
  });

  it('the same seed and orders give the identical match, and it replays exactly from its log', () => {
    const a = createGame(7, undefined, MIXED), b = createGame(7, undefined, MIXED);
    const trail: number[] = [];
    scripted(a, 2500, (m) => { if (m.tick % 250 === 0) trail.push(hash(m)); });
    const again: number[] = [];
    scripted(b, 2500, (m) => { if (m.tick % 250 === 0) again.push(hash(m)); });
    expect(again).toEqual(trail);
    const replay = createGame(7, undefined, MIXED), log = a.log;
    const seen: number[] = [];
    let k = 0;
    while (replay.tick < a.tick) {
      while (k < log.length && log[k]!.tick === replay.tick + 1) replay.pending.push({ tick: replay.tick + 1, cmd: log[k++]!.cmd });
      step(replay);
      if (replay.tick % 250 === 0) seen.push(hash(replay));
    }
    expect(seen).toEqual(trail);
    expect(hash(replay)).toBe(hash(a));
    expect(new Set(trail).size).toBe(trail.length);
  }, 60_000);

  it('uses whole numbers only', () => {
    const g = createGame(4, undefined, MIXED);
    scripted(g, 1500, (m) => {
      if (m.tick % 50 !== 0) return;
      for (const e of m.ents) for (const v of [e.x, e.y, e.hp, e.cd, e.frac, e.daze, e.haste, e.ttl, e.lvl]) if (!Number.isInteger(v)) throw new Error(`a fraction on ${def(e.kind).name}: ${v}`);
      for (const p of m.players) for (const v of [p.blocks, p.bank, p.heroXp, p.heroBack, p.supply]) if (!Number.isInteger(v)) throw new Error(`a fraction on side ${p.id}: ${v}`);
    });
    expect(g.tick).toBe(1500);
  });
});
