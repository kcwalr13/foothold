// One tick of the rules. Players and the computer opponent act only through commands; everything
// here runs the same on every device given the same commands.
import { DEFS, FACTIONS, RULES, def } from './data';
import { updateFog } from './fog';
import { dist, isqrt } from './nav';
import {
  canPlace, centroid, countSupply, footprint, footprintTiles, groupUnits, hasBuilt, spawn, supplyCap, tileIndex, tileOf,
  type Game,
} from './state';
import { K, O, TILE, W, type Command, type Def, type Entity, type Kind } from './types';

// ---------------------------------------------------------------- formation slots

/** Offsets that spread a group around its destination, nearest first. */
const SLOTS: { x: number; y: number }[] = (() => {
  const pts: { i: number; j: number }[] = [];
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) pts.push({ i, j });
  pts.sort((a, b) => (a.i * a.i + a.j * a.j) - (b.i * b.i + b.j * b.j) || a.j - b.j || a.i - b.i);
  return pts.map((p) => ({ x: p.i * 218, y: p.j * 218 }));
})();

// ---------------------------------------------------------------- spatial buckets

const CELL = TILE * 2;

class Buckets {
  readonly cols: number;
  readonly rows: number;
  readonly cells: Entity[][];
  constructor(w: number, h: number) {
    this.cols = Math.ceil(w / 2);
    this.rows = Math.ceil(h / 2);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }
  fill(ents: readonly Entity[], keep: (e: Entity) => boolean): void {
    for (const c of this.cells) c.length = 0;
    for (const e of ents) {
      if (!keep(e)) continue;
      const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(e.x / CELL)));
      const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(e.y / CELL)));
      this.cells[cy * this.cols + cx]!.push(e);
    }
  }
  near(x: number, y: number, r: number, fn: (e: Entity) => void): void {
    const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(this.cols - 1, Math.floor((x + r) / CELL));
    const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(this.rows - 1, Math.floor((y + r) / CELL));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.cells[cy * this.cols + cx]!;
      for (let i = 0; i < c.length; i++) fn(c[i]!);
    }
  }
}

const SCRATCH = new WeakMap<Game, { all: Buckets; mobile: Buckets }>();

function scratch(g: Game): { all: Buckets; mobile: Buckets } {
  let s = SCRATCH.get(g);
  if (!s) {
    s = { all: new Buckets(g.map.w, g.map.h), mobile: new Buckets(g.map.w, g.map.h) };
    SCRATCH.set(g, s);
  }
  return s;
}

// ---------------------------------------------------------------- helpers

const isFighter = (e: Entity) => e.kind !== K.Worker && e.kind !== K.Pile && !DEFS[e.kind]!.building;

function nearFootprint(e: Entity, b: Entity, slack: number): boolean {
  const half = (def(b.kind).size * TILE) / 2 + slack;
  return Math.abs(e.x - b.x) <= half && Math.abs(e.y - b.y) <= half;
}

function inRange(e: Entity, t: Entity, d: Def): boolean {
  return dist(e.x, e.y, t.x, t.y) - def(t.kind).radius <= d.range;
}

function refuse(g: Game, p: number, why: string): void {
  g.events.push({ t: 'refused', p, why });
}

function snapOpen(g: Game, x: number, y: number): { x: number; y: number } | null {
  const mx = g.map.w * TILE - 1, my = g.map.h * TILE - 1;
  const cx = Math.max(0, Math.min(mx, Math.trunc(x))), cy = Math.max(0, Math.min(my, Math.trunc(y)));
  if (!g.nav.blockedAt(cx, cy)) return { x: cx, y: cy };
  const o = g.nav.nearestOpen(tileOf(cx), tileOf(cy));
  if (o < 0) return null;
  return { x: (o % g.map.w) * TILE + TILE / 2, y: Math.floor(o / g.map.w) * TILE + TILE / 2 };
}

/**
 * Moves an entity one step toward a point. Walks straight when the way is clear, otherwise follows
 * the flow field to the goal. Returns true once it is there.
 */
function moveTo(g: Game, e: Entity, gx: number, gy: number, speed: number, target?: Entity): boolean {
  const nav = g.nav;
  const solid = target !== undefined && (def(target.kind).building || target.kind === K.Pile);
  const slack = solid ? Math.trunc(def(target!.kind).size * TILE * 0.75) : 0;
  const ddx = gx - e.x, ddy = gy - e.y;
  if (ddx * ddx + ddy * ddy <= 24 * 24) return true;
  const tx = tileOf(e.x), ty = tileOf(e.y);
  let sx = gx, sy = gy;
  let escaping = false;
  if (nav.isBlocked(tx, ty)) {
    // Caught inside a new building's outline: step out to the nearest open tile.
    const o = nav.nearestOpen(tx, ty);
    if (o < 0) return false;
    sx = (o % nav.w) * TILE + TILE / 2;
    sy = Math.floor(o / nav.w) * TILE + TILE / 2;
    escaping = true;
  } else {
    if (g.tick - e.losTick >= 4) {
      e.los = nav.los(e.x, e.y, gx, gy, slack);
      e.losTick = g.tick;
    }
    if (!e.los) {
      const d = solid
        ? nav.field(10000 + target!.id, () => footprintTiles(g, target!))
        : nav.field(tileIndex(g, gx, gy), () => [tileIndex(g, gx, gy)]);
      const n = nav.next(d, tx, ty);
      if (n >= 0) {
        sx = (n % nav.w) * TILE + TILE / 2;
        sy = Math.floor(n / nav.w) * TILE + TILE / 2;
      } else if (d[ty * nav.w + tx] !== 0) {
        return false; // no way through
      }
    }
  }
  const vx = sx - e.x, vy = sy - e.y;
  const l = isqrt(vx * vx + vy * vy);
  if (l === 0) return false;
  let nx: number, ny: number;
  if (l <= speed) {
    nx = sx;
    ny = sy;
  } else {
    nx = e.x + Math.trunc((vx * speed) / l);
    ny = e.y + Math.trunc((vy * speed) / l);
  }
  if (!escaping && nav.blockedAt(nx, ny)) {
    if (!nav.blockedAt(nx, e.y)) ny = e.y;
    else if (!nav.blockedAt(e.x, ny)) nx = e.x;
    else {
      nx = e.x;
      ny = e.y;
    }
  }
  e.fx = vx;
  e.fy = vy;
  e.x = nx;
  e.y = ny;
  return false;
}

// ---------------------------------------------------------------- commands

function nearestWorker(g: Game, owner: number, x: number, y: number): Entity | undefined {
  let best: Entity | undefined;
  let bestD = 1 << 30;
  for (const e of g.ents) {
    if (e.owner !== owner || e.kind !== K.Worker || e.hp <= 0 || e.ws === W.ToSite || e.ws === W.Build) continue;
    const d = dist(e.x, e.y, x, y) + (e.carry > 0 ? TILE * 2 : 0);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function releasePile(g: Game, w: Entity): void {
  const pile = w.pile ? g.byId.get(w.pile) : undefined;
  if (pile && pile.busy === w.id) pile.busy = 0;
}

function assignBuilder(g: Game, w: Entity, site: Entity): void {
  releasePile(g, w);
  w.ws = W.ToSite;
  w.site = site.id;
  w.losTick = -99;
  site.builder = w.id;
}

function cmdBuild(g: Game, c: Extract<Command, { t: 'build' }>): void {
  const pl = g.players[c.p];
  const d = DEFS[c.kind];
  if (!pl || !d || !d.building || !FACTIONS[pl.faction].buildings.includes(c.kind)) return;
  if (!Number.isInteger(c.tx) || !Number.isInteger(c.ty)) return;
  if (d.needs && !hasBuilt(g, c.p, d.needs)) return refuse(g, c.p, `Needs a ${def(d.needs).name} first`);
  if (!canPlace(g, c.p, c.kind, c.tx, c.ty)) return refuse(g, c.p, "Can't build there");
  if (pl.blocks < d.cost) return refuse(g, c.p, 'Not enough Blocks');
  const cx = c.tx * TILE + (d.size * TILE) / 2, cy = c.ty * TILE + (d.size * TILE) / 2;
  const w = nearestWorker(g, c.p, cx, cy);
  if (!w) return refuse(g, c.p, 'No Worker free to build');
  pl.blocks -= d.cost;
  pl.stats.spent += d.cost;
  const s = spawn(g, c.kind, c.p, cx, cy);
  s.built = false;
  s.hp = Math.max(1, Math.trunc(d.hp / 10));
  g.nav.setRect(c.tx, c.ty, d.size, 1);
  assignBuilder(g, w, s);
}

function cmdCancel(g: Game, c: Extract<Command, { t: 'cancel' }>): void {
  const pl = g.players[c.p];
  const s = g.byId.get(c.id);
  if (!pl || !s || s.owner !== c.p || !def(s.kind).building || s.built || s.hp <= 0) return;
  const cost = def(s.kind).cost;
  const back = s.progress === 0 ? cost : Math.trunc((cost * RULES.cancelRefund) / 100);
  pl.blocks += back;
  pl.stats.spent -= back;
  s.hp = 0;
  s.progress = -1; // marks a cancel, so it isn't counted as a loss
}

function producerFor(g: Game, owner: number, kind: Kind, idleOnly: boolean): Entity | undefined {
  const at = def(kind).madeAt;
  let best: Entity | undefined;
  for (const e of g.ents) {
    if (e.owner !== owner || e.kind !== at || !e.built || e.hp <= 0) continue;
    if (e.queue.length >= (idleOnly ? 1 : RULES.queueMax)) continue;
    if (!best || e.queue.length < best.queue.length) best = e;
  }
  return best;
}

function tryTrain(g: Game, p: number, kind: Kind, auto: boolean): boolean {
  const pl = g.players[p];
  const d = DEFS[kind];
  if (!pl || !d || d.building || !FACTIONS[pl.faction].units.includes(kind)) return false;
  if (d.needs && !hasBuilt(g, p, d.needs)) return false;
  const b = producerFor(g, p, kind, auto);
  if (!b) {
    if (!auto) refuse(g, p, hasBuilt(g, p, d.madeAt!) ? 'Queue is full' : `Needs a ${def(d.madeAt!).name}`);
    return false;
  }
  if (pl.blocks < d.cost) {
    if (!auto) refuse(g, p, 'Not enough Blocks');
    return false;
  }
  if (countSupply(g, p) + d.supply > supplyCap(g, p)) {
    if (!auto) refuse(g, p, 'Supply cap reached: take another base');
    return false;
  }
  pl.blocks -= d.cost;
  pl.stats.spent += d.cost;
  b.queue.push(kind);
  return true;
}

function cmdOrder(g: Game, c: Extract<Command, { t: 'order' }>): void {
  const pl = g.players[c.p];
  if (!pl || !Number.isInteger(c.group) || c.group < 0 || c.group >= RULES.groups) return;
  if (c.mode !== O.Attack && c.mode !== O.Move && c.mode !== O.Hold) return;
  const units = groupUnits(g, c.p, c.group);
  if (c.mode === O.Hold) {
    const cen = centroid(units);
    pl.groups[c.group] = { mode: O.Hold, x: cen.x, y: cen.y };
    for (const u of units) {
      u.mode = O.Hold;
      u.dx = u.x;
      u.dy = u.y;
      u.arrived = true;
    }
    return;
  }
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
  const at = snapOpen(g, c.x, c.y);
  if (!at) return;
  pl.groups[c.group] = { mode: c.mode, x: at.x, y: at.y };
  const mx = g.map.w * TILE, my = g.map.h * TILE;
  units.forEach((u, i) => {
    const s = SLOTS[i % SLOTS.length]!;
    let sx = at.x + s.x, sy = at.y + s.y;
    if (sx < 0 || sy < 0 || sx >= mx || sy >= my || g.nav.blockedAt(sx, sy)) {
      sx = at.x;
      sy = at.y;
    }
    u.mode = c.mode;
    u.dx = sx;
    u.dy = sy;
    u.arrived = false;
    u.losTick = -99;
    u.timer = 0;
    if (c.mode === O.Move) u.tgt = 0;
  });
}

function cmdAssign(g: Game, c: Extract<Command, { t: 'assign' }>): void {
  const pl = g.players[c.p];
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n < RULES.groups;
  if (!pl || !ok(c.from) || !ok(c.to) || c.from === c.to) return;
  const dest = groupUnits(g, c.p, c.to);
  const moved: Entity[] = [];
  for (const u of groupUnits(g, c.p, c.from)) {
    if (c.kind && u.kind !== c.kind) continue;
    if (c.count > 0 && moved.length >= c.count) break;
    u.group = c.to;
    moved.push(u);
  }
  if (moved.length === 0) return;
  if (dest.length > 0) {
    const cen = snapOpen(g, centroid(dest).x, centroid(dest).y);
    if (!cen) return;
    for (const u of moved) {
      u.mode = O.Attack;
      u.dx = cen.x;
      u.dy = cen.y;
      u.arrived = false;
      u.losTick = -99;
      u.timer = 0;
    }
  } else {
    const cen = centroid(moved);
    pl.groups[c.to] = { mode: O.Idle, x: cen.x, y: cen.y };
    for (const u of moved) {
      u.mode = O.Idle;
      u.ax = u.x;
      u.ay = u.y;
      u.arrived = true;
    }
  }
}

function runCommands(g: Game): void {
  if (g.pending.length === 0) return;
  const due = g.pending.filter((p) => p.tick <= g.tick);
  if (due.length === 0) return;
  g.pending = g.pending.filter((p) => p.tick > g.tick);
  for (const { cmd } of due) {
    g.log.push({ tick: g.tick, cmd });
    switch (cmd.t) {
      case 'build': cmdBuild(g, cmd); break;
      case 'cancel': cmdCancel(g, cmd); break;
      case 'train': tryTrain(g, cmd.p, cmd.kind, false); break;
      case 'repeat': {
        const pl = g.players[cmd.p];
        if (!pl || !DEFS[cmd.kind] || def(cmd.kind).building) break;
        pl.repeat = pl.repeat.filter((k) => k !== cmd.kind);
        if (cmd.on) pl.repeat.push(cmd.kind);
        break;
      }
      case 'order': cmdOrder(g, cmd); break;
      case 'assign': cmdAssign(g, cmd); break;
      case 'rally': {
        const pl = g.players[cmd.p];
        if (pl && Number.isInteger(cmd.group) && cmd.group >= 0 && cmd.group < RULES.groups) pl.rally = cmd.group;
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- production

function spawnUnit(g: Game, b: Entity, kind: Kind): void {
  const pl = g.players[b.owner]!;
  const bd = def(b.kind);
  let tx = (g.map.w * TILE) / 2, ty = (g.map.h * TILE) / 2;
  let members: Entity[] = [];
  if (kind === K.Worker) {
    let bestD = 1 << 30;
    for (const p of g.ents) {
      if (p.kind !== K.Pile) continue;
      const d = dist(b.x, b.y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        tx = p.x;
        ty = p.y;
      }
    }
  } else {
    members = groupUnits(g, b.owner, pl.rally);
    if (members.length > 0) {
      const gs = pl.groups[pl.rally]!;
      if (members.some((m) => !m.arrived) && gs.mode !== O.Hold) {
        tx = gs.x;
        ty = gs.y;
      } else {
        const c = centroid(members);
        tx = c.x;
        ty = c.y;
      }
    }
  }
  const vx = tx - b.x, vy = ty - b.y;
  const l = Math.max(1, isqrt(vx * vx + vy * vy));
  const out = bd.radius + Math.trunc(TILE * 0.9);
  const door = snapOpen(g, b.x + Math.trunc((vx * out) / l), b.y + Math.trunc((vy * out) / l));
  if (!door) return;
  const u = spawn(g, kind, b.owner, door.x, door.y);
  u.fx = vx;
  u.fy = vy;
  pl.stats.trained++;
  if (kind === K.Worker) return;
  u.group = pl.rally;
  let goal: { x: number; y: number } | null;
  if (members.length > 0) {
    goal = snapOpen(g, tx, ty);
  } else {
    // An empty group gathers a few steps out from the building, toward the middle of the map.
    const s = SLOTS[g.tick % 9]!;
    goal = snapOpen(g, b.x + Math.trunc((vx * (out + TILE * 3)) / l) + s.x, b.y + Math.trunc((vy * (out + TILE * 3)) / l) + s.y);
  }
  if (goal) {
    u.mode = O.Attack;
    u.dx = goal.x;
    u.dy = goal.y;
    u.arrived = false;
  }
}

function production(g: Game): void {
  const n = g.ents.length;
  for (let i = 0; i < n; i++) {
    const b = g.ents[i]!;
    if (!b.built || b.queue.length === 0 || b.hp <= 0) continue;
    b.qprog++;
    const kind = b.queue[0]!;
    if (b.qprog >= def(kind).time) {
      b.queue.shift();
      b.qprog = 0;
      spawnUnit(g, b, kind);
    }
  }
  if (g.tick % 5 === 0) {
    for (const pl of g.players) for (const kind of pl.repeat) tryTrain(g, pl.id, kind, true);
  }
}

// ---------------------------------------------------------------- workers

function pickPile(g: Game, w: Entity, counts: Map<number, number>): Entity | undefined {
  const hqs = g.ents.filter((e) => e.owner === w.owner && e.kind === K.HQ && e.built && e.hp > 0);
  if (hqs.length === 0) return undefined;
  let best: Entity | undefined;
  let bestScore = Number.MAX_SAFE_INTEGER;
  const reach = RULES.baseReach * TILE;
  for (const p of g.ents) {
    if (p.kind !== K.Pile || p.amount <= 0) continue;
    let near = false;
    for (const hq of hqs) {
      if (dist(hq.x, hq.y, p.x, p.y) <= reach) {
        near = true;
        break;
      }
    }
    if (!near) continue;
    const n = counts.get(p.id) ?? 0;
    const score = (n >= RULES.perPile ? 1_000_000 + n * 200_000 : n * 3 * TILE) + dist(w.x, w.y, p.x, p.y);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function nearestHQ(g: Game, w: Entity): Entity | undefined {
  let best: Entity | undefined;
  let bestD = 1 << 30;
  for (const e of g.ents) {
    if (e.owner !== w.owner || e.kind !== K.HQ || !e.built || e.hp <= 0) continue;
    const d = dist(e.x, e.y, w.x, w.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function workers(g: Game): void {
  let counts: Map<number, number> | undefined;
  const assigned = () => {
    if (!counts) {
      counts = new Map();
      for (const e of g.ents) {
        if (e.kind === K.Worker && e.pile && (e.ws === W.ToPile || e.ws === W.Harvest || e.ws === W.ToHQ)) {
          counts.set(e.pile, (counts.get(e.pile) ?? 0) + 1);
        }
      }
    }
    return counts;
  };
  if (g.rebalance >= 0) {
    // A new Headquarters just opened: move the Workers a base can't use over to it.
    const owner = g.rebalance;
    g.rebalance = -1;
    const c = assigned();
    for (const e of g.ents) {
      if (e.owner !== owner || e.kind !== K.Worker || !e.pile) continue;
      if (e.ws !== W.ToPile && e.ws !== W.ToHQ) continue;
      const n = c.get(e.pile) ?? 0;
      if (n > RULES.perPile) {
        c.set(e.pile, n - 1);
        e.pile = 0;
        if (e.ws === W.ToPile) e.ws = W.Idle;
      }
    }
  }
  const speed = def(K.Worker).speed;
  const pileReach = Math.trunc(TILE * 0.6);
  for (const e of g.ents) {
    if (e.kind !== K.Worker || e.hp <= 0) continue;
    switch (e.ws) {
      case W.Idle: {
        if ((g.tick + e.id) % 4 !== 0) break;
        const pile = pickPile(g, e, assigned());
        if (pile) {
          e.pile = pile.id;
          e.ws = W.ToPile;
          e.losTick = -99;
          counts!.set(pile.id, (counts!.get(pile.id) ?? 0) + 1);
        }
        break;
      }
      case W.ToPile: {
        const pile = g.byId.get(e.pile);
        if (!pile || pile.amount <= 0) {
          e.pile = 0;
          e.ws = W.Idle;
          break;
        }
        if (nearFootprint(e, pile, pileReach)) {
          if (pile.busy === 0 || !g.byId.has(pile.busy)) {
            pile.busy = e.id;
            e.ws = W.Harvest;
            e.timer = RULES.harvestTicks;
          }
        } else {
          moveTo(g, e, pile.x, pile.y, speed, pile);
        }
        break;
      }
      case W.Harvest: {
        const pile = g.byId.get(e.pile);
        if (!pile) {
          e.ws = W.Idle;
          break;
        }
        if (--e.timer <= 0) {
          const take = Math.min(RULES.carry, pile.amount);
          pile.amount -= take;
          pile.busy = 0;
          e.carry = take;
          e.ws = W.ToHQ;
          e.losTick = -99;
          if (pile.amount <= 0) pile.hp = 0;
        }
        break;
      }
      case W.ToHQ: {
        const hq = nearestHQ(g, e);
        if (!hq) break;
        if (nearFootprint(e, hq, Math.trunc(TILE * 0.7))) {
          const pl = g.players[e.owner]!;
          pl.blocks += e.carry;
          pl.stats.gathered += e.carry;
          e.carry = 0;
          e.losTick = -99;
          const pile = e.pile ? g.byId.get(e.pile) : undefined;
          if (pile && pile.amount > 0) e.ws = W.ToPile;
          else {
            e.pile = 0;
            e.ws = W.Idle;
          }
        } else {
          moveTo(g, e, hq.x, hq.y, speed, hq);
        }
        break;
      }
      case W.ToSite: {
        const s = g.byId.get(e.site);
        if (!s || s.built || s.hp <= 0 || s.builder !== e.id) {
          e.site = 0;
          e.ws = e.carry > 0 ? W.ToHQ : W.Idle;
          break;
        }
        if (nearFootprint(e, s, Math.trunc(TILE * 0.75))) e.ws = W.Build;
        else moveTo(g, e, s.x, s.y, speed, s);
        break;
      }
      case W.Build: {
        const s = g.byId.get(e.site);
        if (!s || s.built || s.hp <= 0) {
          e.site = 0;
          e.ws = e.carry > 0 ? W.ToHQ : W.Idle;
          break;
        }
        const d = def(s.kind);
        const grow = Math.trunc((d.hp * 9) / 10);
        s.hp += Math.trunc((grow * (s.progress + 1)) / d.time) - Math.trunc((grow * s.progress) / d.time);
        s.progress++;
        e.fx = s.x - e.x;
        e.fy = s.y - e.y;
        if (s.progress >= d.time) {
          s.built = true;
          s.builder = 0;
          e.site = 0;
          e.ws = e.carry > 0 ? W.ToHQ : W.Idle;
          g.events.push({ t: 'done', owner: s.owner, kind: s.kind, x: s.x, y: s.y });
          if (s.kind === K.HQ) g.rebalance = s.owner;
        }
        break;
      }
    }
  }
  if (g.tick % 10 === 0) {
    // A site whose Worker was lost gets another.
    for (const s of g.ents) {
      if (s.built || s.hp <= 0 || s.owner < 0 || !def(s.kind).building) continue;
      const w = s.builder ? g.byId.get(s.builder) : undefined;
      if (w && w.hp > 0 && w.site === s.id) continue;
      const nw = nearestWorker(g, s.owner, s.x, s.y);
      if (nw) assignBuilder(g, nw, s);
    }
  }
}

// ---------------------------------------------------------------- fighting units

function acquire(g: Game, b: Buckets, e: Entity, d: Def, maxDist: number): number {
  const vis = g.players[e.owner]!.vis;
  let best = 0;
  let bestScore = 1 << 30;
  b.near(e.x, e.y, maxDist + TILE * 3, (o) => {
    if (o.owner === e.owner || o.owner < 0 || o.hp <= 0) return;
    const od = def(o.kind);
    const pct = d.vs[od.cls]!;
    if (pct === 0) return;
    if (vis[tileIndex(g, o.x, o.y)] !== 1) return;
    const dd = dist(e.x, e.y, o.x, o.y) - od.radius;
    if (dd > maxDist) return;
    let score = dd;
    if (od.building) score += od.range > 0 && o.built ? 0 : TILE * 6;
    else if (o.kind === K.Worker) score += e.kind === K.Runner ? -TILE * 2 : TILE * 2;
    if (pct >= 150) score -= TILE * 2;
    else if (pct <= 50) score += TILE;
    if (score < bestScore || (score === bestScore && o.id < best)) {
      bestScore = score;
      best = o.id;
    }
  });
  return best;
}

function units(g: Game, b: Buckets): void {
  // A group on the march keeps the pace of its slowest member.
  const pace: number[] = new Array(g.players.length * RULES.groups).fill(1 << 20);
  for (const e of g.ents) {
    if (e.group >= 0 && !e.arrived && e.hp > 0) {
      const i = e.owner * RULES.groups + e.group;
      pace[i] = Math.min(pace[i]!, def(e.kind).speed);
    }
  }
  for (const e of g.ents) {
    if (!isFighter(e) || e.hp <= 0) continue;
    const d = def(e.kind);
    let t = e.tgt ? g.byId.get(e.tgt) : undefined;
    if (t && (t.hp <= 0 || g.players[e.owner]!.vis[tileIndex(g, t.x, t.y)] !== 1)) {
      t = undefined;
      e.tgt = 0;
    }
    const marching = e.mode === O.Move && !e.arrived;
    if (!marching && d.range > 0) {
      if (!t || (g.tick + e.id) % 5 === 0) {
        const id = acquire(g, b, e, d, e.mode === O.Hold ? d.range : d.range + RULES.notice);
        if (id) {
          if (id !== e.tgt) e.losTick = -99;
          e.tgt = id;
          t = g.byId.get(id);
        } else if (!t) {
          e.tgt = 0;
        }
      }
      if (t && e.mode === O.Idle && dist(e.x, e.y, e.ax, e.ay) > RULES.leash && !inRange(e, t, d)) {
        t = undefined;
        e.tgt = 0;
      }
    }
    if (t && !marching) {
      if (inRange(e, t, d)) {
        e.fx = t.x - e.x;
        e.fy = t.y - e.y;
      } else if (e.mode !== O.Hold) {
        moveTo(g, e, t.x, t.y, d.speed, def(t.kind).building ? t : undefined);
      }
      continue;
    }
    if (e.mode === O.Attack || e.mode === O.Move) {
      if (!e.arrived) {
        const speed = Math.min(d.speed, pace[e.owner * RULES.groups + e.group] ?? d.speed);
        const reached = moveTo(g, e, e.dx, e.dy, speed);
        const left = dist(e.x, e.y, e.dx, e.dy);
        let done = reached || left <= TILE * 0.4;
        if (!done && left <= TILE * 3 && ++e.timer > 12) done = true;
        if (done) {
          e.arrived = true;
          e.mode = O.Idle;
          e.ax = e.x;
          e.ay = e.y;
          e.timer = 0;
        }
      } else {
        e.mode = O.Idle;
      }
    } else if (e.mode === O.Idle) {
      if (dist(e.x, e.y, e.ax, e.ay) > TILE * 1.5) moveTo(g, e, e.ax, e.ay, d.speed);
    }
  }
}

function separate(g: Game, b: Buckets): void {
  b.fill(g.ents, (e) => isFighter(e) && e.hp > 0);
  const nav = g.nav;
  for (const a of g.ents) {
    if (!isFighter(a) || a.hp <= 0) continue;
    const ra = def(a.kind).radius;
    b.near(a.x, a.y, ra * 2 + 64, (o) => {
      if (o.id <= a.id) return;
      let dx = o.x - a.x, dy = o.y - a.y;
      const rr = ra + def(o.kind).radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;
      let d = isqrt(d2);
      if (d === 0) {
        dx = ((a.id * 7 + o.id * 3) % 5) - 2 || 1;
        dy = ((a.id * 5 + o.id * 11) % 5) - 2;
        d = Math.max(1, isqrt(dx * dx + dy * dy));
      }
      const push = Math.min(64, Math.trunc((rr - d) / 2) + 2);
      const px = Math.trunc((dx * push) / d), py = Math.trunc((dy * push) / d);
      if (a.mode !== O.Hold && !nav.blockedAt(a.x - px, a.y - py)) {
        a.x -= px;
        a.y -= py;
      }
      if (o.mode !== O.Hold && !nav.blockedAt(o.x + px, o.y + py)) {
        o.x += px;
        o.y += py;
      }
    });
  }
}

function shooting(g: Game, b: Buckets): void {
  const hits: { t: Entity; dmg: number; by: Entity }[] = [];
  for (const e of g.ents) {
    const d = def(e.kind);
    if (d.range === 0 || e.hp <= 0 || !e.built) continue;
    if (e.cd > 0) e.cd--;
    if (d.building) {
      let t = e.tgt ? g.byId.get(e.tgt) : undefined;
      if (t && (t.hp <= 0 || !inRange(e, t, d) || g.players[e.owner]!.vis[tileIndex(g, t.x, t.y)] !== 1)) {
        t = undefined;
        e.tgt = 0;
      }
      if (!t && (g.tick + e.id) % 3 === 0) e.tgt = acquire(g, b, e, d, d.range);
    } else if (e.mode === O.Move && !e.arrived) {
      continue;
    }
    const t = e.tgt ? g.byId.get(e.tgt) : undefined;
    if (!t || t.hp <= 0 || !inRange(e, t, d)) continue;
    e.fx = t.x - e.x;
    e.fy = t.y - e.y;
    if (e.cd > 0) continue;
    const td = def(t.kind);
    hits.push({ t, dmg: Math.max(1, Math.trunc((d.dmg * d.vs[td.cls]!) / 100)), by: e });
    e.cd = d.cooldown;
    g.events.push({ t: 'shot', from: e.id, to: t.id, kind: e.kind, x1: e.x, y1: e.y, x2: t.x, y2: t.y, owner: e.owner });
  }
  for (const { t, dmg } of hits) {
    t.hp -= dmg;
    const td = def(t.kind);
    if (td.building || t.kind === K.Worker) {
      g.events.push({ t: 'hurt', owner: t.owner, x: t.x, y: t.y, kind: t.kind });
      const st = g.players[t.owner]!.stats;
      if (st.firstAttackTick < 0) st.firstAttackTick = g.tick;
    }
  }
}

// ---------------------------------------------------------------- bookkeeping

function cleanup(g: Game): void {
  let any = false;
  for (const e of g.ents) {
    if (e.hp > 0) continue;
    any = true;
    const d = def(e.kind);
    if (e.kind === K.Pile || d.building) {
      const f = footprint(e);
      g.nav.setRect(f.tx, f.ty, f.size, 0);
    }
    if (e.kind === K.Worker) releasePile(g, e);
    if (e.owner >= 0 && e.progress !== -1) {
      const mine = g.players[e.owner]!.stats, theirs = g.players[1 - e.owner]!.stats;
      if (d.building) {
        mine.lostBuildings++;
        theirs.killedBuildings++;
      } else {
        mine.lostUnits++;
        theirs.killedUnits++;
      }
      g.events.push({ t: 'death', kind: e.kind, owner: e.owner, x: e.x, y: e.y, fx: e.fx, fy: e.fy });
    }
    g.byId.delete(e.id);
  }
  if (any) g.ents = g.ents.filter((e) => e.hp > 0);
}

function accounts(g: Game): void {
  const hq = [0, 0];
  for (const e of g.ents) if (e.kind === K.HQ && e.owner >= 0) hq[e.owner]!++;
  for (const pl of g.players) {
    pl.supply = countSupply(g, pl.id);
    pl.cap = supplyCap(g, pl.id);
  }
  if (hq[0] === 0) g.winner = 1;
  else if (hq[1] === 0) g.winner = 0;
}

export function step(g: Game): void {
  if (g.winner >= 0) return;
  g.tick++;
  g.events.length = 0;
  runCommands(g);
  production(g);
  const s = scratch(g);
  s.all.fill(g.ents, (e) => e.kind !== K.Pile && e.hp > 0);
  workers(g);
  units(g, s.all);
  separate(g, s.mobile);
  shooting(g, s.all);
  cleanup(g);
  if (g.tick % 2 === 0) updateFog(g);
  accounts(g);
}
