/**
 * `export('gif')` on a time-encoded map resolves its run length and loop as a chart does:
 * the export options win, else the spec's playback timing.
 *
 * happy-dom can't rasterize, so the rasterizer is replaced by one that returns blank
 * canvases, and gifenc by an encoder that records each written frame.
 */
import type { DataRow, TileMapSpec } from '@opendata-ai/openchart-core';
import type { GifencEncoder } from 'gifenc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import * as exportModule from '../export';
import { createTileMap } from '../tilemap-mount';

const { encoder } = vi.hoisted(() => ({
  encoder: {
    writeFrame: vi.fn<GifencEncoder['writeFrame']>(),
    finish: vi.fn(),
    bytes: vi.fn<GifencEncoder['bytes']>(() => new Uint8Array()),
    bytesView: vi.fn<GifencEncoder['bytesView']>(() => new Uint8Array()),
  },
}));

vi.mock('gifenc', () => ({
  GIFEncoder: () => encoder,
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array(),
}));

const RUN_MS = 1000;
const FPS = 10;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(exportModule, 'rasterizeSVGToCanvas').mockImplementation(async (_svg, w, h, dpi) => {
    const canvas = document.createElement('canvas');
    canvas.width = w * dpi;
    canvas.height = h * dpi;
    canvas.getContext = (() => ({
      fillStyle: '',
      fillRect: () => {},
      getImageData: (_x: number, _y: number, sw: number, sh: number) => ({
        data: new Uint8ClampedArray(sw * sh * 4),
      }),
    })) as unknown as HTMLCanvasElement['getContext'];
    return canvas;
  });
});

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function rows(): DataRow[] {
  return ['CA', 'TX', 'NY'].flatMap((code, index) =>
    ['2020-01-01', '2020-02-01', '2020-03-01'].map((month, period) => ({
      code,
      month,
      rate: (1 + index) * (1 + 4 * period),
    })),
  );
}

function tileSpec(loop: boolean): TileMapSpec {
  return {
    type: 'tilemap',
    data: rows(),
    encoding: {
      state: { field: 'code', type: 'nominal' },
      value: { field: 'rate', type: 'quantitative' },
      time: { field: 'month', type: 'temporal' },
    },
    playback: { autoplay: false, duration: RUN_MS, loop },
  } as TileMapSpec;
}

function mount(spec: TileMapSpec) {
  const container = createContainer(640, 480);
  const map = createTileMap(container, spec, { autoResize: false });
  cleanup.push(() => map.destroy());
  return map;
}

/** GIF repeat of the written frames: 0 loops forever, -1 plays once. */
function writtenRepeat(): unknown {
  return encoder.writeFrame.mock.calls[0]?.[3]?.repeat;
}

describe("a time-encoded map's export('gif')", () => {
  it('loops when the playback loops', async () => {
    await mount(tileSpec(true)).export('gif', { fps: FPS, embedFonts: false });
    expect(writtenRepeat()).toBe(0);
  });

  it('lets the export loop option override the playback', async () => {
    await mount(tileSpec(true)).export('gif', { fps: FPS, loop: false, embedFonts: false });
    expect(writtenRepeat()).toBe(-1);
  });

  it('runs for the playback duration, or the export durationMs when given', async () => {
    await mount(tileSpec(false)).export('gif', { fps: FPS, embedFonts: false });
    expect(encoder.writeFrame).toHaveBeenCalledTimes((RUN_MS / 1000) * FPS + 1);
    encoder.writeFrame.mockClear();

    await mount(tileSpec(false)).export('gif', { fps: FPS, durationMs: 500, embedFonts: false });
    expect(encoder.writeFrame).toHaveBeenCalledTimes(5 + 1);
    expect(writtenRepeat()).toBe(-1);
  });
});
