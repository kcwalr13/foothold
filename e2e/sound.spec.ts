import { expect, test } from '@playwright/test';
import { K, TILE } from '../src/sim/types';

import { type Any, noSmallButtons, run, start } from './helpers';

test('a fight on screen is heard, and the sound switch turns it off and is remembered', async ({ page: p }) => {
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await start(p, 'play=1&seed=7');
  // Sound starts with a tap, as a browser requires.
  await p.getByRole('button', { name: 'Train', exact: true }).tap();
  await p.evaluate(([trooper, tile]: [number, number]) => {
    const m = (window as Any).__fh;
    const x = m.cam.x, y = m.cam.y;
    for (let i = 0; i < 6; i++) m.debugSpawn(trooper, 0, x / tile - 2, y / tile + i * 0.6 - 1.5);
    for (let i = 0; i < 6; i++) m.debugSpawn(trooper, 1, x / tile + 2, y / tile + i * 0.6 - 1.5);
  }, [K.Trooper, TILE] as [number, number]);
  // A burst of rifles on one tick is one crackle, so the fight is played out over a second of real time.
  for (let i = 0; i < 10; i++) {
    await run(p, 8);
    await p.waitForTimeout(90);
  }
  expect(await p.evaluate(() => (window as Any).__fhSound.played)).toBeGreaterThan(5);

  await p.getByRole('button', { name: 'Pause' }).tap();
  await noSmallButtons(p);
  await p.getByRole('button', { name: /^Sound on/ }).tap();
  await expect(p.getByRole('button', { name: /^Sound off/ })).toBeVisible();
  expect(await p.evaluate(() => localStorage.getItem('foothold.sound'))).toBe('off');
  const before = await p.evaluate(() => (window as Any).__fhSound.played);
  await p.evaluate(() => { (window as Any).__fh.paused.value = true; });
  for (let i = 0; i < 5; i++) {
    await run(p, 8);
    await p.waitForTimeout(90);
  }
  expect(await p.evaluate(() => (window as Any).__fhSound.played)).toBe(before);

  // The menu's How to play has the same switch, and it remembers.
  await p.goto('./?nosw');
  await p.getByRole('button', { name: 'How to play' }).tap();
  await expect(p.getByRole('button', { name: /^Sound off/ })).toBeVisible();
  await noSmallButtons(p);
  expect(errors).toEqual([]);
});
