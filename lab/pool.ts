// Plays a list of matches on every processor core at once. Each match is plain data in and plain data out,
// so the results are the same whatever the number of cores; only the wait changes.
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { BotOptions } from '../src/ai/bot';
import type { Faction } from '../src/sim/types';
import { playMatch, type Result } from './match';

export interface Job {
  seed: number;
  a: BotOptions;
  b: BotOptions;
  maxTicks?: number;
  factions?: readonly [Faction, Faction];
}

const run = (j: Job): Result => playMatch(j.seed, j.a, j.b, j.maxTicks ?? 15000, undefined, j.factions ?? ['green', 'green']);

/** Plays every job and returns the results in the same order. */
export function playAll(jobs: readonly Job[], workers = Math.max(1, cpus().length)): Promise<Result[]> {
  if (workers <= 1 || jobs.length < 4) return Promise.resolve(jobs.map(run));
  const out = new Array<Result>(jobs.length);
  const self = fileURLToPath(import.meta.url);
  const lanes = Array.from({ length: workers }, (_, w) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, self, '--worker'], { stdio: ['pipe', 'pipe', 'inherit'] });
    let buf = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      for (let nl = buf.indexOf('\n'); nl >= 0; nl = buf.indexOf('\n')) {
        const { i, r } = JSON.parse(buf.slice(0, nl)) as { i: number; r: Result };
        out[i] = r;
        buf = buf.slice(nl + 1);
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`lab worker stopped with code ${code}`))));
    child.stdin.end(JSON.stringify(jobs.map((j, i) => ({ i, j })).filter((x) => x.i % workers === w)));
  }));
  return Promise.all(lanes).then(() => out);
}

if (process.argv.includes('--worker')) {
  let text = '';
  process.stdin.on('data', (chunk: Buffer) => { text += chunk.toString(); });
  process.stdin.on('end', () => {
    for (const { i, j } of JSON.parse(text) as { i: number; j: Job }[]) process.stdout.write(JSON.stringify({ i, r: run(j) }) + '\n');
  });
}
