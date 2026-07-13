import type { ChartSpec, LayerSpec, PointMark, TextMarkLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../../../compile';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * Ten US states, GDP (trillions) vs population (millions). The low end clusters
 * tightly, which is what made the scale-domain bug so visible: the further a
 * point sat from the shared upper bound, the further its label drifted.
 */
const states = [
  { label: 'CA', gdp: 3.9, pop: 39.0 },
  { label: 'TX', gdp: 2.6, pop: 30.5 },
  { label: 'NY', gdp: 2.1, pop: 19.6 },
  { label: 'FL', gdp: 1.6, pop: 22.6 },
  { label: 'IL', gdp: 1.1, pop: 12.5 },
  { label: 'PA', gdp: 1.0, pop: 12.9 },
  { label: 'OH', gdp: 0.9, pop: 11.8 },
  { label: 'GA', gdp: 0.8, pop: 11.0 },
  { label: 'NJ', gdp: 0.8, pop: 9.3 },
  { label: 'WA', gdp: 0.8, pop: 7.8 },
];

/** A points layer plus a text layer, both encoding the *same* x/y fields. */
function labeledScatter(textMark: ChartSpec['mark'] = { type: 'text' }): LayerSpec {
  return {
    layer: [
      {
        mark: { type: 'point' },
        data: [...states],
        encoding: {
          x: { field: 'gdp', type: 'quantitative' },
          y: { field: 'pop', type: 'quantitative' },
        },
      },
      {
        mark: textMark,
        data: [...states],
        encoding: {
          x: { field: 'gdp', type: 'quantitative' },
          y: { field: 'pop', type: 'quantitative' },
          text: { field: 'label', type: 'nominal' },
        },
      },
    ],
  };
}

function textMarksOf(spec: ChartSpec): TextMarkLayout[] {
  const layout = compileChart(spec, { width: 900, height: 500 });
  return layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');
}

/** Standalone text chart over the states, with an overridable mark def. */
function textChart(mark: ChartSpec['mark'] = { type: 'text' }): ChartSpec {
  return {
    mark,
    data: [...states],
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'pop', type: 'quantitative' },
      text: { field: 'label', type: 'nominal' },
    },
  };
}

// ---------------------------------------------------------------------------
// Scale alignment
// ---------------------------------------------------------------------------

describe('text marks in a layer', () => {
  /**
   * Regression: text is a position-encoding mark, so it must resolve its domain
   * the same way `point`/`beeswarm`/`range` do (tight, not zero-anchored). When
   * it didn't, a text layer and a point layer over identical fields resolved
   * *different* domains across the same pixel range, and every label drifted off
   * the dot it was labeling — by up to 160px at the low end of the domain.
   */
  it('positions each label exactly on the point it labels', () => {
    const layout = compileLayer(labeledScatter(), { width: 900, height: 500 });

    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    const texts = layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

    expect(points).toHaveLength(states.length);
    expect(texts).toHaveLength(states.length);

    for (const text of texts) {
      const point = points.find((p) => p.data?.label === text.text);
      expect(point, `no point for label ${text.text}`).toBeDefined();

      expect(text.x).toBeCloseTo((point as PointMark).cx, 5);
      expect(text.y).toBeCloseTo((point as PointMark).cy, 5);
    }
  });

  it('offsets labels off their points by exactly dy, keeping x aligned', () => {
    const layout = compileLayer(labeledScatter({ type: 'text', dy: -10 }), {
      width: 900,
      height: 500,
    });

    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    const texts = layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

    for (const text of texts) {
      const point = points.find((p) => p.data?.label === text.text) as PointMark;
      expect(text.x).toBeCloseTo(point.cx, 5);
      expect(text.y).toBeCloseTo(point.cy - 10, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// Offsets
// ---------------------------------------------------------------------------

describe('dx / dy', () => {
  it('bakes the offset into x/y and retains the pre-offset anchor', () => {
    const plain = textMarksOf(textChart());
    const offset = textMarksOf(textChart({ type: 'text', dx: 6, dy: -10 }));

    for (let i = 0; i < plain.length; i++) {
      expect(offset[i].x).toBeCloseTo(plain[i].x + 6, 5);
      expect(offset[i].y).toBeCloseTo(plain[i].y - 10, 5);
      // The anchor is what a leader line would point back to.
      expect(offset[i].anchorX).toBeCloseTo(plain[i].x, 5);
      expect(offset[i].anchorY).toBeCloseTo(plain[i].y, 5);
    }
  });

  it('leaves the anchor unset when the mark is not offset', () => {
    for (const mark of textMarksOf(textChart())) {
      expect(mark.anchorX).toBeUndefined();
      expect(mark.anchorY).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Alignment / baseline
// ---------------------------------------------------------------------------

describe('align and baseline', () => {
  it('centers on the data point by default', () => {
    for (const mark of textMarksOf(textChart())) {
      expect(mark.textAnchor).toBe('middle');
      expect(mark.dominantBaseline).toBe('central');
    }
  });

  it('maps align/baseline onto SVG anchor and baseline', () => {
    const marks = textMarksOf(textChart({ type: 'text', align: 'left', baseline: 'top' }));
    for (const mark of marks) {
      expect(mark.textAnchor).toBe('start');
      expect(mark.dominantBaseline).toBe('hanging');
    }
  });
});

// ---------------------------------------------------------------------------
// Size channel
// ---------------------------------------------------------------------------

describe('size channel', () => {
  const sized = (): ChartSpec => ({
    mark: { type: 'text' },
    data: [...states],
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'pop', type: 'quantitative' },
      text: { field: 'label', type: 'nominal' },
      size: { field: 'gdp', type: 'quantitative' },
    },
  });

  it('maps the size field linearly onto the default font range', () => {
    const marks = textMarksOf(sized());
    const byLabel = new Map(marks.map((m) => [m.text, m]));

    // gdp spans 0.8 (WA) to 3.9 (CA) -> the default 11..32px range.
    expect(byLabel.get('WA')?.fontSize).toBeCloseTo(11, 5);
    expect(byLabel.get('CA')?.fontSize).toBeCloseTo(32, 5);

    // Linear, not sqrt: interior values interpolate proportionally. A sqrt scale
    // would land NY well above this.
    const ny = byLabel.get('NY') as TextMarkLayout; // gdp 2.1
    const expectedNy = 11 + (32 - 11) * ((2.1 - 0.8) / (3.9 - 0.8));
    expect(ny.fontSize).toBeCloseTo(expectedNy, 5);
  });

  it('honors an explicit scale range', () => {
    const spec = sized();
    (spec.encoding.size as { scale?: unknown }).scale = { range: [10, 20] };

    const marks = textMarksOf(spec);
    const byLabel = new Map(marks.map((m) => [m.text, m]));
    expect(byLabel.get('WA')?.fontSize).toBeCloseTo(10, 5);
    expect(byLabel.get('CA')?.fontSize).toBeCloseTo(20, 5);
  });

  it('falls back to mark.fontSize when there is no size encoding', () => {
    for (const mark of textMarksOf(textChart({ type: 'text', fontSize: 14 }))) {
      expect(mark.fontSize).toBe(14);
    }
  });

  it('defaults to 12px with no size encoding and no fontSize', () => {
    for (const mark of textMarksOf(textChart())) {
      expect(mark.fontSize).toBe(12);
    }
  });
});

// ---------------------------------------------------------------------------
// Subset label layers
// ---------------------------------------------------------------------------

describe('a label layer over a subset of the points', () => {
  /**
   * Direct labeling usually names only the notable points, so the text layer
   * carries fewer rows than the point layer. The two must still resolve the same
   * domain — a subset must not re-fit the scale to its own narrower extent.
   */
  it('keeps subset labels aligned with the full point layer', () => {
    const labeled = new Set(['CA', 'TX', 'NY', 'FL', 'IL', 'WA']);
    const spec: LayerSpec = {
      layer: [
        {
          mark: { type: 'point' },
          data: [...states],
          encoding: {
            x: { field: 'gdp', type: 'quantitative' },
            y: { field: 'pop', type: 'quantitative' },
          },
        },
        {
          mark: { type: 'text', dy: -14 },
          data: states.filter((d) => labeled.has(d.label)),
          encoding: {
            x: { field: 'gdp', type: 'quantitative' },
            y: { field: 'pop', type: 'quantitative' },
            text: { field: 'label', type: 'nominal' },
          },
        },
      ],
    };

    const layout = compileLayer(spec, { width: 900, height: 500 });
    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    const texts = layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

    expect(points).toHaveLength(states.length);
    expect(texts).toHaveLength(labeled.size);

    for (const text of texts) {
      const point = points.find((p) => p.data?.label === text.text) as PointMark;
      expect(text.x).toBeCloseTo(point.cx, 5);
      expect(text.y).toBeCloseTo(point.cy - 14, 5);
    }
  });
});

describe('a subset whose extent is narrower than the point layer', () => {
  /**
   * Dropping the min-x row from the label layer narrows *its* data extent. If
   * each leaf resolves its own domain, the label layer re-fits [1.1, 3.9] while
   * the points keep [0.8, 3.9], and every label slides left off its dot.
   */
  it('still aligns when the label subset omits the extreme point', () => {
    const labeled = new Set(['CA', 'TX', 'NY', 'FL', 'IL']); // no WA (the min gdp)
    const spec: LayerSpec = {
      layer: [
        {
          mark: { type: 'point' },
          data: [...states],
          encoding: {
            x: { field: 'gdp', type: 'quantitative' },
            y: { field: 'pop', type: 'quantitative' },
          },
        },
        {
          mark: { type: 'text' },
          data: states.filter((d) => labeled.has(d.label)),
          encoding: {
            x: { field: 'gdp', type: 'quantitative' },
            y: { field: 'pop', type: 'quantitative' },
            text: { field: 'label', type: 'nominal' },
          },
        },
      ],
    };

    const layout = compileLayer(spec, { width: 900, height: 500 });
    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    const texts = layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

    for (const text of texts) {
      const point = points.find((p) => p.data?.label === text.text) as PointMark;
      expect(text.x, `label ${text.text} drifted in x`).toBeCloseTo(point.cx, 5);
      expect(text.y, `label ${text.text} drifted in y`).toBeCloseTo(point.cy, 5);
    }
  });
});
