// Renders the home-screen icons from one SVG design. Run: CHROME=/path/to/chrome node scripts/app-icons.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

/** A green toy soldier on its base, seen from above, on a scrap of paper map. `k` shrinks it for maskable icons. */
function design(k = 1) {
  const s = (v) => 256 + (v - 256) * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#f1e6c9"/>
  <path d="M-20 150 Q 180 90 300 170 T 540 120" fill="none" stroke="rgba(74,58,40,.35)" stroke-width="7" stroke-dasharray="26 20" stroke-linecap="round"/>
  <path d="M-20 420 Q 160 380 260 430 T 540 400" fill="none" stroke="rgba(74,58,40,.25)" stroke-width="7" stroke-dasharray="26 20" stroke-linecap="round"/>
  <rect x="${s(60)}" y="${s(56)}" width="${70 * k}" height="${70 * k}" fill="#d9463d" stroke="#3a2d20" stroke-width="${6 * k}"/>
  <rect x="${s(120)}" y="${s(84)}" width="${70 * k}" height="${70 * k}" fill="#3b78c9" stroke="#3a2d20" stroke-width="${6 * k}"/>
  <ellipse cx="${s(266)}" cy="${s(300)}" rx="${168 * k}" ry="${160 * k}" fill="rgba(0,0,0,.2)"/>
  <circle cx="${s(256)}" cy="${s(286)}" r="${164 * k}" fill="#2f6327"/>
  <ellipse cx="${s(246)}" cy="${s(286)}" rx="${86 * k}" ry="${104 * k}" fill="#4f9440"/>
  <path d="M${s(262)} ${s(346)} L${s(470)} ${s(318)}" stroke="#2b2b2b" stroke-width="${22 * k}" stroke-linecap="round"/>
  <circle cx="${s(268)}" cy="${s(286)}" r="${58 * k}" fill="#86c672"/>
  <circle cx="${s(250)}" cy="${s(268)}" r="${16 * k}" fill="rgba(255,255,255,.35)"/>
</svg>`;
}

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {});
const page = await browser.newPage();
async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  writeFileSync(join(out, file), await page.screenshot({ type: 'png' }));
}
await render(design(), 192, 'icon-192.png');
await render(design(), 512, 'icon-512.png');
await render(design(0.72), 512, 'icon-maskable-512.png');
await render(design(), 180, 'apple-touch-icon.png');
await browser.close();
console.log('icons written to public/icons');
