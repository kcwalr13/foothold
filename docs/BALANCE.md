# Balance report: M1 · First skirmish

Measured on Nov 13, 2026 with the bot lab (`npx tsx lab/league.ts 12` and `npx tsx lab/levels.ts 10`):
the computer opponent on both sides, no screen attached. Targets are the ones in the design doc's
Verification section; several are version 1 targets that M1 is not expected to meet yet.

## What was checked, and where it stands

| Check | Target | M1 result | Status |
| --- | --- | --- | --- |
| Same match twice | Same seed and commands give the identical result | Identical checksum on a re-run and on a replay from the command log (Node) | Met in Node; browser engines not compared yet |
| Counter table holds | Equal-cost fights come out as the unit table says | Troopers beat Runners and Lancers; Runners beat Lancers; a Turret beats its cost in Troopers or Runners; two Lancers break a Turret without a loss | Met |
| Fair fog | The opponent can't read what its units don't see | A test checks every enemy in the opponent's view sits on a tile it can see, over a whole match | Met |
| It pushes back | Normal: a hit before minute 6 in 8 of 10 matches, before minute 10 in all | Against a player who does nothing: first hit at 3:04 median, 2:21 earliest; always before 6:00 | Met |
| Match length (M1) | About 8 minutes | Computer against computer on Normal: median 4:56, range 3:39 to 8:11 | Shorter than planned |
| No best plan | No opening wins over 60%, each loses to at least one | Safe expansion 75%, rush 48%, fast expansion 27%; each loses to at least one other | Not met: the safe expansion is too strong |
| No one-trick wins | A one-unit or fixed build wins under 35% against Normal | All Troopers 53%, all Lancers 67%, all Runners 14%, Turret turtle 44% | Not met for Troopers, Lancers and the turtle |
| Phone speed | 60 frames a second with 200 units on a throttled phone profile | With the processor slowed fourfold: 3.5 ms a tick and 2.0 ms a frame of game code for a 200-unit battle | Game code is well inside budget; true frame rate needs a real phone |
| Thumb-sized | Every control at least 44 px at 844 × 390 and 740 × 360 | Checked by the touch tests on three screen sizes, in every panel and sheet | Met |

## The three openings (Normal against Normal, 108 matches)

Win rate of the row opening against the column opening:

| | Rush | Safe expansion | Fast expansion | Overall |
| --- | --- | --- | --- | --- |
| Rush | | 4% | 92% | 48% |
| Safe expansion | 96% | | 54% | 75% |
| Fast expansion | 8% | 46% | | 27% |

The triangle is there: the rush kills the fast expansion, the safe expansion holds the rush, and the fast
expansion is about even with the safe one. The safe expansion needs a real weakness; the fast expansion
should out-grow it more often.

## One-trick play against Normal

Each trick stays on one base with 14 Workers and builds one thing.

| Trick | Against rush | Against safe expansion | Against fast expansion | Overall |
| --- | --- | --- | --- | --- |
| All Troopers from four Barracks | 100% | 0% | 58% | 53% |
| All Lancers from four Barracks | 100% | 0% | 100% | 67% |
| All Runners from four Barracks | 8% | 0% | 33% | 14% |
| Two Barracks and six Turrets | 92% | 42% | 0% | 44% |

So a one-base push does not win by default: it loses every time to the opponent's safe expansion, and you
only know which opening you face by scouting. It does beat the rush and usually the fast expansion, because
those openings react too late. Closing that is M4 work (scouting and adapting).

## Easy and Normal

| | Result |
| --- | --- |
| Normal against Easy | Normal wins 90 to 95% |
| An idle player on Easy | First hit at 4:55, match over at 5:29 |
| An idle player on Normal | First hit at 3:04 median, match over at 3:29 |

Easy never rushes, stays on one base for five minutes, holds its army to a small cap and does not attack
before 4:30. Hard and Brutal are M4.

## Open items

- Side 1 won 59% of the 108 league matches. The map is symmetric and openings are shared evenly, so this
  is either chance or a small ordering bias; it gets a dedicated check in M2.
- Match length will rise with M2's units and with Blocks running out; M1 has neither.
- Browser-to-browser determinism (Chromium against WebKit) is not yet compared.
