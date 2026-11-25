/**
 * `chart.export('gif')` on a time spec steps through the playback; without time it keeps
 * the entrance GIF.
 *
 * happy-dom can't rasterize, so the rasterizer is replaced by one that records the SVG
 * markup of each frame: that markup is what the GIF encodes.
 */
import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import * as exportModule from '../export';
import { createChart } from '../mount';

// `gifenc` is an optional peer that isn't installed here.
vi.mock('gifenc', () => ({
  GIFEncoder: () => ({ writeFrame: () => {}, finish: () => {}, bytes: () => new Uint8Array() }),
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array(),
}));

const CHART_HEIGHT = 400;
const YEARS = [2000, 2001, 2002];
const RUN_MS = 1000;
const FPS = 10;

let rasterized: string[];

/**
 * The scenes written as GIF frames. The encoder first rasterizes the prepared (final) scene
 * to seed its palette, so that one is not a frame.
 */
function encodedFrames(): Document[] {
  return rasterized
    .slice(1)
    .map((markup) => new DOMParser().parseFromString(markup, 'image/svg+xml'));
}

beforeEach(() => {
  rasterized = [];
  vi.spyOn(exportModule, 'rasterizeSVGToCanvas').mockImplementation(async (svg, w, h, dpi) => {
    // Palette swatch strips rasterize one pixel tall; keep the scenes only.
    if (h > 1) rasterized.push(svg);
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
  return ['Avalon', 'Borea', 'Cydonia'].flatMap((country, index) =>
    YEARS.map((year, period) => ({
      country,
      region: index === 2 ? 'South' : 'North',
      year,
      gdp: (100 + 50 * index) * (period + 1),
      life: 50 + index * 5 + period,
    })),
  );
}

function timeSpec(): ChartSpec {
  return {
    mark: 'point',
    data: rows(),
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'life', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
      key: { field: 'country', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
    playback: { duration: RUN_MS, autoplay: false, trails: ['Avalon'], labels: ['Avalon'] },
  };
}

function staticSpec(): ChartSpec {
  const { time: _time, ...encoding } = timeSpec().encoding as Record<string, unknown>;
  const { playback: _playback, ...rest } = timeSpec();
  return { ...rest, encoding, animation: true } as ChartSpec;
}

function mount(spec: ChartSpec) {
  const container = createContainer(600, CHART_HEIGHT);
  const chart = createChart(container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  return { chart, container };
}

function periodLabel(frame: Document): string | null | undefined {
  return frame.querySelector('[data-key="oc-playback-period"]')?.textContent;
}

function trailVertices(frame: Document): number {
  const points = frame.querySelector('[data-trail-key="Avalon"] polyline')?.getAttribute('points');
  return points ? points.split(' ').length : 0;
}

describe("chart.export('gif') on a time spec", () => {
  it('captures one frame per sampled playhead plus the end hold, stepping through the periods', async () => {
    const { chart, container } = mount(timeSpec());
    chart.playback?.seek(1);

    const gif = await chart.export('gif', { fps: FPS, embedFonts: false });

    expect(gif).toBeInstanceOf(Blob);
    const runFrames = (RUN_MS / 1000) * FPS;
    const documents = encodedFrames();
    expect(documents).toHaveLength(runFrames + 1);
    const labels = documents.map(periodLabel);
    // Each period gets an equal share of the run, then the end hold shows the last one.
    expect(labels).toEqual([...Array(5).fill('2000'), ...Array(5).fill('2001'), '2002']);
    expect(documents.map(trailVertices)).toEqual([...Array(5).fill(2), ...Array(5).fill(3), 4]);
    // The live chart stays where the reader left it.
    expect(chart.playback?.getState().t).toBe(1);
    expect(container.querySelector('[data-key="oc-playback-period"]')?.textContent).toBe('2001');
  });

  it('runs for the export durationMs when given, keeping the playback hold', async () => {
    const { chart } = mount(timeSpec());
    await chart.export('gif', { fps: FPS, durationMs: 500, embedFonts: false });
    const documents = encodedFrames();
    expect(documents).toHaveLength(5 + 1);
    expect(periodLabel(documents[0])).toBe('2000');
    expect(periodLabel(documents[5])).toBe('2002');
  });
});

describe("chart.export('gif') without time", () => {
  it('captures the entrance: marks fade in and there is no period label', async () => {
    const { chart } = mount(staticSpec());
    await chart.export('gif', { fps: FPS, embedFonts: false });
    const documents = encodedFrames();
    expect(documents.length).toBeGreaterThan(2);
    expect(documents.every((frame) => periodLabel(frame) === undefined)).toBe(true);
    const firstPoint = documents[0].querySelector<SVGElement>('circle.oc-mark-point');
    const lastPoint = documents.at(-1)?.querySelector<SVGElement>('circle.oc-mark-point');
    expect(firstPoint?.style.opacity).toBe('0');
    expect(lastPoint?.style.opacity).not.toBe('0');
  });
});
