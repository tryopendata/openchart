import type { DataRow } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { runJoinAggregate } from '../joinaggregate';

const data: DataRow[] = [
  { g: 'a', n: 1 },
  { g: 'a', n: 3 },
  { g: 'b', n: 10 },
];

describe('runJoinAggregate', () => {
  it('keeps every input row', () => {
    const out = runJoinAggregate(data, {
      joinaggregate: [{ op: 'sum', field: 'n', as: 'total' }],
      groupby: ['g'],
    });
    expect(out).toHaveLength(3);
  });

  it('writes each group total onto that group rows', () => {
    const out = runJoinAggregate(data, {
      joinaggregate: [{ op: 'sum', field: 'n', as: 'total' }],
      groupby: ['g'],
    });
    expect(out.map((r) => r.total)).toEqual([4, 4, 10]);
  });

  it('computes over the whole dataset with no groupby', () => {
    const out = runJoinAggregate(data, {
      joinaggregate: [{ op: 'sum', field: 'n', as: 'total' }],
    });
    expect(out.every((r) => r.total === 14)).toBe(true);
  });

  it('supports multiple ops in one transform', () => {
    const out = runJoinAggregate(data, {
      joinaggregate: [
        { op: 'max', field: 'n', as: 'hi' },
        { op: 'count', field: 'n', as: 'n_rows' },
      ],
      groupby: ['g'],
    });
    expect(out[0]).toMatchObject({ hi: 3, n_rows: 2 });
    expect(out[2]).toMatchObject({ hi: 10, n_rows: 1 });
  });

  it('does not mutate the input rows', () => {
    const input: DataRow[] = [{ g: 'a', n: 1 }];
    runJoinAggregate(input, {
      joinaggregate: [{ op: 'sum', field: 'n', as: 't' }],
      groupby: ['g'],
    });
    expect(input[0]).toEqual({ g: 'a', n: 1 });
  });
});
