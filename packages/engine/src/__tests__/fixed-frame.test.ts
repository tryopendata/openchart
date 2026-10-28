import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';

const domain = ['2026-10-08', '2026-11-01'];
const frame = { left: 48, right: 96 };
const data = ['2026-10-12', '2026-10-19', '2026-10-26'].flatMap((week) => [
  { week, preset: 'First', count: 40, rate: 0.8 },
  { week, preset: 'Second', count: 25, rate: 0.6 },
]);
const encoding = {
  x: { field: 'week', type: 'temporal', scale: { domain } },
  color: { field: 'preset', type: 'nominal' },
} as const;
const weekly: ChartSpec = {
  mark: 'bar',
  endpointLabels: { show: true, content: 'label' },
  data,
  frame,
  encoding: { ...encoding, y: { field: 'count', type: 'quantitative' } },
  annotations: [{ type: 'refline', x: '2026-10-20', label: 'Release' }],
};
const history: LayerSpec = {
  data,
  frame,
  encoding,
  layer: [
    { mark: 'area', encoding: { y: { field: 'rate', type: 'quantitative', stack: null } } },
    { mark: 'line', encoding: { y: { field: 'rate', type: 'quantitative' } } },
  ],
  annotations: [
    { type: 'refline', x: '2026-10-20', label: 'Release' },
    { type: 'refline', y: 0.7, label: 'Target', labelPlacement: 'outside' },
  ],
};

describe('authored fixed gutters', () => {
  for (const fontSize of [12, 14])
    for (const width of [330, 360, 680])
      it(`aligns weekly columns and history at ${width}px / ${fontSize}px ticks`, () => {
        const options = {
          width,
          height: 360,
          theme: { fonts: { sizes: { axisTick: fontSize } } },
          onWarn() {},
        };
        const a = compileLayer(history, options),
          b = compileChart(weekly, options);
        expect(a.area.x).toBe(frame.left);
        expect(b.area.x).toBe(frame.left);
        expect(a.area.width).toBe(width - frame.left - frame.right);
        expect(b.area.width).toBe(a.area.width);
        if ((a.endpointLabels?.entries.length ?? 0) > 0) {
          const target = a.annotations.find(
            (annotation) => annotation.line?.start.y === annotation.line?.end.y,
          );
          expect(target?.bounds).toBeDefined();
          expect(target!.bounds!.x + target!.bounds!.width).toBeLessThanOrEqual(
            a.area.x + a.area.width + 0.001,
          );
        }
        expect(
          a.annotations.find(
            (annotation) => annotation.line && annotation.line.start.x === annotation.line.end.x,
          )?.line?.start.x,
        ).toBeCloseTo(b.annotations[0].line!.start.x, 3);
      });

  for (const fontSize of [12, 14])
    for (const width of [330, 360, 680])
      it(`shortens gutter labels once at ${width}px / ${fontSize}px ticks`, () => {
        const warnings: string[] = [];
        const spec: ChartSpec = {
          mark: 'bar',
          frame: { left: 36, right: 20 },
          data: [
            { category: 'An exceptionally long category label', value: 1 },
            { category: 'Another long category label', value: 2 },
          ],
          encoding: {
            y: { field: 'category', type: 'nominal' },
            x: { field: 'value', type: 'quantitative' },
          },
        };
        const layout = compileChart(spec, {
          width,
          height: 360,
          theme: { fonts: { sizes: { axisTick: fontSize } } },
          onWarn: (message) => warnings.push(message),
        });
        expect(layout.area.x).toBe(36);
        expect(layout.area.width).toBe(width - 56);
        expect(
          layout.axes.y?.ticks.every(
            (tick) => tick.label.endsWith('…') && tick.fullLabel?.includes('long'),
          ),
        ).toBe(true);
        expect(warnings.filter((warning) => warning.includes('shortened'))).toHaveLength(1);
      });

  it('demotes even explicit highlighted endpoints when the fixed gutter cannot fit them', () => {
    const spec: ChartSpec = {
      mark: 'line',
      data,
      frame: { left: 48, right: 12 },
      encoding: { ...encoding, y: { field: 'rate', type: 'quantitative' } },
      endpointLabels: true,
      highlight: ['First'],
    };
    const layout = compileChart(spec, { width: 680, height: 360 });
    expect(layout.area.x).toBe(48);
    expect(layout.area.width).toBe(620);
    expect(layout.endpointLabels?.entries ?? []).toHaveLength(0);
    expect(layout.legend.type).toBe('categorical');
    if (layout.legend.type === 'categorical')
      expect(layout.legend.entries.length).toBeGreaterThan(0);
  });

  it('falls back from an outside reference lane instead of growing the fixed gutter', () => {
    const warnings: string[] = [];
    const layout = compileChart(
      {
        ...weekly,
        frame: { left: 48, right: 12 },
        annotations: [
          { type: 'refline', y: 30, label: 'A long reference label', labelPlacement: 'outside' },
        ],
      },
      { width: 680, height: 360, onWarn: (message) => warnings.push(message) },
    );
    expect(layout.area.width).toBe(620);
    expect(layout.annotations[0].label?.x).toBeLessThanOrEqual(layout.area.x + layout.area.width);
    expect(warnings.some((warning) => warning.includes('Outside reference labels'))).toBe(true);
  });

  it('shortens shared layer labels with one figure warning', () => {
    const warnings: string[] = [];
    const data = [
      { category: 'An exceptionally long category label', value: 1 },
      { category: 'Another long category label', value: 2 },
    ];
    const layout = compileLayer(
      {
        data,
        frame: { left: 30, right: 20 },
        encoding: {
          y: { field: 'category', type: 'nominal' },
          x: { field: 'value', type: 'quantitative' },
        },
        layer: [{ mark: 'bar' }, { mark: 'point' }],
      },
      { width: 330, height: 360, onWarn: (warning) => warnings.push(warning) },
    );
    expect(layout.area.x).toBe(30);
    expect(layout.axes.y?.ticks.every((tick) => tick.label.endsWith('…'))).toBe(true);
    expect(warnings.filter((warning) => warning.includes('shortened'))).toHaveLength(1);
  });

  it.each([96, 150])('keeps overcommitted frame geometry finite with right=%s', (right) => {
    const layout = compileLayer(
      { ...history, frame: { left: 48, right } },
      { width: 100, height: 360, onWarn() {} },
    );
    expect(layout.area.x).toBe(48);
    expect(layout.area.width).toBe(0);
    for (const mark of layout.marks)
      for (const [key, value] of Object.entries(mark)) {
        if (typeof value === 'number') expect(Number.isFinite(value), key).toBe(true);
      }
  });

  it('honors fixed gutters in sparkline mode too', () => {
    const layout = compileChart(
      { ...weekly, display: 'sparkline', frame: { left: 20, right: 30 } },
      { width: 330, height: 80 },
    );
    expect(layout.area.x).toBe(20);
    expect(layout.area.width).toBe(280);
  });

  it('leaves omitted frame and empty frame identical', () => {
    const { frame: _, ...without } = weekly;
    expect(compileChart(without, { width: 680, height: 360 })).toEqual(
      compileChart({ ...without, frame: {} }, { width: 680, height: 360 }),
    );
  });
  it.each([-1, Infinity, NaN, '48'])('rejects an invalid gutter %s', (left) => {
    expect(() => compileChart({ ...weekly, frame: { left } }, { width: 680, height: 360 })).toThrow(
      /Frame gutters/,
    );
  });
});
