import {
  estimateTextWidth,
  type MeasureTextFn,
  type RaceMarkDef,
  type RaceSpec,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { worldGdpRace } from '../../../../../examples/src/data/world-gdp-race';
import { raceFrameAt, raceGeometryAt } from '../geometry';
import { layoutRace } from '../layout';
import { prepareRace } from '../prepare';
import { createRaceTimeline } from '../timeline';

function setup(
  values: Record<string, Array<number | null>>,
  options: {
    mark?: RaceMarkDef;
    override?: RaceMarkDef;
    width?: number;
    height?: number;
    axisTick?: number;
    format?: string;
    top?: number;
    gaps?: NonNullable<RaceSpec['race']>['gaps'];
    swap?: number;
    samplesPerPeriod?: number;
    measureText?: MeasureTextFn;
  } = {},
) {
  const prepared = prepareRace(
    {
      type: 'race',
      mark: options.mark ?? 'line',
      data: Object.entries(values).flatMap(([name, items]) =>
        items.map((score, period) => ({ name, score, year: 2000 + period })),
      ),
      encoding: {
        time: { field: 'year', type: 'temporal' },
        key: { field: 'name' },
        value: { field: 'score', format: options.format ?? '.2f' },
      },
      race: {
        top: options.top ?? Object.keys(values).length,
        gaps: options.gaps,
        swap: options.swap ?? 0,
        step: 700,
      },
    },
    {},
  );
  const model =
    options.samplesPerPeriod === undefined
      ? prepared
      : {
          ...prepared,
          timeline: createRaceTimeline(prepared.matrix, {
            top: prepared.timeline.top,
            samplesPerPeriod: options.samplesPerPeriod,
            swapPeriods: (options.swap ?? 0) / 700,
            rescale: 'frame',
          }),
        };
  const layout = layoutRace(model, {
    width: options.width ?? 680,
    height: options.height ?? 320,
    mark: options.override,
    measureText: options.measureText,
    theme: { fonts: { sizes: { axisTick: options.axisTick ?? 12 } } },
  });
  if (layout.mark !== 'line') throw new Error('Expected a line layout');
  function at(t: number) {
    const geometry = raceGeometryAt(model, layout, t);
    if (geometry.mark !== 'line') throw new Error('Expected line geometry');
    return geometry;
  }
  return { model, layout, at };
}

describe('line race layout', () => {
  it('uses normal y-axis density for a 0–11 trillion domain', () => {
    const { at } = setup({ A: [10.3e12, 10.3e12] }, { height: 476, format: '$.3~s' });
    const ticks = at(1).yTicks.filter(({ opacity }) => opacity > 0.5);
    expect(ticks.map(({ label }) => label)).toEqual(['$0', '$2T', '$4T', '$6T', '$8T', '$10T']);
  });

  it.each(
    [330, 360, 680].flatMap((width) => [12, 14].map((axisTick) => ({ width, axisTick }))),
  )('keeps zero and its next visible label apart at $width px with $axisTick px text', ({
    width,
    axisTick,
  }) => {
    const textHeight = 18;
    const { at } = setup(
      { A: [12.6, 12.6] },
      {
        width,
        axisTick,
        height: 200,
        measureText: (text, size, weight) => ({
          width: estimateTextWidth(text, size, weight),
          height: textHeight,
        }),
      },
    );

    const labels = at(1).yTicks.filter(({ label, opacity }) => label && opacity > 0.01);
    const zero = labels.find(({ value }) => value === 0);
    const next = labels.find(({ value }) => value > 0);
    expect(zero?.label).toBe('0.00');
    expect(next?.label).toBeTruthy();
    if (!zero || !next) throw new Error('Expected zero and a positive label');
    expect(
      (zero.labelPosition ?? zero.position) - (next.labelPosition ?? next.position),
    ).toBeGreaterThanOrEqual(textHeight);
  });

  it.each([1, 10])('switches between non-nested y tick steps at scale %i', (scale) => {
    const { at } = setup({ A: [10 * scale, 60 * scale] }, { width: 680, height: 320 });
    let sawFiner = false;
    let sawCoarser = false;
    for (let frame = 0; frame <= 120; frame++) {
      const values = at(frame / 120).yTicks.map(({ value }) => value / scale);
      const finer = values.some(
        (value) => value === 2 || value === 4 || value === 6 || value === 8,
      );
      const coarser = values.includes(5);
      expect(finer && coarser, `t = ${frame / 120}`).toBe(false);
      sawFiner ||= finer;
      sawCoarser ||= coarser;
    }
    expect(sawFiner && sawCoarser).toBe(true);
  });

  it('keeps the two label opacities continuous as their ranks cross', () => {
    const { at } = setup({ A: [100, 0], B: [0, 100] }, { width: 620, height: 476 });
    const before = at(0.520833).series;
    const after = at(0.520834).series;
    for (const series of before) {
      const next = after.find(({ key }) => key === series.key);
      if (!next) throw new Error('Expected the same two series');
      const opacity = series.endLabel.opacity ?? series.opacity;
      expect(next.endLabel.opacity ?? next.opacity).toBeCloseTo(opacity, 3);
    }
  });

  it('keeps readable GDP head labels one text height apart at 2000', () => {
    const measureText: MeasureTextFn = (text, size, weight) => ({
      width: estimateTextWidth(text, size, weight),
      height: size * 1.3,
    });
    const model = prepareRace(
      {
        type: 'race',
        mark: 'line',
        data: worldGdpRace,
        encoding: { time: { field: 'year' }, key: { field: 'country' }, value: { field: 'gdp' } },
        chrome: { title: 'GDP', source: 'World Bank' },
      },
      {},
    );
    const layout = layoutRace(model, { width: 620, height: 476, measureText });
    const geometry = raceGeometryAt(model, layout, 20);
    if (geometry.mark !== 'line') throw new Error('Expected a line');
    const labels = geometry.series
      .filter(
        ({ endLabel, opacity }) =>
          (endLabel.opacity ?? opacity) > 0.15 && (endLabel.text || endLabel.value),
      )
      .map(({ endLabel }) => endLabel.y)
      .sort((a, b) => a - b);
    expect(labels.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i] - labels[i - 1]).toBeGreaterThanOrEqual(layout.theme.fonts.sizes.body * 1.3);
    }
  });

  it('ends an exit fade on the timeline’s configured sample grid', () => {
    const { at } = setup({ A: [9, 1, 1], B: [1, 9, 9] }, { top: 1, samplesPerPeriod: 5 });
    expect(at(1.58).series.find(({ key }) => key === 'A')?.opacity).toBeGreaterThan(0);
    expect(at(1.605).series.map(({ key }) => key)).toEqual(['B']);
  });

  it('carries visibility runs and prefix extrema in its serializable static layout', () => {
    const { layout } = setup({ A: [-2, 3, 1] });
    expect(JSON.parse(JSON.stringify(layout.static))).toMatchObject({
      history: [{ runs: [{ start: 0, end: 2 }], mins: [-2, -2, -2], maxes: [0, 3, 3] }],
    });
  });

  it('reserves gutters only for series that can be drawn', () => {
    const options = { top: 1 };
    const alone = setup({ A: [10, 20, 30] }, options);
    const crowded = setup(
      { A: [10, 20, 30], ['A long invisible name '.repeat(8)]: [-1e8, -1e8, -1e8] },
      options,
    );
    expect(crowded.layout.static.plot).toEqual(alone.layout.static.plot);
    expect(crowded.layout.static.labelGutter).toBe(alone.layout.static.labelGutter);
  });

  it('keeps the number of text measurements bounded as observations accumulate', () => {
    function measurements(periods: number) {
      let count = 0;
      setup(
        { A: Array.from({ length: periods }, (_, index) => 100 + index / periods) },
        {
          measureText: (text, fontSize, weight) => {
            count++;
            return { width: estimateTextWidth(text, fontSize, weight), height: fontSize };
          },
        },
      );
      return count;
    }
    expect(measurements(150)).toBeLessThan(measurements(4) + 30);
  });

  it('gives the leader the label when a short plot can fit only one', () => {
    const { at } = setup({ A: [1, 1], B: [2, 2], Z: [3, 3] }, { height: 132 });
    expect(
      at(1)
        .series.filter(({ endLabel }) => endLabel.text)
        .map(({ key }) => key),
    ).toEqual(['Z']);
  });

  it('keeps outgoing labels in order when their ranks reach the same fold', () => {
    const { at } = setup(
      {
        A: [90, 40, 10, 10],
        B: [80, 60, 80, 80],
        C: [70, 100, 100, 100],
        D: [20, 70, 110, 110],
      },
      { top: 2 },
    );
    const labels = new Map(at(1.1).series.map(({ key, endLabel }) => [key, endLabel]));
    expect(labels.get('A')?.text).toBe('A');
    expect(labels.get('B')?.text).toBe('B');
    expect(labels.get('A')?.y).toBeGreaterThan(labels.get('B')?.y ?? Infinity);
  });

  it.each([360, 800])('moves GDP head labels continuously at %ipx', (width) => {
    const model = prepareRace(
      {
        type: 'race',
        mark: 'line',
        data: worldGdpRace,
        encoding: {
          time: { field: 'year', type: 'ordinal' },
          key: { field: 'country' },
          value: { field: 'gdp', format: '$.3~s' },
        },
        chrome: { title: "The world's largest economies", source: 'World Bank' },
      },
      {},
    );
    const layout = layoutRace(model, { width, height: 476 });
    let previous = new Map<string, number>();
    let largest = { key: '', t: 0, delta: 0 };
    for (let step = 0; step <= (model.timeline.periodCount - 1) * 120; step++) {
      const t = step / 120;
      const frame = raceGeometryAt(model, layout, t);
      if (frame.mark !== 'line') throw new Error('Expected line geometry');
      const next = new Map<string, number>();
      for (const { key, endLabel } of frame.series) {
        if (!endLabel.text) continue;
        const before = previous.get(key);
        const delta = before === undefined ? 0 : Math.abs(endLabel.y - before);
        if (delta > largest.delta) largest = { key, t, delta };
        next.set(key, endLabel.y);
      }
      previous = next;
    }
    expect(largest.delta, JSON.stringify(largest)).toBeLessThanOrEqual(6);
  });

  it('reproduces fades and domains regardless of previous draws or seeks', () => {
    const data = { A: [90, 10, 10, 10], B: [10, 90, 140, 240] };
    const live = setup(data, { top: 1 });
    const fresh = setup(data, { top: 1 });
    const times = [0, 0.25, 0.53, 0.9, 1.4, 2, 2.75, 3];
    const expected = new Map(times.map((t) => [t, fresh.at(t)]));
    expect(expected.get(0.9)?.series.find(({ key }) => key === 'A')?.opacity).toBeGreaterThan(0);
    expect(expected.get(0)?.domain).toEqual([0, 90]);
    expect(expected.get(3)?.domain).toEqual([0, 240]);
    for (const t of [...times.slice().reverse(), ...times, 0.9, 3, 0.25, 1.4, 2.75, 0, 0.53, 2]) {
      expect(live.at(t), `t = ${t}`).toEqual(expected.get(t));
    }
  });

  it('starts the reveal window one period wide, then maps the head to the right edge', () => {
    const { layout, at } = setup({ A: [10, 20, 30, 40] });
    const { plot, xScale } = layout.static;
    const right = plot.x + plot.width;
    expect(xScale.domain).toEqual([0, 3]);
    expect(at(0).series[0].points.map((point) => point?.x)).toEqual([plot.x]);
    expect(at(0).xTicks.find((tick) => tick.value === 1)?.position).toBe(right);
    expect(at(0.5).series[0].points[1]?.x).toBeCloseTo(plot.x + plot.width / 2);
    expect(at(1.5).series[0].points[1]?.x).toBeCloseTo(plot.x + (2 * plot.width) / 3);
    expect(at(1.5).series[0].points[2]?.x).toBe(right);
    expect(at(3).series[0].points[1]?.x).toBeCloseTo(plot.x + plot.width / 3);
    expect(at(3).series[0].points[3]?.x).toBe(right);
  });

  it('keeps the full x span in all mode and honors layout overrides in both directions', () => {
    const data = { A: [10, 20, 30, 40] };
    const all = { type: 'line', window: 'all' } satisfies RaceMarkDef;
    for (const options of [{ mark: all }, { override: all }]) {
      const { layout, at } = setup(data, options);
      const { x, width } = layout.static.plot;
      expect(at(0).xTicks.at(-1)).toMatchObject({ value: 3, position: x + width });
      expect(at(0.5).series[0].points[1]?.x).toBeCloseTo(x + width / 6);
      expect(at(1.5).series[0].points[2]?.x).toBeCloseTo(x + width / 2);
      expect(at(3).series[0].points[1]?.x).toBeCloseTo(x + width / 3);
    }
    const { layout, at } = setup(data, {
      mark: all,
      override: { type: 'line', window: 'reveal' },
    });
    expect(at(1.5).series[0].points[2]?.x).toBe(layout.static.xScale.range[1]);
  });

  it('draws observations and a fractional head with its displayed value', () => {
    const { layout, at } = setup({ A: [2, 8, 12, 20] });
    const { x, y, width, height } = layout.static.plot;
    const geometry = at(1.5);
    expect(geometry.domain).toEqual([0, 10]);
    const max = geometry.domain[1];
    const points = geometry.series[0].points;
    expect(points).toHaveLength(3);
    const screenX = [x, x + width / 1.5, x + width];
    [2, 8, 10].forEach((value, index) => {
      expect(points[index]?.x).toBeCloseTo(screenX[index]);
      expect(points[index]?.y).toBeCloseTo(y + height * (1 - value / max));
    });
    expect(geometry.series[0].endLabel).toMatchObject({ text: 'A', value: '10.00' });
    expect(at(2).series[0].points).toHaveLength(3);
  });

  it('leaves a null at each unfilled observation between visible points', () => {
    const { at } = setup({ A: [3, 5, null, 7, 9], B: [1, 1, 1, 1, 1] }, { gaps: 'drop' });
    const series = at(3.5).series.find(({ key }) => key === 'A');
    expect(series?.points).toEqual([
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      null,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    ]);
    expect(series?.endLabel.value).toBe('8.00');
    expect(
      at(1.5)
        .series.find(({ key }) => key === 'A')
        ?.points.at(-1),
    ).toBeNull();
  });

  it('retains earlier drawn extrema after a leader leaves and excludes a never-drawn key', () => {
    const { at } = setup(
      {
        A: [-20, 100, 5, 5, 5, 5],
        B: [-30, 10, 20, 20, 20, 180],
        C: [-9000, -9000, -9000, -9000, -9000, -9000],
      },
      { top: 1 },
    );
    expect(at(0).domain).toEqual([-20, 0]);
    const afterExit = at(4);
    expect(afterExit.series.map(({ key }) => key)).toEqual(['B']);
    expect(afterExit.domain).toEqual([-30, 100]);
    expect(at(5).domain).toEqual([-30, 180]);
    let previous = at(0).domain;
    for (let sample = 1; sample <= 200; sample++) {
      const { domain, series } = at(sample / 40);
      expect(domain[0]).toBeLessThanOrEqual(previous[0]);
      expect(domain[1]).toBeGreaterThanOrEqual(previous[1]);
      expect(series.some(({ key }) => key === 'C')).toBe(false);
      previous = domain;
    }
    expect(at(4).domain).toEqual(afterExit.domain);
  });

  it('uses live frame opacity for series entering during a swap', () => {
    const { model, at } = setup(
      { A: [90, 10, 10, 10], B: [10, 90, 90, 90] },
      {
        top: 1,
        swap: 400,
      },
    );
    const crossover = 0.5;
    const frame = raceFrameAt(model, crossover);
    expect(frame.items).toHaveLength(2);
    const incoming = frame.items.find(({ key }) => key === 'B');
    expect(incoming?.opacity).toBeGreaterThan(0);
    expect(incoming?.opacity).toBeLessThan(1);
    expect(at(crossover).series.find(({ key }) => key === 'B')?.opacity).toBe(incoming?.opacity);
  });

  it('keeps rank exits visibly fading for one period even with zero swap time', () => {
    const { at } = setup({ A: [90, 10, 10, 10], B: [10, 90, 90, 90] }, { top: 1 });
    const opacityAt = (t: number) => at(t).series.find(({ key }) => key === 'A')?.opacity ?? 0;
    expect(at(0).series.map(({ key }) => key)).toEqual(['A']);
    expect(at(1.2).series.map(({ key }) => key)).toEqual(['B', 'A']);
    expect(opacityAt(0.53)).toBeGreaterThan(0.9);
    expect(opacityAt(1.2)).toBeGreaterThan(0.2);
    expect(opacityAt(1.2)).toBeGreaterThan(opacityAt(1.4));
    expect(opacityAt(1.4)).toBeGreaterThan(0);
    expect(at(1.6).series.map(({ key }) => key)).toEqual(['B']);
  });

  it('ends the fade one period after the last drawable head at a gap', () => {
    const { at } = setup(
      { A: [90, null, null, null], B: [10, 10, 10, 10] },
      {
        top: 1,
        gaps: 'drop',
      },
    );
    const head = (t: number) => at(t).series.find(({ key }) => key === 'A');
    expect(head(0)?.opacity).toBe(1);
    expect(head(0.5)?.opacity).toBeCloseTo(0.5);
    expect(head(0.99)?.opacity).toBeCloseTo(0.01);
    expect(head(1)).toBeUndefined();
  });

  it('reserves the measured name and value gutter and leaves room for the plot when a narrow label is long', () => {
    const short = setup({ A: [1, 123.45] });
    const { static: stat, theme } = short.layout;
    const textWidth = estimateTextWidth(
      'A 123.45',
      theme.fonts.sizes.body,
      theme.fonts.weights.normal,
    );
    expect(stat.labelGutter).toBeGreaterThan(textWidth);
    const long = setup({ ['A very long series name '.repeat(6)]: [1, 123.45] }, { width: 330 });
    expect(long.layout.static.plot.width).toBeGreaterThanOrEqual(
      long.layout.area.width * 0.44 - 0.01,
    );
    const { endLabel } = long.at(1).series[0];
    expect(endLabel.text).toMatch(/…$/);
    expect(endLabel.value).toBe('');
  });

  it('reserves room for compact values between observed points and for the y ticks they reach', () => {
    const { at } = setup({ A: [0, 0, 1000] }, { format: 'compact' });
    const { series, yTicks } = at(1.55);
    expect(series[0].endLabel).toMatchObject({ text: 'A', value: '550' });
    expect(yTicks.find(({ value }) => value === 500)?.label).toBe('500');
  });

  it('fits fractional precision before a compact value changes units', () => {
    const { at } = setup({ A: [0, 0, 10000] }, { format: 'compact' });
    expect(at(1.098875).series[0].endLabel).toMatchObject({ text: 'A', value: '988.75' });
  });

  it('shows both required period labels near the start of a narrow all window', () => {
    const { at, layout } = setup(
      { A: Array.from({ length: 45 }, () => 10) },
      {
        width: 360,
        mark: { type: 'line', window: 'all' },
      },
    );
    const { x, width } = layout.static.plot;
    const { xTicks } = at(1);
    expect(xTicks[0]).toMatchObject({ value: 0, label: '2000', position: x });
    expect(xTicks[1]).toMatchObject({ value: 1, label: '2001' });
    expect(xTicks[1].position).toBeCloseTo(x + width / 44);
  });

  it('fades a y tick in as it enters the expanding domain', () => {
    const { at } = setup({ A: [99, 200] }, { height: 277 });
    const opacity = (t: number) => at(t).yTicks.find(({ value }) => value === 100)?.opacity ?? 0;
    expect(opacity(0)).toBe(0);
    expect(opacity(0.02)).toBeGreaterThan(0);
    expect(opacity(0.02)).toBeLessThan(1);
    expect(opacity(0.2)).toBe(1);
    expect(at(0.02).yTicks.find(({ value }) => value === 0)?.opacity).toBe(1);
  });

  it('omits axes when chrome leaves no room for a line plot', () => {
    const { at, layout } = setup({ A: [100, 100] }, { height: 40 });
    expect(layout.static.plot.height).toBe(0);
    expect(at(1)).toMatchObject({ xTicks: [], yTicks: [] });
  });

  it('draws a readable y axis when finite values span more than Number.MAX_VALUE', () => {
    const { at } = setup({ A: [1e308, 1e308], B: [-1e308, -1e308] }, { format: '~e', height: 440 });
    const { yTicks } = at(1);
    expect(yTicks.find(({ value }) => value === 0)?.label).toBe('0e+0');
    expect(yTicks.some(({ value, opacity }) => value < 0 && opacity > 0)).toBe(true);
    expect(yTicks.some(({ value, opacity }) => value > 0 && opacity > 0)).toBe(true);
    expect(yTicks.every(({ position }) => Number.isFinite(position))).toBe(true);
  });

  it('fits crowded head labels when the browser text box exceeds the nominal font size', () => {
    const labelHeight = 16;
    const { layout, at } = setup(
      { A: [100, 100], B: [1, 1], C: [1, 1], D: [1, 1] },
      {
        width: 360,
        measureText: (text, fontSize, weight) => ({
          width: estimateTextWidth(text, fontSize, weight),
          height: labelHeight,
        }),
      },
    );
    const { y, height } = layout.static.plot;
    const labels = at(1)
      .series.map(({ endLabel }) => endLabel.y)
      .sort((a, b) => a - b);
    expect(labels).toHaveLength(4);
    expect(labels[0] - labelHeight / 2).toBeGreaterThanOrEqual(y);
    expect(labels[3] + labelHeight / 2).toBeLessThanOrEqual(y + height);
    expect(labels[3] - labels[2]).toBeGreaterThanOrEqual(labelHeight);
    expect(labels[2] - labels[1]).toBeGreaterThanOrEqual(labelHeight);
  });

  it.each([
    [330, 12],
    [330, 14],
    [360, 12],
    [360, 14],
    [680, 12],
    [680, 14],
  ])('fits ten crowded labels and thins period ticks at %ipx with %ipx ticks', (width, axisTick) => {
    const data = Object.fromEntries(
      Array.from({ length: 10 }, (_, key) => [
        `Series ${key}`,
        Array.from({ length: 45 }, () => 100 - key / 10),
      ]),
    );
    const { layout, at } = setup(data, { width, axisTick });
    const { plot, tickFontSize } = layout.static;
    const fontSize = layout.theme.fonts.sizes.body;
    const { normal } = layout.theme.fonts.weights;
    expect(tickFontSize).toBe(axisTick);
    expect(layout.area.height - plot.height).toBeGreaterThan(tickFontSize);
    const { series, xTicks, yTicks } = at(43.5);
    expect(series).toHaveLength(10);
    const labels = [...series]
      .sort((a, b) => (a.points.at(-1)?.y ?? 0) - (b.points.at(-1)?.y ?? 0))
      .map(({ endLabel }) => endLabel);
    for (const [index, label] of labels.entries()) {
      expect(label.text).toMatch(/^Series \d$/);
      expect(label.y - fontSize / 2).toBeGreaterThanOrEqual(plot.y);
      expect(label.y + fontSize / 2).toBeLessThanOrEqual(plot.y + plot.height);
      if (index > 0) expect(label.y - labels[index - 1].y).toBeGreaterThanOrEqual(fontSize + 2);
    }
    expect(xTicks.length).toBeGreaterThan(2);
    expect(xTicks.length).toBeLessThan(43);
    expect(xTicks[0]).toMatchObject({ value: 0, label: '2000' });
    expect(xTicks.at(-1)).toMatchObject({ value: 43, label: '2043' });
    for (let index = 1; index < xTicks.length; index++) {
      const a = xTicks[index - 1];
      const b = xTicks[index];
      const halfWidths =
        (estimateTextWidth(a.label, axisTick, normal) +
          estimateTextWidth(b.label, axisTick, normal)) /
        2;
      expect(b.position - a.position).toBeGreaterThanOrEqual(halfWidths + axisTick / 2);
    }
    expect(yTicks.some(({ value, label }) => value === 0 && label === '0.00')).toBe(true);
    expect(
      yTicks.every(({ position }) => position >= plot.y && position <= plot.y + plot.height),
    ).toBe(true);
  });
});
