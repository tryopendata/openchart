import type { RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { normalizeRaceSpec } from '../normalize';

const spec = {
  type: 'race',
  data: [
    { year: 2023, country: 'France', gdp: 3052 },
    { year: 2024, country: 'France', gdp: 3160 },
  ],
  mark: 'bar',
  encoding: {
    time: { field: 'year' },
    key: { field: 'country' },
    value: { field: 'gdp' },
  },
} satisfies RaceSpec;

describe('race spec normalization', () => {
  it('fills the defaults for a bare race spec and defers playback duration', () => {
    const warnings: string[] = [];
    expect(normalizeRaceSpec(spec, warnings)).toEqual({
      ...spec,
      mark: { type: 'bar', cornerRadius: 0 },
      encoding: {
        time: { field: 'year', type: 'quantitative' },
        key: { field: 'country', type: 'nominal' },
        value: { field: 'gdp', type: 'quantitative' },
      },
      race: {
        top: 10,
        duration: undefined,
        step: undefined,
        swap: 400,
        rescale: 'frame',
        gaps: 'interpolate',
        holdEnd: 1500,
        loop: false,
        autoplay: 'visible',
        controls: true,
        period: {},
        summary: false,
      },
      chrome: {},
      theme: {},
      watermark: true,
    });
    expect(warnings).toEqual([]);
  });

  it.each([
    { mark: 'line', expected: { type: 'line', window: 'reveal' } },
    { mark: { type: 'line' }, expected: { type: 'line', window: 'reveal' } },
    { mark: { type: 'line', window: 'all' }, expected: { type: 'line', window: 'all' } },
    { mark: { type: 'bar', cornerRadius: 4 }, expected: { type: 'bar', cornerRadius: 4 } },
    ...(['table', { type: 'table' }] satisfies RaceSpec['mark'][]).map((mark) => ({
      mark,
      expected: { type: 'table', columns: ['rank', 'change', 'name', 'bar', 'value', 'share'] },
    })),
    {
      mark: { type: 'table', columns: ['name', 'value'] },
      expected: { type: 'table', columns: ['name', 'value'] },
    },
  ] satisfies Array<{
    mark: RaceSpec['mark'];
    expected: object;
  }>)('resolves mark defaults and preserves overrides for $mark', ({ mark, expected }) => {
    expect(normalizeRaceSpec({ ...spec, mark }, []).mark).toEqual(expected);
  });

  it('preserves explicit settings, normalizes chrome, and leaves the input intact', () => {
    const custom: RaceSpec = {
      ...spec,
      encoding: {
        time: { field: 'year', type: 'temporal', format: '%Y' },
        key: { field: 'country', type: 'ordinal' },
        value: { field: 'gdp', type: 'quantitative', format: '$~s' },
        color: { value: 'teal' },
        label: { field: 'country', type: 'nominal' },
      },
      race: {
        top: 4,
        step: 750,
        swap: 0,
        rescale: { min: 5000 },
        gaps: 'drop',
        holdEnd: 0,
        loop: true,
        autoplay: false,
        controls: false,
        period: false,
        summary: 'sum',
      },
      chrome: {
        eyebrow: 'Economy',
        title: 'Largest economies',
        subtitle: { text: 'Gross domestic product', color: 'teal' },
        source: 'World Bank',
        byline: 'Markets desk',
        footer: 'Current US dollars',
        brand: 'OpenData',
      },
      theme: { colors: { background: '#fff' } },
      labels: { format: ',.2f' },
      width: 640,
      height: 480,
      watermark: false,
    };
    const original = structuredClone(custom);
    const warnings: string[] = [];

    expect(normalizeRaceSpec(custom, warnings)).toEqual({
      ...original,
      mark: { type: 'bar', cornerRadius: 0 },
      chrome: {
        eyebrow: { text: 'Economy' },
        title: { text: 'Largest economies' },
        subtitle: { text: 'Gross domestic product', color: 'teal' },
        source: { text: 'World Bank' },
        byline: { text: 'Markets desk' },
        footer: { text: 'Current US dollars' },
        brand: { text: 'OpenData' },
      },
    });
    expect(custom).toEqual(original);
    expect(warnings).toEqual([]);
  });

  it('keeps explicit duration when step is omitted', () => {
    const { race } = normalizeRaceSpec({ ...spec, race: { duration: 12000 } }, []);
    expect(race.duration).toBe(12000);
    expect(race.step).toBeUndefined();
  });

  it.each([
    { periods: ['2023-01-01', '2024-01-01'], type: 'temporal' },
    { periods: ['Q4', 'Q1'], type: 'ordinal' },
  ])('infers $type for omitted time type from $periods', ({ periods, type }) => {
    const data = spec.data.map((row, index) => ({ ...row, year: periods[index] }));
    expect(normalizeRaceSpec({ ...spec, data }, []).encoding.time).toEqual({ field: 'year', type });
  });

  it('defaults the period format to the time channel format', () => {
    const encoding = { ...spec.encoding, time: { field: 'year', format: '%Y' } };
    expect(normalizeRaceSpec({ ...spec, encoding }, []).race.period).toEqual({ format: '%Y' });
  });

  it('uses the authored period format when present', () => {
    const encoding = { ...spec.encoding, time: { field: 'year', format: '%Y' } };
    const race = { period: { format: '%b %Y' } };
    expect(normalizeRaceSpec({ ...spec, encoding, race }, []).race.period).toEqual({
      format: '%b %Y',
    });
  });

  it.each([
    false,
    undefined,
  ])('disables autoplay when animation is false and controls is %s', (controls) => {
    const warnings: string[] = [];
    const result = normalizeRaceSpec(
      {
        ...spec,
        animation: false,
        race: { controls, autoplay: true },
      },
      warnings,
    );
    expect(result.animation).toBe(false);
    expect(result.race.autoplay).toBe(false);
    expect(result.race.controls).toBe(controls ?? true);
    expect(warnings).toEqual([]);
  });

  it.each([undefined, true, 'visible'] satisfies Array<
    NonNullable<RaceSpec['race']>['autoplay']
  >)('appends one accessibility warning with controls off and autoplay %j', (autoplay) => {
    const warnings = ['An earlier warning.'];
    const result = normalizeRaceSpec({ ...spec, race: { controls: false, autoplay } }, warnings);
    expect(result.race.autoplay).toBe(autoplay ?? 'visible');
    expect(result.race.controls).toBe(false);
    expect(warnings).toEqual([
      'An earlier warning.',
      expect.stringContaining('Set race.controls to true or race.autoplay to false'),
    ]);
  });
});
