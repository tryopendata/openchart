import { estimateTextWidth, type RaceFrame } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { type BarStaticInput, barGeometry, computeBarStatic } from '../layout-bar';

const input: BarStaticInput = {
  area: { x: 10, y: 20, width: 500, height: 222 },
  top: 4,
  maxLabelWidth: 92,
  maxValueLabelWidth: 34,
  cornerRadius: 4,
  hasNegatives: true,
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
  it.each([
    { hasNegatives: false, x: 110, width: 360 },
    { hasNegatives: true, x: 150, width: 320 },
  ])('reserves gutters and clips to the row band with hasNegatives=$hasNegatives', ({
    hasNegatives,
    x,
    width,
  }) => {
    const plot = { x, y: 42, width, height: 200 };
    const stat = computeBarStatic({ ...input, hasNegatives });
    expect(stat).toMatchObject({
      plot,
      clip: { x: 10, y: 42, width: 500, height: 200 },
      nameX: 102,
      rowHeight: 50,
      barHeight: 37,
      cornerRadius: 4,
      top: 4,
      axisY: 42,
      tickFontSize: 12,
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
  it.each([
    [330, 12],
    [330, 14],
    [360, 12],
    [360, 14],
    [680, 12],
    [680, 14],
  ])('fits ten row slots across the full plot at %i px with %i px ticks', (width, tick) => {
    const stat = computeBarStatic({
      ...input,
      area: { ...input.area, width, height: 390 },
      top: 10,
      fontSize: { ...input.fontSize, tick },
      showSummary: false,
    });
    const geometry = barGeometry(
      stat,
      {
        ...frame,
        items: Array.from({ length: 10 }, (_, rankPos) => ({
          ...frame.items[0],
          key: String(rankPos),
          value: 44,
          valueLabel: '44 km',
          rankPos,
        })),
      },
      formatTick,
    );
    expect(geometry.rows).toHaveLength(10);
    expect(stat.rowHeight * 10).toBeCloseTo(stat.plot.height);
    expect(stat.clip.height).toBe(stat.plot.height);
    for (const { bar, value } of geometry.rows) {
      expect(bar.y).toBeGreaterThanOrEqual(stat.plot.y);
      expect(bar.y + bar.height).toBeLessThanOrEqual(stat.plot.y + stat.plot.height);
      expect(value.y + input.fontSize.value / 2).toBeLessThanOrEqual(
        stat.clip.y + stat.clip.height,
      );
    }
  });

  it('keeps the period and summary visible on a short leaderboard', () => {
    const stat = computeBarStatic({
      ...input,
      area: { x: 0, y: 0, width: 360, height: 100 },
      top: 2,
    });
    const geometry = barGeometry(
      stat,
      { ...frame, items: [{ ...frame.items[0], rankPos: 1 }] },
      formatTick,
    );
    const [row] = geometry.rows;
    expect(row.bar.height).toBeGreaterThan(0);
    expect(geometry.period).toMatchObject({ y: 100, text: '2020' });
    expect(geometry.summary).toMatchObject({ text: '20 km' });
    expect(geometry.summary!.y).toBeLessThan(geometry.period!.y - geometry.period!.fontSize);
  });

  it('keeps the zero line and ticks stable when the visible domain crosses zero', () => {
    const stat = computeBarStatic({
      ...input,
      area: { x: 0, y: 0, width: 600, height: 300 },
      maxLabelWidth: 80,
      maxValueLabelWidth: 50,
    });
    const leader = { ...frame.items[0], value: 100, valueLabel: '100 km' };
    const before = barGeometry(
      stat,
      {
        ...frame,
        domain: [0, 100],
        items: [leader, { ...frame.items[1], value: 0, valueLabel: '0 km' }],
      },
      formatTick,
    );
    const after = barGeometry(
      stat,
      {
        ...frame,
        domain: [-0.001, 100],
        items: [leader, { ...frame.items[1], value: -0.001, valueLabel: '-0.001 km' }],
      },
      formatTick,
    );

    expect(Math.abs(after.rows[0].bar.x - before.rows[0].bar.x)).toBeLessThanOrEqual(1);
    expect(after.ticks.map(({ value }) => value)).toEqual(before.ticks.map(({ value }) => value));
  });

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
        value: { x: 406, y: 79.5, text: '30 km', anchor: 'start' },
      },
      {
        key: 'B',
        color: 'orange',
        opacity: 0.5,
        bar: { x: 200, y: 223.5, width: 50, height: 37 },
        name: { x: 102, y: 242, text: 'Team B' },
        value: { x: 194, y: 242, text: '-10 km', anchor: 'end' },
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

  it('keeps the right-edge tick but omits its label when the full dollar amount does not fit', () => {
    const stat = computeBarStatic({
      ...input,
      area: { ...input.area, width: 800 },
      hasNegatives: false,
      maxValueLabelWidth: 5,
    });
    const { ticks } = barGeometry(
      stat,
      { ...frame, domain: [0, 5], items: [] },
      (value) => (value === 0 ? '$0' : `$${value}T`),
      { fontSize: 13, fontWeight: 400, measureWidth: (text) => 10 * text.length },
    );
    expect(ticks[0]).toMatchObject({ value: 0, label: '$0' });
    expect(ticks.at(-1)).toMatchObject({
      value: 5,
      position: stat.plot.x + stat.plot.width,
      label: '',
    });
    expect(ticks.at(-1)?.opacity).toBeGreaterThan(0);
  });

  it('leaves room for the value label at the negative domain endpoint', () => {
    const valueLabel = '-20 km';
    const fontSize = input.fontSize.value;
    const maxValueLabelWidth = estimateTextWidth(valueLabel, fontSize);
    const stat = computeBarStatic({ ...input, maxValueLabelWidth });
    const row = barGeometry(
      stat,
      { ...frame, items: [{ ...frame.items[1], value: -20, valueLabel }] },
      formatTick,
      { fontSize, fontWeight: 400 },
    ).rows[0];
    expect(row.bar.x).toBe(stat.plot.x);
    expect(row.value.x).toBeCloseTo(stat.plot.x - 6);
    expect(row.value.x - maxValueLabelWidth - row.name.x).toBeCloseTo(8);
  });

  it('keeps geometry finite and within the vertical bounds of a 30 px area', () => {
    const area = { x: 0, y: 0, width: 330, height: 30 };
    const stat = computeBarStatic({ ...input, area });
    const geometry = barGeometry(stat, frame, formatTick);
    expect(stat.plot.height).toBe(8);
    expect(stat.clip.height).toBe(8);
    for (const row of geometry.rows) {
      for (const value of Object.values(row.bar)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
    expect(geometry.period).toMatchObject({ y: area.height, text: '2020' });
    expect(geometry.summary).toMatchObject({ text: '20 km' });
    expect(geometry.summary!.y).toBeGreaterThanOrEqual(area.y);
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
    const stat = computeBarStatic({
      ...input,
      area,
      hasNegatives: false,
      fontSize: { ...input.fontSize, tick },
    });
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
    expect(row.value.x + estimateTextWidth(row.value.text, 13)).toBeCloseTo(area.x + area.width);
    expect(stat.plot.y - area.y).toBe(tick + 10);
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
