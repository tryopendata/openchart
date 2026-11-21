/**
 * Stacked area highlight styling: muted stacked bands render with reduced fill
 * opacity and a crisp canvas-colored hairline seam so neighboring muted bands
 * stay visually distinct instead of fusing into one solid gray slab.
 */

import type { AreaMark, Rect } from '@opendata-ai/openchart-core';
import { adaptTheme, resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeAreaMarks } from '../area';

const AREA: Rect = { x: 40, y: 20, width: 520, height: 300 };

function stackedAreaSpec(
  overrides?: Partial<Pick<NormalizedChartSpec, 'highlight' | 'markDef'>>,
): NormalizedChartSpec {
  return {
    markType: 'area',
    markDef: { type: 'area', ...overrides?.markDef },
    data: [
      { year: '2020', source: 'Gas', share: 41.3 },
      { year: '2023', source: 'Gas', share: 43.5 },
      { year: '2020', source: 'Coal', share: 19.6 },
      { year: '2023', source: 'Coal', share: 16.2 },
      { year: '2020', source: 'Nuclear', share: 20.1 },
      { year: '2023', source: 'Nuclear', share: 18.6 },
    ],
    encoding: {
      x: { field: 'year', type: 'temporal' },
      y: { field: 'share', type: 'quantitative', stack: 'normalize' },
      color: { field: 'source', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
    ...(overrides?.highlight ? { highlight: overrides.highlight } : {}),
  };
}

function marksBySeries(spec: NormalizedChartSpec, theme = resolveTheme({})): Map<string, AreaMark> {
  const scales = computeScales(spec, AREA, spec.data);
  const marks = computeAreaMarks(spec, scales, AREA, theme);
  return new Map(marks.map((mark) => [mark.seriesKey ?? '', mark]));
}

describe('stacked area highlight seams and muted opacity', () => {
  it('draws muted stacked bands with softer opacity and an opaque canvas seam stroke', () => {
    const lightPaper = resolveTheme({ colors: { background: '#faf8f5' } });
    const bySeries = marksBySeries(stackedAreaSpec({ highlight: ['Coal'] }), lightPaper);

    const coal = bySeries.get('Coal');
    const gas = bySeries.get('Gas');
    const nuclear = bySeries.get('Nuclear');

    expect(coal?.fillOpacity).toBe(0.92);
    expect(coal?.strokeWidth).toBe(1);
    expect(coal?.stroke).not.toBe('#faf8f5');

    for (const muted of [gas, nuclear]) {
      expect(muted?.fillOpacity).toBe(0.42);
      expect(muted?.stroke).toBe('#faf8f5');
      expect(muted?.strokeWidth).toBe(1.5);
    }
  });

  it('falls back to a light or dark seam color when the theme background is transparent', () => {
    const transparentLight = resolveTheme({});
    const lightMuted = marksBySeries(
      stackedAreaSpec({ highlight: ['Coal'] }),
      transparentLight,
    ).get('Gas');
    expect(lightMuted?.stroke).toBe('#ffffff');
    expect(lightMuted?.strokeWidth).toBe(1.5);

    const transparentDark = adaptTheme(resolveTheme({}));
    const darkMuted = marksBySeries(stackedAreaSpec({ highlight: ['Coal'] }), transparentDark).get(
      'Gas',
    );
    expect(darkMuted?.stroke).toBe('#111827');
    expect(darkMuted?.strokeWidth).toBe(1.5);
  });

  it('respects an explicit markDef.fillOpacity even when muted', () => {
    const bySeries = marksBySeries(
      stackedAreaSpec({ highlight: ['Coal'], markDef: { type: 'area', fillOpacity: 0.65 } }),
    );
    expect(bySeries.get('Gas')?.fillOpacity).toBe(0.65);
    expect(bySeries.get('Coal')?.fillOpacity).toBe(0.65);
  });

  it('preserves default stacked opacity and stroke width when highlight is absent', () => {
    const bySeries = marksBySeries(stackedAreaSpec());
    for (const series of ['Coal', 'Gas', 'Nuclear']) {
      expect(bySeries.get(series)?.fillOpacity).toBe(0.92);
      expect(bySeries.get(series)?.strokeWidth).toBe(1);
    }
  });
});
