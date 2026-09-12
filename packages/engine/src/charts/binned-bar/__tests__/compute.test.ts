/**
 * Binned bar (histogram) mark tests.
 *
 * These compile through the real `compileChart` rather than calling the
 * compute function directly, because most of what can go wrong here lives in
 * the seams: the bin sugar emitting a paired `as`, the count aggregate
 * grouping by both bin edges, the scale covering the last bin's end, and the
 * renderer dispatch picking `'bar:binned'` at all.
 */

import type { ChartLayout, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';

import { compileChart } from '../../../compile';

/** Deterministic spread over [0, 1000) so bin widths are predictable. */
function values(n: number, min: number, span: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(min + ((i * 37) % span));
  return out;
}

function donations(n = 200, min = 0, span = 1000): Array<Record<string, unknown>> {
  return values(n, min, span).map((amount, i) => ({
    amount,
    candidate: i % 2 === 0 ? 'Talarico' : 'Paxton',
  }));
}

type Spec = Record<string, unknown>;

function histogram(overrides: Spec = {}, data = donations()): Spec {
  const { encoding, ...rest } = overrides as { encoding?: Record<string, unknown> };
  return {
    type: 'chart',
    mark: 'bar',
    data,
    encoding: {
      x: { field: 'amount', type: 'quantitative', bin: { maxbins: 20 } },
      y: { aggregate: 'count' },
      ...encoding,
    },
    ...rest,
  };
}

function compile(spec: Spec): ChartLayout {
  return compileChart(spec, { width: 640, height: 400 });
}

function barsOf(spec: Spec): RectMark[] {
  return compile(spec).marks.filter((m): m is RectMark => m.type === 'rect');
}

describe('binned bar (histogram)', () => {
  it('renders bars from a raw quantitative field plus a count aggregate', () => {
    const bars = barsOf(histogram());
    expect(bars.length).toBeGreaterThan(0);
  });

  it('gives every bin the same pixel width', () => {
    const widths = barsOf(histogram()).map((b) => b.width);
    const min = Math.min(...widths);
    const max = Math.max(...widths);
    expect(max - min).toBeLessThan(1);
  });

  it('scales bin width to the value range, not the bin count', () => {
    // Same bin count over twice the span: each bin covers twice the data, so
    // the pixel width per unit halves while the bar count is unchanged.
    const narrow = barsOf(histogram({}, donations(200, 0, 100)));
    const wide = barsOf(histogram({}, donations(200, 0, 1000)));
    expect(wide.length).toBeGreaterThan(0);
    // The x-axis rescales, so both fill the plot: the invariant is that the
    // bars span the plot in both cases rather than bunching at one end.
    const spanOf = (bars: RectMark[]) =>
      Math.max(...bars.map((b) => b.x + b.width)) - Math.min(...bars.map((b) => b.x));
    expect(spanOf(narrow)).toBeGreaterThan(300);
    expect(spanOf(wide)).toBeGreaterThan(300);
  });

  it('overlaps color groups at the same x instead of dodging them', () => {
    const bars = barsOf(histogram({ encoding: { color: { field: 'candidate' } } }));
    const talarico = bars.filter((b) => b.seriesKey === 'Talarico');
    const paxton = bars.filter((b) => b.seriesKey === 'Paxton');
    expect(talarico.length).toBeGreaterThan(0);
    expect(paxton.length).toBeGreaterThan(0);

    // Every Paxton bar shares an x with some Talarico bar (identity position).
    for (const p of paxton) {
      expect(talarico.some((t) => Math.abs(t.x - p.x) < 0.5)).toBe(true);
    }
  });

  it('drops fill opacity so overlapping distributions stay readable', () => {
    const bars = barsOf(histogram({ encoding: { color: { field: 'candidate' } } }));
    expect(bars.every((b) => b.fillOpacity === 0.55)).toBe(true);
  });

  it('leaves a single distribution fully opaque', () => {
    // No fill-opacity attribute at all, so an ordinary bar's SVG is unchanged.
    expect(barsOf(histogram()).every((b) => b.fillOpacity === undefined)).toBe(true);
  });

  it('honors an explicit mark.fillOpacity over the overlap default', () => {
    const bars = barsOf(
      histogram({
        mark: { type: 'bar', fillOpacity: 0.3 },
        encoding: { color: { field: 'candidate' } },
      }),
    );
    expect(bars.every((b) => b.fillOpacity === 0.3)).toBe(true);
  });

  it('stacks instead of overlapping when stack is explicitly enabled', () => {
    const bars = barsOf(
      histogram({
        encoding: {
          y: { aggregate: 'count', stack: true },
          color: { field: 'candidate' },
        },
      }),
    );
    expect(bars.length).toBeGreaterThan(0);
    // Stacked segments are opaque and carry a stack group.
    expect(bars.every((b) => b.fillOpacity === undefined)).toBe(true);
    expect(bars.every((b) => b.stackGroup !== undefined)).toBe(true);

    // Within a bin, the two segments must not overlap vertically.
    const byBin = new Map<string, RectMark[]>();
    for (const b of bars) {
      const list = byBin.get(b.stackGroup!) ?? [];
      list.push(b);
      byBin.set(b.stackGroup!, list);
    }
    for (const segs of byBin.values()) {
      if (segs.length < 2) continue;
      const sorted = [...segs].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].y + 0.5).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].height);
      }
    }
  });

  it('extends the x domain to cover the last bin end', () => {
    const layout = compile(histogram());
    const bars = layout.marks.filter((m): m is RectMark => m.type === 'rect');
    const right = Math.max(...bars.map((b) => b.x + b.width));
    expect(right).toBeLessThanOrEqual(layout.area.x + layout.area.width + 0.5);
  });

  it('does not pad the binned axis out to zero', () => {
    // Scores in [400, 800]: a zero-anchored domain would push every bar into
    // the right half of the plot.
    const bars = barsOf(histogram({}, donations(200, 400, 400)));
    const left = Math.min(...bars.map((b) => b.x));
    const layout = compile(histogram({}, donations(200, 400, 400)));
    const plotMid = layout.area.x + layout.area.width / 2;
    expect(left).toBeLessThan(plotMid);
  });

  it('announces itself as a histogram of the original field, not a bar chart', () => {
    // The mark is desugared to `bar` and the x field is the bin-start output,
    // so without special-casing both, the alt text would read
    // "Bar chart" over a field called "bin_amount".
    const alt = compile(histogram()).a11y.altText;
    expect(alt).toContain('Histogram');
    expect(alt).toContain('amount');
    expect(alt).not.toContain('bin_amount');
  });

  it('shows the bin range in the tooltip, not the bin start value', () => {
    const layout = compile(histogram());
    const tooltip = layout.tooltipDescriptors.get('rect-0');
    expect(tooltip?.title).toContain('–');
  });

  it('still routes an ordinal binned x to the band bar path', () => {
    // Regression guard on the sugar change: only a quantitative x on a bar
    // gains the paired bin output and the x2 channel.
    const bars = barsOf({
      type: 'chart',
      mark: 'bar',
      data: donations(),
      encoding: {
        x: { field: 'amount', type: 'ordinal', bin: { maxbins: 10 } },
        y: { aggregate: 'count' },
      },
    });
    expect(bars.length).toBeGreaterThan(0);
  });
});

describe("mark: 'histogram' sugar", () => {
  it('compiles to the same marks as the canonical bar + bin + count spec', () => {
    const sugar = barsOf({
      type: 'chart',
      mark: { type: 'histogram', binCount: 20 },
      data: donations(),
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        color: { field: 'candidate', type: 'nominal' },
      },
    });
    const canonical = barsOf(
      histogram({ encoding: { color: { field: 'candidate', type: 'nominal' } } }),
    );
    expect(sugar.map((b) => [b.x, b.y, b.width, b.height, b.fillOpacity])).toEqual(
      canonical.map((b) => [b.x, b.y, b.width, b.height, b.fillOpacity]),
    );
  });

  it('bins on a continuous axis even when x.type is left to inference', () => {
    // The canonical spelling the docs advertise. Without type inference here
    // the channel falls through to a band scale labelled with raw bin edges.
    const bars = barsOf({
      type: 'chart',
      mark: 'bar',
      data: donations(),
      encoding: {
        x: { field: 'amount', bin: { maxbins: 20 } },
        y: { aggregate: 'count' },
      },
    });
    expect(bars.length).toBeGreaterThan(0);
    expect(bars[0].width).toBeCloseTo(bars[1].width, 5);
  });

  it('defaults to 20 bins when binCount is omitted', () => {
    const bars = barsOf({
      type: 'chart',
      mark: 'histogram',
      data: donations(),
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    });
    expect(bars.length).toBeLessThanOrEqual(20);
    expect(bars.length).toBeGreaterThan(10);
  });

  it('respects an explicit y over the count sugar', () => {
    const data = donations().map((d) => ({ ...d, weight: 2 }));
    const bars = barsOf({
      type: 'chart',
      mark: { type: 'histogram', binCount: 10 },
      data,
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        y: { field: 'weight', aggregate: 'sum' },
      },
    });
    expect(bars.length).toBeGreaterThan(0);
  });

  it('makes two differently sized groups comparable when normalized', () => {
    const data = [
      ...values(300, 0, 400).map((amount) => ({ amount, candidate: 'Talarico' })),
      ...values(60, 600, 400).map((amount) => ({ amount, candidate: 'Paxton' })),
    ];
    const layout = compile({
      type: 'chart',
      mark: { type: 'histogram', binCount: 20, normalize: true },
      data,
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        color: { field: 'candidate', type: 'nominal' },
      },
    });
    const bars = layout.marks.filter((m): m is RectMark => m.type === 'rect');
    const totals = new Map<string, number>();
    for (const bar of bars) {
      const row = bar.data as Record<string, unknown> | undefined;
      const share = Number(row?.__proportion ?? 0);
      const key = String(bar.seriesKey ?? '');
      totals.set(key, (totals.get(key) ?? 0) + share);
    }
    expect(totals.size).toBe(2);
    for (const total of totals.values()) expect(total).toBeCloseTo(1, 6);
  });
});

describe('log-spaced histogram', () => {
  /** Skewed data spanning several orders of magnitude (campaign contributions). */
  function skewedDonations(): Array<Record<string, unknown>> {
    const amounts = [
      1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 2000, 2500, 5000, 6500,
    ];
    return amounts.map((amount, i) => ({
      amount,
      candidate: i % 2 === 0 ? 'Talarico' : 'Paxton',
    }));
  }

  it('spreads skewed data across multiple bins instead of collapsing', () => {
    const bars = barsOf({
      type: 'chart',
      mark: { type: 'histogram', binCount: 10 },
      data: skewedDonations(),
      encoding: {
        x: { field: 'amount', type: 'quantitative', scale: { type: 'log' } },
      },
    });
    expect(bars.length).toBeGreaterThan(0);
    // With log binning, skewed data should not collapse into 1-2 bins.
    // Linear binning over [1, 6500] with 10 bins puts ~15 of 20 values in bin 1.
    expect(bars.length).toBeGreaterThanOrEqual(5);
  });

  it('produces bins with variable data-space widths (equal in log space)', () => {
    const bars = barsOf({
      type: 'chart',
      mark: { type: 'histogram', binCount: 5 },
      data: skewedDonations(),
      encoding: {
        x: { field: 'amount', type: 'quantitative', scale: { type: 'log' } },
      },
    });
    // Log-spaced bins have varying data-space widths (bin_end - bin_start)
    // but equal pixel widths because the log scale compresses them uniformly.
    // Check that the data-space widths vary (unlike linear binning).
    const dataWidths = bars.map((b) => {
      const row = b.data as Record<string, unknown>;
      return (row.bin_amount_end as number) - (row.bin_amount as number);
    });
    const uniqueWidths = new Set(dataWidths.map((w) => Math.round(w * 100) / 100));
    expect(uniqueWidths.size).toBeGreaterThan(1);
  });

  it('works with normalize: true on a log scale', () => {
    const layout = compile({
      type: 'chart',
      mark: { type: 'histogram', binCount: 8, normalize: true },
      data: skewedDonations(),
      encoding: {
        x: { field: 'amount', type: 'quantitative', scale: { type: 'log' } },
      },
    });
    const bars = layout.marks.filter((m): m is RectMark => m.type === 'rect');
    expect(bars.length).toBeGreaterThan(0);
    // Proportions should sum to ~1
    let total = 0;
    for (const bar of bars) {
      const row = bar.data as Record<string, unknown> | undefined;
      total += Number(row?.__proportion ?? 0);
    }
    expect(total).toBeCloseTo(1, 6);
  });

  it('handles color groups with log-spaced bins', () => {
    const bars = barsOf({
      type: 'chart',
      mark: { type: 'histogram', binCount: 8 },
      data: skewedDonations(),
      encoding: {
        x: { field: 'amount', type: 'quantitative', scale: { type: 'log' } },
        color: { field: 'candidate', type: 'nominal' },
      },
    });
    const talarico = bars.filter((b) => b.seriesKey === 'Talarico');
    const paxton = bars.filter((b) => b.seriesKey === 'Paxton');
    expect(talarico.length).toBeGreaterThan(0);
    expect(paxton.length).toBeGreaterThan(0);
  });

  it('leaves linear binning unchanged when no log scale', () => {
    const linearBars = barsOf({
      type: 'chart',
      mark: { type: 'histogram', binCount: 10 },
      data: skewedDonations(),
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
      },
    });
    // Linear bins: all bars have equal width
    const widths = linearBars.map((b) => b.width);
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    expect(maxW - minW).toBeLessThan(1);
  });
});

describe('authored bar + x2 (migration section 25)', () => {
  it('routes a quantitative x, x2 and y to the binned renderer', () => {
    // Pins the documented behavior change: this shape used to render through
    // the ordinary bar path. Authors who meant a span want mark: 'range'.
    const bars = barsOf({
      type: 'chart',
      mark: 'bar',
      data: [
        { start: 0, end: 10, value: 3 },
        { start: 10, end: 20, value: 7 },
      ],
      encoding: {
        x: { field: 'start', type: 'quantitative' },
        x2: { field: 'end', type: 'quantitative' },
        y: { field: 'value', type: 'quantitative' },
      },
    });
    expect(bars).toHaveLength(2);
    // Equal spans render at equal widths off the linear scale, not a band.
    expect(bars[0].width).toBeCloseTo(bars[1].width, 5);
  });

  it('leaves a nominal-y floating bar on the band path', () => {
    const spec: Spec = {
      type: 'chart',
      mark: 'bar',
      data: [
        { start: 0, end: 10, phase: 'Design' },
        { start: 10, end: 25, phase: 'Build' },
      ],
      encoding: {
        x: { field: 'start', type: 'quantitative' },
        x2: { field: 'end', type: 'quantitative' },
        y: { field: 'phase', type: 'nominal' },
      },
    };
    const layout = compile(spec);
    const bars = layout.marks.filter((m): m is RectMark => m.type === 'rect');
    expect(bars.length).toBeGreaterThan(0);
    // A band-scale bar takes its thickness from the band, so the two spans
    // (10 and 15 units) still render at different widths.
    expect(bars[0].width).not.toBeCloseTo(bars[1].width, 1);
    // The three guards that key off the binned shape must all decline here:
    // the x domain keeps its zero anchor...
    expect(layout.xInvert?.topData).toBe(0);
    // ...and the left gutter still measures the category labels rather than
    // taking the narrow numeric-tick path.
    expect(layout.area.x).toBeGreaterThan(50);
  });
});
