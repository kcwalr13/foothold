// What happened in a match, for the report at the end: each side's build order, what it made, and how its army
// and economy grew. It only reads the match as it goes (new entities, finished research and upgrades), so it
// is filled in the same way whether the match was played through or picked up again from a save.
import { def, isResearch, isWorker } from '../sim/data';
import type { Game } from '../sim/state';
import { K, type Kind } from '../sim/types';

export interface Entry {
  tick: number;
  kind: Kind;
  /** A building placed, the first of a kind of unit, research finished, or (Frenzy) something unlocked or bought. */
  what: 'build' | 'first' | 'research' | 'upgrade' | 'unlock';
  /** For research and upgrades, the level reached. */
  level?: number;
}

export interface Sample {
  tick: number;
  /** What the army standing would cost to make again, in Blocks and Batteries together. */
  army: number;
  workers: number;
}

export interface Side {
  entries: Entry[];
  made: Map<Kind, number>;
  samples: Sample[];
}

/** How often the army and the economy are measured: every 15 seconds. */
const EVERY = 150;

export class Chronicle {
  readonly sides: Side[];
  private lastId: number;

  constructor(g: Game) {
    this.sides = g.players.map(() => ({ entries: [], made: new Map(), samples: [] }));
    // What each side starts with is not part of its build order.
    this.lastId = g.nextId - 1;
    this.measure(g);
  }

  /** Called once a tick, after the rules have run. */
  note(g: Game): void {
    for (let i = g.ents.length - 1; i >= 0; i--) {
      const e = g.ents[i]!;
      if (e.id <= this.lastId) break;
      if (e.owner < 0) continue;
      const side = this.sides[e.owner];
      if (!side) continue;
      const d = def(e.kind);
      if (e.kind === K.Egg) continue;
      if (d.building) {
        // A Frenzy side starts with all its buildings; a Classic side places its own.
        if (g.mode === 'classic') side.entries.push({ tick: g.tick, kind: e.kind, what: 'build' });
        continue;
      }
      if (d.hero) continue;
      const n = (side.made.get(e.kind) ?? 0) + 1;
      side.made.set(e.kind, n);
      if (n === 1 && !isWorker(e.kind)) side.entries.push({ tick: g.tick, kind: e.kind, what: 'first' });
    }
    this.lastId = Math.max(this.lastId, g.nextId - 1);
    for (const ev of g.events) {
      if (ev.t !== 'done') continue;
      const side = this.sides[ev.owner];
      if (!side || def(ev.kind).building) continue;
      if (g.mode === 'classic') {
        if (isResearch(ev.kind)) side.entries.push({ tick: g.tick, kind: ev.kind, what: 'research', level: levelOf(side, ev.kind) });
      } else if (ev.kind >= K.Weapons) side.entries.push({ tick: g.tick, kind: ev.kind, what: 'upgrade', level: levelOf(side, ev.kind) });
      else side.entries.push({ tick: g.tick, kind: ev.kind, what: 'unlock' });
    }
    if (g.tick % EVERY === 0) this.measure(g);
  }

  private measure(g: Game): void {
    const army = g.players.map(() => 0), workers = g.players.map(() => 0);
    for (const e of g.ents) {
      if (e.owner < 0 || e.hp <= 0) continue;
      const d = def(e.kind);
      if (d.building || e.kind === K.Egg || d.hero) continue;
      if (isWorker(e.kind)) workers[e.owner]!++;
      else army[e.owner]! += d.cost + d.gas;
    }
    this.sides.forEach((s, i) => s.samples.push({ tick: g.tick, army: army[i]!, workers: workers[i]! }));
  }

  /** The last measure, taken at the end so the charts run to the final whistle. */
  finish(g: Game): void {
    const last = this.sides[0]?.samples.at(-1);
    if (last && last.tick !== g.tick) this.measure(g);
  }
}

/** The level a research or upgrade has reached: one more than the times it has come up before. */
function levelOf(side: Side, kind: Kind): number {
  return side.entries.filter((e) => e.kind === kind && (e.what === 'research' || e.what === 'upgrade')).length + 1;
}

