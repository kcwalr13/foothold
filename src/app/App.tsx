// Screens: the menu, and a match with its battlefield and panels.
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { Hud, SoundSwitch } from './Hud';
import { sfx } from './sound';
import { hintsOn, setHints } from './hints';
import { UnitGuide } from './Guide';
import { attachInput } from './input';
import { Match } from './match';
import { Renderer, drawMini } from './render';
import { clearSaved, loadSaved, saveMatch, type Saved } from './save';
import { hash, schedule } from '../sim/state';
import { CLASSIC_MAPS } from '../sim/map';
import type { Faction, Mode } from '../sim/types';

declare const __BUILD__: { commit: string; date: string };

export const updateReady = signal<(() => void) | null>(null);
/** The browser's own offer to install the game, where it makes one (Chrome on Android). */
export const installOffer = signal<{ prompt: () => Promise<void> } | null>(null);

/** On an iPhone or iPad the game is installed from Safari's Share menu, and the browser never offers. */
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Hints on or off, from How to play; turning them on starts them over. */
function HintSwitch() {
  const [on, setOn] = useState(hintsOn);
  return (
    <button class={`chip wide ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? 'Hints on: tap to turn them off' : 'Hints off: tap to turn them on from the start'}
      onClick={() => { setHints(!on); setOn(!on); }}>
      Hints: {on ? 'on' : 'off'}
    </button>
  );
}

const LEVELS = ['Easy', 'Normal', 'Hard', 'Brutal'];
/** Frenzy's opponents come in two levels so far. */
const FRENZY_LEVELS = 2;
const NAMES: Record<Faction, string> = { green: 'Green Army', dino: 'Dino Pack' };

interface Choice { mode: Mode; me: Faction; foe: Faction | 'any'; map: string }

/** What the player last chose on the menu, kept for next time where the browser allows it. */
function remembered(): Choice {
  try {
    const v = JSON.parse(localStorage.getItem('foothold.sides') ?? '{}') as { mode?: string; me?: string; foe?: string; map?: string };
    return {
      mode: v.mode === 'frenzy' ? 'frenzy' : 'classic', me: v.me === 'dino' ? 'dino' : 'green', foe: v.foe === 'green' || v.foe === 'dino' ? v.foe : 'any',
      map: CLASSIC_MAPS.some((m) => m.id === v.map) ? v.map! : 'twin',
    };
  } catch {
    return { mode: 'classic', me: 'green', foe: 'any', map: 'twin' };
  }
}

const clock = (ticks: number) => `${Math.floor(ticks / 600)}:${String(Math.floor((ticks % 600) / 10)).padStart(2, '0')}`;

/** Picks a saved match back up: plays it through again, a slice a frame, and checks it arrives where it was left. */
function Resume({ saved, onDone, onFail }: { saved: Saved; onDone: (m: Match) => void; onFail: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const m = new Match(saved.seed, saved.level, saved.sides, saved.map ?? 'twin');
    let raf = 0;
    const step = () => {
      if (!m.replay(saved.orders, saved.tick)) {
        setDone(m.g.tick / saved.tick);
        raf = requestAnimationFrame(step);
        return;
      }
      if (m.g.tick !== saved.tick || hash(m.g) !== saved.hash) {
        onFail();
        return;
      }
      // Orders given just before the app was left run on the next tick, as they would have.
      for (const o of saved.orders) if (o.tick > saved.tick) schedule(m.g, o.cmd);
      m.cam = { ...saved.cam };
      m.mode.value = saved.mode;
      m.paused.value = true;
      m.menu.value = true;
      onDone(m);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [saved]);
  return (
    <div class="menu">
      <div class="card resuming">
        <h1>FOOTHOLD</h1>
        <p class="tag">Picking up where you left off, at {clock(saved.tick)}…</p>
        <div class="bar" role="progressbar" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.round(done * 100)}%` }} /></div>
      </div>
    </div>
  );
}

function Battle({ level, seed, sides, choice, resumed, hints, onQuit, onAgain }: {
  level: number; seed: number; sides: readonly Faction[]; choice: Choice; resumed?: Match; hints: boolean; onQuit: () => void; onAgain: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement | null>(null);
  const [m] = useState(() => {
    const match = resumed ?? new Match(seed, level, sides, choice.map);
    match.hints = hints;
    return match;
  });
  useEffect(() => {
    const c = canvas.current!;
    const r = new Renderer(c, m);
    const detach = attachInput(c, m);
    let lastMini = 0, lastSave = performance.now();
    const keep = () => saveMatch(m, seed, choice, __BUILD__.commit);
    m.onFrame = () => {
      r.draw();
      const now = performance.now();
      // The match is kept every half minute of play, and whenever it is paused or the app is left.
      if (now - lastSave > 30000 && !m.paused.value) {
        lastSave = now;
        keep();
      }
      if (m.over.value >= 0) clearSaved();
      if (mini.current && now - lastMini > 180) {
        lastMini = now;
        drawMini(mini.current, r, m);
      }
    };
    const resize = () => r.resize();
    const hide = () => {
      // Leaving the app pauses the match and keeps it, so an interruption never costs you the game.
      if (document.hidden && m.over.value < 0) {
        m.paused.value = true;
        m.menu.value = true;
        keep();
      }
    };
    const unpause = m.paused.subscribe((p) => { if (p) keep(); });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.addEventListener('pagehide', keep);
    document.addEventListener('visibilitychange', hide);
    (window as unknown as { __fh?: Match; __fhHash?: () => number }).__fh = m;
    (window as unknown as { __fhHash?: () => number }).__fhHash = () => hash(m.g);
    (window as unknown as { __fhSound?: typeof sfx }).__fhSound = sfx;
    m.start();
    return () => {
      m.stop();
      detach();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('pagehide', keep);
      document.removeEventListener('visibilitychange', hide);
      unpause();
    };
  }, [m]);
  return (
    <div class="battle">
      <canvas ref={canvas} class="field" />
      <Hud m={m} miniRef={mini} onQuit={() => { clearSaved(); onQuit(); }} onAgain={() => { clearSaved(); onAgain(); }} />
    </div>
  );
}

function Menu({ onPlay, saved, onResume, note }: { onPlay: (level: number, choice: Choice) => void; saved: Saved | null; onResume: () => void; note: string }) {
  const [help, setHelp] = useState(false);
  const [units, setUnits] = useState(false);
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
            {note && <p class="note">{note}</p>}
            {saved && (
              <button class="chip wide resume" onClick={onResume}>
                Resume your match: {saved.choice.mode === 'frenzy' ? 'Frenzy' : CLASSIC_MAPS.find((mp) => mp.id === saved.map)?.name ?? 'Classic'}, {NAMES[saved.sides[0]!]}
                {saved.sides.length === 2 ? ` against the ${NAMES[saved.sides[1]!]}` : ''}, {LEVELS[saved.level]}, at {clock(saved.tick)}
              </button>
            )}
            <div class="modes" role="group" aria-label="Game">
              <button class={`chip ${!frenzy ? 'on' : ''}`} aria-pressed={!frenzy} aria-label="Classic: one opponent, bases to build" onClick={() => choose({ ...sides, mode: 'classic' })}>Classic</button>
              <button class={`chip ${frenzy ? 'on' : ''}`} aria-pressed={frenzy} aria-label="Frenzy: three opponents, a hero each" onClick={() => choose({ ...sides, mode: 'frenzy' })}>Frenzy</button>
              {!frenzy && (
                <span class="maps" role="group" aria-label="Map">
                  <span class="lbl">on</span>
                  {CLASSIC_MAPS.map((mp) => (
                    <button key={mp.id} class={`chip ${sides.map === mp.id ? 'on' : ''}`} aria-pressed={sides.map === mp.id} aria-label={`Map: ${mp.name}`} onClick={() => choose({ ...sides, map: mp.id })}>{mp.name}</button>
                  ))}
                </span>
              )}
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
              {LEVELS.slice(0, frenzy ? FRENZY_LEVELS : LEVELS.length).map((name, i) => <button key={name} class="chip big" onClick={() => onPlay(i, sides)}>{name}</button>)}
            </div>
            {!frenzy && <p class="lvlnote">Easy to Hard: the same rules for both sides, a sharper opponent each step. Brutal plays as Hard and collects a quarter more Blocks and Batteries.</p>}
            <button class="chip wide" onClick={() => setHelp(true)}>How to play</button>
            {update && <button class="chip wide" onClick={update}>New version ready: tap to load it</button>}
            {!installed() && installOffer.value && (
              <button class="chip wide" onClick={() => { void installOffer.value?.prompt(); installOffer.value = null; }}>Install, to play offline from your home screen</button>
            )}
            {!installed() && ios && <p class="lvlnote">To play on a flight, add Foothold to your home screen first: Share, then Add to Home Screen. It then runs with no connection.</p>}
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
            <div class="pair">
              <button class="chip wide" onClick={() => setUnits(true)}>Units</button>
              <button class="chip wide" onClick={() => setHelp(false)}>Back</button>
            </div>
            <div class="pair">
              <SoundSwitch />
              <HintSwitch />
            </div>
          </>
        )}
        <p class="build">M5 · Flight-ready · {__BUILD__.commit} · {__BUILD__.date}</p>
      </div>
      {units && (
        <div class="veil">
          <UnitGuide frenzy={frenzy} me={sides.me} onBack={() => setUnits(false)} />
        </div>
      )}
    </div>
  );
}

interface Session { level: number; seed: number; n: number; choice: Choice; sides: readonly Faction[]; resumed?: Match; link?: boolean }

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
  useEffect(() => {
    // Sound can only start from a tap; every button gives a little click.
    const tap = (e: PointerEvent) => {
      sfx.unlock();
      if ((e.target as Element | null)?.closest?.('button')) sfx.play('tap', 0.7);
    };
    document.addEventListener('pointerdown', tap, true);
    return () => document.removeEventListener('pointerdown', tap, true);
  }, []);
  const side = (v: string | null): Faction => (v === 'dino' ? 'dino' : 'green');
  const fromLink = (): Session => {
    // A link can start a match directly: ?play=1&seed=7&me=dino&foe=green, and &mode=frenzy for four corners.
    const mode: Mode = params.get('mode') === 'frenzy' ? 'frenzy' : 'classic';
    const foe = params.get('foe');
    const choice: Choice = { mode, me: side(params.get('me')), foe: foe === 'green' || foe === 'dino' ? foe : mode === 'frenzy' ? 'any' : 'green', map: params.get('map') ?? 'twin' };
    const seed = Number(params.get('seed') || 7);
    return { level: Number(params.get('play') || 1), seed, n: 0, choice, sides: seat(choice, seed), link: true };
  };
  const [game, setGame] = useState<Session | null>(params.has('play') ? fromLink() : null);
  const [saved, setSaved] = useState<Saved | null>(() => (params.has('play') ? null : loadSaved()));
  const [resuming, setResuming] = useState<Saved | null>(null);
  const [note, setNote] = useState('');
  const fresh = (level: number, n: number, choice: Choice): Session => {
    const seed = (Date.now() % 100000) + 1;
    return { level, seed, n, choice, sides: seat(choice, seed) };
  };
  return (
    <>
      {game
        ? <Battle key={game.n} level={game.level} seed={game.seed} sides={game.sides} choice={game.choice} resumed={game.resumed} hints={!game.link}
            onQuit={() => { setSaved(null); setGame(null); }} onAgain={() => setGame({ ...fresh(game.level, game.n + 1, game.choice), link: game.link })} />
        : resuming
          ? <Resume saved={resuming}
              onDone={(m) => { setResuming(null); setGame({ level: resuming.level, seed: resuming.seed, n: 1, choice: resuming.choice, sides: resuming.sides, resumed: m }); }}
              onFail={() => { clearSaved(); setSaved(null); setResuming(null); setNote("That match was kept by an older version of the game, and this one can't pick it up."); }} />
          : <Menu saved={saved} note={note} onResume={() => { setNote(''); setResuming(saved); }} onPlay={(level, choice) => { setSaved(null); setNote(''); setGame(fresh(level, 1, choice)); }} />}
      <div class="rotate"><div><b>Turn your phone sideways</b><br />Foothold plays in landscape.</div></div>
    </>
  );
}
