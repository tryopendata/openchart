import type { LayoutStrategy, LineMark, PointMark, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeLineMarks } from '../compute';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 50, y: 20, width: 500, height: 300 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

function makeSpec(markDef: NormalizedChartSpec['markDef']): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef,
    data: [
      { date: '2020-01-01', value: 10 },
      { date: '2021-01-01', value: 40 },
      { date: '2022-01-01', value: 30 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
    hiddenSeries: [],
    seriesStyles: {},
  };
}

// ---------------------------------------------------------------------------
// markDef.point controls PointMark emission
// ---------------------------------------------------------------------------

describe('markDef.point controls PointMark emission', () => {
  it('does not emit PointMark when point is undefined (default)', () => {
    const spec = makeSpec({ type: 'line' });
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = marks.filter((m) => m.type === 'line');
    const pointMarks = marks.filter((m) => m.type === 'point');

    expect(lineMarks.length).toBeGreaterThan(0);
    expect(pointMarks.length).toBe(0);
  });

  it('does not emit PointMark when point is false', () => {
    const spec = makeSpec({ type: 'line', point: false });
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const pointMarks = marks.filter((m) => m.type === 'point');
    expect(pointMarks.length).toBe(0);
  });

  it('emits visible PointMark when point is true', () => {
    const spec = makeSpec({ type: 'line', point: true });
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const pointMarks = marks.filter((m) => m.type === 'point') as PointMark[];
    expect(pointMarks.length).toBe(3); // One per data point

    // Points should have a non-zero radius (visible)
    for (const p of pointMarks) {
      expect(p.r).toBeGreaterThan(0);
    }
  });

  it('emits transparent PointMark when point is "transparent"', () => {
    const spec = makeSpec({ type: 'line', point: 'transparent' });
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const pointMarks = marks.filter((m) => m.type === 'point') as PointMark[];
    expect(pointMarks.length).toBe(3);

    // Transparent points have zero radius and zero opacity
    for (const p of pointMarks) {
      expect(p.r).toBe(0);
      expect(p.fillOpacity).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// dataPoints on LineMark
// ---------------------------------------------------------------------------

describe('LineMark.dataPoints', () => {
  it('populates dataPoints with pixel coordinates and original data', () => {
    const spec = makeSpec({ type: 'line' });
    const scales = computeScales(spec, chartArea, spec.data);
    const marks = computeLineMarks(spec, scales, chartArea, fullStrategy);

    const lineMarks = marks.filter((m) => m.type === 'line') as LineMark[];
    expect(lineMarks.length).toBe(1);

    const lineMark = lineMarks[0];
    expect(lineMark.dataPoints).toBeDefined();
    expect(lineMark.dataPoints!.length).toBe(3);

    for (const dp of lineMark.dataPoints!) {
      expect(typeof dp.x).toBe('number');
      expect(typeof dp.y).toBe('number');
      expect(dp.datum).toBeDefined();
      expect(dp.datum.date).toBeDefined();
      expect(dp.datum.value).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// markDef.interpolate affects line path computation
// ---------------------------------------------------------------------------

describe('markDef.interpolate affects line generation', () => {
  it('produces different paths for different interpolation modes', () => {
    const defaultSpec = makeSpec({ type: 'line' });
    const linearSpec = makeSpec({ type: 'line', interpolate: 'linear' });
    const stepSpec = makeSpec({ type: 'line', interpolate: 'step' });

    const defaultScales = computeScales(defaultSpec, chartArea, defaultSpec.data);
    const linearScales = computeScales(linearSpec, chartArea, linearSpec.data);
    const stepScales = computeScales(stepSpec, chartArea, stepSpec.data);

    const defaultMarks = computeLineMarks(defaultSpec, defaultScales, chartArea, fullStrategy);
    const linearMarks = computeLineMarks(linearSpec, linearScales, chartArea, fullStrategy);
    const stepMarks = computeLineMarks(stepSpec, stepScales, chartArea, fullStrategy);

    const defaultLine = defaultMarks.find((m) => m.type === 'line') as LineMark;
    const linearLine = linearMarks.find((m) => m.type === 'line') as LineMark;
    const stepLine = stepMarks.find((m) => m.type === 'line') as LineMark;

    // Default (monotone) and linear should produce different paths
    expect(defaultLine.path).not.toBe(linearLine.path);
    // Linear and step should produce different paths
    expect(linearLine.path).not.toBe(stepLine.path);
    // All paths should be non-empty
    expect(defaultLine.path!.length).toBeGreaterThan(0);
    expect(linearLine.path!.length).toBeGreaterThan(0);
    expect(stepLine.path!.length).toBeGreaterThan(0);
  });

  it('uses monotone interpolation by default', () => {
    const spec = makeSpec({ type: 'line' });
    const monotoneSpec = makeSpec({ type: 'line', interpolate: 'monotone' });

    const scales = computeScales(spec, chartArea, spec.data);
    const monotoneScales = computeScales(monotoneSpec, chartArea, monotoneSpec.data);

    const defaultMarks = computeLineMarks(spec, scales, chartArea, fullStrategy);
    const monotoneMarks = computeLineMarks(monotoneSpec, monotoneScales, chartArea, fullStrategy);

    const defaultLine = defaultMarks.find((m) => m.type === 'line') as LineMark;
    const monotoneLine = monotoneMarks.find((m) => m.type === 'line') as LineMark;

    // Default and explicit monotone should produce the same path
    expect(defaultLine.path).toBe(monotoneLine.path);
  });
});
