// One running match: the game loop, the player's selection and camera, and the numbers the panels show.
// Nothing here decides a rule; it asks src/sim and sends commands through the same door the opponent uses.
import { signal } from '@preact/signals';
import { Bot } from '../ai/bot';
import { FrenzyBot } from '../ai/frenzy';
import {
  ABILITIES, DEFS, FACTIONS, FRENZY, RULES, UNLOCK, WORK, abilityCd, def, frenzyUnits, frenzyUpgrades, income, isHall, isRefinery, isResearch, isWorker, levelNeeds,
  researchCost, researchOf, upgradeBlurb, upgradeCosts, upgradeKey,
  type Ability,
} from '../sim/data';
import { collectorsOf, hallOf, heroOf } from '../sim/frenzy';
import { classicMap } from '../sim/map';
import { dist } from '../sim/nav';
import { canPlace, centroid, createGame, groupUnits, hasBuilt, maxHp, missing, onLayer, onNestingGround, schedule, spawn, turned, type Game } from '../sim/state';
import { step } from '../sim/step';
import { makeView, type View } from '../sim/view';
import { sfx, type Voice } from './sound';
import { Chronicle } from './report';
import { nextHint, seenHint } from './hints';
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

/** One of the hero's abilities, as its button shows it. */
export interface AbilityInfo {
  name: string;
  short: string;
  blurb: string;
  /** The hero level that opens it. */
  level: number;
  locked: boolean;
  ready: boolean;
  /** Share of its wait still to run, 0 to 1. */
  wait: number;
  /** True for one that is pointed at a place on the map. */
  aims: boolean;
}

/** A unit on Frenzy's Spawn tab. */
export interface SpawnInfo {
  kind: Kind;
  unlocked: boolean;
  /** In the mix the base is making. */
  on: boolean;
  /** What unlocking it costs. */
  price: number;
  ok: boolean;
  why: string;
  /** 0 to 1 while this is the unit the base is working on, else -1. */
  progress: number;
  /** How long the base takes over one, in seconds, at its present Muster. */
  seconds: number;
}

export interface UpgradeInfo { kind: Kind; level: number; max: number; cost: number; ok: boolean; why: string; blurb: string }

export interface FrenzyHud {
  hero: {
    kind: Kind; alive: boolean; level: number;
    /** Health and experience toward the next level, each 0 to 1. */
    hp: number; xp: number;
    /** Seconds until a fallen hero is back. */
    back: number;
  };
  abilities: AbilityInfo[];
  spawn: SpawnInfo[];
  upgrades: UpgradeInfo[];
  /** How many of your Collectors stand (of two), and the Blocks a second they and the middle bring in. */
  collectors: number;
  income: number;
  /** Who holds the Watchtower in the middle: a side, -1 for nobody, -2 when you can't see it. */
  middle: number;
  overtime: boolean;
  /** Your base's health, 0 to 1. */
  hall: number;
  sides: { id: number; faction: Faction; out: boolean }[];
}

/** How a Frenzy round ended for you. */
export interface Outcome { won: boolean; nobody: boolean; place: number }

/** What the sides are called on screen: by their colour, since two may play the same faction. */
export const SIDES = ['Green', 'Tan', 'Blue', 'Red'] as const;

/** What each unit sounds like when it fires or bites, and how high: the same pop from a smaller or a bigger gun. */
const SHOT_SOUND: Partial<Record<number, [Voice, number]>> = {
  [K.Trooper]: ['rifle', 1], [K.Captain]: ['rifle', 0.85], [K.Runner]: ['zip', 1], [K.Bayonet]: ['bite', 1.7],
  [K.Lancer]: ['rocket', 1], [K.Spitter]: ['spit', 1], [K.Tank]: ['cannon', 1], [K.Jugger]: ['cannon', 0.75],
  [K.Turret]: ['cannon', 1.25], [K.Mortar]: ['mortar', 1], [K.Volcano]: ['mortar', 0.7], [K.Flak]: ['flak', 1],
  [K.Gunship]: ['rattle', 1], [K.Raptor]: ['bite', 1.25], [K.Horn]: ['bite', 0.8], [K.Rex]: ['bite', 0.55],
  [K.Alpha]: ['bite', 0.7], [K.Bronto]: ['stomp', 1], [K.Ptero]: ['screech', 1],
};

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
  /** What only Frenzy has; null in Classic. */
  frenzy: FrenzyHud | null;
}

export interface Toast { id: number; text: string; kind: 'warn' | 'info'; x?: number; y?: number; until: number }

export interface Fx {
  /**
   * shot, fall, wreck, puff: a weapon firing and what it leaves. ripple: where an order was given.
   * cast: an ability on its way (`kind` is the hero, `mode` the slot, `r` its radius in sub-units).
   * blast: one going off. level: a hero gaining a level (`mode`). coin: Blocks paid for a kill (`mode`).
   */
  t: 'shot' | 'fall' | 'ripple' | 'puff' | 'wreck' | 'cast' | 'blast' | 'level' | 'coin';
  x1: number; y1: number; x2: number; y2: number;
  kind: number; owner: number; born: number; life: number; mode?: number; r?: number;
}

export interface Placing { kind: Kind; tx: number; ty: number; ok: boolean }

/** Screen space the panels cover, in CSS pixels. The battlefield is what is left between them. */
export const INSET = { left: 172, right: 152, top: 46 };

const STEP_MS = 1000 / TICKS_PER_SEC;

/**
 * How fast the clock runs against the computer. This is the app's business alone: the rules take the same
 * ticks in the same order at any speed, so a slow match and a fast one with the same orders are the same match.
 */
export const SPEEDS = [
  { value: 0.5, label: '½×', name: 'Half speed' },
  { value: 0.75, label: '¾×', name: 'Three-quarter speed' },
  { value: 1, label: '1×', name: 'Normal speed' },
  { value: 2, label: '2×', name: 'Double speed' },
] as const;

/** Frenzy: whether the army goes wherever the hero is sent. Off unless the player has switched it on. */
function rememberedFollow(): boolean {
  try {
    return localStorage.getItem('foothold.heroFollow') === 'on';
  } catch {
    return false;
  }
}

function rememberedSpeed(): number {
  try {
    const v = Number(localStorage.getItem('foothold.speed'));
    return SPEEDS.some((x) => x.value === v) ? v : 1;
  } catch {
    return 1;
  }
}

const HERO = FRENZY.heroGroup;

export class Match {
  readonly g: Game;
  /** Which game this is: Frenzy (four corners, a hero each) or Classic. */
  readonly frenzy: boolean;
  /** Each side's build order and how its army grew, for the report at the end. */
  readonly chronicle: Chronicle;
  /** Classic's one opponent; Frenzy has three and keeps them in `rivals`. */
  readonly bot: Bot | undefined;
  readonly rivals: FrenzyBot[] = [];
  private readonly bots: { p: number; think(v: View): Command[] }[] = [];
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
   * How a tap on the map is answered: fighting on the way (Attack) or not stopping (Move). There is one
   * setting, for whatever is selected, and it stays as the player set it: nothing else ever changes it.
   */
  readonly mode = signal<OrderMode>(O.Attack);
  readonly placing = signal<Placing | null>(null);
  readonly site = signal(0);
  readonly sheet = signal(-1);
  readonly paused = signal(false);
  readonly menu = signal(false);
  /** One of `SPEEDS`; kept from match to match. */
  readonly speed = signal(rememberedSpeed());
  /** -1 while the match runs; then the winner's side, or 100 when a Frenzy round ended for you without one. */
  readonly over = signal(-1);
  /** Frenzy: how the round ended for you. */
  readonly outcome = signal<Outcome | null>(null);
  /** Frenzy: the ability waiting to be pointed at the map, or -1. */
  readonly aim = signal(-1);
  /** Frenzy: whether the group new units join goes wherever the hero is sent. */
  readonly follow = signal(rememberedFollow());
  /** Frenzy: counts taps on one of your Collectors, each of which asks the panel for the Tech tab. */
  readonly techAsk = signal(0);
  readonly toasts = signal<Toast[]>([]);
  /** A first-match hint on screen, if any. */
  readonly hint = signal<{ id: string; text: string } | null>(null);
  /** Hints are for matches started from the menu, not from a link (the tests' and the lab's way in). */
  hints = false;
  /** When each piece last fired, by id, in `performance.now()` time: the renderer's recoil and muzzle flashes. */
  readonly fired = new Map<number, number>();
  readonly hud = signal<Hud>({ tick: 0, blocks: 0, gas: 0, supply: 0, cap: 0, groups: [], rally: 0, train: [], build: [], research: [], workers: 0, work: 0, idleBarracks: 0, eggs: 0, eggMax: 0, frenzy: null });

  private acc = 0;
  private last = 0;
  private raf = 0;
  private toastId = 1;
  private lastAlert = new Map<string, number>();
  private groupHp: number[] = [0, 0, 0, 0];
  private hurtUntil: number[] = [0, 0, 0, 0];
  private running = false;
  onFrame: (() => void) | null = null;

  /** `factions` is what you play and then what each opponent plays: one opponent is Classic, three is Frenzy. */
  constructor(seed: number, readonly level: number, readonly factions: readonly Faction[] = ['green', 'green'], readonly mapId = 'twin') {
    // Brutal is the one level given anything: its opponent earns more on every load (Classic only, where there are loads).
    this.g = createGame(seed, factions.length === 2 ? classicMap(mapId) : undefined, factions, factions.map((_, i) => (i !== this.me && level === 3 && factions.length === 2 ? RULES.brutalBonus : 0)));
    this.frenzy = this.g.mode === 'frenzy';
    this.chronicle = new Chronicle(this.g);
    const hq = this.g.ents.find((e) => e.owner === this.me && isHall(e.kind))!;
    if (this.frenzy) {
      for (let p = 1; p < factions.length; p++) this.rivals.push(new FrenzyBot(p, seed + p, { level }));
      this.bots.push(...this.rivals);
      // Looking from your base toward the middle, wherever on the map your corner is.
      const out = turned(this.g, this.me, 4 * TILE, -4 * TILE);
      this.cam = { x: hq.x + out.x, y: hq.y + out.y, zoom: 21 };
    } else {
      this.bot = new Bot(1, seed + 1, { level, faction: factions[1], foe: factions[0] });
      this.bots.push(this.bot);
      this.cam = { x: hq.x + 5 * TILE, y: hq.y - 2 * TILE, zoom: 24 };
    }
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

  setSpeed(value: number): void {
    if (!SPEEDS.some((x) => x.value === value)) return;
    this.speed.value = value;
    try {
      localStorage.setItem('foothold.speed', String(value));
    } catch {
      // Private browsing: the speed still holds for this match.
    }
  }

  private frame(now: number): void {
    const dt = Math.min(250, now - this.last);
    this.last = now;
    if (!this.paused.value && this.over.value < 0) {
      this.acc += dt * this.speed.value;
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

  /**
   * Plays a saved match back up to where it was left: the opponents think again exactly as they did, and your
   * own orders are put back on the ticks they ran. A match is its seed and its orders, so nothing else is kept.
   * Stops after `budget` milliseconds so the screen can show how far it has got; call again until it says done.
   */
  replay(orders: readonly { tick: number; cmd: Command }[], to: number, budget = 40): boolean {
    const g = this.g, start = performance.now();
    while (g.tick < to && g.winner === -1) {
      // Your orders go in before the opponents think, as they did when you gave them between two ticks.
      while (this.replayAt < orders.length && orders[this.replayAt]!.tick <= g.tick + 1) {
        const o = orders[this.replayAt++]!;
        if (o.tick === g.tick + 1) schedule(g, o.cmd);
      }
      for (const bot of this.bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
      step(g);
      this.chronicle.note(g);
      if (performance.now() - start > budget) return false;
    }
    this.refresh();
    return true;
  }
  private replayAt = 0;
  private jingled = false;

  /** Advances the match by one tick. Also used by tests to run ahead. */
  tick(): void {
    const g = this.g;
    this.prev.clear();
    for (const e of g.ents) if (e.owner >= 0 && !DEFS[e.kind]!.building) this.prev.set(e.id, { x: e.x, y: e.y });
    for (const bot of this.bots) for (const cmd of bot.think(makeView(g, bot.p))) schedule(g, cmd);
    step(g);
    this.chronicle.note(g);
    this.absorb();
    if (g.tick % 2 === 0) {
      this.fogStamp++;
      this.refresh();
    }
    // A hint at a time, when its moment comes, and never over the end of a match.
    if (this.hints && g.tick % 20 === 0 && !this.hint.value && this.over.value < 0) this.hint.value = nextHint(this);
    if (this.frenzy) {
      // A Frenzy round is over for you when it is won, or when your own base is gone: the others play on without you.
      const pl = g.players[this.me]!;
      if (this.over.value < 0 && (g.winner !== -1 || pl.out)) {
        const left = g.players.filter((p) => !p.out).length;
        this.outcome.value = { won: g.winner === this.me, nobody: g.winner === -2, place: g.winner === this.me ? 1 : left + 1 };
        this.aim.value = -1;
        this.over.value = g.winner >= 0 ? g.winner : 100;
      }
    } else if (g.winner !== -1 && this.over.value < 0) this.over.value = g.winner >= 0 ? g.winner : 100;
    if (this.over.value >= 0 && !this.jingled) {
      this.jingled = true;
      this.chronicle.finish(g);
      sfx.play(this.over.value === this.me ? 'win' : 'lose', 1);
    }
    if (g.tick % 600 === 0) {
      for (const id of this.fired.keys()) if (!g.byId.has(id)) this.fired.delete(id);
    }
  }

  /** A sound from somewhere on the map: heard only on screen, louder close up, from the side it is on. */
  private hear(v: Voice, x: number, y: number, pitch = 1, gain = 1): void {
    if (!sfx.on) return;
    const at = this.toScreen(x, y);
    if (at.x < -60 || at.y < -60 || at.x > this.viewW + 60 || at.y > this.viewH + 60) return;
    const near = Math.max(0.3, Math.min(1, this.cam.zoom / 24));
    sfx.play(v, near * gain, ((at.x / Math.max(1, this.viewW)) * 2 - 1) * 0.6, pitch);
  }

  private absorb(): void {
    const g = this.g, now = performance.now();
    const pl = g.players[this.me]!;
    // Flyers are seen from any height, so anything to do with one uses the wider of the two views.
    const seen = (x: number, y: number, air = false) => (air ? pl.visAir : pl.vis)[Math.floor(y / TILE) * g.map.w + Math.floor(x / TILE)] === 1;
    for (const ev of g.events) {
      switch (ev.t) {
        case 'shot': {
          this.fired.set(ev.from, now);
          const air = ev.kind === K.Gunship || ev.kind === K.Flak || ev.kind === K.Ptero;
          if (seen(ev.x1, ev.y1, air) || seen(ev.x2, ev.y2, air)) {
            const life = ev.kind === K.Mortar ? 620 : ev.kind === K.Volcano ? 420 : ev.kind === K.Bronto ? 380 : ev.kind === K.Lancer || ev.kind === K.Spitter ? 260
              : ev.kind === K.Tank || ev.kind === K.Jugger || ev.kind === K.Flak ? 300 : ev.kind === K.Rex || ev.kind === K.Horn || ev.kind === K.Bayonet ? 200 : 130;
            this.fx.push({ t: 'shot', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, kind: ev.kind, owner: ev.owner, born: now, life });
            const [v, pitch] = SHOT_SOUND[ev.kind] ?? ['rifle', 1];
            this.hear(v, ev.x1, ev.y1, pitch);
          }
          break;
        }
        case 'death':
          if (seen(ev.x, ev.y, def(ev.kind).air)) {
            const d = def(ev.kind);
            const t = d.building ? 'puff' : d.cls === 0 || d.hero || (ev.kind >= K.Gatherer && ev.kind <= K.Egg) ? 'fall' : 'wreck';
            this.fx.push({ t, x1: ev.x, y1: ev.y, x2: ev.fx, y2: ev.fy, kind: ev.kind, owner: ev.owner, born: now, life: d.building ? 1700 : t === 'wreck' ? 2600 : 1400 });
            if (d.building) this.hear('boom', ev.x, ev.y, d.size >= 4 ? 0.8 : 1);
            else if (t === 'wreck' || ev.kind === K.Bronto || ev.kind === K.Rex) this.hear('crash', ev.x, ev.y, ev.kind === K.Bronto || ev.kind === K.Rex || ev.kind === K.Jugger ? 0.7 : 1);
          }
          if (ev.owner === this.me && ev.kind === K.Collector && !pl.out) {
            const left = collectorsOf(g, this.me);
            this.alert(`collector${left}`, left > 0 ? `A Collector is down: ${income(left, pl.haul)} Blocks a second now` : 'Both Collectors are down: no Blocks coming in, no upgrades', 'warn', ev.x, ev.y, 0);
          } else if (ev.owner === this.me && def(ev.kind).building && !pl.out) this.alert('lost', `${def(ev.kind).name} destroyed`, 'warn', ev.x, ev.y, 30);
          break;
        case 'hurt':
          if (ev.owner === this.me) {
            // A Collector says so by name: it stands behind the base, where the player is not looking.
            if (ev.kind === K.Collector) this.alert('collectors', 'Collector under attack', 'warn', ev.x, ev.y, 120);
            else this.alert(isWorker(ev.kind) ? 'workers' : 'base', isWorker(ev.kind) ? `${def(ev.kind).plural} under attack` : 'Base under attack', 'warn', ev.x, ev.y, 120);
          }
          break;
        case 'done':
          if (ev.owner === this.me) {
            const text = ev.kind === K.Muster ? `Muster level ${pl.muster}: the base works faster`
              : ev.kind === K.Haul ? `Haul level ${pl.haul}: ${income(collectorsOf(g, this.me), pl.haul)} Blocks a second`
                : this.frenzy && ev.kind >= K.Weapons ? `${def(ev.kind).name} level ${pl[upgradeKey(ev.kind)]} bought`
                  : isResearch(ev.kind) ? `${def(ev.kind).name} level ${pl[researchOf(ev.kind)]} researched`
                    : this.frenzy ? `${def(ev.kind).plural} unlocked, and in the mix` : `${def(ev.kind).name} ready`;
            this.alert(`done${ev.kind}`, text, 'info', ev.x, ev.y, 10);
            sfx.play(def(ev.kind).building || isResearch(ev.kind) || (this.frenzy && ev.kind >= K.Weapons) ? 'ding' : 'ready', 0.8);
          }
          break;
        case 'refused':
          if (ev.p === this.me) this.alert(`no:${ev.why}`, ev.why, 'warn', undefined, undefined, 15);
          break;
        case 'cast': {
          if (ev.owner === this.me || seen(ev.x1, ev.y1) || seen(ev.x2, ev.y2)) {
            this.fx.push({ t: 'cast', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, kind: ev.hero, owner: ev.owner, born: now, life: Math.max(260, ev.delay * 100 + 60), mode: ev.slot, r: ev.r });
            this.hear('whoosh', ev.x1, ev.y1, 1, ev.owner === this.me ? 1 : 0.7);
          }
          break;
        }
        case 'blast':
          if (ev.owner === this.me || seen(ev.x, ev.y)) {
            this.fx.push({ t: 'blast', x1: ev.x, y1: ev.y, x2: 0, y2: 0, kind: ev.hero, owner: ev.owner, born: now, life: ev.slot === 2 ? 900 : 560, mode: ev.slot, r: ev.r });
            this.hear('blast', ev.x, ev.y, ev.slot === 2 ? 0.8 : 1.1);
          }
          break;
        case 'level':
          if (ev.owner === this.me || seen(ev.x, ev.y)) this.fx.push({ t: 'level', x1: ev.x, y1: ev.y, x2: 0, y2: 0, kind: 0, owner: ev.owner, born: now, life: 1300, mode: ev.level });
          if (ev.owner === this.me) {
            sfx.play('level', 0.8);
            const opened = ABILITIES[FACTIONS[pl.faction].hero]!.find((a) => a.level === ev.level);
            this.alert(`lvl${ev.level}`, opened ? `Level ${ev.level}: ${opened.name} is ready` : `Your ${this.heroName()} is level ${ev.level}`, 'info', ev.x, ev.y, 0);
          }
          break;
        case 'hero':
          if (ev.owner !== this.me) break;
          if (ev.up) this.alert('heroup', `Your ${this.heroName()} is back`, 'info', ev.x, ev.y, 0);
          else if (!pl.out) this.alert('herodown', `Your ${this.heroName()} is down: back in ${Math.ceil((ev.back - g.tick) / TICKS_PER_SEC)} s`, 'warn', ev.x, ev.y, 0);
          break;
        case 'bounty':
          if (ev.owner === this.me) {
            this.fx.push({ t: 'coin', x1: ev.x, y1: ev.y, x2: 0, y2: 0, kind: 0, owner: ev.owner, born: now, life: 900, mode: ev.amount });
            this.hear('coin', ev.x, ev.y, 1, 0.6);
          }
          break;
        case 'out':
          if (ev.owner !== this.me) this.alert(`out${ev.owner}`, `${SIDES[ev.owner]} is out${ev.by === this.me ? ': your doing' : ''}`, 'info', undefined, undefined, 0);
          break;
        case 'overtime':
          this.alert('overtime', 'Overtime: hold the middle or your base crumbles', 'warn', (g.map.w * TILE) / 2, (g.map.h * TILE) / 2, 0);
          break;
      }
    }
  }

  /** What your hero is called. */
  heroName(): string {
    return def(FACTIONS[this.g.players[this.me]!.faction].hero).name;
  }

  /** Whether a warning of this kind has been given this match. */
  alerted(key: string): boolean {
    return this.lastAlert.has(key);
  }

  /** The hint on screen has been read. */
  hintDone(): void {
    const h = this.hint.value;
    if (h) seenHint(h.id);
    this.hint.value = null;
  }

  alert(key: string, text: string, kind: 'warn' | 'info', x?: number, y?: number, gapTicks = 60): void {
    const lastAt = this.lastAlert.get(key) ?? -9999;
    if (this.g.tick - lastAt < gapTicks) return;
    this.lastAlert.set(key, this.g.tick);
    // A warning that something of yours is under fire sounds a horn; a refused order only says so.
    if (kind === 'warn' && !key.startsWith('no:')) sfx.play('horn', 0.9);
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
        max += maxHp(u);
        if (!u.arrived) moving = true;
      }
      if (hp < this.groupHp[i]! - 0) this.hurtUntil[i] = g.tick + 15;
      this.groupHp[i] = hp;
      groups.push({
        count: us.length, hp: max ? hp / max : 0, hurt: g.tick < this.hurtUntil[i]! && us.length > 0, moving,
        kinds: [...kinds.entries()].sort((a, b) => a[0] - b[0]).map(([kind, n]) => ({ kind, n })),
      });
    }
    if (this.frenzy) {
      this.hud.value = {
        tick: g.tick, blocks: pl.blocks, gas: 0, supply: pl.supply, cap: pl.cap, groups, rally: pl.rally,
        train: [], build: [], research: [], workers: 0, work: 0, idleBarracks: 0, eggs: 0, eggMax: 0, frenzy: this.frenzyHud(),
      };
      return;
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
    this.hud.value = { tick: g.tick, blocks: pl.blocks, gas: pl.gas, supply: pl.supply, cap: pl.cap, groups, rally: pl.rally, train, build, research, workers, work, idleBarracks, eggs, eggMax, frenzy: null };
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

  /** What Frenzy's panels show: the hero and its abilities, the mix, the upgrades, the middle. */
  private frenzyHud(): FrenzyHud {
    const g = this.g, pl = g.players[this.me]!;
    const f = FACTIONS[pl.faction];
    const h = heroOf(g, pl), hall = hallOf(g, this.me);
    const level = Math.max(1, pl.heroLvl);
    const abilities: AbilityInfo[] = ABILITIES[f.hero]!.map((a, slot) => {
      const left = Math.max(0, pl.cds[slot]! - g.tick);
      return {
        name: a.name, short: a.short, blurb: a.blurb, level: a.level, locked: level < a.level,
        ready: h !== undefined && level >= a.level && left === 0 && h.daze <= g.tick, wait: Math.min(1, left / abilityCd(a, pl.tempo)), aims: a.range > 0,
      };
    });
    const next = pl.repeat[pl.turn % Math.max(1, pl.repeat.length)];
    const rate = FRENZY.musterRate[pl.muster]!;
    const spawn: SpawnInfo[] = frenzyUnits(pl.faction).map((kind) => {
      const unlocked = pl.unlocked.includes(kind), on = pl.repeat.includes(kind);
      const price = UNLOCK[kind] ?? 0;
      let why = '';
      if (!unlocked && pl.blocks < price) why = 'Not enough Blocks';
      else if (unlocked && on && pl.repeat.length === 1) why = 'The base must make something';
      return { kind, unlocked, on, price, ok: why === '', why, progress: kind === next ? Math.min(1, pl.bank / WORK[kind]!) : -1, seconds: WORK[kind]! / rate / TICKS_PER_SEC };
    });
    const standing = collectorsOf(g, this.me);
    const upgrades: UpgradeInfo[] = frenzyUpgrades(pl.faction).map((kind) => {
      const costs = upgradeCosts(kind), lvl = pl[upgradeKey(kind)];
      const cost = costs[Math.min(lvl, costs.length - 1)]!;
      const why = lvl >= costs.length ? `${def(kind).name} is at its top level`
        : standing === 0 ? 'Upgrades are bought at a Collector, and yours are down' : pl.blocks < cost ? 'Not enough Blocks' : '';
      return { kind, level: lvl, max: costs.length, cost, ok: why === '', why, blurb: upgradeBlurb(kind) };
    });
    let middle = -2;
    for (const e of g.ents) if (e.kind === K.Tower && onLayer(g, pl.vis, e.x, e.y)) middle = e.busy - 1;
    return {
      hero: {
        kind: f.hero, alive: h !== undefined, level,
        hp: h ? h.hp / maxHp(h) : 0, xp: level >= FRENZY.levelMax ? 1 : pl.heroXp / levelNeeds(level),
        back: pl.heroBack > 0 ? Math.ceil((pl.heroBack - g.tick) / TICKS_PER_SEC) : 0,
      },
      abilities, spawn,
      upgrades, collectors: standing, income: income(standing, pl.haul) + (middle === this.me ? FRENZY.middle : 0),
      middle, overtime: g.tick >= FRENZY.overtime, hall: hall ? hall.hp / maxHp(hall) : 0,
      sides: g.players.map((q) => ({ id: q.id, faction: q.faction, out: q.out })),
    };
  }

  /** Test hook: drops a unit onto the map, so speed tests can stage a large battle. */
  debugSpawn(kind: Kind, owner: number, tx: number, ty: number): void {
    const u = spawn(this.g, kind, owner, Math.round(tx * TILE), Math.round(ty * TILE));
    if (!def(kind).building) u.group = owner === this.me && !this.frenzy ? 3 : 0;
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

  // ---------------------------------------------------------------- Frenzy: the base and the hero

  /** A tap on a unit of the Spawn tab: unlock it, or put it in the mix, or take it out. */
  spawnTap(kind: Kind): void {
    const info = this.hud.value.frenzy?.spawn.find((x) => x.kind === kind);
    if (!info) return;
    if (!info.ok) return this.alert(`why${kind}`, info.why, 'warn', undefined, undefined, 5);
    if (!info.unlocked) this.issue({ t: 'unlock', p: this.me, kind });
    else this.issue({ t: 'repeat', p: this.me, kind, on: !info.on });
  }

  setFollow(on: boolean): void {
    this.follow.value = on;
    try {
      localStorage.setItem('foothold.heroFollow', on ? 'on' : 'off');
    } catch {
      // Private browsing: the choice still holds for this match.
    }
  }

  /** Your hero, if it is standing. */
  hero(): Entity | undefined {
    return this.frenzy ? heroOf(this.g, this.g.players[this.me]!) : undefined;
  }

  ability(slot: number): Ability | undefined {
    return ABILITIES[FACTIONS[this.g.players[this.me]!.faction].hero]?.[slot];
  }

  /** A tap on an ability button. One that needs no target goes off; one that does waits for a tap on the map. */
  cast(slot: number): void {
    const info = this.hud.value.frenzy?.abilities[slot], a = this.ability(slot), h = this.hero();
    if (!info || !a) return;
    if (this.aim.value === slot) {
      this.aim.value = -1;
      return;
    }
    const why = !h ? `Your ${this.heroName()} is down` : info.locked ? `${a.name} opens at level ${a.level}` : !info.ready ? (h.daze > this.g.tick ? 'Stunned' : `${a.name} is not ready yet`) : '';
    if (why || !h) return this.alert(`why:${slot}`, why, 'warn', undefined, undefined, 5);
    if (a.range > 0) {
      this.placing.value = null;
      this.aim.value = slot;
    } else {
      this.aim.value = -1;
      this.issue({ t: 'cast', p: this.me, slot, x: h.x, y: h.y });
    }
  }

  /** Points the waiting ability at a place on the map. A tap beyond its reach lands at the end of its reach, on the way there. */
  castAt(x: number, y: number): void {
    const slot = this.aim.value, a = this.ability(slot), h = this.hero();
    if (!a || !h) {
      this.aim.value = -1;
      return;
    }
    let tx = Math.round(x), ty = Math.round(y);
    const far = Math.hypot(tx - h.x, ty - h.y);
    if (far > a.range) {
      // A little inside the ring, so that rounding can never put it a hair outside.
      const k = (a.range - 3) / far;
      tx = Math.round(h.x + (tx - h.x) * k);
      ty = Math.round(h.y + (ty - h.y) * k);
    }
    const g = this.g;
    tx = Math.max(0, Math.min(g.map.w * TILE - 1, tx));
    ty = Math.max(0, Math.min(g.map.h * TILE - 1, ty));
    if (a.kind === 'leap' && g.nav.blockedAt(tx, ty)) return this.alert('land', "Can't land there", 'warn', undefined, undefined, 5);
    this.aim.value = -1;
    this.issue({ t: 'cast', p: this.me, slot, x: tx, y: ty });
  }

  selectGroup(i: number): void {
    this.site.value = 0;
    this.aim.value = -1;
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

  /** Sets how taps on the map are answered from now on, whatever is selected. */
  setMode(mode: OrderMode): void {
    if (mode === O.Attack || mode === O.Move) this.mode.value = mode;
  }

  /**
   * The groups an order to the selected one goes to. In Frenzy, with Follow on, an order to the hero is also
   * an order to the group new units join: one tap moves everything.
   */
  private ordered(): number[] {
    const i = this.sel.value;
    if (i < 0) return [];
    if (!this.frenzy || i !== HERO || !this.follow.value) return [i];
    // While the hero is down the army still answers; and even with nobody in it yet, whatever the base
    // turns out next heads for where the group was last sent.
    const army = this.g.players[this.me]!.rally;
    return this.hero() ? [i, army] : [army];
  }

  hold(): void {
    for (const i of this.ordered()) this.issue({ t: 'order', p: this.me, group: i, mode: O.Hold, x: 0, y: 0 });
  }

  orderTo(x: number, y: number): boolean {
    const i = this.sel.value;
    if (i < 0) return false;
    const groups = this.ordered();
    const waits = this.frenzy && groups.includes(this.g.players[this.me]!.rally);
    if (!waits && groupUnits(this.g, this.me, i).length === 0) return false;
    const mode = this.mode.value === O.Move ? O.Move : O.Attack;
    for (const k of groups) this.issue({ t: 'order', p: this.me, group: k, mode, x: Math.round(x), y: Math.round(y) });
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
    if (this.aim.value >= 0) {
      this.castAt(x, y);
      return;
    }
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
    // Frenzy: a tap on one of your Collectors opens what it sells.
    if (this.frenzy) {
      for (const e of g.ents) {
        if (e.owner !== this.me || e.kind !== K.Collector) continue;
        const half = (def(e.kind).size * TILE) / 2;
        if (Math.abs(x - e.x) <= half && Math.abs(y - e.y) <= half) {
          this.techAsk.value++;
          return;
        }
      }
    }
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
    // A tap on one of your own picks its group up, unless that group already answers to this tap (the one
    // selected, or the army that follows the hero): then it is an order like any other.
    if (hit && hit.group !== this.sel.value && !this.ordered().includes(hit.group)) {
      this.sel.value = hit.group;
      return;
    }
    if (this.sel.value >= 0 && !this.orderTo(x, y)) {
      // A fallen hero stays picked up: it will want its orders the moment it is back.
      const pl = g.players[this.me]!;
      if (this.frenzy && this.sel.value === HERO && pl.heroBack > 0) {
        this.alert('herodown2', `Your ${this.heroName()} is down: back in ${Math.ceil((pl.heroBack - g.tick) / TICKS_PER_SEC)} s`, 'warn', undefined, undefined, 5);
      } else this.sel.value = -1;
    }
  }

  /** A tap on the minimap: an order when a group is selected, else a camera jump. */
  tapMini(x: number, y: number): void {
    if (this.placing.value || this.aim.value >= 0 || this.sel.value < 0 || !this.orderTo(x, y)) this.lookAt(x, y);
  }

  /**
   * Where the map sits inside the minimap's box, as shares of the box's width: the whole of it for a map
   * twice as wide as it is tall, and the middle of it for a square one.
   */
  miniRect(): { x: number; w: number } {
    const w = Math.min(1, this.g.map.w / this.g.map.h / 2);
    return { x: (1 - w) / 2, w };
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
