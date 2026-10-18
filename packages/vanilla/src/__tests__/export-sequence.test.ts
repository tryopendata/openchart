/**
 * Multi-spec GIF export tests.
 *
 * Two testable layers under happy-dom:
 *
 * 1. `settleAnimation`: the wrapper both the offscreen mount and each step
 *    apply to an author's spec. It must force `enter:false` without discarding
 *    the author's own update config.
 * 2. `exportSpecSequence` orchestration: with the rasterizer stubbed
 *    (happy-dom can't draw an SVG into a canvas), the sequence walk itself —
 *    frame counts, dwell vs tween delays, the geometry each frame captured
 *    from the real manual transition, and offscreen DOM cleanup on both
 *    success and failure — is fully observable.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { exportSpecSequence, settleAnimation } from '../export-sequence';
import { createChart } from '../mount';

// Every frame gifenc is asked to write, recorded by the hoisted mock below so
// tests can assert on frame count and per-frame delay/repeat.
const gifRecorder = vi.hoisted(() => ({
  frames: [] as Array<{ width: number; height: number; delay?: number; repeat?: number }>,
}));

// `gifenc` is an optional third-party peer that isn't installed here; stub it
// (same convention as export-gif.test.ts) so the sequence pipeline runs end to end.
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
    // A short, explicit tween so the stepped frames stay few.
    animation: { update: { duration: 100 } },
  };
}

// fps 25 → frameDelay = round(1000/25) = 40ms.
const SEQ_OPTS = { width: 600, height: 400, embedFonts: false, fps: 25, dwellMs: 500 };

/**
 * A canvas standing in for a rasterized frame. happy-dom has no 2D context, so
 * it carries just enough of one for gif-encode's real sRGB readback.
 */
function blankCanvas(w: number, h: number, dpi: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w * dpi;
  canvas.height = h * dpi;
  const readback = {
    getImageData: (_x: number, _y: number, sw: number, sh: number) => ({
      data: new Uint8ClampedArray(sw * sh * 4),
    }),
  };
  canvas.getContext = (() => readback) as unknown as HTMLCanvasElement['getContext'];
  return canvas;
}

/**
 * Stub the rasterizer (happy-dom can't draw an SVG into a canvas). The default
 * implementation records the SVG markup of each frame and hands back a blank
 * canvas; pass `impl` to observe or fail a grab. Same vi.spyOn-on-the-export-
 * module convention as export-gif.test.ts.
 */
async function stubRasterize(
  impl?: (svgString: string, w: number, h: number, dpi: number) => Promise<HTMLCanvasElement>,
): Promise<string[]> {
  const grabbed: string[] = [];
  const exportModule = await import('../export');
  vi.spyOn(exportModule, 'rasterizeSVGToCanvas').mockImplementation(
    impl ??
      (async (svgString, w, h, dpi) => {
        grabbed.push(svgString);
        return blankCanvas(w, h, dpi);
      }),
  );
  return grabbed;
}

/** Right edge of bar `A` in a frame's SVG markup (horizontal bars grow rightward). */
function barRightEdge(svgString: string): number {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const d = doc.querySelector('.oc-mark-rect[data-key="|A"] path')?.getAttribute('d') ?? '';
  const match = /H([\d.]+)/.exec(d);
  if (!match) throw new Error(`no bar A in frame: ${d}`);
  return Number(match[1]);
}

/** Right edge of bar `A` when `spec` is rendered statically at the export size. */
function settledRightEdge(spec: ChartSpec): number {
  const container = createContainer(600, 400);
  const chart = createChart(container, settleAnimation(spec));
  const edge = barRightEdge(container.querySelector('svg')!.outerHTML);
  chart.destroy();
  container.remove();
  return edge;
}

describe('exportSpecSequence orchestration', () => {
  it('walks a 3-spec sequence: dwell frame per spec plus stepped tween frames between', async () => {
    const specs = [stepSpec(10), stepSpec(30), stepSpec(50)];
    const settled = specs.map(settledRightEdge);
    const grabbed = await stubRasterize();
    const baseline = document.body.childElementCount;

    const blob = await exportSpecSequence(specs, SEQ_OPTS);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/gif');
    // Held first frame, then per transition: tween frames on the 40ms fps grid
    // followed by a held dwell frame. Both transitions tween the same distance.
    const delays = gifRecorder.frames.map((f) => f.delay);
    const tweenFrames = (delays.length - 3) / 2;
    expect(tweenFrames).toBeGreaterThanOrEqual(1);
    const tween = Array<number>(tweenFrames).fill(40);
    expect(delays).toEqual([500, ...tween, 500, ...tween, 500]);
    // Loop extension only on the first frame; loop omitted → play once (-1).
    expect(gifRecorder.frames[0].repeat).toBe(-1);
    expect(gifRecorder.frames.slice(1).every((f) => f.repeat === undefined)).toBe(true);

    // Every encoded frame was rasterized from the live chart at that step.
    expect(grabbed).toHaveLength(delays.length);
    const edges = grabbed.map(barRightEdge);
    const dwellAt = [0, tweenFrames + 1, 2 * tweenFrames + 2];
    // Each held frame shows its spec fully settled (the tween was snapped to its end).
    expect(dwellAt.map((i) => edges[i])).toEqual(settled.map((e) => expect.closeTo(e, 3)));
    // Tween frames move the bar from one settled position toward the next.
    for (let leg = 0; leg < 2; leg++) {
      const from = settled[leg];
      const to = settled[leg + 1];
      const steps = edges.slice(dwellAt[leg] + 1, dwellAt[leg + 1]);
      expect(steps[0]).toBeGreaterThan(from);
      expect(steps[0]).toBeLessThan(to);
      for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
      expect(steps.at(-1)!).toBeLessThanOrEqual(to + 1e-6);
    }
    // The offscreen mount container was torn down on success.
    expect(document.body.childElementCount).toBe(baseline);
  });

  it('captures one settled frame per spec when no transition applies', async () => {
    await stubRasterize();
    // A mark-type change can't tween, so each spec is held as a single frame.
    const pointStep = { ...stepSpec(30), mark: 'point' } as ChartSpec;

    await exportSpecSequence([stepSpec(10), pointStep], SEQ_OPTS);

    expect(gifRecorder.frames).toHaveLength(2);
    expect(gifRecorder.frames.map((f) => f.delay)).toEqual([500, 500]);
  });

  it('rejects when a later step fails to compile, and removes the offscreen mount', async () => {
    let mountedDuring = 0;
    await stubRasterize(async (_svgString, w, h, dpi) => {
      // Runs while the first (valid) spec is being grabbed — the offscreen
      // container must be live in the body at this point.
      mountedDuring = document.body.childElementCount;
      return blankCanvas(w, h, dpi);
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
