import { DIVERGING_PALETTES } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

const OPTIONS = { width: 800, height: 400 };

/** d3 hands interpolated colors back as `rgb(r, g, b)`; compare on a single form. */
function hex(value: string): string {
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value.trim());
  if (!rgb) return value.trim().toLowerCase();
  const channel = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}`;
}

const ROWS = [
  { day: 'a', value: -2 },
  { day: 'b', value: 0 },
  { day: 'c', value: 2 },
];

/** The compiled fill of the mark carrying `value`, as the reader would see it. */
function colorAt(layout: ReturnType<typeof compileChart>, value: number): string {
  const mark = layout.marks.find(
    (m) => (m as { data?: Record<string, unknown> }).data?.value === value,
  );
  const fill = (mark as { fill?: string } | undefined)?.fill;
  return hex(String(fill));
}

const RED_BLUE = DIVERGING_PALETTES.redBlue;
const RED = hex(RED_BLUE[0]);
const BLUE = hex(RED_BLUE[RED_BLUE.length - 1]);

// A bar, not a rect: this suite is about the color ramp, and it needs a mark
// with a quantitative axis to carry the value. `rect` used to alias the column
// renderer, so it stood in for one here; now that `rect` is a real heatmap mark
// (two categorical axes, cells sized by bandwidth) it emits nothing for a
// quantitative y, and there is no fill to read back.
function spec(reverse?: boolean) {
  return {
    mark: 'bar' as const,
    data: ROWS,
    encoding: {
      x: { field: 'day', type: 'nominal' as const },
      y: { field: 'value', type: 'quantitative' as const },
      color: {
        field: 'value',
        type: 'quantitative' as const,
        scale: reverse ? { scheme: 'redBlue', reverse: true } : { scheme: 'redBlue' },
      },
    },
  };
}

describe('scale.reverse on a color channel', () => {
  it('ramps low -> red, high -> blue by default (ColorBrewer RdBu order)', () => {
    const layout = compileChart(spec(), OPTIONS);
    expect(colorAt(layout, -2)).toBe(RED);
    expect(colorAt(layout, 2)).toBe(BLUE);
  });

  it('flips the ramp so low -> blue, high -> red', () => {
    const layout = compileChart(spec(true), OPTIONS);
    expect(colorAt(layout, -2)).toBe(BLUE);
    expect(colorAt(layout, 2)).toBe(RED);
  });

  it('keeps the diverging midpoint label when the ramp is reversed', () => {
    // A reversed diverging ramp is still diverging: flipping the stops must not
    // cost it the center tick (min / mid / max, not just min / max).
    const forward = compileChart(spec(), OPTIONS).legend;
    const reversed = compileChart(spec(true), OPTIONS).legend;
    const tickCount = (l: typeof forward) =>
      (l as { ticks?: unknown[] } | undefined)?.ticks?.length ?? 0;
    expect(tickCount(forward)).toBe(3);
    expect(tickCount(reversed)).toBe(tickCount(forward));
  });

  it('keeps the legend ramp in step with the marks', () => {
    const legend = compileChart(spec(true), OPTIONS).legend;
    // The legend resolves its ramp from the same scale.range the marks use, so a
    // reversed scale must not leave the legend pointing the original direction.
    expect(legend?.type).toBe('continuous');
    const stops = (legend as { colorStops: Array<{ color: string }> }).colorStops;
    expect(stops.length).toBeGreaterThan(1);
    expect(hex(stops[0].color)).toBe(BLUE);
    expect(hex(stops[stops.length - 1].color)).toBe(RED);
  });
});
