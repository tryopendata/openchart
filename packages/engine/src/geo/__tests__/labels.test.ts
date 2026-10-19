import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { prepareGeoLabels } from '../labels';
import type { NormalizedGeoMapSpec } from '../types';

const theme = resolveTheme();
const measure = (text: string, size: number) => ({ width: text.length * size * 0.6, height: size });
const feature = (id: string, properties: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  id,
  properties,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
});
const base = {
  type: 'map',
  data: [],
  encoding: {},
  geo: {},
  chrome: {},
  theme: {},
  watermark: false,
} as unknown as NormalizedGeoMapSpec;
describe('geo label candidate assembly', () => {
  it('has an opt-out fast path without a bundle or reserve', () => {
    expect(prepareGeoLabels(base, [], new Map(), theme, measure, 390)).toBeUndefined();
  });
  it('retains custom topology text on unjoined features without name substitution', () => {
    const prepared = prepareGeoLabels(
      { ...base, encoding: { text: { field: 'custom' } } },
      [
        feature('a', { custom: 'Authored place', name: 'Wrong name' }),
        feature('b', { name: 'Never inferred' }),
      ],
      new Map(),
      theme,
      measure,
      390,
    )!;
    expect(prepared.candidates.map((candidate) => candidate.text)).toEqual(['Authored place']);
    expect(prepared.candidates[0].anchor).toEqual({ kind: 'feature', id: 'a' });
  });
  it('retains all text candidates before the visual cap and separates point/feature namespaces', () => {
    const features = Array.from({ length: 205 }, (_, index) =>
      feature(String(index), { text: `Place ${index}` }),
    );
    const prepared = prepareGeoLabels(
      {
        ...base,
        encoding: { text: { field: 'text' } },
        points: {
          data: [{ id: '0', text: 'Point zero', x: 1, y: 1 }],
          key: { field: 'id' },
          text: { field: 'text' },
          longitude: { field: 'x' },
          latitude: { field: 'y' },
        },
      },
      features,
      new Map(),
      theme,
      measure,
      390,
    )!;
    expect(prepared.candidates).toHaveLength(206);
    expect(new Set(prepared.candidates.map((candidate) => candidate.id)).size).toBe(206);
  });
  it('measures fixed note slots for every authored callout, retaining full text and subtitle', () => {
    const callouts = [
      {
        id: 'a',
        anchor: { kind: 'feature' as const, id: 'missing' },
        text: 'An authored explanation with several wrapped words',
        subtitle: 'Complete supporting evidence',
      },
      {
        id: 'b',
        anchor: { kind: 'coordinate' as const, space: 'source' as const, x: 1, y: 2 },
        text: 'Another note',
        minZoom: 4,
      },
    ];
    const prepared = prepareGeoLabels({ ...base, callouts }, [], new Map(), theme, measure, 150)!;
    expect(prepared.noteSlots).toHaveLength(2);
    expect(prepared.noteHeight).toBeGreaterThan(0);
    expect(prepared.candidates[0].text).toBe(callouts[0].text);
    expect(prepared.candidates[0].subtitle).toBe(callouts[0].subtitle);
    expect(prepared.noteSlots.map((slot) => slot.number)).toEqual([1, 2]);
    expect(prepared.noteSlots[0].block.lines.map((line) => line.text).join(' ')).toContain(
      'Complete supporting evidence',
    );
  });
});

it('honors explicit numeric/temporal formats and joined null without inferring topology names', () => {
  const features = [feature('a', { custom: 99 }), feature('b', { custom: 2.5 })];
  const joined = new Map([
    ['a', { custom: null }],
    ['b', { custom: 1.25 }],
  ]);
  const prepared = prepareGeoLabels(
    { ...base, encoding: { text: { field: 'custom', type: 'quantitative', format: '.1f' } } },
    features,
    joined,
    theme,
    measure,
    390,
  )!;
  expect(prepared.candidates.map((candidate) => candidate.text)).toEqual(['1.3']);
  const temporal = prepareGeoLabels(
    { ...base, encoding: { text: { field: 'date', type: 'temporal', format: '%Y-%m' } } },
    [feature('a', { date: '2024-03-05' })],
    new Map(),
    theme,
    measure,
    390,
  )!;
  expect(temporal.candidates[0].text).toBe('2024-03');
});
