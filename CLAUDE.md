# Foothold: notes for Claude

Foothold is Kyle's phone real-time strategy game: toy soldiers on a paper map, landscape, two thumbs,
15 to 20 minute matches against a computer opponent, with player versus player left open for later.
It has two modes. Classic is the game the design doc was written for: one opponent, an economy, bases to
build. Frenzy (milestone MF) is a four-corner free-for-all in the spirit of Footman Frenzy: bases that make
their own armies, Collectors behind each base that bring in the Blocks and sell the upgrades, a hero a side
that you steer yourself, last base standing.

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
  runs a mirror for each of the six plans of each faction and eighteen seat swaps across all three pairings, and
  names the first tick and unit that differ). To keep it so:
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
  Classic must not change when Frenzy does: `npx tsx lab/hashes.ts` prints twelve checksums to compare before
  and after any change to `src/sim`. (They last changed on purpose with M4: the opponent's six plans and the
  bigger map.)
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
- The unit guide (`src/app/Guide.tsx`, from the pause sheet and How to play) reads every number from `def()`,
  `UNLOCK`, `WORK` and `ABILITIES`; only the words (job, beats, beaten by) are written there, and they follow
  the design doc's unit tables. A new unit needs its words in `WORDS`. In Classic it also lists the faction's
  research, every word from `techBlurb`.
- Attack or Move is one setting for the whole army, in both modes: `Match.mode` belongs to no group, stays
  as pressed until the other is pressed (whatever is selected, falls or comes back), and its two buttons are
  never disabled. Kyle asked for exactly this, twice: do not make it per group or reset it anywhere.
- Frenzy in the app: `Match.frenzy`, `Match.rivals` (the three `FrenzyBot`s), `hud.frenzy` for the panels
  (`collectors`, `income`, `upgrades`). The hero is steered like a group and goes on its own. Follow
  (`Match.follow`, remembered, off unless the player switches it on: Kyle's call) makes an order to the hero
  also an order to the group new units join, and while the hero is down that group still answers. A fallen
  hero stays selected. A tap on one of your own Collectors opens the Tech tab (`Match.techAsk`). An ability
  that needs a place is aimed: `Match.aim` holds its slot until the next tap on the map (`castAt`). A round
  is over for the player when it is won or when their own base falls (`Match.over`, `Match.outcome`).
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
  - units are drawn larger than life when zoomed out (`presence` in `toys.ts`, by the painting size, up to a
    fifth): the renderer draws them on a stage whose zoom is raised (`Renderer.larger`), and `ToyBox.get`
    paints a piece asked for at a bigger zoom that much bigger. So a sprite key belongs to units or to
    buildings, never both: one key asked for at two sizes is repainted every frame (the Nest's eggs are
    `d19n`, not the hatching egg's `d19`). Small pieces are drawn after big ones, so infantry stays on top;
  - each unit keeps a silhouette of its own at every zoom, markers included: in a crowd shape is all there
    is to go on. A new unit needs an outline, and a marker, unlike any other's;
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
- Classic's research (Kyle asked for more upgrade paths, Nov 17): `FACTIONS[f].tech` is the Tech tab, nine a
  faction (`FACTIONS[f].research` stays Weapons and Armour, all Frenzy sells). Each item is a `Def` with
  `madeAt` (where it is studied), `needs` and `levels`; Weapons and Armour (Claws and Hide) have three, the
  third waiting for `FACTIONS[f].top` (Heavy Works, a Great Cave); the other seven one, kept in `pl.tech[kind -
  100]` (`techLevel` reads either). What they do is data, `TECH` in `data.ts` (range, speed, dmg, taken, carry,
  mend, for the units named), summed per side and kind by `boost()` in `src/sim/tech.ts` and read in `reach`,
  `speedOf`, `damage`, a Worker's load and `mend()`; call `forgetBoosts(pl)` after changing `pl.tech` by hand.
  Research goes in a building's own queue (`studies`, `sprog`), beside what it trains; `researchBlock` says why
  not, for the sim, the panel and the opponent alike (`View.researchWhy`). A Frenzy round has none of it, and
  the checksum takes research in only where a side has some, so Frenzy's is unchanged.
- Supply tops out at `RULES.supplyMax`, 200: five halls at 40 (Kyle's call, Nov 17). Spare Workers are
  recycled (Kyle asked for a way, Nov 17): a `recycle` command with a count; the rules pick the ones with least
  to do (idle, then at a crowded pile, then on Blocks, then on Batteries; never a builder), set them
  `W.Recycled` (their supply is free at once), and at the nearest hall they hand in their load and give back
  `RULES.recycleRefund` percent of their price (a `recycled` event, not a death). The player recycles from the
  Workers count on the top bar (`CrewSheet` in `Hud.tsx`).
- Frenzy's rules, all in `src/sim` (`frenzy.ts`, numbers in `FRENZY`, `UNLOCK`, `WORK` and `ABILITIES` in
  `data.ts`): `createGame` with four factions makes a Frenzy round on `fourCorners()`. The ground is level
  (nothing in `map.high`, Kyle's call), but each corner is walled along its two inner sides with one gap
  toward the middle (rock, also Kyle's call); inside, each base has a Turret in line on either side of it
  and two Collectors (`K.Collector`) behind it, in the corner (`map.posts`). No Workers, no building, no Batteries:
  `build`, `train` and `cancel` are ignored. A base (the hall, `lvl = 1`) does `musterRate[muster]` work a
  tick against `WORK[kind]` (it starts slowly, Kyle's call, and Muster speeds it up to three times that) and turns out the mix (`pl.repeat`) in turn, waiting when supply
  (`FRENZY.supply`) is full. `FACTIONS[f].frenzy` lists what a base can make: the first is free and fights
  hand to hand (Kyle's call: Bayonets, `K.Bayonet`, a unit only Frenzy has, and Raptors), `unlock` buys
  another for the mix (Troopers included), `repeat` takes it in or out (never the last one). Blocks come
  from the Collectors (`income(collectors, haul)`: nothing with none standing, and they are not rebuilt),
  from holding the middle Watchtower alone (`middleHolder`, `FRENZY.middle`), and as bounties. `research`
  buys an upgrade on the spot, and only while a Collector stands: `frenzyUpgrades(f)` lists them (Weapons
  and Armour or Claws and Hide, Muster, Haul for the Collectors, and Might, Grit and Tempo for the hero),
  `upgradeKey`, `upgradeCosts` and `upgradeBlurb` say where a level lives, what it costs and what it does.
  To an attacker a Collector is a building like any other: no unit prefers it, and `FrenzyBot` marches on
  the base, so in the lab no Collector is ever hit while its base stands (whether opponents should raid them
  is Kyle's to say). A base's Turrets (a Turret with `lvl > 0`) hit
  `FRENZY.turretPower` percent as hard as Classic ones. A hero has a level (`pl.heroLvl`, `e.lvl`;
  `heroHp(kind, lvl, grit)`, `heroDmg(kind, lvl, might)`, `abilityPower`, `abilityCd`, `maxHp(e)`), learns
  from enemies that fall within `xpReach`, comes back at its base after `respawnTicks`, and mends there. Called-up units have `ttl` and take no supply. A side whose
  base falls is out (`pl.out`) and its army with it; the last side in wins, and `winner` is -2 if the last
  fall together. From `FRENZY.overtime` every base loses `crumble` a second except the middle-holder's. A
  group that has been sent somewhere is still headed there when its last unit falls, so what the base
  makes next goes too. Anything with full health asks `maxHp(e)`, never `def(e.kind).hp`.
- Player-facing words follow the toy look: Blocks and Batteries (and battery packs), Workers, Headquarters,
  Refinery, Barracks, Factory, Airfield, Armory, Heavy Works, Turrets, Watchtowers; Troopers, Lancers, Runners,
  Tanks, Mortars, Flak Tracks, Gunships, Juggernauts. For the Dino Pack: Gatherers, eggs, Nest, Dig, Den,
  Wallow, Roost, Bone Pit, Great Cave, Volcano, nesting ground; Raptors, Spitters, Horns, Pteros, Brontos,
  Rexes; Claws and Hide; the tab is Hatch, not Train. Panel buttons use each `Def`'s `short` name. In Frenzy:
  Classic and Frenzy; the base, the Spawn tab, the mix; Bayonets; Collectors; Muster, Haul, Might, Grit and
  Tempo; the Captain (Grenade, Rally, Air strike) and the Alpha (Pounce, Roar, Call the Pack); Follow; the
  middle; Overtime; the sides are Green (you), Tan, Blue
  and Red.
- Classic has three maps (`CLASSIC_MAPS` in `map.ts`, picked on the menu by id: `classicMap(id)`): Twin Ridges
  (`twinRidges()`), 144 by 72 tiles since M4 (it was 96 by 48; Kyle asked for more room, and on Nov 16 said it
  is the right size), and since M5 Three Roads and Crossroads, the same size. A two-sided map is drawn with
  `halves(w, h)`, which sets every tile and its twin together, and lists only the near side's bases. Every base
  is laid out about its Headquarters the same way (six piles in a line two tiles out, a battery pack beside), so a
  load is the same walk on every map. A new map needs a row in `CLASSIC_MAPS`; the tests then check it is
  symmetric, every site sits on open ground and is walkable from both mains, and the opponent expands on it;
  `npx tsx lab/fair.ts` runs its mirrors and seat swaps, and every lab takes `--map=roads` (or `cross`). The pathfinder packs a tile index into the low 16 bits of its heap (`SLOT` in `nav.ts`), so a map may
  have up to 65536 tiles; a building's field is keyed above `w * h`, where no tile's can be.
- The opponent plays one of six plans a match (`SCHEMES`: `rush`, `expand`, `armour`, `air`, `raider`,
  `fortress`), each named per faction (`SCHEME_NAMES`: Rush, Fast expand, Armour push, Air raid, Raider,
  Fortress; Stampede, Big nest, Horn charge, Sky raid, Pack hunt, Den) and said on the result screen with
  `SCHEME_LINES`. A plan sets an opening (`rush`, `standard` or `greedy`: `SCHEME_OPENING`), a tech path
  (`infantry`, `armour`, `air`, or the Fortress's own `FORT_PATH` and `DINO_FORT_PATH`) and a few habits in
  `think` (`fortress`, `raider`, `pusher`). One `Bot` class plays both factions; it is told who is playing whom
  (`faction`, `foe`) and weights its pick by that. Levels are Easy 0, Normal 1, Hard 2 and Brutal 3; Brutal is
  Hard's opponent with `RULES.brutalBonus` percent more on every load (`Player.bonus`, set by `createGame`, the
  one rule that differs between the sides, and said on the menu). A big army that sets out opens a second front
  (`frontAt`: a detachment goes for another base), and an opponent that can't win back a match concedes it (a
  `concede` command, Classic only; two sides conceding on the same tick both lose, `winner` -2). It studies research for
  what it has most of (the `wanted` list in `think`, at a building with nothing else to study), recycles the Workers
  beyond its jobs once its supply bar is full, and puts a fifth hall down near home for the room.
- Frenzy's opponent is `FrenzyBot` (`src/ai/frenzy.ts`), under the same rule: a `View` in, commands out. Its
  bents are `swarm`, `heavy` and `air`; it counter-picks its mix from what it has seen, keeps new units at
  home as a reserve while its army is out, and picks whom to go for by who is hurt and who is near, not by
  who looks weakest, so three sides do not pile on one. It buys Haul early and the hero's upgrades
  late (`SHOPPING`, `AFTER`), and nothing while no Collector of its own stands. On Easy it stays home
  longer, marches with less, takes no notice of what the others make and stops its upgrades early (`EASY`,
  a cap on each): in a four-way fight hanging back pays, so it is the missing upgrades that make Easy easy.

- A match in progress is kept on the phone (`src/app/save.ts`): the seed, level, sides, map, your own orders
  (from `g.log` and `g.pending`) and the checksum, when it is paused, when the app is hidden or left, and every
  half minute; a finished or quit match is forgotten. Resuming plays it through again (`Match.replay`, a slice a
  frame, the opponents thinking as they did) and must arrive at the same checksum, or the save is let go with a
  word. So nothing may change a match except a `Command`: `debugSpawn` is for tests alone.
- Sound is made in code (`src/app/sound.ts`, Web Audio: noise through a filter, tones that slide; no sound files)
  and started by the first tap. `Match.hear` plays a sound only when it happens on screen, louder zoomed in and
  panned to its side; each voice has a shortest gap (`GAP`) and no more than a dozen ring at once. A new unit
  needs its sound in `SHOT_SOUND` (`match.ts`). The Sound switch is in the pause sheet and How to play.
- The after-match report (`Report.tsx`) reads `Match.chronicle` (`report.ts`), which `note(g)` fills after every
  tick, played or replayed: buildings placed, the first of each unit, research, Frenzy unlocks and upgrades, and
  every 15 seconds each side's army (in what it cost) and Workers.
- First-match hints (`hints.ts`, Classic's include spare Workers and the Tech tab): one at a time, low between the panels (`.tip`), each once (`foothold.hints`),
  and only in matches started from the menu (`Match.hints`), never from a `?play=` link, which is how the tests
  and the lab start. How to play turns them back on. The menu offers Chrome's install (`installOffer`) and on an
  iPhone says how to add the game to the home screen.

## Checks before a build goes to Kyle

`npm run typecheck && npm test && npm run build && CHROME=... npm run e2e`, then `npx tsx lab/fair.ts`,
`npx tsx lab/factions.ts 12` (and `npx tsx lab/factions.ts 6 --map=roads` and `--map=cross`), `npx tsx lab/league.ts 12`, `npx tsx lab/league.ts 12 1 dino`,
`npx tsx lab/levels.ts 8`, `npx tsx lab/matrix.ts` and `npx tsx lab/speed.ts`, and for Frenzy
`npx tsx lab/fairfrenzy.ts` and `npx tsx lab/frenzy.ts 12`, with the results written into
`docs/BALANCE.md` and the doc's Verification section. Match outcomes swing on small things: a hundred matches
can sit eight points from the truth, so judge a change by a league run on the same seeds before and after,
never by a handful of matches. Neither faction may win more than 55% of `lab/factions.ts`'s headline. On GitHub the same-match check also
runs in WebKit. Then confirm the deploy landed (the built bundle carries the commit in the menu's build line).
