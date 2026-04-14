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
});
