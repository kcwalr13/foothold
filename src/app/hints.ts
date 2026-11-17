// First-match hints: one short line at a time, the first time the moment for it comes. Each is shown once and
// remembered; "No more hints" stops them, and How to play turns them back on.
import { FACTIONS, def, isHall, isWorker } from '../sim/data';
import { hasBuilt } from '../sim/state';
import { K } from '../sim/types';
import type { Match } from './match';

interface Hint {
  id: string;
  mode: 'classic' | 'frenzy';
  /** When it is worth saying. */
  when: (m: Match) => boolean;
  text: (m: Match) => string;
}

const KEY = 'foothold.hints';

const mine = (m: Match) => m.g.players[m.me]!;
const faction = (m: Match) => FACTIONS[mine(m).faction];
const dino = (m: Match) => mine(m).faction === 'dino';
const halls = (m: Match) => m.g.ents.filter((e) => e.owner === m.me && isHall(e.kind)).length;
const soldiers = (m: Match) => m.g.ents.some((e) => e.owner === m.me && e.hp > 0 && !def(e.kind).building && !isWorker(e.kind) && e.kind !== K.Egg && !def(e.kind).hero);

const HINTS: Hint[] = [
  {
    id: 'workers', mode: 'classic', when: (m) => m.g.tick >= 30,
    text: (m) => dino(m)
      ? 'Your Gatherers bring in Blocks by themselves. Everything hatches from eggs at the Nest: hatch a few more Gatherers from the Hatch tab.'
      : 'Your Workers bring in Blocks by themselves. Train a few more from the Train tab: a base has work for about a dozen.',
  },
  {
    id: 'army', mode: 'classic', when: (m) => mine(m).blocks >= 160 && !hasBuilt(m.g, m.me, faction(m).first),
    text: (m) => dino(m)
      ? 'Time for an army. Build tab: pick the Den, drag its outline onto the nesting ground by your Nest, then Build. A Gatherer walks over and becomes it.'
      : 'Time for an army. Build tab: pick the Barracks, drag its outline onto the map, then Build.',
  },
  {
    id: 'groups', mode: 'classic', when: soldiers,
    text: () => 'New soldiers join Group 1, on the right. Tap the group, then tap the map or the minimap to send it there.',
  },
  {
    id: 'attacked', mode: 'classic', when: (m) => m.alerted('base') || m.alerted('workers'),
    text: () => "You're under attack. Tap your group, then tap your base to bring it home. Double-tap a group to jump to it.",
  },
  {
    id: 'expand', mode: 'classic', when: (m) => m.g.tick >= 3000 && halls(m) === 1,
    text: (m) => `A second base brings in more Blocks and raises your supply. Build a ${def(faction(m).hall).name} on another base site.`,
  },
  {
    id: 'pace', mode: 'classic', when: (m) => m.g.tick >= 1200,
    text: () => 'Too quick, or too slow? Pause, top right, also sets the speed.',
  },
  {
    id: 'fz-base', mode: 'frenzy', when: (m) => m.g.tick >= 30,
    text: () => 'Your base makes soldiers by itself, slowly at first. The Spawn tab unlocks more kinds and sets the mix.',
  },
  {
    id: 'fz-hero', mode: 'frenzy', when: (m) => m.g.tick >= 200,
    text: (m) => `Tap your ${m.heroName()}, then the map, to send it. Its abilities open at levels 1, 3 and 6: tap one, then the map if a ring shows.`,
  },
  {
    id: 'fz-tech', mode: 'frenzy', when: (m) => m.g.tick >= 600 && mine(m).blocks >= 250,
    text: () => 'Your two Collectors bring in the Blocks and sell the upgrades. Tap one, or the Tech tab, to buy.',
  },
  {
    id: 'fz-middle', mode: 'frenzy', when: (m) => m.g.tick >= 1800,
    text: () => 'Hold the Watchtower in the middle alone for more Blocks. From 10:00 it also keeps your base from crumbling.',
  },
];

interface Kept { seen: string[]; off: boolean }

function kept(): Kept {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Kept>;
    return { seen: Array.isArray(v.seen) ? v.seen : [], off: v.off === true };
  } catch {
    return { seen: [], off: false };
  }
}

function keep(k: Kept): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch { /* remembered for this visit only */ }
}

export function hintsOn(): boolean {
  return !kept().off;
}

/** Turns hints on (from the start again) or off. */
export function setHints(on: boolean): void {
  keep(on ? { seen: [], off: false } : { ...kept(), off: true });
}

/** The hint to show now, if any: the first whose moment has come and that hasn't been seen. */
export function nextHint(m: Match): { id: string; text: string } | null {
  const k = kept();
  if (k.off) return null;
  for (const h of HINTS) {
    if (h.mode !== (m.frenzy ? 'frenzy' : 'classic') || k.seen.includes(h.id)) continue;
    if (h.when(m)) return { id: h.id, text: h.text(m) };
  }
  return null;
}

export function seenHint(id: string): void {
  const k = kept();
  if (!k.seen.includes(id)) keep({ ...k, seen: [...k.seen, id] });
}
