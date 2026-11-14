import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App, updateReady } from './App';
import './style.css';

render(<App />, document.getElementById('app')!);

// Cache the whole game for offline play. A new version downloads quietly and waits for the menu.
// (Not inside a preview frame, where service workers are refused.)
const framed = window.self !== window.top;
if ('serviceWorker' in navigator && !framed && !new URLSearchParams(location.search).has('nosw')) {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() { updateReady.value = () => void update(true); },
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => { if (navigator.onLine) void reg.update(); }, 60 * 60 * 1000);
    },
  });
}

// Keep the page from scrolling, zooming or selecting under a thumb.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
