import { expect, it, vi } from 'vitest';
import { resolveTheme } from '../../theme/resolve';
import { footnoteBandHeight } from '../chrome';

it('warns once and retains the numeric API while preferring resolved band metadata', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const theme = resolveTheme();
  expect(footnoteBandHeight(2, theme)).toBeCloseTo(2 * 11 * 1.3 + 4);
  expect(footnoteBandHeight({ noteBandHeight: 87 }, theme)).toBe(87);
  expect(footnoteBandHeight(0, theme)).toBe(0);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toContain('noteBandHeight');
  warn.mockRestore();
});
