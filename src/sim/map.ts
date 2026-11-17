// Maps. Every map is symmetric: a two-sided map is its near side turned half a circle, a four-cornered one
// its first corner turned a quarter circle three times over.
import { TILE, type BaseSite, type GameMap } from './types';

const HQ_SIZE = 4;

/**
 * Twin Ridges: one short, narrow road through the middle (the Pass) and two long, open roads around it.
 * Player 0 starts bottom-left on a plateau with one ramp; player 1 starts top-right. Since M4 it is half as
 * wide and half as tall again as it was (144 by 72 tiles): the same shape, with more ground between things.
 * Each base is laid out about its Headquarters as before, so a load of Blocks is the same walk it always was.
 */
export function twinRidges(): GameMap {
  const w = 144, h = 72;
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
  // The main's plateau: cliffs above and to the right, with one ramp (rows 56 to 61) down to the natural.
  put(0, 46, 31, 47);
  put(30, 48, 31, 55);
  put(30, 62, 31, 71);
  for (let y = 48; y <= 71; y++) for (let x = 0; x <= 29; x++) set(high, x, y, 1);
  // The ridge north-west of the Pass; its twin sits south-east. A ridge is high ground inside a ring of cliff,
  // with one ramp on the side away from the Pass.
  const rx0 = 46, ry0 = 14, rx1 = 69, ry1 = 33;
  const onRidge = (x: number, y: number) => x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1
    && Math.min(x - rx0, rx1 - x) + Math.min(y - ry0, ry1 - y) >= 3;
  for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) {
    if (!onRidge(x, y)) continue;
    let inner = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!onRidge(x + dx, y + dy)) inner = false;
    if (inner) set(high, x, y, 1);
    else set(rock, x, y, 1);
  }
  for (let y = 22; y <= 25; y++) set(rock, rx0, y, 0);

  const near: Omit<BaseSite, 'id' | 'side'>[] = [
    { name: 'Main', tier: 0, hx: 6, hy: 56, cells: [{ tx: 6, ty: 62, amount: 2500 }], piles: [52, 54, 56, 58, 60, 62].map((ty) => ({ tx: 2, ty, amount: 1500 })) },
    { name: 'Natural', tier: 1, hx: 40, hy: 61, cells: [{ tx: 46, ty: 62, amount: 2500 }], piles: [36, 38, 40, 42, 44, 46].map((tx) => ({ tx, ty: 67, amount: 1500 })) },
    { name: 'Third', tier: 2, hx: 6, hy: 31, cells: [{ tx: 12, ty: 32, amount: 2500 }], piles: [27, 29, 31, 33, 35, 37].map((ty) => ({ tx: 2, ty, amount: 1500 })) },
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
  const towers = [{ tx: 71, ty: 6 }, { tx: w - 1 - 71, ty: h - 1 - 6 }];

  const flip = (pts: { x: number; y: number }[]) => pts.map((p) => ({ x: w - p.x, y: h - p.y }));
  const north = [{ x: 15, y: 9 }, { x: 40, y: 7.5 }, { x: 72, y: 6.5 }, { x: 88, y: 8 }];
  const west = [{ x: 44, y: 58 }, { x: 40, y: 44 }, { x: 20, y: 37 }, { x: 14, y: 14 }];
  const roads = [
    [{ x: 49, y: 58 }, { x: 66, y: 42 }, { x: 72, y: 36 }, { x: 78, y: 30 }, { x: 95, y: 14 }],
    north, flip(north), west, flip(west),
  ];
  const labels = [
    { text: 'The Pass', x: 72.9, y: 33.6, rot: -0.78 },
    { text: 'North Road', x: 52, y: 4.4, rot: -0.04 },
    { text: 'South Road', x: 92, y: 69.4, rot: -0.04 },
    { text: 'Watchtower', x: 71.6, y: 9.2, rot: 0.03, small: true },
    { text: 'Watchtower', x: 72.4, y: 63.4, rot: 0.03, small: true },
  ];
  return { name: 'Twin Ridges', seats: 2, w, h, rock, high, bases, towers, posts: [], roads, labels };
}

/** What every two-sided map is made with: tiles set in pairs, one on each side, so the map is always fair. */
function halves(w: number, h: number) {
  const rock = new Uint8Array(w * h), high = new Uint8Array(w * h);
  const set = (a: Uint8Array, x: number, y: number, v: number) => {
    a[y * w + x] = v;
    a[(h - 1 - y) * w + (w - 1 - x)] = v;
  };
  /** Rock over a rectangle of tiles (and its twin); 0 clears it again. */
  const put = (x0: number, y0: number, x1: number, y1: number, v = 1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(rock, x, y, v);
  };
  /** High ground over a rectangle of tiles (and its twin). */
  const raise = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(high, x, y, 1);
  };
  /** The near side's bases, and their twins for the far side. */
  const sites = (near: Omit<BaseSite, 'id' | 'side'>[]): BaseSite[] => {
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
    return bases;
  };
  const flip = (pts: { x: number; y: number }[]) => pts.map((p) => ({ x: w - p.x, y: h - p.y }));
  const tower = (tx: number, ty: number) => [{ tx, ty }, { tx: w - 1 - tx, ty: h - 1 - ty }];
  return { rock, high, put, raise, sites, flip, tower };
}

/** Six piles of Blocks in a line, two tiles apart. */
const line = (from: number, fixed: number, across: boolean, amount = 1500) =>
  [0, 2, 4, 6, 8, 10].map((d) => (across ? { tx: from + d, ty: fixed, amount } : { tx: fixed, ty: from + d, amount }));

/**
 * Three Roads: the mains face each other across the middle of the map, each on a plateau whose ramp opens onto
 * the Middle Road, which forks around a hill half-way. Two ranges of hills shut it off from the North and South
 * Lanes, with one gap in the middle of each range and one beside each main: your own lane is a short walk from
 * home, the other side's only through the middle. Player 0 starts on the left.
 */
export function threeRoads(): GameMap {
  const w = 144, h = 72;
  const { rock, high, put, raise, sites, flip, tower } = halves(w, h);
  // The main's plateau, cliffs on three sides and the ramp (rows 33 to 38) opening east.
  put(0, 22, 27, 23);
  put(0, 48, 27, 49);
  put(26, 24, 27, 32);
  put(26, 39, 27, 47);
  raise(0, 24, 25, 47);
  // The ranges: the northern one runs from beside your main to beside theirs, a gap in its middle; the southern
  // one is its twin, so it leaves a gap beside their main instead.
  put(34, 20, 65, 23);
  put(78, 20, 115, 23);
  // The hill in the middle of the Middle Road.
  put(66, 30, 77, 41);
  put(68, 29, 75, 29);
  const bases = sites([
    { name: 'Main', tier: 0, hx: 6, hy: 33, cells: [{ tx: 6, ty: 39, amount: 2500 }], piles: line(29, 2, false) },
    { name: 'Natural', tier: 1, hx: 38, hy: 40, cells: [{ tx: 44, ty: 41, amount: 2500 }], piles: line(34, 46, true) },
    { name: 'Third', tier: 2, hx: 14, hy: 6, cells: [{ tx: 20, ty: 7, amount: 2500 }], piles: line(10, 2, true) },
    {
      name: 'Rich', tier: 3, hx: 54, hy: 6, cells: [{ tx: 60, ty: 7, amount: 3000 }, { tx: 48, ty: 7, amount: 3000 }],
      piles: [50, 52, 54, 56, 58, 60, 62, 64].map((tx) => ({ tx, ty: 2, amount: 1800 })),
    },
    // Just under your main, but only reached through the middle of the map: the enemy's way there is shorter.
    { name: 'Back corner', tier: 4, hx: 14, hy: 60, cells: [{ tx: 20, ty: 61, amount: 2500 }], piles: line(10, 66, true) },
  ]);
  const north = [{ x: 22, y: 14 }, { x: 50, y: 12 }, { x: 72, y: 11 }, { x: 96, y: 12 }, { x: 124, y: 14 }];
  const middle = [{ x: 28, y: 36 }, { x: 52, y: 38 }, { x: 64, y: 43 }, { x: 72, y: 44 }, { x: 80, y: 43 }, { x: 92, y: 38 }, { x: 116, y: 36 }];
  const roads = [north, flip(north), middle, flip(middle), [{ x: 31, y: 30 }, { x: 31, y: 18 }, { x: 22, y: 14 }], flip([{ x: 31, y: 30 }, { x: 31, y: 18 }, { x: 22, y: 14 }])];
  const labels = [
    { text: 'Middle Road', x: 50, y: 30.5, rot: 0 },
    { text: 'Middle Road', x: 94, y: 41.5, rot: 0 },
    { text: 'North Lane', x: 50, y: 4.6, rot: -0.03 },
    { text: 'South Lane', x: 94, y: 67.4, rot: -0.03 },
    { text: 'Watchtower', x: 72.6, y: 14.2, rot: 0.03, small: true },
    { text: 'Watchtower', x: 71.4, y: 58.4, rot: 0.03, small: true },
  ];
  return { name: 'Three Roads', seats: 2, w, h, rock, high, bases, towers: tower(71, 16), posts: [], roads, labels };
}

/**
 * Crossroads: the mains sit in opposite corners, top-left and bottom-right, each on a plateau with its ramp
 * facing down the map. The middle is open ground cut into a cross by four hills, a Watchtower on the road above
 * and below it. Five bases a side, the last two out in the open: a map for taking ground and holding it.
 */
export function crossroads(): GameMap {
  const w = 144, h = 72;
  const { rock, high, put, raise, sites, flip, tower } = halves(w, h);
  // The main's plateau in the top-left corner: a cliff to the east and to the south, the ramp (columns 12 to 17)
  // in the southern one.
  put(28, 0, 29, 23);
  put(0, 22, 11, 23);
  put(18, 22, 27, 23);
  raise(0, 0, 27, 21);
  // The four hills of the crossroads; the two set here and their twins.
  put(54, 20, 65, 29);
  put(56, 18, 63, 19);
  put(78, 22, 89, 30);
  put(80, 31, 87, 32);
  // A scatter of smaller rocks to walk round.
  put(40, 30, 43, 33);
  put(36, 50, 39, 52);
  put(98, 8, 101, 11);
  const bases = sites([
    { name: 'Main', tier: 0, hx: 6, hy: 8, cells: [{ tx: 6, ty: 14, amount: 2500 }], piles: line(4, 2, false) },
    { name: 'Natural', tier: 1, hx: 14, hy: 30, cells: [{ tx: 20, ty: 31, amount: 2500 }], piles: line(10, 36, true) },
    { name: 'Third', tier: 2, hx: 44, hy: 6, cells: [{ tx: 50, ty: 7, amount: 2500 }], piles: line(40, 2, true) },
    { name: 'Fourth', tier: 3, hx: 6, hy: 56, cells: [{ tx: 12, ty: 57, amount: 2500 }], piles: line(52, 2, false) },
    {
      name: 'Rich', tier: 4, hx: 58, hy: 60, cells: [{ tx: 64, ty: 61, amount: 3000 }, { tx: 52, ty: 61, amount: 3000 }],
      piles: [54, 56, 58, 60, 62, 64, 66, 68].map((tx) => ({ tx, ty: 66, amount: 1800 })),
    },
  ]);
  const across = [{ x: 15, y: 25 }, { x: 30, y: 34 }, { x: 52, y: 36 }, { x: 72, y: 36 }];
  const down = [{ x: 72, y: 36 }, { x: 72, y: 20 }, { x: 74, y: 6 }];
  const west = [{ x: 15, y: 25 }, { x: 10, y: 44 }, { x: 10, y: 54 }];
  const roads = [across, flip(across), down, flip(down), west, flip(west)];
  const labels = [
    { text: 'Crossroads', x: 72, y: 38.6, rot: 0 },
    { text: 'Watchtower', x: 71.6, y: 16.4, rot: 0.03, small: true },
    { text: 'Watchtower', x: 72.4, y: 56.2, rot: 0.03, small: true },
  ];
  return { name: 'Crossroads', seats: 2, w, h, rock, high, bases, towers: tower(71, 14), posts: [], roads, labels };
}

/** The Classic maps, in the order the menu offers them. */
export const CLASSIC_MAPS = [
  { id: 'twin', name: 'Twin Ridges', make: twinRidges },
  { id: 'roads', name: 'Three Roads', make: threeRoads },
  { id: 'cross', name: 'Crossroads', make: crossroads },
] as const;
export type MapId = (typeof CLASSIC_MAPS)[number]['id'];

export function classicMap(id: string): GameMap {
  return (CLASSIC_MAPS.find((m) => m.id === id) ?? CLASSIC_MAPS[0]).make();
}

/**
 * Four Corners, Frenzy's map: a square, the same seen from every corner. Side 0 starts bottom-left and the
 * others follow a quarter turn at a time: top-left, top-right, bottom-right. The ground is level everywhere. Each
 * base stands inside walls with one wide way out, facing the middle, with a Turret in line on either side of it
 * and two Collectors behind it, in the corner; a Watchtower stands on the middle tile.
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
  // The ground is level everywhere, but each base has walls. Side 0's corner is walled along its top and its
  // right side, and the two walls stop short of where they would meet: that gap, six tiles of each, is the
  // one way in and out, facing the middle. (The first build's cliffs, without the high ground behind them.)
  block(0, 46, 10, 46);
  block(16, 52, 16, 62);
  // A pillar on the way from each base to the middle splits the approach in two.
  block(22, 38, 24, 40);
  // An outcrop half-way along each edge, between neighbours: a narrow way along the edge, a wide one inside.
  block(28, 51, 34, 56);

  // Everything else is laid out for side 0, in the bottom-left corner, and turned for the rest. The base
  // sits inside its walls, on the line from its corner to the middle. Its two Turrets stand level with it, one either side,
  // on the line across. Its two Collectors stand behind it, between the base and the corner. The hero
  // waits in front.
  const hall = { tx: 6, ty: 53 };
  const turrets = [{ tx: 3, ty: 50 }, { tx: 11, ty: 58 }];
  const collectors = [{ tx: 1, ty: 57 }, { tx: 4, ty: 60 }];
  const hero = { x: 11 * TILE, y: 52 * TILE };
  const bases: BaseSite[] = [];
  const posts: GameMap['posts'] = [];
  let h = { x: hall.tx, y: hall.ty }, at = hero;
  let ts = turrets.map((q) => ({ x: q.tx, y: q.ty })), cs = collectors.map((q) => ({ x: q.tx, y: q.ty }));
  for (let side = 0; side < 4; side++) {
    bases.push({ id: side, name: 'Corner', side, tier: 0, hx: h.x, hy: h.y, piles: [], cells: [] });
    posts.push({ side, turrets: ts.map((q) => ({ tx: q.x, ty: q.y })), collectors: cs.map((q) => ({ tx: q.x, ty: q.y })), hero: at });
    h = turnTile(h.x, h.y, HQ_SIZE);
    ts = ts.map((q) => turnTile(q.x, q.y, 2));
    cs = cs.map((q) => turnTile(q.x, q.y, 2));
    at = turnPoint(at.x, at.y, s);
  }
  const towers = [{ tx: 31, ty: 31 }];

  let road = [{ x: 11.5, y: 51.5 }, { x: 21, y: 42 }, { x: 25.5, y: 41.5 }, { x: 29, y: 34 }];
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
