import { describe, expect, it } from 'vitest';
import {
  abbreviateNumber,
  buildCompactStepFormatter,
  buildD3Formatter,
  buildTemporalFormatter,
  computeFieldFormatContext,
  defaultNumberFormatter,
  formatCurrency,
  formatDate,
  formatNumber,
  formatOrdinal,
  formatPercent,
  isYearContext,
  isYearLikeValues,
  resolveNumberFormatter,
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
    expect(formatNumber(-1234)).toBe('−1,234');
  });

  it('handles Infinity', () => {
    expect(formatNumber(Infinity)).toBe('Infinity');
  });

  it('handles NaN', () => {
    expect(formatNumber(NaN)).toBe('NaN');
  });

  it('preserves small decimals instead of rounding to 0.00', () => {
    expect(formatNumber(0.0034)).toBe('0.0034');
    expect(formatNumber(0.000012)).toBe('0.000012');
  });

  it('still uses ,.2f for normal-sized decimals', () => {
    expect(formatNumber(0.5)).toBe('0.50');
    expect(formatNumber(3.14567)).toBe('3.15');
  });
});

describe('abbreviateNumber', () => {
  it('abbreviates millions', () => {
    expect(abbreviateNumber(1500000)).toBe('1.5M');
  });

  it('abbreviates billions', () => {
    expect(abbreviateNumber(2300000000)).toBe('2.3B');
  });

  it('abbreviates thousands with lowercase k', () => {
    expect(abbreviateNumber(2300)).toBe('2.3k');
  });

  it('drops trailing .0', () => {
    expect(abbreviateNumber(1000000)).toBe('1M');
    expect(abbreviateNumber(2000)).toBe('2k');
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

  it('trims 1020000 to 1M', () => {
    expect(abbreviateNumber(1020000)).toBe('1M');
  });

  it('renders 18900 as 18.9k', () => {
    expect(abbreviateNumber(18900)).toBe('18.9k');
  });

  it('renders 1000 as 1k', () => {
    expect(abbreviateNumber(1000)).toBe('1k');
  });

  it('rolls up 999999 to 1M', () => {
    expect(abbreviateNumber(999999)).toBe('1M');
  });

  it('rolls up 999999999 to 1B', () => {
    expect(abbreviateNumber(999999999)).toBe('1B');
  });

  it('rolls up 999950 to 1M (rounding boundary)', () => {
    expect(abbreviateNumber(999950)).toBe('1M');
  });

  it('keeps 999949 as 999.9k (below roll-up boundary)', () => {
    expect(abbreviateNumber(999949)).toBe('999.9k');
  });

  it('handles -1500000', () => {
    expect(abbreviateNumber(-1500000)).toBe('-1.5M');
  });
});

describe('formatPercent', () => {
  it('formats fractions (default) with .1~%', () => {
    expect(formatPercent(0.847)).toBe('84.7%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('formats pre-scaled values with fraction: false', () => {
    expect(formatPercent(84.7, { fraction: false })).toBe('84.7%');
    expect(formatPercent(1200, { fraction: false })).toBe('1,200%');
  });
});

describe('formatCurrency', () => {
  it('compact mode abbreviates >= 1000', () => {
    expect(formatCurrency(1900, { compact: true })).toBe('$1.9k');
    expect(formatCurrency(12666, { compact: true })).toBe('$12.7k');
  });

  it('compact mode uses ASCII minus for negatives', () => {
    expect(formatCurrency(-1900, { compact: true })).toBe('-$1.9k');
  });

  it('compact mode keeps small numbers full', () => {
    expect(formatCurrency(42, { compact: true })).toBe('$42');
  });

  it('full mode (default) formats integers without cents', () => {
    expect(formatCurrency(12666)).toBe('$12,666');
  });

  it('full mode uses ASCII minus for negatives', () => {
    expect(formatCurrency(-12666)).toBe('-$12,666');
  });

  it('full mode includes cents for non-integers', () => {
    expect(formatCurrency(12666.5)).toBe('$12,666.50');
  });

  it('handles negative non-integer in full mode', () => {
    expect(formatCurrency(-42.5)).toBe('-$42.50');
  });

  it('handles negative non-integer in compact mode', () => {
    expect(formatCurrency(-42.5, { compact: true })).toBe('-$42.50');
  });
});

describe('isYearLikeValues', () => {
  it('returns true for year-like integer arrays', () => {
    expect(isYearLikeValues([1500, 2024, 2500])).toBe(true);
  });

  it('returns false for empty arrays', () => {
    expect(isYearLikeValues([])).toBe(false);
  });

  it('returns false when values are below 1500', () => {
    expect(isYearLikeValues([1499])).toBe(false);
  });

  it('returns false when values are above 2500', () => {
    expect(isYearLikeValues([2501])).toBe(false);
  });

  it('returns false for non-integer values', () => {
    expect(isYearLikeValues([2024.5])).toBe(false);
  });

  it('returns false when range includes zero', () => {
    expect(isYearLikeValues([0, 2024])).toBe(false);
  });

  it('returns false for negative values', () => {
    expect(isYearLikeValues([-2000])).toBe(false);
  });
});

describe('computeFieldFormatContext', () => {
  it('computes extent and allIntegers from numeric values', () => {
    const ctx = computeFieldFormatContext([10, 20, 30]);
    expect(ctx.extent).toEqual([10, 30]);
    expect(ctx.allIntegers).toBe(true);
  });

  it('detects non-integers', () => {
    const ctx = computeFieldFormatContext([10, 20.5, 30]);
    expect(ctx.allIntegers).toBe(false);
  });

  it('coerces numeric strings', () => {
    const ctx = computeFieldFormatContext(['10', '20', '30']);
    expect(ctx.extent).toEqual([10, 30]);
  });

  it('skips non-finite values', () => {
    const ctx = computeFieldFormatContext([10, NaN, null, undefined, 30]);
    expect(ctx.extent).toEqual([10, 30]);
  });

  it('returns empty context for empty input', () => {
    const ctx = computeFieldFormatContext([]);
    expect(ctx.extent).toBeUndefined();
    expect(ctx.allIntegers).toBeUndefined();
  });

  it('sets surface when provided', () => {
    const ctx = computeFieldFormatContext([1, 2], 'table');
    expect(ctx.surface).toBe('table');
  });
});

describe('isYearContext', () => {
  it('returns true for year-like integer ranges', () => {
    expect(isYearContext({ extent: [1990, 2024], allIntegers: true })).toBe(true);
  });

  it('returns false when non-integers', () => {
    expect(isYearContext({ extent: [1990, 2024], allIntegers: false })).toBe(false);
  });

  it('returns false when out of range', () => {
    expect(isYearContext({ extent: [0, 2024], allIntegers: true })).toBe(false);
  });

  it('returns false for undefined ctx', () => {
    expect(isYearContext(undefined)).toBe(false);
  });
});

describe('resolveNumberFormatter', () => {
  it('returns null for empty string', () => {
    expect(resolveNumberFormatter('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(resolveNumberFormatter(undefined)).toBeNull();
  });

  it('resolves ordinal keyword', () => {
    const fmt = resolveNumberFormatter('ordinal');
    expect(fmt!(1)).toBe('1st');
  });

  it('resolves percent keyword with fraction detection (extent <= 1)', () => {
    const fmt = resolveNumberFormatter('percent', { extent: [0, 0.9] });
    expect(fmt!(0.847)).toBe('84.7%');
  });

  it('resolves percent keyword with pre-scaled detection (extent > 1)', () => {
    const fmt = resolveNumberFormatter('percent', { extent: [0, 98] });
    expect(fmt!(84.7)).toBe('84.7%');
  });

  it('resolves currency keyword for tables (full precision)', () => {
    const fmt = resolveNumberFormatter('currency', { surface: 'table' });
    expect(fmt!(12666)).toBe('$12,666');
  });

  it('resolves currency keyword for charts (compact)', () => {
    const fmt = resolveNumberFormatter('currency');
    expect(fmt!(1900)).toBe('$1.9k');
  });

  it('resolves d3 format strings', () => {
    const fmt = resolveNumberFormatter('$,.0f');
    expect(fmt!(1234)).toBe('$1,234');
  });

  it('currency with step uses step-derived decimals', () => {
    const fmt = resolveNumberFormatter('currency', {
      step: 500000,
      stepReference: 2000000,
    });
    expect(fmt!(1500000)).toBe('$1.5M');
  });
});

describe('defaultNumberFormatter', () => {
  it('contextless: per-value year check (ARIA path)', () => {
    const fmt = defaultNumberFormatter();
    expect(fmt(2024)).toBe('2024');
    expect(fmt(2600)).toBe('2.6k');
  });

  it('year context returns bare year string', () => {
    const fmt = defaultNumberFormatter({ extent: [1990, 2024], allIntegers: true });
    expect(fmt(2024)).toBe('2024');
  });

  it('table surface returns full precision', () => {
    const fmt = defaultNumberFormatter({ surface: 'table' });
    expect(fmt(1020000)).toBe('1,020,000');
  });

  it('step-aware compact when step and reference >= 1000', () => {
    const fmt = defaultNumberFormatter({ step: 500000, stepReference: 2000000 });
    expect(fmt(500000)).toBe('500k');
    expect(fmt(1000000)).toBe('1M');
    expect(fmt(1500000)).toBe('1.5M');
  });

  it('per-value compact/formatNumber for chart surface', () => {
    const fmt = defaultNumberFormatter({ extent: [0, 2000000] });
    expect(fmt(1020000)).toBe('1M');
    expect(fmt(42)).toBe('42');
  });

  it('does not apply per-value year check when context has extent', () => {
    const fmt = defaultNumberFormatter({ extent: [-2000, 2000], allIntegers: true });
    expect(fmt(2000)).toBe('2k');
  });
});

describe('buildCompactStepFormatter', () => {
  it('formats per-value units with step-derived decimals', () => {
    const fmt = buildCompactStepFormatter(500000);
    expect(fmt(0)).toBe('0');
    expect(fmt(500000)).toBe('500k');
    expect(fmt(1000000)).toBe('1M');
    expect(fmt(1500000)).toBe('1.5M');
  });

  it('step-derived decimals prevent misleading rounding', () => {
    const fmt = buildCompactStepFormatter(1250000);
    expect(fmt(1250000)).toBe('1.25M');
    expect(fmt(2500000)).toBe('2.5M');
  });

  it('degenerate narrow domain falls back to comma-grouped', () => {
    const fmt = buildCompactStepFormatter(1);
    expect(fmt(2021)).toBe('2,021');
  });

  it('handles non-finite values', () => {
    const fmt = buildCompactStepFormatter(500000);
    expect(fmt(Infinity)).toBe('Infinity');
    expect(fmt(NaN)).toBe('NaN');
  });

  it('sub-1k ticks render plain', () => {
    const fmt = buildCompactStepFormatter(200);
    expect(fmt(200)).toBe('200');
    expect(fmt(400)).toBe('400');
    expect(fmt(1000)).toBe('1k');
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

  it('$~s replaces SI "G" with "B" for billions', () => {
    const fmt = buildD3Formatter('$~s');
    expect(fmt).not.toBeNull();
    expect(fmt!(1_500_000_000)).toBe('$1.5B');
    expect(fmt!(2_000_000_000)).toBe('$2B');
  });

  it("'ordinal' returns the rank-axis ordinal formatter", () => {
    const fmt = buildD3Formatter('ordinal');
    expect(fmt).not.toBeNull();
    expect(fmt!(1)).toBe('1st');
    expect(fmt!(6)).toBe('6th');
  });
});

describe('formatOrdinal', () => {
  it('formats 1, 2, 3 with st/nd/rd suffixes', () => {
    expect(formatOrdinal(1)).toBe('1st');
    expect(formatOrdinal(2)).toBe('2nd');
    expect(formatOrdinal(3)).toBe('3rd');
  });

  it('formats 4 through 10 with th', () => {
    expect(formatOrdinal(4)).toBe('4th');
    expect(formatOrdinal(10)).toBe('10th');
  });

  it('uses th for the 11-13 teens, including 111-113', () => {
    expect(formatOrdinal(11)).toBe('11th');
    expect(formatOrdinal(12)).toBe('12th');
    expect(formatOrdinal(13)).toBe('13th');
    expect(formatOrdinal(111)).toBe('111th');
    expect(formatOrdinal(112)).toBe('112th');
  });

  it('applies st/nd/rd past the teens', () => {
    expect(formatOrdinal(21)).toBe('21st');
    expect(formatOrdinal(22)).toBe('22nd');
    expect(formatOrdinal(23)).toBe('23rd');
    expect(formatOrdinal(101)).toBe('101st');
  });

  it('rounds non-integers to the nearest rank', () => {
    expect(formatOrdinal(2.4)).toBe('2nd');
  });

  it('falls back to String() for non-finite values', () => {
    expect(formatOrdinal(Number.NaN)).toBe('NaN');
    expect(formatOrdinal(Number.POSITIVE_INFINITY)).toBe('Infinity');
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

  describe('compact formats', () => {
    it('formats months as bare month name', () => {
      expect(formatDate('2025-02-01', undefined, undefined, true, true)).toBe('Feb');
    });

    it('infers year granularity at year boundaries (compact stays %Y)', () => {
      expect(formatDate('2025-01-01', undefined, undefined, true, true)).toBe('2025');
    });

    it('formats days without the year', () => {
      expect(formatDate('2025-03-05', undefined, undefined, true, true)).toBe('Mar 05');
    });

    it('formats quarters with apostrophe year', () => {
      expect(formatDate('2025-04-15', undefined, 'quarter', true, true)).toBe("Q2 '25");
    });

    it('formats quarters with local-time year when useUtc is false', () => {
      expect(formatDate(new Date(2025, 4, 15), undefined, 'quarter', false, true)).toBe("Q2 '25");
    });

    it('formats weeks as month and day', () => {
      expect(formatDate('2025-03-10', undefined, 'week', true, true)).toBe('Mar 10');
    });

    it('formats hours as time only', () => {
      expect(formatDate('2025-03-05T14:00:00Z', undefined, undefined, true, true)).toBe('14:00');
    });

    it('formats minutes as time only', () => {
      expect(formatDate('2025-03-05T14:30:00Z', undefined, undefined, true, true)).toBe('14:30');
    });

    it('default (compact: false) output is unchanged', () => {
      expect(formatDate('2025-02-01')).toBe('Feb 2025');
      expect(formatDate('2025-03-05')).toBe('Mar 05, 2025');
      expect(formatDate('2025-04-15', undefined, 'quarter')).toBe('Q2 2025');
    });

    it('full quarter year follows useUtc at year boundaries', () => {
      expect(formatDate(new Date('2026-01-01T00:00:00Z'), undefined, 'quarter')).toBe('Q1 2026');
    });
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
    expect(fmt!(1577836800000)).toBe('2020');
  });
});
