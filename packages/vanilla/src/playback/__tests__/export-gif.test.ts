import { resolveTheme } from '@opendata-ai/openchart-core';
import type { GifencEncoder } from 'gifenc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as svgExport from '../../export';
import { SVG_NS } from '../../renderers/svg-dom';
import { exportPlaybackGIF, type PlaybackGIFSource } from '../export-gif';

const { encoder, quantize, applyPalette } = vi.hoisted(() => ({
  encoder: {
    writeFrame: vi.fn<GifencEncoder['writeFrame']>(),
    finish: vi.fn(),
    bytes: vi.fn<GifencEncoder['bytes']>(() => new Uint8Array([71, 73, 70, 56, 57, 97])),
    bytesView: vi.fn<GifencEncoder['bytesView']>(() => new Uint8Array([71, 73, 70, 56, 57, 97])),
  },
  quantize: vi.fn(() => [
    [0, 0, 0],
    [255, 255, 255],
  ]),
  applyPalette: vi.fn<typeof import('gifenc').applyPalette>(() => new Uint8Array(4)),
}));

vi.mock('gifenc', () => ({ GIFEncoder: () => encoder, quantize, applyPalette }));

let host: HTMLDivElement;
let markups: string[];
let backgrounds: string[];

function canvas() {
  const element = document.createElement('canvas');
  element.width = 2;
  element.height = 2;
  const painter = {
    fillStyle: '',
    fillRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray(16) }),
  };
  Object.defineProperty(element, 'getContext', { value: () => painter });
  return { element, painter };
}

beforeEach(() => {
  vi.clearAllMocks();
  markups = [];
  backgrounds = [];
  host = document.createElement('div');
  document.body.append(host);
  vi.spyOn(svgExport, 'rasterizeSVGToCanvas').mockImplementation(
    async (markup, _w, height, _dpi, prepare) => {
      // Palette swatches rasterize at a height of 1; keep only the scene frames.
      if (height === 80) markups.push(markup);
      const { element, painter } = canvas();
      if (prepare) {
        prepare(painter as unknown as CanvasRenderingContext2D, element);
        backgrounds.push(painter.fillStyle);
      }
      return element;
    },
  );
});

afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
});

function source(overrides: Partial<PlaybackGIFSource> = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '80');
  const mark = document.createElementNS(SVG_NS, 'rect');
  mark.setAttribute('class', 'oc-playback-mark');
  svg.append(mark);
  host.append(svg);
  const drawn: number[] = [];
  const value: PlaybackGIFSource = {
    svg,
    periodCount: 3,
    durationMs: 1000,
    holdEndMs: 500,
    styleSelectors: ['.oc-playback-mark'],
    paletteSeed: ['#ff0000', '#0000ff'],
    draw(t, frame) {
      expect(frame).not.toBe(svg);
      drawn.push(t);
    },
    ...overrides,
  };
  return { value, drawn };
}

function frameDelays() {
  return encoder.writeFrame.mock.calls.map(([, , , frame]) => frame?.delay);
}

describe('exportPlaybackGIF', () => {
  it('draws once per frame at fps over the duration, then holds the final frame', async () => {
    const { value, drawn } = source();
    const blob = await exportPlaybackGIF(value, { fps: 4 });
    expect(blob.type).toBe('image/gif');
    expect(drawn.slice(-5)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(frameDelays()).toEqual([250, 250, 250, 250, 500]);
  });

  it('honors loop, dpi and backgroundColor', async () => {
    await exportPlaybackGIF(source().value, {
      fps: 2,
      loop: true,
      dpi: 1,
      backgroundColor: '#123456',
    });
    expect(encoder.writeFrame.mock.calls[0][3]).toMatchObject({ repeat: 0 });
    const scales = vi
      .mocked(svgExport.rasterizeSVGToCanvas)
      .mock.calls.filter(([, , height]) => height === 80)
      .map(([, , , dpi]) => dpi);
    expect(new Set(scales)).toEqual(new Set([1]));
    expect(new Set(backgrounds)).toEqual(new Set(['#123456']));
  });

  it('plays once at dpi 2 by default', async () => {
    await exportPlaybackGIF(source().value, { fps: 2 });
    expect(encoder.writeFrame.mock.calls[0][3]).toMatchObject({ repeat: -1 });
    const scales = vi
      .mocked(svgExport.rasterizeSVGToCanvas)
      .mock.calls.filter(([, , height]) => height === 80)
      .map(([, , , dpi]) => dpi);
    expect(new Set(scales)).toEqual(new Set([2]));
  });

  it('embeds fonts unless embedFonts is false', async () => {
    const embed = vi.spyOn(svgExport, 'embedFonts');
    await exportPlaybackGIF(source().value, { fps: 2, embedFonts: false });
    expect(embed).not.toHaveBeenCalled();
    await exportPlaybackGIF(source().value, { fps: 2 });
    expect(embed).toHaveBeenCalled();
  });

  it('inlines a theme style block only when a theme is given', async () => {
    await exportPlaybackGIF(source().value, { fps: 2 });
    expect(markups.some((markup) => markup.includes('data-oc-theme'))).toBe(false);
    markups = [];
    await exportPlaybackGIF(source().value, { fps: 2, theme: resolveTheme({}) });
    expect(markups.every((markup) => markup.includes('data-oc-theme'))).toBe(true);
  });

  it('rejects a non-positive fps', async () => {
    await expect(exportPlaybackGIF(source().value, { fps: 0 })).rejects.toThrow(RangeError);
  });
});
