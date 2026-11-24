import { CATEGORICAL_PALETTE, type RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { worldGdpRace } from '../../../../../examples/src/data/world-gdp-race';
import { layoutRace, prepareRace, raceFrameAt, raceGeometryAt } from '../../index';
import { assignRaceColors, resolveRaceColors } from '../colors';
import { createRaceTimeline } from '../timeline';
import type { RaceMatrix } from '../types';

const matrix: RaceMatrix = {
  keys: ['A', 'B', 'C', 'D', 'E', 'F'],
  labels: ['A', 'B', 'C', 'D', 'E', 'F'],
  colorValues: ['east', null, 'south', 'south', 'west', null],
  periods: [2022, 2023, 2024].map((value) => ({ value, sortKey: value })),
  values: [
    [8, 7, 4],
    [4, 9, 11],
    [10, 2, 9],
    [3, 2, 3],
    [12, 12, 9],
    [2, 1, 2],
  ].map((values) => new Float64Array(values)),
};
const timeline = createRaceTimeline(matrix, {
  top: 2,
  samplesPerPeriod: 24,
  swapPeriods: 0,
  rescale: 'frame',
});
const palette = ['red', 'blue', 'green', 'orange', 'purple', 'brown'];

describe('race colors', () => {
  const gdp = prepareRace(
    {
      type: 'race',
      mark: 'bar',
      data: worldGdpRace.map((row) => ({ ...row, gdp: row.gdp * 1e9 })),
      encoding: {
        time: { field: 'year', type: 'ordinal' },
        key: { field: 'country' },
        value: { field: 'gdp' },
      },
      race: { top: 10 },
    },
    {},
  );
  const oldOrder = [
    ...new Set([
      ...Array.from({ length: gdp.timeline.periodCount }, (_, t) =>
        raceFrameAt(gdp, t).items.map(({ key }) => key),
      ).flat(),
      ...gdp.matrix.keys,
    ]),
  ];
  const oldColors = new Map(
    oldOrder.map((key, slot) => [key, CATEGORICAL_PALETTE[slot % CATEGORICAL_PALETTE.length]]),
  );

  function collisionScore(baseline: boolean) {
    const { periodCount, samplesPerPeriod } = gdp.timeline;
    let weighted = 0;
    let adjacentPeriods = 0;
    for (let sample = 0; sample <= (periodCount - 1) * samplesPerPeriod; sample++) {
      const items = raceFrameAt(gdp, sample / samplesPerPeriod).items;
      let collided = false;
      for (const [index, a] of items.entries()) {
        for (const b of items.slice(index + 1)) {
          if (baseline ? oldColors.get(a.key) !== oldColors.get(b.key) : a.color !== b.color)
            continue;
          const gap = Math.abs(a.rank - b.rank);
          weighted += gap === 1 ? 64 : gap === 2 ? 16 : gap === 3 ? 4 : 1;
          collided ||= gap === 1;
        }
      }
      if (collided && sample % samplesPerPeriod === 0) adjacentPeriods++;
    }
    return { weighted, adjacentPeriods };
  }

  it('lowers the weighted conflict score on GDP relative to first appearance', () => {
    expect(collisionScore(false).weighted).toBeLessThan(collisionScore(true).weighted);
  });

  it('has adjacency collisions in fewer GDP periods than first appearance', () => {
    expect(collisionScore(false).adjacentPeriods).toBeLessThan(
      collisionScore(true).adjacentPeriods,
    );
  });

  it('avoids every collision when all visible keys fit the palette', () => {
    const fixture = prepareRace(
      {
        type: 'race',
        mark: 'bar',
        data: matrix.keys.flatMap((key, index) =>
          [0, 1, 2].map((period) => ({ key, period, value: matrix.values[index][period] })),
        ),
        race: { top: 6 },
        encoding: { time: { field: 'period' }, key: { field: 'key' }, value: { field: 'value' } },
      },
      {},
    );
    for (const t of [0, 0.5, 1, 1.5, 2]) {
      const items = raceFrameAt(fixture, t).items;
      expect(items).toHaveLength(6);
      expect(new Set(items.map(({ color }) => color)).size).toBe(items.length);
    }
    const layout = layoutRace(fixture, { width: 800, height: 520 });
    expect(layout.colors).toEqual(fixture.frameColors);
  });

  it('scores co-visibility during the line mark’s exit fades', () => {
    const model = prepareRace(
      {
        type: 'race',
        mark: 'line',
        race: { top: 1, swap: 0 },
        data: Array.from({ length: 8 }, (_, period) =>
          Array.from({ length: 7 }, (_, key) => ({
            period,
            key: String(key),
            value: key === period % 7 ? 100 : 0,
          })),
        ).flat(),
        encoding: { time: { field: 'period' }, key: { field: 'key' }, value: { field: 'value' } },
      },
      {},
    );
    const layout = layoutRace(model, { width: 800, height: 520 });
    for (let step = 0; step <= 7 * 24; step++) {
      const geometry = raceGeometryAt(model, layout, step / 24);
      if (geometry.mark !== 'line') throw new Error('Expected a line');
      const colors = geometry.series.map(({ color }) => color);
      expect(new Set(colors).size, `t = ${step / 24}`).toBe(colors.length);
    }
  });

  it('scores a line trail after its key leads briefly between color samples', () => {
    const model = prepareRace(
      {
        type: 'race',
        mark: 'line',
        data: [
          [100, 0, 0, 47],
          [0, 0, 80, 47],
        ].flatMap((values, period) =>
          ['A', 'B', 'C', 'X'].map((key, index) => ({ period, key, value: values[index] })),
        ),
        race: { top: 1, step: 1000, swap: 0 },
        encoding: { time: { field: 'period' }, key: { field: 'key' }, value: { field: 'value' } },
        theme: { colors: { categorical: ['red', 'green', 'blue'] } },
      },
      {},
    );
    const layout = layoutRace(model, { width: 800, height: 520 });
    const geometry = raceGeometryAt(model, layout, 0.65);
    if (geometry.mark !== 'line') throw new Error('Expected a line');
    expect(new Set(geometry.series.map(({ key }) => key))).toEqual(new Set(['A', 'C', 'X']));
    expect(new Set(geometry.series.map(({ color }) => color))).toEqual(
      new Set(['red', 'green', 'blue']),
    );
  });

  it('preserves active-palette colors when copying the model', () => {
    const options = {
      width: 800,
      height: 520,
      theme: { colors: { categorical: palette.slice(0, 2) } },
    };
    const original = layoutRace(gdp, options);

    expect(original.colors).not.toEqual(
      resolveRaceColors(
        gdp.colorAssignment.slotsFor(CATEGORICAL_PALETTE.length),
        palette.slice(0, 2),
      ),
    );
    expect(layoutRace({ ...gdp }, options).colors).toEqual(original.colors);
  });

  it('assigns colors on first top-N appearance, then to unseen keys in key order', () => {
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, timeline, undefined, 'team').slotsFor(palette.length),
        palette,
      ),
    ).toEqual(['orange', 'green', 'blue', 'purple', 'red', 'brown']);
  });

  it('colors by key when the color field is the key field', () => {
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, timeline, { field: 'team' }, 'team').slotsFor(palette.length),
        palette,
      ),
    ).toEqual(['orange', 'green', 'blue', 'purple', 'red', 'brown']);
  });

  it('shares colors between keys with the same category, including missing categories', () => {
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, timeline, { field: 'region' }, 'team').slotsFor(palette.length),
        palette,
      ),
    ).toEqual(['orange', 'green', 'blue', 'blue', 'red', 'green']);
  });

  it('keeps a retained category’s color and gives a new category the available color', () => {
    const initial: RaceSpec = {
      type: 'race',
      mark: 'bar',
      data: [0, 1].flatMap((period) => [
        { period, key: 'A', group: 'X', value: 3 },
        { period, key: 'B', group: 'Y', value: 2 },
        { period, key: 'C', group: 'Z', value: 1 },
      ]),
      encoding: {
        time: { field: 'period' },
        key: { field: 'key' },
        value: { field: 'value' },
        color: { field: 'group' },
      },
      theme: { colors: { categorical: ['red', 'blue'] } },
      race: { top: 3 },
    };
    const model = prepareRace(initial, {});
    const updated = prepareRace(
      {
        ...initial,
        data: [0, 1].flatMap((period) => [
          { period, key: 'C', group: 'Z', value: 1 },
          { period, key: 'D', group: 'W', value: 2 },
        ]),
        race: { top: 2 },
      },
      { previousModel: model },
    );

    expect(raceFrameAt(model, 0).items.find(({ key }) => key === 'C')?.color).toBe('red');
    expect(raceFrameAt(updated, 0).items.map(({ key, color }) => [key, color])).toEqual([
      ['D', 'blue'],
      ['C', 'red'],
    ]);
  });

  it('assigns a constant color to every key', () => {
    expect(
      assignRaceColors(matrix, timeline, { value: '#abc' }, 'team').slotsFor(palette.length),
    ).toEqual(['#abc', '#abc', '#abc', '#abc', '#abc', '#abc']);
  });

  it('uses different colors for keys that always rank next to each other when co-visible', () => {
    const model = prepareRace(
      {
        type: 'race',
        mark: 'bar',
        data: [
          [100, 10, 70],
          [100, 95, 30],
          [100, 95, 30],
        ].flatMap((values, period) =>
          ['A', 'B', 'C'].map((key, index) => ({ period, key, value: values[index] })),
        ),
        encoding: { time: { field: 'period' }, key: { field: 'key' }, value: { field: 'value' } },
        race: { top: 2, swap: 0 },
      },
      {},
    );
    const layout = layoutRace(model, {
      width: 800,
      height: 520,
      theme: { colors: { categorical: ['red', 'blue'] } },
    });
    const geometry = raceGeometryAt(model, layout, 2);
    if (geometry.mark !== 'bar') throw new Error('Expected a bar');
    expect(geometry.rows.map(({ key }) => key)).toEqual(['A', 'B']);
    expect(new Set(geometry.rows.map(({ color }) => color))).toEqual(new Set(['red', 'blue']));
  });

  it('assigns a key a color when smoothing first makes it visible at a whole period', () => {
    const model = prepareRace(
      {
        type: 'race',
        mark: 'bar',
        data: matrix.keys.flatMap((key, index) =>
          [0, 1, 2].map((period) => ({
            key: key === 'A' ? 'Z' : key,
            period,
            value: matrix.values[index][period],
          })),
        ),
        encoding: { time: { field: 'period' }, key: { field: 'key' }, value: { field: 'value' } },
        race: { top: 2, step: 1000, swap: 1000 },
      },
      {},
    );
    expect(raceFrameAt(model, 0).items.map(({ key }) => key)).toEqual(['E', 'C']);
    expect(raceFrameAt(model, 1).items.map(({ key, rank }) => [key, rank])).toEqual([
      ['E', 0],
      ['B', 1],
      ['Z', 2],
    ]);
    const layout = layoutRace(model, {
      width: 800,
      height: 520,
      theme: { colors: { categorical: palette } },
    });
    expect(layout.colors[model.matrix.keys.indexOf('Z')]).toBe('orange');
    expect(layout.colors[model.matrix.keys.indexOf('D')]).toBe('purple');
  });

  it.each([
    'quantitative',
    'temporal',
  ] as const)('preserves the color slots after shuffling %s data rows', (type) => {
    const data = matrix.keys.flatMap((key, index) =>
      [0, 1, 2].map((period) => ({
        key,
        period: type === 'quantitative' ? 2022 + period : `${2022 + period}-01-01`,
        value: matrix.values[index][period],
      })),
    );
    const input: RaceSpec = {
      type: 'race',
      mark: 'bar',
      data,
      encoding: {
        time: { field: 'period', type },
        key: { field: 'key' },
        value: { field: 'value' },
      },
      race: { top: 2 },
    };
    const shuffled = [
      ...data.filter((_, index) => index % 2 === 1).reverse(),
      ...data.filter((_, index) => index % 2 === 0),
    ];
    const original = prepareRace(input, {});
    const reordered = prepareRace({ ...input, data: shuffled }, {});
    for (const size of [2, palette.length]) {
      expect(reordered.colorAssignment.slotsFor(size)).toEqual(
        original.colorAssignment.slotsFor(size),
      );
    }
  });

  it('keeps indices unwrapped in the assignment', () => {
    expect(assignRaceColors(matrix, timeline, undefined, 'team').slotsFor(palette.length)).toEqual([
      3, 2, 1, 4, 0, 5,
    ]);
  });
});

describe('resolving race colors', () => {
  it('resolves the same slots against different palettes and preserves constants', () => {
    const slots = [2, 0, '#abc', 3];

    expect(resolveRaceColors(slots, ['red', 'blue'])).toEqual(['red', 'red', '#abc', 'blue']);
    expect(resolveRaceColors(slots, ['cyan', 'magenta', 'yellow'])).toEqual([
      'yellow',
      'cyan',
      '#abc',
      'cyan',
    ]);
  });

  it('uses the core categorical palette when the active palette is empty', () => {
    expect(resolveRaceColors([1, CATEGORICAL_PALETTE.length, '#abc'], [])).toEqual([
      CATEGORICAL_PALETTE[1],
      CATEGORICAL_PALETTE[0],
      '#abc',
    ]);
  });
});
