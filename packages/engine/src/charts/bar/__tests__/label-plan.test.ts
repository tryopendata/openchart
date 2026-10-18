import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { planBarLabels } from '../label-plan';

function spec(
  placement: 'column' | 'outside' | 'inside' | 'adaptive',
  values = [-10, 0, 20],
): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: values.map((value, i) => ({ name: `${i}`, value })),
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'name', type: 'nominal' },
    },
    labels: { density: 'all', format: '.1f', placement },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
  };
}
const theme = resolveTheme();
describe('pre-layout bar label plan', () => {
  it('measures every formatted value, including affixes, with the host measurer', () => {
    const input = spec('column', [100, 0.01]);
    input.labels.prefix = '$';
    input.labels.suffix = '%';
    const texts: string[] = [];
    const plan = planBarLabels(input, theme, {
      availableWidth: 400,
      measureText: (text) => {
        texts.push(text);
        return { width: text === '$0.0%' ? 90 : 30, height: 14 };
      },
    });
    expect(texts).toEqual(['$100.0%', '$0.0%']);
    expect(plan.reserveRight).toBe(102);
    expect(plan.columnWidth).toBe(90);
    expect(plan.placement).toBe('column');
  });
  it('falls back as one chart before placement and exposes the diagnostic reason', () => {
    const input = spec('column', [100]);
    const plan = planBarLabels(input, theme, {
      availableWidth: 110,
      measureText: () => ({ width: 40, height: 14 }),
    });
    expect(plan.placement).toBe('outside');
    expect(plan.fallback).toBe('column-to-outside');
    expect(plan.reserveRight).toBe(46);
  });
  it('suppresses as a whole if even outside cannot retain the minimum plot', () => {
    const plan = planBarLabels(spec('column'), theme, {
      availableWidth: 65,
      measureText: () => ({ width: 80, height: 14 }),
    });
    expect(plan.placement).toBe('suppress');
    expect(plan.fallback).toBe('labels-suppressed');
    expect(plan.reserveRight).toBe(0);
  });
  it('outside reserves both signed ends and zero uses the positive side', () => {
    const plan = planBarLabels(spec('outside'), theme, {
      availableWidth: 400,
      measureText: () => ({ width: 40, height: 14 }),
    });
    expect(plan.reserveLeft).toBe(46);
    expect(plan.reserveRight).toBe(46);
  });
  it('omission and adaptive keep the established zero-reservation behavior', () => {
    const input = spec('adaptive');
    delete input.labels.placement;
    expect(planBarLabels(input, theme, { availableWidth: 65 }).reserveRight).toBe(0);
    expect(planBarLabels(input, theme, { availableWidth: 65 }).placement).toBe('adaptive');
  });
  it('a figure-level column width aligns facet reservations', () => {
    const options = { availableWidth: 300, columnWidth: 100 };
    expect(planBarLabels(spec('column', [1]), theme, options).reserveRight).toBe(112);
    expect(planBarLabels(spec('column', [1000]), theme, options).reserveRight).toBe(112);
  });
});

for (const width of [330, 360, 680]) {
  for (const fontSize of [12, 14]) {
    it(`measured gutter preserves ${fontSize}px labels at ${width}px`, () => {
      const input = spec('column', [1, 100]);
      input.labels.fontSize = fontSize;
      const plan = planBarLabels(input, theme, {
        availableWidth: width,
        measureText: (text, size) => ({ width: text.length * size, height: size * 1.2 }),
      });
      expect(plan.placement).toBe('column');
      expect(plan.reserveRight).toBe(5 * fontSize + 12);
    });
  }
}

it('vertical bars reserve top/bottom space without inventing a value column', () => {
  const input = spec('outside');
  input.encoding = {
    x: { field: 'name', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  };
  const plan = planBarLabels(input, theme, {
    availableWidth: 400,
    availableHeight: 300,
    measureText: () => ({ width: 40, height: 16 }),
  });
  expect(plan.reserveRight).toBe(20);
  expect(plan.reserveLeft).toBe(20);
  expect(plan.columnWidth).toBe(0);
  expect(plan.reserveTop).toBe(24);
  expect(plan.reserveBottom).toBe(24);
});

it('does not reserve or format missing observations as true zero', () => {
  const input = spec('column');
  input.data = [null, undefined, '', ' ', false, Infinity, NaN, 0].map((value, i) => ({
    name: `${i}`,
    value,
  }));
  const seen: string[] = [];
  planBarLabels(input, theme, {
    availableWidth: 400,
    measureText: (text) => {
      seen.push(text);
      return { width: 20, height: 12 };
    },
  });
  expect(seen).toEqual(['0.0']);
});
