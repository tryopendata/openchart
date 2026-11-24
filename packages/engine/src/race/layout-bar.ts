import type { RaceBarGeometry, RaceBarStatic, RaceFrame, Rect } from '@opendata-ai/openchart-core';
import { crossfadeTicks, valueTickLadder } from './ticks';

const NAME_GAP = 8;
const VALUE_GAP = 6;
const TICK_HEIGHT = 22;

export interface BarStaticInput {
  area: Rect;
  top: number;
  maxLabelWidth: number;
  maxValueLabelWidth: number;
  fontSize: { name: number; value: number; tick: number };
  showPeriod: boolean;
  showSummary: boolean;
}

export function computeBarStatic(input: BarStaticInput): RaceBarStatic {
  const { area, top, maxLabelWidth, maxValueLabelWidth, showPeriod, showSummary } = input;
  const nameGutter = maxLabelWidth + NAME_GAP;
  const valueGutter = maxValueLabelWidth + VALUE_GAP;
  const tickHeight = Math.min(TICK_HEIGHT, Math.max(0, area.height));
  const plot = {
    x: area.x + nameGutter,
    y: area.y + tickHeight,
    width: Math.max(0, area.width - nameGutter - valueGutter),
    height: Math.max(0, area.height - tickHeight),
  };
  const rowHeight = plot.height / top;
  const right = plot.x + plot.width;
  const bottom = plot.y + plot.height;
  const period = showPeriod
    ? { x: right, y: bottom, fontSize: Math.max(36, Math.min(72, rowHeight * 2.4)) }
    : null;

  return {
    plot,
    clip: { x: area.x, y: plot.y, width: Math.max(0, area.width), height: plot.height },
    nameX: plot.x - NAME_GAP,
    rowHeight,
    barHeight: Math.round(rowHeight * 0.74),
    top,
    axisY: plot.y,
    period,
    summary: showSummary
      ? { x: right, y: period ? Math.max(plot.y, bottom - period.fontSize - VALUE_GAP) : bottom }
      : null,
  };
}

function shiftDecimal(value: number, places: number): number {
  if (places === 0) return value;
  const [coefficient, exponent] = value.toExponential().split('e');
  return Number(`${coefficient}e${Number(exponent) + places}`);
}

export function barGeometry(
  stat: RaceBarStatic,
  frame: RaceFrame,
  formatTick: (value: number) => string,
): RaceBarGeometry {
  const { plot, clip, rowHeight, barHeight } = stat;
  const [min, max] = frame.domain;
  const rightGutter = Math.max(0, clip.x + clip.width - (plot.x + plot.width));
  const negativeInset = min < 0 ? Math.min(rightGutter, plot.width) : 0;
  const xStart = plot.x + negativeInset;
  const width = plot.width - negativeInset;

  // Rescale extreme domains by a power of ten to preserve decimal tick steps.
  const rawSpan = max - min;
  const places =
    rawSpan === Infinity ? -308 : rawSpan > 0 && width / rawSpan === Infinity ? 308 : 0;
  const scaledMin = shiftDecimal(min, places);
  const scaledMax = shiftDecimal(max, places);
  const span = scaledMax - scaledMin;
  const smallestStep = places > 0 ? shiftDecimal(Number.MIN_VALUE, places) : 0;
  const ladder = valueTickLadder(span).filter((step) => step >= smallestStep);
  const scale = (value: number) => xStart + ((value - scaledMin) / (span || 1)) * width;
  const zero = scale(0);
  const inset = (rowHeight - barHeight) / 2;

  return {
    mark: 'bar',
    rows: frame.items.map((item) => {
      const x = scale(shiftDecimal(item.value, places));
      const y = plot.y + item.rankPos * rowHeight + inset;
      const center = y + barHeight / 2;
      return {
        key: item.key,
        color: item.color,
        opacity: item.opacity,
        bar: { x: Math.min(zero, x), y, width: Math.abs(x - zero), height: barHeight },
        name: { x: stat.nameX, y: center, text: item.label },
        value: {
          x: x + (item.value < 0 ? -VALUE_GAP : VALUE_GAP),
          y: center,
          text: item.valueLabel,
        },
      };
    }),
    ticks: crossfadeTicks([scaledMin, scaledMax], width / span, ladder).map(
      ({ value, opacity }) => {
        const tick = shiftDecimal(value, -places);
        return { value: tick, opacity, position: scale(value), label: formatTick(tick) };
      },
    ),
    period: stat.period ? { ...stat.period, text: frame.period.label } : null,
    summary: stat.summary && frame.summary ? { ...stat.summary, text: frame.summary.label } : null,
  };
}
