import type { PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeDotLabels } from '../labels';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chartArea = { x: 0, y: 0, width: 400, height: 300 };

function makeMark(index: number, value: number): PointMark {
  return {
    type: 'point',
    cx: value * 5,
    cy: index * 40 + 20,
    r: 6,
    fill: '#4e79a7',
    stroke: '#4e79a7',
    strokeWidth: 1,
    data: { category: `Cat${index}`, value },
    aria: { label: `Cat${index}: ${value}` },
  };
}

const marks: PointMark[] = [
  makeMark(0, 10),
  makeMark(1, 20),
  makeMark(2, 30),
  makeMark(3, 40),
  makeMark(4, 50),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeDotLabels density modes', () => {
  it('density "auto" runs collision detection and produces labels', () => {
    const labels = computeDotLabels(marks, chartArea, 'auto');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => typeof l.visible === 'boolean')).toBe(true);
  });

  it('density "all" shows every label as visible', () => {
    const labels = computeDotLabels(marks, chartArea, 'all');
    expect(labels).toHaveLength(marks.length);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });

  it('density "none" returns empty array', () => {
    const labels = computeDotLabels(marks, chartArea, 'none');
    expect(labels).toHaveLength(0);
  });

  it('density "endpoints" returns only first and last labels', () => {
    const labels = computeDotLabels(marks, chartArea, 'endpoints');
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('10');
    expect(labels[1].text).toBe('50');
  });

  it('density "endpoints" with single mark returns that mark', () => {
    const labels = computeDotLabels([marks[0]], chartArea, 'endpoints');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('10');
  });

  it('default density is "auto"', () => {
    const withAuto = computeDotLabels(marks, chartArea, 'auto');
    const withDefault = computeDotLabels(marks, chartArea);
    expect(withDefault.length).toBe(withAuto.length);
  });
});

describe('computeDotLabels positioning', () => {
  it('places labels to the right of the dot', () => {
    const labels = computeDotLabels([marks[0]], chartArea, 'all');
    expect(labels).toHaveLength(1);
    // Label x should be to the right of the dot center + radius
    expect(labels[0].x).toBeGreaterThan(marks[0].cx + marks[0].r);
  });

  it('vertically centers labels on the dot', () => {
    const labels = computeDotLabels([marks[0]], chartArea, 'all');
    const textHeight = 11 * 1.2; // LABEL_FONT_SIZE * 1.2
    // Label y should be roughly centered on the dot's cy
    expect(labels[0].y).toBeCloseTo(marks[0].cy - textHeight / 2, 0);
  });

  it('returns empty for marks with no parseable value', () => {
    const badMark: PointMark = {
      ...marks[0],
      aria: { label: 'no-colon-here' },
    };
    const labels = computeDotLabels([badMark], chartArea, 'all');
    expect(labels).toHaveLength(0);
  });
});
