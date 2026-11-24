import {
  CATEGORICAL_PALETTE,
  CATEGORICAL_PALETTE_DARK,
  estimateTextWidth,
  type RaceSpec,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { layoutRace, prepareRace, raceFrameAt, raceGeometryAt } from '../../index';
import { RACE_MARKS } from '../marks';

const spec = {
  type: 'race',
  mark: 'bar',
  data: [
    { year: 2024, country: 'BR', gdp: 1950, name: 'Brazil' },
    { year: 2025, country: 'BR', gdp: 2100, name: 'Brazil' },
    { year: 2024, country: 'PT', gdp: 290, name: 'Portugal' },
    { year: 2025, country: 'PT', gdp: 320, name: 'Portugal' },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
    label: { field: 'name' },
  },
  race: { top: 2 },
} satisfies RaceSpec;

const size = { width: 800, height: 500 };

describe('race layout', () => {
  it('places the mark area inside padding and between the top and bottom chrome', () => {
    const model = prepareRace(
      {
        ...spec,
        chrome: { title: 'Size of the economy', source: 'Source: World Bank' },
        theme: { spacing: { padding: 17 } },
      },
      {},
    );
    const layout = layoutRace(model, size);

    expect(layout).toMatchObject({
      ...size,
      mark: 'bar',
      a11y: { altText: '2024 to 2025. Brazil leads in 2024. Brazil leads in 2025.', role: 'img' },
      periods: ['2024', '2025'],
      playback: {
        durationMs: 8000,
        holdEndMs: 1500,
        loop: false,
        autoplay: 'visible',
        controls: true,
      },
      watermark: true,
      warnings: [],
    });
    expect(layout.chrome.title?.text).toBe('Size of the economy');
    expect(layout.chrome.source?.text).toBe('Source: World Bank');
    expect(layout.chrome.watermark).toBeDefined();
    expect(layout.chrome.topHeight).toBeGreaterThan(0);
    expect(layout.chrome.bottomHeight).toBeGreaterThan(0);
    expect(layout.area).toEqual({
      x: 17,
      y: 17 + layout.chrome.topHeight,
      width: 766,
      height: 466 - layout.chrome.topHeight - layout.chrome.bottomHeight,
    });
  });

  it('merges theme overrides and carries prep warnings and the watermark setting', () => {
    const model = prepareRace(
      {
        ...spec,
        theme: { spacing: { padding: 21 }, fonts: { sizes: { body: 15 } } },
        watermark: false,
        race: { top: 3 },
      },
      { onWarn() {} },
    );
    const layout = layoutRace(model, {
      ...size,
      theme: { spacing: { padding: 25 }, colors: { categorical: ['#123456', '#abcdef'] } },
    });

    expect(layout.a11y.altText).toBe('2024 to 2025. Brazil leads in 2024. Brazil leads in 2025.');
    expect(layout.area.x).toBe(25);
    expect(layout.theme.fonts.sizes.body).toBe(15);
    expect(layout.colors).toEqual(['#123456', '#abcdef']);
    expect(layout.watermark).toBe(false);
    expect(layout.chrome.watermark).toBeUndefined();
    expect(layout.warnings).toEqual([{ code: 'RACE_SPEC_WARNING', message: model.warnings[0] }]);
  });

  it('uses the host watermark setting only when the spec leaves it unset', () => {
    const hostHidden = layoutRace(prepareRace(spec, {}), { ...size, watermark: false });
    const specShown = layoutRace(prepareRace({ ...spec, watermark: true }, {}), {
      ...size,
      watermark: false,
    });
    const specHidden = layoutRace(prepareRace({ ...spec, watermark: false }, {}), {
      ...size,
      watermark: true,
    });

    expect(hostHidden.watermark).toBe(false);
    expect(hostHidden.chrome.watermark).toBeUndefined();
    expect(specHidden).toEqual(hostHidden);
    expect(specShown.watermark).toBe(true);
    expect(specShown.chrome.watermark).toBeDefined();
    expect(specShown.area.height).toBeLessThan(hostHidden.area.height);
  });

  it('carries the supplied chrome measurer for renderers', () => {
    const measureText = (text: string, fontSize: number) => ({
      width: text.length * fontSize,
      height: fontSize,
    });
    const model = prepareRace({ ...spec, chrome: { title: 'GDP by country' } }, {});

    expect(layoutRace(model, { ...size, measureText })).toHaveProperty('measureText', measureText);
  });

  it.each([
    [330, 12],
    [330, 14],
    [360, 12],
    [360, 14],
    [680, 12],
    [680, 14],
    [1200, 12],
    [1200, 14],
  ])('fits bars and labels at %ipx width with %ipx text', (width, fontSize) => {
    const data = spec.data.map((row) => ({
      ...row,
      name:
        row.country === 'BR' ? 'Federative Republic of Brazil and neighbouring regions' : row.name,
    }));
    const model = prepareRace({ ...spec, data }, {});
    const layout = layoutRace(model, {
      ...size,
      width,
      theme: { fonts: { sizes: { axisTick: fontSize, body: fontSize } } },
    });
    const geometry = raceGeometryAt(model, layout, 0);
    if (layout.mark !== 'bar' || geometry.mark !== 'bar') throw new Error('Expected bars');

    const {
      area,
      static: { plot },
    } = layout;
    expect(layout.width).toBe(width);
    expect(plot.width).toBeGreaterThan(0);
    expect(plot.height).toBeGreaterThan(0);
    expect(plot.x).toBeGreaterThan(area.x);
    expect(plot.x + plot.width).toBeLessThan(area.x + area.width);
    expect(plot.y).toBeGreaterThan(area.y);
    expect(plot.y + plot.height).toBeCloseTo(area.y + area.height);
    expect(geometry.ticks.length).toBeGreaterThan(0);
    for (const tick of geometry.ticks.filter(({ label }) => label)) {
      const halfWidth = estimateTextWidth(tick.label, fontSize) / 2;
      expect(tick.position - halfWidth).toBeGreaterThanOrEqual(area.x);
      expect(tick.position + halfWidth).toBeLessThanOrEqual(area.x + area.width);
    }
    for (const row of geometry.rows) {
      const nameWidth = estimateTextWidth(row.name.text, fontSize);
      expect(nameWidth).toBeLessThanOrEqual(area.width * 0.4);
      expect(row.name.x - nameWidth).toBeGreaterThanOrEqual(area.x - 1e-9);
    }
  });

  it('caps measured names at 40% of the area and shrinks the gutter for short names', () => {
    const longName = 'Federative Republic of Brazil';
    const model = prepareRace(
      {
        ...spec,
        data: spec.data.map((row) => ({
          ...row,
          name: row.country === 'BR' ? longName : row.name,
        })),
      },
      {},
    );
    const measureText = (label: string, fontSize: number) => ({
      width: label.length * fontSize,
      height: fontSize,
    });
    const options = { ...size, width: 360, theme: { fonts: { sizes: { body: 16 } } }, measureText };
    const layout = layoutRace(model, options);
    const short = layoutRace(prepareRace(spec, {}), options);
    const wide = layoutRace(model, { ...options, width: 1200 });
    if (layout.mark !== 'bar' || short.mark !== 'bar' || wide.mark !== 'bar') {
      throw new Error('Expected bar layouts');
    }

    expect(layout.labels).toEqual(['Federat…', 'Portugal']);
    expect(wide.labels).toEqual([longName, 'Portugal']);
    const gutter = layout.static.nameX - layout.area.x;
    const cap = 0.4 * layout.area.width;
    expect(gutter).toBe(128);
    expect(gutter).toBeLessThanOrEqual(cap);
    expect(gutter + 16).toBeGreaterThan(cap);
    expect(wide.static.nameX - wide.area.x).toBe(longName.length * 16);
    expect(short.static.nameX - short.area.x).toBe('Portugal'.length * 16);
    expect(layoutRace(model, { ...options, measureText: undefined }).labels[0]).toMatch(/…$/);
  });

  it('uses the same text budget with estimated measurement', () => {
    const name = 'Federative Republic of Brazil and neighbouring regions';
    const data = spec.data.map((row) => ({ ...row, name }));
    const layout = layoutRace(prepareRace({ ...spec, data }, {}), { ...size, width: 360 });
    if (layout.mark !== 'bar') throw new Error('Expected a bar layout');

    const label = layout.labels[0];
    const measured = estimateTextWidth(label, layout.theme.fonts.sizes.body);
    expect(label).toMatch(/…$/);
    expect(measured).toBeLessThanOrEqual(layout.area.width * 0.4);
    expect(layout.static.nameX - layout.area.x).toBeCloseTo(measured);
  });

  it('leaves names blank when the text budget cannot fit an ellipsis', () => {
    const layout = layoutRace(prepareRace(spec, {}), { ...size, width: 41 });
    if (layout.mark !== 'bar') throw new Error('Expected a bar layout');

    expect(layout.labels).toEqual(['', '']);
    expect(layout.static.nameX).toBe(layout.area.x);
  });

  it('truncates at a complete Unicode code point', () => {
    const data = spec.data.map((row) => ({ ...row, name: 'A 🏁 team' }));
    const model = prepareRace({ ...spec, data }, {});
    // A 40px budget fits the first UTF-16 code unit of the flag, but not both.
    const measureText = (text: string) => ({ width: text.length * 10, height: 10 });
    const layout = layoutRace(model, { ...size, width: 140, measureText });

    expect(layout.labels).toEqual(['A…', 'A…']);
  });

  it('resolves the same color slots against the light and dark palettes', () => {
    const model = prepareRace(spec, {});
    const light = layoutRace(model, size);
    const dark = layoutRace(model, { ...size, darkMode: true });

    expect(light.colors).toEqual(CATEGORICAL_PALETTE.slice(0, 2));
    expect(dark.colors).toEqual(CATEGORICAL_PALETTE_DARK.slice(0, 2));
    expect(dark.theme.isDark).toBe(true);
    expect(dark.theme.colors.text).not.toBe(light.theme.colors.text);
    expect(dark.area).toEqual(light.area);
  });

  it('uses a bar override for a line spec and names unregistered marks', () => {
    const line = prepareRace({ ...spec, mark: 'line' }, {});
    const layout = layoutRace(line, { ...size, mark: { type: 'bar' } });

    expect(layout.mark).toBe('bar');
    expect(line.spec.mark.type).toBe('line');
    const lineEntry = RACE_MARKS.line;
    const tableEntry = RACE_MARKS.table;
    delete RACE_MARKS.line;
    delete RACE_MARKS.table;
    try {
      expect(() => layoutRace(line, size)).toThrow(/Race mark "line".*Registered: bar/);
      expect(() => layoutRace(prepareRace(spec, {}), { ...size, mark: { type: 'table' } })).toThrow(
        /race mark "table".*registered/i,
      );
    } finally {
      RACE_MARKS.line = lineEntry;
      RACE_MARKS.table = tableEntry;
    }
  });

  it('lays out and draws a mark registered with only static and geometry methods', () => {
    const previous = RACE_MARKS.line;
    RACE_MARKS.line = {
      computeStatic(_model, { area }, mark) {
        return {
          plot: area,
          xScale: {
            domain: [0, mark.window === 'all' ? 1 : 0],
            range: [area.x, area.x + area.width],
          },
          yAxisX: area.x,
          labelGutter: 0,
          tickFontSize: 12,
        };
      },
      geometry(_model, layout) {
        return {
          mark: 'line',
          series: [],
          xTicks: [],
          yTicks: [{ value: 0, label: '0', opacity: 1, position: layout.static.plot.y }],
          domain: [0, 1],
        };
      },
    };
    try {
      const model = prepareRace(spec, {});
      const layout = layoutRace(model, { ...size, mark: { type: 'line', window: 'all' } });

      expect(layout).toMatchObject({ mark: 'line', static: { xScale: { domain: [0, 1] } } });
      expect(raceGeometryAt(model, layout, 0)).toMatchObject({
        mark: 'line',
        yTicks: [{ value: 0, position: layout.area.y }],
      });
    } finally {
      if (previous) RACE_MARKS.line = previous;
      else delete RACE_MARKS.line;
    }
  });

  it('reserves the axis band for the theme tick font size', () => {
    const layout = layoutRace(prepareRace(spec, {}), {
      ...size,
      theme: { fonts: { sizes: { axisTick: 14 } } },
    });
    if (layout.mark !== 'bar') throw new Error('Expected a bar layout');

    expect(layout.static.plot.y - layout.area.y).toBe(24);
  });

  it('carries the bar radius from the spec or the mark override', () => {
    const model = prepareRace({ ...spec, mark: { type: 'bar', cornerRadius: 8 } }, {});

    expect(layoutRace(model, size).static).toMatchObject({ cornerRadius: 8 });
    expect(layoutRace(model, { ...size, mark: { type: 'bar' } }).static).toMatchObject({
      cornerRadius: 0,
    });
  });

  it('leaves the cached model intact across width, theme, and mark changes', () => {
    const name = 'Federative Republic of Brazil and neighbouring regions';
    const rows = spec.data.map((row) => ({ ...row, name }));
    const model = prepareRace({ ...spec, data: rows, mark: 'line' }, {});
    const { timeline, formatValue, ...data } = model;
    const before = structuredClone(data);
    const sample = timeline.sample(0.5);

    const wide = layoutRace(model, { ...size, width: 1200, mark: { type: 'bar' } });
    const narrow = layoutRace(model, {
      ...size,
      width: 360,
      darkMode: true,
      mark: { type: 'bar' },
    });

    expect(wide.labels).toEqual([name, name]);
    expect(narrow.labels[0]).toMatch(/…$/);
    expect(model).toEqual({ ...before, timeline, formatValue });
    expect(model.timeline).toBe(timeline);
    expect(model.timeline.sample(0.5)).toEqual(sample);
    expect(structuredClone(narrow)).toEqual(narrow);
  });

  it('keeps caller edits to layout periods and playback local to that layout', () => {
    const model = prepareRace(spec, {});
    const first = layoutRace(model, size);
    const second = layoutRace(model, size);
    first.periods[0] = 'Custom label';
    first.playback.durationMs = 1000;

    expect(raceFrameAt(model, 0).period.label).toBe('2024');
    expect(second.periods[0]).toBe('2024');
    expect(second.playback.durationMs).toBe(8000);
    expect(model.playback.durationMs).toBe(8000);
  });

  it.each([
    { extent: [5, 80, 4, -9000], widest: '-9,000', negatives: true },
    { extent: [5, 90000, 4, 3], widest: '90,000', negatives: false },
  ])('fits the widest formatted global extreme $widest', ({ extent, widest, negatives }) => {
    const data = spec.data.map((row, index) => ({ ...row, gdp: extent[index] }));
    const model = prepareRace({ ...spec, data, labels: { format: ',d' }, race: { top: 1 } }, {});
    const measureText = (label: string, fontSize: number) => ({
      width: label.length * fontSize,
      height: fontSize,
    });
    const layout = layoutRace(model, { ...size, measureText });
    if (layout.mark !== 'bar') throw new Error('Expected a bar layout');

    const rightInset =
      layout.area.x + layout.area.width - layout.static.plot.x - layout.static.plot.width;
    const leftInset = layout.static.plot.x - layout.static.nameX;
    expect(rightInset).toBe(widest.length * 13 + 6);
    expect(leftInset).toBe(8 + (negatives ? rightInset : 0));
    expect(layout.static.top).toBe(1);
  });
});
