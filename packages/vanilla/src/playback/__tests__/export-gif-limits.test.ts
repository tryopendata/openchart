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

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  vi.spyOn(svgExport, 'rasterizeSVGToCanvas').mockImplementation(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    // happy-dom has no 2D context; supply the pixel readback the encoder needs.
    const painter = {
      fillStyle: '',
      fillRect() {},
      getImageData: () => ({ data: new Uint8ClampedArray(16) }),
    };
    Object.defineProperty(canvas, 'getContext', { value: () => painter });
    return canvas;
  });
});

afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
});

function source(overrides: Partial<PlaybackGIFSource> = {}): PlaybackGIFSource {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '80');
  host.append(svg);
  return {
    svg,
    periodCount: 3,
    durationMs: 1000,
    holdEndMs: 500,
    styleSelectors: [],
    paletteSeed: [],
    draw() {},
    ...overrides,
  };
}

function finalDelay() {
  return encoder.writeFrame.mock.calls.at(-1)?.[3]?.delay;
}

describe('exportPlaybackGIF limits', () => {
  it('holds a zero-length end for the shortest delay browsers honor', async () => {
    await exportPlaybackGIF(source({ holdEndMs: 0 }), { fps: 2 });
    expect(finalDelay()).toBe(20);
  });

  it('caps a hold beyond the GIF delay field at its maximum', async () => {
    await exportPlaybackGIF(source({ holdEndMs: 10_000_000 }), { fps: 2 });
    expect(finalDelay()).toBe(655_350);
  });

  it.each([0, -1, Number.NaN])('rejects periodCount %s, naming it', async (periodCount) => {
    await expect(exportPlaybackGIF(source({ periodCount }), { fps: 2 })).rejects.toThrow(
      new RangeError(`GIF export needs at least one period, received periodCount ${periodCount}`),
    );
    expect(encoder.writeFrame).not.toHaveBeenCalled();
  });

  it.each([
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects durationMs %s, naming it', async (durationMs) => {
    await expect(exportPlaybackGIF(source({ durationMs }), { fps: 2 })).rejects.toThrow(
      new RangeError(`GIF export durationMs must be finite and >= 0, received ${durationMs}`),
    );
    expect(encoder.writeFrame).not.toHaveBeenCalled();
  });

  it('names the received and maximum duration when the run is too long for a GIF', async () => {
    await expect(
      exportPlaybackGIF(source({ durationMs: 8_000_000_000 }), { fps: 2 }),
    ).rejects.toThrow(
      new RangeError(
        'Playback duration exceeds the GIF limit. Shorten the playback duration. Received 8000000000 ms; the maximum is 785764650 ms.',
      ),
    );
  });

  it("keeps the race's over-limit message verbatim", async () => {
    await expect(
      exportPlaybackGIF(source({ durationMs: 8_000_000_000, noun: 'race' }), { fps: 2 }),
    ).rejects.toThrow(
      new RangeError('Race duration exceeds the GIF limit. Shorten the race duration.'),
    );
  });
});
