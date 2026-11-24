import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { resolve } from 'node:path';
import type { RaceSpec } from '@opendata-ai/openchart-core';
import { layoutRace, prepareRace, raceGeometryAt } from '@opendata-ai/openchart-engine';
import type { GifencEncoder } from 'gifenc';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as svgExport from '../../export';
import { exportGIF, type GIFExportOptions } from '../../export-gif';
import type { encodeSVGFrames } from '../../gif-frame-encoder';
import { createRace, type RaceInstance } from '../../race-mount';
import { injectThemeStyleBlock } from '../../theme-style-block';
import { RACE_RENDERERS } from '../renderers';

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

const options = { width: 360, height: 276 };
const raceCSS = readFileSync(
  resolve(import.meta.dirname, '../../../../core/src/styles/race.css'),
  'utf8',
);
// happy-dom does not parse @layer blocks. Feed its CSSOM the actual rules within the layer.
const raceRules = raceCSS.slice(raceCSS.indexOf('{') + 1, raceCSS.lastIndexOf('}'));
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
  width = 2,
  height = 2,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
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

function cssRules(css: string): CSSStyleRule[] {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return Array.from(sheet.cssRules).filter((rule) => rule instanceof CSSStyleRule);
}

function pauseNextRaster() {
  const { promise: started, resolve: start } = Promise.withResolvers<void>();
  const { promise: paused, resolve: release } = Promise.withResolvers<void>();
  vi.mocked(svgExport.rasterizeSVGToCanvas).mockImplementationOnce(async () => {
    start();
    await paused;
    return canvasFrame(document);
  });
  return { started, release };
}

describe('race GIF export', () => {
  it('reads the finished encoder bytes through its view', async () => {
    const blob = await mount().export('gif', { fps: 1 });
    expect(await blob.text()).toBe('GIF89a');
    expect(encoder.bytesView).toHaveBeenCalled();
    expect(encoder.bytes).not.toHaveBeenCalled();
  });

  it('rasterizes race frames at their CSS size', async () => {
    await mount().export('gif', { fps: 2 });
    const calls = vi.mocked(svgExport.rasterizeSVGToCanvas).mock.calls;
    expect(
      calls
        .filter(([, , height]) => height === options.height)
        .map(([, width, height, dpi]) => [width, height, dpi]),
    ).toEqual(Array(4).fill([options.width, options.height, 1]));
  });

  it('samples each frame at the elapsed GIF delay', async () => {
    await mount().export('gif', { fps: 12 });
    const model = prepareRace(spec, {});
    const layout = layoutRace(model, options);
    const delays = frameDelays();
    expect(delays.slice(0, 3)).toEqual([80, 90, 80]);
    let elapsed = 0;
    for (const [index, delay] of delays.entries()) {
      const geometry = raceGeometryAt(model, layout, elapsed / 500);
      if (geometry.mark !== 'bar') throw new Error('Expected bar geometry');
      for (const row of geometry.rows) {
        const bar = frames[index + 1].querySelector(`[data-key="${row.key}"] rect`);
        expect(Number(bar?.getAttribute('width'))).toBeCloseTo(row.bar.width, 2);
      }
      elapsed += delay ?? 0;
    }
  });

  it('includes the race root in the shared theme block without changing the chart selector', () => {
    const { theme } = layoutRace(prepareRace(spec, {}), options);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('oc-race');
    injectThemeStyleBlock(svg, theme);
    const block = () => svg.querySelector('style[data-oc-theme]')?.textContent;
    expect(block()).toMatch(
      /^svg\.oc-chart, svg\.oc-map, svg\.oc-tilemap, svg\.oc-barlist, svg\.oc-race \{/,
    );
    svg.classList.replace('oc-race', 'oc-chart');
    injectThemeStyleBlock(svg, theme);
    expect(block()).toMatch(/^svg\.oc-chart, svg\.oc-map, svg\.oc-tilemap, svg\.oc-barlist \{/);
  });

  it('embeds the computed value of every raster declaration in race.css', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = `${raceRules}
      .oc-race {
        --oc-gridline: #123456;
        --oc-text-muted: #234567;
        --oc-text: #345678;
        --oc-text-faint: #456789;
        --oc-source-size: 12px;
        --oc-body-size: 13px;
      }
      /* happy-dom does not inherit SVG presentation attributes through computed style. */
      .oc-race-axis [dominant-baseline="central"] text { dominant-baseline: central; }
    `;
    document.head.append(stylesheet);
    try {
      const expected = cssRules(raceRules).flatMap(({ selectorText, style }) =>
        selectorText
          .split(',')
          .map((selector) => selector.trim())
          .filter(
            (selector) =>
              selector === '.oc-race' ||
              /\.oc-race-(axis|rows?|period|summary|line-)/.test(selector),
          )
          .flatMap((selector) =>
            Array.from(style)
              .filter((property) => property !== 'will-change')
              .map((property) => ({ selector, property })),
          ),
      );
      expect(expected.length).toBeGreaterThan(8);
      const checked = new Set<(typeof expected)[number]>();
      for (const mark of ['bar', 'line'] as const) {
        const instance = mount({ ...spec, mark, race: { ...spec.race, summary: 'sum' } });
        const firstFrame = frames.length + 1;
        const live = host.querySelector('svg.oc-race');
        if (!live) throw new Error('Expected a live race SVG');
        await instance.export('gif', { fps: 1 });
        const frame = frames[firstFrame];
        const embedded = cssRules(frame.querySelector('style[data-oc-theme]')?.textContent ?? '');
        if (mark === 'line') {
          const yLabel = live.querySelector('.oc-race-axis text');
          if (!yLabel) throw new Error('Expected a y-axis label');
          expect(getComputedStyle(yLabel).dominantBaseline).toBe('central');
          expect(
            embedded.findLast((rule) => rule.selectorText === '.oc-race-axis text')?.style
              .dominantBaseline,
          ).toBe('');
        }

        for (const declaration of expected) {
          const { selector, property } = declaration;
          const sample = live.matches(selector) ? live : live.querySelector(selector);
          if (!sample) continue;
          const value = getComputedStyle(sample).getPropertyValue(property);
          expect(value, `${selector} ${property}`).toBeTruthy();
          expect(
            embedded
              .findLast((rule) => rule.selectorText === selector)
              ?.style.getPropertyValue(property),
            `${selector} ${property}`,
          ).toBe(value);
          checked.add(declaration);
        }
        expect(frame.querySelector('.oc-race-period')?.hasAttribute('font-weight') ?? false).toBe(
          false,
        );
        instance.destroy();
      }
      expect([...checked]).toEqual(expect.arrayContaining(expected));
    } finally {
      stylesheet.remove();
    }
  });

  it('exports the live fills and font weights when stylesheet rules throw SecurityError', async () => {
    const stylesheet = document.createElement('style');
    stylesheet.textContent = `
      .oc-race-axis line { stroke: rgb(12, 34, 56); }
      .oc-race-rows text { fill: rgb(23, 45, 67); font-weight: 500; }
      .oc-race-period { fill: rgb(34, 56, 78); font-weight: 700; }
    `;
    document.head.append(stylesheet);
    const sheet = stylesheet.sheet;
    if (!sheet) throw new Error('Expected the live stylesheet');
    const exposedSheets = document.styleSheets;
    const index = Array.from(exposedSheets).indexOf(sheet);
    // happy-dom uses the style element's sheet for its internal cascade. Only
    // the document's public sheet list needs the browser's origin restriction.
    Object.defineProperty(exposedSheets, index, {
      value: new Proxy(sheet, {
        get(target, key) {
          if (key === 'cssRules') throw new DOMException('Origin is opaque', 'SecurityError');
          return Reflect.get(target, key, target);
        },
      }),
    });
    vi.spyOn(document, 'styleSheets', 'get').mockReturnValue(exposedSheets);

    try {
      const instance = mount();
      const period = host.querySelector('.oc-race-period');
      if (!period) throw new Error('Expected a live period label');
      expect(getComputedStyle(period).fontWeight).toBe('700');
      expect(() => document.styleSheets[index].cssRules).toThrow(DOMException);
      await instance.export('gif', { fps: 1 });
      const css = frames[1].querySelector('style[data-oc-theme]')?.textContent;
      for (const [selector, declarations] of [
        ['.oc-race-axis line', ['stroke: rgb(12, 34, 56)']],
        ['.oc-race-rows text', ['fill: rgb(23, 45, 67)', 'font-weight: 500']],
        ['.oc-race-period', ['fill: rgb(34, 56, 78)', 'font-weight: 700']],
      ] as const) {
        const rule = Array.from(css?.matchAll(/([^{}]+){([^{}]+)}/g) ?? []).find(
          ([, value]) => value.trim() === selector,
        );
        for (const declaration of declarations) expect(rule?.[2] ?? '').toContain(declaration);
      }
    } finally {
      stylesheet.remove();
    }
  });

  it('uses the selected mounted renderer throughout export', async () => {
    const instance = mount();
    const bar = RACE_RENDERERS.bar;
    delete RACE_RENDERERS.bar;
    try {
      await instance.export('gif', { fps: 1 });
      expect(frames[1].querySelector('.oc-race-period')?.textContent).toBe('2022');
    } finally {
      RACE_RENDERERS.bar = bar;
    }
  });

  it('types only the encoder settings read by the shared encoder', () => {
    expectTypeOf<Parameters<typeof encodeSVGFrames>[1]>().toEqualTypeOf<
      Pick<GIFExportOptions, 'dpi' | 'loop' | 'backgroundColor' | 'theme'> | undefined
    >();
  });
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
    for (const [, palette] of applyPalette.mock.calls) expect(palette).toEqual(first?.slice(0, -1));
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
    stylesheet.textContent = `${raceRules}\n@font-face {
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
          Number(
            position === 'y'
              ? tick.previousElementSibling?.getAttribute('y1')
              : tick.getAttribute('x'),
          ),
        ]);
        expect(actual).toEqual(
          expect.arrayContaining(
            ticks.map((tick) => [tick.label, Number(tick.position.toFixed(2))]),
          ),
        );
        expect(actual).toHaveLength(ticks.length);
      }
      for (const { key, points, color, opacity, endLabel } of geometry.series) {
        const seriesIndex = paths.findIndex((element) => element.getAttribute('data-key') === key);
        const path = paths[seriesIndex];
        expect(path?.getAttribute('stroke')).toBe(color);
        expect(Number(path?.getAttribute('opacity'))).toBeCloseTo(opacity, 2);
        const commands = points.map((point, position) =>
          point
            ? `${points[position - 1] ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
            : '',
        );
        expect(path?.getAttribute('d')).toBe(commands.join(''));
        const label = labels[seriesIndex];
        expect(label?.textContent).toBe([endLabel.text, endLabel.value].filter(Boolean).join(' '));
        expect(Number(label?.getAttribute('x'))).toBeCloseTo(endLabel.x, 2);
        expect(Number(label?.getAttribute('y'))).toBeCloseTo(endLabel.y, 2);
        expect(Number(label?.getAttribute('opacity'))).toBeCloseTo(opacity, 2);
      }
    }
  });

  it('rejects GIF export for a mounted table before encoding frames', async () => {
    const instance = mount({ ...spec, mark: 'table' });
    expect(host.querySelector('.oc-race-table table')).toBeTruthy();
    await expect(instance.export('gif')).rejects.toThrow(
      new Error('GIF export supports the bar and line marks'),
    );
    expect(frames).toHaveLength(0);
    expect(encoder.writeFrame).not.toHaveBeenCalled();
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

  it('writes offset delta rectangles and gives unchanged pixels a transparent index', async () => {
    // The missing-peer test exercises and caches a failed ESM import. Use the
    // published CommonJS entry to verify the actual bytes independently of it.
    const { GIFEncoder }: typeof import('gifenc') = createRequire(import.meta.url)('gifenc');
    const real = GIFEncoder();
    const offsets: number[] = [];
    encoder.writeFrame.mockImplementation((...args) => {
      offsets.push(real.bytesView().length);
      real.writeFrame(...args);
    });
    encoder.bytesView.mockImplementation(real.bytesView);
    encoder.bytes.mockImplementation(real.bytes);
    encoder.finish.mockImplementation(real.finish);
    const first = new Uint8Array(16);
    const next = first.slice();
    next[5] = 1;
    next[15] = 1;
    applyPalette.mockReturnValueOnce(first).mockReturnValueOnce(next).mockReturnValueOnce(next);
    const rasterize = vi.mocked(svgExport.rasterizeSVGToCanvas);
    const rasterizeSVG = rasterize.getMockImplementation();
    rasterize.mockImplementation(async (...args) => {
      if (args[2] === 1 && rasterizeSVG) return rasterizeSVG(...args);
      return canvasFrame(document, args[4], new Uint8ClampedArray(64), 4, 4);
    });
    try {
      const bytes = new DataView(await (await mount().export('gif', { fps: 2 })).arrayBuffer());
      const [, diff, still] = encoder.writeFrame.mock.calls;
      const key = diff[3]?.transparentIndex;
      if (key === undefined) throw new Error('Expected a transparent delta frame');
      expect(diff.slice(0, 3)).toEqual([
        new Uint8Array([1, key, key, key, key, key, key, key, 1]),
        3,
        3,
      ]);
      expect(diff[3]).toMatchObject({ transparent: true, dispose: 1 });
      expect(bytes.getUint8(offsets[1] + 8)).toBe(0x2c);
      expect(bytes.getUint16(offsets[1] + 9, true)).toBe(1);
      expect(bytes.getUint16(offsets[1] + 11, true)).toBe(1);
      expect(still.slice(0, 3)).toEqual([new Uint8Array([key]), 1, 1]);
      expect(still[3]).toMatchObject({ delay: 1500, transparent: true, dispose: 1 });
    } finally {
      encoder.writeFrame.mockReset();
      encoder.bytesView.mockReset();
      encoder.bytes.mockReset();
      encoder.finish.mockReset();
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

  it('resolves concurrent exports independently without touching the live DOM', async () => {
    vi.doMock('gifenc', () => ({
      GIFEncoder() {
        const delays: number[] = [];
        return {
          ...encoder,
          writeFrame(
            _pixels: Uint8Array,
            _width: number,
            _height: number,
            frame?: { delay?: number },
          ) {
            delays.push(frame?.delay ?? 0);
          },
          bytesView: () => new TextEncoder().encode(delays.join(',')),
        };
      },
      quantize,
      applyPalette,
    }));
    const instance = mount();
    instance.seek(1);
    const state = instance.getState();
    const live = host.innerHTML;
    const firstRaster = pauseNextRaster();
    const first = instance.export('gif', { fps: 2 });
    await Promise.race([firstRaster.started, first]);
    const secondRaster = pauseNextRaster();
    const second = instance.export('gif', { fps: 5 });
    try {
      await Promise.race([secondRaster.started, second]);
      secondRaster.release();
      expect(await (await second).text()).toBe('200,200,200,200,200,1500');
      firstRaster.release();
      expect(await (await first).text()).toBe('500,500,1500');
      expect(instance.getState()).toEqual(state);
      expect(host.innerHTML).toBe(live);
    } finally {
      firstRaster.release();
      secondRaster.release();
      await Promise.allSettled([first, second]);
      vi.doMock('gifenc', () => ({ GIFEncoder: () => encoder, quantize, applyPalette }));
    }
  });

  it('finishes from the original snapshot after an update during rasterization', async () => {
    const instance = mount();
    const raster = pauseNextRaster();
    const exporting = instance.export('gif', { fps: 2 });
    try {
      await Promise.race([raster.started, exporting]);
      instance.update({ ...spec, mark: 'line', chrome: { title: 'Updated' } });
      expect(host.querySelector('.oc-race-line')).toBeTruthy();
      expect(host.querySelector('.oc-title')?.textContent).toBe('Updated');
      raster.release();
      expect((await exporting).type).toBe('image/gif');
      expect(frames.map((frame) => frame.querySelector('.oc-race-period')?.textContent)).toEqual([
        '2022',
        '2023',
        '2024',
      ]);
      expect(frames.map((frame) => frame.querySelector('.oc-title')?.textContent)).toEqual(
        Array(3).fill('Annual standings'),
      );
      expect(host.querySelector('.oc-race-line')).toBeTruthy();
      expect(host.querySelector('.oc-race-period')).toBeNull();
    } finally {
      raster.release();
      await Promise.allSettled([exporting]);
    }
  });

  it('rejects both in-flight exports when destroyed and stops encoding', async () => {
    const instance = mount();
    const firstRaster = pauseNextRaster();
    const first = instance.export('gif', { fps: 2 });
    await Promise.race([firstRaster.started, first]);
    const secondRaster = pauseNextRaster();
    const second = instance.export('gif', { fps: 5 });
    const pending = Promise.allSettled([first, second]);
    try {
      await Promise.race([secondRaster.started, second]);
      instance.destroy();
      expect(await pending).toEqual(
        Array(2).fill({
          status: 'rejected',
          reason: new Error('Race was destroyed during GIF export'),
        }),
      );
      expect(host.children).toHaveLength(0);
    } finally {
      firstRaster.release();
      secondRaster.release();
      // Let the in-flight raster unwound by abort finish its promise continuations.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(encoder.writeFrame).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });
});
