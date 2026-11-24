import type { RaceBarGeometry, RaceBarStatic, RaceFrame, Rect } from '@opendata-ai/openchart-core';
import { crossfadeTicks, valueTickLadder } from './ticks';

const NAME_GAP = 8;
const VALUE_GAP = 6;
const TICK_HEIGHT = 22;

/** Layout inputs measured for the whole race and the current chart area. */
export interface BarStaticInput {
  area: Rect;
  top: number;
  maxLabelWidth: number;
  maxValueLabelWidth: number;
  /** True when any value in the race matrix is negative. */
  hasNegatives: boolean;
  fontSize: { name: number; value: number; tick: number };
  showPeriod: boolean;
  showSummary: boolean;
}

/** Reserves fixed label gutters and clips rows vertically across the full area width. */
export function computeBarStatic(input: BarStaticInput): RaceBarStatic {
  const { area, top, maxLabelWidth, maxValueLabelWidth, hasNegatives, showPeriod, showSummary } =
    input;
  const nameGutter = maxLabelWidth + NAME_GAP;
  const valueGutter = maxValueLabelWidth + VALUE_GAP;
  const leftGutter = nameGutter + (hasNegatives ? valueGutter : 0);
  const tickHeight = Math.min(TICK_HEIGHT, Math.max(0, area.height));
  const plot = {
    x: area.x + leftGutter,
    y: area.y + tickHeight,
    width: Math.max(0, area.width - leftGutter - valueGutter),
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
    nameX: area.x + maxLabelWidth,
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

/** Maps the frame domain to the fixed plot and supplies the baseline and tick spacing scale. */
function barScale(stat: RaceBarStatic, [min, max]: RaceFrame['domain']) {
  const { x, width } = stat.plot;
  const span = max - min;
  const scale = (value: number) => x + ((value - min) / (span || 1)) * width;
  return { scale, zero: scale(0), pxPerUnit: span > 0 ? width / span : 0 };
}

/** Positions a frame's bars, labels, and ticks on the same x scale. */
export function barGeometry(
  stat: RaceBarStatic,
  frame: RaceFrame,
  formatTick: (value: number) => string,
): RaceBarGeometry {
  const { plot, rowHeight, barHeight } = stat;
  const [min, max] = frame.domain;
  const { scale, zero, pxPerUnit } = barScale(stat, frame.domain);
  const inset = (rowHeight - barHeight) / 2;

  return {
    mark: 'bar',
    rows: frame.items.map((item) => {
      const x = scale(item.value);
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
    ticks: crossfadeTicks(frame.domain, pxPerUnit, valueTickLadder(max - min)).map(
      ({ value, opacity }) => ({
        value,
        opacity,
        position: scale(value),
        label: formatTick(value),
      }),
    ),
    period: stat.period ? { ...stat.period, text: frame.period.label } : null,
    summary: stat.summary && frame.summary ? { ...stat.summary, text: frame.summary.label } : null,
  };
}
