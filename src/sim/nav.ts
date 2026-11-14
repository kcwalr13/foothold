// Movement grid and flow fields. A flow field is the walking distance from every tile to a goal;
// every unit heading for the same goal shares one, so pathfinding stays cheap with hundreds of units.
import { TILE } from './types';

export const INF = 0xffff;

/** Whole-number square root. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export function dist(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  return isqrt(dx * dx + dy * dy);
}

const NX = [1, -1, 0, 0, 1, 1, -1, -1];
const NY = [0, 0, 1, -1, 1, -1, 1, -1];

export class Nav {
  /** 1 where a tile can't be walked: terrain, buildings or piles. */
  readonly blocked: Uint8Array;
  version = 1;
  private cache = new Map<number, { v: number; d: Uint16Array }>();
  private heap: number[] = [];

  constructor(readonly w: number, readonly h: number, rock: Uint8Array) {
    this.blocked = rock.slice();
  }

  inside(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  isBlocked(tx: number, ty: number): boolean {
    return !this.inside(tx, ty) || this.blocked[ty * this.w + tx] === 1;
  }

  /** Blocked test for a point in sub-units. */
  blockedAt(x: number, y: number): boolean {
    return this.isBlocked(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  setRect(tx: number, ty: number, size: number, value: 0 | 1): void {
    for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) {
      if (this.inside(x, y)) this.blocked[y * this.w + x] = value;
    }
    this.version++;
  }

  private push(key: number): void {
    const a = this.heap;
    let i = a.length;
    a.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]! <= key) break;
      a[i] = a[p]!;
      i = p;
    }
    a[i] = key;
  }

  private pop(): number {
    const a = this.heap;
    const top = a[0]!;
    const last = a.pop()!;
    const n = a.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && a[c + 1]! < a[c]!) c++;
        if (a[c]! >= last) break;
        a[i] = a[c]!;
        i = c;
      }
      a[i] = last;
    }
    return top;
  }

  /**
   * Walking distance (10 per straight step, 14 per diagonal) from every tile to the nearest seed.
   * Seeds may sit on blocked tiles (a building's footprint); the field flows out from them.
   */
  field(key: number, seedsOf: () => readonly number[]): Uint16Array {
    const hit = this.cache.get(key);
    if (hit && hit.v === this.version) return hit.d;
    const seeds = seedsOf();
    if (this.cache.size > 400) this.cache.clear();
    const { w, h, blocked } = this;
    const d = hit ? hit.d : new Uint16Array(w * h);
    d.fill(INF);
    this.heap.length = 0;
    for (const s of seeds) {
      d[s] = 0;
      this.push(s);
    }
    while (this.heap.length > 0) {
      const top = this.pop();
      const cost = Math.floor(top / 8192), i = top % 8192;
      if (cost > d[i]!) continue;
      const x = i % w, y = (i - x) / w;
      for (let k = 0; k < 8; k++) {
        const nx = x + NX[k]!, ny = y + NY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (blocked[ni] === 1) continue;
        if (k >= 4 && (blocked[y * w + nx] === 1 || blocked[ny * w + x] === 1)) continue;
        const nc = cost + (k < 4 ? 10 : 14);
        if (nc < d[ni]!) {
          d[ni] = nc;
          this.push(nc * 8192 + ni);
        }
      }
    }
    this.cache.set(key, { v: this.version, d });
    return d;
  }

  /** The neighbouring tile one step closer to the goal, or -1 when there is none. */
  next(d: Uint16Array, tx: number, ty: number): number {
    const { w, h, blocked } = this;
    let best = -1;
    let bestCost = this.inside(tx, ty) ? d[ty * w + tx]! : INF;
    for (let k = 0; k < 8; k++) {
      const nx = tx + NX[k]!, ny = ty + NY[k]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (k >= 4 && (blocked[ty * w + nx] === 1 || blocked[ny * w + tx] === 1)) continue;
      // A blocked tile is only a valid step when it is the goal itself (cost 0).
      if (blocked[ni] === 1 && d[ni] !== 0) continue;
      const c = d[ni]! + (k < 4 ? 0 : 1);
      if (c < bestCost) {
        bestCost = c;
        best = ni;
      }
    }
    return best;
  }

  /** True when the straight line between two points crosses no blocked tile. The last `slack` sub-units are not checked. */
  los(x0: number, y0: number, x1: number, y1: number, slack: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const len = isqrt(dx * dx + dy * dy);
    const reach = len - slack;
    if (reach <= 0) return true;
    const n = Math.ceil(reach / (TILE / 2));
    for (let i = 1; i <= n; i++) {
      const t = Math.min(reach, i * (TILE / 2));
      const px = x0 + Math.trunc((dx * t) / len), py = y0 + Math.trunc((dy * t) / len);
      if (this.blockedAt(px, py)) return false;
    }
    return true;
  }

  /** The open tile nearest to a tile, searched in growing squares. Returns its index, or -1. */
  nearestOpen(tx: number, ty: number): number {
    const cx = Math.max(0, Math.min(this.w - 1, tx)), cy = Math.max(0, Math.min(this.h - 1, ty));
    if (!this.isBlocked(cx, cy)) return cy * this.w + cx;
    for (let r = 1; r < 24; r++) {
      let best = -1, bestD = 1 << 30;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (this.isBlocked(x, y)) continue;
        const dd = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (dd < bestD) {
          bestD = dd;
          best = y * this.w + x;
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
}
