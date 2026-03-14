import type { RectMark } from '@opendata-ai/openchart-core';
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
    const labels = computeColumnLabels([makeMark(0, 1234)], chartArea, 'all', ',.0f');
    expect(labels[0].text).toBe('1,234');
  });
});
