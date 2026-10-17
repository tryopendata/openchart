import type { ChartSpec, TextAnnotation } from '@opendata-ai/openchart-core';
import { elementRef } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { annotationCrowdedSpec } from '../../../../../examples/src/gallery/features-annotations.demos';
import { compileChart, compileLayer } from '../../compile';
import { validateSpec } from '../../compiler/validate';
import {
  createAnnotationEditContext,
  inverseLabelPlacement,
  previewAnnotationMove,
  previewConnectorBend,
  previewConnectorOffset,
} from '../edit-context';

export const editSpec: ChartSpec = {
  mark: 'point',
  animation: false,
  responsive: { autoThin: false },
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
  it.each([
    ['subtract', -20],
    ['grow', -20],
    ['subtract', 999],
    ['grow', 999],
  ] as const)('keeps a crowded note-bearing %s plot fixed on drag %s', (chromeLayout, dy) => {
    const spec = structuredClone(annotationCrowdedSpec);
    const size = { width: 390, height: 600, chromeLayout };
    const layout = compileChart(spec, size);
    const ctx = createAnnotationEditContext(layout, spec);
    const ref = elementRef.annotation(0, 'crowded-0');
    const preview = previewAnnotationMove(ctx, ref, { dx: -20, dy });
    const placement = inverseLabelPlacement(ctx, ref, preview.bounds!);
    const annotations = spec.annotations!.map((annotation, index) =>
      index === 0 ? { ...annotation, ...placement } : annotation,
    );
    const committed = compileChart({ ...spec, annotations }, size);
    const result = committed.annotations.find((annotation) => annotation.specIndex === 0)!;
    expect(result.label!.y).toBeCloseTo(preview.label!.y, 8);
    expect(committed.area).toEqual(layout.area);
    expect(committed.dimensions).toEqual(layout.dimensions);
    expect(committed.chrome.noteBandHeight).toEqual(layout.chrome.noteBandHeight);
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
  it('round-trips a moved drop-line including its subtitle and fixed marker', () => {
    const spec: ChartSpec = {
      ...editSpec,
      annotations: [{ ...editSpec.annotations![0], connector: 'drop-line' }],
    };
    const layout = compileChart(spec, options);
    const ctx = createAnnotationEditContext(layout, spec);
    const preview = previewAnnotationMove(ctx, ref, { dx: 20, dy: 20 });
    const placement = inverseLabelPlacement(ctx, ref, preview.bounds!);
    const next = compileChart(
      { ...spec, annotations: [{ ...spec.annotations![0], ...placement }] },
      options,
    ).annotations[0];
    expect(next.label!.x).toBeCloseTo(preview.label!.x, 8);
    expect(next.label!.y).toBeCloseTo(preview.label!.y, 8);
    expect(next.dot).toEqual(preview.dot);
    expect(next.label!.connector).toEqual(preview.label!.connector);
  });
  it('keeps zero-offset placement pinned against data obstacles', () => {
    const pinned = {
      ...editSpec,
      annotations: [{ ...editSpec.annotations![0], anchor: 'left', offset: { dx: 0, dy: 0 } }],
    } as ChartSpec;
    const layout = compileChart(pinned, options);
    const ctx = createAnnotationEditContext(layout, pinned);
    const inverse = inverseLabelPlacement(ctx, ref, layout.annotations[0].bounds!);
    expect(inverse.offset).toEqual({ dx: 0, dy: 0 });
    const next = compileChart(
      { ...pinned, annotations: [{ ...pinned.annotations![0], ...inverse }] },
      options,
    );
    expect(next.annotations).toEqual(layout.annotations);
  });
  it('uses the first leaf despite ignored intermediate layer annotations', () => {
    const spec = {
      layer: [
        {
          annotations: [{ type: 'text', id: 'ignored', x: 0, y: 0, text: 'Ignored' }],
          layer: [editSpec],
        },
      ],
    };
    const layout = compileLayer(spec, options);
    const ctx = createAnnotationEditContext(layout, spec);
    expect(
      previewAnnotationMove(
        ctx,
        { ...ref, path: '/layer/0/layer/0/annotations/0' },
        { dx: 5, dy: 0 },
      ).id,
    ).toBe('callout');
    expect(() =>
      previewAnnotationMove(ctx, { ...ref, path: '/layer/0/annotations/0' }, { dx: 5, dy: 0 }),
    ).toThrow();
  });
  it('validates bend in root and nested layer annotations', () => {
    const bad = { type: 'text', x: 0, y: 0, text: 'Bad', connector: { type: 'curve', bend: 3 } };
    const result = validateSpec({
      annotations: [bad],
      layer: [{ layer: [{ ...editSpec, annotations: [bad] }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.path)).toContain('annotations[0].connector.bend');
    expect(result.errors.map((error) => error.path)).toContain(
      'layer[0].layer[0].annotations[0].connector.bend',
    );
  });
  it('preserves the existing null connector fallback without throwing a warning error', () => {
    expect(() =>
      compileChart(
        {
          ...editSpec,
          annotations: [{ ...editSpec.annotations![0], connector: null }],
        } as unknown as ChartSpec,
        options,
      ),
    ).not.toThrow();
  });
  it('validates bend on graph annotations too', () => {
    const result = validateSpec({
      type: 'graph',
      nodes: [{ id: 'a' }],
      edges: [],
      annotations: [
        { type: 'text', text: 'Bad', x: 0, y: 0, connector: { type: 'curve', bend: NaN } },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.path)).toContain('annotations[0].connector.bend');
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
  it.each([
    'straight',
    'curve',
    'drop-line',
  ] as const)('%s endpoint previews round trip', (type) => {
    const spec = {
      ...editSpec,
      annotations: [
        {
          ...editSpec.annotations![0],
          x: 5,
          y: 5,
          anchor: 'left',
          offset: { dx: -40, dy: -40 },
          connector: { type },
          dot: true,
        },
      ],
    } as ChartSpec;
    const layout = compileChart(spec, options);
    const ctx = createAnnotationEditContext(layout, spec);
    for (const end of ['from', 'to'] as const) {
      const delta = { dx: 20, dy: 20 };
      const preview = previewConnectorOffset(ctx, ref, end, delta);
      const next = compileChart(
        { ...spec, annotations: [{ ...spec.annotations![0], connectorOffset: { [end]: delta } }] },
        options,
      );
      expect(preview).toEqual(next.annotations[0]);
    }
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

it.each([
  'straight',
  'curve',
  'drop-line',
] as const)('wrapped %s previews retain line geometry after release', (connector) => {
  const spec: ChartSpec = {
    ...editSpec,
    annotations: [
      {
        ...editSpec.annotations![0],
        text: 'A **long heading** for wrapped geometry',
        subtitle: 'A **supporting** line with more detail',
        maxWidth: 90,
        subtitleFontSize: 15,
        connector,
      },
    ],
  };
  const layout = compileChart(spec, options);
  const ctx = createAnnotationEditContext(layout, spec);
  const preview = previewAnnotationMove(ctx, ref, { dx: -50, dy: 30 });
  const placement = inverseLabelPlacement(ctx, ref, preview.bounds!);
  const committed = compileChart(
    { ...spec, annotations: [{ ...spec.annotations![0], ...placement }] },
    options,
  ).annotations[0];
  expect(committed.label!.lines).toEqual(preview.label!.lines);
  expect(committed.subtitle!.lines).toEqual(preview.subtitle!.lines);
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(committed.bounds![key]).toBeCloseTo(preview.bounds![key], 8);
});
