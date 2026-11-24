import { CATEGORICAL_PALETTE } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { worldGdpRace } from '../../../../../examples/src/data/world-gdp-race';
import { layoutRace, prepareRace, raceFrameAt, raceGeometryAt } from '../../index';
import { assignRaceColors, resolveRaceColors } from '../colors';
import type { RaceMatrix, RaceTimeline } from '../types';

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
const orderedKeys = [
  [4, 2, 0, 1, 3, 5],
  [4, 1, 0, 2, 3, 5],
  [1, 4, 2, 0, 3, 5],
];
const timeline: RaceTimeline = {
  keyCount: 6,
  periodCount: 3,
  top: 2,
  samplesPerPeriod: 1,
  valueAt: (keyIndex, t) => matrix.values[keyIndex][t],
  exactRank: (keyIndex, t) => orderedKeys[t].indexOf(keyIndex),
  periodRank: (keyIndex, period) => orderedKeys[period].indexOf(keyIndex),
  rankPos: (keyIndex, t) => Math.min(2, orderedKeys[t].indexOf(keyIndex)),
  sample(t) {
    return {
      t,
      periodIndex: t,
      items: orderedKeys[t].slice(0, this.top).map((keyIndex, rank) => ({
        keyIndex,
        rank,
        rankPos: rank,
        value: this.valueAt(keyIndex, t),
        opacity: 1,
        change: 0,
      })),
      domainMin: 0,
      domainMax: this.valueAt(orderedKeys[t][0], t),
    };
  },
};
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

  it('honors caller-supplied slots on a copied model', () => {
    const layout = layoutRace(
      { ...gdp, colorSlots: gdp.colorSlots.map(() => 'red') },
      { width: 800, height: 520 },
    );
    expect(layout.colors).toEqual(gdp.matrix.keys.map(() => 'red'));
  });

  it('assigns colors on first top-N appearance, then to unseen keys in key order', () => {
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, timeline, undefined, 'team')(palette.length),
        palette,
      ),
    ).toEqual(['orange', 'green', 'blue', 'purple', 'red', 'brown']);
  });

  it('colors by key when the color field is the key field', () => {
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, timeline, { field: 'team' }, 'team')(palette.length),
        palette,
      ),
    ).toEqual(['orange', 'green', 'blue', 'purple', 'red', 'brown']);
  });

  it('shares colors between keys with the same category, including missing categories', () => {
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, timeline, { field: 'region' }, 'team')(palette.length),
        palette,
      ),
    ).toEqual(['orange', 'green', 'blue', 'blue', 'red', 'green']);
  });

  it('assigns a constant color to every key', () => {
    expect(assignRaceColors(matrix, timeline, { value: '#abc' }, 'team')(palette.length)).toEqual([
      '#abc',
      '#abc',
      '#abc',
      '#abc',
      '#abc',
      '#abc',
    ]);
  });

  it('uses the active palette size when minimizing co-visible conflicts', () => {
    const colors = assignRaceColors(matrix, timeline, undefined, 'team');
    expect(colors(2)).toBe(colors(2));
    expect(colors(2).every((slot) => typeof slot === 'number' && slot < 2)).toBe(true);
    expect(colors(6)).toEqual([3, 2, 1, 4, 0, 5]);
  });

  it('assigns colors when smoothed rows first become visible in an integer sample', () => {
    const transitioning: RaceTimeline = {
      ...timeline,
      sample(t) {
        const sample = timeline.sample(t);
        if (t !== 1) return sample;
        return {
          ...sample,
          items: [
            sample.items[0],
            { keyIndex: 0, value: 7, rank: 2, rankPos: 0.9, opacity: 1, change: 0 },
            sample.items[1],
          ],
        };
      },
    };
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, transitioning, undefined, 'team')(palette.length),
        palette,
      ),
    ).toEqual(['green', 'orange', 'blue', 'purple', 'red', 'brown']);
    expect(
      resolveRaceColors(
        assignRaceColors(matrix, transitioning, { field: 'region' }, 'team')(palette.length),
        palette,
      ),
    ).toEqual(['green', 'orange', 'blue', 'blue', 'red', 'orange']);
  });

  it('keeps indices unwrapped in the assignment', () => {
    expect(assignRaceColors(matrix, timeline, undefined, 'team')(palette.length)).toEqual([
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
