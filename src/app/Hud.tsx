// The panels around the battlefield: the left thumb runs the base, the right thumb runs the armies.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TargetedPointerEvent } from 'preact';
import { def } from '../sim/data';
import { K, O, TILE, type Kind } from '../sim/types';
import type { Match } from './match';
import { TEAM } from './render';

const clock = (ticks: number) => `${Math.floor(ticks / 600)}:${String(Math.floor((ticks % 600) / 10)).padStart(2, '0')}`;

/** Tap and press-and-hold on one control. */
function usePress(onTap: () => void, onHold?: () => void) {
  const timer = useRef<number>(0);
  const held = useRef(false);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
  };
  return {
    onPointerDown: (e: TargetedPointerEvent<HTMLElement>) => {
      held.current = false;
      downAt.current = { x: e.clientX, y: e.clientY };
      clear();
      if (onHold) {
        timer.current = window.setTimeout(() => {
          held.current = true;
          onHold();
        }, 480);
      }
    },
    onPointerUp: (e: TargetedPointerEvent<HTMLElement>) => {
      clear();
      const d = downAt.current;
      downAt.current = null;
      if (!d || held.current) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 24) onTap();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: Event) => e.preventDefault(),
  };
}

function UnitIcon({ kind, size = 22 }: { kind: number; size?: number }) {
  const t = TEAM[0]!;
  const s = { width: size, height: size };
  switch (kind) {
    case K.Worker:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="12" r="7" fill={t.dark} /><circle cx="11" cy="12" r="3.4" fill="#f2c230" /><rect x="15" y="8" width="7" height="7" fill="#d9463d" stroke="#3a2d20" /></svg>;
    case K.Trooper:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="12" r="9" fill={t.dark} /><circle cx="11" cy="12" r="5" fill={t.fill} /><circle cx="12" cy="12" r="3" fill={t.light} /><path d="M12 16 L23 15" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round" /></svg>;
    case K.Lancer:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2.5" y="3.5" width="17" height="17" rx="4" fill={t.dark} /><circle cx="11" cy="12" r="5" fill={t.fill} /><circle cx="12" cy="12" r="3" fill={t.light} /><path d="M4 7 L21 7" stroke="#3a3a3a" stroke-width="3.6" stroke-linecap="round" /><path d="M20 7 L23 7" stroke="#c2462f" stroke-width="4" stroke-linecap="round" /></svg>;
    case K.Runner:
      return <svg viewBox="0 0 24 24" {...s}><path d="M23 12 L3 21 L7 12 L3 3 Z" fill={t.dark} /><circle cx="11" cy="12" r="3.6" fill={t.light} /></svg>;
    case K.HQ:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="2" width="20" height="20" rx="3" fill={t.dark} /><rect x="6" y="6" width="12" height="12" rx="2" fill={t.fill} /><path d="M12 14 V7 L17 9 L12 11" fill={t.flag} stroke="#3a2d20" stroke-width="1" /></svg>;
    case K.Barracks:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="5" width="20" height="14" rx="3" fill={t.fill} stroke={t.dark} /><path d="M2 5 L8 12 L2 19 Z M22 5 L16 12 L22 19 Z" fill={t.light} /><path d="M8 12 H16" stroke={t.dark} stroke-width="2" /></svg>;
    case K.Turret:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10" fill="#d6c59c" stroke="#8f7d55" /><circle cx="12" cy="12" r="6" fill={t.dark} /><path d="M12 12 L22 6" stroke="#2c2c2c" stroke-width="3.4" stroke-linecap="round" /></svg>;
    default:
      return null;
  }
}

function BlocksIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18"><rect x="2" y="11" width="9" height="9" fill="#d9463d" stroke="#3a2d20" /><rect x="12" y="11" width="9" height="9" fill="#3b78c9" stroke="#3a2d20" /><rect x="7" y="2" width="9" height="9" fill="#e9b730" stroke="#3a2d20" /></svg>;
}

function TrainButton({ m, kind }: { m: Match; kind: Kind }) {
  const info = m.hud.value.train.find((t) => t.kind === kind)!;
  const d = def(kind);
  const press = usePress(() => (info.ok ? m.train(kind) : m.alert(`why${kind}`, info.why, 'warn', undefined, undefined, 5)), () => m.toggleRepeat(kind));
  return (
    <button class={`tile ${info.ok ? '' : 'dim'} ${info.repeat ? 'rep' : ''}`} aria-label={`Train ${d.name}`} data-kind={kind} {...press}>
      <UnitIcon kind={kind} />
      <span class="name">{d.name}</span>
      <span class="cost">{d.cost}</span>
      {info.queued > 0 && <span class="badge">{info.queued}</span>}
      {info.repeat && <span class="loop">↻</span>}
      {info.queued > 0 && <span class="bar"><i style={{ width: `${Math.round(info.progress * 100)}%` }} /></span>}
    </button>
  );
}

function BuildButton({ m, kind }: { m: Match; kind: Kind }) {
  const info = m.hud.value.build.find((t) => t.kind === kind)!;
  const d = def(kind);
  const active = m.placing.value?.kind === kind;
  return (
    <button class={`row ${info.ok ? '' : 'dim'} ${active ? 'on' : ''}`} aria-label={`Build ${d.name}`} data-kind={kind}
      onClick={() => (info.ok ? m.beginPlace(kind) : m.alert(`why${kind}`, info.why, 'warn', undefined, undefined, 5))}>
      <UnitIcon kind={kind} size={24} />
      <span class="name">{d.name}</span>
      <span class="cost">{d.cost}</span>
    </button>
  );
}

function Mini({ m, canvasRef }: { m: Match; canvasRef: { current: HTMLCanvasElement | null } }) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const world = (e: TargetedPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * m.g.map.w * TILE, y: ((e.clientY - r.top) / r.height) * m.g.map.h * TILE };
  };
  return (
    <canvas class="mini" ref={canvasRef} width={272} height={136} aria-label="Minimap"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
        if (d.moved) {
          const w = world(e);
          m.lookAt(w.x, w.y);
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) {
          const w = world(e);
          m.tapMini(w.x, w.y);
        }
      }}
      onPointerCancel={() => { drag.current = null; }}
    />
  );
}

function GroupButton({ m, i }: { m: Match; i: number }) {
  const gi = m.hud.value.groups[i];
  const last = useRef(0);
  const press = usePress(() => {
    const now = performance.now();
    if (now - last.current < 380 && gi && gi.count > 0) m.focusGroup(i);
    else m.selectGroup(i);
    last.current = now;
  }, () => { m.sheet.value = i; });
  const empty = !gi || gi.count === 0;
  return (
    <button class={`group ${m.sel.value === i ? 'on' : ''} ${empty ? 'empty' : ''} ${gi?.hurt ? 'hurt' : ''}`} aria-label={`Group ${i + 1}`} data-group={i} {...press}>
      <span class="num">{i + 1}</span>
      {empty ? <span class="none">empty</span> : (
        <span class="mix">
          {gi!.kinds.map((k) => <span class="k" key={k.kind}><UnitIcon kind={k.kind} size={15} />{k.n}</span>)}
        </span>
      )}
      {m.hud.value.rally === i && <span class="rally" title="New units join this group">+</span>}
      {!empty && <span class="bar"><i style={{ width: `${Math.round(gi!.hp * 100)}%` }} class={gi!.hp < 0.35 ? 'low' : ''} /></span>}
    </button>
  );
}

function Sheet({ m }: { m: Match }) {
  const i = m.sheet.value;
  if (i < 0) return null;
  const gi = m.hud.value.groups[i];
  const others = [0, 1, 2, 3].filter((o) => o !== i);
  const close = () => { m.sheet.value = -1; };
  return (
    <div class="veil" onClick={close}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Group {i + 1}{gi && gi.count > 0 ? `: ${gi.count} units` : ' is empty'}</h2>
        {gi && gi.count > 0 && (
          <div class="rows">
            {gi.kinds.map((k) => (
              <div class="srow" key={k.kind}>
                <span class="what"><UnitIcon kind={k.kind} size={20} /> {k.n} {k.n === 1 ? def(k.kind).name : def(k.kind).plural}</span>
                <span class="to">to {others.map((o) => <button key={o} class="chip" onClick={() => { m.assign(i, o, k.kind, 0); close(); m.sel.value = o; }}>{o + 1}</button>)}</span>
              </div>
            ))}
            <div class="srow">
              <span class="what">Half of the group</span>
              <span class="to">to {others.map((o) => <button key={o} class="chip" onClick={() => { m.assign(i, o, 0, Math.ceil(gi.count / 2)); close(); m.sel.value = o; }}>{o + 1}</button>)}</span>
            </div>
            <div class="srow">
              <span class="what">Everyone</span>
              <span class="to">to {others.map((o) => <button key={o} class="chip" onClick={() => { m.assign(i, o, 0, 0); close(); m.sel.value = o; }}>{o + 1}</button>)}</span>
            </div>
          </div>
        )}
        <div class="srow">
          <span class="what">{m.hud.value.rally === i ? 'New units join this group' : 'New units join another group'}</span>
          {m.hud.value.rally !== i && <button class="chip wide" onClick={() => { m.setRally(i); close(); }}>Send them here</button>}
        </div>
        <button class="chip wide close" onClick={close}>Close</button>
      </div>
    </div>
  );
}

export function Hud({ m, miniRef, onQuit, onAgain }: { m: Match; miniRef: { current: HTMLCanvasElement | null }; onQuit: () => void; onAgain: () => void }) {
  const [tab, setTab] = useState<'build' | 'train'>('train');
  const h = m.hud.value;
  const placing = m.placing.value;
  const site = m.site.value ? m.g.byId.get(m.site.value) : undefined;
  const sel = m.sel.value;
  const over = m.over.value;
  useEffect(() => {
    if (placing) setTab('build');
  }, [placing !== null]);
  const capped = h.supply >= h.cap;
  return (
    <div class="hud">
      <div class="top">
        <span class="stat"><BlocksIcon /> <b data-stat="blocks">{h.blocks}</b></span>
        <span class={`stat ${capped ? 'bad' : ''}`}><span class="lbl">Supply</span> <b>{h.supply}/{h.cap}</b></span>
        <span class={`stat ${h.workers > h.work ? 'over' : ''}`}><span class="lbl">Workers</span> <b data-stat="workers">{h.workers}/{h.work}</b></span>
        <span class="clock">{clock(h.tick)}</span>
        <button class="pause" aria-label="Pause" onClick={() => { m.paused.value = true; m.menu.value = true; }}>II</button>
      </div>

      <div class="left">
        <div class="tabs">
          <button class={tab === 'build' ? 'on' : ''} onClick={() => setTab('build')}>Build</button>
          <button class={tab === 'train' ? 'on' : ''} onClick={() => { setTab('train'); m.cancelPlace(); }}>Train</button>
        </div>
        {tab === 'train' ? (
          <div class="grid">
            {h.train.map((t) => <TrainButton key={t.kind} m={m} kind={t.kind} />)}
          </div>
        ) : (
          <div class="list">
            {h.build.map((b) => <BuildButton key={b.kind} m={m} kind={b.kind} />)}
          </div>
        )}
        <Mini m={m} canvasRef={miniRef} />
      </div>

      <div class="right">
        {[0, 1, 2, 3].map((i) => <GroupButton key={i} m={m} i={i} />)}
        <div class="orders">
          <button class={m.mode.value === O.Attack ? 'on' : ''} disabled={sel < 0} onClick={() => { m.mode.value = O.Attack; }}>Attack</button>
          <button class={m.mode.value === O.Move ? 'on' : ''} disabled={sel < 0} onClick={() => { m.mode.value = O.Move; }}>Move</button>
          <button disabled={sel < 0} onClick={() => m.hold()}>Hold</button>
        </div>
      </div>

      <div class="toasts">
        {m.toasts.value.map((t) => (
          <button key={t.id} class={`toast ${t.kind}`} onClick={() => { if (t.x !== undefined && t.y !== undefined) m.lookAt(t.x, t.y); }}>{t.text}</button>
        ))}
      </div>

      {placing && (
        <div class="bar place">
          <button class="no" aria-label="Cancel placing" onClick={() => m.cancelPlace()}>✕</button>
          <span>{def(placing.kind).name}: drag the outline, then build</span>
          <button class={`yes ${placing.ok ? '' : 'dim'}`} aria-label="Confirm build" onClick={() => m.confirmPlace()}>Build ✓</button>
        </div>
      )}
      {!placing && site && (
        <div class="bar place">
          <span>{def(site.kind).name} under construction</span>
          <button class="no wide" onClick={() => m.cancelSite()}>Cancel it</button>
        </div>
      )}
      {!placing && !site && sel >= 0 && h.groups[sel] && h.groups[sel]!.count > 0 && (
        <div class="hint">Group {sel + 1}: tap the map to {m.mode.value === O.Move ? 'move' : 'attack-move'}</div>
      )}

      <Sheet m={m} />

      {m.menu.value && over < 0 && (
        <div class="veil">
          <div class="sheet">
            <h2>Paused</h2>
            <button class="chip wide" onClick={() => { m.menu.value = false; m.paused.value = false; }}>Resume</button>
            <button class="chip wide" onClick={() => { m.fast.value = !m.fast.value; }}>Speed: {m.fast.value ? 'Fast' : 'Normal'}</button>
            <button class="chip wide" onClick={onAgain}>Restart</button>
            <button class="chip wide" onClick={onQuit}>Quit to menu</button>
          </div>
        </div>
      )}

      {over >= 0 && (
        <div class="veil">
          <div class="sheet end">
            <h1>{over === m.me ? 'Victory' : 'Defeat'}</h1>
            <p>{over === m.me ? 'Their last Headquarters is down.' : 'Your last Headquarters is down.'} Match time {clock(m.g.tick)}.</p>
            <table>
              <tr><th></th><th>You</th><th>Opponent</th></tr>
              <tr><td>Units trained</td><td>{m.g.players[0]!.stats.trained}</td><td>{m.g.players[1]!.stats.trained}</td></tr>
              <tr><td>Units lost</td><td>{m.g.players[0]!.stats.lostUnits}</td><td>{m.g.players[1]!.stats.lostUnits}</td></tr>
              <tr><td>Buildings lost</td><td>{m.g.players[0]!.stats.lostBuildings}</td><td>{m.g.players[1]!.stats.lostBuildings}</td></tr>
              <tr><td>Blocks hauled</td><td>{m.g.players[0]!.stats.gathered}</td><td>{m.g.players[1]!.stats.gathered}</td></tr>
            </table>
            <p class="small">The opponent opened with a {m.bot.plan === 'rush' ? 'rush' : m.bot.plan === 'greedy' ? 'fast expansion' : 'safe expansion'}.</p>
            <button class="chip wide" onClick={onAgain}>Play again</button>
            <button class="chip wide" onClick={onQuit}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
