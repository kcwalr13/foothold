// Screens: the menu, and a match with its battlefield and panels.
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { Hud } from './Hud';
import { attachInput } from './input';
import { Match } from './match';
import { Renderer, drawMini } from './render';

declare const __BUILD__: { commit: string; date: string };

export const updateReady = signal<(() => void) | null>(null);

// Hard and Brutal arrive with the full opponent in M4.
const LEVELS = ['Easy', 'Normal'];

function Battle({ level, seed, onQuit, onAgain }: { level: number; seed: number; onQuit: () => void; onAgain: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement | null>(null);
  const [m] = useState(() => new Match(seed, level));
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

function Menu({ onPlay }: { onPlay: (level: number) => void }) {
  const [help, setHelp] = useState(false);
  const update = updateReady.value;
  return (
    <div class="menu">
      <div class="card">
        <h1>FOOTHOLD</h1>
        <p class="tag">Toy soldiers on a paper map. Take the map, starve them out, knock down every Headquarters.</p>
        {!help ? (
          <>
            <div class="levels">
              {LEVELS.map((name, i) => <button key={name} class="chip big" onClick={() => onPlay(i)}>{name}</button>)}
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
              <li><b>Map.</b> Drag to pan, pinch to zoom. Double-tap a group to jump to it.</li>
              <li><b>Economy.</b> A base has work for about 12 Workers on Blocks. A Refinery on a battery pack puts three more on Batteries, which buy vehicles, Gunships and research. More bases mean more of both and a higher supply cap.</li>
              <li><b>Infantry.</b> Troopers beat Runners and Lancers, and shoot down Gunships. Runners raid Workers and run down Lancers and Mortars. Lancers break Tanks, Juggernauts, Turrets and buildings.</li>
              <li><b>Vehicles.</b> Tanks and Juggernauts blast crowds of infantry. Mortars outrange Turrets but must stand still to fire. Flak Tracks hit only flyers. Gunships fly over anything and wreck vehicles.</li>
              <li><b>Ground.</b> High ground sees down, shoots further, and can't be seen from below. Stand a unit by a watchtower to see the road.</li>
            </ul>
            <button class="chip wide" onClick={() => setHelp(false)}>Back</button>
          </>
        )}
        <p class="build">M2 · Full arsenal · {__BUILD__.commit} · {__BUILD__.date}</p>
      </div>
    </div>
  );
}

export function App() {
  const params = new URLSearchParams(location.search);
  const [game, setGame] = useState<{ level: number; seed: number; n: number } | null>(
    params.has('play') ? { level: Number(params.get('play') || 1), seed: Number(params.get('seed') || 7), n: 0 } : null,
  );
  const fresh = (level: number, n: number) => ({ level, seed: (Date.now() % 100000) + 1, n });
  return (
    <>
      {game
        ? <Battle key={game.n} level={game.level} seed={game.seed} onQuit={() => setGame(null)} onAgain={() => setGame(fresh(game.level, game.n + 1))} />
        : <Menu onPlay={(level) => setGame(fresh(level, 1))} />}
      <div class="rotate"><div><b>Turn your phone sideways</b><br />Foothold plays in landscape.</div></div>
    </>
  );
}
