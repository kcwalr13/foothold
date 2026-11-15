// Maps. Every map is symmetric: a two-sided map is its near side turned half a circle, a four-cornered one
// its first corner turned a quarter circle three times over.
import { TILE, type BaseSite, type GameMap } from './types';

const HQ_SIZE = 4;

/**
 * Twin Ridges: one short, narrow road through the middle (the Pass) and two long, open roads around it.
 * Player 0 starts bottom-left on a plateau with one ramp; player 1 starts top-right.
 */
export function twinRidges(): GameMap {
  const w = 96, h = 48;
  const rock = new Uint8Array(w * h);
  const high = new Uint8Array(w * h);
  /** Sets a tile and its twin on the far side of the map. */
  const set = (a: Uint8Array, x: number, y: number, v: number) => {
    a[y * w + x] = v;
    a[(h - 1 - y) * w + (w - 1 - x)] = v;
  };
  const put = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(rock, x, y, 1);
  };
  // The main's plateau: cliffs above and to the right, with one ramp (rows 37 to 40) down to the natural.
  put(0, 30, 24, 31);
  put(23, 32, 24, 36);
  put(23, 41, 24, 47);
  for (let y = 32; y <= 47; y++) for (let x = 0; x <= 22; x++) set(high, x, y, 1);
  // The ridge north-west of the Pass; its twin sits south-east. A ridge is high ground inside a ring of cliff,
  // with one ramp on the side away from the Pass.
  const rx0 = 30, ry0 = 10, rx1 = 45, ry1 = 22;
  const onRidge = (x: number, y: number) => x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1
    && Math.min(x - rx0, rx1 - x) + Math.min(y - ry0, ry1 - y) >= 2;
  for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) {
    if (!onRidge(x, y)) continue;
    let inner = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!onRidge(x + dx, y + dy)) inner = false;
    if (inner) set(high, x, y, 1);
    else set(rock, x, y, 1);
  }
  for (let y = 15; y <= 17; y++) set(rock, rx0, y, 0);

  const near: Omit<BaseSite, 'id' | 'side'>[] = [
    { name: 'Main', tier: 0, hx: 6, hy: 37, cells: [{ tx: 6, ty: 43, amount: 2500 }], piles: [33, 35, 37, 39, 41, 43].map((ty) => ({ tx: 2, ty, amount: 1500 })) },
    { name: 'Natural', tier: 1, hx: 30, hy: 40, cells: [{ tx: 36, ty: 41, amount: 2500 }], piles: [26, 28, 30, 32, 34, 36].map((tx) => ({ tx, ty: 46, amount: 1500 })) },
    { name: 'Third', tier: 2, hx: 6, hy: 21, cells: [{ tx: 12, ty: 22, amount: 2500 }], piles: [17, 19, 21, 23, 25, 27].map((ty) => ({ tx: 2, ty, amount: 1500 })) },
    {
      name: 'Rich', tier: 3, hx: 6, hy: 5, cells: [{ tx: 12, ty: 6, amount: 3000 }, { tx: 6, ty: 11, amount: 3000 }],
      piles: [
        ...[3, 5, 7, 9].map((ty) => ({ tx: 2, ty, amount: 1800 })),
        ...[5, 7, 9, 11].map((tx) => ({ tx, ty: 1, amount: 1800 })),
      ],
    },
  ];
  const bases: BaseSite[] = [];
  for (const b of near) bases.push({ ...b, id: bases.length, side: 0 });
  for (const b of near) {
    bases.push({
      ...b, id: bases.length, side: 1,
      hx: w - b.hx - HQ_SIZE, hy: h - b.hy - HQ_SIZE,
      piles: b.piles.map((p) => ({ tx: w - 1 - p.tx, ty: h - 1 - p.ty, amount: p.amount })),
      cells: b.cells.map((c) => ({ tx: w - 2 - c.tx, ty: h - 2 - c.ty, amount: c.amount })),
    });
  }
  // One watchtower on each long road, half-way along.
  const towers = [{ tx: 47, ty: 5 }, { tx: w - 1 - 47, ty: h - 1 - 5 }];

  const flip = (pts: { x: number; y: number }[]) => pts.map((p) => ({ x: w - p.x, y: h - p.y }));
  const north = [{ x: 13, y: 8 }, { x: 28, y: 5.5 }, { x: 48, y: 5 }, { x: 58, y: 6 }];
  const west = [{ x: 31, y: 39 }, { x: 27, y: 30 }, { x: 14, y: 24 }, { x: 10, y: 11 }];
  const roads = [
    [{ x: 33, y: 39 }, { x: 44, y: 28 }, { x: 48, y: 24 }, { x: 52, y: 20 }, { x: 63, y: 9 }],
    north, flip(north), west, flip(west),
  ];
  const labels = [
    { text: 'The Pass', x: 48.6, y: 22.2, rot: -0.78 },
    { text: 'North Road', x: 36, y: 3.4, rot: -0.05 },
    { text: 'South Road', x: 60, y: 45.4, rot: -0.05 },
    { text: 'Watchtower', x: 47.6, y: 7.6, rot: 0.03, small: true },
    { text: 'Watchtower', x: 48.4, y: 40.4, rot: 0.03, small: true },
  ];
  return { name: 'Twin Ridges', seats: 2, w, h, rock, high, bases, towers, posts: [], roads, labels };
}

/**
 * Four Corners, Frenzy's map: a square, the same seen from every corner. Side 0 starts bottom-left and the
 * others follow a quarter turn at a time: top-left, top-right, bottom-right. Each base sits on a corner
 * plateau with one wide way down, facing the middle; a Watchtower stands on the middle tile.
 */
export function fourCorners(): GameMap {
  const n = 63, s = n * TILE;
  const rock = new Uint8Array(n * n);
  const high = new Uint8Array(n * n);
  /** One quarter turn: a tile, the top-left tile of a square footprint, and a point in any unit that spans `span`. */
  const turnTile = (x: number, y: number, size = 1) => ({ x: n - size - y, y: x });
  const turnPoint = (x: number, y: number, span: number) => ({ x: span - y, y: x });
  /** Sets a tile and the three it turns into. */
  const set = (a: Uint8Array, x: number, y: number, v: number) => {
    for (let k = 0; k < 4; k++) {
      a[y * n + x] = v;
      ({ x, y } = turnTile(x, y));
    }
  };
  const block = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(rock, x, y, 1);
  };
  // Side 0's plateau fills the bottom-left corner. Cliffs run along its top and right edges and stop short
  // of where they would meet: that gap, six tiles of each, is the way down.
  for (let y = 47; y <= 62; y++) for (let x = 0; x <= 15; x++) set(high, x, y, 1);
  block(0, 46, 10, 46);
  block(16, 52, 16, 62);
  // A pillar on the way from each base to the middle splits the approach in two.
  block(22, 38, 24, 40);
  // An outcrop half-way along each edge, between neighbours: a narrow way along the edge, a wide one inside.
  block(28, 51, 34, 56);

  // Everything else is laid out for side 0 and turned for the rest.
  const hall = { tx: 6, ty: 53 };
  const turrets = [{ tx: 9, ty: 48 }, { tx: 13, ty: 52 }];
  const hero = { x: 11 * TILE, y: 52 * TILE };
  const bases: BaseSite[] = [];
  const posts: GameMap['posts'] = [];
  let h = { x: hall.tx, y: hall.ty }, ts = turrets.map((q) => ({ x: q.tx, y: q.ty })), at = hero;
  for (let side = 0; side < 4; side++) {
    bases.push({ id: side, name: 'Corner', side, tier: 0, hx: h.x, hy: h.y, piles: [], cells: [] });
    posts.push({ side, turrets: ts.map((q) => ({ tx: q.x, ty: q.y })), hero: at });
    h = turnTile(h.x, h.y, HQ_SIZE);
    ts = ts.map((q) => turnTile(q.x, q.y, 2));
    at = turnPoint(at.x, at.y, s);
  }
  const towers = [{ tx: 31, ty: 31 }];

  let road = [{ x: 16.5, y: 46.5 }, { x: 21, y: 42 }, { x: 25.5, y: 41.5 }, { x: 29, y: 34 }];
  let edge = [{ x: 17, y: 56 }, { x: 25, y: 59 }, { x: 31.5, y: 59.5 }, { x: 38, y: 59 }, { x: 46, y: 56 }];
  const roads: { x: number; y: number }[][] = [];
  const labels: GameMap['labels'] = [{ text: 'The Middle', x: 31.5, y: 28.4, rot: 0 }, { text: 'Watchtower', x: 31.5, y: 33.6, rot: 0, small: true }];
  for (let k = 0; k < 4; k++) {
    roads.push(road, edge);
    road = road.map((q) => turnPoint(q.x, q.y, n));
    edge = edge.map((q) => turnPoint(q.x, q.y, n));
  }
  return { name: 'Four Corners', seats: 4, w: n, h: n, rock, high, bases, towers, posts, roads, labels };
}
