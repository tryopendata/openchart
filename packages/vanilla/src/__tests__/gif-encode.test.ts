/**
 * gif-encode primitives under happy-dom.
 *
 * The real rasterizer path runs in the Playwright `gif` project (see
 * e2e/gif/gif-export.spec.ts); these unit tests pin the contract seams a
 * browser test can't isolate: the sRGB readback request and the palette
 * delegation to gifenc's quantizer.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { paletteFromCanvas, readCanvasSRGB } from '../gif-encode';

function stubbedCanvas(pixels: Uint8ClampedArray, capture: { colorSpace?: string }) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 1;
  const fakeCtx = {
    getImageData: (_x: number, _y: number, _w: number, _h: number, opts?: ImageDataSettings) => {
      capture.colorSpace = opts?.colorSpace;
      return { data: pixels } as ImageData;
    },
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
  return canvas;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readCanvasSRGB', () => {
  it('reads pixels back explicitly in sRGB', () => {
    // The export canvas may be display-p3; gifenc's quantizer assumes sRGB
    // bytes, so the readback must request the conversion.
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    const capture: { colorSpace?: string } = {};
    const canvas = stubbedCanvas(pixels, capture);

    const data = readCanvasSRGB(canvas);

    expect(data).toBe(pixels);
    expect(capture.colorSpace).toBe('srgb');
  });

  it('throws when no 2D context is available', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(() => readCanvasSRGB(canvas)).toThrow('Canvas 2D context not available');
  });
});

describe('paletteFromCanvas', () => {
  it('quantizes the sRGB pixels to a 256-color palette', () => {
    const pixels = new Uint8ClampedArray([1, 2, 3, 255]);
    const canvas = stubbedCanvas(pixels, {});

    const palette = [[1, 2, 3]];
    const quantize = vi.fn(() => palette);

    expect(paletteFromCanvas(canvas, quantize)).toBe(palette);
    expect(quantize).toHaveBeenCalledWith(pixels, 256);
  });
});
