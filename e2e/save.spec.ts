import { expect, test, type Page } from '@playwright/test';
import { K } from '../src/sim/types';

import { type Any, run, start, state } from './helpers';

/** Plays on with a few orders of yours between the ticks, as a player would. */
async function playAWhile(p: Page, frenzy: boolean) {
  for (let round = 0; round < 6; round++) {
    await p.evaluate(([fz, r, worker]) => {
      const m = (window as Any).__fh;
      if (fz) m.issue({ t: 'order', p: 0, group: 0, mode: 1, x: m.g.map.w * 128 + r * 256, y: m.g.map.h * 128 });
      else m.issue({ t: 'train', p: 0, kind: worker });
    }, [frenzy, round, K.Worker] as [boolean, number, number]);
    await run(p, 150 + round * 37);
  }
}

for (const [name, query] of [['Classic', 'play=1&seed=11&me=green&foe=dino'], ['Frenzy', 'play=1&seed=5&mode=frenzy']] as const) {
  test(`a ${name} match left half-way is kept, and picks up exactly where it was`, async ({ page: p }) => {
    await start(p, query);
    await playAWhile(p, name === 'Frenzy');
    // Leaving the app keeps the match.
    const before = await p.evaluate(() => {
      const m = (window as Any).__fh;
      m.paused.value = false;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      return { tick: m.g.tick, hash: (window as Any).__fhHash() };
    });
    expect(before.tick).toBeGreaterThan(1000);
    expect(await p.evaluate(() => localStorage.getItem('foothold.match') !== null)).toBe(true);

    await p.goto('./?nosw');
    const resume = p.getByRole('button', { name: /^Resume your match/ });
    await expect(resume).toBeVisible();
    await expect(resume).toContainText(name);
    await resume.tap();
    await p.waitForFunction(() => !!(window as Any).__fh, undefined, { timeout: 30000 });
    // The same match, tick for tick, waiting paused for you.
    expect(await p.evaluate(() => ({ tick: (window as Any).__fh.g.tick, hash: (window as Any).__fhHash() }))).toEqual(before);
    await expect(p.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await p.getByRole('button', { name: 'Resume', exact: true }).tap();
    await run(p, 50);
    expect(await state<number>(p, '(m) => m.g.tick')).toBeGreaterThanOrEqual(before.tick + 50);
  });
}

test('quitting a match forgets it, and a match from another version is let go with a word', async ({ page: p }) => {
  await start(p, 'play=1&seed=11');
  await run(p, 300);
  await p.evaluate(() => { (window as Any).__fh.paused.value = false; (window as Any).__fh.paused.value = true; });
  expect(await p.evaluate(() => localStorage.getItem('foothold.match') !== null)).toBe(true);
  // A match whose orders no longer lead where they did is not picked up. (Leaving the match keeps it again, so
  // it is altered from the menu.)
  await p.goto('./?nosw');
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('foothold.match')!);
    s.hash = (s.hash + 1) >>> 0;
    localStorage.setItem('foothold.match', JSON.stringify(s));
  });
  await p.reload();
  await p.getByRole('button', { name: /^Resume your match/ }).tap();
  await expect(p.getByText("this one can't pick it up")).toBeVisible({ timeout: 30000 });
  await expect(p.getByRole('button', { name: /^Resume your match/ })).toHaveCount(0);
  expect(await p.evaluate(() => localStorage.getItem('foothold.match'))).toBeNull();

  // Quit to the menu from the pause sheet, and nothing is kept.
  await start(p, 'play=1&seed=11');
  await run(p, 300);
  await p.evaluate(() => { (window as Any).__fh.paused.value = false; });
  await p.getByRole('button', { name: 'Pause' }).tap();
  expect(await p.evaluate(() => localStorage.getItem('foothold.match') !== null)).toBe(true);
  await p.getByRole('button', { name: /Quit|menu/i }).first().tap();
  await expect(p.getByRole('heading', { name: 'FOOTHOLD' })).toBeVisible();
  expect(await p.evaluate(() => localStorage.getItem('foothold.match'))).toBeNull();
  await expect(p.getByRole('button', { name: /^Resume your match/ })).toHaveCount(0);
});
