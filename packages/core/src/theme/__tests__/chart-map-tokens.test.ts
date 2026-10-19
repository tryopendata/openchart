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

it('uses approved hierarchy defaults and honors authored mode pairs', () => {
  expect(resolveTheme().colors).toMatchObject({
    gridline: 'rgba(0,0,0,0.05)',
    gridlineZero: 'rgba(0,0,0,0.22)',
    mapInteriorBorder: 'rgba(0,0,0,0.14)',
    mapOutlineBorder: 'rgba(0,0,0,0.40)',
  });
  expect(adaptTheme(resolveTheme()).colors).toMatchObject({
    gridline: 'rgba(255,255,255,0.06)',
    gridlineZero: 'rgba(255,255,255,0.24)',
    mapInteriorBorder: 'rgba(255,255,255,0.18)',
    mapOutlineBorder: 'rgba(255,255,255,0.38)',
  });
  const theme = resolveTheme({
    colors: { gridlineZero: { light: 'rgba(0,0,0,0.22)', dark: 'rgba(255,255,255,0.24)' } },
  });
  expect(theme.colors.gridlineZero).toBe('rgba(0,0,0,0.22)');
  expect(adaptTheme(theme).colors.gridlineZero).toBe('rgba(255,255,255,0.24)');
  expect(
    adaptTheme(resolveTheme({ colors: { gridlineZero: '#123456' } })).colors.gridlineZero,
  ).toBe('#123456');
});

it('preserves explicit plain hierarchy colors even when equal to light defaults', () => {
  const colors = {
    gridlineZero: 'rgba(0,0,0,0.22)',
    mapInteriorBorder: 'rgba(0,0,0,0.14)',
    mapOutlineBorder: 'rgba(0,0,0,0.40)',
  };
  expect(adaptTheme(resolveTheme({ colors })).colors).toMatchObject(colors);
});

it('keeps new default roles visible on a dark authored canvas without a mode flag', () => {
  const theme = resolveTheme({ colors: { background: '#121212', text: '#eeeeee' } });
  expect(theme.colors.gridlineZero?.replaceAll(' ', '')).toBe('rgba(255,255,255,0.24)');
  expect(theme.colors.mapInteriorBorder?.replaceAll(' ', '')).toBe('rgba(255,255,255,0.18)');
  expect(theme.colors.mapOutlineBorder?.replaceAll(' ', '')).toBe('rgba(255,255,255,0.38)');
  expect(theme.colors.mapNoDataHatch).toBeUndefined();
});
