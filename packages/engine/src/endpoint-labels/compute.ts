/**
 * Endpoint labels: per-series right-side label column for multi-series
 * line/area charts. Each entry pairs the series name with its last formatted
 * value, optionally anchored to the line by an open-circle marker.
 *
 * Single-pass design: this is the only place that resolves entries to pixel
 * positions. `predictEndpointLabelsWidth` (in `predict.ts`) runs before marks
 * to reserve right margin space, but only computes width — never positions.
 *
 * Layout pipeline:
 *   1. Filter marks to line/area marks with seriesKey + dataPoints.
 *   2. For each series take the last data point, format the value, wrap the label.
 *   3. Bidirectional collision sweep on labelY: forward pass pushes overlapping
 *      entries down, reverse pass pushes them up; final = midpoint, clamped.
 *   4. Mark `showLeader` true when displacement exceeds threshold.
 *   5. Optionally attach the open-circle marker on the line at the right edge.
 */

import type {
  AreaMark,
  EndpointLabelEntry,
  EndpointLabelsLayout,
  LayoutStrategy,
  LineMark,
  Mark,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import { countColorSeries, resolveSuppression } from '../legend/suppression';
import {
  ENDPOINT_COLUMN_GAP,
  ENDPOINT_ENTRY_GAP,
  ENDPOINT_GAP,
  ENDPOINT_LABEL_FONT_SIZE,
  ENDPOINT_LABEL_FONT_WEIGHT,
  ENDPOINT_LEADER_THRESHOLD,
  ENDPOINT_LINE_HEIGHT,
  ENDPOINT_MARKER_RADIUS,
  ENDPOINT_MARKER_STROKE_WIDTH,
  ENDPOINT_SWATCH_SIZE,
  ENDPOINT_VALUE_FONT_SIZE,
  ENDPOINT_VALUE_FONT_WEIGHT,
  ENDPOINT_VALUE_GAP,
  ENDPOINT_WRAP_WIDTH_DEFAULT,
} from './constants';
import { formatEndpointValue } from './format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Empty layout used as the "column suppressed" return value. */
function emptyLayout(theme: ResolvedTheme): EndpointLabelsLayout {
  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: ENDPOINT_LABEL_FONT_SIZE,
    fontWeight: ENDPOINT_LABEL_FONT_WEIGHT,
    fill: theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
  };
  const valueStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: ENDPOINT_VALUE_FONT_SIZE,
    fontWeight: ENDPOINT_VALUE_FONT_WEIGHT,
    fill: theme.colors.annotationText ?? theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
  };
  return {
    entries: [],
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    labelStyle,
    valueStyle,
    swatchSize: ENDPOINT_SWATCH_SIZE,
    gap: ENDPOINT_GAP,
    valueGap: ENDPOINT_VALUE_GAP,
    swatchChipFill: theme.colors.annotationFill ?? theme.colors.background,
  };
}

function isLineOrArea(mark: Mark): mark is LineMark | AreaMark {
  return mark.type === 'line' || mark.type === 'area';
}

/** Get the last data-point pixel position for a line/area mark. */
function lastDataPoint(mark: LineMark | AreaMark): { x: number; y: number } | null {
  if (mark.dataPoints && mark.dataPoints.length > 0) {
    const last = mark.dataPoints[mark.dataPoints.length - 1];
    return { x: last.x, y: last.y };
  }
  // Fallback for marks compiled without dataPoints (rare): use the last
  // geometry point. For areas this is the top boundary.
  if (mark.type === 'line' && mark.points.length > 0) {
    const last = mark.points[mark.points.length - 1];
    return { x: last.x, y: last.y };
  }
  if (mark.type === 'area' && mark.topPoints.length > 0) {
    const last = mark.topPoints[mark.topPoints.length - 1];
    return { x: last.x, y: last.y };
  }
  return null;
}

/** Get the value to display from a data row. */
function readValue(
  mark: LineMark | AreaMark,
  valueField: string | undefined,
): number | string | null {
  if (!valueField) return null;
  const dp = mark.dataPoints;
  if (dp && dp.length > 0) {
    const datum = dp[dp.length - 1].datum;
    const v = datum[valueField];
    return typeof v === 'number' || typeof v === 'string' ? v : null;
  }
  if (mark.data.length > 0) {
    const v = mark.data[mark.data.length - 1][valueField];
    return typeof v === 'number' || typeof v === 'string' ? v : null;
  }
  return null;
}

/**
 * Local collision sweep: keep each label anchored to its line's `dataY` and
 * only displace neighbors that actually overlap.
 *
 * Each entry's "natural" top is `naturalTop` (typically `dataY - fontSize/2`
 * so the label's first-line baseline-center aligns with the data point). We
 * only push neighbors apart when their stacks would collide, by the minimum
 * amount needed. This preserves the line-tracking behavior the design calls
 * for: when lines are well-separated, labels sit at their lines; when close
 * together, the sweep nudges them apart while staying near their data points.
 *
 * Algorithm:
 *   1. Sort by naturalTop ascending.
 *   2. Forward pass (top→bottom): push i down if it overlaps i-1, then clamp
 *      to `areaBottom - height` so an entry never lands below the chart.
 *   3. Reverse pass (bottom→top): push i up if it overlaps i+1, then clamp
 *      to `areaTop` so an entry never lands above the chart.
 *
 * Both passes cascade the clamp through neighbors, so a clamp at one end can
 * propagate all the way to the other when the chart is too short to fit every
 * label without overlap. (When the total stack is taller than the area, the
 * earliest entries get pinned to areaTop and overlap is unavoidable — the
 * caller has to drop entries or shrink them.)
 */
export function bidirectionalSweep(
  entries: { naturalTop: number; height: number; index: number }[],
  areaTop: number,
  areaBottom: number,
): number[] {
  const n = entries.length;
  if (n === 0) return [];

  // Sort by naturalTop ascending so neighbors in the chart are neighbors here.
  const sorted = [...entries].sort((a, b) => a.naturalTop - b.naturalTop);

  // Initialize tops at the natural (anchored-to-dataY) positions.
  const tops = sorted.map((e) => e.naturalTop);

  // Forward pass: push down only when overlapping the previous entry, then
  // cap at the chart's bottom edge so we don't run off the canvas.
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const minTop = tops[i - 1] + sorted[i - 1].height;
      if (tops[i] < minTop) tops[i] = minTop;
    }
    const maxTop = areaBottom - sorted[i].height;
    if (tops[i] > maxTop) tops[i] = maxTop;
  }

  // Reverse pass: when the forward pass clamped a tail entry up to fit the
  // bottom edge, propagate that displacement back through the predecessors so
  // they don't overlap the now-raised tail. Then clamp at areaTop.
  for (let i = n - 1; i >= 0; i--) {
    if (i < n - 1) {
      const maxTop = tops[i + 1] - sorted[i].height;
      if (tops[i] > maxTop) tops[i] = maxTop;
    }
    if (tops[i] < areaTop) tops[i] = areaTop;
  }

  // Write back in original index order.
  const result = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    result[sorted[i].index] = tops[i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the resolved endpoint-labels layout for a chart.
 *
 * Returns an empty layout (entries: []) when:
 *   - The chart isn't a multi-series line/area.
 *   - The user opted out via `endpointLabels: false`.
 *   - Responsive strategy strips inline labels (compact breakpoint).
 *   - Suppression truth table resolves to "endpoint column off".
 *
 * Otherwise produces fully-positioned entries with bidirectional collision
 * sweep applied to labelY and optional open-circle markers on the line.
 */
export function computeEndpointLabels(
  spec: NormalizedChartSpec,
  marks: Mark[],
  theme: ResolvedTheme,
  chartArea: Rect,
  strategy?: LayoutStrategy,
): EndpointLabelsLayout {
  // Compact strategy: drop the column entirely. The traditional legend takes
  // over series identification at the compact breakpoint.
  if (strategy?.labelMode === 'none') return emptyLayout(theme);

  const seriesCount = countColorSeries(spec);
  const sup = resolveSuppression(spec, {
    seriesCount,
    // The 'none' branch above returned; by here labelMode is not 'none'.
    labelsHiddenByStrategy: false,
    labelsDensityNone: spec.labels.density === 'none',
  });
  if (!sup.showEndpointLabels) return emptyLayout(theme);

  // Dedupe by seriesKey: for area charts, the engine emits BOTH an AreaMark
  // and a derived LineMark per series (see `linesFromAreas` in
  // `charts/line/index.ts`). Without dedupe each series would produce two
  // endpoint entries. Prefer the line mark — its `stroke` is the canonical
  // series color and matches the visible line, whereas the area mark's
  // `stroke` may be derived from a gradient via `getRepresentativeColor`.
  // Same-type collisions (area→area, line→line) keep the first mark; the
  // engine never emits two of the same type per seriesKey.
  const bySeriesKey = new Map<string, LineMark | AreaMark>();
  for (const mark of marks) {
    if (!isLineOrArea(mark) || !mark.seriesKey) continue;
    const existing = bySeriesKey.get(mark.seriesKey);
    if (!existing || (existing.type === 'area' && mark.type === 'line')) {
      bySeriesKey.set(mark.seriesKey, mark);
    }
  }
  const lineOrAreaMarks = Array.from(bySeriesKey.values());
  if (lineOrAreaMarks.length < 2) return emptyLayout(theme);

  const config = typeof spec.endpointLabels === 'object' ? spec.endpointLabels : undefined;
  const wrapWidth = config?.width ?? ENDPOINT_WRAP_WIDTH_DEFAULT;
  const valueField = config?.valueField ?? spec.encoding.y?.field;
  const formatString =
    config?.format ??
    ((spec.encoding.y?.axis as Record<string, unknown> | undefined)?.format as string | undefined);
  const showMarker = config?.showMarker !== false;
  const markerRadius = config?.markerStyle?.radius ?? ENDPOINT_MARKER_RADIUS;
  const markerStrokeWidth = config?.markerStyle?.strokeWidth ?? ENDPOINT_MARKER_STROKE_WIDTH;
  const markerFill = config?.markerStyle?.fill ?? theme.colors.background;

  // Resolve the styles once.
  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: ENDPOINT_LABEL_FONT_SIZE,
    fontWeight: ENDPOINT_LABEL_FONT_WEIGHT,
    fill: theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
  };
  const valueStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: ENDPOINT_VALUE_FONT_SIZE,
    fontWeight: ENDPOINT_VALUE_FONT_WEIGHT,
    fill: theme.colors.annotationText ?? theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
  };

  // First pass: build entries with wrapped labels and dataY (no positions yet).
  type Provisional = {
    seriesKey: string;
    labelLines: string[];
    value: string;
    color: string;
    dataX: number;
    dataY: number;
    height: number;
    width: number;
  };
  const provisional: Provisional[] = [];
  const labelLineHeight = ENDPOINT_LABEL_FONT_SIZE * ENDPOINT_LINE_HEIGHT;
  const valueLineHeight = ENDPOINT_VALUE_FONT_SIZE * ENDPOINT_LINE_HEIGHT;

  for (const mark of lineOrAreaMarks) {
    const seriesKey = mark.seriesKey;
    if (!seriesKey) continue;
    const last = lastDataPoint(mark);
    if (!last) continue;

    const labelLines = wrapText(
      seriesKey,
      ENDPOINT_LABEL_FONT_SIZE,
      ENDPOINT_LABEL_FONT_WEIGHT,
      wrapWidth,
    );
    const rawValue = readValue(mark, valueField);
    const value = formatEndpointValue(rawValue, formatString);

    // Width of the widest line in this entry (used to size the column).
    let entryWidth = 0;
    for (const line of labelLines) {
      const w = estimateTextWidth(line, ENDPOINT_LABEL_FONT_SIZE, ENDPOINT_LABEL_FONT_WEIGHT);
      if (w > entryWidth) entryWidth = w;
    }
    const valueWidth = value
      ? estimateTextWidth(value, ENDPOINT_VALUE_FONT_SIZE, ENDPOINT_VALUE_FONT_WEIGHT)
      : 0;
    if (valueWidth > entryWidth) entryWidth = valueWidth;

    const labelHeight = labelLines.length * labelLineHeight;
    const valueHeight = value ? valueLineHeight : 0;
    const entryHeight = labelHeight + (value ? ENDPOINT_VALUE_GAP : 0) + valueHeight;

    // Determine the line stroke color. AreaMark may have a string fill; prefer
    // mark.stroke for visual continuity with the line drawn on top of the area.
    const color =
      mark.type === 'line'
        ? mark.stroke
        : (mark.stroke ??
          (typeof mark.fill === 'string' ? mark.fill : theme.colors.categorical[0]));

    provisional.push({
      seriesKey,
      labelLines,
      value,
      color,
      dataX: last.x,
      dataY: last.y,
      height: entryHeight,
      width: entryWidth,
    });
  }

  if (provisional.length < 2) return emptyLayout(theme);

  // Bidirectional collision sweep. Each entry's natural top is `dataY - labelFontSize/2`
  // so the label's first-line baseline-center aligns with the line's last data point.
  // The marker sits on this same baseline-center row, putting the open ring directly
  // where the line terminates when undisplaced.
  // Add ENDPOINT_ENTRY_GAP to each entry's claimed height so the sweep leaves
  // breathing room between stacked labels. The renderer doesn't draw the gap,
  // so it's invisible when entries are well-separated.
  const sweepInput = provisional.map((p, i) => ({
    naturalTop: p.dataY - ENDPOINT_LABEL_FONT_SIZE / 2,
    height: p.height + ENDPOINT_ENTRY_GAP,
    index: i,
  }));
  const sweptTops = bidirectionalSweep(sweepInput, chartArea.y, chartArea.y + chartArea.height);

  // Build final entries.
  const columnWidth = Math.max(
    ENDPOINT_SWATCH_SIZE + ENDPOINT_GAP + Math.max(...provisional.map((p) => p.width), 0) + 4,
    32,
  );
  const columnX = chartArea.x + chartArea.width + ENDPOINT_COLUMN_GAP;

  // The marker is the line's visual terminator — always at (chartRightX, dataY).
  // The swatch + label first-line baseline-center sit at `labelY + fontSize/2`.
  // The sweep uses naturalTop = `dataY - fontSize/2` so that, when undisplaced,
  // the swatch row and the marker share the same y, producing the clean
  // single-row look from the mocks.
  //
  // Leader lines are off by default. The marker on the line plus the swatch in
  // the column already tie label to data; a connecting line adds noise without
  // adding information for the small displacements the sweep produces. Users
  // who want them can opt in via `endpointLabels.showLeader: true`.
  const showLeader = config?.showLeader === true;
  const entries: EndpointLabelEntry[] = provisional.map((p, i) => {
    const labelY = sweptTops[i];
    const swatchRowY = labelY + ENDPOINT_LABEL_FONT_SIZE / 2;
    const displaced = Math.abs(swatchRowY - p.dataY) > ENDPOINT_LEADER_THRESHOLD;
    const entry: EndpointLabelEntry = {
      seriesKey: p.seriesKey,
      labelLines: p.labelLines,
      value: p.value,
      color: p.color,
      dataY: p.dataY,
      labelY,
      showLeader: showLeader && displaced,
    };
    if (showMarker) {
      entry.marker = {
        x: p.dataX,
        y: p.dataY,
        fill: markerFill,
        stroke: config?.markerStyle?.stroke ?? p.color,
        strokeWidth: markerStrokeWidth,
        radius: markerRadius,
      };
    }
    return entry;
  });

  return {
    entries,
    bounds: {
      x: columnX,
      y: chartArea.y,
      width: columnWidth,
      height: chartArea.height,
    },
    labelStyle,
    valueStyle,
    swatchSize: ENDPOINT_SWATCH_SIZE,
    gap: ENDPOINT_GAP,
    valueGap: ENDPOINT_VALUE_GAP,
    swatchChipFill: theme.colors.annotationFill ?? theme.colors.background,
  };
}
