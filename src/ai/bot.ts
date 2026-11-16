// The computer opponent. It reads the match only through a View (its own units, what they can see,
// and what it remembers) and acts only through the same commands a player gives.
import { FACTIONS, FIGHTERS, RULES, def, isHall, isWorker, researchCost, researchOf, worth } from '../sim/data';
import { power, type View } from '../sim/view';
import { C, K, O, TILE, type BaseSite, type Command, type Entity, type Faction, type Kind } from '../sim/types';

/** How it opens: an early attack, a safe expansion, or a fast one. */
export type Plan = 'rush' | 'standard' | 'greedy';
export const PLANS: Plan[] = ['rush', 'standard', 'greedy'];
/**
 * What it builds toward once Batteries come in. For the Green Army: upgraded infantry, Tanks and Juggernauts,
 * or Gunships. For the Dino Pack the same three words mean a swarm of Raptors and Spitters with research,
 * a herd of Horns, Brontos and Rexes, or a flock of Pteros.
 */
export type Tech = 'infantry' | 'armour' | 'air';
export const TECHS: Tech[] = ['infantry', 'armour', 'air'];
/**
 * The six plans the design doc names: the same six shapes for both factions, each faction naming them in its
 * own words. A plan fixes the opening and the tech path, and adds a few habits of its own on top: when it
 * attacks, how it raids, how far it digs in.
 */
export type Scheme = 'rush' | 'expand' | 'armour' | 'air' | 'raider' | 'fortress';
export const SCHEMES: Scheme[] = ['rush', 'expand', 'armour', 'air', 'raider', 'fortress'];
export const SCHEME_NAMES: Record<Faction, Record<Scheme, string>> = {
  green: { rush: 'Rush', expand: 'Fast expand', armour: 'Armour push', air: 'Air raid', raider: 'Raider', fortress: 'Fortress' },
  dino: { rush: 'Stampede', expand: 'Big nest', armour: 'Horn charge', air: 'Sky raid', raider: 'Pack hunt', fortress: 'Den' },
};
/** What each plan does, in a line for the result screen. */
export const SCHEME_LINES: Record<Faction, Record<Scheme, string>> = {
  green: {
    rush: 'soldiers before economy, and an early attack',
    expand: 'a second base before an army',
    armour: 'an early Factory, and Tanks and Mortars at about 7:00',
    air: 'an early Airfield, and Gunships sent after your Workers',
    raider: 'Runner packs at every expansion while it took more of the map',
    fortress: 'Turrets and Mortars at home until its Juggernauts arrived',
  },
  dino: {
    rush: 'Raptors before Gatherers, and an early attack',
    expand: 'a second Nest before an army',
    armour: 'an early Wallow, and Horns and Brontos at about 7:00',
    air: 'an early Roost, and Pteros sent after your Workers',
    raider: 'Raptor packs at every expansion while it took more of the map',
    fortress: 'Volcanoes and Spitters at home until its Rexes arrived',
  },
};
const SCHEME_OPENING: Record<Scheme, Plan> = { rush: 'rush', expand: 'greedy', armour: 'standard', air: 'standard', raider: 'greedy', fortress: 'standard' };

/** Fixed builds with no adapting, used by the lab to prove one-trick play loses. */
export type Trick = 'troopers' | 'runners' | 'lancers' | 'turtle' | 'tanks' | 'gunships' | 'raptors' | 'spitters' | 'horns' | 'pteros';
/** The one-trick builds each faction can play. */
export const TRICKS: Record<Faction, Trick[]> = {
  green: ['troopers', 'runners', 'lancers', 'turtle', 'tanks', 'gunships'],
  dino: ['raptors', 'spitters', 'horns', 'pteros'],
};

export interface BotOptions {
  /** One of the six named plans; picked at random, weighted by level and match-up, when not given. */
  scheme?: Scheme;
  /** The lab may still force an opening or a tech path on its own; either overrides the plan's. */
  plan?: Plan;
  tech?: Tech;
  /** -1 idle (for the lab), 0 Easy, 1 Normal, 2 Hard, 3 Brutal. Brutal plays as Hard; its extra income is the rules' (`Player.bonus`). */
  level?: number;
  trick?: Trick;
  /** For the lab's fairness check: a seed for this bot's dice, so that both sides can be made to roll the same. */
  dice?: number;
  /** Who is playing whom, known to both sides before the match starts: it weights the choice of opening and tech path. */
  faction?: Faction;
  foe?: Faction;
}

interface Pt { x: number; y: number }
interface Step { kind: Kind; refineries: number; after: number; bases?: number }

const ARMY = 0, RAID = 1, SCOUT = 2;
const d2 = (a: Pt, b: Pt) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const within = (a: Pt, b: Pt, tiles: number) => d2(a, b) <= tiles * TILE * tiles * TILE;
const price = (k: number) => worth(k);
/**
 * Is a point on a tile where `layer` is set? A point on the line between tiles (the middle of any building of
 * even size) counts if any tile touching it does, so the answer is the same from either end of the map.
 */
const onLayer = (v: View, layer: Uint8Array, pt: Pt): boolean => {
  const w = v.map.w, h = v.map.h;
  const tx = Math.max(0, Math.min(w - 1, Math.floor(pt.x / TILE))), ty = Math.max(0, Math.min(h - 1, Math.floor(pt.y / TILE)));
  const x0 = pt.x % TILE === 0 && tx > 0 ? tx - 1 : tx, y0 = pt.y % TILE === 0 && ty > 0 ? ty - 1 : ty;
  for (let y = y0; y <= ty; y++) for (let x = x0; x <= tx; x++) if (layer[y * w + x] === 1) return true;
  return false;
};
/**
 * Rounds a map coordinate away from the middle of the map. Plain rounding leans the same way everywhere,
 * so a point worked out by the far side would land one step off the mirror image of the near side's.
 */
const away = (a: number, c: number) => (a >= c ? c + Math.floor(a - c + 0.5) : c - Math.floor(c - a + 0.5));
const rx = (v: View, a: number) => away(a, (v.map.w * TILE) / 2);
const ry = (v: View, a: number) => away(a, (v.map.h * TILE) / 2);

/** The order each tech path adds its buildings in, and what must be true first. */
const PATHS: Record<Tech, Step[]> = {
  infantry: [
    { kind: K.Armory, refineries: 1, after: 1800, bases: 2 },
    { kind: K.Factory, refineries: 1, after: 2700 },
    { kind: K.Factory, refineries: 2, after: 0 },
    { kind: K.Heavy, refineries: 2, after: 5400 },
    { kind: K.Airfield, refineries: 3, after: 6000 },
  ],
  armour: [
    { kind: K.Factory, refineries: 1, after: 1800, bases: 2 },
    { kind: K.Armory, refineries: 1, after: 3300, bases: 2 },
    { kind: K.Factory, refineries: 2, after: 0 },
    { kind: K.Heavy, refineries: 2, after: 4200 },
    { kind: K.Airfield, refineries: 2, after: 5400 },
    { kind: K.Factory, refineries: 3, after: 0 },
  ],
  air: [
    { kind: K.Airfield, refineries: 1, after: 1800, bases: 2 },
    { kind: K.Armory, refineries: 1, after: 3300, bases: 2 },
    { kind: K.Airfield, refineries: 2, after: 0 },
    { kind: K.Factory, refineries: 2, after: 4200 },
    { kind: K.Heavy, refineries: 3, after: 6000 },
  ],
};

/**
 * A Fortress digs in and goes straight for its heavies: Heavy Works (or a Great Cave) a few minutes sooner than
 * the armour path would, with an Armory or Bone Pit on the way for the research its turtle lives on.
 */
const FORT_PATH: Step[] = [
  { kind: K.Factory, refineries: 1, after: 1800, bases: 2 },
  { kind: K.Armory, refineries: 1, after: 2400 },
  { kind: K.Heavy, refineries: 2, after: 3000 },
  { kind: K.Factory, refineries: 2, after: 0 },
  { kind: K.Factory, refineries: 3, after: 0 },
  { kind: K.Airfield, refineries: 3, after: 6000 },
];
const DINO_FORT_PATH: Step[] = [
  { kind: K.Wallow, refineries: 1, after: 1800, bases: 2 },
  { kind: K.BonePit, refineries: 1, after: 2400 },
  { kind: K.Cave, refineries: 2, after: 3000 },
  { kind: K.Roost, refineries: 3, after: 6000 },
];

const DINO_PATHS: Record<Tech, Step[]> = {
  infantry: [
    { kind: K.BonePit, refineries: 1, after: 1800, bases: 2 },
    { kind: K.Wallow, refineries: 1, after: 3000 },
    { kind: K.Cave, refineries: 2, after: 5100 },
    { kind: K.Roost, refineries: 3, after: 6000 },
  ],
  armour: [
    { kind: K.Wallow, refineries: 1, after: 1800, bases: 2 },
    { kind: K.BonePit, refineries: 1, after: 3300, bases: 2 },
    { kind: K.Cave, refineries: 2, after: 4200 },
    { kind: K.Roost, refineries: 2, after: 5400 },
  ],
  // Pteros are raiders, not a front line: the flying path puts Horns under them as soon as it can.
  air: [
    { kind: K.Roost, refineries: 1, after: 1800, bases: 2 },
    { kind: K.Wallow, refineries: 1, after: 2700, bases: 2 },
    { kind: K.BonePit, refineries: 2, after: 3900 },
    { kind: K.Cave, refineries: 2, after: 6000 },
  ],
};

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

export class Bot {
  readonly scheme: Scheme;
  readonly plan: Plan;
  readonly tech: Tech;
  readonly level: number;
  readonly trick: Trick | undefined;
  /** The lab forced the tech path: then a Fortress follows that path, not its own. */
  private forcedTech: boolean;
  private rnd: () => number;
  private state: 'gather' | 'attack' | 'defend' | 'retreat' = 'gather';
  private waveAt: number;
  private waveStart = 0;
  private target: Pt | null = null;
  private visited = new Set<number>();
  private lastOrder = -999;
  private threatSeen = -999;
  private raid: { state: 'home' | 'out' | 'back'; target: Pt | null; since: number; next: number } = { state: 'home', target: null, since: 0, next: 0 };
  private scoutLeg = 0;
  private scoutSince = -999;
  private scoutsSent = 0;
  private turretAsked = -999;
  private phase = 0;
  private panicAt = -999;
  private retreatAt = -9999;
  /** When the main army last set out with a second front, and since when the match has looked lost. */
  private frontAt = -9999;
  private hopeless = -1;
  private conceded = false;
  /** Blocks and Batteries set aside so far for the next building. */
  private bank = 0;
  private bankGas = 0;
  private ramp: Pt | null = null;
  /** True while the current attack is one that climbs ramps without counting the cost. */
  private allIn = false;
  private lookedAt = -9999;
  private fortAt = -999;
  /** The largest enemy force seen lately, fading over a minute or so. */
  private enemySeen = 0;
  private lancersSeen = 0;
  /** Dino Pack: eggs hatched as Gatherers and as fighters since its Den went up, to keep the two in proportion. */
  private ecoEggs = 0;
  private armyEggs = 0;
  /** How many of each enemy unit it has seen lately, fading over a couple of minutes. */
  private mem = new Map<number, number>();
  /** Tick of this bot's first attack order, for the lab. */
  firstAttack = -1;

  constructor(readonly p: number, seed: number, opts: BotOptions = {}) {
    this.rnd = rng(opts.dice ?? seed * 7919 + p * 104729 + 13);
    this.level = Math.min(2, opts.level ?? 1);
    this.trick = opts.trick;
    // One of the six plans, weighted by who is playing whom. Easy never rushes and never raids: a newcomer gets
    // a few minutes to find the controls. A Green Army rarely rushes, raids or turtles against a Dino Pack: a
    // Nest's banked eggs hatch a dozen Raptors at once, Raptors run down Runners, and a Dino Pack outgrows a
    // Fortress waiting for its Juggernauts. In a Dino mirror every army is full of Spitters, so the sky is a
    // poor bet, and a Den that sits at home is outgrown the same way.
    const intoEggs = opts.faction === 'green' && opts.foe === 'dino';
    const spitters = opts.faction === 'dino' && opts.foe === 'dino';
    const weights: Record<Scheme, number> = this.level === 0
      ? { rush: 0, expand: 2, armour: 2, air: 1, raider: 0, fortress: 2 }
      : { rush: intoEggs ? 1 : 2, expand: 2, armour: 2, air: spitters ? 1 : 2, raider: intoEggs ? 0.5 : 2, fortress: intoEggs || spitters ? 0.5 : 2 };
    const total = SCHEMES.reduce((s, k) => s + weights[k], 0);
    let roll = this.rnd() * total, picked: Scheme = 'armour';
    for (const k of SCHEMES) {
      roll -= weights[k];
      if (roll < 0 && weights[k] > 0) { picked = k; break; }
    }
    const flies0 = opts.trick === 'gunships' || opts.trick === 'pteros', rolls0 = opts.trick === 'tanks' || opts.trick === 'horns';
    this.scheme = opts.scheme ?? (flies0 ? 'air' : rolls0 ? 'armour' : picked);
    this.plan = opts.plan ?? SCHEME_OPENING[this.scheme];
    const base = this.level === 0 ? 400 : this.plan === 'rush' ? 450 : this.plan === 'standard' ? 800 : 1100;
    // No two matches open quite alike: each bot's first push comes a little earlier or later.
    this.waveAt = Math.round(base * (0.9 + this.rnd() * 0.25));
    if (this.trick) this.waveAt = 600;
    this.phase = Math.floor(this.rnd() * 12);
    // The plan says the tech path, except a fast expansion's, which may go either way once its bases are up.
    const byScheme: Record<Scheme, Tech> = {
      rush: 'infantry', expand: this.rnd() < 0.5 ? 'infantry' : 'armour', armour: 'armour', air: 'air', raider: 'infantry', fortress: 'armour',
    };
    this.tech = opts.tech ?? byScheme[this.scheme];
    this.forcedTech = opts.tech !== undefined;
  }

  private sites(v: View, side: number): BaseSite[] {
    return v.map.bases.filter((b) => b.side === side).sort((a, b) => a.tier - b.tier);
  }

  private siteCentre(b: BaseSite): Pt {
    return { x: (b.hx + 2) * TILE, y: (b.hy + 2) * TILE };
  }

  private pileCentre(b: BaseSite): Pt {
    const n = b.piles.length;
    return {
      x: Math.round((b.piles.reduce((s, p) => s + p.tx + 0.5, 0) / n) * TILE),
      y: Math.round((b.piles.reduce((s, p) => s + p.ty + 0.5, 0) / n) * TILE),
    };
  }

  /** Where the army gathers: in front of the natural, toward the middle of the map. */
  private staging(v: View): Pt {
    const nat = this.siteCentre(this.sites(v, this.p)[1]!);
    if (this.level >= 1 && !this.trick && !v.own.some((e) => isHall(e.kind) && within(e, nat, 4))) {
      // No natural to stand in front of: hold the high ground at the top of the main's ramp instead.
      const top = this.rampTop(v), main = this.siteCentre(this.sites(v, this.p)[0]!);
      const dx = main.x - top.x, dy = main.y - top.y;
      const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
      return { x: rx(v, top.x + (dx * 2.5 * TILE) / l), y: ry(v, top.y + (dy * 2.5 * TILE) / l) };
    }
    const mid = { x: (v.map.w * TILE) / 2, y: (v.map.h * TILE) / 2 };
    const dx = mid.x - nat.x, dy = mid.y - nat.y;
    const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
    return { x: rx(v, nat.x + (dx * 3 * TILE) / l), y: ry(v, nat.y + (dy * 3 * TILE) / l) };
  }

  /** The top of the ramp into this side's main: the middle of the high tiles that touch walkable low ground. */
  private rampTop(v: View): Pt {
    if (this.ramp) return this.ramp;
    const { w, h, high, rock } = v.map;
    const main = this.siteCentre(this.sites(v, this.p)[0]!);
    let sx = 0, sy = 0, n = 0;
    for (let ty = 1; ty < h - 1; ty++) for (let tx = 1; tx < w - 1; tx++) {
      if (high[ty * w + tx] !== 1 || !within({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }, main, 20)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = (ty + dy) * w + tx + dx;
        if (high[k] === 0 && rock[k] === 0) {
          sx += tx + 0.5;
          sy += ty + 0.5;
          n++;
          break;
        }
      }
    }
    this.ramp = n > 0 ? { x: rx(v, (sx / n) * TILE), y: ry(v, (sy / n) * TILE) } : main;
    return this.ramp;
  }

  /** A free spot for a building near a point, leaving a path around it and the Workers' lanes clear. */
  private findSpot(v: View, kind: Kind, near: Pt, margin: number): { tx: number; ty: number } | null {
    const size = def(kind).size;
    // Rounded the other way for the far side, so that the two sides' searches start on mirrored tiles.
    const snap = this.p === 1 ? Math.ceil : Math.floor;
    const cx = snap(near.x / TILE - size / 2), cy = snap(near.y / TILE - size / 2);
    const inLane = (tx: number, ty: number) => {
      for (const b of v.map.bases) {
        let x0 = b.hx, y0 = b.hy, x1 = b.hx + 3, y1 = b.hy + 3;
        for (const p of b.piles) {
          x0 = Math.min(x0, p.tx);
          y0 = Math.min(y0, p.ty);
          x1 = Math.max(x1, p.tx);
          y1 = Math.max(y1, p.ty);
        }
        for (const c of b.cells) {
          x0 = Math.min(x0, c.tx);
          y0 = Math.min(y0, c.ty);
          x1 = Math.max(x1, c.tx + 1);
          y1 = Math.max(y1, c.ty + 1);
        }
        if (tx + size - 1 >= x0 - 1 && tx <= x1 + 1 && ty + size - 1 >= y0 - 1 && ty <= y1 + 1) return true;
      }
      return false;
    };
    const flip = this.p === 1 ? -1 : 1;
    for (let r = 0; r <= 14; r++) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const tx = cx + i * flip, ty = cy + j * flip;
        if (!v.canPlace(kind, tx, ty) || inLane(tx, ty)) continue;
        let clear = true;
        for (let y = ty - margin; y < ty + size + margin && clear; y++) for (let x = tx - margin; x < tx + size + margin; x++) {
          if (v.blocked(x, y) && x >= 0 && y >= 0 && x < v.map.w && y < v.map.h) {
            clear = false;
            break;
          }
        }
        if (clear) return { tx, ty };
      }
    }
    return null;
  }

  think(v: View): Command[] {
    if (this.level < 0) return [];
    const every = this.level === 0 ? 12 : this.level === 2 ? 3 : 5;
    if ((v.tick + this.phase) % every !== 0) return [];
    const out: Command[] = [];
    const p = this.p;
    const trick = this.trick;
    // Some of the lab's one-trick builds never leave the Barracks or the Den; the others need Batteries.
    const techTrick = trick === 'tanks' || trick === 'gunships' || trick === 'horns' || trick === 'pteros';
    const mine = this.sites(v, p), theirs = this.sites(v, 1 - p);
    // The plan's own habits. The lab's one-trick builds have none.
    const fortress = !trick && this.scheme === 'fortress', raider = !trick && this.scheme === 'raider', pusher = !trick && this.scheme === 'armour';
    // Each faction has a hall, a worker, a refinery, a turret, a first army building and a place for research.
    const F = FACTIONS[v.faction], dino = v.faction === 'dino';
    const HALL = F.hall, WORKER = F.worker, REF = F.refinery, TURRET = F.turret;
    /** The fast unit that scouts and raids, and the flyer that raids for the air path. */
    const RUNNER = dino ? K.Raptor : K.Runner, FLYER = dino ? K.Ptero : K.Gunship;
    const count = (k: number) => v.own.filter((e) => e.kind === k).length;
    const queued = (k: number) => v.own.reduce((s, e) => s + e.queue.filter((q) => q === k).length * (e.kind === K.Egg ? def(k).brood : 1), 0);
    const all = (k: number) => count(k) + queued(k);
    const of = (k: number) => v.own.filter((e) => e.kind === k);
    const hqs = of(HALL);
    const builtHQ = hqs.filter((e) => e.built);
    const rax = of(F.first);
    const builtRax = rax.filter((e) => e.built);
    const turrets = of(TURRET);
    const refineries = of(REF);
    const builtRef = refineries.filter((e) => e.built).length;
    const factories = of(K.Factory), airfields = of(K.Airfield), armories = of(F.lab), heavies = of(K.Heavy);
    const wallows = of(K.Wallow), roosts = of(K.Roost), caves = of(K.Cave);
    const workers = all(WORKER);
    const army = v.own.filter((e) => e.group === ARMY && !def(e.kind).building);
    const raiders = v.own.filter((e) => e.group === RAID);
    const scouts = v.own.filter((e) => e.group === SCOUT);
    const armyValue = army.reduce((s, e) => s + price(e.kind), 0);
    const t = v.tick;

    // ---------------------------------------------------------------- what it knows of the enemy
    // What it has seen of the enemy's army sets how much army it wants at home before it spends on growth.
    const seenNow = v.enemies.filter((e) => !def(e.kind).building && !isWorker(e.kind) && e.kind !== K.Egg);
    const seenPower = seenNow.reduce((s2, e) => s2 + power(e), 0);
    if (seenPower >= this.enemySeen) {
      this.enemySeen = seenPower;
      this.lancersSeen = seenNow.length ? seenNow.filter((e) => e.kind === K.Lancer).length / seenNow.length : 0;
    } else {
      this.enemySeen *= this.level === 0 ? 0.994 : 0.997;
    }
    for (const k of FIGHTERS) {
      const now = seenNow.filter((e) => e.kind === k).length;
      if (now === 0 && !this.mem.has(k)) continue;
      this.mem.set(k, Math.max(now, (this.mem.get(k) ?? 0) * 0.997));
    }
    const seen = (k: number) => this.mem.get(k) ?? 0;
    // When it last had eyes on the enemy's army, or on the ground in front of the enemy's natural where one would stand.
    {
      const front = this.siteCentre(theirs[1]!);
      if (seenNow.length > 0 || onLayer(v, v.vis, front)) this.lookedAt = t;
    }
    const ghost = (k: number) => v.ghosts.filter((gh) => gh.kind === k).length;
    // What it has seen of the enemy's army by armour class, in Blocks and Batteries: counters work by class.
    const byClass = (cls: number) => FACTIONS[v.foe].units.reduce((s2, k) => s2 + (def(k).cls === cls && !isWorker(k) ? seen(k) * price(k) : 0), 0);
    const eAir = byClass(C.Air);
    const eArm = byClass(C.Armoured);
    const eLight = byClass(C.Light);
    const eAll = Math.max(1, eAir + eArm + eLight);
    /** Enemy flyers seen lately, and the buildings that make them. */
    const flyersSeen = seen(K.Gunship) + seen(K.Ptero), airNests = ghost(K.Airfield) + ghost(K.Roost);
    const airComing = flyersSeen >= 1 || airNests > 0;
    const enemyTurrets = ghost(K.Turret) + ghost(K.Volcano);

    const homePower = army.reduce((s2, e) => s2 + power(e), 0) + turrets.reduce((s2, e) => s2 + power(e), 0) * 0.6;
    const oneBase = this.visited.has(this.sites(v, 1 - this.p)[1]!.id) && !v.ghosts.some((gh) => isHall(gh.kind) && !within(gh, this.siteCentre(this.sites(v, 1 - this.p)[0]!), 6));
    // The army it wants at home by now: a little each minute early on, and more each minute after the fourth.
    const mins = t / 600;
    let floor = (this.level === 0 ? 100 * mins : 150 * mins + 130 * Math.max(0, mins - 4)) * (oneBase && t > 1200 && t < 4200 ? 1.4 : 1);
    floor = Math.max(floor, this.enemySeen * (this.level === 0 ? 0.6 : 0.95));
    const unsafe = !trick && homePower < floor;
    // Seen an army well over its own with nothing much at home: no second base until that is put right.
    const exposed0 = !trick && this.enemySeen > homePower * 1.5 + 150;
    let blocks = v.blocks, gas = v.gas;
    const spend = (k: number) => {
      blocks -= def(k).cost;
      gas -= def(k).gas;
    };
    const afford = (k: number, keep = 0, keepGas = 0) => blocks - keep >= def(k).cost && gas - keepGas >= def(k).gas;

    // ---------------------------------------------------------------- economy
    const workerCap = this.level === 0 ? 18 : 46;
    let workerTarget = Math.min(workerCap, 14 * builtHQ.length + 6 * (hqs.length - builtHQ.length) + 3 * builtRef);
    // How many of its first army building each opening wants before it does anything else: the Green Army
    // trains at its Barracks and needs several; the Dino Pack hatches at its Nests and needs one Den.
    // On a map this size an enemy army is a long walk away, so a safe expansion takes its natural behind two.
    const raxRush = dino ? 1 : 2, raxOpen = dino ? 1 : 2;
    if (this.plan === 'rush' && rax.length < raxRush && !trick) workerTarget = Math.min(workerTarget, 11);
    if (trick) workerTarget = techTrick ? Math.min(workerTarget, 34) : 14;
    // Safety first: an expanding opening holds at 16 Workers until it has a few soldiers at home.
    if (!trick && this.plan !== 'rush' && t < 2400 && rax.length > 0 && (dino ? army.length : count(K.Trooper)) < 4) {
      workerTarget = Math.min(workerTarget, 16);
    }
    /** Eggs waiting in its Nests: what the Dino Pack has to spend besides Blocks. */
    let eggs = dino ? builtHQ.reduce((s2, e) => s2 + e.eggs, 0) : 0;
    const trainWorkers = () => {
      let n = workers;
      if (dino) {
        // Every Gatherer is an egg, and Blocks, the army doesn't get. Until a Den stands every egg is a Gatherer;
        // after that the economy takes every other egg, and one in three while the army is short.
        const share = builtRax.length === 0 ? 1 : unsafe ? 0.34 : 0.5;
        while (eggs > 0 && n < workerTarget && blocks >= 50 && v.supply + (n - workers) < v.cap
          && (share === 1 || armyFirst || this.ecoEggs <= (this.ecoEggs + this.armyEggs) * share)) {
          out.push({ t: 'train', p, kind: WORKER });
          spend(WORKER);
          n++;
          eggs--;
          if (share < 1) this.ecoEggs++;
        }
        return;
      }
      for (const hq of builtHQ) {
        if (hq.queue.length === 0 && n < workerTarget && blocks >= 50 && v.supply + (n - workers) < v.cap) {
          out.push({ t: 'train', p, kind: K.Worker });
          spend(K.Worker);
          n++;
        }
      }
    };
    // Short of army with the enemy at the door: soldiers get the Blocks first, and Workers what is left.
    // Far short of the army it should have by now: the same.
    const exposed = !trick && t > 900 && homePower < floor * 0.6;
    const armyFirst = (unsafe && t - this.threatSeen < 100) || exposed;
    if (!armyFirst) trainWorkers();

    // What the plan wants built next. Blocks are held back for it until it is placed.
    let want: Kind | 0 = 0;
    let wantAt: Pt | null = null;
    let margin = 1;
    const nextSite = mine.find((s) => !v.own.some((e) => e.kind === HALL && within(e, this.siteCentre(s), 3))
      && !v.ghosts.some((gh) => within(gh, this.siteCentre(s), 4)) && v.canPlace(HALL, s.hx, s.hy));
    const growing = hqs.length > builtHQ.length;
    const saturated = count(WORKER) >= 12 * builtHQ.length + 3 * builtRef;
    const income = (count(WORKER) - 3 * builtRef) * 62;
    // Enough Barracks to turn the income into soldiers, and one more whenever Blocks pile up unspent.
    const hqsTraining = workers < workerTarget ? builtHQ.length : 0;
    const techMakers = dino ? wallows.length + roosts.length : factories.length + airfields.length;
    let raxWant = Math.max(0, Math.floor((income - 300 * hqsTraining - 300 * techMakers) / 200));
    // Before the second base, an expanding opening saves its spare Blocks for the Headquarters, not for more Barracks.
    const saving2 = !trick && this.plan !== 'rush' && hqs.length < 2 && t < 2700;
    if (!saving2 && blocks >= 250 && rax.length === builtRax.length && builtRax.length > 0 && builtRax.every((b) => b.queue.length >= 1)) raxWant = Math.max(raxWant, rax.length + 1);
    raxWant = Math.min(this.level === 0 ? 2 : this.level === 2 ? 10 : 8, raxWant);
    if (this.plan === 'rush') raxWant = Math.max(raxWant, 2);
    else if (this.plan === 'standard') raxWant = Math.max(raxWant, hqs.length >= 2 ? 3 : raxOpen);
    else raxWant = Math.max(raxWant, hqs.length >= 2 ? 1 : 0);
    if (trick) raxWant = techTrick ? 1 : trick === 'turtle' ? 2 : 4;
    // One Den is all the Dino Pack needs: its Nests do the hatching. A fast expansion puts the second Nest first.
    if (dino) raxWant = this.plan === 'greedy' && hqs.length < 2 ? 0 : 1;

    if (builtHQ.length === 0 && hqs.length === 0) {
      // Lost every Headquarters: rebuild if the Blocks are there.
      if (nextSite) {
        want = HALL;
        wantAt = { x: nextSite.hx * TILE, y: nextSite.hy * TILE };
      }
    } else if ((!trick || techTrick) && nextSite && !growing) {
      let expand = false;
      if (techTrick) {
        expand = hqs.length === 1 && t > 1800;
      } else if (hqs.length === 1) {
        if (this.plan === 'greedy') expand = true;
        else if (this.plan === 'standard') expand = rax.length >= raxOpen && (armyValue >= (dino ? 400 : 300) || t > 1800) && (!exposed0 || t > 3000);
        else expand = t > (dino ? 2100 : 2400) || (rax.length >= raxRush && blocks > 500);
      } else if (dino) {
        // More Nests are more eggs as well as more Blocks: the Dino Pack takes its third base sooner, and
        // takes one whenever Blocks pile up with every egg spent.
        const minT = (this.plan === 'greedy' ? 2700 : this.plan === 'standard' ? 3300 : 3900) - (raider ? 600 : 0);
        expand = (saturated || (blocks > 450 && eggs === 0)) && t > minT + 2400 * (hqs.length - 2) && armyValue >= 300 && !unsafe;
      } else {
        // A third base is a mid-game move, and a fourth a late one.
        const minT = (this.plan === 'greedy' ? 3600 : this.plan === 'standard' ? 4200 : 4800) - (raider ? 900 : 0);
        expand = saturated && t > minT + 3000 * (hqs.length - 2) && armyValue >= 300 && !unsafe;
      }
      // A full supply bar needs another Headquarters before anything else.
      if (v.supply >= v.cap - 4 && v.cap < RULES.supplyMax && t - this.threatSeen > 150) expand = true;
      // Easy stays on one base for five minutes and never takes a third.
      if (this.level === 0 && (hqs.length >= 2 || t < 3000)) expand = false;
      // Blocks nearly gone under every Headquarters: expand whatever the danger.
      const left = v.piles.filter((pl) => builtHQ.some((h) => within(pl, h, 10))).reduce((s2, pl) => s2 + pl.amount, 0);
      if (builtHQ.length > 0 && left < 1500 * builtHQ.length) expand = true;
      if (expand) {
        want = HALL;
        wantAt = { x: nextSite.hx * TILE, y: nextSite.hy * TILE };
      }
    }
    // Expanding openings cover the new base with a Turret on the side the enemy comes from.
    // Seeing a bigger army than its own adds Turrets, unless that army is mostly Lancers, which outrange them.
    const short = this.enemySeen - army.reduce((s2, e) => s2 + power(e), 0);
    let extra = this.level >= 1 && short > 0 && this.lancersSeen < 0.5 ? Math.min(3, Math.ceil(short / 220)) : 0;
    // An enemy still on one base after two minutes is building an army, not an economy: one Turret as insurance.
    if (this.level >= 1 && oneBase && t > 1200 && t < 4200 && this.lancersSeen < 0.5) extra = Math.max(extra, 1);
    // A rush that has had its go digs in too. A Fast expand covers its natural once and trusts its economy; a
    // Raider, on the same opening, twice. A Fortress covers its bases twice over, and a Den once more than
    // usual: every Volcano costs it a Gatherer.
    const greedyCover = !trick && this.scheme === 'expand' ? 1 : 2;
    const cover = (this.plan === 'greedy' ? greedyCover : this.plan === 'standard' ? 1 : t > 1500 ? 1 : 0) + extra + (fortress ? (dino ? 1 : 2) : 0);
    const wantsTurret = trick === 'turtle' ? turrets.length < 6
      : !trick && (hqs.length >= 2 || extra > 0 || (this.plan !== 'greedy' && rax.length >= raxRush)) && turrets.length < Math.max(cover, this.level === 2 ? hqs.length - 1 : 0);
    // A Volcano goes on nesting ground: by the natural once a Nest stands there, by the main until then.
    const natHeld = builtHQ.some((h) => within(h, this.siteCentre(mine[1]!), 4));
    if (!want && builtRax.length > 0 && wantsTurret) {
      const b = mine[dino ? (natHeld ? 1 : 0) : trick ? turrets.length % 2 : 1]!;
      const hc = this.siteCentre(b);
      const mid = { x: (v.map.w * TILE) / 2, y: (v.map.h * TILE) / 2 };
      const dx = mid.x - hc.x, dy = mid.y - hc.y;
      const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
      const side = turrets.length % 2 === 0 ? 1 : -1;
      want = TURRET;
      const spread = 2 + Math.floor(turrets.length / 2) * 3;
      wantAt = { x: rx(v, hc.x + (dx * 5 * TILE) / l - (dy * side * spread * TILE) / l), y: ry(v, hc.y + (dy * 5 * TILE) / l + (dx * side * spread * TILE) / l) };
      margin = 0;
    }

    // ---------------------------------------------------------------- Batteries and the tech path
    // The first Refinery goes up once the opening is in place; after that, one on every pack beside a Headquarters.
    const usesGas = techTrick || (!trick && (this.level > 0 || t > 2400));
    const opened = techTrick ? rax.length >= 1
      : this.plan === 'rush' ? rax.length >= raxRush && t > 1300
        : this.plan === 'standard' ? rax.length >= raxRush && (hqs.length >= 2 || t > 2100)
          : hqs.length >= 2 && rax.length >= 1;
    const refineryCap = this.level === 0 ? 1 : 4;
    const pack = v.cells.find((c) => c.site === 0 && c.amount > 0 && builtHQ.some((h) => within(c, h, RULES.baseReach)));
    const refineryDue = usesGas && opened && pack !== undefined && refineries.length < refineryCap
      && (refineries.length === 0 || (refineries.length === builtRef && techMakers + armories.length > 0 && !unsafe));
    if (refineryDue && builtHQ.length > 0) {
      const tx = Math.round(pack!.x / TILE) - 1, ty = Math.round(pack!.y / TILE) - 1;
      if (blocks >= def(REF).cost) {
        out.push({ t: 'build', p, kind: REF, tx, ty });
        spend(REF);
      }
    }
    let techWant: Kind | 0 = 0;
    if (usesGas && builtRef > 0 && builtRax.length > 0) {
      if (techTrick) {
        const k = trick === 'tanks' ? K.Factory : trick === 'gunships' ? K.Airfield : trick === 'horns' ? K.Wallow : K.Roost;
        // The Green Army's tech buildings do the training, so it wants several; the Dino Pack's only unlock.
        if (of(k).length < (dino ? 1 : Math.min(3, 1 + builtRef))) techWant = k;
      } else {
        // Flyers seen, or a building that makes them: a Factory for Flak Tracks jumps the queue. (Spitters need only the Den.)
        if (!dino && airComing && factories.length === 0 && this.level >= 1) techWant = K.Factory;
        const had = new Map<number, number>();
        const path = fortress && !this.forcedTech ? (dino ? DINO_FORT_PATH : FORT_PATH) : (dino ? DINO_PATHS : PATHS)[this.tech];
        for (const s of techWant ? [] : path) {
          const n = (had.get(s.kind) ?? 0) + 1;
          had.set(s.kind, n);
          if (of(s.kind).length >= n) continue;
          // Easy stops at its first Factory (or Wallow) and never researches.
          if (this.level === 0 && (s.kind !== (dino ? K.Wallow : K.Factory) || n > 1 || t < 3300)) continue;
          const ready = builtRef >= s.refineries && t >= s.after && (!s.bases || hqs.length >= s.bases || t > s.after + 1500)
            && def(s.kind).needs.every((need) => v.own.some((e) => e.kind === need && e.built));
          if (ready) techWant = s.kind;
          break;
        }
        // Batteries piling up with every Factory and Airfield busy: one more of the path's own maker.
        const main = this.tech === 'air' ? K.Airfield : K.Factory;
        const busy = [...factories, ...airfields].every((e) => e.built && e.queue.length > 0);
        if (!dino && !techWant && this.level >= 1 && techMakers > 0 && techMakers < 6 && busy && gas > 150 + 60 * techMakers) {
          techWant = this.tech === 'air' && airfields.length >= 3 && factories.length < 2 ? K.Factory : main;
        }
      }
    }
    const makers = rax.length + techMakers + armories.length + heavies.length + caves.length;
    const makerSpot = (): Pt => {
      // Production goes on the far side of the Headquarters from the Blocks; the natural takes the overflow.
      const home = makers < 6 || builtHQ.length < 2 ? mine[0]! : mine[1]!;
      const hc = this.siteCentre(home), pc = this.pileCentre(home);
      const horizontal = Math.abs(hc.x - pc.x) >= Math.abs(hc.y - pc.y);
      return horizontal
        ? { x: hc.x + Math.sign(hc.x - pc.x) * 8 * TILE, y: hc.y }
        : { x: hc.x, y: hc.y + Math.sign(hc.y - pc.y) * 7 * TILE };
    };
    if (!want && techWant && !(unsafe && t - this.threatSeen < 100) && builtHQ.length > 0) {
      want = techWant;
      wantAt = makerSpot();
    }
    if (!want && rax.length < raxWant && builtHQ.length > 0) {
      want = F.first;
      wantAt = makerSpot();
    }
    // A raid on the Workers gets a Turret in reply.
    if (v.hurt.length > 0 && builtRax.length > 0 && !trick && t - this.turretAsked > 250) {
      const h = v.hurt[0]!;
      const near = turrets.filter((e) => within(e, h, 7)).length;
      if (near < (this.level === 2 || airComing ? 2 : 1) && blocks >= 100) {
        const spot = this.findSpot(v, TURRET, h, 0);
        if (spot) {
          out.push({ t: 'build', p, kind: TURRET, tx: spot.tx, ty: spot.ty });
          spend(TURRET);
          this.turretAsked = t;
        }
      }
    }
    // A base facing more than its defenders can handle gets Turrets between it and the threat.
    {
      const foesNear = v.enemies.filter((e) => !def(e.kind).building && !isWorker(e.kind) && e.kind !== K.Egg
        && v.own.some((b) => def(b.kind).building && within(e, b, 16)));
      if (foesNear.length > 0 && builtRax.length > 0 && !trick && this.level >= 1 && t - this.panicAt >= 60 && blocks >= 100) {
        const fx = rx(v, foesNear.reduce((s2, e) => s2 + e.x, 0) / foesNear.length);
        const fy = ry(v, foesNear.reduce((s2, e) => s2 + e.y, 0) / foesNear.length);
        const foeP = foesNear.reduce((s2, e) => s2 + power(e), 0);
        const base = [...hqs].sort((a, b) => d2(a, { x: fx, y: fy }) - d2(b, { x: fx, y: fy }))[0];
        if (base) {
          const homeP = v.own.filter((e) => within(e, base, 12)).reduce((s2, e) => s2 + power(e), 0);
          const nearTurrets = turrets.filter((e) => within(e, base, 9)).length;
          // A Volcano costs a Gatherer as well as Blocks: the Dino Pack stops at two a base and hatches fighters instead.
          if (foeP > homeP * 0.9 && nearTurrets < (dino ? 2 : 4)) {
            const dx = fx - base.x, dy = fy - base.y;
            const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
            const spot = this.findSpot(v, TURRET, { x: rx(v, base.x + (dx * 4 * TILE) / l), y: ry(v, base.y + (dy * 4 * TILE) / l) }, 0);
            if (spot) {
              out.push({ t: 'build', p, kind: TURRET, tx: spot.tx, ty: spot.ty });
              spend(TURRET);
              this.panicAt = t;
            }
          }
        }
      }
    }
    // Growth is paid for out of a share of the income, set aside a little at a time, so that the army
    // keeps training while the next building is saved for: a large share when it has army enough for
    // what it has seen, a small one when it is short, none with the enemy at the door.
    // Outgunned, or grown to two bases: Turrets on the high ground at the top of the main's ramp, where
    // they outrange anything below and can't be seen from it. A main that holds is a match that isn't over.
    if (this.level >= 1 && !trick && builtRax.length > 0 && t > 1500 && t - this.fortAt > 150 && blocks >= 100 && builtHQ.length > 0) {
      const top = this.rampTop(v);
      const main = this.siteCentre(mine[0]!);
      const there = turrets.filter((e) => within(e, top, 6)).length;
      const behind = this.enemySeen - army.reduce((s2, e) => s2 + power(e), 0);
      const wanted = Math.min(fortress && !dino ? 6 : 4, (hqs.length >= 2 && t > 2700 ? 1 : 0) + (t > 4800 ? 1 : 0) + (fortress && !dino ? 2 : 0) + Math.max(0, Math.ceil(behind / 350)));
      if (there < wanted && v.own.some((e) => e.kind === HALL && within(e, main, 4))) {
        const dx = main.x - top.x, dy = main.y - top.y;
        const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
        const side = there % 2 === 0 ? 1 : -1;
        const at = { x: rx(v, top.x + (dx * 2.5 * TILE) / l - (dy * side * 3 * TILE) / l), y: ry(v, top.y + (dy * 2.5 * TILE) / l + (dx * side * 3 * TILE) / l) };
        const spot = this.findSpot(v, TURRET, at, 1);
        // All of it on the high ground, none of it on the ramp.
        const up = (tx: number, ty: number) => v.map.high[ty * v.map.w + tx] === 1;
        if (spot && up(spot.tx, spot.ty) && up(spot.tx + 1, spot.ty) && up(spot.tx, spot.ty + 1) && up(spot.tx + 1, spot.ty + 1)) {
          out.push({ t: 'build', p, kind: TURRET, tx: spot.tx, ty: spot.ty });
          spend(TURRET);
          this.fortAt = t;
        }
      }
    }
    let reserve = 0, reserveGas = 0;
    if (want && wantAt) {
      if (afford(want)) {
        const spot = want === HALL
          ? { tx: Math.round(wantAt.x / TILE), ty: Math.round(wantAt.y / TILE) }
          : this.findSpot(v, want, wantAt, margin);
        if (spot && v.canPlace(want, spot.tx, spot.ty)) {
          out.push({ t: 'build', p, kind: want, tx: spot.tx, ty: spot.ty });
          spend(want);
        }
        this.bank = 0;
        this.bankGas = 0;
      } else {
        const share = t - this.threatSeen < 100 ? 0 : exposed ? 0.1 : unsafe ? 0.3 : 0.65;
        this.bank = Math.min(def(want).cost, this.bank + (Math.max(300, income) / 600) * every * share);
        this.bankGas = Math.min(def(want).gas, this.bankGas + ((builtRef * 170) / 600) * every * share);
        reserve = Math.min(this.bank, blocks);
        reserveGas = Math.min(this.bankGas, gas);
      }
    } else {
      this.bank = 0;
      this.bankGas = 0;
    }

    // ---------------------------------------------------------------- research
    if (!trick && this.level >= 1) {
      const lab = armories.find((e) => e.built && e.queue.length === 0);
      if (lab && !(unsafe && t - this.threatSeen < 100) && armyValue >= 400) {
        const kind = v.weapons <= v.armour ? F.research[0]! : F.research[1]!;
        const level = v[researchOf(kind)];
        if (level < RULES.researchMax) {
          const c = researchCost(kind, level);
          if (blocks - reserve >= c.cost && gas - reserveGas >= c.gas) {
            out.push({ t: 'research', p, kind });
            blocks -= c.cost;
            gas -= c.gas;
          }
        }
      }
    }

    // ---------------------------------------------------------------- army production
    const underAttack = t - this.threatSeen < 100;
    // Easy keeps a small army: it stops training at a cap that grows slowly after the first few minutes.
    const armyCap = this.level === 0 ? 450 + Math.max(0, Math.floor(((t - 2700) * 180) / 600)) : 1e9;
    const inQueue = F.units.reduce((s, k) => s + (isWorker(k) ? 0 : queued(k) * price(k)), 0);
    let supply = armyValue + inQueue >= armyCap ? v.cap : v.supply;
    const planned = new Map<number, number>();
    // Blocks an idle Factory or Airfield is waiting on: the Barracks leave that much alone.
    let saving = 0;
    const train = (makersOf: readonly Entity[], pick: () => Kind | 0, costly = false) => {
      // Idle buildings first, then a second unit in each queue; what is set aside for growth is left alone.
      for (const second of [false, true]) {
        for (const b of makersOf) {
          if (!b.built || b.queue.length !== (second ? 1 : 0)) continue;
          const kind = pick();
          if (!kind || supply + def(kind).supply > v.cap) continue;
          // Units that cost Batteries go ahead of the next building; the Barracks wait for both.
          if (!afford(kind, costly ? 0 : reserve + saving, reserveGas)) {
            if (costly && !second && gas >= def(kind).gas) saving += def(kind).cost;
            return;
          }
          out.push({ t: 'train', p, kind });
          spend(kind);
          supply += def(kind).supply;
          planned.set(kind, (planned.get(kind) ?? 0) + 1);
        }
      }
    };
    const have = (k: number) => all(k) + (planned.get(k) ?? 0);
    /** The kind furthest below its share, by the weights given. */
    const neediest = (weights: readonly (readonly [Kind, number])[]): Kind | 0 => {
      const total = weights.reduce((s, [k]) => s + have(k) * price(k), 0) + 1;
      const sum = weights.reduce((s, [, w]) => s + w, 0);
      let best: Kind | 0 = 0, bestGap = -1e9;
      for (const [k, w] of weights) {
        if (w <= 0) continue;
        const gap = w / sum - (have(k) * price(k)) / total;
        if (gap > bestGap) {
          bestGap = gap;
          best = k;
        }
      }
      return best;
    };
    const airShare = eAir / eAll, armShare = eArm / eAll, lightShare = eLight / eAll;
    const flak = have(K.Flak);
    // Its own answer to flyers, in Gunships it could face down: Troopers count for a little, Flak Tracks for a lot.
    const antiAir = count(K.Trooper) / 4 + flak;
    const needAA = airComing && antiAir < flyersSeen * 1.2 + (airNests > 0 ? 1.5 : 0);

    // Factories: Tanks against infantry, Mortars against Turrets and crowds, Flak Tracks against flyers, Juggernauts when it can.
    if (factories.some((e) => e.built)) {
      const heavy = heavies.some((e) => e.built);
      train(factories, () => {
        if (trick === 'tanks') return K.Tank;
        if (needAA && flak < Math.ceil(flyersSeen * 1.3) + 1) return K.Flak;
        const lancerHeavy = seen(K.Lancer) * 75 > eAll * 0.45;
        return neediest([
          [K.Tank, (this.tech === 'armour' ? 4 : 2) + (pusher ? 1 : 0) + lightShare * 3 - (lancerHeavy ? 2.5 : 0)],
          [K.Mortar, this.level === 0 ? 0 : (have(K.Mortar) >= (fortress ? 10 : 6) ? 0 : 0.8 + (fortress ? 2.5 : 0) + Math.min(2.4, enemyTurrets * 0.6) + lightShare)],
          [K.Jugger, heavy ? 5 : 0],
        ]);
      }, true);
    }
    // Airfields: Gunships, fewer the more Flak the enemy shows.
    if (airfields.some((e) => e.built)) {
      const gunshipCap = Math.max(2, 14 - Math.round(seen(K.Flak) * 3) - Math.round(seen(K.Trooper) / 6) - Math.round(seen(K.Spitter) / 5) - Math.round(seen(K.Ptero) * 1.5));
      train(airfields, () => (trick === 'gunships' || have(K.Gunship) < gunshipCap ? K.Gunship : 0), true);
    }
    if (!dino && builtRax.length > 0 && !techTrick) {
      const troopers = () => have(K.Trooper), lancers = () => have(K.Lancer), runners = () => have(K.Runner);
      // Lancers answer Turrets and armour; Troopers answer everything else, flyers included.
      let lancerShare = enemyTurrets > 0 ? Math.min(0.45, 0.2 + 0.08 * enemyTurrets) : t > 3000 ? 0.12 : 0;
      lancerShare = Math.min(0.7, lancerShare + armShare * 0.9);
      if (ghost(K.Factory) > 0 || ghost(K.Heavy) > 0 || ghost(K.Wallow) > 0 || ghost(K.Cave) > 0) lancerShare = Math.max(lancerShare, 0.3);
      if (needAA) lancerShare *= 0.4;
      let runnerWant = 0;
      if (this.level >= 1 && this.plan !== 'rush') {
        if (this.scoutsSent < 5 && scouts.length === 0 && t > 500) runnerWant += 1;
        // Raiders: three Runners from early on, whatever the tech path. The air path hands the job to Gunships once it has them.
        if (!fortress && t > (this.plan === 'standard' ? 1500 : 1900) && armyValue >= 350 && !(this.tech === 'air' && count(K.Gunship) >= 3)) runnerWant += (this.level === 2 ? 5 : 3) + (raider ? 4 : 0);
        if (seen(K.Lancer) >= 3) runnerWant += 3;
        if (seen(K.Mortar) >= 2) runnerWant += 4;
      }
      if (trick === 'troopers' || trick === 'turtle') {
        lancerShare = 0;
        runnerWant = 0;
      }
      train(builtRax, () => {
        if (trick === 'runners') return K.Runner;
        if (trick === 'lancers') return K.Lancer;
        if (runners() < runnerWant && !underAttack) return K.Runner;
        if (lancers() < Math.floor((troopers() + lancers() + runners() + 1) * lancerShare)) return K.Lancer;
        return K.Trooper;
      });
    }
    if (dino && builtRax.length > 0) {
      // The Dino Pack: every egg is a choice. What it hatches follows its path and what it has seen.
      const wallow = wallows.some((e) => e.built), roost = roosts.some((e) => e.built), cave = caves.some((e) => e.built);
      // Slow shooters are food for Raptors and Pteros; splash is what kills a swarm.
      const slow = (seen(K.Lancer) * price(K.Lancer) + seen(K.Mortar) * price(K.Mortar)) / eAll;
      const splash = (seen(K.Tank) * price(K.Tank) + seen(K.Jugger) * price(K.Jugger) + seen(K.Bronto) * price(K.Bronto)) / eAll;
      const lancerHeavy = seen(K.Lancer) * price(K.Lancer) > eAll * 0.45;
      // What the enemy can shoot upward with sets how many Pteros are worth having.
      const upShooters = seen(K.Trooper) / 5 + seen(K.Spitter) / 4 + seen(K.Flak) * 1.5 + seen(K.Ptero) * 0.8 + enemyTurrets * 0.7;
      const pteroCap = Math.max(2, 14 - Math.round(upShooters));
      const needUp = airComing && have(K.Spitter) / 3 + have(K.Ptero) < flyersSeen * 1.2 + (airNests > 0 ? 1.5 : 0);
      const swarm = this.tech === 'infantry', herd = this.tech === 'armour', flock = this.tech === 'air';
      const cheap = (): Kind => neediest([
        [K.Raptor, (swarm ? 4 : 2.5) + slow * 4 - splash * 3 - Math.min(1.5, enemyTurrets * 0.3)],
        [K.Spitter, (swarm ? 3 : 1.5) + airShare * 6 + lightShare],
      ]) || K.Raptor;
      const pick = (): Kind | 0 => {
        if (trick === 'raptors') return K.Raptor;
        if (trick === 'spitters') return K.Spitter;
        if (trick === 'horns') return wallow ? K.Horn : 0;
        if (trick === 'pteros') return roost ? K.Ptero : 0;
        if (needUp) return K.Spitter;
        return neediest([
          [K.Raptor, (swarm ? 4 : 2.5) + slow * 4 - splash * 3 - Math.min(1.5, enemyTurrets * 0.3)],
          [K.Spitter, (swarm ? 3 : 1.5) + airShare * 6 + lightShare],
          [K.Horn, wallow ? (herd ? 4 : flock ? 3 : 2) + lightShare * 3 - (lancerHeavy ? 2 : 0) + Math.min(1.5, enemyTurrets * 0.4) : 0],
          [K.Bronto, wallow && this.level > 0 && have(K.Bronto) < 5 ? (herd ? 2 : 0.8) + Math.min(2.4, enemyTurrets * 0.6) + lightShare : 0],
          [K.Ptero, roost && have(K.Ptero) < pteroCap ? (flock ? 4.5 : 1.5) + armShare * 3 + slow * 2 : 0],
          [K.Rex, cave ? 5 + armShare * 3 : 0],
        ]) || K.Raptor;
      };
      const hatch = (kind: Kind): boolean => {
        const d = def(kind);
        if (supply + d.supply * d.brood > v.cap) return false;
        // Dinosaurs that cost Batteries go ahead of the next building; the cheap ones wait for both.
        if (!afford(kind, d.gas > 0 ? 0 : reserve + saving, reserveGas)) return false;
        out.push({ t: 'train', p, kind });
        spend(kind);
        supply += d.supply * d.brood;
        planned.set(kind, (planned.get(kind) ?? 0) + d.brood);
        eggs--;
        this.armyEggs++;
        return true;
      };
      while (eggs > 0) {
        const kind = pick();
        if (!kind) break;
        if (hatch(kind)) continue;
        if (trick) break;
        const d = def(kind);
        if (d.gas === 0) break;
        // The big one it wants is not paid for yet. With the Batteries in hand, its Blocks are left alone; either
        // way a spare egg becomes something small sooner than it sits in a full Nest.
        if (gas >= d.gas) saving += d.cost;
        if (eggs < builtHQ.length * 2 || !hatch(cheap())) break;
      }
    }
    if (armyFirst) trainWorkers();

    // ---------------------------------------------------------------- army control
    const stage = this.staging(v);
    const cen = (us: readonly Entity[]): Pt => ({
      x: rx(v, us.reduce((s, e) => s + e.x, 0) / Math.max(1, us.length)),
      y: ry(v, us.reduce((s, e) => s + e.y, 0) / Math.max(1, us.length)),
    });
    const order = (group: number, mode: number, at: Pt) => {
      out.push({ t: 'order', p, group, mode: mode as 1 | 2 | 3, x: at.x, y: at.y });
    };
    const foes = v.enemies.filter((e) => !def(e.kind).building && !isWorker(e.kind) && e.kind !== K.Egg);
    const myBuildings = v.own.filter((e) => def(e.kind).building);
    const threats = foes.filter((e) => myBuildings.some((b) => within(e, b, 13)));
    if (threats.length > 0) this.threatSeen = t;
    const threatPower = threats.reduce((s, e) => s + power(e), 0);
    const armyCen = cen(army);
    const ownNear = army.filter((e) => within(e, armyCen, 9)).reduce((s, e) => s + power(e), 0);
    const foeNear = v.enemies.filter((e) => within(e, armyCen, 11)).reduce((s, e) => s + power(e), 0);
    const due = t - this.lastOrder >= 60;

    // Enemy buildings this side knows about, nearest first; with none known, walk the enemy's base sites.
    // High ground is a different matter: a ramp is climbed only on a hunch (a rush, Easy), with a crushing
    // lead, or at full strength. Short of that the army takes what stands on low ground and then waits
    // below the ramp, out of reach, while its own side grows.
    const isHigh = (pt: Pt) => onLayer(v, v.map.high, pt);
    const highTurrets = v.ghosts.filter((gh) => (gh.kind === K.Turret || gh.kind === K.Volcano) && isHigh(gh)).length;
    const climb = this.allIn || v.supply >= RULES.supplyMax - 4 || armyValue >= this.enemySeen * 2.2 + highTurrets * 300 + 400;
    const pickTarget = (from: Pt): Pt | null => {
      // A rush's first push goes for the Workers at the enemy's main, past whatever guards the nearer base,
      // until it stands among their Blocks and sees nobody left to hit there.
      if (this.plan === 'rush' && this.allIn && this.firstAttack >= 0 && t - this.firstAttack < 1200) {
        const main = this.pileCentre(theirs[0]!);
        const there = within(from, main, 5);
        if (!there || v.enemies.some((e) => isWorker(e.kind) && within(e, main, 8))) return main;
      }
      const known = v.ghosts.filter((gh) => climb || !isHigh(gh));
      // Prefer the nearest Headquarters, then anything else.
      const hq = known.filter((gh) => isHall(gh.kind)).sort((a, b) => d2(a, from) - d2(b, from))[0];
      if (hq) return { x: hq.x, y: hq.y };
      const other = known.sort((a, b) => d2(a, from) - d2(b, from))[0];
      if (other) return { x: other.x, y: other.y };
      const order2 = climb ? [theirs[0]!, theirs[1]!, theirs[2]!, theirs[3]!] : [theirs[1]!, theirs[2]!, theirs[3]!];
      for (const s of order2) {
        if (!this.visited.has(s.id)) return this.siteCentre(s);
      }
      if (!climb) return this.siteCentre(theirs[1]!);
      this.visited.clear();
      return this.siteCentre(theirs[0]!);
    };
    for (const s of theirs) {
      // A site the army can see with nothing on it is crossed off.
      const c = this.siteCentre(s);
      if (onLayer(v, v.vis, c) && !v.ghosts.some((gh) => within(gh, c, 5))) this.visited.add(s.id);
    }

    if (army.length > 0) {
      if (this.state !== 'defend' && threatPower >= 60 && ownNear + 100 >= threatPower * 0.6
        && (this.state !== 'attack' || threatPower >= 250 || d2(armyCen, stage) < d2(armyCen, this.target ?? stage))) {
        this.state = 'defend';
        this.lastOrder = -999;
      }
      switch (this.state) {
        case 'gather': {
          // Known Turrets raise the size of army it wants before it goes, unless it has the tools for them.
          const knownTurrets = trick ? 0 : enemyTurrets;
          const siege = dino
            ? count(K.Bronto) * price(K.Bronto) + count(K.Horn) * price(K.Horn) * 0.5 + count(K.Rex) * price(K.Rex) * 0.3
            : count(K.Lancer) * 75 + count(K.Mortar) * price(K.Mortar) + count(K.Jugger) * price(K.Jugger) * 0.5;
          const turretTax = Math.max(0, knownTurrets * 240 - siege);
          const tooSoon = this.level === 0 && t < 2700;
          // A full supply bar means the army is as big as it is going to get.
          // A full bar on two bases is a reason to take a third; only a full bar with nowhere left to grow sends the army.
          const maxed = v.supply >= v.cap - 3 && (v.cap >= RULES.supplyMax || !nextSite || this.level === 0)
            && armyValue >= Math.max(400, this.enemySeen) && t - this.retreatAt > 900;
          // A rush's first push goes on a hunch. Otherwise the first seven minutes belong to raids: the army
          // goes only against an enemy it has seen next to nothing of. After that it wants a clear lead over
          // what it has seen, or a full supply bar.
          const hunch = this.level === 0 || trick !== undefined || (this.plan === 'rush' && this.firstAttack < 0);
          // Against another Dino Pack a Horn charge may go from five and a half minutes, once its Horns are out:
          // a Dino Pack's greed has to be punished early.
          const early = !hunch && t < (pusher && dino && v.foe === 'dino' ? 3300 : 4200);
          // An Armour push goes at about seven minutes once its heavies are out, on a smaller edge: that is
          // the push. A Raider's main army waits for a bigger edge, its raids doing the work meanwhile.
          const heavies = dino ? count(K.Horn) + count(K.Bronto) + count(K.Rex) : count(K.Tank) + count(K.Mortar) + count(K.Jugger);
          const pushing = pusher && !early && heavies >= 4;
          const edge = hunch ? 1.15 : early ? 3 : pushing ? 1.2 : raider ? 2 : 1.5;
          // A Fortress stays behind its walls until its Juggernauts are out, or its supply bar is full. A Den does
          // not wait for its Rexes: a Dino Pack that sits still is outgrown by one that doesn't.
          const holding = fortress && !dino && !maxed && count(K.Jugger) < 2;
          // Early on it also wants to have looked lately: no walking across the map on a guess.
          const blind = early && t - this.lookedAt > 600;
          if (!tooSoon && !blind && !holding && ((maxed && !early) || armyValue >= Math.max(this.waveAt, trick ? 0 : this.enemySeen * edge) + turretTax)) {
            this.state = 'attack';
            this.allIn = hunch;
            this.waveStart = armyValue;
            this.target = pickTarget(armyCen);
            this.lastOrder = -999;
            if (this.firstAttack < 0) this.firstAttack = t;
            // A big army opens a second front: a detachment goes for another base at the same time.
            if (this.level >= 1 && !trick && armyValue >= 1000) this.frontAt = t;
          } else if (t - this.lastOrder >= 100 && army.some((e) => !within(e, stage, 6))) {
            order(ARMY, O.Attack, stage);
            this.lastOrder = t;
          }
          break;
        }
        case 'attack': {
          const lenient = this.level === 0 ? 2.2 : 1.2;
          // Pull out while there is still an army to pull out: at four tenths lost with the fight still on,
          // or as soon as it is plainly outgunned.
          const bleeding = this.level >= 1 && armyValue < this.waveStart * 0.6 && foeNear > ownNear * 0.5;
          if (armyValue < this.waveStart * 0.3 || bleeding || (foeNear > ownNear * lenient && foeNear > 150)) {
            this.state = 'retreat';
            this.retreatAt = t;
            this.waveAt = Math.round(Math.max(this.waveAt * 1.15, armyValue * 1.3 + 150));
            order(ARMY, O.Move, stage);
            this.lastOrder = t;
            break;
          }
          if (due || !this.target) {
            this.target = pickTarget(armyCen);
            if (this.target) order(ARMY, O.Attack, this.target);
            this.lastOrder = t;
          }
          break;
        }
        case 'defend': {
          if (threats.length === 0) {
            if (t - this.threatSeen > 50) {
              this.state = 'gather';
              this.lastOrder = -999;
            }
          } else if (t - this.lastOrder >= 30) {
            // Outnumbered: fight beside the nearest Turret or Headquarters, not out in the open.
            const tc = cen(threats);
            const cover2 = [...turrets.filter((e) => e.built), ...builtHQ].sort((a, b) => d2(a, tc) - d2(b, tc))[0];
            // Lancers outrange Turrets, so against them it goes out to meet them, but only at something like even strength.
            const outgunned = threatPower > ownNear * 0.9;
            const sally = this.lancersSeen >= 0.5 && ownNear >= threatPower * 0.7;
            if (cover2 && outgunned && !sally && !within(tc, cover2, 5)) order(ARMY, O.Attack, { x: rx(v, (cover2.x * 3 + tc.x) / 4), y: ry(v, (cover2.y * 3 + tc.y) / 4) });
            else if (this.level >= 1 && outgunned && !sally && !cover2) order(ARMY, O.Attack, stage);
            else order(ARMY, O.Attack, tc);
            this.lastOrder = t;
          }
          break;
        }
        case 'retreat': {
          // Home means most of the army is back at the gathering point, not that the stragglers have dragged its middle there.
          const home = army.filter((e) => within(e, stage, 6)).length >= army.length * 0.7;
          if (home || t - this.retreatAt > 700) {
            this.state = 'gather';
            this.lastOrder = -999;
          } else if (t - this.lastOrder >= 80) {
            order(ARMY, O.Move, stage);
            this.lastOrder = t;
          }
          break;
        }
      }
    } else if (this.state !== 'gather') {
      this.state = 'gather';
      this.waveAt = Math.round(this.waveAt * 1.1);
    }

    // ---------------------------------------------------------------- scouting and raids
    if (this.level >= 1 && !trick && this.plan !== 'rush') {
      const idleRunners = army.filter((e) => e.kind === RUNNER);
      // The air path raids with its flyers; the others with Runners, or with a pack of Raptors.
      const flying = this.tech === 'air' && (raiders.some((e) => e.kind === FLYER) || count(FLYER) >= 3);
      const need = flying ? 3 : dino ? (this.level === 2 ? 8 : 6) + (raider ? 2 : 0) : (this.level === 2 ? 5 : 3) + (raider ? 3 : 0);
      // A second front opens only against a second base, and only in the moments the main army sets out.
      const held = theirs.filter((s) => s.tier === 0 || v.ghosts.some((gh) => isHall(gh.kind) && within(gh, this.siteCentre(s), 4)));
      const front = this.state === 'attack' && t - this.frontAt < 60 && held.length >= 2 && this.target !== null;
      const frontNeed = flying ? 3 : dino ? 5 : 3;
      if (scouts.length === 0 && this.scoutsSent < 5 && idleRunners.length > 0) {
        out.push({ t: 'assign', p, from: ARMY, to: SCOUT, kind: RUNNER, count: 1 });
        this.scoutsSent++;
        this.scoutLeg = 0;
        this.scoutSince = -999;
      } else if (this.raid.state === 'home' && front && raiders.length < frontNeed) {
        // The detachment for a second front is taken from the army as it sets out: its fast units, or its flyers.
        const kind = flying ? FLYER : RUNNER;
        if (army.some((e) => e.kind === kind)) out.push({ t: 'assign', p, from: ARMY, to: RAID, kind, count: frontNeed - raiders.length });
      } else if (this.raid.state === 'home' && this.state !== 'defend' && !fortress) {
        if (flying) {
          const spare = army.filter((e) => e.kind === FLYER).length;
          if (raiders.length < need && spare > 0) out.push({ t: 'assign', p, from: ARMY, to: RAID, kind: FLYER, count: need - raiders.length });
        } else if (dino) {
          // Raptors are the army too: a pack goes raiding only when the army can spare it.
          const short2 = need - raiders.length;
          if (short2 > 0 && t > (this.plan === 'standard' ? 1500 : 1900) && t - this.threatSeen > 300 && armyValue >= (raider ? 250 : 350) && !unsafe && idleRunners.length >= short2 + (raider ? 2 : 4)) {
            out.push({ t: 'assign', p, from: ARMY, to: RAID, kind: RUNNER, count: short2 });
          }
        } else if (idleRunners.length > 0) {
          out.push({ t: 'assign', p, from: ARMY, to: RAID, kind: K.Runner, count: 0 });
        }
      }
      if (scouts.length > 0) {
        const legs: Pt[] = [this.siteCentre(theirs[1]!), this.siteCentre(theirs[2]!), this.siteCentre(theirs[3]!), this.pileCentre(theirs[1]!), stage];
        const leg = legs[this.scoutLeg % legs.length]!;
        if (this.scoutSince < 0 || within(scouts[0]!, leg, 4) || t - this.scoutSince > 450) {
          if (this.scoutSince >= 0) this.scoutLeg++;
          order(SCOUT, O.Move, legs[this.scoutLeg % legs.length]!);
          this.scoutSince = t;
        }
      }
      const r = this.raid;
      if (raiders.length === 0) {
        if (r.state !== 'home') {
          r.state = 'home';
          r.next = t + (raider ? 200 : 400);
        }
      } else if (r.state === 'home') {
        if (front && raiders.length >= frontNeed) {
          // The second front: whichever held base is furthest from where the main army is going.
          const aim = this.target!;
          const s = [...held].sort((a, b) => d2(this.pileCentre(b), aim) - d2(this.pileCentre(a), aim) || a.tier - b.tier)[0]!;
          r.target = this.pileCentre(s);
          r.state = 'out';
          r.since = t;
          this.frontAt = -9999;
          order(RAID, flying ? O.Attack : O.Move, r.target);
        } else if (raiders.length >= need && t >= r.next) {
          // Raid a base the enemy is known or likely to hold, picked at random.
          const s = held[Math.floor(this.rnd() * held.length)]!;
          r.target = this.pileCentre(s);
          r.state = 'out';
          r.since = t;
          order(RAID, flying ? O.Attack : O.Move, r.target);
        } else if (t % 100 === 0 && raiders.some((e) => !within(e, stage, 7))) {
          order(RAID, O.Move, stage);
        }
      } else if (r.state === 'out') {
        const rc = cen(raiders);
        const mineP = raiders.reduce((s, e) => s + power(e), 0);
        // Flyers fear only what can shoot up.
        const foeP = v.enemies.filter((e) => within(e, rc, 8) && (!flying || def(e.kind).vs[2] > 0)).reduce((s, e) => s + power(e) * (flying && e.kind === K.Flak ? 3 : 1), 0);
        const prey = v.enemies.some((e) => isWorker(e.kind) && within(e, rc, 9));
        const there = r.target && within(rc, r.target, 5);
        if (foeP > mineP * (flying ? 0.5 : 1.1) || t - r.since > 700 || (there && !prey && t - r.since > 150)) {
          r.state = 'back';
          r.since = t;
          order(RAID, O.Move, stage);
        }
      } else if (within(cen(raiders), stage, 7) || t - r.since > 500) {
        r.state = 'home';
        r.next = t + (raider ? 120 : 250);
      }
    }

    // ---------------------------------------------------------------- conceding
    // A match it can't win back: next to no workers, next to no army, nothing in the bank to rebuild with, and
    // an enemy army it has seen many times the size of its own, for half a minute together. Then it concedes.
    const lost = t > 3600 && workers <= 3 && armyValue * 5 < this.enemySeen && this.enemySeen >= 800 && v.blocks < 200;
    if (!lost) this.hopeless = -1;
    else if (this.hopeless < 0) this.hopeless = t;
    else if (t - this.hopeless >= 300 && !this.conceded && !trick) {
      this.conceded = true;
      out.push({ t: 'concede', p });
    }
    return out;
  }
}
