import type { AxisLayout, Rect, ResolvedChrome, ResolvedTheme } from '@opendata-ai/openchart-core';
import { BRAND_RESERVE_WIDTH, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { AxesResult } from '../../layout/axes';
import type { LayoutDimensions } from '../../layout/dimensions';
import { computeWatermarkObstacle } from '../watermark-obstacle';

const theme: ResolvedTheme = resolveTheme();

function makeDims(overrides: Partial<LayoutDimensions> = {}): LayoutDimensions {
  const total: Rect = { x: 0, y: 0, width: 800, height: 500 };
  const chartArea: Rect = { x: 60, y: 80, width: 700, height: 360 };
  const chrome: ResolvedChrome = {
    topHeight: 80,
    bottomHeight: 40,
  } as ResolvedChrome;
  return {
    total,
    chartArea,
    chrome,
    margins: { top: 80, right: 40, bottom: 40, left: 60 },
    theme,
    ...overrides,
  };
}

function makeAxis(label?: string): AxisLayout {
  return {
    ticks: [],
    gridlines: [],
    label,
    tickLabelStyle: {
      fontFamily: theme.fonts.family,
      fontSize: 12,
      fontWeight: 400,
      fill: '#000',
      lineHeight: 1.2,
    },
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
  };
}

describe('computeWatermarkObstacle', () => {
  it('returns null when watermark is disabled', () => {
    const dims = makeDims();
    const axes: AxesResult = { x: makeAxis(), y: makeAxis() };
    expect(computeWatermarkObstacle(dims, false, axes, theme)).toBeNull();
  });

  it('sits below the x-axis when no bottom chrome is present', () => {
    const dims = makeDims();
    const axes: AxesResult = { x: makeAxis('value'), y: makeAxis() };
    const rect = computeWatermarkObstacle(dims, true, axes, theme);
    expect(rect).not.toBeNull();
    // Right-aligned: total.width - padding - BRAND_RESERVE_WIDTH
    expect(rect!.x).toBe(dims.total.width - theme.spacing.padding - BRAND_RESERVE_WIDTH);
    expect(rect!.width).toBe(BRAND_RESERVE_WIDTH);
    expect(rect!.height).toBe(30);
    // Watermark sits below chart area, offset by x-axis extent + chartToFooter
    const expectedY = dims.chartArea.y + dims.chartArea.height + 48 + theme.spacing.chartToFooter;
    expect(rect!.y).toBe(expectedY);
  });

  it('aligns with bottom chrome when a source element is present', () => {
    const sourceY = 20;
    const dims = makeDims({
      chrome: {
        topHeight: 80,
        bottomHeight: 40,
        source: {
          text: 'Source: Test',
          x: 10,
          y: sourceY,
          maxWidth: 500,
          style: {
            fontFamily: theme.fonts.family,
            fontSize: 10,
            fontWeight: 400,
            fill: '#666',
            lineHeight: 1.2,
          },
        },
      } as ResolvedChrome,
    });
    const axes: AxesResult = { x: makeAxis(), y: makeAxis() };
    const rect = computeWatermarkObstacle(dims, true, axes, theme);
    expect(rect).not.toBeNull();
    // With axis present but no label, extent is 26.
    // Y is chartArea.y + chartArea.height + 26 + sourceY
    expect(rect!.y).toBe(dims.chartArea.y + dims.chartArea.height + 26 + sourceY);
  });
});
