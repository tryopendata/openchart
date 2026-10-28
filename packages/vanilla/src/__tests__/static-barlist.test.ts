import { describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createBarList } from '../barlist-mount';
import { renderStaticSVG } from '../static';
import { barlistSpec, siteSpecs, stepRows } from './__fixtures__/static-specs';

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');
describe('static grouped bar lists', () => {
  for (const name of ['stepFailures', 'keptAttach', 'lift'] as const)
    for (const darkMode of ['off', 'force'] as const)
      it(`${name} ${darkMode}`, async () => {
        const spec = siteSpecs[name];
        const svg = renderStaticSVG(spec, { idPrefix: name, darkMode });
        const doc = parse(svg);
        expect(doc.documentElement.getAttribute('role')).toBe('img');
        expect(doc.documentElement.getAttribute('aria-label')).toBe(
          'Published rates carry their interval and effective sample.',
        );
        expect(doc.querySelector('[role="list"], [role="listitem"], [tabindex]')).toBeNull();
        expect(svg).not.toContain('currentColor');
        expect(svg).not.toContain('--oc-');
        expect(doc.querySelectorAll('rect[data-mark="bar"] title').length).toBeGreaterThan(0);
        await expect(svg).toMatchFileSnapshot(
          `./__snapshots__/static/barlist-${name}-${darkMode}.svg`,
        );
      });
  it('retains the full label tooltip while rendering an ellipsis and dashed value refline', () => {
    const svg = renderStaticSVG(
      barlistSpec(stepRows, { annotations: [{ type: 'refline', x: 0.2, style: 'dashed' }] }),
    );
    const doc = parse(svg);
    expect(doc.querySelector('.oc-barlist-label title')?.textContent).toBe(stepRows[0].step);
    expect(doc.querySelector('.oc-barlist-label text')?.textContent).toMatch(/…$/);
    const rule = doc.querySelector('.oc-barlist-refline')!;
    expect(rule.hasAttribute('stroke-dasharray')).toBe(true);
    expect(Number(rule.getAttribute('y2'))).toBeGreaterThan(Number(rule.getAttribute('y1')));
    expect(
      doc.querySelector('rect[data-mark="bar"][data-step]')?.querySelector('title'),
    ).not.toBeNull();
  });
  it('defaults static height to auto, fits every row and respects hidden accessibility', () => {
    const data = Array.from({ length: 14 }, (_, i) => ({
      step: `Row ${i}`,
      share: i / 20,
      group: i < 7 ? 'steps' : 'env',
      rowText: `Row ${i}`,
    }));
    const svg = renderStaticSVG(barlistSpec(data, { a11y: { hidden: true } }));
    const doc = parse(svg);
    expect(doc.querySelectorAll('rect[data-mark="bar"]')).toHaveLength(14);
    expect(doc.documentElement.getAttribute('aria-hidden')).toBe('true');
    expect(doc.documentElement.hasAttribute('role')).toBe(false);
    expect(doc.documentElement.hasAttribute('aria-label')).toBe(false);
  });
  it('gives rows without authored descriptions a native fallback title', () => {
    const doc = parse(
      renderStaticSVG({
        type: 'barlist',
        data: [{ name: 'Alpha', count: 40 }],
        encoding: { label: { field: 'name' }, value: { field: 'count' } },
      }),
    );
    expect(doc.querySelector('rect[data-mark="bar"] title')?.textContent).toBe('Alpha: 40');
  });
  it('keeps hidden mounted lists outside keyboard navigation', () => {
    const container = createContainer();
    const instance = createBarList(
      container,
      barlistSpec(stepRows, { a11y: { hidden: true } }) as never,
      { autoResize: false },
    );
    try {
      expect(container.querySelector('[tabindex]')).toBeNull();
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      instance.destroy();
      container.remove();
    }
  });
  it('keeps list semantics on a live mount', () => {
    const container = createContainer();
    const instance = createBarList(container, barlistSpec(stepRows) as never, {
      autoResize: false,
    });
    try {
      expect(container.querySelector('svg')?.getAttribute('role')).toBe('list');
      expect(container.querySelector('[role="listitem"]')).not.toBeNull();
    } finally {
      instance.destroy();
      container.remove();
    }
  });
});
