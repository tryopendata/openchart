import { describe, expect, it } from 'vitest';
import { formatPeriodLabels } from '../period-labels';

describe('formatPeriodLabels', () => {
  it('prints temporal years as years and honors an explicit format', () => {
    const periods = [
      { value: 1999, sortKey: 1999 },
      { value: 2000, sortKey: 2000 },
    ];
    expect(formatPeriodLabels(periods, { field: 'year', type: 'temporal' })).toEqual([
      '1999',
      '2000',
    ]);
    expect(formatPeriodLabels(periods, { field: 'year', type: 'temporal', format: '%y' })).toEqual([
      '99',
      '00',
    ]);
  });

  it('labels ordinal periods with their values', () => {
    const periods = [
      { value: 'Q1', sortKey: 0 },
      { value: 'Q2', sortKey: 1 },
    ];
    expect(formatPeriodLabels(periods, { field: 'quarter', type: 'ordinal' })).toEqual([
      'Q1',
      'Q2',
    ]);
  });
});
