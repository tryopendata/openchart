/**
 * Tests for the point-mark rendering backend resolver.
 *
 * Pure function: it decides SVG vs canvas from the mark def, the mark type,
 * the compiled point count, and the chart shape (facet/layer/sparkline).
 * Refusals collect a warning string only when the author explicitly asked for
 * canvas; the caller emits them through emitSpecWarnings.
 */

import type { Display, MarkDef } from '@opendata-ai/openchart-core';
import { describe, expect, it, vi } from 'vitest';
import { compileChart } from '../../compile';
import { AUTO_CANVAS_THRESHOLD, resolveMarkRenderMode } from '../mark-render-mode';

/** Baseline args: a plain scatter with a huge point count. */
function args(overrides: Partial<Parameters<typeof resolveMarkRenderMode>[0]> = {}) {
  return {
    markDef: { type: 'point' } as MarkDef,
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
    expect(
      resolveMarkRenderMode(args({ markDef: { type: 'point', render: 'svg' } }), warnings),
    ).toBe('svg');
    expect(warnings).toEqual([]);
  });

  it('honors explicit svg on a shape canvas would refuse anyway', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'bar', render: 'svg' }, markType: 'bar' }),
        warnings,
      ),
    ).toBe('svg');
    expect(warnings).toEqual([]);
  });

  it('honors explicit canvas at a low point count', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'point', render: 'canvas' }, pointCount: 3 }),
        warnings,
      ),
    ).toBe('canvas');
    expect(warnings).toEqual([]);
  });

  it('honors explicit canvas at zero points', () => {
    expect(
      resolveMarkRenderMode(args({ markDef: { type: 'point', render: 'canvas' }, pointCount: 0 })),
    ).toBe('canvas');
  });

  it('falls back to svg for a non-point mark and names the mark type', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'bar', render: 'canvas' }, markType: 'bar' }),
        warnings,
      ),
    ).toBe('svg');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('bar marks');
  });

  it('falls back to svg for a faceted chart and says so', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'point', render: 'canvas' }, faceted: true }),
        warnings,
      ),
    ).toBe('svg');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('faceted');
  });

  it('falls back to svg for a layered chart and says so', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'point', render: 'canvas' }, layered: true }),
        warnings,
      ),
    ).toBe('svg');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('layered');
  });

  it('falls back to svg for a sparkline and says so', () => {
    const warnings: string[] = [];
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'point', render: 'canvas' }, display: 'sparkline' }),
        warnings,
      ),
    ).toBe('svg');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('sparkline');
  });

  it('emits exactly one warning per resolve even when several rules refuse', () => {
    const warnings: string[] = [];
    resolveMarkRenderMode(
      args({
        markDef: { type: 'bar', render: 'canvas' },
        markType: 'bar',
        faceted: true,
        layered: true,
        display: 'sparkline',
      }),
      warnings,
    );
    expect(warnings).toHaveLength(1);
  });

  it('never warns on a refused shape when render is auto or absent', () => {
    const warnings: string[] = [];
    resolveMarkRenderMode(
      args({ markDef: { type: 'bar', render: 'auto' }, markType: 'bar' }),
      warnings,
    );
    resolveMarkRenderMode(args({ markDef: { type: 'bar' }, markType: 'bar' }), warnings);
    resolveMarkRenderMode(args({ markDef: undefined, markType: 'bar' }), warnings);
    resolveMarkRenderMode(args({ markDef: { type: 'point' }, faceted: true }), warnings);
    expect(warnings).toEqual([]);
  });

  // AUTO_ENABLED is false in this release, so the auto path always answers svg.
  // A later stage flips it to true, at which point these two expectations
  // become 'canvas' above the threshold and stay 'svg' at or below it.
  it('answers svg for auto above the threshold while AUTO_ENABLED is off', () => {
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'point', render: 'auto' }, pointCount: AUTO_CANVAS_THRESHOLD + 1 }),
      ),
    ).toBe('svg');
  });

  it('answers svg for auto at or below the threshold', () => {
    expect(
      resolveMarkRenderMode(
        args({ markDef: { type: 'point', render: 'auto' }, pointCount: AUTO_CANVAS_THRESHOLD }),
      ),
    ).toBe('svg');
  });

  it('treats an absent render field exactly like auto', () => {
    const absent = resolveMarkRenderMode(
      args({ markDef: { type: 'point' }, pointCount: AUTO_CANVAS_THRESHOLD + 1 }),
    );
    const auto = resolveMarkRenderMode(
      args({ markDef: { type: 'point', render: 'auto' }, pointCount: AUTO_CANVAS_THRESHOLD + 1 }),
    );
    expect(absent).toBe(auto);
  });

  it('treats an undefined mark def exactly like auto', () => {
    expect(resolveMarkRenderMode(args({ markDef: undefined }))).toBe('svg');
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

  it('leaves markRenderMode absent for an explicit svg scatter', () => {
    const layout = compileChart(
      {
        mark: { type: 'point', render: 'svg' },
        data: SCATTER_DATA,
        encoding: SCATTER_ENCODING,
      },
      { width: 600, height: 400 },
    );
    expect('markRenderMode' in layout).toBe(false);
  });

  it('stamps canvas on the layout for an explicit canvas scatter', () => {
    const layout = compileChart(
      {
        mark: { type: 'point', render: 'canvas' },
        data: SCATTER_DATA,
        encoding: SCATTER_ENCODING,
      },
      { width: 600, height: 400 },
    );
    expect(layout.markRenderMode).toBe('canvas');
  });

  it('warns once through console.warn when canvas is refused', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const layout = compileChart(
        {
          mark: { type: 'bar', render: 'canvas' },
          data: [
            { c: 'a', v: 1 },
            { c: 'b', v: 2 },
          ],
          encoding: {
            x: { field: 'c', type: 'nominal' as const },
            y: { field: 'v', type: 'quantitative' as const },
          },
        },
        { width: 600, height: 400 },
      );
      expect('markRenderMode' in layout).toBe(false);
      const renderWarnings = spy.mock.calls.filter((c) => String(c[0]).includes('mark.render'));
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
          mark: { type: 'point', render: 'canvas' },
          data: SCATTER_DATA,
          encoding: SCATTER_ENCODING,
          display: 'sparkline',
        },
        { width: 600, height: 400, onWarn },
      );
      const renderWarnings = onWarn.mock.calls.filter((c) => String(c[0]).includes('mark.render'));
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
          mark: { type: 'point', render: 'canvas' },
          data: SCATTER_DATA.map((row, i) => ({ ...row, g: i % 2 === 0 ? 'a' : 'b' })),
          encoding: {
            ...SCATTER_ENCODING,
            facet: { field: 'g', type: 'nominal' as const },
          },
          width: 600,
          height: 400,
        },
        { width: 600, height: 400 },
      );
      expect(layout.facet).toBeDefined();
      expect('markRenderMode' in layout).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
