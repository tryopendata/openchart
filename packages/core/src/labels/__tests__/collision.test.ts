import { describe, expect, it } from 'vitest';
import type { ResolvedLabel, TextStyle } from '../../types/layout';
import {
  computeLabelBounds,
  detectCollision,
  EXTENDED_OFFSET_STRATEGIES,
  type LabelCandidate,
  OFFSET_STRATEGIES,
  resolveCollisions,
} from '../collision';

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

  it('accepts custom strategies without breaking default behavior', () => {
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

    // Explicit default strategies should behave the same as no parameter
    const defaultResults = resolveCollisions(labels);
    const explicitResults = resolveCollisions(labels, OFFSET_STRATEGIES);
    expect(explicitResults).toEqual(defaultResults);
  });

  it('resolves more dense labels with extended strategies than default', () => {
    // 10 labels at the exact same position, simulating many converging line endpoints.
    // The default 7 strategies can place at most 7; extended strategies should place more.
    const labels: LabelCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      text: `Series ${i}`,
      anchorX: 400,
      anchorY: 200,
      width: 60,
      height: 14,
      priority: 'data' as const,
      style: defaultStyle,
    }));

    const defaultResults = resolveCollisions(labels);
    const extendedResults = resolveCollisions(labels, EXTENDED_OFFSET_STRATEGIES);

    const defaultVisible = defaultResults.filter((r) => r.visible).length;
    const extendedVisible = extendedResults.filter((r) => r.visible).length;

    // Default has 7 strategies, so at most 7 can be placed
    expect(defaultVisible).toBeLessThanOrEqual(OFFSET_STRATEGIES.length);
    // Extended strategies should place more labels than default
    expect(extendedVisible).toBeGreaterThan(defaultVisible);
  });

  it('EXTENDED_OFFSET_STRATEGIES includes all base strategies', () => {
    for (const strategy of OFFSET_STRATEGIES) {
      expect(EXTENDED_OFFSET_STRATEGIES).toContainEqual(strategy);
    }
    expect(EXTENDED_OFFSET_STRATEGIES.length).toBeGreaterThan(OFFSET_STRATEGIES.length);
  });
});

describe('computeLabelBounds', () => {
  it('covers the glyph box for an alphabetic-baseline label (y is the baseline)', () => {
    // Column value labels emit y on the alphabetic baseline (top + 0.8*fontSize).
    // The bounds must cover the glyphs above the baseline, not sit below them.
    const fontSize = 10;
    const glyphTop = 100; // where the text visually starts
    const label: ResolvedLabel = {
      text: '42',
      x: 50,
      // Emission shifts the top-space y down to the baseline.
      y: glyphTop + fontSize * 0.8,
      style: { ...defaultStyle, fontSize, textAnchor: 'middle' },
      visible: true,
    };
    const bounds = computeLabelBounds(label);
    // Top edge returns to the glyph top, not the baseline.
    expect(bounds.y).toBeCloseTo(glyphTop, 5);
    // The glyph box (from its top for `height`) contains the baseline.
    expect(bounds.y).toBeLessThan(label.y);
    expect(bounds.y + bounds.height).toBeGreaterThan(label.y);
  });

  it("treats y as the vertical center for dominant-baseline 'central'", () => {
    const fontSize = 10;
    const label: ResolvedLabel = {
      text: '42',
      x: 50,
      y: 100,
      style: { ...defaultStyle, fontSize, dominantBaseline: 'central' },
      visible: true,
    };
    const bounds = computeLabelBounds(label);
    expect(bounds.y).toBeCloseTo(100 - bounds.height / 2, 5);
  });

  it("treats y as the top edge for dominant-baseline 'hanging'", () => {
    const label: ResolvedLabel = {
      text: '42',
      x: 50,
      y: 100,
      style: { ...defaultStyle, dominantBaseline: 'hanging' },
      visible: true,
    };
    expect(computeLabelBounds(label).y).toBe(100);
  });
});
