import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const base: ChartSpec = {
  mark: 'point',
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  annotations: [
    { type: 'text', x: 5, y: 5, text: 'Ordinary' },
    { type: 'text', x: 5, y: 6, text: 'Pinned', responsive: false },
    { type: 'refline', y: 4, label: 'Ordinary rule' },
  ],
};

describe('v8 compact opt-outs (D15)', () => {
  it.each([
    { responsive: false as const },
    { responsive: { autoThin: false } },
    { width: 390, height: 400 },
  ])('preserves hide-all except per-annotation responsive false: %j', (overrides) => {
    const layout = compileChart({ ...base, ...overrides }, { width: 390, height: 400 });
    expect(layout.annotations.map((annotation) => annotation.specIndex)).toEqual([1]);
    expect(layout.chrome.footnotes ?? []).toEqual([]);
  });
});
