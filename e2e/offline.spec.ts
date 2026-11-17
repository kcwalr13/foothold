import { expect, test } from '@playwright/test';

test('installs for offline play: a reload with no connection still starts a match', async ({ page: p, context }) => {
  await p.goto('./');
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(async () => (await caches.keys()).length > 0);
  await p.waitForTimeout(500);
  await context.setOffline(true);
  await p.reload();
  await expect(p.getByRole('heading', { name: 'FOOTHOLD' })).toBeVisible();
  await p.getByRole('button', { name: 'Easy', exact: true }).tap();
  await p.waitForFunction(() => !!(window as unknown as { __fh?: unknown }).__fh);
  await expect(p.locator('.left')).toBeVisible();
});
