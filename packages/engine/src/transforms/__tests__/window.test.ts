import { describe, expect, it } from 'vitest';
import { runTransforms } from '../index';

describe('window transform', () => {
  it('lag(1) on 5 sorted rows: first row null, rest match previous', () => {
    const data = [
      { month: '2024-01', value: 10 },
      { month: '2024-02', value: 20 },
      { month: '2024-03', value: 30 },
      { month: '2024-04', value: 40 },
      { month: '2024-05', value: 50 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'lag', field: 'value', offset: 1, as: 'prev_value' }],
        sort: [{ field: 'month' }],
      },
    ]);
    expect(result.map((r) => r.prev_value)).toEqual([null, 10, 20, 30, 40]);
  });

  it('lag(12) on 24 monthly rows: rows 1-12 null, row 13 matches row 1', () => {
    const data = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(2023, i, 1);
      return { month: d.toISOString().slice(0, 7), value: (i + 1) * 100 };
    });
    const result = runTransforms(data, [
      {
        window: [{ op: 'lag', field: 'value', offset: 12, as: 'prev_year' }],
        sort: [{ field: 'month' }],
      },
    ]);
    // First 12 rows should be null
    for (let i = 0; i < 12; i++) {
      expect(result[i].prev_year).toBe(null);
    }
    // Row 13 (index 12) should match row 1's value (100)
    expect(result[12].prev_year).toBe(100);
    // Row 24 (index 23) should match row 12's value (1200)
    expect(result[23].prev_year).toBe(1200);
  });

  it('pct_change with offset 1 on [100, 110, 121, 133.1]', () => {
    const data = [
      { idx: 1, value: 100 },
      { idx: 2, value: 110 },
      { idx: 3, value: 121 },
      { idx: 4, value: 133.1 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'pct_change', field: 'value', offset: 1, as: 'pct' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result[0].pct).toBe(null);
    expect(result[1].pct).toBeCloseTo(0.1, 5);
    expect(result[2].pct).toBeCloseTo(0.1, 5);
    expect(result[3].pct).toBeCloseTo(0.1, 5);
  });

  it('pct_change with zero denominator returns null, not Infinity', () => {
    const data = [
      { idx: 1, value: 0 },
      { idx: 2, value: 50 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'pct_change', field: 'value', offset: 1, as: 'pct' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result[0].pct).toBe(null);
    expect(result[1].pct).toBe(null); // 0 denominator -> null
  });

  it('diff on [10, 15, 12, 20]', () => {
    const data = [
      { idx: 1, value: 10 },
      { idx: 2, value: 15 },
      { idx: 3, value: 12 },
      { idx: 4, value: 20 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'diff', field: 'value', offset: 1, as: 'delta' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result.map((r) => r.delta)).toEqual([null, 5, -3, 8]);
  });

  it('cumsum on [1, 2, 3, 4, 5]', () => {
    const data = [
      { idx: 1, value: 1 },
      { idx: 2, value: 2 },
      { idx: 3, value: 3 },
      { idx: 4, value: 4 },
      { idx: 5, value: 5 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'cumsum', field: 'value', as: 'running' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result.map((r) => r.running)).toEqual([1, 3, 6, 10, 15]);
  });

  it('cumsum with nulls [1, null, 3, null, 5] treats nulls as 0', () => {
    const data = [
      { idx: 1, value: 1 },
      { idx: 2, value: null },
      { idx: 3, value: 3 },
      { idx: 4, value: null },
      { idx: 5, value: 5 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'cumsum', field: 'value', as: 'running' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result.map((r) => r.running)).toEqual([1, 1, 4, 4, 9]);
  });

  it('rank on values [30, 10, 40, 20] sorted ascending gives ranks [1, 2, 3, 4]', () => {
    // Input is unsorted; window sorts by 'value' ascending
    const data = [
      { id: 'a', value: 30 },
      { id: 'b', value: 10 },
      { id: 'c', value: 40 },
      { id: 'd', value: 20 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'rank', field: 'value', as: 'rank' }],
        sort: [{ field: 'value', order: 'ascending' }],
      },
    ]);
    // Results should be in ORIGINAL input order, so:
    // a(30) -> rank 3, b(10) -> rank 1, c(40) -> rank 4, d(20) -> rank 2
    expect(result.map((r) => r.rank)).toEqual([3, 1, 4, 2]);
  });

  it('first_value on [100, 200, 300] all get 100', () => {
    const data = [
      { idx: 1, value: 100 },
      { idx: 2, value: 200 },
      { idx: 3, value: 300 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'first_value', field: 'value', as: 'first' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result.map((r) => r.first)).toEqual([100, 100, 100]);
  });

  it('groupby partitioning: 2 groups of 3 rows, lag(1) computed independently', () => {
    const data = [
      { group: 'A', idx: 1, value: 10 },
      { group: 'B', idx: 1, value: 100 },
      { group: 'A', idx: 2, value: 20 },
      { group: 'B', idx: 2, value: 200 },
      { group: 'A', idx: 3, value: 30 },
      { group: 'B', idx: 3, value: 300 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'lag', field: 'value', offset: 1, as: 'prev' }],
        sort: [{ field: 'idx' }],
        groupby: ['group'],
      },
    ]);
    // Results in original input order
    // A idx 1 -> null, B idx 1 -> null, A idx 2 -> 10, B idx 2 -> 100, A idx 3 -> 20, B idx 3 -> 200
    expect(result.map((r) => r.prev)).toEqual([null, null, 10, 100, 20, 200]);
  });

  it('sorts ISO dates correctly before computing lag', () => {
    // Input deliberately unsorted
    const data = [
      { date: '2024-03-15', value: 300 },
      { date: '2024-01-10', value: 100 },
      { date: '2024-02-20', value: 200 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'lag', field: 'value', offset: 1, as: 'prev' }],
        sort: [{ field: 'date' }],
      },
    ]);
    // Sorted order: Jan(100), Feb(200), Mar(300)
    // Jan -> null, Feb -> 100, Mar -> 200
    // Original order: Mar, Jan, Feb -> [200, null, 100]
    expect(result.map((r) => r.prev)).toEqual([200, null, 100]);
  });

  it('sorts numeric timestamp strings numerically, not lexicographically', () => {
    // Lexicographic: "9" > "10" but numeric: 9 < 10
    const data = [
      { ts: '10', value: 'b' },
      { ts: '9', value: 'a' },
      { ts: '100', value: 'c' },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'lag', field: 'value', offset: 1, as: 'prev' }],
        sort: [{ field: 'ts' }],
      },
    ]);
    // Numeric sort: 9, 10, 100 -> values: a, b, c
    // ts=10(b) -> lag is a, ts=9(a) -> lag is null, ts=100(c) -> lag is b
    expect(result.map((r) => r.prev)).toEqual(['a', null, 'b']);
  });

  it('lead(1) on 4 rows: last row null, rest match next', () => {
    const data = [
      { idx: 1, value: 10 },
      { idx: 2, value: 20 },
      { idx: 3, value: 30 },
      { idx: 4, value: 40 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'lead', field: 'value', offset: 1, as: 'next_value' }],
        sort: [{ field: 'idx' }],
      },
    ]);
    expect(result.map((r) => r.next_value)).toEqual([20, 30, 40, null]);
  });

  it('rank with tied values uses competition ranking', () => {
    const data = [
      { id: 'a', value: 10 },
      { id: 'b', value: 20 },
      { id: 'c', value: 10 },
      { id: 'd', value: 30 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'rank', field: 'value', as: 'rank' }],
        sort: [{ field: 'value', order: 'ascending' }],
      },
    ]);
    // Sorted: a(10), c(10), b(20), d(30). Tied values get same rank.
    // Original order: a(10)->1, b(20)->3, c(10)->1, d(30)->4
    expect(result.map((r) => r.rank)).toEqual([1, 3, 1, 4]);
  });

  it('returns [] for empty data', () => {
    const result = runTransforms(
      [],
      [
        {
          window: [{ op: 'lag', field: 'value', offset: 1, as: 'prev' }],
          sort: [{ field: 'value' }],
        },
      ],
    );
    expect(result).toEqual([]);
  });

  it('window chained with filter: window then filter on computed field', () => {
    const data = [
      { idx: 1, value: 100 },
      { idx: 2, value: 110 },
      { idx: 3, value: 90 },
      { idx: 4, value: 120 },
    ];
    const result = runTransforms(data, [
      {
        window: [{ op: 'diff', field: 'value', offset: 1, as: 'delta' }],
        sort: [{ field: 'idx' }],
      },
      {
        filter: { field: 'delta', gt: 0 },
      },
    ]);
    // Diffs: [null, 10, -20, 30] -> filter gt 0 -> [10, 30]
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.delta)).toEqual([10, 30]);
  });
});
