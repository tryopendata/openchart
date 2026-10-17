import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { stampThemeProperties } from '../theme-tokens';

describe('authored CSS theme tokens', () => {
  it('leaves unauthored tokens available to host CSS, including border radius', () => {
    const el = document.createElement('div');
    stampThemeProperties(el, resolveTheme());
    expect(el.style.getPropertyValue('--oc-border-radius')).toBe('');
    expect(el.style.getPropertyValue('--oc-text')).toBe('');
    expect(el.style.getPropertyValue('--oc-font-family')).toBe('');
  });
  it('stamps authored leaves and their derived values, then restores host inline overrides', () => {
    const el = document.createElement('div');
    el.style.setProperty('--oc-border-radius', '20px');
    stampThemeProperties(
      el,
      resolveTheme({
        borderRadius: 2,
        fonts: { sizes: { title: 31 } },
        colors: { background: '#faf8f5' },
      }),
    );
    expect(el.style.getPropertyValue('--oc-border-radius')).toBe('2px');
    expect(el.style.getPropertyValue('--oc-title-size')).toBe('31px');
    expect(el.style.getPropertyValue('--oc-bg')).toBe('#faf8f5');
    expect(el.style.getPropertyValue('--oc-annotation-plate')).toBe('#faf8f5');
    expect(el.style.getPropertyValue('--oc-border')).not.toBe('');
    expect(el.style.getPropertyValue('--oc-source-size')).toBe('');
    stampThemeProperties(el, adaptTheme(resolveTheme()));
    expect(el.style.getPropertyValue('--oc-border-radius')).toBe('20px');
    expect(el.style.getPropertyValue('--oc-bg')).toBe('');
    expect(el.style.getPropertyValue('--oc-title-size')).toBe('');
    expect(el.classList.contains('oc-dark')).toBe(true);
  });
});
