/**
 * Design-refresh table surface: density, alignment, delta chips, shared
 * sparkline domains, the totals footer, default sort, and `format: 'compact'`.
 */

import type { CompileTableOptions } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileTable } from '../../compile';

const options: CompileTableOptions = { width: 800, height: 600, onWarn: () => {} };

const rows = [
  { name: 'Alice', zip: 94110, revenue: 1200, change: 2.4, trend: [1, 2, 3] },
  { name: 'Bob', zip: 10001, revenue: 800, change: -1.2, trend: [10, 40, 20] },
  { name: 'Cara', zip: 60601, revenue: 400, change: 0, trend: [5, 5, 5] },
];

const base = {
  type: 'table' as const,
  data: rows,
  columns: [{ key: 'name' }, { key: 'zip' }, { key: 'revenue' }],
};

describe('column type and alignment', () => {
  it('right-aligns quantitative columns and left-aligns the rest', () => {
    const layout = compileTable(base, options);
    expect(layout.columns[0].type).toBe('nominal');
    expect(layout.columns[0].align).toBe('left');
    expect(layout.columns[2].type).toBe('quantitative');
    expect(layout.columns[2].align).toBe('right');
  });

  it('treats id/zip/year-style keys as nominal even though they are numbers', () => {
    const layout = compileTable(base, options);
    expect(layout.columns[1].type).toBe('nominal');
    expect(layout.columns[1].align).toBe('left');
  });

  it('treats camelCase id/zip/year-style keys as nominal too', () => {
    const layout = compileTable(
      {
        type: 'table' as const,
        data: [
          { stateId: 6, zipCode: 94110, postalCode: 10001, fiscalYear: 2024, revenue: 1200 },
          { stateId: 36, zipCode: 10001, postalCode: 60601, fiscalYear: 2025, revenue: 800 },
        ],
        columns: [
          { key: 'stateId' },
          { key: 'zipCode' },
          { key: 'postalCode' },
          { key: 'fiscalYear' },
          { key: 'revenue' },
        ],
        totalRow: true,
      },
      options,
    );
    expect(layout.columns.slice(0, 4).map((c) => c.type)).toEqual([
      'nominal',
      'nominal',
      'nominal',
      'nominal',
    ]);
    expect(layout.columns[4].type).toBe('quantitative');
    // Only the real measure gets summed into the totals footer.
    expect(layout.totalRow?.cells.map((c) => c.formattedValue)).toEqual(['', '', '', '', '2,000']);
  });

  it('honors an explicit type', () => {
    const layout = compileTable(
      { ...base, columns: [{ key: 'name' }, { key: 'zip' }, { key: 'revenue', type: 'nominal' }] },
      options,
    );
    expect(layout.columns[2].align).toBe('left');
  });

  it('still lets explicit align win over the inferred type', () => {
    const layout = compileTable(
      { ...base, columns: [{ key: 'name', align: 'right' }, { key: 'zip' }, { key: 'revenue' }] },
      options,
    );
    expect(layout.columns[0].align).toBe('right');
  });

  it('defaults priority to 1 on the first column and 2 elsewhere', () => {
    const layout = compileTable(base, options);
    expect(layout.columns.map((c) => c.priority)).toEqual([1, 2, 2]);
  });
});

describe('delta columns', () => {
  const spec = {
    ...base,
    columns: [{ key: 'name' }, { key: 'change', delta: true, format: '+.1f' }],
  };

  it('carries sign, direction and tone, and drops the sign from the label', () => {
    const layout = compileTable(spec, options);
    const cells = layout.rows.map((r) => r.cells[1]);

    expect(cells[0]).toMatchObject({
      cellType: 'delta',
      delta: 2.4,
      direction: 'up',
      tone: 'positive',
      formattedValue: '2.4',
    });
    expect(cells[1]).toMatchObject({ direction: 'down', tone: 'negative', formattedValue: '1.2' });
    expect(cells[2]).toMatchObject({ direction: 'flat', tone: 'neutral' });
  });

  it('flips valence under invert while keeping the direction', () => {
    const layout = compileTable(
      { ...base, columns: [{ key: 'name' }, { key: 'change', delta: { invert: true } }] },
      options,
    );
    expect(layout.rows[0].cells[1]).toMatchObject({ direction: 'up', tone: 'negative' });
    expect(layout.rows[1].cells[1]).toMatchObject({ direction: 'down', tone: 'positive' });
  });
});

describe('sparkline domain', () => {
  const columns = [{ key: 'name' }, { key: 'trend', sparkline: { type: 'line' as const } }];

  it('shares one extent across rows by default', () => {
    const layout = compileTable({ ...base, columns }, options);
    const first = layout.rows[0].cells[1];
    const second = layout.rows[1].cells[1];
    if (first.cellType !== 'sparkline' || second.cellType !== 'sparkline') throw new Error('type');

    // Shared domain is [1, 40]: row 1 tops out low, row 2 reaches the ceiling.
    expect(first.sparklineData!.points.at(-1)!.y).toBeCloseTo((3 - 1) / 39, 5);
    expect(second.sparklineData!.points[1].y).toBeCloseTo(1, 5);
  });

  it('normalizes per row under domain: "row"', () => {
    const layout = compileTable(
      {
        ...base,
        columns: [{ key: 'name' }, { key: 'trend', sparkline: { type: 'line', domain: 'row' } }],
      },
      options,
    );
    const first = layout.rows[0].cells[1];
    if (first.cellType !== 'sparkline') throw new Error('type');
    expect(first.sparklineData!.points.at(-1)!.y).toBeCloseTo(1, 5);
  });

  it('accepts an explicit extent', () => {
    const layout = compileTable(
      {
        ...base,
        columns: [{ key: 'name' }, { key: 'trend', sparkline: { type: 'line', domain: [0, 10] } }],
      },
      options,
    );
    const first = layout.rows[0].cells[1];
    if (first.cellType !== 'sparkline') throw new Error('type');
    expect(first.sparklineData!.points[0].y).toBeCloseTo(0.1, 5);
  });
});

describe('total row', () => {
  it('sums quantitative columns over the filtered rows, not the page', () => {
    const layout = compileTable({ ...base, totalRow: true, pagination: { pageSize: 2 } }, options);
    expect(layout.rows).toHaveLength(2);
    expect(layout.totalRow?.label).toBe('Total');
    expect(layout.totalRow?.cells[2].formattedValue).toBe('2,400');
  });

  it('sums the search result set only', () => {
    const layout = compileTable(
      { ...base, totalRow: true, search: true },
      {
        ...options,
        search: 'Alice',
      },
    );
    expect(layout.totalRow?.cells[2].formattedValue).toBe('1,200');
  });

  it('leaves non-quantitative columns blank and takes a custom label', () => {
    const layout = compileTable({ ...base, totalRow: { label: 'All regions' } }, options);
    expect(layout.totalRow?.label).toBe('All regions');
    expect(layout.totalRow?.cells[0].formattedValue).toBe('');
    expect(layout.totalRow?.cells[1].formattedValue).toBe('');
  });

  it('is absent when not requested', () => {
    expect(compileTable(base, options).totalRow).toBeUndefined();
  });

  it('leaves a column blank when total: false, but still sums its siblings', () => {
    const layout = compileTable(
      {
        ...base,
        columns: [{ key: 'name' }, { key: 'zip' }, { key: 'revenue', total: false }],
        totalRow: true,
      },
      options,
    );
    expect(layout.totalRow?.cells[2].formattedValue).toBe('');
  });

  it('sums a quantitative column by default when total is omitted', () => {
    const layout = compileTable({ ...base, totalRow: true }, options);
    expect(layout.totalRow?.cells[2].formattedValue).toBe('2,400');
  });
});

describe('default sort', () => {
  it('sorts by the first inline-bar column, descending', () => {
    const layout = compileTable(
      { ...base, columns: [{ key: 'name' }, { key: 'revenue', bar: {} }] },
      options,
    );
    expect(layout.sort).toEqual({ column: 'revenue', direction: 'desc' });
    expect(layout.rows.map((r) => r.cells[0].formattedValue)).toEqual(['Alice', 'Bob', 'Cara']);
  });

  it('prefers spec.sort over the bar-column default', () => {
    const layout = compileTable(
      {
        ...base,
        sort: { column: 'name', direction: 'desc' },
        columns: [{ key: 'name' }, { key: 'revenue', bar: {} }],
      },
      options,
    );
    expect(layout.sort).toEqual({ column: 'name', direction: 'desc' });
  });

  it('prefers caller state over both', () => {
    const layout = compileTable(
      { ...base, sort: { column: 'name', direction: 'desc' } },
      { ...options, sort: { column: 'revenue', direction: 'asc' } },
    );
    expect(layout.sort).toEqual({ column: 'revenue', direction: 'asc' });
  });

  it('applies no sort when the caller passes null (user cleared it)', () => {
    const layout = compileTable(
      { ...base, columns: [{ key: 'name' }, { key: 'revenue', bar: {} }] },
      { ...options, sort: null },
    );
    expect(layout.sort).toBeUndefined();
    expect(layout.rows.map((r) => r.cells[0].formattedValue)).toEqual(['Alice', 'Bob', 'Cara']);
  });

  it('leaves data order alone with no bar column and no spec sort', () => {
    expect(compileTable(base, options).sort).toBeUndefined();
  });
});

describe('density', () => {
  it('defaults to regular', () => {
    const layout = compileTable(base, options);
    expect(layout.density).toBe('regular');
    expect(layout.striped).toBe(false);
  });

  it('maps the deprecated compact flag to condensed with a warning', () => {
    const warnings: string[] = [];
    const layout = compileTable(
      { ...base, compact: true },
      { ...options, onWarn: (m) => warnings.push(m) },
    );
    expect(layout.density).toBe('condensed');
    expect(layout.compact).toBe(true);
    expect(warnings.join('\n')).toContain('density: "condensed"');
  });

  it('lets density win over compact without warning', () => {
    const warnings: string[] = [];
    const layout = compileTable(
      { ...base, compact: true, density: 'relaxed' },
      { ...options, onWarn: (m) => warnings.push(m) },
    );
    expect(layout.density).toBe('relaxed');
    expect(warnings).toHaveLength(0);
  });
});

describe("format: 'compact'", () => {
  it('abbreviates on a table column that opts in', () => {
    const layout = compileTable(
      {
        ...base,
        data: [{ name: 'Alice', zip: 1, revenue: 1234567 }],
        columns: [{ key: 'name' }, { key: 'revenue', format: 'compact' }],
      },
      options,
    );
    expect(layout.rows[0].cells[1].formattedValue).toBe('1.2M');
  });

  it('leaves sub-thousand values at full precision', () => {
    const layout = compileTable(
      {
        ...base,
        data: [{ name: 'Alice', zip: 1, revenue: 940 }],
        columns: [{ key: 'name' }, { key: 'revenue', format: 'compact' }],
      },
      options,
    );
    expect(layout.rows[0].cells[1].formattedValue).toBe('940');
  });
});

describe('column width', () => {
  const wideOptions: CompileTableOptions = { width: 1000, height: 600, onWarn: () => {} };

  it('resolves an explicit px width exactly, without flex-scaling it', () => {
    const layout = compileTable(
      {
        ...base,
        columns: [{ key: 'name', width: '200px' }, { key: 'zip' }, { key: 'revenue' }],
      },
      wideOptions,
    );
    expect(layout.columns[0].width).toBe(200);
  });

  it('resolves a percent width as a fraction of the container width', () => {
    const layout = compileTable(
      {
        ...base,
        columns: [{ key: 'name', width: '25%' }, { key: 'zip' }, { key: 'revenue' }],
      },
      wideOptions,
    );
    expect(layout.columns[0].width).toBe(250);
  });

  it('rounds a fractional percent width to whole pixels', () => {
    const layout = compileTable(
      {
        ...base,
        columns: [{ key: 'name', width: '33.3%' }, { key: 'zip' }, { key: 'revenue' }],
      },
      wideOptions,
    );
    expect(layout.columns[0].width).toBe(333);
  });

  it('scales overflowing explicit widths down proportionally and warns', () => {
    const warnings: string[] = [];
    const layout = compileTable(
      {
        ...base,
        columns: [
          { key: 'name', width: '500px' },
          { key: 'zip', width: '500px' },
          { key: 'revenue', width: '500px' },
        ],
      },
      { ...wideOptions, onWarn: (m) => warnings.push(m) },
    );
    const widths = layout.columns.map((c) => c.width);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(widths.every((w) => w >= 333 && w <= 334)).toBe(true);
    expect(warnings.some((w) => w.includes('TABLE_WIDTH_OVERFLOW'))).toBe(true);
  });

  it('warns that the table still overflows when scaling hits the minimum width', () => {
    const warnings: string[] = [];
    const layout = compileTable(
      {
        type: 'table' as const,
        data: [Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`c${i}`, i]))],
        columns: Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, width: '200px' })),
      },
      { width: 400, height: 600, onWarn: (m) => warnings.push(m) },
    );
    expect(layout.columns.every((c) => c.width === 60)).toBe(true);
    const warning = warnings.find((w) => w.includes('TABLE_WIDTH_OVERFLOW'));
    expect(warning).toContain('at least one column hit the 60px minimum');
    expect(warning).toContain('still overflow');
  });
});
