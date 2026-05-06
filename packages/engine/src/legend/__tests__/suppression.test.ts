/**
 * Truth-table tests for the centralized legend / endpoint / end-of-line label
 * suppression helper. Covers all 8 cells of the matrix described in
 * `suppression.ts`, plus the special cases (single-series, stacked area,
 * compact strategy).
 */

import { describe, expect, it } from 'vitest';

import type { NormalizedChartSpec } from '../../compiler/types';
import { countColorSeries, resolveSuppression } from '../suppression';

// ---------------------------------------------------------------------------
// Spec factory
// ---------------------------------------------------------------------------

function makeMultiSeriesLineSpec(
  overrides: Partial<NormalizedChartSpec> = {},
): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { date: '2020', value: 10, country: 'US' },
      { date: '2021', value: 20, country: 'US' },
      { date: '2020', value: 5, country: 'UK' },
      { date: '2021', value: 15, country: 'UK' },
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

const baseCtx = {
  seriesCount: 2,
  labelsHiddenByStrategy: false,
  labelsDensityNone: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('countColorSeries', () => {
  it('returns the number of distinct values in the color field', () => {
    const spec = makeMultiSeriesLineSpec();
    expect(countColorSeries(spec)).toBe(2);
  });

  it('returns 0 when no color encoding is set', () => {
    const spec = makeMultiSeriesLineSpec({
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
    });
    expect(countColorSeries(spec)).toBe(0);
  });

  it('returns 0 when color is quantitative', () => {
    const spec = makeMultiSeriesLineSpec({
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'value', type: 'quantitative' },
      },
    });
    expect(countColorSeries(spec)).toBe(0);
  });
});

describe('resolveSuppression - 8-cell truth table', () => {
  // Cell 1: legend unset, endpointLabels unset
  //   -> traditional legend hidden, endpoint column shown, end-of-line hidden
  it('cell 1 (unset, unset): hides legend, shows endpoint column', () => {
    const spec = makeMultiSeriesLineSpec();
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(false);
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  // Cell 2: legend: { show: true }, endpointLabels unset
  //   -> traditional legend shown, endpoint column shown, end-of-line hidden
  it('cell 2 (legend: true, unset): shows both legend and endpoint column', () => {
    const spec = makeMultiSeriesLineSpec({ legend: { show: true } });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(true);
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  // Cell 3: legend unset, endpointLabels: false
  //   -> traditional legend shown (auto-revoked), column hidden, end-of-line hidden
  it('cell 3 (unset, endpointLabels: false): auto-revokes legend, hides column', () => {
    const spec = makeMultiSeriesLineSpec({ endpointLabels: false });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(true);
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  // Cell 4: legend: { show: false }, endpointLabels: false
  //   -> all legend surfaces off, end-of-line labels are last resort
  it('cell 4 (legend: false, endpointLabels: false): only end-of-line labels show', () => {
    const spec = makeMultiSeriesLineSpec({
      legend: { show: false },
      endpointLabels: false,
    });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(false);
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(true);
  });

  // Cell 5: legend: { show: true }, endpointLabels: false
  //   -> legend shown, column hidden, end-of-line hidden
  it('cell 5 (legend: true, endpointLabels: false): legend only', () => {
    const spec = makeMultiSeriesLineSpec({
      legend: { show: true },
      endpointLabels: false,
    });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(true);
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  // Cell 6: legend: { show: false }, endpointLabels: true
  //   -> legend off, column on, end-of-line hidden
  it('cell 6 (legend: false, endpointLabels: true): column only', () => {
    const spec = makeMultiSeriesLineSpec({
      legend: { show: false },
      endpointLabels: true,
    });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(false);
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  // Cell 7: legend: { show: true }, endpointLabels: true
  //   -> both surfaces shown, end-of-line hidden
  it('cell 7 (legend: true, endpointLabels: true): both shown', () => {
    const spec = makeMultiSeriesLineSpec({
      legend: { show: true },
      endpointLabels: true,
    });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(true);
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  // Cell 8 (the implicit eighth cell): unset + endpointLabels: true
  //   matches cell 1's column-on behavior, legend auto-suppressed.
  it('cell 8 (unset, endpointLabels: true): legend auto-suppressed, column on', () => {
    const spec = makeMultiSeriesLineSpec({ endpointLabels: true });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(false);
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
  });
});

describe('resolveSuppression - special cases', () => {
  it('single-series chart: column always off, legend follows its own rules', () => {
    const spec = makeMultiSeriesLineSpec();
    const result = resolveSuppression(spec, { ...baseCtx, seriesCount: 1 });
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(false);
    expect(result.showTraditionalLegend).toBe(true);
  });

  it('non-line/area mark: column always off', () => {
    const spec = makeMultiSeriesLineSpec({ markType: 'bar' });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  it('compact strategy (labelsHiddenByStrategy): column off, end-of-line off', () => {
    const spec = makeMultiSeriesLineSpec();
    const result = resolveSuppression(spec, {
      ...baseCtx,
      labelsHiddenByStrategy: true,
    });
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  it('labels.density === none: scoped to end-of-line labels only (column + legend follow truth table)', () => {
    // labels.density: 'none' is the legacy switch for end-of-line labels.
    // It must NOT suppress the endpoint column or the traditional legend —
    // those follow the truth table independently. End-of-line labels stay off.
    const spec = makeMultiSeriesLineSpec();
    const result = resolveSuppression(spec, { ...baseCtx, labelsDensityNone: true });
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
    // Cell 1 (legend unset, endpointLabels unset): traditional legend hidden.
    expect(result.showTraditionalLegend).toBe(false);
  });

  it('labels.density === none + legend.show: true: legend stays shown', () => {
    const spec = makeMultiSeriesLineSpec({ legend: { show: true } });
    const result = resolveSuppression(spec, { ...baseCtx, labelsDensityNone: true });
    expect(result.showTraditionalLegend).toBe(true);
    expect(result.showEndpointLabels).toBe(true);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  it('stacked area: legend shown by default, column off', () => {
    const spec = makeMultiSeriesLineSpec({
      markType: 'area',
      markDef: { type: 'area' },
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', stack: 'zero' },
        color: { field: 'country', type: 'nominal' },
      },
    });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showTraditionalLegend).toBe(true);
    expect(result.showEndpointLabels).toBe(false);
    expect(result.showEndOfLineLabels).toBe(false);
  });

  it('stacked area with explicit endpointLabels: true: column shown', () => {
    const spec = makeMultiSeriesLineSpec({
      markType: 'area',
      markDef: { type: 'area' },
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', stack: 'zero' },
        color: { field: 'country', type: 'nominal' },
      },
      endpointLabels: true,
    });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showEndpointLabels).toBe(true);
  });

  it('overlap area (no stack): runs through 8-cell table', () => {
    const spec = makeMultiSeriesLineSpec({
      markType: 'area',
      markDef: { type: 'area' },
    });
    const result = resolveSuppression(spec, baseCtx);
    // Cell 1 behavior: legend hidden, column on
    expect(result.showTraditionalLegend).toBe(false);
    expect(result.showEndpointLabels).toBe(true);
  });

  it('endpointLabels: { show: false } counts as explicit off', () => {
    const spec = makeMultiSeriesLineSpec({ endpointLabels: { show: false } });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showEndpointLabels).toBe(false);
    // Auto-revoke legend
    expect(result.showTraditionalLegend).toBe(true);
  });

  it('endpointLabels: { width: 120 } counts as explicit on', () => {
    const spec = makeMultiSeriesLineSpec({ endpointLabels: { width: 120 } });
    const result = resolveSuppression(spec, baseCtx);
    expect(result.showEndpointLabels).toBe(true);
    // Legend auto-suppressed
    expect(result.showTraditionalLegend).toBe(false);
  });
});
