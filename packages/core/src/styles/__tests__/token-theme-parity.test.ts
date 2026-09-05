/**
 * The CSS token defaults and the JS theme are two halves of one design system,
 * and they have drifted apart before (weights 590/450 in CSS vs 590/450/550 in
 * the theme, `--oc-positive` at #10b981 against a theme positive of #16a34a,
 * `--oc-axis` carrying a hairline while `theme.colors.axis` carried tick ink).
 *
 * This test is the thing that stops it recurring: every token that has a theme
 * counterpart must equal it in both modes.
 */

import { describe, expect, it } from 'vitest';
import { adaptTheme } from '../../theme/dark-mode';
import { DEFAULT_THEME } from '../../theme/defaults';
import { resolveTheme } from '../../theme/resolve';
import { cssTokenDefault } from '../token-definitions';

/** `rgba(0, 0, 0, 0.08)` and `rgba(0,0,0,0.08)` are the same color. */
const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase();

const light = resolveTheme();
const dark = adaptTheme(resolveTheme());

describe('CSS token / theme parity', () => {
  it('semantic colors match in both modes', () => {
    expect(norm(cssTokenDefault('--oc-positive', 'light'))).toBe(norm(light.colors.positive));
    expect(norm(cssTokenDefault('--oc-positive', 'dark'))).toBe(norm(dark.colors.positive));
    expect(norm(cssTokenDefault('--oc-negative', 'light'))).toBe(norm(light.colors.negative));
    expect(norm(cssTokenDefault('--oc-negative', 'dark'))).toBe(norm(dark.colors.negative));
  });

  it('gridline matches the theme gridline', () => {
    expect(norm(cssTokenDefault('--oc-gridline', 'light'))).toBe(norm(light.colors.gridline));
    expect(norm(cssTokenDefault('--oc-gridline', 'dark'))).toBe(norm(dark.colors.gridline));
  });

  it('--oc-axis is the hairline, not the tick-label ink', () => {
    expect(norm(cssTokenDefault('--oc-axis', 'light'))).toBe(norm(light.colors.hairline));
    expect(norm(cssTokenDefault('--oc-axis', 'dark'))).toBe(norm(dark.colors.hairline));
    // The regression this guards: axis used to be stamped from colors.axis.
    expect(norm(cssTokenDefault('--oc-axis', 'light'))).not.toBe(norm(light.colors.axis));
  });

  it('chrome weights match the one 400/500/600/700 ladder', () => {
    expect(cssTokenDefault('--oc-title-weight', 'light')).toBe(
      String(DEFAULT_THEME.chrome.title.fontWeight),
    );
    expect(cssTokenDefault('--oc-subtitle-weight', 'light')).toBe(
      String(DEFAULT_THEME.chrome.subtitle.fontWeight),
    );
    expect(cssTokenDefault('--oc-source-weight', 'light')).toBe(
      String(DEFAULT_THEME.chrome.source.fontWeight),
    );
    expect(cssTokenDefault('--oc-eyebrow-weight', 'light')).toBe(
      String(DEFAULT_THEME.chrome.eyebrow.fontWeight),
    );
  });

  it('border radius matches the theme', () => {
    expect(cssTokenDefault('--oc-border-radius', 'light')).toBe(`${DEFAULT_THEME.borderRadius}px`);
  });

  it('the neutral ramp matches the gray tokens in both modes', () => {
    for (const [mode, theme] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const n = theme.colors.neutral;
      expect(cssTokenDefault('--oc-gray-100', mode)).toBe(n[100]);
      expect(cssTokenDefault('--oc-gray-200', mode)).toBe(n[200]);
      expect(cssTokenDefault('--oc-gray-300', mode)).toBe(n[300]);
      expect(cssTokenDefault('--oc-gray-400', mode)).toBe(n[400]);
      expect(cssTokenDefault('--oc-gray-600', mode)).toBe(n[600]);
      expect(cssTokenDefault('--oc-gray-800', mode)).toBe(n[800]);
      expect(cssTokenDefault('--oc-text-secondary', mode)).toBe(n.secondary);
      expect(cssTokenDefault('--oc-text-faint', mode)).toBe(n.faint);
      expect(cssTokenDefault('--oc-border', mode)).toBe(n.border);
      expect(cssTokenDefault('--oc-bg', mode)).toBe(n.surface);
    }
  });

  it('an opaque custom surface derives its own ramp instead of the static one', () => {
    // The default background is transparent, so the ramp falls back to the
    // static tokens (which is what makes the parity above exact). A theme with
    // a real surface derives grays from its own text/background pair.
    const warm = resolveTheme({ colors: { background: '#fffdf9', text: '#171513' } });
    expect(warm.colors.neutral[600]).not.toBe(cssTokenDefault('--oc-gray-600', 'light'));
    expect(warm.colors.neutral.secondary).toBe(warm.colors.neutral[800]);
  });

  it('surface is the theme background whenever that background paints', () => {
    const warm = resolveTheme({ colors: { background: '#fffdf9', text: '#171513' } });
    expect(warm.colors.neutral.surface).toBe('#fffdf9');
    // Transparent themes take the mode's canvas token instead.
    expect(light.colors.neutral.surface).toBe(cssTokenDefault('--oc-bg', 'light'));
    expect(dark.colors.neutral.surface).toBe(cssTokenDefault('--oc-bg', 'dark'));
  });
});
