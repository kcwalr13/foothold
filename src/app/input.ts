// Touch on the battlefield: one finger drags the map, two fingers pinch to zoom, a tap selects or orders.
import { def } from '../sim/data';
import { TILE } from '../sim/types';
import type { Match } from './match';

interface Pt { x: number; y: number }

export function attachInput(canvas: HTMLCanvasElement, m: Match): () => void {
  const pts = new Map<number, Pt>();
  let start: (Pt & { t: number; moved: boolean; ghost: boolean; ox: number; oy: number }) | null = null;
  let pinch = 0;
  let mid: Pt | null = null;

  const at = (e: PointerEvent): Pt => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onGhost = (p: Pt): { ox: number; oy: number } | null => {
    const pl = m.placing.value;
    if (!pl) return null;
    const w = m.toWorld(p.x, p.y);
    const size = def(pl.kind).size, pad = 16 / m.cam.zoom;
    const tx = w.x / TILE, ty = w.y / TILE;
    if (tx < pl.tx - pad || ty < pl.ty - pad || tx > pl.tx + size + pad || ty > pl.ty + size + pad) return null;
    return { ox: tx - pl.tx, oy: ty - pl.ty };
  };

  const down = (e: PointerEvent) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    const p = at(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1) {
      const gh = onGhost(p);
      start = { ...p, t: performance.now(), moved: false, ghost: gh !== null, ox: gh?.ox ?? 0, oy: gh?.oy ?? 0 };
    } else {
      if (start) start.moved = true;
      const [a, b] = [...pts.values()] as [Pt, Pt];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };

  const move = (e: PointerEvent) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const p = at(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1 && start) {
      if (!start.moved && Math.hypot(p.x - start.x, p.y - start.y) > 9) start.moved = true;
      if (!start.moved) return;
      if (start.ghost) {
        const w = m.toWorld(p.x, p.y);
        m.movePlace(Math.round(w.x / TILE - start.ox), Math.round(w.y / TILE - start.oy));
      } else {
        m.panBy(p.x - prev.x, p.y - prev.y);
      }
    } else if (pts.size >= 2) {
      const [a, b] = [...pts.values()] as [Pt, Pt];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch > 0 && d > 0) m.zoomAt(c.x, c.y, d / pinch);
      if (mid) m.panBy(c.x - mid.x, c.y - mid.y);
      pinch = d;
      mid = c;
    }
  };

  const up = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1 && start && !start.moved && performance.now() - start.t < 650) {
      const w = m.toWorld(p.x, p.y);
      m.tap(w.x, w.y);
    }
    pts.delete(e.pointerId);
    pinch = 0;
    mid = null;
    if (pts.size === 1) {
      const [q] = [...pts.values()] as [Pt];
      start = { ...q, t: 0, moved: true, ghost: false, ox: 0, oy: 0 };
    } else if (pts.size === 0) {
      start = null;
    }
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    m.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('wheel', wheel);
  };
}
