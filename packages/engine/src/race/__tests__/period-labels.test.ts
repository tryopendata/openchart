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
  it('prints integer years as written even beside a date with day precision', () => {
    expect(formatPeriodLabels(periods(1995, '1996-02-03'), temporal)).toEqual([
      '1995',
      'Feb 3, 1996',
    ]);
  });

  it('formats integer years as January 1 in UTC', () => {
    expect(
      formatPeriodLabels(periods(1000, 1995, 9999), { ...temporal, format: '%Y-%m-%d' }),
    ).toEqual(['1000-01-01', '1995-01-01', '9999-01-01']);
  });

  it('uses the authored time format in UTC with and without explicit offsets', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    try {
      expect(
        formatPeriodLabels(periods('2024-03-01T00:30:00+02:00', '2024-03-01T00:30:00'), {
          ...temporal,
          format: '%Y-%m-%d %H:%M',
        }),
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
    expect(formatPeriodLabels(periods(...values), temporal)).toEqual(labels);
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
