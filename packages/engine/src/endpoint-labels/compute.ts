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
  MeasureTextFn,
  Rect,
  ResolvedTheme,
  TextStyle,
} from '@opendata-ai/openchart-core';
import {
  estimateTextWidth,
  formatDate,
  pickLabelColor,
  wrapText,
} from '@opendata-ai/openchart-core';
import { resolveKnockoutColor } from '../charts/utils';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScaleType } from '../layout/scales';
import {
  countColorSeries,
  endpointLabelsExplicitlyOn,
  resolveSuppression,
} from '../legend/suppression';
import {
  ENDPOINT_GAP,
  ENDPOINT_LABEL_FONT_WEIGHT,
  ENDPOINT_LEADER_THRESHOLD,
  ENDPOINT_LINE_HEIGHT,
  ENDPOINT_MARKER_RADIUS,
  ENDPOINT_MARKER_STROKE_WIDTH,
  ENDPOINT_SWATCH_SIZE,
  ENDPOINT_VALUE_FONT_WEIGHT,
  ENDPOINT_WRAP_WIDTH_DEFAULT,
} from './constants';
import { composeEndpointText, formatEndpointValue, resolveEndpointContent } from './format';
import { endpointFormatter as resolveEndpointFormatter } from './formatter';
import { fitInteriorLabel } from './interior';
import { endpointObservation } from './observations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Empty layout used as the "column suppressed" return value. */
function emptyLayout(theme: ResolvedTheme): EndpointLabelsLayout {
  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.endpointLabel,
    fontWeight: ENDPOINT_LABEL_FONT_WEIGHT,
    fill: theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
  };
  const valueStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.endpointValue,
    fontWeight: ENDPOINT_VALUE_FONT_WEIGHT,
    fill: theme.colors.annotationText ?? theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
    fontVariant: 'tabular-nums',
  };
  return {
    entries: [],
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    labelStyle,
    valueStyle,
    swatchSize: ENDPOINT_SWATCH_SIZE,
    gap: ENDPOINT_GAP,
    valueGap: theme.spacing.endpointValueGap,
    swatchChipFill: theme.colors.annotationFill ?? theme.colors.background,
  };
}

function isLineOrArea(mark: Mark): mark is LineMark | AreaMark {
  return mark.type === 'line' || mark.type === 'area';
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

  // Clamp the first edge before separating neighbors. Clamping only in the
  // reverse pass collapses multiple above-domain anchors onto the same top.
  const tops = sorted.map((e) => Math.max(areaTop, e.naturalTop));

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
  endpointLabelsDemoted?: boolean,
  measureText?: MeasureTextFn,
  xScaleType?: ResolvedScaleType,
): EndpointLabelsLayout {
  // Compact strategy: drop the column entirely. The traditional legend takes
  // over series identification at the compact breakpoint. Explicit user
  // opt-in overrides the strip: slope/bump recipes are unreadable without
  // their labels, so an author who wrote endpointLabels config keeps it.
  if (strategy?.labelMode === 'none' && !endpointLabelsExplicitlyOn(spec)) {
    return emptyLayout(theme);
  }

  const highlight = spec.highlight ?? [];
  const highlightActive = highlight.length > 0;
  const seriesCount = countColorSeries(spec);
  const sup = resolveSuppression(spec, {
    seriesCount,
    // The 'none' branch above returned unless the user explicitly opted in,
    // in which case resolveSuppression's explicit-on override applies anyway.
    labelsHiddenByStrategy: false,
    endpointLabelsDemoted,
  });
  const epExplicitlyOff =
    spec.endpointLabels === false ||
    (typeof spec.endpointLabels === 'object' && spec.endpointLabels?.show === false);
  if (!sup.showEndpointLabels && !(highlightActive && !epExplicitlyOff)) return emptyLayout(theme);

  // Dedupe by seriesKey: for area charts, the engine emits BOTH an AreaMark
  // and a derived LineMark per series (see `linesFromAreas` in
  // `charts/line/index.ts`). Without dedupe each series would produce two
  // endpoint entries. Prefer stacked area marks because they retain source presence and band bounds.
  // For other areas prefer the line mark — its `stroke` is the canonical
  // series color and matches the visible line, whereas the area mark's
  // `stroke` may be derived from a gradient via `getRepresentativeColor`.
  // Same-type collisions (area→area, line→line) keep the first mark; the
  // engine never emits two of the same type per seriesKey.
  const bySeriesKey = new Map<string, LineMark | AreaMark>();
  for (const mark of marks) {
    if (!isLineOrArea(mark) || !mark.seriesKey) continue;
    const existing = bySeriesKey.get(mark.seriesKey);
    if (
      !existing ||
      (existing.type === 'area' && !existing.stacked && mark.type === 'line') ||
      (mark.type === 'area' && mark.stacked)
    ) {
      bySeriesKey.set(mark.seriesKey, mark);
    }
  }
  const lineOrAreaMarks = Array.from(bySeriesKey.values()).filter(
    (mark) => !highlightActive || highlight.includes(mark.seriesKey!),
  );
  if (lineOrAreaMarks.length < 2 && !highlightActive) return emptyLayout(theme);

  const config = typeof spec.endpointLabels === 'object' ? spec.endpointLabels : undefined;
  const wrapWidth = config?.width ?? ENDPOINT_WRAP_WIDTH_DEFAULT;
  const valueField = config?.valueField ?? spec.encoding.y?.field;
  const anchor = config?.anchor ?? 'boundary';
  const endpointValues = lineOrAreaMarks.flatMap((mark) => {
    const trailing = endpointObservation(mark, 'trailing', anchor)?.datum[valueField ?? ''];
    return config?.ends === 'both'
      ? [trailing, endpointObservation(mark, 'leading', anchor)?.datum[valueField ?? '']]
      : [trailing];
  });
  const endpointFormatter = resolveEndpointFormatter(spec, endpointValues);
  const measure = (text: string, size: number, weight?: number) =>
    measureText?.(text, size, weight).width ?? estimateTextWidth(text, size, weight);
  const dateFor = (value: unknown): string | undefined => {
    if (spec.encoding.x?.type !== 'temporal') return value == null ? undefined : String(value);
    if (!xScaleType) return undefined;
    return formatDate(value as Date | string | number, undefined, undefined, xScaleType === 'utc');
  };
  const endpointDates = (side: 'leading' | 'trailing') =>
    new Set(
      lineOrAreaMarks.map((mark) =>
        String(endpointObservation(mark, side, anchor)?.datum[spec.encoding.x?.field ?? '']),
      ),
    );
  const qualifyTrailing = config?.placement === 'interior' || endpointDates('trailing').size > 1;
  const qualifyLeading = config?.placement === 'interior' || endpointDates('leading').size > 1;
  const showMarker = config?.showMarker !== false;
  const markerRadius = config?.markerStyle?.radius ?? ENDPOINT_MARKER_RADIUS;
  const markerStrokeWidth = config?.markerStyle?.strokeWidth ?? ENDPOINT_MARKER_STROKE_WIDTH;
  // Opaque by default: the marker sits on the line's last point and its fill
  // covers the line end, so the ring isn't pierced.
  const markerFill = config?.markerStyle?.fill ?? resolveKnockoutColor(theme);
  const trailingContent = resolveEndpointContent(config?.content, 'trailing');
  const leadingContent = resolveEndpointContent(config?.content, 'leading');

  // Resolve the styles once.
  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.endpointLabel,
    fontWeight: ENDPOINT_LABEL_FONT_WEIGHT,
    fill: theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
  };
  const valueStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.endpointValue,
    fontWeight: ENDPOINT_VALUE_FONT_WEIGHT,
    fill: theme.colors.annotationText ?? theme.colors.text,
    lineHeight: ENDPOINT_LINE_HEIGHT,
    fontVariant: 'tabular-nums',
  };

  const interior =
    config?.placement === 'interior'
      ? lineOrAreaMarks.flatMap((mark) => {
          if (mark.type !== 'area' || !mark.stacked) return [];
          const color =
            mark.stroke ?? (typeof mark.fill === 'string' ? mark.fill : theme.colors.text);
          const label = fitInteriorLabel(
            mark,
            labelStyle,
            pickLabelColor(typeof mark.fill === 'string' ? mark.fill : color),
            measureText,
          );
          return label ? [label] : [];
        })
      : [];
  // Inverted/overlapping bands can share screen space; keep deterministic
  // identification and leave any rejected name in its endpoint column.
  interior.sort((a, b) => b.width - a.width || b.x - a.x || a.seriesKey.localeCompare(b.seriesKey));
  for (let index = interior.length - 1; index >= 0; index--) {
    const candidate = interior[index];
    if (
      interior
        .slice(0, index)
        .some(
          (other) =>
            candidate.x < other.x + other.width &&
            candidate.x + candidate.width > other.x &&
            candidate.y < other.y + other.height &&
            candidate.y + candidate.height > other.y,
        )
    )
      interior.splice(index, 1);
  }
  const interiorSeries = new Set(interior.map((label) => label.seriesKey));
  // First pass: build entries with wrapped labels and dataY (no positions yet).
  type Provisional = {
    seriesKey: string;
    labelLines: string[];
    value: string;
    color: string;
    strokeDasharray?: string;
    source: NonNullable<EndpointLabelEntry['source']>;
    date?: string;
    band: boolean;
    dataX: number;
    dataY: number;
    height: number;
    width: number;
  };
  const provisional: Provisional[] = [];
  const labelLineHeight = theme.fonts.sizes.endpointLabel * ENDPOINT_LINE_HEIGHT;
  const valueLineHeight = theme.fonts.sizes.endpointValue * ENDPOINT_LINE_HEIGHT;

  for (const mark of lineOrAreaMarks) {
    const seriesKey = mark.seriesKey;
    if (!seriesKey) continue;

    if (highlightActive && !highlight.includes(seriesKey)) continue;

    const last = endpointObservation(mark, 'trailing', anchor);
    if (!last) continue;

    const rawValue = last.datum[valueField ?? ''];
    const date = qualifyTrailing ? dateFor(last.datum[spec.encoding.x?.field ?? '']) : undefined;
    const formatted = formatEndpointValue(
      typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : null,
      endpointFormatter,
    );

    // Content composition: when `content` is set, the composed text becomes
    // the label lines and the second-line value is dropped.
    const effectiveContent =
      interiorSeries.has(seriesKey) && trailingContent === undefined ? 'value' : trailingContent;
    const labelText = effectiveContent
      ? composeEndpointText(effectiveContent, seriesKey, formatted)
      : seriesKey;
    const value = effectiveContent ? '' : formatted;
    const labelLines = wrapText(
      labelText,
      theme.fonts.sizes.endpointLabel,
      ENDPOINT_LABEL_FONT_WEIGHT,
      wrapWidth,
      measureText,
    );

    // Width of the widest line in this entry (used to size the column).
    let entryWidth = 0;
    for (const line of labelLines) {
      const w = measure(line, theme.fonts.sizes.endpointLabel, ENDPOINT_LABEL_FONT_WEIGHT);
      if (w > entryWidth) entryWidth = w;
    }
    const valueWidth = value
      ? measure(value, theme.fonts.sizes.endpointValue, ENDPOINT_VALUE_FONT_WEIGHT)
      : 0;
    if (valueWidth > entryWidth) entryWidth = valueWidth;
    if (date)
      entryWidth = Math.max(
        entryWidth,
        measure(date, theme.fonts.sizes.endpointValue, ENDPOINT_VALUE_FONT_WEIGHT),
      );

    const labelHeight = labelLines.length * labelLineHeight;
    const valueHeight = value ? valueLineHeight : 0;
    const entryHeight =
      labelHeight +
      (value ? theme.spacing.endpointValueGap : 0) +
      valueHeight +
      (date ? valueLineHeight + theme.spacing.endpointValueGap : 0);

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
      strokeDasharray: mark.type === 'line' ? mark.strokeDasharray : undefined,
      source: { datum: last.datum, x: last.datum[spec.encoding.x?.field ?? ''], observed: true },
      date,
      band: last.band,
      dataX: last.x,
      dataY: last.y,
      height: entryHeight,
      width: entryWidth,
    });
  }

  if (provisional.length === 0) return emptyLayout(theme);
  if (provisional.length < 2 && !highlightActive) return emptyLayout(theme);

  // Bidirectional collision sweep. Each entry's natural top is `dataY - labelFontSize/2`
  // so the label's first-line baseline-center aligns with the line's last data point.
  // The marker sits on this same baseline-center row, putting the open ring directly
  // where the line terminates when undisplaced.
  // Add theme.spacing.endpointEntryGap to each entry's claimed height so the sweep leaves
  // breathing room between stacked labels. The renderer doesn't draw the gap,
  // so it's invisible when entries are well-separated.
  const sweepInput = provisional.map((p, i) => ({
    naturalTop: p.dataY - theme.fonts.sizes.endpointLabel / 2,
    height: p.height + theme.spacing.endpointEntryGap,
    index: i,
  }));
  const sweptTops = bidirectionalSweep(sweepInput, chartArea.y, chartArea.y + chartArea.height);

  // Build final entries.
  const columnWidth = Math.max(
    ENDPOINT_SWATCH_SIZE + ENDPOINT_GAP + Math.max(...provisional.map((p) => p.width), 0) + 4,
    32,
  );
  const columnX = chartArea.x + chartArea.width + theme.spacing.endpointColumnGap;

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
    const swatchRowY = labelY + theme.fonts.sizes.endpointLabel / 2;
    const displaced = Math.abs(swatchRowY - p.dataY) > ENDPOINT_LEADER_THRESHOLD;
    const entry: EndpointLabelEntry = {
      seriesKey: p.seriesKey,
      dataX: p.dataX,
      source: p.source,
      date: p.date,
      labelLines: p.labelLines,
      value: p.value,
      color: p.color,
      dataY: p.dataY,
      labelY,
      showLeader: p.band || (showLeader && displaced),
    };
    if (p.strokeDasharray) entry.strokeDasharray = p.strokeDasharray;
    if (showMarker && !p.band) {
      entry.marker = {
        x: p.dataX,
        y: p.dataY,
        dataX: p.dataX,
        fill: markerFill,
        stroke: config?.markerStyle?.stroke ?? p.color,
        strokeWidth: markerStrokeWidth,
        radius: markerRadius,
      };
    }
    return entry;
  });

  // Leading column (left side) for `ends: 'both'` mode.
  const endsBoth = config?.ends === 'both';
  let leading: EndpointLabelEntry[] | undefined;
  let leadingBounds: { x: number; y: number; width: number; height: number } | undefined;

  if (endsBoth) {
    type LeadingProvisional = {
      seriesKey: string;
      labelLines: string[];
      value: string;
      color: string;
      strokeDasharray?: string;
      source: NonNullable<EndpointLabelEntry['source']>;
      date?: string;
      band: boolean;
      dataX: number;
      dataY: number;
      height: number;
      width: number;
    };
    const leadingProvisional: LeadingProvisional[] = [];

    for (const mark of lineOrAreaMarks) {
      const seriesKey = mark.seriesKey;
      if (!seriesKey) continue;

      if (highlightActive && !highlight.includes(seriesKey)) continue;

      const first = endpointObservation(mark, 'leading', anchor);
      if (!first) continue;

      const rawValue = first.datum[valueField ?? ''];
      const date = qualifyLeading ? dateFor(first.datum[spec.encoding.x?.field ?? '']) : undefined;
      const formatted = formatEndpointValue(
        typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : null,
        endpointFormatter,
      );
      const effectiveContent =
        interiorSeries.has(seriesKey) && leadingContent === undefined ? 'value' : leadingContent;
      const labelText = effectiveContent
        ? composeEndpointText(effectiveContent, seriesKey, formatted)
        : seriesKey;
      const value = effectiveContent ? '' : formatted;
      const labelLines = wrapText(
        labelText,
        theme.fonts.sizes.endpointLabel,
        ENDPOINT_LABEL_FONT_WEIGHT,
        wrapWidth,
        measureText,
      );

      let entryWidth = 0;
      for (const line of labelLines) {
        const w = measure(line, theme.fonts.sizes.endpointLabel, ENDPOINT_LABEL_FONT_WEIGHT);
        if (w > entryWidth) entryWidth = w;
      }
      const valueWidth = value
        ? measure(value, theme.fonts.sizes.endpointValue, ENDPOINT_VALUE_FONT_WEIGHT)
        : 0;
      if (valueWidth > entryWidth) entryWidth = valueWidth;
      if (date)
        entryWidth = Math.max(
          entryWidth,
          measure(date, theme.fonts.sizes.endpointValue, ENDPOINT_VALUE_FONT_WEIGHT),
        );

      const labelHeight = labelLines.length * labelLineHeight;
      const valueHeight = value ? valueLineHeight : 0;
      const entryHeight =
        labelHeight +
        (value ? theme.spacing.endpointValueGap : 0) +
        valueHeight +
        (date ? valueLineHeight + theme.spacing.endpointValueGap : 0);

      const color =
        mark.type === 'line'
          ? mark.stroke
          : (mark.stroke ??
            (typeof mark.fill === 'string' ? mark.fill : theme.colors.categorical[0]));

      leadingProvisional.push({
        seriesKey,
        labelLines,
        value,
        color,
        strokeDasharray: mark.type === 'line' ? mark.strokeDasharray : undefined,
        source: {
          datum: first.datum,
          x: first.datum[spec.encoding.x?.field ?? ''],
          observed: true,
        },
        date,
        band: first.band,
        dataX: first.x,
        dataY: first.y,
        height: entryHeight,
        width: entryWidth,
      });
    }

    if (leadingProvisional.length >= 2 || (leadingProvisional.length === 1 && highlightActive)) {
      const leadingSweepInput = leadingProvisional.map((p, i) => ({
        naturalTop: p.dataY - theme.fonts.sizes.endpointLabel / 2,
        height: p.height + theme.spacing.endpointEntryGap,
        index: i,
      }));
      const leadingSweptTops = bidirectionalSweep(
        leadingSweepInput,
        chartArea.y,
        chartArea.y + chartArea.height,
      );

      const leadingColumnWidth = Math.max(
        ENDPOINT_SWATCH_SIZE +
          ENDPOINT_GAP +
          Math.max(...leadingProvisional.map((p) => p.width), 0) +
          4,
        32,
      );
      const leadingColumnX = chartArea.x - theme.spacing.endpointColumnGap - leadingColumnWidth;

      leading = leadingProvisional.map((p, i) => {
        const labelY = leadingSweptTops[i];
        const swatchRowY = labelY + theme.fonts.sizes.endpointLabel / 2;
        const displaced = Math.abs(swatchRowY - p.dataY) > ENDPOINT_LEADER_THRESHOLD;
        const entry: EndpointLabelEntry = {
          seriesKey: p.seriesKey,
          dataX: p.dataX,
          source: p.source,
          date: p.date,
          labelLines: p.labelLines,
          value: p.value,
          color: p.color,
          dataY: p.dataY,
          labelY,
          showLeader: p.band || (showLeader && displaced),
        };
        if (p.strokeDasharray) entry.strokeDasharray = p.strokeDasharray;
        if (showMarker && !p.band) {
          entry.marker = {
            x: p.dataX,
            y: p.dataY,
            dataX: p.dataX,
            fill: markerFill,
            stroke: config?.markerStyle?.stroke ?? p.color,
            strokeWidth: markerStrokeWidth,
            radius: markerRadius,
          };
        }
        return entry;
      });

      leadingBounds = {
        x: leadingColumnX,
        y: chartArea.y,
        width: leadingColumnWidth,
        height: chartArea.height,
      };
    }
  }

  return {
    entries,
    interior: interior.length ? interior : undefined,
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
    valueGap: theme.spacing.endpointValueGap,
    swatchChipFill: theme.colors.annotationFill ?? theme.colors.background,
    leading,
    leadingBounds,
  };
}
