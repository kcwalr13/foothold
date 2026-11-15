# Foothold: notes for Claude

Foothold is Kyle's phone real-time strategy game: toy soldiers on a paper map, landscape, two thumbs,
15 to 20 minute matches against a computer opponent, with player versus player left open for later.
It has two modes. Classic is the game the design doc was written for: one opponent, an economy, bases to
build. Frenzy (milestone MF) is a four-corner free-for-all in the spirit of Footman Frenzy: bases that make
their own armies, a hero a side that you steer yourself, last base standing.

Kyle is the visionary; Claude builds. The design doc is the source of truth:
https://claude.ai/artifact/MSPJQ9Ur2J2PK3sCuKWHcF. Read it (docs tools) before changing gameplay, keep it true
to the build in the same step, and log calls Claude makes on its own in its Decision log.

Stop and ask Kyle only when a pillar conflicts with what can be built, a change would alter the core loop or
anything Kyle owns (vision, pillars, theme and look, name, scope), or a taste call has no defensible default.
Each milestone ends at a gate only Kyle can pass: a build on his phone, a short note, a balance report, and at
most three taste questions.

## Rules of the codebase

- `src/sim` is pure and deterministic: no DOM, no `Date`, no `Math.random`, no floating-point results kept in
  state. Positions are whole sub-units (`TILE` = 256 per tile); distances use `isqrt`. Nothing in the sim may
  call `Math.sin`, `cos`, `atan2` or anything else that can differ between devices. The same seed and commands
  must give the same `hash` everywhere; `src/sim/sim.test.ts` checks it, and a replay from `Game.log`.
- The sim and the opponent are fair to both sides, exactly: a match in which both sides run the same opponent
  with the same dice is a mirror image of itself on every tick, and any match replayed with the two opponents'
  seats swapped is the same match turned half a circle (`fair to both sides` in the tests; `npx tsx lab/fair.ts`
  runs nine mirrors for each faction and eighteen seat swaps across all three pairings, and names the first tick
  and unit that differ). To keep it so:
  - while units are being moved, a unit reads another entity's `px`/`py` (where it stood when the tick's moves
    began), never its `x`/`y`; pushes are summed into `qx`/`qy` and applied afterwards;
  - anything laid out by offsets (formation slots, the way stacked units part) is turned half a circle for player 1;
  - a point exactly on the line between tiles belongs to no fixed side: `blockedAt` and `onLayer` ask every tile
    it touches, `tileToward` picks by where the walker is heading; never `Math.floor(x / TILE)` for a decision;
  - averages and scaled points are rounded away from the middle of the map (`centroid`, `rx`/`ry` in the bot),
    never with `Math.round`;
  - ties are settled by position (nearer the walker, then nearer the middle of the map), never by the order a
    loop happens to scan in, and never by comparing the ids of units on different sides (the one id tie-break,
    between two equally good targets in `acquire`, compares two units of the same side);
  - within a tick, commands run by kind (`PHASE` in `step.ts`), not by who sent first, and two sides claiming
    the same ground on the same tick are both refused.
- Frenzy is fair to every corner in the same exact way, with four seats and quarter turns: four copies of one
  opponent with the same dice stay the same match seen from every corner on every tick, and any round
  replayed with the seats moved round is the same round turned (`fair to every corner` in
  `src/sim/frenzy.test.ts`; `npx tsx lab/fairfrenzy.ts` runs every faction and bent, and eight seat turns,
  and names the first tick and unit that differ). On top of the rules above:
  - `g.turns` is each seat's turn (`[0, 2]` in Classic, `[0, 1, 2, 3]` in Frenzy) and `turned(g, owner, x, y)`
    turns an offset for a side; use it wherever Classic negates for player 1;
  - the pathfinder's last ties are settled in a seat-turned order (`TURNED` in `nav.ts`, the `turn` argument
    of `next` and `nearestOpenTo`), and only when a turn is passed, so Classic paths are what they were;
  - when several sides hurt one thing on the same tick, the kill goes to the side that did the most harm
    (`land()` in `step.ts`), never to whoever was looked at first; ties between sides go by seat offset
    from the victim, never by id;
  - abilities ordered on the same tick are all checked before any takes effect (`castOk`), and those that
    land later wait in `g.casts` and are resolved together: leaps, then packs, then blasts;
  - everything that falls on a tick is paid for and learnt from before any side is put out (`frenzyDeaths`).
  Classic must not change when Frenzy does: its matches are the same, hash for hash, as before Frenzy
  existed: `npx tsx lab/hashes.ts` prints twelve checksums to compare before and after any change to `src/sim`.
- Every change to a match is a `Command` (`src/sim/types.ts`), scheduled for the next tick. The player and the
  opponent use the same commands; the sim validates every field, because a command may one day come from
  another phone.
- The opponent (`src/ai/bot.ts`) never touches `Game`. It gets a `View` from `makeView` and returns commands.
  The fog-of-war test proves a View holds only what that side can see.
- Balance numbers live in `src/sim/data.ts`, not in code paths or the design doc. The doc sets targets.
  `npx tsx lab/matrix.ts` prints every unit against every other at equal cost; the tests pin the pairings
  the design doc's unit table promises.
- Batteries are `gas` in code. A Refinery stands on a battery pack (`K.Cell`) and nowhere else; the pack
  outlives it. High ground is `map.high`: it sees down, outranges low ground and is not seen from below;
  flyers see and are seen regardless (`vis` and `visAir`).
- The app never decides a rule; it asks `src/sim` (`canPlace`, `hasBuilt`, ...).
- Frenzy in the app: `Match.frenzy` (not `Match.mode`, which is the selected group's Attack or Move),
  `Match.rivals` (the three `FrenzyBot`s), `hud.frenzy` for the panels. The hero is steered like a group;
  with Follow on (`Match.follow`, remembered) an order to the hero is also an order to the group new units
  join, and while the hero is down that group still answers. An ability that needs a place is aimed:
  `Match.aim` holds its slot until the next tap on the map (`castAt`). A round is over for the player when
  it is won or when their own base falls (`Match.over`, `Match.outcome`).
- Match speed is the app's alone: `Match.speed` (one of `SPEEDS`, set from the pause sheet and remembered)
  scales how long a tick waits in `frame()`. The sim never sees it, so it cannot change a match; like pausing,
  it exists only against the computer.
- Nothing is fetched at runtime and there are no art files: everything is drawn in code. The toys are
  sprites the game paints for itself (`src/app/toys.ts`): a piece is painted once in flat colours, in tiles
  about its own middle, by a `paint...` function in `army.ts` or `dinos.ts`, and `ToyBox` finishes every one
  the same way (light from the top left, an ink outline, a shadow shape), crops it and keeps it. A frame
  stamps sprites and draws only what moves by hand (tails, feet, flags, smoke, flashes). To keep it so:
  - a piece's colours come from its side's `Team` (`TEAM` in `toys.ts`: you green, the opponent tan, and in
    Frenzy the third and fourth sides blue and red) plus the few fixed ones (`PENCIL`, `STEEL`, `IVORY`, and
    `GOLD` for whatever marks a hero); never a colour chosen by faction;
  - a part that turns or moves on its own (turret, head, the figure on its base) is its own sprite; a new
    look for a state is a new key, not a repaint of an old one;
  - animation is the renderer's alone: `Anim` per entity (walk, heading, aim, pop-in, hit flash) and
    `Match.fired` (who shot, from the sim's `shot` events). The sim never knows a frame was drawn;
  - `ToyBox.begin(z)` opens each frame. Pieces are repainted for a new zoom a few a frame (`REPAINT_MS`),
    never all at once: a pinch must not stutter;
  - the panel buttons show the same toys (`icons.ts`, `paintArmyPiece` and `paintDinoPiece`); only research
    has drawings of its own in `Hud.tsx`. A new unit or building needs its `reach` and its piece there too;
  - the minimap keeps enemies red, not tan: tan there is a battery pack. In Frenzy, where there are no
    battery packs, each opponent is its own colour, and the square map sits in the middle of the minimap's
    box (`Match.miniRect()` says where; taps are mapped through it).
- Every control is at least 44 px; the e2e suite checks it on three screen sizes (the shortest is 340 px
  tall, where the three-by-three panel grids have 47 px a row, and Frenzy's right panel has six rows of 44). Panels are sized by `INSET` in
  `src/app/match.ts` and the matching CSS variables in `style.css`: change them together.
- Units are commanded as groups (0 to 3). Classic has no single-unit selection and no activated abilities;
  do not add them without Kyle. Frenzy's hero is the one exception, and Kyle's call: it is the only member
  of group `FRENZY.heroGroup` (nothing can join it), and its abilities are `cast` commands.
- Version 1 has two factions, both in the build: the Green Army and the Dino Pack. `FACTIONS` in `data.ts`
  names each one's hall, worker, refinery, turret, research building and lists; code asks `isHall`, `isWorker`,
  `isRefinery` and `FACTIONS[f]`, never a faction's own kinds, so a third faction is data. Team colour is the
  side (you green, the opponent tan), not the faction.
- The Dino Pack's rules, all in `src/sim`: a Nest lays an egg every `RULES.eggTicks` and holds `eggMax`;
  `train` spends an egg from the fullest Nest and lays an `Egg` entity beside it that hatches after the unit's
  `time` (Raptors two to an egg, `brood`); a building costs the Gatherer that walks over and becomes it
  (`builder = -1`, it then grows by itself, and cancelling gives the Gatherer back); every Dino building but
  the Nest and the Dig needs nesting ground (`onNestingGround`, within `nestGround` tiles of a finished Nest);
  `melee` units must touch their target and gain no range from high ground; `charge` is extra speed while
  closing; `raider` units go for Workers first. Claws and Hide are Weapons and Armour by another name
  (`researchOf`).
- Frenzy's rules, all in `src/sim` (`frenzy.ts`, numbers in `FRENZY`, `UNLOCK`, `WORK` and `ABILITIES` in
  `data.ts`): `createGame` with four factions makes a Frenzy round on `fourCorners()`. No Workers, no
  building, no Batteries: `build`, `train` and `cancel` are ignored. A base (the hall, `lvl = 1`) does
  `musterRate[muster]` work a tick against `WORK[kind]` and turns out the mix (`pl.repeat`) in turn, waiting
  when supply (`FRENZY.supply`) is full; `unlock` buys a unit for the mix, `repeat` takes it in or out (never
  the last one), `research` buys Weapons, Armour and Muster on the spot. Blocks come as a trickle, for
  holding the middle Watchtower alone (`middleHolder`), and as bounties. A hero has a level (`pl.heroLvl`,
  `e.lvl`; `heroHp`, `heroDmg`, `maxHp(e)`), learns from enemies that fall within `xpReach`, comes back at
  its base after `respawnTicks`, and mends there. Called-up units have `ttl` and take no supply. A side whose
  base falls is out (`pl.out`) and its army with it; the last side in wins, and `winner` is -2 if the last
  fall together. From `FRENZY.overtime` every base loses `crumble` a second except the middle-holder's. A
  group that has been sent somewhere is still headed there when its last unit falls, so what the base
  makes next goes too. Anything with full health asks `maxHp(e)`, never `def(e.kind).hp`.
- Player-facing words follow the toy look: Blocks and Batteries (and battery packs), Workers, Headquarters,
  Refinery, Barracks, Factory, Airfield, Armory, Heavy Works, Turrets, Watchtowers; Troopers, Lancers, Runners,
  Tanks, Mortars, Flak Tracks, Gunships, Juggernauts. For the Dino Pack: Gatherers, eggs, Nest, Dig, Den,
  Wallow, Roost, Bone Pit, Great Cave, Volcano, nesting ground; Raptors, Spitters, Horns, Pteros, Brontos,
  Rexes; Claws and Hide; the tab is Hatch, not Train. Panel buttons use each `Def`'s `short` name. In Frenzy:
  Classic and Frenzy; the base, the Spawn tab, the mix, Muster; the Captain (Grenade, Rally, Air strike) and
  the Alpha (Pounce, Roar, Call the Pack); Follow; the middle; Overtime; the sides are Green (you), Tan, Blue
  and Red.
- The opponent's openings are `rush`, `standard` (safe expansion) and `greedy` (fast expansion); its tech paths
  are `infantry`, `armour` and `air`, for both factions (`PATHS` and `DINO_PATHS`). One `Bot` class plays both;
  it is told who is playing whom (`faction`, `foe`) and weights its choice by that. The six named plans in the
  design doc are M4.
- Frenzy's opponent is `FrenzyBot` (`src/ai/frenzy.ts`), under the same rule: a `View` in, commands out. Its
  bents are `swarm`, `heavy` and `air`; it counter-picks its mix from what it has seen, keeps new units at
  home as a reserve while its army is out, and picks whom to go for by who is hurt and who is near, not by
  who looks weakest, so three sides do not pile on one. On Easy it stays home longer, marches with less,
  takes no notice of what the others make and stops its upgrades early (`EASY_MUSTER`, `EASY_RESEARCH`): in
  a four-way fight hanging back pays, so it is the missing upgrades that make Easy easy.

## Checks before a build goes to Kyle

`npm run typecheck && npm test && npm run build && CHROME=... npm run e2e`, then `npx tsx lab/fair.ts`,
`npx tsx lab/factions.ts 12`, `npx tsx lab/league.ts 12`, `npx tsx lab/league.ts 12 1 dino`,
`npx tsx lab/levels.ts 8`, `npx tsx lab/matrix.ts` and `npx tsx lab/speed.ts`, and for Frenzy
`npx tsx lab/fairfrenzy.ts` and `npx tsx lab/frenzy.ts 12`, with the results written into
`docs/BALANCE.md` and the doc's Verification section. Match outcomes swing on small things: a hundred matches
can sit eight points from the truth, so judge a change by a league run on the same seeds before and after,
never by a handful of matches. Neither faction may win more than 55% of `lab/factions.ts`'s headline. On GitHub the same-match check also
runs in WebKit. Then confirm the deploy landed (the built bundle carries the commit in the menu's build line).
