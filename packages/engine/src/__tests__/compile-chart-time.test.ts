import type { ChartSpec, PointMark, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import {
  bubbleRows,
  bubbleSpec,
  compileOptions,
  staticSpec,
} from '../playback/__tests__/chart-fixtures';
import { compileChartPlayback } from '../playback/chart-playback';

function points(marks: { type: string }[]): PointMark[] {
  return marks.filter((mark): mark is PointMark => mark.type === 'point');
}

// Dorne has no 2002 row, so the final period has three keys.
const rows = bubbleRows().filter((row) => !(row.country === 'Dorne' && row.year === 2002));

describe('compileChart on a time spec', () => {
  it('returns marks for the final period only, one per key present there', () => {
    const layout = compileChart(bubbleSpec(rows), compileOptions);
    const drawn = points(layout.marks);
    expect(drawn.map((mark) => mark.key).sort()).toEqual(['Avalon', 'Borea', 'Cydonia']);
  });

  it('places the final-period marks where the playback draws them, on the frozen axes', () => {
    const spec = bubbleSpec(rows);
    const layout = compileChart(spec, compileOptions);
    const playback = compileChartPlayback(spec, compileOptions);
    expect(layout.axes).toEqual(playback.frame.layout.axes);
    const final = playback.marksAt(playback.periods.length - 1);
    for (const mark of points(layout.marks)) {
      const frameMark = final.find((entry) => entry.key === mark.key)?.mark as PointMark;
      expect(mark.cx).toBeCloseTo(frameMark.cx, 6);
      expect(mark.cy).toBeCloseTo(frameMark.cy, 6);
    }
  });

  it('draws the period playbackT names', () => {
    const spec = bubbleSpec(rows);
    const layout = compileChart(spec, { ...compileOptions, playbackT: 0 });
    const playback = compileChartPlayback(spec, compileOptions);
    const first = playback.marksAt(0);
    const drawn = points(layout.marks);
    expect(drawn.map((mark) => mark.key).sort()).toEqual(['Avalon', 'Borea', 'Cydonia', 'Dorne']);
    for (const mark of drawn) {
      const frameMark = first.find((entry) => entry.key === mark.key)?.mark as PointMark;
      expect(mark.cx).toBeCloseTo(frameMark.cx, 6);
    }
  });

  it('renders a single period as the static chart, with a warning', () => {
    const single = bubbleRows().filter((row) => row.year === 2001);
    const warnings: string[] = [];
    const layout = compileChart(bubbleSpec(single), {
      ...compileOptions,
      onWarn: (message) => warnings.push(message),
    });
    expect(points(layout.marks)).toHaveLength(4);
    expect(warnings.some((message) => /period/i.test(message))).toBe(true);
  });

  it('rejects empty data like every other chart', () => {
    expect(() => compileChart(bubbleSpec([]), compileOptions)).toThrow(/non-empty array/);
  });

  it('fades a bar that leaves between periods, as the live frames do', () => {
    const barRows = ['a', 'b', 'c'].flatMap((category, index) =>
      [2000, 2001, 2002].map((year) => ({ category, year, value: (index + 1) * 10 + year - 2000 })),
    );
    const spec = {
      mark: 'bar',
      data: barRows.filter((row) => !(row.category === 'c' && row.year === 2002)),
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
        time: { field: 'year', type: 'temporal' },
      },
    } as ChartSpec;
    const playback = compileChartPlayback(spec, compileOptions);
    const presence = playback.marksAt(1.25).find(({ key }) => key === '|c')?.presence ?? 1;
    expect(presence).toBeLessThan(1);
    const layout = compileChart(spec, { ...compileOptions, playbackT: 1.25 });
    const leaving = layout.marks.find((mark): mark is RectMark => mark.key === '|c');
    expect(leaving?.fillOpacity).toBeCloseTo(presence, 6);
    const staying = layout.marks.find((mark): mark is RectMark => mark.key === '|a');
    expect(staying?.fillOpacity).toBeUndefined();
  });

  it('fades the name label of a point that leaves, as the live frames do', () => {
    const spec = bubbleSpec(rows, { playback: { labels: ['Dorne'] } });
    const playback = compileChartPlayback(spec, compileOptions);
    const presence = playback.marksAt(1.25).find(({ key }) => key === 'Dorne')?.presence ?? 1;
    expect(presence).toBeLessThan(1);
    const layout = compileChart(spec, { ...compileOptions, playbackT: 1.25 });
    const label = layout.marks.find((mark) => mark.key === 'oc-playback-label|Dorne');
    expect(label?.type).toBe('textMark');
    expect(label && 'opacity' in label ? label.opacity : 1).toBeCloseTo(presence, 6);
  });

  it('rejects trails on a point chart with a categorical y instead of crashing', () => {
    const spec = bubbleSpec(rows, { playback: { trails: true } });
    const encoding = { ...spec.encoding, y: { field: 'region', type: 'nominal' } };
    expect(() => compileChart({ ...spec, encoding } as ChartSpec, compileOptions)).toThrow(
      /playback\.trails/,
    );
  });

  it('leaves a spec without time on the ordinary compile path', () => {
    const spec = staticSpec(bubbleSpec(rows));
    expect(points(compileChart(spec, compileOptions).marks)).toHaveLength(rows.length);
  });
});
