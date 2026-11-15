// The computer opponent for Frenzy. Like the Classic one it reads the match only through a View and acts
// only through the commands a player gives: it spends its own Blocks, steers its own hero, and sees only
// what its own units see.
//
// Everything it works out is the same seen from every corner: points are rounded away from the middle of
// the map, and where two choices are level the one that comes first going round the table from its own
// seat wins. Four copies with the same dice therefore play a match that is the same turned a quarter circle.
import { ABILITIES, FACTIONS, FRENZY, UNLOCK, def, frenzyUnits, heroHp, isHall, upgradeCosts, worth, type Levels } from '../sim/data';
import { power, type View } from '../sim/view';
import { C, K, O, TILE, type Command, type Entity, type Faction, type Kind } from '../sim/types';

/** What it spends on first: numbers and upgrades, the heaviest units, or flyers. */
export type Bent = 'swarm' | 'heavy' | 'air';
export const BENTS: Bent[] = ['swarm', 'heavy', 'air'];

export interface FrenzyBotOptions {
  /** 0 Easy, 1 Normal. */
  level?: number;
  bent?: Bent;
  /** For the lab's fairness check: a seed for this bot's dice, so that every side can be made to roll the same. */
  dice?: number;
  /** For the lab: a mix it never changes and never adds to. */
  only?: Kind;
}

interface Pt { x: number; y: number }
type Buy = { unlock: Kind } | { research: keyof Levels };

// The army in the field, and the reserve: whatever the base turns out while the army is away gathers at home
// and goes out together, not one at a time into whatever is waiting.
const ARMY = 0, RESERVE = 1, HERO = FRENZY.heroGroup;
const u = (kind: Kind): Buy => ({ unlock: kind });
const W: Buy = { research: 'weapons' }, A: Buy = { research: 'armour' }, M: Buy = { research: 'muster' };
// Haul, and the hero's own: Might, Grit, Tempo.
const H: Buy = { research: 'haul' }, MI: Buy = { research: 'might' }, GR: Buy = { research: 'grit' }, TE: Buy = { research: 'tempo' };

/**
 * What each bent buys, in order. Anything it can't yet afford it saves for. Haul comes early in every list:
 * it pays for the rest. The hero's own upgrades come once the army has its teeth.
 */
const SHOPPING: Record<Faction, Record<Bent, Buy[]>> = {
  green: {
    swarm: [u(K.Lancer), H, M, W, u(K.Trooper), M, A, H, u(K.Tank), M, W, A, GR, u(K.Flak), H, u(K.Jugger), MI, u(K.Mortar), u(K.Gunship), u(K.Runner)],
    heavy: [u(K.Lancer), H, u(K.Tank), M, W, A, H, u(K.Jugger), M, W, GR, u(K.Trooper), u(K.Flak), A, M, H, MI, u(K.Mortar), u(K.Gunship), u(K.Runner)],
    air: [u(K.Lancer), H, M, u(K.Gunship), W, u(K.Tank), A, H, M, W, GR, u(K.Trooper), u(K.Flak), A, u(K.Jugger), M, H, MI, u(K.Mortar), u(K.Runner)],
  },
  dino: {
    swarm: [u(K.Spitter), H, M, W, M, A, H, u(K.Horn), M, W, A, GR, H, u(K.Rex), MI, u(K.Bronto), u(K.Ptero)],
    heavy: [u(K.Spitter), H, u(K.Horn), M, W, A, H, u(K.Rex), M, W, GR, u(K.Bronto), A, M, H, MI, u(K.Ptero)],
    air: [u(K.Spitter), H, M, u(K.Ptero), W, u(K.Horn), A, H, M, W, GR, A, u(K.Rex), M, H, MI, u(K.Bronto)],
  },
};
/** Once the list is done: Weapons and Armour to the top turn about, the last of Haul, then the hero's own. */
const AFTER: Buy[] = [W, A, W, A, W, A, W, A, H, H, H, H, TE, MI, GR, TE, MI, GR, TE, MI, GR];

const d2 = (a: Pt, b: Pt) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const within = (a: Pt, b: Pt, tiles: number) => d2(a, b) <= tiles * TILE * tiles * TILE;
/** Rounds away from the middle of the map, so a point worked out in one corner is the turn of the same point worked out in another. */
const away = (a: number, c: number) => (a >= c ? c + Math.floor(a - c + 0.5) : c - Math.floor(c - a + 0.5));

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a hero is worth in a fight, on the same scale as `power`. */
const heroPower = (h: Entity): number => Math.round(((260 + 70 * h.lvl) * h.hp) / heroHp(h.kind, h.lvl));
const might = (e: Entity): number => (def(e.kind).hero ? heroPower(e) : power(e));

/** How far an Easy opponent takes its upgrades: the rest of its Blocks pile up unspent. */
const EASY: Levels = { muster: 1, weapons: 2, armour: 2, haul: 1, might: 1, grit: 1, tempo: 0 };

export class FrenzyBot {
  readonly level: number;
  readonly bent: Bent;
  private rnd: () => number;
  private phase: number;
  private state: 'muster' | 'middle' | 'siege' | 'defend' | 'fallback' = 'muster';
  /** The supply it set out with, and whether new units are gathering at home as a reserve. */
  private wave = 0;
  private reserve = false;
  private since = 0;
  private target: Pt | null = null;
  /** The side it is attacking, or -1. */
  private prey = -1;
  private lastOrder = -999;
  private heroHome = false;
  private heroOrder = -999;
  /** When it first means to leave home, and when it will next think about whom to attack. */
  private marchAt: number;
  private nextPick = 0;
  /** A little luck in each choice of whom to attack, redrawn each time. */
  private whim: number[] = [0, 0, 0, 0];
  /** What it last saw of each side's army, and when; and of each side's base, as a share of its health. */
  private armySeen = [0, 0, 0, 0];
  private armyAt = [-9999, -9999, -9999, -9999];
  private hallSeen = [100, 100, 100, 100];
  /** How much of each class it has seen lately among enemies: Light, Armoured, Air. Fades. */
  private classes = [0, 0, 0];
  private only: Kind | undefined;
  /** Where its army is, and how many are in it. */
  private troopsAt: Pt = { x: 0, y: 0 };
  private troops = 0;
  /** For the lab. */
  firstMarch = -1;

  constructor(readonly p: number, seed: number, opts: FrenzyBotOptions = {}) {
    this.rnd = rng(opts.dice ?? seed * 7919 + p * 104729 + 31);
    this.level = opts.level ?? 1;
    this.bent = opts.bent ?? BENTS[Math.floor(this.rnd() * BENTS.length)]!;
    this.phase = Math.floor(this.rnd() * 5);
    // No two rounds open quite alike. Easy gives a newcomer a couple of minutes to find the buttons.
    this.marchAt = Math.round((this.level === 0 ? 1100 : 450) * (0.85 + this.rnd() * 0.4));
    this.only = opts.only;
  }

  // ---------------------------------------------------------------- where things are

  private hall(v: View): Entity | undefined {
    return v.own.find((e) => isHall(e.kind));
  }

  private middle(v: View): Pt {
    return { x: (v.map.w * TILE) / 2, y: (v.map.h * TILE) / 2 };
  }

  /** A side's base, which everyone knows from the map. */
  private baseOf(v: View, side: number): Pt {
    const b = v.map.bases.find((s) => s.side === side)!;
    return { x: (b.hx + 2) * TILE, y: (b.hy + 2) * TILE };
  }

  /** A point a share of the way from one point to another. */
  private toward(v: View, a: Pt, b: Pt, share: number): Pt {
    const m = this.middle(v);
    return { x: away(a.x + (b.x - a.x) * share, m.x), y: away(a.y + (b.y - a.y) * share, m.y) };
  }

  /** Where the army waits: a little way out from its own base, toward the middle. */
  private staging(v: View): Pt {
    return this.toward(v, this.baseOf(v, this.p), this.middle(v), 0.2);
  }

  /** How far round the table a side sits from this one: 1 the next corner, 2 the far one, 3 the last. */
  private round(v: View, side: number): number {
    const n = v.sides.length;
    return (side - this.p + n) % n;
  }

  private centre(v: View, units: readonly Entity[]): Pt {
    const m = this.middle(v);
    let x = 0, y = 0;
    for (const e of units) {
      x += e.x;
      y += e.y;
    }
    const n = Math.max(1, units.length);
    return { x: away(x / n, m.x), y: away(y / n, m.y) };
  }

  // ---------------------------------------------------------------- what it knows

  private look(v: View): void {
    const seen = [0, 0, 0, 0];
    for (const e of v.enemies) {
      const d = def(e.kind);
      if (isHall(e.kind)) this.hallSeen[e.owner] = Math.round((e.hp * 100) / FRENZY.hallHp);
      if (d.building) continue;
      seen[e.owner]! += might(e);
      if (!d.hero) this.classes[d.cls === C.Air ? 2 : d.cls === C.Armoured ? 1 : 0]! += worth(e.kind) / 50;
    }
    for (let s = 0; s < seen.length; s++) {
      // A bigger army seen is remembered at once; a smaller one only once the old sighting has gone stale.
      if (seen[s]! >= this.armySeen[s]! || v.tick - this.armyAt[s]! > 300) {
        if (seen[s]! > 0 || v.tick - this.armyAt[s]! > 300) {
          this.armySeen[s] = seen[s]! > 0 ? seen[s]! : Math.round(this.armySeen[s]! * 0.8);
          if (seen[s]! > 0) this.armyAt[s] = v.tick;
        }
      }
    }
    for (let c = 0; c < 3; c++) this.classes[c] = this.classes[c]! * 0.97;
  }

  // ---------------------------------------------------------------- spending

  private spend(v: View, out: Command[]): void {
    if (this.only !== undefined) {
      if (!v.unlocked.includes(this.only) && v.blocks >= (UNLOCK[this.only] ?? 0)) out.push({ t: 'unlock', p: this.p, kind: this.only });
      else if (v.unlocked.includes(this.only)) for (const k of v.repeat) if (k !== this.only) out.push({ t: 'repeat', p: this.p, kind: k, on: false });
      return;
    }
    const f = FACTIONS[v.faction];
    let list = SHOPPING[v.faction][this.bent];
    // Flyers overhead and nothing bought that shoots up well: that comes first.
    const antiAir = v.faction === 'green' ? K.Flak : K.Spitter;
    if (this.level >= 1 && this.classes[2]! > 6 && !v.unlocked.includes(antiAir)) list = [u(antiAir), ...list];
    list = [...list, ...AFTER];
    // Upgrades are bought at a Collector. With none standing, only units can still be unlocked.
    const shop = v.own.some((e) => e.kind === K.Collector);
    const kindOf = (key: keyof Levels): Kind => (key === 'weapons' ? f.research[0]! : key === 'armour' ? f.research[1]!
      : key === 'muster' ? K.Muster : key === 'haul' ? K.Haul : key === 'might' ? K.Might : key === 'grit' ? K.Grit : K.Tempo);
    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      if ('unlock' in b) {
        if (v.unlocked.includes(b.unlock)) continue;
        if (v.blocks >= UNLOCK[b.unlock]!) out.push({ t: 'unlock', p: this.p, kind: b.unlock });
        break;
      }
      if (!shop) continue;
      // Each mention in the list is one level: the third Muster in it asks for Muster three.
      const asked = list.slice(0, i + 1).filter((x) => x === b).length;
      const kind = kindOf(b.research), costs = upgradeCosts(kind), level = v[b.research];
      // Easy stops early.
      if (level >= asked || level >= costs.length || (this.level === 0 && level >= EASY[b.research])) continue;
      if (v.blocks >= costs[level]!) out.push({ t: 'research', p: this.p, kind });
      break;
    }
    this.mix(v, out);
  }

  /** The mix it wants from what it has unlocked, given what it has seen of the others. */
  private wanted(v: View): Kind[] {
    const has = (k: Kind) => v.unlocked.includes(k);
    const [light, armoured, air] = this.classes as [number, number, number];
    const pick: Kind[] = [];
    const add = (k: Kind) => { if (has(k) && !pick.includes(k)) pick.push(k); };
    const heed = this.level >= 1;
    if (v.faction === 'green') {
      // The heaviest thing it has, something for armour, and something that shoots up if anything flies.
      if (this.bent === 'air') add(K.Gunship);
      add(K.Jugger);
      if (!pick.includes(K.Jugger)) add(K.Tank);
      if (heed && light > armoured * 2) add(K.Mortar);
      if (!heed || armoured * 2 >= light || pick.length === 0) add(K.Lancer);
      if (heed && air > 4) {
        add(K.Flak);
        add(K.Trooper);
      }
      if (this.bent === 'swarm' || (heed && light > armoured * 2)) add(K.Trooper);
      // Bayonets in front of whatever shoots, until something heavier can stand there.
      if (pick.length < 2 || this.bent === 'swarm' || !(pick.includes(K.Jugger) || pick.includes(K.Tank))) add(K.Bayonet);
    } else {
      if (this.bent === 'air') add(K.Ptero);
      add(K.Rex);
      if (!pick.includes(K.Rex)) add(K.Horn);
      if (heed && light > armoured * 2) add(K.Bronto);
      add(K.Spitter);
      if (heed && air > 4) add(K.Ptero);
      if (pick.length < 2 || this.bent === 'swarm' || (heed && armoured < light)) add(K.Raptor);
    }
    if (pick.length === 0) pick.push(frenzyUnits(v.faction)[0]!);
    return pick;
  }

  private mix(v: View, out: Command[]): void {
    const want = this.wanted(v);
    // In first, out second: the base must never be left with nothing to make.
    for (const k of want) if (!v.repeat.includes(k)) out.push({ t: 'repeat', p: this.p, kind: k, on: true });
    for (const k of v.repeat) if (!want.includes(k)) out.push({ t: 'repeat', p: this.p, kind: k, on: false });
  }

  // ---------------------------------------------------------------- the army

  private send(v: View, out: Command[], to: Pt, mode: typeof O.Attack | typeof O.Move = O.Attack, force = false): void {
    const same = this.target !== null && d2(this.target, to) < (TILE * 2) * (TILE * 2);
    if (same && !force && v.tick - this.lastOrder < 50) return;
    this.target = to;
    this.lastOrder = v.tick;
    out.push({ t: 'order', p: this.p, group: ARMY, mode, x: to.x, y: to.y });
  }

  private go(v: View, state: FrenzyBot['state']): void {
    if (state !== this.state) {
      this.state = state;
      this.since = v.tick;
      this.lastOrder = -999;
    }
  }

  /** Whom to go for: the side that looks weakest from here, with a little luck thrown in. */
  private choose(v: View): { side: number; need: number } | null {
    let best = -1, bestScore = -Infinity, bestRound = 9, need = 0;
    for (const s of v.sides) {
      if (s.id === this.p || s.out) continue;
      const r = this.round(v, s.id);
      const turrets = v.ghosts.filter((gh) => gh.owner === s.id && def(gh.kind).range > 0).length;
      const stale = Math.min(1, Math.max(0, (v.tick - this.armyAt[s.id]!) / 1200));
      // What it expects to meet there: the Turrets it knows of (two, until it has looked) and the army it last saw.
      const guard = (this.armyAt[s.id]! < 0 && turrets === 0 ? 2 : turrets) * 240 + this.armySeen[s.id]! * (1 - stale * 0.5);
      // A wounded base draws it, a neighbour more than the far corner, and luck does the rest. How big the
      // army there looked counts for little: an opponent that always went for the weakest would see three
      // sides fall on one.
      const score = (100 - this.hallSeen[s.id]!) * 6 - guard * 0.15 + (r === 2 ? 0 : 160) + this.whim[r]! * 400;
      if (score > bestScore || (score === bestScore && r < bestRound)) {
        bestScore = score;
        bestRound = r;
        best = s.id;
        need = guard;
      }
    }
    return best < 0 ? null : { side: best, need };
  }

  /** How big an army it wants before it leaves home: bigger as the round goes on. */
  private enough(v: View): number {
    // In overtime there is no time to wait: whatever it has goes to the middle.
    if (v.tick >= FRENZY.overtime - 300) return 6;
    const minutes = v.tick / 600;
    return Math.min(v.cap - 6, Math.round((this.level === 0 ? 8 : 10) + minutes * 2.5));
  }

  /** Is there a base worth going for with what it has? */
  private pick(v: View, own: number): boolean {
    for (let r = 0; r < 4; r++) this.whim[r] = this.rnd();
    const c = this.choose(v);
    if (!c) return false;
    // In overtime the middle decides it: a base is worth leaving the Watchtower for only when it is nearly down.
    if (v.tick >= FRENZY.overtime - 300) {
      if (this.hallSeen[c.side]! < 15 && own > 250) {
        this.prey = c.side;
        return true;
      }
      return false;
    }
    const full = v.supply >= v.cap - 8;
    const duel = v.sides.filter((s) => !s.out).length === 2;
    if (own > c.need * 1.2 + 100 || (full && own > c.need * 0.7) || (duel && own > 300) || (this.hallSeen[c.side]! < 30 && own > 250)) {
      this.prey = c.side;
      return true;
    }
    return false;
  }

  /** New units gather at home as a reserve while the army is out, and join it when it comes home or when they are enough to matter. */
  private reserves(v: View, out: Command[], away: boolean): void {
    if (away && !this.reserve) {
      this.reserve = true;
      out.push({ t: 'rally', p: this.p, group: RESERVE });
      const s = this.staging(v);
      out.push({ t: 'order', p: this.p, group: RESERVE, mode: O.Attack, x: s.x, y: s.y });
      return;
    }
    const held = v.own.filter((e) => e.group === RESERVE);
    const supply = held.reduce((n, e) => n + def(e.kind).supply, 0);
    if (!away && this.reserve) {
      this.reserve = false;
      out.push({ t: 'rally', p: this.p, group: ARMY });
      if (held.length > 0) out.push({ t: 'assign', p: this.p, from: RESERVE, to: ARMY, kind: 0, count: 0 });
    } else if (away && supply >= Math.max(6, Math.round(this.wave * 0.5))) {
      out.push({ t: 'assign', p: this.p, from: RESERVE, to: ARMY, kind: 0, count: 0 });
    }
  }

  private army(v: View, out: Command[], hero: Entity | undefined): void {
    const hall = this.hall(v);
    if (!hall) return;
    const troops = v.own.filter((e) => e.group === ARMY);
    const supply = troops.reduce((n, e) => n + def(e.kind).supply, 0);
    const own = troops.reduce((s, e) => s + power(e), 0) + (hero ? heroPower(hero) : 0);
    const at = troops.length > 0 ? this.centre(v, troops) : this.staging(v);
    this.troopsAt = at;
    this.troops = troops.length;
    const home = { x: hall.x, y: hall.y };
    // Trouble at home: enemies near the base, or the base itself being hit.
    const raiders = v.enemies.filter((e) => !def(e.kind).building && within(e, home, 11));
    const threat = raiders.reduce((s, e) => s + might(e), 0);
    const hit = v.hurt.length > 0;
    // What stands near the army.
    const facing = v.enemies.filter((e) => within(e, at, 9)).reduce((s, e) => s + (def(e.kind).building ? power(e) : might(e)), 0);
    const spent = supply < Math.max(3, this.wave * 0.4);

    if ((threat > 120 || hit) && this.state !== 'defend') {
      // Come home, unless the base it is tearing down is nearly gone: then finish it.
      const closing = this.state === 'siege' && this.prey >= 0 && this.hallSeen[this.prey]! < 25 && this.level >= 1;
      if (!closing) this.go(v, 'defend');
    }
    switch (this.state) {
      case 'muster': {
        this.reserves(v, out, false);
        this.send(v, out, this.staging(v));
        const waited = v.tick - this.since;
        if (v.tick >= this.marchAt && (v.supply >= this.enough(v) || waited > 900)) {
          if (this.firstMarch < 0) this.firstMarch = v.tick;
          this.wave = supply;
          this.go(v, this.level >= 1 && this.pick(v, own) ? 'siege' : 'middle');
        }
        break;
      }
      case 'middle': {
        this.reserves(v, out, true);
        this.send(v, out, this.middle(v));
        if ((facing > own * 1.5 && v.tick - this.since > 30) || (spent && v.tick - this.since > 100)) {
          this.go(v, 'fallback');
          break;
        }
        // With the army near full, or well ahead of anything it has seen, it goes for somebody. With one
        // other side left there is nobody else to wait for, and a base already nearly down is worth a try.
        if (v.tick >= this.nextPick && v.tick - this.since > 150) {
          this.nextPick = v.tick + 200;
          if (this.pick(v, own)) this.go(v, 'siege');
        }
        break;
      }
      case 'siege': {
        const side = v.sides[this.prey];
        if (!side || side.out) {
          this.prey = -1;
          this.go(v, spent ? 'fallback' : 'middle');
          break;
        }
        this.reserves(v, out, true);
        this.send(v, out, this.baseOf(v, this.prey));
        // It gives up a siege that is going badly, unless the base is nearly down: then everything goes in.
        const nearly = this.hallSeen[this.prey]! < 30;
        if (!nearly && v.tick >= FRENZY.overtime - 300) {
          this.go(v, 'middle');
          break;
        }
        if (!nearly && ((facing > own * 1.6 && v.tick - this.since > 60) || (spent && v.tick - this.since > 200))) this.go(v, 'fallback');
        break;
      }
      case 'defend': {
        this.reserves(v, out, false);
        this.send(v, out, raiders.length > 0 ? this.toward(v, home, this.centre(v, raiders), 0.6) : this.staging(v));
        if (threat < 60 && !hit && v.tick - this.since > 80) this.go(v, 'muster');
        break;
      }
      case 'fallback': {
        this.reserves(v, out, false);
        this.send(v, out, this.staging(v), O.Move);
        if (v.tick - this.since > 120 || within(at, this.staging(v), 6)) this.go(v, 'muster');
        break;
      }
    }
  }

  // ---------------------------------------------------------------- the hero

  /** The enemy unit with the most worth of enemies standing within `radius` of it, among those in `range` of the hero. */
  private cluster(v: View, h: Entity, range: number, radius: number, ground: boolean): { at: Entity; value: number; count: number } | null {
    let best: Entity | null = null, bestValue = 0, bestCount = 0, bestRound = 9;
    for (const c of v.enemies) {
      const cd = def(c.kind);
      if ((ground && cd.air) || d2(c, h) > range * range) continue;
      let value = 0, count = 0;
      for (const e of v.enemies) {
        const ed = def(e.kind);
        if ((ground && ed.air) || d2(e, c) > radius * radius) continue;
        value += ed.building ? power(e) * 0.4 : might(e);
        if (!ed.building) count++;
      }
      const r = this.round(v, c.owner);
      if (value > bestValue || (value === bestValue && best !== null && (r < bestRound || (r === bestRound && c.id < best.id)))) {
        best = c;
        bestValue = value;
        bestCount = count;
        bestRound = r;
      }
    }
    return best ? { at: best, value: bestValue, count: bestCount } : null;
  }

  private hero(v: View, out: Command[], h: Entity): void {
    const full = heroHp(h.kind, h.lvl);
    const hall = this.hall(v);
    // Badly hurt, it goes home to mend, and comes back when it is most of the way there.
    if (this.level >= 1 && hall) {
      if (!this.heroHome && h.hp * 100 < full * 30) this.heroHome = true;
      else if (this.heroHome && h.hp * 100 > full * 75) this.heroHome = false;
    }
    let dest = this.target ?? this.staging(v);
    if (this.heroHome && hall) dest = this.toward(v, { x: hall.x, y: hall.y }, this.middle(v), 0.09);
    else if (this.troops >= 3) {
      // It walks faster than its army: it keeps a few steps ahead of it, no more.
      const lead = (h.kind === K.Captain ? 1 : 2.5) * TILE, far = Math.sqrt(d2(this.troopsAt, dest));
      if (far > lead) dest = this.toward(v, this.troopsAt, dest, lead / far);
    } else if (this.state !== 'defend') dest = this.staging(v);
    if (v.tick - this.heroOrder >= 20 || this.heroOrder < this.lastOrder) {
      this.heroOrder = v.tick;
      out.push({ t: 'order', p: this.p, group: HERO, mode: this.heroHome ? O.Move : O.Attack, x: dest.x, y: dest.y });
    }
    if (h.daze > v.tick) return;
    const abilities = ABILITIES[h.kind]!;
    const ready = (slot: number) => h.lvl >= abilities[slot]!.level && v.cds[slot]! <= v.tick;
    // Easy uses what it has only now and then.
    if (this.level === 0 && this.rnd() < 0.8) return;
    const near = v.enemies.filter((e) => !def(e.kind).building && within(e, h, 5));
    const friends = v.own.filter((e) => !def(e.kind).building && within(e, h, 6)).length;
    if (h.kind === K.Captain) {
      const strike = abilities[2]!, grenade = abilities[0]!;
      if (ready(2)) {
        const c = this.cluster(v, h, strike.range, strike.radius, true);
        if (c && (c.value >= 420 || c.count >= 6)) return void out.push({ t: 'cast', p: this.p, slot: 2, x: c.at.x, y: c.at.y });
      }
      if (ready(0)) {
        const c = this.cluster(v, h, grenade.range, grenade.radius, true);
        if (c && (c.value >= 130 || c.count >= 3)) return void out.push({ t: 'cast', p: this.p, slot: 0, x: c.at.x, y: c.at.y });
      }
      if (ready(1) && friends >= 6 && v.enemies.some((e) => within(e, h, 8))) out.push({ t: 'cast', p: this.p, slot: 1, x: h.x, y: h.y });
    } else {
      const pounce = abilities[0]!, roar = abilities[1]!;
      if (ready(1) && !this.heroHome) {
        const held = v.enemies.filter((e) => !def(e.kind).building && d2(e, h) <= roar.radius * roar.radius);
        if (held.length >= 4 || held.reduce((s, e) => s + might(e), 0) >= 420) return void out.push({ t: 'cast', p: this.p, slot: 1, x: h.x, y: h.y });
      }
      if (ready(2) && !this.heroHome && (near.length >= 4 || (this.state === 'siege' && v.enemies.some((e) => def(e.kind).building && within(e, h, 6))))) {
        return void out.push({ t: 'cast', p: this.p, slot: 2, x: h.x, y: h.y });
      }
      if (ready(0) && !this.heroHome && h.hp * 100 > full * 45) {
        const c = this.cluster(v, h, pounce.range, pounce.radius, true);
        // Worth the jump only if it lands on something, and not onto a bigger fight than its side has brought.
        if (c && (c.value >= 130 || c.count >= 3) && d2(c.at, h) > (TILE * 2) * (TILE * 2) && (friends >= 3 || c.value < 200)) {
          out.push({ t: 'cast', p: this.p, slot: 0, x: c.at.x, y: c.at.y });
        }
      }
    }
  }

  // ---------------------------------------------------------------- one turn

  think(v: View): Command[] {
    const out: Command[] = [];
    if (v.sides[this.p]?.out) return out;
    const every = this.level === 0 ? 10 : 5;
    if ((v.tick + this.phase) % every !== 0) return out;
    this.look(v);
    if ((v.tick + this.phase) % (every * 4) === 0) this.spend(v, out);
    const h = v.own.find((e) => def(e.kind).hero && e.ttl === 0);
    this.army(v, out, h);
    if (h) this.hero(v, out, h);
    return out;
  }
}
