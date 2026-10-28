import { describe, expect, it, vi } from 'vitest';
import { compileBarList } from '../compile-barlist';

const data = [
  { name: 'first', value: 1, group: 'steps' },
  { name: 'third', value: 3, group: 'env' },
  { name: 'second', value: 2, group: 'steps' },
  { name: 'fourth', value: 4, group: 'env' },
];
const spec = {
  type: 'barlist',
  data,
  encoding: { label: { field: 'name' }, value: { field: 'value' }, group: { field: 'group' } },
  watermark: false,
};
const options = { width: 640, height: 420 };
describe('static barlist contract', () => {
  it.each([
    { sort: 'largest' },
    { height: 0 },
    { encoding: { ...spec.encoding, group: { field: 'group', type: 'quantitative' } } },
    { encoding: { ...spec.encoding, value: { field: 'value', scale: { domain: [3, 1] } } } },
    { annotations: [{ type: 'refline', x: 1, y: 2 }] },
    { annotations: [{ type: 'text', x: 1 }] },
  ])('rejects invalid barlist additions %j', (override) => {
    expect(() => compileBarList({ ...spec, ...override }, options)).toThrow();
  });
  for (const width of [330, 360, 680])
    for (const axisTick of [12, 14])
      it(`reserves formatted labels at ${width}px and ${axisTick}px ticks`, () => {
        const measureText = (text: string, size: number) => ({
          width: text.length * size * 0.6,
          height: size,
        });
        const layout = compileBarList(
          { ...spec, labels: { format: '.1f', suffix: '× as likely' } },
          { width, height: 400, theme: { fonts: { sizes: { axisTick } } }, measureText },
        );
        for (const row of layout.rows) {
          const textLeft =
            row.valueLabel.x - measureText(row.formattedValue, row.valueLabel.style.fontSize).width;
          expect(textLeft).toBeGreaterThan(row.track.x + row.track.width);
          expect(row.valueLabel.x).toBeLessThanOrEqual(width - layout.theme.spacing.padding);
        }
      });
  it('groups in first-seen order, sorts within each group, then limits across groups', () => {
    const layout = compileBarList({ ...spec, maxItems: 3 }, options);
    expect(layout.rows.map((row) => row.data.name)).toEqual(['second', 'first', 'fourth']);
    expect(layout.groups?.map((group) => group.label.text)).toEqual(['steps', 'env']);
    expect(layout.groups?.[1].separator).toBeDefined();
    expect(
      compileBarList({ ...spec, sort: null }, options).rows.map((row) => row.data.name),
    ).toEqual(['first', 'second', 'third', 'fourth']);
    expect(
      compileBarList({ ...spec, sort: 'ascending' }, options).rows.map((row) => row.data.name),
    ).toEqual(['first', 'second', 'third', 'fourth']);
  });
  it('uses explicit lower and upper domain bounds for bars and reference lines', () => {
    const layout = compileBarList(
      {
        ...spec,
        encoding: { ...spec.encoding, value: { field: 'value', scale: { domain: [1, 3] } } },
        annotations: [{ type: 'refline', x: 2, label: 'Baseline', style: 'dashed' }],
      },
      options,
    );
    const row = layout.rows.find((row) => row.value === 2)!;
    expect(row.bar.width / row.track.width).toBeCloseTo(0.5);
    expect(layout.referenceLines?.[0].x).toBeCloseTo(row.track.x + row.track.width / 2);
    expect(layout.referenceLines?.[0].strokeDasharray).toBeTruthy();
    expect(layout.referenceLines?.[0].y2).toBeGreaterThan(layout.rows.at(-1)!.y);
  });
  it('formats values with label prefix and suffix and honors accessible names', () => {
    const layout = compileBarList(
      {
        ...spec,
        labels: { format: '.1f', prefix: '~', suffix: '× as likely' },
        a11y: { description: 'Exact finding', hidden: true },
      },
      options,
    );
    expect(layout.rows[0].formattedValue).toBe('~2.0× as likely');
    expect(layout.a11y.altText).toBe('Exact finding');
    expect(layout.a11y.hidden).toBe(true);
  });
  it('fits fourteen rows and group headers at auto height and warns for an explicit cap', () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      name: `Row ${i}`,
      value: i,
      group: i < 7 ? 'steps' : 'env',
    }));
    const auto = compileBarList(
      { ...spec, data: rows, height: 'auto' },
      { ...options, height: 80 },
    );
    expect(auto.rows).toHaveLength(14);
    expect(auto.rows.at(-1)!.y + auto.rows.at(-1)!.height).toBeLessThanOrEqual(auto.height);
    const onWarn = vi.fn();
    const capped = compileBarList({ ...spec, data: rows, height: 100 }, { ...options, onWarn });
    expect(capped.rows.length).toBeLessThan(14);
    expect(onWarn.mock.calls.flat().join(' ')).toContain(`${14 - capped.rows.length}`);
    expect(capped.warnings?.[0].context?.droppedCount).toBe(14 - capped.rows.length);
  });
  it('keeps one row when an explicit height cannot fit any, and warns once per compile', () => {
    const onWarn = vi.fn();
    const { padding } = compileBarList(spec, options).theme.spacing;
    // A positive plot area shorter than one row.
    const height = padding * 2 + 8;
    const layout = compileBarList({ ...spec, height }, { ...options, onWarn });
    expect(layout.area.height).toBeLessThan(layout.rows[0]?.height ?? Infinity);
    expect(layout.rows).toHaveLength(1);
    expect(layout.rows[0].data.name).toBe('second');
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(layout.warnings?.[0].context?.droppedCount).toBe(3);
  });
  it('does not warn when the container, not an authored height, limits the rows', () => {
    const onWarn = vi.fn();
    const layout = compileBarList(spec, { ...options, height: 60, onWarn });
    expect(layout.rows.length).toBeGreaterThanOrEqual(1);
    expect(layout.rows.length).toBeLessThan(4);
    expect(onWarn).not.toHaveBeenCalled();
  });
  it('drops reference lines outside the value domain, like chart reference lines resolve to nothing off-scale', () => {
    const layout = compileBarList(
      {
        ...spec,
        encoding: { ...spec.encoding, value: { field: 'value', scale: { domain: [1, 3] } } },
        annotations: [
          { type: 'refline', x: 10, label: 'Too high' },
          { type: 'refline', x: 2 },
          { type: 'refline', x: 0 },
        ],
      },
      options,
    );
    expect(layout.referenceLines).toHaveLength(1);
    const track = layout.rows[0].track;
    expect(layout.referenceLines?.[0].x).toBeCloseTo(track.x + track.width / 2);
    const inferred = compileBarList(
      {
        ...spec,
        annotations: [
          { type: 'refline', x: 5 },
          { type: 'refline', x: 4 },
        ],
      },
      options,
    );
    expect(inferred.referenceLines).toHaveLength(1);
    expect(inferred.referenceLines?.[0].x).toBeCloseTo(track.x + track.width);
  });
});
