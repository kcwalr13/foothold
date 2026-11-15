// Frenzy: four corners, bases that make their own units, a hero each, every side for itself.
// The tick itself is the one in step.ts; this file holds what only Frenzy has. Like everything in src/sim it
// is whole numbers only, and nothing here may depend on which side's turn it is in a loop.
import { ABILITIES, FRENZY, UNLOCK, WORK, abilityPower, def, frenzyUnits, isHall, levelNeeds, researchOf, respawnTicks, worth, FACTIONS, type Ability } from './data';
import { dist } from './nav';
import { countSupply, maxHp, placeHero, spawn, turned, type Game } from './state';
import { land, snapOpen, spawnUnit, type Hit } from './step';
import { K, O, TILE, type Command, type Entity, type Player } from './types';

/** A side's base: the one Headquarters or Nest it must keep. */
export function hallOf(g: Game, p: number): Entity | undefined {
  for (const e of g.ents) if (e.owner === p && isHall(e.kind) && e.hp > 0) return e;
  return undefined;
}

/** A side's hero, if it is standing. */
export function heroOf(g: Game, pl: Player): Entity | undefined {
  const h = pl.hero ? g.byId.get(pl.hero) : undefined;
  return h && h.hp > 0 ? h : undefined;
}

function refuse(g: Game, p: number, why: string): void {
  g.events.push({ t: 'refused', p, why });
}

function pay(g: Game, pl: Player, price: number): boolean {
  if (pl.blocks < price) {
    refuse(g, pl.id, 'Not enough Blocks');
    return false;
  }
  pl.blocks -= price;
  pl.stats.spent += price;
  return true;
}

// ---------------------------------------------------------------- what Blocks buy

/** Pays once for the right to field a unit, and puts it in the mix. */
export function frenzyUnlock(g: Game, c: Extract<Command, { t: 'unlock' }>): void {
  const pl = g.players[c.p];
  if (!pl || !frenzyUnits(pl.faction).includes(c.kind) || pl.unlocked.includes(c.kind)) return;
  const price = UNLOCK[c.kind];
  if (price === undefined || !pay(g, pl, price)) return;
  pl.unlocked.push(c.kind);
  pl.repeat.push(c.kind);
  const hall = hallOf(g, c.p);
  if (hall) g.events.push({ t: 'done', owner: c.p, kind: c.kind, x: hall.x, y: hall.y });
}

/** Puts an unlocked unit in the mix the base makes, or takes it out. The base must always make something. */
export function frenzyMix(g: Game, c: Extract<Command, { t: 'repeat' }>): void {
  const pl = g.players[c.p];
  if (!pl || !pl.unlocked.includes(c.kind)) return;
  const has = pl.repeat.includes(c.kind);
  if (c.on === true && !has) pl.repeat.push(c.kind);
  else if (c.on === false && has) {
    if (pl.repeat.length === 1) return refuse(g, c.p, 'The base must make something');
    pl.repeat = pl.repeat.filter((k) => k !== c.kind);
  }
}

/** Weapons, Armour and Muster are bought on the spot: there is no lab to study them in. */
export function frenzyResearch(g: Game, c: Extract<Command, { t: 'research' }>): void {
  const pl = g.players[c.p];
  if (!pl) return;
  const hall = hallOf(g, c.p);
  if (c.kind === K.Muster) {
    if (pl.muster >= FRENZY.musterCost.length) return refuse(g, c.p, 'Muster is at its top level');
    if (!pay(g, pl, FRENZY.musterCost[pl.muster]!)) return;
    pl.muster++;
  } else {
    if (!FACTIONS[pl.faction].research.includes(c.kind)) return;
    const which = researchOf(c.kind);
    if (pl[which] >= FRENZY.researchCost.length) return refuse(g, c.p, `${def(c.kind).name} is at its top level`);
    if (!pay(g, pl, FRENZY.researchCost[pl[which]]!)) return;
    pl[which]++;
  }
  if (hall) g.events.push({ t: 'done', owner: c.p, kind: c.kind, x: hall.x, y: hall.y });
}

// ---------------------------------------------------------------- abilities

/**
 * Can this ability be used as asked, as the map stands now? '' if it can; 'no' if the order makes no sense
 * and deserves no answer; otherwise what to tell the player.
 */
export function castOk(g: Game, c: Extract<Command, { t: 'cast' }>): string {
  const pl = g.players[c.p];
  if (!pl || pl.out || !Number.isInteger(c.slot)) return 'no';
  const h = heroOf(g, pl);
  if (!h) return pl.heroBack > 0 ? 'Your hero is down' : 'no';
  const a = ABILITIES[h.kind]?.[c.slot];
  if (!a) return 'no';
  if (h.lvl < a.level) return `${a.name} opens at level ${a.level}`;
  if (pl.cds[c.slot]! > g.tick) return `${a.name} is not ready yet`;
  if (h.daze > g.tick) return 'Stunned';
  if (a.range === 0) return '';
  if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) return 'no';
  if (c.x < 0 || c.y < 0 || c.x >= g.map.w * TILE || c.y >= g.map.h * TILE) return 'no';
  if (dist(h.x, h.y, c.x, c.y) > a.range) return 'Out of reach';
  if (a.kind === 'leap' && g.nav.blockedAt(c.x, c.y)) return "Can't land there";
  return '';
}

/**
 * Uses an ability that `castOk` has passed. What works at once (a Rally, a Roar) only marks units, so several
 * on one tick can be taken in any order; everything else is set down to happen on a later tick, all together.
 */
export function castNow(g: Game, c: Extract<Command, { t: 'cast' }>): void {
  const pl = g.players[c.p]!;
  const h = heroOf(g, pl)!;
  const a = ABILITIES[h.kind]![c.slot]!;
  pl.cds[c.slot] = g.tick + a.cd;
  const x = a.range > 0 ? c.x : h.x, y = a.range > 0 ? c.y : h.y;
  g.events.push({ t: 'cast', owner: c.p, hero: h.kind, slot: c.slot, x1: h.x, y1: h.y, x2: x, y2: y, r: a.radius, delay: a.delay });
  if (a.kind === 'haste') {
    for (const e of g.ents) {
      if (e.owner !== c.p || e.hp <= 0 || def(e.kind).building) continue;
      if (dist(h.x, h.y, e.x, e.y) <= a.radius) e.haste = Math.max(e.haste, g.tick + a.time);
    }
  } else if (a.kind === 'daze') {
    for (const e of g.ents) {
      if (e.owner === c.p || e.owner < 0 || e.hp <= 0) continue;
      const d = def(e.kind);
      if (d.building || dist(h.x, h.y, e.x, e.y) - d.radius > a.radius) continue;
      const time = d.hero ? Math.trunc((a.time * FRENZY.dazeHero) / 100) : a.time;
      e.daze = Math.max(e.daze, g.tick + time);
    }
  } else {
    g.casts.push({ tick: g.tick + a.delay, owner: c.p, hero: h.kind, slot: c.slot, x, y });
  }
}

/** Where the called-up stand around the hero, nearest first; turned for each side like every other layout. */
const RING: readonly { x: number; y: number }[] = [
  { x: 3, y: 0 }, { x: -3, y: 0 }, { x: 0, y: 3 }, { x: 0, y: -3 }, { x: 2, y: 2 }, { x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 },
  { x: 5, y: 1 }, { x: -5, y: -1 }, { x: -1, y: 5 }, { x: 1, y: -5 }, { x: 4, y: -3 }, { x: -4, y: 3 }, { x: 3, y: 4 }, { x: -3, y: -4 },
];

/** Abilities whose moment has come. Leaps land first, then whoever is called up arrives, then every blast goes off at once. */
function resolve(g: Game): void {
  if (g.casts.length === 0) return;
  const due = g.casts.filter((q) => q.tick <= g.tick);
  if (due.length === 0) return;
  g.casts = g.casts.filter((q) => q.tick > g.tick);
  const of = (q: (typeof due)[number]): Ability => ABILITIES[q.hero]![q.slot]!;
  const landed = new Set<(typeof due)[number]>();
  for (const q of due) {
    const pl = g.players[q.owner]!;
    const h = heroOf(g, pl);
    if (of(q).kind !== 'leap' || pl.out || !h) continue;
    h.x = q.x;
    h.y = q.y;
    h.dx = h.ax = q.x;
    h.dy = h.ay = q.y;
    h.arrived = true;
    h.mode = O.Idle;
    h.tgt = 0;
    h.losTick = -99;
    landed.add(q);
  }
  for (const q of due) {
    const a = of(q), pl = g.players[q.owner]!;
    const h = heroOf(g, pl);
    if (a.kind !== 'pack' || pl.out || !h || a.calls === undefined) continue;
    const n = abilityPower(a, pl.heroLvl), step = Math.trunc(a.radius / 3);
    for (let i = 0; i < n; i++) {
      const r = RING[i % RING.length]!, o = turned(g, q.owner, r.x * step, r.y * step);
      const at = snapOpen(g, h.x + o.x, h.y + o.y, h.x, h.y, q.owner) ?? { x: h.x, y: h.y };
      const u = spawn(g, a.calls, q.owner, at.x, at.y);
      // On loan: it runs with the hero, takes no supply, and goes home when its time is up.
      u.ttl = g.tick + a.time;
      u.group = FRENZY.heroGroup;
      u.ax = at.x;
      u.ay = at.y;
      u.fx = at.x - h.x;
      u.fy = at.y - h.y;
    }
    g.events.push({ t: 'blast', owner: q.owner, hero: q.hero, slot: q.slot, x: h.x, y: h.y, r: a.radius });
  }
  const hits: Hit[] = [];
  for (const q of due) {
    const a = of(q), pl = g.players[q.owner]!;
    if (pl.out || (a.kind !== 'blast' && !landed.has(q))) continue;
    const dmg = abilityPower(a, pl.heroLvl);
    for (const e of g.ents) {
      if (e.owner === q.owner || e.owner < 0 || e.hp <= 0) continue;
      const d = def(e.kind);
      if (d.air || dist(q.x, q.y, e.x, e.y) - d.radius > a.radius) continue;
      hits.push({ t: e, dmg: d.building ? Math.trunc((dmg * FRENZY.blastVsBuilding) / 100) : dmg, by: q.owner });
    }
    g.events.push({ t: 'blast', owner: q.owner, hero: q.hero, slot: q.slot, x: q.x, y: q.y, r: a.radius });
  }
  land(g, hits);
}

// ---------------------------------------------------------------- the tick

/** Who alone holds the Watchtower in the middle, or -1. */
export function middleHolder(g: Game): number {
  for (const e of g.ents) if (e.kind === K.Tower) return e.busy - 1;
  return -1;
}

/** Frenzy's share of a tick: abilities land, Blocks come in, bases turn out units, heroes come back and mend. */
export function frenzyTick(g: Game): void {
  if (g.tick === FRENZY.overtime) g.events.push({ t: 'overtime' });
  resolve(g);
  const second = g.tick % 10 === 0;
  const holder = second ? middleHolder(g) : -1;
  for (const pl of g.players) {
    if (pl.out) continue;
    const hall = hallOf(g, pl.id);
    if (!hall) continue;
    if (second) {
      const got = FRENZY.trickle + (holder === pl.id ? FRENZY.middle : 0);
      pl.blocks += got;
      pl.stats.gathered += got;
      // Overtime: every base but the middle-holder's crumbles. Nobody is paid for a base that falls this way.
      if (g.tick >= FRENZY.overtime && holder !== pl.id) hall.hp -= FRENZY.crumble;
    }
    // The base works toward the next unit of its mix. With no room for it, the work waits, finished, at the door.
    const kind = pl.repeat[pl.turn % Math.max(1, pl.repeat.length)];
    if (kind !== undefined) {
      const d = def(kind), price = WORK[kind]!;
      pl.bank += FRENZY.musterRate[pl.muster]!;
      if (pl.bank >= price) {
        if (countSupply(g, pl.id) + d.supply * d.brood <= FRENZY.supply) {
          pl.bank -= price;
          pl.turn++;
          for (let k = 0; k < d.brood; k++) spawnUnit(g, hall, kind);
        } else {
          pl.bank = price;
        }
      }
    }
    if (pl.heroBack > 0 && g.tick >= pl.heroBack) {
      const post = g.map.posts[pl.id]!.hero;
      const at = snapOpen(g, post.x, post.y, hall.x, hall.y, pl.id) ?? post;
      const h = placeHero(g, pl, at.x, at.y);
      g.events.push({ t: 'hero', owner: pl.id, up: true, x: h.x, y: h.y, back: 0 });
    }
    if (second) {
      const h = heroOf(g, pl);
      if (h && dist(h.x, h.y, hall.x, hall.y) <= FRENZY.healReach) {
        const full = maxHp(h);
        if (h.hp < full) h.hp = Math.min(full, h.hp + Math.max(1, Math.trunc((full * FRENZY.heal) / 100)));
      }
    }
  }
  for (const e of g.ents) if (e.ttl > 0 && g.tick >= e.ttl && e.hp > 0) e.hp = 0;
}

function learn(g: Game, pl: Player, h: Entity, xp: number): void {
  if (pl.heroLvl >= FRENZY.levelMax) return;
  pl.heroXp += xp;
  while (pl.heroLvl < FRENZY.levelMax && pl.heroXp >= levelNeeds(pl.heroLvl)) {
    pl.heroXp -= levelNeeds(pl.heroLvl);
    const before = maxHp(h);
    pl.heroLvl++;
    h.lvl = pl.heroLvl;
    h.hp += maxHp(h) - before;
    g.events.push({ t: 'level', owner: pl.id, level: pl.heroLvl, x: h.x, y: h.y });
  }
  if (pl.heroLvl >= FRENZY.levelMax) pl.heroXp = 0;
}

/**
 * What follows from this tick's deaths: Blocks for whoever brought each down, experience for every hero that
 * was near, a wait for a fallen hero, and the end of a side whose base fell. True if a side went out, in
 * which case its army has been knocked over too and wants clearing away.
 */
export function frenzyDeaths(g: Game, dead: readonly Entity[]): boolean {
  // Everything that fell is paid for and learnt from first, with every side that was in at the start of the
  // tick still in: two bases falling together must each pay, whichever the loop comes to first.
  const fallen: Entity[] = [];
  for (const e of dead) {
    if (e.owner < 0 || e.progress === -1 || e.ttl !== 0) continue;
    const d = def(e.kind), hall = isHall(e.kind);
    const victim = g.players[e.owner]!;
    const value = worth(e.kind);
    const bounty = d.hero ? FRENZY.heroBounty + FRENZY.heroBountyPer * e.lvl : hall ? FRENZY.hallBounty : Math.trunc((value * FRENZY.bounty) / 100);
    const xp = d.hero ? FRENZY.heroXp + FRENZY.heroXpPer * e.lvl : hall ? FRENZY.hallXp : Math.trunc((value * FRENZY.xp) / 100);
    const killer = e.by >= 0 && e.by !== e.owner ? g.players[e.by] : undefined;
    if (killer && !killer.out && bounty > 0) {
      killer.blocks += bounty;
      killer.stats.gathered += bounty;
      g.events.push({ t: 'bounty', owner: killer.id, amount: bounty, x: e.x, y: e.y });
    }
    for (const pl of g.players) {
      if (pl.id === e.owner || pl.out) continue;
      const h = heroOf(g, pl);
      if (h && dist(h.x, h.y, e.x, e.y) <= FRENZY.xpReach) learn(g, pl, h, xp);
    }
    if (d.hero) {
      victim.hero = 0;
      victim.heroBack = g.tick + respawnTicks(e.lvl);
      g.events.push({ t: 'hero', owner: e.owner, up: false, x: e.x, y: e.y, back: victim.heroBack });
    }
    if (hall && !victim.out) fallen.push(e);
  }
  for (const e of fallen) {
    const victim = g.players[e.owner]!;
    victim.out = true;
    victim.hero = 0;
    victim.heroBack = 0;
    g.events.push({ t: 'out', owner: e.owner, by: e.by >= 0 && e.by !== e.owner ? e.by : -1 });
    for (const o of g.ents) if (o.owner === e.owner && o.hp > 0) o.hp = 0;
  }
  return fallen.length > 0;
}
