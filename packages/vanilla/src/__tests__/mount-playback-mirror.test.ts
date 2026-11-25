/**
 * A bar chart playing over time, mirrored (a population pyramid) or not, draws the bars and
 * value labels of the period the playhead is on, matching the static render at the same `t`.
 */
import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { renderStaticSVG } from '../static';

const YEARS = [2000, 2010, 2020];
const AGES = ['0-4', '5-9', '10-14'];

const rows = YEARS.flatMap((year, period) =>
  AGES.flatMap((age, band) => [
    { year, age, sex: 'Male', pop: 100 + 400 * period + 10 * band },
    { year, age, sex: 'Female', pop: 90 + 300 * period + 20 * band },
  ]),
);

const pyramid: ChartSpec = {
  mark: { type: 'bar', mirror: true },
  data: rows,
  encoding: {
    y: { field: 'age', type: 'ordinal', sort: AGES },
    x: { field: 'pop', type: 'quantitative' },
    color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
    time: { field: 'year', type: 'temporal' },
  },
  playback: { autoplay: false, controls: false },
};

const plainBars: ChartSpec = {
  mark: 'bar',
  data: rows.filter((row) => row.sex === 'Male'),
  encoding: {
    y: { field: 'age', type: 'nominal', sort: AGES },
    x: { field: 'pop', type: 'quantitative' },
    time: { field: 'year', type: 'temporal' },
  },
  playback: { autoplay: false, controls: false },
};

const SIZE = { width: 640, height: 480 };

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
});

/** The x extent of a bar's shape, from its rect attributes or its path's x coordinates. */
function xExtent(shape: Element | null): [number, number] {
  const d = shape?.getAttribute('d');
  const xs = d
    ? [...d.matchAll(/[MH]\s*(-?[\d.]+)/g)].map(([, x]) => Number(x))
    : [Number(shape?.getAttribute('x')), Number(shape?.getAttribute('width'))].reduce(
        (edges, value, index) => (index === 0 ? [value] : [edges[0], edges[0] + value]),
        [] as number[],
      );
  return [Math.min(...xs), Math.max(...xs)].map((x) => Math.round(x * 10) / 10) as [number, number];
}

/** Each keyed bar's x extent and value label text, by key. */
function drawnBars(root: ParentNode): Record<string, unknown> {
  const bars: Record<string, unknown> = {};
  for (const bar of root.querySelectorAll('.oc-mark-rect[data-key]')) {
    const key = String(bar.getAttribute('data-key'));
    const label = root.querySelector(`[data-label-key="${CSS.escape(key)}"]`);
    bars[key] = { extent: xExtent(bar.querySelector('rect, path')), label: label?.textContent };
  }
  return bars;
}

function staticBars(spec: ChartSpec, t: number): Record<string, unknown> {
  const host = document.createElement('div');
  host.innerHTML = renderStaticSVG(spec, { idPrefix: 's', t, ...SIZE });
  return drawnBars(host);
}

describe.each([
  ['a mirrored bar playback', pyramid, 6],
  ['a bar playback', plainBars, 3],
])('%s', (_name, spec, barCount) => {
  it('draws the period it is seeked to, as the static render does', () => {
    const container = createContainer(SIZE.width, SIZE.height);
    const chart = createChart(container, spec, { autoResize: false });
    cleanup.push(() => chart.destroy());
    chart.playback?.seek(1);

    const live = drawnBars(container);
    expect(Object.keys(live)).toHaveLength(barCount);
    expect(live).toEqual(staticBars(spec, 1));
    expect(live).not.toEqual(staticBars(spec, 2));
  });
});
