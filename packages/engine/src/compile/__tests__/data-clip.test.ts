import type { Encoding } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { filterClippedDomains } from '../data-clip';

describe('filterClippedDomains', () => {
  const data = [
    { x: -5, y: 10 },
    { x: 10, y: 20 },
    { x: 25, y: 80 },
    { x: 50, y: 110 },
    { x: 80, y: 200 },
  ];

  it('returns data unchanged when no channel declares scale.clip', () => {
    const encoding: Encoding = {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    };
    const result = filterClippedDomains(data, encoding);
    expect(result).toBe(data);
    expect(result).toHaveLength(5);
  });

  it('filters rows outside the x-axis clipped domain', () => {
    const encoding: Encoding = {
      x: {
        field: 'x',
        type: 'quantitative',
        scale: { domain: [0, 30], clip: true },
      },
      y: { field: 'y', type: 'quantitative' },
    };
    const result = filterClippedDomains(data, encoding);
    expect(result).toEqual([
      { x: 10, y: 20 },
      { x: 25, y: 80 },
    ]);
  });

  it('filters rows outside both x- and y-axis clipped domains', () => {
    const encoding: Encoding = {
      x: {
        field: 'x',
        type: 'quantitative',
        scale: { domain: [0, 60], clip: true },
      },
      y: {
        field: 'y',
        type: 'quantitative',
        scale: { domain: [0, 100], clip: true },
      },
    };
    const result = filterClippedDomains(data, encoding);
    expect(result).toEqual([
      { x: 10, y: 20 },
      { x: 25, y: 80 },
    ]);
  });

  describe('categorical domains', () => {
    const years = [
      { year: '2019', pct: 32.4 },
      { year: '2020', pct: 31.9 },
      { year: '2021', pct: 33.9 },
      { year: '2022', pct: 33.6 },
    ];

    it('keeps only rows whose value is in the domain set', () => {
      const encoding: Encoding = {
        x: {
          field: 'year',
          type: 'ordinal',
          scale: { domain: ['2021', '2022'], clip: true },
        },
        y: { field: 'pct', type: 'quantitative' },
      };
      expect(filterClippedDomains(years, encoding)).toEqual([
        { year: '2021', pct: 33.9 },
        { year: '2022', pct: 33.6 },
      ]);
    });

    it('matches numeric row values against a string domain', () => {
      const numericYears = [
        { year: 2020, pct: 31.9 },
        { year: 2021, pct: 33.9 },
      ];
      const encoding: Encoding = {
        x: {
          field: 'year',
          type: 'ordinal',
          scale: { domain: ['2021'], clip: true },
        },
        y: { field: 'pct', type: 'quantitative' },
      };
      expect(filterClippedDomains(numericYears, encoding)).toEqual([{ year: 2021, pct: 33.9 }]);
    });

    it('does not treat a two-category domain as a numeric range', () => {
      const encoding: Encoding = {
        x: {
          field: 'year',
          type: 'ordinal',
          // A range reading would keep 2020 and 2021 too; membership must not.
          scale: { domain: ['2019', '2022'], clip: true },
        },
        y: { field: 'pct', type: 'quantitative' },
      };
      expect(filterClippedDomains(years, encoding)).toEqual([
        { year: '2019', pct: 32.4 },
        { year: '2022', pct: 33.6 },
      ]);
    });

    it('passes data through when the channel has no clip', () => {
      const encoding: Encoding = {
        x: {
          field: 'year',
          type: 'ordinal',
          scale: { domain: ['2021', '2022'] },
        },
        y: { field: 'pct', type: 'quantitative' },
      };
      expect(filterClippedDomains(years, encoding)).toBe(years);
    });
  });
});
