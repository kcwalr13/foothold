// Screens: the menu, and a match with its battlefield and panels.
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { Hud } from './Hud';
import { attachInput } from './input';
import { Match } from './match';
import { Renderer, drawMini } from './render';
import type { Faction } from '../sim/types';

declare const __BUILD__: { commit: string; date: string };

export const updateReady = signal<(() => void) | null>(null);

// Hard and Brutal arrive with the full opponent in M4.
const LEVELS = ['Easy', 'Normal'];
const NAMES: Record<Faction, string> = { green: 'Green Army', dino: 'Dino Pack' };

/** What the player last chose on the menu, kept for next time where the browser allows it. */
function remembered(): { me: Faction; foe: Faction | 'any' } {
  try {
    const v = JSON.parse(localStorage.getItem('foothold.sides') ?? '{}') as { me?: string; foe?: string };
    return { me: v.me === 'dino' ? 'dino' : 'green', foe: v.foe === 'green' || v.foe === 'dino' ? v.foe : 'any' };
  } catch {
    return { me: 'green', foe: 'any' };
  }
}

function Battle({ level, seed, sides, onQuit, onAgain }: { level: number; seed: number; sides: readonly [Faction, Faction]; onQuit: () => void; onAgain: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement | null>(null);
  const [m] = useState(() => new Match(seed, level, sides));
  useEffect(() => {
    const c = canvas.current!;
    const r = new Renderer(c, m);
    const detach = attachInput(c, m);
    let lastMini = 0;
    m.onFrame = () => {
      r.draw();
      const now = performance.now();
      if (mini.current && now - lastMini > 180) {
        lastMini = now;
        drawMini(mini.current, r, m);
      }
    };
    const resize = () => r.resize();
    const hide = () => {
      // Leaving the app pauses the match, so an interruption never costs you the game.
      if (document.hidden && m.over.value < 0) {
        m.paused.value = true;
        m.menu.value = true;
      }
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    document.addEventListener('visibilitychange', hide);
    (window as unknown as { __fh?: Match }).__fh = m;
    m.start();
    return () => {
      m.stop();
      detach();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [m]);
  return (
    <div class="battle">
      <canvas ref={canvas} class="field" />
      <Hud m={m} miniRef={mini} onQuit={onQuit} onAgain={onAgain} />
    </div>
  );
}

function Menu({ onPlay }: { onPlay: (level: number, me: Faction, foe: Faction | 'any') => void }) {
  const [help, setHelp] = useState(false);
  const [sides, setSides] = useState(remembered);
  const update = updateReady.value;
  const choose = (next: { me: Faction; foe: Faction | 'any' }) => {
    setSides(next);
    try {
      localStorage.setItem('foothold.sides', JSON.stringify(next));
    } catch { /* private browsing: the choice lasts until the page closes */ }
  };
  return (
    <div class="menu">
      <div class="card">
        <h1>FOOTHOLD</h1>
        <p class="tag">Toy soldiers and plastic dinosaurs on a paper map. Take the map, starve them out, knock down every last base.</p>
        {!help ? (
          <>
            <div class="sides">
              <span class="lbl">You</span>
              {(['green', 'dino'] as const).map((f) => (
                <button key={f} class={`chip ${sides.me === f ? 'on' : ''}`} aria-pressed={sides.me === f} aria-label={`Play the ${NAMES[f]}`} onClick={() => choose({ ...sides, me: f })}>{NAMES[f]}</button>
              ))}
              <span class="lbl against">against</span>
              {(['green', 'dino', 'any'] as const).map((f) => (
                <button key={f} class={`chip ${sides.foe === f ? 'on' : ''}`} aria-pressed={sides.foe === f} aria-label={f === 'any' ? 'Against either' : `Against the ${NAMES[f]}`} onClick={() => choose({ ...sides, foe: f })}>
                  {f === 'any' ? 'Either' : f === 'green' ? 'Army' : 'Dinos'}
                </button>
              ))}
            </div>
            <div class="levels">
              {LEVELS.map((name, i) => <button key={name} class="chip big" onClick={() => onPlay(i, sides.me, sides.foe)}>{name}</button>)}
            </div>
            <button class="chip wide" onClick={() => setHelp(true)}>How to play</button>
            {update && <button class="chip wide" onClick={update}>New version ready: tap to load it</button>}
          </>
        ) : (
          <>
            <ul class="how">
              <li><b>Left thumb, the base.</b> Train: tap a unit to queue one, press and hold to keep them coming. Build: pick a building, drag its outline onto the map, then Build.</li>
              <li><b>Right thumb, the armies.</b> Tap a group, then tap the map or the minimap to send it. Attack fights on the way and Move doesn't stop; a group keeps whichever you set. Hold digs in.</li>
              <li><b>Groups.</b> Tap Groups (or an empty group): tap the units you want, then the group they should join. New units join the group marked +new.</li>
              <li><b>Map.</b> Drag to pan, pinch to zoom. Double-tap a group to jump to it. Pause, top right, also sets the speed: half or three-quarter to take your time, double to hurry.</li>
              <li><b>Economy.</b> A base has work for about 12 Workers on Blocks. A Refinery on a battery pack puts three more on Batteries, which buy vehicles, Gunships and research. More bases mean more of both and a higher supply cap.</li>
              <li><b>Infantry.</b> Troopers beat Runners and Lancers, and shoot down Gunships. Runners raid Workers and run down Lancers and Mortars. Lancers break Tanks, Juggernauts, Turrets and buildings.</li>
              <li><b>Vehicles.</b> Tanks and Juggernauts blast crowds of infantry. Mortars outrange Turrets but must stand still to fire. Flak Tracks hit only flyers. Gunships fly over anything and wreck vehicles.</li>
              <li><b>Ground.</b> High ground sees down, shoots further, and can't be seen from below. Stand a unit by a watchtower to see the road.</li>
              <li><b>The Dino Pack.</b> Everything hatches at a Nest, which lays an egg every few seconds and holds three: each egg is a Gatherer or a fighter. A building costs the Gatherer that becomes it and goes on nesting ground near a Nest, so more eggs means more bases. Dens unlock dinosaurs.</li>
              <li><b>Dinosaurs.</b> Raptors come two to an egg and run down Lancers and Mortars. Spitters shoot ground and air. Horns charge infantry and walls. Pteros fly, fight other flyers, and tear into whatever can't shoot up. Brontos stomp crowds and buildings flat. A Rex eats Tanks. Most must reach what they bite: give them open ground.</li>
            </ul>
            <button class="chip wide" onClick={() => setHelp(false)}>Back</button>
          </>
        )}
        <p class="build">M3 · The second faction · {__BUILD__.commit} · {__BUILD__.date}</p>
      </div>
    </div>
  );
}

interface Session { level: number; seed: number; n: number; me: Faction; foe: Faction | 'any'; sides: readonly [Faction, Faction] }

export function App() {
  const params = new URLSearchParams(location.search);
  const side = (v: string | null): Faction => (v === 'dino' ? 'dino' : 'green');
  const [game, setGame] = useState<Session | null>(
    params.has('play') ? {
      level: Number(params.get('play') || 1), seed: Number(params.get('seed') || 7), n: 0,
      me: side(params.get('me')), foe: side(params.get('foe')), sides: [side(params.get('me')), side(params.get('foe'))],
    } : null,
  );
  // "Either" is settled when the match starts, and again for each rematch.
  const fresh = (level: number, n: number, me: Faction, foe: Faction | 'any'): Session => {
    const seed = (Date.now() % 100000) + 1;
    return { level, seed, n, me, foe, sides: [me, foe === 'any' ? (seed % 2 === 0 ? 'green' : 'dino') : foe] };
  };
  return (
    <>
      {game
        ? <Battle key={game.n} level={game.level} seed={game.seed} sides={game.sides} onQuit={() => setGame(null)} onAgain={() => setGame(fresh(game.level, game.n + 1, game.me, game.foe))} />
        : <Menu onPlay={(level, me, foe) => setGame(fresh(level, 1, me, foe))} />}
      <div class="rotate"><div><b>Turn your phone sideways</b><br />Foothold plays in landscape.</div></div>
    </>
  );
}
