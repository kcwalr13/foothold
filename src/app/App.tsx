// Screens: the menu, and a match with its battlefield and panels.
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { Hud } from './Hud';
import { attachInput } from './input';
import { Match } from './match';
import { Renderer, drawMini } from './render';
import type { Faction, Mode } from '../sim/types';

declare const __BUILD__: { commit: string; date: string };

export const updateReady = signal<(() => void) | null>(null);

// Hard and Brutal arrive with the full opponent in M4.
const LEVELS = ['Easy', 'Normal'];
const NAMES: Record<Faction, string> = { green: 'Green Army', dino: 'Dino Pack' };

interface Choice { mode: Mode; me: Faction; foe: Faction | 'any' }

/** What the player last chose on the menu, kept for next time where the browser allows it. */
function remembered(): Choice {
  try {
    const v = JSON.parse(localStorage.getItem('foothold.sides') ?? '{}') as { mode?: string; me?: string; foe?: string };
    return { mode: v.mode === 'frenzy' ? 'frenzy' : 'classic', me: v.me === 'dino' ? 'dino' : 'green', foe: v.foe === 'green' || v.foe === 'dino' ? v.foe : 'any' };
  } catch {
    return { mode: 'classic', me: 'green', foe: 'any' };
  }
}

function Battle({ level, seed, sides, onQuit, onAgain }: { level: number; seed: number; sides: readonly Faction[]; onQuit: () => void; onAgain: () => void }) {
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

function Menu({ onPlay }: { onPlay: (level: number, choice: Choice) => void }) {
  const [help, setHelp] = useState(false);
  const [sides, setSides] = useState(remembered);
  const update = updateReady.value;
  const frenzy = sides.mode === 'frenzy';
  const choose = (next: Choice) => {
    setSides(next);
    try {
      localStorage.setItem('foothold.sides', JSON.stringify(next));
    } catch { /* private browsing: the choice lasts until the page closes */ }
  };
  return (
    <div class="menu">
      <div class="card">
        <h1>FOOTHOLD</h1>
        <p class="tag">{frenzy
          ? 'Four corners, a hero each, and bases that make their own armies. Every side for itself: be the last one standing.'
          : 'Toy soldiers and plastic dinosaurs on a paper map. Take the map, starve them out, knock down every last base.'}</p>
        {!help ? (
          <>
            <div class="modes" role="group" aria-label="Game">
              <button class={`chip ${!frenzy ? 'on' : ''}`} aria-pressed={!frenzy} aria-label="Classic: one opponent, bases to build" onClick={() => choose({ ...sides, mode: 'classic' })}>Classic</button>
              <button class={`chip ${frenzy ? 'on' : ''}`} aria-pressed={frenzy} aria-label="Frenzy: three opponents, a hero each" onClick={() => choose({ ...sides, mode: 'frenzy' })}>Frenzy</button>
            </div>
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
              {LEVELS.map((name, i) => <button key={name} class="chip big" onClick={() => onPlay(i, sides)}>{name}</button>)}
            </div>
            <button class="chip wide" onClick={() => setHelp(true)}>How to play</button>
            {update && <button class="chip wide" onClick={update}>New version ready: tap to load it</button>}
          </>
        ) : (
          <>
            {frenzy ? (
              <ul class="how">
                <li><b>The round.</b> Four corners, every side for itself. Lose your base and you are out; the last base standing wins.</li>
                <li><b>Left thumb, the base.</b> It stands inside walls with one way out, and makes units by itself for as long as there is supply, slowly at first: Bayonets or Raptors to begin with, who fight hand to hand. Muster on the Tech tab speeds it up. Spawn: unlock a unit with Blocks, then tap it into or out of the mix.</li>
                <li><b>Collectors.</b> The two behind your base bring in your Blocks, and sell everything on the Tech tab: Weapons and Armour for the army, Muster for a faster base, Haul for more Blocks, and Might, Grit and Tempo for your hero. Lose one and half your Blocks stop; lose both and nothing can be bought. Tap a Collector to open Tech.</li>
                <li><b>Right thumb, the hero.</b> Tap your hero, then the map. It goes on its own; switch Follow on and your first group goes wherever it is sent. Abilities open at levels 1, 3 and 6: tap one, then the map if a ring appears. A fallen hero comes back at the base, and mends there.</li>
                <li><b>Attack and Move.</b> Attack fights on the way and Move doesn't stop. Whichever you press stays lit, for the hero and every group, until you press the other. Hold digs in.</li>
                <li><b>Groups.</b> New units join Group 1. Press and hold a group (or tap the empty one) to split some off, and to choose which group new units join.</li>
                <li><b>Blocks.</b> What your Collectors bring in, a share of everything your side brings down, and more for holding the Watchtower in the middle alone. A hero learns from every enemy that falls near it.</li>
                <li><b>Overtime.</b> From 10:00 every base crumbles, except the base of the side that holds the middle.</li>
                <li><b>Map.</b> Drag to pan, pinch to zoom. Double-tap the hero or a group to jump to it. Pause, top right, also sets the speed: half or three-quarter to take your time, double to hurry.</li>
                <li><b>Infantry.</b> Bayonets are tough and cheap, but must reach what they fight and can't touch a flyer. Troopers shoot, and shoot down Gunships. Runners are quick, and run down Lancers and Mortars. Lancers break Tanks, Juggernauts, Turrets and bases.</li>
                <li><b>Vehicles.</b> Tanks and Juggernauts blast crowds of infantry. Mortars outrange Turrets but must stand still to fire. Flak Tracks hit only flyers. Gunships fly over anything and wreck vehicles.</li>
                <li><b>Dinosaurs.</b> Raptors come in pairs, and run down Lancers and Mortars. Spitters shoot ground and air. Horns charge infantry and walls. Pteros fly, fight other flyers, and tear into whatever can't shoot up. Brontos stomp crowds and buildings flat. A Rex eats Tanks. Most must reach what they bite.</li>
              </ul>
            ) : (
              <ul class="how">
                <li><b>Left thumb, the base.</b> Train: tap a unit to queue one, press and hold to keep them coming. Build: pick a building, drag its outline onto the map, then Build.</li>
                <li><b>Right thumb, the armies.</b> Tap a group, then tap the map or the minimap to send it. Attack fights on the way and Move doesn't stop; whichever you press stays lit, for every group, until you press the other. Hold digs in.</li>
                <li><b>Groups.</b> Tap Groups (or an empty group): tap the units you want, then the group they should join. New units join the group marked +new.</li>
                <li><b>Map.</b> Drag to pan, pinch to zoom. Double-tap a group to jump to it. Pause, top right, also sets the speed: half or three-quarter to take your time, double to hurry.</li>
                <li><b>Economy.</b> A base has work for about 12 Workers on Blocks. A Refinery on a battery pack puts three more on Batteries, which buy vehicles, Gunships and research. More bases mean more of both and a higher supply cap.</li>
                <li><b>Infantry.</b> Troopers beat Runners and Lancers, and shoot down Gunships. Runners raid Workers and run down Lancers and Mortars. Lancers break Tanks, Juggernauts, Turrets and buildings.</li>
                <li><b>Vehicles.</b> Tanks and Juggernauts blast crowds of infantry. Mortars outrange Turrets but must stand still to fire. Flak Tracks hit only flyers. Gunships fly over anything and wreck vehicles.</li>
                <li><b>Ground.</b> High ground sees down, shoots further, and can't be seen from below. Stand a unit by a watchtower to see the road.</li>
                <li><b>The Dino Pack.</b> Everything hatches at a Nest, which lays an egg every few seconds and holds three: each egg is a Gatherer or a fighter. A building costs the Gatherer that becomes it and goes on nesting ground near a Nest, so more eggs means more bases. Dens unlock dinosaurs.</li>
                <li><b>Dinosaurs.</b> Raptors come two to an egg and run down Lancers and Mortars. Spitters shoot ground and air. Horns charge infantry and walls. Pteros fly, fight other flyers, and tear into whatever can't shoot up. Brontos stomp crowds and buildings flat. A Rex eats Tanks. Most must reach what they bite: give them open ground.</li>
              </ul>
            )}
            <button class="chip wide" onClick={() => setHelp(false)}>Back</button>
          </>
        )}
        <p class="build">MF · Frenzy · {__BUILD__.commit} · {__BUILD__.date}</p>
      </div>
    </div>
  );
}

interface Session { level: number; seed: number; n: number; choice: Choice; sides: readonly Faction[] }

/**
 * Who sits where. Classic: you and one opponent. Frenzy: you and three. "Either" is settled when the match
 * starts, and again for each rematch: one coin for Classic, a coin a seat for Frenzy.
 */
function seat(choice: Choice, seed: number): Faction[] {
  const coin = (i: number): Faction => (choice.foe !== 'any' ? choice.foe : ((seed >> i) & 1) === 0 ? 'green' : 'dino');
  return choice.mode === 'frenzy' ? [choice.me, coin(0), coin(1), coin(2)] : [choice.me, coin(0)];
}

export function App() {
  const params = new URLSearchParams(location.search);
  const side = (v: string | null): Faction => (v === 'dino' ? 'dino' : 'green');
  const fromLink = (): Session => {
    // A link can start a match directly: ?play=1&seed=7&me=dino&foe=green, and &mode=frenzy for four corners.
    const mode: Mode = params.get('mode') === 'frenzy' ? 'frenzy' : 'classic';
    const foe = params.get('foe');
    const choice: Choice = { mode, me: side(params.get('me')), foe: foe === 'green' || foe === 'dino' ? foe : mode === 'frenzy' ? 'any' : 'green' };
    const seed = Number(params.get('seed') || 7);
    return { level: Number(params.get('play') || 1), seed, n: 0, choice, sides: seat(choice, seed) };
  };
  const [game, setGame] = useState<Session | null>(params.has('play') ? fromLink() : null);
  const fresh = (level: number, n: number, choice: Choice): Session => {
    const seed = (Date.now() % 100000) + 1;
    return { level, seed, n, choice, sides: seat(choice, seed) };
  };
  return (
    <>
      {game
        ? <Battle key={game.n} level={game.level} seed={game.seed} sides={game.sides} onQuit={() => setGame(null)} onAgain={() => setGame(fresh(game.level, game.n + 1, game.choice))} />
        : <Menu onPlay={(level, choice) => setGame(fresh(level, 1, choice))} />}
      <div class="rotate"><div><b>Turn your phone sideways</b><br />Foothold plays in landscape.</div></div>
    </>
  );
}
