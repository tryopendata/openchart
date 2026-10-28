import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

const options = { width: 680, height: 320, onWarn: () => {} };
describe('authored label content', () => {
  it('composes normalized segment labels before fit without multiplying percentages twice', () => {
    const spec = {
      data: [
        { dependency: 'runtime', major: 'v1', share: 85 },
        { dependency: 'runtime', major: 'v2', share: 15 },
      ],
      mark: 'bar',
      encoding: {
        x: { field: 'share', type: 'quantitative', stack: 'normalize' },
        y: { field: 'dependency', type: 'nominal' },
        color: { field: 'major', type: 'nominal' },
      },
      labels: { placement: 'inside', content: 'label value', format: 'percent' },
    };
    const layout = compileChart(spec, options);
    const labels = layout.marks.filter((mark) => mark.type === 'rect').map((mark) => mark.label);
    expect(labels.map((label) => label?.text)).toEqual(['v1 85%', 'v2 15%']);
    expect(labels[0]?.visible).toBe(true);
    expect(labels[0]?.halo).toBe(false);
    const narrow = compileChart(
      {
        ...spec,
        data: [
          { dependency: 'runtime', major: 'v1', share: 99 },
          { dependency: 'runtime', major: 'v2', share: 1 },
        ],
      },
      { ...options, width: 330 },
    );
    expect(narrow.marks.filter((mark) => mark.type === 'rect')[1].label?.visible).toBe(false);
  });
  for (const style of ['bar', 'dumbbell', 'arrow'])
    it(`${style} range composes endpoint channel titles and suffix`, () => {
      const layout = compileChart(
        {
          data: [{ row: 'one', median: 14, p75: 26 }],
          mark: { type: 'range', style },
          encoding: {
            x: { field: 'median', type: 'quantitative', title: 'median' },
            x2: { field: 'p75', title: 'p75' },
            y: { field: 'row', type: 'nominal' },
          },
          labels: { density: 'all', content: 'label value', suffix: 'm' },
        },
        options,
      );
      expect(
        layout.marks.filter((mark) => mark.type === 'textMark').map((mark) => mark.text),
      ).toEqual(['median 14m', 'p75 26m']);
      expect(
        layout.marks
          .filter((mark) => mark.type === 'textMark')
          .every((mark) => mark.aria.decorative),
      ).toBe(true);
    });
  for (const width of [330, 360, 680])
    it(`reserves measured range-end labels inside a ${width}px figure`, () => {
      const measureText = (text: string) => ({ width: text.length * 8, height: 13 });
      const layout = compileChart(
        {
          data: [{ row: 'one', median: 14, p75: 26 }],
          mark: { type: 'range', style: 'bar' },
          encoding: {
            x: { field: 'median', type: 'quantitative', title: 'median' },
            x2: { field: 'p75', title: 'p75' },
            y: { field: 'row', type: 'nominal' },
          },
          labels: { density: 'all', content: 'label value', suffix: 'm' },
        },
        { ...options, width, measureText },
      );
      const labels = layout.marks.filter((mark) => mark.type === 'textMark');
      expect(labels).toHaveLength(2);
      for (const label of labels) {
        expect(label.x).toBeGreaterThanOrEqual(0);
        expect(label.x + measureText(label.text).width).toBeLessThanOrEqual(width);
      }
    });
  for (const axisTick of [12, 14])
    for (const width of [330, 360, 680])
      it(`identifies last stacked-column segments and demotes in a narrow lane at ${width}/${axisTick}`, () => {
        const data = ['2026-10-18', '2026-10-25'].flatMap((day) => [
          { day, preset: 'default', projects: 40 },
          { day, preset: 'sandbox', projects: 25 },
        ]);
        const spec = {
          data,
          mark: 'bar',
          encoding: {
            x: { field: 'day', type: 'temporal', interval: 'week' },
            y: { field: 'projects', type: 'quantitative', stack: 'zero' },
            color: { field: 'preset', type: 'nominal' },
          },
          endpointLabels: true,
          frame: { left: 48, right: 96 },
        };
        const layout = compileChart(spec, {
          ...options,
          width,
          theme: { fonts: { sizes: { axisTick } } },
        });
        expect(layout.endpointLabels?.entries.map((entry) => entry.seriesKey).sort()).toEqual([
          'default',
          'sandbox',
        ]);
        expect(
          layout.endpointLabels?.entries.every((entry) => entry.source?.x === '2026-10-25'),
        ).toBe(true);
        expect(
          layout.endpointLabels!.bounds.x + layout.endpointLabels!.bounds.width,
        ).toBeLessThanOrEqual(width);
        const narrow = compileChart(
          { ...spec, frame: { left: 48, right: 5 } },
          { ...options, width },
        );
        expect(narrow.endpointLabels?.entries ?? []).toHaveLength(0);
      });
});
