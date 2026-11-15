// The Dino Pack, painted: plastic dinosaurs seen from above, their eggs, and the sandbox pieces they live in.
// Like the Green Army they are moulded in their side's colour; unlike it they are all tails, strides and teeth.
import { def } from '../sim/data';
import { K, TILE, type Entity } from '../sim/types';
import { pennant } from './army';
import { BLOCK_COLOURS, IVORY, PENCIL, STEEL, brush, fire, home, kick, shadow, smoke, stamp, type Anim, type BuildingLook, type Ctx, type Pen, type Stage, type Team } from './toys';

const TAU = Math.PI * 2;
const ROCK = '#9d9382', ROCK_DARK = '#6d6355', ROCK_LIGHT = '#bcb3a0', MUD = '#5f4a35', MUD_LIGHT = '#7b6046', EARTH = '#8f6d44', EARTH_DARK = '#5d452b';
const WOOD = '#b98a52', WOOD_DARK = '#8d6336', STRAW = '#ecdca6', HAT = '#f7c531', SPIT = '#a5e84f', EYE = '#ffe45e', LAVA = '#f0561d', LAVA_HOT = '#ffc23d';

export const isDinoUnit = (kind: number): boolean => (kind >= K.Gatherer && kind <= K.Egg) || kind === K.Alpha;
export const isDinoBuilding = (kind: number): boolean => kind >= K.Nest && kind <= K.Volcano;

// ------------------------------------------------------------------ dinosaurs

/** How each dinosaur is put together: where its feet fall, where its tail starts, how it strides. */
interface Build {
  /** Half the side of the square its body is painted in, in tiles. */
  half: number;
  /** Feet, front to back: how far forward and how far out. Each is drawn on both sides. */
  feet: readonly (readonly [number, number])[];
  foot: number;
  /** The tail: where it leaves the body, how long, how wide at the root. */
  tail: readonly [number, number, number];
  /** Strides to a tile: small legs take more of them. */
  pace: number;
  /** How far it throws itself forward when it bites. */
  lunge: number;
}

const BUILD: Record<number, Build> = {
  [K.Gatherer]: { half: 0.42, feet: [[0.1, 0.14], [-0.1, 0.14]], foot: 0.055, tail: [-0.15, 0.2, 0.075], pace: 15, lunge: 0 },
  [K.Raptor]: { half: 0.56, feet: [[-0.03, 0.15]], foot: 0.08, tail: [-0.17, 0.44, 0.07], pace: 13, lunge: 0.13 },
  [K.Spitter]: { half: 0.56, feet: [[-0.04, 0.17]], foot: 0.085, tail: [-0.17, 0.34, 0.085], pace: 12, lunge: -0.05 },
  [K.Horn]: { half: 0.76, feet: [[0.14, 0.27], [-0.2, 0.27]], foot: 0.095, tail: [-0.3, 0.3, 0.12], pace: 8, lunge: 0.14 },
  [K.Bronto]: { half: 0.6, feet: [[0.22, 0.33], [-0.24, 0.33]], foot: 0.125, tail: [-0.38, 0.62, 0.14], pace: 5, lunge: 0 },
  [K.Rex]: { half: 0.6, feet: [[-0.04, 0.3]], foot: 0.15, tail: [-0.36, 0.62, 0.17], pace: 6, lunge: 0.1 },
  [K.Alpha]: { half: 0.74, feet: [[-0.04, 0.22]], foot: 0.11, tail: [-0.26, 0.58, 0.1], pace: 10, lunge: 0.16 },
};

/** The body of a dinosaur from above, facing right. Tails, necks and feet are drawn fresh each frame. */
function paintBody(p: Pen, t: Team, kind: number): void {
  switch (kind) {
    case K.Alpha:
      // A Raptor grown half as big again, with a crest of gold down its back: the leader of the pack.
      p.s(t.fill, [0.36, 0, 0.17, 0.165, -0.17, 0.165, -0.36, 0, -0.17, -0.165, 0.17, -0.165]);
      p.l(t.fill, 0.065, [0.15, 0.13, 0.3, 0.23]).l(t.fill, 0.065, [0.15, -0.13, 0.3, -0.23]);
      for (const sx of [-0.22, -0.09, 0.04]) p.l(t.dark, 0.06, [sx, -0.14, sx - 0.04, 0.14]);
      p.p(t.fill, [0.17, -0.115, 0.42, -0.13, 0.68, -0.065, 0.56, 0, 0.68, 0.065, 0.42, 0.13, 0.17, 0.115]);
      for (const side of [-1, 1]) {
        for (const tx of [0.5, 0.58]) p.p(IVORY, [tx - 0.025, side * 0.075, tx + 0.025, side * 0.07, tx + 0.005, side * 0.02]);
        p.o(EYE, 0.4, side * 0.075, 0.032).o(t.ink, 0.41, side * 0.075, 0.014);
      }
      p.p(HAT, [-0.3, 0, -0.2, -0.05, -0.12, 0, -0.02, -0.055, 0.07, 0, 0.17, -0.05, 0.26, 0, 0.17, 0.05, 0.07, 0, -0.02, 0.055, -0.12, 0, -0.2, 0.05]).k(t.ink, 0.02);
      break;
    case K.Gatherer:
      p.o(t.fill, -0.02, 0, 0.2, 0.145);
      p.o(t.fill, 0.2, 0, 0.115, 0.095);
      // A yellow harness, as a Worker has a yellow hat.
      p.b(HAT, -0.05, 0, 0.09, 0.3, 0.03).k(t.ink, 0.025);
      p.o(t.light, 0.24, 0, 0.05, 0.04);
      p.o(t.ink, 0.2, 0.06, 0.02).o(t.ink, 0.2, -0.06, 0.02);
      break;
    case K.Raptor:
      p.s(t.fill, [0.26, 0, 0.12, 0.11, -0.12, 0.11, -0.26, 0, -0.12, -0.11, 0.12, -0.11]);
      p.l(t.fill, 0.045, [0.1, 0.09, 0.2, 0.15]).l(t.fill, 0.045, [0.1, -0.09, 0.2, -0.15]);
      // A narrow head, jaws a little open.
      p.p(t.fill, [0.12, -0.075, 0.3, -0.085, 0.48, -0.04, 0.4, 0, 0.48, 0.04, 0.3, 0.085, 0.12, 0.075]);
      for (const sx of [-0.14, -0.04, 0.06]) p.l(t.dark, 0.045, [sx, -0.09, sx - 0.03, 0.09]);
      p.o(EYE, 0.3, 0.05, 0.022).o(EYE, 0.3, -0.05, 0.022);
      break;
    case K.Spitter: {
      p.s(t.fill, [0.22, 0, 0.12, 0.13, -0.12, 0.13, -0.26, 0, -0.12, -0.13, 0.12, -0.13]);
      // The frill that marks it out: a fan behind the head.
      const fan: number[] = [0.14, 0];
      for (let i = -5; i <= 5; i++) fan.push(0.14 + Math.cos((i / 5) * 1.95) * 0.27, Math.sin((i / 5) * 1.95) * 0.27);
      p.p(t.light, fan).k(t.ink, 0.035);
      for (const k of [-1.3, -0.65, 0, 0.65, 1.3]) p.l(t.dark, 0.025, [0.16, 0, 0.14 + Math.cos(k) * 0.25, Math.sin(k) * 0.25]);
      p.s(t.fill, [0.46, 0, 0.32, 0.09, 0.14, 0.075, 0.14, -0.075, 0.32, -0.09]).k(t.ink, 0.03);
      p.o(SPIT, 0.43, 0, 0.045);
      p.o(t.ink, 0.28, 0.05, 0.02).o(t.ink, 0.28, -0.05, 0.02);
      break;
    }
    case K.Horn:
      p.o(t.fill, -0.07, 0, 0.34, 0.26);
      p.o(t.dark, -0.14, 0, 0.2, 0.09);
      // The shield behind its head, and three horns.
      p.o(t.dark, 0.22, 0, 0.16, 0.34).k(t.ink, 0.04);
      p.o(t.light, 0.21, 0, 0.09, 0.26);
      p.o(t.fill, 0.4, 0, 0.17, 0.145).k(t.ink, 0.035);
      for (const side of [-1, 1]) p.l(t.ink, 0.11, [0.38, side * 0.1, 0.68, side * 0.16]).l(IVORY, 0.06, [0.38, side * 0.1, 0.68, side * 0.16]);
      p.l(t.ink, 0.1, [0.52, 0, 0.63, 0]).l(IVORY, 0.055, [0.52, 0, 0.63, 0]);
      p.o(t.ink, 0.44, 0.09, 0.022).o(t.ink, 0.44, -0.09, 0.022);
      break;
    case K.Bronto:
      p.o(t.fill, -0.04, 0, 0.46, 0.32);
      p.o(t.light, -0.04, 0, 0.3, 0.09);
      for (const [sx, sy, r] of [[-0.24, -0.16, 0.07], [0.02, -0.19, 0.06], [0.2, -0.13, 0.05], [-0.2, 0.17, 0.06], [0.06, 0.2, 0.07], [0.24, 0.13, 0.045]] as const) p.o(t.dark, sx, sy, r, r * 0.8);
      break;
    case K.Rex:
      p.o(t.fill, -0.06, 0, 0.42, 0.29);
      for (const sx of [-0.32, -0.16, 0.0]) p.l(t.dark, 0.08, [sx, -0.2, sx, 0.2]);
      p.l(t.fill, 0.055, [0.2, 0.24, 0.36, 0.31]).l(t.fill, 0.055, [0.2, -0.24, 0.36, -0.31]);
      break;
  }
}

/** A Rex's head, about the point it turns on: it is mostly jaw. */
function paintRexHead(p: Pen, t: Team): void {
  p.s(t.fill, [-0.1, -0.22, 0.26, -0.22, 0.56, -0.12, 0.58, 0, 0.56, 0.12, 0.26, 0.22, -0.1, 0.22, -0.16, 0]);
  for (const side of [-1, 1]) {
    for (const tx of [0.28, 0.37, 0.46]) p.p(IVORY, [tx - 0.03, side * 0.16, tx + 0.03, side * 0.16, tx, side * 0.235]).k(t.ink, 0.015);
    p.o(t.dark, 0.08, side * 0.13, 0.1, 0.055);
    p.o(EYE, 0.1, side * 0.13, 0.04).o(t.ink, 0.115, side * 0.13, 0.02);
    p.o(t.ink, 0.5, side * 0.045, 0.018);
  }
  p.l(t.dark, 0.03, [0.3, 0, 0.56, 0]);
}

/** A Bronto's head: small, at the end of a long neck. */
function paintBrontoHead(p: Pen, t: Team): void {
  p.o(t.fill, 0.04, 0, 0.13, 0.095);
  p.o(t.light, 0.08, 0, 0.06, 0.04);
  p.o(t.ink, 0.02, 0.06, 0.02).o(t.ink, 0.02, -0.06, 0.02);
}

/** A tapering shape that bends: tails, mostly. Inked down both sides but not across the root, so it joins the body. */
function taper(st: Stage, t: Team, from: number, len: number, wide: number, sway: number, colour: string): void {
  const x = st.x;
  x.beginPath();
  x.moveTo(from + wide, -wide);
  x.quadraticCurveTo(from - len * 0.55, -wide * 0.7 + sway * 0.35, from - len, sway);
  x.quadraticCurveTo(from - len * 0.55, wide * 0.7 + sway * 0.35, from + wide, wide);
  x.strokeStyle = t.ink;
  x.lineWidth = 0.05;
  x.stroke();
  x.fillStyle = colour;
  x.fill();
}

/** A curved limb of even width, inked: a Bronto's neck. */
function limb(x: Ctx, ink: string, colour: string, w: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): void {
  for (const [c, lw] of [[ink, w + 0.06], [colour, w]] as const) {
    x.strokeStyle = c;
    x.lineWidth = lw;
    x.beginPath();
    x.moveTo(x0, y0);
    x.quadraticCurveTo(cx, cy, x1, y1);
    x.stroke();
  }
}

function drawEgg(st: Stage, e: Entity, px: number, py: number, t: Team, size: number): void {
  const { z, toys, now } = st;
  const what = e.queue[0];
  const f = what ? Math.min(1, e.qprog / Math.max(1, def(what).time)) : 0;
  const big = (what && def(what).supply >= 4 ? 1.3 : 1) * size;
  const egg = toys.get(`d19${e.owner}`, z, 0.34, (p) => {
    p.o(IVORY, 0, 0, 0.2, 0.26);
    p.o(t.fill, -0.07, -0.1, 0.05).o(t.fill, 0.07, 0.01, 0.06).o(t.fill, -0.04, 0.13, 0.045).o(t.light, 0.06, -0.14, 0.03);
  }, t.ink);
  // It rocks harder the nearer it is to hatching, and gives a little jump at the end.
  const rock = Math.sin(now / (150 - f * 80) + e.id) * (0.05 + f * 0.2);
  const hop = f > 0.8 ? Math.abs(Math.sin(now / 90 + e.id)) * 0.06 * z : 0;
  shadow(st, egg, px, py, rock, big, 0.05);
  stamp(st, egg, px, py - hop, rock, big);
  if (f > 0.6) {
    const p = brush(st, px, py - hop, rock);
    const crack = [-0.14, -0.03, -0.06, 0.04, 0.0, -0.04, 0.07, 0.03];
    if (f > 0.85) crack.push(0.15, -0.03);
    p.l(PENCIL, 0.03, crack.map((v) => v * big));
  }
  home(st);
}

/** A dinosaur on the ground, or an egg that will be one. */
export function drawDinoUnit(st: Stage, e: Entity, px: number, py: number, an: Anim, t: Team, size: number): void {
  if (e.kind === K.Egg) {
    drawEgg(st, e, px, py, t, size);
    return;
  }
  const { x, z, toys, now } = st;
  const b = BUILD[e.kind]!;
  const body = toys.get(`d${e.kind}b${e.owner}`, z, b.half, (p) => paintBody(p, t, e.kind), t.ink);
  const since = now - (st.fired.get(e.id) ?? -1e9);
  // A bite is a lunge: out fast, back slow. A Spitter rears back instead.
  const jab = kick(since, e.kind === K.Bronto ? 420 : 240) * b.lunge;
  const phase = an.step * b.pace;
  const stride = Math.sin(phase) * an.go;
  const face = an.aim + stride * 0.07;
  const cos = Math.cos(face), sin = Math.sin(face);
  const cx = px + cos * jab * z, cy = py + sin * jab * z;
  // A stomp: the Bronto rises a little and comes down.
  const rear = e.kind === K.Bronto ? 1 + kick(since, 420) * 0.1 : 1;
  const s = size * rear;

  shadow(st, body, cx, cy, face, s, 0.07, 0.22);
  let p = brush(st, cx, cy, face);
  // Feet: front and back pairs stepping in turn.
  b.feet.forEach(([fx, fy], i) => {
    const step = (i % 2 === 0 ? stride : -stride) * b.foot * 1.1;
    p.o(t.dark, (fx + step) * s, fy * s, b.foot * s, b.foot * 0.66 * s).k(t.ink, 0.035);
    p.o(t.dark, (fx - step) * s, -fy * s, b.foot * s, b.foot * 0.66 * s).k(t.ink, 0.035);
  });
  const sway = an.go > 0.1 ? Math.sin(phase + 1) * b.tail[2] * 1.5 * an.go : Math.sin(now / 800 + e.id) * b.tail[2] * 0.5;
  stamp(st, body, cx, cy, face, s);
  p = brush(st, cx, cy, face);
  taper(st, t, b.tail[0] * s, b.tail[1] * s, b.tail[2] * s, sway * s, t.fill);

  if (e.kind === K.Gatherer) {
    if (e.carry > 0 && e.cargo === 1) p.o(STEEL, -0.05, 0, 0.12).o('#e98f1f', -0.05, 0, 0.085).o('#ffd27a', -0.03, -0.02, 0.03);
    else if (e.carry > 0) p.b(PENCIL, -0.05, 0, 0.25, 0.25, 0.03).b(BLOCK_COLOURS[e.id % 4]!, -0.05, 0, 0.19, 0.19, 0.02);
  } else if (e.kind === K.Bronto) {
    // The neck swings as it walks, and whips down when it stomps.
    const nod = an.go > 0.1 ? Math.sin(phase * 0.5) * 0.1 : Math.sin(now / 1100 + e.id) * 0.06;
    const hx = (0.92 - kick(since, 420) * 0.12) * s, hy = nod * 2.2 * s;
    limb(x, t.ink, t.fill, 0.17 * s, 0.34 * s, 0, 0.62 * s, nod * 0.6 * s, hx, hy);
    const head = toys.get(`d15h${e.owner}`, z, 0.24, (q) => paintBrontoHead(q, t), t.ink);
    const ha = face + Math.atan2(hy - nod * 0.6 * s, hx - 0.62 * s);
    stamp(st, head, cx + (cos * hx - sin * hy) * z, cy + (sin * hx + cos * hy) * z, ha, s);
  } else if (e.kind === K.Rex) {
    // The head swings a little as it walks and snaps forward when it bites.
    const head = toys.get(`d16h${e.owner}`, z, 0.66, (q) => paintRexHead(q, t), t.ink);
    const bite = kick(since, 240);
    const hx = (0.26 + bite * 0.12) * s, ha = face + stride * 0.1;
    stamp(st, head, cx + cos * hx * z, cy + sin * hx * z, ha, s * (1 + bite * 0.12));
  } else if (e.kind === K.Spitter && since < 160) {
    x.globalAlpha = 1 - since / 160;
    p.o(SPIT, 0.5 * s, 0, 0.08 * s);
    x.globalAlpha = 1;
  }
  home(st);
}

function paintPtero(p: Pen, t: Team): void {
  p.o(t.fill, -0.06, 0, 0.25, 0.09);
  // A long beak ahead and a crest swept back.
  p.p(t.light, [0.12, -0.03, -0.14, 0, 0.12, 0.03]);
  p.p(t.dark, [0.14, -0.065, 0.6, 0, 0.14, 0.065]).k(t.ink, 0.03);
  p.o(t.fill, 0.16, 0, 0.085, 0.075);
  p.o(EYE, 0.19, 0.045, 0.02).o(EYE, 0.19, -0.045, 0.02);
}

/** A Ptero on the wing: its shadow below it, wings beating. */
export function drawPtero(st: Stage, e: Entity, px: number, py: number, an: Anim, t: Team, size: number): void {
  const { x, z, toys, now } = st;
  const body = toys.get(`d14${e.owner}`, z, 0.68, (p) => paintPtero(p, t), t.ink);
  const since = now - (st.fired.get(e.id) ?? -1e9);
  const beat = Math.sin(now / 95 + e.id * 2.1), flap = 0.8 + 0.2 * beat;
  const a = an.aim, dive = kick(since, 220);
  const up = z * (0.2 + beat * 0.03 - dive * 0.12);
  const wings = (cx: number, cy: number, fill: string, ink: string | null) => {
    brush(st, cx, cy, a);
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(0.16 * size, s * 0.05 * size);
      x.quadraticCurveTo(0.22 * size, s * 0.4 * flap * size, -0.02 * size, s * 0.68 * flap * size);
      x.quadraticCurveTo(-0.12 * size, s * 0.36 * flap * size, -0.28 * size, s * 0.06 * size);
      x.closePath();
      if (ink) {
        x.strokeStyle = ink;
        x.lineWidth = 0.07;
        x.stroke();
      }
      x.fillStyle = fill;
      x.fill();
      if (ink) {
        // The bone along the front of each wing.
        x.strokeStyle = t.dark;
        x.lineWidth = 0.035;
        x.beginPath();
        x.moveTo(0.14 * size, s * 0.05 * size);
        x.quadraticCurveTo(0.2 * size, s * 0.38 * flap * size, -0.01 * size, s * 0.64 * flap * size);
        x.stroke();
      }
    }
  };
  x.globalAlpha = 0.2;
  wings(px + z * 0.22, py + z * 0.36, '#000', null);
  x.globalAlpha = 1;
  shadow(st, body, px + z * 0.22, py + z * 0.36, a, size * 0.95, 0, 0.2);
  wings(px, py - up, t.fill, t.ink);
  stamp(st, body, px + Math.cos(a) * dive * 0.1 * z, py - up + Math.sin(a) * dive * 0.1 * z, a, size);
  home(st);
}

/** A dinosaur lying where it fell: `k` runs 0 to 1 as it rolls onto its side and fades into the paper. */
export function drawDinoFallen(st: Stage, kind: number, owner: number, px: number, py: number, face: number, t: Team, k: number): void {
  const { x, z, toys } = st;
  if (kind === K.Egg) {
    // A broken egg: two halves of shell.
    const p = brush(st, px, py, face);
    x.globalAlpha = 1 - k * k;
    p.o(IVORY, -0.1 - k * 0.08, 0, 0.12, 0.16, -0.4).k(t.ink, 0.04).o(IVORY, 0.12 + k * 0.08, 0.02, 0.11, 0.14, 0.5).k(t.ink, 0.04);
    p.o(HAT, 0, 0, 0.07 * (1 - k));
    x.globalAlpha = 1;
    home(st);
    return;
  }
  const b = BUILD[kind];
  if (!b) return;
  const body = toys.get(`d${kind}b${owner}`, z, b.half, (p) => paintBody(p, t, kind), t.ink);
  const tip = Math.min(1, k * 4);
  x.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  const d = toys.dpr, a = face + 0.5 * tip, c = Math.cos(a) * d, n = Math.sin(a) * d, squash = 1 - 0.4 * tip;
  // On its side: narrower across, its legs sticking out one way.
  const p = brush(st, px, py, a);
  taper(st, t, b.tail[0], b.tail[1], b.tail[2] * squash, b.tail[2] * tip, t.fill);
  for (const [fx] of b.feet) p.l(t.ink, 0.1, [fx, 0, fx + 0.04, b.half * 0.62 * tip + 0.05]).l(t.dark, 0.055, [fx, 0, fx + 0.04, b.half * 0.62 * tip + 0.05]);
  x.setTransform(c, n, -n * squash, c * squash, px * d, py * d);
  toys.put(x, body, z);
  x.globalAlpha = 1;
  home(st);
}

/** The markers that stand for dinosaurs when the map is zoomed right out. */
export function drawDinoMarker(st: Stage, e: Entity, px: number, py: number, t: Team, face: number): void {
  const { x, z } = st;
  const r = Math.max(3.2, z * 0.4);
  const oval = (cx: number, cy: number, rx: number, ry: number) => {
    x.beginPath();
    x.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  };
  x.fillStyle = t.fill;
  x.strokeStyle = t.ink;
  x.lineWidth = 1.25;
  switch (e.kind) {
    case K.Gatherer:
      oval(px, py, Math.max(1.8, z * 0.22), Math.max(1.8, z * 0.22));
      x.fill();
      x.stroke();
      return;
    case K.Egg:
      x.fillStyle = IVORY;
      oval(px, py, r * 0.5, r * 0.65);
      x.fill();
      x.stroke();
      return;
    case K.Raptor: {
      // A small claw: two to an egg, so they come in crowds.
      const c = Math.cos(face), s = Math.sin(face);
      x.beginPath();
      x.moveTo(px + c * r * 1.05, py + s * r * 1.05);
      x.lineTo(px - c * r * 0.7 - s * r * 0.75, py - s * r * 0.7 + c * r * 0.75);
      x.lineTo(px - c * r * 0.25, py - s * r * 0.25);
      x.lineTo(px - c * r * 0.7 + s * r * 0.75, py - s * r * 0.7 - c * r * 0.75);
      x.closePath();
      x.fill();
      x.stroke();
      return;
    }
    case K.Spitter:
      oval(px, py, r * 0.9, r * 0.9);
      x.fill();
      x.stroke();
      x.fillStyle = SPIT;
      oval(px, py, r * 0.38, r * 0.38);
      x.fill();
      return;
    case K.Horn:
    case K.Bronto:
    case K.Rex: {
      const k = e.kind === K.Horn ? 1.05 : e.kind === K.Bronto ? 1.5 : 1.4;
      x.lineWidth = e.kind === K.Horn ? 1.8 : 2.6;
      oval(px, py, r * 1.3 * k, r * 0.85 * k);
      x.fill();
      x.stroke();
      x.fillStyle = e.kind === K.Rex ? t.ink : e.kind === K.Horn ? IVORY : t.light;
      oval(px, py, r * 0.5 * k, r * 0.32 * k);
      x.fill();
      return;
    }
    case K.Ptero:
      x.fillStyle = 'rgba(0,0,0,0.2)';
      oval(px + 3, py + 4, r * 0.9, r * 0.6);
      x.fill();
      for (const [w, c] of [[Math.max(4, r * 0.95), t.ink], [Math.max(2.2, r * 0.55), t.fill]] as const) {
        x.strokeStyle = c;
        x.lineWidth = w;
        x.beginPath();
        x.moveTo(px - r * 1.3, py - r * 0.5);
        x.lineTo(px, py + r * 0.5);
        x.lineTo(px + r * 1.3, py - r * 0.5);
        x.stroke();
      }
      return;
  }
}

// ------------------------------------------------------------------ buildings

/** A lumpy outline: the same lump every time for the same seed. */
function lump(cx: number, cy: number, rx: number, ry: number, seed: number, n = 10): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 0.94 + 0.1 * Math.sin(seed * 1.7 + i * 2.3) + 0.04 * Math.sin(seed + i * 5.1);
    pts.push(cx + Math.cos(a) * rx * k * 1.08, cy + Math.sin(a) * ry * k * 1.08);
  }
  return pts;
}

/** Pebbles painted in a side's colours, set round a piece. */
function stones(p: Pen, t: Team, rad: number, n: number, size: number, phase = 0, skipFrom = 9, skipTo = 9): void {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU;
    if (a % TAU > skipFrom && a % TAU < skipTo) continue;
    p.o(i % 2 === 0 ? t.light : IVORY, Math.cos(a) * rad, Math.sin(a) * rad, size, size * 0.8, a).k(t.ink, 0.03);
  }
}

function bolt(p: Pen, cx: number, cy: number, s: number): void {
  p.b(HAT, cx, cy, s, s, s * 0.16).k(PENCIL, 0.05);
  p.p(PENCIL, [cx + s * 0.12, cy - s * 0.38, cx - s * 0.22, cy + s * 0.08, cx, cy + s * 0.08, cx - s * 0.12, cy + s * 0.4, cx + s * 0.24, cy - s * 0.08, cx + s * 0.02, cy - s * 0.08]);
}

/** A sandbox piece from above, sitting on a mat of its side's colour. */
function paintBuilding(p: Pen, t: Team, kind: number): void {
  switch (kind) {
    case K.Nest: {
      // A wide ring of sticks round a bowl of straw. The eggs are put in afterwards.
      p.s(t.fill, lump(0, 0, 1.78, 1.78, 3, 12));
      p.s(t.dark, lump(0, 0, 1.52, 1.52, 5, 12));
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU, r = 1.26 + 0.1 * Math.sin(i * 2.7), tilt = a + Math.PI / 2 + Math.sin(i * 1.9) * 0.5;
        const sx = Math.cos(a) * r, sy = Math.sin(a) * r, dx = Math.cos(tilt) * 0.32, dy = Math.sin(tilt) * 0.32;
        p.l(PENCIL, 0.2, [sx - dx, sy - dy, sx + dx, sy + dy]).l(i % 3 === 0 ? WOOD_DARK : WOOD, 0.13, [sx - dx, sy - dy, sx + dx, sy + dy]);
      }
      p.o(STRAW, 0, 0, 0.98).k(PENCIL, 0.05).o('#f6ecc6', -0.04, -0.06, 0.66);
      // Leaves in the side's colour, tucked into the sticks.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.3;
        p.o(i % 2 ? t.light : t.fill, Math.cos(a) * 1.34, Math.sin(a) * 1.34, 0.22, 0.11, a + 0.9).k(t.ink, 0.035);
      }
      break;
    }
    case K.Dig: {
      // A pit dug down to the battery, and the charger beside it.
      p.s(t.fill, lump(0, 0, 0.9, 0.9, 2, 9));
      p.s(EARTH, lump(-0.08, -0.08, 0.66, 0.64, 4, 9)).k(PENCIL, 0.045);
      p.s(EARTH_DARK, lump(-0.12, -0.12, 0.42, 0.4, 6, 8));
      p.b(STEEL, -0.12, -0.12, 0.3, 0.44, 0.06).b('#e98f1f', -0.12, -0.08, 0.22, 0.3, 0.04).b(STEEL, -0.12, -0.36, 0.12, 0.06, 0.02).o('#ffd27a', -0.16, -0.14, 0.04, 0.1);
      bolt(p, 0.42, 0.42, 0.56);
      stones(p, t, 0.8, 7, 0.085, 2.4, 0.2, 1.4);
      break;
    }
    case K.Den: {
      // A rock with a mouth: claw marks in the side's colour across the top.
      p.s(t.fill, lump(0, 0, 1.32, 1.32, 7, 11));
      p.s(ROCK_DARK, lump(0, -0.06, 1.08, 1.04, 9, 11)).k(PENCIL, 0.05);
      p.s(ROCK, lump(-0.06, -0.16, 0.9, 0.84, 11, 10));
      p.s(ROCK_LIGHT, lump(-0.16, -0.3, 0.56, 0.46, 13, 8));
      p.s('#1f1711', [-0.5, 1.06, -0.44, 0.34, 0, 0.1, 0.44, 0.34, 0.5, 1.06, 0, 1.14]).k(PENCIL, 0.05);
      for (const dx of [-0.34, 0, 0.34]) p.l(t.ink, 0.17, [dx - 0.1, -0.7, dx + 0.1, -0.12]).l(t.fill, 0.1, [dx - 0.1, -0.7, dx + 0.1, -0.12]);
      stones(p, t, 1.2, 12, 0.1, 0.3, 1.1, 2.05);
      break;
    }
    case K.Wallow: {
      // A pool of mud with a trampled bank, reeds at the edge.
      p.s(t.fill, lump(0, 0, 1.32, 1.32, 4, 11));
      p.s(EARTH, lump(0, 0, 1.12, 1.08, 6, 11)).k(PENCIL, 0.05);
      p.s(MUD, lump(0, 0.02, 0.92, 0.86, 8, 10));
      p.s(MUD_LIGHT, lump(-0.12, -0.1, 0.56, 0.46, 10, 8));
      p.r('#8f7252', 0.035, 0.2, 0.22, 0.26).r('#8f7252', 0.03, -0.36, -0.2, 0.16);
      for (const [rx, ry, a] of [[-0.98, -0.5, -0.5], [-1.04, -0.3, -0.2], [0.9, 0.62, 0.7], [1.0, 0.44, 0.4], [0.2, -1.04, 1.4]] as const) {
        p.l(t.ink, 0.11, [rx, ry, rx + Math.cos(a) * 0.34, ry + Math.sin(a) * 0.34]).l(t.light, 0.06, [rx, ry, rx + Math.cos(a) * 0.34, ry + Math.sin(a) * 0.34]);
      }
      stones(p, t, 1.2, 10, 0.09, 1.0);
      break;
    }
    case K.Roost: {
      // A spire of rock, perches thrust through it, a small nest at the top.
      p.s(t.fill, lump(0, 0, 1.32, 1.32, 5, 11));
      p.s(t.dark, lump(0, 0, 1.06, 1.06, 6, 10));
      for (const [x0, y0, x1, y1] of [[-1.26, 0.52, 1.26, -0.46], [-0.6, -1.2, 0.5, 1.22]] as const) p.l(PENCIL, 0.18, [x0, y0, x1, y1]).l(WOOD, 0.11, [x0, y0, x1, y1]);
      p.s(ROCK_DARK, lump(0, 0, 0.84, 0.84, 5, 9)).k(PENCIL, 0.05);
      p.s(ROCK, lump(-0.05, -0.08, 0.62, 0.62, 7, 8));
      p.s(ROCK_LIGHT, lump(-0.1, -0.14, 0.4, 0.4, 9, 7));
      p.o(WOOD_DARK, -0.1, -0.14, 0.26).k(PENCIL, 0.04).o(STRAW, -0.1, -0.14, 0.17);
      p.o(IVORY, -0.15, -0.16, 0.055, 0.07).k(t.ink, 0.025).o(IVORY, -0.04, -0.11, 0.055, 0.07, 0.6).k(t.ink, 0.025);
      for (const [bx, by] of [[1.16, -0.42], [-1.16, 0.48]] as const) p.p(t.flag, [bx - 0.1, by, bx + 0.1, by, bx + 0.1, by + 0.4, bx, by + 0.3, bx - 0.1, by + 0.4]).k(t.ink, 0.04);
      break;
    }
    case K.BonePit: {
      // A pit of old bones: ribs, a skull, a crossed pair.
      p.s(t.fill, lump(0, 0, 1.32, 1.32, 3, 11));
      p.s(EARTH_DARK, lump(0, 0, 1.1, 1.06, 5, 10)).k(PENCIL, 0.05);
      p.s('#3a2c20', lump(0, 0.02, 0.9, 0.84, 7, 10));
      for (let i = 0; i < 5; i++) {
        const rx = -0.56 + i * 0.2;
        p.l(PENCIL, 0.13, [rx, -0.5, rx + 0.1, -0.1, rx, 0.3]).l(IVORY, 0.075, [rx, -0.5, rx + 0.1, -0.1, rx, 0.3]);
      }
      p.l(PENCIL, 0.12, [-0.66, -0.12, 0.36, -0.12]).l(IVORY, 0.07, [-0.66, -0.12, 0.36, -0.12]);
      p.o(IVORY, 0.52, -0.2, 0.24, 0.2).k(PENCIL, 0.04).o(IVORY, 0.72, -0.2, 0.12, 0.11).k(PENCIL, 0.04);
      p.o(PENCIL, 0.46, -0.28, 0.05).o(PENCIL, 0.46, -0.12, 0.05);
      for (const [x0, y0, x1, y1] of [[0.0, 0.42, 0.6, 0.7], [0.0, 0.7, 0.6, 0.42]] as const) {
        p.l(PENCIL, 0.13, [x0, y0, x1, y1]).l(IVORY, 0.075, [x0, y0, x1, y1]);
        p.o(IVORY, x0, y0, 0.06).o(IVORY, x1, y1, 0.06);
      }
      stones(p, t, 1.2, 12, 0.1, 0.1);
      break;
    }
    case K.Cave: {
      // The Great Cave: a dome of rock with a mouth wide enough for a Rex, tusks set either side of it.
      p.s(t.fill, lump(0, 0, 1.34, 1.34, 6, 12));
      p.s(ROCK_DARK, lump(0, -0.04, 1.16, 1.12, 8, 12)).k(PENCIL, 0.05);
      p.s(ROCK, lump(-0.04, -0.14, 0.98, 0.9, 10, 11));
      p.s(ROCK_LIGHT, lump(-0.14, -0.34, 0.58, 0.42, 12, 8));
      p.s('#18110c', [-0.74, 1.12, -0.7, 0.26, 0, -0.04, 0.7, 0.26, 0.74, 1.12, 0, 1.2]).k(PENCIL, 0.05);
      p.r(t.ink, 0.19, 0, 0.3, 0.92, Math.PI * 1.14, Math.PI * 1.86).r(t.fill, 0.12, 0, 0.3, 0.92, Math.PI * 1.14, Math.PI * 1.86);
      for (const side of [-1, 1]) {
        p.l(PENCIL, 0.15, [side * 0.86, 1.08, side * 0.78, 0.7, side * 0.56, 0.44]).l(IVORY, 0.09, [side * 0.86, 1.08, side * 0.78, 0.7, side * 0.56, 0.44]);
      }
      break;
    }
    case K.Volcano: {
      // A toy volcano: slopes in the side's colour, a crater of lava.
      p.s(t.fill, lump(0, 0, 0.9, 0.9, 3, 10));
      p.s(t.dark, lump(0, 0, 0.74, 0.74, 5, 9));
      p.s('#6f6052', lump(0, 0, 0.58, 0.58, 7, 9)).k(PENCIL, 0.045);
      p.s('#8c7b69', lump(-0.03, -0.04, 0.42, 0.42, 9, 8));
      p.l(LAVA, 0.07, [0.14, 0.12, 0.3, 0.26, 0.34, 0.5]).l(LAVA, 0.06, [-0.16, 0.06, -0.36, 0.14, -0.5, 0.06]);
      p.o('#2a1c14', 0, 0, 0.25).k(PENCIL, 0.045).o(LAVA, 0, 0, 0.18).o(LAVA_HOT, 0, 0, 0.1);
      break;
    }
  }
}

const NEST_EGGS = [[-0.3, -0.2, -0.3], [0.32, -0.12, 0.4], [0.0, 0.34, 0.1]] as const;

/** A Dino Pack building, finished. The renderer draws work in progress, damage and health over it. */
export function drawDinoBuilding(st: Stage, b: BuildingLook, px: number, py: number, t: Team): void {
  const { x, z, toys, now } = st;
  const size = def(b.kind).size;
  const s = toys.get(`d${b.kind}s${b.owner}`, z, size / 2 + 0.06, (p) => paintBuilding(p, t, b.kind), t.ink, 'top');
  shadow(st, s, px, py, 0, 1, 0.1, 0.26);
  stamp(st, s, px, py);
  if (b.kind === K.Nest) {
    // The eggs it has waiting, each rocking a little in the straw.
    const egg = toys.get(`d19${b.owner}`, z, 0.34, (p) => {
      p.o(IVORY, 0, 0, 0.2, 0.26);
      p.o(t.fill, -0.07, -0.1, 0.05).o(t.fill, 0.07, 0.01, 0.06).o(t.fill, -0.04, 0.13, 0.045).o(t.light, 0.06, -0.14, 0.03);
    }, t.ink);
    for (let i = 0; i < Math.min(3, b.eggs); i++) {
      const [ex, ey, er] = NEST_EGGS[i]!;
      const rock = b.plain ? 0 : Math.sin(now / 420 + b.seed + i * 2.1) * 0.08;
      shadow(st, egg, px + ex * z, py + ey * z, er + rock, 1.25, 0.04, 0.2);
      stamp(st, egg, px + ex * z, py + ey * z, er + rock, 1.25);
    }
  }
  if (b.plain) {
    home(st);
    return;
  }
  switch (b.kind) {
    case K.Nest:
      pennant(st, px + 1.34 * z, py - 0.9 * z, t, 1.4, b.seed);
      break;
    case K.Dig: {
      const p = brush(st, px, py);
      x.globalAlpha = 0.22 + 0.2 * Math.sin(now / 260 + b.seed);
      p.b('#fff7c8', 0.42, 0.42, 0.46, 0.46, 0.08);
      x.globalAlpha = 1;
      break;
    }
    case K.Den: {
      // Something is always watching from inside.
      const p = brush(st, px, py), blink = (now / 1000 + b.seed * 0.7) % 4 < 0.14 ? 0.2 : 1;
      p.o(EYE, -0.14, 0.62, 0.055, 0.04 * blink).o(EYE, 0.14, 0.62, 0.055, 0.04 * blink);
      pennant(st, px + 0.98 * z, py - 0.5 * z, t, 1.0, b.seed);
      break;
    }
    case K.Wallow: {
      // Bubbles come up through the mud and burst.
      const p = brush(st, px, py);
      for (let i = 0; i < 3; i++) {
        const k = (now / 1300 + i * 0.37 + b.seed * 0.21) % 1;
        const bx = Math.sin(i * 4.1 + b.seed + Math.floor(now / 1300 + i * 0.37 + b.seed * 0.21) * 1.9) * 0.5, by = Math.cos(i * 2.9 + b.seed) * 0.42;
        x.globalAlpha = k < 0.85 ? 0.9 : (1 - k) / 0.15;
        p.o(MUD_LIGHT, bx, by, 0.04 + k * 0.09).k('#9c8262', 0.025);
      }
      x.globalAlpha = 1;
      pennant(st, px + 1.0 * z, py - 0.52 * z, t, 1.0, b.seed);
      break;
    }
    case K.Roost: {
      // The banners on the perches stir.
      const p = brush(st, px, py), sway = Math.sin(now / 480 + b.seed) * 0.06;
      for (const [bx, by] of [[1.16, -0.42], [-1.16, 0.48]] as const) p.p(t.flag, [bx - 0.1, by, bx + 0.1, by, bx + 0.1 + sway, by + 0.4, bx + sway, by + 0.3, bx - 0.1 + sway, by + 0.4]).k(t.ink, 0.04);
      break;
    }
    case K.BonePit:
      if (b.busy) {
        // Research under way: the skull's eyes burn.
        const p = brush(st, px, py);
        x.globalAlpha = 0.6 + 0.4 * Math.sin(now / 180);
        p.o('#9fe8ff', 0.46, -0.28, 0.06).o('#9fe8ff', 0.46, -0.12, 0.06);
        x.globalAlpha = 1;
      }
      pennant(st, px + 1.0 * z, py - 0.56 * z, t, 1.0, b.seed);
      break;
    case K.Cave:
      // Torches either side of the mouth.
      for (const side of [-1, 1]) {
        const p = brush(st, px + side * 1.02 * z, py + 0.92 * z);
        p.l(PENCIL, 0.09, [0, 0.16, 0, -0.04]);
        fire(st, px + side * 1.02 * z, py + 0.86 * z, 0.62, b.seed + side);
      }
      break;
    case K.Volcano: {
      // The crater glows and smokes; when it fires, it spits.
      const p = brush(st, px, py), glow = 0.5 + 0.5 * Math.sin(now / 300 + b.seed), spit = kick(b.since, 300);
      x.globalAlpha = 0.35 + 0.4 * glow;
      p.o(LAVA_HOT, 0, 0, 0.13 + 0.03 * glow);
      x.globalAlpha = 1;
      if (spit > 0) {
        x.globalAlpha = spit;
        p.o('#fff3b0', 0, 0, 0.2 + spit * 0.14);
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + b.seed, d = 0.3 + (1 - spit) * 0.4;
          p.o(LAVA, Math.cos(a) * d, Math.sin(a) * d, 0.05);
        }
        x.globalAlpha = 1;
      }
      smoke(st, px, py - 0.1 * z, 0.6, b.seed, '#5a5048');
      break;
    }
  }
  home(st);
}

/** What a dinosaur's attack looks like at `k` (0 to 1) through its short life. Returns false for kinds it doesn't draw. */
export function drawDinoHit(st: Stage, kind: number, x1: number, y1: number, x2: number, y2: number, k: number): boolean {
  const { x, z } = st;
  const oval = (cx: number, cy: number, rx: number, ry: number) => {
    x.beginPath();
    x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  };
  switch (kind) {
    case K.Raptor:
    case K.Horn:
    case K.Rex:
    case K.Ptero: {
      // Teeth, horns and beaks: claw marks across what was hit.
      const big = kind === K.Rex ? 1.7 : kind === K.Horn ? 1.3 : 1;
      const r = z * 0.26 * big, a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      for (const [w, colour] of [[Math.max(3, z * 0.13 * big), `rgba(150,30,20,${0.5 * (1 - k)})`], [Math.max(1.5, z * 0.07 * big), `rgba(255,255,255,${0.95 * (1 - k)})`]] as const) {
        x.strokeStyle = colour;
        x.lineWidth = w;
        x.beginPath();
        for (const o of kind === K.Raptor || kind === K.Ptero ? [-0.35, 0.35] : [-0.6, 0, 0.6]) {
          const ox = Math.cos(a - Math.PI / 2) * o * r, oy = Math.sin(a - Math.PI / 2) * o * r;
          const reach = r * (0.4 + k * 0.7);
          x.moveTo(x2 + ox - Math.cos(a) * reach, y2 + oy - Math.sin(a) * reach);
          x.lineTo(x2 + ox + Math.cos(a) * reach, y2 + oy + Math.sin(a) * reach);
        }
        x.stroke();
      }
      return true;
    }
    case K.Bronto: {
      // A stomp: dust rolling out to the edge of what it shook, and cracks in the ground.
      const r = (def(K.Bronto).splash / TILE) * z;
      x.strokeStyle = `rgba(120,92,58,${0.85 * (1 - k)})`;
      x.lineWidth = Math.max(2, z * 0.22 * (1 - k * 0.6));
      oval(x2, y2, r * (0.3 + 0.7 * k), r * (0.3 + 0.7 * k) * 0.82);
      x.stroke();
      x.fillStyle = `rgba(190,160,115,${0.34 * (1 - k)})`;
      x.fill();
      x.fillStyle = `rgba(160,130,90,${0.6 * (1 - k)})`;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + x2 * 0.01, d = r * (0.3 + 0.75 * k);
        oval(x2 + Math.cos(a) * d, y2 + Math.sin(a) * d * 0.82, z * (0.1 + 0.1 * k), z * (0.08 + 0.08 * k));
        x.fill();
      }
      return true;
    }
    case K.Spitter: {
      // A gob of something green, and the splat it makes.
      const fly = Math.min(1, k / 0.6);
      if (fly < 1) {
        const gx = x1 + (x2 - x1) * fly, gy = y1 + (y2 - y1) * fly;
        x.strokeStyle = 'rgba(165,232,79,0.45)';
        x.lineWidth = Math.max(1.5, z * 0.07);
        x.beginPath();
        x.moveTo(x1 + (x2 - x1) * Math.max(0, fly - 0.25), y1 + (y2 - y1) * Math.max(0, fly - 0.25));
        x.lineTo(gx, gy);
        x.stroke();
        x.fillStyle = SPIT;
        oval(gx, gy, Math.max(1.8, z * 0.1), Math.max(1.8, z * 0.1));
        x.fill();
        x.strokeStyle = 'rgba(50,100,25,0.9)';
        x.lineWidth = 1.2;
        x.stroke();
      } else {
        const q = (k - 0.6) / 0.4;
        x.fillStyle = `rgba(150,220,70,${0.75 * (1 - q)})`;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + x2 * 0.02, d = z * 0.22 * q;
          oval(x2 + Math.cos(a) * d, y2 + Math.sin(a) * d, z * (0.08 + 0.05 * q), z * (0.07 + 0.04 * q));
          x.fill();
        }
        oval(x2, y2, z * (0.12 + 0.12 * q), z * (0.1 + 0.1 * q));
        x.fill();
      }
      return true;
    }
    case K.Volcano: {
      // A lump of lava lobbed up and over, trailing sparks.
      const fly = Math.min(1, k / 0.75);
      if (fly < 1) {
        const gx = x1 + (x2 - x1) * fly, gy = y1 + (y2 - y1) * fly;
        const reach = Math.min(z * 2, Math.hypot(x2 - x1, y2 - y1) * 0.3);
        const up = Math.sin(fly * Math.PI) * reach;
        x.fillStyle = 'rgba(0,0,0,0.2)';
        oval(gx, gy, z * 0.12, z * 0.08);
        x.fill();
        for (let i = 1; i <= 3; i++) {
          const f2 = Math.max(0, fly - i * 0.06), tx = x1 + (x2 - x1) * f2, ty = y1 + (y2 - y1) * f2 - Math.sin(f2 * Math.PI) * reach;
          x.fillStyle = `rgba(240,86,29,${0.6 - i * 0.16})`;
          oval(tx, ty, z * (0.1 - i * 0.02), z * (0.1 - i * 0.02));
          x.fill();
        }
        x.fillStyle = LAVA;
        oval(gx, gy - up, Math.max(2.2, z * 0.14), Math.max(2.2, z * 0.14));
        x.fill();
        x.fillStyle = LAVA_HOT;
        oval(gx - 1, gy - up - 1, Math.max(1.2, z * 0.07), Math.max(1.2, z * 0.07));
        x.fill();
      } else {
        const q = (k - 0.75) / 0.25;
        x.fillStyle = `rgba(255,140,40,${0.75 * (1 - q)})`;
        oval(x2, y2, z * (0.18 + 0.34 * q), z * (0.18 + 0.34 * q));
        x.fill();
        x.fillStyle = `rgba(255,236,150,${0.9 * (1 - q)})`;
        oval(x2, y2, z * 0.12 * (1 - q), z * 0.12 * (1 - q));
        x.fill();
      }
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ whole pieces, for the panels

/** How far a Dino Pack piece reaches from its middle when it is standing still, in tiles. */
export function dinoReach(kind: number): number {
  if (def(kind).building) return def(kind).size / 2 + 0.06;
  return kind === K.Bronto ? 1.04 : kind === K.Rex ? 0.9 : kind === K.Alpha ? 0.82 : kind === K.Ptero ? 0.72 : kind === K.Horn ? 0.68 : kind === K.Egg ? 0.32 : kind === K.Gatherer ? 0.38 : 0.56;
}

/** A whole Dino Pack piece, standing still and facing right: what the buttons in the panels show. */
export function paintDinoPiece(p: Pen, t: Team, kind: number): void {
  const x = p.x;
  if (def(kind).building) {
    paintBuilding(p, t, kind);
    if (kind === K.Nest) {
      for (const [ex, ey, er] of NEST_EGGS) {
        x.save();
        x.translate(ex, ey);
        x.rotate(er);
        x.scale(1.25, 1.25);
        p.o(IVORY, 0, 0, 0.2, 0.26).k(t.ink, 0.05);
        p.o(t.fill, -0.07, -0.1, 0.05).o(t.fill, 0.07, 0.01, 0.06).o(t.fill, -0.04, 0.13, 0.045);
        x.restore();
      }
    }
    return;
  }
  if (kind === K.Egg) {
    p.o(IVORY, 0, 0, 0.2, 0.26);
    p.o(t.fill, -0.07, -0.1, 0.05).o(t.fill, 0.07, 0.01, 0.06).o(t.fill, -0.04, 0.13, 0.045);
    return;
  }
  if (kind === K.Ptero) {
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(0.16, s * 0.05);
      x.quadraticCurveTo(0.22, s * 0.4, -0.02, s * 0.68);
      x.quadraticCurveTo(-0.12, s * 0.36, -0.28, s * 0.06);
      x.closePath();
      x.fillStyle = t.fill;
      x.fill();
      p.l(t.dark, 0.035, [0.14, s * 0.05, 0.16, s * 0.34, -0.01, s * 0.64]);
    }
    paintPtero(p, t);
    return;
  }
  const b = BUILD[kind]!;
  // Nudged so that tail and head together sit in the middle of the button.
  const shift = kind === K.Bronto ? -0.04 : kind === K.Rex ? 0.08 : kind === K.Raptor ? 0.08 : kind === K.Alpha ? 0.08 : kind === K.Spitter ? 0.04 : 0;
  x.save();
  x.translate(shift, 0);
  for (const [fx, fy] of b.feet) p.o(t.dark, fx, fy, b.foot, b.foot * 0.66).o(t.dark, fx, -fy, b.foot, b.foot * 0.66);
  x.beginPath();
  x.moveTo(b.tail[0] + b.tail[2], -b.tail[2]);
  x.quadraticCurveTo(b.tail[0] - b.tail[1] * 0.55, -b.tail[2] * 0.7, b.tail[0] - b.tail[1], 0.03);
  x.quadraticCurveTo(b.tail[0] - b.tail[1] * 0.55, b.tail[2] * 0.7, b.tail[0] + b.tail[2], b.tail[2]);
  x.fillStyle = t.fill;
  x.fill();
  paintBody(p, t, kind);
  if (kind === K.Gatherer) p.b(PENCIL, -0.05, 0, 0.25, 0.25, 0.03).b(BLOCK_COLOURS[1], -0.05, 0, 0.19, 0.19, 0.02);
  if (kind === K.Bronto) {
    limb(x, t.fill, t.fill, 0.17, 0.34, 0, 0.62, 0.05, 0.9, 0.12);
    x.translate(0.9, 0.12);
    x.rotate(0.25);
    paintBrontoHead(p, t);
  } else if (kind === K.Rex) {
    x.translate(0.26, 0);
    paintRexHead(p, t);
  }
  x.restore();
}
