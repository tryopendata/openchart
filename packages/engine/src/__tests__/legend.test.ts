import type { LayoutStrategy, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeLegend } from '../legend/compute';

const specWithColor: NormalizedChartSpec = {
  markType: 'line',
  markDef: { type: 'line' },
  data: [
    { date: '2020', value: 10, country: 'US' },
    { date: '2021', value: 20, country: 'UK' },
    { date: '2022', value: 30, country: 'Germany' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {},
  annotations: [],
  responsive: true,
  theme: {},
  darkMode: 'off',
  labels: { density: 'none', format: '', prefix: '' },
};

const specWithoutColor: NormalizedChartSpec = {
  ...specWithColor,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

const chartArea: Rect = { x: 50, y: 50, width: 500, height: 300 };
const theme: ResolvedTheme = resolveTheme();

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
  chromeMode: 'full',
  legendMaxHeight: -1,
};

const compactStrategy: LayoutStrategy = {
  labelMode: 'none',
  legendPosition: 'top',
  annotationPosition: 'tooltip-only',
  axisLabelDensity: 'minimal',
  chromeMode: 'full',
  legendMaxHeight: -1,
};

describe('computeLegend', () => {
  it('derives entries from color encoding unique values', () => {
    const legend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(3);
    expect(legend.entries.map((e) => e.label)).toEqual(['US', 'UK', 'Germany']);
  });

  it('assigns distinct colors from the theme palette', () => {
    const legend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    const colors = legend.entries.map((e) => e.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(3);
  });

  it('returns empty entries when no color encoding', () => {
    const legend = computeLegend(specWithoutColor, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(0);
    expect(legend.bounds.width).toBe(0);
    expect(legend.bounds.height).toBe(0);
  });

  it('positions legend on right at full width', () => {
    const legend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    expect(legend.position).toBe('right');
    expect(legend.bounds.width).toBeGreaterThan(0);
  });

  it('positions legend on top at compact width', () => {
    const legend = computeLegend(specWithColor, compactStrategy, theme, chartArea);
    expect(legend.position).toBe('top');
    expect(legend.bounds.height).toBeGreaterThan(0);
  });

  it('returns empty entries when show is false', () => {
    const specHidden: NormalizedChartSpec = {
      ...specWithColor,
      legend: { show: false },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(specHidden, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(0);
    expect(legend.bounds.width).toBe(0);
    expect(legend.bounds.height).toBe(0);
  });

  it('still shows legend when show is true', () => {
    const specShown: NormalizedChartSpec = {
      ...specWithColor,
      legend: { show: true },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(specShown, fullStrategy, theme, chartArea);
    expect(legend.entries).toHaveLength(3);
  });

  it('with columns: 3 and 6 series, shows all 6 entries across 2 rows', () => {
    const sixSeriesSpec: NormalizedChartSpec = {
      ...specWithColor,
      data: [
        { date: '2020', value: 10, country: 'A' },
        { date: '2020', value: 10, country: 'B' },
        { date: '2020', value: 10, country: 'C' },
        { date: '2020', value: 10, country: 'D' },
        { date: '2020', value: 10, country: 'E' },
        { date: '2020', value: 10, country: 'F' },
      ],
      legend: { columns: 3 },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(sixSeriesSpec, compactStrategy, theme, chartArea);
    // All 6 entries visible (no overflow indicator)
    expect(legend.entries).toHaveLength(6);
    expect(legend.entries.every((e) => !e.overflow)).toBe(true);
  });

  it('with symbolLimit: 3 and 6 series, truncates to 3 entries + overflow', () => {
    const sixSeriesSpec: NormalizedChartSpec = {
      ...specWithColor,
      data: [
        { date: '2020', value: 10, country: 'A' },
        { date: '2020', value: 10, country: 'B' },
        { date: '2020', value: 10, country: 'C' },
        { date: '2020', value: 10, country: 'D' },
        { date: '2020', value: 10, country: 'E' },
        { date: '2020', value: 10, country: 'F' },
      ],
      legend: { symbolLimit: 3 },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(sixSeriesSpec, compactStrategy, theme, chartArea);
    // 3 real entries + 1 overflow indicator
    expect(legend.entries).toHaveLength(4);
    expect(legend.entries[3].label).toBe('+3 more');
    expect(legend.entries[3].overflow).toBe(true);
  });

  it('with symbolLimit on right-positioned legend, truncates entries', () => {
    const sixSeriesSpec: NormalizedChartSpec = {
      ...specWithColor,
      data: [
        { date: '2020', value: 10, country: 'A' },
        { date: '2020', value: 10, country: 'B' },
        { date: '2020', value: 10, country: 'C' },
        { date: '2020', value: 10, country: 'D' },
        { date: '2020', value: 10, country: 'E' },
        { date: '2020', value: 10, country: 'F' },
      ],
      legend: { symbolLimit: 2 },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(sixSeriesSpec, fullStrategy, theme, chartArea);
    // 2 real entries + 1 overflow indicator
    expect(legend.entries).toHaveLength(3);
    expect(legend.entries[2].label).toBe('+4 more');
    expect(legend.entries[2].overflow).toBe(true);
  });

  it('symbolLimit: 0 is clamped to 1 (minimum 1 entry)', () => {
    const sixSeriesSpec: NormalizedChartSpec = {
      ...specWithColor,
      data: [
        { date: '2020', value: 10, country: 'A' },
        { date: '2020', value: 10, country: 'B' },
        { date: '2020', value: 10, country: 'C' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
    };
    const compactStrategy: LayoutStrategy = {
      legend: { symbolLimit: 0 },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(sixSeriesSpec, compactStrategy, theme, chartArea);
    // symbolLimit: 0 gets clamped to 1, so 1 real entry + overflow
    expect(legend.entries.length).toBeGreaterThanOrEqual(1);
    expect(legend.entries.filter((e) => !e.overflow).length).toBeGreaterThanOrEqual(1);
  });

  it('symbolLimit greater than entry count shows all entries', () => {
    const largeLimit: LayoutStrategy = {
      legend: { symbolLimit: 100 },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const legend = computeLegend(specWithColor, largeLimit, theme, chartArea);
    // All 3 entries shown, no overflow
    expect(legend.entries).toHaveLength(3);
    expect(legend.entries.every((e) => !e.overflow)).toBe(true);
  });

  it('with maxRows: 3 and 8 long-named entries, shows more entries than default maxRows of 2', () => {
    // Use long series names so entries overflow 2 rows but fit in 3
    const longNameData = [
      { date: '2020', value: 10, country: 'Home price to income ratio' },
      { date: '2020', value: 10, country: 'Tuition to income ratio' },
      { date: '2020', value: 10, country: 'Health premium to income' },
      { date: '2020', value: 10, country: 'Childcare cost to income' },
      { date: '2020', value: 10, country: 'Transportation expenses' },
      { date: '2020', value: 10, country: 'Food and groceries cost' },
      { date: '2020', value: 10, country: 'Utilities and services' },
      { date: '2020', value: 10, country: 'Insurance and benefits' },
    ];
    const maxRowsSpec: NormalizedChartSpec = {
      ...specWithColor,
      data: longNameData,
      legend: { maxRows: 3 },
      hiddenSeries: [],
      seriesStyles: {},
    };
    const defaultSpec: NormalizedChartSpec = {
      ...specWithColor,
      data: longNameData,
    };
    const legendDefault = computeLegend(defaultSpec, compactStrategy, theme, chartArea);
    const legendMaxRows = computeLegend(maxRowsSpec, compactStrategy, theme, chartArea);
    const defaultVisible = legendDefault.entries.filter((e) => !e.overflow).length;
    const maxRowsVisible = legendMaxRows.entries.filter((e) => !e.overflow).length;
    expect(maxRowsVisible).toBeGreaterThan(defaultVisible);
  });

  it('uses explicit domain+range colors in legend entries', () => {
    const specExplicit: NormalizedChartSpec = {
      ...specWithColor,
      data: [
        { date: '2020', value: 10, country: 'UK' },
        { date: '2021', value: 20, country: 'US' },
        { date: '2022', value: 30, country: 'Germany' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: {
          field: 'country',
          type: 'nominal',
          scale: {
            domain: ['US', 'UK', 'Germany'],
            range: ['#ff0000', '#0000ff', '#00ff00'],
          },
        },
      },
    };
    const legend = computeLegend(specExplicit, compactStrategy, theme, chartArea);
    // Data order is UK, US, Germany but domain order is US, UK, Germany
    // Legend should match colors to domain indices, not data order
    const ukEntry = legend.entries.find((e) => e.label === 'UK')!;
    const usEntry = legend.entries.find((e) => e.label === 'US')!;
    const deEntry = legend.entries.find((e) => e.label === 'Germany')!;
    expect(usEntry.color).toBe('#ff0000');
    expect(ukEntry.color).toBe('#0000ff');
    expect(deEntry.color).toBe('#00ff00');
  });

  it('orders legend entries by explicit domain, not data order', () => {
    const specExplicit: NormalizedChartSpec = {
      ...specWithColor,
      data: [
        { date: '2020', value: 10, country: 'Germany' },
        { date: '2021', value: 20, country: 'UK' },
        { date: '2022', value: 30, country: 'US' },
      ],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: {
          field: 'country',
          type: 'nominal',
          scale: {
            domain: ['US', 'UK', 'Germany'],
          },
        },
      },
    };
    const legend = computeLegend(specExplicit, compactStrategy, theme, chartArea);
    expect(legend.entries.map((e) => e.label)).toEqual(['US', 'UK', 'Germany']);
  });

  it('uses correct swatch shape for chart type', () => {
    const lineLegend = computeLegend(specWithColor, fullStrategy, theme, chartArea);
    expect(lineLegend.entries[0].shape).toBe('line');

    const barSpec: NormalizedChartSpec = {
      ...specWithColor,
      markType: 'bar',
      markDef: { type: 'bar' },
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'date', type: 'nominal' },
        color: { field: 'country', type: 'nominal' },
      },
    };
    const barLegend = computeLegend(barSpec, fullStrategy, theme, chartArea);
    expect(barLegend.entries[0].shape).toBe('square');

    const scatterSpec: NormalizedChartSpec = {
      ...specWithColor,
      markType: 'point',
      markDef: { type: 'point' },
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'country', type: 'nominal' },
      },
    };
    const scatterLegend = computeLegend(scatterSpec, fullStrategy, theme, chartArea);
    expect(scatterLegend.entries[0].shape).toBe('circle');
  });

  describe('auto-suppression for line/area with endpoint labels', () => {
    /** Line spec with labels enabled for suppression tests. */
    const lineWithLabels: NormalizedChartSpec = {
      ...specWithColor,
      labels: { density: 'auto', format: '', prefix: '' },
    };

    it('suppresses legend for multi-series line chart with default labels', () => {
      const legend = computeLegend(lineWithLabels, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(0);
    });

    it('preserves legend when legend.show is explicitly true', () => {
      const spec: NormalizedChartSpec = {
        ...lineWithLabels,
        legend: { show: true },
        hiddenSeries: [],
        seriesStyles: {},
      };
      const legend = computeLegend(spec, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(3);
    });

    it('preserves legend when any legend config is present (e.g. position)', () => {
      const spec: NormalizedChartSpec = {
        ...lineWithLabels,
        legend: { position: 'top' },
        hiddenSeries: [],
        seriesStyles: {},
      };
      const legend = computeLegend(spec, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(3);
    });

    it('preserves legend when labels density is none', () => {
      const spec: NormalizedChartSpec = {
        ...lineWithLabels,
        labels: { density: 'none', format: '', prefix: '' },
      };
      const legend = computeLegend(spec, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(3);
    });

    it('preserves legend at compact breakpoint where labelMode is none', () => {
      const legend = computeLegend(lineWithLabels, compactStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(3);
    });

    it('preserves legend for stacked area chart (default stacking)', () => {
      const areaSpec: NormalizedChartSpec = {
        ...lineWithLabels,
        markType: 'area',
        markDef: { type: 'area' },
      };
      const legend = computeLegend(areaSpec, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(3);
    });

    it('suppresses legend for unstacked area chart with labels', () => {
      const areaSpec: NormalizedChartSpec = {
        ...lineWithLabels,
        markType: 'area',
        markDef: { type: 'area' },
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative', stack: null },
          color: { field: 'country', type: 'nominal' },
        },
      };
      const legend = computeLegend(areaSpec, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(0);
    });

    it('preserves legend for bar chart (not line/area)', () => {
      const barSpec: NormalizedChartSpec = {
        ...lineWithLabels,
        markType: 'bar',
        markDef: { type: 'bar' },
        encoding: {
          x: { field: 'date', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'country', type: 'nominal' },
        },
      };
      const legend = computeLegend(barSpec, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(3);
    });

    it('does not suppress for single-series line (no color encoding)', () => {
      const noColorWithLabels: NormalizedChartSpec = {
        ...specWithoutColor,
        labels: { density: 'auto', format: '', prefix: '' },
      };
      const legend = computeLegend(noColorWithLabels, fullStrategy, theme, chartArea);
      expect(legend.entries).toHaveLength(0);
      expect(legend.bounds.width).toBe(0);
    });
  });

  describe('top legend spacing', () => {
    const topLegendSpec = {
      mark: 'bar' as const,
      data: [
        { name: 'A', value: 10, group: 'X' },
        { name: 'A', value: 20, group: 'Y' },
        { name: 'B', value: 30, group: 'X' },
        { name: 'B', value: 25, group: 'Y' },
      ],
      encoding: {
        x: { field: 'name', type: 'nominal' as const },
        y: { field: 'value', type: 'quantitative' as const },
        color: { field: 'group', type: 'nominal' as const },
      },
      legend: { position: 'top' as const },
    };

    it('places the legend exactly 8px above the chart area at standard width', () => {
      const layout = compileChart(topLegendSpec, { width: 600, height: 400 });

      expect(layout.legend.position).toBe('top');
      expect(layout.legend.entries.length).toBeGreaterThan(0);
      expect(layout.legend.bounds.height).toBeGreaterThan(0);

      const legendBottom = layout.legend.bounds.y + layout.legend.bounds.height;
      const gap = layout.area.y - legendBottom;
      expect(gap).toBe(8);
    });

    it('eliminates legend gap on narrow viewports (< 420px)', () => {
      const layout = compileChart(topLegendSpec, { width: 360, height: 400 });

      expect(layout.legend.position).toBe('top');
      expect(layout.legend.entries.length).toBeGreaterThan(0);

      const legendBottom = layout.legend.bounds.y + layout.legend.bounds.height;
      const gap = layout.area.y - legendBottom;
      expect(gap).toBe(0);
    });
  });
});
