// The computer opponent. It reads the match only through a View (its own units, what they can see,
// and what it remembers) and acts only through the same commands a player gives.
import { DEFS, def } from '../sim/data';
import { power, type View } from '../sim/view';
import { K, O, TILE, type BaseSite, type Command, type Entity, type Kind } from '../sim/types';

export type Plan = 'rush' | 'standard' | 'greedy';
export const PLANS: Plan[] = ['rush', 'standard', 'greedy'];
/** Fixed builds with no adapting, used by the lab to prove one-trick play loses. */
export type Trick = 'troopers' | 'runners' | 'lancers' | 'turtle';

export interface BotOptions {
  plan?: Plan;
  /** 0 Easy, 1 Normal, 2 Hard. */
  level?: number;
  trick?: Trick;
}

interface Pt { x: number; y: number }

const ARMY = 0, RAID = 1, SCOUT = 2;
const d2 = (a: Pt, b: Pt) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const within = (a: Pt, b: Pt, tiles: number) => d2(a, b) <= tiles * TILE * tiles * TILE;

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
  readonly plan: Plan;
  readonly level: number;
  readonly trick: Trick | undefined;
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
  /** The largest enemy force seen lately, fading over a minute or so. */
  private enemySeen = 0;
  private lancersSeen = 0;
  /** Tick of this bot's first attack order, for the lab. */
  firstAttack = -1;

  constructor(readonly p: number, seed: number, opts: BotOptions = {}) {
    this.rnd = rng(seed * 7919 + p * 104729 + 13);
    this.level = opts.level ?? 1;
    this.trick = opts.trick;
    // Easy never rushes: a newcomer gets a few minutes to find the controls.
    // Otherwise the safe expansion is the most common opening, the rush the rarest.
    const pool: Plan[] = this.level === 0 ? ['standard', 'greedy'] : ['standard', 'standard', 'standard', 'greedy', 'greedy', 'rush', 'rush'];
    this.plan = opts.plan ?? pool[Math.floor(this.rnd() * pool.length)]!;
    const base = this.level === 0 ? 400 : this.plan === 'rush' ? 300 : this.plan === 'standard' ? 560 : 950;
    // No two matches open quite alike: each bot's first push comes a little earlier or later.
    this.waveAt = Math.round(base * (0.9 + this.rnd() * 0.25));
    if (this.trick) this.waveAt = 600;
    this.phase = Math.floor(this.rnd() * 12);
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
    const mid = { x: (v.map.w * TILE) / 2, y: (v.map.h * TILE) / 2 };
    const dx = mid.x - nat.x, dy = mid.y - nat.y;
    const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
    return { x: Math.round(nat.x + (dx * 3 * TILE) / l), y: Math.round(nat.y + (dy * 3 * TILE) / l) };
  }

  /** A free spot for a building near a point, leaving a path around it and the Workers' lanes clear. */
  private findSpot(v: View, kind: Kind, near: Pt, margin: number): { tx: number; ty: number } | null {
    const size = def(kind).size;
    const cx = Math.floor(near.x / TILE - size / 2), cy = Math.floor(near.y / TILE - size / 2);
    const inLane = (tx: number, ty: number) => {
      for (const b of v.map.bases) {
        let x0 = b.hx, y0 = b.hy, x1 = b.hx + 3, y1 = b.hy + 3;
        for (const p of b.piles) {
          x0 = Math.min(x0, p.tx);
          y0 = Math.min(y0, p.ty);
          x1 = Math.max(x1, p.tx);
          y1 = Math.max(y1, p.ty);
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
    const mine = this.sites(v, p), theirs = this.sites(v, 1 - p);
    const count = (k: number) => v.own.filter((e) => e.kind === k).length;
    const queued = (k: number) => v.own.reduce((s, e) => s + e.queue.filter((q) => q === k).length, 0);
    const hqs = v.own.filter((e) => e.kind === K.HQ);
    const builtHQ = hqs.filter((e) => e.built);
    const rax = v.own.filter((e) => e.kind === K.Barracks);
    const builtRax = rax.filter((e) => e.built);
    const turrets = v.own.filter((e) => e.kind === K.Turret);
    const workers = count(K.Worker) + queued(K.Worker);
    const army = v.own.filter((e) => e.group === ARMY && !def(e.kind).building);
    const raiders = v.own.filter((e) => e.group === RAID);
    const scouts = v.own.filter((e) => e.group === SCOUT);
    const armyValue = army.reduce((s, e) => s + def(e.kind).cost, 0);
    const t = v.tick;
    // What it has seen of the enemy's army sets how much army it wants at home before it spends on growth.
    const seenNow = v.enemies.filter((e) => !def(e.kind).building && e.kind !== K.Worker);
    const seenPower = seenNow.reduce((s2, e) => s2 + power(e), 0);
    if (seenPower >= this.enemySeen) {
      this.enemySeen = seenPower;
      this.lancersSeen = seenNow.length ? seenNow.filter((e) => e.kind === K.Lancer).length / seenNow.length : 0;
    } else {
      this.enemySeen *= 0.994;
    }
    const homePower = army.reduce((s2, e) => s2 + power(e), 0) + turrets.reduce((s2, e) => s2 + power(e), 0);
    const oneBase = this.visited.has(this.sites(v, 1 - this.p)[1]!.id) && !v.ghosts.some((gh) => gh.kind === K.HQ && !within(gh, this.siteCentre(this.sites(v, 1 - this.p)[0]!), 6));
    let floor = (this.level === 0 ? 90 : 150) * (t / 600) * (oneBase && t > 1200 && t < 4200 ? 1.5 : 1);
    floor = Math.max(floor, this.enemySeen * (this.level === 0 ? 0.6 : 0.95));
    const unsafe = !this.trick && homePower < floor;
    let blocks = v.blocks;
    const spend = (n: number) => {
      blocks -= n;
    };

    // ---------------------------------------------------------------- economy
    const workerCap = this.level === 0 ? 16 : this.level === 2 ? 48 : 42;
    let workerTarget = Math.min(workerCap, 14 * builtHQ.length + 6 * (hqs.length - builtHQ.length));
    if (this.plan === 'rush' && rax.length < 2 && !this.trick) workerTarget = Math.min(workerTarget, 11);
    if (this.trick) workerTarget = 14;
    // Safety first: an expanding opening holds at 16 Workers until it has a few soldiers at home.
    if (!this.trick && this.plan !== 'rush' && t < 2400 && rax.length > 0 && v.own.filter((e) => e.kind === K.Trooper).length < 4) {
      workerTarget = Math.min(workerTarget, 16);
    }
    // Short of army for what it has seen: no more Workers until that is put right.
    if (unsafe && t > 900) workerTarget = Math.min(workerTarget, 16);
    for (const hq of builtHQ) {
      if (hq.queue.length === 0 && workers < workerTarget && blocks >= 50 && v.supply < v.cap) {
        out.push({ t: 'train', p, kind: K.Worker });
        spend(50);
        break;
      }
    }

    // What the plan wants built next. Blocks are held back for it until it is placed.
    let want: Kind | 0 = 0;
    let wantAt: Pt | null = null;
    let margin = 1;
    const nextSite = mine.find((s) => !v.own.some((e) => e.kind === K.HQ && within(e, this.siteCentre(s), 3))
      && !v.ghosts.some((gh) => within(gh, this.siteCentre(s), 4)) && v.canPlace(K.HQ, s.hx, s.hy));
    const growing = hqs.length > builtHQ.length;
    const saturated = count(K.Worker) >= 12 * builtHQ.length;
    const income = count(K.Worker) * 62;
    // Enough Barracks to turn the income into soldiers, and one more whenever Blocks pile up unspent.
    const hqsTraining = workers < workerTarget ? builtHQ.length : 0;
    let raxWant = Math.max(0, Math.floor((income - 300 * hqsTraining) / 200));
    if (blocks >= 250 && rax.length === builtRax.length && builtRax.length > 0 && builtRax.every((b) => b.queue.length >= 1)) raxWant = Math.max(raxWant, rax.length + 1);
    raxWant = Math.min(this.level === 0 ? 2 : this.level === 2 ? 10 : 8, raxWant);
    if (this.plan === 'rush') raxWant = Math.max(raxWant, 2);
    else if (this.plan === 'standard') raxWant = Math.max(raxWant, 3);
    else raxWant = Math.max(raxWant, hqs.length >= 2 ? 1 : 0);
    if (this.trick) raxWant = this.trick === 'turtle' ? 2 : 4;

    if (builtHQ.length === 0 && hqs.length === 0) {
      // Lost every Headquarters: rebuild if the Blocks are there.
      if (nextSite) {
        want = K.HQ;
        wantAt = { x: nextSite.hx * TILE, y: nextSite.hy * TILE };
      }
    } else if (!this.trick && nextSite && !growing) {
      let expand = false;
      if (hqs.length === 1) {
        if (this.plan === 'greedy') expand = true;
        else if (this.plan === 'standard') expand = rax.length >= 3 && (armyValue >= 550 || t > 2700) && !unsafe;
        else expand = t > 2400 || (rax.length >= 2 && blocks > 500);
      } else {
        const minT = this.plan === 'greedy' ? 2600 : this.plan === 'standard' ? 3200 : 4200;
        expand = saturated && t > minT * (hqs.length - 1) && armyValue >= 300 && !unsafe;
      }
      // Easy stays on one base for five minutes and never takes a third.
      if (this.level === 0 && (hqs.length >= 2 || t < 3000)) expand = false;
      // Blocks nearly gone under every Headquarters: expand whatever the danger.
      const left = v.piles.filter((pl) => builtHQ.some((h) => within(pl, h, 10))).reduce((s2, pl) => s2 + pl.amount, 0);
      if (builtHQ.length > 0 && left < 1500 * builtHQ.length) expand = true;
      if (expand) {
        want = K.HQ;
        wantAt = { x: nextSite.hx * TILE, y: nextSite.hy * TILE };
      }
    }
    // Expanding openings cover the new base with a Turret on the side the enemy comes from.
    // Seeing a bigger army than its own adds Turrets, unless that army is mostly Lancers, which outrange them.
    const short = this.enemySeen - army.reduce((s2, e) => s2 + power(e), 0);
    let extra = this.level >= 1 && short > 0 && this.lancersSeen < 0.5 ? Math.min(3, Math.ceil(short / 220)) : 0;
    // An enemy still on one base after two minutes is building an army, not an economy: one Turret as insurance.
    if (this.level >= 1 && oneBase && t > 1200 && t < 4200 && this.lancersSeen < 0.5) extra = Math.max(extra, 1);
    // A rush that has had its go digs in too; a fast expansion covers itself twice.
    const cover = (this.plan === 'greedy' ? 2 : this.plan === 'standard' ? 1 : t > 1500 ? 1 : 0) + extra;
    const wantsTurret = this.trick === 'turtle' ? turrets.length < 6
      : !this.trick && (hqs.length >= 2 || extra > 0 || (this.plan !== 'greedy' && rax.length >= 2)) && turrets.length < Math.max(cover, this.level === 2 ? hqs.length - 1 : 0);
    if (!want && builtRax.length > 0 && wantsTurret) {
      const b = mine[this.trick ? turrets.length % 2 : 1]!;
      const hc = this.siteCentre(b);
      const mid = { x: (v.map.w * TILE) / 2, y: (v.map.h * TILE) / 2 };
      const dx = mid.x - hc.x, dy = mid.y - hc.y;
      const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
      const side = turrets.length % 2 === 0 ? 1 : -1;
      want = K.Turret;
      const spread = 2 + Math.floor(turrets.length / 2) * 3;
      wantAt = { x: Math.round(hc.x + (dx * 5 * TILE) / l - (dy * side * spread * TILE) / l), y: Math.round(hc.y + (dy * 5 * TILE) / l + (dx * side * spread * TILE) / l) };
      margin = 0;
    }
    if (!want && rax.length < raxWant && builtHQ.length > 0) {
      want = K.Barracks;
      // Barracks go on the far side of the Headquarters from the Blocks.
      const home = rax.length < 5 ? mine[0]! : mine[1]!;
      const hc = this.siteCentre(home), pc = this.pileCentre(home);
      const horizontal = Math.abs(hc.x - pc.x) >= Math.abs(hc.y - pc.y);
      wantAt = horizontal
        ? { x: hc.x + Math.sign(hc.x - pc.x) * 8 * TILE, y: hc.y }
        : { x: hc.x, y: hc.y + Math.sign(hc.y - pc.y) * 7 * TILE };
    }
    // A raid on the Workers gets a Turret in reply.
    if (v.hurt.length > 0 && builtRax.length > 0 && !this.trick && t - this.turretAsked > 250) {
      const h = v.hurt[0]!;
      const near = turrets.filter((e) => within(e, h, 7)).length;
      if (near < (this.level === 2 ? 2 : 1) && blocks >= 100) {
        const spot = this.findSpot(v, K.Turret, h, 0);
        if (spot) {
          out.push({ t: 'build', p, kind: K.Turret, tx: spot.tx, ty: spot.ty });
          spend(100);
          this.turretAsked = t;
        }
      }
    }
    // A base facing more than its defenders can handle gets Turrets between it and the threat.
    {
      const foesNear = v.enemies.filter((e) => !def(e.kind).building && e.kind !== K.Worker
        && v.own.some((b) => def(b.kind).building && within(e, b, 16)));
      if (foesNear.length > 0 && builtRax.length > 0 && !this.trick && this.level >= 1 && t - this.panicAt >= 60 && blocks >= 100) {
        const fx = Math.round(foesNear.reduce((s2, e) => s2 + e.x, 0) / foesNear.length);
        const fy = Math.round(foesNear.reduce((s2, e) => s2 + e.y, 0) / foesNear.length);
        const foeP = foesNear.reduce((s2, e) => s2 + power(e), 0);
        const base = [...hqs].sort((a, b) => d2(a, { x: fx, y: fy }) - d2(b, { x: fx, y: fy }))[0];
        if (base) {
          const homeP = v.own.filter((e) => within(e, base, 12)).reduce((s2, e) => s2 + power(e), 0);
          const nearTurrets = turrets.filter((e) => within(e, base, 9)).length;
          if (foeP > homeP * 0.9 && nearTurrets < 4) {
            const dx = fx - base.x, dy = fy - base.y;
            const l = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
            const spot = this.findSpot(v, K.Turret, { x: Math.round(base.x + (dx * 4 * TILE) / l), y: Math.round(base.y + (dy * 4 * TILE) / l) }, 0);
            if (spot) {
              out.push({ t: 'build', p, kind: K.Turret, tx: spot.tx, ty: spot.ty });
              spend(100);
              this.panicAt = t;
            }
          }
        }
      }
    }
    let reserve = 0;
    if (want && wantAt) {
      const cost = def(want).cost;
      if (blocks >= cost) {
        const spot = want === K.HQ
          ? { tx: Math.round(wantAt.x / TILE), ty: Math.round(wantAt.y / TILE) }
          : this.findSpot(v, want, wantAt, margin);
        if (spot && v.canPlace(want, spot.tx, spot.ty)) {
          out.push({ t: 'build', p, kind: want, tx: spot.tx, ty: spot.ty });
          spend(cost);
        }
      } else {
        reserve = cost;
      }
    }

    // ---------------------------------------------------------------- army production
    const underAttack = t - this.threatSeen < 100;
    if (builtRax.length > 0) {
      const enemyTurrets = v.ghosts.filter((gh) => gh.kind === K.Turret).length;
      const enemyLancers = v.enemies.filter((e) => e.kind === K.Lancer).length;
      const troopers = count(K.Trooper) + queued(K.Trooper);
      const lancers = count(K.Lancer) + queued(K.Lancer);
      const runners = count(K.Runner) + queued(K.Runner);
      const total = troopers + lancers + runners;
      let lancerShare = enemyTurrets > 0 ? Math.min(0.45, 0.2 + 0.08 * enemyTurrets) : t > 3000 ? 0.12 : 0;
      let runnerWant = 0;
      if (this.level >= 1 && this.plan !== 'rush') {
        if (this.scoutsSent < 3 && scouts.length === 0 && t > 500) runnerWant += 1;
        if (t > (this.plan === 'standard' ? 1500 : 1900) && armyValue >= 400) runnerWant += this.level === 2 ? 5 : 3;
        if (enemyLancers >= 3) runnerWant += 3;
      }
      if (this.trick === 'troopers' || this.trick === 'turtle') {
        lancerShare = 0;
        runnerWant = 0;
      }
      const pick = (): Kind => {
        if (this.trick === 'runners') return K.Runner;
        if (this.trick === 'lancers') return K.Lancer;
        if (runners < runnerWant && !underAttack) return K.Runner;
        if (lancers < Math.floor((total + 1) * lancerShare)) return K.Lancer;
        return K.Trooper;
      };
      // Easy keeps a small army: it stops training at a cap that grows slowly after the first few minutes.
      const armyCap = this.level === 0 ? 450 + Math.max(0, Math.floor(((t - 2700) * 180) / 600)) : 1e9;
      // Idle Barracks come first, whatever is being saved for; a second unit in the queue waits for spare Blocks.
      let supply = armyValue + queued(K.Trooper) * 50 + queued(K.Lancer) * 75 >= armyCap ? v.cap : v.supply;
      for (const second of [false, true]) {
        for (const b of builtRax) {
          if (b.queue.length !== (second ? 1 : 0) || supply >= v.cap) continue;
          const kind = pick();
          const cost = def(kind).cost;
          const keep = second && !underAttack && !unsafe ? reserve : 0;
          if (blocks - keep < cost) break;
          out.push({ t: 'train', p, kind });
          spend(cost);
          supply++;
        }
      }
    }

    // ---------------------------------------------------------------- army control
    const stage = this.staging(v);
    const cen = (us: readonly Entity[]): Pt => ({
      x: Math.round(us.reduce((s, e) => s + e.x, 0) / Math.max(1, us.length)),
      y: Math.round(us.reduce((s, e) => s + e.y, 0) / Math.max(1, us.length)),
    });
    const order = (group: number, mode: number, at: Pt) => {
      out.push({ t: 'order', p, group, mode: mode as 1 | 2 | 3, x: at.x, y: at.y });
    };
    const foes = v.enemies.filter((e) => !def(e.kind).building && e.kind !== K.Worker);
    const myBuildings = v.own.filter((e) => def(e.kind).building);
    const threats = foes.filter((e) => myBuildings.some((b) => within(e, b, 13)));
    if (threats.length > 0) this.threatSeen = t;
    const threatPower = threats.reduce((s, e) => s + power(e), 0);
    const armyCen = cen(army);
    const ownNear = army.filter((e) => within(e, armyCen, 9)).reduce((s, e) => s + power(e), 0);
    const foeNear = v.enemies.filter((e) => within(e, armyCen, 11)).reduce((s, e) => s + power(e), 0);
    const due = t - this.lastOrder >= 60;

    // Enemy buildings this side knows about, nearest first; with none known, walk the enemy's base sites.
    const pickTarget = (from: Pt): Pt | null => {
      const known = [...v.ghosts].sort((a, b) => {
        const wa = (a.kind === K.HQ ? 0 : 1), wb = (b.kind === K.HQ ? 0 : 1);
        return wa - wb || d2(a, from) - d2(b, from);
      });
      // Prefer the nearest Headquarters, then anything else.
      const hq = known.filter((gh) => gh.kind === K.HQ).sort((a, b) => d2(a, from) - d2(b, from))[0];
      if (hq) return { x: hq.x, y: hq.y };
      if (known[0]) return { x: known[0].x, y: known[0].y };
      for (const s of [theirs[0]!, theirs[1]!, theirs[2]!, theirs[3]!]) {
        if (!this.visited.has(s.id)) return this.siteCentre(s);
      }
      this.visited.clear();
      return this.siteCentre(theirs[0]!);
    };
    for (const s of theirs) {
      // A site the army can see with nothing on it is crossed off.
      const c = this.siteCentre(s);
      const i = Math.floor(c.y / TILE) * v.map.w + Math.floor(c.x / TILE);
      if (v.vis[i] === 1 && !v.ghosts.some((gh) => within(gh, c, 5))) this.visited.add(s.id);
    }

    if (army.length > 0) {
      if (this.state !== 'defend' && threatPower >= 60 && ownNear + 100 >= threatPower * 0.6
        && (this.state !== 'attack' || threatPower >= 250 || d2(armyCen, stage) < d2(armyCen, this.target ?? stage))) {
        this.state = 'defend';
        this.lastOrder = -999;
      }
      switch (this.state) {
        case 'gather': {
          // Known Turrets raise the size of army it wants before it goes.
          const knownTurrets = this.trick ? 0 : v.ghosts.filter((gh) => gh.kind === K.Turret).length;
          const lancerValue = army.filter((e) => e.kind === K.Lancer).length * 75;
          const turretTax = Math.max(0, knownTurrets * 220 - lancerValue * 1.5);
          const tooSoon = this.level === 0 && t < 2700;
          if (!tooSoon && armyValue >= Math.max(this.waveAt, this.trick ? 0 : this.enemySeen * 1.15) + turretTax) {
            this.state = 'attack';
            this.waveStart = armyValue;
            this.target = pickTarget(armyCen);
            this.lastOrder = -999;
            if (this.firstAttack < 0) this.firstAttack = t;
          } else if (t - this.lastOrder >= 100 && army.some((e) => !within(e, stage, 6))) {
            order(ARMY, O.Attack, stage);
            this.lastOrder = t;
          }
          break;
        }
        case 'attack': {
          const lenient = this.level === 0 ? 2.2 : 1.35;
          if (armyValue < this.waveStart * 0.3 || (foeNear > ownNear * lenient && foeNear > 150)) {
            this.state = 'retreat';
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
            if (cover2 && threatPower > ownNear * 0.9 && this.lancersSeen < 0.5 && !within(tc, cover2, 5)) order(ARMY, O.Attack, { x: Math.round((cover2.x * 3 + tc.x) / 4), y: Math.round((cover2.y * 3 + tc.y) / 4) });
            else order(ARMY, O.Attack, tc);
            this.lastOrder = t;
          }
          break;
        }
        case 'retreat': {
          if (within(armyCen, stage, 7) || t - this.lastOrder > 400) {
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
    if (this.level >= 1 && !this.trick && this.plan !== 'rush') {
      const idleRunners = army.filter((e) => e.kind === K.Runner);
      if (scouts.length === 0 && this.scoutsSent < 3 && idleRunners.length > 0) {
        out.push({ t: 'assign', p, from: ARMY, to: SCOUT, kind: K.Runner, count: 1 });
        this.scoutsSent++;
        this.scoutLeg = 0;
        this.scoutSince = -999;
      } else if (idleRunners.length > 0 && this.raid.state === 'home' && this.state !== 'defend') {
        out.push({ t: 'assign', p, from: ARMY, to: RAID, kind: K.Runner, count: 0 });
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
      const need = this.level === 2 ? 5 : 3;
      const r = this.raid;
      if (raiders.length === 0) {
        if (r.state !== 'home') {
          r.state = 'home';
          r.next = t + 400;
        }
      } else if (r.state === 'home') {
        if (raiders.length >= need && t >= r.next) {
          // Raid a base the enemy is known or likely to hold, picked at random.
          const held = theirs.filter((s) => s.tier === 0 || v.ghosts.some((gh) => gh.kind === K.HQ && within(gh, this.siteCentre(s), 4)));
          const s = held[Math.floor(this.rnd() * held.length)]!;
          r.target = this.pileCentre(s);
          r.state = 'out';
          r.since = t;
          order(RAID, O.Move, r.target);
        } else if (t % 100 === 0 && raiders.some((e) => !within(e, stage, 7))) {
          order(RAID, O.Move, stage);
        }
      } else if (r.state === 'out') {
        const rc = cen(raiders);
        const mineP = raiders.reduce((s, e) => s + power(e), 0);
        const foeP = v.enemies.filter((e) => within(e, rc, 8)).reduce((s, e) => s + power(e), 0);
        const prey = v.enemies.some((e) => e.kind === K.Worker && within(e, rc, 9));
        const there = r.target && within(rc, r.target, 5);
        if (foeP > mineP * 1.1 || t - r.since > 700 || (there && !prey && t - r.since > 150)) {
          r.state = 'back';
          r.since = t;
          order(RAID, O.Move, stage);
        }
      } else if (within(cen(raiders), stage, 7) || t - r.since > 500) {
        r.state = 'home';
        r.next = t + 250;
      }
    }
    return out;
  }
}

/** Tells the lab which unit kinds a bot can field. */
export const FIGHTERS: Kind[] = [K.Trooper, K.Lancer, K.Runner].filter((k) => DEFS[k]) as Kind[];
