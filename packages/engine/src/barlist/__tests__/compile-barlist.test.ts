import type { BarListSpec, CompileOptions } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import { compileBarList } from '../compile-barlist';

const BASE_OPTIONS: CompileOptions = {
  width: 600,
  height: 400,
};

function makeSpec(overrides?: Partial<BarListSpec>): BarListSpec {
  return {
    type: 'barlist',
    data: [
      { label: 'Alpha', count: 100 },
      { label: 'Beta', count: 75 },
      { label: 'Gamma', count: 50 },
      { label: 'Delta', count: 25 },
    ],
    encoding: {
      label: { field: 'label', type: 'nominal' },
      value: { field: 'count', type: 'quantitative' },
    },
    ...overrides,
  };
}

describe('compileBarList', () => {
  it('compiles a basic barlist spec with correct row count', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.rows).toHaveLength(4);
  });

  it('sorts rows by value descending', () => {
    const spec = makeSpec({
      data: [
        { label: 'Low', count: 10 },
        { label: 'High', count: 100 },
        { label: 'Mid', count: 50 },
      ],
    });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].label.text).toBe('High');
    expect(layout.rows[1].label.text).toBe('Mid');
    expect(layout.rows[2].label.text).toBe('Low');
  });

  it('limits rows to maxItems', () => {
    const spec = makeSpec({ maxItems: 2 });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows).toHaveLength(2);
    expect(layout.rows[0].label.text).toBe('Alpha');
    expect(layout.rows[1].label.text).toBe('Beta');
  });

  it('filters out null values', () => {
    const spec = makeSpec({
      data: [
        { label: 'Valid', count: 50 },
        { label: 'Null', count: null },
        { label: 'Also valid', count: 25 },
      ],
    });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows).toHaveLength(2);
  });

  it('assigns cycling colors to rows', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    const colors = layout.rows.map((r) => r.bar.fill);
    expect(colors[0]).not.toBe(colors[1]);
    expect(colors[1]).not.toBe(colors[2]);
  });

  it('bar width is proportional to value', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    const maxWidth = layout.rows[0].bar.width;
    const halfWidth = layout.rows[2].bar.width;
    expect(halfWidth).toBeCloseTo(maxWidth * 0.5, 0);
  });

  it('first row gets full-width bar', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    const row0 = layout.rows[0];
    expect(row0.bar.width).toBe(row0.track.width);
  });

  it('pill cornerRadius is half the bar height', () => {
    const spec = makeSpec({ barHeight: 8, cornerRadius: 'pill' });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].bar.cornerRadius).toBe(4);
    expect(layout.rows[0].track.cornerRadius).toBe(4);
  });

  it('numeric cornerRadius is used directly', () => {
    const spec = makeSpec({ cornerRadius: 3 });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].bar.cornerRadius).toBe(3);
  });

  it('default barHeight is 6', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.rows[0].bar.height).toBe(6);
  });

  it('custom barHeight applies', () => {
    const spec = makeSpec({ barHeight: 10 });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].bar.height).toBe(10);
  });

  it('builds tooltip descriptors keyed by row index', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.tooltipDescriptors.size).toBe(4);
    const tooltip = layout.tooltipDescriptors.get('0');
    expect(tooltip?.title).toBe('Alpha');
    expect(tooltip?.fields[0].value).toBeDefined();
  });

  it('builds a11y metadata', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.a11y.altText).toContain('4 items');
    expect(layout.a11y.dataTableFallback).toHaveLength(4);
    expect(layout.a11y.role).toBe('list');
  });

  it('returns animation indices matching row order', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.rows[0].animationIndex).toBe(0);
    expect(layout.rows[1].animationIndex).toBe(1);
    expect(layout.rows[2].animationIndex).toBe(2);
  });

  it('throws when data is empty', () => {
    const spec = makeSpec({ data: [] });
    expect(() => compileBarList(spec, BASE_OPTIONS)).toThrow(/empty/i);
  });

  it('formats values with valueFormat', () => {
    const spec = makeSpec({ valueFormat: '$,.0f' });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].formattedValue).toBe('$100');
  });

  it('formats values with SI suffix format', () => {
    const spec = makeSpec({
      data: [
        { label: 'Big', count: 1500 },
        { label: 'Small', count: 200 },
      ],
      valueFormat: '~s',
    });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].formattedValue).toBe('1.5k');
  });

  it('dark mode changes label colors', () => {
    const lightLayout = compileBarList(makeSpec(), { ...BASE_OPTIONS, darkMode: false });
    const darkLayout = compileBarList(makeSpec(), { ...BASE_OPTIONS, darkMode: true });
    expect(lightLayout.rows[0].valueLabel.style.fill).not.toBe(
      darkLayout.rows[0].valueLabel.style.fill,
    );
  });

  it('rejects non-barlist specs', () => {
    const invalidSpec = {
      type: 'tilemap',
      data: { CA: 100 },
    };
    expect(() => compileBarList(invalidSpec, BASE_OPTIONS)).toThrow('non-barlist');
  });

  it('uses color encoding for consistent category colors', () => {
    const spec = makeSpec({
      data: [
        { label: 'A', count: 100, cat: 'x' },
        { label: 'B', count: 50, cat: 'x' },
        { label: 'C', count: 25, cat: 'y' },
      ],
      encoding: {
        label: { field: 'label', type: 'nominal' },
        value: { field: 'count', type: 'quantitative' },
        color: { field: 'cat', type: 'nominal' },
      },
    });
    const layout = compileBarList(spec, BASE_OPTIONS);
    expect(layout.rows[0].bar.fill).toBe(layout.rows[1].bar.fill);
    expect(layout.rows[0].bar.fill).not.toBe(layout.rows[2].bar.fill);
  });

  it('preserves original data in row marks', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.rows[0].data).toEqual({ label: 'Alpha', count: 100 });
  });

  it('rows have correct aria labels', () => {
    const layout = compileBarList(makeSpec(), BASE_OPTIONS);
    expect(layout.rows[0].aria.label).toContain('Alpha');
  });

  it('chromeLayout: grow returns a taller SVG than subtract for the same spec', () => {
    const chromeSpec = makeSpec({
      chrome: { title: 'Bar list', subtitle: 'Chrome adds height' },
    });
    const subtract = compileBarList({ ...chromeSpec, chromeLayout: 'subtract' }, BASE_OPTIONS);
    const grow = compileBarList({ ...chromeSpec, chromeLayout: 'grow' }, BASE_OPTIONS);

    expect(subtract.height).toBe(BASE_OPTIONS.height);
    expect(grow.height).toBeGreaterThan(subtract.height);
    // Default (omitted) stays subtract.
    const omitted = compileBarList(chromeSpec, BASE_OPTIONS);
    expect(omitted.height).toBe(subtract.height);
  });
});
