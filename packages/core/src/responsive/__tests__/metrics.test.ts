import { describe, expect, it } from 'vitest';
import {
  AXIS_TITLE_GAP,
  AXIS_TITLE_OFFSET_DEFAULT,
  axisTitleOffset,
  TICK_LABEL_OFFSET,
} from '../metrics';

// The rotated y-axis title is anchored at its center and its glyph box extends
// half the title font size toward the tick labels. axisTitleOffset() returns the
// distance from the chart edge to that center; visible clearance between the
// widest tick label and the title's near edge is therefore:
//   offset - TICK_LABEL_OFFSET - tickLabelWidth - titleFontSize / 2
const visibleClearance = (offset: number, tickLabelWidth: number, titleFontSize: number): number =>
  offset - TICK_LABEL_OFFSET - tickLabelWidth - titleFontSize / 2;

describe('axisTitleOffset', () => {
  const WIDE = 1200; // wide viewport so the dynamic value wins over the floor

  it('leaves the title clear of the tick labels at the default font size', () => {
    const offset = axisTitleOffset(40, 13, WIDE);
    // ~AXIS_TITLE_GAP of clearance, never overlapping (negative).
    expect(visibleClearance(offset, 40, 13)).toBeGreaterThanOrEqual(AXIS_TITLE_GAP - 1);
  });

  it('keeps clearance constant as the title font size grows', () => {
    // The original bug: a fixed gap let large title fonts overlap the tick
    // labels because the title's half-glyph ate into the gap. Clearance must
    // stay ~AXIS_TITLE_GAP regardless of how big the title font is.
    const small = visibleClearance(axisTitleOffset(40, 13, WIDE), 40, 13);
    const large = visibleClearance(axisTitleOffset(40, 30, WIDE), 40, 30);

    expect(large).toBeGreaterThanOrEqual(AXIS_TITLE_GAP - 1);
    expect(Math.abs(large - small)).toBeLessThanOrEqual(1); // rounding only
  });

  it('pushes the title further left as tick labels get wider', () => {
    // Both label widths sit above the viewport floor, so the offset tracks the
    // label width 1:1 (a 60px wider label moves the title 60px further left).
    const narrow = axisTitleOffset(50, 13, WIDE);
    const wide = axisTitleOffset(110, 13, WIDE);
    expect(narrow).toBeGreaterThan(AXIS_TITLE_OFFSET_DEFAULT); // floor not in play
    expect(wide - narrow).toBeCloseTo(60, 0);
  });

  it('falls back to the viewport-minimum offset for short labels on wide containers', () => {
    // Tiny label + small font: the dynamic value is below the floor, so the
    // floor wins (prevents the title from hugging the chart edge).
    const offset = axisTitleOffset(2, 11, WIDE);
    expect(offset).toBe(AXIS_TITLE_OFFSET_DEFAULT);
  });
});
