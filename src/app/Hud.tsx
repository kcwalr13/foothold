// The panels around the battlefield: the left thumb runs the base, the right thumb runs the armies.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TargetedPointerEvent } from 'preact';
import { FACTIONS, def, isRefinery } from '../sim/data';
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
    // ---- the Dino Pack
    case K.Gatherer:
      return <svg viewBox="0 0 24 24" {...s}><path d="M2 12 L8 9 V15 Z" fill={t.dark} /><ellipse cx="11" cy="12" rx="6" ry="4.5" fill={t.fill} /><ellipse cx="18" cy="12" rx="3.2" ry="2.6" fill={t.dark} /><rect x="8" y="9" width="6" height="6" fill="#e9b730" stroke={ink} /></svg>;
    case K.Raptor:
      return <svg viewBox="0 0 24 24" {...s}><path d="M1 12 L9 10 V14 Z" fill={t.dark} /><ellipse cx="11" cy="12" rx="5.5" ry="3.2" fill={t.fill} /><path d="M14 9 L23 10.6 L19 12 L23 13.4 L14 15 Z" fill={t.dark} /><path d="M8 9 L7.5 15 M11 9 L10.5 15" stroke={t.dark} stroke-width="1.4" /><ellipse cx="9" cy="6.5" rx="2.4" ry="1.5" fill={t.dark} /><ellipse cx="9" cy="17.5" rx="2.4" ry="1.5" fill={t.dark} /></svg>;
    case K.Spitter:
      return <svg viewBox="0 0 24 24" {...s}><path d="M1 12 L8 9.5 V14.5 Z" fill={t.dark} /><ellipse cx="9.5" cy="12" rx="5" ry="3.8" fill={t.fill} /><path d="M13 12 L15 4.5 A8 8 0 0 1 15 19.5 Z" fill={t.light} stroke={t.dark} stroke-width="1" /><ellipse cx="17.5" cy="12" rx="3" ry="2.2" fill={t.dark} /><circle cx="21.5" cy="12" r="1.5" fill="#7fd04a" /></svg>;
    case K.Horn:
      return <svg viewBox="0 0 24 24" {...s}><ellipse cx="9" cy="12" rx="7.5" ry="6" fill={t.fill} /><ellipse cx="14.5" cy="12" rx="3" ry="6.8" fill={t.dark} /><ellipse cx="14.5" cy="12" rx="1.6" ry="5" fill={t.light} /><ellipse cx="18" cy="12" rx="3" ry="2.8" fill={t.fill} /><path d="M17 9.5 L23.5 8 M17 14.5 L23.5 16 M20.5 12 H23.5" stroke="#f6efd9" stroke-width="2" stroke-linecap="round" /><path d="M17 9.5 L23.5 8 M17 14.5 L23.5 16 M20.5 12 H23.5" stroke={ink} stroke-width="0.5" stroke-linecap="round" fill="none" /></svg>;
    case K.Ptero:
      return <svg viewBox="0 0 24 24" {...s}><path d="M14 11 Q15 4 9 1 Q8 7 6 11 Z M14 13 Q15 20 9 23 Q8 17 6 13 Z" fill={t.fill} stroke={t.dark} stroke-width="1" /><ellipse cx="10.5" cy="12" rx="5.5" ry="2" fill={t.dark} /><path d="M15 10.4 L23.5 12 L15 13.6 Z" fill={t.dark} /></svg>;
    case K.Bronto:
      return <svg viewBox="0 0 24 24" {...s}><path d="M7 12 Q3 11 1 7" stroke={t.dark} stroke-width="2.6" fill="none" stroke-linecap="round" /><ellipse cx="10.5" cy="12" rx="6.5" ry="5.2" fill={t.fill} /><ellipse cx="10" cy="12" rx="4" ry="1.5" fill={t.dark} /><path d="M15.5 12 Q19 12.5 21.5 15.5" stroke={t.fill} stroke-width="3" fill="none" stroke-linecap="round" /><ellipse cx="22" cy="16" rx="1.9" ry="1.5" fill={t.dark} /></svg>;
    case K.Rex:
      return <svg viewBox="0 0 24 24" {...s}><path d="M1 12 L7 8.5 V15.5 Z" fill={t.dark} /><ellipse cx="9" cy="12" rx="6" ry="5" fill={t.fill} /><path d="M6 8 V16 M9 7.4 V16.6" stroke={t.dark} stroke-width="1.6" /><path d="M12 7 L20 7.6 Q23.5 12 20 16.4 L12 17 Z" fill={t.dark} /><path d="M16.5 8.2 H21 M16.5 15.8 H21" stroke="#f6efd9" stroke-width="1.6" stroke-dasharray="1.2 1.1" /></svg>;
    case K.Nest:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10.5" fill="#8a6a43" stroke="#5d452b" /><circle cx="12" cy="12" r="7" fill="#e6d39c" /><ellipse cx="12" cy="9" rx="2" ry="2.6" fill="#f6efd9" stroke={t.dark} /><ellipse cx="9" cy="14" rx="2" ry="2.6" fill="#f6efd9" stroke={t.dark} /><ellipse cx="15" cy="14" rx="2" ry="2.6" fill="#f6efd9" stroke={t.dark} /></svg>;
    case K.Dig:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10" fill="#b08a5a" stroke="#5d452b" /><ellipse cx="12" cy="12" rx="5.5" ry="4.6" fill="#3a2d20" /><rect x="11" y="9.5" width="5" height="5" rx="1" fill="#e08a1e" stroke={ink} /><circle cx="5" cy="6" r="1.8" fill={t.fill} stroke={t.dark} /></svg>;
    case K.Den:
      return <svg viewBox="0 0 24 24" {...s}><path d="M2 14 Q2 3 12 3 Q22 3 22 14 Q22 21 12 21 Q2 21 2 14 Z" fill="#9a8f7c" stroke="#6a6052" /><path d="M7.5 21 A4.5 5 0 0 1 16.5 21 Z" fill="#2a211a" /><path d="M6 20 A6 6.6 0 0 1 18 20" stroke={t.fill} stroke-width="2" fill="none" /></svg>;
    case K.Wallow:
      return <svg viewBox="0 0 24 24" {...s}><ellipse cx="12" cy="12" rx="10.5" ry="9.5" fill="#8a6a43" stroke="#5d452b" /><ellipse cx="12" cy="12.5" rx="7" ry="6" fill="#5f4a35" /><path d="M10.5 13.5 L8.5 8 M13.5 13.5 L15.5 8" stroke="#f6efd9" stroke-width="2" stroke-linecap="round" /><circle cx="4" cy="7" r="1.6" fill={t.fill} stroke={t.dark} /><circle cx="20" cy="7" r="1.6" fill={t.fill} stroke={t.dark} /></svg>;
    case K.Roost:
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 1.5 L22 8 L20 21 L5 22 L1.5 9.5 Z" fill="#6a6052" /><path d="M12 5 L18.5 9 L17 17.5 L7.5 18 L5.5 10.5 Z" fill="#9a8f7c" /><circle cx="12" cy="12" r="3.4" fill="#e6d39c" stroke="#5d452b" stroke-width="1.6" /><path d="M14.5 10 L20 5 M9.5 14.5 L4.5 19" stroke={t.fill} stroke-width="2.2" stroke-linecap="round" /></svg>;
    case K.BonePit:
      return <svg viewBox="0 0 24 24" {...s}><ellipse cx="12" cy="12" rx="10.5" ry="9.5" fill="#b9a67a" /><ellipse cx="12" cy="12" rx="8" ry="7" fill="#eadfb8" /><path d="M6 12 H16 M8.5 8.5 Q10 12 8.5 15.5 M11 8.5 Q12.5 12 11 15.5 M13.5 8.5 Q15 12 13.5 15.5" stroke={ink} stroke-width="1.3" fill="none" stroke-linecap="round" /><circle cx="17.8" cy="12" r="2" fill="#f6efd9" stroke={ink} /><circle cx="4.5" cy="6" r="1.6" fill={t.fill} stroke={t.dark} /></svg>;
    case K.Cave:
      return <svg viewBox="0 0 24 24" {...s}><path d="M1.5 14 Q1.5 2.5 12 2.5 Q22.5 2.5 22.5 14 Q22.5 21.5 12 21.5 Q1.5 21.5 1.5 14 Z" fill="#6f675c" stroke="#463f36" /><path d="M5.5 21 A6.5 7.5 0 0 1 18.5 21 Z" fill="#1d1712" /><path d="M7 16.5 L8.5 19.5 L10 15 L12 18.5 L14 15 L15.5 19.5 L17 16.5" fill="none" stroke="#f6efd9" stroke-width="1.5" stroke-linejoin="round" /><path d="M4 20 A8 9 0 0 1 20 20" stroke={t.fill} stroke-width="2" fill="none" /></svg>;
    case K.Volcano:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10.5" fill="#7a5a3c" stroke={t.fill} stroke-width="1.8" /><circle cx="12" cy="12" r="7" fill="#5e4530" /><circle cx="12" cy="12" r="4.2" fill="#3a2418" /><circle cx="12" cy="12" r="3" fill="#ff8a2a" /><circle cx="11.3" cy="11.3" r="1.2" fill="#ffe07a" /></svg>;
    case K.Claws:
      return <svg viewBox="0 0 24 24" {...s}><path d="M5 4 Q9 12 6 20 M11 3 Q15 12 12 21 M17 4 Q21 12 18 20" stroke="#d9463d" stroke-width="2.6" fill="none" stroke-linecap="round" /><path d="M5 4 Q9 12 6 20 M11 3 Q15 12 12 21 M17 4 Q21 12 18 20" stroke={ink} stroke-width="0.6" fill="none" stroke-linecap="round" /></svg>;
    case K.Hide:
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 2.5 L20.5 6 V12 C20.5 17 17 20.2 12 21.8 C7 20.2 3.5 17 3.5 12 V6 Z" fill="#8a9a5b" stroke={ink} stroke-linejoin="round" /><path d="M7 9 Q9.5 7 12 9 Q14.5 7 17 9 M7 13 Q9.5 11 12 13 Q14.5 11 17 13 M9 17 Q10.5 15.4 12 17 Q13.5 15.4 15 17" stroke="#dfe7c0" stroke-width="1.4" fill="none" /></svg>;
    default:
      return null;
  }
}

/** An egg, for the count of those waiting. */
function EggIcon() {
  return <svg viewBox="0 0 24 24" width="17" height="17"><ellipse cx="12" cy="13" rx="7.5" ry="9.5" fill="#f6efd9" stroke="#3a2d20" stroke-width="1.6" /><circle cx="9.5" cy="9.5" r="1.7" fill="#4f9440" /><circle cx="14.5" cy="15" r="2.1" fill="#4f9440" /></svg>;
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
    <button class={`tile ${info.ok ? '' : 'dim'} ${info.repeat ? 'rep' : ''}`} aria-label={`${d.madeAt === K.Nest ? 'Hatch' : 'Train'} ${d.name}`} data-kind={kind} {...press}>
      <UnitIcon kind={kind} size={20} />
      <span class="name">{d.short}{d.brood > 1 && <b class="brood"> ×{d.brood}</b>}</span>
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
  const empty = !gi || gi.count === 0;
  const press = usePress(() => {
    const now = performance.now();
    // An empty group has nothing to order about: a tap on it opens the organiser, to put something in it.
    if (empty) m.sheet.value = i;
    else if (now - last.current < 380) m.focusGroup(i);
    else m.selectGroup(i);
    last.current = now;
  }, () => { m.sheet.value = i; });
  return (
    <button class={`group ${m.sel.value === i ? 'on' : ''} ${empty ? 'empty' : ''} ${gi?.hurt ? 'hurt' : ''}`} aria-label={`Group ${i + 1}`} data-group={i} {...press}>
      <span class="num">{i + 1}</span>
      {empty ? <span class="none">empty: tap to fill</span> : (
        <span class="mix">
          {gi!.kinds.map((k) => <span class="k" key={k.kind}><UnitIcon kind={k.kind} size={15} />{k.n}</span>)}
        </span>
      )}
      {m.hud.value.rally === i && <span class="rally" title="New units join this group">+new</span>}
      {!empty && m.modes.value[i] === O.Move && <span class="gmode">move</span>}
      {!empty && <span class="bar"><i style={{ width: `${Math.round(gi!.hp * 100)}%` }} class={gi!.hp < 0.35 ? 'low' : ''} /></span>}
    </button>
  );
}

/** What is picked up in the organiser: one kind of unit from a group, or (kind 0) everyone in it. */
interface Picked { from: number; kind: number; n: number; all: boolean }

/**
 * The army organiser. All four groups side by side; tap the units you want, then the group they should
 * join. Opened by the Groups button, by a tap on an empty group, or by a press and hold on any group.
 */
function Organiser({ m }: { m: Match }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const outside = useRef(false);
  const open = m.sheet.value >= 0;
  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);
  if (!open) return null;
  const groups = m.hud.value.groups;
  const have = (from: number, kind: number) => {
    const gi = groups[from];
    if (!gi) return 0;
    return kind === 0 ? gi.count : gi.kinds.find((k) => k.kind === kind)?.n ?? 0;
  };
  const max = picked ? have(picked.from, picked.kind) : 0;
  const n = picked ? (picked.all ? max : Math.min(picked.n, max)) : 0;
  const live = picked !== null && max > 0;
  const close = () => { m.sheet.value = -1; };
  // A tap outside the sheet closes it, but only a tap that began there: the tap that opened the organiser
  // ends with a click too, and on a wide phone that click lands on the veil that has just appeared.
  const veil = {
    onPointerDown: (e: TargetedPointerEvent<HTMLElement>) => { outside.current = e.target === e.currentTarget; },
    onClick: (e: MouseEvent) => {
      if (outside.current && e.target === e.currentTarget) close();
      outside.current = false;
    },
  };
  const pick = (from: number, kind: number) => {
    if (picked && picked.from === from && picked.kind === kind) setPicked(null);
    else if (have(from, kind) > 0) setPicked({ from, kind, n: have(from, kind), all: true });
  };
  const drop = (to: number) => {
    if (!picked || !live || picked.from === to) return;
    m.assignPart(picked.from, to, picked.kind, picked.all ? max : n);
    m.sel.value = to;
    setPicked(null);
  };
  const set = (count: number) => picked && setPicked({ ...picked, n: Math.max(1, Math.min(max, count)), all: count >= max });
  const what = picked ? (picked.kind === 0 ? (n === 1 ? 'unit' : 'units') : n === 1 ? def(picked.kind).name : def(picked.kind).plural) : '';
  return (
    <div class="veil" {...veil}>
      <div class="sheet org">
        <div class="cards">
          {[0, 1, 2, 3].map((i) => {
            const gi = groups[i];
            const target = live && picked!.from !== i;
            const whole = live && picked!.from === i && picked!.kind === 0;
            return (
              <div key={i} class={`gcard ${target ? 'target' : ''} ${live && picked!.from === i ? 'from' : ''}`} data-card={i} onClick={() => drop(i)}>
                <button class={`ghead ${whole ? 'on' : ''}`} aria-label={target ? `Move them to Group ${i + 1}` : `Everyone in Group ${i + 1}`}
                  onClick={(e) => { if (!target) { e.stopPropagation(); pick(i, 0); } }}>
                  <b>{i + 1}</b>
                  <span>{target ? 'Move here' : gi && gi.count > 0 ? `all ${gi.count}` : 'empty'}</span>
                </button>
                <div class="gkinds">
                  {(gi?.kinds ?? []).map((k) => (
                    <button key={k.kind} class={`gk ${live && picked!.from === i && (picked!.kind === k.kind || picked!.kind === 0) ? 'on' : ''}`}
                      aria-label={`${k.n} ${k.n === 1 ? def(k.kind).name : def(k.kind).plural} in Group ${i + 1}`}
                      onClick={(e) => { if (!target) { e.stopPropagation(); pick(i, k.kind); } }}>
                      <UnitIcon kind={k.kind} size={19} />
                      <span>{k.n}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {live ? (
          <div class="orow" data-row="picked">
            <button class="chip" aria-label="One fewer" disabled={n <= 1} onClick={() => set(n - 1)}>−</button>
            <b class="count" data-count={n}>{n}</b>
            <button class="chip" aria-label="One more" disabled={n >= max} onClick={() => set(n + 1)}>+</button>
            <button class={`chip ${!picked!.all && n === Math.ceil(max / 2) ? 'on' : ''}`} disabled={max < 2} onClick={() => set(Math.ceil(max / 2))}>Half</button>
            <button class={`chip ${picked!.all ? 'on' : ''}`} onClick={() => set(max)}>All</button>
            <span class="say">{what} from Group {picked!.from + 1}. Now tap the group {n === 1 ? 'it' : 'they'} should join.</span>
          </div>
        ) : (
          <div class="orow" data-row="hint">
            <span class="say">Tap the units you want, or a group's number for everyone in it. Then tap the group they should join.</span>
          </div>
        )}
        <div class="orow">
          <span class="say tight">New units join</span>
          {[0, 1, 2, 3].map((i) => (
            <button key={i} class={`chip ${m.hud.value.rally === i ? 'on' : ''}`} aria-label={`New units join Group ${i + 1}`} onClick={() => m.setRally(i)}>{i + 1}</button>
          ))}
          <button class="chip done" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  );
}

export function Hud({ m, miniRef, onQuit, onAgain }: { m: Match; miniRef: { current: HTMLCanvasElement | null }; onQuit: () => void; onAgain: () => void }) {
  const [tab, setTab] = useState<'build' | 'train' | 'tech'>('train');
  const h = m.hud.value;
  const mine = m.factions[0], theirs = m.factions[1], dino = mine === 'dino';
  const F = FACTIONS[mine];
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
        <span class={`stat ${h.workers > h.work ? 'over' : ''}`}><span class="lbl">{def(F.worker).plural}</span> <b data-stat="workers">{h.workers}/{h.work}</b></span>
        {dino && <span class={`stat ${h.eggs >= h.eggMax && h.eggMax > 0 ? 'over' : ''}`} title="Eggs ready in your Nests"><EggIcon /> <b data-stat="eggs">{h.eggs}/{h.eggMax}</b></span>}
        <span class="clock">{clock(h.tick)}</span>
        <button class="pause" aria-label="Pause" onClick={() => { m.paused.value = true; m.menu.value = true; }}>II</button>
      </div>

      <div class="left">
        <div class="tabs">
          <button class={tab === 'build' ? 'on' : ''} onClick={() => setTab('build')}>Build</button>
          <button class={tab === 'train' ? 'on' : ''} onClick={() => { setTab('train'); m.cancelPlace(); }}>{dino ? 'Hatch' : 'Train'}</button>
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
            <p class="note">{dino
              ? 'Researched at the Bone Pit. Claws: every dinosaur hits harder. Hide: every dinosaur takes less.'
              : 'Researched at the Armory. Weapons: every unit hits harder. Armour: every unit takes less.'}</p>
          </div>
        )}
        <Mini m={m} canvasRef={miniRef} />
      </div>

      <div class="right">
        {[0, 1, 2, 3].map((i) => <GroupButton key={i} m={m} i={i} />)}
        <div class="orders">
          <button class={sel >= 0 && m.mode.value === O.Attack ? 'on' : ''} aria-pressed={sel >= 0 && m.mode.value === O.Attack} disabled={sel < 0} onClick={() => m.setMode(O.Attack)}>Attack</button>
          <button class={sel >= 0 && m.mode.value === O.Move ? 'on' : ''} aria-pressed={sel >= 0 && m.mode.value === O.Move} disabled={sel < 0} onClick={() => m.setMode(O.Move)}>Move</button>
          <button disabled={sel < 0} onClick={() => m.hold()}>Hold</button>
          <button aria-label="Groups" onClick={() => { m.sheet.value = Math.max(0, sel); }}>Groups</button>
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
          <span>{def(placing.kind).name}: {isRefinery(placing.kind) ? 'drag the outline onto a battery pack'
            : dino && placing.kind !== K.Nest ? 'goes on nesting ground; costs a Gatherer' : dino ? 'drag the outline; costs a Gatherer' : 'drag the outline, then build'}</span>
          <button class={`yes ${placing.ok ? '' : 'dim'}`} aria-label="Confirm build" onClick={() => m.confirmPlace()}>Build ✓</button>
        </div>
      )}
      {!placing && site && (
        <div class="bar place">
          <span>{def(site.kind).name} {dino ? 'growing' : 'under construction'}</span>
          <button class="no wide" onClick={() => m.cancelSite()}>Cancel it</button>
        </div>
      )}
      {!placing && !site && sel >= 0 && h.groups[sel] && h.groups[sel]!.count > 0 && (
        <div class="hint">Group {sel + 1}: tap the map to {m.mode.value === O.Move ? 'move there without stopping to fight' : 'go there, fighting on the way'}</div>
      )}

      <Organiser m={m} />

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
            <p>{over === m.me ? `Their last ${def(FACTIONS[theirs].hall).name} is down.` : `Your last ${def(F.hall).name} is down.`} Match time {clock(m.g.tick)}.</p>
            <table>
              <tr><th></th><th>You</th><th>Opponent</th></tr>
              <tr><td>Units trained</td><td>{m.g.players[0]!.stats.trained}</td><td>{m.g.players[1]!.stats.trained}</td></tr>
              <tr><td>Units lost</td><td>{m.g.players[0]!.stats.lostUnits}</td><td>{m.g.players[1]!.stats.lostUnits}</td></tr>
              <tr><td>Buildings lost</td><td>{m.g.players[0]!.stats.lostBuildings}</td><td>{m.g.players[1]!.stats.lostBuildings}</td></tr>
              <tr><td>Blocks hauled</td><td>{m.g.players[0]!.stats.gathered}</td><td>{m.g.players[1]!.stats.gathered}</td></tr>
              <tr><td>Batteries hauled</td><td>{m.g.players[0]!.stats.gathered2}</td><td>{m.g.players[1]!.stats.gathered2}</td></tr>
            </table>
            <p class="small">The opponent opened with a {m.bot.plan === 'rush' ? 'rush' : m.bot.plan === 'greedy' ? 'fast expansion' : 'safe expansion'} and
              built toward {theirs === 'dino'
                ? (m.bot.tech === 'air' ? 'a flock of Pteros' : m.bot.tech === 'armour' ? 'Horns, Brontos and Rexes' : 'a swarm of Raptors and Spitters')
                : (m.bot.tech === 'air' ? 'Gunships' : m.bot.tech === 'armour' ? 'Tanks and Juggernauts' : 'upgraded infantry')}.</p>
            <button class="chip wide" onClick={onAgain}>Play again</button>
            <button class="chip wide" onClick={onQuit}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
