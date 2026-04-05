import { describe, expect, it } from 'vitest';
import { runFold } from '../fold';

describe('runFold', () => {
  const data = [
    { country: 'US', gold: 10, silver: 20, bronze: 30 },
    { country: 'UK', gold: 5, silver: 15, bronze: 25 },
  ];

  it('folds two columns with default key/value names', () => {
    const result = runFold(data, {
      fold: ['gold', 'silver'],
    });

    expect(result).toHaveLength(4); // 2 rows x 2 fold fields
    expect(result[0]).toEqual({ country: 'US', bronze: 30, key: 'gold', value: 10 });
    expect(result[1]).toEqual({ country: 'US', bronze: 30, key: 'silver', value: 20 });
    expect(result[2]).toEqual({ country: 'UK', bronze: 25, key: 'gold', value: 5 });
    expect(result[3]).toEqual({ country: 'UK', bronze: 25, key: 'silver', value: 15 });
  });

  it('folds three columns', () => {
    const result = runFold(data, {
      fold: ['gold', 'silver', 'bronze'],
    });

    expect(result).toHaveLength(6); // 2 rows x 3 fold fields
    // First row's fold outputs
    expect(result[0].key).toBe('gold');
    expect(result[0].value).toBe(10);
    expect(result[1].key).toBe('silver');
    expect(result[1].value).toBe(20);
    expect(result[2].key).toBe('bronze');
    expect(result[2].value).toBe(30);
  });

  it('uses custom as names', () => {
    const result = runFold(data, {
      fold: ['gold', 'silver'],
      as: ['medal', 'count'],
    });

    expect(result[0].medal).toBe('gold');
    expect(result[0].count).toBe(10);
    expect(result[1].medal).toBe('silver');
    expect(result[1].count).toBe(20);
    // Default key/value shouldn't be present
    expect(result[0].key).toBeUndefined();
    expect(result[0].value).toBeUndefined();
  });

  it('preserves non-fold fields', () => {
    const result = runFold(data, {
      fold: ['gold'],
    });

    // country and bronze are non-fold fields
    expect(result[0].country).toBe('US');
    expect(result[0].bronze).toBe(30);
    // gold should not be a direct field (it's now key/value)
    expect(result[0].gold).toBeUndefined();
  });

  it('handles undefined fold field values', () => {
    const sparse = [{ name: 'test', a: 1 }]; // no 'b' field
    const result = runFold(sparse, {
      fold: ['a', 'b'],
    });

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(1);
    expect(result[1].value).toBeUndefined();
  });

  it('handles empty data', () => {
    const result = runFold([], { fold: ['gold', 'silver'] });
    expect(result).toHaveLength(0);
  });
});
