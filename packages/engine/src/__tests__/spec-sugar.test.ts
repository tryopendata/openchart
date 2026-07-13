/**
 * Tests for the pre-validation VL-idiom sugar expansion (expandSpecSugar)
 * and its deprecation warnings.
 *
 * Covers: data {values} unwrapping, top-level title/subtitle, bare value
 * defs, channel-level legend, axis: null, scale.scheme resolution, theta as
 * the arc value channel, count-without-field, VL sort forms, width/height
 * fixed sizing, strokeDash on line marks, and the exactly-one-warning
 * contract for v8-deprecated surface (radius/shape/href/order, $schema, the
 * implicit stack default).
 */

import type { LayerSpec, LineMark } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileChart, compileLayer, expandSpecSugar } from '../compile';

const OPTIONS = { width: 600, height: 400 };

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

/** Collect the console.warn messages captured by the spy. */
function warned(): string[] {
  return warnSpy.mock.calls.map((call) => String(call[0]));
}

// ---------------------------------------------------------------------------
// data: { values } unwrapping
// ---------------------------------------------------------------------------

describe('data: { values } unwrapping', () => {
  it('unwraps the VL object form to a bare array', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      data: { values: [{ cat: 'A', value: 1 }] },
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    });
    expect(result.data).toEqual([{ cat: 'A', value: 1 }]);
  });

  it('leaves { url } in place for validation to reject', () => {
    const spec = { mark: 'bar', data: { url: 'https://example.com/data.json' }, encoding: {} };
    const result = expandSpecSugar(spec);
    expect(result.data).toEqual({ url: 'https://example.com/data.json' });
  });
});

// ---------------------------------------------------------------------------
// Top-level title/subtitle
// ---------------------------------------------------------------------------

describe('top-level title/subtitle', () => {
  const base = {
    mark: 'bar',
    data: [{ cat: 'A', value: 1 }],
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };

  it('expands a string title into chrome.title', () => {
    const result = expandSpecSugar({ ...base, title: 'Revenue' });
    expect(result.chrome).toEqual({ title: 'Revenue' });
    expect('title' in result).toBe(false);
  });

  it('expands the { text, subtitle } object form', () => {
    const result = expandSpecSugar({ ...base, title: { text: 'Revenue', subtitle: 'By region' } });
    expect(result.chrome).toEqual({ title: 'Revenue', subtitle: 'By region' });
  });

  it('expands a top-level subtitle', () => {
    const result = expandSpecSugar({ ...base, title: 'Revenue', subtitle: 'By region' });
    expect(result.chrome).toEqual({ title: 'Revenue', subtitle: 'By region' });
  });

  it('authored chrome wins over the expanded title', () => {
    const result = expandSpecSugar({
      ...base,
      title: 'Sugar title',
      chrome: { title: 'Chrome title' },
    });
    expect((result.chrome as Record<string, unknown>).title).toBe('Chrome title');
  });
});

// ---------------------------------------------------------------------------
// Top-level description (alt-text override)
// ---------------------------------------------------------------------------

describe('top-level description', () => {
  const base = {
    mark: 'bar',
    data: [{ cat: 'A', value: 1 }],
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };

  it('folds description into a11y.description', () => {
    const result = expandSpecSugar({ ...base, description: 'Bar chart of one value' });
    expect(result.a11y).toEqual({ description: 'Bar chart of one value' });
    expect('description' in result).toBe(false);
  });

  it('an authored a11y.description wins over the top-level description', () => {
    const result = expandSpecSugar({
      ...base,
      description: 'Sugar text',
      a11y: { description: 'Authored text' },
    });
    expect((result.a11y as Record<string, unknown>).description).toBe('Authored text');
  });

  it('preserves other a11y fields when folding', () => {
    const result = expandSpecSugar({ ...base, description: 'Alt', a11y: { hidden: true } });
    expect(result.a11y).toEqual({ description: 'Alt', hidden: true });
  });
});

// ---------------------------------------------------------------------------
// Bare value defs
// ---------------------------------------------------------------------------

describe('bare value defs', () => {
  it('moves color: { value } to mark.fill for bar marks', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { value: '#1b7fa3' },
      },
    });
    expect(result.mark).toEqual({ type: 'bar', fill: '#1b7fa3' });
    expect((result.encoding as Record<string, unknown>).color).toBeUndefined();
  });

  it('moves color: { value } to mark.stroke for line marks', () => {
    const result = expandSpecSugar({
      mark: 'line',
      data: [{ date: '2020-01-01', value: 1 }],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { value: '#1b7fa3' },
      },
    });
    expect(result.mark).toEqual({ type: 'line', stroke: '#1b7fa3' });
  });

  it('moves size and opacity values to mark-level properties', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        size: { value: 20 },
        opacity: { value: 0.5 },
      },
    });
    expect(result.mark).toEqual({ type: 'bar', size: 20, opacity: 0.5 });
  });

  it('explicit mark-level values win over expanded channel constants', () => {
    const result = expandSpecSugar({
      mark: { type: 'bar', fill: '#explicit' },
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { value: '#sugar' },
      },
    });
    expect((result.mark as Record<string, unknown>).fill).toBe('#explicit');
  });

  it('leaves conditional value defs untouched', () => {
    const color = { condition: { test: { field: 'value', gt: 0 }, value: 'red' }, value: 'gray' };
    const result = expandSpecSugar({
      mark: 'bar',
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color,
      },
    });
    expect((result.encoding as Record<string, unknown>).color).toEqual(color);
  });
});

// ---------------------------------------------------------------------------
// Channel-level legend
// ---------------------------------------------------------------------------

describe('channel-level legend on color', () => {
  const base = {
    mark: 'line',
    data: [
      { date: '2020-01-01', value: 1, group: 'A' },
      { date: '2021-01-01', value: 2, group: 'A' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };

  it('legend: null hides the legend via the top-level config', () => {
    const result = expandSpecSugar({
      ...base,
      encoding: {
        ...base.encoding,
        color: { field: 'group', type: 'nominal', legend: null },
      },
    });
    expect(result.legend).toEqual({ show: false });
    expect((result.encoding as Record<string, Record<string, unknown>>).color.legend).toBe(
      undefined,
    );
  });

  it('a channel legend config merges into the top-level legend, top level winning', () => {
    const result = expandSpecSugar({
      ...base,
      legend: { position: 'bottom' },
      encoding: {
        ...base.encoding,
        color: { field: 'group', type: 'nominal', legend: { position: 'top', columns: 2 } },
      },
    });
    expect(result.legend).toEqual({ position: 'bottom', columns: 2 });
  });
});

// ---------------------------------------------------------------------------
// axis: null and scale.scheme
// ---------------------------------------------------------------------------

describe('axis: null and scale.scheme', () => {
  it('converts axis: null to axis: false', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal', axis: null },
        y: { field: 'value', type: 'quantitative' },
      },
    });
    expect((result.encoding as Record<string, Record<string, unknown>>).x.axis).toBe(false);
  });

  it('resolves scheme names (including VL aliases) to scale.range', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'value', type: 'quantitative', scale: { scheme: 'blues' } },
      },
    });
    const colorScale = (result.encoding as Record<string, Record<string, unknown>>).color
      .scale as Record<string, unknown>;
    expect(colorScale.scheme).toBeUndefined();
    expect(Array.isArray(colorScale.range)).toBe(true);
    expect((colorScale.range as string[]).length).toBeGreaterThan(2);
  });

  it('leaves unknown scheme names for validation, which rejects with the supported list', () => {
    expect(() =>
      compileChart(
        {
          mark: 'bar',
          data: [{ cat: 'A', value: 1 }],
          encoding: {
            x: { field: 'cat', type: 'nominal' },
            y: { field: 'value', type: 'quantitative' },
            color: { field: 'value', type: 'quantitative', scale: { scheme: 'viridis' } },
          },
        },
        OPTIONS,
      ),
    ).toThrow(/not a supported scheme name/);
  });
});

// ---------------------------------------------------------------------------
// theta as the arc value channel
// ---------------------------------------------------------------------------

describe('theta on arc marks', () => {
  const data = [
    { category: 'A', amount: 30 },
    { category: 'B', amount: 70 },
  ];

  it('uses theta as the value channel when y is absent (no warning)', () => {
    const layout = compileChart(
      {
        mark: 'arc',
        data,
        encoding: {
          theta: { field: 'amount', type: 'quantitative' },
          color: { field: 'category', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    const arcs = layout.marks.filter((m) => m.type === 'arc');
    expect(arcs.length).toBe(2);
    expect(warned()).toEqual([]);
  });

  it('warns and uses theta when both y and theta are present (theta wins)', () => {
    const layout = compileChart(
      {
        mark: 'arc',
        data,
        encoding: {
          y: { field: 'amount', type: 'quantitative' },
          theta: { field: 'amount', type: 'quantitative' },
          color: { field: 'category', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    const messages = warned().filter((m) => m.includes('encoding.theta'));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('theta wins');
    const arcs = layout.marks.filter((m) => m.type === 'arc');
    expect(arcs.length).toBe(2);
  });

  it('warns when y is used as a deprecated alias for theta on arc marks', () => {
    const layout = compileChart(
      {
        mark: 'arc',
        data,
        encoding: {
          y: { field: 'amount', type: 'quantitative' },
          color: { field: 'category', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    const messages = warned().filter((m) => m.includes('encoding.y on arc'));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('encoding.theta');
    const arcs = layout.marks.filter((m) => m.type === 'arc');
    expect(arcs.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// aggregate: 'count' without a field
// ---------------------------------------------------------------------------

describe('count aggregate without a field', () => {
  it('desugars to an aggregate transform grouped by the other channels', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      data: [
        { cat: 'A', v: 1 },
        { cat: 'A', v: 2 },
        { cat: 'B', v: 3 },
      ],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { aggregate: 'count', type: 'quantitative' },
      },
    });
    expect(result.transform).toEqual([
      { aggregate: [{ op: 'count', field: '__count', as: '__count' }], groupby: ['cat'] },
    ]);
    expect((result.encoding as Record<string, unknown>).y).toEqual({
      field: '__count',
      type: 'quantitative',
      title: 'Count',
    });
  });

  it('compiles the count spec with row counts as values', () => {
    const layout = compileChart(
      {
        mark: 'bar',
        data: [
          { cat: 'A', v: 1 },
          { cat: 'A', v: 2 },
          { cat: 'B', v: 3 },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { aggregate: 'count' },
        },
      },
      OPTIONS,
    );
    expect(layout.marks.filter((m) => m.type === 'rect')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// VL sort forms
// ---------------------------------------------------------------------------

describe('VL sort forms', () => {
  const data = [
    { cat: 'A', value: 20 },
    { cat: 'B', value: 50 },
    { cat: 'C', value: 10 },
  ];
  const base = {
    mark: 'bar',
    data,
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };

  function domainFor(sort: unknown): unknown {
    const result = expandSpecSugar({
      ...base,
      encoding: {
        ...base.encoding,
        x: { ...base.encoding.x, sort },
      },
    });
    const x = (result.encoding as Record<string, Record<string, unknown>>).x;
    expect(x.sort).toBeUndefined();
    return (x.scale as Record<string, unknown> | undefined)?.domain;
  }

  it("resolves sort: '-y' to a value-descending domain", () => {
    expect(domainFor('-y')).toEqual(['B', 'A', 'C']);
  });

  it("resolves sort: 'y' to a value-ascending domain", () => {
    expect(domainFor('y')).toEqual(['C', 'A', 'B']);
  });

  it('resolves a value-array sort with unlisted values appended in data order', () => {
    expect(domainFor(['C', 'B'])).toEqual(['C', 'B', 'A']);
  });

  it('resolves the { field, op, order } object form', () => {
    expect(domainFor({ field: 'value', op: 'max', order: 'descending' })).toEqual(['B', 'A', 'C']);
  });

  it('sums duplicate category values before comparing (VL default op)', () => {
    const result = expandSpecSugar({
      ...base,
      data: [
        { cat: 'A', value: 10 },
        { cat: 'A', value: 45 },
        { cat: 'B', value: 50 },
      ],
      encoding: {
        ...base.encoding,
        x: { ...base.encoding.x, sort: '-y' },
      },
    });
    const x = (result.encoding as Record<string, Record<string, unknown>>).x;
    expect((x.scale as Record<string, unknown>).domain).toEqual(['A', 'B']);
  });

  it('drops the sort when an explicit scale.domain is present', () => {
    const result = expandSpecSugar({
      ...base,
      encoding: {
        ...base.encoding,
        x: { ...base.encoding.x, sort: '-y', scale: { domain: ['C', 'B', 'A'] } },
      },
    });
    const x = (result.encoding as Record<string, Record<string, unknown>>).x;
    expect(x.sort).toBeUndefined();
    expect((x.scale as Record<string, unknown>).domain).toEqual(['C', 'B', 'A']);
  });

  it('passes canonical ascending/descending/null values through untouched', () => {
    const result = expandSpecSugar({
      ...base,
      encoding: {
        ...base.encoding,
        x: { ...base.encoding.x, sort: 'descending' },
      },
    });
    expect((result.encoding as Record<string, Record<string, unknown>>).x.sort).toBe('descending');
  });
});

// ---------------------------------------------------------------------------
// width/height fixed sizing
// ---------------------------------------------------------------------------

describe('top-level width/height', () => {
  it('overrides the container-derived compile dimensions', () => {
    const layout = compileChart(
      {
        mark: 'bar',
        width: 400,
        height: 300,
        data: [{ cat: 'A', value: 1 }],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      },
      { width: 800, height: 600 },
    );
    expect(layout.dimensions).toEqual({ width: 400, height: 300 });
  });

  it('implies responsive: false when both width and height are set', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      width: 400,
      height: 300,
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    });
    expect(result.responsive).toBe(false);
  });

  it('respects an explicit responsive value', () => {
    const result = expandSpecSugar({
      mark: 'bar',
      width: 400,
      height: 300,
      responsive: true,
      data: [{ cat: 'A', value: 1 }],
      encoding: {
        x: { field: 'cat', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    });
    expect(result.responsive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// strokeDash on line marks
// ---------------------------------------------------------------------------

describe('strokeDash on line marks', () => {
  const data = [
    { date: '2020-01-01', value: 1, scenario: 'actual' },
    { date: '2021-01-01', value: 2, scenario: 'actual' },
    { date: '2020-01-01', value: 1.5, scenario: 'forecast' },
    { date: '2021-01-01', value: 3, scenario: 'forecast' },
  ];

  it('assigns dash patterns per series when strokeDash matches the color field', () => {
    const layout = compileChart(
      {
        mark: 'line',
        data,
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'scenario', type: 'nominal' },
          strokeDash: { field: 'scenario', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    const lines = layout.marks.filter((m): m is LineMark => m.type === 'line');
    expect(lines).toHaveLength(2);
    const byKey = new Map(lines.map((l) => [l.seriesKey, l.strokeDasharray]));
    expect(byKey.get('actual')).toBeUndefined(); // first value renders solid
    expect(byKey.get('forecast')).toBe('6 4');
  });

  it('groups by the strokeDash field when no color channel is present', () => {
    const layout = compileChart(
      {
        mark: 'line',
        data,
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          strokeDash: { field: 'scenario', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    const lines = layout.marks.filter((m): m is LineMark => m.type === 'line');
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.strokeDasharray)).toEqual([undefined, '6 4']);
  });
});

// ---------------------------------------------------------------------------
// Deprecation warnings (v8 clock)
// ---------------------------------------------------------------------------

describe('deprecation warnings', () => {
  const base = {
    mark: 'bar',
    data: [{ cat: 'A', value: 1 }],
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };

  it.each([
    'radius',
    'shape',
    'href',
    'order',
  ] as const)('warns exactly once for the removed %s channel, naming v8', (channel) => {
    compileChart(
      {
        ...base,
        encoding: { ...base.encoding, [channel]: { field: 'value', type: 'quantitative' } },
      },
      OPTIONS,
    );
    const messages = warned().filter((m) => m.includes(`encoding.${channel}`));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('removed in v8');
  });

  it('warns once for $schema and strips it', () => {
    const result = expandSpecSugar({
      ...base,
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    });
    expect('$schema' in result).toBe(false);
    compileChart({ ...base, $schema: 'https://vega.github.io/schema/vega-lite/v5.json' }, OPTIONS);
    expect(warned().filter((m) => m.includes('$schema'))).toHaveLength(1);
  });

  it('warns once when a multi-series bar relies on the implicit stack default', () => {
    compileChart(
      {
        mark: 'bar',
        data: [
          { cat: 'A', value: 1, group: 'g1' },
          { cat: 'A', value: 2, group: 'g2' },
          { cat: 'B', value: 3, group: 'g1' },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'group', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    const messages = warned().filter((m) => m.includes('stack'));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('stacked');
  });

  it('warns for a multi-series area relying on the implicit stack default', () => {
    compileChart(
      {
        mark: 'area',
        data: [
          { date: '2020-01-01', value: 1, group: 'g1' },
          { date: '2020-01-01', value: 2, group: 'g2' },
          { date: '2021-01-01', value: 3, group: 'g1' },
          { date: '2021-01-01', value: 4, group: 'g2' },
        ],
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'group', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    expect(warned().filter((m) => m.includes('stack'))).toHaveLength(1);
  });

  it('does not warn when stack is set explicitly', () => {
    compileChart(
      {
        mark: 'bar',
        data: [
          { cat: 'A', value: 1, group: 'g1' },
          { cat: 'A', value: 2, group: 'g2' },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { field: 'value', type: 'quantitative', stack: 'zero' },
          color: { field: 'group', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    expect(warned().filter((m) => m.includes('stack'))).toHaveLength(0);
  });

  it('does not warn for single-row-per-category colored bars', () => {
    compileChart(
      {
        mark: 'bar',
        data: [
          { cat: 'A', value: 1, group: 'g1' },
          { cat: 'B', value: 2, group: 'g2' },
        ],
        encoding: {
          x: { field: 'cat', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'group', type: 'nominal' },
        },
      },
      OPTIONS,
    );
    expect(warned().filter((m) => m.includes('stack'))).toHaveLength(0);
  });

  it("warns once for the deprecated 'rule' annotation type, naming the refline replacement", () => {
    compileChart(
      {
        ...base,
        annotations: [{ type: 'rule', y: 1, label: 'target' }],
      },
      OPTIONS,
    );
    const messages = warned().filter((m) => m.includes("annotation type 'rule'"));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("'refline'");
  });

  it("does not warn for the canonical 'refline' annotation type", () => {
    compileChart(
      {
        ...base,
        annotations: [{ type: 'refline', y: 1, label: 'target' }],
      },
      OPTIONS,
    );
    expect(warned().filter((m) => m.includes("annotation type 'rule'"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Layer specs
// ---------------------------------------------------------------------------

describe('layer specs', () => {
  it('applies sugar to layer children (value def, data values, sort)', () => {
    const layout = compileLayer(
      {
        data: {
          values: [
            { cat: 'A', value: 20 },
            { cat: 'B', value: 50 },
            { cat: 'C', value: 10 },
          ],
        },
        layer: [
          {
            mark: 'bar',
            encoding: {
              x: { field: 'cat', type: 'nominal', sort: '-y' },
              y: { field: 'value', type: 'quantitative' },
              color: { value: '#1b7fa3' },
            },
          },
        ],
      } as unknown as LayerSpec,
      OPTIONS,
    );
    // Sorted domain: B (50), A (20), C (10)
    expect(layout.axes.x?.ticks.map((t) => t.label)).toEqual(['B', 'A', 'C']);
    const rects = layout.marks.filter((m) => m.type === 'rect');
    expect(rects).toHaveLength(3);
    for (const rect of rects) {
      expect((rect as { fill?: unknown }).fill).toBe('#1b7fa3');
    }
  });

  it('emits each deprecation warning once per compile even across layer children', () => {
    compileLayer(
      {
        data: [
          { cat: 'A', value: 1 },
          { cat: 'B', value: 2 },
        ],
        layer: [
          {
            mark: 'bar',
            encoding: {
              x: { field: 'cat', type: 'nominal' },
              y: { field: 'value', type: 'quantitative' },
              href: { field: 'cat', type: 'nominal' },
            },
          },
          {
            mark: 'line',
            encoding: {
              x: { field: 'cat', type: 'ordinal' },
              y: { field: 'value', type: 'quantitative' },
              href: { field: 'cat', type: 'nominal' },
            },
          },
        ],
      } as unknown as LayerSpec,
      OPTIONS,
    );
    expect(warned().filter((m) => m.includes('encoding.href'))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// options.onWarn sink (isomorphic warning routing, no hardcoded console)
// ---------------------------------------------------------------------------

describe('options.onWarn warning sink', () => {
  const deprecated = {
    mark: 'bar',
    data: [{ cat: 'A', value: 1 }],
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      // A dead v8 channel: guaranteed to produce a deprecation warning.
      href: { field: 'value', type: 'quantitative' },
    },
  };

  it('routes warnings to a host-provided sink instead of console.warn', () => {
    const sink: string[] = [];
    compileChart(deprecated, { ...OPTIONS, onWarn: (m) => sink.push(m) });

    // The warning reached the sink...
    expect(sink.some((m) => m.includes('encoding.href'))).toBe(true);
    // ...and console.warn was NOT touched (the spy caught nothing).
    expect(warned().filter((m) => m.includes('encoding.href'))).toEqual([]);
  });

  it('a no-op sink silences warnings entirely (e.g. SSR)', () => {
    compileChart(deprecated, { ...OPTIONS, onWarn: () => {} });
    expect(warned()).toEqual([]);
  });

  it('falls back to console.warn when no sink is provided', () => {
    compileChart(deprecated, OPTIONS);
    expect(warned().some((m) => m.includes('encoding.href'))).toBe(true);
  });
});
