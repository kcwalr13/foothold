# Balance report: MF · Frenzy, second build

Measured on Nov 15, 2026 with the bot lab: the computer opponent in every seat, no screen attached.

```
npx tsx lab/fairfrenzy.ts          # 6 same-dice rounds and 8 seat-turned rounds
npx tsx lab/frenzy.ts 36 1 --mixed # the headline: 216 rounds at mixed tables
npx tsx lab/frenzy.ts 12           # mixed tables, one-faction tables, one-unit armies, Easy and Normal, an idle player
npx tsx lab/hashes.ts              # twelve Classic checksums, the same before and after Frenzy
npx tsx lab/speed.ts
```

This report has two parts. The first is Frenzy as it stands after Kyle's five changes to the first build:
Turrets in line with the base, level ground, Collectors behind each base that bring in the Blocks and sell
the upgrades, a basic unit that fights hand to hand, and a hero that goes its own way. Every figure in it was
measured again on the new rules. The second part is Classic as it was measured for M3: **Classic's rules did
not change.** Twelve Classic matches give the same checksum, order for order, as they did before Frenzy was
added, and every Classic lab run below was repeated on Nov 15 and came out the same to the last figure.

Frenzy's targets are in the design doc's Verification section. Where it misses one, this report says by how
much and why.

## Frenzy: the headline

**At a table of two Green Armies and two Dino Packs, a Green Army wins 47% of 216 rounds and a Dino Pack
53%.** The target is that neither faction wins more than 55%. Two hundred rounds pin that to about three and
a half points either way. The first build stood at 52% and 48%.

**A Dino Pack is the first side out in 59% of those rounds**, where an even game would give 50%. In the
first build it was 72%. A Dino Pack is still the likelier to go first, but by much less.

**Rounds are a little shorter:** the median round ends at 13:17, where the first build's ended at 14:37.

**The opponents never go for a Collector.** In 216 rounds no side lost a Collector while its base still
stood, and in six rounds looked at closely none was so much as scratched. Opponents march on the base, which
stands between them and the Collectors, and a base that falls takes its side out. Today a Collector is in
danger only when you send your own army at one. Whether the opponents should raid yours is a question for
Kyle.

A warning that the lab gave about itself, twice now: the first 72 of these 216 rounds, taken alone, say the
Green Army wins 54%, and the same 72 in the first build said 63%. Seventy rounds can sit ten points from the
truth. Every tuning change was judged on the same 216 seeds before and after.

## Frenzy: what was checked, and where it stands

| Check | Target | Result | Status |
| --- | --- | --- | --- |
| Fair to every corner | No corner of the map is favoured | Exactly so, on the new map. Four copies of one opponent with the same dice stay the same round seen from every corner on every tick, for each faction and each bent (six rounds of up to 10 minutes); eight rounds with mixed factions and bents, replayed with the seats moved one, two and three corners round, are the same round turned, unit for unit | Met |
| Faction balance | At a mixed table neither faction wins more than 55% of rounds | Green Army 47%, Dino Pack 53%, of 216 | Met |
| Who goes out first | Each faction is the first side out in about half of mixed rounds | A Dino Pack in 59% of 216 (72% in the first build) | Closer; not met |
| Round length | 10 to 15 minutes, and every round ends | Median 13:17; one in ten under 8:09; nine in ten under 15:30; none of 216 unfinished at 25:00. Four Green Armies: median 14:38. Four Dino Packs: median 11:24 | Met |
| No best seat | Each seat wins about a quarter | 28%, 28%, 20%, 24% of 216 (the rules are exactly fair, so this is dice) | Met |
| No best bent | Each of the opponent's three leanings wins about a quarter of the seats it takes | Heaviest units 29%, flyers 26%, numbers and upgrades 20% (15% in the first build) | Close; numbers and upgrades is still the lowest |
| No one-unit army wins | An army of one unit wins less than its fair share of 25% | Bayonets, Troopers, Lancers, Tanks, Gunships, Raptors, Spitters, Horns, Pteros: each won 0 of 24 against three ordinary opponents | Met |
| It pushes back | An idle player is attacked, and knocked out | On Normal an idle Green Army is first hit at 3:04 and out at 6:24 (medians), and is the first side out in 15 of 24 rounds; an idle Dino Pack is hit at 2:34, out at 5:27, and first out in 15 of 24. Neither ever wins | Met |
| Easy is easier | A Normal opponent beats Easy ones, and an Easy one loses to Normal ones | One Normal opponent among three Easy ones wins 77% of 48 rounds, where a fair share is 25%; one Easy among three Normal wins none of 48 | Met |
| Same match twice | The same seed and orders give the identical round in Node, Chromium and WebKit | A Frenzy round of four (two of each faction, nine minutes or more, about two thousand orders) joins the two Classic matches: Chromium, at three phone sizes, replays the Node round from its seed and orders to the same checksum and plays its own from scratch to the same checksum. WebKit runs the same on GitHub before each deploy | Met |
| Fair fog | No opponent can read what its units don't see | A test checks, with four at the table, that every enemy in each side's view is one that side can see | Met |
| Whole numbers | The rules use whole numbers only | A test plays a Frenzy round and checks every number in the state | Met |
| Phone speed | 60 frames a second on a throttled phone profile | With the processor slowed fourfold and all four sides at full supply fighting around the Watchtower (136 to 144 units, four heroes, abilities going off), five runs: 2 to 2.5 ms a tick and 3 to 6 ms a frame of game code; the worst tick in twenty 5 to 12 ms and the worst frame in twenty 12 to 22 ms. The first build, measured beside it on the same machine the same day: 2 to 2.5 ms a tick and 2 to 7 ms a frame, worst in twenty 6 to 9 and 10 to 15. The two builds are the same within that machine's noise. Without a screen, a tick of the rules in the same battle takes 0.5 to 0.6 ms (worst in twenty 2 to 3). Frenzy caps a side at 40 supply, so it never puts as many units on the field as Classic's 200 | Game code is inside budget at the median; in the thickest brawl one frame in twenty may run late on a slow phone. True frame rate needs a real phone |
| Thumb-sized | Every control at least 44 px | Checked by 105 touch tests on three screen sizes, the shortest 340 px tall, 36 of them Frenzy's: the menu, both tabs with the seven upgrade tiles, the hero and its abilities, aiming, Attack and Move, the organiser, the pause sheet and the result screen | Met |
| Classic unchanged | Frenzy must not alter Classic | Twelve Classic matches (three for each pairing of factions) give the same checksum as before Frenzy; all 63 Classic rules tests still pass | Met |

## Frenzy: how a round goes

From the 216 mixed rounds, Normal opponents in every seat:

- **The opening.** Every side has its first unit in five seconds or less: a Bayonet at 4.2 seconds, a pair
  of Raptors at 3.4. The opponents first march from home at a median of 1:05, to the middle or at a
  neighbour.
- **Heroes.** A hero is level 4 at 5:00 (median) and the winner's ends at level 10, the top. Abilities open
  at levels 1, 3 and 6, so the second is open well before 5:00 and the third arrives in the second half of a
  round.
- **The first side out** leaves at a median of 6:01; one round in ten loses a side before 3:02.
- **The end.** The median round ends at 13:17, in overtime. A whole base takes 4:35 to crumble, so a round
  cannot run far past 15:00 unless somebody holds the middle. One round in ten is over before 8:09, with no
  overtime at all.
- **What gets made,** per side per round: for a Dino Pack about 63 Raptors, 45 Spitters, 13 Horns, 13 Rexes
  and 12 Pteros; for a Green Army about 32 Lancers, 23 Bayonets, 15 Troopers, 12 Juggernauts, 9 Flak
  Tracks, 8 Tanks and 6 Gunships. **Runners, Mortars and Brontos are almost never made** (fewer than one a
  round): the opponent has no use for them in Frenzy, which says they may have no use for you either.
- **What gets bought.** The winner ends a round with nearly everything: on average 3.9 of 4 levels each
  of Weapons and Armour, 3.0 of 3 of Muster, 3.9 of 4 of Haul, and 2.6, 2.6 and 2.4 of 3 of Might, Grit and
  Tempo. All seven upgrades together cost 9,200 Blocks. So late Blocks do have somewhere to go, and a round
  that runs to overtime just about empties the shop.

## Frenzy: one faction at every seat

| Table | Rounds | Median length | First side out | Bents: share of seats won |
| --- | --- | --- | --- | --- |
| Two Green Armies and two Dino Packs, every seating | 216 | 13:17 | 6:01 | heaviest units 29%, flyers 26%, numbers and upgrades 20% |
| Four Green Armies | 24 | 14:38 | 6:52 | heaviest units 26%, flyers 25%, numbers and upgrades 23% |
| Four Dino Packs | 24 | 11:24 | 6:43 | heaviest units 35%, flyers 25%, numbers and upgrades 13% |

Four Green Armies still tend to go the distance, but less than they did: one round in ten is over by 8:11,
where in the first build nine in ten ended between 14:23 and 15:51. Four Dino Packs settle it soonest, and
among them a swarm is the weak leaning.

## Frenzy: Easy, Normal and an idle player

| | Result |
| --- | --- |
| One Normal opponent among three Easy ones | Wins 77% of 48 rounds (a fair share is 25%); first out in 10% |
| One Easy opponent among three Normal ones | Wins none of 48; first out in 35% |
| An idle Green Army against three Normal opponents | First hit at 3:04, out at 6:24 (medians). Of 24 rounds: second once, third 8 times, first out 15 |
| An idle Dino Pack against three Normal opponents | First hit at 2:34, out at 5:27. Of 24: second 3 times, third 6, first out 15 |
| An idle Green Army against three Easy opponents | First hit at 4:52, out at 6:56. Of 24: second 4 times, third 6, first out 14 |
| An idle Dino Pack against three Easy opponents | First hit at 3:49, out at 6:43. Of 24: third 9 times, first out 15 |

An Easy opponent keeps its army at home for about the first two minutes, marches with less, takes no notice
of what the others are making, uses its hero's abilities one chance in five, and stops its upgrades early:
one level each of Muster, Haul, Might and Grit, two each of Weapons and Armour, and no Tempo. The missing
upgrades are what make it easy, because in a four-way fight the side that hangs back does well.

An idle player still comes second or third in nine or ten rounds of 24, for the same reason: three opponents
are busy with each other. But an idle base no longer lasts until it crumbles. In the first build an idle
Green Army against Easy opponents stood until 14:34; now it is out at 6:56. A base on level ground can be
walked up to from every side. Hard and Brutal are M4.

## Frenzy: the numbers

All of it lives in `src/sim/data.ts` (`FRENZY`, `UNLOCK`, `WORK`, `ABILITIES`).

| | |
| --- | --- |
| Blocks | 100 to start. Each of a base's two Collectors brings in 2 a second, so 4 a second with both standing, 2 with one, nothing with none. 4 more a second for holding the middle Watchtower alone |
| Collectors | Two behind each base, 2,500 health each, unarmed, not rebuilt. Bringing one down pays 150. Upgrades can be bought while at least one stands |
| Bounties | A quarter of a fallen unit's worth, to the side that did it the most harm on that tick. A hero pays 60 and 15 more for each of its levels. A base pays 300 |
| Supply | 40, fixed. A unit the base has finished waits at the door until there is room |
| A base | 5,500 health (a Classic Headquarters has 1,200 and a Nest 1,100). Two Turrets or Volcanoes, one on either side of it, of 1,500 health (Classic: 280 and 260) that reach a tile and a half further than Classic ones and hit three times as hard. The ground is level everywhere |
| Upgrades for the army and the base | Weapons and Armour (Claws and Hide): four levels at 150, 300, 450 and 600 Blocks. Muster: three levels at 150, 300 and 450; the base works 1.3, 1.6 and 2 times as fast |
| Haul | Four levels at 200, 350, 500 and 650. Each adds 1 Block a second to each Collector: 6, 8, 10 and 12 a second with both standing. The first level pays for itself in 1:40, the last in 5:25 |
| Upgrades for the hero | Three levels each at 200, 400 and 600. Might: 15% a level on its hits and on the damage of its abilities. Grit: 20% a level on its health. Tempo: abilities ready 12% sooner a level |
| Overtime | From 10:00 every base loses 20 health a second, except the base of the side holding the middle alone. Nobody is paid for a base that crumbles |
| Experience | A hero within nine tiles learns from every enemy that falls: a fifth of its worth; 80 and 20 a level for a hero; 250 for a base. Level n takes 100 × n. Each level adds 14% health and 12% damage; the top is level 10 |
| A fallen hero | Back at its base after 13 seconds at level 1 and 3 more for each level. Within six tiles of its own base it mends 3% of its health a second |

| Unit | Unlock | The base makes one every | | Unit | Unlock | The base makes one every |
| --- | --- | --- | --- | --- | --- | --- |
| Bayonet | free | 4.2 s | | Raptor | free | 3.4 s, a pair |
| Trooper | 100 | 4.2 s | | Spitter | 100 | 4.2 s |
| Lancer | 100 | 6.0 s | | Horn | 300 | 8.0 s |
| Runner | 100 | 5.0 s | | Ptero | 350 | 10.5 s |
| Flak Track | 200 | 10.5 s | | Bronto | 500 | 16.5 s |
| Tank | 400 | 14.0 s | | Rex | 800 | 24.5 s |
| Mortar | 400 | 14.0 s | | | | |
| Gunship | 500 | 17.5 s | | | | |
| Juggernaut | 800 | 27.0 s | | | | |

Times are for a base with no Muster. With several units in the mix the base makes them in turn.

The Bayonet exists only in Frenzy: 80 health (a Trooper has 45), 9 damage every 0.8 seconds at arm's
length, a little faster on its feet than a Trooper and faster still while closing. It hits infantry in full,
vehicles and buildings at 60%, and cannot touch a flyer.

| Hero | Health, level 1 to 10 | Hit, level 1 to 10 | Level 1 | Level 3 | Level 6 |
| --- | --- | --- | --- | --- | --- |
| Captain | 520 to 1,175; with all of Grit 832 to 1,880 | 20 to 41, at 5.5 tiles; with all of Might 29 to 59 | Grenade: 55 damage (9 more a level) within 1.6 tiles, thrown up to 6.5 tiles; every 10 s | Rally: its own units within 6 tiles fire 30% and move 25% faster for 8 s; every 25 s | Air strike: 170 damage (25 more a level) within 2.8 tiles, up to 9 tiles away, a second and a half after the call; every 60 s |
| Alpha | 1,000 to 2,260; with all of Grit 1,600 to 3,616 | 30 to 62, a bite; with all of Might 43 to 89 | Pounce: leaps up to 6 tiles and lands for 50 damage (8 more a level) within 1.4 tiles; every 10 s | Roar: enemies within 4.5 tiles are stunned for 2.5 s, heroes for half that; every 25 s | Call the Pack: 6 Raptors (1 more a level) for 25 s, which take no supply; every 60 s |

Blasts do half damage to buildings and do not reach flyers. All of Might adds 45% to a blast or a landing
(a level 10 Grenade does 197, an Air strike 391) but calls no more Raptors. All of Tempo brings the waits
down to 6.4, 16 and 38.4 seconds.

## Frenzy: what tuning changed

The first playable rules did not finish and were not fair to the Dino Pack. For the first build, in order:

1. **Rounds would not end.** Opponents sat at home or traded in the middle; rounds were still going at 25:00
   and one base stood on 47 health for eight minutes. Waves, a reserve that gathers at home while the army
   is out, and an opponent that finishes a base it has nearly broken, helped. Overtime ended it: from 10:00
   bases crumble unless you hold the middle.
2. **The first lost fight ended a side.** Lancers do double damage to buildings and outranged the Turrets: a
   group of them took a 3,000-health base down in about eleven seconds. Bases went to 5,500, Turrets to 1,500
   with more reach. A cap on damage to buildings was tried and thrown out: it hurt the Dino Pack, whose
   answer to a base is Horns and Brontos.
3. **Three sides piled on one.** Each opponent chose the weakest-looking army to attack, so all three chose
   the same side, usually a Dino Pack. They now weigh a base already hurt and a side close at hand above an
   army that looks weak.
4. **The Green Army won too much** (59% to 81% across early runs). Dinosaurs now come faster than their
   prices would give, the Alpha went to 1,000 health, Pounce to 50, and unlocks cost more. That gave 52%.

For the second build, on the same 216 seeds each time:

5. **Level ground took the Green Army's edge away.** With the plateaus gone, Bayonets in front and the first
   build's timings, the Green Army won 36% of mixed rounds, and 40% with a faster Bayonet alone. Fights of
   equal base-work on open ground showed why: Bayonets held their own against Raptors, and everything that
   shoots or rolls fell behind dinosaurs that could now reach it from every side.
6. **Too far the other way.** Every Green unit was made about a fifth faster and the Green Army won 63%,
   with a side out before 2:06 in one round in ten.
7. **Two changes together settled it.** Green timings went about half-way back (the table above). And a
   base's Turrets were made to hit three times as hard: beside the base on open ground, Turrets of Classic
   strength did not slow a rush. Across the three runs above one round in ten lost a side by 2:06 to 2:40
   and the first side went out at about 5:00; now those are 3:02 and 6:01. That is the 47% above.
8. **Raiders and Collectors: tried, measured, taken out.** At first Runners, Raptors, Gunships and Pteros
   sought out Collectors as they seek out Workers in Classic. Run on the same 216 seeds with that rule on,
   the Green Army won 49% and the first side went out at 6:10, which is the same result within the lab's
   noise, and no Collector was hit in either run. The rule did nothing, so the simpler one stayed: a
   Collector is a building like any other.
9. **The opponents learnt the shop.** Each buys Haul early, the army's upgrades through the middle of a
   round and its hero's late, and nothing once its Collectors are down. Easy stops early, as above.

## Frenzy: open items

- **The opponents never raid Collectors.** They can fall, a raid on one pays, and a side with none is
  starved, but in the lab it never happens: 2,500 health under a Turret's fire is nearly as much work as the
  base itself, and the base ends a side outright. If Collectors should be something you have to defend, the
  opponents need to be taught to go for them, and a Collector wants less health so that a raid is quicker
  than a siege.
- **A Dino Pack is still the first side out more often** than a Green Army, 59% to 41%. It was 72%.
- **Numbers and upgrades is still the lowest leaning** for the opponent (20% of the seats it takes, against
  29% and 26%), and among four Dino Packs it wins only 13%. A swarm at 40 supply is worth less than a heavy
  army at 40 supply.
- **Runners, Mortars and Brontos go unmade.** Runners have no Workers to raid, Mortars must stand still in a
  brawl that never does, and Brontos have no walls to break.
- **The Green opponent makes more Lancers than Bayonets.** It treats the Bayonet as a front line to put in
  front of shooters, not as its army. A player may find a different answer.
- **Hanging back still pays** in a four-way fight: an idle player comes second or third in nine or ten
  rounds of 24. The middle's income and overtime are the pull the other way.
- True frame rate, which needs a real phone.

---

# Classic, as measured for M3

Everything from here down is the M3 report of Nov 14, 2026. Classic's rules have not changed since, and the
lab runs were repeated on Nov 15 with the same results.

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
