import type { RectMark } from '@opendata-ai/core';
import { describe, expect, it } from 'vitest';
import { computeBarLabels } from '../labels';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chartArea = { x: 0, y: 0, width: 400, height: 300 };

function makeMark(index: number, value: number): RectMark {
  return {
    type: 'rect',
    x: 0,
    y: index * 30,
    width: Math.abs(value) * 5,
    height: 25,
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

describe('computeBarLabels density modes', () => {
  it('density "auto" runs collision detection and produces labels', () => {
    const labels = computeBarLabels(marks, chartArea, 'auto');
    expect(labels.length).toBeGreaterThan(0);
    // Some labels may be hidden by collision detection
    expect(labels.every((l) => typeof l.visible === 'boolean')).toBe(true);
  });

  it('density "all" shows every label as visible', () => {
    const labels = computeBarLabels(marks, chartArea, 'all');
    expect(labels).toHaveLength(marks.length);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });

  it('density "none" returns empty array', () => {
    const labels = computeBarLabels(marks, chartArea, 'none');
    expect(labels).toHaveLength(0);
  });

  it('density "endpoints" returns only first and last labels', () => {
    const labels = computeBarLabels(marks, chartArea, 'endpoints');
    expect(labels).toHaveLength(2);
    // First label should contain the first mark's value
    expect(labels[0].text).toBe('10');
    // Last label should contain the last mark's value
    expect(labels[1].text).toBe('50');
  });

  it('density "endpoints" with single mark returns that mark', () => {
    const labels = computeBarLabels([marks[0]], chartArea, 'endpoints');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('10');
  });

  it('default density is "auto"', () => {
    const withAuto = computeBarLabels(marks, chartArea, 'auto');
    const withDefault = computeBarLabels(marks, chartArea);
    expect(withDefault.length).toBe(withAuto.length);
  });
});
