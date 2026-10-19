import type { DesignDiagnostic } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

const columns = {
  mark: 'bar',
  data: [
    { name: 'A very long category label that rotates', value: 20 },
    { name: 'Another very long category label that rotates', value: -5 },
  ],
  encoding: { x: { field: 'name', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } },
};

describe('value-label capacity uses the actual measured figure frame', () => {
  for (const width of [330, 390]) {
    for (const height of [250, 300]) {
      it(`suppresses outside labels before reserving an unusable plot at ${width}x${height}`, () => {
        const diagnostics: DesignDiagnostic[] = [];
        const base = compileChart({ ...columns, labels: { fontSize: 32 } }, { width, height });
        const next = compileChart(
          { ...columns, labels: { fontSize: 32, placement: 'outside' } },
          { width, height, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) },
        );
        expect(next.area).toEqual(base.area);
        expect(next.marks.every((mark) => mark.type !== 'rect' || !mark.label)).toBe(true);
        expect(
          diagnostics.some(
            (diagnostic) =>
              diagnostic.code === 'layout.value-labels.labels-suppressed' &&
              diagnostic.path === '/labels/placement',
          ),
        ).toBe(true);
      });
    }
  }
  it('retains outside labels when the complete frame has at least the minimum usable plot', () => {
    const layout = compileChart(
      { ...columns, labels: { fontSize: 32, placement: 'outside' } },
      { width: 390, height: 500 },
    );
    expect(layout.area.height).toBeGreaterThanOrEqual(60);
    expect(layout.marks.some((mark) => mark.type === 'rect' && mark.label?.visible)).toBe(true);
  });
});

it('includes authored header and chrome bands in outside-label capacity', () => {
  const spec = {
    ...columns,
    chromeLayout: 'subtract' as const,
    chrome: {
      title: 'A fixed-height figure with a measured header',
      subtitle: 'The title, subtitle and footer keep their reservations',
      source: 'Illustrative data',
    },
    encoding: {
      ...columns.encoding,
      y: {
        ...columns.encoding.y,
        axis: { title: 'Measured units', titleAngle: 0, titleAnchor: 'end' },
      },
    },
  };
  const diagnostics: DesignDiagnostic[] = [];
  const base = compileChart({ ...spec, labels: { fontSize: 32 } }, { width: 390, height: 400 });
  const layout = compileChart(
    { ...spec, labels: { placement: 'outside', fontSize: 32 } },
    { width: 390, height: 400, onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) },
  );
  expect(layout.area).toEqual(base.area);
  expect(layout.marks.every((mark) => mark.type !== 'rect' || !mark.label)).toBe(true);
  expect(
    diagnostics.some((diagnostic) => diagnostic.code === 'layout.value-labels.labels-suppressed'),
  ).toBe(true);
});

it.each([
  400, 440, 480, 520, 560, 600,
])('faceted outside labels retain the minimum plot after each measured header at %ipx', (height) => {
  const layout = compileChart(
    {
      ...columns,
      height,
      data: columns.data.flatMap((row) => [
        { ...row, region: 'North' },
        { ...row, region: 'South' },
      ]),
      encoding: {
        ...columns.encoding,
        row: { field: 'region', type: 'nominal' },
        y: {
          ...columns.encoding.y,
          axis: { title: 'Measured units', titleAngle: 0, titleAnchor: 'end' },
        },
      },
      labels: { placement: 'outside', fontSize: 32 },
    },
    { width: 390, height },
  );
  for (const panel of layout.facet!.panels) {
    if (panel.marks.some((mark) => mark.type === 'rect' && mark.label))
      expect(panel.area.height).toBeGreaterThanOrEqual(60);
  }
});
