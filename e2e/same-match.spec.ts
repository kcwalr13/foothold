import { expect, test } from '@playwright/test';
import { replay, selfPlay } from '../src/app/selfplay';
import type { Faction } from '../src/sim/types';

type Lab = { selfPlay: typeof selfPlay; replay: typeof replay };
type Sides = readonly [Faction, Faction];

// The rules engine promises that the same seed and the same orders give the same match on every device.
// Node plays a match here; the browser then replays it from the seed and the list of orders alone, and
// plays its own from scratch. All three must end on the same checksum. Once with two Green Armies, once
// with the Dino Pack against the Green Army, so both factions' rules are covered.
for (const [name, sides] of [['two Green Armies', ['green', 'green']], ['the Dino Pack against the Green Army', ['dino', 'green']]] as [string, Sides][]) {
  test(`this browser plays the identical match to Node, order for order: ${name}`, async ({ page: p }) => {
    test.setTimeout(120_000);
    const ticks = 9000;
    // A full match: nine minutes or more, both tech paths on the field, several hundred orders. Which seed
    // gives one shifts every time the opponent is retuned, so take the first of a few that does.
    let seed = 3;
    let node = selfPlay(seed, ticks, sides);
    while ((node.ticks < 5400 || node.log.length < 400) && seed < 12) node = selfPlay(++seed, ticks, sides);
    expect(node.ticks).toBeGreaterThanOrEqual(5400);
    expect(node.log.length).toBeGreaterThanOrEqual(400);
    expect(replay(seed, node.log, node.ticks, sides)).toBe(node.hash);
    await p.goto('./?nosw');
    await p.waitForFunction(() => !!(window as unknown as { __fhLab?: Lab }).__fhLab);
    const replayed = await p.evaluate(({ seed, log, ticks, sides }) => (window as unknown as { __fhLab: Lab }).__fhLab.replay(seed, log, ticks, sides), { seed, log: node.log, ticks: node.ticks, sides });
    expect(replayed).toBe(node.hash);
    const own = await p.evaluate(({ seed, ticks, sides }) => {
      const r = (window as unknown as { __fhLab: Lab }).__fhLab.selfPlay(seed, ticks, sides);
      return { hash: r.hash, ticks: r.ticks, winner: r.winner, orders: r.log.length };
    }, { seed, ticks, sides });
    expect(own).toEqual({ hash: node.hash, ticks: node.ticks, winner: node.winner, orders: node.log.length });
  });
}
