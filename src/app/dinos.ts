// The Dino Pack, drawn: plastic dinosaurs seen from above, their eggs, and the playset pieces they live in.
// Like everything else in the game these are drawn, not loaded; each has a silhouette of its own.
import { def } from '../sim/data';
import { K, TILE, type Entity } from '../sim/types';

export interface Team { fill: string; dark: string; light: string; flag: string }
type Ctx = CanvasRenderingContext2D;

const IVORY = '#f6efd9', ROCK = '#9a8f7c', ROCK_DARK = '#6a6052', MUD = '#5f4a35', EARTH = '#8a6a43', EARTH_DARK = '#5d452b';
const BLOCKS = ['#d9463d', '#3b78c9', '#e9b730', '#3f9b57'];

export const isDinoUnit = (kind: number): boolean => kind >= K.Gatherer && kind <= K.Egg;
export const isDinoBuilding = (kind: number): boolean => kind >= K.Nest && kind <= K.Volcano;

const oval = (x: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  x.beginPath();
  x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
};

/** A tail that tapers to a point and sways as the animal walks. */
function tail(x: Ctx, r: number, from: number, len: number, wide: number, sway: number): void {
  x.beginPath();
  x.moveTo(from, -wide);
  x.quadraticCurveTo(from - len * 0.6, -wide * 0.5 + sway * 0.4, from - len, sway);
  x.quadraticCurveTo(from - len * 0.6, wide * 0.5 + sway * 0.4, from, wide);
  x.closePath();
  x.fill();
  void r;
}

/** Feet showing either side of the body, front and back pairs stepping in turn. */
function feet(x: Ctx, colour: string, r: number, pairs: readonly [number, number][], size: number, step: number): void {
  x.fillStyle = colour;
  pairs.forEach(([fx, fy], i) => {
    const s = (i % 2 === 0 ? step : -step) * size * 0.6;
    oval(x, fx * r + s, fy * r, size, size * 0.62);
    x.fill();
    oval(x, fx * r - s, -fy * r, size, size * 0.62);
    x.fill();
  });
}

/** A toy dinosaur, seen from above, facing the way it is going. */
export function drawDino(x: Ctx, px: number, py: number, z: number, e: Entity, t: Team, now: number): void {
  if (e.kind === K.Egg) {
    drawEgg(x, px, py, z, e, t, now);
    return;
  }
  const r = (def(e.kind).radius / TILE) * z;
  const a = Math.atan2(e.fy, e.fx || 0.0001);
  const moving = e.still < 2;
  const beat = now / (e.kind === K.Bronto ? 260 : e.kind === K.Raptor ? 80 : 130) + e.id * 1.7;
  const sway = moving ? Math.sin(beat) * r * 0.22 : Math.sin(now / 900 + e.id) * r * 0.06;
  const step = moving ? Math.sin(beat) : 0;
  const line = Math.max(1, z * 0.045);
  x.save();
  x.translate(px, py);
  // Its shadow on the paper.
  x.fillStyle = 'rgba(0,0,0,0.2)';
  oval(x, 1.5 + z * 0.02, 2.5 + z * 0.03, r * 1.05, r * 0.72, a);
  x.fill();
  x.rotate(a);
  x.lineCap = 'round';
  x.lineJoin = 'round';
  switch (e.kind) {
    case K.Gatherer: {
      feet(x, t.dark, r, [[0.1, 0.55]], r * 0.24, step);
      x.fillStyle = t.dark;
      tail(x, r, -r * 0.45, r * 0.8, r * 0.26, sway);
      x.fillStyle = t.fill;
      oval(x, -r * 0.05, 0, r * 0.72, r * 0.5);
      x.fill();
      x.fillStyle = t.dark;
      oval(x, r * 0.74, 0, r * 0.36, r * 0.27);
      x.fill();
      x.fillStyle = t.light;
      oval(x, r * 0.8, 0, r * 0.2, r * 0.15);
      x.fill();
      if (e.carry > 0 && e.cargo === 1) {
        // A battery on its back.
        x.fillStyle = '#2c2c2c';
        oval(x, -r * 0.12, 0, r * 0.4, r * 0.4);
        x.fill();
        x.fillStyle = '#e08a1e';
        oval(x, -r * 0.12, 0, r * 0.27, r * 0.27);
        x.fill();
      } else if (e.carry > 0) {
        const s = r * 0.72;
        x.fillStyle = BLOCKS[e.id % 4]!;
        x.fillRect(-r * 0.12 - s / 2, -s / 2, s, s);
        x.strokeStyle = 'rgba(40,30,20,0.7)';
        x.lineWidth = 1;
        x.strokeRect(-r * 0.12 - s / 2, -s / 2, s, s);
      } else {
        x.fillStyle = '#f2c230';
        oval(x, -r * 0.1, 0, r * 0.22, r * 0.22);
        x.fill();
      }
      break;
    }
    case K.Raptor: {
      feet(x, t.dark, r, [[0.0, 0.62]], r * 0.3, step);
      x.fillStyle = t.dark;
      tail(x, r, -r * 0.4, r * 1.35, r * 0.2, sway * 1.4);
      x.fillStyle = t.fill;
      oval(x, 0, 0, r * 0.78, r * 0.4);
      x.fill();
      // Stripes across the back.
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1, z * 0.05);
      x.beginPath();
      for (const sx of [-0.35, -0.05, 0.25]) {
        x.moveTo(sx * r, -r * 0.3);
        x.lineTo(sx * r - r * 0.08, r * 0.3);
      }
      x.stroke();
      // A narrow head, jaws a little open.
      x.fillStyle = t.dark;
      x.beginPath();
      x.moveTo(r * 0.55, -r * 0.26);
      x.lineTo(r * 1.4, -r * 0.1);
      x.lineTo(r * 1.0, 0);
      x.lineTo(r * 1.4, r * 0.1);
      x.lineTo(r * 0.55, r * 0.26);
      x.closePath();
      x.fill();
      x.fillStyle = t.light;
      oval(x, r * 0.72, 0, r * 0.2, r * 0.14);
      x.fill();
      break;
    }
    case K.Spitter: {
      feet(x, t.dark, r, [[-0.05, 0.6]], r * 0.27, step);
      x.fillStyle = t.dark;
      tail(x, r, -r * 0.45, r * 1.0, r * 0.24, sway);
      x.fillStyle = t.fill;
      oval(x, -r * 0.05, 0, r * 0.72, r * 0.46);
      x.fill();
      // The frill that marks it out: a fan behind the head.
      x.fillStyle = t.light;
      x.strokeStyle = t.dark;
      x.lineWidth = line;
      x.beginPath();
      x.moveTo(r * 0.5, 0);
      x.arc(r * 0.5, 0, r * 0.7, -Math.PI * 0.62, Math.PI * 0.62);
      x.closePath();
      x.fill();
      x.stroke();
      x.beginPath();
      for (const k of [-0.4, -0.2, 0, 0.2, 0.4]) {
        x.moveTo(r * 0.5, 0);
        x.lineTo(r * 0.5 + Math.cos(k * Math.PI) * r * 0.68, Math.sin(k * Math.PI) * r * 0.68);
      }
      x.stroke();
      x.fillStyle = t.dark;
      oval(x, r * 0.85, 0, r * 0.36, r * 0.23);
      x.fill();
      x.fillStyle = '#7fd04a';
      oval(x, r * 1.12, 0, r * 0.11, r * 0.11);
      x.fill();
      break;
    }
    case K.Horn: {
      feet(x, t.dark, r, [[0.4, 0.62], [-0.45, 0.62]], r * 0.22, step);
      x.fillStyle = t.dark;
      tail(x, r, -r * 0.6, r * 0.65, r * 0.26, sway * 0.6);
      x.fillStyle = t.fill;
      oval(x, -r * 0.1, 0, r * 0.82, r * 0.6);
      x.fill();
      x.fillStyle = t.dark;
      oval(x, -r * 0.2, 0, r * 0.42, r * 0.2);
      x.fill();
      // The shield behind its head, and three horns.
      x.fillStyle = t.dark;
      oval(x, r * 0.52, 0, r * 0.34, r * 0.66);
      x.fill();
      x.fillStyle = t.light;
      oval(x, r * 0.5, 0, r * 0.2, r * 0.5);
      x.fill();
      x.fillStyle = t.fill;
      oval(x, r * 0.86, 0, r * 0.34, r * 0.3);
      x.fill();
      x.strokeStyle = IVORY;
      x.lineWidth = Math.max(1.6, z * 0.09);
      x.beginPath();
      x.moveTo(r * 0.8, -r * 0.24);
      x.lineTo(r * 1.42, -r * 0.34);
      x.moveTo(r * 0.8, r * 0.24);
      x.lineTo(r * 1.42, r * 0.34);
      x.moveTo(r * 1.1, 0);
      x.lineTo(r * 1.36, 0);
      x.stroke();
      break;
    }
    case K.Bronto: {
      feet(x, t.dark, r, [[0.42, 0.56], [-0.42, 0.56]], r * 0.22, step);
      // A long tail one way and a long neck the other.
      x.strokeStyle = t.dark;
      x.lineWidth = r * 0.26;
      x.beginPath();
      x.moveTo(-r * 0.6, 0);
      x.quadraticCurveTo(-r * 1.1, -sway * 0.8, -r * 1.55, -sway * 2.2);
      x.stroke();
      x.lineWidth = r * 0.12;
      x.beginPath();
      x.moveTo(-r * 1.5, -sway * 2.0);
      x.lineTo(-r * 1.85, -sway * 3.0);
      x.stroke();
      x.fillStyle = t.fill;
      oval(x, -r * 0.05, 0, r * 0.82, r * 0.55);
      x.fill();
      x.fillStyle = t.dark;
      oval(x, -r * 0.1, 0, r * 0.5, r * 0.16);
      x.fill();
      x.strokeStyle = t.fill;
      x.lineWidth = r * 0.26;
      x.beginPath();
      x.moveTo(r * 0.55, 0);
      x.quadraticCurveTo(r * 1.0, sway * 0.5, r * 1.42, sway * 1.2);
      x.stroke();
      x.fillStyle = t.dark;
      oval(x, r * 1.5, sway * 1.3, r * 0.22, r * 0.17);
      x.fill();
      x.fillStyle = t.light;
      oval(x, r * 1.55, sway * 1.3, r * 0.09, r * 0.07);
      x.fill();
      break;
    }
    case K.Rex: {
      feet(x, t.dark, r, [[-0.05, 0.6]], r * 0.3, step);
      x.fillStyle = t.dark;
      tail(x, r, -r * 0.5, r * 1.15, r * 0.36, sway);
      x.fillStyle = t.fill;
      oval(x, -r * 0.05, 0, r * 0.8, r * 0.54);
      x.fill();
      // Dark bars down the back.
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1.4, z * 0.08);
      x.beginPath();
      for (const sx of [-0.45, -0.15, 0.15]) {
        x.moveTo(sx * r, -r * 0.4);
        x.lineTo(sx * r, r * 0.4);
      }
      x.stroke();
      // Little arms, and a head that is mostly jaw.
      x.lineWidth = Math.max(1.2, z * 0.06);
      x.beginPath();
      x.moveTo(r * 0.45, -r * 0.4);
      x.lineTo(r * 0.72, -r * 0.56);
      x.moveTo(r * 0.45, r * 0.4);
      x.lineTo(r * 0.72, r * 0.56);
      x.stroke();
      x.fillStyle = t.dark;
      x.beginPath();
      x.moveTo(r * 0.5, -r * 0.4);
      x.lineTo(r * 1.3, -r * 0.34);
      x.quadraticCurveTo(r * 1.52, 0, r * 1.3, r * 0.34);
      x.lineTo(r * 0.5, r * 0.4);
      x.closePath();
      x.fill();
      x.fillStyle = t.light;
      oval(x, r * 0.78, -r * 0.17, r * 0.1, r * 0.07);
      x.fill();
      oval(x, r * 0.78, r * 0.17, r * 0.1, r * 0.07);
      x.fill();
      // Teeth along the snout.
      x.fillStyle = IVORY;
      for (const k of [1.0, 1.14, 1.28]) {
        oval(x, r * k, -r * 0.3, r * 0.05, r * 0.05);
        x.fill();
        oval(x, r * k, r * 0.3, r * 0.05, r * 0.05);
        x.fill();
      }
      break;
    }
  }
  x.restore();
}

/** An egg on its way to being a dinosaur: it rocks harder the nearer it is, and cracks before it hatches. */
function drawEgg(x: Ctx, px: number, py: number, z: number, e: Entity, t: Team, now: number): void {
  const what = e.queue[0];
  const f = what ? Math.min(1, e.qprog / Math.max(1, def(what).time)) : 0;
  const r = z * 0.27 * (what && def(what).supply >= 4 ? 1.25 : 1);
  x.save();
  x.translate(px, py);
  x.fillStyle = 'rgba(0,0,0,0.2)';
  oval(x, 1.5, 2.5, r * 0.85, r * 0.75);
  x.fill();
  x.rotate(Math.sin(now / (150 - f * 70) + e.id) * (0.04 + f * 0.16));
  x.fillStyle = IVORY;
  x.strokeStyle = t.dark;
  x.lineWidth = Math.max(1, z * 0.05);
  oval(x, 0, 0, r * 0.78, r);
  x.fill();
  x.stroke();
  x.fillStyle = t.fill;
  for (const [sx, sy, s] of [[-0.3, -0.35, 0.16], [0.25, 0.05, 0.2], [-0.15, 0.45, 0.14]] as const) {
    oval(x, sx * r, sy * r, s * r, s * r);
    x.fill();
  }
  if (f > 0.65) {
    x.strokeStyle = '#3a2d20';
    x.lineWidth = Math.max(1, z * 0.04);
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.1);
    x.lineTo(-r * 0.2, r * 0.1);
    x.lineTo(r * 0.05, -r * 0.12);
    x.lineTo(r * 0.3, r * 0.08);
    if (f > 0.85) x.lineTo(r * 0.55, -r * 0.1);
    x.stroke();
  }
  x.restore();
}

/** A Ptero on the wing: its shadow below it, wings beating. */
export function drawPtero(x: Ctx, px: number, py: number, z: number, e: Entity, t: Team, now: number): void {
  const r = z * 0.42, a = Math.atan2(e.fy, e.fx || 0.0001);
  const flap = 0.78 + 0.22 * Math.sin(now / 95 + e.id * 2.1);
  const wings = (cx: number, cy: number, colour: string) => {
    x.save();
    x.translate(cx, cy);
    x.rotate(a);
    x.fillStyle = colour;
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(r * 0.35, s * r * 0.12);
      x.quadraticCurveTo(r * 0.5, s * r * 0.9 * flap, -r * 0.05, s * r * 1.6 * flap);
      x.quadraticCurveTo(-r * 0.25, s * r * 0.8 * flap, -r * 0.6, s * r * 0.14);
      x.closePath();
      x.fill();
    }
    x.restore();
  };
  wings(px + z * 0.3, py + z * 0.45, 'rgba(0,0,0,0.18)');
  const by = py - z * 0.12;
  wings(px, by, t.fill);
  x.save();
  x.translate(px, by);
  x.rotate(a);
  x.lineCap = 'round';
  // The bones of each wing.
  x.strokeStyle = t.dark;
  x.lineWidth = Math.max(1.2, z * 0.06);
  x.beginPath();
  for (const s of [-1, 1]) {
    x.moveTo(r * 0.3, s * r * 0.1);
    x.quadraticCurveTo(r * 0.5, s * r * 0.9 * flap, -r * 0.05, s * r * 1.6 * flap);
  }
  x.stroke();
  // Body, a long beak ahead and a crest behind.
  x.fillStyle = t.dark;
  oval(x, -r * 0.05, 0, r * 0.62, r * 0.2);
  x.fill();
  x.beginPath();
  x.moveTo(r * 0.45, -r * 0.14);
  x.lineTo(r * 1.4, 0);
  x.lineTo(r * 0.45, r * 0.14);
  x.closePath();
  x.fill();
  x.strokeStyle = t.light;
  x.lineWidth = Math.max(1.4, z * 0.07);
  x.beginPath();
  x.moveTo(r * 0.45, 0);
  x.lineTo(r * 0.02, 0);
  x.stroke();
  x.restore();
}

/** The markers that stand for dinosaurs when the map is zoomed right out. */
export function drawDinoMarker(x: Ctx, px: number, py: number, z: number, e: Entity, t: Team): void {
  const r = Math.max(3, z * 0.4);
  x.fillStyle = t.fill;
  x.strokeStyle = t.dark;
  x.lineWidth = 1;
  switch (e.kind) {
    case K.Gatherer:
      oval(x, px, py, Math.max(1.6, z * 0.22), Math.max(1.6, z * 0.22));
      x.fill();
      return;
    case K.Egg:
      x.fillStyle = IVORY;
      oval(x, px, py, r * 0.5, r * 0.65);
      x.fill();
      x.stroke();
      return;
    case K.Raptor:
      // A small claw: two to an egg, so they come in crowds.
      x.beginPath();
      x.moveTo(px, py - r * 0.95);
      x.lineTo(px + r * 0.75, py + r * 0.7);
      x.lineTo(px, py + r * 0.25);
      x.lineTo(px - r * 0.75, py + r * 0.7);
      x.closePath();
      x.fill();
      x.stroke();
      return;
    case K.Spitter:
      oval(x, px, py, r * 0.9, r * 0.9);
      x.fill();
      x.stroke();
      x.fillStyle = '#7fd04a';
      oval(x, px, py, r * 0.38, r * 0.38);
      x.fill();
      return;
    case K.Horn:
    case K.Bronto:
    case K.Rex: {
      const k = e.kind === K.Horn ? 1.05 : e.kind === K.Bronto ? 1.5 : 1.4;
      x.lineWidth = e.kind === K.Horn ? 1.6 : 2.4;
      oval(x, px, py, r * 1.3 * k, r * 0.85 * k);
      x.fill();
      x.stroke();
      x.fillStyle = e.kind === K.Rex ? t.dark : e.kind === K.Horn ? IVORY : t.light;
      oval(x, px, py, r * 0.5 * k, r * 0.32 * k);
      x.fill();
      return;
    }
    case K.Ptero:
      x.fillStyle = 'rgba(0,0,0,0.2)';
      oval(x, px + 3, py + 4, r * 0.9, r * 0.6);
      x.fill();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(2.4, r * 0.7);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(px - r * 1.3, py - r * 0.5);
      x.lineTo(px, py + r * 0.5);
      x.lineTo(px + r * 1.3, py - r * 0.5);
      x.stroke();
      x.fillStyle = t.light;
      oval(x, px, py + r * 0.3, r * 0.4, r * 0.4);
      x.fill();
      return;
  }
}

/** A ring of painted stones in a side's colour: every Dino building wears one, so you can tell whose it is. */
function stones(x: Ctx, px: number, py: number, rad: number, n: number, size: number, t: Team, phase = 0): void {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    x.fillStyle = i % 2 === 0 ? t.fill : t.light;
    oval(x, px + Math.cos(a) * rad, py + Math.sin(a) * rad, size, size * 0.85, a);
    x.fill();
    x.strokeStyle = t.dark;
    x.lineWidth = 1;
    x.stroke();
  }
}

/** A lumpy mound of rock or earth, the same lump every time for the same building. */
function mound(x: Ctx, px: number, py: number, rx: number, ry: number, seed: number): void {
  x.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.9 + 0.1 * Math.sin(seed * 1.7 + i * 2.3);
    const qx = px + Math.cos(a) * rx * k, qy = py + Math.sin(a) * ry * k;
    if (i === 0) x.moveTo(qx, qy);
    else {
      const b = ((i - 0.5) / n) * Math.PI * 2, kb = 1.0 + 0.08 * Math.sin(seed + i * 1.3);
      x.quadraticCurveTo(px + Math.cos(b) * rx * kb, py + Math.sin(b) * ry * kb, qx, qy);
    }
  }
  x.closePath();
}

/** A Dino Pack building: a playset piece seen from above. `eggs` is how many a Nest has waiting. */
export function drawDinoBuilding(x: Ctx, px: number, py: number, z: number, kind: number, t: Team, eggs: number, now: number): void {
  const s = def(kind).size * z, h = s / 2;
  const detail = z >= 11;
  const line = Math.max(1, z * 0.06);
  x.lineCap = 'round';
  x.lineJoin = 'round';
  switch (kind) {
    case K.Nest: {
      // A ring of sticks round a bed of straw, with the eggs that are ready lying in it.
      x.fillStyle = EARTH;
      oval(x, px, py, h * 0.97, h * 0.97);
      x.fill();
      x.strokeStyle = EARTH_DARK;
      x.lineWidth = line;
      x.stroke();
      if (detail) {
        x.strokeStyle = 'rgba(60,42,24,0.75)';
        x.lineWidth = Math.max(1, z * 0.07);
        x.beginPath();
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2, tw = 0.5 + 0.4 * Math.sin(i * 2.4);
          x.moveTo(px + Math.cos(a) * h * 0.72, py + Math.sin(a) * h * 0.72);
          x.lineTo(px + Math.cos(a + tw * 0.3) * h * 0.95, py + Math.sin(a + tw * 0.3) * h * 0.95);
        }
        x.stroke();
      }
      x.fillStyle = '#e6d39c';
      oval(x, px, py, h * 0.68, h * 0.68);
      x.fill();
      x.strokeStyle = 'rgba(150,120,60,0.6)';
      x.lineWidth = line;
      x.stroke();
      stones(x, px, py, h * 0.84, 8, Math.max(1.8, z * 0.17), t, 0.4);
      // Three hollows; an egg in each that is ready.
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        const ex = px + Math.cos(a) * h * 0.3, ey = py + Math.sin(a) * h * 0.3;
        x.fillStyle = 'rgba(120,90,40,0.35)';
        oval(x, ex, ey, h * 0.2, h * 0.17);
        x.fill();
        if (i < eggs) {
          x.fillStyle = IVORY;
          x.strokeStyle = t.dark;
          x.lineWidth = Math.max(1, z * 0.05);
          oval(x, ex, ey, h * 0.15, h * 0.19, a + 0.5);
          x.fill();
          x.stroke();
          x.fillStyle = t.fill;
          oval(x, ex - h * 0.04, ey - h * 0.05, h * 0.035, h * 0.035);
          x.fill();
          oval(x, ex + h * 0.05, ey + h * 0.04, h * 0.04, h * 0.04);
          x.fill();
        }
      }
      break;
    }
    case K.Dig: {
      // A heap of earth thrown up round the hole it digs the batteries out of.
      x.fillStyle = '#b08a5a';
      mound(x, px, py, h * 0.95, h * 0.95, 3);
      x.fill();
      x.strokeStyle = EARTH_DARK;
      x.lineWidth = line;
      x.stroke();
      x.fillStyle = '#3a2d20';
      oval(x, px, py, h * 0.5, h * 0.42);
      x.fill();
      x.fillStyle = '#e08a1e';
      oval(x, px + h * 0.12, py + h * 0.05, h * 0.16, h * 0.16);
      x.fill();
      x.strokeStyle = '#2c2c2c';
      x.lineWidth = Math.max(1, z * 0.05);
      x.stroke();
      stones(x, px, py, h * 0.74, 5, Math.max(1.6, z * 0.14), t, 0.9);
      break;
    }
    case K.Den: {
      // A rock with a way in, and a band of the side's colour painted over the mouth.
      x.fillStyle = ROCK;
      mound(x, px, py, h * 0.95, h * 0.88, 1);
      x.fill();
      x.strokeStyle = ROCK_DARK;
      x.lineWidth = line;
      x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.18)';
      oval(x, px - h * 0.25, py - h * 0.3, h * 0.45, h * 0.28, -0.4);
      x.fill();
      x.fillStyle = '#2a211a';
      x.beginPath();
      x.arc(px, py + h * 0.5, h * 0.42, Math.PI, 0);
      x.closePath();
      x.fill();
      x.strokeStyle = t.fill;
      x.lineWidth = Math.max(2, z * 0.16);
      x.beginPath();
      x.arc(px, py + h * 0.5, h * 0.53, Math.PI * 1.08, Math.PI * 1.92);
      x.stroke();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1, z * 0.04);
      x.beginPath();
      x.arc(px, py + h * 0.5, h * 0.62, Math.PI * 1.08, Math.PI * 1.92);
      x.stroke();
      break;
    }
    case K.Wallow: {
      // A mud hole, stamped flat round the edge.
      x.fillStyle = EARTH;
      mound(x, px, py, h * 0.96, h * 0.9, 5);
      x.fill();
      x.strokeStyle = EARTH_DARK;
      x.lineWidth = line;
      x.stroke();
      x.fillStyle = MUD;
      mound(x, px, py, h * 0.68, h * 0.6, 7);
      x.fill();
      x.strokeStyle = 'rgba(190,160,120,0.5)';
      x.lineWidth = Math.max(1, z * 0.05);
      x.beginPath();
      x.ellipse(px - h * 0.15, py - h * 0.05, h * 0.3, h * 0.18, 0, Math.PI * 0.1, Math.PI * 0.9);
      x.stroke();
      x.beginPath();
      x.ellipse(px + h * 0.2, py + h * 0.15, h * 0.2, h * 0.12, 0, Math.PI * 1.1, Math.PI * 1.9);
      x.stroke();
      // A pair of horns left sticking out of the mud says what comes from here.
      x.strokeStyle = IVORY;
      x.lineWidth = Math.max(1.6, z * 0.1);
      x.beginPath();
      x.moveTo(px - h * 0.12, py + h * 0.1);
      x.lineTo(px - h * 0.3, py - h * 0.25);
      x.moveTo(px + h * 0.12, py + h * 0.1);
      x.lineTo(px + h * 0.3, py - h * 0.25);
      x.stroke();
      stones(x, px, py, h * 0.82, 7, Math.max(1.8, z * 0.15), t, 0.2);
      break;
    }
    case K.Roost: {
      // A crag with a nest of sticks on top and feathers in the side's colour.
      x.fillStyle = ROCK_DARK;
      x.beginPath();
      x.moveTo(px, py - h * 0.96);
      x.lineTo(px + h * 0.9, py - h * 0.3);
      x.lineTo(px + h * 0.7, py + h * 0.85);
      x.lineTo(px - h * 0.6, py + h * 0.92);
      x.lineTo(px - h * 0.95, py - h * 0.2);
      x.closePath();
      x.fill();
      x.fillStyle = ROCK;
      x.beginPath();
      x.moveTo(px, py - h * 0.7);
      x.lineTo(px + h * 0.6, py - h * 0.2);
      x.lineTo(px + h * 0.42, py + h * 0.55);
      x.lineTo(px - h * 0.4, py + h * 0.6);
      x.lineTo(px - h * 0.62, py - h * 0.12);
      x.closePath();
      x.fill();
      x.strokeStyle = EARTH_DARK;
      x.lineWidth = Math.max(2, z * 0.16);
      oval(x, px, py + h * 0.02, h * 0.3, h * 0.3);
      x.stroke();
      x.fillStyle = '#e6d39c';
      x.fill();
      for (const [fa, len] of [[-2.4, 0.7], [-0.7, 0.75], [0.9, 0.62]] as const) {
        x.strokeStyle = t.fill;
        x.lineWidth = Math.max(2, z * 0.14);
        x.beginPath();
        x.moveTo(px + Math.cos(fa) * h * 0.3, py + Math.sin(fa) * h * 0.3);
        x.lineTo(px + Math.cos(fa) * h * len, py + Math.sin(fa) * h * len);
        x.stroke();
        x.strokeStyle = t.dark;
        x.lineWidth = Math.max(1, z * 0.04);
        x.stroke();
      }
      break;
    }
    case K.BonePit: {
      // A sand pit with an old skeleton in it.
      x.fillStyle = '#b9a67a';
      mound(x, px, py, h * 0.96, h * 0.9, 2);
      x.fill();
      x.fillStyle = '#eadfb8';
      mound(x, px, py, h * 0.74, h * 0.68, 4);
      x.fill();
      x.strokeStyle = IVORY;
      x.lineWidth = Math.max(1.4, z * 0.08);
      x.beginPath();
      x.moveTo(px - h * 0.42, py);
      x.lineTo(px + h * 0.34, py);
      for (const k of [-0.26, -0.08, 0.1]) {
        x.moveTo(px + h * k, py - h * 0.3);
        x.quadraticCurveTo(px + h * (k + 0.1), py, px + h * k, py + h * 0.3);
      }
      x.stroke();
      x.strokeStyle = 'rgba(90,70,40,0.55)';
      x.lineWidth = Math.max(1, z * 0.03);
      x.stroke();
      x.fillStyle = IVORY;
      oval(x, px + h * 0.44, py, h * 0.15, h * 0.12);
      x.fill();
      x.stroke();
      stones(x, px, py, h * 0.84, 7, Math.max(1.8, z * 0.15), t, 0.6);
      break;
    }
    case K.Cave: {
      // The biggest rock on the table, with a mouth full of teeth.
      x.fillStyle = '#6f675c';
      mound(x, px, py, h * 0.97, h * 0.93, 6);
      x.fill();
      x.strokeStyle = '#463f36';
      x.lineWidth = line * 1.3;
      x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.13)';
      oval(x, px - h * 0.2, py - h * 0.42, h * 0.5, h * 0.24, -0.3);
      x.fill();
      x.fillStyle = '#1d1712';
      x.beginPath();
      x.arc(px, py + h * 0.45, h * 0.6, Math.PI, 0);
      x.closePath();
      x.fill();
      x.fillStyle = IVORY;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + ((i + 0.5) / 5) * Math.PI;
        const tx = px + Math.cos(a) * h * 0.58, ty = py + h * 0.45 + Math.sin(a) * h * 0.58;
        x.beginPath();
        x.moveTo(tx - h * 0.06, ty);
        x.lineTo(tx + h * 0.06, ty);
        x.lineTo(px + Math.cos(a) * h * 0.38, py + h * 0.45 + Math.sin(a) * h * 0.38);
        x.closePath();
        x.fill();
      }
      x.strokeStyle = t.fill;
      x.lineWidth = Math.max(2.2, z * 0.18);
      x.beginPath();
      x.arc(px, py + h * 0.45, h * 0.72, Math.PI * 1.1, Math.PI * 1.9);
      x.stroke();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1, z * 0.04);
      x.beginPath();
      x.arc(px, py + h * 0.45, h * 0.82, Math.PI * 1.1, Math.PI * 1.9);
      x.stroke();
      break;
    }
    case K.Volcano: {
      // A cone seen from above: slopes, rim, and a crater that glows.
      const glow = 0.75 + 0.25 * Math.sin(now / 240 + px * 0.01);
      x.fillStyle = '#7a5a3c';
      mound(x, px, py, h * 0.96, h * 0.96, 8);
      x.fill();
      x.strokeStyle = t.fill;
      x.lineWidth = Math.max(2, z * 0.14);
      x.stroke();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1, z * 0.04);
      oval(x, px, py, h * 0.98, h * 0.98);
      x.stroke();
      x.fillStyle = '#5e4530';
      oval(x, px, py, h * 0.66, h * 0.66);
      x.fill();
      if (detail) {
        x.strokeStyle = 'rgba(40,28,18,0.55)';
        x.lineWidth = Math.max(1, z * 0.05);
        x.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + 0.3;
          x.moveTo(px + Math.cos(a) * h * 0.42, py + Math.sin(a) * h * 0.42);
          x.lineTo(px + Math.cos(a) * h * 0.9, py + Math.sin(a) * h * 0.9);
        }
        x.stroke();
      }
      x.fillStyle = '#3a2418';
      oval(x, px, py, h * 0.4, h * 0.4);
      x.fill();
      x.fillStyle = `rgba(255,${Math.round(110 + 70 * glow)},40,${0.85 * glow + 0.1})`;
      oval(x, px, py, h * 0.29, h * 0.29);
      x.fill();
      x.fillStyle = `rgba(255,240,160,${0.6 * glow})`;
      oval(x, px - h * 0.05, py - h * 0.05, h * 0.12, h * 0.12);
      x.fill();
      break;
    }
  }
}

/** What a dinosaur's attack looks like at `k` (0 to 1) through its short life. Returns false for kinds it doesn't draw. */
export function drawDinoHit(x: Ctx, kind: number, x1: number, y1: number, x2: number, y2: number, z: number, k: number): boolean {
  switch (kind) {
    case K.Raptor:
    case K.Horn:
    case K.Rex:
    case K.Ptero: {
      // Teeth, horns and beaks: a quick slash across what was hit.
      const big = kind === K.Rex ? 1.7 : kind === K.Horn ? 1.3 : 1;
      const r = z * 0.26 * big, a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      x.strokeStyle = `rgba(255,255,255,${0.95 * (1 - k)})`;
      x.lineWidth = Math.max(1.4, z * 0.07 * big);
      x.lineCap = 'round';
      x.beginPath();
      for (const o of kind === K.Raptor || kind === K.Ptero ? [0] : [-0.5, 0.5]) {
        const ox = Math.cos(a - Math.PI / 2) * o * r, oy = Math.sin(a - Math.PI / 2) * o * r;
        const reach = r * (0.5 + k * 0.7);
        x.moveTo(x2 + ox - Math.cos(a) * reach, y2 + oy - Math.sin(a) * reach);
        x.lineTo(x2 + ox + Math.cos(a) * reach, y2 + oy + Math.sin(a) * reach);
      }
      x.stroke();
      return true;
    }
    case K.Bronto: {
      // A stomp: dust rolling out to the edge of what it shook.
      const r = (def(K.Bronto).splash / TILE) * z;
      x.strokeStyle = `rgba(150,118,78,${0.75 * (1 - k)})`;
      x.lineWidth = Math.max(2, z * 0.2 * (1 - k * 0.6));
      oval(x, x2, y2, r * (0.3 + 0.7 * k), r * (0.3 + 0.7 * k) * 0.82);
      x.stroke();
      x.fillStyle = `rgba(190,160,115,${0.3 * (1 - k)})`;
      x.fill();
      return true;
    }
    case K.Spitter: {
      // A gob of something green, and the splat it makes.
      const fly = Math.min(1, k / 0.6);
      if (fly < 1) {
        x.fillStyle = '#7fd04a';
        oval(x, x1 + (x2 - x1) * fly, y1 + (y2 - y1) * fly, Math.max(1.6, z * 0.09), Math.max(1.6, z * 0.09));
        x.fill();
        x.strokeStyle = 'rgba(60,110,30,0.8)';
        x.lineWidth = 1;
        x.stroke();
      } else {
        const q = (k - 0.6) / 0.4;
        x.fillStyle = `rgba(127,208,74,${0.7 * (1 - q)})`;
        oval(x, x2, y2, z * (0.12 + 0.2 * q), z * (0.1 + 0.16 * q));
        x.fill();
      }
      return true;
    }
    case K.Volcano: {
      // A lump of lava lobbed up and over.
      const fly = Math.min(1, k / 0.75);
      if (fly < 1) {
        const gx = x1 + (x2 - x1) * fly, gy = y1 + (y2 - y1) * fly;
        const up = Math.sin(fly * Math.PI) * Math.min(z * 2, Math.hypot(x2 - x1, y2 - y1) * 0.3);
        x.fillStyle = 'rgba(0,0,0,0.2)';
        oval(x, gx, gy, z * 0.12, z * 0.08);
        x.fill();
        x.fillStyle = '#ff8a2a';
        oval(x, gx, gy - up, Math.max(2, z * 0.13), Math.max(2, z * 0.13));
        x.fill();
        x.fillStyle = '#ffe07a';
        oval(x, gx - 1, gy - up - 1, Math.max(1, z * 0.06), Math.max(1, z * 0.06));
        x.fill();
      } else {
        const q = (k - 0.75) / 0.25;
        x.fillStyle = `rgba(255,140,40,${0.7 * (1 - q)})`;
        oval(x, x2, y2, z * (0.15 + 0.3 * q), z * (0.15 + 0.3 * q));
        x.fill();
      }
      return true;
    }
  }
  return false;
}
