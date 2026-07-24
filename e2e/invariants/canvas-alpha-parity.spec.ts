/**
 * Canvas and SVG must composite translucent overlapping marks identically.
 *
 * Red-locked bug: the canvas renderer batched all points sharing a
 * (fill, alpha) into one `beginPath()` and painted them with a single `fill()`
 * at `globalAlpha`. Circles overlapping inside one path get unioned by the fill
 * rule, so the stack was faded ONCE -- a dense cluster came out at the alpha of
 * a single dot. SVG composites each `<circle>` separately and builds toward
 * opaque. Dense scatters rendered washed out on screen while their exports
 * (which re-render through real SVG) looked right.
 *
 * This cannot be caught by a stubbed 2D context: both call sequences are legal
 * and the difference only exists in rasterized output. Hence a real browser.
 *
 * The story stacks `STACK_DEPTH` identical points at one coordinate, so the
 * correct composite is closed-form rather than a screenshot baseline:
 *   over white, luminance = 255 * (1 - opacity)^depth
 * With opacity 0.35 and depth 6 that is ~19/255. The batched bug produced
 * ~166/255 -- a gap no antialiasing tolerance can blur away.
 */

import { expect, test } from '@playwright/test';

const OPACITY = 0.35;
const STACK_DEPTH = 6;

/** Ideal src-over result for N stacked black dots at OPACITY on white. */
const EXPECTED = 255 * (1 - OPACITY) ** STACK_DEPTH;

/**
 * Generous: covers antialiasing, DPR downsampling and the canvas layer's
 * 8-bit rounding. Still ~7x tighter than the distance to the buggy value, so
 * the test discriminates the defect without policing sub-percent drift.
 */
const TOLERANCE = 20;

test('canvas composites stacked translucent points like SVG does', async ({ page }) => {
  await page.goto('/?mode=preview&story=testing--canvas-alpha-parity--stacked-translucent-points');

  // `createChart` promotes the mount node itself to `.oc-root`; the chart is not
  // nested in a further wrapper.
  await page.waitForSelector('#parity-svg.oc-root svg.oc-chart');
  await page.waitForSelector('#parity-canvas canvas.oc-mark-canvas');
  await page.evaluate(() => document.fonts.ready);
  // The canvas layer paints on a rAF tick; give it a couple of frames to land.
  await page.waitForTimeout(200);

  const sample = await page.evaluate(() => {
    const markCanvas = document.querySelector(
      '#parity-canvas canvas.oc-mark-canvas',
    ) as HTMLCanvasElement | null;
    if (!markCanvas) return { error: 'no mark canvas' };

    const ctx = markCanvas.getContext('2d');
    if (!ctx) return { error: '2d context unavailable' };

    const { width, height } = markCanvas;
    const data = ctx.getImageData(0, 0, width, height).data;

    /**
     * Composite a pixel over white, so the reading is comparable regardless of
     * whether the layer painted an opaque background or left it transparent.
     */
    const lumAt = (i: number): number => {
      const a = data[i + 3] / 255;
      return data[i] * a + 255 * (1 - a);
    };

    // Locate the stack rather than trusting a computed coordinate.
    //
    // Deliberate: on the canvas side `.oc-marks` is an EMPTY svg group (the dots
    // live on the canvas), so its bounding box collapses to zero at the
    // container origin -- sampling there reads unpainted background and the test
    // would "fail" on the wrong pixel. The stack is the darkest thing drawn, so
    // searching for it is both simpler and self-validating.
    let darkest = Number.POSITIVE_INFINITY;
    let paintedPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 2) paintedPixels++;
      const lum = lumAt(i);
      if (lum < darkest) darkest = lum;
    }
    if (!Number.isFinite(darkest)) return { error: 'canvas is empty' };

    // Average the INTERIOR of the stack, not a box centred on the darkest pixel.
    //
    // The darkest pixel is frequently on the dot's antialiased rim, so a box
    // around it straddles the edge and averages dot with background -- that read
    // lands ~100 even on a correct render and would make this test lie in both
    // directions. Instead: take every pixel at or very near the darkest value.
    // On a correct render that is the flat interior of the stack; if compositing
    // regresses, the whole interior shifts together and the mean moves with it.
    const NEAR = 4;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = lumAt(i);
      if (lum <= darkest + NEAR) {
        sum += lum;
        count++;
      }
    }

    return {
      canvasLuminance: sum / count,
      darkest,
      interiorPixels: count,
      paintedPixels,
      // If the SVG side stopped drawing dots the comparison would be vacuous.
      svgCircleCount: document.querySelectorAll('#parity-svg circle.oc-mark-point').length,
      canvasCircleCount: document.querySelectorAll('#parity-canvas circle.oc-mark-point').length,
    };
  });

  if ('error' in sample) throw new Error(`sampling failed: ${sample.error}`);

  // Guard the premise: SVG really did draw the stack, canvas really did not,
  // and the canvas actually painted something for us to measure.
  expect(sample.svgCircleCount, 'SVG chart should render real circles').toBe(STACK_DEPTH);
  expect(sample.canvasCircleCount, 'canvas chart should have no SVG circles').toBe(0);
  expect(sample.paintedPixels, 'canvas painted nothing to sample').toBeGreaterThan(100);

  // eslint-disable-next-line no-console
  console.log(
    `alpha parity: interior=${sample.canvasLuminance.toFixed(1)} darkest=${sample.darkest.toFixed(1)} ` +
      `expected=${EXPECTED.toFixed(1)} (interiorPx=${sample.interiorPixels})`,
  );

  // The stack must cover a real area. A single dot at r=14 is ~600px; six
  // coincident dots stay ~600. If this collapses, the renderer stopped drawing
  // the cluster and the luminance readings below would be measuring noise.
  expect(sample.interiorPixels, 'stack interior too small to trust').toBeGreaterThan(200);

  const message =
    `canvas luminance ${sample.canvasLuminance.toFixed(1)} should be within ${TOLERANCE} of ` +
    `${EXPECTED.toFixed(1)}. A value near 166 means overlapping points were batched into one ` +
    `path and faded once instead of compositing individually.`;

  // Assert on BOTH the interior mean and the darkest pixel. The mean alone is
  // weak by construction -- it averages pixels selected for being near the
  // darkest, so it tracks `darkest` and would look tight even if the whole
  // stack lightened. Pinning `darkest` to the expected composite is what
  // actually catches a compositing regression.
  expect(Math.abs(sample.darkest - EXPECTED), message).toBeLessThan(TOLERANCE);
  expect(Math.abs(sample.canvasLuminance - EXPECTED), message).toBeLessThan(TOLERANCE);
});
