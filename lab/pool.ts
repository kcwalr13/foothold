// Plays a list of matches on every processor core at once. Each match is plain data in and plain data out,
// so the results are the same whatever the number of cores; only the wait changes.
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { BotOptions } from '../src/ai/bot';
import type { FrenzyBotOptions } from '../src/ai/frenzy';
import type { Faction } from '../src/sim/types';
import { playFrenzy, type FrenzyResult } from './frenzymatch';
import { playMatch, type Result } from './match';

export interface Job {
  seed: number;
  a: BotOptions;
  b: BotOptions;
  maxTicks?: number;
  factions?: readonly [Faction, Faction];
  /** A Classic map by its id (`CLASSIC_MAPS`); Twin Ridges if none. */
  map?: string;
}

const run = (j: Job): Result => playMatch(j.seed, j.a, j.b, j.maxTicks ?? 15000, undefined, j.factions ?? ['green', 'green'], j.map ?? 'twin');

/** A Frenzy match: four sides, each with its own opponent. */
export interface FrenzyJob {
  seed: number;
  factions: Faction[];
  opts?: FrenzyBotOptions[];
  maxTicks?: number;
  /** A seat that is given no orders at all. */
  idle?: number;
}

const runFrenzy = (j: FrenzyJob): FrenzyResult => playFrenzy(j.seed, j.factions, j.opts ?? [], j.maxTicks ?? 12000, undefined, j.idle ?? -1);

/** Hands a list of jobs out to worker processes and returns the results in the same order. */
function fanOut<J, R>(tag: 'classic' | 'frenzy', jobs: readonly J[], here: (j: J) => R, workers: number): Promise<R[]> {
  if (workers <= 1 || jobs.length < 4) return Promise.resolve(jobs.map(here));
  const out = new Array<R>(jobs.length);
  const self = fileURLToPath(import.meta.url);
  const lanes = Array.from({ length: workers }, (_, w) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, self, '--worker', tag], { stdio: ['pipe', 'pipe', 'inherit'] });
    let buf = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      for (let nl = buf.indexOf('\n'); nl >= 0; nl = buf.indexOf('\n')) {
        const { i, r } = JSON.parse(buf.slice(0, nl)) as { i: number; r: R };
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

/** Any lab run plays on another Classic map when given --map=roads (or cross); jobs that name a map keep it. */
const MAP = process.argv.find((a) => a.startsWith('--map='))?.slice(6);

/** Plays every job and returns the results in the same order. */
export function playAll(jobs: readonly Job[], workers = Math.max(1, cpus().length)): Promise<Result[]> {
  return fanOut('classic', MAP ? jobs.map((j) => ({ map: MAP, ...j })) : jobs, run, workers);
}

/** The same for Frenzy matches. */
export function playAllFrenzy(jobs: readonly FrenzyJob[], workers = Math.max(1, cpus().length)): Promise<FrenzyResult[]> {
  return fanOut('frenzy', jobs, runFrenzy, workers);
}

if (process.argv.includes('--worker')) {
  const frenzy = process.argv.includes('frenzy');
  let text = '';
  process.stdin.on('data', (chunk: Buffer) => { text += chunk.toString(); });
  process.stdin.on('end', () => {
    for (const { i, j } of JSON.parse(text) as { i: number; j: Job & FrenzyJob }[]) {
      process.stdout.write(JSON.stringify({ i, r: frenzy ? runFrenzy(j) : run(j) }) + '\n');
    }
  });
}
