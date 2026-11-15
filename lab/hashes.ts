// The checksum of twelve Classic matches, three for each pairing of factions. A change that is meant to leave
// Classic alone (anything for Frenzy, say) must leave every line of this as it was: run it before and after
// and compare.
// Run: npx tsx lab/hashes.ts > before.txt   (then, after the change)   npx tsx lab/hashes.ts | diff before.txt -
import { playMatch } from './match';

const out: string[] = [];
for (const [fa, fb] of [['green', 'green'], ['green', 'dino'], ['dino', 'green'], ['dino', 'dino']] as const) {
  for (const seed of [3, 11, 27]) {
    const r = playMatch(seed, { level: 1 }, { level: 1 }, 7000, undefined, [fa, fb]);
    out.push(`${fa} ${fb} ${seed} ${r.ticks} ${r.winner} ${r.hash} ${r.commands}`);
  }
}
console.log(out.join('\n'));
