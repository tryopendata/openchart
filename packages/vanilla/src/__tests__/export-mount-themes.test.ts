import { resolveTheme } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createBarList } from '../barlist-mount';
import { createGeoMap } from '../map-mount';
import { createSankey } from '../sankey-mount';
import { type CanvasStub, stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';
import { createTileMap } from '../tilemap-mount';

const rows = [
  { name: 'Alpha', value: 10 },
  { name: 'Beta', value: 20 },
];
const chrome = { title: 'Exported evidence' };
const authoredTheme = { colors: { text: '#654321' } };
const families = [
  {
    name: 'barlist',
    mount: (container: HTMLElement, themed = true) =>
      createBarList(
        container,
        {
          type: 'barlist',
          data: rows,
          chrome,
          theme: themed ? authoredTheme : undefined,
          animation: false,
          encoding: {
            label: { field: 'name', type: 'nominal' },
            value: { field: 'value', type: 'quantitative' },
          },
        },
        { responsive: false },
      ),
  },
  {
    name: 'map',
    mount: (container: HTMLElement, themed = true) =>
      createGeoMap(
        container,
        {
          type: 'map',
          data: rows,
          chrome,
          theme: themed ? authoredTheme : undefined,
          animation: false,
          geo: {
            projection: 'mercator',
            features: {
              type: 'Topology',
              objects: {
                regions: {
                  type: 'GeometryCollection',
                  geometries: [
                    { type: 'Polygon', id: 'Alpha', properties: { name: 'Alpha' }, arcs: [[0]] },
                  ],
                },
              },
              arcs: [
                [
                  [0, 0],
                  [0, 1],
                  [1, 1],
                  [1, 0],
                  [0, 0],
                ],
              ],
            },
          },
          encoding: {
            key: { field: 'name', type: 'nominal' },
            color: { field: 'value', type: 'quantitative' },
          },
        },
        { responsive: false },
      ),
  },
  {
    name: 'sankey',
    mount: (container: HTMLElement, themed = true) =>
      createSankey(
        container,
        {
          type: 'sankey',
          data: [{ from: 'Alpha', to: 'Beta', value: 10 }],
          chrome,
          theme: themed ? authoredTheme : undefined,
          animation: false,
          encoding: {
            source: { field: 'from', type: 'nominal' },
            target: { field: 'to', type: 'nominal' },
            value: { field: 'value', type: 'quantitative' },
          },
        },
        { responsive: false },
      ),
  },
  {
    name: 'tilemap',
    mount: (container: HTMLElement, themed = true) =>
      createTileMap(
        container,
        {
          type: 'tilemap',
          data: [{ state: 'CA', value: 10 }],
          chrome,
          theme: themed ? authoredTheme : undefined,
          animation: false,
          encoding: {
            state: { field: 'state', type: 'nominal' },
            value: { field: 'value', type: 'quantitative' },
          },
        },
        { responsive: false },
      ),
  },
];
const formats = ['svg', 'svg-with-fonts', 'png', 'jpg'] as const;
let canvas: CanvasStub;
let rasterSources: Blob[];
const cleanup: Array<() => void> = [];

beforeEach(() => {
  canvas = stubCanvas2D();
  rasterSources = [];
  // happy-dom has no image decoder or raster encoder. Keep the full export
  // pipeline and inspect the real SVG blob handed to the browser decoder.
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    rasterSources.push(blob as Blob);
    return 'blob:export-test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal(
    'Image',
    class {
      onload?: () => void;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    callback(new Blob(['rasterized'], { type }));
  });
});
afterEach(() => {
  for (const destroy of cleanup.splice(0)) destroy();
  canvas.restore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Read the self-contained root token cascade, without the host stylesheet. */
function exportedTextToken(svg: SVGElement): string {
  const inline = svg.style.getPropertyValue('--oc-text');
  if (inline) return inline.trim();
  let value = '';
  for (const style of svg.querySelectorAll('style')) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style.textContent ?? '');
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && svg.matches(rule.selectorText)) {
        value = rule.style.getPropertyValue('--oc-text').trim() || value;
      }
    }
  }
  return value;
}

for (const family of families) {
  describe(`${family.name} public exports`, () => {
    it('preserves host stylesheet tokens when the spec leaves them unauthored', async () => {
      const container = createContainer();
      container.classList.add('host-theme');
      const style = document.createElement('style');
      style.textContent = '.host-theme svg { --oc-text: #135790; }';
      document.head.appendChild(style);
      cleanup.push(() => style.remove());
      const instance = family.mount(container, false);
      cleanup.push(() => instance.destroy());
      expect(getComputedStyle(container.querySelector('svg')!).getPropertyValue('--oc-text')).toBe(
        '#135790',
      );
      const serialized = await instance.export('svg');
      const svg = new DOMParser().parseFromString(serialized as string, 'image/svg+xml')
        .documentElement as unknown as SVGElement;
      expect(exportedTextToken(svg)).toBe('#135790');
    });

    it.each(
      formats,
    )('preserves live host tokens in %s without mutating the live SVG', async (format) => {
      const container = createContainer();
      const instance = family.mount(container);
      cleanup.push(() => instance.destroy());
      const live = container.querySelector('svg') as SVGElement;
      live.style.setProperty('--oc-text', '#123456');
      const before = live.outerHTML;
      const result = await instance.export(format, { embedFonts: false });
      const serialized = typeof result === 'string' ? result : await rasterSources.at(-1)!.text();
      const svg = new DOMParser().parseFromString(serialized, 'image/svg+xml')
        .documentElement as unknown as SVGElement;
      expect(exportedTextToken(svg)).toBe('#123456');
      expect(svg.querySelectorAll('style[data-oc-theme]')).toHaveLength(1);
      expect(svg.querySelector('style')?.textContent).toContain('.oc-title');
      expect(live.outerHTML).toBe(before);
    });

    it.each(
      formats,
    )('lets an explicit export theme override authored and host tokens in %s', async (format) => {
      const container = createContainer();
      const instance = family.mount(container);
      cleanup.push(() => instance.destroy());
      const live = container.querySelector('svg') as SVGElement;
      live.style.setProperty('--oc-text', '#123456');
      const result = await instance.export(format, {
        embedFonts: false,
        theme: resolveTheme({ colors: { text: '#abcdef' } }),
      });
      const serialized = typeof result === 'string' ? result : await rasterSources.at(-1)!.text();
      const svg = new DOMParser().parseFromString(serialized, 'image/svg+xml')
        .documentElement as unknown as SVGElement;
      expect(exportedTextToken(svg)).toBe('#abcdef');
      expect(svg.querySelectorAll('style[data-oc-theme]')).toHaveLength(1);
      expect(live.style.getPropertyValue('--oc-text')).toBe('#123456');
    });
  });
}
