import {
  ensureSVGDimensions,
  exportSVG,
  getSVGBackgroundColor,
  getSVGDimensions,
  rasterizeSVGToCanvas,
} from './export';
import type { GIFExportOptions } from './export-gif';
import { readCanvasSRGB } from './gif-encode';

/** Tell a missing optional peer apart from a failure during module evaluation. */
export function isModuleNotFound(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return true;
  const message = (err as { message?: string })?.message ?? '';
  return /cannot find (module|package)|failed to (resolve|fetch)/i.test(message);
}

/** Map play-once, forever, or an explicit loop count to gifenc's repeat flag. */
export function resolveRepeat(loop: boolean | number | undefined): number {
  if (loop === true) return 0;
  if (typeof loop === 'number') return loop;
  return -1;
}

interface GIFFrames {
  svg: SVGElement;
  count: number;
  /** Draw a frame and return its delay in milliseconds. Null draws the settled frame. */
  draw(index: number | null): number;
  /** Reserve colors that may disappear by the settled frame and write only a global table. */
  globalPalette?: {
    swatches: SVGElement;
    startFrames(): void;
  };
}

/** Rasterize a detached scene to a GIF, using its settled frame for a global palette. */
export async function encodeSVGFrames(
  source: SVGElement,
  options: GIFExportOptions | undefined,
  prepare: () => Promise<GIFFrames>,
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted();
  let gifenc: typeof import('gifenc');
  try {
    gifenc = await import('gifenc');
  } catch (err) {
    if (isModuleNotFound(err)) {
      throw new Error(
        "GIF export requires the optional 'gifenc' peer dependency. Install it: npm install gifenc",
      );
    }
    throw new Error('GIF export failed to load the gifenc encoder', { cause: err });
  }
  signal?.throwIfAborted();
  const { width, height } = getSVGDimensions(source);
  if (!width || !height) {
    throw new Error(`SVG has zero dimensions (width=${width}, height=${height})`);
  }

  const { svg, count, draw, globalPalette } = await prepare();
  signal?.throwIfAborted();
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const dpi = options?.dpi ?? 2;
  const repeat = resolveRepeat(options?.loop);
  const background =
    options?.backgroundColor ?? getSVGBackgroundColor(source, options?.theme?.colors.background);

  async function rasterize(scene: SVGElement, w: number, h: number, scale: number) {
    signal?.throwIfAborted();
    const markup = ensureSVGDimensions(exportSVG(scene), w, h);
    const canvas = await rasterizeSVGToCanvas(markup, w, h, scale, (ctx, cv) => {
      // Fill the raw device-pixel canvas before the rasterizer scales it.
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, cv.width, cv.height);
    });
    signal?.throwIfAborted();
    return canvas;
  }

  const gif = GIFEncoder();
  draw(null);
  const seed = readCanvasSRGB(await rasterize(svg, width, height, dpi));
  const reserved = new Map<number, number[]>();
  if (globalPalette) {
    const { swatches } = globalPalette;
    const size = getSVGDimensions(swatches);
    const rgba = readCanvasSRGB(await rasterize(swatches, size.width, size.height, 1));
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      reserved.set((r << 16) | (g << 8) | b, [r, g, b]);
    }
    globalPalette.startFrames();
  }
  const palette = quantize(seed, 256 - reserved.size);
  palette.push(...reserved.values());

  async function writeFrame(index: number | null, first: boolean) {
    const delay = draw(index);
    const canvas = await rasterize(svg, width, height, dpi);
    const pixels = applyPalette(readCanvasSRGB(canvas), palette);
    gif.writeFrame(pixels, canvas.width, canvas.height, {
      delay,
      ...(first ? { repeat } : {}),
      ...(first || !globalPalette ? { palette } : {}),
    });
  }

  for (let index = 0; index < count; index++) await writeFrame(index, index === 0);
  await writeFrame(null, !(count > 0));
  gif.finish();
  return new Blob([Uint8Array.from(gif.bytes())], { type: 'image/gif' });
}
