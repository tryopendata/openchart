import { describe, expect, it } from 'vitest';
import { runTimeUnit } from '../timeunit';

describe('runTimeUnit', () => {
  // Use a specific date: 2024-03-15 14:30:45.123 (Friday)
  const testDate = new Date(2024, 2, 15, 14, 30, 45, 123);
  const data = [{ ts: testDate }];

  describe('single time units', () => {
    it('extracts year', () => {
      const result = runTimeUnit(data, { timeUnit: 'year', field: 'ts', as: 'y' });
      expect(result[0].y).toBe(2024);
    });

    it('extracts quarter', () => {
      const result = runTimeUnit(data, { timeUnit: 'quarter', field: 'ts', as: 'q' });
      expect(result[0].q).toBe(1); // March is Q1
    });

    it('extracts month (0-indexed)', () => {
      const result = runTimeUnit(data, { timeUnit: 'month', field: 'ts', as: 'm' });
      expect(result[0].m).toBe(2); // March = 2
    });

    it('extracts day of week', () => {
      const result = runTimeUnit(data, { timeUnit: 'day', field: 'ts', as: 'd' });
      expect(result[0].d).toBe(5); // Friday
    });

    it('extracts date (day of month)', () => {
      const result = runTimeUnit(data, { timeUnit: 'date', field: 'ts', as: 'd' });
      expect(result[0].d).toBe(15);
    });

    it('extracts hours', () => {
      const result = runTimeUnit(data, { timeUnit: 'hours', field: 'ts', as: 'h' });
      expect(result[0].h).toBe(14);
    });

    it('extracts minutes', () => {
      const result = runTimeUnit(data, { timeUnit: 'minutes', field: 'ts', as: 'min' });
      expect(result[0].min).toBe(30);
    });

    it('extracts seconds', () => {
      const result = runTimeUnit(data, { timeUnit: 'seconds', field: 'ts', as: 's' });
      expect(result[0].s).toBe(45);
    });

    it('extracts milliseconds', () => {
      const result = runTimeUnit(data, { timeUnit: 'milliseconds', field: 'ts', as: 'ms' });
      expect(result[0].ms).toBe(123);
    });

    it('extracts week number', () => {
      const result = runTimeUnit(data, { timeUnit: 'week', field: 'ts', as: 'w' });
      expect(typeof result[0].w).toBe('number');
      expect(result[0].w).toBeGreaterThan(0);
      expect(result[0].w).toBeLessThanOrEqual(53);
    });

    it('extracts dayofyear', () => {
      const result = runTimeUnit(data, { timeUnit: 'dayofyear', field: 'ts', as: 'doy' });
      expect(typeof result[0].doy).toBe('number');
      // March 15 is day 75 in a leap year (2024)
      expect(result[0].doy).toBe(75);
    });
  });

  describe('compound time units', () => {
    it('extracts yearmonth', () => {
      const result = runTimeUnit(data, { timeUnit: 'yearmonth', field: 'ts', as: 'ym' });
      expect(result[0].ym).toBe('2024-03');
    });

    it('extracts yearmonthdate', () => {
      const result = runTimeUnit(data, { timeUnit: 'yearmonthdate', field: 'ts', as: 'ymd' });
      expect(result[0].ymd).toBe('2024-03-15');
    });

    it('extracts monthdate', () => {
      const result = runTimeUnit(data, { timeUnit: 'monthdate', field: 'ts', as: 'md' });
      expect(result[0].md).toBe('03-15');
    });

    it('extracts hoursminutes', () => {
      const result = runTimeUnit(data, { timeUnit: 'hoursminutes', field: 'ts', as: 'hm' });
      expect(result[0].hm).toBe('14:30');
    });
  });

  describe('date parsing', () => {
    it('parses ISO string dates', () => {
      const stringData = [{ ts: '2024-03-15T14:30:00Z' }];
      const result = runTimeUnit(stringData, { timeUnit: 'year', field: 'ts', as: 'y' });
      expect(result[0].y).toBe(2024);
    });

    it('parses numeric timestamps', () => {
      const numData = [{ ts: testDate.getTime() }];
      const result = runTimeUnit(numData, { timeUnit: 'year', field: 'ts', as: 'y' });
      expect(result[0].y).toBe(2024);
    });

    it('returns null for unparseable dates', () => {
      const badData = [{ ts: 'not-a-date' }];
      const result = runTimeUnit(badData, { timeUnit: 'year', field: 'ts', as: 'y' });
      expect(result[0].y).toBeNull();
    });

    it('returns null for null values', () => {
      const nullData = [{ ts: null }];
      const result = runTimeUnit(nullData, { timeUnit: 'year', field: 'ts', as: 'y' });
      expect(result[0].y).toBeNull();
    });
  });

  it('preserves existing fields', () => {
    const extraData = [{ ts: testDate, label: 'test' }];
    const result = runTimeUnit(extraData, { timeUnit: 'year', field: 'ts', as: 'y' });
    expect(result[0].label).toBe('test');
    expect(result[0].ts).toBe(testDate);
  });

  it('handles empty data', () => {
    const result = runTimeUnit([], { timeUnit: 'year', field: 'ts', as: 'y' });
    expect(result).toHaveLength(0);
  });
});
