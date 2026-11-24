import { CATEGORICAL_PALETTE, type RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { layoutRace, prepareRace, raceFrameAt, raceGeometryAt } from '../../index';

const longName = 'Federative Republic of Brazil and neighbouring regions';
const spec = {
  type: 'race',
  mark: 'bar',
  data: [
    { year: 2023, country: 'BR', gdp: 12, name: longName },
    { year: 2024, country: 'BR', gdp: 8, name: longName },
    { year: 2025, country: 'BR', gdp: 16, name: longName },
    { year: 2023, country: 'PT', gdp: 3, name: 'Portugal' },
    { year: 2024, country: 'PT', gdp: 11, name: 'Portugal' },
    { year: 2025, country: 'PT', gdp: 10, name: 'Portugal' },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
    label: { field: 'name' },
  },
  labels: { format: '.1f' },
  race: { top: 2, rescale: 'frame', swap: 0 },
} satisfies RaceSpec;

const size = { width: 360, height: 500 };

describe('race frames and geometry', () => {
  it('returns deterministic frames and geometry with the same order, values, and period', () => {
    const model = prepareRace({ ...spec, mark: 'line' }, {});
    const layout = layoutRace(model, { ...size, mark: { type: 'bar' } });
    const frame = raceFrameAt(model, 1.25);
    const geometry = raceGeometryAt(model, layout, 1.25);
    if (layout.mark !== 'bar' || geometry.mark !== 'bar') throw new Error('Expected bar geometry');

    expect(frame).toMatchObject({
      t: 1.25,
      period: { index: 1, value: 2024, label: '2024' },
      items: [
        { key: 'PT', value: 10.75, valueLabel: '10.8' },
        { key: 'BR', value: 10, valueLabel: '10.0' },
      ],
      domain: [0, 10.75],
    });
    expect(geometry.rows.map(({ key, value }) => [key, value.text])).toEqual([
      ['PT', '10.8'],
      ['BR', '10.0'],
    ]);
    expect(geometry.rows[0].bar.width).toBeCloseTo(layout.static.plot.width);
    expect(geometry.rows[1].bar.width).toBeCloseTo(layout.static.plot.width * (10 / 10.75));
    expect(geometry.period).toEqual({
      ...layout.static.period,
      text: '2024',
    });
    expect(geometry.ticks.length).toBeGreaterThan(0);
    expect(geometry.ticks.every(({ value, label }) => label === value.toFixed(1))).toBe(true);

    expect(raceFrameAt(model, 2)).toMatchObject({
      t: 2,
      period: { index: 2, value: 2025, label: '2025' },
      items: [
        { key: 'BR', value: 16 },
        { key: 'PT', value: 10 },
      ],
    });
    const last = raceGeometryAt(model, layout, 2);
    if (last.mark !== 'bar') throw new Error('Expected bar geometry after seeking');
    expect(last.rows.map(({ key, value }) => [key, value.text])).toEqual([
      ['BR', '16.0'],
      ['PT', '10.0'],
    ]);
    expect(last.period?.text).toBe('2025');
    expect(raceFrameAt(model, 1.25)).toEqual(frame);
    expect(raceGeometryAt(model, layout, 1.25)).toEqual(geometry);
  });

  it.each([
    [-20, 0],
    [30, 2],
  ])('clamps %i to %i in both entry points', (outside, endpoint) => {
    const model = prepareRace(spec, {});
    const layout = layoutRace(model, size);
    const frame = raceFrameAt(model, outside);

    expect(frame.t).toBe(endpoint);
    expect(frame).toEqual(raceFrameAt(model, endpoint));
    expect(raceGeometryAt(model, layout, outside)).toEqual(raceGeometryAt(model, layout, endpoint));
  });

  it('rejects a NaN frame time with a range error', () => {
    const model = prepareRace(spec, {});
    const layout = layoutRace(model, size);

    expect(() => raceFrameAt(model, NaN)).toThrow(RangeError);
    expect(() => raceGeometryAt(model, layout, NaN)).toThrow(RangeError);
  });

  it('uses layout colors and truncated names while frames keep their full labels', () => {
    const model = prepareRace(spec, {});
    const layout = layoutRace(model, {
      ...size,
      darkMode: true,
      theme: {
        colors: {
          categorical: [
            { light: '#123456', dark: '#abcdef' },
            { light: '#345678', dark: '#987654' },
          ],
        },
      },
    });
    const dark = raceGeometryAt(model, layout, 1);
    const light = raceFrameAt(model, 1);
    if (dark.mark !== 'bar') throw new Error('Expected bar geometry');

    expect(layout.colors).toEqual(['#abcdef', '#987654']);
    expect(dark.rows.map(({ key, color, name }) => [key, color, name.text])).toEqual([
      ['PT', '#987654', layout.labels[1]],
      ['BR', '#abcdef', layout.labels[0]],
    ]);
    expect(dark.rows[1].name.text).toMatch(/…$/);
    expect(light.items.map(({ key, color, label }) => [key, color, label])).toEqual([
      ['PT', CATEGORICAL_PALETTE[1], 'Portugal'],
      ['BR', CATEGORICAL_PALETTE[0], longName],
    ]);
  });

  it('uses the spec palette in standalone frames', () => {
    const model = prepareRace(
      {
        ...spec,
        theme: { colors: { categorical: [{ light: '#123456', dark: '#abcdef' }, '#345678'] } },
      },
      {},
    );
    const layout = layoutRace(model, size);
    const geometry = raceGeometryAt(model, layout, 0);
    if (geometry.mark !== 'bar') throw new Error('Expected bar geometry');

    expect(raceFrameAt(model, 0).items.map(({ color }) => color)).toEqual(['#123456', '#345678']);
    expect(geometry.rows.map(({ color }) => color)).toEqual(['#123456', '#345678']);
  });

  it('places the integer-period leader at the frame-rescaled right edge', () => {
    const model = prepareRace(spec, {});
    const layout = layoutRace(model, size);
    const geometry = raceGeometryAt(model, layout, 1);
    if (layout.mark !== 'bar' || geometry.mark !== 'bar') throw new Error('Expected bar geometry');

    const { plot, nameX } = layout.static;
    const leader = geometry.rows[0];
    expect(leader.key).toBe('PT');
    expect(leader.bar.x).toBe(plot.x);
    expect(leader.bar.x + leader.bar.width).toBeCloseTo(plot.x + plot.width);
    expect(geometry.rows.map(({ name }) => name.x)).toEqual([nameX, nameX]);
    expect(nameX).toBeLessThan(plot.x);
    expect(geometry.period).toMatchObject({ x: plot.x + plot.width, y: plot.y + plot.height });
  });

  it('shows the top sum, excludes a fading row, and keeps the hidden period available to frames', () => {
    const model = prepareRace(
      {
        ...spec,
        race: { ...spec.race, top: 1, swap: 1000, duration: 2000, summary: 'sum', period: false },
      },
      {},
    );
    const layout = layoutRace(model, size);
    const frame = raceFrameAt(model, 0.8);
    const geometry = raceGeometryAt(model, layout, 0.8);
    if (geometry.mark !== 'bar') throw new Error('Expected bar geometry');

    expect(frame.items.map(({ key, rank, value }) => ({ key, rank, value }))).toEqual([
      { key: 'PT', rank: 0, value: 9.4 },
      { key: 'BR', rank: 1, value: 8.8 },
    ]);
    expect(frame.period.label).toBe('2023');
    expect(frame.summary).toEqual({ value: 9.4, label: '9.4' });
    expect(geometry.period).toBeNull();
    expect(geometry.summary?.text).toBe('9.4');
  });
});
