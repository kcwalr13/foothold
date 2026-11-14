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
- Every change to a match is a `Command` (`src/sim/types.ts`), scheduled for the next tick. The player and the
  opponent use the same commands; the sim validates every field, because a command may one day come from
  another phone.
- The opponent (`src/ai/bot.ts`) never touches `Game`. It gets a `View` from `makeView` and returns commands.
  The fog-of-war test proves a View holds only what that side can see.
- Balance numbers live in `src/sim/data.ts`, not in code paths or the design doc. The doc sets targets.
- The app never decides a rule; it asks `src/sim` (`canPlace`, `hasBuilt`, ...).
- Nothing is fetched at runtime and there are no art files: `src/app/render.ts` draws everything.
- Every control is at least 44 px; the e2e suite checks it on three screen sizes. Panels are sized by
  `INSET` in `src/app/match.ts` and the matching CSS variables in `style.css`: change them together.
- Units are commanded as groups (0 to 3). There is no single-unit selection and no activated abilities in
  version 1; do not add them without Kyle.
- Version 1 has two factions. M1 ships the Green Army only; `FACTIONS` in `data.ts` and the `C` armour classes
  are shaped for the Dino Pack (M3) and a possible third.
- Player-facing words follow the toy look: Blocks and Batteries, Workers, Headquarters, Troopers, Lancers,
  Runners, Turrets. In a Green Army mirror the player is green and the opponent is tan.

## Checks before a build goes to Kyle

`npm run typecheck && npm test && npm run build && CHROME=... npm run e2e`, then `npx tsx lab/league.ts 12`
and `npx tsx lab/levels.ts 8`, with the results written into `docs/BALANCE.md` and the doc's Verification
section. Then confirm the deploy landed (the built bundle carries the commit in the menu's build line).
