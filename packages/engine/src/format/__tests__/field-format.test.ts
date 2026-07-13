import { describe, expect, it } from 'vitest';
import { resolveFieldFormatter } from '../field-format';

describe('resolveFieldFormatter', () => {
  describe('precedence', () => {
    it('surfaceFormat wins over channelFormat', () => {
      const fmt = resolveFieldFormatter({
        surfaceFormat: '.0%',
        channelFormat: ',.0f',
        values: [0.5, 0.75, 1.0],
      });
      expect(fmt(0.5)).toBe('50%');
    });

    it('channelFormat is used when surfaceFormat is absent', () => {
      const fmt = resolveFieldFormatter({
        channelFormat: '.0%',
        values: [0.5, 0.75, 1.0],
      });
      expect(fmt(0.5)).toBe('50%');
    });

    it('falls back to default when both formats are absent', () => {
      const fmt = resolveFieldFormatter({
        values: [1000, 2000, 3000],
      });
      const result = fmt(2000);
      expect(result).toBe('2k');
    });

    it('treats empty string as unset', () => {
      const fmt = resolveFieldFormatter({
        surfaceFormat: '',
        channelFormat: '',
        values: [10000, 20000],
      });
      expect(fmt(10000)).toBe('10k');
    });
  });

  describe('semantic keywords', () => {
    it('percent keyword formats as percentage', () => {
      const fmt = resolveFieldFormatter({
        surfaceFormat: 'percent',
        values: [0.25, 0.5, 0.75],
      });
      expect(fmt(0.5)).toBe('50%');
    });

    it('currency keyword formats with $', () => {
      const fmt = resolveFieldFormatter({
        surfaceFormat: 'currency',
        values: [100, 200, 300],
      });
      expect(fmt(200)).toContain('$');
    });
  });

  describe('years guard', () => {
    it('renders year-like values as bare integers', () => {
      const fmt = resolveFieldFormatter({
        values: [2020, 2021, 2022, 2023, 2024],
      });
      expect(fmt(2024)).toBe('2024');
    });

    it('does not apply years guard to non-year ranges', () => {
      const fmt = resolveFieldFormatter({
        values: [5000, 10000, 15000],
      });
      expect(fmt(10000)).toBe('10k');
    });
  });

  describe('step threading', () => {
    it('step is applied to the context', () => {
      const fmt = resolveFieldFormatter({
        values: [0, 5000, 10000, 15000, 20000],
        step: 5000,
      });
      expect(fmt(15000)).toBe('15k');
    });
  });

  describe('chart vs table surface', () => {
    it('chart surface gets compact formatting', () => {
      const fmt = resolveFieldFormatter({
        values: [1000, 2000, 3000],
        surface: 'chart',
      });
      expect(fmt(2000)).toBe('2k');
    });

    it('table surface gets full precision', () => {
      const fmt = resolveFieldFormatter({
        values: [1000, 2000, 3000],
        surface: 'table',
      });
      expect(fmt(2000)).toBe('2,000');
    });
  });
});
