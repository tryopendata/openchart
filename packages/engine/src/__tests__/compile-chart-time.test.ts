import type { PointMark } from '@opendata-ai/openchart-core';
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

  it('renders empty data without throwing', () => {
    const layout = compileChart(bubbleSpec([]), compileOptions);
    expect(points(layout.marks)).toEqual([]);
  });

  it('leaves a spec without time on the ordinary compile path', () => {
    const spec = staticSpec(bubbleSpec(rows));
    expect(points(compileChart(spec, compileOptions).marks)).toHaveLength(rows.length);
  });
});
