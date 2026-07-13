import type { Annotation, ResolvedAnnotation, TextAnnotation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { thinAnnotations } from '../thinning';

const measure = (text: string, font: { fontSize: number }) => text.length * font.fontSize * 0.6;

function makeResolved(
  x: number,
  y: number,
  text: string,
  overrides?: Partial<ResolvedAnnotation>,
): ResolvedAnnotation {
  return {
    type: 'text',
    label: {
      x,
      y,
      text,
      visible: true,
      style: { fontSize: 12, fontWeight: 400, textAnchor: 'start', lineHeight: 1.3 },
    },
    ...overrides,
  } as ResolvedAnnotation;
}

function makeSpec(text: string, overrides?: Partial<TextAnnotation>): TextAnnotation {
  return {
    type: 'text',
    x: 0,
    y: 0,
    text,
    ...overrides,
  } as TextAnnotation;
}

describe('thinAnnotations', () => {
  it('returns unchanged when 0 or 1 annotations', () => {
    const single = [makeResolved(100, 100, 'A')];
    const result = thinAnnotations(single, [makeSpec('A')], measure);
    expect(result.footnotes).toHaveLength(0);
    expect(result.annotations).toBe(single);
  });

  it('keeps non-overlapping annotations in place', () => {
    const annotations = [makeResolved(0, 0, 'First'), makeResolved(500, 500, 'Second')];
    const specs: Annotation[] = [makeSpec('First'), makeSpec('Second')];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(0);
    expect(result.annotations[0].footnoteIndex).toBeUndefined();
    expect(result.annotations[1].footnoteIndex).toBeUndefined();
  });

  it('demotes overlapping annotations to footnotes', () => {
    const annotations = [
      makeResolved(100, 100, 'First label'),
      makeResolved(105, 100, 'Second label'),
    ];
    const specs: Annotation[] = [makeSpec('First label'), makeSpec('Second label')];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(1);
    expect(result.footnotes[0]).toEqual({ index: 1, text: 'Second label' });
    expect(result.annotations[1].footnoteIndex).toBe(1);
    expect(result.annotations[0].footnoteIndex).toBeUndefined();
  });

  it('respects priority ordering (lower priority kept first)', () => {
    const annotations = [
      makeResolved(100, 100, 'Low priority'),
      makeResolved(105, 100, 'High priority'),
    ];
    const specs: Annotation[] = [
      makeSpec('Low priority', { priority: 10 }),
      makeSpec('High priority', { priority: 1 }),
    ];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(1);
    expect(result.footnotes[0].text).toBe('Low priority');
    expect(result.annotations[1].footnoteIndex).toBeUndefined();
    expect(result.annotations[0].footnoteIndex).toBe(1);
  });

  it('pins annotations with responsive: false', () => {
    const annotations = [makeResolved(100, 100, 'Pinned'), makeResolved(105, 100, 'Candidate')];
    const specs: Annotation[] = [makeSpec('Pinned', { responsive: false }), makeSpec('Candidate')];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(1);
    expect(result.footnotes[0].text).toBe('Candidate');
    expect(result.annotations[0].footnoteIndex).toBeUndefined();
  });

  it('does not thin non-text annotations', () => {
    const annotations: ResolvedAnnotation[] = [
      {
        type: 'refline',
        line: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      } as ResolvedAnnotation,
      makeResolved(100, 100, 'Text'),
    ];
    const specs: Annotation[] = [{ type: 'refline', y: 0 }, makeSpec('Text')];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(0);
  });

  it('assigns sequential footnote indices', () => {
    const annotations = [
      makeResolved(100, 100, 'Keep this'),
      makeResolved(105, 100, 'Demote 1'),
      makeResolved(110, 100, 'Demote 2'),
    ];
    const specs: Annotation[] = [makeSpec('Keep this'), makeSpec('Demote 1'), makeSpec('Demote 2')];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(2);
    expect(result.footnotes[0].index).toBe(1);
    expect(result.footnotes[1].index).toBe(2);
  });

  it('maintains correct index alignment with mixed annotation types', () => {
    const annotations: ResolvedAnnotation[] = [
      {
        type: 'refline',
        line: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      } as ResolvedAnnotation,
      makeResolved(100, 100, 'First text'),
      makeResolved(105, 100, 'Second text'),
    ];
    const specs: Annotation[] = [
      { type: 'refline', y: 0 },
      makeSpec('First text', { priority: 1 }),
      makeSpec('Second text', { priority: 10 }),
    ];
    const result = thinAnnotations(annotations, specs, measure);
    expect(result.footnotes).toHaveLength(1);
    expect(result.footnotes[0].text).toBe('Second text');
    expect(result.annotations[1].footnoteIndex).toBeUndefined();
    expect(result.annotations[2].footnoteIndex).toBe(1);
  });

  describe('plot-area containment', () => {
    // Label `y` is the text baseline, so bounds extend upward from it: a label
    // at y=40 with a 12px font spans roughly y=28..44. Keep test baselines far
    // enough from the top edge that a fitting label really does fit.
    const plotArea = { x: 0, y: 0, width: 120, height: 200 };

    it('demotes a label that overflows the plot even when nothing collides', () => {
      // Stacked at different y, so the two never pairwise-collide. The second
      // runs off the right edge and must still demote.
      const annotations = [
        makeResolved(0, 40, 'Fits'),
        makeResolved(60, 120, 'Way too long to fit here'),
      ];
      const specs: Annotation[] = [makeSpec('Fits'), makeSpec('Way too long to fit here')];
      const result = thinAnnotations(annotations, specs, measure, plotArea);
      expect(result.footnotes).toHaveLength(1);
      expect(result.footnotes[0].text).toBe('Way too long to fit here');
      expect(result.annotations[0].footnoteIndex).toBeUndefined();
      expect(result.annotations[1].footnoteIndex).toBe(1);
    });

    it('keeps a label that fits inside the plot', () => {
      const annotations = [makeResolved(0, 40, 'A'), makeResolved(0, 120, 'B')];
      const specs: Annotation[] = [makeSpec('A'), makeSpec('B')];
      const result = thinAnnotations(annotations, specs, measure, plotArea);
      expect(result.footnotes).toHaveLength(0);
    });

    it('never demotes a pinned label, even when it overflows', () => {
      const annotations = [
        makeResolved(0, 40, 'Fits'),
        makeResolved(60, 120, 'Way too long to fit here'),
      ];
      const specs: Annotation[] = [
        makeSpec('Fits'),
        makeSpec('Way too long to fit here', { responsive: false }),
      ];
      const result = thinAnnotations(annotations, specs, measure, plotArea);
      expect(result.footnotes).toHaveLength(0);
      expect(result.annotations[1].footnoteIndex).toBeUndefined();
    });

    it('applies no containment constraint when plotArea is omitted', () => {
      const annotations = [
        makeResolved(0, 40, 'Fits'),
        makeResolved(60, 120, 'Way too long to fit here'),
      ];
      const specs: Annotation[] = [makeSpec('Fits'), makeSpec('Way too long to fit here')];
      const result = thinAnnotations(annotations, specs, measure);
      expect(result.footnotes).toHaveLength(0);
    });

    // A callout above a peak or below a trough lands in the margin, outside the
    // plot but inside the chart. Annotations render outside the clip path, so
    // that is legal placement and must stay inline. Fencing containment to the
    // plot demoted ordinary callouts to footnotes.
    //
    // The plot is inset inside the chart here (a real top margin exists), so
    // "above the plot" and "outside the chart" are genuinely different regions.
    // Roomy enough that the coverage budget stays out of the way — containment
    // is what's under test here.
    const insetPlot = { x: 40, y: 60, width: 700, height: 400 };
    const chart = { x: 0, y: 0, width: 780, height: 520 };

    it('keeps a label sitting in the margin above the plot', () => {
      // Baseline y=30: bounds span roughly y=18..34, above insetPlot.y (60) but
      // well inside the chart. Fenced to the plot this demotes; fenced to the
      // chart it stays inline.
      const annotations = [makeResolved(50, 120, 'Inside'), makeResolved(50, 30, 'Above the peak')];
      const specs: Annotation[] = [makeSpec('Inside'), makeSpec('Above the peak')];

      const result = thinAnnotations(annotations, specs, measure, insetPlot, chart);

      expect(result.footnotes).toHaveLength(0);
      expect(result.annotations[1].footnoteIndex).toBeUndefined();
    });

    it('still demotes a label that escapes the chart entirely', () => {
      // x=740 in a 780-wide chart: the text runs past the right edge.
      const annotations = [
        makeResolved(50, 120, 'Inside'),
        makeResolved(740, 120, 'Off the right edge of the chart'),
      ];
      const specs: Annotation[] = [makeSpec('Inside'), makeSpec('Off the right edge of the chart')];

      const result = thinAnnotations(annotations, specs, measure, insetPlot, chart);

      expect(result.footnotes).toHaveLength(1);
      expect(result.annotations[1].footnoteIndex).toBe(1);
    });
  });

  describe('coverage budget', () => {
    // Four labels, each well clear of the others and of the plot edges, so
    // neither the overlap test nor the containment test fires. Only the
    // coverage budget can demote here — which is the point: at narrow widths
    // collision resolution spreads labels out and clamping tucks them back in,
    // leaving a crowded-but-legal layout that the other two rules cannot see.
    // Editorial-length copy, not toy strings: label area is what the budget
    // meters, and real callouts ("Recovery begins") are several times wider
    // than a five-letter placeholder.
    const TEXTS = ['Recovery begins', 'Strong rebound', 'Record territory', 'Pandemic low'];
    const spread = () => TEXTS.map((t, i) => makeResolved(5, 20 + i * 40, t));
    const specs: Annotation[] = TEXTS.map((t) => makeSpec(t));

    it('demotes the crowded tail once labels exceed the budget on a small plot', () => {
      const annotations = spread();
      const plotArea = { x: 0, y: 0, width: 160, height: 160 };
      const result = thinAnnotations(annotations, specs, measure, plotArea);

      // Nothing collides and everything is inside the plot, so a demotion here
      // is attributable to the budget alone.
      expect(result.footnotes.length).toBeGreaterThan(0);

      // Priority ties fall back to spec order, so the tail demotes and the head
      // stays inline.
      expect(result.annotations[0].footnoteIndex).toBeUndefined();
      expect(result.annotations[3].footnoteIndex).toBeDefined();
    });

    it('leaves every label inline when the plot has room', () => {
      const annotations = spread();
      const plotArea = { x: 0, y: 0, width: 900, height: 500 };
      const result = thinAnnotations(annotations, specs, measure, plotArea);
      expect(result.footnotes).toHaveLength(0);
    });

    it('does not let a pinned label consume the budget and evict candidates', () => {
      // The pinned label is enormous — on its own it would blow the budget. It
      // must not be charged against it, or the candidate that easily fits gets
      // demoted in its place.
      const annotations = [
        makeResolved(5, 20, 'A pinned label that is extremely long and wide'),
        makeResolved(5, 120, 'Tiny'),
      ];
      const pinnedSpecs: Annotation[] = [
        makeSpec('A pinned label that is extremely long and wide', { responsive: false }),
        makeSpec('Tiny'),
      ];
      const plotArea = { x: 0, y: 0, width: 400, height: 200 };
      const result = thinAnnotations(annotations, pinnedSpecs, measure, plotArea);

      expect(result.annotations[0].footnoteIndex).toBeUndefined();
      expect(result.annotations[1].footnoteIndex).toBeUndefined();
      expect(result.footnotes).toHaveLength(0);
    });
  });
});
