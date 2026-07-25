/**
 * Multi-spec GIF export tests.
 *
 * Two testable layers under happy-dom:
 *
 * 1. `settleAnimation`: the wrapper both the offscreen mount and each step
 *    apply to an author's spec. It must force `enter:false` without discarding
 *    the author's own update config.
 * 2. `exportSpecSequence` orchestration: with the rasterize/encode layer
 *    stubbed (happy-dom has no real canvas), the sequence walk itself — frame
 *    counts, dwell vs tween delays, manual transition stepping, and offscreen
 *    DOM cleanup on both success and failure — is fully observable.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { exportSpecSequence, settleAnimation } from '../export-sequence';
import { createChart } from '../mount';
import type { TransitionHandle } from '../transition';

// Every frame gifenc is asked to write, recorded by the hoisted mock below so
// tests can assert on frame count and per-frame delay/repeat.
const gifRecorder = vi.hoisted(() => ({
  frames: [] as Array<{ width: number; height: number; delay?: number; repeat?: number }>,
}));

// `gifenc` is an optional peer that isn't installed here, and happy-dom has no
// canvas 2D context to read pixels back from. Stub both (same convention as
// export-gif.test.ts) so the sequence pipeline runs end to end.
vi.mock('gifenc', () => ({
  GIFEncoder: () => ({
    writeFrame: (
      _index: Uint8Array,
      width: number,
      height: number,
      opts?: { delay?: number; repeat?: number },
    ) => {
      gifRecorder.frames.push({ width, height, delay: opts?.delay, repeat: opts?.repeat });
    },
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

const baseSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
};

afterEach(() => {
  document.body.innerHTML = '';
  gifRecorder.frames.length = 0;
  vi.restoreAllMocks();
});

describe('settleAnimation', () => {
  it('produces {enter:false, update:true} when the spec has no animation', () => {
    expect(settleAnimation(baseSpec).animation).toEqual({ enter: false, update: true });
  });

  it('produces {enter:false, update:true} when animation is the boolean shorthand', () => {
    expect(settleAnimation({ ...baseSpec, animation: true }).animation).toEqual({
      enter: false,
      update: true,
    });
    expect(settleAnimation({ ...baseSpec, animation: { update: true } }).animation).toEqual({
      enter: false,
      update: true,
    });
    expect(settleAnimation({ ...baseSpec, animation: { update: false } }).animation).toEqual({
      enter: false,
      update: true,
    });
  });

  it("keeps the author's update config (maxMarks) while still forcing enter:false", () => {
    const settled = settleAnimation({
      ...baseSpec,
      animation: { enter: true, update: { maxMarks: 5000, duration: 900 } },
    });
    expect(settled.animation).toEqual({
      enter: false,
      update: { maxMarks: 5000, duration: 900 },
    });
  });

  it("does not mutate the author's spec", () => {
    const spec: ChartSpec = { ...baseSpec, animation: { update: { maxMarks: 5000 } } };
    settleAnimation(spec);
    expect(spec.animation).toEqual({ update: { maxMarks: 5000 } });
  });

  it('carries maxMarks through compilation into the rendered layout', () => {
    const container = createContainer();
    const settled = settleAnimation({
      ...baseSpec,
      animation: { update: { maxMarks: 5000 } },
    });
    const chart = createChart(container, settled, { width: 600, height: 400 });

    const animation = (chart.layout as { animation?: { update?: { maxMarks?: number } } })
      .animation;
    expect(animation?.update?.maxMarks).toBe(5000);

    chart.destroy();
  });
});

// ---------------------------------------------------------------------------
// exportSpecSequence orchestration
// ---------------------------------------------------------------------------

/** A step in a keyframe sequence: same shape as baseSpec, different values. */
function stepSpec(value: number): ChartSpec {
  return {
    ...baseSpec,
    data: [
      { name: 'A', value },
      { name: 'B', value: value + 20 },
    ],
  };
}

// fps 25 → frameDelay = round(1000/25) = 40ms.
const SEQ_OPTS = { width: 600, height: 400, embedFonts: false, fps: 25, dwellMs: 500 };

/**
 * Stub the rasterizer (happy-dom can't draw an SVG into a canvas). The default
 * implementation hands back a bare canvas; pass `impl` to observe or fail a
 * grab. Same vi.spyOn-on-the-export-module convention as export-gif.test.ts.
 */
async function stubRasterize(
  impl?: (svgString: string, w: number, h: number, dpi: number) => Promise<HTMLCanvasElement>,
): Promise<void> {
  const exportModule = await import('../export');
  vi.spyOn(exportModule, 'rasterizeSVGToCanvas').mockImplementation(
    impl ??
      (async (_svgString, w, h, dpi) => {
        const canvas = document.createElement('canvas');
        canvas.width = w * dpi;
        canvas.height = h * dpi;
        return canvas;
      }),
  );
}

/**
 * Wrap the real createChart so the mounted instance's `beginManualUpdate` is
 * replaced with `makeHandle`'s result. Real transitions under happy-dom would
 * make the tween frame count depend on internal duration defaults; a fake
 * handle with a known totalMs makes the walk deterministic.
 */
async function interceptBeginManualUpdate(
  makeHandle: () => TransitionHandle | null,
): Promise<void> {
  const mountModule = await import('../mount');
  const realCreateChart = mountModule.createChart;
  vi.spyOn(mountModule, 'createChart').mockImplementation((container, spec, options) => {
    const instance = realCreateChart(container, spec, options);
    instance.beginManualUpdate = makeHandle;
    return instance;
  });
}

describe('exportSpecSequence orchestration', () => {
  it('walks a 3-spec sequence: dwell frame per spec plus stepped tween frames between', async () => {
    const stepCalls: number[] = [];
    let cancelCount = 0;
    await interceptBeginManualUpdate(() => ({
      totalMs: 100,
      step(ms: number) {
        stepCalls.push(ms);
        return ms < 100;
      },
      cancel() {
        cancelCount++;
      },
      get running() {
        return false;
      },
      snapshot: () => new Map(),
    }));
    await stubRasterize();
    const baseline = document.body.childElementCount;

    const blob = await exportSpecSequence([stepSpec(10), stepSpec(30), stepSpec(50)], SEQ_OPTS);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/gif');
    // 1 held first frame + 2 transitions × (2 tween frames at t=40,80 + 1 dwell).
    expect(gifRecorder.frames).toHaveLength(7);
    expect(gifRecorder.frames.map((f) => f.delay)).toEqual([500, 40, 40, 500, 40, 40, 500]);
    // Loop extension only on the first frame; loop omitted → play once (-1).
    expect(gifRecorder.frames[0].repeat).toBe(-1);
    expect(gifRecorder.frames.slice(1).every((f) => f.repeat === undefined)).toBe(true);
    // Each transition stepped at the fps grid, then snapped to its end.
    expect(stepCalls).toEqual([40, 80, 100, 40, 80, 100]);
    expect(cancelCount).toBe(2);
    // The offscreen mount container was torn down on success.
    expect(document.body.childElementCount).toBe(baseline);
  });

  it('captures one settled frame per spec when no transition applies (null handle)', async () => {
    await interceptBeginManualUpdate(() => null);
    await stubRasterize();

    await exportSpecSequence([stepSpec(10), stepSpec(30)], SEQ_OPTS);

    expect(gifRecorder.frames).toHaveLength(2);
    expect(gifRecorder.frames.map((f) => f.delay)).toEqual([500, 500]);
  });

  it('rejects when a later step fails to compile, and removes the offscreen mount', async () => {
    let mountedDuring = 0;
    await stubRasterize(async (_svgString, w, h, dpi) => {
      // Runs while the first (valid) spec is being grabbed — the offscreen
      // container must be live in the body at this point.
      mountedDuring = document.body.childElementCount;
      const canvas = document.createElement('canvas');
      canvas.width = w * dpi;
      canvas.height = h * dpi;
      return canvas;
    });
    const baseline = document.body.childElementCount;
    // A bar spec with an empty encoding fails engine validation.
    const badSpec = { mark: 'bar', data: [{ name: 'A', value: 1 }], encoding: {} } as ChartSpec;

    await expect(exportSpecSequence([stepSpec(10), badSpec], SEQ_OPTS)).rejects.toThrow(
      /Invalid spec/,
    );

    // The first spec really did mount offscreen…
    expect(mountedDuring).toBeGreaterThan(baseline);
    // …and the failure path tore it down: nothing leaked under document.body.
    expect(document.body.childElementCount).toBe(baseline);
  });

  it('does not leak the offscreen container when the FIRST spec fails to compile', async () => {
    // createChart throws before mountOffscreen can return, so the cleanup
    // cannot come from the caller's finally block — mountOffscreen itself
    // must remove the container it appended.
    const baseline = document.body.childElementCount;
    const badSpec = { mark: 'bar', data: [{ name: 'A', value: 1 }], encoding: {} } as ChartSpec;

    await expect(exportSpecSequence([badSpec, stepSpec(10)], SEQ_OPTS)).rejects.toThrow(
      /Invalid spec/,
    );

    expect(document.body.childElementCount).toBe(baseline);
  });

  it('rejects on an empty specs array without touching the DOM', async () => {
    // Documented behavior: at least one spec is required — the function
    // rejects rather than resolving to an empty/zero-frame GIF.
    const baseline = document.body.childElementCount;

    await expect(exportSpecSequence([], SEQ_OPTS)).rejects.toThrow(
      'exportSpecSequence requires at least one spec',
    );

    expect(document.body.childElementCount).toBe(baseline);
    expect(gifRecorder.frames).toHaveLength(0);
  });

  it('tears down the offscreen mount when a frame grab throws mid-sequence', async () => {
    let mountedDuring = 0;
    await stubRasterize(async () => {
      mountedDuring = document.body.childElementCount;
      throw new Error('rasterize failed under happy-dom');
    });
    const baseline = document.body.childElementCount;

    await expect(exportSpecSequence([stepSpec(10), stepSpec(30)], SEQ_OPTS)).rejects.toThrow(
      'rasterize failed under happy-dom',
    );

    expect(mountedDuring).toBeGreaterThan(baseline);
    expect(document.body.childElementCount).toBe(baseline);
  });
});
