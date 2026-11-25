import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

const IGNORED = 'playback is ignored without encoding.time';

const rows = [
  { country: 'France', year: 1995, gdp: 20000, life: 78 },
  { country: 'France', year: 1996, gdp: 21000, life: 78.4 },
  { country: 'India', year: 1995, gdp: 400, life: 61 },
  { country: 'India', year: 1996, gdp: 420, life: 61.5 },
];

const scatter: ChartSpec = {
  mark: 'point',
  data: rows,
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'life', type: 'quantitative' },
  },
};

function warningsFor(spec: ChartSpec): string[] {
  const warnings: string[] = [];
  compileChart(spec, { width: 400, height: 300, onWarn: (message) => warnings.push(message) });
  return warnings;
}

describe('playback without time warning', () => {
  it('warns when a chart has a playback block and no encoding.time', () => {
    expect(warningsFor({ ...scatter, playback: { duration: 4000 } })).toContain(IGNORED);
  });

  it('is silent when the chart has no playback block', () => {
    expect(warningsFor(scatter)).not.toContain(IGNORED);
  });

  it('is silent when the chart has encoding.time', () => {
    const timed: ChartSpec = {
      ...scatter,
      encoding: {
        ...scatter.encoding,
        key: { field: 'country' },
        time: { field: 'year', type: 'temporal' },
      },
      playback: { duration: 4000 },
    };
    expect(warningsFor(timed)).not.toContain(IGNORED);
  });
});
