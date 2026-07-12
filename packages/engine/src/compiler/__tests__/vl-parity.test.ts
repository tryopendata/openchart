/**
 * VL-idiom guessability suite.
 *
 * Each fixture in fixtures/vl-parity pairs a Vega-Lite-style spec ("vl") with
 * the canonical openchart spec ("canonical") for one accepted idiom, and
 * asserts they compile to deep-equal ChartLayouts. Layered fixtures
 * (layered: true) run through compileLayer to prove the same sugar works on
 * LayerSpec children.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompileOptions, LayerSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileChart, compileLayer } from '../../compile';

interface ParityFixture {
  file: string;
  layered?: boolean;
  options: CompileOptions;
  /** Per-side option overrides (e.g. the width/height fixture compiles the VL side in a larger container). */
  vlOptions?: CompileOptions;
  canonicalOptions?: CompileOptions;
  vl: Record<string, unknown>;
  canonical: Record<string, unknown>;
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'vl-parity');
const fixtures: ParityFixture[] = readdirSync(fixturesDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => ({
    file,
    ...(JSON.parse(readFileSync(join(fixturesDir, file), 'utf8')) as Omit<ParityFixture, 'file'>),
  }));

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('VL-idiom parity fixtures', () => {
  it('loads at least one flat and one layered fixture', () => {
    expect(fixtures.some((f) => !f.layered)).toBe(true);
    expect(fixtures.some((f) => f.layered)).toBe(true);
  });

  for (const fixture of fixtures) {
    it(`${fixture.file}: VL form compiles to the same layout as the canonical form`, () => {
      const vlLayout = fixture.layered
        ? compileLayer(fixture.vl as unknown as LayerSpec, fixture.vlOptions ?? fixture.options)
        : compileChart(fixture.vl, fixture.vlOptions ?? fixture.options);
      const canonicalLayout = fixture.layered
        ? compileLayer(
            fixture.canonical as unknown as LayerSpec,
            fixture.canonicalOptions ?? fixture.options,
          )
        : compileChart(fixture.canonical, fixture.canonicalOptions ?? fixture.options);
      expect(vlLayout).toEqual(canonicalLayout);
    });
  }
});
