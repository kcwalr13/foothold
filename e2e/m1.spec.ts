import { type Page, expect, test } from '@playwright/test';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function start(p: Page, query = 'play=1&seed=7') {
  await p.goto(`./?nosw&${query}`);
  await p.waitForFunction(() => !!(window as Any).__fh);
  await p.evaluate(() => { (window as Any).__fh.paused.value = true; });
}
const run = (p: Page, n: number) => p.evaluate((k) => {
  const m = (window as Any).__fh;
  for (let i = 0; i < k; i++) m.tick();
}, n);
const state = <T>(p: Page, fn: string): Promise<T> => p.evaluate((f) => new Function('m', `return (${f})(m)`)((window as Any).__fh), fn);

async function noSmallButtons(p: Page) {
  const small = await p.evaluate(() => [...document.querySelectorAll('button')]
    .map((el) => ({ label: el.getAttribute('aria-label') ?? el.textContent, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
    .map(({ label, r }) => `${label} ${Math.round(r.width)}×${Math.round(r.height)}`));
  expect(small).toEqual([]);
}

async function hold(p: Page, selector: string, ms = 600) {
  const box = (await p.locator(selector).boundingBox())!;
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true };
  await p.locator(selector).dispatchEvent('pointerdown', at);
  await p.waitForTimeout(ms);
  await p.locator(selector).dispatchEvent('pointerup', at);
}

test('menu to match, and every control is thumb-sized', async ({ page: p }, info) => {
  await p.goto('./?nosw');
  await expect(p.getByRole('heading', { name: 'FOOTHOLD' })).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'How to play' }).tap();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Back' }).tap();
  await p.getByRole('button', { name: 'Normal' }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  await expect(p.locator('.left')).toBeVisible();
  await expect(p.locator('.right')).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('match-start.png') });
  await p.getByRole('button', { name: 'Pause' }).tap();
  await expect(p.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await noSmallButtons(p);
  expect(await state(p, '(m) => m.paused.value')).toBe(true);
  await p.getByRole('button', { name: 'Resume' }).tap();
  expect(await state(p, '(m) => m.paused.value')).toBe(false);
});

test('the panels leave the battlefield in the middle and nothing overflows the screen', async ({ page: p }) => {
  await start(p);
  const { w, h } = await p.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  for (const sel of ['.top', '.left', '.right', '.mini', '.orders']) {
    const b = (await p.locator(sel).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(h + 0.5);
  }
  const left = (await p.locator('.left').boundingBox())!, right = (await p.locator('.right').boundingBox())!;
  expect(right.x - (left.x + left.width)).toBeGreaterThan(w * 0.5);
});

test('train with a tap, keep them coming with a press and hold', async ({ page: p }) => {
  await start(p);
  await run(p, 30);
  const before = await state<number>(p, '(m) => m.g.players[0].blocks');
  await p.getByRole('button', { name: 'Train Worker' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBeLessThan(before);
  expect(await state<number>(p, '(m) => m.g.ents.find((e) => e.kind === 20 && e.owner === 0).queue.length')).toBe(1);
  await hold(p, '[aria-label="Train Worker"]');
  await run(p, 3);
  expect(await state<number[]>(p, '(m) => m.g.players[0].repeat')).toEqual([1]);
  await run(p, 400);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 1 && e.owner === 0).length')).toBeGreaterThan(10);
  // A unit with no building yet says why.
  await p.getByRole('button', { name: 'Train Trooper' }).tap();
  await expect(p.locator('.toast.warn')).toContainText('Needs a Barracks');
});

test('place a building by dragging its outline, then cancel one under construction', async ({ page: p }, info) => {
  await start(p);
  await p.evaluate(() => { (window as Any).__fh.g.players[0].blocks = 600; });
  await run(p, 2);
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await p.getByRole('button', { name: 'Build Barracks' }).tap();
  await expect(p.locator('.bar.place')).toContainText('drag the outline');
  await noSmallButtons(p);
  const from = await state<{ x: number; y: number; tx: number; ty: number }>(p, `(m) => { const pl = m.placing.value; const s = m.toScreen((pl.tx + 1.5) * 256, (pl.ty + 1.5) * 256); return { x: s.x, y: s.y, tx: pl.tx, ty: pl.ty }; }`);
  const to = await state<{ x: number; y: number }>(p, '(m) => m.toScreen(17.5 * 256, 35.5 * 256)');
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await p.mouse.move(to.x, to.y, { steps: 4 });
  await p.mouse.up();
  const placed = await state<{ tx: number; ty: number; ok: boolean }>(p, '(m) => m.placing.value');
  expect(placed).toMatchObject({ tx: 16, ty: 34, ok: true });
  await p.screenshot({ path: info.outputPath('placing.png') });
  await p.getByRole('button', { name: 'Confirm build' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 21 && e.owner === 0).length')).toBe(1);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBe(450);
  // An outline over the Headquarters turns red and refuses.
  await p.getByRole('button', { name: 'Build Barracks' }).tap();
  await p.evaluate(() => { (window as Any).__fh.movePlace(6, 37); });
  expect(await state<boolean>(p, '(m) => m.placing.value.ok')).toBe(false);
  await p.getByRole('button', { name: 'Confirm build' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 21 && e.owner === 0).length')).toBe(1);
  await p.getByRole('button', { name: 'Cancel placing' }).tap();
  // Tap the site, cancel it, get the Blocks back.
  const site = await state<{ x: number; y: number }>(p, '(m) => { const e = m.g.ents.find((e) => e.kind === 21 && e.owner === 0); return m.toScreen(e.x, e.y); }');
  await p.touchscreen.tap(site.x, site.y);
  await p.getByRole('button', { name: 'Cancel it' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 21 && e.owner === 0).length')).toBe(0);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBeGreaterThanOrEqual(560);
});

test('select a group, send it with a tap on the map and on the minimap, split it, hold it', async ({ page: p }, info) => {
  await start(p);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    m.g.players[0].blocks = 3000;
    m.issue({ t: 'build', p: 0, kind: 21, tx: 13, ty: 34 });
  });
  await run(p, 400);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    for (let i = 0; i < 4; i++) m.train(2);
    m.train(4);
  });
  await run(p, 800);
  expect(await state<number>(p, '(m) => m.hud.value.groups[0].count')).toBe(5);
  await p.getByRole('button', { name: 'Group 1' }).tap();
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(0);
  // Tap open ground on the battlefield: the group attack-moves there.
  const spot = await state<{ x: number; y: number }>(p, '(m) => { m.cam.x = 16 * 256; m.cam.y = 40 * 256; m.cam.zoom = 20; m.clampCam(); return m.toScreen(19 * 256, 44 * 256); }');
  await p.touchscreen.tap(spot.x, spot.y);
  await run(p, 2);
  expect(await state<{ mode: number; x: number; y: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 1 });
  await run(p, 200);
  const near = await state<boolean>(p, '(m) => m.g.ents.filter((e) => e.owner === 0 && e.group === 0).every((e) => Math.abs(e.x - 19 * 256) < 3 * 256 && Math.abs(e.y - 44 * 256) < 3 * 256)');
  expect(near).toBe(true);
  // Move is one-shot, by a tap on the minimap.
  await p.getByRole('button', { name: 'Move', exact: true }).tap();
  const mini = (await p.locator('.mini').boundingBox())!;
  await p.touchscreen.tap(mini.x + mini.width * (30 / 96), mini.y + mini.height * (38 / 48));
  await run(p, 2);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 2 });
  expect(await state<number>(p, '(m) => m.mode.value')).toBe(1);
  // Press and hold the group to split it: Runners to Group 2.
  await hold(p, '[aria-label="Group 1"]');
  await expect(p.getByRole('heading', { name: 'Group 1: 5 units' })).toBeVisible();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('split.png') });
  await p.locator('.srow', { hasText: 'Runner' }).getByRole('button', { name: '2' }).tap();
  await run(p, 3);
  expect(await state<number[]>(p, '(m) => m.hud.value.groups.map((g) => g.count)')).toEqual([4, 1, 0, 0]);
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(1);
  await p.getByRole('button', { name: 'Hold', exact: true }).tap();
  await run(p, 2);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[1]')).toMatchObject({ mode: 3 });
});

test('drag pans, the wheel zooms, and the whole map fits between the panels', async ({ page: p }, info) => {
  await start(p);
  const c0 = await state<{ x: number; y: number; zoom: number }>(p, '(m) => ({ ...m.cam })');
  const mid = await state<{ x: number; y: number }>(p, '(m) => m.centre()');
  await p.mouse.move(mid.x, mid.y);
  await p.mouse.down();
  await p.mouse.move(mid.x - 60, mid.y - 30, { steps: 5 });
  await p.mouse.up();
  const c1 = await state<{ x: number; y: number; zoom: number }>(p, '(m) => ({ ...m.cam })');
  expect(c1.x).toBeGreaterThan(c0.x);
  expect(c1.y).toBeGreaterThan(c0.y);
  await p.mouse.wheel(0, 4000);
  const fit = await state<{ zoom: number; min: number; left: number; right: number; w: number }>(p, `(m) => {
    m.cam.x = 48 * 256; m.cam.y = 24 * 256; m.clampCam();
    return { zoom: m.cam.zoom, min: m.minZoom(), left: m.toScreen(0, 0).x, right: m.toScreen(96 * 256, 0).x, w: m.viewW };
  }`);
  expect(fit.zoom).toBeCloseTo(fit.min, 5);
  expect(fit.left).toBeGreaterThanOrEqual(152);
  expect(fit.right).toBeLessThanOrEqual(fit.w - 152);
  await run(p, 4);
  await p.screenshot({ path: info.outputPath('whole-map.png') });
});

test('the opponent comes for you, and a match ends with a result screen', async ({ page: p }, info) => {
  test.setTimeout(120_000);
  await start(p, 'play=1&seed=7');
  // Do nothing: the opponent should find and finish an idle player.
  const ended = await p.evaluate(() => {
    const m = (window as Any).__fh;
    for (let i = 0; i < 12000 && m.g.winner < 0; i++) m.tick();
    return { winner: m.g.winner, tick: m.g.tick, hit: m.g.players[0].stats.firstAttackTick };
  });
  expect(ended.winner).toBe(1);
  expect(ended.hit).toBeGreaterThan(0);
  expect(ended.hit).toBeLessThan(6000);
  await expect(p.getByRole('heading', { name: 'Defeat' })).toBeVisible();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('defeat.png') });
  await p.getByRole('button', { name: 'Play again' }).tap();
  await p.waitForFunction(() => (window as Any).__fh.g.tick < 50);
});

test('turning the phone upright asks you to turn it back', async ({ page: p }) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto('./?nosw');
  await expect(p.locator('.rotate')).toBeVisible();
  await expect(p.locator('.rotate')).toContainText('Turn your phone sideways');
});
