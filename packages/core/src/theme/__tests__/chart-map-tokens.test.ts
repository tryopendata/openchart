import { describe, expect, it } from 'vitest';
import { adaptTheme } from '../dark-mode';
import { resolveTheme } from '../resolve';

describe('endpoint and map theme controls', () => {
  it('retains the current endpoint geometry by default', () => {
    const theme = resolveTheme();
    expect(theme.fonts.sizes).toMatchObject({ endpointLabel: 13, endpointValue: 12 });
    expect(theme.spacing).toMatchObject({
      endpointEntryGap: 6,
      endpointValueGap: 4,
      endpointColumnGap: 18,
    });
  });
  it('resolves independently authored sizes and gaps', () => {
    const theme = resolveTheme({
      fonts: { sizes: { endpointLabel: 15, endpointValue: 14 } },
      spacing: { endpointEntryGap: 8, endpointValueGap: 5, endpointColumnGap: 22 },
    });
    expect(theme.fonts.sizes.endpointLabel).toBe(15);
    expect(theme.spacing.endpointColumnGap).toBe(22);
  });
  it('leaves unauthored map colors available for derived warm and dark fallbacks', () => {
    for (const theme of [
      resolveTheme(),
      resolveTheme({ colors: { background: '#faf8f5' } }),
      adaptTheme(resolveTheme()),
    ]) {
      expect(theme.colors.mapNoDataFill).toBeUndefined();
      expect(theme.colors.mapNoDataHatch).toBeUndefined();
      expect(theme.colors.mapInteriorBorder).toBeUndefined();
      expect(theme.colors.mapOutlineBorder).toBeUndefined();
    }
  });
  it('honors explicit map light/dark pairs and plain colors', () => {
    const theme = resolveTheme({
      colors: {
        mapNoDataFill: { light: '#f0e0d0', dark: '#102030' },
        mapNoDataHatch: { light: '#c0b0a0', dark: '#405060' },
        mapInteriorBorder: '#abcdef',
        mapOutlineBorder: { light: '#aabbcc', dark: '#ddeeff' },
      },
    });
    expect(theme.colors.mapNoDataFill).toBe('#f0e0d0');
    const dark = adaptTheme(theme);
    expect(dark.colors.mapNoDataFill).toBe('#102030');
    expect(dark.colors.mapNoDataHatch).toBe('#405060');
    expect(dark.colors.mapInteriorBorder).toBe('#abcdef');
    expect(dark.colors.mapOutlineBorder).toBe('#ddeeff');
  });
});

it('leaves zero-rule ink optional and honors authored mode pairs', () => {
  expect(resolveTheme().colors.gridlineZero).toBeUndefined();
  expect(adaptTheme(resolveTheme()).colors.gridlineZero).toBeUndefined();
  const theme = resolveTheme({
    colors: { gridlineZero: { light: 'rgba(0,0,0,0.22)', dark: 'rgba(255,255,255,0.24)' } },
  });
  expect(theme.colors.gridlineZero).toBe('rgba(0,0,0,0.22)');
  expect(adaptTheme(theme).colors.gridlineZero).toBe('rgba(255,255,255,0.24)');
  expect(
    adaptTheme(resolveTheme({ colors: { gridlineZero: '#123456' } })).colors.gridlineZero,
  ).toBe('#123456');
});
