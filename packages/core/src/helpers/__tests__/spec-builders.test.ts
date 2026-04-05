import { describe, expect, it } from 'vitest';
import type { EncodingChannel } from '../../types/spec';
import {
  barChart,
  columnChart,
  dataTable,
  inferFieldType,
  lineChart,
  pieChart,
  scatterChart,
} from '../spec-builders';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const timeSeriesData = [
  { date: '2020-01-01', value: 10, country: 'US' },
  { date: '2021-01-01', value: 40, country: 'US' },
  { date: '2020-01-01', value: 15, country: 'UK' },
  { date: '2021-01-01', value: 35, country: 'UK' },
];

const categoricalData = [
  { name: 'Apples', count: 50, price: 1.2 },
  { name: 'Bananas', count: 30, price: 0.8 },
  { name: 'Oranges', count: 45, price: 1.5 },
];

const numericData = [
  { x: 1, y: 2, size: 10, group: 'A' },
  { x: 3, y: 4, size: 20, group: 'B' },
  { x: 5, y: 1, size: 15, group: 'A' },
];

const mixedData = [
  { id: 1, name: 'Alice', score: 95, joined: '2020-03-15' },
  { id: 2, name: 'Bob', score: 87, joined: '2021-07-22' },
  { id: 3, name: 'Carol', score: 92, joined: '2019-11-01' },
];

// ---------------------------------------------------------------------------
// inferFieldType
// ---------------------------------------------------------------------------

describe('inferFieldType', () => {
  it('infers quantitative for number fields', () => {
    expect(inferFieldType(categoricalData, 'count')).toBe('quantitative');
    expect(inferFieldType(categoricalData, 'price')).toBe('quantitative');
  });

  it('infers temporal for ISO date strings', () => {
    expect(inferFieldType(timeSeriesData, 'date')).toBe('temporal');
  });

  it('infers temporal for partial ISO dates (YYYY-MM format)', () => {
    const data = [{ period: '2020-01' }, { period: '2020-02' }];
    expect(inferFieldType(data, 'period')).toBe('temporal');
  });

  it('infers temporal for year-only strings (YYYY format)', () => {
    const data = [{ year: '2020' }, { year: '2021' }];
    expect(inferFieldType(data, 'year')).toBe('temporal');
  });

  it('infers nominal for plain string fields', () => {
    expect(inferFieldType(categoricalData, 'name')).toBe('nominal');
    expect(inferFieldType(timeSeriesData, 'country')).toBe('nominal');
  });

  it('infers nominal for mixed types', () => {
    const data = [{ value: 10 }, { value: 'text' }];
    expect(inferFieldType(data, 'value')).toBe('nominal');
  });

  it('handles null/undefined values gracefully', () => {
    const data = [{ value: null }, { value: undefined }, { value: 42 }];
    expect(inferFieldType(data, 'value')).toBe('quantitative');
  });

  it('handles Date objects as temporal', () => {
    const data = [{ date: new Date('2020-01-01') }, { date: new Date('2021-01-01') }];
    expect(inferFieldType(data, 'date')).toBe('temporal');
  });

  it('samples at most 20 values', () => {
    // Create 100 items, all numbers. Should still work without issue.
    const data = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    expect(inferFieldType(data, 'v')).toBe('quantitative');
  });

  it('returns nominal for empty data', () => {
    expect(inferFieldType([], 'anything')).toBe('nominal');
  });
});

// ---------------------------------------------------------------------------
// lineChart
// ---------------------------------------------------------------------------

describe('lineChart', () => {
  it('creates a line chart spec with string field names', () => {
    const spec = lineChart(timeSeriesData, 'date', 'value');

    expect(spec.mark).toBe('line');
    expect(spec.data).toBe(timeSeriesData);
    expect(spec.encoding.x).toEqual({ field: 'date', type: 'temporal' });
    expect(spec.encoding.y).toEqual({ field: 'value', type: 'quantitative' });
  });

  it('accepts full EncodingChannel objects', () => {
    const xChannel: EncodingChannel = {
      field: 'date',
      type: 'temporal',
      axis: { title: 'Year' },
    };
    const yChannel: EncodingChannel = {
      field: 'value',
      type: 'quantitative',
      scale: { zero: true },
    };

    const spec = lineChart(timeSeriesData, xChannel, yChannel);

    expect(spec.encoding.x).toEqual(xChannel);
    expect(spec.encoding.y).toEqual(yChannel);
  });

  it('includes color encoding from options', () => {
    const spec = lineChart(timeSeriesData, 'date', 'value', {
      color: 'country',
    });

    expect(spec.encoding.color).toEqual({ field: 'country', type: 'nominal' });
  });

  it('passes through chrome and annotations', () => {
    const spec = lineChart(timeSeriesData, 'date', 'value', {
      chrome: { title: 'GDP Growth' },
      annotations: [{ type: 'refline', y: 0, label: 'Zero' }],
    });

    expect(spec.chrome).toEqual({ title: 'GDP Growth' });
    expect(spec.annotations).toHaveLength(1);
  });

  it('passes through theme and darkMode', () => {
    const spec = lineChart(timeSeriesData, 'date', 'value', {
      theme: { borderRadius: 8 },
      darkMode: 'auto',
    });

    expect(spec.theme).toEqual({ borderRadius: 8 });
    expect(spec.darkMode).toBe('auto');
  });
});

// ---------------------------------------------------------------------------
// barChart
// ---------------------------------------------------------------------------

describe('barChart', () => {
  it('maps category to y-axis and value to x-axis', () => {
    const spec = barChart(categoricalData, 'name', 'count');

    expect(spec.mark).toBe('bar');
    // Bar chart convention: category on y, value on x
    expect(spec.encoding.y).toEqual({ field: 'name', type: 'nominal' });
    expect(spec.encoding.x).toEqual({ field: 'count', type: 'quantitative' });
  });

  it('accepts full channel objects', () => {
    const catChannel: EncodingChannel = {
      field: 'name',
      type: 'ordinal',
      axis: { title: 'Fruit' },
    };

    const spec = barChart(categoricalData, catChannel, 'count');

    expect(spec.encoding.y).toEqual(catChannel);
  });
});

// ---------------------------------------------------------------------------
// columnChart
// ---------------------------------------------------------------------------

describe('columnChart', () => {
  it('creates a column chart spec with x and y', () => {
    const spec = columnChart(categoricalData, 'name', 'count');

    // columnChart now produces mark: 'bar' (vertical orientation inferred from encoding)
    expect(typeof spec.mark).toBe('object');
    expect((spec.mark as Record<string, unknown>).type).toBe('bar');
    expect(spec.encoding.x).toEqual({ field: 'name', type: 'nominal' });
    expect(spec.encoding.y).toEqual({ field: 'count', type: 'quantitative' });
  });
});

// ---------------------------------------------------------------------------
// pieChart
// ---------------------------------------------------------------------------

describe('pieChart', () => {
  it('maps category to color channel and value to y', () => {
    const spec = pieChart(categoricalData, 'name', 'count');

    expect(spec.mark).toBe('arc');
    // Arc (pie) convention: value on y, category on color, no x
    expect(spec.encoding.y).toEqual({ field: 'count', type: 'quantitative' });
    expect(spec.encoding.color).toEqual({ field: 'name', type: 'nominal' });
    expect(spec.encoding.x).toBeUndefined();
  });

  it('includes size encoding when specified', () => {
    const spec = pieChart(numericData, 'group', 'y', { size: 'size' });

    expect(spec.encoding.size).toEqual({ field: 'size', type: 'quantitative' });
  });
});

// ---------------------------------------------------------------------------
// scatterChart
// ---------------------------------------------------------------------------

describe('scatterChart', () => {
  it('creates a scatter chart with both axes quantitative', () => {
    const spec = scatterChart(numericData, 'x', 'y');

    expect(spec.mark).toBe('point');
    expect(spec.encoding.x).toEqual({ field: 'x', type: 'quantitative' });
    expect(spec.encoding.y).toEqual({ field: 'y', type: 'quantitative' });
  });

  it('supports color and size encoding', () => {
    const spec = scatterChart(numericData, 'x', 'y', {
      color: 'group',
      size: 'size',
    });

    expect(spec.encoding.color).toEqual({ field: 'group', type: 'nominal' });
    expect(spec.encoding.size).toEqual({ field: 'size', type: 'quantitative' });
  });
});

// ---------------------------------------------------------------------------
// dataTable
// ---------------------------------------------------------------------------

describe('dataTable', () => {
  it('auto-generates columns from data keys', () => {
    const spec = dataTable(categoricalData);

    expect(spec.type).toBe('table');
    expect(spec.data).toBe(categoricalData);
    expect(spec.columns).toHaveLength(3);
    expect(spec.columns[0]).toEqual({ key: 'name', label: 'name', align: 'left' });
    expect(spec.columns[1]).toEqual({ key: 'count', label: 'count', align: 'right' });
    expect(spec.columns[2]).toEqual({ key: 'price', label: 'price', align: 'right' });
  });

  it('uses provided columns instead of auto-generating', () => {
    const columns = [
      { key: 'name', label: 'Fruit Name' },
      { key: 'count', label: 'Quantity', format: ',.0f' },
    ];
    const spec = dataTable(categoricalData, { columns });

    expect(spec.columns).toBe(columns);
    expect(spec.columns).toHaveLength(2);
  });

  it('right-aligns numeric columns in auto-generated config', () => {
    const spec = dataTable(mixedData);

    const idCol = spec.columns.find((c) => c.key === 'id');
    const scoreCol = spec.columns.find((c) => c.key === 'score');
    const nameCol = spec.columns.find((c) => c.key === 'name');

    expect(idCol?.align).toBe('right');
    expect(scoreCol?.align).toBe('right');
    expect(nameCol?.align).toBe('left');
  });

  it('passes through all table options', () => {
    const spec = dataTable(categoricalData, {
      rowKey: 'name',
      chrome: { title: 'Fruit Data' },
      search: true,
      pagination: { pageSize: 10 },
      stickyFirstColumn: true,
      compact: true,
      darkMode: 'auto',
    });

    expect(spec.rowKey).toBe('name');
    expect(spec.chrome).toEqual({ title: 'Fruit Data' });
    expect(spec.search).toBe(true);
    expect(spec.pagination).toEqual({ pageSize: 10 });
    expect(spec.stickyFirstColumn).toBe(true);
    expect(spec.compact).toBe(true);
    expect(spec.darkMode).toBe('auto');
  });

  it('returns empty columns for empty data', () => {
    const spec = dataTable([]);

    expect(spec.columns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mixed field ref (string vs object) across builders
// ---------------------------------------------------------------------------

describe('mixed FieldRef usage', () => {
  it('allows mixing string and object field refs', () => {
    const yChannel: EncodingChannel = {
      field: 'value',
      type: 'quantitative',
      aggregate: 'mean',
      axis: { title: 'Average Value', format: ',.1f' },
    };

    const spec = lineChart(timeSeriesData, 'date', yChannel, {
      color: { field: 'country', type: 'nominal' },
    });

    // x was a string, so type was inferred
    expect(spec.encoding.x?.type).toBe('temporal');
    // y was a full object, so it's passed through
    expect(spec.encoding.y?.aggregate).toBe('mean');
    expect(spec.encoding.y?.axis?.title).toBe('Average Value');
    // color was a full object
    expect(spec.encoding.color?.type).toBe('nominal');
  });
});
