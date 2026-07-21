/**
 * Shared gifenc frame-encoding primitives.
 *
 * Both GIF exporters (`export-gif.ts`, entrance animation; `export-sequence.ts`,
 * spec-swap keyframes) need the same low-level steps: read a canvas back in
 * sRGB (the export canvas may be display-p3, but gifenc's quantizer assumes sRGB
 * bytes), quantize a shared palette, and write indexed frames. They differ only
 * in how they PRODUCE canvases — synthesized per time-step vs. one per spec — so
 * that stays in each caller; only these primitives are shared, which keeps the
 * sRGB-readback subtlety in exactly one place.
 */

/**
 * Read a canvas's pixels back in sRGB. The export canvas may be display-p3 (so
 * PNG/JPG can embed a wide-gamut profile), but GIF is sRGB-only and gifenc's
 * quantizer assumes sRGB bytes — feeding it P3-encoded data would shift and
 * desaturate the GIF. The browser converts P3→sRGB on readback.
 */
export function readCanvasSRGB(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  return ctx.getImageData(0, 0, canvas.width, canvas.height, {
    colorSpace: 'srgb',
  }).data;
}

/** Quantize a 256-color palette from a canvas's sRGB pixels. */
export function paletteFromCanvas(
  canvas: HTMLCanvasElement,
  quantize: (data: Uint8ClampedArray, maxColors: number) => number[][],
): number[][] {
  return quantize(readCanvasSRGB(canvas), 256);
}
