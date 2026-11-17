# Balance report: M5 · Flight-ready, second build

Measured on Nov 17, 2026 with the bot lab: the computer opponent in every seat, no screen attached. The full set
of checks was run on this build: `lab/fair.ts`, `lab/factions.ts 12` (and 6 seeds on Three Roads and on
Crossroads, then 216 matches on each), `lab/league.ts 12` for both mirrors, `lab/levels.ts 8`, `lab/matrix.ts`,
`lab/speed.ts` and `lab/fairfrenzy.ts`.

What changed, all at Kyle's asking (Nov 17): supply tops out at **200** (five Headquarters or Nests at 40 each);
spare Workers and Gatherers can be **recycled** (they walk home, hand in their load, give back half their price,
and free their supply at once); and each faction has **nine kinds of research** instead of two: Weapons and
Armour (Claws and Hide) to a third level behind Heavy Works (a Great Cave), and seven more, each studied at its
own building in a research queue beside what that building trains. The opponent uses all three. Frenzy did not
change: three Frenzy rounds give the same checksums as before, and `lab/fairfrenzy.ts` finds every corner fair,
so Frenzy's figures (further below) stand.

## The headline: still neither faction the weaker pick

| | M4 and M5's first build | This build |
|---|---|---|
| The Dino Pack wins, as the opponent plays both sides (Twin Ridges, 216 matches) | 52% | **54%** |
| The same, every plan forced against every other | 63% | 63% |
| Three Roads, as played, 216 matches | 50% | 53% |
| Crossroads, as played, 216 matches | 47% | 52% |
| Median length, as played, Twin Ridges | 9:04 | 9:00 |

The target is that neither faction wins more than 55% of the headline: met, with a point to spare. The two new
maps are measured on 216 matches of their own (the same seeds before and after); `factions.ts 6` on its six
seeds gave 64% on Three Roads and 55% on Crossroads, but those seeds leaned to the Dino Pack before too (57% and
47%): 108 matches are good to about five points either way, 216 to three and a half.

**How it got there.** The first version moved the headline 4 to 6 points toward the Dino Pack on the same seeds.
Three things were tried in turn:

- **Swift Feet and Thick Skulls halved** (to 8% faster and 10% less). In equal-cost fights the first numbers were
  worth 25 and 43 points to the Dino side, where Long Rifles and Heavy Shells were worth 1 and 18 to the Green.
- **Helmets in place of Quick March.** Speed bought the Green Army nothing in a fight: its infantry shoot. With
  Helmets, the research each opponent usually buys is worth the same to both sides in a fight between the armies
  they actually field (Troopers, Lancers and a few Tanks against Raptors, Spitters and Horns): +11 for the Green
  Army's, -13 for the Dino Pack's.
- **The new research priced mostly in Batteries, the same for both.** This is the one that mattered. After six
  minutes the Dino opponent sits on 485 spare Blocks on average and the Green opponent on 79: the Dino Pack is
  short of eggs, the Green Army of Blocks. Priced in Blocks, research cost the Green Army soldiers and the Dino
  Pack nothing. Priced in Batteries (which the Green opponent has more of to spare) each side buys about as much
  (2.1 and 2.3 items a match on one set of seeds) and the headline came back to within a point or two.

Swings of three or four points on the same 216 seeds came from changes that should have done nothing (eggs laid
4% slower *raised* the Dino Pack's share), which is why every step above was judged on two sets of 216 and the
result confirmed by the full `factions.ts 12` run.

## Supply, recycling and research in play

From 24 matches between Normal opponents, every pairing, Twin Ridges:

- **Full supply.** A third of the matches reach a cap of 200 (8 of 24), and in 5 a side fills it.
- **Recycling.** The opponent recycles spare Workers once its supply bar is full: in the faction runs the Green
  opponent sends home 3 to 6 a match and the Dino opponent 1 to 2.
- **Research.** What the opponents studied most: Claws, Hide, Acid Spit, Big Mouths, Hot Rock and Swift Feet on
  the Dino side; Long Rifles, Concrete, Weapons, Helmets, Big Loads and Heavy Shells on the Green side. Field
  Repair and Mending, the late game's, came in a few of the longest matches.

## The rest of the checks

| Check | This build | Against target |
|---|---|---|
| Fair to both sides | 36 mirrors (each plan of each faction on each map) stay a mirror for 15 minutes; 18 seat-swapped matches are the same match | Met |
| No best plan | Green mirror: Fast expand 80% as played. Dino mirror: Big nest 63%, Pack hunt 69%. Against each other, a Dino Pack hunt wins 86% of 29 | Not met, as in M4 |
| No one-trick wins | All Lancers win 61% against a Green opponent, all Troopers 42% against a Dino one; every other one-unit build 25% or less | Not met for the same two, as in M4 |
| Levels | Normal beats Easy every time; Brutal beats Hard 69% to 94%; Hard against Normal 38% to 56% | Not met for Hard, as in M4 |
| Counter table | `lab/matrix.ts` prints exactly what it printed for M4 | Met |
| Phone speed | Both sides at full supply (222 to 254 fighting units with 82 Workers): a tick of the rules takes 0.31 to 0.53 ms (median), the worst in twenty 1.5 to 5.5 ms; a Frenzy brawl 0.23 ms | Inside budget; true frame rate needs a real phone |
| Frenzy unchanged | Three rounds give M5's checksums; every corner fair | Met |

M4's open items (a Hard that beats Normal, a fast expansion the other plans punish, an answer to one-unit
floods) are where they were.

# M5 · Flight-ready, first build

Measured on Nov 16, 2026 with the bot lab: the computer opponent in every seat, no screen attached.

```
npx tsx lab/hashes.ts                       # twelve Classic checksums on Twin Ridges, compared with M4's first build
npx tsx lab/fair.ts                         # a mirror for each plan of each faction on each of the three maps, and 18 seat swaps
npx tsx lab/factions.ts 12 --map=roads      # Green Army against Dino Pack on Three Roads: 216 as played, 216 plan against plan
npx tsx lab/factions.ts 6 --map=cross       # the same on Crossroads, 108 and 108
npx tsx lab/speed.ts
```

M5 changes no rule and nothing in the opponent. It adds two Classic maps, and everything else in it (saving a
match, sound, the report, hints, installing) lives in the app, where it cannot change a match. **Twelve
Classic matches on Twin Ridges and three Frenzy rounds give exactly the checksums they gave on M4's first
build**, so every figure measured for M4's first build (below) and for Frenzy's third build (further below)
still stands. What is new here is the two maps.

## The two new maps

| | Twin Ridges (M4) | Three Roads | Crossroads |
|---|---|---|---|
| The Dino Pack wins, as the opponent plays both sides | 52% of 216 | 47% of 216 | 47% of 108 |
| The Dino Pack wins, every plan forced against every other | 63% of 216 | 63% of 216 | 56% of 107 |
| Median length, as played | 9:04 | 8:32 | 10:15 |
| Nine in ten over by | 12:22 | 10:48 | 13:27 |
| The Dino Pack first hit at home (median) | 3:46 | 3:52 | 7:58 |
| The Green Army first hit at home (median) | 5:10 | 4:40 | 5:07 |
| Mirrors still a mirror after 15:00 | 12 of 12 | 12 of 12 | 12 of 12 |
| Seat-swapped matches the same match | 6 of 6 | 6 of 6 | 6 of 6 |

**Neither faction is the weaker pick on either new map.** On Three Roads the first 108 matches gave the Dino
Pack 57% and the next 108 only 36%: the same lab, the same opponent, other dice. That is why a map is judged by
216 matches, not 108, and why Crossroads' 47% of 108 is good to about five points either way.

Both new maps are fair to both sides exactly, as Twin Ridges is: built half by half about the middle, every
base site checked by the tests to stand on open ground and to be walkable from both mains, and the lab's 24
mirrors and 12 seat swaps on them unbroken.

**Three Roads** is the shortest map to play (8:32): the Middle Road runs straight from ramp to ramp, so a Green
Rush wins 69% of 52 matches against the Dino Pack here and a Fast expand 68% of 65. The Dino Pack's Big nest
(77% of 39) and Pack hunt (76% of 29) are its best plans; its Horn charge, Sky raid and Den win a quarter of the
time.

**Crossroads** is the longest (10:15, the corners are far apart, and a Dino Pack is first hit at home only at
7:58, in the median match) and the one that rewards expanding most: five
bases a side, the last two out in open ground. A Green Fast expand wins 89% of 44 matches against the Dino Pack
there, and a Green Rush only 13% of 24; forced against every Dino plan, the Rush loses 94%. This is M4's open
item (a fast expansion that nothing punishes) at its sharpest, and the M4 work on the opponent should be judged
on Crossroads as well as Twin Ridges.

## Speed

Unchanged, as it should be with no rule changed: a tick of the rules with 174 to 194 fighting units takes 0.30
to 0.44 ms (median), the worst in twenty 1.1 to 5.1 ms; a Frenzy brawl 0.25 ms. The budget is 100 ms.

## M4's open items, worked on alongside

Kyle's call was to build M5 with M4's last work alongside it. That work has not landed yet: none of the
opponent changes tried in the lab has held up on the same seeds before and after.

- **Hard against Normal** (about 45% in M4's report). Tried: Hard pulling back sooner from a losing fight and
  attacking with a smaller lead. Hard won 42% of 64 against Normal, no better, so it was not kept.
- **The fast expansion.** Tried: one Barracks before the natural rather than two for the standard opening (the
  Green mirror's Fast expand fell from 80% to 63%, but the Fortress rose to 73% and the Rush fell to 17%), and
  that with a stronger Rush and a Fortress that builds fewer Turrets (the Rush won none and the Fortress 77%).
  Neither was kept: each moved the problem rather than solving it.
- **One-unit floods** (all Lancers against a Green opponent, all Troopers against a Dino one): not yet started.

The rest of M4's open items stand as listed below.

# Classic, M4 first build

## The headline: neither faction is the weaker pick

**With the opponent playing both sides as it plays against you, the Dino Pack wins 113 of 216 matches against
the Green Army: 52%.** The target is that neither wins more than 55%. Two hundred matches pin a win rate to
about three and a half points either way.

It took one change to the rules to get there. On the bigger map both sides grow for longer before the first
fight, and the Dino Pack's eggs (several Gatherers at once from every Nest, where a Headquarters trains one
Worker at a time) pulled ahead: on the same plans the Dino Pack won 60% to 63% of runs of 108. Workers now
train in 8 seconds, as fast as a Gatherer hatches; with that the Dino Pack won 53% of 108 and then 52% of 216.

The second measure, every plan forced against every other (216 matches), gives the Dino Pack 63%. The
difference is the opponent's own judgement: against a Dino Pack a Green opponent picks the plans that work
there (a rush, a fast expansion) and rarely the ones that don't (a raider, a fortress), as a player would.

| Green plan against the Dino Pack, as played | Wins | Dino plan against the Green Army, as played | Wins |
| --- | --- | --- | --- |
| Rush (52 matches) | 60% | Stampede (35) | 71% |
| Fast expand (65) | 55% | Big nest (39) | 59% |
| Armour push (33) | 36% | Horn charge (40) | 58% |
| Air raid (44) | 52% | Sky raid (36) | 44% |
| Raider (10) | 10% | Pack hunt (29) | 62% |
| Fortress (12) | 0% | Den (37) | 22% |

## What was checked, and where it stands

| Check | Target | M4 first build | Status |
| --- | --- | --- | --- |
| Faction balance | Neither faction wins more than 55% with the computer on both sides | Dino Pack 52% of 216 as played; 63% plan against plan | Met as played |
| Fair to both sides | Neither end of the map is favoured | Exactly so on the new map: twelve mirrors, one for each plan of each faction, stay a mirror image for 15 minutes; eighteen seat-swapped matches are the same match unit for unit | Met |
| No best plan | No plan wins over 60%, each loses to at least one | Green mirror: Fast expand 80%. Dino mirror: Big nest 72%, Pack hunt 70% and loses to none. Green against Dino: no Green plan over 56% | Not met: the bigger map rewards expanding fast |
| No one-trick wins | A one-unit or fixed build wins under 35% against Normal | All Lancers 56% to 61% against a Green opponent; all Troopers 44% against a Dino one; everything else under 35% | Not met for two builds |
| It pushes back | Normal: a hit before minute 6 in 8 of 10 matches against an idle player | Normal Dino Pack 3:42 (median), every match before 6:00; Normal Green Army 3:14 to about 5:50 by its plan, every match before 6:00 | Met |
| Match length | Computer against computer on Normal: median 15 to 18 minutes | Median 9:04 Green against Dino, 8:39 in a Green mirror, 10:56 in a Dino mirror | Not met. The bigger map added about 15 seconds |
| Counter table | Equal-cost fights come out as the unit table says | Unchanged: the tests pin every pairing, and the matrix is within a few points of M3's | Met |
| Levels | Each level beats the one below | Normal beats Easy every time; Brutal beats Hard 63% to 94%; Hard against Normal 38% to 56%, about 45% | Not met for Hard |
| Phone speed | Within budget with the map full | 0.3 to 0.6 ms a tick (median) with 180 to 200 fighting units, unthrottled; worst in twenty 1.4 to 5.3 ms | Met, pending a real phone |

## The six plans against each other (648 matches, 6 to a cell)

Win rate of the row plan. Six matches a cell is few, so read the rows, not the cells.

**Green mirror** (median 8:39):

| | Rush | Fast expand | Armour push | Air raid | Raider | Fortress | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rush | | 50% | 0% | 0% | 33% | 17% | 20% |
| Fast expand | 33% | | 100% | 67% | 100% | 100% | 80% |
| Armour push | 100% | 0% | | 0% | 17% | 17% | 27% |
| Air raid | 100% | 0% | 83% | | 83% | 33% | 60% |
| Raider | 17% | 17% | 33% | 17% | | 17% | 20% |
| Fortress | 100% | 0% | 67% | 67% | 83% | | 63% |

**Dino mirror** (median 10:56):

| | Stampede | Big nest | Horn charge | Sky raid | Pack hunt | Den | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stampede | | 0% | 67% | 83% | 33% | 83% | 53% |
| Big nest | 100% | | 67% | 83% | 20% | 83% | 72% |
| Horn charge | 67% | 0% | | 67% | 17% | 67% | 43% |
| Sky raid | 17% | 67% | 67% | | 33% | 50% | 47% |
| Pack hunt | 50% | 100% | 83% | 50% | | 67% | 70% |
| Den | 83% | 0% | 17% | 50% | 0% | | 30% |

**Green Army (rows) against Dino Pack** (median 8:41):

| | Stampede | Big nest | Horn charge | Sky raid | Pack hunt | Den | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rush | 100% | 0% | 83% | 67% | 0% | 83% | 56% |
| Fast expand | 0% | 50% | 33% | 17% | 67% | 50% | 36% |
| Armour push | 50% | 67% | 33% | 50% | 17% | 67% | 47% |
| Air raid | 50% | 83% | 0% | 50% | 0% | 33% | 36% |
| Raider | 0% | 17% | 0% | 17% | 0% | 67% | 17% |
| Fortress | 0% | 17% | 0% | 33% | 0% | 0% | 8% |

**As played** (`lab/league.ts`, each side picking its own plan, 108 matches): in a Green mirror the side on
Fast expand wins 75% of the 40 times it is picked, Air raid 50%, Fortress 49%, Raider 46%, Rush 41%, Armour
push 34%; median length 9:05. In a Dino mirror Horn charge wins 60% of the 30 times it is picked, Big nest 59%,
Pack hunt 56%, Sky raid 44%, Stampede 41%, Den 15%; median length 11:08, and 3 of 108 were still going at the
30-minute limit, the first unfinished Classic matches since M1.

**What the bigger map did.** On the old map the plans came out close to even in a Green mirror (45% to 55%,
every one beaten by another). With half as far again to walk, an early attack arrives later and a fast
expansion has longer to pay off: Fast expand now wins four Green-mirror matches in five, Big nest and Pack
hunt (both fast expansions) top the Dino mirror, and a rush is only good against a plan that is slow to get
its army out. Three changes went in to keep the early plans honest (a safe expansion takes its natural behind
two Barracks, an Armour push may go from 5:30, a rush's first push goes for the Workers at a natural the
enemy has taken), and they helped the Green Army against the Dino Pack more than they helped inside a mirror.
Making a fast expansion something the other plans can punish is the next piece of M4.

**Conceding.** About one match in ten between two opponents now ends with the loser conceding (63 of 648
here), always in a match it had plainly lost: three Workers or fewer, an army under a fifth of the other's and
under 200 Blocks, for half a minute.

## One-trick play

Against the other faction's Normal opponent (win rate of the trick):

| Trick | Against | Overall | By the opponent's plan |
| --- | --- | --- | --- |
| All Troopers | Dino Pack | 44% | Stampede 67%, Big nest 0%, Horn charge 100%, Sky raid 100%, Pack hunt 0%, Den 0% |
| All Raptors | Green Army | 25% | Fast expand 83%, Raider 67%, the rest 0% |
| All Spitters | Green Army | 19% | Fast expand 50%, Raider 67%, the rest 0% |
| Everything else | either | 0% | |

Against their own faction, by level (win rate of the trick):

| Trick | Easy | Normal | Hard | Brutal |
| --- | --- | --- | --- | --- |
| All Troopers | 56% | 0% | 0% | 0% |
| All Runners | 6% | 6% | 0% | 0% |
| All Lancers | 56% | 56% | 38% | 0% |
| Turret turtle | 38% | 0% | 0% | 0% |
| All Tanks | 56% | 0% | 0% | 0% |
| All Gunships | 31% | 0% | 0% | 0% |
| All Raptors | 6% | 0% | 0% | 0% |
| All Spitters | 56% | 25% | 25% | 0% |
| All Horns | 100% | 0% | 6% | 0% |
| All Pteros | 31% | 0% | 0% | 0% |

The bigger map closed the Trooper flood that beat a Green opponent 61% at M3: it now has too far to walk. Two
floods still get through: Lancers against a Green opponent (they outrange its Turrets and it does not yet
answer them with enough Troopers and Runners), and Troopers against a Dino Horn charge or Sky raid, which go
for Horns or Pteros before they have what stops infantry. Teaching it to read a flood and answer it is the
scouting-and-adapting part of M4.

## The levels

| | Result |
| --- | --- |
| Normal against Easy | 16 of 16 in every pairing of factions |
| Hard against Normal | Green against Green 38%, Green against Dino 44%, Dino against Green 56%, Dino against Dino 44% |
| Brutal against Hard | Green against Green 88%, Green against Dino 75%, Dino against Green 94%, Dino against Dino 63% |
| An idle player on Easy | First hit at about 5:15, match over at about 5:45 |
| An idle player on Normal | First hit at 3:42 from a Dino Pack, every match before 6:00; 3:14 to about 5:50 from a Green Army, by its plan |

**Brutal is clearly harder; Hard is not yet.** Hard plays with Normal's economy, thinks every 0.3 seconds
instead of 0.5, raids with bigger packs, opens its second front sooner, builds more Turrets and leans on the
plans that pay in each pairing. In the lab none of that beats Normal head to head, and the things tried to
make it stronger (a bigger economy, more Barracks, attacking with a smaller lead) made it weaker. It does more
at once, which should tell more against a person than against another copy of itself, but making Hard
measurably harder is open M4 work.

Easy's Fortress used to wait for Juggernauts that Easy never builds, and so never attacked; it now attacks
when Easy would. A Fortress of any level now goes out against an enemy it has looked at and found with next
to no army.

## The counter table

The matrix (`npx tsx lab/matrix.ts`, 1,800 a side, attack-moving across open ground just off the middle of the
new map) is within a few points of the M3 table in every cell. Two cells moved across the line: Troopers
against Raptors is now Troopers by 6 (was Raptors by 7) and Rex against Raptors a draw (was the Rex keeping
39%); both were close calls at M3 too.

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

## Fair to both sides

Both checks hold on the new map, for the six plans: twelve mirrors and eighteen seat swaps. The bigger map
exposed a fifteenth cause, which was not about fairness at all but showed up first as a broken mirror:

15. The pathfinder kept a tile's number and its walking cost in one number, with room for 8,192 tiles. Twin
    Ridges now has 10,368, so on the far side of the map distances were filed against the wrong tiles, and a
    Worker could walk away from its Refinery. Its fields for buildings were also keyed by the building's number
    plus 10,000, which a tile's own number can now reach. Both are fixed (room for 65,536 tiles, building
    fields keyed above the last tile); on the old map neither had any effect, and twelve Classic matches
    recorded on the live build replay to the same checksum on these rules.

## Open items

- A fast expansion is the best plan in both mirrors on the bigger map. The plans that should punish it (an
  early push, raids on the natural) need to arrive while it is still thin.
- Hard is not yet harder than Normal.
- Lancers against a Green opponent and Troopers against a Dino Horn charge or Sky raid beat the opponent more
  than one time in three.
- Match length: the bigger map added only about 15 seconds to a match between two opponents.
- At full supply a swarm is worth far less than a Green army. Untested by the lab, whose matches end early.
- True frame rate, which needs a real phone.

# Frenzy, as measured for its third build

Frenzy's rules and opponents did not change in M4, and its rounds come out the same, checksum for checksum;
everything from here down was measured on Nov 15 for MF's third build.

## Frenzy: the headline

**At a table of two Green Armies and two Dino Packs, a Green Army wins 47% of 216 rounds and a Dino Pack
53%.** The target is that neither faction wins more than 55%. Two hundred rounds pin that to about three and
a half points either way. The second build stood at 47% too, the first at 52%.

**A Dino Pack is the first side out in 57% of those rounds**, where an even game would give 50%. In the
second build it was 59%, in the first 72%.

**Rounds run a little longer than in the second build:** the median round ends at 14:12, where the second
build's ended at 13:17 and the first build's at 14:37. A base now starts slower and has walls again, and
both make a side harder to put out early: the first side goes out at a median of 6:52, against 6:01.

**The opponents never go for a Collector.** In 216 rounds no side lost a Collector while its base still
stood, and in six rounds looked at closely none was so much as scratched. Opponents march on the base, which
stands between them and the Collectors, and a base that falls takes its side out. Today a Collector is in
danger only when you send your own army at one. Whether the opponents should raid yours is a question for
Kyle.

A warning that the lab keeps giving about itself: the first 72 of these 216 rounds, taken alone, say the
Green Army wins 44%; in the second build the same 72 said 54%, and in the first 63%, while all three
builds' 216 rounds said 47% to 52%. Seventy rounds can sit ten points from the truth. Every tuning change
was judged on the same 216 seeds before and after.

## Frenzy: what was checked, and where it stands

| Check | Target | Result | Status |
| --- | --- | --- | --- |
| Fair to every corner | No corner of the map is favoured | Exactly so, on the walled map. Four copies of one opponent with the same dice stay the same round seen from every corner on every tick, for each faction and each bent (six rounds of up to 10 minutes); eight rounds with mixed factions and bents, replayed with the seats moved one, two and three corners round, are the same round turned, unit for unit | Met |
| Faction balance | At a mixed table neither faction wins more than 55% of rounds | Green Army 47%, Dino Pack 53%, of 216 | Met |
| Who goes out first | Each faction is the first side out in about half of mixed rounds | A Dino Pack in 57% of 216 (59% in the second build, 72% in the first) | Closer; not met |
| Round length | 10 to 15 minutes, and every round ends | Median 14:12; one in ten under 9:12; nine in ten under 15:43; none of 216 unfinished at 25:00. Four Green Armies: median 14:52. Four Dino Packs: median 11:43 | Met, at the long end |
| No best seat | Each seat wins about a quarter | 27%, 21%, 23%, 29% of 216 (the rules are exactly fair, so this is dice) | Met |
| No best bent | Each of the opponent's three leanings wins about a quarter of the seats it takes | Flyers 27%, heaviest units 25%, numbers and upgrades 22% (15% in the first build). Among four Dino Packs, numbers and upgrades wins 7% | Met at mixed tables; not among four Dino Packs |
| No one-unit army wins | An army of one unit wins less than its fair share of 25% | Against three ordinary opponents, all Lancers won 1 of 24; Bayonets, Troopers, Tanks, Gunships, Raptors, Spitters, Horns and Pteros each won none | Met |
| It pushes back | An idle player is attacked, and knocked out | On Normal an idle Green Army is first hit at 3:55 and out at 6:20 (medians), and is the first side out in 17 of 24 rounds; an idle Dino Pack is hit at 2:16, out at 6:35, and first out in 15 of 24. Neither ever wins | Met |
| Easy is easier | A Normal opponent beats Easy ones, and an Easy one loses to Normal ones | One Normal opponent among three Easy ones wins 83% of 48 rounds, where a fair share is 25%; one Easy among three Normal wins 1 of 48 | Met |
| Same match twice | The same seed and orders give the identical round in Node, Chromium and WebKit | A Frenzy round of four (two of each faction, nine minutes or more, about two thousand orders) joins the two Classic matches: Chromium, at three phone sizes, replays the Node round from its seed and orders to the same checksum and plays its own from scratch to the same checksum. WebKit runs the same on GitHub before each deploy | Met |
| Fair fog | No opponent can read what its units don't see | A test checks, with four at the table, that every enemy in each side's view is one that side can see | Met |
| Whole numbers | The rules use whole numbers only | A test plays a Frenzy round and checks every number in the state | Met |
| Phone speed | 60 frames a second on a throttled phone profile | Measured for the second build, with the processor slowed fourfold and all four sides at full supply fighting around the Watchtower (136 to 144 units, four heroes, abilities going off), five runs: 2 to 2.5 ms a tick and 3 to 6 ms a frame of game code; the worst tick in twenty 5 to 12 ms and the worst frame in twenty 12 to 22 ms, the same as the first build within that machine's noise. The third build adds only walls, which are drawn once into the map, and without a screen a tick of the rules in that battle still takes 0.3 to 0.5 ms (worst in twenty 1 to 3). Frenzy caps a side at 40 supply, so it never puts as many units on the field as Classic's 200 | Game code is inside budget at the median; in the thickest brawl one frame in twenty may run late on a slow phone. True frame rate needs a real phone |
| Thumb-sized | Every control at least 44 px | Checked by 105 touch tests on three screen sizes, the shortest 340 px tall, 36 of them Frenzy's: the menu, both tabs with the seven upgrade tiles, the hero and its abilities, aiming, Attack and Move, the organiser, the pause sheet and the result screen | Met |
| Classic unchanged | Frenzy must not alter Classic | Twelve Classic matches (three for each pairing of factions) give the same checksum as before Frenzy; all 63 Classic rules tests still pass | Met |

## Frenzy: how a round goes

From the 216 mixed rounds, Normal opponents in every seat:

- **The opening.** Every side has its first unit in under seven seconds: a pair of Raptors at 5.7 seconds,
  a Bayonet at 6.6. The opponents first march from home at a median of 0:56, to the middle or at a
  neighbour, with a handful of units.
- **Heroes.** A hero is level 4 at 5:00 (median) and the winner's ends at level 9 of 10. Abilities open
  at levels 1, 3 and 6, so the second is open well before 5:00 and the third arrives in the second half of a
  round.
- **The first side out** leaves at a median of 6:52; one round in ten loses a side before 4:36.
- **The end.** The median round ends at 14:12, in overtime. A whole base takes 4:35 to crumble, so a round
  cannot run far past 15:00 unless somebody holds the middle. One round in ten is over before 9:12, with no
  overtime at all.
- **What gets made,** per side per round: for a Dino Pack about 52 Raptors, 40 Spitters, 13 Rexes, 12 Pteros
  and 12 Horns; for a Green Army about 29 Lancers, 21 Bayonets, 15 Troopers, 11 Juggernauts, 9 Flak
  Tracks, 8 Tanks and 6 Gunships. **Runners, Mortars and Brontos are almost never made** (fewer than one a
  round): the opponent has no use for them in Frenzy, which says they may have no use for you either.
- **What gets bought.** The winner ends a round with nearly everything: on average 3.9 of 4 levels each
  of Weapons and Armour, 3.0 of 3 of Muster, 3.9 of 4 of Haul, and 2.7, 2.7 and 2.5 of 3 of Might, Grit and
  Tempo. All seven upgrades together cost 9,200 Blocks. So late Blocks do have somewhere to go, and a round
  that runs to overtime just about empties the shop.

## Frenzy: one faction at every seat

| Table | Rounds | Median length | First side out | Bents: share of seats won |
| --- | --- | --- | --- | --- |
| Two Green Armies and two Dino Packs, every seating | 216 | 14:12 | 6:52 | flyers 27%, heaviest units 25%, numbers and upgrades 22% |
| Four Green Armies | 24 | 14:52 | 8:00 | flyers 31%, numbers and upgrades 27%, heaviest units 18% |
| Four Dino Packs | 24 | 11:43 | 7:29 | flyers 34%, heaviest units 32%, numbers and upgrades 7% |

With the walls back, four Green Armies go the distance again: nine rounds in ten end between 13:45 and
15:51, which is bases crumbling, as in the first build. Four Dino Packs settle it soonest, and among them a
swarm is the weak leaning by a long way.

## Frenzy: Easy, Normal and an idle player

| | Result |
| --- | --- |
| One Normal opponent among three Easy ones | Wins 83% of 48 rounds (a fair share is 25%); first out in 13% |
| One Easy opponent among three Normal ones | Wins 1 of 48; first out in 33% |
| An idle Green Army against three Normal opponents | First hit at 3:55, out at 6:20 (medians). Of 24 rounds: third 7 times, first out 17 |
| An idle Dino Pack against three Normal opponents | First hit at 2:16, out at 6:35. Of 24: third 9 times, first out 15 |
| An idle Green Army against three Easy opponents | First hit at 4:59, out at 6:37. Of 24: second once, third 7 times, first out 16 |
| An idle Dino Pack against three Easy opponents | First hit at 4:46, out at 6:54. Of 24: third 5 times, first out 19 |

An Easy opponent keeps its army at home for about the first two minutes, marches with less, takes no notice
of what the others are making, uses its hero's abilities one chance in five, and stops its upgrades early:
one level each of Muster, Haul, Might and Grit, two each of Weapons and Armour, and no Tempo. The missing
upgrades are what make it easy, because in a four-way fight the side that hangs back does well.

An idle player still comes third in 5 to 9 rounds of 24, for the same reason: three opponents are busy with
each other. But it almost never comes second, and an idle base no longer lasts until it crumbles: in the
first build an idle Green Army against Easy opponents stood until 14:34, and now it is out at 6:37. Hard and
Brutal are M4.

## Frenzy: the numbers

All of it lives in `src/sim/data.ts` (`FRENZY`, `UNLOCK`, `WORK`, `ABILITIES`).

| | |
| --- | --- |
| Blocks | 100 to start. Each of a base's two Collectors brings in 2 a second, so 4 a second with both standing, 2 with one, nothing with none. 4 more a second for holding the middle Watchtower alone |
| Collectors | Two behind each base, 2,500 health each, unarmed, not rebuilt. Bringing one down pays 150. Upgrades can be bought while at least one stands |
| Bounties | A quarter of a fallen unit's worth, to the side that did it the most harm on that tick. A hero pays 60 and 15 more for each of its levels. A base pays 300 |
| Supply | 40, fixed. A unit the base has finished waits at the door until there is room |
| A base | 5,500 health (a Classic Headquarters has 1,200 and a Nest 1,100). Two Turrets or Volcanoes, one on either side of it, of 1,500 health (Classic: 280 and 260) that reach a tile and a half further than Classic ones and hit three times as hard. The ground is level everywhere; each corner is walled along its two inner sides, leaving one way in, six tiles wide, toward the middle |
| Upgrades for the army and the base | Weapons and Armour (Claws and Hide): four levels at 150, 300, 450 and 600 Blocks. Muster: three levels at 150, 300 and 450. A base starts at 6 work a tick; Muster takes it to 10, 14 and 18, so 1.67, 2.33 and 3 times as fast |
| Haul | Four levels at 200, 350, 500 and 650. Each adds 1 Block a second to each Collector: 6, 8, 10 and 12 a second with both standing. The first level pays for itself in 1:40, the last in 5:25 |
| Upgrades for the hero | Three levels each at 200, 400 and 600. Might: 15% a level on its hits and on the damage of its abilities. Grit: 20% a level on its health. Tempo: abilities ready 12% sooner a level |
| Overtime | From 10:00 every base loses 20 health a second, except the base of the side holding the middle alone. Nobody is paid for a base that crumbles |
| Experience | A hero within nine tiles learns from every enemy that falls: a fifth of its worth; 80 and 20 a level for a hero; 250 for a base. Level n takes 100 × n. Each level adds 14% health and 12% damage; the top is level 10 |
| A fallen hero | Back at its base after 13 seconds at level 1 and 3 more for each level. Within six tiles of its own base it mends 3% of its health a second |

| Unit | Unlock | The base makes one every (no Muster, all of it) | | Unit | Unlock | The base makes one every (no Muster, all of it) |
| --- | --- | --- | --- | --- | --- | --- |
| Bayonet | free | 6.6 s, 2.2 s | | Raptor | free | 5.7 s, 1.9 s, a pair |
| Trooper | 100 | 6.7 s, 2.2 s | | Spitter | 100 | 7.0 s, 2.3 s |
| Lancer | 100 | 9.5 s, 3.2 s | | Horn | 300 | 13.3 s, 4.4 s |
| Runner | 100 | 8.0 s, 2.7 s | | Ptero | 350 | 17.5 s, 5.8 s |
| Flak Track | 200 | 16.7 s, 5.6 s | | Bronto | 500 | 27.5 s, 9.2 s |
| Tank | 400 | 22.2 s, 7.4 s | | Rex | 800 | 40.8 s, 13.6 s |
| Mortar | 400 | 22.2 s, 7.4 s | | | | |
| Gunship | 500 | 27.7 s, 9.2 s | | | | |
| Juggernaut | 800 | 42.8 s, 14.3 s | | | | |

With several units in the mix the base makes them in turn.

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

For the third build, again on the same 216 seeds:

10. **The walls cost the Green Army four points.** Walls alone took it from 47% to 43%; the slower start
    on top made it 42%, which is the same within the lab's noise.
11. **Green units about 5% quicker** to come out, at every Muster level, put it back at 47%. That is the
    same lever as step 6, at about a third of the step that overshot to 63%.

## Frenzy: open items

- **The opponents never raid Collectors.** They can fall, a raid on one pays, and a side with none is
  starved, but in the lab it never happens: 2,500 health under a Turret's fire is nearly as much work as the
  base itself, and the base ends a side outright. If Collectors should be something you have to defend, the
  opponents need to be taught to go for them, and a Collector wants less health so that a raid is quicker
  than a siege.
- **A Dino Pack is still the first side out more often** than a Green Army, 57% to 43%. It was 59% in the
  second build and 72% in the first.
- **Numbers and upgrades is still the lowest leaning** for the opponent (22% of the seats it takes, against
  27% and 25%), and among four Dino Packs it wins only 7%. A swarm at 40 supply is worth less than a heavy
  army at 40 supply.
- **Runners, Mortars and Brontos go unmade.** Runners have no Workers to raid, Mortars must stand still in a
  brawl that never does, and Brontos, the Dino Pack's building-breakers, find few buildings to break.
- **The Green opponent makes more Lancers than Bayonets.** It treats the Bayonet as a front line to put in
  front of shooters, not as its army. A player may find a different answer.
- **Hanging back still pays** in a four-way fight: an idle player comes third in 5 to 9 rounds of 24. The middle's income and overtime are the pull the other way.
- **Rounds sit at the long end** of 10 to 15 minutes (median 14:12), and four Green Armies nearly always
  play on until bases crumble. If that feels slow, a slightly quicker start or an earlier overtime are one
  number each.
- **The walls' gap is out of the Turrets' reach.** The Turrets stand beside the base, as asked, and cover
  the base and the Collectors; an attacker comes through the gap unshot and meets them inside.
- True frame rate, which needs a real phone.

---

