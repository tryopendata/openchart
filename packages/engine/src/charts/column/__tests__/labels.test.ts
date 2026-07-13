import type { RectMark } from '@opendata-ai/openchart-core';
import { buildD3Formatter } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeColumnLabels } from '../labels';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chartArea = { x: 0, y: 0, width: 400, height: 300 };

function makeMark(index: number, value: number): RectMark {
  const height = Math.abs(value) * 5;
  const y = value >= 0 ? 300 - height : 300;
  return {
    type: 'rect',
    x: index * 80,
    y,
    width: 60,
    height,
    fill: '#4e79a7',
    data: { category: `Cat${index}`, value },
    aria: { label: `Cat${index}: ${value}` },
  };
}

const marks: RectMark[] = [
  makeMark(0, 10),
  makeMark(1, 20),
  makeMark(2, 30),
  makeMark(3, 40),
  makeMark(4, 50),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeColumnLabels density modes', () => {
  it('density "auto" runs collision detection and produces labels', () => {
    const labels = computeColumnLabels(marks, chartArea, 'auto');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => typeof l.visible === 'boolean')).toBe(true);
  });

  it('density "all" shows every label as visible', () => {
    const labels = computeColumnLabels(marks, chartArea, 'all');
    expect(labels).toHaveLength(marks.length);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });

  it('density "none" returns empty array', () => {
    const labels = computeColumnLabels(marks, chartArea, 'none');
    expect(labels).toHaveLength(0);
  });

  it('density "endpoints" returns only first and last labels', () => {
    const labels = computeColumnLabels(marks, chartArea, 'endpoints');
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('10');
    expect(labels[1].text).toBe('50');
  });

  it('density "endpoints" with single mark returns that mark', () => {
    const labels = computeColumnLabels([marks[0]], chartArea, 'endpoints');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('10');
  });

  it('default density is "auto"', () => {
    const withAuto = computeColumnLabels(marks, chartArea, 'auto');
    const withDefault = computeColumnLabels(marks, chartArea);
    expect(withDefault.length).toBe(withAuto.length);
  });
});

describe('computeColumnLabels positioning', () => {
  it('places positive value labels above the column', () => {
    const labels = computeColumnLabels([makeMark(0, 20)], chartArea, 'all');
    expect(labels).toHaveLength(1);
    const mark = makeMark(0, 20);
    // Label y should be above the column top
    expect(labels[0].y).toBeLessThan(mark.y);
  });

  it('places negative value labels below the column', () => {
    const negativeMark = makeMark(0, -15);
    const labels = computeColumnLabels([negativeMark], chartArea, 'all');
    expect(labels).toHaveLength(1);
    // Label y should be below the column bottom
    expect(labels[0].y).toBeGreaterThan(negativeMark.y + negativeMark.height);
  });

  it('centers labels horizontally on the column', () => {
    const labels = computeColumnLabels([makeMark(0, 20)], chartArea, 'all');
    const mark = makeMark(0, 20);
    const markCenter = mark.x + mark.width / 2;
    expect(labels[0].x).toBe(markCenter);
  });

  it('applies labelFormat to numeric values', () => {
    const labels = computeColumnLabels(
      [makeMark(0, 1234)],
      chartArea,
      'all',
      buildD3Formatter(',.0f'),
    );
    expect(labels[0].text).toBe('1,234');
  });
});

describe('computeColumnLabels stacked segments', () => {
  /** One segment of a stacked column, positioned by its top edge. */
  function makeStackedMark(y: number, height: number, fill: string, value: number): RectMark {
    return {
      type: 'rect',
      x: 0,
      y,
      width: 60,
      height,
      fill,
      stackGroup: 'Cat0',
      data: { category: 'Cat0', value },
      aria: { label: `Cat0: ${value}` },
    };
  }

  it('centers the label inside its own segment, not above it', () => {
    // Above a stacked segment's top edge is the next segment up, not the
    // background, so the label must stay within its own band.
    const mark = makeStackedMark(100, 80, '#0e7490', 33);
    const labels = computeColumnLabels([mark], chartArea, 'all');

    expect(labels).toHaveLength(1);
    expect(labels[0].y).toBeGreaterThan(mark.y);
    expect(labels[0].y).toBeLessThan(mark.y + mark.height);
  });

  it('picks a fill that contrasts with its own segment', () => {
    // A dark segment takes white text; a light segment takes near-black. The
    // old code tinted the text with the segment's own series color, which put
    // colored text on a colored fill.
    const dark = computeColumnLabels([makeStackedMark(100, 80, '#0e7490', 33)], chartArea, 'all');
    const light = computeColumnLabels([makeStackedMark(100, 80, '#e2e8f0', 33)], chartArea, 'all');

    expect(dark[0].style.fill).toBe('#ffffff');
    expect(light[0].style.fill).toBe('#111111');
  });

  it('hides the label when the segment is too short to hold it', () => {
    // A ~4% segment (Nuclear in the energy-mix demo) can't fit a 10px label
    // without spilling into its neighbours.
    const labels = computeColumnLabels([makeStackedMark(100, 6, '#0e7490', 4)], chartArea, 'all');

    expect(labels).toHaveLength(1);
    expect(labels[0].visible).toBe(false);
  });

  it('an explicit labels.color still wins over the contrast pick', () => {
    const labels = computeColumnLabels(
      [makeStackedMark(100, 80, '#0e7490', 33)],
      chartArea,
      'all',
      undefined,
      undefined,
      undefined,
      '#ff00ff',
    );

    expect(labels[0].style.fill).toBe('#ff00ff');
  });

  it('leaves unstacked columns labeling above the bar', () => {
    const mark = makeMark(0, 20);
    const labels = computeColumnLabels([mark], chartArea, 'all');

    expect(labels[0].y).toBeLessThan(mark.y);
  });
});
