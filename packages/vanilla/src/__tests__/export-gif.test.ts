/**
 * GIF export tests.
 *
 * Pixel output can't be verified under happy-dom (no real canvas
 * rasterization), so — like the PNG/JPG tests — the interface tests only assert
 * the call returns a Promise and swallow the rejection. The pure logic
 * (loop→repeat mapping, role classification, per-frame keyframe evaluation)
 * is unit-tested directly.
 */

import {
  type ChartSpec,
  evalCurve,
  FLUID_SPRING,
  type ResolvedTheme,
} from '@opendata-ai/openchart-core';
import type { CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import type { AnimatedTarget } from '../export-gif';
import {
  applyFrameState,
  classifyTarget,
  exportGIF,
  isModuleNotFound,
  resolveRepeat,
} from '../export-gif';
import { createChart } from '../mount';
import { stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';
import { renderChartSVG } from '../svg-renderer';

// `gifenc` is an optional third-party peer that isn't installed here; stub it
// so the export pipeline runs far enough to reach the frame-background painter.
vi.mock('gifenc', () => ({
  GIFEncoder: () => ({
    writeFrame: () => {},
    finish: () => {},
    bytes: () => new Uint8Array(),
  }),
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array(),
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

  it('maps a grid cell (data-cell) to the cell role: a fade on its shape, no clip', () => {
    const g = markGroup('oc-mark oc-mark-rect', 'rect');
    g.setAttribute('data-cell', '');
    const result = classifyTarget(g);
    expect(result).toMatchObject({ kind: 'fade', role: 'cell' });
    expect(result?.el.tagName.toLowerCase()).toBe('rect');
  });

  it('maps line and area groups to line-area (the group itself clips)', () => {
    const line = svgEl('g', 'oc-mark oc-mark-line');
    const area = svgEl('g', 'oc-mark oc-mark-area');
    expect(classifyTarget(line)).toEqual({ el: line, kind: 'line-area', role: 'line-area' });
    expect(classifyTarget(area)).toEqual({ el: area, kind: 'line-area', role: 'line-area' });
  });

  it('maps arcs and points to fade (scale breaks their positioning)', () => {
    expect(classifyTarget(svgEl('circle', 'oc-mark oc-mark-point'))?.kind).toBe('fade');
    expect(classifyTarget(svgEl('g', 'oc-mark oc-mark-arc'))?.kind).toBe('fade');
  });

  it('treats unknown mark types as a generic fade (no hard pop-in)', () => {
    expect(classifyTarget(svgEl('text', 'oc-mark oc-mark-text'))?.kind).toBe('fade');
  });

  it('maps elements to the choreography role whose CSS rule animates them', () => {
    const textGroup = svgEl('g', 'oc-mark oc-mark-text');
    textGroup.appendChild(svgEl('text', ''));
    expect(classifyTarget(textGroup)?.role).toBe('text');
    expect(classifyTarget(svgEl('text', 'oc-mark-label'))?.role).toBe('label');
    expect(classifyTarget(svgEl('g', 'oc-annotation'))?.role).toBe('annotation');
    const stack = svgEl('g', 'oc-stack-reveal', 'horizontal');
    expect(classifyTarget(stack)).toMatchObject({ kind: 'bar-horizontal', role: 'stack-reveal-h' });
  });
});

// ---------------------------------------------------------------------------
// applyFrameState (per-frame inline interpolation — the observable output)
// ---------------------------------------------------------------------------

function target(kind: AnimatedTarget['kind'], startMs = 0, durationMs = 500): AnimatedTarget {
  return { el: svgEl('rect', 'x'), kind, startMs, durationMs };
}

describe('applyFrameState', () => {
  it('vertical bar: fully clipped before its start, and never faded', () => {
    const t = target('bar-vertical', 100, 500);
    applyFrameState(t, 0, 'smooth'); // before startMs
    expect(t.el.style.clipPath).toBe('inset(100% 0 0 0)');
    expect(t.el.style.opacity).toBe('');
  });

  it('vertical bar: unclipped at/after its end', () => {
    const t = target('bar-vertical', 0, 500);
    applyFrameState(t, 500, 'smooth');
    expect(t.el.style.clipPath).toBe('inset(0 0 0 0)');
    expect(t.el.style.opacity).toBe('');
  });

  it('a negative bar grows from its stamped --oc-bar-from (the baseline at the top)', () => {
    const t = target('bar-vertical', 0, 500);
    t.el.style.setProperty('--oc-bar-from', '0 0 100% 0');
    applyFrameState(t, 0, 'smooth');
    expect(t.el.style.clipPath).toBe('inset(0 0 100% 0)');
    applyFrameState(t, 250, 'smooth');
    const bottom = Number(t.el.style.clipPath.match(/^inset\(0 0 ([\d.]+)%/)?.[1]);
    expect(bottom).toBeCloseTo((1 - evalCurve('smooth', 0.5)) * 100, 6);
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

  it("honours snappy: geometry follows the snappy curve, not smooth's samples", () => {
    const t = target('bar-vertical', 0, 500);
    applyFrameState(t, 250, 'snappy');
    const inset = Number(t.el.style.clipPath.match(/inset\(([\d.]+)%/)?.[1]);
    expect(inset).toBeCloseTo((1 - evalCurve('snappy', 0.5)) * 100, 6);
    expect(inset).not.toBeCloseTo((1 - evalCurve('smooth', 0.5)) * 100, 1);
  });

  it('text rises 0.6em over the duration while a 140ms fade runs alongside', () => {
    const t: AnimatedTarget = { ...target('fade', 0, 600), role: 'text', fadeMs: 140 };
    applyFrameState(t, 0, 'smooth');
    expect(t.el.style.transform).toBe('translateY(0.6em)');
    expect(Number(t.el.style.opacity)).toBe(0);
    applyFrameState(t, 140, 'smooth');
    expect(Number(t.el.style.opacity)).toBe(1);
    expect(t.el.style.transform).not.toBe('translateY(0em)');
    applyFrameState(t, 600, 'smooth');
    expect(t.el.style.transform).toBe('translateY(0em)');
  });

  it('a label rides from its stamped --oc-label-from offset to rest', () => {
    const t: AnimatedTarget = { ...target('fade', 0, 600), role: 'label', fadeMs: 140 };
    t.el.style.setProperty('--oc-label-from', '0px, 120px');
    applyFrameState(t, 0, 'smooth');
    expect(t.el.style.transform).toBe('translate(0px, 120px)');
    applyFrameState(t, 300, 'smooth');
    const y = Number(t.el.style.transform.match(/, ([\d.]+)px\)$/)?.[1]);
    expect(y).toBeCloseTo(120 * (1 - evalCurve('smooth', 0.5)), 6);
    applyFrameState(t, 600, 'smooth');
    expect(t.el.style.transform).toBe('translate(0px, 0px)');
  });

  it('a spring phase eases the segment by the spring, as the stamped linear() does', () => {
    const phase = { duration: 400, spring: FLUID_SPRING };
    const t = target('line-area', 0, 400);
    applyFrameState(t, 200, 'smooth', phase);
    const inset = Number(t.el.style.clipPath.match(/inset\(0 ([\d.]+)%/)?.[1]);
    expect(inset).toBeGreaterThan(0);
    expect(inset).toBeLessThan(50);
  });

  it('stack reveal: starts from the stamped baseline inset and opens to inset(0)', () => {
    const el = svgEl('g', 'oc-stack-reveal');
    el.style.setProperty('--oc-stack-from', '40% 0 60% 0');
    const t: AnimatedTarget = {
      el,
      kind: 'bar-vertical',
      role: 'stack-reveal',
      startMs: 0,
      durationMs: 500,
    };
    applyFrameState(t, 0, 'smooth');
    expect(el.style.clipPath).toBe('inset(40% 0 60% 0)');
    applyFrameState(t, 500, 'smooth');
    expect(el.style.clipPath).toBe('inset(0 0 0 0)');
    // Unstamped, it falls back to the bottom-up reveal.
    const plain: AnimatedTarget = { ...t, el: svgEl('g', 'oc-stack-reveal') };
    applyFrameState(plain, 0, 'smooth');
    expect(plain.el.style.clipPath).toBe('inset(100% 0 0 0)');
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

/** A dark scatter spec; canvas mark mode is opted into at mount time. */
function scatterSpec(): ChartSpec {
  return {
    mark: 'point',
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
  // happy-dom can't decode an SVG into an <img> or paint a canvas, so the
  // rasterizer is replaced by one that just runs the background painter.
  const spy = vi
    .spyOn(exportModule, 'rasterizeSVGToCanvas')
    .mockImplementation(async (svgString, w, h, dpi, prepare) => {
      const canvas = document.createElement('canvas');
      canvas.width = w * dpi;
      canvas.height = h * dpi;
      // Blank pixels for the real sRGB readback in gif-encode.
      const readback = {
        getImageData: (_x: number, _y: number, sw: number, sh: number) => ({
          data: new Uint8ClampedArray(sw * sh * 4),
        }),
      };
      canvas.getContext = (() => readback) as unknown as HTMLCanvasElement['getContext'];
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
function mountForExport(
  spec: ChartSpec,
  renderer?: 'canvas',
): {
  svg: SVGElement;
  theme: ResolvedTheme;
  destroy: () => void;
} {
  const container = createContainer();
  const chart = createChart(container, spec, { width: 600, height: 400, renderer });
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
      const { svg, theme, destroy } = mountForExport(scatterSpec(), 'canvas');
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
