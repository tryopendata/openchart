import type { ChartSpec, DesignDiagnostic } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

const source: ChartSpec = {
  mark: 'line',
  data: [
    { year: '2019', brand: 'Samsung', share: 0.216 },
    { year: '2024', brand: 'Samsung', share: 0.19 },
    { year: '2019', brand: 'Huawei', share: 0.176 },
    { year: '2024', brand: 'Huawei', share: 0.043 },
    { year: '2019', brand: 'Apple', share: 0.139 },
    { year: '2024', brand: 'Apple', share: 0.187 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'share', type: 'quantitative', axis: false, scale: { zero: false } },
    color: { field: 'brand', type: 'nominal' },
  },
  endpointLabels: { ends: 'both', content: 'label value', format: '.0%' },
  legend: { show: false },
};

describe('endpoint minimum usable plot budget', () => {
  it('identifies impossible explicitly preserved both-end columns at their authored path', () => {
    const diagnostics: DesignDiagnostic[] = [];
    const layout = compileChart(source, {
      width: 220,
      height: 360,
      onDiagnostic: (item) => diagnostics.push(item),
    });
    expect(layout.endpointLabels?.entries.length).toBeGreaterThan(0);
    expect(layout.legend?.entries ?? []).toHaveLength(0);
    expect(
      diagnostics.some((item) => item.path === '/endpointLabels' && item.message.includes('plot')),
    ).toBe(true);
  });

  it('considers axis reservations before keeping automatic endpoint columns', () => {
    const input: ChartSpec = {
      ...source,
      endpointLabels: undefined,
      legend: undefined,
      encoding: {
        ...source.encoding,
        y: {
          field: 'share',
          type: 'quantitative',
          axis: { title: 'Rate', tickPosition: 'gutter' },
        },
      },
      theme: { fonts: { sizes: { axisTick: 20, body: 13 } } },
    };
    const layout = compileChart(input, {
      width: 680,
      height: 500,
      measureText: (text, size) => ({ width: size === 20 ? 500 : text.length * 7, height: size }),
    });
    expect(layout.area.width).toBeGreaterThanOrEqual(60);
    expect(layout.endpointLabels?.entries ?? []).toHaveLength(0);
    expect(layout.legend?.entries.length).toBeGreaterThan(0);
  });
});

it('reserves a requested keyed summary before constrained endpoint fallback placement', () => {
  const layout = compileChart(
    {
      ...source,
      endpointLabels: undefined,
      responsive: { labelSummary: true },
      encoding: {
        ...source.encoding,
        y: {
          field: 'share',
          type: 'quantitative',
          axis: { title: 'Rate', tickPosition: 'gutter' },
        },
      },
      theme: { fonts: { sizes: { axisTick: 20 } } },
    },
    {
      width: 680,
      height: 500,
      measureText: (text, size) => ({ width: size === 20 ? 500 : text.length * 7, height: size }),
    },
  );
  expect(layout.endpointLabels?.entries ?? []).toHaveLength(0);
  expect(layout.chrome.seriesSummary).toHaveLength(3);
  expect(layout.chrome.noteBandHeight).toBeGreaterThan(0);
  expect(layout.area.width).toBeGreaterThanOrEqual(60);
});

it('preserves explicit endpoint columns even past the early width-fraction threshold', async () => {
  const { normalizeSpec } = await import('../../compiler/normalize');
  const { resolveTheme } = await import('@opendata-ai/openchart-core');
  const { endpointLabelsDemotedAt } = await import('../../layout/plan');
  const normalized = normalizeSpec(source) as import('../../compiler/types').NormalizedChartSpec;
  expect(endpointLabelsDemotedAt(normalized, resolveTheme(), 220)).toBe(false);
  const layout = compileChart(
    { ...source, theme: { spacing: { endpointColumnGap: 24 } } },
    { width: 680, height: 360 },
  );
  const endpoints = layout.endpointLabels!;
  expect(endpoints.bounds.x - layout.area.x - layout.area.width).toBe(24);
  expect(layout.area.x - endpoints.leadingBounds!.x - endpoints.leadingBounds!.width).toBeCloseTo(
    24,
  );
});

it('reports explicit columns when inline tick reservations exhaust the quantitative plot', () => {
  const diagnostics: DesignDiagnostic[] = [];
  compileChart(
    {
      ...source,
      encoding: {
        ...source.encoding,
        y: { field: 'share', type: 'quantitative', axis: { tickPosition: 'inline' } },
      },
      theme: { fonts: { sizes: { axisTick: 20 } } },
    },
    {
      width: 680,
      height: 500,
      measureText: (text, size) => ({ width: size === 20 ? 500 : text.length * 7, height: size }),
      onDiagnostic: (item) => diagnostics.push(item),
    },
  );
  expect(diagnostics.some((item) => item.path === '/endpointLabels')).toBe(true);
});
