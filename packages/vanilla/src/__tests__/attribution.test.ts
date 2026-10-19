import { computeChrome, type GraphSpec, resolveTheme } from '@opendata-ai/openchart-core';
import { compileGraph, compileTable } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { createGraphShell } from '../graph/shell';
import { createAttributionFooter } from '../renderers/attribution-footer';
import { renderAttributionBrand } from '../renderers/brand';

const chrome = {
  source: 'Source: Official statistics',
  byline: 'By Research Team',
  footer: 'Methods: sample data',
  brand: { text: 'Our research\nOpen methods', style: { fontSize: 20 } },
};
describe('shared attribution painting', () => {
  it('paints a custom brand without adding an OpenData watermark', () => {
    const resolved = computeChrome(chrome, resolveTheme(), 390);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    renderAttributionBrand(svg, resolved, 200);
    expect(svg.querySelector('.oc-brand')?.getAttribute('y')).toBe(
      String(200 + resolved.brand!.y + 20 * 0.8),
    );
    expect(svg.textContent).toContain('Our research');
    expect(svg.querySelector('.oc-chrome-ref')).toBeNull();
  });
  it('paints the default mark at its measured size and never hides it only on mobile', () => {
    for (const width of [180, 390, 1280]) {
      const resolved = computeChrome({ source: 'Source' }, resolveTheme(), width);
      const footer = createAttributionFooter(resolved, width)!;
      expect((footer.querySelector('.oc-watermark') as SVGElement)?.style.fontSize).toBe('12px');
      expect(footer.querySelector('a')?.getAttribute('href')).toBe('https://tryopendata.ai');
    }
  });
  it('table compilation preserves byline, custom brand and exact portable styles', () => {
    const layout = compileTable(
      { type: 'table', data: [{ name: 'A' }], columns: [{ key: 'name' }], chrome },
      { width: 390, height: 400 },
    );
    const footer = createAttributionFooter(layout.chrome, layout.width!)!;
    expect(footer.querySelector('.oc-byline')?.textContent).toBe('By Research Team');
    expect((footer.querySelector('.oc-brand') as SVGElement)?.style.fontSize).toBe('20px');
    expect(footer.querySelector('.oc-watermark')).toBeNull();
  });
  it('graph shell reserves source/custom-brand space and replaces its footer on update', () => {
    const spec: GraphSpec = { type: 'graph', nodes: [{ id: 'a' }], edges: [], chrome };
    const compilation = compileGraph(spec, { width: 390, height: 400 });
    const container = document.createElement('div');
    container.getBoundingClientRect = () => ({ width: 390, height: 400 }) as DOMRect;
    const shell = createGraphShell(container, spec, compilation, { autoResize: false }, () => {});
    shell.renderChrome(compilation);
    expect(shell.getSize().height).toBe(400 - compilation.chrome.bottomHeight);
    expect(container.querySelector('.oc-byline')?.textContent).toBe('By Research Team');
    const next = compileGraph(
      { ...spec, chrome: { source: 'Updated source' }, watermark: false },
      { width: 390, height: 400 },
    );
    shell.renderChrome(next);
    expect(container.querySelectorAll('.oc-attribution-footer')).toHaveLength(1);
    expect(container.textContent).toContain('Updated source');
    expect(container.querySelector('.oc-brand')).toBeNull();
    shell.destroy();
    expect(container.childElementCount).toBe(0);
  });
});
