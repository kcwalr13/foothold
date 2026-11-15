// Fog of war: what each player can see now, has ever seen, and remembers of the enemy's buildings.
// Height matters: from low ground you can't see up onto high ground. Flyers see everything in reach,
// and are seen from any height.
import { RULES, def } from './data';
import { K, TILE, type Player } from './types';
import { onLayer, type Game } from './state';

const DISCS = new Map<number, Int8Array>();

function disc(r: number): Int8Array {
  let d = DISCS.get(r);
  if (!d) {
    const pts: number[] = [];
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r) pts.push(x, y);
    }
    d = Int8Array.from(pts);
    DISCS.set(r, d);
  }
  return d;
}

export function updateFog(g: Game): void {
  const { w, h, high } = g.map;
  for (const pl of g.players) {
    pl.vis.fill(0);
    pl.visAir.fill(0);
  }
  const mark = (pl: Player, tx: number, ty: number, r: number, seesHigh: boolean) => {
    const pts = disc(r);
    const { vis, visAir } = pl;
    for (let i = 0; i < pts.length; i += 2) {
      const x = tx + pts[i]!, y = ty + pts[i + 1]!;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = y * w + x;
      visAir[k] = 1;
      if (seesHigh || high[k] === 0) vis[k] = 1;
    }
  };
  for (const e of g.ents) {
    if (e.owner < 0 || e.hp <= 0) continue;
    const d = def(e.kind);
    const tx = Math.max(0, Math.min(w - 1, Math.floor(e.x / TILE))), ty = Math.max(0, Math.min(h - 1, Math.floor(e.y / TILE)));
    // Standing exactly on the line between tiles (as every building of even size does), it sees from each
    // tile it touches. Seeing from only one of them would lean the same way on both sides of the map.
    const x0 = e.x % TILE === 0 && tx > 0 ? tx - 1 : tx, y0 = e.y % TILE === 0 && ty > 0 ? ty - 1 : ty;
    const pl = g.players[e.owner]!, r = e.built ? d.sight : 3;
    let up = d.air;
    for (let yy = y0; yy <= ty && !up; yy++) for (let xx = x0; xx <= tx; xx++) if (high[yy * w + xx] === 1) up = true;
    for (let yy = y0; yy <= ty; yy++) for (let xx = x0; xx <= tx; xx++) mark(pl, xx, yy, r, up);
  }
  // A watchtower shows the low ground around it to a side that alone has a ground unit standing by.
  for (const t of g.ents) {
    if (t.kind !== K.Tower) continue;
    let holder = -1;
    for (const e of g.ents) {
      if (e.owner < 0 || e.hp <= 0) continue;
      const d = def(e.kind);
      if (d.building || d.air) continue;
      if (Math.abs(e.x - t.x) > RULES.towerReach || Math.abs(e.y - t.y) > RULES.towerReach) continue;
      if (holder === -1) holder = e.owner;
      else if (holder !== e.owner) {
        holder = -2;
        break;
      }
    }
    // `busy` on a watchtower is its holder plus one, or 0 when nobody (or both sides) stand by.
    t.busy = holder >= 0 ? holder + 1 : 0;
    if (holder >= 0) mark(g.players[holder]!, Math.floor(t.x / TILE), Math.floor(t.y / TILE), RULES.towerSight, false);
  }
  for (const pl of g.players) {
    const { vis, explored } = pl;
    for (let i = 0; i < vis.length; i++) if (vis[i] === 1) explored[i] = 1;
  }
  for (const e of g.ents) {
    if (e.owner < 0 || e.hp <= 0 || !def(e.kind).building) continue;
    for (const pl of g.players) {
      if (pl.id === e.owner) continue;
      if (onLayer(g, pl.vis, e.x, e.y)) pl.seen.set(e.id, { id: e.id, kind: e.kind, owner: e.owner, x: e.x, y: e.y });
    }
  }
  for (const pl of g.players) {
    for (const [id, gh] of pl.seen) {
      if (onLayer(g, pl.vis, gh.x, gh.y) && !g.byId.has(id)) pl.seen.delete(id);
    }
  }
}
