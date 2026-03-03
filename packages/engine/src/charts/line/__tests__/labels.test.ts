import type { LayoutStrategy, LineMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeLineLabels } from '../labels';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

const compactStrategy: LayoutStrategy = {
  labelMode: 'none',
  legendPosition: 'top',
  annotationPosition: 'tooltip-only',
  axisLabelDensity: 'minimal',
};

function makeLine(series: string, color: string, yOffset: number): LineMark {
  return {
    type: 'line',
    points: [
      { x: 50, y: 100 + yOffset },
      { x: 150, y: 80 + yOffset },
      { x: 250, y: 120 + yOffset },
      { x: 350, y: 60 + yOffset },
    ],
    stroke: color,
    strokeWidth: 2,
    seriesKey: series,
    data: [],
    aria: { label: `${series} trend line` },
  };
}

const marks: LineMark[] = [
  makeLine('US', '#4e79a7', 0),
  makeLine('UK', '#f28e2c', 30),
  makeLine('Canada', '#e15759', 60),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeLineLabels density modes', () => {
  it('density "auto" produces labels with collision detection', () => {
    const labelMap = computeLineLabels(marks, fullStrategy, 'auto');
    expect(labelMap.size).toBeGreaterThan(0);
    // Each label should have a visibility flag
    for (const label of labelMap.values()) {
      expect(typeof label.visible).toBe('boolean');
    }
  });

  it('density "all" shows every series label as visible', () => {
    const labelMap = computeLineLabels(marks, fullStrategy, 'all');
    expect(labelMap.size).toBe(3);
    expect(labelMap.has('US')).toBe(true);
    expect(labelMap.has('UK')).toBe(true);
    expect(labelMap.has('Canada')).toBe(true);
    for (const label of labelMap.values()) {
      expect(label.visible).toBe(true);
    }
  });

  it('density "none" returns empty map', () => {
    const labelMap = computeLineLabels(marks, fullStrategy, 'none');
    expect(labelMap.size).toBe(0);
  });

  it('density "endpoints" works like auto for line charts', () => {
    const autoMap = computeLineLabels(marks, fullStrategy, 'auto');
    const endpointsMap = computeLineLabels(marks, fullStrategy, 'endpoints');
    // Line labels are already endpoint labels (end-of-line), so same behavior
    expect(endpointsMap.size).toBe(autoMap.size);
  });

  it('compact strategy suppresses labels regardless of density', () => {
    const labelMap = computeLineLabels(marks, compactStrategy, 'all');
    expect(labelMap.size).toBe(0);
  });

  it('default density is "auto"', () => {
    const withAuto = computeLineLabels(marks, fullStrategy, 'auto');
    const withDefault = computeLineLabels(marks, fullStrategy);
    expect(withDefault.size).toBe(withAuto.size);
  });
});
