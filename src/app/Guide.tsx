// The unit guide: every unit of both factions, its toy in your colour and the opponent's, what it does, what it
// beats and what beats it, with its numbers read from the game's own data, so the guide can never go stale.
import { useState } from 'preact/hooks';
import { ABILITIES, FACTIONS, FRENZY, UNLOCK, WORK, def, heroDmg, heroHp } from '../sim/data';
import { C, K, type Faction, type Kind } from '../sim/types';
import { toyIcon } from './icons';

/** What a unit is for, in words: the design doc's unit tables, said the way a player would. */
interface Words {
  job: string;
  beats: string;
  beatenBy: string;
  /** In Frenzy, where there are no Workers to raid, when that changes what it beats. */
  frenzyBeats?: string;
}

const WORDS: Partial<Record<Kind, Words>> = {
  [K.Worker]: { job: 'Hauls Blocks and Batteries, and puts up buildings.', beats: 'Nothing: keep it out of fights.', beatenBy: 'Raiders: Runners, Gunships, Raptors and Pteros.' },
  [K.Trooper]: { job: 'Cheap rifle infantry that shoots ground and air.', beats: 'Runners, Lancers and Gunships.', beatenBy: 'Tanks, Mortars and Juggernauts: armour and splash.' },
  [K.Lancer]: { job: 'Anti-armour infantry with slow, heavy shots.', beats: 'Tanks, Juggernauts, Turrets and buildings.', beatenBy: 'Troopers and other light units.' },
  [K.Runner]: { job: 'Fast raider and scout.', beats: 'Workers, Lancers and Mortars.', beatenBy: 'Troopers, Tanks and Turrets.', frenzyBeats: 'Lancers and Mortars.' },
  [K.Tank]: { job: 'Line-breaker with a splash cannon.', beats: 'Crowds of infantry.', beatenBy: 'Lancers and Gunships.' },
  [K.Mortar]: { job: 'Long-range splash. Fires only after standing still a moment, and can’t hit what is close.', beats: 'Massed infantry, Turrets and buildings.', beatenBy: 'Runners, Tanks and flyers.' },
  [K.Flak]: { job: 'Anti-air escort for the army.', beats: 'Gunships and Pteros.', beatenBy: 'Every ground unit: it can only shoot up.' },
  [K.Gunship]: { job: 'Flying raider that crosses walls and cliffs.', beats: 'Tanks, Juggernauts and Workers.', beatenBy: 'Flak Tracks, massed Troopers and Turrets.', frenzyBeats: 'Tanks and Juggernauts.' },
  [K.Jugger]: { job: 'Late-game heavy.', beats: 'Light and armoured units alike.', beatenBy: 'Massed Lancers and flyers.' },
  [K.Bayonet]: { job: 'Tough, cheap foot soldier that fights hand to hand.', beats: 'Light units it can reach.', beatenBy: 'Splash, Turrets, and flyers: it can’t touch them.' },
  [K.Captain]: { job: 'Your hero: a rifle, steady at range, and three abilities.', beats: 'Whatever its abilities catch bunched up.', beatenBy: 'Being caught alone.' },
  [K.Gatherer]: { job: 'Hauls Blocks and Batteries, and becomes buildings.', beats: 'Nothing: keep it out of fights.', beatenBy: 'Raiders: Runners, Gunships, Raptors and Pteros.' },
  [K.Raptor]: { job: 'Cheap, fast biter.', beats: 'Lancers, Mortars and Workers.', beatenBy: 'Splash, Turrets and flyers.', frenzyBeats: 'Lancers and Mortars.' },
  [K.Spitter]: { job: 'Spits at ground and air from range.', beats: 'Flyers and light units.', beatenBy: 'Splash, armour, and Raptors up close.' },
  [K.Horn]: { job: 'Charging front line.', beats: 'Light units and buildings.', beatenBy: 'Lancers and flyers.' },
  [K.Ptero]: { job: 'Fast flying raider that fights air and ground.', beats: 'Workers, other flyers, slow shooters, and anything that can’t shoot up.', beatenBy: 'Troopers, Spitters, Flak Tracks and Turrets.', frenzyBeats: 'Other flyers, slow shooters, and anything that can’t shoot up.' },
  [K.Bronto]: { job: 'Slow, huge wall-breaker with a splash stomp.', beats: 'Buildings and massed light units.', beatenBy: 'Lancers and flyers.' },
  [K.Rex]: { job: 'Late-game heavy that eats vehicles.', beats: 'Anything armoured: Tanks, Juggernauts, Horns.', beatenBy: 'Massed Lancers and flyers.' },
  [K.Alpha]: { job: 'Your hero: teeth, speed, and three abilities.', beats: 'Whatever its abilities catch bunched up.', beatenBy: 'Being caught alone.' },
};

const CLASS: Record<number, string> = { [C.Light]: 'Light', [C.Armoured]: 'Armoured', [C.Air]: 'Air', [C.Structure]: 'Building' };
const one = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const tiles = (sub: number): string => `${one(Math.round((sub / 256) * 10) / 10)} tiles`;
const seconds = (ticks: number): string => `${one(Math.round(ticks) / 10)} s`;

/** Where a unit comes from, in Classic. */
function source(kind: Kind): string {
  const d = def(kind);
  const at = d.madeAt !== undefined ? def(d.madeAt).name : '';
  const others = d.needs.filter((k) => k !== d.madeAt).map((k) => def(k).name);
  if (d.madeAt === K.Nest) return `Hatches at a Nest${others.length ? `, once you have a ${others.join(' and a ')}` : ''}`;
  return `Trained at the ${at}${others.length ? `, with ${others.join(' and ')}` : ''}`;
}

function Card({ kind, frenzy }: { kind: Kind; frenzy: boolean }) {
  const d = def(kind), w = WORDS[kind];
  const armed = d.range > 0 || d.hero;
  const hp = d.hero ? `${heroHp(kind, 1)} at level 1` : String(d.hp);
  const dmg = d.hero ? heroDmg(kind, 1) : d.dmg;
  const hit = !armed ? 'Unarmed' : `${dmg} every ${seconds(d.cooldown)}${d.splash > 0 ? ', splash' : ''}${d.vs[C.Air] === 0 ? ', ground only' : d.vs[C.Light] === 0 ? ', flyers only' : ''}`;
  // A melee unit's tag says it fights hand to hand; only a shooter has a reach worth giving.
  const reach = !armed || d.melee ? '' : tiles(d.range);
  const tags = [CLASS[d.cls], d.air ? 'flies' : '', d.melee && armed ? 'melee' : '', !frenzy && d.brood > 1 ? `${d.brood} to an egg` : ''].filter(Boolean);
  let cost: string;
  if (d.hero) cost = 'One a side';
  else if (frenzy) cost = `${UNLOCK[kind] ? `Unlock ${UNLOCK[kind]}` : 'Free'} · one every ${seconds(WORK[kind]! / FRENZY.musterRate[0]!)}${d.brood > 1 ? `, ${d.brood} at a time` : ''}`;
  else cost = `${d.cost} Blocks${d.gas > 0 ? ` · ${d.gas} Batteries` : ''}${d.madeAt === K.Nest ? ' · an egg' : ''} · ${d.supply} supply`;
  const from = d.hero ? 'Comes back at your base when it falls' : frenzy ? '' : source(kind);
  const abilities = d.hero ? ABILITIES[kind] ?? [] : [];
  return (
    <div class="ucard" data-kind={kind}>
      <div class="upics">
        <img src={toyIcon(kind, 0)} alt="" />
        <img src={toyIcon(kind, 1)} alt="" />
      </div>
      <div class="utext">
        <div class="uname">{d.name}{tags.map((t) => <span key={t} class="utag">{t}</span>)}</div>
        <div class="ucost">{cost}</div>
        {w && <div class="uline">{w.job}</div>}
        {w && <div class="uline"><b>Beats</b> {frenzy && w.frenzyBeats ? w.frenzyBeats : w.beats}</div>}
        {w && <div class="uline"><b>Beaten by</b> {w.beatenBy}</div>}
        {abilities.map((a) => <div key={a.name} class="uline"><b>{a.name}</b> (level {a.level}) {a.blurb}.</div>)}
        <div class="ustats">Health {hp} · {hit}{reach ? ` · reach ${reach}` : ''}{d.speed > 0 ? ` · speed ${one(Math.round(((d.speed * 10) / 256) * 10) / 10)} tiles a second` : ''}{from ? ` · ${from}` : ''}</div>
      </div>
    </div>
  );
}

/** The guide itself. It opens on your own faction; the other is a tap away. */
export function UnitGuide({ frenzy, me, onBack }: { frenzy: boolean; me: Faction; onBack: () => void }) {
  const [side, setSide] = useState<Faction>(me);
  const roster = FACTIONS[side];
  const kinds: Kind[] = frenzy ? [...roster.frenzy, roster.hero] : roster.units;
  return (
    <div class="sheet guide" role="dialog" aria-label="Units">
      <div class="uhead">
        <h2>Units</h2>
        <div class="utabs" role="group" aria-label="Faction">
          {(['green', 'dino'] as const).map((f) => (
            <button key={f} class={`chip ${side === f ? 'on' : ''}`} aria-pressed={side === f} onClick={() => setSide(f)}>{FACTIONS[f].name}</button>
          ))}
        </div>
        <button class="chip" onClick={onBack}>Back</button>
      </div>
      <p class="unote">Shown in your green and the opponent&rsquo;s tan. Counters go by class (Light, Armoured, Air), so they hold across factions.</p>
      <div class="ulist" data-side={side}>
        {kinds.map((k) => <Card key={k} kind={k} frenzy={frenzy} />)}
      </div>
    </div>
  );
}
