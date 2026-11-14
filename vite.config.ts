import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Relative base so the same build works on GitHub Pages (/foothold/) and inside a future app-store wrapper.
const commit = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
})();

export default defineConfig({
  base: './',
  define: {
    __BUILD__: JSON.stringify({ commit, date: new Date().toISOString().slice(0, 10) }),
  },
  plugins: [
    preact(),
    VitePWA({
      // The player decides when to reload, so an update never interrupts a match.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: './',
        name: 'Foothold',
        short_name: 'Foothold',
        description: 'A real-time strategy game of toy soldiers on a paper map.',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#4b3a2b',
        theme_color: '#4b3a2b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2020', sourcemap: true },
});
