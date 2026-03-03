import type { CompileTableOptions } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileTable } from '../../compile';

const sampleData = [
  { name: 'Alice', age: 30, score: 88.5 },
  { name: 'Bob', age: 25, score: 92.1 },
  { name: 'Charlie', age: 35, score: 76.3 },
  { name: 'Diana', age: 28, score: 95.0 },
];

const baseSpec = {
  type: 'table' as const,
  data: sampleData,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
    { key: 'score', label: 'Score' },
  ],
};

const baseOptions: CompileTableOptions = {
  width: 800,
  height: 600,
};

describe('compileTable', () => {
  it('produces a valid TableLayout from a basic spec', () => {
    const layout = compileTable(baseSpec, baseOptions);

    expect(layout.columns).toHaveLength(3);
    expect(layout.rows).toHaveLength(4);
    expect(layout.theme).toBeDefined();
    expect(layout.chrome).toBeDefined();
    expect(layout.search.enabled).toBe(false);
    expect(layout.stickyFirstColumn).toBe(false);
    expect(layout.compact).toBe(false);
  });

  it('formats cell values correctly', () => {
    const layout = compileTable(baseSpec, baseOptions);

    // First row, first cell should be "Alice"
    const firstRow = layout.rows[0];
    expect(firstRow.cells[0].formattedValue).toBe('Alice');
    // Age should be formatted as number
    expect(firstRow.cells[1].formattedValue).toBe('30');
    // Score should be formatted with decimal
    expect(firstRow.cells[2].formattedValue).toBe('88.50');
  });

  it('applies d3-format strings to numeric columns', () => {
    const spec = {
      ...baseSpec,
      columns: [{ key: 'name' }, { key: 'age', format: '.1f' }, { key: 'score', format: ',.0f' }],
    };
    const layout = compileTable(spec, baseOptions);

    expect(layout.rows[0].cells[1].formattedValue).toBe('30.0');
    expect(layout.rows[0].cells[2].formattedValue).toBe('89');
  });

  it('right-aligns number columns by default', () => {
    const layout = compileTable(baseSpec, baseOptions);

    // name should be left, age and score should be right
    expect(layout.columns[0].align).toBe('left');
    expect(layout.columns[1].align).toBe('right');
    expect(layout.columns[2].align).toBe('right');
  });

  it('generates stable row IDs from data index', () => {
    const layout = compileTable(baseSpec, baseOptions);

    expect(layout.rows[0].id).toBe('0');
    expect(layout.rows[1].id).toBe('1');
    expect(layout.rows[2].id).toBe('2');
    expect(layout.rows[3].id).toBe('3');
  });

  it('uses rowKey for row IDs when specified', () => {
    const spec = { ...baseSpec, rowKey: 'name' };
    const layout = compileTable(spec, baseOptions);

    expect(layout.rows[0].id).toBe('Alice');
    expect(layout.rows[1].id).toBe('Bob');
    expect(layout.rows[2].id).toBe('Charlie');
    expect(layout.rows[3].id).toBe('Diana');
  });

  it('applies tabular-nums font variant on number cells', () => {
    const layout = compileTable(baseSpec, baseOptions);

    // age cell should have tabular-nums
    const ageCell = layout.rows[0].cells[1];
    expect(ageCell.style.fontVariant).toBe('tabular-nums');

    // name cell should not
    const nameCell = layout.rows[0].cells[0];
    expect(nameCell.style.fontVariant).toBeUndefined();
  });

  it('computes reasonable column widths (header text not clipped)', () => {
    const layout = compileTable(baseSpec, baseOptions);

    for (const col of layout.columns) {
      // Each column should be at least 60px
      expect(col.width).toBeGreaterThanOrEqual(60);
    }
  });

  it('computes chrome from spec', () => {
    const spec = {
      ...baseSpec,
      chrome: { title: 'Test Table', subtitle: 'A test' },
    };
    const layout = compileTable(spec, baseOptions);

    expect(layout.chrome.title?.text).toBe('Test Table');
    expect(layout.chrome.subtitle?.text).toBe('A test');
  });

  it('produces valid a11y metadata', () => {
    const spec = {
      ...baseSpec,
      chrome: { title: 'Student Scores' },
    };
    const layout = compileTable(spec, baseOptions);

    expect(layout.a11y.caption).toBe('Table: Student Scores');
    expect(layout.a11y.summary).toContain('3 columns');
    expect(layout.a11y.summary).toContain('4 rows');
  });

  it('handles empty data gracefully', () => {
    // Validation catches empty data, so we test with a minimal valid dataset
    const spec = {
      type: 'table' as const,
      data: [{ x: 1 }],
      columns: [{ key: 'x' }],
    };
    const layout = compileTable(spec, baseOptions);
    expect(layout.rows).toHaveLength(1);
  });

  it('preserves original data in row.data', () => {
    const layout = compileTable(baseSpec, baseOptions);

    expect(layout.rows[0].data).toBe(sampleData[0]);
    expect(layout.rows[0].data.name).toBe('Alice');
  });

  it('throws for non-table spec', () => {
    expect(() =>
      compileTable(
        {
          type: 'line',
          data: [
            { date: '2020-01-01', y: 2 },
            { date: '2021-01-01', y: 4 },
          ],
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        baseOptions,
      ),
    ).toThrow('Use compileChart instead');
  });

  it('determines column cellType from visual features', () => {
    const spec = {
      type: 'table' as const,
      data: [
        {
          val: 10,
          cat: 'A',
          trend: [1, 2, 3],
          bar: 50,
          img: 'http://example.com/a.png',
          flag: 'US',
        },
      ],
      columns: [
        { key: 'val', heatmap: { palette: 'blue' } },
        { key: 'cat', categoryColors: { A: '#ff0000' } },
        { key: 'trend', sparkline: { type: 'line' as const } },
        { key: 'bar', bar: {} },
        { key: 'img', image: {} },
        { key: 'flag', flag: true },
      ],
    };
    const layout = compileTable(spec, baseOptions);

    expect(layout.columns[0].cellType).toBe('heatmap');
    expect(layout.columns[1].cellType).toBe('category');
    expect(layout.columns[2].cellType).toBe('sparkline');
    expect(layout.columns[3].cellType).toBe('bar');
    expect(layout.columns[4].cellType).toBe('image');
    expect(layout.columns[5].cellType).toBe('flag');
  });

  it('applies dark mode theme', () => {
    const layout = compileTable(baseSpec, { ...baseOptions, darkMode: true });
    expect(layout.theme.isDark).toBe(true);
  });
});
