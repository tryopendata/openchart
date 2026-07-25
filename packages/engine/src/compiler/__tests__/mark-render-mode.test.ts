/**
 * Tests for the point-mark rendering backend resolver.
 *
 * Pure function: it decides SVG vs canvas from the host's requested backend
 * (the `renderer` compile option), the mark type, the compiled point count,
 * and the chart shape (facet/layer/sparkline). Refusals collect a warning
 * string when the host explicitly asked for canvas, or when 'auto' wanted
 * canvas for a chart dense enough that the SVG fallback is a real cost; the
 * caller emits them through emitSpecWarnings.
 */

import type { Display } from '@opendata-ai/openchart-core';
import { describe, expect, it, vi } from 'vitest';
import { compileChart } from '../../compile';
import {
  AUTO_CANVAS_REFUSAL_WARN_THRESHOLD,
  AUTO_CANVAS_THRESHOLD,
  resolveMarkRenderMode,
} from '../mark-render-mode';

/** Baseline args: a plain scatter with a huge point count. */
function args(overrides: Partial<Parameters<typeof resolveMarkRenderMode>[0]> = {}) {
  return {
    requested: undefined,
    markType: 'point',
    pointCount: AUTO_CANVAS_THRESHOLD * 5,
    display: 'full' as Display,
    faceted: false,
    layered: false,
    ...overrides,
  };
}

describe('resolveMarkRenderMode', () => {
  it('honors explicit svg even above the auto threshold', () => {
    const warnings: string[] = [];
    expect(resolveMarkRenderMode(args({ requested: 'svg' }), warnings)).toBe('svg');
    expect(warnings).toEqual([]);
  });

  it('honors explicit svg on a shape canvas would refuse anyway', () => {
    const warnings: string[] = [];
    expect(resolveMarkRenderMode(args({ requested: 'svg', markType: 'bar' }), warnings)).toBe(
      'svg',
    );
    expect(warnings).toEqual([]);
  });

  it('honors explicit canvas at a low point count', () => {
    const warnings: string[] = [];
    expect(resolveMarkRenderMode(args({ requested: 'canvas', pointCount: 3 }), warnings)).toBe(
      'canvas',
    );
    expect(warnings).toEqual([]);
  });

  it('honors explicit canvas at zero points', () => {
    expect(resolveMarkRenderMode(args({ requested: 'canvas', pointCount: 0 }))).toBe('canvas');
  });

  it('falls back to svg for a non-point mark and names the mark type', () => {
    const warnings: string[] = [];
    expect(resolveMarkRenderMode(args({ requested: 'canvas', markType: 'bar' }), warnings)).toBe(
      'svg',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('bar marks');
  });

  it('falls back to svg for a faceted chart and says so', () => {
    const warnings: string[] = [];
    expect(resolveMarkRenderMode(args({ requested: 'canvas', faceted: true }), warnings)).toBe(
      'svg',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('faceted');
  });

  it('falls back to svg for a layered chart and says so', () => {
    const warnings: string[] = [];
    expect(resolveMarkRenderMode(args({ requested: 'canvas', layered: true }), warnings)).toBe(
      'svg',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('layered');
  });

  it('falls back to svg for a sparkline and says so', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(args({ requested: 'canvas', display: 'sparkline' }), warnings),
    ).toBe('svg');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('sparkline');
  });

  it('emits exactly one warning per resolve even when several rules refuse', () => {
    const warnings: string[] = [];
    resolveMarkRenderMode(
      args({
        requested: 'canvas',
        markType: 'bar',
        faceted: true,
        layered: true,
        display: 'sparkline',
      }),
      warnings,
    );
    expect(warnings).toHaveLength(1);
  });

  it('stays quiet on a refused shape for auto or absent below the warn threshold', () => {
    const warnings: string[] = [];
    const quiet = { pointCount: AUTO_CANVAS_REFUSAL_WARN_THRESHOLD };
    resolveMarkRenderMode(args({ ...quiet, requested: 'auto', markType: 'bar' }), warnings);
    resolveMarkRenderMode(args({ ...quiet, requested: undefined, markType: 'bar' }), warnings);
    resolveMarkRenderMode(args({ ...quiet, requested: undefined, faceted: true }), warnings);
    expect(warnings).toEqual([]);
  });

  it('warns on an auto refusal once the chart is dense enough to hurt', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({
          requested: 'auto',
          layered: true,
          pointCount: AUTO_CANVAS_REFUSAL_WARN_THRESHOLD + 1,
        }),
        warnings,
      ),
    ).toBe('svg');
    expect(warnings).toHaveLength(1);
    // Names the count, the shape that refused, and stays on the [openchart] prefix.
    expect(warnings[0]).toContain(String(AUTO_CANVAS_REFUSAL_WARN_THRESHOLD + 1));
    expect(warnings[0]).toContain('layered');
    expect(warnings[0]).toContain('[openchart]');
  });

  it('treats an absent requested value like auto for the dense refusal warning', () => {
    const warnings: string[] = [];
    resolveMarkRenderMode(
      args({
        requested: undefined,
        faceted: true,
        pointCount: AUTO_CANVAS_REFUSAL_WARN_THRESHOLD + 1,
      }),
      warnings,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('faceted');
  });

  it('does not warn about density when the shape supports canvas', () => {
    // A plain dense scatter is promoted, not refused: nothing to report.
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ requested: 'auto', pointCount: AUTO_CANVAS_REFUSAL_WARN_THRESHOLD + 1 }),
        warnings,
      ),
    ).toBe('canvas');
    expect(warnings).toEqual([]);
  });

  it('warns once, not twice, when an explicit canvas request is also dense', () => {
    const warnings: string[] = [];
    resolveMarkRenderMode(
      args({
        requested: 'canvas',
        layered: true,
        pointCount: AUTO_CANVAS_REFUSAL_WARN_THRESHOLD + 1,
      }),
      warnings,
    );
    expect(warnings).toHaveLength(1);
    // The explicit-request phrasing wins; it already tells the author what to do.
    expect(warnings[0]).toContain('is not supported');
  });

  it('promotes auto to canvas above the threshold', () => {
    expect(
      resolveMarkRenderMode(args({ requested: 'auto', pointCount: AUTO_CANVAS_THRESHOLD + 1 })),
    ).toBe('canvas');
  });

  it('answers svg for auto at or below the threshold', () => {
    expect(
      resolveMarkRenderMode(args({ requested: 'auto', pointCount: AUTO_CANVAS_THRESHOLD })),
    ).toBe('svg');
  });

  it('treats an absent requested value exactly like auto', () => {
    for (const pointCount of [AUTO_CANVAS_THRESHOLD, AUTO_CANVAS_THRESHOLD + 1]) {
      expect(resolveMarkRenderMode(args({ requested: undefined, pointCount }))).toBe(
        resolveMarkRenderMode(args({ requested: 'auto', pointCount })),
      );
    }
    expect(
      resolveMarkRenderMode(args({ requested: undefined, pointCount: AUTO_CANVAS_THRESHOLD + 1 })),
    ).toBe('canvas');
  });
});

// ---------------------------------------------------------------------------
// compileChart wiring
// ---------------------------------------------------------------------------

const SCATTER_DATA = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 2 }));

const SCATTER_ENCODING = {
  x: { field: 'x', type: 'quantitative' as const },
  y: { field: 'y', type: 'quantitative' as const },
};

describe('compileChart markRenderMode', () => {
  it('leaves markRenderMode absent for a default scatter', () => {
    const layout = compileChart(
      { mark: 'point', data: SCATTER_DATA, encoding: SCATTER_ENCODING },
      { width: 600, height: 400 },
    );
    expect(layout.markRenderMode).toBeUndefined();
    expect('markRenderMode' in layout).toBe(false);
  });

  it('leaves markRenderMode absent for an explicit svg renderer', () => {
    const layout = compileChart(
      { mark: 'point', data: SCATTER_DATA, encoding: SCATTER_ENCODING },
      { width: 600, height: 400, renderer: 'svg' },
    );
    expect('markRenderMode' in layout).toBe(false);
  });

  it('stamps canvas on the layout for an explicit canvas renderer', () => {
    const layout = compileChart(
      { mark: 'point', data: SCATTER_DATA, encoding: SCATTER_ENCODING },
      { width: 600, height: 400, renderer: 'canvas' },
    );
    expect(layout.markRenderMode).toBe('canvas');
  });

  it('warns once through console.warn when canvas is refused', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const layout = compileChart(
        {
          mark: 'bar',
          data: [
            { c: 'a', v: 1 },
            { c: 'b', v: 2 },
          ],
          encoding: {
            x: { field: 'c', type: 'nominal' as const },
            y: { field: 'v', type: 'quantitative' as const },
          },
        },
        { width: 600, height: 400, renderer: 'canvas' },
      );
      expect('markRenderMode' in layout).toBe(false);
      const renderWarnings = spy.mock.calls.filter((c) => String(c[0]).includes('renderer'));
      expect(renderWarnings).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('routes the refusal warning to options.onWarn when provided', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onWarn = vi.fn();
    try {
      compileChart(
        {
          mark: 'point',
          data: SCATTER_DATA,
          encoding: SCATTER_ENCODING,
          display: 'sparkline',
        },
        { width: 600, height: 400, onWarn, renderer: 'canvas' },
      );
      const renderWarnings = onWarn.mock.calls.filter((c) => String(c[0]).includes('renderer'));
      expect(renderWarnings).toHaveLength(1);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('never stamps markRenderMode on a faceted layout', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const layout = compileChart(
        {
          mark: 'point',
          data: SCATTER_DATA.map((row, i) => ({ ...row, g: i % 2 === 0 ? 'a' : 'b' })),
          encoding: {
            ...SCATTER_ENCODING,
            facet: { field: 'g', type: 'nominal' as const },
          },
          width: 600,
          height: 400,
        },
        { width: 600, height: 400, renderer: 'canvas' },
      );
      expect(layout.facet).toBeDefined();
      expect('markRenderMode' in layout).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('warns through onWarn when a dense faceted chart silently falls back to svg', () => {
    // The case the warning exists for: the author asked for nothing, the chart
    // is far too dense for SVG, and the facet shape is what refused canvas.
    const onWarn = vi.fn();
    const dense = Array.from({ length: AUTO_CANVAS_REFUSAL_WARN_THRESHOLD + 200 }, (_, i) => ({
      x: i % 500,
      y: i,
      g: i % 2 === 0 ? 'a' : 'b',
    }));
    compileChart(
      {
        mark: 'point',
        data: dense,
        encoding: { ...SCATTER_ENCODING, facet: { field: 'g', type: 'nominal' as const } },
        width: 600,
        height: 400,
      },
      { width: 600, height: 400, onWarn },
    );
    const denseWarnings = onWarn.mock.calls.filter((c) =>
      String(c[0]).includes('point marks as SVG'),
    );
    expect(denseWarnings).toHaveLength(1);
    expect(String(denseWarnings[0][0])).toContain('faceted');
  });

  it('stays silent for a small faceted chart with no renderer requested', () => {
    const onWarn = vi.fn();
    compileChart(
      {
        mark: 'point',
        data: SCATTER_DATA.map((row, i) => ({ ...row, g: i % 2 === 0 ? 'a' : 'b' })),
        encoding: { ...SCATTER_ENCODING, facet: { field: 'g', type: 'nominal' as const } },
        width: 600,
        height: 400,
      },
      { width: 600, height: 400, onWarn },
    );
    const denseWarnings = onWarn.mock.calls.filter((c) =>
      String(c[0]).includes('point marks as SVG'),
    );
    expect(denseWarnings).toEqual([]);
  });

  it('warns on and strips the removed mark.render spec field', () => {
    const onWarn = vi.fn();
    const layout = compileChart(
      {
        // Pre-v8 spec shape: render lived on the mark def. Sugar strips it
        // with a migration warning; it no longer selects the backend.
        mark: { type: 'point', render: 'canvas' } as never,
        data: SCATTER_DATA,
        encoding: SCATTER_ENCODING,
      },
      { width: 600, height: 400, onWarn },
    );
    expect('markRenderMode' in layout).toBe(false);
    const stripWarnings = onWarn.mock.calls.filter((c) =>
      String(c[0]).includes('mark.render was removed'),
    );
    expect(stripWarnings).toHaveLength(1);
  });
});
