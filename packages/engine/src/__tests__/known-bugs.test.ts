import type { ChartLayout, LineMark } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { describe, expect, test } from 'vitest';
import { compileChart } from '../compile';

// Red-locked: fixed by docs/plans/05-annotation-placement-engine.md

describe('known layout bugs', () => {
  test.fails('annotation label does not overlap the line it annotates', () => {
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
    // Today the label sits only ANCHOR_OFFSET (8px) from its anchor point ON the line,
    // so the label box almost certainly overlaps the line path.
    const verticallyOverlaps = labelTop < lineMaxY && labelBottom > lineMinY;
    expect(verticallyOverlaps).toBe(false);
  });
});
