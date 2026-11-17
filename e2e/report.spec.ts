import { expect, test } from '@playwright/test';

import { type Any, noSmallButtons, run, start } from './helpers';

for (const [name, query, columns] of [['Classic', 'play=1&seed=7&me=green&foe=dino', 2], ['Frenzy', 'play=1&seed=5&mode=frenzy', 4]] as const) {
  test(`after a ${name} match, the report shows every side's build order and how its army grew`, async ({ page: p }, info) => {
    test.setTimeout(120000);
    await start(p, query);
    // An idle player loses in a few minutes: the opponents' build orders are what there is to see.
    await p.evaluate(() => { const m = (window as Any).__fh; for (let i = 0; i < 12000 && m.over.value < 0; i++) m.tick(); });
    await p.evaluate(() => { (window as Any).__fh.paused.value = false; });
    await p.getByRole('button', { name: 'Report', exact: true }).tap();
    const report = p.getByRole('dialog', { name: 'Match report' });
    await expect(report).toBeVisible();
    await expect(report.locator('.orders section')).toHaveCount(columns);
    // The opponents built and made things, with times, and the charts run to the end of the match.
    const opp = report.locator('.orders section[data-side="1"] li');
    expect(await opp.count()).toBeGreaterThan(3);
    await expect(opp.first()).toContainText(/\d+:\d\d/);
    await expect(report.locator('.chart polyline')).toHaveCount(name === 'Classic' ? 4 : 4);
    await expect(report.locator('.orders section[data-side="1"] .made')).not.toHaveText('No units made');
    await noSmallButtons(p);
    await p.screenshot({ path: info.outputPath('report.png') });
    await report.getByRole('button', { name: 'Back' }).tap();
    await expect(report).toHaveCount(0);
    await expect(p.getByRole('button', { name: 'Play again' })).toBeVisible();
  });
}
