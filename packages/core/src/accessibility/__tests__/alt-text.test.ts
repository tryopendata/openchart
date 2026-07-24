import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../../types/spec';
import { generateAltText, generateDataTable, MAX_SR_TABLE_ROWS } from '../alt-text';

const lineSpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 20, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 25, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: { title: 'GDP Growth Rate' },
};

const barSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 },
    { category: 'C', value: 30 },
  ],
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

describe('generateAltText', () => {
  it('includes chart type', () => {
    const alt = generateAltText(lineSpec, lineSpec.data);
    expect(alt).toContain('Line chart');
  });

  it('includes title when present', () => {
    const alt = generateAltText(lineSpec, lineSpec.data);
    expect(alt).toContain('GDP Growth Rate');
  });

  it('includes temporal range', () => {
    const alt = generateAltText(lineSpec, lineSpec.data);
    expect(alt).toContain('from 2020 to 2021');
  });

  it('includes series count and names', () => {
    const alt = generateAltText(lineSpec, lineSpec.data);
    expect(alt).toContain('2 series');
    expect(alt).toContain('US');
    expect(alt).toContain('UK');
  });

  it('includes data point count', () => {
    const alt = generateAltText(lineSpec, lineSpec.data);
    expect(alt).toContain('4 data points');
  });

  it('handles categorical x-axis', () => {
    const alt = generateAltText(barSpec, barSpec.data);
    expect(alt).toContain('Bar chart');
    expect(alt).toContain('3 categories');
  });

  it('handles missing chrome gracefully', () => {
    const alt = generateAltText(barSpec, barSpec.data);
    expect(alt).toBeTruthy();
    expect(alt).not.toContain('showing undefined');
  });
});

describe('generateDataTable', () => {
  it('includes headers as first row', () => {
    const table = generateDataTable(lineSpec, lineSpec.data);
    expect(table[0]).toEqual(['date', 'value', 'country']);
  });

  it('includes data rows', () => {
    const table = generateDataTable(lineSpec, lineSpec.data);
    expect(table).toHaveLength(5); // 1 header + 4 data rows
    expect(table[1]).toEqual(['2020-01-01', 10, 'US']);
  });

  it('only includes encoded fields', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [{ category: 'A', value: 10, extra: 'ignored' }],
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const table = generateDataTable(spec, spec.data);
    expect(table[0]).toEqual(['category', 'value']);
    expect(table[1]).toEqual(['A', 10]);
  });

  it('returns empty for spec with no encoding fields', () => {
    const spec: ChartSpec = {
      mark: 'arc',
      data: [{ value: 10 }],
      encoding: {},
    };
    const table = generateDataTable(spec, spec.data);
    expect(table).toEqual([]);
  });
});

describe('generateDataTable row cap', () => {
  const scatterSpec = (rowCount: number): ChartSpec => ({
    mark: 'point',
    data: Array.from({ length: rowCount }, (_, i) => ({ x: i, y: i * 2 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
  });

  it('pins the cap at 1000', () => {
    expect(MAX_SR_TABLE_ROWS).toBe(1000);
  });

  it('caps 1001 input rows at 1000 data rows', () => {
    const spec = scatterSpec(1001);
    const table = generateDataTable(spec, spec.data);
    expect(table).toHaveLength(1001); // 1 header + 1000 data rows
    expect(table.length - 1).toBe(1000);
    expect(table[1000]).toEqual([999, 1998]);
  });

  it('keeps every row at exactly 1000 (boundary, not off by one)', () => {
    const spec = scatterSpec(1000);
    const table = generateDataTable(spec, spec.data);
    expect(table.length - 1).toBe(1000);
    expect(table[1000]).toEqual([999, 1998]);
  });

  it('leaves a small table untouched', () => {
    const spec = scatterSpec(3);
    const table = generateDataTable(spec, spec.data);
    expect(table).toEqual([
      ['x', 'y'],
      [0, 0],
      [1, 2],
      [2, 4],
    ]);
  });

  it('truncates a 50k-row scatter down to the cap', () => {
    const spec = scatterSpec(50_000);
    const table = generateDataTable(spec, spec.data);
    expect(table.length - 1).toBe(1000);
  });
});
