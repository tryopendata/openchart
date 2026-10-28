import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { applyRoleStyle, SVG_NS } from '../renderers/svg-dom';
import { renderStaticSVG } from '../static';
import { staticFactory } from '../static-dom';
import { buildThemeStyleBlock } from '../theme-style-block';

const roles = [
  'oc-chrome',
  'oc-eyebrow',
  'oc-title',
  'oc-subtitle',
  'oc-source',
  'oc-byline',
  'oc-footer',
  'oc-brand',
  'oc-eyebrow-dot',
  'oc-metrics',
  'oc-metric-label',
  'oc-metric-value',
  'oc-metric-delta-up',
  'oc-metric-delta-down',
  'oc-metric-secondary',
  'oc-axis-tick-inline',
  'oc-endpoint-labels',
  'oc-endpoint-label',
  'oc-endpoint-value',
  'oc-endpoint-leader',
  'oc-annotation-subtitle',
  'oc-legend',
];
const properties = [
  'fill',
  'stroke',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-transform',
  'font-variant-numeric',
];
describe('static role styles match the exported cascade', () => {
  for (const dark of [false, true])
    it(`resolves all roles in ${dark ? 'dark' : 'light'} mode with theme overrides`, () => {
      const base = resolveTheme({
        colors: { text: '#123456', axis: '#456789' },
        fonts: { family: 'serif', sizes: { body: 17 } },
        chrome: { title: { fontSize: 31, fontWeight: 700 } },
      });
      const theme = dark ? adaptTheme(base) : base;
      const style = document.createElement('style');
      style.textContent = buildThemeStyleBlock(theme);
      const root = document.createElementNS(SVG_NS, 'svg');
      root.classList.add('oc-chart');
      root.style.color = theme.colors.text;
      document.body.append(style, root);
      try {
        for (const role of roles) {
          const live = document.createElementNS(SVG_NS, 'text');
          live.classList.add(role);
          root.appendChild(live);
          const output = staticFactory.svg('text');
          applyRoleStyle({ theme }, output, role);
          // happy-dom does not compute SVG presentation attributes. Mirror them as
          // inline declarations solely for its computed-style comparison.
          const comparable = document.createElementNS(SVG_NS, 'text');
          for (const property of properties) {
            const value = output.style.getPropertyValue(property) || output.getAttribute(property);
            if (value)
              comparable.style.setProperty(
                property,
                property === 'font-size' && /^\d+$/.test(value) ? `${value}px` : value,
              );
          }
          root.appendChild(comparable);
          const actual = getComputedStyle(comparable),
            expected = getComputedStyle(live);
          for (const property of properties) {
            if (!output.hasAttribute(property) && !output.style.getPropertyValue(property))
              continue;
            const expectedValue = expected.getPropertyValue(property);
            const actualValue = actual.getPropertyValue(property);
            expect(actualValue, `${role} ${property}`).toBe(
              expectedValue === 'currentColor' ? theme.colors.text : expectedValue,
            );
          }
        }
      } finally {
        root.remove();
        style.remove();
      }
    });
  it('preserves authored role colors and type sizes', () => {
    const theme = resolveTheme();
    const el = staticFactory.svg('text');
    el.setAttribute('fill', '#abcdef');
    el.setAttribute('font-size', '29');
    el.style.setProperty('fill', '#fedcba');
    applyRoleStyle({ theme }, el, 'oc-endpoint-label');
    applyRoleStyle({ theme }, el, 'oc-title');
    expect(el.getAttribute('fill')).toBe('#abcdef');
    expect(el.getAttribute('font-size')).toBe('29');
    expect(el.style.fill).toBe('#fedcba');
  });
  it('scopes map root declarations and descendant selectors to each prefixed figure', () => {
    const host = document.createElement('div');
    for (const [idPrefix, darkMode] of [
      ['light.1', 'off'],
      ['dark', 'force'],
    ] as const) {
      const doc = new DOMParser().parseFromString(
        renderStaticSVG(geoLabelSpec, { idPrefix, darkMode }),
        'image/svg+xml',
      );
      host.appendChild(document.importNode(doc.documentElement, true));
    }
    document.body.appendChild(host);
    try {
      const light = host.querySelector('[id="light.1-oc-root"]')!,
        dark = host.querySelector('#dark-oc-root')!;
      expect(getComputedStyle(light).getPropertyValue('--oc-text')).not.toBe(
        getComputedStyle(dark).getPropertyValue('--oc-text'),
      );
      expect(getComputedStyle(light).getPropertyValue('font-variant-numeric')).toBe('tabular-nums');
      expect(getComputedStyle(dark).getPropertyValue('font-variant-numeric')).toBe('tabular-nums');
      expect(light.querySelector('style')!.textContent).toContain('svg.oc-map#light\\.1-oc-root');
    } finally {
      host.remove();
    }
  });
});
