import type { LayoutStrategy, Mark, Rect } from '@opendata-ai/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { clearRenderers, getChartRenderer, registerChartRenderer } from '../registry';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A minimal renderer that returns a single rect mark.
 * Used to verify the registry lifecycle without needing real chart logic.
 */
function stubRenderer(
  _spec: NormalizedChartSpec,
  _scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
): Mark[] {
  return [
    {
      type: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: '#ff0000',
      data: {},
      aria: { label: 'stub mark' },
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chart renderer registry', () => {
  afterEach(() => {
    clearRenderers();
  });

  it('returns undefined for an unregistered chart type', () => {
    expect(getChartRenderer('nonexistent')).toBeUndefined();
  });

  it('registers and retrieves a renderer by type', () => {
    registerChartRenderer('test-type', stubRenderer);

    const retrieved = getChartRenderer('test-type');
    expect(retrieved).toBe(stubRenderer);
  });

  it('registered renderer produces marks when called', () => {
    registerChartRenderer('test-type', stubRenderer);

    const renderer = getChartRenderer('test-type')!;
    const marks = renderer(
      {} as NormalizedChartSpec,
      {} as ResolvedScales,
      { x: 0, y: 0, width: 600, height: 400 },
      {} as LayoutStrategy,
    );

    expect(marks).toHaveLength(1);
    expect(marks[0].type).toBe('rect');
    if (marks[0].type === 'rect') {
      expect(marks[0].width).toBe(100);
      expect(marks[0].fill).toBe('#ff0000');
    }
  });

  it('overwrites a previously registered renderer for the same type', () => {
    const secondRenderer = () => [] as Mark[];

    registerChartRenderer('test-type', stubRenderer);
    registerChartRenderer('test-type', secondRenderer);

    expect(getChartRenderer('test-type')).toBe(secondRenderer);
  });

  it('clearRenderers removes all registered renderers', () => {
    registerChartRenderer('type-a', stubRenderer);
    registerChartRenderer('type-b', stubRenderer);

    // Both should be registered
    expect(getChartRenderer('type-a')).toBe(stubRenderer);
    expect(getChartRenderer('type-b')).toBe(stubRenderer);

    clearRenderers();

    // Both should be gone
    expect(getChartRenderer('type-a')).toBeUndefined();
    expect(getChartRenderer('type-b')).toBeUndefined();
  });

  it('multiple types can be registered independently', () => {
    const rendererA = () => [] as Mark[];
    const rendererB = () => [] as Mark[];

    registerChartRenderer('type-a', rendererA);
    registerChartRenderer('type-b', rendererB);

    expect(getChartRenderer('type-a')).toBe(rendererA);
    expect(getChartRenderer('type-b')).toBe(rendererB);
    // Unregistered type still returns undefined
    expect(getChartRenderer('type-c')).toBeUndefined();
  });
});
