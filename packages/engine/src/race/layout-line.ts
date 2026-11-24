import {
  estimateTextWidth,
  type RaceLineGeometry,
  type RaceLineStatic,
  type RaceTick,
} from '@opendata-ai/openchart-core';
import { targetTickCount } from '../layout/axes/ticks';
import { interpolateRaceValue } from './interpolate';
import { truncateRaceLabel } from './layout-bar';
import { departingLineOpacity, lineVisibilityRuns } from './line-visibility';
import type { RaceLayoutsByMark, RaceMarkEntry } from './marks';
import { crossfadeTicks, periodTickLadder, valueTickLadder } from './ticks';
import type { RaceModel } from './types';

const LABEL_GAP = 6;
const TICK_GAP = 4;
const TICK_PADDING = 10;
const OVERLAP_OPACITY = 0.15;

type LineLayout = RaceLayoutsByMark['line'];
type LineSeries = RaceLineGeometry['series'][number];
type SeriesHistory = RaceLineStatic['history'][number];

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
  const history = buildHistory(model);
  let labelWidth = 0;
  let min = 0;
  let max = 0;
  const lastPeriod = model.timeline.periodCount - 1;
  for (const entry of history) {
    labelWidth = Math.max(labelWidth, measureText(labels[entry.key], body, normal).width);
    const lastRun = entry.runs.at(-1);
    if (!lastRun) continue;
    const [low, high] = extentAt(model, entry, Math.min(lastPeriod, lastRun.end + 1));
    min = Math.min(min, low);
    max = Math.max(max, high);
  }

  const valueProbes = new Set([min, 0, max, min / 2 + max / 2]);
  const tickProbes = new Set([roundBound(min), 0, roundBound(max)]);
  for (const bound of [min, max]) {
    for (const step of valueTickLadder(Math.abs(bound))) {
      const value = Math.sign(bound) * step;
      if (value < min || value > max) continue;
      tickProbes.add(value);
      // A fractional position between ticks can have wider text than a whole observation.
      valueProbes.add(value / 3);
    }
  }
  const maxWidth = (values: Set<number>, size: number) =>
    Math.max(
      ...[...values].map((value) => measureText(model.formatValue(value), size, normal).width),
    );
  const window = mark.window ?? 'reveal';
  let leftWidth = maxWidth(tickProbes, axisTick) + TICK_GAP;
  let rightWidth =
    labelWidth + measureText(' ', body, normal).width + maxWidth(valueProbes, body) + LABEL_GAP;
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
      domain: [0, lastPeriod],
      range: [plot.x, plot.x + plot.width],
    },
    yAxisX: plot.x,
    labelGutter,
    tickFontSize: axisTick,
    history,
  };
};

function buildHistory(model: RaceModel): SeriesHistory[] {
  const history: SeriesHistory[] = [];
  model.matrix.values.forEach((values, key) => {
    const runs = lineVisibilityRuns(model.timeline, key, values);
    if (runs.length === 0) return;
    let min = 0;
    let max = 0;
    const mins: number[] = [];
    const maxes: number[] = [];
    values.forEach((value, period) => {
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      mins[period] = min;
      maxes[period] = max;
    });
    history.push({ key, runs, mins, maxes });
  });
  return history;
}

function extentAt(model: RaceModel, { key, mins, maxes }: SeriesHistory, t: number) {
  const period = Math.floor(t);
  const head = interpolateRaceValue(model.matrix.values[key], period, t - period);
  const value = Number.isFinite(head) ? head : 0;
  return [Math.min(mins[period], value), Math.max(maxes[period], value)];
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

interface HeadLabelPlacement {
  endLabel: LineSeries['endLabel'];
  opacity: number;
  rankPos: number;
}

function placeHeadLabels(layout: LineLayout, candidates: HeadLabelPlacement[]) {
  const { plot } = layout.static;
  const { sizes, weights } = layout.theme.fonts;
  const fontSize = sizes.body;
  const measuredHeight = layout.measureText?.('Mg', fontSize, weights.normal).height;
  const labelHeight = Math.ceil(measuredHeight ?? fontSize * 1.2) + 1;
  const spacing = Math.max(fontSize + 2, labelHeight);
  const capacity = plot.height < labelHeight ? 0 : 1 + (plot.height - labelHeight) / spacing;
  const labels: HeadLabelPlacement[] = [];
  let occupied = 0;
  for (const label of candidates) {
    if (occupied + label.opacity <= capacity) {
      labels.push(label);
      occupied += label.opacity;
    } else {
      label.endLabel.text = '';
      label.endLabel.value = '';
    }
  }

  labels.sort((a, b) => a.rankPos - b.rankPos);
  const slots = labels.map((label) => {
    let slot = 0;
    let weightedY = 0;
    let weight = 0;
    for (const other of labels) {
      const delta = label.rankPos - other.rankPos;
      // The opacity-weighted slot and the preferred y agree at a rank crossing.
      slot += other.opacity * Math.max(0, Math.min(1, 0.5 + 2 * delta));
      const nearby = other.opacity * Math.max(0, 1 - Math.abs(delta));
      weightedY += nearby * other.endLabel.y;
      weight += nearby;
    }
    const offset = slot * spacing;
    return { offset, preferred: weightedY / weight - offset };
  });

  // Pool neighboring offsets that would reverse rank order, moving both labels
  // toward their shared center. A fading label contributes less to that center.
  const blocks: Array<{ start: number; end: number; total: number; weight: number }> = [];
  for (const [index, { preferred }] of slots.entries()) {
    const weight = labels[index].opacity;
    const block = { start: index, end: index, total: preferred * weight, weight };
    let previous = blocks.at(-1);
    while (previous && previous.total / previous.weight > block.total / block.weight) {
      block.start = previous.start;
      block.total += previous.total;
      block.weight += previous.weight;
      blocks.pop();
      previous = blocks.at(-1);
    }
    blocks.push(block);
  }

  const top = plot.y + labelHeight / 2;
  const bottom = plot.y + plot.height - labelHeight / 2;
  const minOffset = top - spacing / 2;
  const maxOffset = bottom - (occupied - 0.5) * spacing;
  for (const block of blocks) {
    const base = Math.max(minOffset, Math.min(maxOffset, block.total / block.weight));
    for (let index = block.start; index <= block.end; index++) {
      labels[index].endLabel.y = Math.max(top, Math.min(bottom, base + slots[index].offset));
    }
  }

  // Equal-strength labels recede together as they cross. An established label
  // can retain more opacity when its neighbor is already fading.
  const painted = labels.filter(({ endLabel }) => endLabel.text || endLabel.value);
  for (const label of painted) {
    if (label.opacity <= OVERLAP_OPACITY) continue;
    let visibility = 1;
    for (const other of painted) {
      if (label === other) continue;
      const clearance = Math.abs(label.endLabel.y - other.endLabel.y);
      const fit = Math.max(0, Math.min(1, clearance - labelHeight + 1));
      const priority = Math.max(0, Math.min(1, (label.opacity - other.opacity) * 2));
      visibility = Math.min(visibility, Math.max(fit, priority));
    }
    const opacity = OVERLAP_OPACITY + (label.opacity - OVERLAP_OPACITY) * visibility;
    if (opacity < label.opacity) label.endLabel.opacity = opacity;
  }
  return labelHeight;
}

function lineValueTicks(domain: [number, number], height: number) {
  const span = domain[1] - domain[0];
  if (span === 0) return [{ value: 0, opacity: 1, coarse: true }];

  const target = targetTickCount(height, 'full', 'y');
  const ideal = span / target;
  const ladder = valueTickLadder(span, [1, 2, 5]);
  const upper = ladder.findIndex((step) => step >= ideal);
  const pxPerUnit = height / span;
  const ticksAt = (step: number[]) =>
    crossfadeTicks(domain, pxPerUnit, step).map((tick) => ({ ...tick, coarse: true }));
  if (upper <= 0) return ticksAt(ladder.slice(0, 1));

  const finer = ladder[upper - 1];
  const coarser = ladder[upper];
  // D3 switches nice increments at the geometric mean. Only nested
  // increments can share a grid while the finer ticks fade in or out.
  const ratio = coarser / finer;
  if (Math.abs(ratio - Math.round(ratio)) > 1e-6) {
    return ticksAt([ideal / finer < Math.sqrt(ratio) ? finer : coarser]);
  }
  const threshold = (height / target) * Math.sqrt(finer / coarser);
  const coarseValues = new Set(ticksAt([coarser]).map(({ value }) => value));
  return crossfadeTicks(domain, pxPerUnit, [finer, coarser], threshold * 1.1, threshold * 0.9).map(
    (tick) => ({ ...tick, coarse: coarseValues.has(tick.value) }),
  );
}

function fitYTickLabels(ticks: Array<RaceTick & { coarse: boolean }>, labelHeight: number) {
  const occupied: number[] = [];
  const byPriority = [...ticks].sort(
    (a, b) =>
      Number(b.value === 0) - Number(a.value === 0) ||
      Number(b.coarse) - Number(a.coarse) ||
      a.value - b.value,
  );
  for (const tick of byPriority) {
    if (!tick.label || tick.opacity <= 0.01) continue;
    const y = tick.labelPosition ?? tick.position;
    let clearance = Infinity;
    for (const position of occupied) clearance = Math.min(clearance, Math.abs(position - y));
    const opacity = Math.max(0, Math.min(1, (clearance - labelHeight) / 4));
    if (opacity === 0) tick.label = '';
    else {
      tick.labelOpacity = opacity;
      occupied.push(y);
    }
  }
}

/** Draw the ranked series on a domain that includes all points shown up to the playhead. */
export const lineGeometry: RaceMarkEntry<'line'>['geometry'] = (model, layout, frame) => {
  const { t } = frame;
  const { plot, xScale, window, tickFontSize, history } = layout.static;
  const xMax = window === 'all' ? xScale.domain[1] : Math.max(1, t);
  const x = (period: number) => xScale.range[0] + (period / xMax) * plot.width;
  const period = frame.period.index;
  const fraction = t - period;
  const active = new Map(frame.items.map((item) => [item.key, item]));
  let min = 0;
  let max = 0;
  const visible: Array<{ key: number; opacity: number; rankPos: number; departing: boolean }> = [];
  for (const entry of history) {
    const { key, runs } = entry;
    let index = runs.length - 1;
    while (index >= 0 && runs[index].start > t) index--;
    const run = runs[index];
    const item = active.get(model.matrix.keys[key]);
    if (!run && !item) continue;

    const lastDraw = item || !run ? t : Math.min(t, run.end + 1);
    const [low, high] = extentAt(model, entry, lastDraw);
    min = Math.min(min, low);
    max = Math.max(max, high);
    let opacity = item?.opacity ?? 0;
    // Keep the frame's entrance fade. Extend a departing series from its last peak
    // to one period past the exit, even when the frame has already faded it out.
    while (index >= 0 && runs[index].end + 1 > t) {
      opacity = Math.max(opacity, departingLineOpacity(runs[index], t));
      index--;
    }
    if (opacity > 0) {
      // Once a series leaves the fold, its fade age keeps its rank moving
      // past the boundary and separates departing series at the same rank.
      const age = run ? Math.max(0, t - run.end) : 0;
      visible.push({
        key,
        opacity,
        rankPos: (item?.rankPos ?? model.timeline.rankPos(key, t)) + age,
        departing: !item || item.rank >= model.timeline.top,
      });
    }
  }
  visible.sort(
    (a, b) =>
      Number(a.departing) - Number(b.departing) || b.opacity - a.opacity || a.rankPos - b.rankPos,
  );

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
  const labels: HeadLabelPlacement[] = [];
  const anchors: Array<{ x: number; y: number }> = [];
  for (const { key, opacity, rankPos } of visible) {
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
    const endLabel = { x: labelX, y: anchor.y, text: name, value };
    series.push({
      key: model.matrix.keys[key],
      color: layout.colors[key],
      opacity,
      points,
      endLabel,
    });
    labels.push({ endLabel, opacity, rankPos });
    anchors.push(anchor);
  }
  const labelHeight = placeHeadLabels(layout, labels);
  for (const [index, { endLabel, opacity }] of labels.entries()) {
    const anchor = anchors[index];
    const displacement = Math.abs(anchor.y - endLabel.y);
    const strength = Math.min(1, (2 * displacement) / labelHeight - 1);
    if ((endLabel.text || endLabel.value) && strength > 0) {
      endLabel.leader = { ...anchor, opacity: strength * (endLabel.opacity ?? opacity) * 0.45 };
    }
  }

  const tickText = lineText(layout, tickFontSize);
  const showAxes = plot.width > 0 && plot.height > 0;
  const yTicks = !showAxes
    ? []
    : lineValueTicks([low, high], plot.height).map((tick) => {
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
          labelPosition:
            value === 0 ? Math.min(position, plot.y + plot.height - tickFontSize * 0.75) : position,
          coarse: tick.coarse,
          label: tickText.fit(
            model.formatValue(value),
            layout.static.yAxisX - layout.area.x - TICK_GAP,
          ),
        };
      });
  const tickHeight = layout.measureText?.(
    'Mg',
    tickFontSize,
    layout.theme.fonts.weights.normal,
  ).height;
  fitYTickLabels(yTicks, tickHeight ?? tickFontSize * 1.2);

  return {
    mark: 'line',
    series,
    xTicks: showAxes ? periodTicks(layout, period, x, xMax) : [],
    yTicks,
    domain: [min, max],
  };
};
