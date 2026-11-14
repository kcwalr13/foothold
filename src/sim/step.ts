// One tick of the rules. Players and the computer opponent act only through commands; everything
// here runs the same on every device given the same commands.
import { DEFS, FACTIONS, RULES, def, isResearch, researchCost } from './data';
import { updateFog } from './fog';
import { dist, isqrt } from './nav';
import {
  canPlace, cellAt, centroid, countSupply, footprint, footprintTiles, groupUnits, hasBuilt, missing, onLayer, spawn, supplyCap,
  tileOf, visibleTo, wasVisibleTo, type Game,
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

const isFighter = (e: Entity) => e.owner >= 0 && e.kind !== K.Worker && !DEFS[e.kind]!.building;

function nearFootprint(e: Entity, b: Entity, slack: number): boolean {
  const half = (def(b.kind).size * TILE) / 2 + slack;
  return Math.abs(e.x - b.x) <= half && Math.abs(e.y - b.y) <= half;
}

/** How far a weapon reaches against one target: high ground outranges low ground. */
function reach(g: Game, e: Entity, t: Entity, d: Def): number {
  if (d.air || def(t.kind).air) return d.range;
  const high = g.map.high;
  return onLayer(g, high, e.x, e.y) && !onLayer(g, high, t.x, t.y) ? d.range + RULES.highRange : d.range;
}

function inRange(g: Game, e: Entity, t: Entity, d: Def): boolean {
  return dist(e.x, e.y, t.x, t.y) - def(t.kind).radius <= reach(g, e, t, d);
}

// While units are being moved, each one judges the others by where they stood when the moves began.
// Otherwise whoever happens to be moved later in the tick sees a little further into the future.
function reachThen(g: Game, e: Entity, t: Entity, d: Def): number {
  if (d.air || def(t.kind).air) return d.range;
  const high = g.map.high;
  return onLayer(g, high, e.x, e.y) && !onLayer(g, high, t.px, t.py) ? d.range + RULES.highRange : d.range;
}

function inRangeThen(g: Game, e: Entity, t: Entity, d: Def): boolean {
  return dist(e.x, e.y, t.px, t.py) - def(t.kind).radius <= reachThen(g, e, t, d);
}

function refuse(g: Game, p: number, why: string): void {
  g.events.push({ t: 'refused', p, why });
}

/** The point itself if a unit can stand there, else the middle of the nearest open tile, ties going to the side nearest `from`. */
function snapOpen(g: Game, x: number, y: number, fromX = x, fromY = y): { x: number; y: number } | null {
  const mx = g.map.w * TILE - 1, my = g.map.h * TILE - 1;
  const cx = Math.max(0, Math.min(mx, Math.trunc(x))), cy = Math.max(0, Math.min(my, Math.trunc(y)));
  if (!g.nav.blockedAt(cx, cy)) return { x: cx, y: cy };
  const o = g.nav.nearestOpenTo(cx, cy, fromX, fromY);
  if (o < 0) return null;
  return { x: (o % g.map.w) * TILE + TILE / 2, y: Math.floor(o / g.map.w) * TILE + TILE / 2 };
}

/**
 * The tile a coordinate is in. One exactly on the line between two tiles is in the tile on the side of `toward`
 * (or, with nothing to choose by, on the side of the middle of the map): decided by plain rounding, the line
 * would always belong to the tile on one fixed side, and the two ends of the map would disagree.
 */
function tileToward(a: number, toward: number, mid: number): number {
  if (a % TILE !== 0) return tileOf(a);
  const side = toward !== a ? toward : mid;
  return side < a ? a / TILE - 1 : a / TILE;
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
  if (def(e.kind).air) {
    // Flyers go straight there, over rock and rooftops alike.
    const l = isqrt(ddx * ddx + ddy * ddy);
    if (l <= speed) {
      e.x = gx;
      e.y = gy;
    } else {
      e.x += Math.trunc((ddx * speed) / l);
      e.y += Math.trunc((ddy * speed) / l);
    }
    e.fx = ddx;
    e.fy = ddy;
    return false;
  }
  // A unit standing exactly on the line between two tiles is in the one on the side it is heading for, and
  // a goal on a line is in the tile on the walker's side, so that a unit and its mirror image on the far side
  // of the map are always in mirror-image tiles, walking to mirror-image tiles.
  const midX = (nav.w * TILE) / 2, midY = (nav.h * TILE) / 2;
  const tx = tileToward(e.x, gx, midX), ty = tileToward(e.y, gy, midY);
  const goal = Math.max(0, Math.min(nav.h - 1, tileToward(gy, e.y, midY))) * nav.w + Math.max(0, Math.min(nav.w - 1, tileToward(gx, e.x, midX)));
  let sx = gx, sy = gy;
  let escaping = false;
  if (nav.isBlocked(tx, ty)) {
    // Caught inside a new building's outline: step out to the nearest open tile, toward where it was going.
    const o = nav.nearestOpenTo(e.x, e.y, gx, gy);
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
        : nav.field(goal, () => [goal]);
      const n = nav.next(d, tx, ty, e.x, e.y);
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
  const lacks = missing(g, c.p, d.needs);
  if (lacks) return refuse(g, c.p, `Needs ${article(def(lacks).name)} first`);
  if (!canPlace(g, c.p, c.kind, c.tx, c.ty)) {
    return refuse(g, c.p, c.kind === K.Refinery ? 'A Refinery goes on a battery pack' : "Can't build there");
  }
  if (pl.blocks < d.cost) return refuse(g, c.p, 'Not enough Blocks');
  if (pl.gas < d.gas) return refuse(g, c.p, 'Not enough Batteries');
  const cx = c.tx * TILE + (d.size * TILE) / 2, cy = c.ty * TILE + (d.size * TILE) / 2;
  const w = nearestWorker(g, c.p, cx, cy);
  if (!w) return refuse(g, c.p, 'No Worker free to build');
  const cell = c.kind === K.Refinery ? cellAt(g, c.tx, c.ty) : undefined;
  pl.blocks -= d.cost;
  pl.gas -= d.gas;
  pl.stats.spent += d.cost + d.gas;
  const s = spawn(g, c.kind, c.p, cx, cy);
  s.built = false;
  s.hp = Math.max(1, Math.trunc(d.hp / 10));
  if (cell) {
    // The pack stays where it is; the Refinery and the pack remember each other.
    cell.site = s.id;
    s.pile = cell.id;
  } else {
    g.nav.setRect(c.tx, c.ty, d.size, 1);
  }
  assignBuilder(g, w, s);
}

function cmdCancel(g: Game, c: Extract<Command, { t: 'cancel' }>): void {
  const pl = g.players[c.p];
  const s = g.byId.get(c.id);
  if (!pl || !s || s.owner !== c.p || !def(s.kind).building || s.built || s.hp <= 0) return;
  const d = def(s.kind);
  const share = s.progress === 0 ? 100 : RULES.cancelRefund;
  const back = Math.trunc((d.cost * share) / 100), back2 = Math.trunc((d.gas * share) / 100);
  pl.blocks += back;
  pl.gas += back2;
  pl.stats.spent -= back + back2;
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
  const lacks = missing(g, p, d.madeAt ? [d.madeAt, ...d.needs] : d.needs);
  if (lacks) {
    if (!auto) refuse(g, p, `Needs ${article(def(lacks).name)}`);
    return false;
  }
  const b = producerFor(g, p, kind, auto);
  if (!b) {
    if (!auto) refuse(g, p, 'Queue is full');
    return false;
  }
  if (pl.blocks < d.cost) {
    if (!auto) refuse(g, p, 'Not enough Blocks');
    return false;
  }
  if (pl.gas < d.gas) {
    if (!auto) refuse(g, p, 'Not enough Batteries');
    return false;
  }
  if (countSupply(g, p) + d.supply > supplyCap(g, p)) {
    if (!auto) refuse(g, p, 'Supply cap reached: take another base');
    return false;
  }
  pl.blocks -= d.cost;
  pl.gas -= d.gas;
  pl.stats.spent += d.cost + d.gas;
  b.queue.push(kind);
  return true;
}

/** Research is queued at an Armory; each item has two levels and is studied one level at a time. */
function cmdResearch(g: Game, c: Extract<Command, { t: 'research' }>): void {
  const pl = g.players[c.p];
  if (!pl || !isResearch(c.kind) || !FACTIONS[pl.faction].research.includes(c.kind)) return;
  const level = c.kind === K.Weapons ? pl.weapons : pl.armour;
  if (level >= RULES.researchMax) return refuse(g, c.p, `${def(c.kind).name} is at its top level`);
  let lab: Entity | undefined;
  for (const e of g.ents) {
    if (e.owner !== c.p || e.kind !== K.Armory || e.hp <= 0) continue;
    if (e.queue.includes(c.kind)) return refuse(g, c.p, 'Already being researched');
    if (e.built && e.queue.length < RULES.queueMax && (!lab || e.queue.length < lab.queue.length)) lab = e;
  }
  if (!lab) return refuse(g, c.p, hasBuilt(g, c.p, K.Armory) ? 'Queue is full' : 'Needs an Armory');
  const price = researchCost(c.kind, level);
  if (pl.blocks < price.cost) return refuse(g, c.p, 'Not enough Blocks');
  if (pl.gas < price.gas) return refuse(g, c.p, 'Not enough Batteries');
  pl.blocks -= price.cost;
  pl.gas -= price.gas;
  pl.stats.spent += price.cost + price.gas;
  lab.queue.push(c.kind);
}

function article(name: string): string {
  return `${'AEIOU'.includes(name[0]!) ? 'an' : 'a'} ${name}`;
}

function cmdOrder(g: Game, c: Extract<Command, { t: 'order' }>): void {
  const pl = g.players[c.p];
  if (!pl || !Number.isInteger(c.group) || c.group < 0 || c.group >= RULES.groups) return;
  if (c.mode !== O.Attack && c.mode !== O.Move && c.mode !== O.Hold) return;
  const units = groupUnits(g, c.p, c.group);
  if (c.mode === O.Hold) {
    const cen = centroid(units, g.map);
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
  const from = centroid(units, g.map);
  const at = units.length > 0 ? snapOpen(g, c.x, c.y, from.x, from.y) : snapOpen(g, c.x, c.y);
  if (!at) return;
  pl.groups[c.group] = { mode: c.mode, x: at.x, y: at.y };
  const mx = g.map.w * TILE, my = g.map.h * TILE;
  // The far side's formation is the near side's turned half a circle, like everything else on the map.
  const turn = c.p === 1 ? -1 : 1;
  units.forEach((u, i) => {
    const s = SLOTS[i % SLOTS.length]!;
    let sx = at.x + s.x * turn, sy = at.y + s.y * turn;
    if (sx < 0 || sy < 0 || sx >= mx || sy >= my || (!def(u.kind).air && g.nav.blockedAt(sx, sy))) {
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
    const mid = centroid(dest, g.map);
    const cen = snapOpen(g, mid.x, mid.y);
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
    const cen = centroid(moved, g.map);
    pl.groups[c.to] = { mode: O.Idle, x: cen.x, y: cen.y };
    for (const u of moved) {
      u.mode = O.Idle;
      u.ax = u.x;
      u.ay = u.y;
      u.arrived = true;
    }
  }
}

const PHASE: Record<string, number> = { order: 0, assign: 0, rally: 0, cancel: 1, build: 2, train: 3, research: 3, repeat: 3 };

function runCommands(g: Game): void {
  if (g.pending.length === 0) return;
  const due = g.pending.filter((p) => p.tick <= g.tick);
  if (due.length === 0) return;
  g.pending = g.pending.filter((p) => p.tick > g.tick);
  // Within a tick, whose command arrived first must decide nothing. Orders run first and see the map as the
  // tick found it; then cancelled sites are cleared; then buildings go down; then everything that touches
  // only its own side. Two sides claiming the same ground on the same tick are both turned away.
  due.sort((a, b) => (PHASE[a.cmd.t] ?? 3) - (PHASE[b.cmd.t] ?? 3));
  const clash = new Set<Command>();
  const sites = due.map(({ cmd }) => {
    if (cmd.t !== 'build' || !g.players[cmd.p] || !Number.isInteger(cmd.tx) || !Number.isInteger(cmd.ty)) return null;
    if (!DEFS[cmd.kind]?.building || !canPlace(g, cmd.p, cmd.kind, cmd.tx, cmd.ty)) return null;
    return { cmd, tx: cmd.tx, ty: cmd.ty, size: DEFS[cmd.kind]!.size };
  });
  for (const a of sites) for (const b of sites) {
    if (!a || !b || a.cmd.p === b.cmd.p) continue;
    if (a.tx < b.tx + b.size && b.tx < a.tx + a.size && a.ty < b.ty + b.size && b.ty < a.ty + a.size) clash.add(a.cmd);
  }
  for (const { cmd } of due) {
    g.log.push({ tick: g.tick, cmd });
    if (clash.has(cmd)) {
      refuse(g, cmd.p, "Can't build there");
      continue;
    }
    switch (cmd.t) {
      case 'build': cmdBuild(g, cmd); break;
      case 'cancel': cmdCancel(g, cmd); break;
      case 'train': tryTrain(g, cmd.p, cmd.kind, false); break;
      case 'research': cmdResearch(g, cmd); break;
      case 'repeat': {
        const pl = g.players[cmd.p];
        if (!pl || !FACTIONS[pl.faction].units.includes(cmd.kind)) break;
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
        const c = centroid(members, g.map);
        tx = c.x;
        ty = c.y;
      }
    }
  }
  const vx = tx - b.x, vy = ty - b.y;
  const l = Math.max(1, isqrt(vx * vx + vy * vy));
  const out = bd.radius + Math.trunc(TILE * 0.9);
  const door = snapOpen(g, b.x + Math.trunc((vx * out) / l), b.y + Math.trunc((vy * out) / l), tx, ty);
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
    const s = SLOTS[g.tick % 9]!, turn = b.owner === 1 ? -1 : 1;
    goal = snapOpen(g, b.x + Math.trunc((vx * (out + TILE * 3)) / l) + s.x * turn, b.y + Math.trunc((vy * (out + TILE * 3)) / l) + s.y * turn);
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
    if (isResearch(kind)) {
      const pl = g.players[b.owner]!;
      const level = kind === K.Weapons ? pl.weapons : pl.armour;
      if (b.qprog >= researchCost(kind, level).time) {
        b.queue.shift();
        b.qprog = 0;
        if (kind === K.Weapons) pl.weapons = Math.min(RULES.researchMax, level + 1);
        else pl.armour = Math.min(RULES.researchMax, level + 1);
        g.events.push({ t: 'done', owner: b.owner, kind, x: b.x, y: b.y });
      }
    } else if (b.qprog >= def(kind).time) {
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

/** What is left where a Worker works: a pile of Blocks, or the battery pack under a Refinery. */
function nodeLeft(g: Game, node: Entity): number {
  if (node.kind === K.Pile) return node.amount;
  if (node.kind !== K.Refinery || !node.built || node.hp <= 0) return 0;
  const cell = g.byId.get(node.pile);
  return cell ? cell.amount : 0;
}

function pickPile(g: Game, w: Entity, counts: Map<number, number>): Entity | undefined {
  const hqs = g.ents.filter((e) => e.owner === w.owner && e.kind === K.HQ && e.built && e.hp > 0);
  if (hqs.length === 0) return undefined;
  let best: Entity | undefined;
  let bestScore = Number.MAX_SAFE_INTEGER;
  const reach = RULES.baseReach * TILE;
  for (const p of g.ents) {
    const refinery = p.kind === K.Refinery && p.owner === w.owner;
    if (!refinery && p.kind !== K.Pile) continue;
    if (nodeLeft(g, p) <= 0) continue;
    let near = false;
    for (const hq of hqs) {
      if (dist(hq.x, hq.y, p.x, p.y) <= reach) {
        near = true;
        break;
      }
    }
    if (!near) continue;
    const n = counts.get(p.id) ?? 0;
    let score = dist(w.x, w.y, p.x, p.y);
    if (refinery) {
      // A Refinery takes three Workers and no more; a free place there beats a pile a little further off.
      if (n >= RULES.perRefinery) continue;
      score -= TILE * 6;
    } else {
      score += n >= RULES.perPile ? 1_000_000 + n * 200_000 : n * 3 * TILE;
    }
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** A Refinery by this Headquarters that still has a place free. */
function openRefinery(g: Game, hq: Entity, counts: Map<number, number>): Entity | undefined {
  const reach = RULES.baseReach * TILE;
  for (const r of g.ents) {
    if (r.kind !== K.Refinery || r.owner !== hq.owner || nodeLeft(g, r) <= 0) continue;
    if ((counts.get(r.id) ?? 0) >= RULES.perRefinery) continue;
    if (dist(hq.x, hq.y, r.x, r.y) <= reach) return r;
  }
  return undefined;
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
  // How many Workers each pile and Refinery has, counted before anyone acts and kept up to date as they do.
  // (Counted part-way through, the tally would show one side's Workers after their turn and the other's before.)
  const counts = new Map<number, number>();
  for (const e of g.ents) {
    if (e.kind === K.Worker && e.pile && (e.ws === W.ToPile || e.ws === W.Harvest || e.ws === W.ToHQ)) {
      counts.set(e.pile, (counts.get(e.pile) ?? 0) + 1);
    }
  }
  const assigned = () => counts;
  const leave = (e: Entity) => {
    if (e.pile) counts.set(e.pile, (counts.get(e.pile) ?? 1) - 1);
    e.pile = 0;
  };
  /** A Worker done with a building site goes back to hauling: to the Headquarters with a load, else to look for work. */
  const offSite = (e: Entity) => {
    e.site = 0;
    if (e.carry > 0) {
      e.ws = W.ToHQ;
      if (e.pile) counts.set(e.pile, (counts.get(e.pile) ?? 0) + 1);
    } else {
      e.pile = 0;
      e.ws = W.Idle;
    }
  };
  if (g.rebalance !== 0) {
    // A new Headquarters just opened: move the Workers a base can't use over to it.
    const who = g.rebalance;
    g.rebalance = 0;
    const c = assigned();
    for (const e of g.ents) {
      if (e.owner < 0 || (who & (1 << e.owner)) === 0 || e.kind !== K.Worker || !e.pile) continue;
      if (e.ws !== W.ToPile && e.ws !== W.ToHQ) continue;
      if (g.byId.get(e.pile)?.kind !== K.Pile) continue;
      const n = c.get(e.pile) ?? 0;
      if (n > RULES.perPile) {
        // One on its way back with a load finishes the trip, and looks for new work once it has delivered.
        leave(e);
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
        const pile = pickPile(g, e, assigned());
        if (pile) {
          e.pile = pile.id;
          e.ws = W.ToPile;
          e.losTick = -99;
          counts.set(pile.id, (counts.get(pile.id) ?? 0) + 1);
        }
        break;
      }
      case W.ToPile: {
        const pile = g.byId.get(e.pile);
        if (!pile || nodeLeft(g, pile) <= 0) {
          leave(e);
          e.ws = W.Idle;
          break;
        }
        if (nearFootprint(e, pile, pileReach)) {
          if (pile.kind === K.Refinery) {
            // A Refinery has room for all three of its Workers at once.
            e.ws = W.Harvest;
            e.timer = RULES.harvestTicks;
          } else if (pile.busy === 0 || !g.byId.has(pile.busy)) {
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
        if (!pile || (pile.kind === K.Refinery && nodeLeft(g, pile) <= 0)) {
          leave(e);
          e.ws = W.Idle;
          break;
        }
        if (--e.timer <= 0) {
          if (pile.kind === K.Refinery) {
            const cell = g.byId.get(pile.pile)!;
            const take = Math.min(RULES.gasCarry, cell.amount);
            cell.amount -= take;
            e.carry = take;
            e.cargo = 1;
          } else {
            const take = Math.min(RULES.carry, pile.amount);
            pile.amount -= take;
            pile.busy = 0;
            e.carry = take;
            e.cargo = 0;
            if (pile.amount <= 0) pile.hp = 0;
          }
          e.ws = W.ToHQ;
          e.losTick = -99;
        }
        break;
      }
      case W.ToHQ: {
        const hq = nearestHQ(g, e);
        if (!hq) break;
        if (nearFootprint(e, hq, Math.trunc(TILE * 0.7))) {
          const pl = g.players[e.owner]!;
          if (e.cargo === 1) {
            pl.gas += e.carry;
            pl.stats.gathered2 += e.carry;
          } else {
            pl.blocks += e.carry;
            pl.stats.gathered += e.carry;
          }
          e.carry = 0;
          e.cargo = 0;
          e.losTick = -99;
          const pile = e.pile ? g.byId.get(e.pile) : undefined;
          if (!pile || pile.kind === K.Pile) {
            // A Refinery by this Headquarters with a place free takes the next Worker to walk past.
            const c = assigned();
            const r = openRefinery(g, hq, c);
            if (r) {
              if (pile) c.set(pile.id, (c.get(pile.id) ?? 1) - 1);
              c.set(r.id, (c.get(r.id) ?? 0) + 1);
              e.pile = r.id;
              e.ws = W.ToPile;
              break;
            }
          }
          if (pile && nodeLeft(g, pile) > 0) e.ws = W.ToPile;
          else {
            leave(e);
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
          offSite(e);
          break;
        }
        if (nearFootprint(e, s, Math.trunc(TILE * 0.75))) e.ws = W.Build;
        else moveTo(g, e, s.x, s.y, speed, s);
        break;
      }
      case W.Build: {
        const s = g.byId.get(e.site);
        if (!s || s.built || s.hp <= 0) {
          offSite(e);
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
          offSite(e);
          g.events.push({ t: 'done', owner: s.owner, kind: s.kind, x: s.x, y: s.y });
          if (s.kind === K.HQ) g.rebalance |= 1 << s.owner;
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

function acquire(g: Game, b: Buckets, e: Entity, d: Def, extra: number): number {
  let best = 0;
  let bestScore = 1 << 30;
  const far = d.range + RULES.highRange + extra;
  b.near(e.x, e.y, far + TILE * 3, (o) => {
    if (o.owner === e.owner || o.owner < 0 || o.hp <= 0) return;
    const od = def(o.kind);
    const pct = d.vs[od.cls]!;
    if (pct === 0) return;
    if (!wasVisibleTo(g, e.owner, o)) return;
    const dd = dist(e.x, e.y, o.px, o.py) - od.radius;
    if (dd > reachThen(g, e, o, d) + extra || dd < d.minRange) return;
    let score = dd;
    if (od.building) score += od.range > 0 && o.built ? 0 : TILE * 6;
    else if (o.kind === K.Worker) score += e.kind === K.Runner || e.kind === K.Gunship ? -TILE * 2 : TILE * 2;
    if (pct >= 150) score -= TILE * 2;
    else if (pct <= 50) score += TILE;
    if (score < bestScore || (score === bestScore && o.id < best)) {
      bestScore = score;
      best = o.id;
    }
  });
  return best;
}

function unitStep(g: Game, b: Buckets, e: Entity, pace: readonly number[]): void {
  const d = def(e.kind);
  let t = e.tgt ? g.byId.get(e.tgt) : undefined;
  if (t && (t.hp <= 0 || !wasVisibleTo(g, e.owner, t))) {
    t = undefined;
    e.tgt = 0;
  }
  const marching = e.mode === O.Move && !e.arrived;
  if (!marching && d.range > 0) {
    // Everyone looks again for a better target on the same ticks.
    if (!t || g.tick % 4 === 0) {
      const id = acquire(g, b, e, d, e.mode === O.Hold ? 0 : RULES.notice);
      if (id) {
        if (id !== e.tgt) e.losTick = -99;
        e.tgt = id;
        t = g.byId.get(id);
      } else if (!t) {
        e.tgt = 0;
      }
    }
    if (t && e.mode === O.Idle && dist(e.x, e.y, e.ax, e.ay) > RULES.leash && !inRangeThen(g, e, t, d)) {
      t = undefined;
      e.tgt = 0;
    }
  }
  if (t && !marching) {
    if (inRangeThen(g, e, t, d)) {
      e.fx = t.px - e.x;
      e.fy = t.py - e.y;
    } else if (e.mode !== O.Hold) {
      moveTo(g, e, t.px, t.py, d.speed, def(t.kind).building ? t : undefined);
    }
    return;
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
    e.px = e.x;
    e.py = e.y;
  }
  for (const e of g.ents) {
    if (!isFighter(e) || e.hp <= 0) continue;
    unitStep(g, b, e, pace);
    e.still = e.x === e.px && e.y === e.py ? Math.min(e.still + 1, 999) : 0;
  }
}

const APART: readonly { x: number; y: number }[] = [
  { x: 4, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 4 }, { x: -3, y: 3 }, { x: -4, y: 0 }, { x: -3, y: -3 }, { x: 0, y: -4 }, { x: 3, y: -3 },
];

/**
 * Units that overlap push each other apart. Every push is worked out from where the units stand now and
 * added up, and only then is anyone moved, so the result doesn't depend on the order units are looked at.
 */
function separate(g: Game, b: Buckets): void {
  b.fill(g.ents, (e) => isFighter(e) && e.hp > 0);
  const nav = g.nav;
  for (const a of g.ents) {
    if (!isFighter(a) || a.hp <= 0) continue;
    const ad = def(a.kind);
    const ra = ad.radius;
    b.near(a.x, a.y, ra * 2 + 128, (o) => {
      if (o.id <= a.id) return;
      const od = def(o.kind);
      // Flyers jostle only with flyers.
      if (od.air !== ad.air) return;
      let dx = o.x - a.x, dy = o.y - a.y;
      const rr = ra + od.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;
      let d = isqrt(d2);
      if (d === 0) {
        // Standing on the very same spot (a new unit at a busy door): they part along a line that turns with
        // the clock. Of two on one side the newer goes its side's way along it; of two enemies, each goes
        // its own side's way. Chosen by anything else, such as their ids, the two ends of the map would differ.
        const way = APART[g.tick % APART.length]!;
        const turn = (a.owner === o.owner ? o.owner : 1 - o.owner) === 1 ? -1 : 1;
        dx = way.x * turn;
        dy = way.y * turn;
        d = isqrt(dx * dx + dy * dy);
      }
      const push = Math.min(64, Math.trunc((rr - d) / 2) + 2);
      const px = Math.trunc((dx * push) / d), py = Math.trunc((dy * push) / d);
      a.qx -= px;
      a.qy -= py;
      o.qx += px;
      o.qy += py;
    });
  }
  for (const e of g.ents) {
    if (e.qx === 0 && e.qy === 0) continue;
    let qx = e.qx, qy = e.qy;
    e.qx = 0;
    e.qy = 0;
    if (e.mode === O.Hold) continue;
    // A unit in a crowd is shoved from many sides: no more than a third of a tile in one tick.
    const l = isqrt(qx * qx + qy * qy);
    if (l > 88) {
      qx = Math.trunc((qx * 88) / l);
      qy = Math.trunc((qy * 88) / l);
    }
    if (def(e.kind).air ? inMap(g, e.x + qx, e.y + qy) : !nav.blockedAt(e.x + qx, e.y + qy)) {
      e.x += qx;
      e.y += qy;
    }
  }
}

function inMap(g: Game, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.map.w * TILE && y < g.map.h * TILE;
}

/**
 * Damage of one hit. Research works in hundredths of a point, and what doesn't make a whole point is
 * carried to the shooter's next shot, so small weapons gain from research too.
 */
function damage(g: Game, by: Entity, d: Def, t: Entity, share: number): number {
  const td = def(t.kind);
  const hit = Math.max(1, Math.trunc((d.dmg * d.vs[td.cls]!) / 100));
  const up = d.building ? 100 : 100 + g.players[by.owner]!.weapons * RULES.weaponStep;
  const down = td.building ? 100 : 100 - g.players[t.owner]!.armour * RULES.armourStep;
  if (up === 100 && down === 100 && share === 100) return hit;
  // Splash is rounded down for each unit caught in it, so who stands where in the blast decides nothing else.
  if (share !== 100) return Math.max(1, Math.trunc((hit * up * down * share) / 1_000_000));
  const v = Math.trunc((hit * up * down) / 100) + by.frac;
  by.frac = v % 100;
  return Math.trunc(v / 100);
}

function shooting(g: Game, b: Buckets): void {
  const hits: { t: Entity; dmg: number }[] = [];
  for (const e of g.ents) {
    const d = def(e.kind);
    if (d.range === 0 || e.hp <= 0 || !e.built) continue;
    if (e.cd > 0) e.cd--;
    if (d.building) {
      let t = e.tgt ? g.byId.get(e.tgt) : undefined;
      if (t && (t.hp <= 0 || !inRange(g, e, t, d) || !visibleTo(g, e.owner, t))) {
        t = undefined;
        e.tgt = 0;
      }
      if (!t && g.tick % 2 === 0) e.tgt = acquire(g, b, e, d, 0);
    } else if (e.mode === O.Move && !e.arrived) {
      continue;
    }
    const t = e.tgt ? g.byId.get(e.tgt) : undefined;
    if (!t || t.hp <= 0 || !inRange(g, e, t, d)) continue;
    const td = def(t.kind);
    if (d.minRange > 0 && dist(e.x, e.y, t.x, t.y) - td.radius < d.minRange) continue;
    e.fx = t.x - e.x;
    e.fy = t.y - e.y;
    // A weapon that needs setting up fires only once its crew has stood still long enough.
    if (e.cd > 0 || e.still < d.setup) continue;
    const dmg = damage(g, e, d, t, 100);
    if (dmg > 0) hits.push({ t, dmg });
    if (d.splash > 0) {
      b.near(t.x, t.y, d.splash + TILE * 2, (o) => {
        if (o === t || o.owner === e.owner || o.owner < 0 || o.hp <= 0) return;
        const od = def(o.kind);
        if (od.air !== td.air || d.vs[od.cls] === 0) return;
        if (dist(t.x, t.y, o.x, o.y) - od.radius > d.splash) return;
        const part = damage(g, e, d, o, RULES.splashShare);
        if (part > 0) hits.push({ t: o, dmg: part });
      });
    }
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
    if (e.kind === K.Refinery) {
      // The battery pack outlives the Refinery, and still stands in the way.
      const cell = g.byId.get(e.pile);
      if (cell) cell.site = 0;
    } else if (e.kind === K.Pile || d.building) {
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
  s.all.fill(g.ents, (e) => e.owner >= 0 && e.hp > 0);
  workers(g);
  units(g, s.all);
  separate(g, s.mobile);
  shooting(g, s.all);
  cleanup(g);
  if (g.tick % 2 === 0) updateFog(g);
  accounts(g);
}
