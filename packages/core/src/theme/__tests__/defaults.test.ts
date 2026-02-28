import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../colors/contrast';
import { DEFAULT_THEME } from '../defaults';

describe('DEFAULT_THEME', () => {
  it('has all required top-level fields', () => {
    expect(DEFAULT_THEME.colors).toBeDefined();
    expect(DEFAULT_THEME.fonts).toBeDefined();
    expect(DEFAULT_THEME.spacing).toBeDefined();
    expect(DEFAULT_THEME.borderRadius).toBeDefined();
    expect(DEFAULT_THEME.chrome).toBeDefined();
  });

  it('uses Inter as primary font', () => {
    expect(DEFAULT_THEME.fonts.family).toContain('Inter');
  });

  it('title is 22px bold', () => {
    expect(DEFAULT_THEME.chrome.title.fontSize).toBe(22);
    expect(DEFAULT_THEME.chrome.title.fontWeight).toBe(700);
  });

  it('subtitle is 15px normal weight', () => {
    expect(DEFAULT_THEME.chrome.subtitle.fontSize).toBe(15);
    expect(DEFAULT_THEME.chrome.subtitle.fontWeight).toBe(400);
  });

  it('source is 12px normal weight', () => {
    expect(DEFAULT_THEME.chrome.source.fontSize).toBe(12);
    expect(DEFAULT_THEME.chrome.source.fontWeight).toBe(400);
  });

  it('categorical palette has sufficient contrast on white background', () => {
    const bg = DEFAULT_THEME.colors.background;
    for (const color of DEFAULT_THEME.colors.categorical) {
      const ratio = contrastRatio(color, bg);
      // AA for large text is 3:1. Some editorial palette colors may not
      // hit 4.5:1 on pure white, but they should all clear 3:1.
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('has sequential and diverging palette entries', () => {
    expect(Object.keys(DEFAULT_THEME.colors.sequential).length).toBeGreaterThan(0);
    expect(Object.keys(DEFAULT_THEME.colors.diverging).length).toBeGreaterThan(0);
  });
});
