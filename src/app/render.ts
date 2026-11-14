// Draws the match: a hand-drawn paper map with toy soldiers on it. No art files; everything is drawn here.
import { def } from '../sim/data';
import { centroid, groupUnits, visibleTo, type Game } from '../sim/state';
import { C, K, O, TILE, W, type Entity, type GameMap, type Ghost } from '../sim/types';
import { INSET, type Fx, type Match } from './match';

const PX = 16; // pixels per tile in the pre-drawn map sheet

export const TEAM = [
  { fill: '#4f9440', dark: '#2f6327', light: '#86c672', flag: '#2f8f2f' },
  { fill: '#cfa262', dark: '#8c6730', light: '#ecd3a0', flag: '#c8742b' },
];
const PAPER = '#f1e6c9';
const INK = 'rgba(74,58,40,';
const BLOCK_COLOURS = ['#d9463d', '#3b78c9', '#e9b730', '#3f9b57'];
const STEEL = '#2c2c2c';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The static sheet: paper, crayon hills, pencil roads and hand-lettered names. Drawn once. */
function drawSheet(map: GameMap): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.w * PX;
  c.height = map.h * PX;
  const x = c.getContext('2d')!;
  const rnd = seeded(7);
  x.fillStyle = PAPER;
  x.fillRect(0, 0, c.width, c.height);
  // Paper grain and a few old stains.
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = `rgba(${rnd() < 0.5 ? '120,96,60' : '255,250,235'},${0.03 + rnd() * 0.05})`;
    x.fillRect(rnd() * c.width, rnd() * c.height, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 7; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 60 + rnd() * 120);
    g.addColorStop(0, 'rgba(160,125,70,0.07)');
    g.addColorStop(1, 'rgba(160,125,70,0)');
    x.save();
    x.translate(rnd() * c.width, rnd() * c.height);
    x.fillStyle = g;
    x.fillRect(-200, -200, 400, 400);
    x.restore();
  }
  // Fold creases.
  for (const fx of [c.width / 3, (2 * c.width) / 3]) {
    const g = x.createLinearGradient(fx - 5, 0, fx + 5, 0);
    g.addColorStop(0, 'rgba(90,70,40,0)');
    g.addColorStop(0.5, 'rgba(90,70,40,0.13)');
    g.addColorStop(1, 'rgba(255,255,255,0.05)');
    x.fillStyle = g;
    x.fillRect(fx - 5, 0, 10, c.height);
  }
  const gh = x.createLinearGradient(0, c.height / 2 - 5, 0, c.height / 2 + 5);
  gh.addColorStop(0, 'rgba(90,70,40,0)');
  gh.addColorStop(0.5, 'rgba(90,70,40,0.11)');
  gh.addColorStop(1, 'rgba(255,255,255,0.05)');
  x.fillStyle = gh;
  x.fillRect(0, c.height / 2 - 5, c.width, 10);

  // Pencil roads.
  x.lineCap = 'round';
  x.lineJoin = 'round';
  for (const road of map.roads) {
    for (const [w, a, dash] of [[5, 0.1, []], [1.6, 0.42, [9, 7]]] as [number, number, number[]][]) {
      x.strokeStyle = `${INK}${a})`;
      x.lineWidth = w;
      x.setLineDash(dash);
      x.beginPath();
      road.forEach((p, i) => {
        const px = p.x * PX, py = p.y * PX;
        if (i === 0) x.moveTo(px, py);
        else {
          const q = road[i - 1]!;
          x.quadraticCurveTo(((q.x + p.x) / 2) * PX + (rnd() - 0.5) * 18, ((q.y + p.y) / 2) * PX + (rnd() - 0.5) * 18, px, py);
        }
      });
      x.stroke();
    }
  }
  x.setLineDash([]);

  // Base sites: a dotted pencil square where a Headquarters fits.
  for (const b of map.bases) {
    x.strokeStyle = `${INK}0.32)`;
    x.lineWidth = 1.4;
    x.setLineDash([4, 5]);
    x.strokeRect(b.hx * PX + 2, b.hy * PX + 2, 4 * PX - 4, 4 * PX - 4);
    x.setLineDash([]);
  }

  // High ground: a warm crayon wash, with pencil hachures down every slope you can walk.
  const rock = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && map.rock[ty * map.w + tx] === 1;
  const high = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < map.w && ty < map.h && map.high[ty * map.w + tx] === 1;
  x.save();
  x.beginPath();
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) if (high(tx, ty)) x.rect(tx * PX - 0.5, ty * PX - 0.5, PX + 1, PX + 1);
  x.clip();
  x.fillStyle = 'rgba(222,190,128,0.5)';
  x.fillRect(0, 0, c.width, c.height);
  x.lineWidth = 1.2;
  for (let i = -c.height; i < c.width; i += 11) {
    x.strokeStyle = `rgba(150,112,62,${0.08 + rnd() * 0.08})`;
    x.beginPath();
    x.moveTo(i + (rnd() - 0.5) * 3, 0);
    x.lineTo(i + c.height + (rnd() - 0.5) * 3, c.height);
    x.stroke();
  }
  x.restore();
  x.strokeStyle = `${INK}0.55)`;
  x.lineWidth = 1.3;
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    if (!high(tx, ty)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || rock(nx, ny) || high(nx, ny)) continue;
      // The edge between this tile and its low neighbour, and strokes running down from it.
      const ex = (tx + 0.5 + dx * 0.5) * PX, ey = (ty + 0.5 + dy * 0.5) * PX;
      for (let k = 0; k < 4; k++) {
        const along = (k - 1.5) * (PX / 4) + (rnd() - 0.5) * 1.5, len = PX * (0.55 + rnd() * 0.35);
        x.beginPath();
        x.moveTo(ex + (dy !== 0 ? along : 0), ey + (dx !== 0 ? along : 0));
        x.lineTo(ex + (dy !== 0 ? along : 0) + dx * len, ey + (dx !== 0 ? along : 0) + dy * len);
        x.stroke();
      }
    }
  }

  // Crayon hills and cliffs.
  x.save();
  x.beginPath();
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) if (rock(tx, ty)) x.rect(tx * PX - 0.5, ty * PX - 0.5, PX + 1, PX + 1);
  x.clip();
  x.fillStyle = '#c9a56a';
  x.fillRect(0, 0, c.width, c.height);
  x.lineWidth = 2.2;
  for (let i = -c.height; i < c.width; i += 6) {
    x.strokeStyle = `rgba(122,84,44,${0.2 + rnd() * 0.22})`;
    x.beginPath();
    x.moveTo(i + (rnd() - 0.5) * 3, 0);
    x.lineTo(i + c.height + (rnd() - 0.5) * 3, c.height);
    x.stroke();
  }
  for (let i = 0; i < c.width + c.height; i += 13) {
    x.strokeStyle = `rgba(150,110,60,${0.1 + rnd() * 0.14})`;
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i - c.height, c.height);
    x.stroke();
  }
  x.restore();
  x.strokeStyle = '#6d4a28';
  x.lineWidth = 2.4;
  const wob = () => (rnd() - 0.5) * 1.6;
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    if (!rock(tx, ty)) continue;
    const x0 = tx * PX, y0 = ty * PX;
    const edge = (ax: number, ay: number, bx: number, by: number) => {
      x.beginPath();
      x.moveTo(ax + wob(), ay + wob());
      x.lineTo(bx + wob(), by + wob());
      x.stroke();
    };
    if (ty > 0 && !rock(tx, ty - 1)) edge(x0, y0, x0 + PX, y0);
    if (ty < map.h - 1 && !rock(tx, ty + 1)) edge(x0, y0 + PX, x0 + PX, y0 + PX);
    if (tx > 0 && !rock(tx - 1, ty)) edge(x0, y0, x0, y0 + PX);
    if (tx < map.w - 1 && !rock(tx + 1, ty)) edge(x0 + PX, y0, x0 + PX, y0 + PX);
  }

  // Hand-lettered names.
  x.fillStyle = `${INK}0.6)`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (const l of map.labels) {
    x.save();
    x.translate(l.x * PX, l.y * PX);
    x.rotate(l.rot);
    x.font = `italic 600 ${l.small ? 11 : 17}px "Marker Felt", "Chalkboard SE", "Segoe Print", "Comic Sans MS", cursive`;
    x.fillText(l.text, 0, 0);
    x.restore();
  }
  // Worn edge.
  const eg = x.createLinearGradient(0, 0, 0, c.height);
  eg.addColorStop(0, 'rgba(120,90,50,0.16)');
  eg.addColorStop(0.04, 'rgba(120,90,50,0)');
  eg.addColorStop(0.96, 'rgba(120,90,50,0)');
  eg.addColorStop(1, 'rgba(120,90,50,0.16)');
  x.fillStyle = eg;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private sheet: HTMLCanvasElement;
  private fog: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogImg: ImageData;
  private fogStamp = -1;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement, private m: Match) {
    this.ctx = canvas.getContext('2d')!;
    this.sheet = drawSheet(m.g.map);
    this.fog = document.createElement('canvas');
    this.fog.width = m.g.map.w;
    this.fog.height = m.g.map.h;
    this.fogCtx = this.fog.getContext('2d')!;
    this.fogImg = this.fogCtx.createImageData(m.g.map.w, m.g.map.h);
    this.resize();
  }

  mapSheet(): HTMLCanvasElement {
    return this.sheet;
  }

  fogSheet(): HTMLCanvasElement {
    this.updateFog();
    return this.fog;
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.m.viewW = w;
    this.m.viewH = h;
    this.m.clampCam();
  }

  private updateFog(): void {
    if (this.fogStamp === this.m.fogStamp) return;
    this.fogStamp = this.m.fogStamp;
    const pl = this.m.g.players[this.m.me]!;
    const d = this.fogImg.data;
    for (let i = 0; i < pl.vis.length; i++) {
      const o = i * 4;
      if (pl.vis[i] === 1) {
        d[o + 3] = 0;
      } else if (pl.explored[i] === 1) {
        d[o] = 110; d[o + 1] = 96; d[o + 2] = 74; d[o + 3] = 58;
      } else {
        d[o] = 214; d[o + 1] = 208; d[o + 2] = 192; d[o + 3] = 190;
      }
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
  }

  draw(): void {
    const m = this.m, g = m.g, x = this.ctx, z = m.cam.zoom;
    const now = performance.now();
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // The table under the map.
    x.fillStyle = '#4b3a2b';
    x.fillRect(0, 0, m.viewW, m.viewH);
    const o = m.toScreen(0, 0);
    const mw = g.map.w * z, mh = g.map.h * z;
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.fillRect(o.x + 5, o.y + 6, mw, mh);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.sheet, o.x, o.y, mw, mh);

    const me = m.me, vis = g.players[me]!.vis;
    const seen = (e: { x: number; y: number }) => vis[Math.floor(e.y / TILE) * g.map.w + Math.floor(e.x / TILE)] === 1;
    const air: Entity[] = [];
    const sx = (wx: number) => o.x + (wx / TILE) * z, sy = (wy: number) => o.y + (wy / TILE) * z;
    const onScreen = (px: number, py: number, pad: number) => px > -pad && py > -pad && px < m.viewW + pad && py < m.viewH + pad;
    const detail = z >= 11;

    // Piles of Blocks, battery packs and watchtowers.
    for (const e of g.ents) {
      if (e.owner >= 0) continue;
      const px = sx(e.x), py = sy(e.y);
      if (!onScreen(px, py, z * 2)) continue;
      if (e.kind === K.Pile) this.pile(px, py, z, e);
      else if (e.kind === K.Cell) this.pack(px, py, z, e);
      else if (e.kind === K.Tower) this.tower(px, py, z, e.busy === me + 1 || seen(e) ? e.busy - 1 : -1);
    }

    // Fog of war: bare sketch where never seen, faded where not seen now.
    this.updateFog();
    x.drawImage(this.fog, o.x, o.y, mw, mh);

    // Placement grid; for a Refinery, a ring round every pack that is free.
    const pl = m.placing.value;
    if (pl) this.placeGrid(pl.tx, pl.ty, def(pl.kind).size, z, o);
    if (pl && pl.kind === K.Refinery) {
      x.strokeStyle = `rgba(47,143,58,${0.55 + 0.35 * Math.sin(now / 160)})`;
      x.lineWidth = 2.5;
      for (const e of g.ents) {
        if (e.kind !== K.Cell || e.site !== 0) continue;
        x.beginPath();
        x.arc(sx(e.x), sy(e.y), z * 1.7, 0, Math.PI * 2);
        x.stroke();
      }
    }

    // Remembered enemy buildings.
    for (const gh of g.players[me]!.seen.values()) {
      if (seen(gh)) continue;
      const px = sx(gh.x), py = sy(gh.y);
      if (!onScreen(px, py, z * 4)) continue;
      x.globalAlpha = 0.42;
      this.building(px, py, z, gh, true, 1, 0, 0);
      x.globalAlpha = 1;
    }

    // Buildings.
    for (const e of g.ents) {
      if (e.owner < 0 || !def(e.kind).building) continue;
      if (e.owner !== me && !seen(e)) continue;
      const px = sx(e.x), py = sy(e.y);
      if (!onScreen(px, py, z * 4)) continue;
      this.building(px, py, z, e, e.built, e.built ? 1 : e.progress / def(e.kind).time, e.fx, e.fy);
      if (e.id === m.site.value) {
        const s = def(e.kind).size * z;
        x.strokeStyle = '#fff';
        x.lineWidth = 2;
        x.setLineDash([6, 4]);
        x.strokeRect(px - s / 2 - 3, py - s / 2 - 3, s + 6, s + 6);
        x.setLineDash([]);
      }
      if (e.built && e.queue.length > 0 && e.owner === me && detail) {
        const s = def(e.kind).size * z, f = e.qprog / def(e.queue[0]!).time;
        x.fillStyle = 'rgba(40,30,20,0.55)';
        x.fillRect(px - s / 2, py + s / 2 + 3, s, 4);
        x.fillStyle = '#ffd24a';
        x.fillRect(px - s / 2, py + s / 2 + 3, s * f, 4);
      }
      if (e.hp < def(e.kind).hp && e.built) this.hpBar(px, py - (def(e.kind).size * z) / 2 - 7, def(e.kind).size * z * 0.8, e.hp / def(e.kind).hp);
    }

    // Selected group: rings under its units, and a line to where it is headed.
    const sel = m.sel.value;
    const pos = (e: Entity) => {
      const p = m.prev.get(e.id);
      if (!p) return { x: sx(e.x), y: sy(e.y) };
      return { x: sx(p.x + (e.x - p.x) * m.alpha), y: sy(p.y + (e.y - p.y) * m.alpha) };
    };
    if (sel >= 0) {
      const us = groupUnits(g, me, sel);
      if (us.length > 0) {
        const gs = g.players[me]!.groups[sel]!;
        if (us.some((u) => !u.arrived) && (gs.mode === O.Attack || gs.mode === O.Move)) {
          const c = centroid(us);
          x.strokeStyle = gs.mode === O.Move ? 'rgba(60,150,70,0.7)' : 'rgba(200,60,40,0.7)';
          x.lineWidth = 2;
          x.setLineDash([7, 6]);
          x.beginPath();
          x.moveTo(sx(c.x), sy(c.y));
          x.lineTo(sx(gs.x), sy(gs.y));
          x.stroke();
          x.setLineDash([]);
          this.cross(sx(gs.x), sy(gs.y), 7, x.strokeStyle as string);
        }
        x.strokeStyle = 'rgba(255,255,255,0.95)';
        x.lineWidth = detail ? 2 : 1.5;
        for (const u of us) {
          const p = pos(u);
          x.beginPath();
          x.arc(p.x, p.y, Math.max(4.5, z * (def(u.kind).radius / TILE + 0.15)), 0, Math.PI * 2);
          x.stroke();
        }
      }
    }

    // Units: Workers first, fighters on top, flyers above everything.
    for (let pass = 0; pass < 2; pass++) {
      for (const e of g.ents) {
        if (e.owner < 0 || def(e.kind).building) continue;
        if ((e.kind === K.Worker) !== (pass === 0)) continue;
        if (e.owner !== me && !visibleTo(g, me, e)) continue;
        if (def(e.kind).air) {
          air.push(e);
          continue;
        }
        const p = pos(e);
        if (!onScreen(p.x, p.y, z)) continue;
        if (detail) this.figure(p.x, p.y, z, e);
        else this.marker(p.x, p.y, z, e);
        const r = def(e.kind).radius / TILE;
        if (e.hp < def(e.kind).hp && detail) this.hpBar(p.x, p.y - z * (r + 0.24), z * Math.max(0.7, r * 2), e.hp / def(e.kind).hp);
      }
    }

    // Shots, falls and taps.
    for (const f of m.fx) this.effect(f, now, sx, sy, z);

    for (const e of air) {
      const p = pos(e);
      if (!onScreen(p.x, p.y, z * 2)) continue;
      if (detail) this.flyer(p.x, p.y, z, e, now);
      else this.marker(p.x, p.y, z, e);
      if (e.hp < def(e.kind).hp && detail) this.hpBar(p.x, p.y - z * 0.95, z * 0.9, e.hp / def(e.kind).hp);
    }

    // Flags over your groups.
    for (let i = 0; i < 4; i++) {
      const us = groupUnits(g, me, i);
      if (us.length === 0) continue;
      let cx = 0, cy = 0, top = 1e9;
      for (const u of us) {
        const p = pos(u);
        cx += p.x;
        cy += p.y;
        top = Math.min(top, p.y);
      }
      cx /= us.length;
      cy /= us.length;
      this.flag(cx, detail ? top - z * 0.9 : cy - 12, i, i === sel, m.hud.value.groups[i]?.hp ?? 1, !detail);
    }

    // The outline of a building being placed.
    if (pl) {
      const d = def(pl.kind), s = d.size * z;
      const px = o.x + pl.tx * z, py = o.y + pl.ty * z;
      x.fillStyle = pl.ok ? 'rgba(70,170,80,0.32)' : 'rgba(210,60,50,0.38)';
      x.fillRect(px, py, s, s);
      x.globalAlpha = 0.6;
      this.building(px + s / 2, py + s / 2, z, { kind: pl.kind, owner: me } as Ghost, true, 1, 1, 0);
      x.globalAlpha = 1;
      x.strokeStyle = pl.ok ? '#2f8f3a' : '#c0392b';
      x.lineWidth = 2.5;
      x.strokeRect(px, py, s, s);
      if (d.range > 0) {
        x.strokeStyle = 'rgba(60,60,60,0.45)';
        x.lineWidth = 1.5;
        x.setLineDash([5, 5]);
        x.beginPath();
        x.arc(px + s / 2, py + s / 2, (d.range / TILE) * z, 0, Math.PI * 2);
        x.stroke();
        x.setLineDash([]);
      }
    }
  }

  private placeGrid(tx: number, ty: number, size: number, z: number, o: { x: number; y: number }): void {
    const x = this.ctx, g = this.m.g;
    const x0 = Math.max(0, tx - 6), y0 = Math.max(0, ty - 6), x1 = Math.min(g.map.w, tx + size + 6), y1 = Math.min(g.map.h, ty + size + 6);
    x.strokeStyle = 'rgba(74,58,40,0.16)';
    x.lineWidth = 1;
    x.beginPath();
    for (let gx = x0; gx <= x1; gx++) {
      x.moveTo(o.x + gx * z, o.y + y0 * z);
      x.lineTo(o.x + gx * z, o.y + y1 * z);
    }
    for (let gy = y0; gy <= y1; gy++) {
      x.moveTo(o.x + x0 * z, o.y + gy * z);
      x.lineTo(o.x + x1 * z, o.y + gy * z);
    }
    x.stroke();
    x.fillStyle = 'rgba(190,60,50,0.16)';
    for (let gy = y0; gy < y1; gy++) for (let gx = x0; gx < x1; gx++) {
      if (g.nav.isBlocked(gx, gy)) x.fillRect(o.x + gx * z, o.y + gy * z, z, z);
    }
  }

  private cross(px: number, py: number, r: number, colour: string): void {
    const x = this.ctx;
    x.strokeStyle = colour;
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(px - r, py - r);
    x.lineTo(px + r, py + r);
    x.moveTo(px + r, py - r);
    x.lineTo(px - r, py + r);
    x.stroke();
  }

  private hpBar(px: number, py: number, w: number, f: number): void {
    const x = this.ctx;
    x.fillStyle = 'rgba(40,30,20,0.6)';
    x.fillRect(px - w / 2, py, w, 3);
    x.fillStyle = f > 0.5 ? '#58c04a' : f > 0.25 ? '#e9b730' : '#d9463d';
    x.fillRect(px - w / 2, py, w * Math.max(0, f), 3);
  }

  private pile(px: number, py: number, z: number, e: Entity): void {
    const x = this.ctx;
    const n = e.amount > 1100 ? 4 : e.amount > 600 ? 3 : e.amount > 200 ? 2 : 1;
    const s = z * 0.4;
    const spots = [[-0.42, 0.12], [0.2, 0.2], [-0.1, -0.38], [0.36, -0.3]];
    for (let i = 0; i < n; i++) {
      const bx = px + spots[i]![0]! * z * 0.62 - s / 2, by = py + spots[i]![1]! * z * 0.62 - s / 2;
      x.fillStyle = 'rgba(0,0,0,0.2)';
      x.fillRect(bx + 1.5, by + 2, s, s);
      x.fillStyle = BLOCK_COLOURS[(e.id + i) % 4]!;
      x.fillRect(bx, by, s, s);
      if (z >= 11) {
        x.strokeStyle = 'rgba(40,30,20,0.6)';
        x.lineWidth = 1;
        x.strokeRect(bx + 0.5, by + 0.5, s - 1, s - 1);
        x.fillStyle = 'rgba(255,255,255,0.28)';
        x.fillRect(bx + 1.5, by + 1.5, s * 0.5, s * 0.22);
      }
    }
  }

  /** Four fat batteries standing on end, fewer as the pack runs down. */
  private pack(px: number, py: number, z: number, e: Entity): void {
    const x = this.ctx;
    const n = e.amount > 1800 ? 4 : e.amount > 1100 ? 3 : e.amount > 450 ? 2 : e.amount > 0 ? 1 : 0;
    const r = z * 0.4;
    x.fillStyle = 'rgba(0,0,0,0.2)';
    this.rr(px - z + 3, py - z + 4, z * 2 - 2, z * 2 - 2, z * 0.3);
    x.fill();
    x.fillStyle = '#b9ad8e';
    this.rr(px - z + 1, py - z + 1, z * 2 - 2, z * 2 - 2, z * 0.3);
    x.fill();
    x.strokeStyle = 'rgba(74,58,40,0.55)';
    x.lineWidth = 1;
    x.stroke();
    const spots = [[-1, -1], [1, 1], [1, -1], [-1, 1]] as const;
    for (let i = 0; i < 4; i++) {
      const cx = px + spots[i]![0] * z * 0.47, cy = py + spots[i]![1] * z * 0.47;
      if (i >= n) {
        // An empty socket.
        x.fillStyle = 'rgba(60,45,30,0.28)';
        x.beginPath();
        x.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
        x.fill();
        continue;
      }
      x.fillStyle = STEEL;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#e08a1e';
      x.beginPath();
      x.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#d7d7d7';
      x.beginPath();
      x.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      x.fill();
    }
  }

  /** A watchtower from above: a block platform with a pennant in its holder's colour. */
  private tower(px: number, py: number, z: number, holder: number): void {
    const x = this.ctx, s = z * 0.92, h = s / 2;
    x.fillStyle = 'rgba(0,0,0,0.25)';
    x.fillRect(px - h + 2.5, py - h + 3.5, s, s);
    x.fillStyle = '#9a6a3c';
    x.fillRect(px - h, py - h, s, s);
    x.fillStyle = '#c99a62';
    x.fillRect(px - h * 0.62, py - h * 0.62, s * 0.62, s * 0.62);
    x.strokeStyle = '#5a3c1e';
    x.lineWidth = Math.max(1, z * 0.06);
    x.strokeRect(px - h, py - h, s, s);
    x.beginPath();
    x.moveTo(px - h, py - h);
    x.lineTo(px + h, py + h);
    x.moveTo(px + h, py - h);
    x.lineTo(px - h, py + h);
    x.stroke();
    // Pole and pennant.
    x.strokeStyle = '#3a2d20';
    x.lineWidth = Math.max(1.2, z * 0.07);
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px, py - z * 0.95);
    x.stroke();
    x.fillStyle = holder >= 0 ? TEAM[holder]!.fill : '#fbf6e6';
    x.strokeStyle = holder >= 0 ? TEAM[holder]!.dark : 'rgba(74,58,40,0.7)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(px, py - z * 0.95);
    x.lineTo(px + z * 0.62, py - z * 0.75);
    x.lineTo(px, py - z * 0.52);
    x.closePath();
    x.fill();
    x.stroke();
  }

  /** A playset piece, drawn from above. */
  private building(px: number, py: number, z: number, e: { kind: number; owner: number }, built: boolean, progress: number, fx: number, fy: number): void {
    const x = this.ctx, t = TEAM[e.owner] ?? TEAM[0]!, d = def(e.kind), s = d.size * z, h = s / 2;
    const r = Math.max(2, z * 0.18);
    const alpha = x.globalAlpha;
    if (!built) x.globalAlpha = alpha * 0.55;
    x.fillStyle = 'rgba(0,0,0,0.22)';
    this.rr(px - h + 3, py - h + 4, s, s, r);
    x.fill();
    if (e.kind === K.HQ) {
      x.fillStyle = t.dark;
      this.rr(px - h + 1, py - h + 1, s - 2, s - 2, r);
      x.fill();
      x.fillStyle = t.fill;
      this.rr(px - h * 0.68, py - h * 0.68, s * 0.68, s * 0.68, r * 0.7);
      x.fill();
      x.fillStyle = t.light;
      const q = s * 0.2;
      for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        this.rr(px + cx * (h - q * 0.62) - q / 2, py + cy * (h - q * 0.62) - q / 2, q, q, r * 0.5);
        x.fill();
      }
      // Flagpole and pennant.
      x.strokeStyle = '#3a2d20';
      x.lineWidth = Math.max(1.2, z * 0.07);
      x.beginPath();
      x.moveTo(px, py + s * 0.12);
      x.lineTo(px, py - s * 0.24);
      x.stroke();
      x.fillStyle = t.flag;
      x.beginPath();
      x.moveTo(px, py - s * 0.24);
      x.lineTo(px + s * 0.22, py - s * 0.16);
      x.lineTo(px, py - s * 0.08);
      x.closePath();
      x.fill();
    } else if (e.kind === K.Barracks) {
      x.fillStyle = t.fill;
      this.rr(px - h + 1, py - h * 0.78, s - 2, s * 0.78, r);
      x.fill();
      x.fillStyle = t.light;
      x.beginPath();
      x.moveTo(px - h + 2, py - h * 0.78 + 2);
      x.lineTo(px - h * 0.45, py);
      x.lineTo(px - h + 2, py + h * 0.78 - 2);
      x.closePath();
      x.fill();
      x.beginPath();
      x.moveTo(px + h - 2, py - h * 0.78 + 2);
      x.lineTo(px + h * 0.45, py);
      x.lineTo(px + h - 2, py + h * 0.78 - 2);
      x.closePath();
      x.fill();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1.5, z * 0.1);
      x.beginPath();
      x.moveTo(px - h * 0.45, py);
      x.lineTo(px + h * 0.45, py);
      x.stroke();
      x.lineWidth = Math.max(1, z * 0.05);
      this.rr(px - h + 1, py - h * 0.78, s - 2, s * 0.78, r);
      x.stroke();
    } else if (e.kind === K.Turret) {
      x.fillStyle = '#d6c59c';
      x.beginPath();
      x.arc(px, py, h * 0.92, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#8f7d55';
      x.lineWidth = Math.max(1, z * 0.07);
      x.stroke();
      if (z >= 11) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          x.beginPath();
          x.moveTo(px + Math.cos(a) * h * 0.62, py + Math.sin(a) * h * 0.62);
          x.lineTo(px + Math.cos(a) * h * 0.92, py + Math.sin(a) * h * 0.92);
          x.stroke();
        }
      }
      x.fillStyle = t.dark;
      x.beginPath();
      x.arc(px, py, h * 0.56, 0, Math.PI * 2);
      x.fill();
      const a = Math.atan2(fy, fx || (e.owner === 1 ? -1 : 1));
      x.strokeStyle = '#2c2c2c';
      x.lineWidth = Math.max(2, z * 0.2);
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + Math.cos(a) * h * 1.05, py + Math.sin(a) * h * 1.05);
      x.stroke();
      x.fillStyle = t.fill;
      x.beginPath();
      x.arc(px, py, h * 0.3, 0, Math.PI * 2);
      x.fill();
    } else if (e.kind === K.Refinery) {
      x.fillStyle = t.dark;
      this.rr(px - h + 1, py - h + 1, s - 2, s - 2, r * 1.6);
      x.fill();
      // The tank, and the charging box with its bolt.
      x.fillStyle = t.light;
      x.beginPath();
      x.arc(px - h * 0.26, py - h * 0.26, h * 0.5, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = t.fill;
      x.lineWidth = Math.max(1.5, z * 0.1);
      x.stroke();
      x.fillStyle = '#e9b730';
      this.rr(px + h * 0.08, py + h * 0.08, h * 0.74, h * 0.74, r * 0.6);
      x.fill();
      x.strokeStyle = '#3a2d20';
      x.lineWidth = Math.max(1, z * 0.07);
      x.stroke();
      x.beginPath();
      x.moveTo(px + h * 0.52, py + h * 0.16);
      x.lineTo(px + h * 0.34, py + h * 0.46);
      x.lineTo(px + h * 0.56, py + h * 0.46);
      x.lineTo(px + h * 0.4, py + h * 0.74);
      x.stroke();
    } else if (e.kind === K.Factory) {
      x.fillStyle = t.dark;
      this.rr(px - h + 1, py - h + 1, s - 2, s - 2, r);
      x.fill();
      // A saw-tooth roof in three bays, and a wide door at the front.
      for (let i = 0; i < 3; i++) {
        const y0 = py - h + s * 0.08 + i * s * 0.2;
        x.fillStyle = t.light;
        x.beginPath();
        x.moveTo(px - h * 0.84, y0 + s * 0.17);
        x.lineTo(px + h * 0.84, y0);
        x.lineTo(px + h * 0.84, y0 + s * 0.17);
        x.closePath();
        x.fill();
        x.fillStyle = t.fill;
        x.beginPath();
        x.moveTo(px - h * 0.84, y0 + s * 0.17);
        x.lineTo(px - h * 0.84, y0);
        x.lineTo(px + h * 0.84, y0);
        x.closePath();
        x.fill();
      }
      x.fillStyle = STEEL;
      this.rr(px - h * 0.42, py + h * 0.42, h * 0.84, h * 0.5, r * 0.4);
      x.fill();
      x.fillStyle = '#6b6b6b';
      x.beginPath();
      x.arc(px + h * 0.62, py + h * 0.66, h * 0.13, 0, Math.PI * 2);
      x.fill();
    } else if (e.kind === K.Airfield) {
      x.fillStyle = '#8f8a7a';
      this.rr(px - h + 1, py - h + 1, s - 2, s - 2, r);
      x.fill();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(2, z * 0.16);
      this.rr(px - h + 2, py - h + 2, s - 4, s - 4, r);
      x.stroke();
      // The pad, and a hangar strip along the back.
      x.fillStyle = t.fill;
      this.rr(px - h * 0.8, py - h * 0.84, s * 0.8, s * 0.17, r * 0.4);
      x.fill();
      x.strokeStyle = '#f4ecd4';
      x.lineWidth = Math.max(1.5, z * 0.1);
      x.beginPath();
      x.arc(px, py + h * 0.14, h * 0.52, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.moveTo(px - h * 0.2, py - h * 0.14);
      x.lineTo(px - h * 0.2, py + h * 0.42);
      x.moveTo(px + h * 0.2, py - h * 0.14);
      x.lineTo(px + h * 0.2, py + h * 0.42);
      x.moveTo(px - h * 0.2, py + h * 0.14);
      x.lineTo(px + h * 0.2, py + h * 0.14);
      x.stroke();
    } else if (e.kind === K.Armory) {
      x.fillStyle = t.dark;
      this.rr(px - h + 1, py - h + 1, s - 2, s - 2, r);
      x.fill();
      x.fillStyle = t.fill;
      this.rr(px - h * 0.74, py - h * 0.74, s * 0.74, s * 0.74, r * 0.7);
      x.fill();
      // A shield on the roof.
      x.fillStyle = t.light;
      x.beginPath();
      x.moveTo(px, py - h * 0.52);
      x.lineTo(px + h * 0.42, py - h * 0.34);
      x.lineTo(px + h * 0.42, py + h * 0.06);
      x.quadraticCurveTo(px + h * 0.36, py + h * 0.4, px, py + h * 0.56);
      x.quadraticCurveTo(px - h * 0.36, py + h * 0.4, px - h * 0.42, py + h * 0.06);
      x.lineTo(px - h * 0.42, py - h * 0.34);
      x.closePath();
      x.fill();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(1.5, z * 0.12);
      x.beginPath();
      x.moveTo(px, py - h * 0.3);
      x.lineTo(px, py + h * 0.3);
      x.moveTo(px - h * 0.22, py);
      x.lineTo(px + h * 0.22, py);
      x.stroke();
    } else if (e.kind === K.Heavy) {
      x.fillStyle = STEEL;
      this.rr(px - h + 1, py - h + 1, s - 2, s - 2, r);
      x.fill();
      x.fillStyle = t.dark;
      this.rr(px - h * 0.8, py - h * 0.8, s * 0.8, s * 0.5, r * 0.6);
      x.fill();
      x.strokeStyle = t.light;
      x.lineWidth = Math.max(2, z * 0.16);
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(px - h * 0.5, py - h * 0.3);
      x.lineTo(px + h * 0.5, py - h * 0.3);
      x.stroke();
      // Hazard stripes along the front.
      x.save();
      x.beginPath();
      x.rect(px - h * 0.84, py + h * 0.42, s * 0.84, s * 0.2);
      x.clip();
      x.fillStyle = '#e9b730';
      x.fillRect(px - h, py + h * 0.4, s, s * 0.25);
      x.strokeStyle = STEEL;
      x.lineWidth = Math.max(2, z * 0.2);
      for (let i = -3; i <= 4; i++) {
        x.beginPath();
        x.moveTo(px + i * h * 0.42, py + h * 0.9);
        x.lineTo(px + i * h * 0.42 + h * 0.4, py + h * 0.38);
        x.stroke();
      }
      x.restore();
    }
    x.globalAlpha = alpha;
    if (!built) {
      x.strokeStyle = 'rgba(60,45,30,0.8)';
      x.lineWidth = 1.5;
      x.setLineDash([5, 4]);
      x.strokeRect(px - h, py - h, s, s);
      x.setLineDash([]);
      x.fillStyle = 'rgba(40,30,20,0.6)';
      x.fillRect(px - h, py + h + 3, s, 4);
      x.fillStyle = '#7fd0ff';
      x.fillRect(px - h, py + h + 3, s * Math.max(0, progress), 4);
    }
  }

  private rr(px: number, py: number, w: number, h: number, r: number): void {
    const x = this.ctx;
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  /**
   * A simple marker when zoomed out. Infantry: circle Trooper, square Lancer, triangle Runner, diamond Mortar.
   * Vehicles are wide dark-edged slabs, the Juggernaut the biggest; a Gunship is a cross. A dot is a Worker.
   */
  private marker(px: number, py: number, z: number, e: Entity): void {
    const x = this.ctx, t = TEAM[e.owner]!;
    const r = e.kind === K.Worker ? Math.max(1.6, z * 0.22) : Math.max(3, z * 0.4);
    x.fillStyle = t.fill;
    x.strokeStyle = t.dark;
    x.lineWidth = 1;
    x.beginPath();
    if (e.kind === K.Lancer) x.rect(px - r * 0.85, py - r * 0.85, r * 1.7, r * 1.7);
    else if (e.kind === K.Runner) {
      x.moveTo(px, py - r * 1.15);
      x.lineTo(px + r, py + r * 0.8);
      x.lineTo(px - r, py + r * 0.8);
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
      x.fillStyle = e.kind === K.Flak ? t.light : t.fill;
      x.strokeStyle = STEEL;
      x.lineWidth = e.kind === K.Jugger ? 2.4 : 1.6;
    } else if (e.kind === K.Gunship) {
      x.fillStyle = 'rgba(0,0,0,0.2)';
      x.arc(px + 3, py + 4, r * 0.9, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.strokeStyle = t.dark;
      x.lineWidth = Math.max(2.4, r * 0.7);
      x.moveTo(px - r * 1.3, py);
      x.lineTo(px + r * 1.3, py);
      x.moveTo(px, py - r * 1.3);
      x.lineTo(px, py + r * 1.3);
      x.stroke();
      x.beginPath();
      x.fillStyle = t.light;
      x.arc(px, py, r * 0.55, 0, Math.PI * 2);
      x.fill();
      return;
    } else x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
    if (e.kind !== K.Worker) x.stroke();
  }

  /** A die-cast vehicle, seen from above: treads, hull, turret and gun. */
  private vehicle(px: number, py: number, z: number, e: Entity): void {
    const x = this.ctx, t = TEAM[e.owner]!;
    const r = (def(e.kind).radius / TILE) * z;
    const big = e.kind === K.Jugger;
    const len = r * (big ? 1.12 : 1.1), wid = r * (big ? 0.92 : 0.78);
    x.save();
    x.translate(px, py);
    x.fillStyle = 'rgba(0,0,0,0.24)';
    this.rr(-len + 2, -wid + 3, len * 2, wid * 2, r * 0.25);
    x.fill();
    x.rotate(Math.atan2(e.fy, e.fx || 0.0001));
    // Treads.
    x.fillStyle = STEEL;
    this.rr(-len, -wid, len * 2, wid * 2, r * 0.22);
    x.fill();
    // Hull.
    x.fillStyle = t.dark;
    this.rr(-len * 0.92, -wid * 0.68, len * 1.84, wid * 1.36, r * 0.18);
    x.fill();
    x.lineCap = 'round';
    if (e.kind === K.Flak) {
      // An open box on the back and two thin barrels.
      x.fillStyle = t.light;
      this.rr(-len * 0.7, -wid * 0.46, len * 0.9, wid * 0.92, r * 0.12);
      x.fill();
      x.strokeStyle = STEEL;
      x.lineWidth = Math.max(1.4, z * 0.07);
      for (const side of [-1, 1]) {
        x.beginPath();
        x.moveTo(-len * 0.1, side * wid * 0.24);
        x.lineTo(len * 1.25, side * wid * 0.24);
        x.stroke();
      }
    } else {
      // Gun first, so the turret sits over its root.
      x.strokeStyle = STEEL;
      x.lineWidth = Math.max(2, z * (big ? 0.13 : 0.12));
      for (const side of big ? [-1, 1] : [0]) {
        x.beginPath();
        x.moveTo(0, side * wid * 0.26);
        x.lineTo(len * (big ? 1.3 : 1.42), side * wid * 0.26);
        x.stroke();
      }
      x.fillStyle = t.fill;
      if (big) this.rr(-len * 0.52, -wid * 0.5, len * 0.92, wid, r * 0.16);
      else {
        x.beginPath();
        x.arc(-len * 0.08, 0, wid * 0.56, 0, Math.PI * 2);
      }
      x.fill();
      x.strokeStyle = t.light;
      x.lineWidth = Math.max(1, z * 0.05);
      x.stroke();
      x.fillStyle = t.light;
      x.beginPath();
      x.arc(-len * 0.14, 0, wid * 0.2, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }

  /** A Gunship: its shadow on the paper, then the machine itself above it, rotor turning. */
  private flyer(px: number, py: number, z: number, e: Entity, now: number): void {
    const x = this.ctx, t = TEAM[e.owner]!;
    const r = z * 0.46, a = Math.atan2(e.fy, e.fx || 0.0001);
    x.fillStyle = 'rgba(0,0,0,0.2)';
    x.beginPath();
    x.ellipse(px + z * 0.28, py + z * 0.42, r * 0.95, r * 0.6, a, 0, Math.PI * 2);
    x.fill();
    x.save();
    x.translate(px, py - z * 0.12);
    x.rotate(a);
    x.lineCap = 'round';
    // Tail boom and tail fin.
    x.strokeStyle = t.dark;
    x.lineWidth = Math.max(2, z * 0.13);
    x.beginPath();
    x.moveTo(-r * 0.2, 0);
    x.lineTo(-r * 1.35, 0);
    x.stroke();
    x.lineWidth = Math.max(1.6, z * 0.1);
    x.beginPath();
    x.moveTo(-r * 1.35, -r * 0.36);
    x.lineTo(-r * 1.35, r * 0.36);
    x.stroke();
    // Stub wings, body and canopy.
    x.strokeStyle = STEEL;
    x.lineWidth = Math.max(1.6, z * 0.09);
    x.beginPath();
    x.moveTo(r * 0.05, -r * 0.72);
    x.lineTo(r * 0.05, r * 0.72);
    x.stroke();
    x.fillStyle = t.dark;
    x.beginPath();
    x.ellipse(r * 0.1, 0, r * 0.82, r * 0.48, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = t.fill;
    x.beginPath();
    x.ellipse(r * 0.05, 0, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = t.light;
    x.beginPath();
    x.ellipse(r * 0.55, 0, r * 0.24, r * 0.22, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
    // The rotor: a faint disc and two blades.
    const spin = now / 45 + e.id;
    x.fillStyle = 'rgba(40,40,40,0.1)';
    x.beginPath();
    x.arc(px, py - z * 0.12, r * 1.25, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = 'rgba(30,30,30,0.6)';
    x.lineWidth = Math.max(1.4, z * 0.07);
    x.beginPath();
    for (const k of [0, Math.PI / 2]) {
      x.moveTo(px - Math.cos(spin + k) * r * 1.25, py - z * 0.12 - Math.sin(spin + k) * r * 1.25);
      x.lineTo(px + Math.cos(spin + k) * r * 1.25, py - z * 0.12 + Math.sin(spin + k) * r * 1.25);
    }
    x.stroke();
  }

  /** A plastic figure on its base, seen from above. */
  private figure(px: number, py: number, z: number, e: Entity): void {
    if (def(e.kind).cls === C.Armoured) {
      this.vehicle(px, py, z, e);
      return;
    }
    const x = this.ctx, t = TEAM[e.owner]!;
    const r = z * (e.kind === K.Worker ? 0.26 : e.kind === K.Mortar ? 0.36 : 0.31);
    const a = Math.atan2(e.fy, e.fx || 0.0001);
    x.save();
    x.translate(px, py);
    // Base, with its shadow on the paper.
    x.fillStyle = 'rgba(0,0,0,0.22)';
    x.beginPath();
    x.ellipse(1.5, 2.5, r * 1.02, r * 0.96, 0, 0, Math.PI * 2);
    x.fill();
    x.rotate(a);
    x.fillStyle = t.dark;
    x.beginPath();
    if (e.kind === K.Lancer) {
      const q = r * 0.92;
      x.moveTo(-q + r * 0.3, -q);
      x.arcTo(q, -q, q, q, r * 0.3);
      x.arcTo(q, q, -q, q, r * 0.3);
      x.arcTo(-q, q, -q, -q, r * 0.3);
      x.arcTo(-q, -q, q, -q, r * 0.3);
    } else if (e.kind === K.Runner) {
      x.moveTo(r * 1.25, 0);
      x.lineTo(-r * 0.75, r * 0.95);
      x.lineTo(-r * 0.4, 0);
      x.lineTo(-r * 0.75, -r * 0.95);
    } else {
      x.arc(0, 0, r, 0, Math.PI * 2);
    }
    x.closePath();
    x.fill();
    // Body and helmet.
    x.fillStyle = t.fill;
    x.beginPath();
    x.ellipse(-r * 0.05, 0, r * 0.5, r * 0.62, 0, 0, Math.PI * 2);
    x.fill();
    x.lineCap = 'round';
    if (e.kind === K.Trooper) {
      x.strokeStyle = '#2b2b2b';
      x.lineWidth = Math.max(1.3, z * 0.07);
      x.beginPath();
      x.moveTo(r * 0.05, r * 0.36);
      x.lineTo(r * 1.3, r * 0.3);
      x.stroke();
    } else if (e.kind === K.Lancer) {
      x.strokeStyle = '#3a3a3a';
      x.lineWidth = Math.max(2.2, z * 0.15);
      x.beginPath();
      x.moveTo(-r * 0.7, -r * 0.42);
      x.lineTo(r * 1.15, -r * 0.42);
      x.stroke();
      x.strokeStyle = '#c2462f';
      x.lineWidth = Math.max(2.2, z * 0.17);
      x.beginPath();
      x.moveTo(r * 1.1, -r * 0.42);
      x.lineTo(r * 1.3, -r * 0.42);
      x.stroke();
    } else if (e.kind === K.Runner) {
      x.strokeStyle = '#2b2b2b';
      x.lineWidth = Math.max(1.3, z * 0.08);
      x.beginPath();
      x.moveTo(r * 0.1, r * 0.3);
      x.lineTo(r * 0.85, r * 0.3);
      x.stroke();
    } else if (e.kind === K.Mortar) {
      // The tube; once the crew has stood still long enough, its legs are out and it is ready to fire.
      const ready = e.still >= def(K.Mortar).setup;
      if (ready) {
        x.strokeStyle = '#5a4a36';
        x.lineWidth = Math.max(1.2, z * 0.06);
        x.beginPath();
        x.moveTo(r * 0.95, 0);
        x.lineTo(r * 0.45, -r * 0.8);
        x.moveTo(r * 0.95, 0);
        x.lineTo(r * 0.45, r * 0.8);
        x.stroke();
      }
      x.strokeStyle = STEEL;
      x.lineWidth = Math.max(2.6, z * 0.2);
      x.beginPath();
      x.moveTo(r * 0.2, -r * 0.34);
      x.lineTo(r * (ready ? 1.35 : 1.0), -r * 0.34);
      x.stroke();
      if (ready) {
        x.fillStyle = '#e9b730';
        x.beginPath();
        x.arc(r * 1.35, -r * 0.34, Math.max(1.2, z * 0.07), 0, Math.PI * 2);
        x.fill();
      }
    } else if (e.kind === K.Worker) {
      if (e.carry > 0 && e.cargo === 1) {
        // A battery under one arm.
        x.fillStyle = STEEL;
        x.beginPath();
        x.arc(r * 0.8, 0, r * 0.5, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#e08a1e';
        x.beginPath();
        x.arc(r * 0.8, 0, r * 0.34, 0, Math.PI * 2);
        x.fill();
      } else if (e.carry > 0) {
        const s = r * 0.85;
        x.fillStyle = BLOCK_COLOURS[e.id % 4]!;
        x.fillRect(r * 0.35, -s / 2, s, s);
        x.strokeStyle = 'rgba(40,30,20,0.7)';
        x.lineWidth = 1;
        x.strokeRect(r * 0.35, -s / 2, s, s);
      } else if (e.ws === W.Build) {
        x.strokeStyle = '#6b4a2b';
        x.lineWidth = Math.max(1.3, z * 0.08);
        x.beginPath();
        x.moveTo(r * 0.2, r * 0.3);
        x.lineTo(r * 1.1, r * 0.1);
        x.stroke();
      }
    }
    x.fillStyle = t.light;
    x.beginPath();
    x.arc(r * 0.08, 0, r * (e.kind === K.Worker ? 0.36 : 0.34), 0, Math.PI * 2);
    x.fill();
    if (e.kind === K.Worker) {
      x.fillStyle = '#f2c230';
      x.beginPath();
      x.arc(r * 0.08, 0, r * 0.22, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  }

  /** A shell going off: a bright ring that opens to the edge of its blast, and smoke after it. */
  private burst(px: number, py: number, r: number, k: number): void {
    const x = this.ctx;
    const kk = Math.max(0, Math.min(1, k));
    x.fillStyle = `rgba(255,170,60,${0.55 * (1 - kk)})`;
    x.beginPath();
    x.arc(px, py, Math.max(3, r * (0.35 + 0.65 * kk)), 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = `rgba(120,70,30,${0.7 * (1 - kk)})`;
    x.lineWidth = 2;
    x.stroke();
    if (kk < 0.35) {
      x.fillStyle = `rgba(255,244,200,${1 - kk * 2.8})`;
      x.beginPath();
      x.arc(px, py, Math.max(2, r * 0.3), 0, Math.PI * 2);
      x.fill();
    }
  }

  private flag(px: number, py: number, i: number, selected: boolean, hp: number, big: boolean): void {
    const x = this.ctx;
    const w = big ? 26 : 20, h = big ? 18 : 14;
    x.fillStyle = 'rgba(0,0,0,0.25)';
    this.rr(px - w / 2 + 1.5, py - h + 2, w, h, 4);
    x.fill();
    x.fillStyle = selected ? '#ffd24a' : '#fff8e6';
    this.rr(px - w / 2, py - h, w, h, 4);
    x.fill();
    x.strokeStyle = selected ? '#8a5a00' : '#2f6327';
    x.lineWidth = selected ? 2.2 : 1.5;
    x.stroke();
    x.fillStyle = '#1f3a1a';
    x.font = `800 ${big ? 13 : 11}px system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(String(i + 1), px, py - h / 2 + 0.5);
    x.fillStyle = 'rgba(40,30,20,0.55)';
    x.fillRect(px - w / 2, py + 1.5, w, 3);
    x.fillStyle = hp > 0.5 ? '#58c04a' : hp > 0.25 ? '#e9b730' : '#d9463d';
    x.fillRect(px - w / 2, py + 1.5, w * hp, 3);
  }

  private effect(f: Fx, now: number, sx: (n: number) => number, sy: (n: number) => number, z: number): void {
    const x = this.ctx;
    const k = Math.min(1, (now - f.born) / f.life);
    if (f.t === 'shot') {
      const x1 = sx(f.x1), y1 = sy(f.y1), x2 = sx(f.x2), y2 = sy(f.y2);
      const blast = (def(f.kind).splash / TILE) * z;
      if (f.kind === K.Mortar) {
        // A shell lobbed high: it climbs, hangs and drops, its shadow running along the ground under it.
        const fly = Math.min(1, k / 0.72);
        if (fly < 1) {
          const gx = x1 + (x2 - x1) * fly, gy = y1 + (y2 - y1) * fly;
          const up = Math.sin(fly * Math.PI) * Math.min(z * 3.2, Math.hypot(x2 - x1, y2 - y1) * 0.35);
          x.fillStyle = 'rgba(0,0,0,0.22)';
          x.beginPath();
          x.ellipse(gx, gy, z * 0.14, z * 0.09, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = STEEL;
          x.beginPath();
          x.arc(gx, gy - up, Math.max(2, z * 0.13), 0, Math.PI * 2);
          x.fill();
        } else {
          this.burst(x2, y2, blast, (k - 0.72) / 0.28);
        }
      } else if (f.kind === K.Tank || f.kind === K.Jugger) {
        const fly = Math.min(1, k / 0.3);
        if (fly < 1) {
          x.strokeStyle = 'rgba(255,214,120,0.95)';
          x.lineWidth = Math.max(2.4, z * (f.kind === K.Jugger ? 0.16 : 0.12));
          x.lineCap = 'round';
          x.beginPath();
          x.moveTo(x1 + (x2 - x1) * Math.max(0, fly - 0.3), y1 + (y2 - y1) * Math.max(0, fly - 0.3));
          x.lineTo(x1 + (x2 - x1) * fly, y1 + (y2 - y1) * fly);
          x.stroke();
          if (k < 0.12) {
            x.fillStyle = `rgba(255,236,150,${1 - k * 8})`;
            x.beginPath();
            x.arc(x1 + (x2 - x1) * 0.1, y1 + (y2 - y1) * 0.1, z * 0.28, 0, Math.PI * 2);
            x.fill();
          }
        } else {
          this.burst(x2, y2, blast, (k - 0.3) / 0.7);
        }
      } else if (f.kind === K.Flak) {
        // Black puffs in the air round the target.
        for (let i = 0; i < 3; i++) {
          const a = (f.born % 7) + i * 2.1, d = blast * (0.25 + 0.3 * i);
          const kk = Math.max(0, Math.min(1, k * 1.5 - i * 0.2));
          if (kk <= 0) continue;
          x.fillStyle = `rgba(40,40,40,${0.55 * (1 - kk)})`;
          x.beginPath();
          x.arc(x2 + Math.cos(a) * d, y2 - z * 0.12 + Math.sin(a) * d, z * (0.14 + 0.22 * kk), 0, Math.PI * 2);
          x.fill();
          if (kk < 0.3) {
            x.fillStyle = `rgba(255,190,80,${1 - kk * 3})`;
            x.beginPath();
            x.arc(x2 + Math.cos(a) * d, y2 - z * 0.12 + Math.sin(a) * d, z * 0.1, 0, Math.PI * 2);
            x.fill();
          }
        }
      } else if (f.kind === K.Lancer) {
        const hx = x1 + (x2 - x1) * Math.min(1, k * 1.6), hy = y1 + (y2 - y1) * Math.min(1, k * 1.6);
        x.strokeStyle = `rgba(250,250,250,${0.7 * (1 - k)})`;
        x.lineWidth = Math.max(1.5, z * 0.09);
        x.beginPath();
        x.moveTo(x1, y1);
        x.lineTo(hx, hy);
        x.stroke();
        if (k > 0.6) {
          x.fillStyle = `rgba(245,150,40,${1 - k})`;
          x.beginPath();
          x.arc(x2, y2, z * 0.45 * (k - 0.4) * 2, 0, Math.PI * 2);
          x.fill();
        }
      } else {
        const a = 0.12 + k * 0.5, b = Math.min(1, a + 0.38);
        const wide = f.kind === K.Turret ? Math.max(2.4, z * 0.13) : Math.max(1.6, z * 0.08);
        for (const [w, colour] of [[wide + 1.6, `rgba(120,60,20,${0.45 * (1 - k)})`], [wide, f.kind === K.Turret ? `rgba(255,150,40,${1 - k})` : `rgba(255,224,90,${1 - k})`]] as [number, string][]) {
          x.strokeStyle = colour;
          x.lineWidth = w;
          x.beginPath();
          x.moveTo(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a);
          x.lineTo(x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
          x.stroke();
        }
        if (k < 0.35 && z >= 11) {
          // Muzzle flash.
          x.fillStyle = `rgba(255,236,150,${1 - k * 2.8})`;
          x.beginPath();
          x.arc(x1 + (x2 - x1) * 0.06, y1 + (y2 - y1) * 0.06, z * 0.16, 0, Math.PI * 2);
          x.fill();
        }
      }
    } else if (f.t === 'fall') {
      // A toy soldier tipped over on the paper.
      const px = sx(f.x1), py = sy(f.y1), t = TEAM[f.owner] ?? TEAM[0]!;
      const r = z * 0.34, a = Math.atan2(f.y2, f.x2 || 0.0001) + 1.2;
      x.save();
      x.translate(px, py);
      x.rotate(a);
      x.globalAlpha = 0.85 * (1 - k * k);
      x.fillStyle = t.dark;
      x.beginPath();
      x.ellipse(0, 0, r * 1.25, r * 0.5, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = t.light;
      x.beginPath();
      x.arc(r * 0.8, 0, r * 0.3, 0, Math.PI * 2);
      x.fill();
      x.restore();
      x.globalAlpha = 1;
      if (k < 0.25) {
        x.strokeStyle = `rgba(255,255,255,${1 - k * 4})`;
        x.lineWidth = 2;
        x.beginPath();
        x.arc(px, py, r * (1 + k * 5), 0, Math.PI * 2);
        x.stroke();
      }
    } else if (f.t === 'wreck') {
      // A burnt mark on the paper and a few bits of plastic.
      const px = sx(f.x1), py = sy(f.y1), t = TEAM[f.owner] ?? TEAM[0]!;
      const r = (def(f.kind).radius / TILE) * z;
      if (k < 0.2) this.burst(px, py, r * 2.2, k / 0.2);
      x.globalAlpha = 0.75 * (1 - k * k);
      x.fillStyle = 'rgba(40,32,24,0.55)';
      x.beginPath();
      x.ellipse(px, py, r * 1.15, r * 0.9, 0.4, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = t.dark;
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + (f.born % 5), d = r * (0.3 + 0.25 * i) * Math.min(1, k * 6 + 0.3);
        x.fillRect(px + Math.cos(a) * d - r * 0.16, py + Math.sin(a) * d - r * 0.12, r * 0.34, r * 0.24);
      }
      x.globalAlpha = 1;
    } else if (f.t === 'puff') {
      const px = sx(f.x1), py = sy(f.y1), s = def(f.kind).size * z;
      x.fillStyle = `rgba(90,70,50,${0.5 * (1 - k)})`;
      x.beginPath();
      x.arc(px, py, (s / 2) * (0.6 + k), 0, Math.PI * 2);
      x.fill();
    } else if (f.t === 'ripple') {
      const px = sx(f.x1), py = sy(f.y1);
      const colour = f.mode === O.Move ? `rgba(60,150,70,${1 - k})` : `rgba(205,55,40,${1 - k})`;
      x.strokeStyle = colour;
      x.lineWidth = 2.5;
      x.beginPath();
      x.arc(px, py, 6 + k * 16, 0, Math.PI * 2);
      x.stroke();
      this.cross(px, py, 5, colour);
    }
  }
}

/** Draws the minimap: the whole sheet, the fog, and a dot per unit. */
export function drawMini(c: HTMLCanvasElement, r: Renderer, m: Match): void {
  const g: Game = m.g, x = c.getContext('2d')!;
  const w = c.width, h = c.height;
  x.imageSmoothingEnabled = true;
  x.drawImage(r.mapSheet(), 0, 0, w, h);
  x.drawImage(r.fogSheet(), 0, 0, w, h);
  const kx = w / (g.map.w * TILE), ky = h / (g.map.h * TILE);
  for (const gh of g.players[m.me]!.seen.values()) {
    x.fillStyle = '#b5651d';
    x.fillRect(gh.x * kx - 2, gh.y * ky - 2, 4, 4);
  }
  for (const e of g.ents) {
    if (e.owner < 0) {
      if (e.kind === K.Cell) {
        x.fillStyle = '#e08a1e';
        x.fillRect(e.x * kx - 2, e.y * ky - 2, 4, 4);
      } else if (e.kind === K.Tower) {
        x.fillStyle = e.busy === m.me + 1 ? '#2f9a2f' : '#fff';
        x.strokeStyle = '#3a2d20';
        x.lineWidth = 1;
        x.fillRect(e.x * kx - 2.5, e.y * ky - 2.5, 5, 5);
        x.strokeRect(e.x * kx - 2.5, e.y * ky - 2.5, 5, 5);
      }
      continue;
    }
    if (e.owner !== m.me && !visibleTo(g, m.me, e)) continue;
    const b = def(e.kind).building;
    x.fillStyle = e.owner === m.me ? (b ? '#1f5a1a' : '#2f9a2f') : (b ? '#8a2a12' : '#e0452b');
    const s = b ? 4 : e.kind === K.Worker ? 1.5 : def(e.kind).supply >= 3 ? 3.5 : 2.5;
    x.fillRect(e.x * kx - s / 2, e.y * ky - s / 2, s, s);
  }
  const a = m.toWorld(INSET.left, INSET.top), b2 = m.toWorld(m.viewW - INSET.right, m.viewH);
  x.strokeStyle = '#fff';
  x.lineWidth = 1.5;
  x.strokeRect(a.x * kx, a.y * ky, (b2.x - a.x) * kx, (b2.y - a.y) * ky);
}
