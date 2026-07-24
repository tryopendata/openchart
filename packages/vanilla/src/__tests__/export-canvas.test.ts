/**
 * Exporting a chart that renders its dots on canvas.
 *
 * The on-screen SVG in canvas mode is missing background, gridlines and every
 * point, so the export path has to put them back. Two strategies, and the
 * governing property for the vector one is parity: exporting a canvas-mode
 * chart must produce the same bytes as exporting the SVG-mode twin.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { materializeCanvasModeSVG, VECTOR_EXPORT_MAX_POINTS } from '../export-canvas';
import { createChart } from '../mount';
import { type CanvasStub, stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';

let stub: CanvasStub;
let originalToDataURL: (() => string) | undefined;

/** A 1x1 transparent PNG, so the raster path has something to inline. */
const FAKE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

beforeEach(() => {
  stub = stubCanvas2D();
  // happy-dom implements no toDataURL. Without it every raster attempt bails
  // to the vector fallback and the raster tests would silently pass on the
  // wrong path.
  const proto = HTMLCanvasElement.prototype as unknown as { toDataURL?: () => string };
  originalToDataURL = proto.toDataURL;
  proto.toDataURL = () => FAKE_PNG;
});

afterEach(() => {
  stub.restore();
  const proto = HTMLCanvasElement.prototype as unknown as { toDataURL?: () => string };
  if (originalToDataURL) proto.toDataURL = originalToDataURL;
  else delete proto.toDataURL;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function scatter(n: number, render?: 'canvas' | 'svg'): ChartSpec {
  return {
    mark: render ? { type: 'point', render } : 'point',
    data: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: i, y: (i * 7) % 100 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      key: { field: 'id', type: 'nominal' },
    },
  };
}

function mount(spec: ChartSpec) {
  const container = createContainer(600, 400);
  return { container, chart: createChart(container, spec, { width: 600, height: 400 }) };
}

/** Generated ids use a monotonic counter, so normalize before comparing. */
const normalize = (s: string) => s.replace(/oc-(clip|grad|pattern)-\d+/g, 'oc-$1-N');

// These suites compile and mount charts with thousands of points, so individual
// tests legitimately run past a second. Vitest's 5s default sits close enough to
// that to flake when the rest of the suite is saturating the machine -- and a
// timeout here would read as a canvas bug rather than a busy runner.
vi.setConfig({ testTimeout: 20_000 });

describe('vector export (at or below the point cap)', () => {
  it('re-materializes the dots, gridlines and background the canvas took over', () => {
    const { container, chart } = mount(scatter(1000, 'canvas'));

    // Precondition: the on-screen SVG really is missing all three.
    const live = container.querySelector('svg') as SVGElement;
    expect(live.querySelectorAll('circle.oc-mark-point').length).toBe(0);
    expect(live.querySelectorAll('.oc-gridline').length).toBe(0);

    const out = chart.export('svg');
    expect((out.match(/class="[^"]*oc-mark-point/g) ?? []).length).toBe(1000);
    expect(out).toContain('oc-gridline');
    // Vector path: no raster inlined.
    expect(out).not.toContain('<image');

    chart.destroy();
  });

  it('is byte-identical to exporting the SVG-mode twin', () => {
    // The governing property. If these ever diverge, one of the two paths is
    // rendering something the other is not.
    const canvasChart = mount(scatter(1000, 'canvas'));
    const canvasOut = canvasChart.chart.export('svg');
    canvasChart.chart.destroy();

    const svgChart = mount(scatter(1000, 'svg'));
    const svgOut = svgChart.chart.export('svg');
    svgChart.chart.destroy();

    expect(normalize(canvasOut)).toBe(normalize(svgOut));
  });

  it('leaves SVG-mode export untouched', () => {
    const { chart } = mount(scatter(50, 'svg'));
    const out = chart.export('svg');
    expect(out).not.toContain('<image');
    expect((out.match(/class="[^"]*oc-mark-point/g) ?? []).length).toBe(50);
    chart.destroy();
  });

  it('does not disturb the live chart', () => {
    // Materialization renders into a detached host. The on-screen SVG must
    // still be the canvas-mode one afterwards.
    const { container, chart } = mount(scatter(1000, 'canvas'));
    chart.export('svg');

    const live = container.querySelector('svg') as SVGElement;
    expect(live.querySelectorAll('circle.oc-mark-point').length).toBe(0);
    expect(container.querySelectorAll('canvas.oc-mark-canvas').length).toBe(1);
    expect(container.querySelectorAll('svg').length).toBe(1);
    chart.destroy();
  });
});

describe('raster-mark export (above the point cap)', () => {
  it('inlines one image and emits no point circles', () => {
    const { chart } = mount(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'));
    const out = chart.export('svg');

    expect((out.match(/<image/g) ?? []).length).toBe(1);
    expect(out).not.toContain('oc-mark-point');
    chart.destroy();
  });

  it('keeps gridlines and the background vector', () => {
    // Only the dot cloud rasterizes. Axes, gridlines and text stay crisp.
    const { chart } = mount(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'));
    const out = chart.export('svg');

    expect(out).toContain('oc-gridline');
    expect(out).toContain('oc-axis');
    chart.destroy();
  });

  it('puts the raster under the overlays, not on top of them', () => {
    const layout = mount(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'));
    const out = layout.chart.export('svg');

    // The image must be the first child of the marks group, so anything the
    // group draws afterwards (trendline, labels) paints over it.
    const group = out.indexOf('data-oc-marks-group');
    const image = out.indexOf('<image', group);
    expect(group).toBeGreaterThanOrEqual(0);
    expect(image).toBeGreaterThan(group);
    // Nothing else between the group tag and the image but the tag's own close.
    expect(out.slice(group, image)).not.toContain('<g ');
    layout.chart.destroy();
  });

  it('marks the raster aria-hidden (the SR table carries the data)', () => {
    const { chart } = mount(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'));
    expect(chart.export('svg')).toMatch(/<image[^>]*aria-hidden="true"/);
    chart.destroy();
  });

  it('falls back to vector circles rather than throwing when no raster is possible', () => {
    // Environments without toDataURL (SSR, happy-dom without a stub) must
    // still get a usable file. A large one beats a blank plot.
    const proto = HTMLCanvasElement.prototype as unknown as { toDataURL?: () => string };
    const saved = proto.toDataURL;
    delete proto.toDataURL;
    try {
      const { chart } = mount(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'));
      let out = '';
      expect(() => {
        out = chart.export('svg');
      }).not.toThrow();
      expect(out).not.toContain('<image');
      expect((out.match(/class="[^"]*oc-mark-point/g) ?? []).length).toBe(
        VECTOR_EXPORT_MAX_POINTS + 1,
      );
      chart.destroy();
    } finally {
      if (saved) proto.toDataURL = saved;
    }
  });
});

describe('the cap boundary', () => {
  it('takes the vector path AT the cap and the raster path one past it', () => {
    const at = mount(scatter(VECTOR_EXPORT_MAX_POINTS, 'canvas'));
    expect(at.chart.export('svg')).not.toContain('<image');
    at.chart.destroy();

    const over = mount(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'));
    expect(over.chart.export('svg')).toContain('<image');
    over.chart.destroy();
  });
});

describe('raster formats always take the vector path', () => {
  // PNG/JPG/GIF rasterize the whole figure anyway, so the raster-marks
  // optimization buys them nothing and the vector path buys pixel-parity with
  // SVG mode for free. Probing via materializeCanvasModeSVG rather than
  // chart.export('png'), which needs a real Image decode happy-dom lacks.
  it('materializes full vector even far above the cap', () => {
    const layout = compileChart(scatter(VECTOR_EXPORT_MAX_POINTS + 500, 'canvas'), {
      width: 600,
      height: 400,
    });
    const svg = materializeCanvasModeSVG(layout, { forceVector: true });
    expect(svg.querySelector('image')).toBeNull();
    expect(svg.querySelectorAll('circle.oc-mark-point').length).toBe(
      VECTOR_EXPORT_MAX_POINTS + 500,
    );
    // And the background rect the canvas had taken over is back.
    expect(svg.querySelector('rect[fill]')).not.toBeNull();
  });
});

describe('forceVector', () => {
  const bigLayout = () =>
    compileChart(scatter(VECTOR_EXPORT_MAX_POINTS + 1, 'canvas'), { width: 600, height: 400 });

  it('takes the vector path above the cap when asked', () => {
    // Raster formats use this: they rasterize the whole figure anyway, so the
    // one-shot cost of a full vector SVG buys pixel-parity with SVG mode.
    const forced = materializeCanvasModeSVG(bigLayout(), { forceVector: true });
    expect(forced.querySelector('image')).toBeNull();
    expect(forced.querySelectorAll('circle.oc-mark-point').length).toBe(
      VECTOR_EXPORT_MAX_POINTS + 1,
    );
  });

  it('takes the raster path for the same layout without it', () => {
    const raster = materializeCanvasModeSVG(bigLayout());
    expect(raster.querySelectorAll('circle.oc-mark-point').length).toBe(0);
  });
});
