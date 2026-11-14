// Fog of war: what each player can see now, has ever seen, and remembers of the enemy's buildings.
import { def } from './data';
import { TILE } from './types';
import type { Game } from './state';

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
  const { w, h } = g.map;
  for (const pl of g.players) pl.vis.fill(0);
  for (const e of g.ents) {
    if (e.owner < 0 || e.hp <= 0) continue;
    const d = def(e.kind);
    const r = e.built ? d.sight : 3;
    const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
    const vis = g.players[e.owner]!.vis;
    const pts = disc(r);
    for (let i = 0; i < pts.length; i += 2) {
      const x = tx + pts[i]!, y = ty + pts[i + 1]!;
      if (x >= 0 && y >= 0 && x < w && y < h) vis[y * w + x] = 1;
    }
  }
  for (const pl of g.players) {
    const { vis, explored } = pl;
    for (let i = 0; i < vis.length; i++) if (vis[i] === 1) explored[i] = 1;
  }
  const at = (x: number, y: number) => Math.floor(y / TILE) * w + Math.floor(x / TILE);
  for (const e of g.ents) {
    if (e.owner < 0 || e.hp <= 0 || !def(e.kind).building) continue;
    const pl = g.players[1 - e.owner]!;
    if (pl.vis[at(e.x, e.y)] === 1) pl.seen.set(e.id, { id: e.id, kind: e.kind, owner: e.owner, x: e.x, y: e.y });
  }
  for (const pl of g.players) {
    for (const [id, gh] of pl.seen) {
      if (pl.vis[at(gh.x, gh.y)] === 1 && !g.byId.has(id)) pl.seen.delete(id);
    }
  }
}
