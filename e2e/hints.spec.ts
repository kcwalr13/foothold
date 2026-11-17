import { expect, test } from '@playwright/test';

import { type Any, noSmallButtons, run, start } from './helpers';

test('a first match from the menu gives hints one at a time, each once, and they can be stopped and started again', async ({ page: p }, info) => {
  await p.goto('./?nosw');
  await p.getByRole('button', { name: 'Normal', exact: true }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  await p.evaluate(() => { (window as Any).__fh.paused.value = true; });
  await run(p, 40);
  const hint = p.getByRole('note', { name: 'Hint' });
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Workers');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('hint.png') });
  await hint.getByRole('button', { name: 'Got it' }).tap();
  await expect(hint).toHaveCount(0);
  // The next one comes when its moment does, and the first never comes back.
  await run(p, 1300);
  await expect(hint).toBeVisible();
  await expect(hint).not.toContainText('Train tab');
  expect(await p.evaluate(() => JSON.parse(localStorage.getItem('foothold.hints')!).seen)).toContain('workers');
  await hint.getByRole('button', { name: 'No more hints' }).tap();
  await run(p, 3000);
  await expect(hint).toHaveCount(0);

  // How to play turns them back on, from the start.
  await p.goto('./?nosw');
  await p.getByRole('button', { name: 'How to play' }).tap();
  await p.getByRole('button', { name: /^Hints off/ }).tap();
  await expect(p.getByRole('button', { name: /^Hints on/ })).toBeVisible();
  expect(await p.evaluate(() => JSON.parse(localStorage.getItem('foothold.hints')!))).toEqual({ seen: [], off: false });
});

test('the menu says how to install for offline play on an iPhone, and fits', async ({ page: p }, info) => {
  await p.goto('./?nosw');
  if (info.project.name === 'iphone') await expect(p.getByText('Add to Home Screen')).toBeVisible();
  await noSmallButtons(p);
  const card = await p.locator('.menu .card').boundingBox();
  const vh = p.viewportSize()!.height;
  // Everything on the menu can be reached: the card fits, or scrolls.
  const scrolls = await p.evaluate(() => { const c = document.querySelector('.menu') as HTMLElement; return c.scrollHeight > c.clientHeight + 1 ? getComputedStyle(c).overflowY : 'fits'; });
  expect(card!.height <= vh || scrolls === 'auto' || scrolls === 'scroll').toBe(true);
  await p.screenshot({ path: info.outputPath('menu.png') });
});

test('a match started from a link gives no hints', async ({ page: p }) => {
  await start(p, 'play=1&seed=3');
  await run(p, 900);
  await p.waitForTimeout(300);
  await expect(p.getByRole('note', { name: 'Hint' })).toHaveCount(0);
});
