# Balance report: M2 · Full arsenal

Measured on Nov 14, 2026 with the bot lab: the computer opponent on both sides, no screen attached.

```
npx tsx lab/fair.ts          # 9 mirror matches and 18 seat-swapped matches
npx tsx lab/league.ts 12     # 216 matches, then 216 one-trick matches
npx tsx lab/levels.ts 8
npx tsx lab/matrix.ts
npx tsx lab/speed.ts
```

Targets are the ones in the design doc's Verification section. Several are version 1 targets that M2 is not
expected to meet; where M2 misses, this report says by how much and why.

## What was checked, and where it stands

| Check | Target | M2 result | Status |
| --- | --- | --- | --- |
| Same match twice | Same seed and orders give the identical result in Node, Chromium and WebKit | A re-run and a replay from the order log are identical in Node. Chromium, at three phone sizes, replays a ten-minute Node match from its seed and 586 orders to the same checksum, and plays its own from scratch to the same checksum. WebKit passes the same check on GitHub, where it runs before each deploy | Met |
| Fair to both sides | Neither end of the map is favoured | Exactly so. A match between two copies of the opponent is a mirror image of itself on every tick for 15 minutes, in all nine opening and tech pairings. Eighteen matches between different opponents, replayed with the seats swapped, are the same match unit for unit to the end | Met. M1's lean toward one side was real; thirteen causes found and fixed (below) |
| Counter table holds | Equal-cost fights come out as the unit table says | Every pairing the unit table promises, 21 in all, is pinned by a test | Met |
| Fair fog | The opponent can't read what its units don't see | A test checks every enemy in the opponent's view is one it can see, over a whole match, with high ground and flyers in play | Met |
| It pushes back | Normal: a hit before minute 6 in 8 of 10 matches, before minute 10 in all | An idle player is hit at 3:28 median, 2:27 earliest. Against an opponent that defends itself, 54% of sides are hit before 6:00 and 74% before 10:00 | Met against an idle player; short against a defended one |
| Match length | Computer against computer on Normal: median 15 to 18 minutes, 9 in 10 over by minute 22 | Median 9:04 across openings and 10:01 across tech paths; 9 in 10 over by 12:27; longest finished 27:32, and one match of 216 ran past the 30-minute limit | Not met: double M1's 4:56, still short |
| No best plan | No plan wins over 60%, each loses to at least one | Openings: safe expansion 52%, rush 50%, fast expansion 48%, and each loses to one other. Tech paths: air 58%, infantry 52%, armour 40% | Met for openings. Tech paths are inside 60%, but air loses to neither other path and armour to both |
| No one-trick wins | A one-unit or fixed build wins under 35% against Normal | Troopers 61%, Lancers 42%, Runners 17%, Tanks 0%, Gunships 0%, Turret turtle 0% | Not met for Troopers and Lancers |
| Phone speed | 60 frames a second with 200 units on a throttled phone profile | With the processor slowed fourfold, a 190-unit battle takes 1.5 ms a tick and 1.3 ms a frame of game code (worst one in twenty: 13.6 ms and 7.3 ms) | Game code is well inside budget; true frame rate needs a real phone |
| Thumb-sized | Every control at least 44 px at 844 × 390 and 740 × 360 | Checked by 39 touch tests on three screen sizes, the shortest 340 px tall, in every panel, tab and sheet | Met |

## The counter table

Every unit against every other at equal cost (1,800 Blocks plus Batteries a side), both sides attack-moving
across open ground. A cell is the share of its army the row keeps when it wins, or (negative) the share the
column keeps.

| | Trooper | Lancer | Runner | Tank | Mortar | Flak Track | Gunship | Juggernaut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trooper | | 68 | 60 | -87 | -59 | 100 | 78 | -76 |
| Lancer | -68 | | -59 | 30 | -71 | 100 | -100 | 61 |
| Runner | -60 | 59 | | -97 | 36 | 100 | -100 | -91 |
| Tank | 87 | -30 | 97 | | 78 | 100 | -100 | -48 |
| Mortar | 59 | 71 | -36 | -78 | | 0 | -100 | -81 |
| Flak Track | -100 | -100 | -100 | -100 | 0 | | 90 | -100 |
| Gunship | -78 | 100 | 100 | 100 | 100 | -90 | | 100 |
| Juggernaut | 76 | -61 | 91 | 48 | 81 | 100 | -100 | |

The two halves of the table are now exact opposites, because the test ground is a true mirror image and the
rules favour neither end of it. At M1 and in M2's first runs the same fight came out a little differently
depending on which side fought it. On fair ground, eight Tanks edged out their cost in Lancers at 160% damage
to Armoured, so Lancers now do 170%.

Read across: Tanks and Juggernauts crush infantry and fall to Lancers and Gunships. Gunships beat everything
that can't shoot up and lose to Flak Tracks and massed Troopers. Mortars beat Lancers and lose to what
reaches them: Runners, Tanks, Gunships. A Flak Track hits only flyers, so alone it beats nothing else.

Mortars against infantry depends on numbers, which is what the unit table means by "massed Light". Four
Mortars lose to their cost in Troopers, eight beat it, and sixteen beat even their cost in Runners. The tests
also pin two fights the table can't show: two Mortars break a Turret without a loss, as two Lancers do; and a
Mortar never fires before it has stood still for two seconds or at anything within 4.5 tiles.

## The three openings (Normal against Normal, 108 matches, tech paths at random)

Win rate of the row opening against the column opening:

| | Rush | Safe expansion | Fast expansion | Overall |
| --- | --- | --- | --- | --- |
| Rush | | 21% | 79% | 50% |
| Safe expansion | 79% | | 25% | 52% |
| Fast expansion | 21% | 75% | | 48% |

This is the triangle the design asks for: a rush kills greed, caution holds a rush, and greed out-grows
caution, each about three times in four, and all three finish within two points of even. At M1 the safe
expansion won 75% overall and beat both others.

## The three tech paths (both sides open with the safe expansion, 108 matches)

| | Infantry | Armour | Air | Overall |
| --- | --- | --- | --- | --- |
| Infantry | | 63% | 42% | 52% |
| Armour | 38% | | 42% | 40% |
| Air | 58% | 58% | | 58% |

Infantry is Barracks units with research first, armour is Tanks, Mortars and Juggernauts, air is Gunships.
Each path makes all the Barracks units as well.

Armour is the weak one in the opponent's hands, and the reason is how it spends, not what the units do. From
about minute five the opponent is short of Blocks and has Batteries to spare. Its infantry path puts those
spare Batteries into research; its armour path was putting scarce Blocks into a Factory and Tanks. Tanks and
Flak Tracks now cost fewer Blocks and more Batteries for the same total (125 and 100, was 150 and 75; 75 and
75, was 100 and 50). In the league that took armour from 31% to 40%, and air against armour from 67% to 58%.
The rest is the opponent's build order, which is M4's work.

## One-trick play against Normal (36 matches a trick)

| Trick | Against rush | Against safe expansion | Against fast expansion | Overall |
| --- | --- | --- | --- | --- |
| All Troopers from four Barracks | 83% | 0% | 100% | 61% |
| All Lancers from four Barracks | 25% | 0% | 100% | 42% |
| All Runners from four Barracks | 50% | 0% | 0% | 17% |
| Two Barracks and six Turrets | 0% | 0% | 0% | 0% |
| All Tanks, two bases | 0% | 0% | 0% | 0% |
| All Gunships, two bases | 0% | 0% | 0% | 0% |

The safe expansion holds every one-trick build. The rush and the fast expansion still lose to a four-Barracks
Trooper push, as they did at M1: it arrives early and larger than anything an opponent has that spent on a
second Headquarters or sent its own soldiers out first. Mass Tanks and mass Gunships never win: Lancers
answer the one, and Troopers, Turrets and Flak Tracks the other. Closing the Trooper push is what M4's
scouting and adapting are for.

## What a match looks like now

Averages for one side across the 216 league matches:

- Units trained: 46 Troopers, 26 Lancers, 14 Runners, 4 Tanks, 2 Gunships, 2 Mortars, 1 Flak Track, 0.1 Juggernauts.
- Research: a little under one level finished.
- Peak army: a median of 27 to 42 supply, out of a possible 120 less Workers.

So the opponent uses the new units, and still fields mostly infantry. Against each other, a side on the armour
path makes about four Tanks and one or two Mortars in a match, and a side on the air path three or four
Gunships. It almost never reaches Juggernauts, because its matches against itself are over in nine or ten
minutes and Heavy Works comes after the seventh. A player who lasts longer will reach that part of the game;
the opponent rarely shows it yet.

## Why matches are still short

A match between two copies of the opponent is decided by its first decisive battle. Whoever loses it is
finished off within a minute or two, or contained on its main until the winner has grown enough to climb the
ramp. M2 pushed that battle later in four ways, and each moved the median by a minute or so:

- The main army stays home for the first seven minutes unless the opponent opened with a rush or has seen
  next to nothing of the enemy's army. The early game belongs to raids.
- After that it attacks with a clear lead over what it has seen, or with a full supply bar and nowhere left to
  expand.
- It pulls out of a losing attack at four tenths lost, and goes all the way home before it turns to fight.
- It no longer charges a ramp into a main on high ground without a crushing lead: it takes the bases on low
  ground and waits below, out of reach. A side that has lost its natural gathers at the top of its ramp and
  puts Turrets there.

What is missing is a side that comes back from a lost battle, and one that concedes when it can't. Both are in
M4's list (retreats, attacks on two fronts, conceding). Against a person the length depends on the person;
these numbers say only that the opponent, left to itself, ends things in about ten minutes.

## Fair to both sides

M1's league leaned toward side 1 (59%), and M2's first runs leaned further (63% over 90 mirror matches). The
map is the same turned half a circle, so the rules and the opponent should be too. They are now, exactly, and
two checks hold them there (`npx tsx lab/fair.ts`; one of each kind also runs with the tests):

- **Mirror.** Both sides run the same opponent with the same dice. Every unit of one side must stand, on
  every tick, where the other side's stands turned half a circle. All nine opening and tech pairings stay a
  mirror for 15 minutes.
- **Seat swap.** Two different opponents play a match; then they play it again from each other's end of the
  map. The second match must be the first turned half a circle, to the last unit and hit point. All eighteen
  are, including matches against one-trick and Easy opponents.

The checks name the first tick and the first unit that differ, which is how each cause was found:

1. Formation slots were laid out by the same offsets for both sides, so the far side's formation faced the
   wrong way round.
2. Units were moved one at a time, each judging the others by where they stood at that instant, so a unit
   moved later in the tick saw a little further ahead. Every unit now judges the others by where they stood
   when the tick's moves began.
3. Units pushing apart in a crowd were moved pair by pair. All pushes are now added up, then applied together.
4. Splash damage was rounded in the order the blast found its victims, and borrowed the shooter's carried
   fraction.
5. Units looked for a new target, and Workers for a new pile, on ticks staggered by their id numbers.
6. When both sides finished a Headquarters on the same tick, only one side's Workers were shared out to it.
7. Workers choosing a pile counted the Workers already there part-way through the same pass.
8. A point exactly on the line between two tiles (the middle of every even-sized building, a unit that
   stopped on a line, a flyer overhead) was given to the tile on one fixed side, for walking, for sight, for
   high ground and for where a path should end.
9. Averages (the middle of a group, a rally point) were rounded the same way at both ends of the map, and so
   landed one step off each other's mirror image. They are rounded away from the middle of the map.
10. With two equally short ways round a building, both sides took the same compass direction. The way nearer
    the walker wins, and dead level, the way nearer the middle of the map.
11. Two units on the very same spot (a new unit at a busy door) parted in a direction worked out from their
    id numbers.
12. Within a tick, side 0's commands ran first: an order sent on the tick the enemy placed a building on the
    same spot went to a different place depending on the seat. Orders now run before building, whoever sent
    them, and two sides claiming the same ground on the same tick are both turned away.
13. In the opponent: build spots, gathering points and the test for whether a Turret stands on high ground
    each leaned one way.

The test ground for the counter table was not a mirror image either; it is now. With all of that fixed, the
league's "side 0 wins" figure (53% and 47% in its two tables) is the luck of which opening and dice met which.

## Easy and Normal

| | Result |
| --- | --- |
| Normal against Easy | Normal wins 29 of 32 |
| An idle player on Easy | First hit at 4:56, match over at 5:29 |
| An idle player on Normal | First hit at 3:28 median, match over at 3:51 |
| One-trick play against Easy | Runners 100%; Troopers, Lancers, Tanks and the Turret turtle 69% each; Gunships 0% |

Easy never rushes, stays on one base for five minutes, holds its army to a small cap, takes one Refinery and
one Factory late, builds Tanks but no Mortars or Gunships, and never researches. Hard and Brutal are M4.

## The numbers behind the new units

Blocks / Batteries, supply, hit points, range in tiles, and what each hit does. All of it lives in
`src/sim/data.ts`.

| Unit | Cost | Supply | Hit points | Range | Notes |
| --- | --- | --- | --- | --- | --- |
| Tank | 125 / 100 | 3 | 280 | 5.5 | Splash 0.9 tiles; full damage to Light and Structures, 70% to Armoured |
| Mortar | 125 / 100 | 3 | 100 | 4.5 to 11 | Light class; splash 1.1 tiles; 150% to Structures; two seconds to set up |
| Flak Track | 75 / 75 | 2 | 170 | 7 | Hits flyers only, with splash |
| Gunship | 150 / 150 | 3 | 170 | 4.5 | Flies; 160% to Armoured, 75% to Light; can't hit other flyers |
| Juggernaut | 300 / 225 | 6 | 800 | 6 | Needs Heavy Works; splash 0.9 tiles; 110% to Armoured and Structures |

Research costs 150 / 150 for the first level and 250 / 250 for the second: 15% more damage a Weapons level, 10%
less damage taken an Armour level, for units and not buildings. A Refinery brings in about 180 Batteries a
minute, three a trip. A unit on high ground shooting down reaches 1.5 tiles further. A watchtower shows 11
tiles of low ground around it to a side that stands by it alone. Changed from M1: Troopers do 55% to flyers,
Lancers 170% to Armoured (and still 200% to Structures), and Turrets 60% to Armoured.

## Open items

- Match length is the largest gap. The next steps are M4's: an opponent that recovers, opens a second front
  and concedes.
- The opponent runs short of Blocks with Batteries to spare, and its armour path suffers most for it.
- A four-Barracks Trooper push still beats the opponent's rush and its fast expansion.
- True frame rate, which needs a real phone.
