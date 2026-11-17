import { expect, test } from '@playwright/test';
import { def } from '../src/sim/data';
import { K } from '../src/sim/types';

import { type Any, hold, noSmallButtons, run, start, state } from './helpers';

test('menu to match, and every control is thumb-sized', async ({ page: p }, info) => {
  await p.goto('./?nosw');
  await expect(p.getByRole('heading', { name: 'FOOTHOLD' })).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'How to play' }).tap();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Back' }).tap();
  await p.getByRole('button', { name: 'Normal', exact: true }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  await expect(p.locator('.left')).toBeVisible();
  await expect(p.locator('.right')).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Tech', exact: true }).tap();
  await expect(p.getByRole('button', { name: 'Research Weapons' })).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Train', exact: true }).tap();
  await expect(p.locator('.grid .tile')).toHaveCount(9);
  await p.screenshot({ path: info.outputPath('match-start.png') });
  await p.getByRole('button', { name: 'Pause' }).tap();
  await expect(p.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await noSmallButtons(p);
  expect(await state(p, '(m) => m.paused.value')).toBe(true);
  await p.getByRole('button', { name: 'Resume' }).tap();
  expect(await state(p, '(m) => m.paused.value')).toBe(false);
});

test('the unit guide, from the pause sheet and from How to play: every unit of both factions, its toys, job and numbers', async ({ page: p }) => {
  await start(p, 'play=1&seed=7&me=dino&foe=green');
  await p.getByRole('button', { name: 'Pause' }).tap();
  await p.getByRole('button', { name: 'Units', exact: true }).tap();
  const guide = p.getByRole('dialog', { name: 'Units' });
  await expect(guide).toBeVisible();
  // It opens on your own faction: a card a unit, Gatherer to Rex, each with its toy in your colour and in tan.
  await expect(guide.getByRole('button', { name: 'Dino Pack' })).toHaveAttribute('aria-pressed', 'true');
  await expect(guide.locator('.ucard')).toHaveCount(7);
  await expect(guide.locator('.ucard').first()).toContainText('Gatherer');
  const raptor = guide.locator(`.ucard[data-kind="${K.Raptor}"]`);
  await expect(raptor).toContainText('2 to an egg');
  await expect(raptor).toContainText('an egg ·');
  await expect(raptor).toContainText('Beats');
  await expect(raptor).toContainText('Beaten by');
  await expect(raptor).toContainText('Health ');
  const drawn = await guide.locator('.ucard img').evaluateAll((els) => els.map((el) => (el as HTMLImageElement).naturalWidth));
  expect(drawn.length).toBe(14);
  expect(drawn.every((w) => w > 0)).toBe(true);
  await noSmallButtons(p);
  // The other faction is a tap away.
  await guide.getByRole('button', { name: 'Green Army' }).tap();
  await expect(guide.locator('.ucard')).toHaveCount(9);
  await expect(guide.locator(`.ucard[data-kind="${K.Jugger}"]`)).toContainText('Batteries');
  await expect(guide.locator(`.ucard[data-kind="${K.Jugger}"]`)).toContainText('Heavy Works');
  await expect(guide.locator(`.ucard[data-kind="${K.Flak}"]`)).toContainText('flyers only');
  // The list scrolls inside the sheet: the last card can be reached, and the sheet stays on the screen.
  await guide.locator('.ucard').last().scrollIntoViewIfNeeded();
  await expect(guide.locator('.ucard').last()).toBeInViewport();
  const box = (await guide.boundingBox())!, h = await p.evaluate(() => innerHeight);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
  // Back to the pause sheet, still paused.
  await guide.getByRole('button', { name: 'Back' }).tap();
  await expect(p.getByRole('heading', { name: 'Paused' })).toBeVisible();
  expect(await state(p, '(m) => m.paused.value')).toBe(true);
  // And from the menu, under How to play.
  await p.getByRole('button', { name: 'Quit to menu' }).tap();
  await p.getByRole('button', { name: 'How to play' }).tap();
  await p.getByRole('button', { name: 'Units', exact: true }).tap();
  await expect(p.getByRole('dialog', { name: 'Units' })).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('dialog', { name: 'Units' }).getByRole('button', { name: 'Back' }).tap();
  await expect(p.getByRole('button', { name: 'How to play' })).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'Units', exact: true })).toBeVisible();
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
  const to = await state<{ x: number; y: number }>(p, '(m) => m.toScreen(17.5 * 256, 54.5 * 256)');
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await p.mouse.move(to.x, to.y, { steps: 4 });
  await p.mouse.up();
  const placed = await state<{ tx: number; ty: number; ok: boolean }>(p, '(m) => m.placing.value');
  expect(placed).toMatchObject({ tx: 16, ty: 53, ok: true });
  await p.screenshot({ path: info.outputPath('placing.png') });
  await p.getByRole('button', { name: 'Confirm build' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 21 && e.owner === 0).length')).toBe(1);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBe(450);
  // An outline over the Headquarters turns red and refuses.
  await p.getByRole('button', { name: 'Build Barracks' }).tap();
  await p.evaluate(() => { (window as Any).__fh.movePlace(6, 56); });
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

test('select a group, send it with a tap on the map and on the minimap; Move stays on until switched back', async ({ page: p }) => {
  await start(p);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    m.g.players[0].blocks = 3000;
    m.issue({ t: 'build', p: 0, kind: 21, tx: 13, ty: 53 });
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
  // Move, by a tap on the minimap, and it stays Move for the next order too.
  const mini = (await p.locator('.mini').boundingBox())!;
  const move = p.getByRole('button', { name: 'Move', exact: true }), attack = p.getByRole('button', { name: 'Attack', exact: true });
  await move.tap();
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  await p.touchscreen.tap(mini.x + mini.width * (45 / 144), mini.y + mini.height * (57 / 72));
  await run(p, 2);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 2 });
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  await expect(p.locator('.hint')).toContainText('without stopping to fight');
  await p.touchscreen.tap(mini.x + mini.width * (31 / 144), mini.y + mini.height * (59 / 72));
  await run(p, 2);
  expect(await state<{ mode: number; x: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 2 });
  expect(await state<number>(p, '(m) => m.g.players[0].groups[0].x')).toBeLessThan(34 * 256);
  // It sticks: deselect and it is still lit, and can still be pressed; select again, still Move. Only
  // pressing Attack switches it back.
  await p.getByRole('button', { name: 'Group 1' }).tap();
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  await expect(move).toBeEnabled();
  await expect(attack).toBeEnabled();
  await p.getByRole('button', { name: 'Group 1' }).tap();
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  await attack.tap();
  await expect(attack).toHaveAttribute('aria-pressed', 'true');
  await p.touchscreen.tap(mini.x + mini.width * (45 / 144), mini.y + mini.height * (57 / 72));
  await run(p, 2);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 1 });
  await p.getByRole('button', { name: 'Hold', exact: true }).tap();
  await run(p, 2);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 3 });
});

test('make groups in the organiser: tap the units, then the group they should join', async ({ page: p }, info) => {
  await start(p);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    for (let i = 0; i < 8; i++) m.debugSpawn(2, 0, 15 + (i % 4), 40 + Math.floor(i / 4));
    for (let i = 0; i < 3; i++) m.debugSpawn(4, 0, 15 + i, 42);
    for (let i = 0; i < 2; i++) m.debugSpawn(5, 0, 15 + i, 62);
    for (const e of m.g.ents) if (e.owner === 0 && e.group === 3) e.group = 0;
  });
  await run(p, 2);
  const counts = () => state<number[]>(p, '(m) => m.hud.value.groups.map((g) => g.count)');
  const kinds = (g: number) => state<Record<string, number>>(p, `(m) => Object.fromEntries(m.hud.value.groups[${g}].kinds.map((k) => [k.kind, k.n]))`);
  expect(await counts()).toEqual([13, 0, 0, 0]);
  // The Groups button is always there, and says what to do.
  await p.getByRole('button', { name: 'Groups', exact: true }).tap();
  await expect(p.locator('.org [data-row="hint"]')).toContainText('Tap the units you want');
  await noSmallButtons(p);
  // All three Runners to Group 2: tap them, tap Group 2.
  await p.getByRole('button', { name: '3 Runners in Group 1' }).tap();
  await expect(p.locator('.org [data-row="picked"]')).toContainText('Runners from Group 1');
  await expect(p.locator('.org .count')).toHaveText('3');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('organiser.png') });
  await p.getByRole('button', { name: 'Move them to Group 2' }).tap();
  await run(p, 3);
  expect(await counts()).toEqual([10, 3, 0, 0]);
  expect(await kinds(1)).toEqual({ 4: 3 });
  // Some of a kind: five of the eight Troopers to Group 3, by tapping anywhere on its card.
  await p.getByRole('button', { name: '8 Troopers in Group 1' }).tap();
  await p.getByRole('button', { name: 'Half' }).tap();
  await expect(p.locator('.org .count')).toHaveText('4');
  await p.getByRole('button', { name: 'One more' }).tap();
  await expect(p.locator('.org .count')).toHaveText('5');
  await p.locator('.org [data-card="2"]').tap();
  await run(p, 3);
  expect(await counts()).toEqual([5, 3, 5, 0]);
  expect(await kinds(2)).toEqual({ 2: 5 });
  // Half of everyone left in Group 1 (three Troopers, two Tanks) is a fair share of each kind.
  await p.getByRole('button', { name: 'Everyone in Group 1' }).tap();
  await p.getByRole('button', { name: 'Half' }).tap();
  await expect(p.locator('.org .count')).toHaveText('3');
  await p.getByRole('button', { name: 'Move them to Group 4' }).tap();
  await run(p, 3);
  expect(await counts()).toEqual([2, 3, 5, 3]);
  expect(await kinds(3)).toEqual({ 2: 2, 5: 1 });
  // A picked kind can be put back down by tapping it again, and new units can be sent to another group.
  await p.getByRole('button', { name: '3 Runners in Group 2' }).tap();
  await p.getByRole('button', { name: '3 Runners in Group 2' }).tap();
  await expect(p.locator('.org [data-row="hint"]')).toBeVisible();
  await p.getByRole('button', { name: 'New units join Group 2' }).tap();
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.g.players[0].rally')).toBe(1);
  await p.getByRole('button', { name: 'Done' }).tap();
  await expect(p.locator('.org')).toHaveCount(0);
  // The last group filled is the one selected, ready for an order.
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(3);
  await expect(p.locator('[data-group="1"] .rally')).toBeVisible();
  // Empty a group and tap it: the organiser opens, since an empty group has nothing to order about.
  await p.evaluate(() => { const m = (window as Any).__fh; m.assign(3, 0, 0, 0); });
  await run(p, 3);
  await expect(p.locator('[data-group="3"]')).toHaveClass(/empty/);
  await p.getByRole('button', { name: 'Group 4' }).tap();
  await expect(p.locator('.org')).toBeVisible();
  await p.getByRole('button', { name: 'Done' }).tap();
  // A tap outside the sheet closes it. Press and hold on a group opens it too.
  await p.touchscreen.tap(8, 8);
  await expect(p.locator('.org')).toHaveCount(0);
  await hold(p, '[aria-label="Group 1"]');
  await expect(p.locator('.org')).toBeVisible();
});

test('a Refinery snaps onto a battery pack, takes three Workers and fills the Batteries count', async ({ page: p }, info) => {
  await start(p);
  await p.evaluate(() => { (window as Any).__fh.g.players[0].blocks = 600; });
  await run(p, 2);
  await expect(p.locator('[data-stat="batteries"]')).toHaveText('0');
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await p.getByRole('button', { name: 'Build Refinery' }).tap();
  await expect(p.locator('.bar.place')).toContainText('battery pack');
  // It starts on the pack beside the Headquarters.
  expect(await state<{ tx: number; ty: number; ok: boolean }>(p, '(m) => m.placing.value')).toMatchObject({ tx: 6, ty: 62, ok: true });
  // Dragged onto open ground it turns red; dragged back near the pack it snaps on.
  await p.evaluate(() => { (window as Any).__fh.movePlace(14, 55); });
  expect(await state<boolean>(p, '(m) => m.placing.value.ok')).toBe(false);
  await p.evaluate(() => { (window as Any).__fh.movePlace(8, 61); });
  expect(await state<{ tx: number; ty: number; ok: boolean }>(p, '(m) => m.placing.value')).toMatchObject({ tx: 6, ty: 62, ok: true });
  await p.screenshot({ path: info.outputPath('refinery.png') });
  await p.getByRole('button', { name: 'Confirm build' }).tap();
  await run(p, 700);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 23 && e.owner === 0 && e.built).length')).toBe(1);
  expect(await state<number>(p, '(m) => m.g.players[0].gas')).toBeGreaterThan(40);
  await expect(p.locator('[data-stat="batteries"]')).not.toHaveText('0');
  await expect(p.locator('[data-stat="workers"]')).toContainText('/15');
  // With the only pack in reach taken, a second Refinery starts on the next nearest.
  await p.getByRole('button', { name: 'Build Refinery' }).tap();
  expect(await state<{ tx: number; ty: number }>(p, '(m) => m.placing.value')).not.toMatchObject({ tx: 6, ty: 62 });
});

test('the panels say what a unit needs, and research runs at the Armory', async ({ page: p }, info) => {
  await start(p);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    m.g.players[0].blocks = 3000;
    m.g.players[0].gas = 3000;
  });
  await run(p, 2);
  await p.getByRole('button', { name: 'Train Tank' }).tap();
  await expect(p.locator('.toast.warn')).toContainText('Needs a Factory');
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    m.debugSpawn(21, 0, 13.5, 53.5);
    m.debugSpawn(24, 0, 17.5, 53.5);
  });
  await run(p, 2);
  await p.getByRole('button', { name: 'Train Juggernaut' }).tap();
  await expect(p.locator('.toast.warn', { hasText: 'Heavy Works' })).toContainText('Needs a Heavy Works');
  await p.getByRole('button', { name: 'Train Tank' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.players[0].gas')).toBe(3000 - def(K.Tank).gas);
  expect(await state<number[]>(p, '(m) => m.g.ents.find((e) => e.kind === 24).queue')).toEqual([5]);
  await p.getByRole('button', { name: 'Tech', exact: true }).tap();
  await p.getByRole('button', { name: 'Research Weapons' }).tap();
  await expect(p.locator('.toast.warn', { hasText: 'Armory' })).toContainText('Needs an Armory');
  await p.evaluate(() => { (window as Any).__fh.debugSpawn(26, 0, 13.5, 62.5); });
  await run(p, 2);
  await p.getByRole('button', { name: 'Research Weapons' }).tap();
  await run(p, 100);
  expect(await state<number>(p, '(m) => m.hud.value.research[0].progress')).toBeGreaterThan(0.1);
  await p.screenshot({ path: info.outputPath('research.png') });
  await run(p, 520);
  expect(await state<number>(p, '(m) => m.g.players[0].weapons')).toBe(1);
  await expect(p.getByRole('button', { name: 'Research Weapons' })).toContainText('●○');
  await noSmallButtons(p);
});

test('every unit and building of the full arsenal is drawn, near and far, with nothing going wrong', async ({ page: p }, info) => {
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await start(p);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    m.g.players[0].explored.fill(1);
    [21, 24, 25, 26, 27, 22].forEach((k, i) => m.debugSpawn(k, 0, 12.5 + (i % 3) * 4, 33.5 + Math.floor(i / 3) * 10));
    [2, 3, 4, 5, 6, 7, 8, 9].forEach((k, i) => {
      m.debugSpawn(k, 0, 12 + (i % 4) * 1.4, 37.5 + Math.floor(i / 4) * 1.4);
      m.debugSpawn(k, 1, 18 + (i % 4) * 1.4, 37.5 + Math.floor(i / 4) * 1.4);
    });
    m.cam.x = 15 * 256; m.cam.y = 39 * 256; m.cam.zoom = 24; m.clampCam();
    m.paused.value = false;
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: info.outputPath('arsenal.png') });
  // Every kind is in the fight on the group button, and shells have flown.
  expect(await state<number>(p, '(m) => m.g.log.length + m.g.events.length + m.fx.length')).toBeGreaterThan(0);
  await p.evaluate(() => { const m = (window as Any).__fh; m.cam.zoom = 6; m.clampCam(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: info.outputPath('arsenal-far.png') });
  await p.evaluate(() => { const m = (window as Any).__fh; m.cam.x = 40 * 256; m.cam.y = 14 * 256; m.cam.zoom = 44; m.clampCam(); });
  await p.waitForTimeout(400);
  expect(errors).toEqual([]);
});

test('the buttons show the toys themselves: every unit and building has its own picture', async ({ page: p }) => {
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  // Eight buildings and nine units for the Green Army; eight and seven for the Dino Pack.
  for (const [query, tabs, count] of [['play=1&seed=7', ['Build', 'Train'], 17], ['play=1&seed=7&me=dino', ['Build', 'Hatch'], 15]] as const) {
    await start(p, query);
    const seen = new Set<string>();
    for (const tab of tabs) {
      await p.getByRole('button', { name: tab, exact: true }).tap();
      await expect(p.locator('.grid img.toy').first()).toBeVisible();
      const toys = await p.locator('.grid img.toy').evaluateAll((els) => els.map((el) => {
        const img = el as HTMLImageElement, r = img.getBoundingClientRect();
        return { src: img.src, drawn: img.complete && img.naturalWidth > 0, w: r.width, h: r.height };
      }));
      for (const t of toys) {
        expect(t.drawn).toBe(true);
        // Big enough to tell a Tank from a Flak Track, and never squashed.
        expect(t.w).toBeGreaterThanOrEqual(16);
        expect(Math.abs(t.w - t.h)).toBeLessThan(1);
        seen.add(t.src);
      }
    }
    expect(seen.size).toBe(count);
  }
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------- the Dino Pack

const DINO = 'play=1&seed=7&me=dino';

test('choose a side on the menu: the Dino Pack plays, and the choice is remembered', async ({ page: p }, info) => {
  await p.goto('./?nosw');
  await expect(p.getByRole('button', { name: 'Play the Green Army', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(p.getByRole('button', { name: 'Against either', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await p.getByRole('button', { name: 'Play the Dino Pack', exact: true }).tap();
  await p.getByRole('button', { name: 'Against the Green Army', exact: true }).tap();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('menu.png') });
  await p.getByRole('button', { name: 'Normal', exact: true }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  expect(await state<string[]>(p, '(m) => m.g.players.map((pl) => pl.faction)')).toEqual(['dino', 'green']);
  await expect(p.getByRole('button', { name: 'Hatch', exact: true })).toBeVisible();
  await expect(p.locator('.grid .tile')).toHaveCount(7);
  await expect(p.locator('[data-stat="eggs"]')).toHaveText('1/3');
  await expect(p.locator('[data-stat="workers"]')).toContainText('8/12');
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await expect(p.locator('.grid .tile')).toHaveCount(8);
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Tech', exact: true }).tap();
  await expect(p.getByRole('button', { name: 'Research Claws' })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Research Hide' })).toBeVisible();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('dino-start.png') });
  // Back at the menu the same sides are still picked; against the Dino Pack it is a Dino mirror.
  await p.goto('./?nosw');
  await expect(p.getByRole('button', { name: 'Play the Dino Pack', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(p.getByRole('button', { name: 'Against the Green Army', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await p.getByRole('button', { name: 'Against the Dino Pack', exact: true }).tap();
  await p.getByRole('button', { name: 'Easy', exact: true }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  expect(await state<string[]>(p, '(m) => m.g.players.map((pl) => pl.faction)')).toEqual(['dino', 'dino']);
});

test('hatch with a tap: the egg leaves the Nest and a dinosaur climbs out', async ({ page: p }, info) => {
  await start(p, DINO);
  await run(p, 2);
  await expect(p.locator('[data-stat="eggs"]')).toHaveText('1/3');
  await p.getByRole('button', { name: 'Hatch Gatherer' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBe(0);
  expect(await state<number[]>(p, '(m) => m.g.ents.filter((e) => e.kind === 19 && e.owner === 0).map((e) => e.queue[0])')).toEqual([10]);
  await expect(p.locator('[data-stat="eggs"]')).toHaveText('0/3');
  // The Nest has no egg ready, and says so.
  await p.evaluate(() => { (window as Any).__fh.g.players[0].blocks = 400; });
  await run(p, 2);
  await p.getByRole('button', { name: 'Hatch Gatherer' }).tap();
  await expect(p.locator('.toast.warn')).toContainText('No egg ready yet');
  await run(p, 100);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 10 && e.owner === 0).length')).toBe(9);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 19).length')).toBe(0);
  // Eggs come back on their own, up to three; a press and hold keeps one kind hatching.
  await expect(p.locator('[data-stat="eggs"]')).toHaveText('2/3');
  await hold(p, '[aria-label="Hatch Gatherer"]');
  await run(p, 3);
  expect(await state<number[]>(p, '(m) => m.g.players[0].repeat')).toEqual([10]);
  await run(p, 300);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 10 && e.owner === 0).length')).toBeGreaterThan(11);
  // Raptors need a Den, and then come two to an egg.
  await p.getByRole('button', { name: 'Hatch Raptor' }).tap();
  await expect(p.locator('.toast.warn', { hasText: 'Den' })).toContainText('Needs a Den');
  await hold(p, '[aria-label="Hatch Gatherer"]');
  await p.evaluate(() => { const m = (window as Any).__fh; m.debugSpawn(32, 0, 13.5, 35.5); m.g.players[0].blocks = 400; });
  await run(p, 60);
  await expect(p.getByRole('button', { name: 'Hatch Raptor' })).toContainText('×2');
  await p.getByRole('button', { name: 'Hatch Raptor' }).tap();
  await run(p, 3);
  await p.screenshot({ path: info.outputPath('hatching.png') });
  await run(p, 130);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 11 && e.owner === 0).length')).toBe(2);
  await noSmallButtons(p);
});

test('a Gatherer becomes the building, and only on nesting ground', async ({ page: p }, info) => {
  await start(p, DINO);
  await p.evaluate(() => { (window as Any).__fh.g.players[0].blocks = 600; });
  await run(p, 2);
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await p.getByRole('button', { name: 'Build Den' }).tap();
  await expect(p.locator('.bar.place')).toContainText('nesting ground');
  await noSmallButtons(p);
  expect(await state<boolean>(p, '(m) => m.placing.value.ok')).toBe(true);
  // Far from the Nest the outline turns red and the build is refused.
  await p.evaluate(() => { (window as Any).__fh.movePlace(30, 36); });
  expect(await state<boolean>(p, '(m) => m.placing.value.ok')).toBe(false);
  await p.getByRole('button', { name: 'Confirm build' }).tap();
  await expect(p.locator('.toast.warn')).toContainText('nesting ground');
  await p.evaluate(() => { (window as Any).__fh.movePlace(13, 53); });
  expect(await state<{ tx: number; ty: number; ok: boolean }>(p, '(m) => m.placing.value')).toMatchObject({ tx: 13, ty: 53, ok: true });
  await p.screenshot({ path: info.outputPath('nesting-ground.png') });
  await p.getByRole('button', { name: 'Confirm build' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBe(500);
  // The Gatherer walks over and is gone; the Den then grows by itself.
  await run(p, 120);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 10 && e.owner === 0).length')).toBe(7);
  expect(await state<number>(p, '(m) => m.g.ents.find((e) => e.kind === 32 && e.owner === 0).builder')).toBe(-1);
  await expect(p.locator('[data-stat="workers"]')).toContainText('7/12');
  // Cancel it while it grows and the Gatherer climbs back out with the Blocks.
  const site = await state<{ x: number; y: number }>(p, '(m) => { const e = m.g.ents.find((e) => e.kind === 32 && e.owner === 0); return m.toScreen(e.x, e.y); }');
  await p.touchscreen.tap(site.x, site.y);
  await expect(p.locator('.bar')).toContainText('growing');
  await p.getByRole('button', { name: 'Cancel it' }).tap();
  await run(p, 3);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 32 && e.owner === 0).length')).toBe(0);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.kind === 10 && e.owner === 0).length')).toBe(8);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBeGreaterThanOrEqual(560);
});

test('every dinosaur and Dino building is drawn, near and far, with nothing going wrong', async ({ page: p }, info) => {
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await start(p, DINO);
  await p.evaluate(() => {
    const m = (window as Any).__fh;
    m.g.players[0].explored.fill(1);
    m.g.players[0].gas = 2000;
    m.g.players[0].blocks = 2000;
    [32, 33, 34, 35, 36, 37, 31].forEach((k, i) => m.debugSpawn(k, 0, 12.5 + (i % 4) * 4, 50.5 + Math.floor(i / 4) * 12));
    [10, 11, 12, 13, 14, 15, 16].forEach((k, i) => {
      m.debugSpawn(k, 0, 12 + (i % 4) * 1.5, 37.5 + Math.floor(i / 4) * 1.5);
      m.debugSpawn(k, 1, 18.5 + (i % 4) * 1.5, 37.5 + Math.floor(i / 4) * 1.5);
    });
    // The Green Army across the way, so every kind of hit is drawn as well.
    [2, 3, 5, 7, 8].forEach((k, i) => m.debugSpawn(k, 1, 20 + i * 1.2, 41));
    m.cam.x = 16 * 256; m.cam.y = 38 * 256; m.cam.zoom = 24; m.clampCam();
    m.paused.value = false;
  });
  await p.getByRole('button', { name: 'Hatch Rex' }).tap();
  // The egg is laid on the next tick. On a loaded machine a frame can catch up many ticks at once, and the
  // fight next door goes on meanwhile, so wait for the egg itself rather than a fixed time.
  await p.waitForFunction(() => (window as Any).__fh.g.ents.filter((e: Any) => e.kind === 19).length === 1);
  await p.waitForTimeout(600);
  await p.screenshot({ path: info.outputPath('dinosaurs.png') });
  expect(await state<number>(p, '(m) => m.fx.length + m.g.events.length')).toBeGreaterThan(0);
  await p.evaluate(() => { const m = (window as Any).__fh; m.cam.zoom = 6; m.clampCam(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: info.outputPath('dinosaurs-far.png') });
  await p.getByRole('button', { name: 'Build', exact: true }).tap();
  await p.getByRole('button', { name: 'Build Volcano' }).tap();
  await p.waitForTimeout(300);
  await p.screenshot({ path: info.outputPath('dinosaurs-placing.png') });
  await noSmallButtons(p);
  expect(errors).toEqual([]);
});

test('the Dino opponent comes for you too, and beats an idle army', async ({ page: p }, info) => {
  test.setTimeout(120_000);
  await start(p, 'play=1&seed=7&foe=dino');
  const ended = await p.evaluate(() => {
    const m = (window as Any).__fh;
    for (let i = 0; i < 12000 && m.g.winner < 0; i++) m.tick();
    return { winner: m.g.winner, hit: m.g.players[0].stats.firstAttackTick };
  });
  expect(ended.winner).toBe(1);
  expect(ended.hit).toBeGreaterThan(0);
  expect(ended.hit).toBeLessThan(6000);
  await expect(p.getByRole('heading', { name: 'Defeat' })).toBeVisible();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('defeat-by-dinos.png') });
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
  await p.mouse.wheel(0, 4000);
  const fit = await state<{ zoom: number; min: number; left: number; right: number; w: number }>(p, `(m) => {
    m.cam.x = m.g.map.w * 128; m.cam.y = m.g.map.h * 128; m.clampCam();
    return { zoom: m.cam.zoom, min: m.minZoom(), left: m.toScreen(0, 0).x, right: m.toScreen(m.g.map.w * 256, 0).x, w: m.viewW };
  }`);
  expect(fit.zoom).toBeCloseTo(fit.min, 5);
  expect(fit.left).toBeGreaterThanOrEqual(172);
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

test('the pause sheet sets the speed, from half to double, and the choice is kept', async ({ page: p }, info) => {
  await start(p);
  const ticksIn = async (ms: number) => {
    const from = await state<number>(p, '(m) => m.g.tick');
    await p.waitForTimeout(ms);
    return (await state<number>(p, '(m) => m.g.tick')) - from;
  };
  await p.evaluate(() => { (window as Any).__fh.paused.value = false; });
  await expect(p.locator('.pace')).toHaveCount(0);
  const normal = await ticksIn(2000);
  await p.getByRole('button', { name: 'Pause' }).tap();
  await expect(p.getByRole('button', { name: 'Normal speed' })).toHaveAttribute('aria-pressed', 'true');
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Half speed' }).tap();
  await expect(p.getByRole('button', { name: 'Half speed' })).toHaveAttribute('aria-pressed', 'true');
  await p.screenshot({ path: info.outputPath('speed.png') });
  await p.getByRole('button', { name: 'Resume' }).tap();
  // The clock says so, and the match takes about twice as long over the same ground.
  await expect(p.locator('.pace')).toHaveText('½×');
  const half = await ticksIn(2000);
  expect(half).toBeGreaterThan(0);
  expect(half).toBeLessThanOrEqual(12);
  expect(half).toBeLessThan(normal * 0.75);
  expect(half).toBeGreaterThan(normal * 0.3);
  // A new match starts at the speed you left the last one at.
  await start(p);
  expect(await state<number>(p, '(m) => m.speed.value')).toBe(0.5);
  await expect(p.locator('.pace')).toHaveText('½×');
  await p.getByRole('button', { name: 'Pause' }).tap();
  await p.getByRole('button', { name: 'Three-quarter speed' }).tap();
  expect(await state<number>(p, '(m) => m.speed.value')).toBe(0.75);
  await p.getByRole('button', { name: 'Double speed' }).tap();
  expect(await state<number>(p, '(m) => m.speed.value')).toBe(2);
  await p.getByRole('button', { name: 'Normal speed' }).tap();
  await p.getByRole('button', { name: 'Resume' }).tap();
  await expect(p.locator('.pace')).toHaveCount(0);
});

test('turning the phone upright asks you to turn it back', async ({ page: p }) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto('./?nosw');
  await expect(p.locator('.rotate')).toBeVisible();
  await expect(p.locator('.rotate')).toContainText('Turn your phone sideways');
});
