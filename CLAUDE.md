# Foothold: notes for Claude

Foothold is Kyle's phone real-time strategy game: toy soldiers on a paper map, landscape, two thumbs,
15 to 20 minute matches against a computer opponent, with player versus player left open for later.

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
- Nothing is fetched at runtime and there are no art files: `src/app/render.ts` draws everything.
- Every control is at least 44 px; the e2e suite checks it on three screen sizes (the shortest is 340 px
  tall, where the three-by-three panel grids have 47 px a row). Panels are sized by `INSET` in
  `src/app/match.ts` and the matching CSS variables in `style.css`: change them together.
- Units are commanded as groups (0 to 3). There is no single-unit selection and no activated abilities in
  version 1; do not add them without Kyle.
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
- Player-facing words follow the toy look: Blocks and Batteries (and battery packs), Workers, Headquarters,
  Refinery, Barracks, Factory, Airfield, Armory, Heavy Works, Turrets, Watchtowers; Troopers, Lancers, Runners,
  Tanks, Mortars, Flak Tracks, Gunships, Juggernauts. For the Dino Pack: Gatherers, eggs, Nest, Dig, Den,
  Wallow, Roost, Bone Pit, Great Cave, Volcano, nesting ground; Raptors, Spitters, Horns, Pteros, Brontos,
  Rexes; Claws and Hide; the tab is Hatch, not Train. Panel buttons use each `Def`'s `short` name.
- The opponent's openings are `rush`, `standard` (safe expansion) and `greedy` (fast expansion); its tech paths
  are `infantry`, `armour` and `air`, for both factions (`PATHS` and `DINO_PATHS`). One `Bot` class plays both;
  it is told who is playing whom (`faction`, `foe`) and weights its choice by that. The six named plans in the
  design doc are M4.

## Checks before a build goes to Kyle

`npm run typecheck && npm test && npm run build && CHROME=... npm run e2e`, then `npx tsx lab/fair.ts`,
`npx tsx lab/factions.ts 12`, `npx tsx lab/league.ts 12`, `npx tsx lab/league.ts 12 1 dino`,
`npx tsx lab/levels.ts 8`, `npx tsx lab/matrix.ts` and `npx tsx lab/speed.ts`, with the results written into
`docs/BALANCE.md` and the doc's Verification section. Match outcomes swing on small things: a hundred matches
can sit eight points from the truth, so judge a change by a league run on the same seeds before and after,
never by a handful of matches. Neither faction may win more than 55% of `lab/factions.ts`'s headline. On GitHub the same-match check also
runs in WebKit. Then confirm the deploy landed (the built bundle carries the commit in the menu's build line).
