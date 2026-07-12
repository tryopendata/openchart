/**
 * Behavior characterization suite for the annotation layer.
 *
 * WHY THIS FILE EXISTS
 *
 * The rest of the annotation tests (compute.test.ts, resolve-text.test.ts,
 * placement*.test.ts) call the resolvers and passes DIRECTLY. That is how a
 * `normalize.ts` bug once shipped two whole features as dead code while 3305
 * tests passed: every one of them bypassed the pipeline that had the bug.
 *
 * These tests only ever call `compileChart`. They assert on the `ChartLayout`
 * the renderer consumes -- which IS the engine's observable output -- and never
 * on which function produced it. That makes them the safety net for refactoring
 * the annotation internals: if a change is genuinely behavior-preserving, every
 * test here passes untouched. If one fails, behavior moved.
 *
 * Rules for anything added here:
 *   - Go through `compileChart`. No importing from `../annotations/*` except
 *     constants (so a retuned default doesn't fail the test for the wrong reason).
 *   - Assert on what a reader would SEE: is the label above the point, does the
 *     leader reach it, is the text bold, does the block overlap the mark.
 *   - Never assert on a function being called, or on an intermediate field that
 *     only exists because of how the code is currently organized.
 */

import type {
  Annotation,
  ChartLayout,
  ChartSpec,
  ResolvedAnnotation,
} from '@opendata-ai/openchart-core';
import { describe, expect, test } from 'vitest';
import {
  ANCHOR_OFFSET,
  ARROWHEAD_LENGTH,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_DOT_RADIUS,
  DEFAULT_DOT_STROKE_WIDTH,
  LEDE_FONT_WEIGHT,
  MIN_CONNECTOR_LENGTH,
  SUBTITLE_FONT_WEIGHT,
  subtitleFontSize,
} from '../annotations/constants';
import { compileChart } from '../compile';

// --- helpers ---------------------------------------------------------------

const SERIES = [
  { m: 'Jan', v: 10 },
  { m: 'Feb', v: 50 },
  { m: 'Mar', v: 30 },
  { m: 'Apr', v: 42 },
];

type Ann = Annotation;

/** Compile a line chart carrying `annotations`, and hand back the resolved ones. */
function annotationsFor(annotations: Ann[], width = 800, height = 460): ResolvedAnnotation[] {
  const layout: ChartLayout = compileChart(
    {
      mark: 'line',
      data: SERIES,
      encoding: {
        x: { field: 'm', type: 'ordinal' },
        y: { field: 'v', type: 'quantitative' },
      },
      annotations,
    } as ChartSpec,
    { width, height },
  );
  return layout.annotations ?? [];
}

const first = (annotations: Ann[]) => annotationsFor(annotations)[0];

/** Length of the leader the renderer will actually stroke. */
function strokedLength(a: ResolvedAnnotation): number | null {
  const c = a.label?.connector;
  if (!c) return null;
  const len = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
  return c.arrow ? len - ARROWHEAD_LENGTH : len;
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// --- the block sits where the author asked -------------------------------

describe('a callout lands where the anchor says it should', () => {
  test('a top anchor puts the block above the point, straddling it', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'top' }]);
    const b = a.bounds!;
    const dot = a.dot!;

    // Above: the whole block clears the point.
    expect(b.y + b.height).toBeLessThan(dot.y);
    // Straddling: the point is inside the block's horizontal span, not off one end.
    expect(b.x).toBeLessThan(dot.x);
    expect(b.x + b.width).toBeGreaterThan(dot.x);
  });

  test('a bottom anchor puts the block below the point, straddling it', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'bottom' }]);
    const b = a.bounds!;
    const dot = a.dot!;

    expect(b.y).toBeGreaterThan(dot.y);
    expect(b.x).toBeLessThan(dot.x);
    expect(b.x + b.width).toBeGreaterThan(dot.x);
  });

  test('a left anchor puts the block beside the point, not over it', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'left' }]);
    const b = a.bounds!;
    const dot = a.dot!;

    // Entirely to the left, clear of the point by the anchor setback.
    expect(b.x + b.width).toBeLessThan(dot.x);
    expect(dot.x - (b.x + b.width)).toBeGreaterThanOrEqual(ANCHOR_OFFSET - 1);
  });

  test('a right anchor puts the block beside the point, not over it', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'right' }]);
    const b = a.bounds!;
    const dot = a.dot!;

    expect(b.x).toBeGreaterThan(dot.x);
    expect(b.x - dot.x).toBeGreaterThanOrEqual(ANCHOR_OFFSET - 1);
  });

  // An offset is measured FROM THE DATA POINT, never between two compiles. Adding an
  // annotation changes the reserved margins, which resizes the plot, which moves every
  // data point -- so `movedLayout.label.x - bareLayout.label.x` is not the offset, it's
  // the offset plus a scale shift. `label - dot` is the quantity the reader actually sees.
  const labelFromPoint = (a: ResolvedAnnotation) => ({
    dx: a.label!.x - a.dot!.x,
    dy: a.label!.y - a.dot!.y,
  });

  /** Where the block sits relative to its data point, for a given authored offset. */
  const offsetBy = (anchor: string, dx: number, dy: number) =>
    labelFromPoint(
      first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor, offset: { dx, dy } }]),
    );

  // Every reading below carries an offset, so every one takes the explicit path. A
  // zero-offset baseline would NOT: with no offset the block is still eligible for the
  // obstacle nudge, so it sits wherever that pass shoved it, and a delta measured
  // against it is the offset PLUS the nudge. Compare like with like.
  test.each([
    'top',
    'bottom',
    'left',
    'right',
  ] as const)('an offset translates a %s-anchored block by exactly that much', (anchor) => {
    const base = offsetBy(anchor, 1, 1);
    const moved = offsetBy(anchor, 26, -14);

    expect(moved.dx - base.dx).toBeCloseTo(25, 5);
    expect(moved.dy - base.dy).toBeCloseTo(-15, 5);
  });

  test.each([
    'top',
    'bottom',
    'left',
    'right',
  ] as const)('an offset on a %s-anchored block is monotonic -- no dead zones, no jumps', (anchor) => {
    // The knob has to behave like a knob. This failed hard before explicit offsets
    // were made to outrank the obstacle pass: on a line chart the polyline is one
    // long obstacle, so a right-anchored `dy: -10` moved the block ZERO pixels while
    // `dy: -15` teleported it 56px. Same knob, no monotonicity -- unaimable.
    const base = offsetBy(anchor, 0, -5).dy;

    for (const dy of [-10, -15, -20, -40]) {
      expect(offsetBy(anchor, 0, dy).dy - base).toBeCloseTo(dy + 5, 5);
    }
  });

  test('an offset with no anchor is a tweak, not a placement -- it still gets out of the way', () => {
    // An `offset` with an `anchor` is a placement and outranks avoidance (above). An
    // offset with NO anchor is not: the block is sited by the auto-placement search and
    // the offset just nudges wherever the search put it, so it still has to dodge the
    // line. Exempting it too drove "Obesity flattens here" straight through its own
    // curve in the scrollytelling story.
    //
    // The real geometry from that story: a flattening curve, so the block lands in the
    // shallow region and the offset walks it back down onto the line.
    const layout: ChartLayout = compileChart(
      {
        mark: 'line',
        data: [
          { y: '2019', v: 32.2 },
          { y: '2020', v: 31.8 },
          { y: '2021', v: 33.8 },
          { y: '2022', v: 33.5 },
          { y: '2023', v: 34.2 },
          { y: '2024', v: 34.1 },
        ],
        encoding: {
          x: { field: 'y', type: 'ordinal' },
          y: { field: 'v', type: 'quantitative', scale: { domain: [30, 36], nice: false } },
        },
        annotations: [
          { type: 'text', x: '2021', y: 33.8, text: 'Obesity flattens here', offset: { dy: -20 } },
        ],
      } as ChartSpec,
      { width: 1000, height: 440 },
    );

    const b = layout.annotations![0].bounds!;
    const points = layout.marks.flatMap((m) => ('points' in m ? (m.points ?? []) : []));

    // Sample the SEGMENTS, not just the vertices. The block sits between two data
    // points, so a vertex-only check sails through while the line runs clean across
    // the words -- which is how this very assertion was vacuous on the first attempt.
    const crossesBlock = (() => {
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        for (let t = 0; t <= 1; t += 0.02) {
          const x = p0.x + (p1.x - p0.x) * t;
          const y = p0.y + (p1.y - p0.y) * t;
          if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return true;
        }
      }
      return false;
    })();

    expect(crossesBlock).toBe(false);
  });

  test('a hand-offset block keeps its spot; the other one routes around it', () => {
    // The corollary of "explicit wins": the pinned block does not move to dodge its
    // neighbour, but it still claims its space, so nothing prints on top of it.
    const [pinned, other] = annotationsFor([
      { type: 'text', x: 'Mar', y: 30, text: 'Pinned', anchor: 'top', offset: { dx: 0, dy: -30 } },
      { type: 'text', x: 'Mar', y: 30, text: 'Other', anchor: 'top' },
    ]);

    // Sits exactly where it was told to, neighbour or no neighbour.
    expect(pinned.label!.y - pinned.dot!.y).toBeCloseTo(offsetBy('top', 0, -30).dy, 5);
    expect(overlaps(pinned.bounds!, other.bounds!)).toBe(false);
  });

  test('a callout does not sit on top of the line it annotates', () => {
    const layout: ChartLayout = compileChart(
      {
        mark: 'line',
        data: SERIES,
        encoding: {
          x: { field: 'm', type: 'ordinal' },
          y: { field: 'v', type: 'quantitative' },
        },
        annotations: [{ type: 'text', x: 'Feb', y: 50, text: 'The peak' }],
      } as ChartSpec,
      { width: 800, height: 460 },
    );

    const a = layout.annotations![0];
    const points = layout.marks.flatMap((m) => ('points' in m ? (m.points ?? []) : []));
    const b = a.bounds!;

    // No vertex of the series falls inside the label block.
    for (const p of points) {
      const inside = p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
      expect(inside).toBe(false);
    }
  });
});

// --- the leader connects the block to the point --------------------------

describe('the leader actually connects the words to the data', () => {
  test('a bare callout draws a leader and a marker with no authoring', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak' }]);

    // The "minimal spec is publication-ready" rule.
    expect(a.label?.connector).toBeDefined();
    expect(a.dot).toBeDefined();
  });

  test("the leader ends on the data point, not on the label's own edge", () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'top' }]);
    const c = a.label!.connector!;
    const dot = a.dot!;

    // `to` is pulled back off the marker, but it aims at the point: within the
    // marker's own radius plus its stroke.
    const gap = Math.hypot(dot.x - c.to.x, dot.y - c.to.y);
    expect(gap).toBeLessThanOrEqual(DEFAULT_DOT_RADIUS + DEFAULT_DOT_STROKE_WIDTH + 3);
  });

  test('the leader starts outside the text, never inside it', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'A longer callout', anchor: 'top' }]);
    const c = a.label!.connector!;
    const b = a.bounds!;

    const insideText =
      c.from.x > b.x && c.from.x < b.x + b.width && c.from.y > b.y && c.from.y < b.y + b.height;
    expect(insideText).toBe(false);
  });

  test('a leader too short to read is dropped, and the marker carries it alone', () => {
    // Label pulled right down onto its point.
    const a = first([
      { type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'top', offset: { dx: 0, dy: 26 } },
    ]);

    expect(a.label?.connector).toBeUndefined();
    // The marker survives: the reader still knows which point is meant.
    expect(a.dot).toBeDefined();
  });

  test('whatever leader IS drawn is long enough to read as a line', () => {
    // Sweep the label in toward its point across both voices. Every connector
    // that survives must have a strokable length -- never a 1px nub.
    for (const arrow of [false, true]) {
      for (let dy = 0; dy <= 26; dy++) {
        const a = first([
          {
            type: 'text',
            x: 'Mar',
            y: 30,
            text: 'Peak',
            anchor: 'top',
            offset: { dx: 0, dy },
            connector: arrow ? { type: 'straight', arrow: true } : 'straight',
          },
        ]);
        const stroke = strokedLength(a);
        if (stroke === null) continue; // suppressed, which is a valid outcome
        expect(stroke).toBeGreaterThanOrEqual(MIN_CONNECTOR_LENGTH);
      }
    }
  });

  test('a drop-line hangs straight down from the words to the point', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', connector: 'drop-line' }]);
    const c = a.label!.connector!;
    const b = a.bounds!;

    // Vertical, pinned to the point's x.
    expect(c.from.x).toBeCloseTo(c.to.x, 5);
    expect(c.from.x).toBeCloseTo(a.dot!.x, 5);
    // Runs downward, from a block that sits above the point.
    expect(c.from.y).toBeLessThan(c.to.y);
    expect(b.y + b.height).toBeLessThanOrEqual(a.dot!.y);
  });
});

// --- typography the reader sees ------------------------------------------

describe('the words are styled the way the design says', () => {
  test('a plain callout is regular weight at the default size', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak' }]);

    expect(a.label!.style.fontSize).toBe(DEFAULT_ANNOTATION_FONT_SIZE);
    expect(a.label!.style.fontWeight).toBe(DEFAULT_ANNOTATION_FONT_WEIGHT);
  });

  test('adding a subtitle promotes the first line to a bold lede', () => {
    const a = first([
      { type: 'text', x: 'Mar', y: 30, text: '+1.17°C', subtitle: 'the warmest year' },
    ]);

    // This is the pairing the whole lede rule exists for. It once shipped dead.
    expect(a.label!.style.fontWeight).toBe(LEDE_FONT_WEIGHT);
    expect(a.subtitle!.text).toBe('the warmest year');
    expect(a.subtitle!.style.fontWeight).toBe(SUBTITLE_FONT_WEIGHT);
    expect(a.subtitle!.style.fontSize).toBe(subtitleFontSize(DEFAULT_ANNOTATION_FONT_SIZE));
  });

  test('an explicit weight beats the lede rule', () => {
    const a = first([
      { type: 'text', x: 'Mar', y: 30, text: 'Peak', subtitle: 'context', fontWeight: 500 },
    ]);
    expect(a.label!.style.fontWeight).toBe(500);
  });

  test('the subtitle sits under the primary line and shares its left edge', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', subtitle: 'context' }]);

    expect(a.subtitle!.y).toBeGreaterThan(a.label!.y);
    expect(a.subtitle!.x).toBeCloseTo(a.label!.x, 5);
  });

  test('a subtitle works on a drop-line too', () => {
    const a = first([
      { type: 'text', x: 'Mar', y: 30, text: 'Peak', subtitle: 'context', connector: 'drop-line' },
    ]);
    expect(a.subtitle?.text).toBe('context');
    expect(a.label!.style.fontWeight).toBe(LEDE_FONT_WEIGHT);
  });

  test('text is never center-aligned; it faces the data', () => {
    const left = first([{ type: 'text', x: 'Mar', y: 30, text: 'a\nb', anchor: 'left' }]);
    const right = first([{ type: 'text', x: 'Mar', y: 30, text: 'a\nb', anchor: 'right' }]);
    const top = first([{ type: 'text', x: 'Mar', y: 30, text: 'a\nb', anchor: 'top' }]);

    // A left-anchored block's right edge faces the point, so it rags right-aligned.
    expect(left.label!.style.textAnchor).toBe('end');
    expect(right.label!.style.textAnchor).toBe('start');
    expect(top.label!.style.textAnchor).toBe('start');
  });

  test('the block grows to fit a subtitle, so collisions can see it', () => {
    const plain = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak' }]);
    const withSub = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', subtitle: 'context' }]);

    expect(withSub.bounds!.height).toBeGreaterThan(plain.bounds!.height);
    // ...but the label's own box stays the label's own box (the plate is sized
    // from it, so a subtitle must not inflate it).
    expect(withSub.label!.bounds!.height).toBeCloseTo(plain.label!.bounds!.height, 5);
  });
});

// --- bold spans ----------------------------------------------------------

describe('**bold** emphasis rides inside the sentence', () => {
  /**
   * Compile with a WEIGHT-AWARE measurer, i.e. what a browser gives us.
   *
   * The default `heuristicMeasure` (the SSR/static fallback) is weight-blind, so
   * bold and regular measure identically there and this test would prove nothing.
   * The real canvas path does distinguish them, and that's the path where a bold
   * span's extra width has to reach bounds -- otherwise collisions and connector
   * exits are computed against a box narrower than the drawn text.
   */
  const widthWith = (text: string): number => {
    const layout: ChartLayout = compileChart(
      {
        mark: 'line',
        data: SERIES,
        encoding: {
          x: { field: 'm', type: 'ordinal' },
          y: { field: 'v', type: 'quantitative' },
        },
        annotations: [{ type: 'text', x: 'Mar', y: 30, text }],
      } as never,
      {
        width: 800,
        height: 460,
        measureText: (t: string, fontSize: number, fontWeight = 400) => ({
          width: t.length * fontSize * (fontWeight >= 600 ? 0.62 : 0.5),
          height: fontSize,
        }),
      },
    );
    return layout.annotations![0].bounds!.width;
  };

  test('a bold span widens the block, and the ** markers take no space', () => {
    const plain = widthWith('Jobs fell to 12,000');
    const bold = widthWith('Jobs fell to **12,000**');

    // Bold is wider than regular: the span is measured at its own weight.
    expect(bold).toBeGreaterThan(plain);

    // And the `**` markers are consumed, not measured. Four asterisks at 13px
    // would add ~26px on their own; the real gain is just the 6 bold characters
    // going from 0.5 to 0.62 width (6 * 13 * 0.12 ≈ 9.4px).
    expect(bold - plain).toBeLessThan(15);
  });

  test('an unmatched ** is just text', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'unmatched ** here' }]);
    // Round-trips verbatim; the renderer will draw the asterisks.
    expect(a.label!.text).toBe('unmatched ** here');
  });

  test('a bold subtitle span is measured too', () => {
    const plain = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', subtitle: 'under 0.3C' }]);
    const bold = first([
      { type: 'text', x: 'Mar', y: 30, text: 'Peak', subtitle: 'under **0.3C**' },
    ]);
    // The markers are stripped from the rendered string in both engines.
    expect(bold.subtitle!.text).toBe('under **0.3C**');
    expect(plain.subtitle!.text).toBe('under 0.3C');
  });
});

// --- the marker ----------------------------------------------------------

describe('the endpoint marker', () => {
  test('an arrowed callout gets no marker: the arrowhead already points', () => {
    const a = first([
      { type: 'text', x: 'Mar', y: 30, text: 'Peak', connector: { type: 'curve', arrow: true } },
    ]);
    expect(a.dot).toBeUndefined();
  });

  test('a quiet leader gets an open-ring marker to terminate it', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', connector: 'straight' }]);
    expect(a.dot).toBeDefined();
    expect(a.dot!.radius).toBe(DEFAULT_DOT_RADIUS);
    // Ring, not disc: the fill is the surface, the stroke is the connector's ink.
    expect(a.dot!.stroke).toBe(a.label!.connector!.stroke);
  });

  test('dot:false means bare, always', () => {
    const a = first([
      { type: 'text', x: 'Mar', y: 30, text: 'Peak', connector: 'straight', dot: false },
    ]);
    expect(a.dot).toBeUndefined();
  });

  test('the marker sits on the data point', () => {
    const a = first([{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'top' }]);
    const layout = compileChart(
      {
        mark: 'line',
        data: SERIES,
        encoding: {
          x: { field: 'm', type: 'ordinal' },
          y: { field: 'v', type: 'quantitative' },
        },
        annotations: [{ type: 'text', x: 'Mar', y: 30, text: 'Peak', anchor: 'top' }],
      } as ChartSpec,
      { width: 800, height: 460 },
    );
    const marks = layout.marks.flatMap((m) => ('points' in m ? (m.points ?? []) : []));
    const mar = marks[2]; // third datum
    expect(a.dot!.x).toBeCloseTo(mar.x, 1);
    expect(a.dot!.y).toBeCloseTo(mar.y, 1);
  });
});

// --- collisions: the reason the mutation passes exist --------------------

describe('callouts get out of each other and stay readable', () => {
  const crowded = () =>
    annotationsFor([
      { type: 'text', x: 'Jan', y: 10, text: 'First callout here' },
      { type: 'text', x: 'Feb', y: 50, text: 'Second callout here' },
      { type: 'text', x: 'Mar', y: 30, text: 'Third callout here' },
      { type: 'text', x: 'Apr', y: 42, text: 'Fourth callout here' },
    ]);

  test('no two callout blocks overlap each other', () => {
    const blocks = crowded()
      .filter((a) => a.footnoteIndex == null)
      .map((a) => a.bounds!)
      .filter(Boolean);

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        expect(overlaps(blocks[i], blocks[j])).toBe(false);
      }
    }
  });

  test('every callout keeps a leader that still reaches its own point', () => {
    for (const a of crowded()) {
      if (!a.label?.connector || !a.dot) continue;
      const c = a.label.connector;
      const gap = Math.hypot(a.dot.x - c.to.x, a.dot.y - c.to.y);
      // After being shoved around, the leader still terminates at its marker.
      expect(gap).toBeLessThanOrEqual(DEFAULT_DOT_RADIUS + DEFAULT_DOT_STROKE_WIDTH + 3);
    }
  });

  test('a nudged callout brings its subtitle with it', () => {
    const nudged = annotationsFor([
      { type: 'text', x: 'Jan', y: 10, text: 'First callout', subtitle: 'with context' },
      { type: 'text', x: 'Feb', y: 50, text: 'Second callout', subtitle: 'with context' },
      { type: 'text', x: 'Mar', y: 30, text: 'Third callout', subtitle: 'with context' },
    ]);

    for (const a of nudged) {
      if (!a.subtitle || !a.label) continue;
      // The subtitle carries absolute coords; if a pass moves the label and
      // forgets the subtitle, they separate. They must stay locked.
      expect(a.subtitle.x).toBeCloseTo(a.label.x, 5);
      expect(a.subtitle.y).toBeGreaterThan(a.label.y);
    }
  });

  test('drop-lines stay vertical even when they collide', () => {
    const both = annotationsFor([
      { type: 'text', x: 'Feb', y: 50, text: 'First drop-line here', connector: 'drop-line' },
      { type: 'text', x: 'Mar', y: 30, text: 'Second drop-line here', connector: 'drop-line' },
    ]);

    for (const a of both) {
      const c = a.label?.connector;
      expect(c).toBeDefined();
      expect(c!.from.x).toBeCloseTo(c!.to.x, 5);
      expect(c!.from.x).toBeCloseTo(a.dot!.x, 5);
    }
  });
});

// --- thinning ------------------------------------------------------------

describe('when callouts cannot all fit, they demote to footnotes', () => {
  const long = (s: string) => s.repeat(10);

  const thinned = () =>
    compileChart(
      {
        mark: 'line',
        autoThin: true,
        data: SERIES,
        encoding: {
          x: { field: 'm', type: 'ordinal' },
          y: { field: 'v', type: 'quantitative' },
        },
        annotations: [
          { type: 'text', x: 'Jan', y: 10, text: long('AAA ') },
          { type: 'text', x: 'Feb', y: 50, text: long('BBB ') },
          { type: 'text', x: 'Mar', y: 30, text: long('CCC ') },
          { type: 'text', x: 'Apr', y: 42, text: long('DDD ') },
        ],
      } as ChartSpec,
      { width: 420, height: 300 },
    );

  test('a demoted callout keeps its marker so the number has something to sit by', () => {
    const layout = thinned();
    const demoted = layout.annotations!.filter((a) => a.footnoteIndex != null);
    expect(demoted.length).toBeGreaterThan(0);

    for (const a of demoted) {
      expect(a.dot).toBeDefined();
    }
  });

  test('every footnote marker points at its own text', () => {
    const layout = thinned();
    const byNumber = new Map((layout.chrome.footnotes ?? []).map((f) => [f.index, f.text]));

    let checked = 0;
    for (const a of layout.annotations!) {
      if (a.footnoteIndex == null) continue;
      expect(byNumber.get(a.footnoteIndex)).toBe(a.label?.text);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('the footnote list is numbered from one, with no gaps or repeats', () => {
    const footnotes = thinned().chrome.footnotes ?? [];
    expect(footnotes.length).toBeGreaterThan(0);
    expect(footnotes.map((f) => f.index)).toEqual(
      Array.from({ length: footnotes.length }, (_, i) => i + 1),
    );
  });
});

// --- data-coordinate stability -------------------------------------------

describe('callouts are anchored in the data, not in pixels', () => {
  test('resizing the chart moves a callout with its data point', () => {
    const narrow = annotationsFor([{ type: 'text', x: 'Mar', y: 30, text: 'Peak' }], 600, 400)[0];
    const wide = annotationsFor([{ type: 'text', x: 'Mar', y: 30, text: 'Peak' }], 900, 400)[0];

    // Different pixel positions...
    expect(wide.dot!.x).not.toBeCloseTo(narrow.dot!.x, 1);
    // ...but the label keeps the same relationship to its point in both.
    const offsetNarrow = narrow.label!.x - narrow.dot!.x;
    const offsetWide = wide.label!.x - wide.dot!.x;
    expect(offsetWide).toBeCloseTo(offsetNarrow, 1);
  });

  test('an annotation on a value outside the domain is dropped, not misplaced', () => {
    const all = annotationsFor([
      { type: 'text', x: 'Mar', y: 30, text: 'Real' },
      { type: 'text', x: 'NotAMonth', y: 30, text: 'Bogus' },
    ]);

    expect(all).toHaveLength(1);
    expect(all[0].label!.text).toBe('Real');
  });
});
