import { expect, it } from 'vitest';
import * as publicCore from '../../index';
import { resolveTheme } from '../../theme/resolve';
import { computeNoteBandHeight } from '../chrome';

it('removes the public footnoteBandHeight alias and prefers resolved note-band metadata', () => {
  expect(publicCore).not.toHaveProperty('footnoteBandHeight');
  const theme = resolveTheme();
  expect(computeNoteBandHeight({ noteBandHeight: 87 }, theme)).toBe(87);
  expect(computeNoteBandHeight(2, theme)).toBeCloseTo(2 * theme.fonts.sizes.small * 1.3 + 4);
  expect(computeNoteBandHeight(0, theme)).toBe(0);
});
