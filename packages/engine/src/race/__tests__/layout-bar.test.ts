import { estimateTextWidth, type RaceFrame } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { type BarStaticInput, barGeometry, computeBarStatic } from '../layout-bar';

const input: BarStaticInput = {
  area: { x: 10, y: 20, width: 500, height: 222 },
  top: 4,
  maxLabelWidth: 92,
  maxValueLabelWidth: 34,
  fontSize: { name: 14, value: 12, tick: 12 },
  showPeriod: true,
  showSummary: true,
};
const frame: RaceFrame = {
  t: 0.5,
  period: { index: 0, value: 2020, label: '2020' },
  domain: [-20, 44],
  summary: { value: 20, label: '20 km' },
  items: [
    {
      key: 'A',
      label: 'Team A',
      color: 'blue',
      value: 30,
      valueLabel: '30 km',
      rank: 0,
      rankPos: 0.25,
      opacity: 1,
      change: 0,
    },
    {
      key: 'B',
      label: 'Team B',
      color: 'orange',
      value: -10,
      valueLabel: '-10 km',
      rank: 1,
      rankPos: 3.5,
      opacity: 0.5,
      change: -1,
    },
  ],
};
const formatTick = (value: number) => `${value} km`;

describe('bar race static layout', () => {
  it('reserves gutters and a tick band and clips rows vertically while keeping the gutters', () => {
    const plot = { x: 110, y: 42, width: 360, height: 200 };
    const stat = computeBarStatic(input);
    expect(stat).toMatchObject({
      plot,
      clip: { x: 10, y: 42, width: 500, height: 200 },
      nameX: 102,
      rowHeight: 50,
      barHeight: 37,
      top: 4,
      axisY: 42,
      period: { x: 470, y: 242, fontSize: 72 },
    });
    expect(stat.summary?.x).toBe(stat.period?.x);
    expect(stat.summary?.y).toBeLessThan(stat.period?.y ?? 0);
  });

  it.each([
    { top: 20, size: 36 },
    { top: 10, size: 48 },
    { top: 4, size: 72 },
  ])('sizes the period label to $size px with $top rows', ({ top, size }) => {
    expect(computeBarStatic({ ...input, top }).period?.fontSize).toBe(size);
  });
});

describe('bar race frame geometry', () => {
  it('places positive and negative bars against zero at their fractional rank positions', () => {
    const geometry = barGeometry(computeBarStatic(input), frame, formatTick);
    expect(geometry.mark).toBe('bar');
    expect(geometry.rows).toEqual([
      {
        key: 'A',
        color: 'blue',
        opacity: 1,
        bar: { x: 250, y: 61, width: 150, height: 37 },
        name: { x: 102, y: 79.5, text: 'Team A' },
        value: { x: 406, y: 79.5, text: '30 km' },
      },
      {
        key: 'B',
        color: 'orange',
        opacity: 0.5,
        bar: { x: 200, y: 223.5, width: 50, height: 37 },
        name: { x: 102, y: 242, text: 'Team B' },
        value: { x: 194, y: 242, text: '-10 km' },
      },
    ]);
  });

  it('positions and formats the same axis ticks on the bar scale', () => {
    expect(barGeometry(computeBarStatic(input), frame, formatTick).ticks).toEqual([
      { value: -20, label: '-20 km', opacity: 5 / 12, position: 150 },
      { value: -10, label: '-10 km', opacity: 5 / 12, position: 200 },
      { value: 0, label: '0 km', opacity: 1, position: 250 },
      { value: 10, label: '10 km', opacity: 5 / 12, position: 300 },
      { value: 20, label: '20 km', opacity: 5 / 12, position: 350 },
      { value: 30, label: '30 km', opacity: 5 / 12, position: 400 },
      { value: 40, label: '40 km', opacity: 5 / 12, position: 450 },
    ]);
  });

  it('leaves room for the value label at the negative domain endpoint', () => {
    const stat = computeBarStatic(input);
    const row = barGeometry(
      stat,
      { ...frame, items: [{ ...frame.items[1], value: -20, valueLabel: '-20 km' }] },
      formatTick,
    ).rows[0];
    expect(row.bar.x).toBe(stat.plot.x + input.maxValueLabelWidth + 6);
    expect(row.value.x - input.maxValueLabelWidth).toBe(stat.plot.x);
    expect(row.value.x - input.maxValueLabelWidth - row.name.x).toBe(8);
  });

  it('keeps geometry finite and within the vertical bounds of a 30 px area', () => {
    const area = { x: 0, y: 0, width: 330, height: 30 };
    const stat = computeBarStatic({ ...input, area });
    const geometry = barGeometry(stat, frame, formatTick);
    expect(stat.plot.height).toBe(8);
    for (const row of geometry.rows) {
      for (const value of Object.values(row.bar)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
    expect(geometry.period?.y).toBe(area.height);
    expect(geometry.summary?.y).toBeGreaterThanOrEqual(area.y);
    expect(geometry.summary?.y).toBeLessThan(geometry.period?.y ?? 0);
  });

  it('maps large finite endpoints and keeps ticks when the domain subtraction would overflow', () => {
    const stat = computeBarStatic(input);
    const geometry = barGeometry(
      stat,
      {
        ...frame,
        domain: [-1e308, 1e308],
        items: [
          { ...frame.items[0], value: 1e308 },
          { ...frame.items[1], value: -1e308 },
        ],
      },
      String,
    );
    expect(geometry.rows.map(({ bar }) => [bar.x, bar.width])).toEqual([
      [310, 160],
      [150, 160],
    ]);
    expect(geometry.ticks.map(({ value, position }) => [value, position])).toEqual([
      [-1e308, 150],
      [-5e307, 230],
      [0, 310],
      [5e307, 390],
      [1e308, 470],
    ]);
  });

  it('keeps the axis sparse when pixels per unit would overflow on a tiny domain', () => {
    const stat = computeBarStatic(input);
    const geometry = barGeometry(
      stat,
      { ...frame, domain: [0, 1e-310], items: [{ ...frame.items[0], value: 1e-310 }] },
      String,
    );
    expect(geometry.rows[0].bar).toMatchObject({ x: 110, width: 360 });
    expect(geometry.ticks.map(({ value, position }) => [value, position])).toEqual([
      [0, 110],
      [5e-311, 290],
      [1e-310, 470],
    ]);
  });

  it('keeps distinct ticks when the domain contains only two representable values', () => {
    const value = Number.MIN_VALUE;
    const geometry = barGeometry(
      computeBarStatic(input),
      { ...frame, domain: [0, value], items: [{ ...frame.items[0], value }] },
      String,
    );
    expect(geometry.ticks.map(({ value: tick, position }) => [tick, position])).toEqual([
      [0, 110],
      [value, 470],
    ]);
  });

  it('draws period and summary independently and requires a summary in the frame', () => {
    const both = computeBarStatic(input);
    expect(barGeometry(both, frame, formatTick)).toMatchObject({
      period: { ...both.period, text: '2020' },
      summary: { ...both.summary, text: '20 km' },
    });
    expect(
      barGeometry(computeBarStatic({ ...input, showPeriod: false }), frame, formatTick),
    ).toMatchObject({ period: null, summary: { text: '20 km' } });
    expect(
      barGeometry(computeBarStatic({ ...input, showSummary: false }), frame, formatTick),
    ).toMatchObject({ period: { text: '2020' }, summary: null });
    expect(barGeometry(both, { ...frame, summary: undefined }, formatTick).summary).toBeNull();
  });

  it.each([
    [330, 12],
    [330, 14],
    [360, 12],
    [360, 14],
    [680, 12],
    [680, 14],
  ])('fits the name and value gutters at width %i with %i px tick text', (width, tick) => {
    const area = { ...input.area, width };
    const stat = computeBarStatic({ ...input, area, fontSize: { ...input.fontSize, tick } });
    const domainEnd = frame.domain[1];
    const geometry = barGeometry(
      stat,
      {
        ...frame,
        domain: [0, domainEnd],
        items: [{ ...frame.items[0], value: domainEnd, valueLabel: '44 km' }],
      },
      formatTick,
    );
    const row = geometry.rows[0];
    expect(row.name.x - input.maxLabelWidth).toBe(area.x);
    expect(row.value.x + input.maxValueLabelWidth).toBe(area.x + area.width);
    expect(row.bar.width).toBeGreaterThan(0);
    expect(geometry.ticks.length).toBeGreaterThan(1);
    for (const [index, tickLabel] of geometry.ticks.slice(1).entries()) {
      const previous = geometry.ticks[index];
      const needed =
        (estimateTextWidth(previous.label, tick) + estimateTextWidth(tickLabel.label, tick)) / 2;
      expect(tickLabel.position - previous.position).toBeGreaterThan(needed);
    }
  });
});
