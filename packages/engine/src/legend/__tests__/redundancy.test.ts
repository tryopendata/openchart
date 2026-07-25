import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import type { NormalizedChartSpec } from '../../compiler/types';
import { computeLegendContent } from '../compute';

const theme = resolveTheme({});
const strategy = {
  axisLabelDensity: 'full' as const,
  labelMode: 'all' as const,
  legendPosition: 'top' as const,
  legendMaxHeight: 1,
  fontScale: 1,
};

function makeBarSpec(overrides: Partial<NormalizedChartSpec> = {}): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ],
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '', prefix: '' },
    hiddenSeries: [],
    seriesStyles: {},
    watermark: true,
    display: 'full',
    userExplicit: {
      chrome: false,
      legend: false,
      endpointLabels: false,
      xAxis: false,
      yAxis: false,
      labels: false,
      animation: false,
      watermark: false,
      crosshair: false,
    },
    ...overrides,
  };
}

describe('bar/column legend redundancy rule', () => {
  it('hides legend when color.field matches the category axis field', () => {
    const spec = makeBarSpec();
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries).toHaveLength(0);
  });

  it('shows legend when user explicitly sets legend config', () => {
    const spec = makeBarSpec({
      legend: { show: true },
      userExplicit: {
        chrome: false,
        legend: true,
        endpointLabels: false,
        xAxis: false,
        yAxis: false,
        labels: false,
        animation: false,
        watermark: false,
        crosshair: false,
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('shows legend when color.field differs from category axis field', () => {
    const spec = makeBarSpec({
      data: [
        { category: 'A', value: 10, series: 'X' },
        { category: 'B', value: 20, series: 'Y' },
      ],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('works for horizontal bars (y is category, x is quantitative)', () => {
    const spec = makeBarSpec({
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
        color: { field: 'category', type: 'nominal' },
      },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries).toHaveLength(0);
  });
});

describe('arc legend redundancy rule', () => {
  function makeArcSpec(overrides: Partial<NormalizedChartSpec> = {}): NormalizedChartSpec {
    return {
      ...makeBarSpec(),
      markType: 'arc',
      markDef: { type: 'arc' },
      encoding: {
        theta: { field: 'value', type: 'quantitative' },
        color: { field: 'category', type: 'nominal' },
      },
      ...overrides,
    };
  }

  it('hides the legend when slice labels name every category', () => {
    // The leader-line labels already identify each slice; a legend restates them.
    const content = computeLegendContent(makeArcSpec(), strategy, theme, 600, 400);
    expect(content.entries).toHaveLength(0);
  });

  it('keeps the legend when labels.density is none', () => {
    // No slice labels render, so the legend is the only thing naming the slices.
    const spec = makeArcSpec({ labels: { density: 'none', format: '', prefix: '' } });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('keeps the legend for density "endpoints", which labels only 2 slices', () => {
    // filterByDensity returns [first, last] for 'endpoints'. Hiding the legend
    // here would leave every middle slice with no identifier anywhere -- not a
    // label, not a legend row.
    const spec = makeArcSpec({ labels: { density: 'endpoints', format: '', prefix: '' } });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('ignores strategy.labelMode, which pie rendering never consults', () => {
    // charts/pie/index.ts passes only `spec.labels.density` to computePieLabels
    // -- no strategy. So on the compact breakpoint every slice label still
    // renders, and the legend must stay suppressed to match. Reading labelMode
    // here would put the legend and the renderer into disagreement.
    const compact = { ...strategy, labelMode: 'none' as const };
    const content = computeLegendContent(makeArcSpec(), compact, theme, 600, 400);
    expect(content.entries).toHaveLength(0);
  });

  it('keeps the legend when slice count is high enough to drop labels', () => {
    // Past ARC_LABEL_CROWDING_LIMIT the leader-line labels start losing
    // collisions and dropping silently, so the legend stays as the fallback.
    const many = Array.from({ length: 30 }, (_, i) => ({
      category: `Category${i}`,
      value: 100,
    }));
    const content = computeLegendContent(makeArcSpec({ data: many }), strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('keeps the legend when the user configured one explicitly', () => {
    const spec = makeArcSpec({
      userExplicit: { ...makeBarSpec().userExplicit, legend: true },
    });
    const content = computeLegendContent(spec, strategy, theme, 600, 400);
    expect(content.entries.length).toBeGreaterThan(0);
  });

  it('leaves waffle and parliament legends alone', () => {
    // Same part-to-whole family, but neither attaches per-mark labels, so the
    // legend is their only series identifier.
    for (const markType of ['waffle', 'parliament'] as const) {
      const spec = makeArcSpec({ markType, markDef: { type: markType } });
      const content = computeLegendContent(spec, strategy, theme, 600, 400);
      expect(content.entries.length).toBeGreaterThan(0);
    }
  });
});
