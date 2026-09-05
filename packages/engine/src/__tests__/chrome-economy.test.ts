/**
 * Chrome economy: what a small container is allowed to draw.
 *
 * The rule set lives in `resolveChromeEconomy` (core/responsive/breakpoints);
 * these tests assert it reaches the compiled layout, and that an explicit
 * axis config still wins over every drop.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import { compileChart } from '../compile';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const data = months.map((month, i) => ({ month, value: 10 + i * 3 }));

function compile(
  width: number,
  height: number,
  encodingOverrides: Record<string, unknown> = {},
): ChartLayout {
  return compileChart(
    {
      mark: 'line',
      data,
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
        ...encodingOverrides,
      },
    },
    { width, height },
  );
}

/** Same series on a temporal x, where ticks are ruler marks rather than names. */
function compileTemporal(width: number, height: number): ChartLayout {
  return compileChart(
    {
      mark: 'line',
      data: data.map((row, i) => ({
        t: new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 10),
        value: row.value,
      })),
      encoding: {
        x: { field: 't', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    { width, height },
  );
}

describe('chrome economy', () => {
  it('drops gridlines and axes on a 300x140 tile', () => {
    const layout = compile(300, 140);
    expect(layout.axes.x).toBeUndefined();
    expect(layout.axes.y).toBeUndefined();
  });

  it('keeps gridlines and axes on a full-size chart', () => {
    const tall = compile(700, 400);
    expect(tall.axes.y).toBeDefined();
    expect(tall.axes.y!.gridlines.length).toBeGreaterThan(0);
  });

  it('drops axes on a 700x180 embed', () => {
    const layout = compile(700, 180);
    expect(layout.axes.y).toBeUndefined();
  });

  it('drops the grid but keeps an explicitly requested axis under 150px', () => {
    const layout = compile(700, 140, {
      y: { field: 'value', type: 'quantitative', axis: { tickCount: 3 } },
    });
    expect(layout.axes.y).toBeDefined();
    expect(layout.axes.y!.gridlines).toHaveLength(0);
  });

  it('keeps the grid at 180px when the axis is explicit', () => {
    const layout = compile(700, 180, {
      y: { field: 'value', type: 'quantitative', axis: { tickCount: 3 } },
    });
    expect(layout.axes.y!.gridlines.length).toBeGreaterThan(0);
  });

  it('caps a continuous x axis at three tick labels at compact width', () => {
    const layout = compileTemporal(360, 400);
    expect(layout.axes.x!.ticks.length).toBeLessThanOrEqual(3);
  });

  it('leaves the tick count alone above the compact breakpoint', () => {
    const layout = compileTemporal(800, 400);
    expect(layout.axes.x!.ticks.length).toBeGreaterThan(3);
  });

  it('never caps a band axis: a category tick is an identity, not a ruler mark', () => {
    const layout = compileChart(
      {
        mark: 'bar',
        data: ['A', 'B', 'C', 'D', 'E'].map((grade, i) => ({ grade, value: 10 + i })),
        encoding: {
          x: { field: 'grade', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      { width: 360, height: 400 },
    );
    expect(layout.axes.x!.ticks).toHaveLength(5);
  });

  it('honours an explicit grid on a tile that would otherwise drop it', () => {
    const layout = compile(300, 140, {
      y: { field: 'value', type: 'quantitative', axis: { grid: true, tickCount: 3 } },
    });
    expect(layout.axes.y).toBeDefined();
    expect(layout.axes.y!.gridlines.length).toBeGreaterThan(0);
  });
});
