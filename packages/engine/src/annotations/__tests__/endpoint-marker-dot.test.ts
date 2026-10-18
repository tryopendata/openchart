import type { ChartSpec, TextAnnotation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

const data = ['2022-01-01', '2023-01-01', '2024-01-01'].flatMap((year, i) => [
  { year, value: 100 + i * 50, series: 'A' },
  { year, value: 80 + i * 10, series: 'B' },
]);

const spec = (annotation: TextAnnotation): ChartSpec => ({
  mark: 'line',
  data,
  encoding: {
    x: { field: 'year', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
  legend: { show: false },
  endpointLabels: { content: 'label', showMarker: true },
  annotations: [annotation],
  animation: false,
});

const callout: TextAnnotation = {
  type: 'text',
  x: '2024-01-01',
  y: 200,
  text: 'A reaches 200',
  anchor: 'left',
  offset: { dx: -12, dy: -24 },
  connector: true,
};

describe('annotation dot on an endpoint marker', () => {
  it('draws as the marker: same center and colors', () => {
    const layout = compileChart(spec(callout), { width: 800, height: 400 });
    const marker = layout.endpointLabels!.entries.find((e) => e.seriesKey === 'A')!.marker!;
    const dot = layout.annotations[0].dot!;
    expect(dot.x).toBeCloseTo(marker.x, 6);
    expect(dot.y).toBeCloseTo(marker.y, 6);
    expect(dot.stroke).toBe(marker.stroke);
    expect(dot.fill).toBe(marker.fill);
  });

  it('keeps an authored dot style', () => {
    const layout = compileChart(spec({ ...callout, dot: { stroke: '#ff0000' } }), {
      width: 800,
      height: 400,
    });
    expect(layout.annotations[0].dot!.stroke).toBe('#ff0000');
  });
});
