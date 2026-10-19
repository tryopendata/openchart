import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { measureLabel } from '../axes/thinning';

const yearly = (years: number[]) =>
  years.map((year, i) => ({ date: String(year), value: 10 + Math.sin(i) * 3 + i }));
const daily = Array.from({ length: 30 }, (_, i) => ({
  date: `2024-03-${String(i + 1).padStart(2, '0')}`,
  value: 10 + Math.sin(i) * 3,
}));

const temporalLine = (data: Record<string, unknown>[], axis?: Record<string, unknown>): ChartSpec =>
  ({
    mark: 'line',
    data,
    encoding: {
      x: { field: 'date', type: 'temporal', ...(axis ? { axis } : {}) },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: { title: 'Trend' },
  }) as ChartSpec;

describe('default temporal x ticks at compact widths', () => {
  const cases: Array<[string, Record<string, unknown>[]]> = [
    ['nine years', yearly([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024])],
    ['thirty days', daily],
  ];
  for (const [name, data] of cases) {
    it.each([280, 320, 340, 360])(`${name} keeps at least two labels at %spx`, (width) => {
      const layout = compileChart(temporalLine(data), { width, height: 300 });
      const ticks = layout.axes.x!.ticks;
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      const style = layout.axes.x!.tickLabelStyle;
      for (let i = 1; i < ticks.length; i++) {
        const prev = ticks[i - 1];
        const next = ticks[i];
        const prevRight =
          (prev.labelPosition ?? prev.position) +
          measureLabel(prev.label, style.fontSize, style.fontWeight) / 2;
        const nextLeft =
          (next.labelPosition ?? next.position) -
          measureLabel(next.label, style.fontSize, style.fontWeight) / 2;
        expect(prevRight, `${prev.label} / ${next.label}`).toBeLessThanOrEqual(nextLeft);
      }
    });
  }

  it('names the year when the compact tick cap drops the year-boundary tick', () => {
    // Mirrors annotationDelaySpec: 18 months, which used to collapse to "2024".
    const months = Array.from({ length: 18 }, (_, i) => {
      const m = i + 6;
      return {
        date: `${2023 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`,
        value: 40 + i,
      };
    });
    const layout = compileChart(temporalLine(months), { width: 390, height: 400 });
    const labels = layout.axes.x!.ticks.map((t) => t.label);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels.some((l) => /20\d\d/.test(l))).toBe(true);
  });

  it('leaves an authored tick count alone', () => {
    const layout = compileChart(
      temporalLine(yearly([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]), {
        tickCount: 1,
      }),
      { width: 320, height: 300 },
    );
    expect(layout.axes.x!.ticks.length).toBeLessThanOrEqual(1);
  });

  it('leaves authored tick values alone', () => {
    const layout = compileChart(
      temporalLine(yearly([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]), {
        values: ['2020-06-01'],
      }),
      { width: 320, height: 300 },
    );
    expect(layout.axes.x!.ticks).toHaveLength(1);
  });
});

describe('default numeric tick precision', () => {
  const halfSteps: ChartSpec = {
    mark: 'line',
    data: [3.6, 4.1, 4.4, 4.9, 5.2].map((value, i) => ({ date: String(2020 + i), value })),
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative', scale: { zero: false } },
    },
  };

  it('uses the least precision that tells the ticks apart', () => {
    const layout = compileChart(halfSteps, { width: 640, height: 400 });
    const labels = layout.axes.y!.ticks.map((t) => t.label);
    // 0.2 steps: "3.6", "3.8", "4", "4.2", not "3.60" beside "4".
    expect(labels).toContain('3.6');
    expect(labels).toContain('4');
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).not.toMatch(/\.\d*0$/);
  });

  it('keeps 0.05 steps at two places without trailing zeros', () => {
    const layout = compileChart(
      {
        ...halfSteps,
        data: [4.12, 4.2, 4.31, 4.38].map((value, i) => ({ date: String(2020 + i), value })),
      },
      { width: 640, height: 400 },
    );
    const labels = layout.axes.y!.ticks.map((t) => t.label);
    expect(labels.some((l) => /\.\d5$/.test(l))).toBe(true);
    for (const label of labels) expect(label).not.toMatch(/\.\d*0$/);
  });

  it('leaves an authored axis format untouched', () => {
    const layout = compileChart(
      {
        ...halfSteps,
        encoding: {
          ...halfSteps.encoding,
          y: { ...halfSteps.encoding.y!, axis: { format: '.2f' } },
        },
      } as ChartSpec,
      { width: 640, height: 400 },
    );
    expect(layout.axes.y!.ticks.map((t) => t.label)).toContain('4.00');
  });
});
