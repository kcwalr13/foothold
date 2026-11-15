# Balance report: M3 · The second faction

Measured on Nov 14, 2026 with the bot lab: the computer opponent on both sides, no screen attached.

```
npx tsx lab/fair.ts            # 18 mirror matches and 18 seat-swapped matches
npx tsx lab/factions.ts 12     # Green Army against Dino Pack: 432 matches, then 240 one-trick matches
npx tsx lab/league.ts 12       # Green mirror: 216 matches, then 216 one-trick matches
npx tsx lab/league.ts 12 1 dino   # Dino mirror: 216 matches, then 144 one-trick matches
npx tsx lab/levels.ts 8
npx tsx lab/matrix.ts
npx tsx lab/speed.ts
```

Targets are the ones in the design doc's Verification section. Several are version 1 targets that M3 is not
expected to meet; where M3 misses, this report says by how much and why.

## The headline: neither faction is the weaker pick

**With the opponent playing both sides as it plays against you, the Dino Pack wins 106 of 216 matches against
the Green Army: 49%.** The target is that neither wins more than 55%.

Each side picks its own opening and tech path with its own dice, knowing only which faction it faces. A
second measure, which forces every opening against every other and every tech path against every other
(216 more matches), gives the Dino Pack 48%.

How sure is that? Two hundred matches pin a win rate to about three and a half points either way, so "49%"
means "between 45 and 53". During tuning, runs of a hundred matches on different dice landed as far apart as
44% and 67% for the same rules, which is why every change below was judged on the same seeds before and
after and never on a handful of matches.

## What was checked, and where it stands

| Check | Target | M3 result | Status |
| --- | --- | --- | --- |
| Faction balance | Green Army against Dino Pack, computer on both sides: neither wins more than 55% | Dino Pack 49% of 216 as the opponent plays it; 48% of 216 across the forced grids | Met |
| Same match twice | Same seed and orders give the identical result in Node, Chromium and WebKit | Two matches now: a Green mirror and the Dino Pack against the Green Army. Chromium, at three phone sizes, replays each Node match (nine minutes or more, several hundred orders) from its seed and orders to the same checksum, and plays its own from scratch to the same checksum. WebKit runs the same two on GitHub before each deploy | Met |
| Fair to both sides | Neither end of the map is favoured | Exactly so, for both factions. Nine mirror matches for each faction stay a mirror image on every tick for 15 minutes; eighteen matches across all three pairings, replayed with the seats swapped, are the same match unit for unit | Met. The Dino Pack found one more cause (below) |
| Counter table holds | Equal-cost fights come out as the unit table says | All 21 Green pairings as at M2, and 40 fights for the Dino Pack's table, are pinned by tests | Met |
| Fair fog | The opponent can't read what its units don't see | Unchanged: a test checks every enemy in the opponent's view is one it can see | Met |
| It pushes back | Normal: a hit before minute 6 in 8 of 10 matches, before minute 10 in all | An idle player is hit at 2:49 by a Normal Dino Pack and 3:28 by a Normal Green Army (medians). Between two opponents, the Green side is hit before 6:00 in 63% of matches and the Dino side in 34%; before 10:00 in 84% and 59% | Met against an idle player; short against a defended one, and shorter against the Dino Pack |
| Match length | Computer against computer on Normal: median 15 to 18 minutes, 9 in 10 over by minute 22 | Median 8:29 across factions, 9:04 to 10:03 in a Green mirror, 8:15 to 8:57 in a Dino mirror; 9 in 10 over by 10:15 to 11:55 | Not met, and no closer than M2 |
| No best plan | No plan wins over 60%, each loses to at least one | Openings hold in both mirrors (Green 52/50/48, Dino 58/48/44). Tech paths: Green 60/50/40 as at M2; in a Dino mirror Horns first wins 67% and the flying path 33% | Met for openings; not for the Dino mirror's tech paths |
| No one-trick wins | A one-unit or fixed build wins under 35% against Normal | Against their own faction: Troopers 61% and Lancers 42% as at M2; every Dino trick 0%. Across factions: all-Raptors 47% and all-Spitters 50% against a Green opponent; nothing Green wins more than 14% against a Dino opponent | Not met for four builds |
| Phone speed | 60 frames a second with 200 units on a throttled phone profile | With the processor slowed fourfold, a battle of 174 to 194 units takes about 2 ms a tick and 6 ms a frame of game code (worst one in twenty: 11 ms and 12 ms), in all three pairings; a pinch through every zoom never holds a frame longer than 18 ms. Measured again after the cosmetic pass of Nov 14, which took a frame from 2 to 5 ms up to 6 | Game code is inside budget; true frame rate needs a real phone |
| Thumb-sized | Every control at least 44 px at 844 × 390 and 740 × 360 | Checked by 66 touch tests on three screen sizes, the shortest 340 px tall, in every panel, tab and sheet of both factions and on the menu | Met |

## Green Army against Dino Pack

### As the opponent plays it (216 matches)

Each side's win rate by what it chose. The numbers in brackets are how many matches that choice was made in.

| | Rush | Safe expansion | Fast expansion | Infantry | Armour | Air |
| --- | --- | --- | --- | --- | --- | --- |
| Dino Pack | 43% (60) | 63% (93) | 33% (63) | 46% (39) | 49% (92) | 51% (85) |
| Green Army | 8% (26) | 72% (112) | 35% (78) | 42% (36) | 61% (87) | 45% (93) |

The Dino Pack's three tech paths finish within five points of each other. The opening matters more than the
faction: for both sides the safe expansion is the strong one in this pairing and the rush the weak one.

### Every opening against every other (108 matches, tech paths at random)

Win rate of the Dino Pack, by its opening (rows) and the Green Army's (columns). Twelve matches a cell, so a
single cell can be 15 points from the truth.

| Dino \ Green | Rush | Safe expansion | Fast expansion | Overall |
| --- | --- | --- | --- | --- |
| Rush | 17% | 0% | 100% | 39% |
| Safe expansion | 83% | 17% | 67% | 56% |
| Fast expansion | 100% | 25% | 33% | 53% |
| Overall | 67% | 14% | 67% | 49% |

The shape is real even where the cells are noisy:

- **A Dino rush kills a Green fast expansion every time**, in about three minutes. By 2:00 it has sixteen
  Raptors and five Spitters, the Green side has no army, and the Raptors go for the Workers.
- **A Green safe expansion holds everything.** Three Barracks and Turrets stop the Raptors, and its first
  push at three to four minutes, sent when it has seen no army to speak of, can break a Dino second Nest.
- **A Green rush is a poor idea.** A Dino Pack answers eight Troopers with the eggs it has banked: a dozen
  Raptors hatch in eleven seconds, beside Volcanoes that cost it 50 Blocks and a Gatherer each. The opponent
  now knows this and rushes a Dino Pack in one match of seven, not two.

The safe-against-safe cell says 17%, but the next table plays that pairing 108 times and gets 46%.

### Every tech path against every other (108 matches, both sides open with the safe expansion)

| Dino \ Green | Infantry | Armour | Air | Overall |
| --- | --- | --- | --- | --- |
| Infantry (Raptors, Spitters, Claws and Hide) | 25% | 33% | 50% | 36% |
| Armour (Horns, Brontos, then the Rex) | 42% | 25% | 58% | 42% |
| Air (Pteros over Horns) | 42% | 67% | 75% | 61% |
| Overall | 36% | 42% | 61% | 46% |

Read down the columns for what the Green Army should build: armour and infantry both beat the Dino Pack more
often than not, and Gunships are the wrong answer, because Spitters come from the first Den and Pteros hunt
Gunships. Read across for the Dino Pack: Pteros are its best answer to Tanks and Gunships, and a swarm alone
is its worst plan against an army that has Tanks or Turrets to stand behind.

## The counter table

Every unit against every other at equal cost (1,800 Blocks plus Batteries a side; a Raptor is priced at half
its egg), both sides attack-moving across open ground. A cell is the share of its army the row keeps when it
wins, or (negative) the share the column keeps.

| | Trooper | Lancer | Runner | Tank | Mortar | Flak | Gunship | Jugger | Raptor | Spitter | Horn | Ptero | Bronto | Rex |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trooper | | 68 | 60 | -87 | -59 | 100 | 78 | -76 | -7 | -22 | -66 | 59 | -75 | -41 |
| Lancer | -68 | | -59 | 30 | -71 | 100 | -100 | 61 | -69 | -66 | 74 | -100 | 53 | 84 |
| Runner | -60 | 59 | | -97 | 36 | 100 | -100 | -91 | -41 | -63 | -89 | -100 | -93 | -79 |
| Tank | 87 | -30 | 97 | | 78 | 100 | -100 | -48 | 94 | 90 | 29 | -100 | -28 | -71 |
| Mortar | 59 | 71 | -36 | -78 | | 0 | -100 | -81 | -66 | 59 | -89 | -100 | -83 | -94 |
| Flak Track | -100 | -100 | -100 | -100 | 0 | | 90 | -100 | -100 | -100 | -100 | 96 | -100 | -100 |
| Gunship | -78 | 100 | 100 | 100 | 100 | -90 | | 100 | 100 | -75 | 100 | -100 | 100 | 100 |
| Juggernaut | 76 | -61 | 91 | 48 | 81 | 100 | -100 | | 86 | 79 | 55 | -100 | 60 | -64 |
| Raptor | 7 | 69 | 41 | -94 | 66 | 100 | -100 | -86 | | 17 | -55 | -100 | -93 | -39 |
| Spitter | 22 | 66 | 63 | -90 | -59 | 100 | 75 | -79 | -17 | | -71 | 58 | -77 | -53 |
| Horn | 66 | -74 | 89 | -29 | 89 | 100 | -100 | -55 | 55 | 71 | | -100 | -39 | -67 |
| Ptero | -59 | 100 | 100 | 100 | 100 | -96 | 100 | 100 | 100 | -58 | 100 | | 100 | 100 |
| Bronto | 75 | -53 | 93 | 28 | 83 | 100 | -100 | -60 | 93 | 77 | 39 | -100 | | -74 |
| Rex | 41 | -84 | 79 | 71 | 94 | 100 | -100 | 64 | 39 | 53 | 67 | -100 | 74 | |

The table counts 1,800 a side in whole units, which flatters the Rex against the Juggernaut (four against
three). At four apiece the Rex still wins and keeps 45%.

**What the Dino Pack does to the Green Army.** Raptors and Spitters each beat Lancers, Runners and (Spitters
narrowly, Raptors barely) Troopers, so Green infantry alone does not hold open ground. Raptors are far
better in a small fight than a large one, because only so many can reach: twelve Raptors beat six Troopers
and keep half, seventy-two beat thirty-six and keep 7%. Tanks, Mortars and Juggernauts flatten both small
dinosaurs. One Turret beats eight Raptors, which cost twice what it does.

**What the Green Army does to the Dino Pack.** Lancers beat every big dinosaur, the Rex included. Horns and
Brontos run over Troopers. Pteros beat everything that can't shoot up, which is most of both armies, and
lose to Troopers, Spitters, Flak Tracks and Turrets. The Rex beats every vehicle.

**Inside the Dino Pack** there is a triangle: Raptors beat Spitters, Spitters beat Pteros, and Pteros beat
Raptors, Horns, Brontos and Rexes. Horns beat both small dinosaurs; the Rex beats Horns and Brontos.

Three numbers were changed to get here, all on Nov 14:

- **Spitters reach five tiles, as Troopers do** (was 4.5). At 4.5 they lost to Troopers and the Dino Pack won
  43% as played; the unit table had promised "strong against Light".
- **Spitters do half damage to flyers, as Troopers do** (was full). At full damage a Dino mirror had no use
  for Pteros at all.
- **Pteros do full damage to armour** (was 60%). They could not be hit by Horns but killed them too slowly
  to matter.

## A Dino mirror (216 matches)

| | Rush | Safe expansion | Fast expansion | Overall |
| --- | --- | --- | --- | --- |
| Rush | | 17% | 100% | 58% |
| Safe expansion | 83% | | 4% | 44% |
| Fast expansion | 0% | 96% | | 48% |

The openings are the design's triangle with the edges sharpened: a rush kills greed every time, caution
stops a rush five times in six, and greed out-grows caution almost always. Eggs make each of those more
decisive than in a Green mirror, because whoever is ahead turns the lead into dinosaurs at once.

| | Infantry | Armour | Air | Overall |
| --- | --- | --- | --- | --- |
| Infantry | | 38% | 63% | 50% |
| Armour | 63% | | 71% | 67% |
| Air | 38% | 29% | | 33% |

**Horns first is the best plan in a Dino mirror, and that is over the 60% line.** Horns beat both small
dinosaurs, and the only things that beat Horns before the Rex are Pteros, which every Dino army's Spitters
shoot down. Before the three changes above the flying path won 2% of these matches; it now wins a third.
The opponent takes to the air in one Dino mirror of five, not two of five. This is the largest balance gap in
the build, and it is a unit question as much as an opponent one: the Dino Pack has no cheap answer to armour
the way the Green Army has Lancers.

## A Green mirror (216 matches)

Unchanged in character from M2, which is the point: the Dino Pack's rules were added beside the Green
Army's, not through them.

| | Rush | Safe expansion | Fast expansion | Overall |
| --- | --- | --- | --- | --- |
| Rush | | 25% | 79% | 52% |
| Safe expansion | 75% | | 25% | 50% |
| Fast expansion | 21% | 75% | | 48% |

| | Infantry | Armour | Air | Overall |
| --- | --- | --- | --- | --- |
| Infantry | | 63% | 38% | 50% |
| Armour | 38% | | 42% | 40% |
| Air | 63% | 58% | | 60% |

## One-trick play against Normal

Win rate of a side that builds one thing, by the Normal opponent's opening.

| Trick | Against | Rush | Safe expansion | Fast expansion | Overall |
| --- | --- | --- | --- | --- | --- |
| All Troopers | Green Army | 83% | 0% | 100% | 61% |
| All Lancers | Green Army | 25% | 0% | 100% | 42% |
| All Runners | Green Army | 58% | 0% | 0% | 19% |
| Turret turtle, all Tanks, all Gunships | Green Army | 0% | 0% | 0% | 0% |
| All Troopers | Dino Pack | 0% | 42% | 0% | 14% |
| Turret turtle | Dino Pack | 17% | 0% | 0% | 6% |
| All Runners, Lancers, Tanks or Gunships | Dino Pack | 0% | 0% | 0% | 0% |
| All Raptors | Green Army | 92% | 0% | 50% | 47% |
| All Spitters | Green Army | 67% | 8% | 75% | 50% |
| All Horns | Green Army | 0% | 17% | 0% | 6% |
| All Pteros | Green Army | 0% | 0% | 0% | 0% |
| All Raptors, Spitters, Horns or Pteros | Dino Pack | 0% | 0% | 0% | 0% |

The pattern from M1 and M2 holds and now has a Dino version: a one-base flood of the cheapest unit beats an
opponent that rushed or expanded first, and loses to one that opened safely. Nothing one-note beats a Dino
opponent more than one match in seven, because eggs let it answer whatever arrives. Closing the flood is
still M4's job (scouting and adapting).

## What a match looks like

Averages for one side, Green Army against Dino Pack as the opponent plays it:

- **Dino Pack:** 88 Raptors, 29 Spitters, 10 Horns, 3 Pteros, 2 Brontos, and a Rex in one match of ten. Peak
  army 61 supply. A little under one research level.
- **Green Army:** 38 Troopers, 20 Lancers, 8 Runners, 2 Tanks, 1 each of Flak Tracks, Mortars and Gunships,
  almost no Juggernauts. Peak army 37 supply.

So the two sides look different on the field: about 130 dinosaurs against about 70 soldiers and vehicles.
Neither reaches its heaviest unit often, because matches between two opponents end at eight or nine minutes.

One thing the lab cannot show, since its matches end early: at full supply a Raptor-heavy army is worth much
less than a Green one. A Raptor takes a whole supply for 25 Blocks; a Trooper takes one for 50. A Dino Pack
that reaches the late game has to be Horns, Brontos, Pteros and Rexes by then. If long matches against the
Green Army feel uphill as the Dino Pack, this is the first place to look.

## Why matches are still short

Nothing here changed at M3. A match between two copies of the opponent is decided by its first decisive
battle, and the loser is finished off or contained. With the Dino Pack in the match it is decided a little
sooner still, because eggs turn a won fight into a bigger army within seconds. An opponent that recovers,
opens a second front and concedes is M4.

## Fair to both sides

Both checks from M2 now cover both factions (`npx tsx lab/fair.ts`): nine mirror matches each, and eighteen
seat-swapped matches across Green against Green, Dino against Green and Dino against Dino. All 36 hold.

The Dino Pack exposed one more cause, the fourteenth:

14. A new unit walks out to join its group. If the group was empty and had never been given an order, the
    first unit out walked to a sensible gathering spot, but the second, hatched while the first was still
    walking, headed for the corner of the map. The Green Army almost never produced two units that close
    together; a Nest does it with every pair of Raptors. The first unit out now leaves the gathering spot
    for the rest. This changed the course of a few Green mirror matches and none of their results.

## Easy and Normal

| | Result |
| --- | --- |
| Normal against Easy, same faction | Green 15 of 16, Dino 16 of 16 |
| Normal Green Army against Easy Dino Pack | 16 of 16 |
| Normal Dino Pack against Easy Green Army | 14 of 16 |
| An idle player on Easy | First hit at 4:56 from a Green Army, 6:35 from a Dino Pack; match over at about 5:30 and 7:00 |
| An idle player on Normal | First hit at 3:28 from a Green Army (median), 2:49 from a Dino Pack; match over at about 4:00 either way |
| One-trick play against Easy Green Army | Runners 100%, Turret turtle 75%, Troopers, Lancers and Tanks 69%, Gunships 0% |
| One-trick play against Easy Dino Pack | Horns 100%, Spitters 81%, Raptors and Pteros 50% |

An Easy Dino Pack never rushes, keeps a small army, hatches no Brontos and stops at its first Wallow. It
attacks later than an Easy Green Army does. Hard and Brutal are M4.

## The numbers behind the Dino Pack

Blocks / Batteries, supply, hit points, reach in tiles, and what each bite does. All of it lives in
`src/sim/data.ts`.

| Unit | Cost | Supply | Hit points | Reach | Notes |
| --- | --- | --- | --- | --- | --- |
| Gatherer | 50 | 1 | 40 | | Hatches in 8 seconds; becomes any building |
| Raptor | 50 a pair | 1 each | 24 | bite | Needs a Den. Nearly as fast as a Runner; half damage to Armoured and Structures; goes for Workers first |
| Spitter | 60 | 1 | 50 | 5 | Needs a Den. Half damage to Armoured, flyers and Structures |
| Horn | 100 / 50 | 2 | 230 | bite | Needs a Wallow. Charges the last few steps; 110% to Light, 150% to Structures, 70% to Armoured |
| Ptero | 100 / 75 | 2 | 110 | 1.4 | Needs a Roost. Flies, and hits flyers; half damage to Structures; goes for Workers first |
| Bronto | 200 / 150 | 4 | 650 | bite | Needs a Wallow. Stomp hits everything within 1.3 tiles; 220% to Structures |
| Rex | 275 / 225 | 6 | 850 | bite | Needs a Great Cave. 180% to Armoured, 80% to Light |

| Building | Cost (plus its Gatherer) | Needs | Notes |
| --- | --- | --- | --- |
| Nest | 300 | | 1,100 hit points; 40 supply; an egg every 5 seconds, holds 3; nesting ground for 10 tiles around |
| Dig | 50 | A battery pack | The Dino Pack's Refinery |
| Den | 100 | Nesting ground | Raptors and Spitters |
| Wallow | 150 / 100 | Den | Horns and Brontos |
| Roost | 100 / 100 | Den | Pteros |
| Bone Pit | 100 / 75 | Den | Claws and Hide, two levels each, at the Armory's prices |
| Great Cave | 150 / 200 | Wallow and Bone Pit | The Rex |
| Volcano | 50 | Den | A Turret's gun and reach |

**Eggs set the Dino Pack's early strength, and were the main dial.** With an egg every four seconds it won
about 56% against the Green Army; every six seconds, about 44%; every five, about 52%. The later changes (the
opponent's choice of opening, the Spitter's reach) moved that to the 49% reported above.

## What changed in the lab

- `lab/factions.ts` is new: the headline, the two grids and the cross-faction one-trick matches.
- `lab/league.ts` takes a faction for a mirror league; `lab/levels.ts` covers both factions.
- Four Dino one-trick builds joined the six Green ones.
- Every league now plays on all processor cores (`lab/pool.ts`). Results are the same as on one core.
- The opponent is told which faction it faces, as the player is on the menu, and weights its opening and
  tech path by it: a Green opponent rushes a Dino Pack one match in seven, and a Dino opponent flies against
  another one match in five.

## Open items

- In a Dino mirror, Horns first wins two matches in three and Pteros have little to do. The Dino Pack may
  want a cheaper answer to armour than the Rex.
- A one-base flood of Raptors or Spitters beats a Green opponent that rushed or expanded first, as a Trooper
  flood beats a Green one. M4's scouting is the fix.
- At full supply a swarm is worth far less than a Green army. Untested by the lab, whose matches end early.
- Match length, unchanged from M2 and the largest gap against the design.
- The Green opponent's fast expansion loses to a Dino rush every time and it still chooses it two matches in
  seven.
- True frame rate, which needs a real phone.
