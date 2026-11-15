// Draws the match: a hand-drawn paper map with toy soldiers on it. No art files; everything is drawn here.
import { ABILITIES, FACTIONS, FRENZY, RULES, def, isRefinery, isWorker } from '../sim/data';
import { centroid, groupUnits, maxHp, visibleTo, type Game } from '../sim/state';
import { drawArmyBuilding, drawArmyFallen, drawArmyMarker, drawArmyUnit, drawGunship } from './army';
import { drawDinoBuilding, drawDinoFallen, drawDinoHit, drawDinoMarker, drawDinoUnit, drawPtero, isDinoBuilding, isDinoUnit } from './dinos';
import { K, O, TILE, type Entity, type GameMap } from '../sim/types';
import { INSET, type Fx, type Match } from './match';
import { BLOCK_COLOURS, GOLD, IVORY, PENCIL, Pen, STEEL, TEAM, ToyBox, brush, fire, home, pop, shadow, smoke, stamp, turn, type Anim, type BuildingLook, type Stage } from './toys';

export { TEAM } from './toys';

const PX = 16; // pixels per tile in the pre-drawn map sheet

const PAPER = '#f1e6c9';
const INK = 'rgba(74,58,40,';

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
  private toys = new ToyBox();
  private pen: Pen;
  /** What each piece was doing last frame, so it can walk, turn and recoil with some weight. */
  private anim = new Map<number, Anim>();
  private frameNo = 0;
  private lastNow = 0;

  constructor(private canvas: HTMLCanvasElement, private m: Match) {
    this.ctx = canvas.getContext('2d')!;
    this.pen = new Pen(this.ctx);
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
    this.toys.dpr = this.dpr;
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
    this.toys.begin(z);
    const st: Stage = { x, toys: this.toys, z, now, fired: m.fired, pen: this.pen };
    const dt = Math.min(100, now - this.lastNow);
    this.lastNow = now;
    this.frameNo++;
    x.lineCap = 'round';
    x.lineJoin = 'round';
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
    const sx = (wx: number) => o.x + (wx / TILE) * z, sy = (wy: number) => o.y + (wy / TILE) * z;
    const onScreen = (px: number, py: number, pad: number) => px > -pad && py > -pad && px < m.viewW + pad && py < m.viewH + pad;
    const detail = z >= 11;

    // Piles of Blocks, battery packs and watchtowers.
    for (const e of g.ents) {
      if (e.owner >= 0) continue;
      const px = sx(e.x), py = sy(e.y);
      if (!onScreen(px, py, z * 2)) continue;
      if (e.kind === K.Pile) this.pile(st, px, py, e);
      else if (e.kind === K.Cell) this.pack(st, px, py, e);
      else if (e.kind === K.Tower) this.tower(st, px, py, e.busy === me + 1 || seen(e) ? e.busy - 1 : -1, e.id);
    }

    // Fog of war: bare sketch where never seen, faded where not seen now.
    this.updateFog();
    x.drawImage(this.fog, o.x, o.y, mw, mh);

    // Placement grid; for a Refinery, a ring round every pack that is free.
    const pl = m.placing.value;
    if (pl) this.placeGrid(pl.tx, pl.ty, def(pl.kind).size, z, o);
    if (pl && isDinoBuilding(pl.kind) && pl.kind !== K.Nest && pl.kind !== K.Dig) {
      // Nesting ground: where a Dino building may go.
      x.strokeStyle = `rgba(47,143,58,${0.5 + 0.25 * Math.sin(now / 200)})`;
      x.fillStyle = 'rgba(70,170,80,0.07)';
      x.lineWidth = 2;
      x.setLineDash([8, 6]);
      for (const e of g.ents) {
        if (e.owner !== me || e.kind !== K.Nest || !e.built) continue;
        x.beginPath();
        x.arc(sx(e.x), sy(e.y), RULES.nestGround * z, 0, Math.PI * 2);
        x.fill();
        x.stroke();
      }
      x.setLineDash([]);
    }
    if (pl && isRefinery(pl.kind)) {
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
      x.globalAlpha = 0.45;
      this.building(st, px, py, gh.kind, gh.owner, null, dt);
      x.globalAlpha = 1;
    }

    // Buildings.
    for (const e of g.ents) {
      if (e.owner < 0 || !def(e.kind).building) continue;
      if (e.owner !== me && !seen(e)) continue;
      const px = sx(e.x), py = sy(e.y);
      if (!onScreen(px, py, z * 4)) continue;
      this.building(st, px, py, e.kind, e.owner, e, dt);
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
      if (e.hp < maxHp(e) && e.built) this.hpBar(px, py - (def(e.kind).size * z) / 2 - 7, def(e.kind).size * z * 0.8, e.hp / maxHp(e));
    }

    // Selected group: rings under its units, and a line to where it is headed.
    const sel = m.sel.value;
    const pos = (e: Entity) => {
      const p = m.prev.get(e.id);
      const wx = p ? p.x + (e.x - p.x) * m.alpha : e.x, wy = p ? p.y + (e.y - p.y) * m.alpha : e.y;
      return { x: sx(wx), y: sy(wy), wx: wx / TILE, wy: wy / TILE };
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
        // A ring that breathes a little, so the group you hold stands out from the one beside it.
        const swell = 1 + 0.06 * Math.sin(now / 260);
        for (const [w, colour] of [[detail ? 3.4 : 2.6, 'rgba(30,40,20,0.5)'], [detail ? 1.8 : 1.4, '#ffffff']] as const) {
          x.strokeStyle = colour;
          x.lineWidth = w;
          x.beginPath();
          for (const u of us) {
            const p = pos(u), r = Math.max(4.5, z * (def(u.kind).radius / TILE + 0.17)) * swell;
            x.moveTo(p.x + r, p.y);
            x.arc(p.x, p.y, r, 0, Math.PI * 2);
          }
          x.stroke();
        }
      }
    }

    // Units: Workers first, fighters on top, flyers above everything.
    const air: { e: Entity; p: ReturnType<typeof pos> }[] = [];
    for (let pass = 0; pass < 2; pass++) {
      for (const e of g.ents) {
        if (e.owner < 0 || def(e.kind).building) continue;
        if ((isWorker(e.kind) || e.kind === K.Egg) !== (pass === 0)) continue;
        if (e.owner !== me && !visibleTo(g, me, e)) continue;
        const p = pos(e);
        if (def(e.kind).air) {
          air.push({ e, p });
          continue;
        }
        if (!onScreen(p.x, p.y, z * 1.5)) continue;
        this.unit(st, e, p, dt, detail);
        const r = def(e.kind).radius / TILE;
        // A hero's health is always on show; anything else's only once it is hurt.
        if ((e.hp < maxHp(e) || def(e.kind).hero) && detail) this.hpBar(p.x, p.y - z * (r + (def(e.kind).hero ? 0.5 : 0.3)), z * Math.max(0.7, r * 2), e.hp / maxHp(e));
      }
    }

    // Shots, falls and taps.
    for (const f of m.fx) this.effect(st, f, sx, sy);

    for (const { e, p } of air) {
      if (!onScreen(p.x, p.y, z * 2)) continue;
      this.unit(st, e, p, dt, detail);
      if (e.hp < maxHp(e) && detail) this.hpBar(p.x, p.y - z * 1.0, z * 0.9, e.hp / maxHp(e));
    }

    // An ability being aimed: how far it reaches from the hero, and how wide it lands.
    const aiming = m.aim.value >= 0 ? m.ability(m.aim.value) : undefined, aimer = aiming ? m.hero() : undefined;
    if (aiming && aimer) {
      const hp = pos(aimer), t = TEAM[me]!;
      x.setLineDash([7, 6]);
      x.lineDashOffset = -now / 40;
      for (const [w, c] of [[4, 'rgba(255,255,255,0.75)'], [2, t.ink]] as const) {
        x.strokeStyle = c;
        x.lineWidth = w;
        x.beginPath();
        x.arc(hp.x, hp.y, (aiming.range / TILE) * z, 0, Math.PI * 2);
        x.stroke();
      }
      x.setLineDash([]);
      x.fillStyle = t.pale;
      x.beginPath();
      x.arc(hp.x, hp.y, (aiming.range / TILE) * z, 0, Math.PI * 2);
      x.fill();
    }

    // Flags over your groups.
    for (let i = 0; i < 4; i++) {
      // In Frenzy the last group is the hero, who is marked in gold and needs no number.
      if (m.frenzy && i === FRENZY.heroGroup) continue;
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
      x.globalAlpha = 0.65;
      this.building(st, px + s / 2, py + s / 2, pl.kind, me, null, dt);
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

    // Forget pieces that have left the table.
    if (this.frameNo % 240 === 0) {
      for (const id of this.anim.keys()) if (!g.byId.has(id)) this.anim.delete(id);
    }
  }

  /** What a piece was doing last frame, brought up to date: how far it has walked, which way it faces and aims. */
  private animOf(e: Entity, wx: number, wy: number, now: number, dt: number): Anim {
    const g = this.m.g, d = def(e.kind);
    const facing = Math.atan2(e.fy, e.fx || 0.0001);
    let a = this.anim.get(e.id);
    if (!a) {
      // Made in sight just now: it pops onto the table. Anything older simply walked into view.
      const fresh = !d.building && g.tick > 3 && e.id >= g.nextId - 24;
      const start = d.building ? (e.owner === 1 ? Math.PI : 0) : facing;
      a = { stamp: this.frameNo - 1, born: fresh ? now : -1e9, x: wx, y: wy, step: (e.id * 0.37) % 1, go: 0, head: start, aim: start, hp: e.hp, hurt: -1e9, done: -1e9, built: e.built };
      this.anim.set(e.id, a);
    }
    if (a.stamp !== this.frameNo - 1) {
      a.x = wx;
      a.y = wy;
    }
    a.stamp = this.frameNo;
    const dx = wx - a.x, dy = wy - a.y, dist = Math.hypot(dx, dy);
    const moving = dist > 0.0035 && dist < 1.5;
    if (moving) {
      a.step += dist;
      a.head = turn(a.head, Math.atan2(dy, dx), dt / 130);
    }
    a.go += ((moving ? 1 : 0) - a.go) * Math.min(1, dt / 120);
    a.x = wx;
    a.y = wy;
    const tgt = e.tgt ? g.byId.get(e.tgt) : undefined;
    const armoured = e.kind === K.Tank || e.kind === K.Flak || e.kind === K.Jugger;
    let want = d.building ? a.aim : facing;
    if (tgt) want = Math.atan2(tgt.y - e.y, tgt.x - e.x);
    else if (d.building && (e.fx !== 0 || e.fy !== 0) && d.range > 0) want = facing;
    else if (armoured && a.go > 0.3) want = a.head;
    a.aim = turn(a.aim, want, dt / (armoured || d.building ? 170 : 90));
    if (e.hp < a.hp) a.hurt = now;
    a.hp = e.hp;
    return a;
  }

  /** One unit: a toy up close, a marker from far off. */
  private unit(st: Stage, e: Entity, p: { x: number; y: number; wx: number; wy: number }, dt: number, detail: boolean): void {
    const { x, z, now } = st, t = TEAM[e.owner]!;
    const a = this.animOf(e, p.wx, p.wy, now, dt);
    const d = def(e.kind);
    if (!detail) {
      if (d.hero) this.heroMarker(p.x, p.y, t);
      else if (isDinoUnit(e.kind)) drawDinoMarker(st, e, p.x, p.y, t, a.aim);
      else drawArmyMarker(st, e, p.x, p.y, t, a.aim);
      return;
    }
    const size = pop((now - a.born) / 300);
    const tick = this.m.g.tick;
    if (d.hero) {
      // A hero stands in a ring of its side's colour that breathes, so it can be found in any crowd.
      const r = z * (d.radius / TILE + 0.34) * (1 + Math.sin(now / 420) * 0.05);
      x.fillStyle = t.pale;
      x.beginPath();
      x.arc(p.x, p.y, r, 0, Math.PI * 2);
      x.fill();
      x.lineWidth = Math.max(1.5, z * 0.07);
      x.strokeStyle = GOLD;
      x.stroke();
    }
    if (e.haste > tick) {
      // Rallied: a bright ring spinning underfoot.
      x.strokeStyle = t.light;
      x.lineWidth = Math.max(1.2, z * 0.06);
      x.setLineDash([z * 0.18, z * 0.16]);
      x.lineDashOffset = -now / 30;
      x.beginPath();
      x.arc(p.x, p.y, z * (d.radius / TILE + 0.14), 0, Math.PI * 2);
      x.stroke();
      x.setLineDash([]);
    }
    if (e.ttl > tick) {
      // Called up for a while: a gold ring underfoot that runs down like a clock, so it is plain they won't stay.
      const whole = ABILITIES[FACTIONS[this.m.g.players[e.owner]!.faction].hero]?.find((ab) => ab.kind === 'pack')?.time ?? 250;
      x.strokeStyle = GOLD;
      x.lineWidth = Math.max(1.5, z * 0.07);
      x.beginPath();
      x.arc(p.x, p.y, z * (d.radius / TILE + 0.1), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, (e.ttl - tick) / whole));
      x.stroke();
    }
    if (e.kind === K.Ptero) drawPtero(st, e, p.x, p.y, a, t, size);
    else if (isDinoUnit(e.kind)) drawDinoUnit(st, e, p.x, p.y, a, t, size);
    else if (e.kind === K.Gunship) drawGunship(st, e, p.x, p.y, a, t, size);
    else drawArmyUnit(st, e, p.x, p.y, a, t, size);
    if (e.daze > tick) {
      // Stunned: stars going round its head.
      const top = p.y - z * (d.radius / TILE + 0.12) - (d.air ? z * 0.2 : 0);
      x.fillStyle = '#ffe45e';
      x.strokeStyle = '#7a5a10';
      x.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const w = now / 190 + i * 2.094, cx = p.x + Math.cos(w) * z * 0.26, cy = top + Math.sin(w) * z * 0.09, r = Math.max(2, z * 0.085);
        x.beginPath();
        for (let k = 0; k < 8; k++) {
          const q = (k * Math.PI) / 4, rr = k % 2 ? r * 0.45 : r;
          x.lineTo(cx + Math.cos(q) * rr, cy + Math.sin(q) * rr);
        }
        x.closePath();
        x.fill();
        x.stroke();
      }
    }
    if (d.hero) {
      // Its level, on a gold badge at its shoulder.
      const bx = p.x + z * (d.radius / TILE + 0.3), by = p.y - z * (d.radius / TILE + 0.22), r = Math.max(6, z * 0.26);
      x.fillStyle = GOLD;
      x.strokeStyle = PENCIL;
      x.lineWidth = 1.5;
      x.beginPath();
      x.arc(bx, by, r, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      x.fillStyle = PENCIL;
      x.font = `900 ${Math.round(r * 1.35)}px system-ui, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(String(e.lvl), bx, by + r * 0.06);
    }
    const hurt = now - a.hurt;
    if (hurt < 120) {
      // Struck: a blink of white.
      const r = z * Math.min(0.42, def(e.kind).radius / TILE) * 0.9;
      x.globalAlpha = 0.5 * (1 - hurt / 120);
      x.fillStyle = '#fff';
      x.beginPath();
      x.arc(p.x, p.y - (def(e.kind).air ? z * 0.2 : 0), r, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
    }
  }

  /** A hero from far off: a gold star on its side's colour. */
  private heroMarker(px: number, py: number, t: (typeof TEAM)[number]): void {
    const x = this.ctx, r = Math.max(5, this.m.cam.zoom * 0.55);
    x.fillStyle = t.fill;
    x.strokeStyle = t.ink;
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.fillStyle = GOLD;
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const q = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.36 : r * 0.82;
      x.lineTo(px + Math.cos(q) * rr, py + Math.sin(q) * rr);
    }
    x.closePath();
    x.fill();
  }

  /** An ability on its way: what is thrown, called down or shouted, between the order and the effect. */
  private casting(st: Stage, f: Fx, k: number, sx: (n: number) => number, sy: (n: number) => number): void {
    const { x, z, now } = st, t = TEAM[f.owner] ?? TEAM[0]!;
    const a = ABILITIES[f.kind]?.[f.mode ?? 0];
    if (!a) return;
    const x1 = sx(f.x1), y1 = sy(f.y1), x2 = sx(f.x2), y2 = sy(f.y2), r = ((f.r ?? 0) / TILE) * z;
    const ring = (cx: number, cy: number, rad: number, colour: string, w: number, dash = false) => {
      x.strokeStyle = colour;
      x.lineWidth = w;
      if (dash) x.setLineDash([6, 5]);
      x.beginPath();
      x.arc(cx, cy, Math.max(1, rad), 0, Math.PI * 2);
      x.stroke();
      if (dash) x.setLineDash([]);
    };
    if (a.kind === 'blast' && a.delay < 10) {
      // A grenade: where it will land, and the thing itself in the air.
      ring(x2, y2, r, `rgba(190,50,35,${0.35 + 0.5 * k})`, 2, true);
      const gx = x1 + (x2 - x1) * k, gy = y1 + (y2 - y1) * k - Math.sin(k * Math.PI) * z * 1.6;
      x.fillStyle = 'rgba(0,0,0,0.22)';
      x.beginPath();
      x.ellipse(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, z * 0.14, z * 0.09, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = t.ink;
      x.beginPath();
      x.arc(gx, gy, Math.max(2.5, z * 0.13), 0, Math.PI * 2);
      x.fill();
      x.fillStyle = GOLD;
      x.beginPath();
      x.arc(gx + z * 0.05, gy - z * 0.07, Math.max(1, z * 0.045), 0, Math.PI * 2);
      x.fill();
    } else if (a.kind === 'blast') {
      // An air strike: a target marked on the ground, and a shadow crossing it.
      x.fillStyle = `rgba(200,50,35,${0.1 + 0.12 * Math.abs(Math.sin(now / 90))})`;
      x.beginPath();
      x.arc(x2, y2, r, 0, Math.PI * 2);
      x.fill();
      ring(x2, y2, r, 'rgba(190,50,35,0.85)', 2.5, true);
      x.strokeStyle = 'rgba(190,50,35,0.85)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(x2 - r * 0.3, y2);
      x.lineTo(x2 + r * 0.3, y2);
      x.moveTo(x2, y2 - r * 0.3);
      x.lineTo(x2, y2 + r * 0.3);
      x.stroke();
      const run = (k - 0.72) * 9, px = x2 + run * r, py = y2 + run * r * 0.2;
      x.fillStyle = 'rgba(0,0,0,0.26)';
      x.beginPath();
      x.moveTo(px + z * 1.1, py);
      x.lineTo(px - z * 0.5, py - z * 1.0);
      x.lineTo(px - z * 0.2, py);
      x.lineTo(px - z * 0.5, py + z * 1.0);
      x.closePath();
      x.fill();
    } else if (a.kind === 'leap') {
      // A pounce: where it will land, and a streak through the air.
      ring(x2, y2, r, `rgba(190,50,35,${0.3 + 0.5 * k})`, 2, true);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - z * 1.8;
      x.strokeStyle = t.fill;
      x.globalAlpha = 0.75;
      x.lineWidth = Math.max(3, z * 0.3);
      x.setLineDash([z * 0.5, z * 0.35]);
      x.lineDashOffset = -k * z * 6;
      x.beginPath();
      x.moveTo(x1, y1);
      x.quadraticCurveTo(mx, my, x1 + (x2 - x1) * Math.min(1, k * 1.1), y1 + (y2 - y1) * Math.min(1, k * 1.1) - Math.sin(Math.min(1, k * 1.1) * Math.PI) * z * 0.5);
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
    } else if (a.kind === 'daze') {
      // A roar: rings going out, one after another.
      for (let i = 0; i < 3; i++) {
        const q = k * 1.4 - i * 0.2;
        if (q <= 0 || q >= 1) continue;
        ring(x1, y1, r * q, `rgba(255,228,94,${0.9 * (1 - q)})`, Math.max(2, z * 0.14 * (1 - q)));
        ring(x1, y1, r * q, `rgba(90,60,10,${0.5 * (1 - q)})`, 1);
      }
    } else if (a.kind === 'haste') {
      // A rally: one bright ring out to everyone it reaches.
      ring(x1, y1, r * k, t.light, Math.max(2, z * 0.16 * (1 - k)));
      x.globalAlpha = 0.25 * (1 - k);
      x.fillStyle = t.light;
      x.beginPath();
      x.arc(x1, y1, r * k, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
    }
  }

  /** An ability going off. */
  private blasted(st: Stage, f: Fx, k: number, sx: (n: number) => number, sy: (n: number) => number): void {
    const { x, z } = st;
    const a = ABILITIES[f.kind]?.[f.mode ?? 0];
    if (!a) return;
    const px = sx(f.x1), py = sy(f.y1), r = ((f.r ?? TILE) / TILE) * z;
    if (a.kind === 'pack') {
      // The pack hatching: shell flying outward.
      x.fillStyle = IVORY;
      x.strokeStyle = PENCIL;
      x.lineWidth = 1;
      x.globalAlpha = 1 - k * k;
      for (let i = 0; i < 10; i++) {
        const q = i * 0.628 + 0.3, d = r * (0.3 + 1.5 * (1 - Math.pow(1 - k, 2))), s = Math.max(1.5, z * 0.09);
        x.beginPath();
        x.ellipse(px + Math.cos(q) * d, py + Math.sin(q) * d * 0.8, s, s * 0.7, q + k * 5, 0, Math.PI * 2);
        x.fill();
        x.stroke();
      }
      x.globalAlpha = 1;
      return;
    }
    if (a.delay >= 10) {
      // An air strike is five blasts across the circle, one after another.
      const spots = [[0, 0], [-0.5, -0.3], [0.45, -0.35], [-0.35, 0.45], [0.5, 0.35]] as const;
      spots.forEach(([ox, oy], i) => {
        const q = k * 1.8 - i * 0.16;
        if (q > 0 && q < 1) this.burst(px + ox * r, py + oy * r, r * 0.62, q, i);
      });
      return;
    }
    this.burst(px, py, r, k, f.born);
    if (k < 0.5) {
      // The ground shakes out to the edge of the blast.
      x.strokeStyle = `rgba(110,60,25,${0.6 * (1 - k * 2)})`;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, r * (0.5 + k), 0, Math.PI * 2);
      x.stroke();
    }
  }

  /**
   * One building. With an entity it is the real thing: turning its gun, flying its flag, half-built or on
   * fire. Without one it is only the piece: a plan being placed, or an enemy building as it was last seen.
   */
  private building(st: Stage, px: number, py: number, kind: number, owner: number, e: Entity | null, dt: number): void {
    const { x, z, now } = st;
    const t = TEAM[owner] ?? TEAM[0]!, d = def(kind), s = d.size * z, h = s / 2;
    const look: BuildingLook = { kind, owner, aim: owner === 1 ? Math.PI : 0, since: 1e9, busy: false, seed: 0, eggs: 0, plain: true };
    let done = 1e9, hurt = 1e9;
    if (e) {
      const a = this.animOf(e, e.x / TILE, e.y / TILE, now, dt);
      if (e.built && !a.built) a.done = now;
      a.built = e.built;
      look.aim = a.aim;
      look.since = now - (st.fired.get(e.id) ?? -1e9);
      look.busy = e.built && e.queue.length > 0;
      look.seed = e.id;
      look.eggs = e.eggs;
      look.plain = !e.built;
      done = now - a.done;
      hurt = now - a.hurt;
    }
    const paint = () => (isDinoBuilding(kind) ? drawDinoBuilding(st, look, px, py, t) : drawArmyBuilding(st, look, px, py, t));
    if (!e || e.built) {
      paint();
    } else {
      // Work in progress: the plan faint on the paper, and the piece itself filling in behind a working edge.
      const k = Math.max(0, Math.min(1, e.progress / d.time)), alpha = x.globalAlpha;
      x.globalAlpha = alpha * 0.28;
      paint();
      x.globalAlpha = alpha;
      const edge = px - h + s * k, grown = isDinoBuilding(kind);
      x.save();
      x.beginPath();
      // A Dino building grows out from its middle; a Green Army one is put together from one side.
      if (grown) x.arc(px, py, h * 1.5 * k, 0, Math.PI * 2);
      else x.rect(px - h - 6, py - h - 6, s * k + 6, s + 12);
      x.clip();
      paint();
      x.restore();
      x.strokeStyle = 'rgba(58,45,32,0.8)';
      x.lineWidth = 1.5;
      x.setLineDash([5, 4]);
      x.strokeRect(px - h, py - h, s, s);
      x.setLineDash([]);
      if (grown && k > 0.01 && k < 1) {
        x.strokeStyle = '#fff6c4';
        x.lineWidth = 2;
        x.beginPath();
        x.arc(px, py, h * 1.5 * k, 0, Math.PI * 2);
        x.stroke();
      } else if (k > 0.01 && k < 1) {
        x.strokeStyle = '#fff6c4';
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(edge, py - h);
        x.lineTo(edge, py + h);
        x.stroke();
        // Sparks along the edge where the work is.
        x.fillStyle = '#ffd24a';
        for (let i = 0; i < 3; i++) {
          const f = (now / 240 + i * 0.37 + e.id * 0.11) % 1;
          x.globalAlpha = 1 - f;
          x.beginPath();
          x.arc(edge + Math.sin(i * 9 + e.id) * 3, py - h + s * ((i * 0.31 + e.id * 0.17 + Math.floor(now / 240 + i * 0.37) * 0.23) % 1), 1.2 + 2.2 * f, 0, Math.PI * 2);
          x.fill();
        }
        x.globalAlpha = 1;
      }
      x.fillStyle = 'rgba(40,30,20,0.6)';
      x.fillRect(px - h, py + h + 3, s, 4);
      x.fillStyle = '#7fd0ff';
      x.fillRect(px - h, py + h + 3, s * k, 4);
    }
    if (!e || !e.built) return;
    if (done < 520) {
      // Finished: a ring runs out from it.
      const k = done / 520;
      x.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
      x.lineWidth = 3 * (1 - k) + 1;
      x.beginPath();
      x.arc(px, py, h * (0.7 + 0.7 * k), 0, Math.PI * 2);
      x.stroke();
    }
    const hp = e.hp / maxHp(e);
    if (hp < 0.66 && z >= 11) {
      // Hurt: smoke, and below a third, fire.
      const ox = Math.sin(e.id * 1.7) * h * 0.4, oy = Math.cos(e.id * 2.3) * h * 0.35;
      smoke(st, px + ox, py + oy, d.size * 0.36, e.id, '#3f3a33');
      if (hp < 0.33) {
        fire(st, px + ox, py + oy + z * 0.1, d.size * 0.4, e.id);
        fire(st, px - ox * 0.8, py - oy * 0.6 + z * 0.1, d.size * 0.32, e.id + 3);
        smoke(st, px - ox * 0.8, py - oy * 0.6, d.size * 0.3, e.id + 5, '#2f2b26');
      }
      home(st);
    }
    if (hurt < 140) {
      x.globalAlpha = 0.4 * (1 - hurt / 140);
      x.fillStyle = '#fff';
      x.fillRect(px - h, py - h, s, s);
      x.globalAlpha = 1;
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

  /** A pile of wooden blocks, studs up; it shrinks as Workers carry it off. */
  private pile(st: Stage, px: number, py: number, e: Entity): void {
    const n = e.amount > 1100 ? 4 : e.amount > 600 ? 3 : e.amount > 200 ? 2 : 1;
    const s = st.toys.get(`pile${n}${e.id % 4}`, st.z, 0.62, (p) => {
      const spots = [[-0.26, 0.08, -0.12], [0.13, 0.13, 0.1], [-0.06, -0.24, 0.06], [0.23, -0.19, -0.16]] as const;
      for (let i = 0; i < n; i++) {
        const [bx, by, rot] = spots[i]!, c = BLOCK_COLOURS[(e.id + i) % 4]!;
        p.b(c, bx, by, 0.4, 0.4, 0.05, rot).k(PENCIL, 0.045);
        p.o('rgba(255,255,255,0.3)', bx - 0.02, by - 0.02, 0.1).k('rgba(58,45,32,0.5)', 0.025);
      }
    }, PENCIL, 'top');
    shadow(st, s, px, py, 0, 1, 0.06, 0.22);
    stamp(st, s, px, py);
    home(st);
  }

  /** Four fat batteries standing on end in their tray, fewer as the pack runs down. */
  private pack(st: Stage, px: number, py: number, e: Entity): void {
    const n = e.amount > 1800 ? 4 : e.amount > 1100 ? 3 : e.amount > 450 ? 2 : e.amount > 0 ? 1 : 0;
    const s = st.toys.get(`pack${n}`, st.z, 1.06, (p) => {
      p.b('#c2b596', 0, 0, 1.92, 1.92, 0.3).b('#a99c7c', 0, 0, 1.66, 1.66, 0.22);
      const spots = [[-1, -1], [1, 1], [1, -1], [-1, 1]] as const;
      for (let i = 0; i < 4; i++) {
        const cx = spots[i]![0] * 0.47, cy = spots[i]![1] * 0.47;
        if (i >= n) {
          p.o('#7d7059', cx, cy, 0.32).k(PENCIL, 0.035);
          continue;
        }
        p.o(STEEL, cx, cy, 0.4).o('#ee8f22', cx, cy, 0.31).o('#ffc163', cx - 0.06, cy - 0.06, 0.13).o('#e2e2e2', cx, cy, 0.12).k(PENCIL, 0.03);
      }
    }, PENCIL, 'top');
    shadow(st, s, px, py, 0, 1, 0.06, 0.2);
    stamp(st, s, px, py);
    home(st);
  }

  /** A watchtower from above: a plank platform on four posts, flying the colour of whoever holds it. */
  private tower(st: Stage, px: number, py: number, holder: number, id: number): void {
    const { z, now } = st;
    const s = st.toys.get('tower', z, 0.62, (p) => {
      for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.l(PENCIL, 0.13, [cx * 0.3, cy * 0.3, cx * 0.5, cy * 0.5]).l('#8d6336', 0.07, [cx * 0.3, cy * 0.3, cx * 0.5, cy * 0.5]);
      p.b('#b98a52', 0, 0, 0.84, 0.84, 0.05).k(PENCIL, 0.05);
      for (const dy of [-0.21, 0, 0.21]) p.l('#8d6336', 0.025, [-0.4, dy, 0.4, dy]);
      p.b('#d2a56c', 0, 0, 0.5, 0.5, 0.04).k(PENCIL, 0.035);
      p.l(PENCIL, 0.03, [-0.25, -0.25, 0.25, 0.25]).l(PENCIL, 0.03, [0.25, -0.25, -0.25, 0.25]);
    }, PENCIL, 'top');
    shadow(st, s, px, py, 0, 1, 0.1, 0.26);
    stamp(st, s, px, py);
    // Pole and pennant: white while no one holds it.
    const p = brush(st, px, py), t = holder >= 0 ? TEAM[holder]! : null, w = now / 240 + id;
    p.l(PENCIL, 0.06, [0, 0.04, 0, -0.98]);
    const pts: number[] = [0, -0.98];
    for (let i = 1; i <= 3; i++) pts.push(i * 0.22, -0.98 + i * 0.07 + Math.sin(w + i) * 0.035 * i);
    for (let i = 2; i >= 0; i--) pts.push(i * 0.22, -0.5 - i * 0.08 + Math.sin(w + i) * 0.035 * i);
    p.p(t ? t.flag : '#fbf6e6', pts).k(t ? t.ink : PENCIL, 0.045);
    p.o('#f7c531', 0, -1.0, 0.05);
    home(st);
  }

  /** A playset piece, drawn from above. */
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

  /** A shell going off: a flash, a ball of fire opening to the edge of its blast, bits thrown clear, smoke after. */
  private burst(px: number, py: number, r: number, k: number, seed = 0): void {
    const x = this.ctx;
    const kk = Math.max(0, Math.min(1, k));
    x.fillStyle = `rgba(255,150,50,${0.6 * (1 - kk)})`;
    x.beginPath();
    x.arc(px, py, Math.max(3, r * (0.35 + 0.65 * kk)), 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = `rgba(110,60,25,${0.75 * (1 - kk)})`;
    x.lineWidth = 2;
    x.stroke();
    if (kk > 0.3) {
      x.fillStyle = `rgba(70,62,54,${0.34 * (1 - kk)})`;
      x.beginPath();
      x.arc(px + r * 0.1, py - r * 0.25 * kk, r * (0.3 + 0.35 * kk), 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = `rgba(50,40,30,${0.9 * (1 - kk)})`;
    for (let i = 0; i < 5; i++) {
      const a = seed + i * 1.26, d = r * (0.3 + 0.9 * kk) * (0.8 + 0.3 * Math.sin(seed * 3 + i));
      x.beginPath();
      x.arc(px + Math.cos(a) * d, py + Math.sin(a) * d - Math.sin(kk * Math.PI) * r * 0.25, Math.max(1, r * 0.07), 0, Math.PI * 2);
      x.fill();
    }
    if (kk < 0.35) {
      x.fillStyle = `rgba(255,246,205,${1 - kk * 2.8})`;
      x.beginPath();
      x.arc(px, py, Math.max(2, r * (0.25 + 0.5 * kk)), 0, Math.PI * 2);
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

  private effect(st: Stage, f: Fx, sx: (n: number) => number, sy: (n: number) => number): void {
    const { x, z, now } = st;
    const k = Math.min(1, (now - f.born) / f.life);
    if (f.t === 'cast') return this.casting(st, f, k, sx, sy);
    if (f.t === 'blast') return this.blasted(st, f, k, sx, sy);
    if (f.t === 'level' || f.t === 'coin') {
      // Words that rise and fade: a level gained, Blocks paid for a kill.
      const px = sx(f.x1), py = sy(f.y1) - z * 0.7 - k * z * 1.3;
      if (f.t === 'level') {
        x.strokeStyle = `rgba(247,197,49,${1 - k})`;
        x.lineWidth = Math.max(2, z * 0.14 * (1 - k));
        x.beginPath();
        x.arc(sx(f.x1), sy(f.y1), z * (0.5 + k * 1.6), 0, Math.PI * 2);
        x.stroke();
      }
      const text = f.t === 'level' ? `Level ${f.mode}` : `+${f.mode}`;
      x.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      x.font = `900 ${f.t === 'level' ? Math.max(13, Math.round(z * 0.62)) : Math.max(11, Math.round(z * 0.5))}px system-ui, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineWidth = 3;
      x.strokeStyle = 'rgba(58,45,32,0.85)';
      x.strokeText(text, px, py);
      x.fillStyle = GOLD;
      x.fillText(text, px, py);
      x.globalAlpha = 1;
      return;
    }
    const seed = f.born % 6.28;
    if (f.t === 'shot') {
      const x1 = sx(f.x1), y1 = sy(f.y1), x2 = sx(f.x2), y2 = sy(f.y2);
      if (f.kind === K.Bayonet) {
        // A thrust: one bright line into what was hit.
        const a = Math.atan2(y2 - y1, x2 - x1), r = z * 0.32, from = 0.95 - k * 0.5;
        for (const [w, colour] of [[Math.max(3, z * 0.12), `rgba(150,30,20,${0.45 * (1 - k)})`], [Math.max(1.5, z * 0.06), `rgba(255,255,255,${0.95 * (1 - k)})`]] as const) {
          x.strokeStyle = colour;
          x.lineWidth = w;
          x.beginPath();
          x.moveTo(x2 - Math.cos(a) * r * from, y2 - Math.sin(a) * r * from);
          x.lineTo(x2 + Math.cos(a) * r * 0.3, y2 + Math.sin(a) * r * 0.3);
          x.stroke();
        }
        return;
      }
      if (drawDinoHit(st, f.kind, x1, y1, x2, y2, k)) return;
      const blast = (def(f.kind).splash / TILE) * z;
      const at = (q: number): [number, number] => [x1 + (x2 - x1) * q, y1 + (y2 - y1) * q];
      const streak = (from: number, to: number, w: number, core: string, glow: string) => {
        const [ax, ay] = at(from), [bx, by] = at(to);
        for (const [lw, colour] of [[w + 2, glow], [w, core]] as const) {
          x.strokeStyle = colour;
          x.lineWidth = lw;
          x.beginPath();
          x.moveTo(ax, ay);
          x.lineTo(bx, by);
          x.stroke();
        }
      };
      if (f.kind === K.Mortar) {
        // A shell lobbed high: it climbs, hangs and drops, its shadow running along the ground under it.
        const fly = Math.min(1, k / 0.72);
        if (fly < 1) {
          const [gx, gy] = at(fly);
          const up = Math.sin(fly * Math.PI) * Math.min(z * 3.2, Math.hypot(x2 - x1, y2 - y1) * 0.35);
          x.fillStyle = 'rgba(0,0,0,0.22)';
          x.beginPath();
          x.ellipse(gx, gy, z * 0.14, z * 0.09, 0, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = STEEL;
          x.beginPath();
          x.arc(gx, gy - up, Math.max(2, z * (0.11 + 0.05 * Math.sin(fly * Math.PI))), 0, Math.PI * 2);
          x.fill();
          x.fillStyle = 'rgba(255,255,255,0.5)';
          x.beginPath();
          x.arc(gx - 1, gy - up - 1, Math.max(0.8, z * 0.04), 0, Math.PI * 2);
          x.fill();
        } else {
          this.burst(x2, y2, blast, (k - 0.72) / 0.28, seed);
        }
      } else if (f.kind === K.Tank || f.kind === K.Jugger) {
        const fly = Math.min(1, k / 0.3);
        if (fly < 1) streak(Math.max(0.08, fly - 0.25), Math.max(0.1, fly), Math.max(2.4, z * (f.kind === K.Jugger ? 0.15 : 0.11)), '#fff0b0', 'rgba(230,120,30,0.6)');
        else this.burst(x2, y2, Math.max(blast, z * 0.5), (k - 0.3) / 0.7, seed);
      } else if (f.kind === K.Flak) {
        // Twin tracers going up, then black puffs in the air round the target.
        if (k < 0.4) streak(Math.max(0.1, k * 2.5 - 0.3), Math.min(1, k * 2.5), Math.max(1.4, z * 0.06), '#fff3b0', 'rgba(230,120,30,0.45)');
        for (let i = 0; i < 3; i++) {
          const a = seed + i * 2.1, d = blast * (0.25 + 0.3 * i);
          const kk = Math.max(0, Math.min(1, k * 1.5 - i * 0.2));
          if (kk <= 0) continue;
          x.fillStyle = `rgba(40,40,40,${0.6 * (1 - kk)})`;
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
        // A rocket on a trail of smoke, and a punch of fire where it lands.
        const fly = Math.min(1, k / 0.62);
        for (let i = 0; i < 5; i++) {
          const q = fly - i * 0.11;
          if (q <= 0.05) continue;
          const [tx, ty] = at(q);
          x.fillStyle = `rgba(235,232,224,${Math.max(0, 0.6 - i * 0.1) * (1 - k)})`;
          x.beginPath();
          x.arc(tx + Math.sin(i * 3 + seed) * 1.5, ty + Math.cos(i * 2 + seed) * 1.5, Math.max(1.5, z * (0.05 + i * 0.022)), 0, Math.PI * 2);
          x.fill();
        }
        if (fly < 1) {
          const [hx, hy] = at(fly), a = Math.atan2(y2 - y1, x2 - x1);
          const p = brush(st, hx, hy, a);
          p.o('#ffb52e', -0.14, 0, 0.1, 0.05).b(PENCIL, 0, 0, 0.2, 0.09, 0.03).o('#d9463d', 0.1, 0, 0.06, 0.045);
          home(st);
        } else {
          this.burst(x2, y2, z * 0.42, (k - 0.62) / 0.38, seed);
        }
      } else {
        // Small arms: a short bright streak, and a spark where it strikes.
        const big = f.kind === K.Turret;
        const head = Math.min(1, 0.15 + k * 1.5);
        if (head < 1 || k < 0.6) streak(Math.max(0.12, head - (big ? 0.34 : 0.26)), head, big ? Math.max(2.2, z * 0.11) : Math.max(1.3, z * 0.055), '#fff6c4', big ? 'rgba(240,120,30,0.6)' : 'rgba(210,130,30,0.45)');
        if (k > 0.5) {
          const q = (k - 0.5) / 0.5, r = z * (big ? 0.26 : 0.16);
          x.strokeStyle = `rgba(255,236,160,${1 - q})`;
          x.lineWidth = Math.max(1.2, z * 0.05);
          x.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = seed + i * 1.57;
            x.moveTo(x2 + Math.cos(a) * r * 0.3 * q, y2 + Math.sin(a) * r * 0.3 * q);
            x.lineTo(x2 + Math.cos(a) * r * (0.4 + 0.6 * q), y2 + Math.sin(a) * r * (0.4 + 0.6 * q));
          }
          x.stroke();
        }
      }
    } else if (f.t === 'fall') {
      // Knocked flat on the paper: the piece itself, on its side, fading.
      const px = sx(f.x1), py = sy(f.y1), t = TEAM[f.owner] ?? TEAM[0]!;
      const r = Math.max(z * 0.34, (def(f.kind).radius / TILE) * z);
      if (k < 0.25) {
        x.strokeStyle = `rgba(255,255,255,${1 - k * 4})`;
        x.lineWidth = 2;
        x.beginPath();
        x.arc(px, py, r * (1 + k * 4), 0, Math.PI * 2);
        x.stroke();
      }
      if (z < 11) {
        x.globalAlpha = 0.8 * (1 - k * k);
        x.fillStyle = t.dark;
        x.beginPath();
        x.ellipse(px, py, r * 1.1, r * 0.5, 0.6, 0, Math.PI * 2);
        x.fill();
        x.globalAlpha = 1;
      } else if (isDinoUnit(f.kind)) drawDinoFallen(st, f.kind, f.owner, px, py, Math.atan2(f.y2, f.x2 || 0.0001), t, k);
      else drawArmyFallen(st, f.kind, f.owner, px, py, Math.atan2(f.y2, f.x2 || 0.0001), t, k);
    } else if (f.t === 'wreck') {
      // A vehicle blown apart: a scorch on the paper, plates of its plastic thrown clear, smoke for a while after.
      const px = sx(f.x1), py = sy(f.y1), t = TEAM[f.owner] ?? TEAM[0]!;
      const r = (def(f.kind).radius / TILE) * z, fade = 1 - k * k;
      x.fillStyle = `rgba(36,28,22,${0.5 * fade})`;
      x.beginPath();
      x.ellipse(px, py, r * 1.2, r * 0.95, 0.4, 0, Math.PI * 2);
      x.fill();
      const out = 1 - Math.pow(1 - Math.min(1, k * 5), 3);
      x.globalAlpha = fade;
      x.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + seed, d = r * (0.25 + 0.3 * (i % 3)) * (0.3 + out), w = r * (0.5 - (i % 3) * 0.1), h = r * 0.3;
        x.save();
        x.translate(px + Math.cos(a) * d, py + Math.sin(a) * d - Math.sin(Math.min(1, k * 5) * Math.PI) * r * 0.3);
        x.rotate(a * 2.3 + out * 2);
        x.fillStyle = i % 2 ? t.fill : t.dark;
        x.strokeStyle = t.ink;
        x.fillRect(-w / 2, -h / 2, w, h);
        x.strokeRect(-w / 2, -h / 2, w, h);
        x.restore();
      }
      x.globalAlpha = 1;
      if (k < 0.16) this.burst(px, py, r * 2.4, k / 0.16, seed);
      else if (k < 0.85 && z >= 11) {
        smoke(st, px, py, (r / z) * 1.5, seed, '#3a3530');
        home(st);
      }
    } else if (f.t === 'puff') {
      // A building coming down: a blast, a ring of dust, rubble in its colour, and a mark where it stood.
      const px = sx(f.x1), py = sy(f.y1), s = def(f.kind).size * z, t = TEAM[f.owner] ?? TEAM[0]!;
      const fade = 1 - k * k, out = 1 - Math.pow(1 - Math.min(1, k * 3), 3);
      x.fillStyle = `rgba(36,28,22,${0.42 * fade})`;
      x.beginPath();
      x.ellipse(px, py, s * 0.48, s * 0.44, 0, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = `rgba(150,125,90,${0.7 * (1 - out)})`;
      x.lineWidth = Math.max(3, s * 0.12 * (1 - out));
      x.beginPath();
      x.arc(px, py, s * (0.3 + 0.6 * out), 0, Math.PI * 2);
      x.stroke();
      x.globalAlpha = fade;
      x.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + seed, d = s * (0.12 + 0.11 * (i % 4)) * (0.4 + out), w = s * (0.16 - (i % 3) * 0.03);
        x.save();
        x.translate(px + Math.cos(a) * d, py + Math.sin(a) * d - Math.sin(Math.min(1, k * 3) * Math.PI) * s * 0.12);
        x.rotate(a * 1.9 + out * 1.5);
        x.fillStyle = i % 3 === 0 ? t.light : i % 3 === 1 ? t.fill : t.dark;
        x.strokeStyle = t.ink;
        x.fillRect(-w / 2, -w * 0.35, w, w * 0.7);
        x.strokeRect(-w / 2, -w * 0.35, w, w * 0.7);
        x.restore();
      }
      x.globalAlpha = 1;
      if (k < 0.3) this.burst(px, py, s * 0.62, k / 0.3, seed);
      else if (k < 0.8 && z >= 11) {
        smoke(st, px, py, def(f.kind).size * 0.42, seed, '#4a443c');
        home(st);
      }
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
  // A square map sits in the middle of the box, with the panel's own colour either side of it.
  const box = m.miniRect(), w = c.width * box.w, h = c.height, left = c.width * box.x;
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (box.w < 1) {
    x.fillStyle = '#d9c9a2';
    x.fillRect(0, 0, c.width, c.height);
  }
  x.setTransform(1, 0, 0, 1, left, 0);
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
        const holder = e.busy - 1, known = holder === m.me || (holder >= 0 && visibleTo(g, m.me, e));
        x.fillStyle = known ? TEAM[holder]!.flag : '#fff';
        x.strokeStyle = '#3a2d20';
        x.lineWidth = 1;
        x.fillRect(e.x * kx - 2.5, e.y * ky - 2.5, 5, 5);
        x.strokeRect(e.x * kx - 2.5, e.y * ky - 2.5, 5, 5);
      }
      continue;
    }
    if (e.owner !== m.me && !visibleTo(g, m.me, e)) continue;
    const b = def(e.kind).building;
    // Yours in your green. Theirs stay red here, not their tan: on a map this small tan is a battery pack,
    // and the one thing the minimap must do is show an attack coming at a glance.
    x.fillStyle = e.owner === m.me ? (b ? TEAM[0]!.ink : TEAM[0]!.fill) : (b ? '#8a2a12' : '#e0452b');
    // With three opponents each shows in its own colour: who is coming matters as much as that someone is.
    // (Frenzy's map has no battery packs for tan to be mistaken for.)
    if (m.frenzy && e.owner !== m.me) x.fillStyle = b ? TEAM[e.owner]!.dark : TEAM[e.owner]!.flag;
    const hero = def(e.kind).hero;
    const s = b ? (m.frenzy ? 5 : 4) : hero ? 5 : isWorker(e.kind) || e.kind === K.Egg ? 1.5 : def(e.kind).supply >= 3 ? 3.5 : 2.5;
    x.fillRect(e.x * kx - s / 2, e.y * ky - s / 2, s, s);
    if (hero) {
      x.strokeStyle = GOLD;
      x.lineWidth = 1.5;
      x.strokeRect(e.x * kx - s / 2, e.y * ky - s / 2, s, s);
    }
  }
  const a = m.toWorld(INSET.left, INSET.top), b2 = m.toWorld(m.viewW - INSET.right, m.viewH);
  x.strokeStyle = '#fff';
  x.lineWidth = 1.5;
  x.strokeRect(a.x * kx, a.y * ky, (b2.x - a.x) * kx, (b2.y - a.y) * ky);
  x.setTransform(1, 0, 0, 1, 0, 0);
}
