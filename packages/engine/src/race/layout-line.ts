import {
  estimateTextWidth,
  type RaceLineGeometry,
  type RaceTick,
} from '@opendata-ai/openchart-core';
import { interpolateRaceValue } from './interpolate';
import { truncateRaceLabel } from './layout-bar';
import type { RaceLayoutsByMark, RaceMarkEntry } from './marks';
import { crossfadeTicks, periodTickLadder, valueTickLadder } from './ticks';
import type { RaceModel } from './types';

const LABEL_GAP = 6;
const TICK_GAP = 4;
const TICK_PADDING = 10;
const SAMPLES_PER_PERIOD = 24;
const VISIBILITY_EPSILON = 1e-6;

type LineLayout = RaceLayoutsByMark['line'];
type LineSeries = RaceLineGeometry['series'][number];

// Round each bound outward on its own nested ladder so a growing span can't shrink either bound.
function roundBound(value: number): number {
  const step = valueTickLadder(Math.abs(value))[0];
  if (!step) return value;
  const rounded = Math.sign(value) * Math.ceil(Math.abs(value) / step) * step;
  return Number.isFinite(rounded)
    ? Math.sign(value) * Math.max(Math.abs(value), Math.abs(rounded))
    : value;
}

/** Reserve space for the y axis, period ticks, and name/value labels. */
export const computeLineStatic: RaceMarkEntry<'line'>['computeStatic'] = (
  model,
  { area, labels, theme },
  mark,
  measureText,
) => {
  const { body, axisTick } = theme.fonts.sizes;
  const { normal } = theme.fonts.weights;
  let labelWidth = 0;
  let yAxisWidth = 0;
  let min = 0;
  let max = 0;
  const measureValue = (value: number, label: string) => {
    if (!Number.isFinite(value)) return;
    const text = model.formatValue(value);
    labelWidth = Math.max(labelWidth, measureText(`${label} ${text}`, body, normal).width);
    yAxisWidth = Math.max(yAxisWidth, measureText(text, axisTick, normal).width);
  };
  for (const [key, values] of model.matrix.values.entries()) {
    const label = labels[key];
    let low = Infinity;
    let high = -Infinity;
    for (const [period, value] of values.entries()) {
      if (!Number.isFinite(value)) continue;
      measureValue(value, label);
      min = Math.min(min, value);
      max = Math.max(max, value);
      const next = values[period + 1];
      const midpoint = interpolateRaceValue(values, period, 0.5);
      if (!Number.isFinite(midpoint) || value === next) continue;
      measureValue(midpoint, label);
      // Integer observations can display extra decimal places between periods.
      const fractional = Math.floor(midpoint) + 0.88;
      const start = Math.min(value, next);
      const end = Math.max(value, next);
      if (start < fractional && fractional < end) measureValue(fractional, label);
      low = Math.min(low, start);
      high = Math.max(high, end);
    }
    // Compact and SI formats can get shorter at a unit change. Allow room
    // for the mantissa just below that change as well as the observations.
    for (let unit = 1000; unit <= Math.max(-low, high); unit *= 1000) {
      const beforeChange = unit * 0.99988;
      if (low <= beforeChange && beforeChange <= high) measureValue(beforeChange, label);
      if (low <= -beforeChange && -beforeChange <= high) measureValue(-beforeChange, label);
    }
  }

  for (const value of [roundBound(min), 0, roundBound(max)]) {
    yAxisWidth = Math.max(
      yAxisWidth,
      measureText(model.formatValue(value), axisTick, normal).width,
    );
  }
  const window = mark.window ?? 'reveal';
  let leftWidth = yAxisWidth + TICK_GAP;
  let rightWidth = labelWidth + LABEL_GAP;
  if (window === 'all') {
    const [first, ...rest] = model.periodLabels;
    leftWidth = Math.max(leftWidth, measureText(first, axisTick, normal).width + TICK_GAP / 2);
    for (const label of rest) {
      rightWidth = Math.max(rightWidth, measureText(label, axisTick, normal).width + TICK_GAP / 2);
    }
  }
  const gutterBudget = area.width / 2;
  const leftGutter = Math.min(
    Math.ceil(leftWidth),
    gutterBudget - Math.min(rightWidth, gutterBudget / 2),
  );
  const labelGutter = Math.min(Math.ceil(rightWidth), gutterBudget - leftGutter);
  const plot = {
    x: area.x + leftGutter,
    y: area.y,
    width: area.width - leftGutter - labelGutter,
    height: Math.max(0, area.height - axisTick - TICK_PADDING),
  };
  return {
    plot,
    window,
    xScale: {
      domain: [0, model.timeline.periodCount - 1],
      range: [plot.x, plot.x + plot.width],
    },
    yAxisX: plot.x,
    labelGutter,
    tickFontSize: axisTick,
  };
};

interface VisibilityRun {
  start: number;
  end: number;
  peakTime: number;
  peakOpacity: number;
}

function visibilityRuns(model: RaceModel, key: number, values: Float64Array): VisibilityRun[] {
  const { timeline } = model;
  const threshold = timeline.top - VISIBILITY_EPSILON;
  const runs: VisibilityRun[] = [];
  function add(start: number, end: number, startRank: number, endRank: number) {
    const peakOpacity = Math.min(1, timeline.top - Math.min(startRank, endRank));
    const fullRank = timeline.top - 1;
    let peakTime = end;
    if (endRank > startRank && endRank > fullRank) {
      const fraction = Math.max(0, (fullRank - startRank) / (endRank - startRank));
      peakTime = start + fraction * (end - start);
    }
    const previous = runs.at(-1);
    if (previous && previous.end === start) {
      previous.end = end;
      if (peakOpacity >= previous.peakOpacity) {
        previous.peakOpacity = peakOpacity;
        previous.peakTime = peakTime;
      }
    } else {
      runs.push({ start, end, peakTime, peakOpacity });
    }
  }

  for (let period = 0; period < values.length; period++) {
    if (!Number.isFinite(values[period])) continue;
    let rank = timeline.rankPos(key, period);
    if (rank < threshold) add(period, period, rank, rank);
    if (!Number.isFinite(values[period + 1])) continue;

    // The timeline interpolates smoothed ranks between these samples. Use the
    // crossing time so a direct seek and a sequence of draws see the same history.
    for (let sample = 0; sample < SAMPLES_PER_PERIOD; sample++) {
      const start = period + sample / SAMPLES_PER_PERIOD;
      const end = period + (sample + 1) / SAMPLES_PER_PERIOD;
      const nextRank = timeline.rankPos(key, end);
      if (rank < threshold && nextRank < threshold) {
        add(start, end, rank, nextRank);
      } else if (rank < threshold || nextRank < threshold) {
        const crossing = start + ((threshold - rank) / (nextRank - rank)) * (end - start);
        if (rank < threshold) add(start, crossing, rank, threshold);
        else add(crossing, end, threshold, nextRank);
      }
      rank = nextRank;
    }
  }
  return runs;
}

// Only the derived, size-independent history is memoized. The layout is still plain data.
const histories = new WeakMap<RaceModel, ReturnType<typeof buildHistory>>();

function buildHistory(model: RaceModel) {
  return model.matrix.values.map((values, key) => {
    const runs = visibilityRuns(model, key, values);
    let min = 0;
    let max = 0;
    const mins = new Float64Array(values.length);
    const maxes = new Float64Array(values.length);
    values.forEach((value, period) => {
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      mins[period] = min;
      maxes[period] = max;
    });
    return { runs, mins, maxes };
  });
}

function lineText(layout: LineLayout, size: number) {
  const weight = layout.theme.fonts.weights.normal;
  const measure = layout.measureText;
  const measureWidth = measure
    ? (text: string, fontSize: number, fontWeight?: number) =>
        measure(text, fontSize, fontWeight).width
    : estimateTextWidth;
  return {
    width: (text: string) => measureWidth(text, size, weight),
    fit: (text: string, budget: number) =>
      truncateRaceLabel(text, budget, size, weight, measureWidth),
  };
}

function periodTicks(
  layout: LineLayout,
  playhead: number,
  x: (period: number) => number,
  xMax: number,
): RaceTick[] {
  const { area, periods, static: stat } = layout;
  const text = lineText(layout, stat.tickFontSize);
  const occupied: Array<{ left: number; right: number }> = [];
  const ticks: RaceTick[] = [];
  const add = (period: number, left: number, right: number, required: boolean) => {
    const position = x(period);
    const centered = stat.window === 'reveal';
    const first = period === 0;
    const labelX = centered ? position : position + (first ? -TICK_GAP / 2 : TICK_GAP / 2);
    const budget = centered
      ? 2 * Math.min(labelX - left, right - labelX)
      : first
        ? labelX - left
        : right - labelX;
    const label = required ? text.fit(periods[period], budget) : periods[period];
    const width = text.width(label);
    const start = labelX - (centered ? width / 2 : first ? width : 0);
    const end = start + width;
    if (
      !required &&
      (width > budget ||
        occupied.some((other) => start < other.right + TICK_GAP && end > other.left - TICK_GAP))
    )
      return;
    ticks.push({ value: period, label, opacity: 1, position });
    if (label) occupied.push({ left: start, right: end });
  };
  const right = area.x + area.width;
  const middle = (x(0) + x(playhead)) / 2;
  add(0, area.x, playhead === 0 ? right : middle - TICK_GAP / 2, true);
  if (playhead !== 0) add(playhead, middle + TICK_GAP / 2, right, true);

  const { width } = stat.plot;
  if (width > 0) {
    // Use the ladder as a starting density. Actual label bounds decide which ticks fit.
    let step = 1;
    for (const candidate of periodTickLadder()) {
      if ((candidate * width) / xMax > 40) break;
      step = candidate;
    }
    for (let period = step; period <= xMax; period += step) {
      if (period !== playhead) add(period, area.x, right, false);
    }
  }
  return ticks.sort((a, b) => a.value - b.value);
}

function placeHeadLabels(layout: LineLayout, series: LineSeries[]) {
  const { plot } = layout.static;
  const { sizes, weights } = layout.theme.fonts;
  const fontSize = sizes.body;
  const measuredHeight = layout.measureText?.('Mg', fontSize, weights.normal).height;
  // Some fonts' ascenders and descenders exceed the nominal body size.
  const labelHeight = Math.ceil(measuredHeight ?? fontSize * 1.2) + 1;
  const spacing = Math.max(fontSize + 2, labelHeight);
  const capacity = Math.max(0, Math.floor((plot.height - labelHeight) / spacing) + 1);
  const byY = series
    .slice(0, capacity)
    .map(({ endLabel }) => endLabel)
    .sort((a, b) => a.y - b.y);
  let next = plot.y + labelHeight / 2;
  for (const label of byY) {
    label.y = Math.max(label.y, next);
    next = label.y + spacing;
  }
  next = plot.y + plot.height - labelHeight / 2;
  for (const label of byY.reverse()) {
    label.y = Math.min(label.y, next);
    next = label.y - spacing;
  }
  for (const { endLabel } of series.slice(capacity)) {
    endLabel.text = '';
    endLabel.value = '';
  }
}

function departingOpacity(run: VisibilityRun, t: number): number {
  const expiry = run.end + 1;
  return t < run.peakTime ? 0 : run.peakOpacity * ((expiry - t) / (expiry - run.peakTime));
}

/** Draw the ranked series on a domain that includes all points shown up to the playhead. */
export const lineGeometry: RaceMarkEntry<'line'>['geometry'] = (model, layout, frame) => {
  const { t } = frame;
  const { plot, xScale, window, tickFontSize } = layout.static;
  const xMax = window === 'all' ? xScale.domain[1] : Math.max(1, t);
  const x = (period: number) => xScale.range[0] + (period / xMax) * plot.width;
  const period = frame.period.index;
  const fraction = t - period;
  const active = new Map(frame.items.map((item) => [item.key, item]));
  let history = histories.get(model);
  if (!history) {
    history = buildHistory(model);
    histories.set(model, history);
  }

  let min = 0;
  let max = 0;
  const visible: Array<{ key: number; opacity: number }> = [];
  for (const [key, { runs, mins, maxes }] of history.entries()) {
    let index = runs.length - 1;
    while (index >= 0 && runs[index].start > t) index--;
    const run = runs[index];
    const item = active.get(model.matrix.keys[key]);
    if (!run && !item) continue;

    const lastDraw = item || !run ? t : Math.min(t, run.end + 1);
    const lastPeriod = Math.floor(lastDraw);
    const lastValue = interpolateRaceValue(
      model.matrix.values[key],
      lastPeriod,
      lastDraw - lastPeriod,
    );
    min = Math.min(min, mins[lastPeriod], Number.isFinite(lastValue) ? lastValue : 0);
    max = Math.max(max, maxes[lastPeriod], Number.isFinite(lastValue) ? lastValue : 0);
    let opacity = item?.opacity ?? 0;
    // Keep the frame's entrance fade. Extend a departing series from its last peak
    // to one period past the exit, even when the frame has already faded it out.
    while (index >= 0 && runs[index].end + 1 > t) {
      opacity = Math.max(opacity, departingOpacity(runs[index], t));
      index--;
    }
    if (opacity > 0) visible.push({ key, opacity });
  }
  // In a very short plot, leave room for the strongest labels first.
  visible.sort((a, b) => b.opacity - a.opacity);

  min = roundBound(min);
  max = roundBound(max);
  const divisor = Number.isFinite(max - min) ? 1 : 2;
  const low = min / divisor;
  const high = max / divisor;
  const span = high - low;
  const y = (value: number) =>
    plot.y + plot.height * (span === 0 ? 1 : (high - value / divisor) / span);

  const text = lineText(layout, layout.theme.fonts.sizes.body);
  const series: LineSeries[] = [];
  for (const { key, opacity } of visible) {
    const values = model.matrix.values[key];
    const points = Array.from(values.subarray(0, period + 1), (value, index) =>
      Number.isFinite(value) ? { x: x(index), y: y(value) } : null,
    );
    const head = interpolateRaceValue(values, period, fraction);
    if (fraction > 0) points.push(Number.isFinite(head) ? { x: x(t), y: y(head) } : null);
    let last = points.length - 1;
    while (last >= 0 && points[last] === null) last--;
    const anchor = points[last];
    if (!anchor) continue;
    const labelX = anchor.x + LABEL_GAP;
    const budget = layout.area.x + layout.area.width - labelX;
    const value = text.fit(model.formatValue(Number.isFinite(head) ? head : values[last]), budget);
    const name = text.fit(layout.labels[key], budget - (value ? text.width(` ${value}`) : 0));
    series.push({
      key: model.matrix.keys[key],
      color: layout.colors[key],
      opacity,
      points,
      endLabel: { x: labelX, y: anchor.y, text: name, value },
    });
  }
  placeHeadLabels(layout, series);

  const tickText = lineText(layout, tickFontSize);
  const showAxes = plot.width > 0 && plot.height > 0;
  const yTicks = !showAxes
    ? []
    : (span === 0
        ? [{ value: 0, opacity: 1 }]
        : crossfadeTicks(
            [low, high],
            plot.height / span,
            valueTickLadder(span),
            Math.max(48, tickFontSize * 3),
            Math.max(30, tickFontSize * 2),
          )
      ).map((tick) => {
        const value = tick.value * divisor;
        const position = y(value);
        const distanceToEdge = Math.max(
          0,
          Math.min(position - plot.y, plot.y + plot.height - position),
        );
        const edgeOpacity = value === 0 ? 1 : Math.min(1, distanceToEdge / tickFontSize);
        return {
          value,
          opacity: tick.opacity * edgeOpacity,
          position,
          label: tickText.fit(
            model.formatValue(value),
            layout.static.yAxisX - layout.area.x - TICK_GAP,
          ),
        };
      });
  return {
    mark: 'line',
    series,
    xTicks: showAxes ? periodTicks(layout, period, x, xMax) : [],
    yTicks,
    domain: [min, max],
  };
};
