// The after-match report: how each side's army and economy grew, and what each built and when.
import { def, FACTIONS, isHall } from '../sim/data';
import { SCHEME_NAMES } from '../ai/bot';
import { SIDES, type Match } from './match';
import type { Entry, Sample } from './report';
import { TEAM } from './toys';

const clock = (ticks: number) => `${Math.floor(ticks / 600)}:${String(Math.floor((ticks % 600) / 10)).padStart(2, '0')}`;

/** One line of a build order, in the game's words. */
function said(e: Entry): string {
  const d = def(e.kind);
  switch (e.what) {
    case 'build': return isHall(e.kind) ? `${d.name}, a new base` : d.name;
    case 'first': return `First ${d.name}`;
    case 'research': return `${d.name} ${e.level}`;
    case 'upgrade': return `${d.name} ${e.level}`;
    case 'unlock': return `${d.plural} unlocked`;
  }
}

/** A small line chart of one measure for every side, all on the same scale. */
function Chart({ title, series, pick, end }: { title: string; series: Sample[][]; pick: (s: Sample) => number; end: number }) {
  const W = 300, H = 96, top = Math.max(1, ...series.flatMap((s) => s.map(pick)));
  const x = (t: number) => (t / Math.max(1, end)) * W, y = (v: number) => H - (v / top) * (H - 6) - 2;
  return (
    <figure class="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={title}>
        <line x1="0" y1={H} x2={W} y2={H} class="axis" />
        {series.map((s, i) => (
          <polyline key={i} fill="none" stroke={TEAM[i]!.dark} stroke-width={i === 0 ? 2.6 : 2} stroke-linejoin="round"
            points={s.map((p) => `${x(p.tick).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')} />
        ))}
        <text x="0" y={H + 12} class="tick">0:00</text>
        <text x={W} y={H + 12} class="tick" text-anchor="end">{clock(end)}</text>
        <text x="2" y="10" class="tick">{Math.round(top)}</text>
      </svg>
    </figure>
  );
}

export function MatchReport({ m, onBack }: { m: Match; onBack: () => void }) {
  const sides = m.chronicle.sides, g = m.g;
  const name = (i: number) => {
    if (m.frenzy) return `${SIDES[i]}${i === m.me ? ' (you)' : ''}`;
    if (i === m.me) return 'You';
    const f = g.players[i]!.faction;
    return m.bot ? `Opponent: ${SCHEME_NAMES[f][m.bot.scheme]}` : 'Opponent';
  };
  return (
    <div class="report" role="dialog" aria-label="Match report">
      <div class="rhead">
        <h2>Match report</h2>
        <button class="chip" onClick={onBack}>Back</button>
      </div>
      <div class="charts">
        <Chart title="Army, in what it cost" series={sides.map((s) => s.samples)} pick={(p) => p.army} end={g.tick} />
        {!m.frenzy && <Chart title={`${def(FACTIONS[g.players[m.me]!.faction].worker).plural} and ${def(FACTIONS[g.players[1 - m.me]!.faction].worker).plural}`} series={sides.map((s) => s.samples)} pick={(p) => p.workers} end={g.tick} />}
      </div>
      <div class={`orders n${sides.length}`}>
        {sides.map((s, i) => (
          <section key={i} data-side={i}>
            <h3 style={{ color: TEAM[i]!.ink }}><i style={{ background: TEAM[i]!.fill }} />{name(i)}</h3>
            <ol>
              {s.entries.map((e, j) => <li key={j}><span class="t">{clock(e.tick)}</span> {said(e)}</li>)}
              {s.entries.length === 0 && <li class="none">Nothing built</li>}
            </ol>
            <p class="made">{[...s.made.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${n === 1 ? def(k).name : def(k).plural}`).join(', ') || 'No units made'}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
