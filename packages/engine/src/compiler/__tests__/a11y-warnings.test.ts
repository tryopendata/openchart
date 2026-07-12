/**
 * Dev-mode WCAG contrast warnings.
 *
 * Unit tests for collectContrastWarnings plus compileChart integration:
 * warnings only fire with { dev: true }, name both colors and the ratio,
 * and never throw.
 */

import { resolveTheme } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileChart } from '../../compile';
import { computeScales } from '../../layout/scales';
import { collectContrastWarnings } from '../a11y-warnings';
import type { NormalizedChartSpec } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AREA = { x: 0, y: 0, width: 500, height: 300 };

/** Stacked column spec with an explicit two-color range. */
function stackedBarSpec(range: [string, string]) {
  return {
    mark: 'bar' as const,
    data: [
      { month: 'Jan', series: 'A', value: 10 },
      { month: 'Jan', series: 'B', value: 20 },
      { month: 'Feb', series: 'A', value: 15 },
      { month: 'Feb', series: 'B', value: 25 },
    ],
    encoding: {
      x: { field: 'month', type: 'nominal' as const },
      y: { field: 'value', type: 'quantitative' as const, stack: 'zero' as const },
      color: { field: 'series', type: 'nominal' as const, scale: { range } },
    },
  };
}

function scalesFor(spec: ReturnType<typeof stackedBarSpec>) {
  return computeScales(
    { ...spec, markType: 'bar' } as unknown as NormalizedChartSpec,
    AREA,
    spec.data,
  );
}

const theme = resolveTheme({});

// ---------------------------------------------------------------------------
// collectContrastWarnings (unit)
// ---------------------------------------------------------------------------

describe('collectContrastWarnings', () => {
  it('warns on adjacent stacked series below 3:1, naming both colors and the ratio', () => {
    const spec = stackedBarSpec(['#1a5276', '#21618c']);
    const warnings = collectContrastWarnings(scalesFor(spec), 'bar', theme);

    const adjacent = warnings.find((w) => w.includes('Adjacent series'));
    expect(adjacent).toBeDefined();
    expect(adjacent).toContain('#1a5276');
    expect(adjacent).toContain('#21618c');
    expect(adjacent).toContain('"A"');
    expect(adjacent).toContain('"B"');
    expect(adjacent).toMatch(/\d\.\d{2}:1/);
    expect(adjacent).toContain('WCAG 1.4.11');
    // Suggested replacement is a concrete color
    expect(adjacent).toMatch(/Nearest passing color for "B": #[0-9a-f]{6}/i);
  });

  it('stays silent for well-separated series colors', () => {
    const spec = stackedBarSpec(['#0b3040', '#f5b942']);
    const warnings = collectContrastWarnings(scalesFor(spec), 'bar', theme);
    expect(warnings.filter((w) => w.includes('Adjacent series'))).toEqual([]);
  });

  it('skips adjacency checks for line marks (series are not adjacent fills)', () => {
    const spec = stackedBarSpec(['#1a5276', '#21618c']);
    const warnings = collectContrastWarnings(scalesFor(spec), 'line', theme);
    expect(warnings.filter((w) => w.includes('Adjacent series'))).toEqual([]);
  });

  it('warns when a series color falls below 3:1 against an opaque background', () => {
    const whiteBg = resolveTheme({ colors: { background: '#ffffff' } });
    const spec = stackedBarSpec(['#f2f3f4', '#0b3040']);
    const warnings = collectContrastWarnings(scalesFor(spec), 'bar', whiteBg);
    const bg = warnings.find((w) => w.includes('against the background'));
    expect(bg).toBeDefined();
    expect(bg).toContain('#f2f3f4');
  });

  it('warns on text tokens below 4.5:1', () => {
    const lowContrastTheme = resolveTheme({
      colors: { background: '#ffffff', text: '#bbbbbb' },
    });
    const spec = stackedBarSpec(['#0b3040', '#111111']);
    const warnings = collectContrastWarnings(scalesFor(spec), 'bar', lowContrastTheme);
    const text = warnings.find((w) => w.includes('theme.colors.text'));
    expect(text).toBeDefined();
    expect(text).toContain('WCAG 1.4.3');
  });

  it('skips background-relative checks when the background is transparent (default)', () => {
    const spec = stackedBarSpec(['#f2f3f4', '#0b3040']);
    const warnings = collectContrastWarnings(scalesFor(spec), 'bar', theme);
    expect(warnings.filter((w) => w.includes('against the background'))).toEqual([]);
  });

  it('passes cleanly when series contrast both each other and the background', () => {
    const spec = stackedBarSpec(['#767676', '#111111']);
    expect(collectContrastWarnings(scalesFor(spec), 'bar', theme)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// compileChart integration (dev gate)
// ---------------------------------------------------------------------------

describe('compileChart dev-mode gating', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs contrast warnings only when dev: true', () => {
    const spec = stackedBarSpec(['#1a5276', '#21618c']);

    compileChart(spec, { width: 600, height: 400 });
    const withoutDev = (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes('[openchart a11y]'),
    );
    expect(withoutDev).toEqual([]);

    compileChart(spec, { width: 600, height: 400, dev: true });
    const withDev = (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes('[openchart a11y]'),
    );
    expect(withDev.length).toBeGreaterThan(0);
  });

  it('never throws, even for unparseable colors', () => {
    const spec = stackedBarSpec(['not-a-color', 'also-not-a-color']);
    expect(() => compileChart(spec, { width: 600, height: 400, dev: true })).not.toThrow();
  });
});
