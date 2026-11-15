// One running match: the game loop, the player's selection and camera, and the numbers the panels show.
// Nothing here decides a rule; it asks src/sim and sends commands through the same door the opponent uses.
import { computed, signal } from '@preact/signals';
import { Bot } from '../ai/bot';
import { DEFS, FACTIONS, RULES, def, isHall, isRefinery, isResearch, isWorker, researchCost, researchOf } from '../sim/data';
import { dist } from '../sim/nav';
import { canPlace, centroid, createGame, groupUnits, hasBuilt, missing, onNestingGround, schedule, spawn, type Game } from '../sim/state';
import { step } from '../sim/step';
import { makeView } from '../sim/view';
import { K, O, TICKS_PER_SEC, TILE, type Command, type Entity, type Faction, type Kind, type OrderMode } from '../sim/types';

export interface Camera { x: number; y: number; zoom: number }

export interface GroupInfo {
  count: number;
  kinds: { kind: Kind; n: number }[];
  hp: number;
  hurt: boolean;
  moving: boolean;
}

export interface TrainInfo { kind: Kind; queued: number; progress: number; ok: boolean; why: string; repeat: boolean }
export interface BuildInfo { kind: Kind; ok: boolean; why: string }
export interface ResearchInfo {
  kind: Kind; level: number; max: number; cost: number; gas: number; ok: boolean; why: string;
  /** 0 to 1 while a level is being researched, else -1. */
  progress: number;
}

const isDinoKind = (kind: number) => FACTIONS.dino.buildings.includes(kind as Kind);

/** "a Barracks", "an Armory". */
const a = (name: string) => `${'AEIOU'.includes(name[0]!) ? 'an' : 'a'} ${name}`;

export interface Hud {
  tick: number;
  blocks: number;
  /** Batteries. */
  gas: number;
  supply: number;
  cap: number;
  groups: GroupInfo[];
  rally: number;
  train: TrainInfo[];
  build: BuildInfo[];
  research: ResearchInfo[];
  workers: number;
  /** Workers your bases have work for. */
  work: number;
  idleBarracks: number;
  /** Dino Pack: eggs ready across your Nests, and how many they could hold. */
  eggs: number;
  eggMax: number;
}

export interface Toast { id: number; text: string; kind: 'warn' | 'info'; x?: number; y?: number; until: number }

export interface Fx {
  t: 'shot' | 'fall' | 'ripple' | 'puff' | 'wreck';
  x1: number; y1: number; x2: number; y2: number;
  kind: number; owner: number; born: number; life: number; mode?: number;
}

export interface Placing { kind: Kind; tx: number; ty: number; ok: boolean }

/** Screen space the panels cover, in CSS pixels. The battlefield is what is left between them. */
export const INSET = { left: 172, right: 152, top: 46 };

const STEP_MS = 1000 / TICKS_PER_SEC;

export class Match {
  readonly g: Game;
  readonly bot: Bot;
  readonly me = 0;
  cam: Camera;
  viewW = 800;
  viewH = 380;
  /** Positions one tick ago, for smooth drawing between ticks. */
  prev = new Map<number, { x: number; y: number }>();
  alpha = 1;
  fx: Fx[] = [];
  fogStamp = 0;

  readonly sel = signal(-1);
  /**
   * How each group answers a tap on the map: fighting on the way (Attack) or not stopping (Move). It is the
   * group's own and it stays as set until the player changes it, or the group empties.
   */
  readonly modes = signal<OrderMode[]>([O.Attack, O.Attack, O.Attack, O.Attack]);
  /** The selected group's mode. */
  readonly mode = computed<OrderMode>(() => (this.sel.value >= 0 ? this.modes.value[this.sel.value] ?? O.Attack : O.Attack));
  readonly placing = signal<Placing | null>(null);
  readonly site = signal(0);
  readonly sheet = signal(-1);
  readonly paused = signal(false);
  readonly menu = signal(false);
  readonly fast = signal(false);
  readonly over = signal(-1);
  readonly toasts = signal<Toast[]>([]);
  readonly hud = signal<Hud>({ tick: 0, blocks: 0, gas: 0, supply: 0, cap: 0, groups: [], rally: 0, train: [], build: [], research: [], workers: 0, work: 0, idleBarracks: 0, eggs: 0, eggMax: 0 });

  private acc = 0;
  private last = 0;
  private raf = 0;
  private toastId = 1;
  private lastAlert = new Map<string, number>();
  private groupHp: number[] = [0, 0, 0, 0];
  private hurtUntil: number[] = [0, 0, 0, 0];
  private running = false;
  onFrame: (() => void) | null = null;

  /** `factions` is what you play and what the opponent plays. */
  constructor(seed: number, readonly level: number, readonly factions: readonly [Faction, Faction] = ['green', 'green']) {
    this.g = createGame(seed, undefined, factions);
    this.bot = new Bot(1, seed + 1, { level, faction: factions[1], foe: factions[0] });
    const hq = this.g.ents.find((e) => e.owner === this.me && isHall(e.kind))!;
    this.cam = { x: hq.x + 5 * TILE, y: hq.y - 2 * TILE, zoom: 24 };
    this.refresh();
  }

  // ---------------------------------------------------------------- loop

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(now: number): void {
    const dt = Math.min(250, now - this.last);
    this.last = now;
    if (!this.paused.value && this.over.value < 0) {
      this.acc += dt * (this.fast.value ? 2 : 1);
      let n = 0;
      while (this.acc >= STEP_MS && n < 6) {
        this.tick();
        this.acc -= STEP_MS;
        n++;
      }
      if (n === 6) this.acc = 0;
      this.alpha = Math.min(1, this.acc / STEP_MS);
    }
    const t = performance.now();
    if (this.fx.length > 0) this.fx = this.fx.filter((f) => t - f.born < f.life);
    if (this.toasts.value.some((x) => x.until < t)) this.toasts.value = this.toasts.value.filter((x) => x.until >= t);
    this.onFrame?.();
  }

  /** Advances the match by one tick. Also used by tests to run ahead. */
  tick(): void {
    const g = this.g;
    this.prev.clear();
    for (const e of g.ents) if (e.kind < 20) this.prev.set(e.id, { x: e.x, y: e.y });
    for (const cmd of this.bot.think(makeView(g, this.bot.p))) schedule(g, cmd);
    step(g);
    this.absorb();
    if (g.tick % 2 === 0) {
      this.fogStamp++;
      this.refresh();
    }
    if (g.winner >= 0 && this.over.value < 0) this.over.value = g.winner;
  }

  private absorb(): void {
    const g = this.g, now = performance.now();
    const pl = g.players[this.me]!;
    // Flyers are seen from any height, so anything to do with one uses the wider of the two views.
    const seen = (x: number, y: number, air = false) => (air ? pl.visAir : pl.vis)[Math.floor(y / TILE) * g.map.w + Math.floor(x / TILE)] === 1;
    for (const ev of g.events) {
      switch (ev.t) {
        case 'shot': {
          const air = ev.kind === K.Gunship || ev.kind === K.Flak || ev.kind === K.Ptero;
          if (seen(ev.x1, ev.y1, air) || seen(ev.x2, ev.y2, air)) {
            const life = ev.kind === K.Mortar ? 620 : ev.kind === K.Volcano ? 420 : ev.kind === K.Bronto ? 380 : ev.kind === K.Lancer || ev.kind === K.Spitter ? 260
              : ev.kind === K.Tank || ev.kind === K.Jugger || ev.kind === K.Flak ? 300 : ev.kind === K.Rex || ev.kind === K.Horn ? 200 : 130;
            this.fx.push({ t: 'shot', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, kind: ev.kind, owner: ev.owner, born: now, life });
          }
          break;
        }
        case 'death':
          if (seen(ev.x, ev.y, def(ev.kind).air)) {
            const d = def(ev.kind);
            const t = d.building ? 'puff' : d.cls === 0 || (ev.kind >= K.Gatherer && ev.kind <= K.Egg) ? 'fall' : 'wreck';
            this.fx.push({ t, x1: ev.x, y1: ev.y, x2: ev.fx, y2: ev.fy, kind: ev.kind, owner: ev.owner, born: now, life: d.building ? 700 : t === 'wreck' ? 2600 : 1400 });
          }
          if (ev.owner === this.me && def(ev.kind).building) this.alert('lost', `${def(ev.kind).name} destroyed`, 'warn', ev.x, ev.y, 30);
          break;
        case 'hurt':
          if (ev.owner === this.me) {
            this.alert(isWorker(ev.kind) ? 'workers' : 'base', isWorker(ev.kind) ? `${def(ev.kind).plural} under attack` : 'Base under attack', 'warn', ev.x, ev.y, 120);
          }
          break;
        case 'done':
          if (ev.owner === this.me) {
            const text = isResearch(ev.kind)
              ? `${def(ev.kind).name} level ${pl[researchOf(ev.kind)]} researched`
              : `${def(ev.kind).name} ready`;
            this.alert(`done${ev.kind}`, text, 'info', ev.x, ev.y, 10);
          }
          break;
        case 'refused':
          if (ev.p === this.me) this.alert(`no:${ev.why}`, ev.why, 'warn', undefined, undefined, 15);
          break;
      }
    }
  }

  alert(key: string, text: string, kind: 'warn' | 'info', x?: number, y?: number, gapTicks = 60): void {
    const lastAt = this.lastAlert.get(key) ?? -9999;
    if (this.g.tick - lastAt < gapTicks) return;
    this.lastAlert.set(key, this.g.tick);
    const t: Toast = { id: this.toastId++, text, kind, x, y, until: performance.now() + (kind === 'warn' ? 3600 : 1700) };
    this.toasts.value = [...this.toasts.value.filter((o) => o.text !== text), t].slice(-2);
  }

  // ---------------------------------------------------------------- what the panels show

  refresh(): void {
    const g = this.g, me = this.me, pl = g.players[me]!;
    const groups: GroupInfo[] = [];
    for (let i = 0; i < RULES.groups; i++) {
      const us = groupUnits(g, me, i);
      const kinds = new Map<Kind, number>();
      let hp = 0, max = 0, moving = false;
      for (const u of us) {
        kinds.set(u.kind, (kinds.get(u.kind) ?? 0) + 1);
        hp += u.hp;
        max += def(u.kind).hp;
        if (!u.arrived) moving = true;
      }
      // An emptied group forgets Move: whoever fills it next starts out fighting on the way.
      if (us.length === 0 && this.modes.value[i] !== O.Attack) this.setMode(O.Attack, i);
      if (hp < this.groupHp[i]! - 0) this.hurtUntil[i] = g.tick + 15;
      this.groupHp[i] = hp;
      groups.push({
        count: us.length, hp: max ? hp / max : 0, hurt: g.tick < this.hurtUntil[i]! && us.length > 0, moving,
        kinds: [...kinds.entries()].sort((a, b) => a[0] - b[0]).map(([kind, n]) => ({ kind, n })),
      });
    }
    const f = FACTIONS[pl.faction];
    const dino = pl.faction === 'dino';
    let eggs = 0, eggMax = 0;
    for (const e of g.ents) {
      if (e.owner === me && e.kind === K.Nest && e.built) {
        eggs += e.eggs;
        eggMax += RULES.eggMax;
      }
    }
    const train: TrainInfo[] = f.units.map((kind) => {
      const d = def(kind);
      let queued = 0, progress = 0;
      for (const e of g.ents) {
        if (e.owner !== me || e.queue.length === 0) continue;
        for (const q of e.queue) if (q === kind) queued++;
        if (e.queue[0] === kind) progress = Math.max(progress, e.qprog / d.time);
      }
      let why = '';
      const lacks = missing(g, me, [d.madeAt!, ...d.needs]);
      if (lacks) why = `Needs ${a(def(lacks).name)}`;
      else if (dino && eggs === 0) why = 'No egg ready yet';
      else if (pl.blocks < d.cost) why = 'Not enough Blocks';
      else if (pl.gas < d.gas) why = 'Not enough Batteries';
      else if (pl.supply + d.supply * d.brood > pl.cap) why = 'Supply cap reached';
      return { kind, queued, progress, ok: why === '', why, repeat: pl.repeat.includes(kind) };
    });
    const build: BuildInfo[] = f.buildings.map((kind) => {
      const d = def(kind);
      let why = '';
      const lacks = missing(g, me, d.needs);
      if (lacks) why = `Needs ${a(def(lacks).name)}`;
      else if (pl.blocks < d.cost) why = 'Not enough Blocks';
      else if (pl.gas < d.gas) why = 'Not enough Batteries';
      return { kind, ok: why === '', why };
    });
    const research: ResearchInfo[] = f.research.map((kind) => {
      const level = pl[researchOf(kind)];
      const price = researchCost(kind, Math.min(level, RULES.researchMax - 1));
      let progress = -1;
      for (const e of g.ents) {
        if (e.owner !== me || e.kind !== f.lab) continue;
        const i = e.queue.indexOf(kind);
        if (i >= 0) progress = i === 0 ? e.qprog / price.time : 0;
      }
      let why = '';
      if (level >= RULES.researchMax) why = `${def(kind).name} is at its top level`;
      else if (progress >= 0) why = 'Already being researched';
      else if (!hasBuilt(g, me, f.lab)) why = `Needs ${a(def(f.lab).name)}`;
      else if (pl.blocks < price.cost) why = 'Not enough Blocks';
      else if (pl.gas < price.gas) why = 'Not enough Batteries';
      return { kind, level, max: RULES.researchMax, cost: price.cost, gas: price.gas, ok: why === '', why, progress };
    });
    let workers = 0, idleBarracks = 0, work = 0;
    const hqs = g.ents.filter((e) => e.owner === me && isHall(e.kind) && e.built);
    const byHQ = (e: Entity) => hqs.some((h) => dist(h.x, h.y, e.x, e.y) <= RULES.baseReach * TILE);
    for (const e of g.ents) {
      if (e.kind === K.Pile) {
        if (e.amount > 0 && byHQ(e)) work += RULES.perPile;
        continue;
      }
      if (e.owner !== me) continue;
      if (isWorker(e.kind)) workers++;
      else if (e.kind === K.Barracks && e.built && e.queue.length === 0) idleBarracks++;
      else if (isRefinery(e.kind) && e.built && (g.byId.get(e.pile)?.amount ?? 0) > 0 && byHQ(e)) work += RULES.perRefinery;
    }
    this.hud.value = { tick: g.tick, blocks: pl.blocks, gas: pl.gas, supply: pl.supply, cap: pl.cap, groups, rally: pl.rally, train, build, research, workers, work, idleBarracks, eggs, eggMax };
    const p = this.placing.value;
    if (p) {
      const ok = canPlace(g, me, p.kind, p.tx, p.ty);
      if (ok !== p.ok) this.placing.value = { ...p, ok };
    }
    const s = this.site.value;
    if (s) {
      const e = g.byId.get(s);
      if (!e || e.built) this.site.value = 0;
    }
  }

  /** Test hook: drops a unit onto the map, so speed tests can stage a large battle. */
  debugSpawn(kind: Kind, owner: number, tx: number, ty: number): void {
    const u = spawn(this.g, kind, owner, Math.round(tx * TILE), Math.round(ty * TILE));
    if (!def(kind).building) u.group = owner === this.me ? 3 : 0;
  }

  // ---------------------------------------------------------------- commands from the player

  issue(cmd: Command): void {
    schedule(this.g, cmd);
  }

  train(kind: Kind): void {
    this.issue({ t: 'train', p: this.me, kind });
  }

  research(kind: Kind): void {
    this.issue({ t: 'research', p: this.me, kind });
  }

  toggleRepeat(kind: Kind): void {
    const on = !this.g.players[this.me]!.repeat.includes(kind);
    this.issue({ t: 'repeat', p: this.me, kind, on });
    this.alert(`rep${kind}${on}`, on ? `Keeping ${def(kind).plural} coming` : `Stopped repeating ${def(kind).plural}`, 'info', undefined, undefined, 0);
  }

  selectGroup(i: number): void {
    this.site.value = 0;
    this.sel.value = this.sel.value === i ? -1 : i;
  }

  focusGroup(i: number): void {
    const us = groupUnits(this.g, this.me, i);
    if (us.length === 0) return;
    const c = centroid(us);
    this.cam.x = c.x;
    this.cam.y = c.y;
    this.clampCam();
    this.sel.value = i;
  }

  /** Sets how a group (the selected one unless named) answers taps on the map from now on. */
  setMode(mode: OrderMode, group = this.sel.value): void {
    if (group < 0 || (mode !== O.Attack && mode !== O.Move)) return;
    this.modes.value = this.modes.value.map((old, i) => (i === group ? mode : old));
  }

  hold(): void {
    const i = this.sel.value;
    if (i < 0) return;
    this.issue({ t: 'order', p: this.me, group: i, mode: O.Hold, x: 0, y: 0 });
  }

  orderTo(x: number, y: number): boolean {
    const i = this.sel.value;
    if (i < 0 || groupUnits(this.g, this.me, i).length === 0) return false;
    const mode = this.mode.value === O.Move ? O.Move : O.Attack;
    this.issue({ t: 'order', p: this.me, group: i, mode, x: Math.round(x), y: Math.round(y) });
    this.fx.push({ t: 'ripple', x1: x, y1: y, x2: 0, y2: 0, kind: 0, owner: this.me, born: performance.now(), life: 520, mode });
    return true;
  }

  assign(from: number, to: number, kind: number, count: number): void {
    this.issue({ t: 'assign', p: this.me, from, to, kind, count });
  }

  /**
   * Moves `count` units from one group to another: of one kind, or (kind 0) a fair share of every kind in
   * the group, so that half an army is half its Troopers and half its Tanks, not its oldest half.
   */
  assignPart(from: number, to: number, kind: number, count: number): void {
    const kinds = this.hud.value.groups[from]?.kinds ?? [];
    const total = kinds.reduce((n, k) => n + k.n, 0);
    if (from === to || total === 0 || count <= 0) return;
    if (kind !== 0) {
      const have = kinds.find((k) => k.kind === kind)?.n ?? 0;
      if (have > 0) this.assign(from, to, kind, count >= have ? 0 : count);
      return;
    }
    if (count >= total) {
      this.assign(from, to, 0, 0);
      return;
    }
    // Largest remainders: every kind gets its whole share, and the units left over go to the biggest fractions.
    const shares = kinds.map((k) => ({ kind: k.kind, n: Math.floor((k.n * count) / total), rest: (k.n * count) % total, max: k.n }));
    let left = count - shares.reduce((n, sh) => n + sh.n, 0);
    for (const sh of [...shares].sort((x, y) => y.rest - x.rest || x.kind - y.kind)) {
      if (left <= 0) break;
      if (sh.n < sh.max) {
        sh.n++;
        left--;
      }
    }
    for (const sh of shares) if (sh.n > 0) this.assign(from, to, sh.kind, sh.n >= sh.max ? 0 : sh.n);
  }

  setRally(i: number): void {
    this.issue({ t: 'rally', p: this.me, group: i });
  }

  // ---------------------------------------------------------------- building placement

  /** Battery packs with no Refinery on them, nearest first. */
  private freePacks(x: number, y: number): Entity[] {
    return this.g.ents.filter((e) => e.kind === K.Cell && e.site === 0)
      .sort((p, q) => dist(x, y, p.x, p.y) - dist(x, y, q.x, q.y));
  }

  beginPlace(kind: Kind): void {
    const g = this.g, d = def(kind);
    this.site.value = 0;
    if (isRefinery(kind)) {
      // A Refinery has only a few places it can go: start on the free pack nearest one of your Headquarters.
      const hqs = g.ents.filter((e) => e.owner === this.me && isHall(e.kind));
      const near = (e: Entity) => Math.min(...hqs.map((h) => dist(h.x, h.y, e.x, e.y)), 1e9) * 4 + dist(this.cam.x, this.cam.y, e.x, e.y);
      const pack = this.freePacks(this.cam.x, this.cam.y).sort((p, q) => near(p) - near(q))[0];
      if (!pack) {
        this.alert('nopack', 'No battery pack is free', 'warn', undefined, undefined, 5);
        return;
      }
      this.cam.x = pack.x;
      this.cam.y = pack.y;
      this.clampCam();
      const tx = Math.round(pack.x / TILE) - 1, ty = Math.round(pack.y / TILE) - 1;
      this.placing.value = { kind, tx, ty, ok: canPlace(g, this.me, kind, tx, ty) };
      return;
    }
    // Start at the middle of the view; if the view is over rock or far from open ground, start at home.
    let tx = Math.round(this.cam.x / TILE - d.size / 2), ty = Math.round(this.cam.y / TILE - d.size / 2);
    const spot = this.nearestFree(kind, tx, ty, 8);
    if (spot) {
      tx = spot.tx;
      ty = spot.ty;
    } else {
      const hq = g.ents.find((e) => e.owner === this.me && isHall(e.kind) && e.built);
      if (hq) {
        const s2 = this.nearestFree(kind, Math.round(hq.x / TILE) + 5, Math.round(hq.y / TILE), 12);
        if (s2) {
          tx = s2.tx;
          ty = s2.ty;
          this.cam.x = (tx + d.size / 2) * TILE;
          this.cam.y = (ty + d.size / 2) * TILE;
          this.clampCam();
        }
      }
    }
    if (isHall(kind)) {
      // A Headquarters wants to sit by a pile of Blocks: start on the nearest free base site.
      const site = this.nearestSite(this.cam.x, this.cam.y);
      if (site) {
        tx = site.hx;
        ty = site.hy;
        this.cam.x = (tx + 2) * TILE;
        this.cam.y = (ty + 2) * TILE;
        this.clampCam();
      }
    }
    this.placing.value = { kind, tx, ty, ok: canPlace(g, this.me, kind, tx, ty) };
  }

  private nearestFree(kind: Kind, tx: number, ty: number, reach: number): { tx: number; ty: number } | null {
    for (let r = 0; r <= reach; r++) {
      let best: { tx: number; ty: number } | null = null, bestD = 1e9;
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
        if (!canPlace(this.g, this.me, kind, x, y)) continue;
        const dd = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (dd < bestD) {
          bestD = dd;
          best = { tx: x, ty: y };
        }
      }
      if (best) return best;
    }
    return null;
  }

  private nearestSite(x: number, y: number) {
    let best = null, bestD = Infinity;
    for (const b of this.g.map.bases) {
      if (!canPlace(this.g, this.me, FACTIONS[this.g.players[this.me]!.faction].hall, b.hx, b.hy)) continue;
      const dd = dist(x, y, (b.hx + 2) * TILE, (b.hy + 2) * TILE);
      if (dd < bestD) {
        bestD = dd;
        best = b;
      }
    }
    return best;
  }

  movePlace(tx: number, ty: number): void {
    const p = this.placing.value;
    if (!p) return;
    const d = def(p.kind);
    let nx = Math.max(0, Math.min(this.g.map.w - d.size, tx)), ny = Math.max(0, Math.min(this.g.map.h - d.size, ty));
    if (isRefinery(p.kind)) {
      // Snap onto a free battery pack when the outline comes close to one.
      const pack = this.freePacks((nx + 1) * TILE, (ny + 1) * TILE)[0];
      if (pack && dist((nx + 1) * TILE, (ny + 1) * TILE, pack.x, pack.y) <= 3 * TILE) {
        nx = Math.round(pack.x / TILE) - 1;
        ny = Math.round(pack.y / TILE) - 1;
      }
    }
    if (isHall(p.kind)) {
      // Snap onto a base site when the outline is dropped close to one.
      for (const b of this.g.map.bases) {
        if (Math.abs(b.hx - nx) <= 2 && Math.abs(b.hy - ny) <= 2) {
          nx = b.hx;
          ny = b.hy;
          break;
        }
      }
    }
    if (nx === p.tx && ny === p.ty) return;
    this.placing.value = { kind: p.kind, tx: nx, ty: ny, ok: canPlace(this.g, this.me, p.kind, nx, ny) };
  }

  confirmPlace(): void {
    const p = this.placing.value;
    if (!p) return;
    if (!p.ok) {
      const d = def(p.kind);
      const why = isRefinery(p.kind) ? `${a(d.name).replace(/^a/, 'A')} goes on a battery pack`
        : isDinoKind(p.kind) && !isHall(p.kind) && !onNestingGround(this.g, this.me, (p.tx + d.size / 2) * TILE, (p.ty + d.size / 2) * TILE) ? 'That goes on nesting ground, near a Nest'
          : "Can't build there";
      this.alert('place', why, 'warn', undefined, undefined, 5);
      return;
    }
    this.issue({ t: 'build', p: this.me, kind: p.kind, tx: p.tx, ty: p.ty });
    this.placing.value = null;
  }

  cancelPlace(): void {
    this.placing.value = null;
  }

  cancelSite(): void {
    const id = this.site.value;
    if (id) this.issue({ t: 'cancel', p: this.me, id });
    this.site.value = 0;
  }

  // ---------------------------------------------------------------- taps on the battlefield

  /** A tap at a point on the map, in sub-units. */
  tap(x: number, y: number): void {
    const g = this.g;
    const p = this.placing.value;
    if (p) {
      const d = def(p.kind);
      this.movePlace(Math.round(x / TILE - d.size / 2), Math.round(y / TILE - d.size / 2));
      return;
    }
    // An unfinished building of yours: offer to cancel it.
    for (const e of g.ents) {
      if (e.owner !== this.me || e.built || !DEFS[e.kind]!.building) continue;
      const half = (def(e.kind).size * TILE) / 2;
      if (Math.abs(x - e.x) <= half && Math.abs(y - e.y) <= half) {
        this.site.value = e.id;
        return;
      }
    }
    this.site.value = 0;
    const reach = Math.max(TILE * 0.9, (26 / this.cam.zoom) * TILE);
    let hit: Entity | undefined, hitD = reach;
    for (const e of g.ents) {
      if (e.owner !== this.me || e.group < 0) continue;
      const dd = dist(e.x, e.y, x, y);
      if (dd < hitD) {
        hitD = dd;
        hit = e;
      }
    }
    if (hit && hit.group !== this.sel.value) {
      this.sel.value = hit.group;
      return;
    }
    if (this.sel.value >= 0) {
      if (!this.orderTo(x, y)) this.sel.value = -1;
    }
  }

  /** A tap on the minimap: an order when a group is selected, else a camera jump. */
  tapMini(x: number, y: number): void {
    if (this.placing.value || this.sel.value < 0 || !this.orderTo(x, y)) this.lookAt(x, y);
  }

  lookAt(x: number, y: number): void {
    this.cam.x = x;
    this.cam.y = y;
    this.clampCam();
  }

  // ---------------------------------------------------------------- camera

  minZoom(): number {
    const w = this.viewW - INSET.left - INSET.right, h = this.viewH - INSET.top;
    return Math.min(w / this.g.map.w, h / this.g.map.h) * 0.96;
  }

  clampCam(): void {
    const c = this.cam;
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.zoom)) {
      c.x = (this.g.map.w * TILE) / 2;
      c.y = (this.g.map.h * TILE) / 2;
      c.zoom = 20;
    }
    c.zoom = Math.max(this.minZoom(), Math.min(44, c.zoom));
    c.x = Math.max(0, Math.min(this.g.map.w * TILE, c.x));
    c.y = Math.max(0, Math.min(this.g.map.h * TILE, c.y));
  }

  /** Screen point of the middle of the battlefield between the panels. */
  centre(): { x: number; y: number } {
    return { x: (INSET.left + this.viewW - INSET.right) / 2, y: (INSET.top + this.viewH) / 2 };
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    const c = this.centre();
    return { x: this.cam.x + ((sx - c.x) / this.cam.zoom) * TILE, y: this.cam.y + ((sy - c.y) / this.cam.zoom) * TILE };
  }

  toScreen(x: number, y: number): { x: number; y: number } {
    const c = this.centre();
    return { x: c.x + ((x - this.cam.x) / TILE) * this.cam.zoom, y: c.y + ((y - this.cam.y) / TILE) * this.cam.zoom };
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.toWorld(sx, sy);
    this.cam.zoom *= factor;
    this.clampCam();
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCam();
  }

  panBy(dx: number, dy: number): void {
    this.cam.x -= (dx / this.cam.zoom) * TILE;
    this.cam.y -= (dy / this.cam.zoom) * TILE;
    this.clampCam();
  }
}
