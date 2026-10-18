import type { LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';

const base = {
  mark: 'line',
  data: [
    { date: '2024-01-01', value: 10 },
    { date: '2024-02-01', value: 30 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Revenue per customer ($)', tickPosition: 'inline' },
    },
  },
  chrome: { title: 'Revenue improved', subtitle: 'Monthly results' },
};
describe('measured y-axis headers', () => {
  it.each([
    390, 1024, 1440,
  ])('reserves a header band without changing the domain at %ipx', (width) => {
    const old = compileChart(base, { width, height: 400 });
    const next = compileChart(
      {
        ...base,
        encoding: {
          ...base.encoding,
          y: {
            ...base.encoding.y,
            axis: { ...base.encoding.y.axis, titleAngle: 0, titleAnchor: 'end' },
          },
        },
      },
      { width, height: 400 },
    );
    expect(next.area.y).toBeGreaterThan(old.area.y);
    expect(next.area.x).toBeLessThan(old.area.x);
    expect(next.axes.y?.titlePosition?.angle).toBe(0);
    expect(next.axes.y?.titlePosition?.y).toBeLessThan(next.area.y);
    expect(next.axes.y?.ticks.map((t) => t.value)).toEqual(old.axes.y?.ticks.map((t) => t.value));
  });
});

it.each([
  { titleAngle: NaN },
  { titleAngle: 'flat' },
  { titleAnchor: 'sideways' },
])('rejects invalid title placement %#', (axis) => {
  expect(() =>
    compileChart(
      {
        ...base,
        encoding: {
          ...base.encoding,
          y: { ...base.encoding.y, axis: { title: 'Revenue', ...axis } },
        },
      },
      { width: 640, height: 400 },
    ),
  ).toThrow('/encoding/y/axis/title');
});

it.each([
  0, 45, 90,
])('reserves authored title angle %i without clipping its measured footprint', (angle) => {
  const layout = compileChart(
    {
      ...base,
      encoding: {
        ...base.encoding,
        y: {
          ...base.encoding.y,
          axis: { title: 'Revenue per customer ($)', titleAngle: angle, titleAnchor: 'middle' },
        },
      },
    },
    { width: 640, height: 400 },
  );
  const pos = layout.axes.y!.titlePosition!;
  expect(pos.angle).toBe(angle);
  expect(pos.x).toBeGreaterThan(0);
  expect(pos.x).toBeLessThan(layout.area.x);
  expect(Number.isFinite(layout.area.width)).toBe(true);
});

it('keeps mixed-unit headers above both axes in a shared dual-axis frame', () => {
  const leaf = (title: string) => ({
    ...base,
    encoding: {
      ...base.encoding,
      y: { ...base.encoding.y, axis: { title, titleAngle: 0, titleAnchor: 'end' } },
    },
  });
  const layout = compileLayer(
    {
      layer: [leaf('Revenue ($)'), leaf('Conversion (%)')],
      resolve: { scale: { y: 'independent' } },
    } as LayerSpec,
    { width: 640, height: 400 },
  );
  expect(layout.axes.y?.titlePosition?.angle).toBe(0);
  expect(layout.axes.y2?.titlePosition?.angle).toBe(0);
  expect(layout.axes.y2?.titlePosition?.textAnchor).toBe('end');
  expect(layout.axes.y2?.titlePosition?.y).toBeLessThan(layout.area.y);
});

it('keeps a large rotated title baseline far enough inside the viewport for its glyph ascent', () => {
  const layout = compileChart(
    { ...base, theme: { fonts: { sizes: { body: 26, axisTick: 24 } } } },
    { width: 390, height: 960 },
  );
  expect(layout.axes.y!.titlePosition!.x).toBeGreaterThanOrEqual(26);
});
