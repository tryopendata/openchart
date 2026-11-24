import type { EncodingChannel } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { formatPeriodLabels } from '../period-labels';

const temporal: EncodingChannel = { field: 'period', type: 'temporal' };
const ordinal: EncodingChannel = { field: 'period', type: 'ordinal' };
const quantitative: EncodingChannel = { field: 'period', type: 'quantitative' };

function periods(...values: Array<string | number>) {
  return values.map((value, sortKey) => ({ value, sortKey }));
}

describe('race period labels', () => {
  it('formats RFC-2822 and long-form dates using their stored UTC timestamps', () => {
    expect(
      formatPeriodLabels(
        [
          { value: 'Sat, 01 Mar 2024 00:00:00 GMT', sortKey: Date.UTC(2024, 2, 1) },
          { value: 'September 1, 2024 00:00:00 GMT', sortKey: Date.UTC(2024, 8, 1) },
          { value: 'Tue, 01 Oct 2024 00:00:00 GMT', sortKey: Date.UTC(2024, 9, 1) },
        ],
        temporal,
      ),
    ).toEqual(['Mar 2024', 'Sep 2024', 'Oct 2024']);
  });

  it('uses date granularity for an integer year stored with an epoch sort key', () => {
    expect(
      formatPeriodLabels(
        [
          { value: 1995, sortKey: Date.UTC(1995, 0, 1) },
          { value: '1996-02-03', sortKey: Date.UTC(1996, 1, 3) },
        ],
        temporal,
      ),
    ).toEqual(['Jan 1, 1995', 'Feb 3, 1996']);
  });

  it('prints integer years as written when the matrix uses year sort keys', () => {
    const years = [1995, 1996].map((value) => ({ value, sortKey: value }));
    expect(formatPeriodLabels(years, temporal)).toEqual(['1995', '1996']);
  });

  it('formats integer years as January 1 in UTC', () => {
    const years = [1000, 1995, 9999].map((value) => ({ value, sortKey: value }));
    expect(formatPeriodLabels(years, { ...temporal, format: '%Y-%m-%d' })).toEqual([
      '1000-01-01',
      '1995-01-01',
      '9999-01-01',
    ]);
  });

  it('uses the authored time format in UTC with and without explicit offsets', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    try {
      expect(
        formatPeriodLabels(
          [
            { value: '2024-03-01T00:30:00+02:00', sortKey: Date.UTC(2024, 1, 29, 22, 30) },
            { value: '2024-03-01T00:30:00', sortKey: Date.UTC(2024, 2, 1, 0, 30) },
          ],
          { ...temporal, format: '%Y-%m-%d %H:%M' },
        ),
      ).toEqual(['2024-02-29 22:30', '2024-03-01 00:30']);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it.each([
    { values: ['2023-01-01', '2024-01-01'], labels: ['2023', '2024'] },
    { values: ['2024-01-01', '2024-02-01'], labels: ['Jan 2024', 'Feb 2024'] },
    { values: ['2024-01-01', '2024-02-03'], labels: ['Jan 1, 2024', 'Feb 3, 2024'] },
  ])('chooses one granularity for dates $values', ({ values, labels }) => {
    const dates = values.map((value) => ({ value, sortKey: Date.parse(value) }));
    expect(formatPeriodLabels(dates, temporal)).toEqual(labels);
  });

  it('prints ordinal values as text in period order', () => {
    expect(
      formatPeriodLabels(periods('Fall', 1000, 'Spring'), { ...ordinal, format: ',d' }),
    ).toEqual(['Fall', '1000', 'Spring']);
  });

  it('applies the channel number format only when supplied for quantitative periods', () => {
    const values = periods(0.125, 0.5);
    expect(formatPeriodLabels(values, { ...quantitative, format: '.1%' })).toEqual([
      '12.5%',
      '50.0%',
    ]);
    expect(formatPeriodLabels(values, quantitative)).toEqual(['0.125', '0.5']);
  });

  it('uses the field extent to format prescaled percentages', () => {
    expect(formatPeriodLabels(periods(0.5, 12.5), { ...quantitative, format: 'percent' })).toEqual([
      '0.5%',
      '12.5%',
    ]);
  });
});
