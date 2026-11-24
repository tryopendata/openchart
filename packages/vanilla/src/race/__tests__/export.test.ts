import { registerHooks } from 'node:module';
import type { RaceSpec } from '@opendata-ai/openchart-core';
import { layoutRace, prepareRace, raceGeometryAt } from '@opendata-ai/openchart-engine';
import type { GifencEncoder } from 'gifenc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as svgExport from '../../export';
import { exportGIF } from '../../export-gif';
import { createRace, type RaceInstance } from '../../race-mount';
import { exportRaceGIF } from '../export';
import { createRaceShell } from '../shell';

const { encoder, quantize, applyPalette } = vi.hoisted(() => ({
  encoder: {
    writeFrame: vi.fn<GifencEncoder['writeFrame']>(),
    finish: vi.fn(),
    bytes: () => new Uint8Array([71, 73, 70, 56, 57, 97]),
  },
  quantize: vi.fn(() => [
    [0, 0, 0],
    [255, 255, 255],
  ]),
  applyPalette: vi.fn<typeof import('gifenc').applyPalette>(() => new Uint8Array(4)),
}));

vi.mock('gifenc', () => ({ GIFEncoder: () => encoder, quantize, applyPalette }));

const options = { width: 360, height: 276 };
const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  width: options.width,
  height: options.height + 44,
  data: [
    { name: 'A', year: 2022, value: 40 },
    { name: 'B', year: 2022, value: 10 },
    { name: 'A', year: 2023, value: 50 },
    { name: 'B', year: 2023, value: 90 },
    { name: 'A', year: 2024, value: 80 },
    { name: 'B', year: 2024, value: 100 },
  ],
  encoding: { time: { field: 'year' }, key: { field: 'name' }, value: { field: 'value' } },
  chrome: { title: 'Annual standings' },
  race: { top: 2, step: 500, autoplay: false, holdEnd: 250, swap: 0 },
};

let host: HTMLDivElement;
let race: RaceInstance | undefined;
let frames: SVGSVGElement[];
let backgrounds: CanvasRenderingContext2D['fillStyle'][];

function mount(candidate = spec) {
  race = createRace(host, candidate, { autoResize: false });
  return race;
}

function canvasFrame(
  document: Document,
  prepare?: Parameters<typeof svgExport.rasterizeSVGToCanvas>[4],
  pixels = new Uint8ClampedArray(16),
) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  // Supply the pixel readback and background painter that happy-dom lacks.
  const painter = {
    fillStyle: '',
    fillRect() {},
    getImageData: () => ({ data: pixels }),
  };
  Object.defineProperty(canvas, 'getContext', { value: () => painter });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Expected a test canvas context');
  if (prepare) {
    prepare(ctx, canvas);
    backgrounds.push(ctx.fillStyle);
  }
  return canvas;
}

beforeEach(() => {
  vi.clearAllMocks();
  frames = [];
  backgrounds = [];
  host = document.createElement('div');
  document.body.append(host);
  vi.spyOn(svgExport, 'rasterizeSVGToCanvas').mockImplementation(
    async (svg, _w, _h, _dpi, prepare) => {
      // Parse the serialized SVG at the raster boundary, before any canvas work.
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const frame = parsed.querySelector('svg');
      if (!frame) throw new Error('Expected an SVG frame');
      if (_h === 1 && _dpi === 1) {
        const pixels = Array.from(frame.querySelectorAll('rect[fill]')).flatMap((swatch) => {
          const fill = swatch.getAttribute('fill') ?? '';
          const channels = fill.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)?.slice(1);
          return channels ? [...channels.map((channel) => parseInt(channel, 16)), 255] : [];
        });
        return canvasFrame(document, undefined, Uint8ClampedArray.from(pixels));
      }
      frames.push(frame);
      return canvasFrame(document, prepare);
    },
  );
});

afterEach(() => {
  race?.destroy();
  race = undefined;
  host.remove();
  vi.restoreAllMocks();
});

function frameDelays() {
  return encoder.writeFrame.mock.calls.map(([, , , frame]) => frame?.delay);
}

describe('race GIF export', () => {
  it('plays the resolved step duration at 25 fps and holds the final frame for 1.5 seconds', async () => {
    const gif = await mount().export('gif');
    expect(gif.type).toBe('image/gif');
    expect(await gif.text()).toBe('GIF89a');
    expect(frameDelays()).toEqual([...Array(25).fill(40), 1500]);
    expect(frames).toHaveLength(27); // Palette source plus all encoded frames.
    expect(frames[0].querySelector('.oc-race-period')?.textContent).toBe('2024');
    expect(frames[1].querySelector('.oc-race-period')?.textContent).toBe('2022');
    expect(frames.at(-1)?.querySelector('.oc-race-period')?.textContent).toBe('2024');
    expect(quantize).toHaveBeenCalledTimes(1);
    for (const [, palette] of applyPalette.mock.calls)
      expect(palette).toBe(quantize.mock.results[0].value);
  });

  it.each([
    { duration: 1000, fps: 60, delays: Array(50).fill(20) },
    { duration: 900_000, fps: 0.001, delays: [450_000, 450_000] },
    { duration: 5, fps: 25, delays: [20] },
  ])('uses playable GIF delay fields for $duration ms at $fps fps', async ({
    duration,
    fps,
    delays,
  }) => {
    await mount({ ...spec, race: { ...spec.race, duration, step: undefined } }).export('gif', {
      fps,
    });
    expect(frameDelays()).toEqual([...delays, 1500]);
    expect(frames[1].querySelector('.oc-race-period')?.textContent).toBe('2022');
    expect(frames.at(-1)?.querySelector('.oc-race-period')?.textContent).toBe('2024');
  });

  it('rejects a duration beyond the GIF frame and delay limits', async () => {
    await expect(
      mount({ ...spec, race: { ...spec.race, duration: 800_000_000, step: undefined } }).export(
        'gif',
      ),
    ).rejects.toThrow(/duration.*GIF/i);
    expect(frames).toHaveLength(0);
  });

  it('keeps a departing leader color in the shared palette without writing local color tables', async () => {
    const candidate: RaceSpec = {
      ...spec,
      race: { ...spec.race, top: 1 },
      theme: { colors: { categorical: ['#ff0000', '#00ff00'] } },
    };
    await mount(candidate).export('gif', { fps: 2 });
    expect(frames[0].querySelector('.oc-race-rows rect')?.getAttribute('fill')).toBe('#00ff00');
    expect(frames[1].querySelector('.oc-race-rows rect')?.getAttribute('fill')).toBe('#ff0000');
    const [first, ...rest] = encoder.writeFrame.mock.calls.map(([, , , frame]) => frame?.palette);
    expect(first).toEqual(
      expect.arrayContaining([
        [255, 0, 0],
        [0, 255, 0],
      ]),
    );
    expect(rest).toEqual([undefined, undefined]);
    for (const [, palette] of applyPalette.mock.calls) expect(palette).toBe(first);
  });

  it('fills a transparent host token with the dark theme surface', async () => {
    race = createRace(host, spec, { autoResize: false, darkMode: 'force' });
    host.querySelector('svg')?.style.setProperty('--oc-bg', 'transparent');
    await race.export('gif', { fps: 2 });
    const model = prepareRace(spec, {});
    const expected = layoutRace(model, { ...options, darkMode: true }).theme.colors.neutral.surface;
    expect(backgrounds).toContain(expected);
    expect(backgrounds).not.toContain('transparent');
  });

  it('rejects unsupported formats from JavaScript', async () => {
    const instance = mount();
    await expect(Reflect.apply(instance.export, instance, ['png'])).rejects.toThrow(
      'Unsupported export format: png',
    );
    expect(frames).toHaveLength(0);
  });

  it('exports races mounted into an iframe document', async () => {
    const frame = document.createElement('iframe');
    host.append(frame);
    const iframeHost = frame.contentDocument?.body;
    if (!iframeHost) throw new Error('Expected an iframe document');
    race = createRace(iframeHost, spec, { autoResize: false });
    expect((await race.export('gif', { fps: 2 })).type).toBe('image/gif');
    expect(frames[1].querySelector('.oc-race-period')?.textContent).toBe('2022');
  });

  it('reduces the sampling rate to fit the complete timeline and end hold into 1200 frames', async () => {
    const duration = 47_960;
    await mount({ ...spec, race: { ...spec.race, duration, step: undefined } }).export('gif', {
      fps: 50,
    });
    expect(frameDelays()).toEqual([...Array(1199).fill(40), 1500]);
    expect(frames.at(-2)?.querySelector('.oc-race-period')?.textContent).toBe('2023');
    expect(frames.at(-1)?.querySelector('.oc-race-period')?.textContent).toBe('2024');
    const model = prepareRace(spec, {});
    const geometry = raceGeometryAt(model, layoutRace(model, options), (1198 / 1199) * 2);
    if (geometry.mark !== 'bar') throw new Error('Expected bar geometry');
    const lastMovingBar = frames.at(-2)?.querySelector('[data-key="A"] rect');
    const expectedWidth = geometry.rows.find((row) => row.key === 'A')?.bar.width;
    expect(Number(lastMovingBar?.getAttribute('width'))).toBeCloseTo(expectedWidth ?? NaN, 2);
  });

  it.each([
    [false, -1],
    [true, 0],
  ])('writes GIF repeat %s as %s', async (loop, repeat) => {
    await mount({ ...spec, race: { ...spec.race, loop } }).export('gif', { fps: 2 });
    expect(encoder.writeFrame.mock.calls.map(([, , , frame]) => frame?.repeat)).toEqual([
      repeat,
      undefined,
      undefined,
    ]);
  });

  it('draws bar geometry with chrome, theme and no HTML controls in the frame', async () => {
    const themed: RaceSpec = { ...spec, theme: { colors: { background: '#101418' } } };
    await mount(themed).export('gif', { fps: 4 });
    const model = prepareRace(themed, {});
    const layout = layoutRace(model, options);
    expect(backgrounds).toEqual(Array(6).fill('#101418'));
    for (const [index, t] of [0, 0.5, 1, 1.5, 2].entries()) {
      const frame = frames[index + 1];
      const geometry = raceGeometryAt(model, layout, t);
      if (geometry.mark !== 'bar') throw new Error('Expected bar geometry');
      expect(frame.querySelector('.oc-title')?.textContent).toBe('Annual standings');
      expect(frame.querySelector('style[data-oc-theme]')?.textContent).toContain('.oc-title');
      expect(frame.querySelector('button, input, .oc-race-controls-slot')).toBeNull();
      expect(
        Array.from(frame.querySelectorAll('.oc-race-axis text'), (tick) => tick.textContent).sort(),
      ).toEqual(geometry.ticks.map((tick) => tick.label).sort());
      for (const tick of geometry.ticks) {
        const label = Array.from(frame.querySelectorAll('.oc-race-axis text')).find(
          (element) => element.textContent === tick.label,
        );
        expect(Number(label?.previousElementSibling?.getAttribute('x1'))).toBeCloseTo(
          tick.position,
          2,
        );
        expect(Number(label?.parentElement?.getAttribute('opacity'))).toBeCloseTo(tick.opacity, 2);
      }
      expect(frame.querySelector('.oc-race-period')?.textContent).toBe(geometry.period?.text);
      const rows = Array.from(
        frame.querySelectorAll('.oc-race-rows [data-key]:not([display="none"])'),
      );
      expect(rows.map((row) => row.getAttribute('data-key'))).toEqual(
        geometry.rows.map((row) => row.key),
      );
      for (const [rowIndex, row] of rows.entries()) {
        const rect = row.querySelector('rect');
        const expected = geometry.rows[rowIndex];
        expect(rect?.getAttribute('fill')).toBe(expected.color);
        expect(Number(row.getAttribute('opacity'))).toBeCloseTo(expected.opacity, 2);
        expect(Array.from(row.querySelectorAll('text'), (text) => text.textContent)).toEqual([
          expected.name.text,
          expected.value.text,
        ]);
        for (const attr of ['x', 'y', 'width', 'height'] as const) {
          expect(Number(rect?.getAttribute(attr))).toBeCloseTo(expected.bar[attr], 2);
        }
      }
    }
  });

  it('embeds the mounted period label font in every rasterized frame', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = `@font-face {
      font-family: 'RaceFont'; font-weight: 600;
      src: url('data:font/woff2;name=fixture.woff2;base64,AQID') format('woff2');
    }`;
    document.head.append(stylesheet);
    try {
      await mount({ ...spec, theme: { fonts: { family: 'RaceFont, sans-serif' } } }).export('gif', {
        fps: 2,
      });
      expect(frames).toHaveLength(4);
      for (const frame of frames) {
        expect(frame.querySelector('defs > style')?.textContent).toContain(
          'data:font/woff2;base64,AQID',
        );
      }
    } finally {
      stylesheet.remove();
    }
  });

  it('draws line geometry from the start after swapping a mounted bar race to line', async () => {
    const instance = mount();
    instance.seek(1.25);
    const line: RaceSpec = {
      ...spec,
      mark: 'line',
      data: [
        ...spec.data,
        { name: 'C', year: 2023, value: 300 },
        { name: 'C', year: 2024, value: 400 },
      ],
    };
    instance.update(line);
    await instance.export('gif', { fps: 4 });
    const model = prepareRace(line, {});
    const layout = layoutRace(model, options);
    for (const [index, t] of [0, 0.5, 1, 1.5, 2].entries()) {
      const geometry = raceGeometryAt(model, layout, t);
      if (geometry.mark !== 'line') throw new Error('Expected line geometry');
      const frame = frames[index + 1];
      const paths = Array.from(frame.querySelectorAll('path[data-key]'));
      const labels = Array.from(frame.querySelectorAll('.oc-race-line-labels > text'));
      expect(paths).toHaveLength(geometry.series.length);
      expect(labels).toHaveLength(paths.length);
      if (index === 0) {
        expect(paths.map((element) => element.getAttribute('data-key'))).toEqual(
          geometry.series.map((series) => series.key),
        );
      }
      for (const [selector, ticks, position] of [
        ['.oc-race-axis > g:first-child text', geometry.yTicks, 'y'],
        ['.oc-race-axis > g:last-child text', geometry.xTicks, 'x'],
      ] as const) {
        const actual = Array.from(frame.querySelectorAll(selector), (tick) => [
          tick.textContent,
          Number(tick.getAttribute(position)),
        ]);
        expect(actual).toEqual(
          expect.arrayContaining(ticks.map((tick) => [tick.label, tick.position])),
        );
        expect(actual).toHaveLength(ticks.length);
      }
      for (const { key, points, color, opacity, endLabel } of geometry.series) {
        const seriesIndex = paths.findIndex((element) => element.getAttribute('data-key') === key);
        const path = paths[seriesIndex];
        expect(path?.getAttribute('stroke')).toBe(color);
        expect(Number(path?.getAttribute('opacity'))).toBe(opacity);
        const commands = points.map((point, position) =>
          point
            ? `${points[position - 1] ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
            : '',
        );
        expect(path?.getAttribute('d')).toBe(commands.join(''));
        const label = labels[seriesIndex];
        expect(label?.textContent).toBe([endLabel.text, endLabel.value].filter(Boolean).join(' '));
        expect(Number(label?.getAttribute('x'))).toBe(endLabel.x);
        expect(Number(label?.getAttribute('y'))).toBe(endLabel.y);
        expect(Number(label?.getAttribute('opacity'))).toBe(opacity);
      }
    }
  });

  it('rejects GIF export for a table view before rasterizing', async () => {
    const model = prepareRace({ ...spec, mark: 'table' }, {});
    const barLayout = layoutRace(model, { ...options, mark: { type: 'bar' } });
    // The table layout lane is pending. Its HTML host can already be created by the shell.
    const layout = {
      ...barLayout,
      mark: 'table' as const,
      static: {
        rowHeight: 20,
        headerHeight: 20,
        fontSize: 12,
        columns: [],
        labels: {
          rank: 'Rank',
          name: 'Name',
          bar: 'Bar',
          value: 'Value',
          change: 'Change',
          share: 'Share',
        },
      },
    };
    const shell = createRaceShell(host, layout, 'table');
    await expect(exportRaceGIF({ model, layout, shell, idScope: 'table' })).rejects.toThrow(
      new Error('GIF export supports the bar and line marks'),
    );
    expect(frames).toHaveLength(0);
  });

  it('reports how to install the missing optional GIF dependency', async () => {
    vi.doUnmock('gifenc');
    const hook = registerHooks({
      resolve(specifier, context, next) {
        if (specifier === 'gifenc' || specifier.includes('/node_modules/gifenc/')) {
          throw Object.assign(new Error('Cannot find package gifenc'), {
            code: 'ERR_MODULE_NOT_FOUND',
          });
        }
        return next(specifier, context);
      },
    });
    try {
      await expect(mount().export('gif')).rejects.toThrow(
        "GIF export requires the optional 'gifenc' peer dependency. Install it: npm install gifenc",
      );
      expect(frames).toHaveLength(0);
    } finally {
      hook.deregister();
      vi.doMock('gifenc', () => ({ GIFEncoder: () => encoder, quantize, applyPalette }));
    }
  });

  it('keeps an existing chart encoder initialization failure distinct from a missing peer', async () => {
    const failure = new Error('Module evaluation failed', {
      cause: new Error('Failed to fetch resources'),
    });
    vi.doMock('gifenc', () => {
      throw failure.cause;
    });
    try {
      mount();
      const svg = host.querySelector('svg');
      if (!svg) throw new Error('Expected the chart SVG');
      await expect(exportGIF(svg, undefined)).rejects.toThrow(
        'GIF export failed to load the gifenc encoder',
      );
      expect(frames).toHaveLength(0);
    } finally {
      vi.doMock('gifenc', () => ({ GIFEncoder: () => encoder, quantize, applyPalette }));
    }
  });

  it('leaves the paused playhead, speed, focus and mounted DOM intact', async () => {
    const instance = mount();
    instance.seek(1.25);
    instance.setSpeed(2);
    const scrubber = host.querySelector('input');
    scrubber?.focus();
    const state = instance.getState();
    const markup = host.innerHTML;
    const records: MutationRecord[] = [];
    const mutations = new MutationObserver((changes) => records.push(...changes));
    mutations.observe(host, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    try {
      await instance.export('gif', { fps: 2 });
      expect(instance.getState()).toEqual(state);
      expect(host.innerHTML).toBe(markup);
      expect(document.activeElement).toBe(scrubber);
      expect([...records, ...mutations.takeRecords()]).toHaveLength(0);
    } finally {
      mutations.disconnect();
    }
  });

  it('keeps playing while the detached frame rasterizes', async () => {
    const instance = mount({ ...spec, race: { ...spec.race, step: 5000 } });
    const { promise: started, resolve: rasterStarted } = Promise.withResolvers<void>();
    const { promise: pausedRaster, resolve: releaseRaster } = Promise.withResolvers<void>();
    vi.mocked(svgExport.rasterizeSVGToCanvas).mockImplementationOnce(async () => {
      rasterStarted();
      await pausedRaster;
      return canvasFrame(document);
    });
    const liveSVG = host.querySelector('svg.oc-race');
    instance.seek(0.5);
    instance.play();
    const before = instance.getState();
    const markup = liveSVG?.outerHTML;
    const exporting = instance.export('gif', { fps: 0.2 });
    try {
      expect(instance.getState()).toEqual(before);
      expect(liveSVG?.outerHTML).toBe(markup);
      await Promise.race([started, exporting]);
      const start = instance.getState().t;
      expect(start).toBeGreaterThanOrEqual(before.t);
      await vi.waitFor(() => expect(instance.getState().t).toBeGreaterThan(start));
      expect(instance.getState().playing).toBe(true);
      expect(host.querySelector('svg.oc-race')).toBe(liveSVG);
    } finally {
      releaseRaster();
      await exporting;
    }
    expect(instance.getState().playing).toBe(true);
    expect(frames[0].querySelector('.oc-race-period')?.textContent).toBe('2022');
  });

  it('rejects a pending export when destroyed and stops encoding', async () => {
    const instance = mount();
    const { promise: started, resolve: rasterStarted } = Promise.withResolvers<void>();
    const { promise: pausedRaster, resolve: releaseRaster } = Promise.withResolvers<void>();
    vi.mocked(svgExport.rasterizeSVGToCanvas).mockImplementationOnce(async () => {
      rasterStarted();
      await pausedRaster;
      return canvasFrame(document);
    });
    const exporting = instance.export('gif', { fps: 2 });
    try {
      await Promise.race([started, exporting]);
      instance.destroy();
      await expect(exporting).rejects.toThrow(/destroyed.*GIF export/i);
      expect(host.children).toHaveLength(0);
    } finally {
      releaseRaster();
      // Let the in-flight raster unwound by abort finish its promise continuations.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(encoder.writeFrame).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });
});
