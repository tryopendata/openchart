import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { barSpec, lineSpec } from '../__test-fixtures__/specs';
import { createIdScope } from '../render-context';
import { renderStaticSVG } from '../static';
import { roundGeometryValue, StaticElement, StaticText, serialize } from '../static-dom';
import { renderStaticParts } from '../static-render';

describe('DOM-free static rendering', () => {
  it('renders fixture goldens without a DOM', async () => {
    const { staticPlatformSpecs } = await import('./__fixtures__/static-platform-specs');
    for (const [name, spec] of Object.entries(staticPlatformSpecs))
      for (const darkMode of ['off', 'force'] as const) {
        const actual = renderStaticSVG(spec, {
          darkMode,
          idPrefix: name,
          precision: 3,
          width: name === 'legend-notes' ? 330 : 640,
        });
        expect(actual).toBe(
          readFileSync(
            path.join(import.meta.dirname, '__snapshots__/static', `${name}-${darkMode}.svg`),
            'utf8',
          ),
        );
      }
  });
  it('never reads or replaces browser globals, including during recursive measurement', () => {
    expect(globalThis.document).toBeUndefined();
    expect(globalThis.window).toBeUndefined();
    let nested = false;
    const svg = renderStaticSVG(lineSpec, {
      measureText: (text, size) => {
        if (!nested) {
          nested = true;
          expect(renderStaticSVG(barSpec)).toContain('<svg');
        }
        return { width: (text.length * size) / 2, height: size };
      },
    });
    expect(svg).toContain('<svg');
    expect(nested).toBe(true);
    expect(globalThis.document).toBeUndefined();
    expect(globalThis.window).toBeUndefined();
  });
  it('keeps paused renders and A-B-A render order independent', async () => {
    const a = renderStaticParts(lineSpec, { idPrefix: 'a' });
    await Promise.resolve();
    const b = renderStaticParts(barSpec, { idPrefix: 'b' });
    await Promise.resolve();
    expect(a.serialize()).toBe(renderStaticSVG(lineSpec, { idPrefix: 'a' }));
    expect(b.serialize()).toBe(renderStaticSVG(barSpec, { idPrefix: 'b' }));
    const before = renderStaticSVG(lineSpec);
    renderStaticSVG(barSpec);
    expect(renderStaticSVG(lineSpec)).toBe(before);
  });
  it('gives each static id scope an independent monotonic sequence', () => {
    const a = createIdScope('a'),
      b = createIdScope('b');
    expect(a.next('oc-clip')).toBe('a-oc-clip-0');
    expect(b.next('oc-clip')).toBe('b-oc-clip-0');
    expect(a.next('oc-grad')).toBe('a-oc-grad-1');
  });
  it.each(['table', 'graph', 'sankey'])('names unsupported %s specs', (type) => {
    expect(() => renderStaticSVG({ type } as never)).toThrow(
      `renderStaticSVG does not render "${type}"; supported: chart, layer, barlist, tilemap, geomap`,
    );
  });
  it('escapes XML text and attributes while preserving non-breaking spaces', () => {
    const root = new StaticElement('svg');
    root.setAttribute('aria-label', '&"<>\t\n\r');
    root.appendChild(new StaticText('&<>\u00a0'));
    expect(serialize(root)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" aria-label="&amp;&quot;&lt;&gt;&#9;&#10;&#13;">&amp;&lt;&gt;\u00a0</svg>',
    );
  });
  it.each([
    ['M1-0.0001', 'M1 0'],
    ['M.5.5', 'M0.5 0.5'],
    ['M1e-8-2', 'M0 -2'],
    ['translate(-0.0001,1.23456)', 'translate(0,1.235)'],
  ])('keeps number boundaries in %s', (input, expected) => {
    expect(roundGeometryValue(input, 3)).toBe(expected);
    expect(roundGeometryValue(input, null)).toBe(input);
  });
  it('rounds unitless geometry but keeps unit lengths such as em baseline shifts', () => {
    const root = new StaticElement('svg');
    const text = root.appendChild(new StaticElement('text'));
    text.setAttribute('x', '10.46');
    text.setAttribute('dy', '0.35em');
    text.appendChild(new StaticElement('tspan')).setAttribute('dx', '0.71em');
    root.appendChild(new StaticElement('rect')).setAttribute('width', '12.5%');
    expect(serialize(root, { precision: 0 })).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" dy="0.35em"><tspan dx="0.71em"/></text><rect width="12.5%"/></svg>',
    );
    expect(roundGeometryValue('0.71em', 1)).toBe('0.71em');
    expect(roundGeometryValue('M1.26 2.24L3.25 4Z', 1)).toBe('M1.3 2.2L3.3 4Z');
  });
  it('matches descendant and child combinators like the DOM', () => {
    const root = new StaticElement('svg');
    const group = root.appendChild(new StaticElement('g'));
    group.setAttribute('class', 'oc-legend');
    const inner = group.appendChild(new StaticElement('g'));
    const text = inner.appendChild(new StaticElement('text'));
    text.setAttribute('data-label', 'a b > c');
    expect(root.querySelectorAll('svg > g').length).toBe(1);
    expect(root.querySelectorAll('.oc-legend > g')).toEqual([inner]);
    expect(root.querySelectorAll('.oc-legend>text')).toEqual([]);
    expect(root.querySelectorAll('.oc-legend text')).toEqual([text]);
    expect(root.querySelectorAll('svg > g > g > text')).toEqual([text]);
    expect(text.matches('g > [data-label="a b > c"]')).toBe(true);
    expect(text.closest('svg > .oc-legend')).toBe(group);
    expect(() => root.querySelectorAll('g + g')).toThrow('Unsupported static selector');
  });
  it('serializes styles and namespace transitions in declaration order', () => {
    const root = new StaticElement('svg');
    root.style.height = '20px';
    root.style.setProperty('pointer-events', 'none');
    const foreign = root.appendChild(new StaticElement('foreignObject'));
    foreign.appendChild(new StaticElement('div', 'http://www.w3.org/1999/xhtml')).textContent =
      'content';
    expect(serialize(root)).toContain('style="height: 20px; pointer-events: none;"');
    expect(serialize(root)).toContain('<div xmlns="http://www.w3.org/1999/xhtml">content</div>');
  });
  it('keeps the static-path style-write inventory explicit', () => {
    const sourceRoot = path.resolve(import.meta.dirname, '..');
    const paths = [
      'static.ts',
      'static-render.ts',
      'svg-renderer.ts',
      'barlist-renderer.ts',
      'theme-tokens.ts',
      'map-renderer.ts',
      'map-camera.ts',
      'map-view-renderer.ts',
      'map-labels.ts',
      'map-color-key.ts',
      'tilemap-renderer.ts',
      'gradient-utils.ts',
      'pattern-utils.ts',
      ...readdirSync(path.join(sourceRoot, 'renderers'))
        .filter((name) => name.endsWith('.ts') && !name.startsWith('table'))
        .map((name) => `renderers/${name}`),
    ];
    const writing = paths
      .filter((file) => /\.style\b/.test(readFileSync(path.join(sourceRoot, file), 'utf8')))
      .sort();
    expect(writing).toEqual([
      'barlist-renderer.ts',
      'map-labels.ts',
      'map-renderer.ts',
      'map-view-renderer.ts',
      'renderers/annotations.ts',
      'renderers/attribution-footer.ts',
      'renderers/chrome.ts',
      'renderers/endpoint-labels.ts',
      'renderers/legend.ts',
      'renderers/marks.ts',
      'renderers/svg-dom.ts',
      'static-render.ts',
      'svg-renderer.ts',
      'theme-tokens.ts',
      'tilemap-renderer.ts',
    ]);
  });
  it('has no legacy global rendering or id state', () => {
    const sourceRoot = path.resolve(import.meta.dirname, '..');
    const files = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() && !entry.name.startsWith('__')
          ? files(path.join(directory, entry.name))
          : entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
            ? [path.join(directory, entry.name)]
            : [],
      );
    for (const file of files(sourceRoot)) {
      if (file.endsWith('svg-ids.ts') || file.endsWith('render-context.ts')) continue;
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /\b(?:nextSvgId|setMarkRenderState|resetSvgIdCounter)\s*\(/,
      );
    }
  });
});
