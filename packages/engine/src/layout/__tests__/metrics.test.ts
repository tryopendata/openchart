import type { Metric } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import {
  computeMetricBar,
  METRIC_BAR_INTERNALS,
  type MetricFontSizes,
  metricBarHeight,
} from '../metrics';

const { TOP_GAP, BOTTOM_GAP, INTER_ROW_GAP, LABEL_LINE_HEIGHT_RATIO, VALUE_LINE_HEIGHT_RATIO } =
  METRIC_BAR_INTERNALS;

const defaultFonts: MetricFontSizes = { label: 10, value: 22 };
const largeFonts: MetricFontSizes = { label: 16, value: 32 };

const metrics: Metric[] = [
  { label: 'Revenue', value: '$1.2B', delta: '+12%', deltaTone: 'up' },
  { label: 'Users', value: '4.5M' },
];

const area = { x: 20, width: 600 };

describe('metricBarHeight', () => {
  it('returns the expected height at default font sizes', () => {
    const expected =
      TOP_GAP +
      defaultFonts.label * LABEL_LINE_HEIGHT_RATIO +
      INTER_ROW_GAP +
      defaultFonts.value * VALUE_LINE_HEIGHT_RATIO +
      BOTTOM_GAP;
    expect(metricBarHeight()).toBe(expected);
    expect(metricBarHeight(defaultFonts)).toBe(expected);
  });

  it('grows when font sizes increase', () => {
    const large = metricBarHeight(largeFonts);
    expect(large).toBeGreaterThan(metricBarHeight(defaultFonts));
  });

  it('matches the formula for custom sizes', () => {
    const expected =
      TOP_GAP +
      largeFonts.label * LABEL_LINE_HEIGHT_RATIO +
      INTER_ROW_GAP +
      largeFonts.value * VALUE_LINE_HEIGHT_RATIO +
      BOTTOM_GAP;
    expect(metricBarHeight(largeFonts)).toBe(expected);
  });
});

describe('computeMetricBar', () => {
  it('uses custom font sizes for layout positions', () => {
    const topY = 50;
    const defaultBar = computeMetricBar(metrics, topY, area, 400, undefined, defaultFonts)!;
    const largeBar = computeMetricBar(metrics, topY, area, 400, undefined, largeFonts)!;

    expect(defaultBar).toBeDefined();
    expect(largeBar).toBeDefined();

    expect(largeBar.height).toBeGreaterThan(defaultBar.height);
    expect(largeBar.height).toBe(metricBarHeight(largeFonts));

    expect(largeBar.cells[0].labelY).toBeGreaterThan(defaultBar.cells[0].labelY);
    expect(largeBar.cells[0].valueY).toBeGreaterThan(defaultBar.cells[0].valueY);
  });

  it('computes labelY and valueY from font sizes', () => {
    const topY = 50;
    const bar = computeMetricBar(metrics, topY, area, 400, undefined, largeFonts)!;

    expect(bar.cells[0].labelY).toBe(topY + TOP_GAP + largeFonts.label);
    expect(bar.cells[0].valueY).toBe(
      topY +
        TOP_GAP +
        largeFonts.label * LABEL_LINE_HEIGHT_RATIO +
        INTER_ROW_GAP +
        largeFonts.value,
    );
  });

  it('uses custom font size for overflow detection', () => {
    const tinyCell: Metric[] = [{ label: 'A', value: 'WWWWWWWWWWWWWWWWWWWWWWWWWW' }];
    const narrowArea = { x: 0, width: 500 };

    const withSmall = computeMetricBar(tinyCell, 0, narrowArea, 400, undefined, {
      label: 10,
      value: 12,
    });
    const withLarge = computeMetricBar(tinyCell, 0, narrowArea, 400, undefined, {
      label: 10,
      value: 40,
    });

    expect(withSmall).toBeDefined();
    expect(withLarge).toBeUndefined();
  });
});
