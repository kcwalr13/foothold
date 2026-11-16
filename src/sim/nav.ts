// Movement grid and flow fields. A flow field is the walking distance from every tile to a goal;
// every unit heading for the same goal shares one, so pathfinding stays cheap with hundreds of units.
import { TILE } from './types';

export const INF = 0xffff;
/** The heap holds cost and tile in one number, the tile in the low part: room for maps of up to 65536 tiles. */
const SLOT = 1 << 16;

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

// Neighbours in the order ties are settled: straight steps before diagonal ones, and within each kind an
// order that reads the same when the map is turned half a circle (east or west before south or north;
// south-east or north-west before north-east or south-west), so both sides walk mirror-image paths.
const NX = [1, -1, 0, 0, 1, -1, 1, -1];
const NY = [0, 0, 1, -1, 1, -1, -1, 1];
// The same order turned one, two and three quarter circles. On a four-cornered map each side settles its
// last ties in the order as seen from its own corner, so all four walk the same paths, each turned.
const TURNED: { x: number[]; y: number[] }[] = [{ x: NX, y: NY }];
for (let t = 1; t < 4; t++) {
  const was = TURNED[t - 1]!;
  TURNED.push({ x: was.y.map((v) => 0 - v), y: was.x.slice() });
}

export class Nav {
  /** 1 where a tile can't be walked: terrain, buildings or piles. */
  readonly blocked: Uint8Array;
  version = 1;
  private cache = new Map<number, { v: number; d: Uint16Array }>();
  private heap: number[] = [];

  constructor(readonly w: number, readonly h: number, rock: Uint8Array) {
    if (w * h > SLOT) throw new Error(`a ${w} by ${h} map is more tiles than the pathfinder has room for`);
    this.blocked = rock.slice();
  }

  inside(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  isBlocked(tx: number, ty: number): boolean {
    return !this.inside(tx, ty) || this.blocked[ty * this.w + tx] === 1;
  }

  /**
   * Blocked test for a point in sub-units. A point exactly on the line between two tiles counts as blocked
   * if either is: decided any other way, the line would belong to the tile on one fixed side of it, and the
   * two sides of the map would walk slightly different paths.
   */
  blockedAt(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (this.isBlocked(tx, ty)) return true;
    const onX = x % TILE === 0, onY = y % TILE === 0;
    if (onX && this.isBlocked(tx - 1, ty)) return true;
    if (onY && this.isBlocked(tx, ty - 1)) return true;
    return onX && onY && this.isBlocked(tx - 1, ty - 1);
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
      const cost = Math.floor(top / SLOT), i = top % SLOT;
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
          this.push(nc * SLOT + ni);
        }
      }
    }
    this.cache.set(key, { v: this.version, d });
    return d;
  }

  /**
   * The neighbouring tile one step closer to the goal, or -1 when there is none. When two are equally good
   * (the two ways round a building), the one whose middle is nearer to where the walker actually stands wins;
   * a walker dead in line with the building goes round on the side nearer the middle of the map. Either way a
   * unit and its mirror image on the far side of the map go round the same way.
   */
  next(d: Uint16Array, tx: number, ty: number, x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2, turn = 0): number {
    const { w, h, blocked } = this;
    const ox = TURNED[turn]!.x, oy = TURNED[turn]!.y;
    let best = -1, bestNear = Infinity, bestMid = Infinity;
    let bestCost = this.inside(tx, ty) ? d[ty * w + tx]! : INF;
    for (let k = 0; k < 8; k++) {
      const nx = tx + ox[k]!, ny = ty + oy[k]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (k >= 4 && (blocked[ty * w + nx] === 1 || blocked[ny * w + tx] === 1)) continue;
      // A blocked tile is only a valid step when it is the goal itself (cost 0).
      if (blocked[ni] === 1 && d[ni] !== 0) continue;
      const c = d[ni]! + (k < 4 ? 0 : 1);
      if (c > bestCost) continue;
      const cx = nx * TILE + TILE / 2, cy = ny * TILE + TILE / 2;
      const near = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      const mid = this.fromMiddle(cx, cy);
      if (c < bestCost || (best >= 0 && (near < bestNear || (near === bestNear && mid < bestMid)))) {
        bestCost = c;
        bestNear = near;
        bestMid = mid;
        best = ni;
      }
    }
    return best;
  }

  /** Where a tile comes in reading order on a square map turned back `turn` quarter circles. */
  private readingOrder(tx: number, ty: number, turn: number): number {
    for (let k = 0; k < turn; k++) [tx, ty] = [ty, this.w - 1 - tx];
    return ty * this.w + tx;
  }

  /** How far a point is from the middle of the map (squared): the last word when everything else is level. */
  private fromMiddle(x: number, y: number): number {
    const mx = x - (this.w * TILE) / 2, my = y - (this.h * TILE) / 2;
    return mx * mx + my * my;
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

  /**
   * The open tile whose middle is nearest to a point (in sub-units). When several are equally near,
   * as on every side of a square building asked for by its middle, the one nearest `from` wins:
   * an army sent at a building stops on the side it came from, whichever way it was walking. With
   * that level too, the one nearer the middle of the map wins. Returns the tile's index, or -1.
   *
   * `turn` is for a four-cornered map, where even that can leave two tiles level (a point on a diagonal of
   * the map): then the tile that comes first in reading order, read from the asker's own corner, wins, and
   * the search covers one ring more so that no tile is missed for standing on the far side of a line.
   */
  nearestOpenTo(x: number, y: number, fromX: number, fromY: number, turn?: number): number {
    const cx = Math.max(0, Math.min(this.w - 1, Math.floor(x / TILE))), cy = Math.max(0, Math.min(this.h - 1, Math.floor(y / TILE)));
    let best = -1, bestD = Infinity, bestF = Infinity, bestM = Infinity, bestK = Infinity;
    const slack = turn === undefined ? 1 : 2;
    for (let r = 0; r < 24; r++) {
      // A tile in ring r is at least r - 1 tiles away, so once a find is nearer than that, no later ring can beat it.
      if (best >= 0 && r >= slack && bestD < (r - slack) * TILE * ((r - slack) * TILE)) break;
      for (let ty = cy - r; ty <= cy + r; ty++) for (let tx = cx - r; tx <= cx + r; tx++) {
        if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) !== r) continue;
        if (this.isBlocked(tx, ty)) continue;
        const mx = tx * TILE + TILE / 2, my = ty * TILE + TILE / 2;
        const d = (mx - x) * (mx - x) + (my - y) * (my - y);
        const f = (mx - fromX) * (mx - fromX) + (my - fromY) * (my - fromY);
        const m = this.fromMiddle(mx, my);
        const k = turn === undefined ? 0 : this.readingOrder(tx, ty, turn);
        if (d < bestD || (d === bestD && (f < bestF || (f === bestF && (m < bestM || (m === bestM && k < bestK)))))) {
          bestD = d;
          bestF = f;
          bestM = m;
          bestK = k;
          best = ty * this.w + tx;
        }
      }
    }
    return best;
  }
}
