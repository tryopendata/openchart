import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../../../compile';
import { DEFAULT_POINT_RADIUS } from '../compute';

const data = [null, 5, null].map((value, index) => ({
  day: `2026-10-${10 + index}`,
  value,
  text: `value ${value}`,
}));
const encoding = {
  x: { field: 'day', type: 'temporal' },
  y: { field: 'value', type: 'quantitative' },
  description: { field: 'text' },
};
const options = { width: 360, height: 220, onWarn: () => {} };
describe('isolated observations', () => {
  for (const mark of ['line', 'area'])
    it(`${mark} emits one real point and no line or area for one observation`, () => {
      const layout = compileChart({ data, mark, encoding }, options);
      expect(
        layout.marks.filter((mark) => mark.type === 'line' || mark.type === 'area'),
      ).toHaveLength(0);
      const points = layout.marks.filter((mark) => mark.type === 'point');
      expect(points).toHaveLength(1);
      expect(points[0].r).toBe(DEFAULT_POINT_RADIUS);
      expect(points[0].markType).toBe('point');
      expect(points[0].authoredDescription).toBe('value 5');
      expect(points[0].aria.decorative).not.toBe(true);
      expect([...layout.tooltipDescriptors.keys()].some((key) => key.startsWith('point-'))).toBe(
        true,
      );
    });
  it('explicit point:false suppresses isolated observations with one warning', () => {
    const warnings: string[] = [];
    const layout = compileChart(
      { data, mark: { type: 'line', point: false }, encoding },
      { ...options, onWarn: (warning) => warnings.push(warning) },
    );
    expect(layout.marks).toHaveLength(0);
    expect(warnings.filter((warning) => warning.includes('Isolated point'))).toHaveLength(1);
  });
  it('keeps connected paths separate from isolated middle observations', () => {
    const values = [1, 2, null, 5, null, 7, 8];
    const rows = values.map((value, index) => ({
      day: `2026-10-${10 + index}`,
      value,
      text: 'series',
    }));
    const layout = compileChart({ data: rows, mark: 'line', encoding }, options);
    const lines = layout.marks.filter((mark) => mark.type === 'line');
    const points = layout.marks.filter((mark) => mark.type === 'point');
    expect(lines).toHaveLength(1);
    expect(points).toHaveLength(1);
    expect(lines[0].points).toHaveLength(4);
    expect(lines[0].data).toHaveLength(4);
    expect(lines[0].path?.match(/M/g)).toHaveLength(2);
    expect(lines[0].path).not.toContain('Z');
    expect(points[0].data.value).toBe(5);
  });
  it('does not duplicate isolated colored-area dots when normal points are requested', () => {
    const layout = compileChart(
      {
        data: data.map((row) => ({ ...row, group: 'A' })),
        mark: { type: 'area', point: true },
        encoding: { ...encoding, color: { field: 'group', type: 'nominal' } },
      },
      options,
    );
    expect(layout.marks.filter((mark) => mark.type === 'point')).toHaveLength(1);
    expect(
      layout.marks.filter((mark) => mark.type === 'line' || mark.type === 'area'),
    ).toHaveLength(0);
  });
  it('keeps stacked-area isolated dots on cumulative boundaries and honors shared gaps', () => {
    const rows = ['A', 'B'].flatMap((group) =>
      [0, 1, 2].map((index) => ({
        day: `2026-10-${10 + index}`,
        group,
        value: index === 1 && group === 'A' ? null : group === 'A' ? 10 : 20,
      })),
    );
    const layout = compileChart(
      {
        data: rows,
        mark: { type: 'area', point: true },
        encoding: {
          x: encoding.x,
          y: { ...encoding.y, stack: 'zero' },
          color: { field: 'group', type: 'nominal' },
        },
      },
      options,
    );
    expect(
      layout.marks.filter((mark) => mark.type === 'line' || mark.type === 'area'),
    ).toHaveLength(0);
    const points = layout.marks.filter((mark) => mark.type === 'point');
    expect(points).toHaveLength(4);
    expect(points.every((point) => point.data.day !== '2026-10-11')).toBe(true);
    const lower = points.find((point) => point.data.group === 'A')!;
    const upper = points.find((point) => point.data.group === 'B')!;
    expect(upper.cy).toBeLessThan(lower.cy);
  });
  for (const width of [120, 330, 360, 680])
    for (const axisTick of [12, 14])
      it(`reserves every leaf's caps and large points at ${width}/${axisTick}`, () => {
        for (const reverse of [false, true]) {
          const leaves = [
            {
              mark: { type: 'errorbar', ticks: true },
              encoding: {
                x: { field: 'lower', type: 'quantitative', scale: { domain: [0, 1] } },
                x2: { field: 'upper' },
                y: { field: 'row', type: 'nominal' },
              },
            },
            {
              mark: { type: 'point', size: 7 },
              encoding: {
                x: { field: 'value', type: 'quantitative', scale: { domain: [0, 1] } },
                y: { field: 'row', type: 'nominal' },
              },
            },
          ];
          const layout = compileLayer(
            {
              data: [
                { row: 'A', lower: 0, upper: 1, value: 0 },
                { row: 'A', lower: 0, upper: 1, value: 1 },
              ],
              layer: reverse ? leaves.reverse() : leaves,
              display: 'sparkline',
              a11y: { hidden: true },
            },
            { ...options, width, height: 16, theme: { fonts: { sizes: { axisTick } } } },
          );
          for (const mark of layout.marks) {
            if (mark.type === 'point') {
              expect(mark.cx - mark.r).toBeGreaterThanOrEqual(0);
              expect(mark.cx + mark.r).toBeLessThanOrEqual(width);
              expect(mark.cy - mark.r).toBeGreaterThanOrEqual(0);
              expect(mark.cy + mark.r).toBeLessThanOrEqual(16);
            }
            if (mark.type === 'tick') {
              expect(mark.y - mark.length / 2).toBeGreaterThanOrEqual(0);
              expect(mark.y + mark.length / 2).toBeLessThanOrEqual(16);
            }
          }
        }
      });
});
