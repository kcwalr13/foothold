# Foothold

A real-time strategy game for a phone held in landscape: toy soldiers on a paper map. You run an economy,
place buildings, and command armies in groups against a computer opponent that plays by the same rules.

This is milestone **M3 · The second faction**: one map (Twin Ridges) and two factions you can play or play
against, in any pairing.

- **The Green Army** is the plastic army men: ranged, steady, strongest dug in. It trains in queues at its
  buildings and builds anywhere on open ground. Eight buildings, eight fighting units from Troopers to
  Juggernauts.
- **The Dino Pack** is the plastic dinosaurs: cheap, fast and many, strongest in the open. Everything hatches
  from eggs at its Nests, a building costs the Gatherer that becomes it, and it builds only on nesting ground
  near a Nest. Eight buildings, six dinosaurs from Raptors to the Rex.

Both share two resources (Blocks and Batteries), research, high ground, watchtowers, fog of war, and an
opponent with three openings and three tech paths. The design lives in the design doc linked from `CLAUDE.md`.

## Play

Open the build on your phone, turn it sideways, and add it to the home screen. After the first visit it runs
with no connection. On the menu, pick your side and the opponent's, then Easy or Normal.

- **Left thumb, the base.** Train (or Hatch): tap a unit to make one, press and hold to keep them coming.
  Build: pick a building, drag its outline onto the map, then Build.
- **Right thumb, the armies.** Tap a group, then tap the map or the minimap to send it. Attack fights what it
  meets, Move goes without fighting, and a group keeps whichever you set; Hold digs in. Tap Groups, or any
  empty group, to organise the army: tap the units you want, then the group they should join. Double-tap a
  group to jump to it.
- **Map.** Drag to pan, pinch to zoom out to the whole map. High ground sees down, shoots further and can't be
  seen from below; a unit standing by a watchtower shows you the road.
- **Batteries.** Build a Refinery (or a Dig) on a battery pack beside a Headquarters (or a Nest) and three
  Workers staff it. Batteries buy the bigger units and research.
- **Dino Pack.** A Nest lays an egg every five seconds and holds three; every egg is a Gatherer or a fighter.
  The Den, Wallow, Roost and Great Cave unlock dinosaurs; more Nests hatch more of them.

## Develop

```
npm install
npm run dev          # local server
npm test             # rules-engine tests (Vitest)
npm run build        # type-check and build to dist/
npm run e2e          # phone-sized touch tests (Playwright) against the build
npx tsx lab/league.ts 12     # Green mirror: every opening and tech path against every other, plus one-trick bots
npx tsx lab/league.ts 12 1 dino   # the same for a Dino mirror
npx tsx lab/factions.ts 12   # Green Army against Dino Pack: the headline win rate, the grids, one-trick bots
npx tsx lab/levels.ts 8      # the difficulty levels against each other and against simple play, both factions
npx tsx lab/matrix.ts        # every unit of both factions against every other at equal cost
npx tsx lab/speed.ts         # how long a tick of the rules takes with the map full
npx tsx lab/fair.ts          # proves neither end of the map is favoured: mirror matches and seat swaps
```

Set `CHROME=/path/to/chrome` to run the touch tests and `npm run icons` with a browser you already have.

## Layout

- `src/sim` is the rules engine: pure, deterministic, whole-number maths, and fair to both sides of the map.
  A match is its seed plus its list of commands, which is what makes replays, save-and-resume and (later)
  two-player possible. The touch tests replay a Node match in the browser and check the result is identical.
- `src/ai` is the computer opponent. It sees the match only through `View` (its own units, what they can see,
  what it remembers) and acts only through commands.
- `src/app` is the phone interface: the canvas renderer, touch input and the panels.
- `lab` plays whole matches with no screen attached, on every processor core, for balance and for the report
  in `docs/BALANCE.md`.
- `e2e` drives the built app at phone sizes with touch.
