import type { ArcMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computePieLabels } from '../labels';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const chartArea = { x: 0, y: 0, width: 400, height: 400 };
const center = { x: 200, y: 200 };
const outerRadius = 150;

function makeArc(category: string, value: number, startAngle: number, endAngle: number): ArcMark {
  const midAngle = (startAngle + endAngle) / 2;
  const centroidRadius = outerRadius * 0.6;
  return {
    type: 'arc',
    path: '', // SVG path not needed for label computation
    centroid: {
      x: center.x + Math.sin(midAngle) * centroidRadius,
      y: center.y - Math.cos(midAngle) * centroidRadius,
    },
    center,
    innerRadius: 0,
    outerRadius,
    startAngle,
    endAngle,
    fill: '#4e79a7',
    stroke: '#ffffff',
    strokeWidth: 2,
    data: { category, value },
    aria: { label: `${category}: ${value} (${Math.round(value)}%)` },
  };
}

// Three slices: top-right, bottom-right, left
const marks: ArcMark[] = [
  makeArc('Alpha', 50, 0, Math.PI * 0.8),
  makeArc('Beta', 30, Math.PI * 0.8, Math.PI * 1.4),
  makeArc('Gamma', 20, Math.PI * 1.4, Math.PI * 2),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computePieLabels density modes', () => {
  it('density "auto" runs collision detection and produces labels', () => {
    const labels = computePieLabels(marks, chartArea, 'auto');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => typeof l.visible === 'boolean')).toBe(true);
  });

  it('density "all" shows every label as visible', () => {
    const labels = computePieLabels(marks, chartArea, 'all');
    expect(labels).toHaveLength(marks.length);
    expect(labels.every((l) => l.visible === true)).toBe(true);
  });

  it('density "none" returns empty array', () => {
    const labels = computePieLabels(marks, chartArea, 'none');
    expect(labels).toHaveLength(0);
  });

  it('density "endpoints" returns only first and last labels', () => {
    const labels = computePieLabels(marks, chartArea, 'endpoints');
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('Alpha');
    expect(labels[1].text).toBe('Gamma');
  });

  it('density "endpoints" with single mark returns that mark', () => {
    const labels = computePieLabels([marks[0]], chartArea, 'endpoints');
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('Alpha');
  });

  it('default density is "auto"', () => {
    const withAuto = computePieLabels(marks, chartArea, 'auto');
    const withDefault = computePieLabels(marks, chartArea);
    expect(withDefault.length).toBe(withAuto.length);
  });

  it('returns empty for empty marks array', () => {
    const labels = computePieLabels([], chartArea, 'all');
    expect(labels).toHaveLength(0);
  });
});

describe('computePieLabels positioning', () => {
  it('labels use category name (not value) as text', () => {
    const labels = computePieLabels(marks, chartArea, 'all');
    expect(labels[0].text).toBe('Alpha');
    expect(labels[1].text).toBe('Beta');
    expect(labels[2].text).toBe('Gamma');
  });

  it('labels are positioned outside the outer radius', () => {
    const labels = computePieLabels(marks, chartArea, 'all');
    for (const label of labels) {
      const dx = label.x - center.x;
      const dy = label.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Label should be at least at the outer radius distance from center
      // (accounting for text width offset, the anchor point may vary)
      expect(dist).toBeGreaterThan(outerRadius * 0.5);
    }
  });

  it('visible labels have connector lines to centroid', () => {
    const labels = computePieLabels(marks, chartArea, 'all');
    const visibleLabels = labels.filter((l) => l.visible);
    for (const label of visibleLabels) {
      expect(label.connector).toBeDefined();
      expect(label.connector!.from).toEqual({ x: label.x, y: label.y });
      expect(label.connector!.to).toBeDefined();
      expect(label.connector!.stroke).toBeDefined();
    }
  });

  it('right-side labels use "start" text anchor', () => {
    // First mark (0 to 0.8*PI) has midAngle ~0.4*PI, sin > 0 => right side
    const labels = computePieLabels([marks[0]], chartArea, 'all');
    expect(labels[0].style.textAnchor).toBe('start');
  });

  it('left-side labels use "end" text anchor', () => {
    // Third mark (1.4*PI to 2*PI) has midAngle ~1.7*PI, sin(1.7*PI) < 0 => left side
    const labels = computePieLabels([marks[2]], chartArea, 'all');
    expect(labels[0].style.textAnchor).toBe('end');
  });
});
