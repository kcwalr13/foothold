import { expect, test } from '@playwright/test';
import { replay, selfPlay } from '../src/app/selfplay';

type Lab = { selfPlay: typeof selfPlay; replay: typeof replay };

// The rules engine promises that the same seed and the same orders give the same match on every device.
// Node plays a match here; the browser then replays it from the seed and the list of orders alone, and
// plays its own from scratch. All three must end on the same checksum.
test('this browser plays the identical match to Node, order for order', async ({ page: p }) => {
  test.setTimeout(120_000);
  const ticks = 9000;
  // A full match: nine minutes or more, both tech paths on the field, several hundred orders. Which seed
  // gives one shifts every time the opponent is retuned, so take the first of a few that does.
  let seed = 3;
  let node = selfPlay(seed, ticks);
  while ((node.ticks < 5400 || node.log.length < 400) && seed < 12) node = selfPlay(++seed, ticks);
  expect(node.ticks).toBeGreaterThanOrEqual(5400);
  expect(node.log.length).toBeGreaterThanOrEqual(400);
  expect(replay(seed, node.log, node.ticks)).toBe(node.hash);
  await p.goto('./?nosw');
  await p.waitForFunction(() => !!(window as unknown as { __fhLab?: Lab }).__fhLab);
  const replayed = await p.evaluate(({ seed, log, ticks }) => (window as unknown as { __fhLab: Lab }).__fhLab.replay(seed, log, ticks), { seed, log: node.log, ticks: node.ticks });
  expect(replayed).toBe(node.hash);
  const own = await p.evaluate(({ seed, ticks }) => {
    const r = (window as unknown as { __fhLab: Lab }).__fhLab.selfPlay(seed, ticks);
    return { hash: r.hash, ticks: r.ticks, winner: r.winner, orders: r.log.length };
  }, { seed, ticks });
  expect(own).toEqual({ hash: node.hash, ticks: node.ticks, winner: node.winner, orders: node.log.length });
});
