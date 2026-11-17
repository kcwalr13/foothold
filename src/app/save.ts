// A match in progress, kept on the phone so closing the app never costs you the game. A match is its seed and
// its orders, so only your own orders are kept: on resume the opponents think again exactly as they did.
import { hash } from '../sim/state';
import type { Command, Faction, Mode, OrderMode } from '../sim/types';
import type { Match } from './match';

const KEY = 'foothold.match';

export interface Saved {
  v: 1;
  /** The build that saved it, to say so if a newer one can't pick it up. */
  commit: string;
  seed: number;
  level: number;
  sides: Faction[];
  /** What the menu was set to, for the rematch button. */
  choice: { mode: Mode; me: Faction; foe: Faction | 'any' };
  tick: number;
  /** The match's checksum at `tick`: a resumed match must arrive at the same one. */
  hash: number;
  orders: { tick: number; cmd: Command }[];
  cam: { x: number; y: number; zoom: number };
  mode: OrderMode;
}

export function saveMatch(m: Match, seed: number, choice: Saved['choice'], commit: string): void {
  if (m.over.value >= 0 || m.g.tick < 10) return;
  const saved: Saved = {
    v: 1, commit, seed, level: m.level, sides: [...m.factions], choice, tick: m.g.tick, hash: hash(m.g),
    // What has run, and what you ordered that had yet to run when the app was left.
    orders: [...m.g.log, ...m.g.pending].filter((o) => o.cmd.p === m.me).map((o) => ({ tick: o.tick, cmd: o.cmd })),
    cam: { ...m.cam }, mode: m.mode.value,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private browsing or a full store: the match simply isn't kept.
  }
}

export function loadSaved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    if (!v || v.v !== 1 || !Array.isArray(v.orders) || !Array.isArray(v.sides) || typeof v.tick !== 'number') return null;
    return v;
  } catch {
    return null;
  }
}

export function clearSaved(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept, nothing to clear.
  }
}
