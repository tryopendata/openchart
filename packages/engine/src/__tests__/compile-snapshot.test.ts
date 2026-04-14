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

type AxisTick = { label?: string; value?: unknown; position?: unknown };
type AxisShape = Record<string, unknown> & { ticks?: AxisTick[] };

/**
 * Whether an axis carries temporal (Date) ticks. D3 time scales produce
 * midnight-local Date objects, so tick positions and values shift by hours
 * between macOS (CDT/PDT) and Linux CI (UTC). We strip temporal axes from
 * the main snapshot and assert their labels separately.
 */
function isTemporalAxis(axis: AxisShape | undefined): boolean {
  return Array.isArray(axis?.ticks) && axis.ticks.some((t) => t.value instanceof Date);
}

/** Convert ChartLayout into a fully serializable shape for snapshot comparison. */
function serializeLayout(
  layout: ChartLayout,
  { stripTemporalAxes = false } = {},
): Record<string, unknown> {
  const { tooltipDescriptors, measureText: _measure, ...rest } = layout;
  const axes = rest.axes as { x?: AxisShape; y?: AxisShape } | undefined;

  let serializedAxes = axes;
  if (axes && stripTemporalAxes) {
    serializedAxes = {
      ...axes,
      x: isTemporalAxis(axes.x) ? undefined : axes.x,
      y: isTemporalAxis(axes.y) ? undefined : axes.y,
    };
  }

  return {
    ...rest,
    axes: serializedAxes,
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

    // Temporal x-axis positions shift with timezone (macOS CDT vs Linux UTC),
    // so we strip it from the structural snapshot and assert just the labels.
    expect(serializeLayout(layout, { stripTemporalAxes: true })).toMatchSnapshot();

    const xAxes = (layout.axes as { x?: AxisShape } | undefined)?.x;
    const tickLabels = (xAxes?.ticks ?? []).map((t: AxisTick) => t.label);
    expect(tickLabels.length).toBeGreaterThanOrEqual(3);
    expect(tickLabels.length).toBeLessThanOrEqual(6);
    expect(tickLabels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
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
