import type { CompileWarning, RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, prepareRace, RaceDataError } from '../../index';

const spec = {
  type: 'race',
  mark: 'bar',
  data: [
    { year: 2024, country: 'BR', gdp: 24, name: 'Brazil' },
    { year: 2022, country: 'BR', gdp: 20, name: 'Brasil' },
    { year: 2023, country: 'PT', gdp: 10, name: 'Portugal' },
    { year: 2022, country: 'PT', gdp: 9, name: 'Portugal' },
    { year: 2024, country: 'PT', gdp: 12, name: 'Portugal' },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
    label: { field: 'name' },
  },
  race: { top: 2, swap: 0 },
} satisfies RaceSpec;

function getError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected compilation to throw');
}

describe('race preparation', () => {
  it('reuses ranking and formatting across a mark swap and rebuilds after a data edit', () => {
    const input = structuredClone(spec);
    const previousModel = prepareRace(input, {});
    const line = prepareRace({ ...input, mark: 'line' }, { previousModel });
    expect(line.spec.mark.type).toBe('line');
    for (const field of ['matrix', 'timeline', 'periodLabels', 'formatValue'] as const) {
      expect(line[field]).toBe(previousModel[field]);
    }

    input.data[0].gdp = 40;
    const updated = prepareRace({ ...input, mark: 'line' }, { previousModel: line });
    for (const field of ['matrix', 'timeline', 'periodLabels', 'formatValue'] as const) {
      expect(updated[field]).not.toBe(line[field]);
    }
    expect(line.timeline.valueAt(0, 2)).toBe(24);
    expect(updated.timeline.valueAt(0, 2)).toBe(40);
  });

  it('ignores unconsumed metadata on encoding and scaling options when reusing ranking', () => {
    const metadata = {
      toJSON() {
        throw new Error('Metadata is not part of the race');
      },
    };
    const input: RaceSpec = {
      ...spec,
      encoding: { ...spec.encoding, color: { ...metadata, field: 'country' } },
      race: { ...spec.race, rescale: { ...metadata, min: 30 } },
    };
    const previousModel = prepareRace(input, {});
    const next = prepareRace({ ...input, mark: 'line' }, { previousModel });
    expect(next.timeline).toBe(previousModel.timeline);
    expect(next.timeline.sample(2).domainMax).toBe(30);
  });

  it('rebuilds ranking when timing or formatting changes', () => {
    const previousModel = prepareRace(spec, {});
    const updated = prepareRace(
      {
        ...spec,
        race: { ...spec.race, swap: 300, period: { format: '%y' } },
        labels: { format: '.2f' },
      },
      { previousModel },
    );
    expect(updated.timeline).not.toBe(previousModel.timeline);
    expect(updated.periodLabels).toEqual(['22', '23', '24']);
    expect(updated.formatValue(24)).toBe('24.00');
  });

  it('pivots data, fills interior gaps, and caches ranks, labels, and color slots', () => {
    const model = prepareRace(spec, {});

    expect(model.matrix).toEqual({
      periods: [
        { value: 2022, sortKey: 2022 },
        { value: 2023, sortKey: 2023 },
        { value: 2024, sortKey: 2024 },
      ],
      keys: ['BR', 'PT'],
      labels: ['Brazil', 'Portugal'],
      colorValues: [null, null],
      values: [Float64Array.of(20, 22, 24), Float64Array.of(9, 10, 12)],
    });
    expect(model.periodLabels).toEqual(['2022', '2023', '2024']);
    expect(model.colorAssignment.slotsFor(6)).toEqual([0, 1]);
    expect(model.timeline).toMatchObject({ periodCount: 3, keyCount: 2, top: 2 });
    expect(model.timeline.sample(1.5)).toEqual({
      t: 1.5,
      periodIndex: 1,
      domainMin: 0,
      domainMax: 23,
      items: [
        { keyIndex: 0, value: 23, rank: 0, rankPos: 0, opacity: 1, change: 0 },
        { keyIndex: 1, value: 11, rank: 1, rankPos: 1, opacity: 1, change: 0 },
      ],
    });
    expect(model.warnings).toEqual([]);
  });

  it('honors the gap and rescale policies', () => {
    const model = prepareRace(
      { ...spec, race: { ...spec.race, gaps: 'hold', rescale: 'fixed' } },
      {},
    );

    expect(model.timeline.valueAt(0, 1)).toBe(20);
    expect(model.timeline.sample(0).domainMax).toBe(24);
  });

  it('orders color slots by first appearance and shares slots for an encoded group', () => {
    const data = [
      ...spec.data.map((row) => ({ ...row, region: row.country === 'BR' ? 'Americas' : 'Europe' })),
      { year: 2022, country: 'CA', gdp: 30, name: 'Canada', region: 'Americas' },
      { year: 2024, country: 'CA', gdp: 32, name: 'Canada', region: 'Americas' },
    ];
    const input = { ...spec, data, race: { ...spec.race, top: 3 } };
    expect(prepareRace(input, {}).colorAssignment.slotsFor(6)).toEqual([1, 0, 2]);
    expect(
      prepareRace(
        { ...input, encoding: { ...spec.encoding, color: { field: 'region' } } },
        {},
      ).colorAssignment.slotsFor(6),
    ).toEqual([0, 0, 1]);
  });

  it('prefers the period format over the time format and uses the channel format alone', () => {
    const formatted = {
      ...spec,
      encoding: { ...spec.encoding, time: { ...spec.encoding.time, format: '%b %Y' } },
    };
    expect(prepareRace(formatted, {}).periodLabels).toEqual(['Jan 2022', 'Jan 2023', 'Jan 2024']);
    expect(
      prepareRace({ ...formatted, race: { ...spec.race, period: { format: '%y' } } }, {})
        .periodLabels,
    ).toEqual(['22', '23', '24']);
  });

  it('reports all validation issues in the same aggregated format as compileChart', () => {
    const chartError = getError(() => compileChart(null, { width: 800, height: 500 }));
    expect(getError(() => prepareRace(null, {}))).toEqual(chartError);

    const error = getError(() =>
      prepareRace({ ...spec, race: { top: 0, duration: 0 }, encoding: { time: {} } }, {}),
    );
    expect(error.message.split('\n')).toEqual([
      chartError.message.split('\n')[0],
      '/encoding/time/field: Spec error: encoding.time requires a non-empty "field" string',
      '/encoding/key: Spec error: race encoding requires a "key" channel',
      '/encoding/value: Spec error: race encoding requires a "value" channel',
      '/race/top: Spec error: race.top must be an integer of at least 1',
      '/race/duration: Spec error: race.duration must be a finite number greater than zero',
    ]);
  });

  it('rejects a valid chart spec at the race entry point', () => {
    const chart = {
      mark: 'bar',
      data: spec.data,
      encoding: {
        x: { field: 'country', type: 'nominal' },
        y: { field: 'gdp', type: 'quantitative' },
      },
    };
    expect(() => prepareRace(chart, {})).toThrow(/prepareRace.*non-race spec/);
  });

  it('throws an unwrapped RaceDataError for duplicate rows', () => {
    const error = getError(() => prepareRace({ ...spec, data: [...spec.data, spec.data[0]] }, {}));
    expect(error).toBeInstanceOf(RaceDataError);
    expect(error).toMatchObject({
      code: 'DUPLICATE_KEY_PERIOD',
      message:
        "2 rows have country = 'BR' and year = 2024. Aggregate them first so each key has one value per period.",
    });
  });

  it('emits normalization and matrix warnings once and clamps top to the key count', () => {
    const warnings: CompileWarning[] = [];
    const data = Array.from({ length: 501 }, (_, index) => ({
      year: 2022,
      country: `C${index}`,
      gdp: index,
      name: `Country ${index}`,
    }));
    data.push({ year: 2023, country: 'C0', gdp: Infinity, name: 'Country 0' });
    const model = prepareRace(
      { ...spec, data, race: { ...spec.race, top: 502, controls: false } },
      { onWarn: (warning) => warnings.push(warning) },
    );

    expect(model.timeline.top).toBe(501);
    expect(warnings).toEqual([
      { code: 'RACE_SPEC_WARNING', message: expect.stringMatching(/autoplay.*controls disabled/) },
      { code: 'RACE_SPEC_WARNING', message: "Dropped 1 non-finite values from 'gdp'." },
      { code: 'RACE_SPEC_WARNING', message: expect.stringMatching(/^501 distinct keys/) },
      { code: 'RACE_SPEC_WARNING', message: expect.stringMatching(/race\.top.*502.*501/) },
    ]);
    expect(model.warnings).toEqual(warnings.map(({ message }) => message));
  });

  it('deduplicates a warning classified as a deprecation across preps for the same sink', () => {
    const input = {
      ...spec,
      data: spec.data.map((row, index) => ({
        ...row,
        deprecatedGdp: index === 0 ? Infinity : row.gdp,
      })),
      encoding: { ...spec.encoding, value: { field: 'deprecatedGdp' } },
    };
    const warnings: CompileWarning[] = [];
    const onWarn = (warning: CompileWarning) => warnings.push(warning);
    prepareRace(input, { onWarn });
    prepareRace(input, { onWarn });

    expect(warnings).toEqual([
      { code: 'RACE_SPEC_WARNING', message: "Dropped 1 non-finite values from 'deprecatedGdp'." },
    ]);
  });

  it.each([
    { race: { duration: 4800 }, expected: 4800 },
    { race: { step: 450 }, expected: 900 },
  ])('resolves authored timing $race to $expected ms', ({ race, expected }) => {
    const model = prepareRace({ ...spec, race: { ...spec.race, ...race } }, {});

    expect(model.playback.durationMs).toBe(expected);
  });

  it.each([
    [3, 8000],
    [20, 14000],
    [140, 90000],
  ])('resolves default timing for %i periods to %i ms', (count, expected) => {
    const data = Array.from({ length: count }, (_, index) => [
      { ...spec.data[0], year: 1900 + index },
      { ...spec.data[2], year: 1900 + index },
    ]).flat();
    const model = prepareRace({ ...spec, data }, {});

    expect(model.playback.durationMs).toBe(expected);
  });

  it('converts swap from milliseconds to ranks smoothed over the resolved period length', () => {
    const data = [
      { ...spec.data[0], year: 2022, gdp: 10 },
      { ...spec.data[0], year: 2023, gdp: 0 },
      { ...spec.data[0], year: 2024, gdp: 0 },
      { ...spec.data[2], year: 2022, gdp: 0 },
      { ...spec.data[2], year: 2023, gdp: 10 },
      { ...spec.data[2], year: 2024, gdp: 10 },
    ];
    const fast = prepareRace({ ...spec, data, race: { top: 2, step: 1000, swap: 400 } }, {});
    const slow = prepareRace({ ...spec, data, race: { top: 2, duration: 4000, swap: 400 } }, {});

    // The switch happens at the first sample after t = 0.5. This time sits
    // between samples, so the result depends on both sample density and swap.
    expect(fast.timeline.rankPos(0, 0.52)).toBeCloseTo(0.496, 6);
    expect(slow.timeline.rankPos(0, 0.52)).toBeCloseTo(0.493333, 6);
  });

  it('rejects a step whose full duration would overflow', () => {
    const error = getError(() => prepareRace({ ...spec, race: { ...spec.race, step: 1e308 } }, {}));
    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toMatch(/race\.step.*3 periods/);
  });

  it('keeps rank smoothing off with zero swap even for a subnormal duration', () => {
    const model = prepareRace({ ...spec, race: { ...spec.race, duration: Number.MIN_VALUE } }, {});

    expect(model.playback.durationMs).toBe(Number.MIN_VALUE);
    expect(model.timeline.sample(1.5).items.map(({ rankPos }) => rankPos)).toEqual([0, 1]);
  });

  it('uses the finite matrix extent for value formats and lets labels override the channel', () => {
    const formatted = {
      ...spec,
      data: spec.data.map((row) => ({ ...row, gdp: row.year === 2023 ? null : row.gdp })),
      encoding: { ...spec.encoding, value: { ...spec.encoding.value, format: 'percent' } },
    };

    expect(prepareRace(formatted, {}).formatValue(24)).toBe('24%');
    expect(prepareRace({ ...formatted, labels: { format: '.2f' } }, {}).formatValue(24)).toBe(
      '24.00',
    );
  });

  it('carries playback settings and suppresses autoplay when animation is disabled', () => {
    const race = { ...spec.race, duration: 2200, holdEnd: 300, loop: true, autoplay: true };
    expect(prepareRace({ ...spec, race }, {}).playback).toEqual({
      durationMs: 2200,
      holdEndMs: 300,
      loop: true,
      autoplay: true,
      controls: true,
    });
    const model = prepareRace(
      { ...spec, race: { ...race, controls: false }, animation: false },
      {},
    );
    expect(model.playback).toEqual({
      durationMs: 2200,
      holdEndMs: 300,
      loop: true,
      autoplay: false,
      controls: false,
    });
    expect(model.warnings).toEqual([]);
  });
});
