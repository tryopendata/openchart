import type { ChartLayout, LineMark } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { describe, expect, test } from 'vitest';
import { ANCHOR_OFFSET, ARROWHEAD_LENGTH, MIN_CONNECTOR_LENGTH } from '../annotations/constants';
import { compileChart } from '../compile';

describe('known layout bugs', () => {
  test('annotation label does not overlap the line it annotates', () => {
    // Generate ~25 smooth sine-wave data points over two years
    const data: { date: string; value: number }[] = [];
    const startDate = new Date('2022-01-01');
    for (let i = 0; i < 25; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * 30); // ~monthly
      // Sine wave: value ranges ~20-80 with a peak near i=6 (mid-2022)
      const value = 50 + 30 * Math.sin((i / 25) * 2 * Math.PI);
      data.push({ date: d.toISOString().slice(0, 10), value });
    }

    // The peak is near i=6 (~July 2022), where sin peaks
    const peakIndex = 6;
    const peakDate = data[peakIndex].date;
    const peakValue = data[peakIndex].value;

    const spec = {
      mark: 'line' as const,
      data,
      encoding: {
        x: { field: 'date' as const, type: 'temporal' as const },
        y: { field: 'value' as const, type: 'quantitative' as const },
      },
      annotations: [
        {
          type: 'text' as const,
          x: peakDate,
          y: peakValue,
          text: 'Peak season',
        },
      ],
    };

    const layout: ChartLayout = compileChart(spec, { width: 600, height: 400 });

    // Find the annotation
    const annotation = layout.annotations[0];
    expect(annotation).toBeDefined();
    expect(annotation.label).toBeDefined();

    const label = annotation.label!;
    const fontSize = label.style.fontSize;
    const fontWeight = label.style.fontWeight;

    // Estimate the label bounding box
    const labelWidth = estimateTextWidth(label.text, fontSize, fontWeight);
    const labelHeight = fontSize * 1.3;

    // Label bounding box (y is the baseline, so top of text is y - fontSize)
    const labelLeft =
      label.style.textAnchor === 'middle'
        ? label.x - labelWidth / 2
        : label.style.textAnchor === 'end'
          ? label.x - labelWidth
          : label.x;
    const labelRight = labelLeft + labelWidth;
    const labelTop = label.y - fontSize;
    const labelBottom = labelTop + labelHeight;

    // Find the LineMark
    const lineMark = layout.marks.find((m): m is LineMark => m.type === 'line');
    expect(lineMark).toBeDefined();

    const points = lineMark!.points;

    // Find line segments that fall within the label's x-range
    let lineMinY = Infinity;
    let lineMaxY = -Infinity;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Check if this segment overlaps the label's x-range
      const segLeft = Math.min(p1.x, p2.x);
      const segRight = Math.max(p1.x, p2.x);

      if (segRight >= labelLeft && segLeft <= labelRight) {
        // This segment is within the label's x-range
        // Find the y-range of the line within the label's x-span
        const overlapLeft = Math.max(segLeft, labelLeft);
        const overlapRight = Math.min(segRight, labelRight);

        // Interpolate y values at the overlap boundaries
        const segWidth = p2.x - p1.x;
        if (Math.abs(segWidth) < 0.001) {
          lineMinY = Math.min(lineMinY, p1.y, p2.y);
          lineMaxY = Math.max(lineMaxY, p1.y, p2.y);
        } else {
          const t1 = (overlapLeft - p1.x) / segWidth;
          const t2 = (overlapRight - p1.x) / segWidth;
          const y1 = p1.y + t1 * (p2.y - p1.y);
          const y2 = p1.y + t2 * (p2.y - p1.y);
          lineMinY = Math.min(lineMinY, y1, y2);
          lineMaxY = Math.max(lineMaxY, y1, y2);
        }
      }
    }

    // The label bounding box should NOT vertically overlap with the line's y-range.
    // The label sits ANCHOR_OFFSET (28px) off its anchor point on the line, which
    // is sized to clear both the marker and the line path.
    const verticallyOverlaps = labelTop < lineMaxY && labelBottom > lineMinY;
    expect(verticallyOverlaps).toBe(false);
  });

  // Regression: the collision pass calls `refreshConnector` on every annotation it
  // moves, and that rebuilt `from`/`to` from a ray-box exit toward the target. A
  // drop-line is not a leader — it's a vertical rule pinned to the data point's x
  // — so the rebuild tilted it into a diagonal (which the renderer then draws with
  // shape-rendering: crispEdges, assuming axis alignment), and the
  // MIN_CONNECTOR_LENGTH rule could delete it outright.
  //
  // Two drop-lines placed close enough to collide is what makes this observable:
  // a lone annotation is never shifted, so `refreshConnector` never runs and the
  // bug hides. Against the unfixed code this pair yields a 12.9px-diagonal first
  // connector and a *deleted* second one.
  describe('drop-line connectors survive the collision pass', () => {
    const collidingDropLines = () =>
      compileChart(
        {
          mark: 'line' as const,
          data: [
            { m: 'Jan', v: 10 },
            { m: 'Feb', v: 50 },
            { m: 'Mar', v: 48 },
            { m: 'Apr', v: 30 },
          ],
          encoding: {
            x: { field: 'm' as const, type: 'ordinal' as const },
            y: { field: 'v' as const, type: 'quantitative' as const },
          },
          annotations: [
            {
              type: 'text' as const,
              x: 'Feb',
              y: 50,
              text: 'First drop-line here',
              connector: 'drop-line' as const,
            },
            {
              type: 'text' as const,
              x: 'Mar',
              y: 48,
              text: 'Second drop-line here',
              connector: 'drop-line' as const,
            },
          ],
        },
        { width: 800, height: 460 },
      ).annotations ?? [];

    // One test, not three. The `x` pinning is the only assertion the generic
    // ray-box rebuild actually breaks -- it preserves `style` through its
    // `{ ...connector }` spread, and this geometry happens to land on
    // `exit: 'vertical'` either way, so splitting those into their own tests just
    // manufactured two that pass with the fix reverted.
    test('stay vertical, with x pinned to the data point', () => {
      const annotations = collidingDropLines();
      expect(annotations).toHaveLength(2);
      for (const annotation of annotations) {
        const connector = annotation.label?.connector;
        // Survived the min-length rule (the generic rebuild can shorten a
        // drop-line enough to delete it outright).
        expect(connector).toBeDefined();
        // The whole contract of a drop-line: from.x === to.x === the point's x.
        expect(connector?.from.x).toBeCloseTo(connector?.to.x ?? Number.NaN, 5);
        expect(connector?.from.x).toBeCloseTo(annotation.dot?.x ?? Number.NaN, 5);
        expect(connector?.style).toBe('drop-line');
        expect(connector?.exit).toBe('vertical');
      }
    });
  });

  // Regression: the engine gated connectors on `length >= MIN_CONNECTOR_LENGTH`,
  // but the renderer stops an ARROWED stroke `ARROWHEAD_LENGTH` (7px) short and
  // spends that budget on the head. So an 8.1px arrowed connector cleared the 8px
  // gate and then shipped a 1.1px stub with an arrowhead stuck on the end. Sharing
  // the constant didn't fix it: both sides had the number, only one reasoned about
  // it. The gate now measures what actually gets stroked.
  describe('the connector min-length gate accounts for the arrowhead', () => {
    const strokeFor = (arrow: boolean, dy: number) => {
      const annotation = compileChart(
        {
          mark: 'line' as const,
          data: [
            { m: 'Jan', v: 10 },
            { m: 'Feb', v: 50 },
            { m: 'Mar', v: 30 },
          ],
          encoding: {
            x: { field: 'm' as const, type: 'ordinal' as const },
            y: { field: 'v' as const, type: 'quantitative' as const },
          },
          annotations: [
            {
              type: 'text' as const,
              x: 'Mar',
              y: 30,
              text: 'Note',
              anchor: 'top' as const,
              offset: { dx: 0, dy },
              connector: arrow ? { type: 'straight' as const, arrow: true } : 'straight',
            },
          ],
        },
        { width: 800, height: 460 },
      ).annotations?.[0];

      const connector = annotation?.label?.connector;
      if (!connector) return null;
      const length = Math.hypot(
        connector.to.x - connector.from.x,
        connector.to.y - connector.from.y,
      );
      // What the renderer actually strokes.
      return arrow ? length - ARROWHEAD_LENGTH : length;
    };

    test('an arrowed connector never ships a stroke shorter than the minimum', () => {
      // dy: 6 is the case that used to slip through -- an 8.10px connector that
      // stroked 1.10px once the head took its 7px.
      for (let dy = 0; dy <= 8; dy++) {
        const stroke = strokeFor(true, dy);
        if (stroke === null) continue; // suppressed outright, which is correct
        expect(stroke).toBeGreaterThanOrEqual(MIN_CONNECTOR_LENGTH);
      }
    });

    test('the plain (non-arrowed) gate is unchanged', () => {
      // The head costs nothing here, so the full length is the stroke and the
      // original 8px rule still holds. Guards against "fixing" the arrow case by
      // tightening the gate for everyone.
      for (let dy = 0; dy <= 8; dy++) {
        const stroke = strokeFor(false, dy);
        if (stroke === null) continue;
        expect(stroke).toBeGreaterThanOrEqual(MIN_CONNECTOR_LENGTH);
      }
      // And a short-but-legal plain connector still draws.
      expect(strokeFor(false, 0)).not.toBeNull();
    });
  });

  // Regression: `resolveTextAnnotation` bolts the lede rule on (a `subtitle`
  // promotes the primary line to 700) BEFORE branching to the drop-line resolver,
  // which used to resolve no subtitle at all. Net effect: authoring a subtitle on
  // a drop-line silently threw the subtitle away but still bolded the primary --
  // a field whose only visible effect was a mystery weight change.
  describe('a drop-line annotation honors its subtitle', () => {
    // Annotate Mar, not the Feb maximum: a callout on the chart's top value clamps
    // against the chart edge and has nowhere to go, which is a separate (and
    // legitimate) degradation. This is the ordinary case.
    const dropLineWithSubtitle = () =>
      compileChart(
        {
          mark: 'line' as const,
          data: [
            { m: 'Jan', v: 10 },
            { m: 'Feb', v: 50 },
            { m: 'Mar', v: 30 },
          ],
          encoding: {
            x: { field: 'm' as const, type: 'ordinal' as const },
            y: { field: 'v' as const, type: 'quantitative' as const },
          },
          annotations: [
            {
              type: 'text' as const,
              x: 'Mar',
              y: 30,
              text: 'Peak',
              subtitle: 'the highest month',
              connector: 'drop-line' as const,
            },
          ],
        },
        { width: 800, height: 460 },
      ).annotations?.[0];

    test('resolves the subtitle instead of dropping it', () => {
      const annotation = dropLineWithSubtitle();
      expect(annotation?.subtitle?.text).toBe('the highest month');
    });

    test('still promotes the primary line to a bold lede', () => {
      expect(dropLineWithSubtitle()?.label?.style.fontWeight).toBe(700);
    });

    test('renders the subtitle below the primary line, left edges aligned', () => {
      const annotation = dropLineWithSubtitle();
      expect(annotation?.subtitle?.y).toBeGreaterThan(annotation?.label?.y ?? Number.NaN);
      expect(annotation?.subtitle?.x).toBeCloseTo(annotation?.label?.x ?? Number.NaN, 5);
    });

    test('the whole block stays above the data point, so the line still drops', () => {
      // A drop-line runs DOWN from the block to the point. The subtitle makes the
      // block taller and wider, which made it collide with the line mark -- and the
      // obstacle nudge then shoved it *below* the point, inverting the connector so
      // it pointed up, away from the data, with the block sitting on the mark.
      const annotation = dropLineWithSubtitle();
      const bounds = annotation?.bounds;
      const dotY = annotation?.dot?.y ?? Number.NaN;
      expect((bounds?.y ?? Number.NaN) + (bounds?.height ?? Number.NaN)).toBeLessThanOrEqual(dotY);

      const connector = annotation?.label?.connector;
      expect(connector?.from.y).toBeLessThan(connector?.to.y ?? Number.NaN);
    });

    test('the block bounds cover the subtitle, so collisions see it', () => {
      const annotation = dropLineWithSubtitle();
      const bounds = annotation?.bounds;
      const labelBounds = annotation?.label?.bounds;
      // `bounds` is the union; `label.bounds` stays label-only (the renderer sizes
      // the background plate from it).
      expect(bounds?.height).toBeGreaterThan(labelBounds?.height ?? Number.NaN);
    });
  });

  // Regression: `compute.ts` stamped `result.bounds` (the UNION of label and
  // subtitle, which is what placement scores) into `label.bounds`, whose contract
  // is the label-only text box. The renderer sizes the `background` plate from
  // `label.bounds`, so an auto-placed annotation with a subtitle got a plate sized
  // to both lines while the explicit path got one sized to the label.
  test('auto-placed label bounds are the label box, not the label+subtitle union', () => {
    const layout = compileChart(
      {
        mark: 'line' as const,
        data: [
          { m: 'Jan', v: 10 },
          { m: 'Feb', v: 50 },
          { m: 'Mar', v: 30 },
        ],
        encoding: {
          x: { field: 'm' as const, type: 'ordinal' as const },
          y: { field: 'v' as const, type: 'quantitative' as const },
        },
        annotations: [
          // No anchor/offset => the auto-placement path.
          {
            type: 'text' as const,
            x: 'Feb',
            y: 50,
            text: 'Peak',
            subtitle: 'a considerably wider subtitle line',
          },
        ],
      },
      { width: 800, height: 460 },
    );
    const annotation = layout.annotations?.[0];
    const labelBounds = annotation?.label?.bounds;
    const unionBounds = annotation?.bounds;
    expect(labelBounds).toBeDefined();
    expect(unionBounds).toBeDefined();

    // The subtitle is wider and sits below, so the union must be strictly bigger.
    // If label.bounds were the union, these would be identical.
    expect(labelBounds?.width).toBeLessThan(unionBounds?.width ?? 0);
    expect(labelBounds?.height).toBeLessThan(unionBounds?.height ?? 0);
  });

  // Regression: `anchor: 'top'`/`'bottom'` render with textAnchor 'start', so the
  // block used to hang entirely to the RIGHT of its data point — "above" read as
  // "up and to the right", and authors had to hand-compute a negative dx of about
  // half the block width to re-center it. The block now straddles the point
  // horizontally; the TEXT inside stays left-aligned (ragged right).
  describe('top/bottom anchored blocks straddle their data point', () => {
    const centerOffsetFor = (annotation: Record<string, unknown>) => {
      const layout = compileChart(
        {
          mark: 'line' as const,
          data: [
            { m: 'Jan', v: 10 },
            { m: 'Feb', v: 50 },
            { m: 'Mar', v: 30 },
          ],
          encoding: {
            x: { field: 'm' as const, type: 'ordinal' as const },
            y: { field: 'v' as const, type: 'quantitative' as const },
          },
          annotations: [annotation],
        },
        { width: 800, height: 460 },
      );
      const resolved = layout.annotations?.[0];
      const bounds = resolved?.label?.bounds;
      const pointX = resolved?.dot?.x;
      if (!bounds || pointX === undefined) throw new Error('annotation did not resolve');
      return bounds.x + bounds.width / 2 - pointX;
    };

    /** The block's horizontal span expressed relative to the data point. */
    const spanAround = (annotation: Record<string, unknown>) => {
      const layout = compileChart(
        {
          mark: 'line' as const,
          data: [
            { m: 'Jan', v: 10 },
            { m: 'Feb', v: 50 },
            { m: 'Mar', v: 30 },
          ],
          encoding: {
            x: { field: 'm' as const, type: 'ordinal' as const },
            y: { field: 'v' as const, type: 'quantitative' as const },
          },
          annotations: [annotation],
        },
        { width: 800, height: 460 },
      );
      const resolved = layout.annotations?.[0];
      const bounds = resolved?.label?.bounds;
      const pointX = resolved?.dot?.x;
      if (!bounds || pointX === undefined) throw new Error('annotation did not resolve');
      return { left: bounds.x - pointX, right: bounds.x + bounds.width - pointX };
    };

    test('a single-line top-anchored block centers on its point', () => {
      expect(
        centerOffsetFor({ type: 'text', x: 'Feb', y: 50, text: 'Peak here', anchor: 'top' }),
      ).toBeCloseTo(0, 1);
    });

    test('a multi-line top-anchored block centers on its point', () => {
      expect(
        centerOffsetFor({
          type: 'text',
          x: 'Feb',
          y: 50,
          text: 'Hurricanes and\na strike cut',
          anchor: 'top',
        }),
      ).toBeCloseTo(0, 1);
    });

    test('a multi-line bottom-anchored block centers on its point', () => {
      expect(
        centerOffsetFor({
          type: 'text',
          x: 'Feb',
          y: 50,
          text: 'Two lines\nhere now',
          anchor: 'bottom',
        }),
      ).toBeCloseTo(0, 1);
    });

    test('the text inside stays left-aligned, not center-aligned', () => {
      const layout = compileChart(
        {
          mark: 'line' as const,
          data: [
            { m: 'Jan', v: 10 },
            { m: 'Feb', v: 50 },
          ],
          encoding: {
            x: { field: 'm' as const, type: 'ordinal' as const },
            y: { field: 'v' as const, type: 'quantitative' as const },
          },
          annotations: [
            { type: 'text' as const, x: 'Feb', y: 50, text: 'Two\nlines', anchor: 'top' as const },
          ],
        },
        { width: 800, height: 460 },
      );
      expect(layout.annotations?.[0]?.label?.style?.textAnchor).toBe('start');
    });

    test('left/right anchors are unaffected (block sits beside the point)', () => {
      // "Beside", not "straddling": the whole block clears the point by exactly the
      // ANCHOR_OFFSET setback (28px), so the point lies OUTSIDE the block's x-span.
      // A sign check alone (`centerOffset < 0`) still passes for a centered block
      // that has merely drifted — which is the regression this guards.

      const left = spanAround({ type: 'text', x: 'Feb', y: 50, text: 'Left side', anchor: 'left' });
      // Whole block to the LEFT: its near (right) edge stops one setback short of
      // the point, so the point never falls inside the span.
      expect(left.right).toBeCloseTo(-ANCHOR_OFFSET, 1);
      expect(left.left).toBeLessThan(left.right);

      const right = spanAround({
        type: 'text',
        x: 'Feb',
        y: 50,
        text: 'Right side',
        anchor: 'right',
      });
      // Mirror image: near (left) edge starts one setback past the point.
      expect(right.left).toBeCloseTo(ANCHOR_OFFSET, 1);
      expect(right.right).toBeGreaterThan(right.left);

      // And the contrast that gives "beside" its meaning: a top anchor STRADDLES,
      // i.e. the point lies strictly inside the block's x-span.
      const top = spanAround({ type: 'text', x: 'Feb', y: 50, text: 'Left side', anchor: 'top' });
      expect(top.left).toBeLessThan(0);
      expect(top.right).toBeGreaterThan(0);
    });
  });

  describe('annotation typography survives normalization', () => {
    const baseSpec = (annotation: Record<string, unknown>) => ({
      mark: 'line' as const,
      data: [
        { year: '1980', value: 0.26 },
        { year: '2025', value: 1.17 },
      ],
      encoding: {
        x: { field: 'year' as const, type: 'ordinal' as const },
        y: { field: 'value' as const, type: 'quantitative' as const },
      },
      annotations: [annotation],
    });

    const styleOf = (annotation: Record<string, unknown>) => {
      const layout = compileChart(baseSpec(annotation), { width: 800, height: 460 });
      const style = layout.annotations?.[0]?.label?.style;
      if (!style) throw new Error('annotation did not resolve a label style');
      return style;
    };

    test('a subtitle promotes the primary line to a bold lede', () => {
      const style = styleOf({
        type: 'text',
        x: '2025',
        y: 1.17,
        text: 'Peak',
        subtitle: 'the warmest year on record',
      });
      expect(style.fontWeight).toBe(700);
    });

    test('a plain annotation stays regular weight', () => {
      const style = styleOf({ type: 'text', x: '2025', y: 1.17, text: 'Peak' });
      expect(style.fontWeight).toBe(400);
    });

    test('the default font size reaches the compiled output', () => {
      const style = styleOf({ type: 'text', x: '2025', y: 1.17, text: 'Peak' });
      expect(style.fontSize).toBe(13);
    });

    test('an explicit fontWeight beats the lede rule', () => {
      const style = styleOf({
        type: 'text',
        x: '2025',
        y: 1.17,
        text: 'Peak',
        subtitle: 'context',
        fontWeight: 300,
      });
      expect(style.fontWeight).toBe(300);
    });

    test('an explicit fontSize beats the default', () => {
      const style = styleOf({ type: 'text', x: '2025', y: 1.17, text: 'Peak', fontSize: 18 });
      expect(style.fontSize).toBe(18);
    });
  });
});
