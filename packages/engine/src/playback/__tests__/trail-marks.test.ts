/**
 * Trails in the static compile of a time spec: the engine's decorative trail marks at the
 * static period, under the bubbles, styled as the live trails are.
 */
import type { LineMark, Mark, PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { compileChartPlayback } from '../chart-playback';
import { isTrailMark, TRAIL_STYLE, trailDotKey, trailLineKey } from '../trail-marks';
import { bubbleSpec, compileOptions } from './chart-fixtures';

const spec = bubbleSpec(undefined, { playback: { trails: ['Avalon'] } });

function dataPoint(marks: Mark[], key: string): PointMark {
  return marks.find((mark) => mark.type === 'point' && mark.key === key) as PointMark;
}

describe('compileChart on a time spec with playback.trails', () => {
  it('draws the trail line and one dot per observed period at the final period, under the bubbles', () => {
    const layout = compileChart(spec, compileOptions);
    const playback = compileChartPlayback(spec, compileOptions);
    const [trail] = playback.trailsAt(playback.periods.length - 1);
    const bubble = dataPoint(layout.marks, 'Avalon');
    const color = bubble.fill as string;

    const trailMarks = layout.marks.filter(isTrailMark);
    expect(trailMarks).toEqual([
      {
        type: 'line',
        key: trailLineKey('Avalon'),
        points: [...trail.points, trail.head],
        stroke: color,
        strokeWidth: TRAIL_STYLE.strokeWidth,
        opacity: TRAIL_STYLE.opacity,
        data: [],
        aria: { decorative: true },
      },
      ...trail.points.map((point, index) => ({
        type: 'point',
        key: trailDotKey('Avalon', index),
        cx: point.x,
        cy: point.y,
        r: TRAIL_STYLE.dotRadius,
        fill: color,
        fillOpacity: TRAIL_STYLE.opacity,
        stroke: 'none',
        strokeWidth: 0,
        data: {},
        aria: { decorative: true },
      })),
    ]);
    expect(trail.points).toHaveLength(playback.periods.length);
    const line = trailMarks[0] as LineMark;
    expect(line.points.at(-1)).toEqual({ x: bubble.cx, y: bubble.cy });
    // Trails paint before every data mark.
    const firstDataMark = layout.marks.findIndex((mark) => !isTrailMark(mark));
    expect(layout.marks.slice(0, firstDataMark)).toEqual(trailMarks);
  });

  it('stops the trail at the period playbackT names', () => {
    const layout = compileChart(spec, { ...compileOptions, playbackT: 1 });
    const line = layout.marks.find(isTrailMark) as LineMark;
    const bubble = dataPoint(layout.marks, 'Avalon');
    expect(line.points).toHaveLength(2 + 1);
    expect(line.points.at(-1)).toEqual({ x: bubble.cx, y: bubble.cy });
  });

  it('gives trail marks no tooltips', () => {
    const layout = compileChart(spec, compileOptions);
    const trailIds = layout.marks
      .map((mark, index) => (isTrailMark(mark) ? `${mark.type}-${index}` : null))
      .filter((id): id is string => id !== null);
    expect(trailIds.filter((id) => layout.tooltipDescriptors.has(id))).toEqual([]);
    const bubbleIndex = layout.marks.indexOf(dataPoint(layout.marks, 'Avalon'));
    expect(layout.tooltipDescriptors.has(`point-${bubbleIndex}`)).toBe(true);
  });

  it('draws no trail marks without playback.trails', () => {
    const layout = compileChart(bubbleSpec(), compileOptions);
    expect(layout.marks.filter(isTrailMark)).toEqual([]);
  });
});
