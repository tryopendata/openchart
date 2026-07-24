/**
 * GIF export tests.
 *
 * Pixel output can't be verified under happy-dom (no real canvas
 * rasterization), so — like the PNG/JPG tests — the interface tests only assert
 * the call returns a Promise and swallow the rejection. The pure logic
 * (loop→repeat mapping, easing sample interpolation) is unit-tested directly.
 */

import type { ChartSpec, ResolvedTheme } from '@opendata-ai/openchart-core';
import type { CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import type { AnimatedTarget } from '../export-gif';
import {
  applyFrameState,
  classifyTarget,
  EASE_SMOOTH_SAMPLES,
  evalLinearSamples,
  exportGIF,
  isModuleNotFound,
  resolveRepeat,
} from '../export-gif';
import { createChart } from '../mount';
import { stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';
import { renderChartSVG } from '../svg-renderer';

// `gifenc` is an optional peer that isn't installed here, and happy-dom has no
// canvas 2D context to read pixels back from. Stub both so the export pipeline
// runs far enough to reach the frame-background painter.
vi.mock('gifenc', () => ({
  GIFEncoder: () => ({
    writeFrame: () => {},
    finish: () => {},
    bytes: () => new Uint8Array(),
  }),
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array(),
}));

vi.mock('../gif-encode', () => ({
  readCanvasSRGB: () => new Uint8ClampedArray(4),
  paletteFromCanvas: () => [[0, 0, 0]],
}));

// Build a detached SVG element of a given class/shape for classify/interp tests.
function svgEl(tag: string, className: string, orient?: string): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElement;
  el.setAttribute('class', className);
  if (orient) el.setAttribute('data-orient', orient);
  return el;
}

function markGroup(className: string, child: 'rect' | 'path' | null, orient?: string): SVGElement {
  const g = svgEl('g', className, orient);
  if (child) g.appendChild(svgEl(child, `${className}-shape`));
  return g;
}

const COMPILE_OPTS: CompileOptions = { width: 600, height: 400 };

function renderToSVG(spec = barSpec) {
  const container = createContainer();
  const layout = compileChart(spec, COMPILE_OPTS);
  return renderChartSVG(layout, container, { animate: true });
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// resolveRepeat (loop → gifenc repeat mapping)
// ---------------------------------------------------------------------------

describe('resolveRepeat', () => {
  it('defaults to play-once (-1) when loop is undefined or false', () => {
    expect(resolveRepeat(undefined)).toBe(-1);
    expect(resolveRepeat(false)).toBe(-1);
  });

  it('maps true to loop-forever (0)', () => {
    expect(resolveRepeat(true)).toBe(0);
  });

  it('passes an explicit numeric loop count through', () => {
    expect(resolveRepeat(3)).toBe(3);
    expect(resolveRepeat(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evalLinearSamples (CSS linear() easing replication)
// ---------------------------------------------------------------------------

describe('evalLinearSamples', () => {
  it('pins the endpoints', () => {
    expect(evalLinearSamples(EASE_SMOOTH_SAMPLES, 0)).toBe(0);
    expect(evalLinearSamples(EASE_SMOOTH_SAMPLES, 1)).toBe(1);
  });

  it('clamps out-of-range input to the endpoints', () => {
    expect(evalLinearSamples(EASE_SMOOTH_SAMPLES, -0.5)).toBe(0);
    expect(evalLinearSamples(EASE_SMOOTH_SAMPLES, 2)).toBe(1);
  });

  it('is monotonic non-decreasing across the range (ease-out shape)', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = evalLinearSamples(EASE_SMOOTH_SAMPLES, Math.min(t, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('front-loads progress (ease-out): halfway in time is past halfway in value', () => {
    expect(evalLinearSamples(EASE_SMOOTH_SAMPLES, 0.5)).toBeGreaterThan(0.5);
  });

  it('interpolates linearly between adjacent samples', () => {
    // Two samples: a straight line from 0 to 1 → identity.
    expect(evalLinearSamples([0, 1], 0.25)).toBeCloseTo(0.25, 6);
    expect(evalLinearSamples([0, 1], 0.75)).toBeCloseTo(0.75, 6);
  });
});

// ---------------------------------------------------------------------------
// isModuleNotFound (distinguishes "gifenc absent" from a real load failure)
// ---------------------------------------------------------------------------

describe('isModuleNotFound', () => {
  it('recognizes Node/bundler module-not-found codes', () => {
    expect(isModuleNotFound({ code: 'ERR_MODULE_NOT_FOUND' })).toBe(true);
    expect(isModuleNotFound({ code: 'MODULE_NOT_FOUND' })).toBe(true);
  });

  it('recognizes "cannot find module/package" messages', () => {
    expect(isModuleNotFound(new Error('Cannot find module gifenc'))).toBe(true);
    expect(isModuleNotFound(new Error('Failed to resolve import "gifenc"'))).toBe(true);
  });

  it('does NOT treat a real evaluation error as a missing module', () => {
    // A genuine bug inside gifenc must surface with its own message, not the
    // misleading "npm install gifenc" hint.
    expect(isModuleNotFound(new TypeError('x is not a function'))).toBe(false);
    expect(isModuleNotFound({ code: 'ERR_INTERNAL' })).toBe(false);
    expect(isModuleNotFound(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyTarget (mark DOM → animation kind + target element)
// ---------------------------------------------------------------------------

describe('classifyTarget', () => {
  it('maps a vertical bar group to its <rect> child with bar-vertical', () => {
    const g = markGroup('oc-mark oc-mark-rect', 'rect');
    const result = classifyTarget(g);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('bar-vertical');
    // The <rect> child, not the group, receives the clip (matches the CSS).
    expect(result?.el.tagName.toLowerCase()).toBe('rect');
  });

  it('maps a horizontal bar (data-orient) to bar-horizontal', () => {
    const g = markGroup('oc-mark oc-mark-rect', 'rect', 'horizontal');
    expect(classifyTarget(g)?.kind).toBe('bar-horizontal');
  });

  it('falls back to the <path> child for partial-corner bars', () => {
    const g = markGroup('oc-mark oc-mark-rect', 'path');
    expect(classifyTarget(g)?.el.tagName.toLowerCase()).toBe('path');
  });

  it('returns null for a bar group with no shape child', () => {
    const g = markGroup('oc-mark oc-mark-rect', null);
    expect(classifyTarget(g)).toBeNull();
  });

  it('maps line and area groups to line-area (the group itself clips)', () => {
    const line = svgEl('g', 'oc-mark oc-mark-line');
    const area = svgEl('g', 'oc-mark oc-mark-area');
    expect(classifyTarget(line)).toEqual({ el: line, kind: 'line-area' });
    expect(classifyTarget(area)).toEqual({ el: area, kind: 'line-area' });
  });

  it('maps arcs and points to fade (scale breaks their positioning)', () => {
    expect(classifyTarget(svgEl('circle', 'oc-mark oc-mark-point'))?.kind).toBe('fade');
    expect(classifyTarget(svgEl('g', 'oc-mark oc-mark-arc'))?.kind).toBe('fade');
  });

  it('treats unknown mark types as a generic fade (no hard pop-in)', () => {
    expect(classifyTarget(svgEl('text', 'oc-mark oc-mark-text'))?.kind).toBe('fade');
  });
});

// ---------------------------------------------------------------------------
// applyFrameState (per-frame inline interpolation — the observable output)
// ---------------------------------------------------------------------------

function target(kind: AnimatedTarget['kind'], startMs = 0, durationMs = 500): AnimatedTarget {
  return { el: svgEl('rect', 'x'), kind, startMs, durationMs };
}

describe('applyFrameState', () => {
  it('vertical bar: fully clipped and transparent before its start', () => {
    const t = target('bar-vertical', 100, 500);
    applyFrameState(t, 0, 'smooth'); // before startMs
    expect(t.el.style.clipPath).toBe('inset(100% 0 0 0)');
    expect(Number(t.el.style.opacity)).toBe(0);
  });

  it('vertical bar: unclipped and opaque at/after its end', () => {
    const t = target('bar-vertical', 0, 500);
    applyFrameState(t, 500, 'smooth');
    expect(t.el.style.clipPath).toBe('inset(0% 0 0 0)');
    expect(Number(t.el.style.opacity)).toBe(1);
  });

  it('vertical bar: mid-animation is partially revealed from the top', () => {
    const t = target('bar-vertical', 0, 500);
    applyFrameState(t, 250, 'smooth');
    const inset = Number(t.el.style.clipPath.match(/inset\(([\d.]+)%/)?.[1]);
    // Eased midpoint is well past 50% revealed (ease-out front-loads).
    expect(inset).toBeGreaterThan(0);
    expect(inset).toBeLessThan(50);
  });

  it('horizontal bar: clips from the right edge', () => {
    const t = target('bar-horizontal', 0, 500);
    applyFrameState(t, 0, 'smooth');
    expect(t.el.style.clipPath).toBe('inset(0 100% 0 0)');
  });

  it('line/area: clips from the right and reaches full opacity early (by 15%)', () => {
    const t = target('line-area', 0, 500);
    applyFrameState(t, 500 * 0.15, 'smooth'); // 15% through
    expect(Number(t.el.style.opacity)).toBe(1);
    expect(t.el.style.clipPath).toMatch(/^inset\(0 /);
  });

  it('fade: opacity ramps 0 → 1 with no clip', () => {
    const t = target('fade', 0, 500);
    applyFrameState(t, 0, 'smooth');
    expect(Number(t.el.style.opacity)).toBe(0);
    expect(t.el.style.clipPath).toBe('');
    applyFrameState(t, 500, 'smooth');
    expect(Number(t.el.style.opacity)).toBe(1);
  });

  it('opacity never leaves the [0,1] range across the whole timeline', () => {
    const t = target('bar-vertical', 0, 500);
    for (let ms = -100; ms <= 600; ms += 50) {
      applyFrameState(t, ms, 'smooth');
      const o = Number(t.el.style.opacity);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// exportGIF interface
// ---------------------------------------------------------------------------

describe('exportGIF', () => {
  it('is a function accepting (svg, animation, options)', () => {
    expect(typeof exportGIF).toBe('function');
    expect(exportGIF.length).toBeGreaterThanOrEqual(2);
  });

  it('returns a Promise when called with a rendered SVG element', () => {
    const svg = renderToSVG();
    const animation = {
      enter: {
        duration: 500,
        ease: 'smooth' as const,
        staggerDelay: 40,
        staggerOrder: 'index' as const,
      },
      annotationDelay: 200,
    };
    const result = exportGIF(svg, animation, { embedFonts: false, fps: 10 });
    expect(result).toBeInstanceOf(Promise);
    // happy-dom can't rasterize a canvas, so this rejects — swallow it.
    result.catch(() => {});
  });

  it('tolerates an undefined animation config (falls back to defaults)', () => {
    const svg = renderToSVG();
    const result = exportGIF(svg, undefined, { embedFonts: false, fps: 10 });
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });
});

// ---------------------------------------------------------------------------
// Frame background color
// ---------------------------------------------------------------------------

/** A dark scatter spec, optionally opting into canvas mark mode. */
function scatterSpec(render?: 'canvas'): ChartSpec {
  return {
    mark: render ? { type: 'point', render } : 'point',
    data: Array.from({ length: 20 }, (_, i) => ({ x: i, y: (i * 7) % 100 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    theme: { colors: { background: DARK_BG } },
  };
}

const DARK_BG = '#101418';

let markerSeq = 0;

/**
 * Run exportGIF against a stubbed rasterizer and report every `fillStyle` the
 * frame-background painter set. That's the color the GIF is flood-filled with,
 * which is what these tests are actually about.
 *
 * The interface tests above kick off exports they never await, so the stub only
 * records frames whose serialized markup carries THIS call's marker attribute.
 */
async function capturedFrameFills(
  svg: SVGElement,
  options: Parameters<typeof exportGIF>[2],
): Promise<string[]> {
  const marker = `oc-test-${markerSeq++}`;
  svg.setAttribute('data-test-marker', marker);
  const fills: string[] = [];
  const exportModule = await import('../export');
  const spy = vi
    .spyOn(exportModule, 'rasterizeSVGToCanvas')
    .mockImplementation(async (svgString, w, h, dpi, prepare) => {
      const canvas = document.createElement('canvas');
      canvas.width = w * dpi;
      canvas.height = h * dpi;
      const ctx = { fillStyle: '', fillRect: () => {} } as unknown as CanvasRenderingContext2D;
      prepare?.(ctx, canvas);
      if (svgString.includes(marker)) fills.push(ctx.fillStyle as string);
      return canvas;
    });
  try {
    await exportGIF(svg, undefined, { ...options, embedFonts: false, fps: 1, durationMs: 1 });
  } finally {
    spy.mockRestore();
  }
  return fills;
}

/** Mount a chart and hand back its live SVG plus resolved theme, as mount.ts does. */
function mountForExport(spec: ChartSpec): {
  svg: SVGElement;
  theme: ResolvedTheme;
  destroy: () => void;
} {
  const container = createContainer();
  const chart = createChart(container, spec, { width: 600, height: 400 });
  return {
    svg: container.querySelector('svg') as SVGElement,
    theme: (chart.layout as { theme: ResolvedTheme }).theme,
    destroy: () => chart.destroy(),
  };
}

describe('GIF frame background', () => {
  it("uses the theme's dark background for a canvas-mode chart, not white", async () => {
    // happy-dom has no canvas 2D context, so the canvas layer needs a stub.
    const stub = stubCanvas2D();
    try {
      const { svg, theme, destroy } = mountForExport(scatterSpec('canvas'));
      // Canvas mode suppresses the background rect: nothing to read a fill from.
      expect(svg.querySelector('rect[fill]')).toBeNull();
      expect(theme.colors.background).toBe(DARK_BG);

      const fills = await capturedFrameFills(svg, { theme });
      expect(fills.length).toBeGreaterThan(0);
      for (const fill of fills) expect(fill).toBe(DARK_BG);

      destroy();
    } finally {
      stub.restore();
    }
  });

  it('still reads the background rect in SVG mode, in preference to the theme', async () => {
    const { svg, theme, destroy } = mountForExport(scatterSpec());
    const rect = svg.querySelector('rect') as SVGElement;
    expect(rect.getAttribute('fill')).toBe(DARK_BG);
    // Repaint the rect so it no longer matches the theme: the rect must win,
    // which is the pre-existing behavior the theme fallback must not disturb.
    rect.setAttribute('fill', '#224466');

    const fills = await capturedFrameFills(svg, { theme });
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill).toBe('#224466');

    destroy();
  });

  it('an explicit backgroundColor option still overrides both', async () => {
    const { svg, theme, destroy } = mountForExport(scatterSpec());
    const fills = await capturedFrameFills(svg, { theme, backgroundColor: '#ff00ff' });
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill).toBe('#ff00ff');

    destroy();
  });
});
