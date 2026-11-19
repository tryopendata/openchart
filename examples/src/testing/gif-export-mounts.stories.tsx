// The frame sampler's module types its lazy `gifenc` import against vanilla's ambient declaration.
/// <reference path="../../../packages/vanilla/src/gifenc.d.ts" />

/**
 * Testing / GIF export beyond charts: bar list, tile map, sankey and map.
 *
 * Not an editorial demo. Each story mounts an animated visualization, exports
 * its entrance as a GIF and a PNG, decodes both in the browser and writes the
 * evidence to `#gif-mount-result` for `e2e/gif/gif-export.spec.ts`:
 *   - the first GIF frame differs from the last (it animates);
 *   - the last GIF frame matches the PNG export (it settles where the export does);
 *   - mid-entrance values from the same frame sampler the GIF uses (a map
 *     feature's fill partway from the neutral to its color, a bar list row
 *     partway up its 4px slide, a focused map's dimmed features ending dim).
 */

import type {
  BarListSpec,
  GeoMapSpec,
  ResolvedAnimation,
  SankeySpec,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import {
  createBarList,
  createGeoMap,
  createSankey,
  createTileMap,
} from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef, useState } from 'react';
import usStatesTopo from 'us-atlas/states-albers-10m.json';
import { createFrameSampler } from '../../../packages/vanilla/src/export-gif';
import { energyFlow } from '../data/energy-flow';
import { stateEconomies } from '../data/state-economies';
import { usStateUnemployment } from '../data/us-state-unemployment';

export default { title: 'Testing / Gif Export Mounts' };

const economies = stateEconomies.data.map((row) => ({ ...row }));

const barlist: BarListSpec = {
  type: 'barlist',
  animation: true,
  data: economies.slice(0, 5),
  encoding: {
    label: { field: 'state', type: 'nominal' },
    value: { field: 'gdp', type: 'quantitative' },
  },
};

const tilemap: TileMapSpec = {
  type: 'tilemap',
  animation: true,
  data: { ...usStateUnemployment.data },
};

const sankey: SankeySpec = {
  type: 'sankey',
  animation: true,
  data: energyFlow.data.map((row) => ({ ...row })),
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
};

const map = (focus?: string): GeoMapSpec => ({
  type: 'map',
  animation: true,
  geo: { features: usStatesTopo, idField: 'name', ...(focus ? { focus } : {}) },
  data: economies,
  encoding: {
    key: { field: 'state', type: 'nominal' },
    color: { field: 'gdp', type: 'quantitative' },
  },
});

interface Exportable {
  export(format: 'gif' | 'png', options?: { dpi?: number; fps?: number }): unknown;
  destroy(): void;
  readonly layout: { animation?: ResolvedAnimation };
}

// ---------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------

// The DOM lib in this TypeScript version doesn't carry WebCodecs' ImageDecoder.
interface GifDecoder {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  completed: Promise<void>;
  decode(o: { frameIndex: number }): Promise<{ image: CanvasImageSource & { close(): void } }>;
  close(): void;
}
type GifDecoderCtor = new (init: { data: ReadableStream; type: string }) => GifDecoder;

function pixels(source: CanvasImageSource, width: number, height: number): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  // GIF frames are opaque on the chart background (white when transparent).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

async function decodeGif(
  blob: Blob,
): Promise<{ frames: Uint8ClampedArray[]; w: number; h: number }> {
  const bitmap = await createImageBitmap(blob);
  const { width: w, height: h } = bitmap;
  bitmap.close();
  const Decoder = (globalThis as unknown as { ImageDecoder: GifDecoderCtor }).ImageDecoder;
  const decoder = new Decoder({ data: blob.stream(), type: 'image/gif' });
  await decoder.tracks.ready;
  await decoder.completed;
  const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < count; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    frames.push(pixels(image, w, h));
    image.close();
  }
  decoder.close();
  return { frames, w, h };
}

/** Mean absolute difference per channel (0-255), over RGB. */
function meanDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n += 3;
  }
  return sum / n;
}

// ---------------------------------------------------------------------------
// Mid-entrance probes (the GIF's own frame sampler, run on the live scene)
// ---------------------------------------------------------------------------

const rgb = (color: string): number[] => {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
};

type Probe = (svg: SVGElement, animation: ResolvedAnimation | undefined) => Record<string, unknown>;

/** Run the sampler on a copy of the live scene at every 10ms of the entrance. */
function sweep(
  svg: SVGElement,
  animation: ResolvedAnimation | undefined,
  read: (clone: SVGElement) => void,
): { clone: SVGElement; sampler: ReturnType<typeof createFrameSampler> } {
  const clone = svg.cloneNode(true) as SVGElement;
  const sampler = createFrameSampler(clone, animation);
  for (let t = 0; t <= sampler.endMs; t += 10) {
    sampler.apply(t);
    read(clone);
  }
  return { clone, sampler };
}

/** Some map feature's fill sits strictly between the neutral and its own color. */
const mapFillProbe: Probe = (svg, animation) => {
  let between = false;
  let sample: unknown = null;
  sweep(svg, animation, (clone) => {
    const neutral = rgb(clone.style.getPropertyValue('--oc-secondary'));
    for (const el of clone.querySelectorAll<SVGElement>('.oc-map-feature')) {
      const target = el.style.getPropertyValue('--oc-feature-fill');
      if (!target || target.startsWith('url(') || !el.style.fill) continue;
      const final = rgb(target);
      const now = rgb(el.style.fill);
      const inside = now.every((v, i) => {
        if (neutral[i] === final[i]) return v === final[i];
        return v > Math.min(neutral[i], final[i]) && v < Math.max(neutral[i], final[i]);
      });
      if (inside && !between) {
        between = true;
        sample = { neutral, final, now };
      }
    }
  });
  return { fillBetween: between, fillSample: sample };
};

/** Some bar list row's translateY sits strictly between 4px and 0. */
const slideProbe: Probe = (svg, animation) => {
  const seen: number[] = [];
  sweep(svg, animation, (clone) => {
    for (const row of clone.querySelectorAll<SVGElement>('.oc-barlist-row')) {
      const y = /translateY\(([-\d.e]+)px\)/.exec(row.style.transform)?.[1];
      if (y !== undefined) seen.push(Number(y));
    }
  });
  return { slideBetween: seen.some((y) => y > 0 && y < 4), slideMax: Math.max(...seen) };
};

/** Some animated element is partway through its fade. */
const fadeProbe: Probe = (svg, animation) => {
  let partial = false;
  sweep(svg, animation, (clone) => {
    for (const el of clone.querySelectorAll<SVGElement>('[style*="opacity"]')) {
      const o = Number(el.style.opacity);
      if (o > 0 && o < 1) partial = true;
    }
  });
  return { fadeBetween: partial };
};

/** Dimmed features fade toward the dim and end on it, and the settled scene holds it. */
const focusProbe =
  (focused: string): Probe =>
  (svg, animation) => {
    let maxDimmed = 0;
    const { clone, sampler } = sweep(svg, animation, (scene) => {
      for (const el of scene.querySelectorAll<SVGElement>('.oc-map-feature')) {
        if (el.getAttribute('data-feature-id') === focused) continue;
        maxDimmed = Math.max(maxDimmed, Number(el.style.opacity || 1));
      }
    });
    const opacities = (scene: SVGElement) =>
      Array.from(scene.querySelectorAll<SVGElement>('.oc-map-feature'))
        .filter((el) => el.getAttribute('data-feature-id') !== focused)
        .map((el) => Number(el.style.opacity || 1));
    sampler.apply(sampler.endMs);
    const atEnd = opacities(clone);
    sampler.apply(null);
    const settled = opacities(clone);
    return {
      dimmedMax: maxDimmed,
      dimmedAtEnd: [Math.min(...atEnd), Math.max(...atEnd)],
      dimmedSettled: [Math.min(...settled), Math.max(...settled)],
    };
  };

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function GifProbe({ mount, probe }: { mount: (el: HTMLElement) => Exportable; probe: Probe }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState('pending');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const instance = mount(el);
    let cancelled = false;

    (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        const gif = (await instance.export('gif', { fps: 20, dpi: 1 })) as Blob;
        const png = (await instance.export('png', { dpi: 1 })) as Blob;
        const { frames, w, h } = await decodeGif(gif);
        const pngBitmap = await createImageBitmap(png);
        const pngPixels = pixels(pngBitmap, w, h);
        const sameSize = pngBitmap.width === w && pngBitmap.height === h;
        pngBitmap.close();
        const svg = el.querySelector('svg') as SVGElement;
        const evidence = {
          frames: frames.length,
          sameSize,
          firstVsLast: meanDiff(frames[0], frames[frames.length - 1]),
          lastVsPng: meanDiff(frames[frames.length - 1], pngPixels),
          ...probe(svg, instance.layout.animation),
        };
        if (!cancelled) setResult(JSON.stringify(evidence));
      } catch (err) {
        if (!cancelled) setResult(`error: ${(err as Error).message}`);
      }
    })();

    return () => {
      cancelled = true;
      instance.destroy();
    };
  }, [mount, probe]);

  return (
    <div>
      <div ref={containerRef} style={{ width: 560 }} />
      <pre id="gif-mount-result" data-result={result}>
        {result}
      </pre>
    </div>
  );
}

const mountBarList = (el: HTMLElement) => createBarList(el, barlist) as unknown as Exportable;
const mountTileMap = (el: HTMLElement) => createTileMap(el, tilemap) as unknown as Exportable;
const mountSankey = (el: HTMLElement) => createSankey(el, sankey) as unknown as Exportable;
const mountMap = (el: HTMLElement) => createGeoMap(el, map()) as unknown as Exportable;
const mountFocusMap = (el: HTMLElement) => createGeoMap(el, map('06')) as unknown as Exportable;
const californiaFocus = focusProbe('06');

export const BarList = () => <GifProbe mount={mountBarList} probe={slideProbe} />;
export const TileMap = () => <GifProbe mount={mountTileMap} probe={fadeProbe} />;
export const Sankey = () => <GifProbe mount={mountSankey} probe={fadeProbe} />;
export const GeoMap = () => <GifProbe mount={mountMap} probe={mapFillProbe} />;
export const GeoMapFocus = () => <GifProbe mount={mountFocusMap} probe={californiaFocus} />;
