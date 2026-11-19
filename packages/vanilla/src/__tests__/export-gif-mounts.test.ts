/**
 * `export('gif')` on the non-chart mounts (bar list, tile map, sankey, map).
 *
 * happy-dom can't rasterize, so the rasterizer is replaced by one that records
 * the SVG markup of each frame. That markup is what the GIF encodes: it shows
 * whether each mount hands the sampler a scene with its entrance stamps, and
 * whether the frames animate and settle where the live mount does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createBarList } from '../barlist-mount';
import * as exportModule from '../export';
import { FOCUS_DIM_OPACITY } from '../map-camera';
import { createGeoMap } from '../map-mount';
import { createSankey } from '../sankey-mount';
import { createTileMap } from '../tilemap-mount';

// `gifenc` is an optional peer that isn't installed here.
vi.mock('gifenc', () => ({
  GIFEncoder: () => ({ writeFrame: () => {}, finish: () => {}, bytes: () => new Uint8Array() }),
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array(),
}));

let frames: string[];

beforeEach(() => {
  frames = [];
  vi.spyOn(exportModule, 'rasterizeSVGToCanvas').mockImplementation(async (svg, w, h, dpi) => {
    frames.push(svg);
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

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const MINI_TOPO = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [0, 0] },
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
      ],
    },
  },
  arcs: [
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
  ],
};

const mapSpec = (focus?: string) => ({
  type: 'map' as const,
  animation: true,
  geo: { features: MINI_TOPO, projection: 'mercator' as const, ...(focus ? { focus } : {}) },
  data: [
    { fips: '06', value: 10 },
    { fips: '48', value: 20 },
  ],
  encoding: {
    key: { field: 'fips', type: 'nominal' as const },
    color: { field: 'value', type: 'quantitative' as const },
  },
});

interface GifInstance {
  export(format: 'gif', options?: exportModule.PNGExportOptions & { fps?: number }): unknown;
  destroy(): void;
}

const opts = { autoResize: false } as const;

const cases: Array<{ name: string; root: string; mount(c: HTMLElement): GifInstance }> = [
  {
    name: 'barlist',
    root: 'oc-barlist',
    mount: (c) =>
      createBarList(
        c,
        {
          type: 'barlist',
          animation: true,
          data: [
            { name: 'A', value: 4 },
            { name: 'B', value: 9 },
          ],
          encoding: {
            label: { field: 'name', type: 'nominal' },
            value: { field: 'value', type: 'quantitative' },
          },
        },
        opts,
      ),
  },
  {
    name: 'tilemap',
    root: 'oc-tilemap',
    mount: (c) =>
      createTileMap(c, { type: 'tilemap', animation: true, data: { CA: 5, TX: 4 } }, opts),
  },
  {
    name: 'sankey',
    root: 'oc-sankey',
    mount: (c) =>
      createSankey(
        c,
        {
          type: 'sankey',
          animation: true,
          data: [
            { from: 'A', to: 'C', amount: 10 },
            { from: 'B', to: 'C', amount: 20 },
          ],
          encoding: {
            source: { field: 'from', type: 'nominal' },
            target: { field: 'to', type: 'nominal' },
            value: { field: 'amount', type: 'quantitative' },
          },
        },
        opts,
      ),
  },
  { name: 'map', root: 'oc-map', mount: (c) => createGeoMap(c, mapSpec(), opts) },
];

const parse = (markup: string): SVGSVGElement =>
  new DOMParser().parseFromString(markup, 'image/svg+xml')
    .documentElement as unknown as SVGSVGElement;

async function exportFrames(instance: GifInstance): Promise<SVGSVGElement[]> {
  await instance.export('gif', { embedFonts: false, fps: 10 } as never);
  // The first rasterization seeds the palette from the settled scene.
  return frames.slice(1).map(parse);
}

describe.each(cases)('$name export("gif")', ({ root, mount }) => {
  it('encodes an animated entrance that settles on a still scene', async () => {
    const instance = mount(createContainer());
    const scenes = await exportFrames(instance);
    instance.destroy();

    expect(scenes.length).toBeGreaterThan(2);
    for (const svg of scenes) {
      expect(svg.getAttribute('class')).toContain(root);
      // Nothing plays on the detached copy: frames are inline values only.
      expect(svg.getAttribute('class')).not.toContain('oc-animate');
    }
    const first = scenes[0];
    const last = scenes[scenes.length - 1];
    // The sampler found entrance targets and wrote a from-state.
    expect(first.querySelector('[style*="opacity: 0"], [style*="opacity:0"]')).not.toBeNull();
    expect(first.outerHTML).not.toBe(last.outerHTML);
    expect(last.querySelector('[style*="opacity: 0;"]')).toBeNull();
  });
});

describe('map export("gif") under a focus', () => {
  const feature = (svg: SVGSVGElement, id: string) =>
    svg.querySelector<SVGElement>(`.oc-map-feature[data-feature-id="${id}"]`);

  it('fades dimmed features to the dim opacity and holds them there', async () => {
    const instance = createGeoMap(createContainer(), mapSpec('06'), opts);
    const scenes = await exportFrames(instance);
    instance.destroy();

    const last = scenes[scenes.length - 1];
    expect(Number(feature(last, '48')?.style.opacity)).toBeCloseTo(FOCUS_DIM_OPACITY, 6);
    expect(Number(feature(last, '06')?.style.opacity || 1)).toBe(1);

    // Mid-entrance, the dimmed feature is on its way to the dim, never above it.
    const dimmed = scenes.map((s) => Number(feature(s, '48')?.style.opacity));
    expect(Math.max(...dimmed)).toBeLessThanOrEqual(FOCUS_DIM_OPACITY + 1e-9);
    expect(dimmed.some((o) => o > 0 && o < FOCUS_DIM_OPACITY)).toBe(true);
  });
});
