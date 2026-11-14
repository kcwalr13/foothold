# Foothold

A real-time strategy game for a phone held in landscape: toy soldiers on a paper map. You run an economy,
place buildings, and command armies in groups against a computer opponent that plays by the same rules.

This is milestone **M2 · Full arsenal**: one map (Twin Ridges) and the whole Green Army. Two resources
(Blocks and Batteries), eight buildings, eight fighting units from Troopers to Juggernauts, weapon and armour
research, high ground, watchtowers, free building placement, fog of war, and an opponent with three openings
and three tech paths. The design lives in the design doc linked from `CLAUDE.md`.

## Play

Open the build on your phone, turn it sideways, and add it to the home screen. After the first visit it runs
with no connection.

- **Left thumb, the base.** Train: tap a unit to queue one, press and hold to keep them coming. Build: pick a
  building, drag its outline onto the map, then Build.
- **Right thumb, the armies.** Tap a group, then tap the map or the minimap to send it. Move goes without
  fighting; Hold digs in. Press and hold a group to split it or to send new units to it. Double-tap a group to
  jump to it.
- **Map.** Drag to pan, pinch to zoom out to the whole map. High ground sees down, shoots further and can't be
  seen from below; a unit standing by a watchtower shows you the road.
- **Batteries.** Build a Refinery on a battery pack beside a Headquarters and three Workers staff it.
  Batteries buy vehicles, Gunships and research.

## Develop

```
npm install
npm run dev          # local server
npm test             # rules-engine tests (Vitest)
npm run build        # type-check and build to dist/
npm run e2e          # phone-sized touch tests (Playwright) against the build
npx tsx lab/league.ts 12     # every opening and tech path against every other, plus one-trick bots
npx tsx lab/levels.ts 8      # the difficulty levels against each other and against simple play
npx tsx lab/matrix.ts        # every unit against every other at equal cost
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
- `lab` plays whole matches with no screen attached, for balance and for the report in `docs/BALANCE.md`.
- `e2e` drives the built app at phone sizes with touch.
