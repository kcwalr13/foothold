// What every touch test needs: a match started from a link and stopped, a way to run it tick by tick, a way
// to ask it questions, and the thumb-size check.
import { type Page, expect } from '@playwright/test';

export type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function start(p: Page, query = 'play=1&seed=7') {
  await p.goto(`./?nosw&${query}`);
  await p.waitForFunction(() => !!(window as Any).__fh);
  await p.evaluate(() => { (window as Any).__fh.paused.value = true; });
}
export const run = (p: Page, n: number) => p.evaluate((k) => {
  const m = (window as Any).__fh;
  for (let i = 0; i < k; i++) m.tick();
}, n);
export const state = <T>(p: Page, fn: string): Promise<T> => p.evaluate((f) => new Function('m', `return (${f})(m)`)((window as Any).__fh), fn);

export async function noSmallButtons(p: Page) {
  const small = await p.evaluate(() => [...document.querySelectorAll('button')]
    .map((el) => ({ label: el.getAttribute('aria-label') ?? el.textContent, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
    .map(({ label, r }) => `${label} ${Math.round(r.width)}×${Math.round(r.height)}`));
  expect(small).toEqual([]);
}

export async function hold(p: Page, selector: string, ms = 600) {
  const box = (await p.locator(selector).boundingBox())!;
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true };
  await p.locator(selector).dispatchEvent('pointerdown', at);
  await p.waitForTimeout(ms);
  await p.locator(selector).dispatchEvent('pointerup', at);
}
