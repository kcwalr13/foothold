import { expect, test } from '@playwright/test';
import { ABILITIES, FRENZY, abilityPower, frenzyUnits, frenzyUpgrades, heroHp, income } from '../src/sim/data';
import { K, TILE } from '../src/sim/types';
import { type Any, hold, noSmallButtons, run, start, state } from './helpers';

// Frenzy: four corners, a base that makes its own army, a hero steered by hand. These tests play it with
// thumbs on three phone sizes; the rules themselves are proved in src/sim/frenzy.test.ts.

const FRENZY_GREEN = 'play=1&seed=7&mode=frenzy&me=green&foe=dino';
const FRENZY_DINO = 'play=1&seed=7&mode=frenzy&me=dino&foe=green';

/** Raises your hero to a level, as a few minutes of fighting would. */
const level = (p: Parameters<typeof run>[0], n: number) => p.evaluate((lvl) => {
  const m = (window as Any).__fh, pl = m.g.players[0], h = m.hero();
  pl.heroLvl = lvl;
  h.lvl = lvl;
  m.refresh();
}, n);

test('Frenzy from the menu: four sides, a hero, and every control is thumb-sized', async ({ page: p }, info) => {
  await p.goto('./?nosw');
  const classic = p.getByRole('button', { name: /^Classic/ }), frenzy = p.getByRole('button', { name: /^Frenzy/ });
  await expect(classic).toHaveAttribute('aria-pressed', 'true');
  await frenzy.tap();
  await expect(frenzy).toHaveAttribute('aria-pressed', 'true');
  await expect(p.locator('.tag')).toContainText('Four corners');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('menu-frenzy.png') });
  await p.getByRole('button', { name: 'How to play' }).tap();
  await expect(p.locator('.how')).toContainText('Overtime');
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Back' }).tap();
  await p.getByRole('button', { name: 'Normal' }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  expect(await state(p, '(m) => ({ mode: m.g.mode, sides: m.g.players.length, me: m.g.players[0].faction, rivals: m.rivals.length })'))
    .toEqual({ mode: 'frenzy', sides: 4, me: 'green', rivals: 3 });
  // The base panel: Spawn and Tech, nothing to build and nobody to train.
  await expect(p.getByRole('button', { name: 'Spawn', exact: true })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Build', exact: true })).toHaveCount(0);
  await expect(p.locator('.grid .tile')).toHaveCount(frenzyUnits('green').length);
  await expect(p.locator('[data-stat="batteries"]')).toHaveCount(0);
  await expect(p.locator('[data-stat="workers"]')).toHaveCount(0);
  await expect(p.locator('[data-stat="base"]')).toHaveText('100%');
  // Two Collectors standing, and what they bring in each second beside the Blocks.
  await expect(p.locator('[data-stat="income"]')).toHaveText(`+${income(2, 0)}`);
  await expect(p.locator('.table i')).toHaveCount(4);
  // The army panel: the hero, its three abilities, two groups, and Follow where Groups was. The hero goes
  // its own way unless Follow is switched on, and Attack is lit from the start with nothing selected.
  await expect(p.getByRole('button', { name: 'Your Captain' })).toBeVisible();
  await expect(p.locator('.ability')).toHaveCount(3);
  await expect(p.locator('.right .group')).toHaveCount(3);
  await expect(p.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false');
  await expect(p.getByRole('button', { name: 'Attack', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(p.getByRole('button', { name: 'Move', exact: true })).toBeEnabled();
  await noSmallButtons(p);
  const { w, h } = await p.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  for (const sel of ['.top', '.left', '.right', '.mini', '.orders', '.abilities']) {
    const b = (await p.locator(sel).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(h + 0.5);
  }
  await p.screenshot({ path: info.outputPath('frenzy-start.png') });
  await p.getByRole('button', { name: 'Tech', exact: true }).tap();
  for (const name of ['Weapons', 'Armour', 'Muster', 'Haul', 'Might', 'Grit', 'Tempo']) await expect(p.getByRole('button', { name: `Buy ${name}` })).toBeVisible();
  await expect(p.locator('.grid.ups .tile')).toHaveCount(frenzyUpgrades('green').length);
  await expect(p.locator('[data-note="tech"]')).toContainText('at your Collectors');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-tech-start.png') });
  await p.getByRole('button', { name: 'Pause' }).tap();
  await expect(p.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await noSmallButtons(p);
  // Back at the menu Frenzy is still picked, and the Dino Pack plays it too, against three of its own.
  await p.goto('./?nosw');
  await expect(p.getByRole('button', { name: /^Frenzy/ })).toHaveAttribute('aria-pressed', 'true');
  await p.getByRole('button', { name: 'Play the Dino Pack' }).tap();
  await p.getByRole('button', { name: 'Against the Dino Pack' }).tap();
  await p.getByRole('button', { name: 'Easy' }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  expect(await state<string[]>(p, '(m) => m.g.players.map((pl) => pl.faction)')).toEqual(['dino', 'dino', 'dino', 'dino']);
  await expect(p.locator('.grid .tile')).toHaveCount(frenzyUnits('dino').length);
  await expect(p.getByRole('button', { name: 'Your Alpha' })).toBeVisible();
  await noSmallButtons(p);
  await p.getByRole('button', { name: 'Tech', exact: true }).tap();
  for (const name of ['Claws', 'Hide', 'Muster', 'Haul', 'Might', 'Grit', 'Tempo']) await expect(p.getByRole('button', { name: `Buy ${name}` })).toBeVisible();
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-dino.png') });
  // Classic is still there, and still the game it was.
  await p.goto('./?nosw');
  await p.getByRole('button', { name: /^Classic/ }).tap();
  await p.getByRole('button', { name: 'Normal' }).tap();
  await p.waitForFunction(() => !!(window as Any).__fh);
  expect(await state(p, '(m) => ({ mode: m.g.mode, sides: m.g.players.length })')).toEqual({ mode: 'classic', sides: 2 });
  await expect(p.getByRole('button', { name: 'Build', exact: true })).toBeVisible();
});

test('the base makes the army by itself: Bayonets first; unlock with Blocks and tap units in and out of the mix', async ({ page: p }, info) => {
  await start(p, FRENZY_GREEN);
  await run(p, 160);
  // The free unit is the one that fights hand to hand; Troopers are there to be unlocked.
  const first = await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.kind === ${K.Bayonet}).length`);
  expect(first).toBeGreaterThanOrEqual(2);
  expect(await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.kind === ${K.Trooper}).length`)).toBe(0);
  await expect(p.locator('[data-group="0"]')).toContainText(String(first));
  await expect(p.getByRole('button', { name: 'Stop making Bayonets' })).toHaveAttribute('aria-pressed', 'true');
  await expect(p.getByRole('button', { name: 'Unlock Troopers' })).toBeVisible();
  // Too dear: it says so, and nothing is spent.
  await p.getByRole('button', { name: 'Unlock Juggernauts' }).tap();
  await expect(p.locator('.toast').filter({ hasText: 'Not enough Blocks' })).toBeVisible();
  await p.evaluate(() => { const m = (window as Any).__fh; m.g.players[0].blocks = 1000; m.refresh(); });
  await p.getByRole('button', { name: 'Unlock Lancers' }).tap();
  await run(p, 2);
  expect(await state(p, '(m) => ({ blocks: m.g.players[0].blocks > 880 && m.g.players[0].blocks < 920, unlocked: m.g.players[0].unlocked, mix: m.g.players[0].repeat })'))
    .toEqual({ blocks: true, unlocked: [K.Bayonet, K.Lancer], mix: [K.Bayonet, K.Lancer] });
  await expect(p.getByRole('button', { name: 'Stop making Lancers' })).toHaveAttribute('aria-pressed', 'true');
  // Out of the mix, and back in; the last one cannot be taken out.
  await p.getByRole('button', { name: 'Stop making Bayonets' }).tap();
  await run(p, 2);
  expect(await state<number[]>(p, '(m) => m.g.players[0].repeat')).toEqual([K.Lancer]);
  await expect(p.getByRole('button', { name: 'Make Bayonets' })).toHaveAttribute('aria-pressed', 'false');
  await p.getByRole('button', { name: 'Stop making Lancers' }).tap();
  await run(p, 2);
  await expect(p.locator('.toast').filter({ hasText: 'The base must make something' })).toBeVisible();
  expect(await state<number[]>(p, '(m) => m.g.players[0].repeat')).toEqual([K.Lancer]);
  await run(p, 200);
  expect(await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.kind === ${K.Lancer}).length`)).toBeGreaterThanOrEqual(2);
  expect(await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.kind === ${K.Bayonet}).length`)).toBeLessThanOrEqual(first + 1);
  await p.getByRole('button', { name: 'Make Bayonets' }).tap();
  await run(p, 2);
  expect(await state<number[]>(p, '(m) => m.g.players[0].repeat')).toEqual([K.Lancer, K.Bayonet]);
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-spawn.png') });
});

test('Collectors bring the Blocks in and sell the upgrades: the army\'s, Haul, and the hero\'s own', async ({ page: p }, info) => {
  await start(p, FRENZY_GREEN);
  await run(p, 30);
  const tab = () => p.locator('.tabs.two button.on');
  // A tap on a Collector, out on the map, opens what it sells.
  await expect(tab()).toHaveText('Spawn');
  const c = await state<{ x: number; y: number }>(p, `(m) => { const e = m.g.ents.find((e) => e.owner === 0 && e.kind === ${K.Collector}); m.cam.x = e.x + 4 * 256; m.cam.y = e.y - 3 * 256; m.cam.zoom = 22; m.clampCam(); return m.toScreen(e.x, e.y); }`);
  await p.touchscreen.tap(c.x, c.y);
  await expect(tab()).toHaveText('Tech');
  await p.screenshot({ path: info.outputPath('frenzy-collectors.png') });
  // Every second, what the two of them bring in.
  const before = await state<{ blocks: number; tick: number }>(p, '(m) => ({ blocks: m.g.players[0].blocks, tick: m.g.tick })');
  await run(p, 100);
  expect(await state<number>(p, '(m) => m.g.players[0].blocks')).toBe(before.blocks + 10 * income(2, 0));
  // Bought on the spot: one of the army's, one of the base's.
  await p.evaluate(() => { const m = (window as Any).__fh; m.g.players[0].blocks = 2000; m.refresh(); });
  await p.getByRole('button', { name: 'Buy Weapons' }).tap();
  await p.getByRole('button', { name: 'Buy Muster' }).tap();
  await run(p, 2);
  expect(await state(p, '(m) => ({ weapons: m.g.players[0].weapons, armour: m.g.players[0].armour, muster: m.g.players[0].muster })')).toEqual({ weapons: 1, armour: 0, muster: 1 });
  await expect(p.getByRole('button', { name: 'Buy Weapons' })).toHaveAttribute('data-level', '1');
  await expect(p.getByRole('button', { name: 'Buy Weapons' }).locator('.pips i.on')).toHaveCount(1);
  await expect(p.getByRole('button', { name: 'Buy Weapons' }).locator('.pips i')).toHaveCount(FRENZY.researchCost.length);
  // Haul: more from each Collector, and the top bar says so.
  await p.getByRole('button', { name: 'Buy Haul' }).tap();
  await expect(p.locator('[data-note="tech"]')).toContainText('Each Collector brings in more Blocks');
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.g.players[0].haul')).toBe(1);
  await expect(p.locator('[data-stat="income"]')).toHaveText(`+${income(2, 1)}`);
  await expect(p.locator('.toast').filter({ hasText: `Haul level 1: ${income(2, 1)} Blocks a second` })).toBeVisible();
  // The hero's own: Grit is health, at once.
  const hpBefore = await state<number>(p, '(m) => m.hero().hp');
  await p.getByRole('button', { name: 'Buy Grit' }).tap();
  await expect(p.locator('[data-note="tech"]')).toContainText('Your hero has more health');
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.hero().hp')).toBe(hpBefore + heroHp(K.Captain, 1, 1) - heroHp(K.Captain, 1, 0));
  await p.getByRole('button', { name: 'Buy Might' }).tap();
  await p.getByRole('button', { name: 'Buy Tempo' }).tap();
  await run(p, 2);
  expect(await state(p, '(m) => ({ might: m.g.players[0].might, grit: m.g.players[0].grit, tempo: m.g.players[0].tempo })')).toEqual({ might: 1, grit: 1, tempo: 1 });
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-tech.png') });
  // Not enough: it says so.
  await p.evaluate(() => { const m = (window as Any).__fh; m.g.players[0].blocks = 0; m.refresh(); });
  await p.getByRole('button', { name: 'Buy Armour' }).tap();
  await expect(p.locator('.toast').filter({ hasText: 'Not enough Blocks' })).toBeVisible();
  // One Collector down: half comes in. Both down: nothing does, and nothing can be bought.
  await p.evaluate((kind) => { const m = (window as Any).__fh; m.g.ents.find((e: Any) => e.owner === 0 && e.kind === kind).hp = 0; }, K.Collector);
  await run(p, 3);
  await expect(p.locator('[data-stat="income"]')).toHaveText(`+${income(1, 1)}`);
  await expect(p.locator('.toast').filter({ hasText: `A Collector is down: ${income(1, 1)} Blocks a second now` })).toBeVisible();
  await p.evaluate((kind) => { const m = (window as Any).__fh; m.g.ents.find((e: Any) => e.owner === 0 && e.kind === kind).hp = 0; m.g.players[0].blocks = 3000; }, K.Collector);
  await run(p, 3);
  await expect(p.locator('[data-stat="income"]')).toHaveText('+0');
  await expect(p.locator('.toast').filter({ hasText: 'Both Collectors are down' })).toBeVisible();
  await expect(p.locator('[data-note="tech"]')).toContainText('nothing can be bought');
  await p.getByRole('button', { name: 'Buy Armour' }).tap();
  await run(p, 2);
  await expect(p.locator('.toast').filter({ hasText: 'Upgrades are bought at a Collector, and yours are down' })).toBeVisible();
  expect(await state<number>(p, '(m) => m.g.players[0].armour')).toBe(0);
  // Units can still be unlocked.
  await p.getByRole('button', { name: 'Spawn', exact: true }).tap();
  await p.getByRole('button', { name: 'Unlock Troopers' }).tap();
  await run(p, 2);
  expect(await state<number[]>(p, '(m) => m.g.players[0].unlocked')).toContain(K.Trooper);
});

test('a Collector under attack says so by name', async ({ page: p }) => {
  await start(p, FRENZY_GREEN);
  await run(p, 20);
  // An enemy Lancer in the corner behind a Collector, out of sight of the Turrets: it has only the Collector to shoot at.
  await p.evaluate(({ collector, lancer }) => {
    const m = (window as Any).__fh;
    const c = m.g.ents.find((e: Any) => e.owner === 0 && e.kind === collector);
    m.debugSpawn(lancer, 1, c.x / 256 - 1.4, c.y / 256 + 1.4);
  }, { collector: K.Collector, lancer: K.Lancer });
  await run(p, 40);
  await expect(p.locator('.toast').filter({ hasText: 'Collector under attack' }).first()).toBeVisible();
  expect(await state<boolean>(p, `(m) => m.g.ents.some((e) => e.owner === 0 && e.kind === ${K.Collector} && e.hp < 2500)`)).toBe(true);
});

test('steer the hero: it goes its own way; Follow takes the first group along; the minimap sends it too', async ({ page: p }, info) => {
  await start(p, FRENZY_GREEN);
  await run(p, 160);
  const hero = p.getByRole('button', { name: 'Your Captain' }), follow = p.getByRole('button', { name: 'Follow' });
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await hero.tap();
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(FRENZY.heroGroup);
  await expect(p.locator('.hint')).toContainText('Captain:');
  // One tap on the map: the hero goes, and the army stays where it is.
  const at = { x: 15.5 * TILE, y: 47.5 * TILE };
  const army = await state<{ mode: number; x: number; y: number }>(p, '(m) => m.g.players[0].groups[0]');
  const spot = await state<{ x: number; y: number }>(p, `(m) => { const h = m.hero(); m.cam.x = h.x; m.cam.y = h.y; m.cam.zoom = 20; m.clampCam(); return m.toScreen(${at.x}, ${at.y}); }`);
  await p.touchscreen.tap(spot.x, spot.y);
  await run(p, 2);
  const sent = await state<{ mode: number; x: number; y: number }[]>(p, '(m) => m.g.players[0].groups');
  expect(sent[FRENZY.heroGroup]).toMatchObject({ mode: 1 });
  expect(Math.abs(sent[FRENZY.heroGroup]!.x - at.x) + Math.abs(sent[FRENZY.heroGroup]!.y - at.y)).toBeLessThan(TILE);
  expect(sent[0]).toEqual(army);
  await run(p, 120);
  expect(await state<boolean>(p, `(m) => { const h = m.hero(); return Math.abs(h.x - ${at.x}) < 2 * 256 && Math.abs(h.y - ${at.y}) < 2 * 256; }`)).toBe(true);
  expect(await state<boolean>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.group === 0).every((e) => Math.hypot(e.x - ${at.x}, e.y - ${at.y}) > 2 * 256)`)).toBe(true);
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(FRENZY.heroGroup);
  // Follow on: the same tap now moves the first group too, and a tap among that group is still an order.
  await follow.tap();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(p.locator('.hint')).toContainText('Captain and Group 1');
  const next = { x: 17.5 * TILE, y: 49.5 * TILE };
  const spot2 = await state<{ x: number; y: number }>(p, `(m) => { const h = m.hero(); m.cam.x = h.x; m.cam.y = h.y; m.clampCam(); return m.toScreen(${next.x}, ${next.y}); }`);
  await p.touchscreen.tap(spot2.x, spot2.y);
  await run(p, 2);
  const both = await state<{ mode: number; x: number; y: number }[]>(p, '(m) => m.g.players[0].groups');
  expect(both[FRENZY.heroGroup]).toMatchObject({ mode: 1 });
  expect(both[0]).toMatchObject({ mode: 1 });
  expect(Math.abs(both[0]!.x - next.x) + Math.abs(both[0]!.y - next.y)).toBeLessThan(TILE);
  await run(p, 100);
  const among = await state<{ x: number; y: number }>(p, '(m) => { const u = m.g.ents.find((e) => e.owner === 0 && e.group === 0); const h = m.hero(); m.cam.x = h.x; m.cam.y = h.y; m.clampCam(); return m.toScreen(u.x + 60, u.y + 60); }');
  await p.touchscreen.tap(among.x, among.y);
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(FRENZY.heroGroup);
  // Follow off again: the hero goes alone by the minimap, and the army is picked up by a tap on one of its units.
  await follow.tap();
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await expect(p.locator('.hint')).toContainText('Captain:');
  const held = await state<{ x: number; y: number }>(p, '(m) => m.g.players[0].groups[0]');
  const mini = (await p.locator('.mini').boundingBox())!;
  // The square map sits in the middle half of the minimap's box: six tenths across the box is seven tenths across the map.
  await p.touchscreen.tap(mini.x + mini.width * 0.6, mini.y + mini.height * 0.5);
  await run(p, 2);
  const now = await state<{ mode: number; x: number; y: number }[]>(p, '(m) => m.g.players[0].groups');
  expect(now[0]).toMatchObject({ x: held.x, y: held.y });
  expect(Math.abs(now[FRENZY.heroGroup]!.x / TILE - 63 * 0.7)).toBeLessThan(2.5);
  expect(Math.abs(now[FRENZY.heroGroup]!.y / TILE - 63 * 0.5)).toBeLessThan(2.5);
  const unit = await state<{ x: number; y: number }>(p, '(m) => { const u = m.g.ents.find((e) => e.owner === 0 && e.group === 0); m.cam.x = u.x; m.cam.y = u.y; m.clampCam(); return m.toScreen(u.x, u.y); }');
  await p.touchscreen.tap(unit.x, unit.y);
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(0);
  await expect(p.locator('.hint')).toContainText('Group 1:');
  await noSmallButtons(p);
  // Hold stops the hero where it stands; Follow is remembered for the next round.
  await hero.tap();
  await p.getByRole('button', { name: 'Hold', exact: true }).tap();
  await run(p, 2);
  expect(await state<{ mode: number }>(p, `(m) => m.g.players[0].groups[${FRENZY.heroGroup}]`)).toMatchObject({ mode: 3 });
  await p.screenshot({ path: info.outputPath('frenzy-hero.png') });
  await follow.tap();
  await start(p, FRENZY_GREEN);
  await expect(p.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
  await p.getByRole('button', { name: 'Follow' }).tap();
  await expect(p.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false');
});

test('Attack and Move stick: whichever was pressed stays lit whatever is selected, falls or comes back', async ({ page: p }) => {
  await start(p, FRENZY_GREEN);
  await run(p, 160);
  const attack = p.getByRole('button', { name: 'Attack', exact: true }), move = p.getByRole('button', { name: 'Move', exact: true });
  const lit = async (which: 'attack' | 'move') => {
    await expect(move).toHaveAttribute('aria-pressed', which === 'move' ? 'true' : 'false');
    await expect(attack).toHaveAttribute('aria-pressed', which === 'attack' ? 'true' : 'false');
    await expect(move).toBeEnabled();
    await expect(attack).toBeEnabled();
  };
  // Nothing selected: Attack is lit, and Move can be pressed all the same.
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(-1);
  await lit('attack');
  await move.tap();
  await lit('move');
  // The hero, then the army: each goes without stopping to fight, and Move is still lit after each.
  const tapAt = async (tx: number, ty: number) => {
    const s = await state<{ x: number; y: number }>(p, `(m) => { m.cam.x = 13 * 256; m.cam.y = 50 * 256; m.cam.zoom = 18; m.clampCam(); return m.toScreen(${tx} * 256, ${ty} * 256); }`);
    await p.touchscreen.tap(s.x, s.y);
    await run(p, 2);
  };
  await p.getByRole('button', { name: 'Your Captain' }).tap();
  await lit('move');
  await expect(p.locator('.hint')).toContainText('without stopping to fight');
  await tapAt(16.5, 47.5);
  expect(await state<{ mode: number }>(p, `(m) => m.g.players[0].groups[${FRENZY.heroGroup}]`)).toMatchObject({ mode: 2 });
  await p.getByRole('button', { name: 'Group 1' }).tap();
  await lit('move');
  await tapAt(17.5, 50.5);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 2 });
  await lit('move');
  // The hero falls and the army is wiped out: still Move. The group new units join takes an order even
  // with nobody in it, and takes it as a Move.
  await p.evaluate(() => { const m = (window as Any).__fh; for (const e of m.g.ents) if (e.owner === 0 && e.group >= 0) e.hp = 0; });
  await run(p, 12);
  await lit('move');
  await tapAt(15.5, 48.5);
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(0);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 2 });
  await lit('move');
  // The hero comes back, new units arrive: still Move, and the next order is a Move.
  await run(p, 170);
  await expect(p.getByRole('button', { name: 'Your Captain', exact: true })).toHaveAttribute('data-hero', 'up');
  await lit('move');
  await p.getByRole('button', { name: 'Your Captain', exact: true }).tap();
  // (Well clear of the new units, which wait where the army was sent: a tap on one of them would pick them up.)
  await tapAt(20.5, 53.5);
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(FRENZY.heroGroup);
  expect(await state<{ mode: number }>(p, `(m) => m.g.players[0].groups[${FRENZY.heroGroup}]`)).toMatchObject({ mode: 2 });
  // Only pressing Attack changes it, and then that sticks the same way.
  await attack.tap();
  await lit('attack');
  await p.getByRole('button', { name: 'Group 1' }).tap();
  await lit('attack');
  await tapAt(17.5, 50.5);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 1 });
  await p.getByRole('button', { name: 'Your Captain', exact: true }).tap();
  await lit('attack');
  await noSmallButtons(p);
});

test('a fallen hero stays picked up; with Follow on the army answers meanwhile, and new units head for where it was sent', async ({ page: p }) => {
  await start(p, FRENZY_GREEN);
  await run(p, 160);
  const hero = p.getByRole('button', { name: 'Your Captain', exact: true });
  await hero.tap();
  await p.evaluate(() => { const m = (window as Any).__fh; m.hero().hp = 0; });
  await run(p, 4);
  await expect(hero).toHaveAttribute('data-hero', 'down');
  await expect(hero).toContainText('back in');
  const at = { x: 15.5 * TILE, y: 47.5 * TILE };
  const spot = await state<{ x: number; y: number }>(p, `(m) => { m.cam.x = 11 * 256; m.cam.y = 52 * 256; m.cam.zoom = 20; m.clampCam(); return m.toScreen(${at.x}, ${at.y}); }`);
  // On its own (Follow is off): a tap says the hero is down, moves nobody, and leaves it picked up.
  const idle = await state<{ x: number; y: number }>(p, '(m) => m.g.players[0].groups[0]');
  await p.touchscreen.tap(spot.x, spot.y);
  await run(p, 2);
  await expect(p.locator('.toast').filter({ hasText: 'Your Captain is down' }).first()).toBeVisible();
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(FRENZY.heroGroup);
  expect(await state<{ x: number; y: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject(idle);
  // With Follow on, the same tap sends the army.
  await p.getByRole('button', { name: 'Follow' }).tap();
  await expect(p.locator('.hint')).toContainText('Group 1:');
  await p.touchscreen.tap(spot.x, spot.y);
  await run(p, 2);
  expect(await state<{ mode: number }>(p, '(m) => m.g.players[0].groups[0]')).toMatchObject({ mode: 1 });
  const before = await state<number>(p, '(m) => m.g.ents.filter((e) => e.owner === 0 && e.group === 0).length');
  // An ability asked for while it is away says so.
  await p.getByRole('button', { name: 'Grenade' }).tap();
  await expect(p.locator('.toast').filter({ hasText: 'Your Captain is down' }).first()).toBeVisible();
  expect(await state<number>(p, '(m) => m.aim.value')).toBe(-1);
  // It comes back at the base, whole, and still selected.
  await run(p, 160);
  await expect(hero).toHaveAttribute('data-hero', 'up');
  expect(await state<number>(p, '(m) => m.sel.value')).toBe(FRENZY.heroGroup);
  expect(await state<boolean>(p, '(m) => { const h = m.hero(); return !!h && Math.abs(h.x - 11 * 256) < 3 * 256 && Math.abs(h.y - 52 * 256) < 3 * 256; }')).toBe(true);
  // Meanwhile the base kept working, and everything it made went where the army was sent.
  const army = await state<{ n: number; headed: boolean; there: number }>(p, `(m) => {
    const us = m.g.ents.filter((e) => e.owner === 0 && e.group === 0), near = (x, y) => Math.abs(x - ${at.x}) < 4 * 256 && Math.abs(y - ${at.y}) < 4 * 256;
    return { n: us.length, headed: us.every((e) => near(e.dx, e.dy)), there: us.filter((e) => near(e.x, e.y)).length };
  }`);
  expect(army.n).toBeGreaterThan(before);
  expect(army.headed).toBe(true);
  expect(army.there).toBeGreaterThanOrEqual(before);
  await p.getByRole('button', { name: 'Follow' }).tap();
});

test('abilities: Grenade is aimed with a tap inside the ring, Rally goes off at once, and each waits its turn', async ({ page: p }, info) => {
  await start(p, FRENZY_GREEN);
  await run(p, 120);
  const [grenade, rally, strike] = ABILITIES[K.Captain]!;
  // Not open yet: it says when.
  await p.getByRole('button', { name: rally!.name }).tap();
  await expect(p.locator('.toast').filter({ hasText: `${rally!.name} opens at level ${rally!.level}` })).toBeVisible();
  // Grenade: tap it, the ring and the bar appear; the cross puts it away again.
  const button = p.getByRole('button', { name: grenade!.name, exact: true });
  await button.tap();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(p.locator('.bar.place')).toContainText('tap the map inside the ring');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-aim.png') });
  await p.getByRole('button', { name: 'Cancel aiming' }).tap();
  expect(await state<number>(p, '(m) => m.aim.value')).toBe(-1);
  // Thrown at something three tiles off: it lands, and hurts.
  await p.evaluate((kind) => { const m = (window as Any).__fh, h = m.hero(); m.debugSpawn(kind, 1, h.x / 256 + 3, h.y / 256 - 2); m.refresh(); }, K.Jugger);
  const target = await state<{ x: number; y: number; hp: number; sx: number; sy: number }>(p, `(m) => { const h = m.hero(); const e = m.g.ents.find((e) => e.owner === 1 && e.kind === ${K.Jugger}); m.cam.x = h.x; m.cam.y = h.y; m.cam.zoom = 20; m.clampCam(); const s = m.toScreen(e.x, e.y); return { x: e.x, y: e.y, hp: e.hp, sx: s.x, sy: s.y }; }`);
  await button.tap();
  await p.touchscreen.tap(target.sx, target.sy);
  expect(await state<number>(p, '(m) => m.aim.value')).toBe(-1);
  await run(p, 2);
  expect(await state<{ slot: number }[]>(p, '(m) => m.g.casts.filter((c) => c.owner === 0)')).toMatchObject([{ slot: 0 }]);
  await run(p, grenade!.delay + 1);
  expect(await state<number>(p, `(m) => m.g.ents.find((e) => e.owner === 1 && e.kind === ${K.Jugger})?.hp ?? 0`)).toBeLessThanOrEqual(target.hp - abilityPower(grenade!, 1));
  expect(await state<boolean>(p, "(m) => m.fx.some((f) => f.t === 'blast')")).toBe(true);
  await p.evaluate((kind) => { const m = (window as Any).__fh; for (const e of m.g.ents) if (e.owner === 1 && e.kind === kind) e.hp = 0; }, K.Jugger);
  // It has to cool before the next one.
  await button.tap();
  await expect(p.locator('.toast').filter({ hasText: `${grenade!.name} is not ready yet` })).toBeVisible();
  expect(await state<number>(p, '(m) => m.aim.value')).toBe(-1);
  // A tap beyond the ring lands at the end of its reach, on the way there.
  await run(p, grenade!.cd);
  await button.tap();
  const far = await state<{ x: number; y: number }>(p, '(m) => { const h = m.hero(); m.cam.zoom = 12; m.clampCam(); return m.toScreen(h.x + 10 * 256, h.y - 6 * 256); }');
  await p.touchscreen.tap(far.x, far.y);
  await run(p, 2);
  const thrown = await state<{ d: number }>(p, '(m) => { const h = m.hero(), c = m.g.casts.find((c) => c.owner === 0); return { d: Math.hypot(c.x - h.x, c.y - h.y) }; }');
  expect(thrown.d).toBeLessThanOrEqual(grenade!.range);
  expect(thrown.d).toBeGreaterThan(grenade!.range - TILE);
  // At level 6 the other two are open: Rally needs no aim, Air strike does.
  await level(p, 6);
  await p.getByRole('button', { name: rally!.name }).tap();
  expect(await state<number>(p, '(m) => m.aim.value')).toBe(-1);
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.owner === 0 && e.haste > m.g.tick).length')).toBeGreaterThan(3);
  await p.getByRole('button', { name: strike!.name }).tap();
  await expect(p.locator('.bar.place')).toContainText(strike!.name);
  const near = await state<{ x: number; y: number }>(p, '(m) => { const h = m.hero(); return m.toScreen(h.x + 3 * 256, h.y - 3 * 256); }');
  await p.touchscreen.tap(near.x, near.y);
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.g.players[0].cds[2] - m.g.tick')).toBeGreaterThan(strike!.cd - 10);
  await p.evaluate(() => { (window as Any).__fh.paused.value = false; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: info.outputPath('frenzy-strike.png') });
  await noSmallButtons(p);
});

test('the Alpha pounces where it is pointed, roars, and calls the pack', async ({ page: p }, info) => {
  await start(p, FRENZY_DINO);
  await run(p, 60);
  const [pounce, roar, pack] = ABILITIES[K.Alpha]!;
  await expect(p.getByRole('button', { name: 'Your Alpha' })).toBeVisible();
  await level(p, 6);
  // Pounce: the Alpha lands where the tap was.
  const at = { x: 13.5 * TILE, y: 49.5 * TILE };
  const spot = await state<{ x: number; y: number }>(p, `(m) => { const h = m.hero(); m.cam.x = h.x; m.cam.y = h.y; m.cam.zoom = 20; m.clampCam(); return m.toScreen(${at.x}, ${at.y}); }`);
  await p.getByRole('button', { name: pounce!.name }).tap();
  await expect(p.locator('.bar.place')).toContainText(pounce!.name);
  await p.touchscreen.tap(spot.x, spot.y);
  await run(p, pounce!.delay + 3);
  expect(await state<boolean>(p, `(m) => { const h = m.hero(); return Math.hypot(h.x - ${at.x}, h.y - ${at.y}) < 1.5 * 256; }`)).toBe(true);
  // The roof of its own Nest is no place to land.
  await run(p, pounce!.cd);
  await p.getByRole('button', { name: pounce!.name }).tap();
  const wall = await state<{ x: number; y: number }>(p, '(m) => { m.cam.x = 12 * 256; m.cam.y = 50 * 256; m.clampCam(); return m.toScreen(9.5 * 256, 53.5 * 256); }');
  await p.touchscreen.tap(wall.x, wall.y);
  await expect(p.locator('.toast').filter({ hasText: "Can't land there" })).toBeVisible();
  expect(await state<number>(p, '(m) => m.aim.value')).toBe(0);
  await p.getByRole('button', { name: 'Cancel aiming' }).tap();
  // Roar: whoever is near stands stunned.
  await p.evaluate((kind) => { const m = (window as Any).__fh, h = m.hero(); for (let i = 0; i < 3; i++) m.debugSpawn(kind, 2, h.x / 256 + 2 + i * 0.9, h.y / 256 - 1.5); m.refresh(); }, K.Tank);
  await p.getByRole('button', { name: roar!.name }).tap();
  await run(p, 2);
  expect(await state<number>(p, '(m) => m.g.ents.filter((e) => e.owner === 2 && e.daze > m.g.tick).length')).toBe(3);
  // Call the Pack: Raptors that stay a while and take no supply.
  const supply = await state<number>(p, '(m) => m.g.players[0].supply');
  await p.getByRole('button', { name: pack!.name }).tap();
  await run(p, 3);
  const called = await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.kind === ${K.Raptor} && e.ttl > 0).length`);
  expect(called).toBe(abilityPower(pack!, 6));
  expect(await state<number>(p, '(m) => m.g.players[0].supply')).toBeLessThanOrEqual(supply + 2);
  await p.evaluate(() => { (window as Any).__fh.paused.value = false; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: info.outputPath('frenzy-pack.png') });
  await noSmallButtons(p);
  await run(p, pack!.time + 5);
  expect(await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.kind === ${K.Raptor} && e.ttl > 0).length`)).toBe(0);
});

test('two groups in Frenzy: split the army in the organiser; the hero stays its own', async ({ page: p }, info) => {
  await start(p, FRENZY_GREEN);
  await run(p, 400);
  const all = await state<number>(p, '(m) => m.hud.value.groups[0].count');
  expect(all).toBeGreaterThanOrEqual(6);
  await hold(p, '[data-group="0"]');
  await expect(p.locator('.sheet.org')).toBeVisible();
  await expect(p.locator('.sheet.org .gcard')).toHaveCount(2);
  await expect(p.locator('.sheet.org')).not.toContainText('Captain');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-groups.png') });
  await p.evaluate(() => { const m = (window as Any).__fh; m.assignPart(0, 1, 0, 3); });
  await run(p, 2);
  expect(await state<number[]>(p, '(m) => m.hud.value.groups.slice(0, 2).map((g) => g.count)')).toEqual([all - 3, 3]);
  // Nothing can be put in with the hero.
  await p.evaluate((g) => { const m = (window as Any).__fh; m.issue({ t: 'assign', p: 0, from: 0, to: g, kind: 0, count: 2 }); }, FRENZY.heroGroup);
  await run(p, 2);
  expect(await state<number>(p, `(m) => m.g.ents.filter((e) => e.owner === 0 && e.group === ${FRENZY.heroGroup}).length`)).toBe(1);
});

test('every hero and all four colours are drawn, near and far, with abilities going off and nothing going wrong', async ({ page: p }, info) => {
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await start(p, FRENZY_GREEN);
  await run(p, 30);
  await p.evaluate(({ green, dino }) => {
    const m = (window as Any).__fh;
    for (const pl of m.g.players) pl.explored.fill(1);
    // A little of everything, for every side, in the open ground by the middle.
    for (let o = 0; o < 4; o++) {
      const kinds = o % 2 === 0 ? green : dino;
      const cx = 31.5 + [-5, -5, 5, 5][o]!, cy = 31.5 + [5, -5, -5, 5][o]!;
      kinds.forEach((k: number, i: number) => m.debugSpawn(k, o, cx + (i % 4) * 1.3 - 2, cy + Math.floor(i / 4) * 1.3 - 1));
    }
    // The player's hero joins them, at a level with everything open.
    const h = m.hero(), pl = m.g.players[0];
    h.x = h.px = 27 * 256; h.y = h.py = 35 * 256; pl.heroLvl = 7; h.lvl = 7; h.hp = 900;
    m.cam.x = 31.5 * 256; m.cam.y = 31.5 * 256; m.cam.zoom = 20; m.clampCam();
    m.refresh();
  }, { green: frenzyUnits('green'), dino: frenzyUnits('dino') });
  await run(p, 3);
  await p.evaluate(() => {
    const m = (window as Any).__fh, h = m.hero();
    m.issue({ t: 'cast', p: 0, slot: 0, x: h.x + 3 * 256, y: h.y - 3 * 256 });
    m.issue({ t: 'cast', p: 0, slot: 1, x: h.x, y: h.y });
    m.issue({ t: 'cast', p: 0, slot: 2, x: h.x + 5 * 256, y: h.y - 5 * 256 });
    m.paused.value = false;
  });
  await p.waitForTimeout(1300);
  await p.screenshot({ path: info.outputPath('frenzy-battle.png') });
  expect(await state<boolean>(p, "(m) => m.fx.some((f) => f.t === 'blast' || f.t === 'cast')")).toBe(true);
  await p.evaluate(() => { const m = (window as Any).__fh; m.cam.zoom = 6; m.clampCam(); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: info.outputPath('frenzy-far.png') });
  await p.evaluate(() => { const m = (window as Any).__fh; m.cam.zoom = 44; m.clampCam(); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: info.outputPath('frenzy-near.png') });
  expect(errors).toEqual([]);
});

test('an idle player is knocked out and the round ends with placings; at 10:00 overtime starts and bases crumble', async ({ page: p }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await start(p, FRENZY_GREEN);
  // Do nothing at all: the others should come, and the round should end one way or another.
  const ended = await p.evaluate(() => {
    const m = (window as Any).__fh;
    for (let i = 0; i < 14000 && m.over.value < 0; i++) m.tick();
    return { tick: m.g.tick, over: m.over.value, outcome: m.outcome.value, out: m.g.players.map((pl: Any) => pl.out), hit: m.g.players[0].stats.firstAttackTick };
  });
  expect(ended.over).toBeGreaterThanOrEqual(0);
  expect(ended.hit).toBeGreaterThan(0);
  expect(ended.hit).toBeLessThan(6000);
  expect(ended.out[0]).toBe(true);
  const title = ['', 'Victory', 'Second place', 'Third place', 'First out'][ended.outcome.place]!;
  await expect(p.getByRole('heading', { name: title })).toBeVisible();
  await expect(p.locator('.sheet.end tr[data-side]')).toHaveCount(4);
  await expect(p.locator('.sheet.end tr[data-side="0"]')).toContainText('You');
  await expect(p.locator('.sheet.end tr[data-side="0"]')).toContainText('Out');
  await expect(p.locator('.sheet.end .small')).toContainText('Tan went for');
  await noSmallButtons(p);
  const sheet = (await p.locator('.sheet.end').boundingBox())!;
  expect(sheet.y).toBeGreaterThanOrEqual(0);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(await p.evaluate(() => innerHeight) + 0.5);
  await p.screenshot({ path: info.outputPath('frenzy-result.png') });
  await p.getByRole('button', { name: 'Play again' }).tap();
  await p.waitForFunction(() => (window as Any).__fh.g.tick < 50 && (window as Any).__fh.g.mode === 'frenzy');
  // The same round again, with a base that cannot be knocked down before overtime: at 10:00 it starts to
  // crumble, and the top bar says so. (That holding the middle spares a base is proved in the rules tests.)
  await start(p, FRENZY_GREEN);
  await p.evaluate((hp) => {
    const m = (window as Any).__fh;
    for (let i = 0; i < 5990; i++) {
      const hall = m.g.ents.find((e: Any) => e.owner === 0 && e.lvl > 0 && e.kind === 20);
      if (hall) hall.hp = hp;
      m.tick();
    }
  }, FRENZY.hallHp);
  expect(await state<number>(p, '(m) => m.over.value')).toBe(-1);
  await run(p, 12);
  await expect(p.locator('.pace.ot')).toHaveText('Overtime');
  await expect(p.locator('.toast').filter({ hasText: 'Overtime' })).toBeVisible();
  await run(p, 100);
  const crumbled = await state<number>(p, '(m) => m.g.ents.find((e) => e.owner === 0 && e.kind === 20).hp');
  expect(crumbled).toBeLessThanOrEqual(FRENZY.hallHp - 9 * FRENZY.crumble);
  await expect(p.locator('[data-stat="base"]')).not.toHaveText('100%');
  await noSmallButtons(p);
  await p.screenshot({ path: info.outputPath('frenzy-overtime.png') });
  expect(errors).toEqual([]);
});
