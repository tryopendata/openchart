import type { LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { barSpec, lineSpec, pieSpec } from '../__test-fixtures__/specs';
import { renderStaticSVG } from '../static';

describe('renderStaticSVG', () => {
  it('returns a valid SVG string', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox');
  });

  it('produces byte-identical output for the same spec', () => {
    const first = renderStaticSVG(lineSpec, { width: 640, height: 420 });
    const second = renderStaticSVG(lineSpec, { width: 640, height: 420 });
    expect(first).toBe(second);
  });

  it('includes a11y attributes', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).toContain('role=');
    expect(svg).toContain('aria-label=');
  });

  it('does not contain interactive elements', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).not.toContain('data-voronoi-overlay');
    expect(svg).not.toContain('data-crosshair');
    expect(svg).not.toContain('data-snap-dots');
  });

  it('does not contain animation classes', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).not.toContain('oc-animate');
  });

  it('includes the inlined style block with theme values', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).toContain('<style');
    expect(svg).toContain('.oc-brand-dot');
  });

  it('scopes custom properties to svg.oc-chart, not :root', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).toContain('svg.oc-chart');
    expect(svg).not.toContain(':root');
  });

  it('uses var() references in class rules for theme overridability', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).toContain('fill: var(--oc-accent)');
    expect(svg).toContain('fill: var(--oc-text)');
    expect(svg).toContain('fill: var(--oc-text-muted)');
    expect(svg).toContain('font-family: var(--oc-font-family)');
    expect(svg).not.toMatch(/\.oc-brand-dot \{ fill: #[0-9a-f]{6}/i);
  });

  it('renders bar charts', () => {
    const svg = renderStaticSVG(barSpec);
    expect(svg).toContain('oc-mark-rect');
  });

  it('renders pie charts', () => {
    const svg = renderStaticSVG(pieSpec);
    expect(svg).toContain('oc-mark-arc');
  });

  it('renders layer specs', () => {
    const layerSpec: LayerSpec = {
      layer: [
        {
          mark: 'line',
          data: [
            { x: '2020', y: 10 },
            { x: '2021', y: 20 },
          ],
          encoding: {
            x: { field: 'x', type: 'temporal' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        {
          mark: 'point',
          data: [
            { x: '2020', y: 10 },
            { x: '2021', y: 20 },
          ],
          encoding: {
            x: { field: 'x', type: 'temporal' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
      ],
    };
    const svg = renderStaticSVG(layerSpec);
    expect(svg).toContain('<svg');
    expect(svg).toContain('oc-mark-line');
  });

  it('respects explicit width and height', () => {
    const svg = renderStaticSVG(lineSpec, { width: 800, height: 500 });
    expect(svg).toContain('viewBox="0 0 800 500"');
  });

  it('renders dark mode when darkMode is "force"', () => {
    const light = renderStaticSVG(lineSpec, { darkMode: 'off' });
    const dark = renderStaticSVG(lineSpec, { darkMode: 'force' });
    expect(light).not.toBe(dark);
  });

  it('renders chrome elements', () => {
    const svg = renderStaticSVG(lineSpec);
    expect(svg).toContain('GDP Growth');
    expect(svg).toContain('US vs UK over time');
    expect(svg).toContain('World Bank');
  });

  it('produces deterministic IDs across calls', () => {
    const first = renderStaticSVG(lineSpec, { width: 640, height: 420 });
    const second = renderStaticSVG(lineSpec, { width: 640, height: 420 });
    const idPattern = /id="oc-[a-z]+-\d+"/g;
    const firstIds = first.match(idPattern) ?? [];
    const secondIds = second.match(idPattern) ?? [];
    expect(firstIds).toEqual(secondIds);
    expect(firstIds.length).toBeGreaterThan(0);
  });

  it('does not pollute global document or window after rendering', () => {
    const docBefore = globalThis.document;
    const winBefore = globalThis.window;
    renderStaticSVG(lineSpec);
    expect(globalThis.document).toBe(docBefore);
    expect(globalThis.window).toBe(winBefore);
  });

  it('suppresses watermark when watermark is false', () => {
    const svg = renderStaticSVG(lineSpec, { watermark: false });
    expect(svg).not.toContain('oc-brand-text');
  });

  // renderChartSVG keys ONLY on its own `canvasMarks` option, never on
  // layout.markRenderMode. Without that rule, promoting a layout to canvas
  // mode would strip points, background, and gridlines from every SSR render
  // -- there is no canvas element in the static path to paint them.
  it('renders full SVG marks for a high point count regardless of render mode', () => {
    const svg = renderStaticSVG({
      mark: 'point',
      data: Array.from({ length: 1500 }, (_, i) => ({ x: i, y: (i * 7) % 100 })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    });
    expect(svg).toContain('oc-mark-point');
    expect(svg).toContain('oc-gridline');
  });

  it('renders full SVG marks even when the spec explicitly asks for canvas', () => {
    const svg = renderStaticSVG({
      mark: { type: 'point', render: 'canvas' },
      data: Array.from({ length: 50 }, (_, i) => ({ x: i, y: (i * 7) % 100 })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    });
    expect(svg).toContain('oc-mark-point');
    expect(svg).toContain('oc-gridline');
    expect(svg).not.toContain('oc-mark-canvas');
  });
});
