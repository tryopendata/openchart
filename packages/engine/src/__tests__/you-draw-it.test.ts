/**
 * "You draw it" (`youDrawIt`) engine tests: spec validation and geometry
 * resolution through the public compile path. Asserts on the resolved
 * ChartLayout.youDrawIt (samples, fromX, yInvert) and on validation errors
 * for the line-only / single-series / from-required rules.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const OPTS = { width: 600, height: 400 } as const;

function lineData() {
  // 2000..2020 in steps of 5, single series, quantitative y.
  return [2000, 2005, 2010, 2015, 2020].map((year, i) => ({
    year: `${year}`,
    value: 100 + i * 10,
  }));
}

function baseSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'line',
    data: lineData(),
    encoding: {
      x: { field: 'year', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    youDrawIt: { from: '2010' },
    ...overrides,
  } as ChartSpec;
}

describe('youDrawIt resolution', () => {
  it('resolves geometry with samples strictly after `from` in data coordinates', () => {
    const layout = compileChart(baseSpec(), OPTS);
    const ydi = layout.youDrawIt;
    expect(ydi).toBeDefined();

    // fromX sits inside the plot area.
    expect(ydi!.fromX).toBeGreaterThan(ydi!.area.x);
    expect(ydi!.fromX).toBeLessThanOrEqual(ydi!.area.x + ydi!.area.width);

    // 2010 is the visible line end (the anchor), so samples start after it
    // and run to the last x, carrying data x values.
    const xValues = ydi!.samples.map((s) => s.xValue);
    expect(xValues).toEqual(['2015', '2020']);

    // Samples ascend by pixel x.
    const pxs = ydi!.samples.map((s) => s.px);
    expect([...pxs].sort((a, b) => a - b)).toEqual(pxs);
  });

  it('resolves invertible y anchors so guesses map to data coordinates', () => {
    const layout = compileChart(baseSpec(), OPTS);
    const inv = layout.youDrawIt!.yInvert;
    expect(inv).toBeDefined();
    // Top pixel = larger data value, bottom pixel = smaller (y axis flips).
    expect(inv!.topData).toBeGreaterThan(inv!.bottomData);
    expect(inv!.topPixel).toBeLessThan(inv!.bottomPixel);
  });

  it('applies default prompt, revealLabel, and resetLabel', () => {
    const layout = compileChart(baseSpec(), OPTS);
    expect(layout.youDrawIt!.prompt).toBe('Draw your guess');
    expect(layout.youDrawIt!.revealLabel).toBe('Show me');
    expect(layout.youDrawIt!.resetLabel).toBe('Clear');
  });

  it('honors custom prompt, revealLabel, and resetLabel', () => {
    const layout = compileChart(
      baseSpec({
        youDrawIt: {
          from: '2010',
          prompt: 'Your turn',
          revealLabel: 'Reveal',
          resetLabel: 'Erase',
        },
      }),
      OPTS,
    );
    expect(layout.youDrawIt!.prompt).toBe('Your turn');
    expect(layout.youDrawIt!.revealLabel).toBe('Reveal');
    expect(layout.youDrawIt!.resetLabel).toBe('Erase');
  });

  it('anchors the guess on the data point when `from` is a data x', () => {
    const layout = compileChart(baseSpec(), OPTS);
    const ydi = layout.youDrawIt!;
    const line = layout.marks.find((m) => m.type === 'line');
    if (line?.type !== 'line') throw new Error('expected a line mark');
    const atFrom = line.points.find((p) => Math.abs(p.x - ydi.fromX) <= 0.5);
    expect(atFrom).toBeDefined();
    expect(ydi.anchor).toEqual({ x: ydi.fromX, y: atFrom!.y });
  });

  it('interpolates the anchor when `from` falls between data points', () => {
    const layout = compileChart(baseSpec({ youDrawIt: { from: '2012' } }), OPTS);
    const ydi = layout.youDrawIt!;
    const line = layout.marks.find((m) => m.type === 'line');
    if (line?.type !== 'line') throw new Error('expected a line mark');
    const before = line.points.filter((p) => p.x < ydi.fromX).at(-1)!;
    const after = line.points.find((p) => p.x > ydi.fromX)!;
    const t = (ydi.fromX - before.x) / (after.x - before.x);
    expect(ydi.anchor!.x).toBe(ydi.fromX);
    expect(ydi.anchor!.y).toBeCloseTo(before.y + t * (after.y - before.y), 6);
    expect(ydi.samples.map((s) => s.xValue)).toEqual(['2015', '2020']);
  });

  it('resolves a comparison line to pixel points', () => {
    const layout = compileChart(
      baseSpec({
        youDrawIt: {
          from: '2010',
          comparisonLine: [
            { x: '2010', y: 120 },
            { x: '2020', y: 150 },
          ],
        },
      }),
      OPTS,
    );
    const comp = layout.youDrawIt!.comparisonPoints;
    expect(comp).toBeDefined();
    expect(comp!.length).toBe(2);
    expect(comp![0].x).toBeLessThan(comp![1].x);
  });

  it('omits youDrawIt from the layout when not requested', () => {
    const layout = compileChart(baseSpec({ youDrawIt: undefined }), OPTS);
    expect(layout.youDrawIt).toBeUndefined();
  });
});

describe('youDrawIt validation', () => {
  it('rejects non-line marks', () => {
    expect(() =>
      compileChart(
        baseSpec({ mark: 'bar', encoding: { x: { field: 'year' }, y: { field: 'value' } } }),
        OPTS,
      ),
    ).toThrow(/only supported on line charts/i);
  });

  it('requires from', () => {
    expect(() => compileChart(baseSpec({ youDrawIt: {} as ChartSpec['youDrawIt'] }), OPTS)).toThrow(
      /from is required/i,
    );
  });

  it('accepts from: 0 (falsy but valid)', () => {
    const numericData = [0, 1, 2, 3].map((step) => ({ step: `${step}`, value: 10 + step }));
    const layout = compileChart(
      {
        mark: 'line',
        data: numericData,
        encoding: {
          x: { field: 'step', type: 'ordinal' },
          y: { field: 'value', type: 'quantitative' },
        },
        youDrawIt: { from: 0 },
      } as ChartSpec,
      OPTS,
    );
    expect(layout.youDrawIt).toBeDefined();
    expect(layout.youDrawIt!.samples.length).toBeGreaterThan(0);
  });

  it('rejects multi-series (categorical color with >1 value)', () => {
    const multi = [
      { year: '2010', value: 10, region: 'A' },
      { year: '2011', value: 12, region: 'A' },
      { year: '2010', value: 20, region: 'B' },
      { year: '2011', value: 22, region: 'B' },
    ];
    expect(() =>
      compileChart(
        {
          mark: 'line',
          data: multi,
          encoding: {
            x: { field: 'year', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'region', type: 'nominal' },
          },
          youDrawIt: { from: '2010' },
        } as ChartSpec,
        OPTS,
      ),
    ).toThrow(/single-series/i);
  });
});
