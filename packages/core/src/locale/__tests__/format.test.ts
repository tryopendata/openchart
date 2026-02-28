import { describe, expect, it } from 'vitest';
import { abbreviateNumber, formatDate, formatNumber } from '../format';

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
});
