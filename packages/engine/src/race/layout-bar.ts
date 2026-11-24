import {
  DEFAULT_THEME,
  estimateTextWidth,
  type RaceBarGeometry,
  type RaceBarStatic,
  type RaceFrame,
  type Rect,
  truncateToWidth,
} from '@opendata-ai/openchart-core';
import { crossfadeTicks, valueTickLadder } from './ticks';

const NAME_GAP = 8;
const VALUE_GAP = 6;
const TICK_PADDING = 10;
const TICK_LABEL_GAP = 4;
const MIN_PLOT_FRACTION = 0.4;

/** Layout inputs measured for the whole race and the current chart area. */
export interface BarStaticInput {
  area: Rect;
  top: number;
  maxLabelWidth: number;
  maxValueLabelWidth: number;
  cornerRadius: number;
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
  const areaWidth = Math.max(0, area.width);
  const minPlotWidth = areaWidth * MIN_PLOT_FRACTION;
  const gutterBudget = areaWidth - minPlotWidth;
  const nameGutter = Math.min(maxLabelWidth + NAME_GAP, gutterBudget);
  const valueGutter = Math.min(
    maxValueLabelWidth + VALUE_GAP,
    (gutterBudget - nameGutter) / (hasNegatives ? 2 : 1),
  );
  const leftGutter = nameGutter + (hasNegatives ? valueGutter : 0);
  const tickFontSize = input.fontSize.tick;
  const tickHeight = Math.min(tickFontSize + TICK_PADDING, Math.max(0, area.height));
  const plot = {
    x: area.x + leftGutter,
    y: area.y + tickHeight,
    width: Math.max(minPlotWidth, areaWidth - leftGutter - valueGutter),
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
    clip: { x: area.x, y: plot.y, width: areaWidth, height: plot.height },
    nameX: area.x + Math.min(maxLabelWidth, nameGutter),
    rowHeight,
    barHeight: Math.round(rowHeight * 0.74),
    cornerRadius: input.cornerRadius,
    top,
    axisY: plot.y,
    tickFontSize,
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

interface BarValueText {
  fontSize: number;
  fontWeight: number;
  measureWidth?: typeof estimateTextWidth;
}

const defaultValueText: BarValueText = {
  fontSize: DEFAULT_THEME.fonts.sizes.body,
  fontWeight: DEFAULT_THEME.fonts.weights.normal,
};

/** Fit a race label with an ellipsis, or leave it empty when even the ellipsis cannot fit. */
export function truncateRaceLabel(
  label: string,
  budget: number,
  fontSize: number,
  fontWeight: number,
  measureWidth: typeof estimateTextWidth,
): string {
  const fitted = truncateToWidth(label, budget, fontSize, fontWeight, measureWidth);
  return fitted === '…' && measureWidth(fitted, fontSize, fontWeight) > budget ? '' : fitted;
}

function fitBarValue(
  text: string,
  edge: number,
  y: number,
  negative: boolean,
  clip: Rect,
  { fontSize, fontWeight, measureWidth = estimateTextWidth }: BarValueText,
): RaceBarGeometry['rows'][number]['value'] {
  let width = measureWidth(text, fontSize, fontWeight);
  if (width > clip.width) {
    text = truncateRaceLabel(text, clip.width, fontSize, fontWeight, measureWidth);
    width = measureWidth(text, fontSize, fontWeight);
  }
  const left = clip.x + (negative ? width : 0);
  const right = clip.x + clip.width - (negative ? 0 : width);
  const preferredX = edge + (negative ? -VALUE_GAP : VALUE_GAP);
  return {
    x: Math.max(left, Math.min(right, preferredX)),
    y,
    text,
    anchor: negative ? 'end' : 'start',
  };
}

/** Keep gridlines in the crossfade and give the zero and stronger ticks first claim on label space. */
function barTicks(
  stat: RaceBarStatic,
  domain: RaceFrame['domain'],
  { scale, pxPerUnit }: ReturnType<typeof barScale>,
  formatTick: (value: number) => string,
  { fontWeight, measureWidth = estimateTextWidth }: BarValueText,
): RaceBarGeometry['ticks'] {
  const fontSize = stat.tickFontSize;
  const { x, width } = stat.clip;
  const ladder = valueTickLadder(domain[1] - domain[0]);
  const ticks = crossfadeTicks(domain, pxPerUnit, ladder).map((tick) => ({
    ...tick,
    position: scale(tick.value),
    label: '',
  }));

  const occupied: Array<{ left: number; right: number }> = [];
  const byPriority = [...ticks].sort(
    (a, b) => Number(b.value === 0) - Number(a.value === 0) || b.opacity - a.opacity,
  );
  for (const tick of byPriority) {
    const { position } = tick;
    const budget = 2 * Math.max(0, Math.min(position - x, x + width - position));
    const label = formatTick(tick.value);
    if (!label) continue;
    const labelWidth = measureWidth(label, fontSize, fontWeight);
    if (labelWidth > budget) continue;
    const halfWidth = labelWidth / 2;
    const left = position - halfWidth;
    const right = position + halfWidth;
    if (
      occupied.some(
        (other) => left < other.right + TICK_LABEL_GAP && right > other.left - TICK_LABEL_GAP,
      )
    ) {
      continue;
    }
    tick.label = label;
    occupied.push({ left, right });
  }
  return ticks;
}

/** Positions a frame's bars, labels, and ticks on the same x scale. */
export function barGeometry(
  stat: RaceBarStatic,
  frame: RaceFrame,
  formatTick: (value: number) => string,
  valueText: BarValueText = defaultValueText,
): RaceBarGeometry {
  const { plot, rowHeight, barHeight, clip } = stat;
  const axis = barScale(stat, frame.domain);
  const { scale, zero } = axis;
  const inset = (rowHeight - barHeight) / 2;
  const right = clip.x + clip.width;
  const valueLeft = Math.max(clip.x, Math.min(stat.nameX + NAME_GAP, right));
  const valueClip = { ...clip, x: valueLeft, width: right - valueLeft };

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
        value: fitBarValue(item.valueLabel, x, center, item.value < 0, valueClip, valueText),
      };
    }),
    ticks: barTicks(stat, frame.domain, axis, formatTick, valueText),
    period: stat.period ? { ...stat.period, text: frame.period.label } : null,
    summary: stat.summary && frame.summary ? { ...stat.summary, text: frame.summary.label } : null,
  };
}
