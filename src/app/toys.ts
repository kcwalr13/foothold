// The toy box: how every piece in the game is painted.
//
// A piece is painted once, in flat colours, onto a small canvas of its own. The toy box then gives it the look
// of moulded plastic (a soft dome of light, an ink outline all the way round) and keeps it, so a frame of the
// game is a few hundred stamps and not thousands of shapes. Nothing here is loaded: it is all drawn.

export type Ctx = CanvasRenderingContext2D;

/** One side's plastic: the colour it is moulded in, its shadow and highlight, and the ink that outlines it. */
export interface Team {
  fill: string;
  dark: string;
  light: string;
  /** The outline, and the darkest parts: gun barrels, treads, cave mouths. */
  ink: string;
  /** Flags and pennants: brighter than the plastic, so a base reads from across the map. */
  flag: string;
  /** A wash of the colour for ground that belongs to the side. */
  pale: string;
}

/**
 * You are green and the opponent is tan, whichever faction each plays. Frenzy seats two more: blue and red,
 * which with green and tan are the four colours of a board game.
 */
export const TEAM: readonly Team[] = [
  { fill: '#3fa23a', dark: '#2a7a2c', light: '#8fdc76', ink: '#143d18', flag: '#35c23b', pale: 'rgba(63,162,58,0.3)' },
  { fill: '#dc9638', dark: '#ab6a1f', light: '#f9d48d', ink: '#4f2c0a', flag: '#f08a1d', pale: 'rgba(220,150,56,0.34)' },
  { fill: '#4a8fe0', dark: '#2b65b0', light: '#a9d2fa', ink: '#102c57', flag: '#2f8df0', pale: 'rgba(74,143,224,0.3)' },
  { fill: '#dd5a50', dark: '#aa352e', light: '#f8b0a6', ink: '#551611', flag: '#ee3b30', pale: 'rgba(221,90,80,0.3)' },
];

/** Gold marks a hero, whichever side it is on: the rim of its base, the crest down its back. */
export const GOLD = '#f7c531';

export const PENCIL = '#3a2d20';
export const STEEL = '#2b2b2b';
export const IVORY = '#f8f1dc';
export const BLOCK_COLOURS = ['#d9463d', '#3b78c9', '#e9b730', '#3f9b57'] as const;

const TAU = Math.PI * 2;

/** Draws shapes in tiles, about the middle of the piece. Every call names its colour first. */
export class Pen {
  constructor(readonly x: Ctx) {}

  /** An oval. */
  o(c: string, cx: number, cy: number, rx: number, ry = rx, rot = 0): this {
    const x = this.x;
    x.fillStyle = c;
    x.beginPath();
    x.ellipse(cx, cy, Math.max(0.001, rx), Math.max(0.001, ry), rot, 0, TAU);
    x.fill();
    return this;
  }

  /** A box about its centre, its corners rounded by `r`, turned by `rot`. */
  b(c: string, cx: number, cy: number, w: number, h: number, r = 0, rot = 0): this {
    const x = this.x;
    x.fillStyle = c;
    if (rot !== 0) {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot);
      cx = 0;
      cy = 0;
    }
    const l = cx - w / 2, t = cy - h / 2, k = Math.min(r, w / 2, h / 2);
    x.beginPath();
    x.moveTo(l + k, t);
    x.arcTo(l + w, t, l + w, t + h, k);
    x.arcTo(l + w, t + h, l, t + h, k);
    x.arcTo(l, t + h, l, t, k);
    x.arcTo(l, t, l + w, t, k);
    x.closePath();
    x.fill();
    if (rot !== 0) x.restore();
    return this;
  }

  /** A closed shape with straight sides: x0, y0, x1, y1, ... */
  p(c: string, pts: readonly number[]): this {
    const x = this.x;
    x.fillStyle = c;
    x.beginPath();
    x.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i]!, pts[i + 1]!);
    x.closePath();
    x.fill();
    return this;
  }

  /** A closed shape with soft corners, pulled toward each point in turn: bodies, tails, hills. */
  s(c: string, pts: readonly number[]): this {
    const x = this.x, n = pts.length / 2;
    const mx = (i: number) => (pts[(i % n) * 2]! + pts[((i + 1) % n) * 2]!) / 2;
    const my = (i: number) => (pts[(i % n) * 2 + 1]! + pts[((i + 1) % n) * 2 + 1]!) / 2;
    x.fillStyle = c;
    x.beginPath();
    x.moveTo(mx(n - 1), my(n - 1));
    for (let i = 0; i < n; i++) x.quadraticCurveTo(pts[i * 2]!, pts[i * 2 + 1]!, mx(i), my(i));
    x.closePath();
    x.fill();
    return this;
  }

  /** A line through the points, `w` wide, with round ends. */
  l(c: string, w: number, pts: readonly number[]): this {
    const x = this.x;
    x.strokeStyle = c;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i]!, pts[i + 1]!);
    x.stroke();
    return this;
  }

  /** Inks round the shape just drawn: `.b(colour, ...).k(ink, 0.05)`. */
  k(c: string, w: number): this {
    const x = this.x;
    x.strokeStyle = c;
    x.lineWidth = w;
    x.stroke();
    return this;
  }

  /** A ring. */
  r(c: string, w: number, cx: number, cy: number, rad: number, from = 0, to = TAU): this {
    const x = this.x;
    x.strokeStyle = c;
    x.lineWidth = w;
    x.beginPath();
    x.arc(cx, cy, rad, from, to);
    x.stroke();
    return this;
  }
}

/** A finished piece: the picture, and its outline filled in black for the shadow it casts. */
export interface Sprite {
  /** The piece, cut down to the part that has paint on it. */
  img: HTMLCanvasElement;
  shade: HTMLCanvasElement;
  /** Sprite pixels to a tile. */
  u: number;
  /** The size the zoom asked for when it was painted; a different one now means it is due a repaint. */
  at: number;
  /** Where the piece's own middle sits in the picture, in sprite pixels: it turns about this point. */
  cx: number;
  cy: number;
}

/** Where the light falls: a dome for pieces that turn, from the top left for buildings, or not at all. */
export type Light = 'dome' | 'top' | 'flat';

function canvasOf(w: number, h = w): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tinted(src: HTMLCanvasElement, colour: string): HTMLCanvasElement {
  const c = canvasOf(src.width, src.height), x = c.getContext('2d')!;
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = colour;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * The part of a picture that has anything in it, as [left, top, width, height].
 * A piece is stamped hundreds of times a frame, and every empty pixel around it is paid for each time.
 */
function inked(c: HTMLCanvasElement): [number, number, number, number] {
  const w = c.width, h = c.height;
  const a = c.getContext('2d')!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0, i = 3; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      if (a[i] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return [0, 0, 1, 1];
  // One spare pixel all round, so a turned piece is smoothed against nothing rather than cut off.
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(w - 1, x1 + 1);
  y1 = Math.min(h - 1, y1 + 1);
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/**
 * Paints a piece in flat colours at `u` pixels to a tile, then finishes it the way every toy in the box is
 * finished: light from the top left, and an ink line all the way round.
 */
function finish(u: number, half: number, paint: (p: Pen) => void, ink: string, light: Light, line: number): HTMLCanvasElement {
  const pad = Math.ceil(line) + 2;
  const side = Math.ceil(half * 2 * u) + pad * 2;

  const raw = canvasOf(side), rx = raw.getContext('2d')!;
  rx.translate(side / 2, side / 2);
  rx.scale(u, u);
  rx.lineCap = 'round';
  rx.lineJoin = 'round';
  paint(new Pen(rx));
  rx.setTransform(1, 0, 0, 1, 0, 0);
  if (light !== 'flat') {
    // Moulded plastic catches the light on top and falls away at the edges.
    rx.globalCompositeOperation = 'source-atop';
    let wash: CanvasGradient;
    if (light === 'dome') {
      wash = rx.createRadialGradient(side / 2, side / 2, 0, side / 2, side / 2, side * 0.52);
      wash.addColorStop(0, 'rgba(255,255,255,0.2)');
      wash.addColorStop(0.55, 'rgba(255,255,255,0)');
      wash.addColorStop(1, 'rgba(0,0,0,0.2)');
    } else {
      wash = rx.createLinearGradient(side * 0.2, side * 0.1, side * 0.8, side * 0.9);
      wash.addColorStop(0, 'rgba(255,255,255,0.2)');
      wash.addColorStop(0.5, 'rgba(255,255,255,0)');
      wash.addColorStop(1, 'rgba(0,0,0,0.18)');
    }
    rx.fillStyle = wash;
    rx.fillRect(0, 0, side, side);
    rx.globalCompositeOperation = 'source-over';
  }

  const sil = tinted(raw, ink);
  const img = canvasOf(side), ix = img.getContext('2d')!;
  for (let i = 0; i < 12; i++) ix.drawImage(sil, Math.cos((i / 12) * TAU) * line, Math.sin((i / 12) * TAU) * line);
  ix.drawImage(raw, 0, 0);
  sil.width = 0;
  raw.width = 0;
  return img;
}

/** Zoom is continuous; pieces are painted at steps of about a fifth and stretched the little way between. */
const bucketOf = (z: number): number => Math.pow(2, Math.round(Math.log2(Math.max(4, z)) * 4) / 4);

/** How long, in milliseconds, one frame may spend repainting pieces for a new zoom. */
const REPAINT_MS = 4;

export class ToyBox {
  dpr = 1;
  private cache = new Map<string, Sprite>();
  /** The size pieces are painted at just now: sprite pixels to a tile, before the phone's own scale. */
  private current = 0;
  private spent = 0;

  /** Call once at the top of every frame: it settles the size to paint at and opens the frame's allowance. */
  begin(z: number): void {
    this.spent = 0;
    // Fingers wander while they pinch. A new size is taken only once the zoom is well clear of the old one,
    // so resting on the line between two sizes does not repaint everything back and forth.
    if (this.current === 0 || Math.abs(Math.log2(Math.max(4, z) / this.current)) > 0.17) this.current = bucketOf(z);
  }

  /**
   * The piece called `key`. `paint` draws it in tiles about its middle, inside a square reaching `half` tiles
   * each way; it runs only when the piece is not in the box at the size the zoom wants.
   *
   * Painting is the slow part, and a pinch asks for every piece on screen again at once. So a frame repaints
   * only what it has time for, and until its turn comes a piece is shown from the picture it already has,
   * stretched: a touch soft for a few frames, which nobody sees, in place of a stutter, which everybody does.
   */
  get(key: string, z: number, half: number, paint: (p: Pen) => void, ink: string = PENCIL, light: Light = 'dome'): Sprite {
    if (this.current === 0) this.begin(z);
    const b = this.current, at = b * this.dpr;
    const had = this.cache.get(key);
    if (had && (had.at === at || this.spent >= REPAINT_MS)) return had;

    const t0 = performance.now();
    let u = at;
    if (half * 2 * u > 760) u = 760 / (half * 2);
    // The outline is about a pixel on the phone at the usual zoom and thickens as you zoom in.
    const whole = finish(u, half, paint, ink, light, Math.max(1, Math.min(2.6, b * 0.055)) * (u / b));
    const [left, top, w, h] = inked(whole);
    const img = canvasOf(w, h);
    img.getContext('2d')!.drawImage(whole, -left, -top);
    const made: Sprite = { img, shade: tinted(img, '#000'), u, at, cx: whole.width / 2 - left, cy: whole.height / 2 - top };
    whole.width = 0;
    if (had) {
      had.img.width = 0;
      had.shade.width = 0;
    }
    this.cache.set(key, made);
    this.spent += performance.now() - t0;
    return made;
  }

  /** A piece on its own square of paper at a size of your choosing, for a button to show. */
  picture(across: number, half: number, paint: (p: Pen) => void, ink: string, light: Light, outline: number): HTMLCanvasElement {
    return finish(across / (half * 2), half, paint, ink, light, outline);
  }

  /** Stamps a piece about the origin of `x`, which the caller has moved and turned. */
  put(x: Ctx, s: Sprite, z: number, scale = 1): void {
    const k = (z / s.u) * scale;
    x.drawImage(s.img, -s.cx * k, -s.cy * k, s.img.width * k, s.img.height * k);
  }

  /** The shadow a piece casts: its own shape, in black. The caller sets how dark with `globalAlpha`. */
  cast(x: Ctx, s: Sprite, z: number, scale = 1): void {
    const k = (z / s.u) * scale;
    x.drawImage(s.shade, -s.cx * k, -s.cy * k, s.shade.width * k, s.shade.height * k);
  }
}

/** What the renderer remembers about one piece from frame to frame, so that it can move like a thing with weight. */
export interface Anim {
  /** The frame it was last drawn in. */
  stamp: number;
  /** When it first appeared, in milliseconds; pieces made in sight pop into place. */
  born: number;
  /** Where it was last frame, in tiles. */
  x: number;
  y: number;
  /** How far it has travelled, in tiles: legs and treads turn with this. */
  step: number;
  /** 0 standing, 1 moving, eased. */
  go: number;
  /** The way it is travelling, and the way its weapon points, in radians, both eased. */
  head: number;
  aim: number;
  hp: number;
  /** When it was last hurt, and when a building was finished. */
  hurt: number;
  done: number;
  built: boolean;
}

/** Turns angle `a` toward `b` by the short way round, `k` of the way. */
export function turn(a: number, b: number, k: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, k);
}

/** 0 → 1 → 0 over a shot's recoil: sharp out, slow back. */
export function kick(since: number, ms: number): number {
  if (since < 0 || since >= ms) return 0;
  const k = since / ms;
  return k < 0.18 ? k / 0.18 : 1 - (k - 0.18) / 0.82;
}

/** A rise from 0 to 1 that overshoots a little and settles: pieces popping onto the table. */
export function pop(k: number): number {
  if (k >= 1) return 1;
  if (k <= 0) return 0;
  const c = 1.70158, q = k - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
}

/** What a building painter needs to know about the building in front of it. */
export interface BuildingLook {
  kind: number;
  owner: number;
  /** Which way a Turret's gun points, and when it last fired. */
  aim: number;
  since: number;
  /** True while it is training or researching. */
  busy: boolean;
  /** A stable number for this building, so no two wave their flags in step. */
  seed: number;
  /** Eggs waiting in a Nest. */
  eggs: number;
  /** Just the piece itself, nothing moving: for plans, memories and work in progress. */
  plain: boolean;
}

/** What every painter is handed for a frame. */
export interface Stage {
  x: Ctx;
  toys: ToyBox;
  /** Pixels to a tile. */
  z: number;
  /** Milliseconds, from `performance.now()`. */
  now: number;
  /** When each piece last fired, by id. */
  fired: ReadonlyMap<number, number>;
  /** A pen on `x`, for shapes drawn fresh each frame (see `brush`). */
  pen: Pen;
}

/** Stamps a piece at a place on the screen, turned by `rot`. Call `home` when the piece is finished. */
export function stamp(st: Stage, s: Sprite, px: number, py: number, rot = 0, scale = 1): void {
  const d = st.toys.dpr, c = Math.cos(rot) * d, n = Math.sin(rot) * d;
  st.x.setTransform(c, n, -n, c, px * d, py * d);
  st.toys.put(st.x, s, st.z, scale);
}

/** The shadow of a piece on the paper: the same shape, a little down and to the right. */
export function shadow(st: Stage, s: Sprite, px: number, py: number, rot = 0, scale = 1, lift = 0.05, dark = 0.24): void {
  const d = st.toys.dpr, c = Math.cos(rot) * d, n = Math.sin(rot) * d;
  st.x.setTransform(c, n, -n, c, (px + st.z * lift * 0.8) * d, (py + st.z * lift) * d);
  const a = st.x.globalAlpha;
  st.x.globalAlpha = a * dark;
  // A faint shadow has no edge worth smoothing, and smoothing is the dear part of stamping a turned piece.
  st.x.imageSmoothingEnabled = false;
  st.toys.cast(st.x, s, st.z, scale);
  st.x.imageSmoothingEnabled = true;
  st.x.globalAlpha = a;
}

/** Moves the brush to a place and turns it, so plain shapes can be drawn in tiles about that place. */
export function brush(st: Stage, px: number, py: number, rot = 0): Pen {
  const d = st.toys.dpr, k = st.z * d, c = Math.cos(rot) * k, n = Math.sin(rot) * k;
  st.x.setTransform(c, n, -n, c, px * d, py * d);
  return st.pen;
}

/** Puts the brush back where the rest of the frame expects it. */
export function home(st: Stage): void {
  const d = st.toys.dpr;
  st.x.setTransform(d, 0, 0, d, 0, 0);
}

/** A burst of light at the end of a barrel. `k` runs 0 to 1 over the life of the flash. */
export function flash(st: Stage, px: number, py: number, rot: number, size: number, k: number): void {
  if (k >= 1) return;
  const p = brush(st, px, py, rot), s = size * (0.7 + 0.5 * k);
  st.x.globalAlpha = 1 - k * k;
  p.p('#ff9a2e', [s * 1.5, 0, s * 0.35, s * 0.42, -s * 0.1, s * 0.75, -s * 0.05, 0, -s * 0.1, -s * 0.75, s * 0.35, -s * 0.42]);
  p.o('#fff6c4', s * 0.3, 0, s * 0.42, s * 0.3);
  st.x.globalAlpha = 1;
}

/** Smoke drifting up and away, a puff at a time. */
export function smoke(st: Stage, px: number, py: number, size: number, seed: number, colour: string): void {
  const p = brush(st, px, py);
  for (let i = 0; i < 3; i++) {
    const k = (st.now / 1500 + seed * 0.37 + i / 3) % 1;
    st.x.globalAlpha = 0.5 * (1 - k) * Math.min(1, k * 6);
    p.o(colour, k * 0.5 * size + Math.sin(k * 5 + i) * 0.06, -k * 0.9 * size, (0.12 + k * 0.24) * size);
  }
  st.x.globalAlpha = 1;
}

/** A small fire, flickering. */
export function fire(st: Stage, px: number, py: number, size: number, seed: number): void {
  const p = brush(st, px, py), f = st.now / 85 + seed * 2.1;
  const h = (0.26 + 0.07 * Math.sin(f) + 0.04 * Math.sin(f * 2.3)) * size, w = (0.15 + 0.02 * Math.sin(f * 1.7)) * size;
  p.s('#e8531c', [-w, 0, -w * 0.7, -h * 0.5, Math.sin(f * 0.7) * w * 0.4, -h * 1.25, w * 0.7, -h * 0.5, w, 0, 0, w * 0.5]);
  p.s('#ffb52e', [-w * 0.6, 0, -w * 0.4, -h * 0.4, Math.sin(f * 0.9) * w * 0.3, -h * 0.85, w * 0.4, -h * 0.4, w * 0.6, 0, 0, w * 0.3]);
  p.o('#fff3b0', 0, -h * 0.12, w * 0.3, h * 0.2);
}
