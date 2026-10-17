import type { ChartSpec, TextAnnotation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { validateSpec } from '../../compiler/validate';
import { heuristicMeasure, measureRichLine } from '../geometry';
import { wrapAnnotationText } from '../wrap-text';

const base: ChartSpec = {
  mark: 'point',
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  animation: false,
};
const annotation: TextAnnotation = {
  type: 'text',
  x: 5,
  y: 5,
  text: 'A **strong long phrase** and an extraordinarilylongword',
  subtitle: 'A supporting line that also wraps',
  responsive: false,
};

describe('annotation text layout opt-ins', () => {
  it('wraps rich runs and long words while retaining explicit empty lines', () => {
    const lines = wrapAnnotationText(
      'First\n\n**extraordinarilylongword** next',
      65,
      { fontSize: 13, fontWeight: 400 },
      heuristicMeasure,
    );
    expect(lines[1]).toBe('');
    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines)
      expect(
        measureRichLine(line, { fontSize: 13, fontWeight: 400 }, heuristicMeasure),
      ).toBeLessThanOrEqual(65);
    expect(lines.slice(2, -1).every((line) => line.startsWith('**') && line.endsWith('**'))).toBe(
      true,
    );
  });
  it.each([
    undefined,
    'drop-line',
  ] as const)('preserves text identity and measures the wrapped block (%s)', (connector) => {
    const layout = compileChart(
      { ...base, annotations: [{ ...annotation, connector, maxWidth: 85, subtitleFontSize: 15 }] },
      { width: 600, height: 500 },
    );
    const a = layout.annotations[0];
    expect(a.label!.text).toBe(annotation.text);
    expect(a.subtitle!.text).toBe(annotation.subtitle);
    expect(a.label!.lines!.length).toBeGreaterThan(1);
    expect(a.subtitle!.lines!.length).toBeGreaterThan(1);
    expect(a.label!.bounds!.width).toBeLessThanOrEqual(85);
    expect(a.subtitle!.style.fontSize).toBe(15);
    expect(a.bounds!.width).toBeLessThanOrEqual(85);
  });
  it('null and omission reproduce identical layout', () => {
    const compile = (a: TextAnnotation) =>
      compileChart({ ...base, annotations: [a] }, { width: 600, height: 500 }).annotations;
    expect(compile({ ...annotation, maxWidth: null })).toEqual(compile(annotation));
    expect(compile({ ...annotation, subtitleFontSize: 11 })).toEqual(compile(annotation));
  });
});

describe('compact annotation limit', () => {
  const annotations: TextAnnotation[] = [
    { type: 'text', id: 'late', x: 2, y: 2, text: 'Second', priority: 2 },
    { type: 'text', id: 'first', x: 8, y: 8, text: 'First', priority: 1 },
    { type: 'text', id: 'pinned', x: 5, y: 5, text: 'Pinned', responsive: false },
  ];
  it('zero demotes every eligible annotation, retaining pinned ones', () => {
    const result = compileChart(
      { ...base, annotations, responsive: { compactAnnotationLimit: 0 } },
      { width: 390, height: 700 },
    );
    expect(result.chrome.footnotes?.length).toBe(2);
    expect(result.annotations.find((a) => a.id === 'pinned')?.footnoteIndex).toBeUndefined();
  });
  it('zero also demotes a single annotation', () => {
    const result = compileChart(
      { ...base, annotations: [annotations[0]], responsive: { compactAnnotationLimit: 0 } },
      { width: 390, height: 700 },
    );
    expect(result.chrome.footnotes?.length).toBe(1);
  });
  it('uses outer width, preserving unlimited behavior at 400 and above', () => {
    const compile = (width: number, limit?: number | null) =>
      compileChart(
        { ...base, annotations, responsive: { compactAnnotationLimit: limit } },
        { width, height: 700 },
      );
    expect(compile(400, 0).annotations).toEqual(compile(400).annotations);
    expect(compile(390, null).annotations).toEqual(compile(390).annotations);
  });
  it('does not override D15 hide-all', () => {
    const result = compileChart(
      { ...base, annotations, responsive: { autoThin: false, compactAnnotationLimit: 0 } },
      { width: 390, height: 700 },
    );
    expect(result.annotations.map((a) => a.id)).toEqual(['pinned']);
    expect(result.chrome.footnotes).toBeUndefined();
  });
});

it('resolves authored annotation tokens and keeps explicit ink authoritative', () => {
  const result = compileChart(
    {
      ...base,
      theme: {
        colors: {
          annotationLabel: '#112233',
          annotationMuted: '#223344',
          annotationLeader: '#334455',
          annotationRule: '#445566',
          annotationRangeFill: '#556677',
          annotationMarkerFill: '#667788',
          annotationPlate: '#778899',
        },
      },
      annotations: [
        {
          ...annotation,
          text: 'Callout',
          anchor: 'left',
          offset: { dx: -60, dy: -100 },
          connector: true,
          background: true,
        },
        { type: 'refline', y: 3, label: 'Rule' },
        { type: 'range', x1: 1, x2: 2, label: 'Range' },
      ],
    },
    { width: 800, height: 700 },
  );
  const a = result.annotations[0];
  expect(a.label!.style.fill).toBe('#112233');
  expect(a.subtitle!.style.fill).toBe('#223344');
  expect(a.label!.connector!.stroke).toBe('#334455');
  expect(a.dot!.fill).toBe('#667788');
  expect(a.label!.background).toBe('#778899');
  expect(result.annotations[1].stroke).toBe('#445566');
  expect(result.annotations[2].fill).toBe('#556677');
  const explicit = compileChart(
    {
      ...base,
      theme: { colors: { annotationLabel: '#112233' } },
      annotations: [
        {
          ...annotation,
          text: 'Arrow',
          anchor: 'left',
          offset: { dx: -60, dy: -100 },
          fill: '#aabbcc',
          connector: 'curve',
        },
      ],
    },
    { width: 800, height: 700 },
  );
  expect(explicit.annotations[0].label!.connector!.stroke).toBe('#aabbcc');
});

it.each([
  'subtract',
  'grow',
] as const)('does not reserve a single-note band under 200px (%s)', (chromeLayout) => {
  const spec = { ...base, chromeLayout, annotations: [{ ...annotation, responsive: undefined }] };
  const opts = { width: 390, height: 199 };
  const omitted = compileChart(spec, opts);
  const limited = compileChart({ ...spec, responsive: { compactAnnotationLimit: 0 } }, opts);
  expect(limited.area).toEqual(omitted.area);
  expect(limited.chrome).toEqual(omitted.chrome);
});

it('keeps priority ties in source order before coverage and collision', () => {
  const annotations: TextAnnotation[] = [
    { type: 'text', id: 'late', x: 2, y: 2, text: 'Later', priority: 2 },
    { type: 'text', id: 'first', x: 5, y: 5, text: 'First', priority: 1 },
    { type: 'text', id: 'tied', x: 8, y: 8, text: 'Tie', priority: 1 },
  ];
  const result = compileChart(
    { ...base, annotations, responsive: { compactAnnotationLimit: 1 } },
    { width: 390, height: 800 },
  );
  expect(result.annotations.filter((a) => !a.footnoteIndex).map((a) => a.id)).toEqual(['first']);
});
it('uses figure width for the limit when facet panels are compact', () => {
  const spec: ChartSpec = {
    ...base,
    data: ['A', 'B'].flatMap((group) => base.data.map((row) => ({ ...row, group }))),
    encoding: { ...base.encoding, facet: { field: 'group', type: 'nominal', columns: 2 } },
    annotations: [{ ...annotation, text: 'Short', subtitle: undefined, responsive: undefined }],
  };
  const opts = { width: 640, height: 600 };
  expect(compileChart({ ...spec, responsive: { compactAnnotationLimit: 0 } }, opts).facet).toEqual(
    compileChart(spec, opts).facet,
  );
});

it.each([
  -1,
  0,
  Infinity,
  NaN,
  '90',
])('rejects invalid finite text widths and subtitle sizes: %s', (value) => {
  for (const field of ['maxWidth', 'subtitleFontSize']) {
    const result = validateSpec({ ...base, annotations: [{ ...annotation, [field]: value }] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.endsWith(field))).toBe(true);
  }
});
it.each([
  -1,
  1.5,
  Infinity,
  NaN,
  '1',
])('rejects invalid compact limits: %s', (compactAnnotationLimit) => {
  const result = validateSpec({ ...base, responsive: { compactAnnotationLimit } });
  expect(result.valid).toBe(false);
});

it.each([
  false,
  true,
])('preserves compiled rule/range defaults while honoring tokens (dark=%s)', (darkMode) => {
  const annotations: ChartSpec['annotations'] = [
    { type: 'refline', id: 'rule', y: 3, label: 'Rule' },
    { type: 'range', id: 'range', x1: 1, x2: 2, label: 'Range' },
  ];
  const options = { width: 800, height: 700, darkMode };
  const legacyInk: ChartSpec['annotations'] = [
    { ...annotations[0], stroke: '#666666' },
    { ...annotations[1], fill: '#000000' },
  ];
  const defaults = compileChart({ ...base, annotations }, options);
  expect(defaults.theme.colors.annotationRule).toBe('#666666');
  expect(defaults.theme.colors.annotationRangeFill).toBe('#000000');
  expect(defaults.annotations).toEqual(
    compileChart({ ...base, annotations: legacyInk }, options).annotations,
  );
  const theme = {
    colors: {
      annotationRule: { light: '#445566', dark: '#aabbcc' },
      annotationRangeFill: { light: '#556677', dark: '#bbccdd' },
    },
  };
  const themed = compileChart({ ...base, annotations, theme }, options);
  expect(themed.annotations[0].stroke).toBe(darkMode ? '#aabbcc' : '#445566');
  expect(themed.annotations[1].fill).toBe(darkMode ? '#bbccdd' : '#556677');
  const explicit = compileChart({ ...base, annotations: legacyInk, theme }, options);
  expect(explicit.annotations[0].stroke).toBe('#666666');
  expect(explicit.annotations[1].fill).toBe('#000000');
});
