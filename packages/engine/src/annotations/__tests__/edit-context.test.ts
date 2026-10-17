import type { ChartSpec, TextAnnotation } from '@opendata-ai/openchart-core';
import { elementRef } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { validateSpec } from '../../compiler/validate';
import {
  createAnnotationEditContext,
  inverseLabelPlacement,
  previewAnnotationMove,
  previewConnectorBend,
} from '../edit-context';

export const editSpec: ChartSpec = {
  mark: 'point',
  animation: false,
  autoThin: false,
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  chrome: { title: 'An annotation edit' },
  annotations: [
    {
      type: 'text',
      id: 'callout',
      x: 9.9,
      y: 5,
      text: 'A heading',
      subtitle: 'A wider second line',
      connector: 'curve',
    },
  ],
};
const options = { width: 600, height: 400 };
const ref = elementRef.annotation(0, 'callout');

describe('resolved annotation editing', () => {
  it.each([
    { dx: -10, dy: 10 },
    { dx: -999, dy: -999 },
    { dx: 999, dy: 999 },
  ])('first drag commits the preview including clamp: %j', (delta) => {
    const layout = compileChart(editSpec, options);
    expect(layout.annotations[0].label!.style.textAnchor).toBe('end');
    const before = structuredClone(layout.annotations);
    const ctx = createAnnotationEditContext(layout, editSpec);
    const preview = previewAnnotationMove(ctx, ref, delta);
    const placement = inverseLabelPlacement(ctx, ref, preview.bounds!);
    expect(placement.anchor).not.toBe('auto');
    expect(placement.responsive).toBe(false);
    const nextSpec = { ...editSpec, annotations: [{ ...editSpec.annotations![0], ...placement }] };
    const committed = compileChart(nextSpec, options).annotations[0];
    expect(committed.label!.x).toBeCloseTo(preview.label!.x, 8);
    expect(committed.label!.y).toBeCloseTo(preview.label!.y, 8);
    expect(committed.subtitle!.x).toBeCloseTo(preview.subtitle!.x, 8);
    expect(committed.subtitle!.y).toBeCloseTo(preview.subtitle!.y, 8);
    const round = (value: unknown) =>
      JSON.parse(
        JSON.stringify(value, (_key, item) =>
          typeof item === 'number' ? Math.round(item * 1e8) / 1e8 : item,
        ),
      );
    expect(round(committed.label!.connector)).toEqual(round(preview.label!.connector));
    expect(committed.dot).toEqual(layout.annotations[0].dot);
    expect(layout.annotations).toEqual(before);
  });
  it('keeps the plot and attachment fixed when committing a callout at maximum x', () => {
    const spec = { ...editSpec, annotations: [{ ...editSpec.annotations![0], x: 10 }] };
    const layout = compileChart(spec, options);
    const ctx = createAnnotationEditContext(layout, spec);
    const preview = previewAnnotationMove(ctx, ref, { dx: -60, dy: -30 });
    const placement = inverseLabelPlacement(ctx, ref, preview.bounds!);
    const next = compileChart(
      { ...spec, annotations: [{ ...spec.annotations[0], ...placement }] },
      options,
    );
    expect(next.area).toEqual(layout.area);
    expect(next.annotations[0].label!.x).toBeCloseTo(preview.label!.x, 8);
    expect(next.annotations[0].label!.connector?.endpoint).toEqual(
      preview.label!.connector?.endpoint,
    );
  });
  it('freezes the original layout and source during a gesture', () => {
    const spec = structuredClone(editSpec);
    const layout = compileChart(spec, options);
    const ctx = createAnnotationEditContext(layout, spec);
    const original = previewAnnotationMove(ctx, ref, { dx: 0, dy: 0 });
    layout.annotations[0].label!.x += 100;
    (spec.annotations![0] as TextAnnotation).text = 'mutated';
    expect(previewAnnotationMove(ctx, ref, { dx: 0, dy: 0 })).toEqual(original);
  });
  it('bend preview matches compilation and leaves label and anchor fixed', () => {
    const spec = {
      ...editSpec,
      annotations: [{ ...editSpec.annotations![0], anchor: 'left', offset: { dx: -20, dy: -20 } }],
    } as ChartSpec;
    const layout = compileChart(spec, options);
    const ctx = createAnnotationEditContext(layout, spec);
    const preview = previewConnectorBend(ctx, ref, 0.5);
    const next = compileChart(
      {
        ...spec,
        annotations: [{ ...spec.annotations![0], connector: { type: 'curve', bend: 0.5 } }],
      },
      options,
    );
    expect(preview).toEqual(next.annotations[0]);
    expect(preview.label!.x).toBe(layout.annotations[0].label!.x);
    expect(preview.dot).toEqual(layout.annotations[0].dot);
  });
  it.each([-1.01, 1.01, NaN, Infinity, '0.5'])('rejects invalid bend %s', (bend) => {
    const result = validateSpec({
      ...editSpec,
      annotations: [{ ...editSpec.annotations![0], connector: { type: 'curve', bend } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('bend'))).toBe(true);
  });
  it.each(['straight', 'drop-line'])('warns and ignores bend for %s', (type) => {
    const warnings: string[] = [];
    const annotation = { ...editSpec.annotations![0], connector: { type, bend: 0.5 } };
    const bent = compileChart(
      { ...editSpec, annotations: [annotation] },
      { ...options, onWarn: (warning) => warnings.push(warning) },
    );
    const plain = compileChart(
      { ...editSpec, annotations: [{ ...annotation, connector: { type } }] },
      options,
    );
    expect(bent.annotations).toEqual(plain.annotations);
    expect(warnings.some((w) => w.includes('bend'))).toBe(true);
  });
});
