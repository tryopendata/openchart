import { describe, expect, it } from 'vitest';
import {
  abbreviateNumber,
  buildD3Formatter,
  buildTemporalFormatter,
  formatDate,
  formatNumber,
} from '../format';

describe('formatNumber', () => {
  it('formats integers with commas', () => {
    expect(formatNumber(1500000)).toBe('1,500,000');
  });

  it('formats decimals to 2 places', () => {
    expect(formatNumber(42.567)).toBe('42.57');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles negative numbers', () => {
    // d3-format uses unicode minus sign (U+2212), not ASCII hyphen-minus
    expect(formatNumber(-1234)).toBe('\u22121,234');
  });

  it('handles Infinity', () => {
    expect(formatNumber(Infinity)).toBe('Infinity');
  });

  it('handles NaN', () => {
    expect(formatNumber(NaN)).toBe('NaN');
  });
});

describe('abbreviateNumber', () => {
  it('abbreviates millions', () => {
    expect(abbreviateNumber(1500000)).toBe('1.5M');
  });

  it('abbreviates billions', () => {
    expect(abbreviateNumber(2300000000)).toBe('2.3B');
  });

  it('abbreviates thousands', () => {
    expect(abbreviateNumber(2300)).toBe('2.3K');
  });

  it('drops trailing .0', () => {
    expect(abbreviateNumber(1000000)).toBe('1M');
    expect(abbreviateNumber(2000)).toBe('2K');
  });

  it('does not abbreviate small numbers', () => {
    expect(abbreviateNumber(42)).toBe('42');
  });

  it('handles negative numbers', () => {
    expect(abbreviateNumber(-1500000)).toBe('-1.5M');
  });

  it('abbreviates trillions', () => {
    expect(abbreviateNumber(1_200_000_000_000)).toBe('1.2T');
  });
});

describe('buildD3Formatter', () => {
  it('returns a formatter for a valid d3 format string', () => {
    const fmt = buildD3Formatter('$,.0f');
    expect(fmt).not.toBeNull();
    expect(fmt!(1234)).toBe('$1,234');
  });

  it('handles tilde trim modifier', () => {
    const fmt = buildD3Formatter('$,.2~f');
    expect(fmt).not.toBeNull();
    expect(fmt!(3.1)).toBe('$3.1');
    expect(fmt!(3.75)).toBe('$3.75');
  });

  it('handles literal alpha suffix after d3 format', () => {
    const fmt = buildD3Formatter('$,.2~fT');
    expect(fmt).not.toBeNull();
    expect(fmt!(3.75)).toBe('$3.75T');
  });

  it('handles non-alpha suffix like %', () => {
    const fmt = buildD3Formatter('.0f%');
    expect(fmt).not.toBeNull();
    expect(fmt!(50)).toBe('50%');
  });

  it('returns null for undefined input', () => {
    expect(buildD3Formatter(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(buildD3Formatter('')).toBeNull();
  });

  it('returns null for completely invalid format', () => {
    expect(buildD3Formatter('not-a-format!!!')).toBeNull();
  });

  it('$~s formats low thousands with SI suffix', () => {
    const fmt = buildD3Formatter('$~s');
    expect(fmt).not.toBeNull();
    expect(fmt!(6000)).toBe('$6k');
    expect(fmt!(7000)).toBe('$7k');
    expect(fmt!(14000)).toBe('$14k');
  });
});

describe('formatDate', () => {
  it('formats a Date object', () => {
    const result = formatDate(new Date('2020-06-15'), undefined, 'day');
    expect(result).toContain('2020');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });

  it('formats an ISO string', () => {
    const result = formatDate('2020-01-01', undefined, 'year');
    expect(result).toBe('2020');
  });

  it('formats quarters', () => {
    const result = formatDate(new Date('2020-04-15'), undefined, 'quarter');
    expect(result).toBe('Q2 2020');
  });

  it('formats months', () => {
    const result = formatDate(new Date('2020-03-01'), undefined, 'month');
    expect(result).toContain('Mar');
    expect(result).toContain('2020');
  });

  it('handles invalid dates gracefully', () => {
    const result = formatDate('not-a-date');
    expect(result).toBe('not-a-date');
  });

  it('infers year granularity for bare year strings regardless of timezone', () => {
    // "2020" parses as 2020-01-01T00:00:00Z. In negative-offset timezones,
    // local getHours()/getDate() would see Dec 31 2019 — the UTC fix prevents that.
    const result = formatDate('2020');
    expect(result).toBe('2020');
  });

  it('infers year granularity for Jan 1 ISO dates', () => {
    const result = formatDate('2020-01-01');
    expect(result).toBe('2020');
  });

  it('infers month granularity for first-of-month dates', () => {
    const result = formatDate('2020-06-01');
    expect(result).toContain('Jun');
    expect(result).toContain('2020');
  });

  it('infers day granularity for mid-month dates', () => {
    const result = formatDate('2020-06-15');
    expect(result).toContain('15');
    expect(result).toContain('Jun');
  });
});

describe('buildTemporalFormatter', () => {
  it('returns null for undefined format', () => {
    expect(buildTemporalFormatter(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(buildTemporalFormatter('')).toBeNull();
  });

  it('formats dates with %Y to just the year', () => {
    const fmt = buildTemporalFormatter('%Y');
    expect(fmt).not.toBeNull();
    expect(fmt!('2020-01-01')).toBe('2020');
    expect(fmt!(new Date('2020-06-15'))).toBe('2020');
  });

  it('formats dates with %b %Y to month and year', () => {
    const fmt = buildTemporalFormatter('%b %Y');
    expect(fmt).not.toBeNull();
    expect(fmt!('2020-06-01')).toBe('Jun 2020');
  });

  it('formats dates with full date format', () => {
    const fmt = buildTemporalFormatter('%Y-%m-%d');
    expect(fmt).not.toBeNull();
    expect(fmt!('2020-06-15')).toBe('2020-06-15');
  });

  it('handles invalid date input gracefully', () => {
    const fmt = buildTemporalFormatter('%Y');
    expect(fmt).not.toBeNull();
    expect(fmt!('not-a-date')).toBe('not-a-date');
  });

  it('handles Date objects', () => {
    const fmt = buildTemporalFormatter('%Y');
    expect(fmt).not.toBeNull();
    expect(fmt!(new Date('2025-01-01T00:00:00Z'))).toBe('2025');
  });

  it('handles numeric timestamps', () => {
    const fmt = buildTemporalFormatter('%Y');
    expect(fmt).not.toBeNull();
    // 2020-01-01T00:00:00Z
    expect(fmt!(1577836800000)).toBe('2020');
  });
});
