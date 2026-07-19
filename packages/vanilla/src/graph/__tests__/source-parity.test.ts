/**
 * Source-parity drift alarm.
 *
 * The worker (`simulation-worker.ts`) and the sync fallback (`simulation.ts`)
 * deliberately DUPLICATE the force setup because the worker is bundled as a
 * standalone IIFE and can't import from workspace packages. This cheap grep test
 * fails loudly if the two force lists drift apart, so a sim change lands in BOTH.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// __tests__/ → ../ is the graph source dir. import.meta.dirname is provided by
// vitest and is a plain filesystem path (import.meta.url isn't file: under vite).
const graphDir = join(import.meta.dirname, '..');
const sync = readFileSync(join(graphDir, 'simulation.ts'), 'utf8');
const worker = readFileSync(join(graphDir, 'simulation-worker.ts'), 'utf8');

/** All `.force('name', ...)` registrations in a source string, sorted + deduped. */
function forceNames(src: string): string[] {
  const names = new Set<string>();
  for (const m of src.matchAll(/\.force\(\s*'([^']+)'/g)) names.add(m[1]);
  return [...names].sort();
}

/** All d3-force factories imported/used, so the toolset stays aligned. */
function forceFactories(src: string): string[] {
  const names = new Set<string>();
  for (const m of src.matchAll(/\b(force[A-Z]\w+)\b/g)) names.add(m[1]);
  return [...names].sort();
}

describe('simulation source parity (sync ⇄ worker)', () => {
  it('registers the same named forces in both paths', () => {
    expect(forceNames(sync)).toEqual(forceNames(worker));
  });

  it('uses the same d3-force factories in both paths', () => {
    expect(forceFactories(sync)).toEqual(forceFactories(worker));
  });

  it('both paths honor the warmup config fields', () => {
    for (const src of [sync, worker]) {
      expect(src).toContain('warmupTicks');
      expect(src).toContain('warmupBudgetMs');
      expect(src).toContain('initialAlpha');
    }
  });
});
