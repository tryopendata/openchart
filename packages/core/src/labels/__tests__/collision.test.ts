import { describe, expect, it } from 'vitest';
import type { TextStyle } from '../../types/layout';
import type { LabelCandidate } from '../collision';
import { detectCollision, resolveCollisions } from '../collision';

const defaultStyle: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 12,
  fontWeight: 400,
  fill: '#333',
  lineHeight: 1.3,
};

describe('detectCollision', () => {
  it('detects overlapping rectangles', () => {
    expect(
      detectCollision(
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 50, y: 25, width: 100, height: 50 },
      ),
    ).toBe(true);
  });

  it('returns false for non-overlapping rectangles', () => {
    expect(
      detectCollision(
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 100, width: 50, height: 50 },
      ),
    ).toBe(false);
  });

  it('returns false for adjacent rectangles (no overlap)', () => {
    expect(
      detectCollision(
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 50, y: 0, width: 50, height: 50 },
      ),
    ).toBe(false);
  });

  it('detects containment (one inside the other)', () => {
    expect(
      detectCollision(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 25, y: 25, width: 50, height: 50 },
      ),
    ).toBe(true);
  });
});

describe('resolveCollisions', () => {
  it('places non-overlapping labels at their anchors', () => {
    const labels: LabelCandidate[] = [
      {
        text: 'A',
        anchorX: 0,
        anchorY: 0,
        width: 20,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
      {
        text: 'B',
        anchorX: 100,
        anchorY: 100,
        width: 20,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
    ];

    const results = resolveCollisions(labels);
    expect(results).toHaveLength(2);
    expect(results[0].visible).toBe(true);
    expect(results[1].visible).toBe(true);
    expect(results[0].x).toBe(0);
    expect(results[0].y).toBe(0);
    expect(results[1].x).toBe(100);
    expect(results[1].y).toBe(100);
  });

  it('resolves overlapping labels by offsetting', () => {
    const labels: LabelCandidate[] = [
      {
        text: 'A',
        anchorX: 50,
        anchorY: 50,
        width: 40,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
      {
        text: 'B',
        anchorX: 55,
        anchorY: 52,
        width: 40,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
    ];

    const results = resolveCollisions(labels);
    expect(results).toHaveLength(2);
    // First label should be at anchor
    expect(results[0].x).toBe(50);
    // Second label should be offset
    expect(results[1].x !== 55 || results[1].y !== 52).toBe(true);
  });

  it('prioritizes data labels over annotation labels', () => {
    const labels: LabelCandidate[] = [
      {
        text: 'Annotation',
        anchorX: 50,
        anchorY: 50,
        width: 60,
        height: 14,
        priority: 'annotation',
        style: defaultStyle,
      },
      {
        text: 'Data',
        anchorX: 50,
        anchorY: 50,
        width: 40,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
    ];

    const results = resolveCollisions(labels);
    // Data label (higher priority) should get its preferred position
    const dataResult = results.find((r) => r.text === 'Data');
    expect(dataResult!.x).toBe(50);
    expect(dataResult!.y).toBe(50);
    expect(dataResult!.visible).toBe(true);
  });

  it('demotes labels to tooltip-only when no position works', () => {
    // Create many overlapping labels in a tiny area
    const labels: LabelCandidate[] = Array.from({ length: 20 }, (_, i) => ({
      text: `Label ${i}`,
      anchorX: 50,
      anchorY: 50,
      width: 80,
      height: 14,
      priority: 'data' as const,
      style: defaultStyle,
    }));

    const results = resolveCollisions(labels);
    // Some should be demoted to tooltip-only
    const hidden = results.filter((r) => !r.visible);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('adds connector when label is offset from anchor', () => {
    const labels: LabelCandidate[] = [
      {
        text: 'A',
        anchorX: 50,
        anchorY: 50,
        width: 40,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
      {
        text: 'B',
        anchorX: 55,
        anchorY: 52,
        width: 40,
        height: 14,
        priority: 'data',
        style: defaultStyle,
      },
    ];

    const results = resolveCollisions(labels);
    const offsetLabel = results.find((r) => r.connector !== undefined);
    if (offsetLabel) {
      expect(offsetLabel.connector!.to.x).toBe(
        labels.find((l) => l.text === offsetLabel.text)!.anchorX,
      );
    }
  });

  it('handles empty input', () => {
    expect(resolveCollisions([])).toEqual([]);
  });
});
