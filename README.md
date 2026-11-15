# Foothold

A real-time strategy game for a phone held in landscape: toy soldiers on a paper map. You run an economy,
place buildings, and command armies in groups against a computer opponent that plays by the same rules.

This is milestone **MF · Frenzy**: two factions you can play or play against in any pairing, and two ways to
play them.

- **Classic** is one opponent on Twin Ridges: gather, build, take the map, knock down every last base.
- **Frenzy** is four corners and every side for itself, after Footman Frenzy. Your base makes its army by
  itself; you choose what goes into the mix, buy upgrades at the Collectors behind it, and steer a hero with
  three abilities. Collectors pay, kills pay, the Watchtower in the middle pays, and a side whose base falls
  is out. Last base standing wins.

- **The Green Army** is the plastic army men: ranged, steady, strongest dug in. It trains in queues at its
  buildings and builds anywhere on open ground. Eight buildings, eight fighting units from Troopers to
  Juggernauts.
- **The Dino Pack** is the plastic dinosaurs: cheap, fast and many, strongest in the open. Everything hatches
  from eggs at its Nests, a building costs the Gatherer that becomes it, and it builds only on nesting ground
  near a Nest. Eight buildings, six dinosaurs from Raptors to the Rex.

Both share two resources (Blocks and Batteries), research, high ground, watchtowers, fog of war, and an
opponent with three openings and three tech paths. In Frenzy each has a hero: the Captain (Grenade, Rally,
Air strike) and the Alpha (Pounce, Roar, Call the Pack). The design lives in the design doc linked from
`CLAUDE.md`.

## Play

Open the build on your phone, turn it sideways, and add it to the home screen. After the first visit it runs
with no connection. On the menu, pick Classic or Frenzy, your side and the opponents', then Easy or Normal.

Classic:

- **Left thumb, the base.** Train (or Hatch): tap a unit to make one, press and hold to keep them coming.
  Build: pick a building, drag its outline onto the map, then Build.
- **Right thumb, the armies.** Tap a group, then tap the map or the minimap to send it. Attack fights what it
  meets, Move goes without fighting, and whichever you press stays lit for every group until you press the
  other; Hold digs in. Tap Groups, or any
  empty group, to organise the army: tap the units you want, then the group they should join. Double-tap a
  group to jump to it.
- **Speed.** Pause, top right, also sets the speed: half or three-quarter to take your time, normal, or
  double. The game remembers it and shows it beside the clock.
- **Units.** The pause sheet (and How to play) opens a guide to every unit of both factions: its toy in
  your colour and the opponent's, what it does, what it beats and what beats it, and its numbers.
- **Map.** Drag to pan, pinch to zoom out to the whole map. High ground sees down, shoots further and can't be
  seen from below; a unit standing by a watchtower shows you the road.
- **Batteries.** Build a Refinery (or a Dig) on a battery pack beside a Headquarters (or a Nest) and three
  Workers staff it. Batteries buy the bigger units and research.
- **Dino Pack.** A Nest lays an egg every five seconds and holds three; every egg is a Gatherer or a fighter.
  The Den, Wallow, Roost and Great Cave unlock dinosaurs; more Nests hatch more of them.

Frenzy:

- **Left thumb, the base.** It stands inside walls with one way out, and makes units by itself while there
  is supply: slowly at first, Bayonets or Raptors, who fight hand to hand. Spawn: unlock a unit with Blocks, then tap it into or out of the mix.
- **Collectors.** The two behind your base bring in your Blocks and sell everything on the Tech tab, on the
  spot: Weapons and Armour for the army, Muster for a faster base (up to three times as fast), Haul for more Blocks, and Might, Grit and
  Tempo for your hero. Lose one and half your Blocks stop; lose both and nothing can be bought.
- **Right thumb, the hero.** Tap your hero, then the map. It goes on its own; switch Follow on and your first
  group goes wherever it is sent. Abilities open at levels 1, 3 and 6: tap one, then the map if a ring
  appears. A fallen hero comes back at the base after a wait, and mends there.
- **Attack and Move.** One setting for the hero and every group: whichever you press stays lit until you
  press the other.
- **Groups.** New units join Group 1. Press and hold a group to split some off into Group 2.
- **Blocks.** What the Collectors bring in, a share of everything your side brings down, and more for holding
  the Watchtower in the middle alone. A hero learns from every enemy that falls near it.
- **Overtime.** From 10:00 every base crumbles except the base of the side that holds the middle.

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
npx tsx lab/fairfrenzy.ts    # the same for Frenzy's four corners: same-dice rounds and seat turns
npx tsx lab/frenzy.ts 12     # Frenzy: two of each faction in every seating, one-faction tables, one-unit armies
npx tsx lab/hashes.ts        # twelve Classic checksums, to prove a change left Classic alone
```

Set `CHROME=/path/to/chrome` to run the touch tests and `npm run icons` with a browser you already have.

## Layout

- `src/sim` is the rules engine: pure, deterministic, whole-number maths, and fair to both sides of the map
  (and, in Frenzy, to all four corners).
  A match is its seed plus its list of commands, which is what makes replays, save-and-resume and (later)
  two-player possible. The touch tests replay a Node match in the browser and check the result is identical.
- `src/ai` is the computer opponent: `bot.ts` for Classic, `frenzy.ts` for Frenzy. It sees the match only
  through `View` (its own units, what they can see, what it remembers) and acts only through commands.
- `src/app` is the phone interface: the canvas renderer, touch input and the panels. There are no art files:
  `toys.ts` paints every unit and building once as a sprite (flat colours in, moulded plastic with an ink
  outline out), `army.ts` and `dinos.ts` hold the two factions' pieces and their animation, and the panel
  buttons show the same toys.
- `lab` plays whole matches with no screen attached, on every processor core, for balance and for the report
  in `docs/BALANCE.md`.
- `e2e` drives the built app at phone sizes with touch.
