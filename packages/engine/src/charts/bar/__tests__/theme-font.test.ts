import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

describe('value label theme font', () => {
  for (const kind of ['bar', 'column', 'dot', 'range', 'pie'] as const) {
    it(`${kind} resolves its value labels from the theme`, () => {
      const horizontal = kind === 'bar' || kind === 'dot' || kind === 'range';
      const spec = {
        mark:
          kind === 'column' ? 'bar' : kind === 'pie' ? 'arc' : kind === 'dot' ? 'lollipop' : kind,
        data: [
          { name: 'A', value: 30, end: 60 },
          { name: 'B', value: 50, end: 70 },
        ],
        encoding:
          kind === 'pie'
            ? {
                theta: { field: 'value', type: 'quantitative' },
                color: { field: 'name', type: 'nominal' },
              }
            : {
                x: {
                  field: horizontal ? 'value' : 'name',
                  type: horizontal ? 'quantitative' : 'nominal',
                },
                y: {
                  field: horizontal ? 'name' : 'value',
                  type: horizontal ? 'nominal' : 'quantitative',
                },
                ...(kind === 'range' ? { x2: { field: 'end', type: 'quantitative' } } : {}),
              },
        labels: { density: 'all' },
        theme: { fonts: { family: 'Georgia, serif' } },
      } as ChartSpec;
      const layout = compileChart(spec, { width: 680, height: 400 });
      const labels = layout.marks.flatMap((mark) =>
        'label' in mark && mark.label ? [mark.label] : [],
      );
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.every((label) => label.style.fontFamily === layout.theme.fonts.family)).toBe(
        true,
      );
    });
  }
});
