import type { RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it, vi } from 'vitest';
import { raceA11y } from '../a11y';
import { layoutRace } from '../layout';
import { prepareRace } from '../prepare';

const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  data: [
    { year: 2020, key: 'a', name: 'Alpha', score: 20 },
    { year: 2020, key: 'b', name: 'Beta', score: 30 },
    { year: 2020, key: 'c', name: 'Gamma', score: 10 },
    { year: 2021, key: 'a', name: 'Alpha', score: 10 },
    { year: 2021, key: 'b', name: 'Beta', score: 10 },
    { year: 2021, key: 'c', name: 'Gamma', score: 30 },
    { year: 2022, key: 'a', name: 'Alpha', score: 10 },
    { year: 2022, key: 'b', name: 'Beta', score: 20 },
    { year: 2022, key: 'c', name: 'Gamma', score: 30 },
  ],
  encoding: {
    time: { field: 'year', type: 'quantitative', format: '.0f CE' },
    key: { field: 'key' },
    label: { field: 'name' },
    value: { field: 'score', format: '.1f' },
  },
  race: { top: 2, duration: 2000, swap: 1000 },
};

describe('raceA11y', () => {
  it('describes both endpoint leaders and the largest full-rank climb', () => {
    const a11y = raceA11y(prepareRace(spec, {}));
    expect(a11y.altText).toBe(
      '2020 CE to 2022 CE. Beta leads in 2020 CE. Gamma leads in 2022 CE. Gamma climbs the most, from rank 3 to rank 1.',
    );
  });

  it('lists exact period standings with formatted values, even when positions are smoothed', () => {
    expect(raceA11y(prepareRace(spec, {})).dataTableFallback).toEqual([
      ['Period', 'Rank 1', 'Rank 2'],
      ['2020 CE', 'Beta (30.0)', 'Alpha (20.0)'],
      ['2021 CE', 'Gamma (30.0)', 'Beta (10.0)'],
      ['2022 CE', 'Gamma (30.0)', 'Beta (20.0)'],
    ]);
  });

  it.each([60, 61, 121])('covers the full span when there are %i periods', (count) => {
    const model = prepareRace(
      {
        ...spec,
        race: { top: 1 },
        data: Array.from({ length: count }, (_, i) => ({
          year: 1900 + i,
          key: 'A',
          name: null,
          score: i,
        })),
      },
      {},
    );
    const { dataTableFallback, totalRows } = raceA11y(model);
    const expected = Array.from({ length: 60 }, (_, i) => {
      const index = Math.round((i * (count - 1)) / 59);
      return [`${1900 + index} CE`, `A (${index}.0)`];
    });
    expect(dataTableFallback).toEqual([['Period', 'Rank 1'], ...expected]);
    expect(totalRows).toBe(count > 60 ? count : undefined);
  });

  it('names leaders by key when their display labels are blank', () => {
    const model = prepareRace(
      { ...spec, data: spec.data.map((row) => ({ ...row, name: row.key === 'c' ? '  ' : '' })) },
      {},
    );
    const { altText, dataTableFallback } = raceA11y(model);
    expect(altText).toBe(
      '2020 CE to 2022 CE. b leads in 2020 CE. c leads in 2022 CE. c climbs the most, from rank 3 to rank 1.',
    );
    expect(dataTableFallback.at(-1)).toEqual(['2022 CE', 'c (30.0)', 'b (20.0)']);
  });

  it('gets a whole period ranking without recomputing it for each tied key', () => {
    const model = prepareRace(
      {
        ...spec,
        data: spec.data.map((row) => ({ ...row, score: row.year === 2021 ? 10 : row.score })),
      },
      {},
    );
    using exactRank = vi.spyOn(model.timeline, 'exactRank');
    expect(raceA11y(model).dataTableFallback[2]).toEqual([
      '2021 CE',
      'Beta (10.0)',
      'Alpha (10.0)',
    ]);
    expect(exactRank).not.toHaveBeenCalled();
  });

  it('isolates the accessibility metadata returned in each layout', () => {
    const model = prepareRace(spec, {});
    const { a11y } = layoutRace(model, { width: 640, height: 480 });
    a11y.altText = 'Custom';
    a11y.dataTableFallback[0][0] = 'Changed';
    a11y.dataTableFallback.pop();

    const next = layoutRace(model, { width: 400, height: 300 }).a11y;
    expect(next.altText).toContain('2020 CE to 2022 CE');
    expect(next.dataTableFallback).toEqual([
      ['Period', 'Rank 1', 'Rank 2'],
      ['2020 CE', 'Beta (30.0)', 'Alpha (20.0)'],
      ['2021 CE', 'Gamma (30.0)', 'Beta (10.0)'],
      ['2022 CE', 'Gamma (30.0)', 'Beta (20.0)'],
    ]);
  });

  it('leaves ranks blank for empty periods and skips unavailable endpoints in the climb', () => {
    const model = prepareRace(
      {
        ...spec,
        race: { top: 2, gaps: 'drop' },
        data: [
          { year: 2020, key: 'a', name: null, score: null },
          { year: 2021, key: 'a', name: null, score: -4 },
          { year: 2022, key: 'b', name: null, score: 0 },
        ],
      },
      {},
    );
    expect(raceA11y(model)).toEqual({
      altText: '2020 CE to 2022 CE. No ranked entries in 2020 CE. b leads in 2022 CE.',
      dataTableFallback: [
        ['Period', 'Rank 1', 'Rank 2'],
        ['2020 CE', '', ''],
        ['2021 CE', 'a (−4.0)', ''],
        ['2022 CE', 'b (0.0)', ''],
      ],
      role: 'img',
      keyboardNavigable: false,
    });
  });

  it('honors authored descriptions and the hidden and table settings', () => {
    const described = raceA11y(
      prepareRace({ ...spec, a11y: { description: 'Official results', table: false } }, {}),
    );
    expect(described.altText).toBe('Official results');
    expect(described.dataTableFallback).toEqual([]);
    const hidden = raceA11y(prepareRace({ ...spec, a11y: { hidden: true } }, {}));
    expect(hidden.hidden).toBe(true);
    expect(hidden.dataTableFallback).toEqual([]);
  });
});
