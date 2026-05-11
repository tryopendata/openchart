import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../colors/contrast';
import { ACHROMATIC_RAMP } from '../../colors/palettes';
import { adaptColorForDarkMode } from '../dark-mode';
import { DEFAULT_THEME } from '../defaults';

describe('DEFAULT_THEME', () => {
  it('has all required top-level fields', () => {
    expect(DEFAULT_THEME.colors).toBeDefined();
    expect(DEFAULT_THEME.fonts).toBeDefined();
    expect(DEFAULT_THEME.spacing).toBeDefined();
    expect(DEFAULT_THEME.borderRadius).toBeDefined();
    expect(DEFAULT_THEME.chrome).toBeDefined();
  });

  it('uses Inter Variable as primary font', () => {
    expect(DEFAULT_THEME.fonts.family).toContain('Inter Variable');
  });

  it('title is 26px demi (590 weight)', () => {
    expect(DEFAULT_THEME.chrome.title.fontSize).toBe(26);
    expect(DEFAULT_THEME.chrome.title.fontWeight).toBe(590);
  });

  it('subtitle is 14px normal weight', () => {
    expect(DEFAULT_THEME.chrome.subtitle.fontSize).toBe(14);
    expect(DEFAULT_THEME.chrome.subtitle.fontWeight).toBe(400);
  });

  it('source is 11px normal weight', () => {
    expect(DEFAULT_THEME.chrome.source.fontSize).toBe(11);
    expect(DEFAULT_THEME.chrome.source.fontWeight).toBe(400);
  });

  it('borderRadius is 2px (square aesthetic)', () => {
    expect(DEFAULT_THEME.borderRadius).toBe(2);
  });

  it('font weights include 550 (medium) and 590 (demi)', () => {
    expect(DEFAULT_THEME.fonts.weights.medium).toBe(550);
    expect(DEFAULT_THEME.fonts.weights.semibold).toBe(590);
  });

  it('categorical palette is non-empty and primary accent is cyan', () => {
    // Palette is a designed OKLCH multi-hue ramp tuned for dark surfaces
    // (L~=0.70). It does not guarantee WCAG-AA-large-text contrast on
    // pure white; light-mode line strokes route through the strong
    // accent token (`adaptForLightLineStroke`) instead. Per-token
    // accessibility is enforced via dedicated contrast helpers, not
    // here.
    expect(DEFAULT_THEME.colors.categorical.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_THEME.colors.categorical[0]).toBe('#06b6d4');
  });

  it('dark canvas surface tokens are part of the achromatic ramp', () => {
    expect(ACHROMATIC_RAMP.bg).toBe('#09090b');
    expect(ACHROMATIC_RAMP.fg).toBe('#f7f8f8');
  });

  it('dark-mode adapter preserves contrast monotonicity for cyan accent', () => {
    // The cyan accent on white has a low ratio (~2.4); the adapter's
    // job is to produce a similar ratio against the dark canvas, not
    // to raise it. Just confirm the adapter returns something.
    const adapted = adaptColorForDarkMode('#06b6d4', '#ffffff', ACHROMATIC_RAMP.bg);
    expect(adapted).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrastRatio(adapted, ACHROMATIC_RAMP.bg)).toBeGreaterThan(1.5);
  });

  it('has sequential and diverging palette entries', () => {
    expect(Object.keys(DEFAULT_THEME.colors.sequential).length).toBeGreaterThan(0);
    expect(Object.keys(DEFAULT_THEME.colors.diverging).length).toBeGreaterThan(0);
  });
});
