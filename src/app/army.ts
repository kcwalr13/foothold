// The Green Army, painted: plastic soldiers on their bases, die-cast vehicles and the playset they fight from.
// Every piece is moulded in its side's colour, so a glance tells you whose it is; shape tells you what it is.
import { def } from '../sim/data';
import { K, W, type Entity } from '../sim/types';
import { BLOCK_COLOURS, GOLD, IVORY, PENCIL, STEEL, brush, flash, home, kick, shadow, smoke, stamp, type Anim, type BuildingLook, type Pen, type Stage, type Team } from './toys';

const TAU = Math.PI * 2;
const HAT = '#f7c531', SAND = '#dcc9a0', SAND_DARK = '#a88f5f', RED = '#d9463d', TARMAC = '#7b766b', GLASS = '#cfeef2', WOOD = '#c2935a';

// ------------------------------------------------------------------ soldiers

/** The base a figure stands on. Its outline is how you tell the infantry apart from far off. */
function paintBase(p: Pen, t: Team, kind: number): void {
  if (kind === K.Captain) {
    // The Captain's base is the biggest on the table, and rimmed in gold.
    p.o(GOLD, 0, 0, 0.43).o(t.fill, 0, 0, 0.375).o(t.dark, 0, 0, 0.325).o(t.fill, 0, 0, 0.29);
  } else if (kind === K.Bayonet) {
    // A shield of a base, point forward: the one that goes in first.
    p.p(t.fill, [0.4, 0, 0.14, 0.31, -0.3, 0.27, -0.3, -0.27, 0.14, -0.31]);
    p.p(t.dark, [0.31, 0, 0.1, 0.235, -0.225, 0.205, -0.225, -0.205, 0.1, -0.235]).p(t.fill, [0.26, 0, 0.08, 0.195, -0.185, 0.17, -0.185, -0.17, 0.08, -0.195]);
  } else if (kind === K.Lancer) {
    p.b(t.fill, 0, 0, 0.6, 0.6, 0.12);
    p.b(t.dark, 0, 0, 0.5, 0.5, 0.09).b(t.fill, 0, 0, 0.44, 0.44, 0.07);
  } else if (kind === K.Runner) {
    p.p(t.fill, [0.42, 0, -0.26, 0.32, -0.13, 0, -0.26, -0.32]);
    p.p(t.dark, [0.3, 0, -0.18, 0.23, -0.09, 0, -0.18, -0.23]).p(t.fill, [0.25, 0, -0.14, 0.18, -0.06, 0, -0.14, -0.18]);
  } else {
    const r = kind === K.Mortar ? 0.39 : kind === K.Worker ? 0.25 : 0.3;
    p.o(t.fill, 0, 0, r).o(t.dark, 0, 0, r - 0.045).o(t.fill, 0, 0, r - 0.075);
  }
}

/** The figure itself, seen from above and facing right: pack, shoulders, arms, weapon, helmet. */
function paintFigure(p: Pen, t: Team, kind: number, ready: boolean): void {
  switch (kind) {
    case K.Captain:
      // Broader than a Trooper, a rifle at the shoulder, and an officer's cap with a gold star on it.
      p.b(t.dark, -0.17, 0, 0.14, 0.27, 0.05);
      p.o(t.dark, 0, 0, 0.145, 0.275);
      p.l(t.dark, 0.1, [0.02, 0.22, 0.24, 0.13]).l(t.dark, 0.1, [0.03, -0.22, 0.35, 0.04]);
      p.l(t.ink, 0.075, [0.07, 0.14, 0.6, 0.055]);
      p.o(t.light, 0.02, 0, 0.165);
      p.o(t.ink, 0.13, 0, 0.075, 0.15);
      star(p, GOLD, 0.0, 0, 0.09);
      break;
    case K.Bayonet:
      // Both hands on a rifle levelled at the hip, and a blade on the end of it: pale, so it shows on any colour.
      p.b(t.dark, -0.13, 0, 0.11, 0.2, 0.04);
      p.o(t.dark, 0, 0, 0.12, 0.225);
      p.l(t.dark, 0.085, [0.01, 0.18, 0.16, 0.1]).l(t.dark, 0.085, [0.03, -0.18, 0.31, 0.0]);
      p.l(t.ink, 0.07, [-0.06, 0.13, 0.42, 0.03]);
      p.p(t.ink, [0.4, 0.075, 0.69, 0.005, 0.4, -0.02]).p(IVORY, [0.43, 0.05, 0.64, 0.008, 0.43, -0.002]);
      p.o(t.light, 0.03, 0, 0.13).o(t.fill, -0.01, 0.0, 0.05, 0.09);
      p.l(t.ink, 0.035, [0.06, -0.1, 0.06, 0.1]);
      break;
    case K.Trooper:
      p.b(t.dark, -0.13, 0, 0.11, 0.2, 0.04);
      p.o(t.dark, 0, 0, 0.115, 0.215);
      p.l(t.dark, 0.08, [0.02, 0.17, 0.19, 0.1]).l(t.dark, 0.08, [0.03, -0.17, 0.28, 0.03]);
      p.l(t.ink, 0.06, [0.05, 0.11, 0.47, 0.045]);
      p.o(t.light, 0.03, 0, 0.125).o(t.fill, -0.01, 0.0, 0.05, 0.085);
      break;
    case K.Lancer:
      p.b(t.dark, -0.12, 0.04, 0.12, 0.2, 0.04);
      p.o(t.dark, 0, 0.03, 0.12, 0.21);
      p.l(t.dark, 0.08, [0.02, -0.12, 0.14, -0.15]).l(t.dark, 0.08, [0.02, 0.2, 0.16, -0.08]);
      // The launcher over one shoulder, its warhead red so it is never mistaken for a rifle.
      p.l(t.ink, 0.13, [-0.3, -0.15, 0.3, -0.15]);
      p.l(t.light, 0.13, [-0.06, -0.15, -0.01, -0.15]);
      p.o(RED, 0.37, -0.15, 0.085, 0.07);
      p.o(t.light, 0.03, 0.04, 0.125).o(t.fill, -0.01, 0.04, 0.05, 0.085);
      break;
    case K.Runner:
      p.o(t.dark, -0.03, 0, 0.1, 0.18);
      p.l(t.dark, 0.075, [0, 0.15, -0.13, 0.2]).l(t.dark, 0.075, [0, -0.15, 0.17, -0.1]);
      p.l(t.ink, 0.055, [0.1, -0.11, 0.36, -0.07]);
      p.o(t.light, 0.05, 0, 0.115);
      p.l(t.ink, 0.04, [0.11, -0.085, 0.11, 0.085]);
      break;
    case K.Mortar:
      p.o(t.dark, -0.15, 0.12, 0.1, 0.16);
      p.l(t.dark, 0.075, [-0.12, 0.02, 0.0, -0.08]);
      if (ready) {
        // Legs out, baseplate down, a shell at the lip: ready to fire.
        p.l(PENCIL, 0.04, [0.3, -0.1, 0.18, -0.3]).l(PENCIL, 0.04, [0.3, -0.1, 0.2, 0.1]);
        p.o(t.ink, 0.0, -0.1, 0.11);
        p.l(t.ink, 0.13, [0.0, -0.1, 0.44, -0.1]);
        p.o(HAT, 0.45, -0.1, 0.055);
      } else {
        p.l(t.ink, 0.13, [-0.02, -0.1, 0.3, -0.1]);
      }
      p.o(t.light, -0.13, 0.12, 0.115).o(t.fill, -0.16, 0.12, 0.05, 0.08);
      break;
    default:
      // A Worker: bare arms out in front and a yellow hard hat.
      p.o(t.dark, -0.01, 0, 0.1, 0.18);
      p.l(t.dark, 0.07, [0, 0.15, 0.16, 0.1]).l(t.dark, 0.07, [0, -0.15, 0.16, -0.1]);
      p.o(HAT, 0.02, 0, 0.115).o('#fbe08a', 0.04, -0.02, 0.05);
      break;
  }
}

const MUZZLE: Record<number, [number, number, number]> = {
  [K.Trooper]: [0.52, 0.045, 0.16],
  [K.Lancer]: [0.48, -0.15, 0.22],
  [K.Runner]: [0.42, -0.07, 0.13],
  [K.Mortar]: [0.52, -0.1, 0.24],
  [K.Tank]: [0.74, 0, 0.3],
  [K.Flak]: [0.78, 0, 0.2],
  [K.Jugger]: [0.98, 0, 0.36],
  [K.Gunship]: [0.5, 0, 0.2],
  [K.Captain]: [0.62, 0.055, 0.2],
};

/** How big a square a figure's base and body are painted in: the Captain is a size up from everyone else. */
const baseHalf = (kind: number): number => (kind === K.Captain ? 0.52 : 0.46);
const bodyHalf = (kind: number): number => (kind === K.Captain || kind === K.Bayonet ? 0.74 : 0.56);

function drawInfantry(st: Stage, e: Entity, px: number, py: number, an: Anim, t: Team, size: number): void {
  const { z, toys, now } = st;
  const ready = e.kind === K.Mortar && e.still >= def(K.Mortar).setup;
  const base = toys.get(`a${e.kind}b${e.owner}`, z, baseHalf(e.kind), (p) => paintBase(p, t, e.kind), t.ink);
  const body = toys.get(`a${e.kind}f${e.owner}${ready ? 'r' : ''}`, z, bodyHalf(e.kind), (p) => paintFigure(p, t, e.kind, ready), t.ink);
  const face = an.aim, cos = Math.cos(face), sin = Math.sin(face);
  // The base stays flat on the table; the figure on it rocks as it walks and jolts as it fires.
  shadow(st, base, px, py, face, size, 0.06);
  stamp(st, base, px, py, face, size);
  const since = now - (st.fired.get(e.id) ?? -1e9);
  // A shot kicks the figure back; a Bayonet's thrust carries it forward, to the length of its arms.
  const back = e.kind === K.Bayonet ? kick(since, 240) * -0.2
    : kick(since, e.kind === K.Lancer || e.kind === K.Mortar ? 320 : 150) * (e.kind === K.Lancer || e.kind === K.Mortar ? 0.07 : 0.04);
  const stride = Math.sin(an.step * 13) * an.go;
  if (an.go > 0.05 && z >= 15) {
    // Boots, one ahead and one behind, swapping with every step.
    const p = brush(st, px, py, face);
    p.o(t.ink, 0.02 + stride * 0.11, 0.085, 0.075 * size, 0.05 * size).o(t.ink, 0.02 - stride * 0.11, -0.085, 0.075 * size, 0.05 * size);
  }
  const fwd = (stride * 0.025 - back) * z, breathe = 1 + Math.sin(now / 620 + e.id * 1.3) * 0.02 * (1 - an.go);
  stamp(st, body, px + cos * fwd, py + sin * fwd, face + stride * 0.1, size * breathe);

  if (e.kind === K.Worker) {
    const p = brush(st, px + cos * fwd, py + sin * fwd, face);
    if (e.carry > 0 && e.cargo === 1) {
      p.o(STEEL, 0.25, 0, 0.13).o('#e98f1f', 0.25, 0, 0.09).o('#ffd27a', 0.27, -0.02, 0.035);
    } else if (e.carry > 0) {
      p.b(PENCIL, 0.26, 0, 0.26, 0.26, 0.03).b(BLOCK_COLOURS[e.id % 4]!, 0.26, 0, 0.2, 0.2, 0.02);
    } else if (e.ws === W.Build) {
      // Hammering: the arm comes down twice a second.
      const swing = Math.abs(Math.sin(now / 160 + e.id)) * 0.7;
      p.l(PENCIL, 0.05, [0.12, 0.08, 0.12 + Math.cos(swing) * 0.24, 0.08 - Math.sin(swing) * 0.24]);
      p.o(STEEL, 0.12 + Math.cos(swing) * 0.26, 0.08 - Math.sin(swing) * 0.26, 0.06);
    }
  }
  const m = MUZZLE[e.kind];
  if (m && since < 90) flash(st, px + (cos * m[0] - sin * m[1]) * z * size, py + (sin * m[0] + cos * m[1]) * z * size, face, m[2], since / 90);
  home(st);
}

// ------------------------------------------------------------------ vehicles

/** Treads and hull, facing right. `f` is one of three tread positions, so the links run as it drives. */
function paintHull(p: Pen, t: Team, kind: number, f: number): void {
  const big = kind === K.Jugger;
  const len = big ? 1.22 : kind === K.Tank ? 0.94 : 0.9, wid = big ? 0.98 : kind === K.Tank ? 0.74 : 0.7;
  const tw = big ? 0.25 : 0.19, ty = wid / 2 - tw / 2;
  for (const side of [-1, 1]) {
    p.b(t.ink, 0, side * ty, len, tw, 0.07);
    for (let i = -4; i <= 4; i++) {
      const lx = (i + f / 3) * (len / 8.5);
      if (Math.abs(lx) < len / 2 - 0.04) p.l('#6f6f6a', 0.03, [lx, side * ty - tw * 0.36, lx, side * ty + tw * 0.36]);
    }
  }
  const hw = wid - tw * 1.25;
  if (big) {
    // A wedge of a hull with skirts over the treads.
    p.p(t.fill, [len / 2 - 0.02, -hw * 0.3, len / 2 - 0.02, hw * 0.3, len / 2 - 0.2, hw / 2, -len / 2 + 0.05, hw / 2, -len / 2 + 0.05, -hw / 2, len / 2 - 0.2, -hw / 2]).k(t.ink, 0.05);
    for (const side of [-1, 1]) p.b(t.dark, -0.04, side * (ty - 0.02), len * 0.72, tw * 0.5, 0.04).k(t.ink, 0.035);
    p.b(t.dark, -len / 2 + 0.2, 0, 0.22, hw * 0.74, 0.04);
    for (const gy of [-0.14, 0, 0.14]) p.l(t.ink, 0.035, [-len / 2 + 0.12, gy, -len / 2 + 0.28, gy]);
    p.p(t.light, [len / 2 - 0.06, -hw * 0.24, len / 2 - 0.06, hw * 0.24, len / 2 - 0.2, hw * 0.4, len / 2 - 0.2, -hw * 0.4]);
  } else if (kind === K.Flak) {
    // A half-track: a cab up front and an open bed for the guns.
    p.b(t.fill, 0, 0, len * 0.96, hw, 0.07).k(t.ink, 0.045);
    p.b(t.dark, -0.14, 0, 0.5, hw * 0.8, 0.05);
    p.b(t.fill, 0.28, 0, 0.26, hw * 0.86, 0.06).k(t.ink, 0.035);
    p.b(GLASS, 0.33, 0, 0.07, hw * 0.6, 0.02);
  } else {
    p.b(t.fill, 0, 0, len * 0.96, hw, 0.08).k(t.ink, 0.045);
    p.b(t.dark, -len / 2 + 0.17, 0, 0.2, hw * 0.74, 0.04);
    for (const gy of [-0.09, 0, 0.09]) p.l(t.ink, 0.03, [-len / 2 + 0.1, gy, -len / 2 + 0.24, gy]);
    p.p(t.light, [len / 2 - 0.05, -hw * 0.36, len / 2 - 0.05, hw * 0.36, len / 2 - 0.16, hw * 0.44, len / 2 - 0.16, -hw * 0.44]);
  }
}

/** The turret and its guns, about the point they turn on. */
function paintTurret(p: Pen, t: Team, kind: number): void {
  if (kind === K.Jugger) {
    for (const side of [-1, 1]) {
      p.l(t.ink, 0.12, [0.16, side * 0.115, 0.84, side * 0.115]);
      p.l(t.ink, 0.16, [0.74, side * 0.115, 0.84, side * 0.115]);
    }
    p.p(t.fill, [0.34, -0.2, 0.34, 0.2, 0.14, 0.33, -0.36, 0.29, -0.42, 0, -0.36, -0.29, 0.14, -0.33]).k(t.ink, 0.05);
    p.p(t.light, [0.24, -0.15, 0.24, 0.15, 0.1, 0.23, -0.26, 0.2, -0.26, -0.2, 0.1, -0.23]);
    p.o(t.fill, -0.1, 0.09, 0.09).k(t.ink, 0.035);
    p.o(t.dark, -0.1, -0.11, 0.06);
  } else if (kind === K.Flak) {
    for (const side of [-1, 1]) p.l(t.ink, 0.06, [0.0, side * 0.085, 0.72, side * 0.085]);
    p.o(t.dark, 0, 0, 0.19).k(t.ink, 0.04);
    p.b(t.light, 0.02, 0, 0.16, 0.3, 0.04).k(t.ink, 0.035);
    p.o(t.fill, -0.1, 0.15, 0.07).o(t.fill, -0.1, -0.15, 0.07);
  } else {
    p.l(t.ink, 0.1, [0.1, 0, 0.64, 0]);
    p.l(t.ink, 0.15, [0.56, 0, 0.64, 0]);
    p.s(t.fill, [0.26, -0.2, 0.26, 0.2, -0.1, 0.24, -0.34, 0.14, -0.34, -0.14, -0.1, -0.24]).k(t.ink, 0.045);
    p.o(t.light, -0.02, 0, 0.13, 0.12);
    p.o(t.fill, -0.03, 0.02, 0.07).k(t.ink, 0.03);
  }
}

function drawVehicle(st: Stage, e: Entity, px: number, py: number, an: Anim, t: Team, size: number): void {
  const { z, toys, now } = st;
  const frame = ((Math.floor(an.step / 0.07) % 3) + 3) % 3;
  const hull = toys.get(`a${e.kind}h${e.owner}${frame}`, z, e.kind === K.Jugger ? 0.72 : 0.56, (p) => paintHull(p, t, e.kind, frame), t.ink);
  const top = toys.get(`a${e.kind}t${e.owner}`, z, e.kind === K.Jugger ? 0.92 : 0.76, (p) => paintTurret(p, t, e.kind), t.ink);
  const since = now - (st.fired.get(e.id) ?? -1e9);
  const heavy = e.kind === K.Flak ? 0.4 : 1;
  const back = kick(since, 260) * heavy;
  const ac = Math.cos(an.aim), as = Math.sin(an.aim);
  // The whole hull rocks back from its own gun, and shivers a little on the move.
  const hx = px - ac * back * 0.04 * z, hy = py - as * back * 0.04 * z + Math.sin(an.step * 40) * 0.008 * z * an.go;
  if (an.go > 0.3 && z >= 15) {
    // Dust off the back of the treads.
    const p = brush(st, hx, hy, an.head), len = e.kind === K.Jugger ? 0.66 : 0.5;
    for (let i = 0; i < 2; i++) {
      const k = (an.step * 2.2 + i * 0.5) % 1;
      st.x.globalAlpha = 0.34 * (1 - k) * an.go;
      p.o('#b8a888', -len - k * 0.34, (i ? 0.22 : -0.22) + Math.sin(e.id + i) * 0.04, 0.08 + k * 0.12);
    }
    st.x.globalAlpha = 1;
  }
  shadow(st, hull, hx, hy, an.head, size, 0.07, 0.26);
  stamp(st, hull, hx, hy, an.head, size);
  const pivot = e.kind === K.Flak ? -0.16 : -0.05;
  const tx = hx + Math.cos(an.head) * pivot * z * size - ac * back * 0.07 * z, ty = hy + Math.sin(an.head) * pivot * z * size - as * back * 0.07 * z;
  stamp(st, top, tx, ty, an.aim, size);
  const m = MUZZLE[e.kind]!;
  if (since < 110) {
    if (e.kind === K.Jugger || e.kind === K.Flak) {
      const off = (e.kind === K.Jugger ? 0.115 : 0.085) * z * size * (Math.floor(now / 55) % 2 ? 1 : -1);
      flash(st, tx + ac * m[0] * z * size - as * off, ty + as * m[0] * z * size + ac * off, an.aim, m[2], since / 110);
    } else {
      flash(st, tx + ac * m[0] * z * size, ty + as * m[0] * z * size, an.aim, m[2], since / 110);
    }
  }
  home(st);
}

// ------------------------------------------------------------------ the Gunship

function paintGunship(p: Pen, t: Team): void {
  p.l(t.dark, 0.1, [-0.12, 0, -0.66, 0]).k(t.ink, 0.16);
  p.l(t.dark, 0.1, [-0.12, 0, -0.66, 0]);
  p.b(t.fill, -0.66, 0, 0.1, 0.32, 0.04).k(t.ink, 0.04);
  p.b(t.dark, 0.0, 0, 0.16, 0.86, 0.05).k(t.ink, 0.04);
  for (const side of [-1, 1]) p.b(t.ink, 0.03, side * 0.4, 0.3, 0.1, 0.05).o(RED, 0.19, side * 0.4, 0.035);
  p.s(t.fill, [0.56, 0, 0.3, 0.26, -0.18, 0.2, -0.36, 0, -0.18, -0.2, 0.3, -0.26]).k(t.ink, 0.045);
  p.s(t.light, [0.3, 0, 0.14, 0.13, -0.16, 0.1, -0.16, -0.1, 0.14, -0.13]);
  p.s(GLASS, [0.5, 0, 0.36, 0.13, 0.2, 0.1, 0.2, -0.1, 0.36, -0.13]).k(t.ink, 0.035);
}

export function drawGunship(st: Stage, e: Entity, px: number, py: number, an: Anim, t: Team, size: number): void {
  const { x, z, toys, now } = st;
  const body = toys.get(`a8${e.owner}`, z, 0.86, (p) => paintGunship(p, t), t.ink);
  const up = z * (0.2 + Math.sin(now / 420 + e.id) * 0.025), a = an.aim;
  shadow(st, body, px + z * 0.2, py + z * 0.34, a, size * 0.92, 0, 0.2);
  stamp(st, body, px, py - up, a, size);
  const since = now - (st.fired.get(e.id) ?? -1e9);
  if (since < 100) {
    const side = (Math.floor(now / 60) % 2 ? 1 : -1) * 0.4 * z;
    flash(st, px + Math.cos(a) * 0.3 * z - Math.sin(a) * side, py - up + Math.sin(a) * 0.3 * z + Math.cos(a) * side, a, 0.2, since / 100);
  }
  // The rotor: a faint disc, and two blades that are mostly blur.
  const p = brush(st, px + Math.cos(a) * 0.02 * z, py - up + Math.sin(a) * 0.02 * z, now / 38 + e.id);
  x.globalAlpha = 0.14;
  p.o('#20241c', 0, 0, 0.62 * size);
  x.globalAlpha = 0.5;
  p.l(STEEL, 0.07, [-0.62 * size, 0, 0.62 * size, 0]).l(STEEL, 0.07, [0, -0.62 * size, 0, 0.62 * size]);
  x.globalAlpha = 1;
  p.o(t.ink, 0, 0, 0.07);
  home(st);
}

/** Any Green Army unit that walks or drives. */
export function drawArmyUnit(st: Stage, e: Entity, px: number, py: number, an: Anim, t: Team, size: number): void {
  if (e.kind === K.Tank || e.kind === K.Flak || e.kind === K.Jugger) drawVehicle(st, e, px, py, an, t, size);
  else drawInfantry(st, e, px, py, an, t, size);
}

/** A unit lying where it fell: `k` runs 0 to 1 as it tips over and fades into the paper. */
export function drawArmyFallen(st: Stage, kind: number, owner: number, px: number, py: number, face: number, t: Team, k: number): void {
  const { x, z, toys } = st;
  const base = toys.get(`a${kind}b${owner}`, z, baseHalf(kind), (p) => paintBase(p, t, kind), t.ink);
  const body = toys.get(`a${kind}f${owner}`, z, bodyHalf(kind), (p) => paintFigure(p, t, kind, false), t.ink);
  const tip = Math.min(1, k * 5);
  x.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  // Knocked flat: the base swings up on edge and the figure lies along the ground beside it.
  const d = st.toys.dpr, a = face + 0.9 * tip, c = Math.cos(a) * d, n = Math.sin(a) * d, squash = 1 - 0.62 * tip;
  x.setTransform(c * squash, n * squash, -n, c, (px - Math.cos(face) * 0.14 * tip * z) * d, (py - Math.sin(face) * 0.14 * tip * z) * d);
  toys.put(x, base, z);
  x.setTransform(c, n, -n * (1 - 0.3 * tip), c * (1 - 0.3 * tip), (px + Math.cos(face) * 0.1 * tip * z) * d, (py + Math.sin(face) * 0.1 * tip * z) * d);
  toys.put(x, body, z);
  x.globalAlpha = 1;
  home(st);
}

// ------------------------------------------------------------------ buildings

function star(p: Pen, c: string, cx: number, cy: number, r: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.p(c, pts);
}

function sandbags(p: Pen, cx: number, cy: number, rad: number, n: number, from = 0, to = TAU): void {
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * (i + 0.5)) / n;
    p.o(SAND, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 0.2, 0.125, a + Math.PI / 2).k(SAND_DARK, 0.03);
  }
}

/** A playset piece from above, standing on a plate of its side's plastic. */
function paintBuilding(p: Pen, t: Team, kind: number): void {
  switch (kind) {
    case K.Collector: {
      // A toy-box tray in its side's colour, heaped with Blocks. Both factions keep theirs in the same kind.
      p.b(t.dark, 0, 0, 1.86, 1.86, 0.26);
      p.b(t.fill, 0, 0, 1.58, 1.58, 0.16).k(t.ink, 0.06);
      p.b(t.light, 0, 0, 1.3, 1.3, 0.1).k(t.ink, 0.035);
      const heap: readonly [number, number, number][] = [[-0.33, -0.3, 0], [0.3, -0.33, 1], [-0.3, 0.33, 2], [0.33, 0.3, 3]];
      for (const [cx, cy, c] of heap) p.b(PENCIL, cx, cy, 0.56, 0.56, 0.06).b(BLOCK_COLOURS[c]!, cx, cy, 0.46, 0.46, 0.04);
      // One more on top, askew.
      const x = p.x;
      x.save();
      x.rotate(0.5);
      p.b(PENCIL, 0, -0.02, 0.56, 0.56, 0.06).b(BLOCK_COLOURS[2], 0, -0.02, 0.46, 0.46, 0.04).b('#f6d67a', -0.08, -0.1, 0.16, 0.14, 0.03);
      x.restore();
      break;
    }
    case K.HQ: {
      // A fort: four walls, a tower at each corner, a keep with a star on its roof.
      p.b(t.dark, 0, 0, 3.84, 3.84, 0.34);
      p.b(t.fill, 0, 0, 3.36, 3.36, 0.2).k(t.ink, 0.06);
      p.b(t.dark, 0, 0, 2.56, 2.56, 0.12).k(t.ink, 0.05);
      for (let i = -2; i <= 2; i++) {
        if (i !== 0) p.b(t.light, i * 0.5, 1.48, 0.26, 0.16, 0.04);
        p.b(t.light, i * 0.5, -1.48, 0.26, 0.16, 0.04).b(t.light, -1.48, i * 0.5, 0.16, 0.26, 0.04).b(t.light, 1.48, i * 0.5, 0.16, 0.26, 0.04);
      }
      p.b(t.ink, 0, 1.46, 0.74, 0.46, 0.06).b(WOOD, 0, 1.48, 0.56, 0.34, 0.04);
      p.l(PENCIL, 0.03, [0, 1.32, 0, 1.64]);
      for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        p.b(t.light, cx * 1.46, cy * 1.46, 0.96, 0.96, 0.16).k(t.ink, 0.06);
        p.b(t.fill, cx * 1.46, cy * 1.46, 0.56, 0.56, 0.1).k(t.ink, 0.04);
      }
      p.b(t.fill, 0, -0.12, 1.6, 1.36, 0.14).k(t.ink, 0.06);
      p.p(t.light, [-0.8, -0.8, 0.8, -0.8, 0.44, -0.12, -0.44, -0.12]);
      p.p(t.dark, [-0.8, 0.56, 0.8, 0.56, 0.44, -0.12, -0.44, -0.12]);
      p.l(t.ink, 0.04, [-0.44, -0.12, 0.44, -0.12, 0.8, -0.8]).l(t.ink, 0.04, [-0.8, -0.8, -0.44, -0.12, -0.8, 0.56]).l(t.ink, 0.04, [0.44, -0.12, 0.8, 0.56]);
      star(p, IVORY, 0, -0.46, 0.27);
      break;
    }
    case K.Barracks: {
      // A long ridge tent with a door flap, sandbags by the entrance.
      p.b(t.dark, 0, 0, 2.86, 2.86, 0.28);
      p.b(t.fill, 0, -0.16, 2.56, 1.96, 0.14).k(t.ink, 0.06);
      p.b(t.light, 0, -0.66, 2.5, 0.94, 0.1);
      p.p(t.dark, [-1.28, -1.12, -0.86, -0.16, -1.28, 0.8]).p(t.dark, [1.28, -1.12, 0.86, -0.16, 1.28, 0.8]);
      p.l(t.ink, 0.05, [-0.86, -0.16, 0.86, -0.16]).l(t.ink, 0.04, [-1.26, -1.1, -0.86, -0.16, -1.26, 0.78]).l(t.ink, 0.04, [1.26, -1.1, 0.86, -0.16, 1.26, 0.78]);
      for (const sx of [-0.43, 0, 0.43]) p.l(t.dark, 0.025, [sx, -1.1, sx, -0.2]).l(t.ink, 0.02, [sx, -0.12, sx, 0.78]);
      p.p(t.dark, [-0.4, 0.82, 0.4, 0.82, 0.52, 1.3, -0.52, 1.3]).k(t.ink, 0.05);
      p.p(t.ink, [-0.2, 0.86, 0.2, 0.86, 0.26, 1.28, -0.26, 1.28]);
      p.o(SAND, -0.98, 1.14, 0.2, 0.12, -0.3).k(SAND_DARK, 0.03);
      p.o(SAND, -0.74, 1.2, 0.2, 0.12).k(SAND_DARK, 0.03).o(SAND, 0.82, 1.16, 0.2, 0.12).k(SAND_DARK, 0.03).o(SAND, 1.04, 1.22, 0.2, 0.12, 0.3).k(SAND_DARK, 0.03);
      star(p, IVORY, 0, -0.64, 0.24);
      break;
    }
    case K.Turret: {
      // A gun pit: a ring of sandbags round a floor of the side's colour.
      p.o(t.dark, 0, 0, 0.96);
      p.o(t.fill, 0, 0, 0.6).k(t.ink, 0.05);
      sandbags(p, 0, 0, 0.74, 11);
      p.o(t.dark, 0, 0, 0.3).k(t.ink, 0.04);
      break;
    }
    case K.Refinery: {
      // A tank with a domed lid, a pump house, and the charger with its bolt.
      p.b(t.dark, 0, 0, 1.86, 1.86, 0.26);
      p.l(t.ink, 0.15, [-0.34, 0.1, -0.34, 0.52, 0.2, 0.52]).l(t.light, 0.07, [-0.34, 0.1, -0.34, 0.52, 0.2, 0.52]);
      p.b(t.fill, 0.44, -0.46, 0.56, 0.5, 0.08).k(t.ink, 0.05).b(t.light, 0.44, -0.54, 0.44, 0.2, 0.05);
      p.o(t.fill, -0.34, -0.32, 0.5).k(t.ink, 0.055).o(t.light, -0.34, -0.32, 0.36).o(t.fill, -0.34, -0.32, 0.26).o(t.dark, -0.34, -0.32, 0.09).k(t.ink, 0.03);
      p.b(HAT, 0.42, 0.42, 0.72, 0.72, 0.12).k(PENCIL, 0.055);
      p.p(PENCIL, [0.5, 0.14, 0.26, 0.48, 0.42, 0.48, 0.34, 0.72, 0.6, 0.36, 0.44, 0.36]);
      break;
    }
    case K.Factory: {
      // A saw-tooth roof in three bays, a smokestack, and a wide door with chevrons on the apron.
      p.b(t.dark, 0, 0, 2.86, 2.86, 0.28);
      p.b(t.fill, 0, -0.24, 2.6, 2.16, 0.1).k(t.ink, 0.06);
      for (let i = 0; i < 3; i++) {
        const y0 = -1.28 + i * 0.7;
        p.p(t.light, [-1.26, y0 + 0.64, 1.26, y0 + 0.06, 1.26, y0 + 0.64]);
        p.l(t.ink, 0.04, [-1.26, y0 + 0.64, 1.26, y0 + 0.64]).l(t.ink, 0.025, [-1.26, y0 + 0.64, 1.26, y0 + 0.06]);
      }
      p.b(t.dark, 0, 1.12, 1.9, 0.58, 0.06).k(t.ink, 0.05);
      p.b(STEEL, 0, 1.06, 1.24, 0.4, 0.04);
      for (const dx of [-0.42, -0.14, 0.14, 0.42]) p.l('#55524c', 0.03, [dx, 0.9, dx, 1.22]);
      for (const side of [-1, 1]) p.p(HAT, [side * 0.72, 0.9, side * 0.9, 0.9, side * 0.78, 1.34, side * 0.6, 1.34]);
      p.o(t.dark, 0.92, -0.98, 0.3).k(t.ink, 0.05).o(STEEL, 0.92, -0.98, 0.17);
      break;
    }
    case K.Airfield: {
      // A pad of tarmac with a painted H, bordered in the side's colour, and a hangar along the back.
      p.b(t.fill, 0, 0, 2.86, 2.86, 0.28);
      p.b(TARMAC, 0, 0.16, 2.46, 2.3, 0.14).k(t.ink, 0.05);
      p.r(IVORY, 0.09, 0, 0.3, 0.8);
      p.l(IVORY, 0.11, [-0.3, -0.08, -0.3, 0.68]).l(IVORY, 0.11, [0.3, -0.08, 0.3, 0.68]).l(IVORY, 0.11, [-0.3, 0.3, 0.3, 0.3]);
      for (const side of [-1, 1]) p.l(HAT, 0.05, [side * 1.08, -0.5, side * 1.08, 1.16]);
      p.b(t.fill, 0, -1.1, 2.56, 0.58, 0.1).k(t.ink, 0.06);
      p.b(t.light, 0, -1.2, 2.44, 0.22, 0.06);
      for (const dx of [-0.82, -0.27, 0.27, 0.82]) p.l(t.ink, 0.03, [dx, -1.36, dx, -0.84]);
      break;
    }
    case K.Armory: {
      // A squat bunker: a shield on the roof, crates stacked outside.
      p.b(t.dark, 0, 0, 2.86, 2.86, 0.28);
      p.b(t.fill, 0, -0.06, 2.46, 2.4, 0.36).k(t.ink, 0.06);
      p.b(t.light, 0, -0.06, 1.86, 1.8, 0.24).k(t.ink, 0.04);
      p.p(t.dark, [0, -0.78, 0.56, -0.56, 0.56, 0.0, 0.3, 0.44, 0, 0.64, -0.3, 0.44, -0.56, 0.0, -0.56, -0.56]).k(t.ink, 0.05);
      p.l(IVORY, 0.13, [0, -0.42, 0, 0.3]).l(IVORY, 0.13, [-0.3, -0.1, 0.3, -0.1]);
      p.b(WOOD, -1.0, 1.08, 0.46, 0.46, 0.04).k(PENCIL, 0.04).l(PENCIL, 0.03, [-1.2, 0.88, -0.8, 1.28]);
      p.b(WOOD, -0.5, 1.14, 0.36, 0.36, 0.04).k(PENCIL, 0.04).l(PENCIL, 0.03, [-0.66, 0.98, -0.34, 1.3]);
      break;
    }
    case K.Heavy: {
      // A steel shed with a gantry across it and hazard stripes at the door.
      p.b(t.dark, 0, 0, 2.86, 2.86, 0.28);
      p.b(STEEL, 0, 0, 2.52, 2.52, 0.14).k(t.ink, 0.06);
      p.b(t.fill, 0, -0.42, 2.24, 1.46, 0.1).k(t.ink, 0.05);
      p.b(t.light, 0, -0.84, 2.1, 0.3, 0.06);
      for (const dx of [-0.74, -0.37, 0, 0.37, 0.74]) p.l(t.dark, 0.05, [dx, -0.62, dx, 0.26]);
      const x = p.x;
      x.save();
      x.beginPath();
      x.rect(-1.16, 0.6, 2.32, 0.52);
      x.clip();
      p.b(HAT, 0, 0.86, 2.4, 0.6);
      for (let i = -5; i <= 5; i++) p.l(STEEL, 0.14, [i * 0.34 - 0.2, 1.2, i * 0.34 + 0.2, 0.5]);
      x.restore();
      p.l(t.ink, 0.2, [-1.2, 0.42, 1.2, 0.42]).l(HAT, 0.11, [-1.2, 0.42, 1.2, 0.42]);
      p.b(STEEL, 0.4, 0.42, 0.3, 0.3, 0.04).k(t.ink, 0.04);
      break;
    }
  }
}

/** The gun in a Turret's pit: a shield, a barrel and the gunner's helmet behind it. */
function paintTurretGun(p: Pen, t: Team): void {
  p.l(t.ink, 0.15, [0.0, 0, 0.98, 0]);
  p.l(t.ink, 0.2, [0.86, 0, 0.98, 0]);
  p.b(t.dark, -0.1, 0, 0.3, 0.32, 0.06).k(t.ink, 0.04);
  p.p(t.light, [0.24, -0.34, 0.34, -0.3, 0.34, 0.3, 0.24, 0.34, 0.12, 0.3, 0.12, -0.3]).k(t.ink, 0.045);
  p.o(t.light, -0.3, 0, 0.115).k(t.ink, 0.03);
}

/** A flag on a pole, rippling. */
export function pennant(st: Stage, px: number, py: number, t: Team, size: number, seed: number): void {
  const p = brush(st, px, py), w = st.now / 230 + seed;
  const tip = 0.62 * size, h = 0.3 * size;
  p.l(PENCIL, 0.05, [0, 0.12 * size, 0, -h * 2.1]);
  const y0 = -h * 2.1;
  const pts: number[] = [0, y0];
  for (let i = 1; i <= 4; i++) pts.push((tip * i) / 4, y0 + Math.sin(w + i * 1.1) * 0.05 * size * (i / 2) + (i === 4 ? h * 0.5 : 0));
  for (let i = 3; i >= 0; i--) pts.push((tip * i) / 4, y0 + h + Math.sin(w + i * 1.1) * 0.05 * size * (i / 2));
  p.p(t.flag, pts).k(t.ink, 0.045);
  p.o(HAT, 0, y0 - 0.03, 0.05);
}

/** A Green Army building, finished. The renderer draws scaffolding, damage and health over it. */
export function drawArmyBuilding(st: Stage, b: BuildingLook, px: number, py: number, t: Team): void {
  const { x, z, toys, now } = st;
  const size = def(b.kind).size;
  const s = toys.get(`a${b.kind}s${b.owner}`, z, size / 2 + 0.06, (p) => paintBuilding(p, t, b.kind), t.ink, 'top');
  shadow(st, s, px, py, 0, 1, 0.1, 0.26);
  stamp(st, s, px, py);
  if (b.plain) {
    if (b.kind === K.Turret) stamp(st, toys.get(`a22g${b.owner}`, z, 1.1, (p) => paintTurretGun(p, t), t.ink), px, py, b.aim);
    home(st);
    return;
  }
  switch (b.kind) {
    case K.HQ: {
      // A radar dish turning on one tower, and the flag over the keep.
      const p = brush(st, px + 1.46 * z, py - 1.46 * z, now / 900 + b.seed);
      p.o(t.ink, 0, 0, 0.09).l(t.ink, 0.05, [0, 0, 0.26, 0]);
      p.r(t.ink, 0.1, 0.3, 0, 0.2, Math.PI * 0.62, Math.PI * 1.38).r(IVORY, 0.05, 0.3, 0, 0.2, Math.PI * 0.62, Math.PI * 1.38);
      pennant(st, px + 0.52 * z, py - 0.1 * z, t, 1.5, b.seed);
      break;
    }
    case K.Barracks:
      pennant(st, px + 1.06 * z, py - 0.2 * z, t, 1.0, b.seed);
      if (b.busy) {
        // Boots on the ground: a light in the doorway while it trains.
        const p = brush(st, px, py);
        x.globalAlpha = 0.45 + 0.35 * Math.sin(now / 180);
        p.p('#ffd45e', [-0.18, 0.9, 0.18, 0.9, 0.23, 1.26, -0.23, 1.26]);
        x.globalAlpha = 1;
      }
      break;
    case K.Turret: {
      const gun = toys.get(`a22g${b.owner}`, z, 1.1, (p) => paintTurretGun(p, t), t.ink);
      const back = kick(b.since, 220) * 0.09 * z;
      const gx = px - Math.cos(b.aim) * back, gy = py - Math.sin(b.aim) * back;
      stamp(st, gun, gx, gy, b.aim);
      if (b.since < 110) flash(st, gx + Math.cos(b.aim) * 1.04 * z, gy + Math.sin(b.aim) * 1.04 * z, b.aim, 0.34, b.since / 110);
      break;
    }
    case K.Collector: {
      // Blocks arriving: one drops onto the heap every second, and the flag says whose they are.
      const k = (now / 1000 + b.seed) % 1, p = brush(st, px, py);
      const drop = Math.max(0, 1 - k * 3.2);
      x.globalAlpha = Math.min(1, k * 6) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      p.b(PENCIL, 0.52, -0.5 - drop * 0.5, 0.34, 0.34, 0.04).b(BLOCK_COLOURS[Math.floor(now / 1000 + b.seed) % 4]!, 0.52, -0.5 - drop * 0.5, 0.26, 0.26, 0.03);
      x.globalAlpha = 1;
      pennant(st, px - 0.74 * z, py - 0.58 * z, t, 0.8, b.seed);
      break;
    }
    case K.Refinery: {
      // The charger hums: its light swells and fades, and the pump house ticks over.
      const p = brush(st, px, py);
      x.globalAlpha = 0.22 + 0.2 * Math.sin(now / 260 + b.seed);
      p.b('#fff7c8', 0.42, 0.42, 0.6, 0.6, 0.1);
      x.globalAlpha = 1;
      p.o(Math.floor(now / 500 + b.seed) % 2 ? '#7dff6a' : t.ink, 0.6, -0.34, 0.055);
      break;
    }
    case K.Factory: {
      smoke(st, px + 0.92 * z, py - 0.98 * z, b.busy ? 1.25 : 0.7, b.seed, b.busy ? '#4a463f' : '#8d877a');
      if (b.busy) {
        const p = brush(st, px, py);
        x.globalAlpha = 0.35 + 0.3 * Math.sin(now / 150);
        p.b('#ffb347', 0, 1.06, 1.16, 0.32, 0.04);
        x.globalAlpha = 1;
      }
      break;
    }
    case K.Airfield: {
      // Lights round the pad, chasing; a windsock at the corner.
      const p = brush(st, px, py), on = Math.floor(now / 260) % 4;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        p.o(i === on || b.busy ? '#fff2a8' : t.ink, Math.cos(a) * 0.98, 0.3 + Math.sin(a) * 0.98, 0.065);
      }
      const sway = Math.sin(now / 500 + b.seed) * 0.25;
      p.l(PENCIL, 0.04, [1.12, -0.52, 1.12, -0.74]);
      p.p('#f08a1d', [1.12, -0.8, 1.12, -0.66, 1.12 + Math.cos(sway) * 0.42, -0.71 + Math.sin(sway) * 0.42]).k(PENCIL, 0.03);
      break;
    }
    case K.Armory:
      if (b.busy) {
        // Research under way: the cross on the shield glows.
        const p = brush(st, px, py);
        x.globalAlpha = 0.45 + 0.4 * Math.sin(now / 200);
        p.l('#9fe8ff', 0.2, [0, -0.48, 0, 0.24]).l('#9fe8ff', 0.2, [-0.3, -0.16, 0.3, -0.16]);
        x.globalAlpha = 1;
      }
      break;
    case K.Heavy: {
      // The hoist runs along its gantry, and a warning lamp turns.
      const p = brush(st, px, py), run = Math.sin(now / 1400 + b.seed) * 0.8;
      p.b(STEEL, run, 0.42, 0.3, 0.3, 0.04).k(t.ink, 0.04).o(HAT, run, 0.42, 0.07);
      const lamp = now / 300 + b.seed;
      x.globalAlpha = 0.5 + 0.5 * Math.sin(lamp);
      p.o('#ff8a3a', -1.02, -1.02, 0.1);
      x.globalAlpha = 1;
      break;
    }
  }
  home(st);
}

// ------------------------------------------------------------------ zoomed out

/**
 * A marker for the whole-map view: a circle is a Trooper, a square a Lancer, an arrow a Runner, a diamond a
 * Mortar. Vehicles are wide slabs, the Juggernaut the biggest; a Gunship is a cross. A dot is a Worker.
 */
export function drawArmyMarker(st: Stage, e: Entity, px: number, py: number, t: Team, face: number): void {
  const { x, z } = st;
  const r = e.kind === K.Worker ? Math.max(1.8, z * 0.22) : Math.max(3.2, z * 0.4);
  x.fillStyle = t.fill;
  x.strokeStyle = t.ink;
  x.lineWidth = 1.25;
  x.beginPath();
  if (e.kind === K.Lancer) x.rect(px - r * 0.85, py - r * 0.85, r * 1.7, r * 1.7);
  else if (e.kind === K.Bayonet) {
    // A shield, point forward.
    const c = Math.cos(face), s = Math.sin(face);
    const at = (f: number, l: number) => [px + c * f * r - s * l * r, py + s * f * r + c * l * r] as const;
    const pts = [at(1.35, 0), at(0.4, 0.95), at(-0.95, 0.85), at(-0.95, -0.85), at(0.4, -0.95)];
    x.moveTo(pts[0]![0], pts[0]![1]);
    for (const q of pts.slice(1)) x.lineTo(q[0], q[1]);
    x.closePath();
  } else if (e.kind === K.Runner) {
    const c = Math.cos(face), s = Math.sin(face);
    x.moveTo(px + c * r * 1.3, py + s * r * 1.3);
    x.lineTo(px - c * r * 0.8 - s * r, py - s * r * 0.8 + c * r);
    x.lineTo(px - c * r * 0.8 + s * r, py - s * r * 0.8 - c * r);
    x.closePath();
  } else if (e.kind === K.Mortar) {
    x.moveTo(px, py - r * 1.2);
    x.lineTo(px + r * 1.2, py);
    x.lineTo(px, py + r * 1.2);
    x.lineTo(px - r * 1.2, py);
    x.closePath();
  } else if (e.kind === K.Tank || e.kind === K.Flak || e.kind === K.Jugger) {
    const k = e.kind === K.Jugger ? 1.55 : e.kind === K.Tank ? 1.15 : 0.95;
    x.rect(px - r * 1.25 * k, py - r * 0.85 * k, r * 2.5 * k, r * 1.7 * k);
    x.lineWidth = e.kind === K.Jugger ? 2.6 : 1.8;
    if (e.kind === K.Flak) x.fillStyle = t.light;
  } else if (e.kind === K.Gunship) {
    x.fillStyle = 'rgba(0,0,0,0.2)';
    x.arc(px + 3, py + 4, r * 0.9, 0, TAU);
    x.fill();
    for (const [w, c] of [[Math.max(4, r * 0.95), t.ink], [Math.max(2.2, r * 0.55), t.fill]] as const) {
      x.beginPath();
      x.strokeStyle = c;
      x.lineWidth = w;
      x.moveTo(px - r * 1.3, py);
      x.lineTo(px + r * 1.3, py);
      x.moveTo(px, py - r * 1.3);
      x.lineTo(px, py + r * 1.3);
      x.stroke();
    }
    return;
  } else x.arc(px, py, r, 0, TAU);
  x.fill();
  x.stroke();
}

// ------------------------------------------------------------------ whole pieces, for the panels

/** How far a Green Army piece reaches from its middle when it is standing still, in tiles. */
export function armyReach(kind: number): number {
  if (def(kind).building) return def(kind).size / 2 + 0.06;
  return kind === K.Jugger ? 0.92 : kind === K.Tank || kind === K.Flak ? 0.74 : kind === K.Gunship ? 0.78 : kind === K.Captain ? 0.66 : kind === K.Bayonet ? 0.6
    : kind === K.Mortar ? 0.52 : 0.5;
}

/** A whole Green Army piece, standing still and facing right: what the buttons in the panels show. */
export function paintArmyPiece(p: Pen, t: Team, kind: number): void {
  const x = p.x;
  if (def(kind).building) {
    paintBuilding(p, t, kind);
    if (kind === K.Turret) {
      x.save();
      x.rotate(-0.5);
      paintTurretGun(p, t);
      x.restore();
    }
  } else if (kind === K.Tank || kind === K.Flak || kind === K.Jugger) {
    x.save();
    x.translate(-0.12, 0);
    paintHull(p, t, kind, 0);
    x.translate(kind === K.Flak ? -0.16 : -0.05, 0);
    paintTurret(p, t, kind);
    x.restore();
  } else if (kind === K.Gunship) {
    paintGunship(p, t);
    x.globalAlpha = 0.55;
    p.l(STEEL, 0.07, [-0.5, -0.36, 0.5, 0.36]).l(STEEL, 0.07, [-0.36, 0.5, 0.36, -0.5]);
    x.globalAlpha = 1;
    p.o(t.ink, 0, 0, 0.07);
  } else {
    x.save();
    x.translate(-0.06, 0);
    paintBase(p, t, kind);
    paintFigure(p, t, kind, kind === K.Mortar);
    if (kind === K.Worker) p.b(PENCIL, 0.26, 0, 0.26, 0.26, 0.03).b(BLOCK_COLOURS[0], 0.26, 0, 0.2, 0.2, 0.02);
    x.restore();
  }
}
