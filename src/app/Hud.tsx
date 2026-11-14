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

export function UnitIcon({ kind, size = 22 }: { kind: number; size?: number }) {
  const t = TEAM[0]!;
  const s = { width: size, height: size };
  const ink = '#3a2d20', steel = '#2c2c2c';
  switch (kind) {
    case K.Worker:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="12" r="7" fill={t.dark} /><circle cx="11" cy="12" r="3.4" fill="#f2c230" /><rect x="15" y="8" width="7" height="7" fill="#d9463d" stroke={ink} /></svg>;
    case K.Trooper:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="12" r="9" fill={t.dark} /><circle cx="11" cy="12" r="5" fill={t.fill} /><circle cx="12" cy="12" r="3" fill={t.light} /><path d="M12 16 L23 15" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round" /></svg>;
    case K.Lancer:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2.5" y="3.5" width="17" height="17" rx="4" fill={t.dark} /><circle cx="11" cy="12" r="5" fill={t.fill} /><circle cx="12" cy="12" r="3" fill={t.light} /><path d="M4 7 L21 7" stroke="#3a3a3a" stroke-width="3.6" stroke-linecap="round" /><path d="M20 7 L23 7" stroke="#c2462f" stroke-width="4" stroke-linecap="round" /></svg>;
    case K.Runner:
      return <svg viewBox="0 0 24 24" {...s}><path d="M23 12 L3 21 L7 12 L3 3 Z" fill={t.dark} /><circle cx="11" cy="12" r="3.6" fill={t.light} /></svg>;
    case K.Tank:
      return <svg viewBox="0 0 24 24" {...s}><rect x="1.5" y="5" width="18" height="14" rx="3" fill={t.dark} /><rect x="3.5" y="7.5" width="14" height="9" rx="2" fill={t.fill} /><path d="M11 12 H23" stroke={steel} stroke-width="3" stroke-linecap="round" /><circle cx="10" cy="12" r="4.2" fill={t.light} stroke={t.dark} /></svg>;
    case K.Mortar:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="9" cy="14" r="7.5" fill={t.dark} /><circle cx="9" cy="14" r="4" fill={t.fill} /><path d="M9 14 L20 4" stroke={steel} stroke-width="4.2" stroke-linecap="round" /><circle cx="20" cy="4" r="1.6" fill="#e9b730" /></svg>;
    case K.Flak:
      return <svg viewBox="0 0 24 24" {...s}><rect x="1.5" y="6" width="16" height="12" rx="2.5" fill={t.dark} /><rect x="4" y="8.5" width="9" height="7" rx="1.5" fill={t.fill} /><path d="M10 10 H23 M10 14 H23" stroke={steel} stroke-width="2.2" stroke-linecap="round" /></svg>;
    case K.Gunship:
      return <svg viewBox="0 0 24 24" {...s}><path d="M3 12 H12" stroke={t.dark} stroke-width="3" stroke-linecap="round" /><path d="M3 9 V15" stroke={t.dark} stroke-width="2.4" stroke-linecap="round" /><ellipse cx="15" cy="12" rx="6.5" ry="4.6" fill={t.dark} /><ellipse cx="17" cy="12" rx="2.6" ry="2.4" fill={t.light} /><path d="M7 4 L23 20 M23 4 L7 20" stroke={steel} stroke-width="1.6" stroke-linecap="round" opacity="0.75" /></svg>;
    case K.Jugger:
      return <svg viewBox="0 0 24 24" {...s}><rect x="1" y="2.5" width="19" height="19" rx="3" fill={steel} /><rect x="2.5" y="5.5" width="16" height="13" rx="2" fill={t.dark} /><path d="M11 10 H23 M11 14 H23" stroke={steel} stroke-width="2.6" stroke-linecap="round" /><rect x="5" y="7.5" width="9" height="9" rx="2" fill={t.fill} stroke={t.light} /></svg>;
    case K.HQ:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="2" width="20" height="20" rx="3" fill={t.dark} /><rect x="6" y="6" width="12" height="12" rx="2" fill={t.fill} /><path d="M12 14 V7 L17 9 L12 11" fill={t.flag} stroke={ink} stroke-width="1" /></svg>;
    case K.Barracks:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="5" width="20" height="14" rx="3" fill={t.fill} stroke={t.dark} /><path d="M2 5 L8 12 L2 19 Z M22 5 L16 12 L22 19 Z" fill={t.light} /><path d="M8 12 H16" stroke={t.dark} stroke-width="2" /></svg>;
    case K.Turret:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10" fill="#d6c59c" stroke="#8f7d55" /><circle cx="12" cy="12" r="6" fill={t.dark} /><path d="M12 12 L22 6" stroke={steel} stroke-width="3.4" stroke-linecap="round" /></svg>;
    case K.Refinery:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="2" width="20" height="20" rx="4" fill={t.dark} /><circle cx="9.5" cy="9.5" r="5" fill={t.light} stroke={t.fill} /><rect x="13" y="13" width="7" height="7" rx="1.5" fill="#e9b730" stroke={ink} /><path d="M17.2 14 L15.4 16.8 H17.4 L16 19.4" stroke={ink} stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>;
    case K.Factory:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="3" width="20" height="18" rx="2.5" fill={t.dark} /><path d="M4 9 L10 5 V9 L16 5 V9 L20 6.4 V9 Z" fill={t.light} /><rect x="4" y="10" width="16" height="9" fill={t.fill} /><rect x="9" y="13" width="6" height="6" fill={steel} /></svg>;
    case K.Airfield:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="2" width="20" height="20" rx="3" fill="#8f8a7a" stroke={t.dark} stroke-width="1.6" /><circle cx="12" cy="12" r="6.5" fill="none" stroke="#f4ecd4" stroke-width="1.6" /><path d="M9.5 8.5 V15.5 M14.5 8.5 V15.5 M9.5 12 H14.5" stroke="#f4ecd4" stroke-width="1.8" stroke-linecap="round" /></svg>;
    case K.Armory:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="2" width="20" height="20" rx="3" fill={t.dark} /><path d="M12 5 L18 7.5 V12.5 C18 16 15.5 18.4 12 19.6 C8.5 18.4 6 16 6 12.5 V7.5 Z" fill={t.light} stroke={t.fill} /><path d="M12 8.5 V16 M9 12 H15" stroke={t.dark} stroke-width="2" stroke-linecap="round" /></svg>;
    case K.Heavy:
      return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="2" width="20" height="20" rx="3" fill={steel} /><rect x="4.5" y="4.5" width="15" height="9" rx="1.5" fill={t.dark} /><path d="M4 16 H20 V20 H4 Z" fill="#e9b730" /><path d="M6 20 L9 16 M11 20 L14 16 M16 20 L19 16" stroke={steel} stroke-width="1.8" /><path d="M7 9 H17" stroke={t.light} stroke-width="2.4" stroke-linecap="round" /></svg>;
    case K.Weapons:
      return <svg viewBox="0 0 24 24" {...s}><path d="M4 20 L15 9" stroke={steel} stroke-width="3.4" stroke-linecap="round" /><path d="M13 4 H20 V11 Z" fill="#d9463d" stroke={ink} stroke-linejoin="round" /><path d="M4 12 L8 16" stroke={ink} stroke-width="2" stroke-linecap="round" /></svg>;
    case K.Armour:
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 2.5 L20.5 6 V12 C20.5 17 17 20.2 12 21.8 C7 20.2 3.5 17 3.5 12 V6 Z" fill="#8fa3b5" stroke={ink} stroke-linejoin="round" /><path d="M12 5.5 V18.6" stroke="#dfe7ee" stroke-width="2" /></svg>;
    default:
      return null;
  }
}

function BlocksIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18"><rect x="2" y="11" width="9" height="9" fill="#d9463d" stroke="#3a2d20" /><rect x="12" y="11" width="9" height="9" fill="#3b78c9" stroke="#3a2d20" /><rect x="7" y="2" width="9" height="9" fill="#e9b730" stroke="#3a2d20" /></svg>;
}

function BatteryIcon({ size = 18 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size}><rect x="9.5" y="1.5" width="5" height="3" fill="#b9b9b9" stroke="#3a2d20" /><rect x="6" y="4" width="12" height="18" rx="2" fill="#2c2c2c" stroke="#3a2d20" /><rect x="6" y="4" width="12" height="7" rx="2" fill="#e08a1e" /><path d="M13.2 10.5 L10 15 H12.6 L11 19.5" stroke="#ffd24a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>;
}

/** What something costs: Blocks in ink, Batteries in blue. */
function Cost({ cost, gas }: { cost: number; gas: number }) {
  return <span class="cost">{cost}{gas > 0 && <i>{gas}</i>}</span>;
}

function TrainButton({ m, kind }: { m: Match; kind: Kind }) {
  const info = m.hud.value.train.find((t) => t.kind === kind)!;
  const d = def(kind);
  const press = usePress(() => (info.ok ? m.train(kind) : m.alert(`why${kind}`, info.why, 'warn', undefined, undefined, 5)), () => m.toggleRepeat(kind));
  return (
    <button class={`tile ${info.ok ? '' : 'dim'} ${info.repeat ? 'rep' : ''}`} aria-label={`Train ${d.name}`} data-kind={kind} {...press}>
      <UnitIcon kind={kind} size={20} />
      <span class="name">{d.short}</span>
      <Cost cost={d.cost} gas={d.gas} />
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
    <button class={`tile ${info.ok ? '' : 'dim'} ${active ? 'on' : ''}`} aria-label={`Build ${d.name}`} data-kind={kind}
      onClick={() => (info.ok ? m.beginPlace(kind) : m.alert(`why${kind}`, info.why, 'warn', undefined, undefined, 5))}>
      <UnitIcon kind={kind} size={20} />
      <span class="name">{d.short}</span>
      <Cost cost={d.cost} gas={d.gas} />
    </button>
  );
}

function ResearchButton({ m, kind }: { m: Match; kind: Kind }) {
  const info = m.hud.value.research.find((t) => t.kind === kind)!;
  const d = def(kind);
  const done = info.level >= info.max;
  return (
    <button class={`row ${info.ok ? '' : 'dim'}`} aria-label={`Research ${d.name}`} data-kind={kind}
      onClick={() => (info.ok ? m.research(kind) : m.alert(`why${kind}`, info.why, 'warn', undefined, undefined, 5))}>
      <UnitIcon kind={kind} size={24} />
      <span class="name">{d.name} <b class="pips">{'●'.repeat(info.level)}{'○'.repeat(info.max - info.level)}</b></span>
      {done ? <span class="cost">Top level</span> : <Cost cost={info.cost} gas={info.gas} />}
      {info.progress >= 0 && <span class="bar"><i style={{ width: `${Math.round(info.progress * 100)}%` }} /></span>}
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
  const [tab, setTab] = useState<'build' | 'train' | 'tech'>('train');
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
        <span class="stat"><BatteryIcon /> <b data-stat="batteries">{h.gas}</b></span>
        <span class={`stat ${capped ? 'bad' : ''}`}><span class="lbl">Supply</span> <b>{h.supply}/{h.cap}</b></span>
        <span class={`stat ${h.workers > h.work ? 'over' : ''}`}><span class="lbl">Workers</span> <b data-stat="workers">{h.workers}/{h.work}</b></span>
        <span class="clock">{clock(h.tick)}</span>
        <button class="pause" aria-label="Pause" onClick={() => { m.paused.value = true; m.menu.value = true; }}>II</button>
      </div>

      <div class="left">
        <div class="tabs">
          <button class={tab === 'build' ? 'on' : ''} onClick={() => setTab('build')}>Build</button>
          <button class={tab === 'train' ? 'on' : ''} onClick={() => { setTab('train'); m.cancelPlace(); }}>Train</button>
          <button class={tab === 'tech' ? 'on' : ''} onClick={() => { setTab('tech'); m.cancelPlace(); }}>Tech</button>
        </div>
        {tab === 'train' ? (
          <div class="grid">
            {h.train.map((t) => <TrainButton key={t.kind} m={m} kind={t.kind} />)}
          </div>
        ) : tab === 'build' ? (
          <div class="grid">
            {h.build.map((b) => <BuildButton key={b.kind} m={m} kind={b.kind} />)}
          </div>
        ) : (
          <div class="list">
            {h.research.map((r) => <ResearchButton key={r.kind} m={m} kind={r.kind} />)}
            <p class="note">Researched at the Armory. Weapons: every unit hits harder. Armour: every unit takes less.</p>
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
          <span>{def(placing.kind).name}: {placing.kind === K.Refinery ? 'drag the outline onto a battery pack' : 'drag the outline, then build'}</span>
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
              <tr><td>Batteries hauled</td><td>{m.g.players[0]!.stats.gathered2}</td><td>{m.g.players[1]!.stats.gathered2}</td></tr>
            </table>
            <p class="small">The opponent opened with a {m.bot.plan === 'rush' ? 'rush' : m.bot.plan === 'greedy' ? 'fast expansion' : 'safe expansion'} and
              built toward {m.bot.tech === 'air' ? 'Gunships' : m.bot.tech === 'armour' ? 'Tanks and Juggernauts' : 'upgraded infantry'}.</p>
            <button class="chip wide" onClick={onAgain}>Play again</button>
            <button class="chip wide" onClick={onQuit}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
