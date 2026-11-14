import { defineConfig, devices } from '@playwright/test';

// Phone-sized, landscape, touch runs against the production build. WebKit isn't available in the
// build environment, so the iPhone profile runs in Chromium with iPhone dimensions, touch and scale;
// on GitHub's runners a WebKit project runs the same-match check as well.
// Set CHROME to a browser binary to use it in place of Playwright's own download.
const launchOptions = process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {};

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/', trace: 'retain-on-failure', launchOptions },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14 landscape'], browserName: 'chromium' } },
    { name: 'android', use: { ...devices['Pixel 7 landscape'], browserName: 'chromium' } },
    { name: 'small', use: { ...devices['Pixel 7 landscape'], browserName: 'chromium', viewport: { width: 740, height: 360 } } },
    // Safari's engine, where it is installed (GitHub's runners): only the same-match check, which is about the engine.
    ...(process.env.CI ? [{ name: 'webkit', testMatch: /same-match/, use: { ...devices['iPhone 14 landscape'] } }] : []),
  ],
});
