/**
 * Faceted layout invariants: multi-series faceted charts reserve no figure-level
 * right endpoint-label margin and emit no false-positive series-identification
 * warnings when each panel labels its own series.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { seriesIdentificationWarnings } from '../../compiler/a11y-warnings';
import { normalizeSpec } from '../../compiler/normalize';

const DATA = [
  { year: '2020', source: 'Gas', share: 41.3 },
  { year: '2023', source: 'Gas', share: 43.5 },
  { year: '2020', source: 'Coal', share: 19.6 },
  { year: '2023', source: 'Coal', share: 16.2 },
  { year: '2020', source: 'Nuclear', share: 20.1 },
  { year: '2023', source: 'Nuclear', share: 18.6 },
  { year: '2020', source: 'Wind', share: 8.6 },
  { year: '2023', source: 'Wind', share: 10.1 },
];

function facetedLineSpec(extra?: Partial<ChartSpec>): ChartSpec {
  return {
    mark: 'line',
    data: DATA,
    encoding: {
      x: { field: 'year', type: 'temporal' },
      y: { field: 'share', type: 'quantitative', scale: { domain: [0, 50] } },
      color: { field: 'source', type: 'nominal' },
      facet: { field: 'source', type: 'nominal', columns: 2, sort: null },
    },
    legend: { show: false },
    ...extra,
  };
}

describe('faceted layout right margin and a11y warnings', () => {
  it('reserves no phantom right endpoint-label margin on multi-series faceted charts', () => {
    const implicit = compileChart(facetedLineSpec(), { width: 800, height: 480 });
    const explicitOff = compileChart(facetedLineSpec({ endpointLabels: false }), {
      width: 800,
      height: 480,
    });

    const implicitRightMargin = implicit.dimensions.width - (implicit.area.x + implicit.area.width);
    const explicitRightMargin =
      explicitOff.dimensions.width - (explicitOff.area.x + explicitOff.area.width);

    expect(Math.abs(implicitRightMargin - explicitRightMargin)).toBeLessThanOrEqual(1);
    expect(implicitRightMargin).toBeLessThan(40);
  });

  it('emits no seriesIdentificationWarnings when encoding.facet labels every panel', () => {
    const normalized = normalizeSpec(facetedLineSpec({ endpointLabels: false }));
    expect(seriesIdentificationWarnings(normalized)).toEqual([]);

    const warnings: string[] = [];
    compileChart(facetedLineSpec({ endpointLabels: false }), {
      width: 800,
      height: 480,
      onWarn: (message) => warnings.push(message),
    });
    expect(warnings.filter((w) => w.includes('Both legend and endpointLabels'))).toEqual([]);
  });

  it('emits no seriesIdentificationWarnings when row or column facets split by the series field', () => {
    const rowSpec: ChartSpec = {
      mark: 'line',
      data: DATA,
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal' },
        row: { field: 'source', type: 'nominal' },
      },
      legend: { show: false },
      endpointLabels: false,
    };
    const warnings: string[] = [];
    compileChart(rowSpec, {
      width: 800,
      height: 480,
      onWarn: (message) => warnings.push(message),
    });
    expect(warnings.filter((w) => w.includes('Both legend and endpointLabels'))).toEqual([]);
  });

  it('still warns when facet splits by a different field than color', () => {
    const multiSeriesPerPanel: ChartSpec = {
      mark: 'line',
      data: DATA.map((row, index) => ({ ...row, region: index % 2 === 0 ? 'East' : 'West' })),
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal' },
        facet: { field: 'region', type: 'nominal', columns: 2 },
      },
      legend: { show: false },
      endpointLabels: false,
    };
    expect(seriesIdentificationWarnings(normalizeSpec(multiSeriesPerPanel))).toHaveLength(1);
  });

  it('still warns on non-faceted multi-series line charts with both legend and endpointLabels disabled', () => {
    const spec: ChartSpec = {
      mark: 'line',
      data: DATA,
      encoding: {
        x: { field: 'year', type: 'temporal' },
        y: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal' },
      },
      legend: { show: false },
      endpointLabels: false,
    };
    const normalized = normalizeSpec(spec);
    expect(seriesIdentificationWarnings(normalized)).toHaveLength(1);
  });
});
