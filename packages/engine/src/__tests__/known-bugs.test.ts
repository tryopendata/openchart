import type { ChartLayout, LineMark } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { describe, expect, test } from 'vitest';
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

  // Regression: `normalizeSpec` used to stamp `fontSize: 12` / `fontWeight: 400`
  // onto every text annotation. That made `annotation.fontWeight` always defined,
  // so the lede rule (subtitle promotes the primary line to bold) could never fire
  // and DEFAULT_ANNOTATION_FONT_SIZE could never apply — both shipped as dead code.
  //
  // Every annotation unit test called the resolvers directly, bypassing normalize,
  // so all 3305 tests passed while the compiled output was wrong. This test must go
  // through compileChart: that is the only path where the bug was observable.
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
      expect(
        centerOffsetFor({ type: 'text', x: 'Feb', y: 50, text: 'Left side', anchor: 'left' }),
      ).toBeLessThan(0);
      expect(
        centerOffsetFor({ type: 'text', x: 'Feb', y: 50, text: 'Right side', anchor: 'right' }),
      ).toBeGreaterThan(0);
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
