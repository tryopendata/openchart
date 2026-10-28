import { describe, expect, it } from 'vitest';
import { compileLayer } from '../../compile';
import { flattenLayers } from '../../compiler/normalize';

const options = { width: 120, height: 16, onWarn: () => {} };
const domain = ['claude', 'codex', 'cursor'];
const encoding = {
  x: { field: 'lower', type: 'quantitative' as const, scale: { domain: [0, 1] } },
  x2: { field: 'upper' },
  y: { field: 'agent', type: 'nominal' as const, scale: { domain } },
  description: { field: 'text' },
};
type CellRow = {
  agent: string;
  lower: number | null;
  upper: number | null;
  value: number | null;
  text: string;
};
function cell(value: number, hidden = true) {
  const data: CellRow[] = [{ agent: 'claude', lower: 0.1, upper: 0.95, value, text: 'published' }];
  return {
    data,
    layer: [
      { mark: 'errorbar' as const, encoding },
      {
        mark: 'point' as const,
        encoding: {
          x: { field: 'value', type: 'quantitative' as const },
          y: encoding.y,
          description: encoding.description,
        },
      },
    ],
    display: 'sparkline' as const,
    a11y: hidden ? { hidden: true } : { description: 'Finding' },
    watermark: false,
  };
}
describe('layer static figure contract', () => {
  it('propagates sparkline defaults and hidden accessibility through nested leaves', () => {
    const spec = cell(0.5);
    const layout = compileLayer(spec, options);
    expect(layout.display).toBe('sparkline');
    expect(layout.a11y.hidden).toBe(true);
    expect(layout.chrome.title).toBeUndefined();
    const leaves = flattenLayers({
      ...spec,
      layer: [{ layer: spec.layer }],
      frame: { left: 12, right: 8 },
    });
    expect(leaves).toHaveLength(2);
    for (const leaf of leaves) {
      expect(leaf.display).toBe('sparkline');
      expect(leaf.a11y).toEqual({ hidden: true });
      expect(leaf.frame).toEqual({ left: 12, right: 8 });
    }
  });
  it('names a full layered figure from its finding', () => {
    expect(
      compileLayer(
        { ...cell(0.5, false), display: 'full' },
        { ...options, width: 680, height: 320 },
      ).a11y.altText,
    ).toBe('Finding');
  });
  it('places the same shared-domain value at the same pixel in different cells', () => {
    const centers = [0.3, 0.9].map((value) => {
      const spec = cell(value);
      spec.data.push({ ...spec.data[0], value: 0.5 });
      const layout = compileLayer(spec, options);
      const point = layout.marks.find((mark) => mark.type === 'point' && mark.data.value === 0.5);
      if (point?.type !== 'point') throw new Error('Missing shared midpoint');
      return point.cx;
    });
    expect(centers[0]).toBeCloseTo(centers[1], 8);
  });
  it('keeps the hidden category band and emits no mark for null bounds or values', () => {
    const spec = cell(0.5, false);
    spec.data.push({
      agent: 'codex',
      lower: null,
      upper: null,
      value: null,
      text: 'unpublished',
    });
    const layout = compileLayer(
      { ...spec, display: 'full' },
      { ...options, width: 680, height: 320 },
    );
    expect(layout.axes.y?.ticks.map((tick) => tick.label)).toEqual(domain);
    expect(
      layout.marks.some((mark) => !Array.isArray(mark.data) && mark.data.agent === 'codex'),
    ).toBe(false);
  });
  it('does not extend an explicit domain for observations outside it', () => {
    const first = compileLayer(cell(0.5), options);
    const second = compileLayer(cell(4), options);
    const whisker = (layout: typeof first) => layout.marks.find((mark) => mark.type === 'rule');
    const a = whisker(first),
      b = whisker(second);
    if (a?.type !== 'rule' || b?.type !== 'rule') throw new Error('Missing bounds');
    expect(a.x1).toBeCloseTo(b.x1, 8);
    expect(a.x2).toBeCloseTo(b.x2, 8);
  });
  it('inherits composed labels through nested applicable leaves and preserves explicit overrides', () => {
    const data = [{ row: 'A', lower: 14, upper: 26 }];
    const span = {
      data,
      mark: 'range' as const,
      encoding: {
        x: { field: 'lower', type: 'quantitative' as const },
        x2: { field: 'upper', type: 'quantitative' as const },
        y: { field: 'row', type: 'nominal' as const },
      },
    };
    const leaves = flattenLayers({
      data,
      labels: { content: 'label value', suffix: 'm' },
      layer: [
        { layer: [span, { ...span, labels: false }] },
        {
          data,
          mark: 'tick',
          encoding: {
            x: { field: 'lower', type: 'quantitative' },
            y: { field: 'row', type: 'nominal' },
          },
        },
      ],
    });
    expect(leaves[0].labels).toEqual({ content: 'label value', suffix: 'm' });
    expect(leaves[1].labels).toBe(false);
    expect(leaves[2].labels).toBeUndefined();
  });
});
