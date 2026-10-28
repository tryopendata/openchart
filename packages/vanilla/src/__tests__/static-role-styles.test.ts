import {
  adaptTheme,
  type ChartSpec,
  isBarListSpec,
  isLayerSpec,
  type ResolvedTheme,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { compileBarList, compileChart, compileLayer } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { lineSpec } from '../__test-fixtures__/specs';
import { renderBarListSVG } from '../barlist-renderer';
import { createIdScope, createRenderContext } from '../render-context';
import { applyRoleStyle, SVG_NS } from '../renderers/svg-dom';
import { renderStaticSVG } from '../static';
import { staticFactory } from '../static-dom';
import { renderChartSVG } from '../svg-renderer';
import { buildThemeStyleBlock } from '../theme-style-block';
import { staticPlatformSpecs } from './__fixtures__/static-platform-specs';
import { siteSpecs } from './__fixtures__/static-specs';

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

// Close endpoints with opted-in leaders: the renderer writes the series color as a
// `stroke` attribute, which the `.oc-endpoint-leader` class rule overrides live.
const leaderSpec: ChartSpec = {
  ...lineSpec,
  data: [
    { date: '2020', value: 10, country: 'US' },
    { date: '2021', value: 40, country: 'US' },
    { date: '2020', value: 5, country: 'UK' },
    { date: '2021', value: 39.5, country: 'UK' },
  ],
  endpointLabels: { showLeader: true },
};
type FigureSpec = Parameters<typeof renderStaticSVG>[0];
const figures: Record<string, FigureSpec> = {
  leader: leaderSpec,
  ...Object.fromEntries(
    Object.entries(staticPlatformSpecs).filter(([name]) => name !== 'map' && name !== 'tilemap'),
  ),
  ...Object.fromEntries(Object.entries(siteSpecs).map(([name, spec]) => [`site-${name}`, spec])),
};
const inherited = ['fill', 'stroke', 'font-family', 'font-size', 'font-weight'];
const cascaded = [...inherited, 'letter-spacing', 'text-transform', 'font-variant-numeric'];
function declarations(style: string | null): Map<string, string> {
  return new Map(
    (style ?? '').split(';').flatMap((part) => {
      const colon = part.indexOf(':');
      return colon < 0 ? [] : [[part.slice(0, colon).trim(), part.slice(colon + 1).trim()]];
    }),
  );
}
/** The live tree: the same renderer without static inlining, styled by the theme block. */
function renderLive(spec: FigureSpec, width: number, height: number, darkMode: boolean) {
  const compileOpts = { width, height, darkMode, onWarn: () => {} };
  const context = createRenderContext({ ids: createIdScope('live'), interactive: false });
  if (isBarListSpec(spec)) {
    const layout = compileBarList({ ...spec, height: spec.height ?? 'auto' }, compileOpts);
    return { svg: renderBarListSVG(layout, { animate: false, context }), theme: layout.theme };
  }
  const layout = isLayerSpec(spec)
    ? compileLayer(spec, compileOpts)
    : compileChart(spec as ChartSpec, compileOpts);
  const svg = renderChartSVG(layout, document.createElement('div'), {
    animate: false,
    crosshair: false,
    context,
  });
  return { svg, theme: layout.theme };
}
describe('static role styles match the cascade on fully rendered figures', () => {
  for (const [name, spec] of Object.entries(figures))
    for (const darkMode of ['off', 'force'] as const)
      it(`${name} ${darkMode}`, () => {
        const cell = 'display' in spec && spec.display === 'sparkline';
        // Sizes of the goldens: site figures at 680x320, platform fixtures at 640x420.
        const site = name.startsWith('site-');
        const width = cell ? 120 : name === 'legend-notes' ? 330 : site ? 680 : 640;
        const height = cell ? 16 : site ? 320 : 420;
        const live = renderLive(spec, width, height, darkMode === 'force');
        const theme: ResolvedTheme = live.theme;
        const css = buildThemeStyleBlock(theme);
        const rules = css
          .split('}')
          .filter((rule) => rule.includes('{'))
          .map((rule) => {
            const [selector, body] = rule.split('{');
            return { selector: selector.trim(), body: declarations(body) };
          });
        const style = document.createElement('style');
        style.textContent = css;
        const probe = document.createElementNS(SVG_NS, 'svg');
        probe.style.color = theme.colors.text;
        const probeText = probe.appendChild(document.createElementNS(SVG_NS, 'text'));
        (live.svg as unknown as SVGElement).style.color = theme.colors.text;
        document.body.append(style, live.svg, probe);
        try {
          const normalize = (property: string, value: string) => {
            if (/^currentcolor$/i.test(value)) value = theme.colors.text;
            if (property === 'font-size' && /^[\d.]+$/.test(value)) value = `${value}px`;
            probeText.style.cssText = '';
            probeText.style.setProperty(property, value);
            return getComputedStyle(probeText).getPropertyValue(property) || value;
          };
          // What a browser paints live: inline style, then a matching class rule,
          // then the presentation attribute, then the parent's value.
          const expected = (el: Element, property: string): string | undefined => {
            const inline = declarations(el.getAttribute('style')).get(property);
            if (inline) return getComputedStyle(el).getPropertyValue(property);
            if (rules.some((rule) => rule.body.has(property) && el.matches(rule.selector)))
              return getComputedStyle(el).getPropertyValue(property);
            const attribute = el.getAttribute(property);
            if (attribute !== null) return attribute;
            return el.parentElement && el !== live.svg && inherited.includes(property)
              ? expected(el.parentElement, property)
              : undefined;
          };
          // Static output carries no stylesheet: inline style, attribute, parent.
          const actual = (el: Element, property: string): string | undefined =>
            declarations(el.getAttribute('style')).get(property) ??
            el.getAttribute(property) ??
            (el.parentElement && inherited.includes(property)
              ? actual(el.parentElement, property)
              : undefined);
          const output = new DOMParser().parseFromString(
            renderStaticSVG(spec, { darkMode, width, height }),
            'image/svg+xml',
          ).documentElement;
          const liveNodes = [live.svg, ...live.svg.querySelectorAll('*')];
          const staticNodes = [output, ...output.querySelectorAll('*')];
          expect(staticNodes.map((el) => el.tagName)).toEqual(liveNodes.map((el) => el.tagName));
          let checked = 0;
          liveNodes.forEach((el, i) => {
            for (const property of cascaded) {
              const want = expected(el, property);
              if (want === undefined) continue;
              const got = actual(staticNodes[i], property);
              const label = `${el.tagName}.${el.getAttribute('class') ?? ''} ${property}`;
              expect(got && normalize(property, got), label).toBe(normalize(property, want));
              checked++;
            }
          });
          expect(checked).toBeGreaterThan(0);
          if (name === 'chrome')
            expect(
              live.svg.querySelector('.oc-eyebrow-dot'),
              'fixture draws chrome',
            ).not.toBeNull();
          if (name === 'leader')
            expect(
              live.svg.querySelector('.oc-endpoint-leader'),
              'fixture draws a leader',
            ).not.toBeNull();
        } finally {
          live.svg.remove();
          probe.remove();
          style.remove();
        }
      });
});
