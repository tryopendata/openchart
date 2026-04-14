/**
 * Integration snapshot test: the backstop for Step 7 refactor.
 *
 * Compiles three representative ChartSpecs that exercise the extracted paths
 * (legend-heavy, clipped-domain, watermark + gradient) and snapshots the full
 * ChartLayout. Pre-refactor snapshots are captured before helper extraction;
 * post-refactor snapshots must match exactly without --update-snapshots.
 *
 * Non-serializable fields (Map, Function) are normalized into plain structures
 * so the snapshot can round-trip through the default serializer.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

/**
 * Normalize a tick value for snapshot comparison. Date objects are converted
 * to their UTC ISO date string (YYYY-MM-DD) so the snapshot doesn't encode
 * the local timezone offset, which differs between macOS (CDT/PDT) and the
 * Linux CI runner (UTC).
 */
function normalizeTickValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

/**
 * Normalize a tick position to 2 decimal places. D3 time-scale positions are
 * floating-point and shift slightly with timezone because the tick Date values
 * differ by hours. Rounding eliminates that noise without losing signal.
 */
function normalizePosition(pos: unknown): unknown {
  if (typeof pos === 'number') return Math.round(pos * 100) / 100;
  return pos;
}

/** Normalize an axis tick array for platform-independent snapshot comparison. */
function normalizeTicks(
  ticks: Array<{ label?: string; value?: unknown; position?: unknown }>,
): unknown[] {
  return ticks.map((t) => ({
    ...t,
    value: normalizeTickValue(t.value),
    position: normalizePosition(t.position),
  }));
}

/** Normalize an axis object so tick values and positions are platform-stable. */
function normalizeAxis(axis: Record<string, unknown> | undefined): unknown {
  if (!axis) return axis;
  const ticks = axis.ticks;
  return {
    ...axis,
    ticks: Array.isArray(ticks)
      ? normalizeTicks(ticks as Parameters<typeof normalizeTicks>[0])
      : ticks,
  };
}

/** Convert ChartLayout into a fully serializable shape for snapshot comparison. */
function serializeLayout(layout: ChartLayout): Record<string, unknown> {
  const { tooltipDescriptors, measureText: _measure, ...rest } = layout;
  const axes = rest.axes as
    | { x?: Record<string, unknown>; y?: Record<string, unknown> }
    | undefined;
  return {
    ...rest,
    axes: axes ? { ...axes, x: normalizeAxis(axes.x), y: normalizeAxis(axes.y) } : axes,
    tooltipDescriptors: Array.from(tooltipDescriptors.entries()),
  };
}

describe('compileChart snapshot (Step 7 oracle)', () => {
  it('legend-heavy multi-series line chart', () => {
    const spec = {
      mark: 'line' as const,
      data: [
        { date: '2020-01-01', value: 10, country: 'US' },
        { date: '2021-01-01', value: 40, country: 'US' },
        { date: '2020-01-01', value: 15, country: 'UK' },
        { date: '2021-01-01', value: 35, country: 'UK' },
        { date: '2020-01-01', value: 8, country: 'FR' },
        { date: '2021-01-01', value: 22, country: 'FR' },
        { date: '2020-01-01', value: 12, country: 'DE' },
        { date: '2021-01-01', value: 28, country: 'DE' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' as const },
        y: { field: 'value', type: 'quantitative' as const },
        color: { field: 'country', type: 'nominal' as const },
      },
      chrome: {
        title: 'GDP Growth',
        subtitle: 'Four-country comparison',
        source: 'World Bank',
      },
      legend: { show: true },
      watermark: false,
    };

    const layout = compileChart(spec, { width: 800, height: 500 });
    expect(serializeLayout(layout)).toMatchSnapshot();
  });

  it('clipped-domain bar chart (data outside scale.domain filtered)', () => {
    const spec = {
      mark: 'bar' as const,
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 25 },
        { name: 'C', value: 40 },
        { name: 'D', value: 75 },
        { name: 'E', value: 90 },
      ],
      encoding: {
        x: {
          field: 'value',
          type: 'quantitative' as const,
          scale: { domain: [0, 50], clip: true },
        },
        y: { field: 'name', type: 'nominal' as const },
      },
      chrome: {
        title: 'Clipped Values',
      },
      watermark: false,
    };

    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(serializeLayout(layout)).toMatchSnapshot();
  });

  it('watermarked column chart with gradient fill', () => {
    const spec = {
      mark: {
        type: 'bar' as const,
        fill: {
          type: 'linear' as const,
          stops: [
            { offset: 0, color: '#ff0000' },
            { offset: 1, color: '#0000ff' },
          ],
        },
      },
      data: [
        { category: 'A', score: 30 },
        { category: 'B', score: 55 },
        { category: 'C', score: 70 },
        { category: 'D', score: 45 },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' as const },
        y: { field: 'score', type: 'quantitative' as const },
      },
      chrome: {
        title: 'Gradient Columns',
        source: 'Test data',
        byline: 'By the engine',
      },
      watermark: true,
    };

    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(serializeLayout(layout)).toMatchSnapshot();
  });
});
