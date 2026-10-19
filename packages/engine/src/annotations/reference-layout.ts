import type {
  Annotation,
  Rect,
  RefLineAnnotation,
  ResolvedAnnotation,
  ThemeColors,
} from '@opendata-ai/openchart-core';
import { overlapArea } from '@opendata-ai/openchart-core';
import { DEFAULT_LINE_HEIGHT } from './constants';
import {
  type AnnotationMeasureTextFn,
  computeTextBlockBounds,
  estimateLabelBounds,
  refreshConnector,
} from './geometry';
import type { PlacementObstacle } from './placement';
import { wrapAnnotationText } from './wrap-text';

/** Vertical gap between top-lane rows. */
export const REFERENCE_LANE_GAP = 8;
/** Gap between the lowest top-lane row and the plot. */
export const REFERENCE_LANE_PAD = 24;

/** A vertical outside label measured for the top lane. */
export interface ReferenceLaneLabel {
  /** Index of the annotation in the spec's annotation list. */
  index: number;
  width: number;
  height: number;
}

/** A packed top-lane row: labels whose horizontal extents do not overlap. */
export interface ReferenceLaneRow {
  members: number[];
  height: number;
}

/** An admitted top-lane row, positioned by the distance from its top to the plot top. */
export interface ReferenceLaneSlot {
  members: number[];
  above: number;
}

export interface ReferenceReserve {
  right: number;
  /** Height reserved above the plot for the top lane. */
  top: number;
  labelWidth: number;
  /** Vertical outside labels, measured at `labelWidth`, in source order. */
  labels: ReferenceLaneLabel[];
  /**
   * Admitted top-lane rows. A vertical outside label in no row places inside
   * the plot. Placement reads these; it never re-derives the lane.
   */
  rows: ReferenceLaneSlot[];
  /** Whether any top-lane row was admitted. */
  topLane?: boolean;
}

/** No outside reference labels: nothing reserved. */
export const NO_REFERENCE_RESERVE: ReferenceReserve = {
  right: 0,
  top: 0,
  labelWidth: 0,
  labels: [],
  rows: [],
};

const isOutsideLabel = (a: Annotation): a is RefLineAnnotation =>
  a.type === 'refline' && a.labelPlacement === 'outside' && !!a.label;

/**
 * Measure the outside lanes from authored labels and container width, never
 * placement results. `fontSize` is the theme small size: the same fallback the
 * resolver renders labels at. Without x positions every vertical label gets
 * its own top-lane row, all admitted (the facet grid reserves it per panel).
 * `edgeInset` is the gap between a right-lane label and the container's
 * right edge; figures pass the chrome padding so the label lines up with the
 * title, source and brand. The 16px default is the facet panel inset.
 */
export function referenceLabelReserve(
  annotations: Annotation[],
  width: number,
  measure: AnnotationMeasureTextFn,
  fontSize: number,
  edgeInset = 16,
): ReferenceReserve {
  const labelWidth = Math.max(24, Math.min(160, width * 0.25));
  const labels: ReferenceLaneLabel[] = [];
  // The right lane is as wide as its widest wrapped label, not the wrap cap.
  let rightWidth = 0;
  for (const [index, a] of annotations.entries()) {
    if (!isOutsideLabel(a)) continue;
    const font = { fontSize: a.fontSize ?? fontSize, fontWeight: a.fontWeight ?? 400 };
    const lines = wrapAnnotationText(a.label!, labelWidth, font, measure);
    const size = computeTextBlockBounds(
      0,
      0,
      lines.join('\n'),
      { ...font, lineHeight: DEFAULT_LINE_HEIGHT },
      measure,
    );
    if (a.y !== undefined) {
      rightWidth = Math.max(rightWidth, Math.min(labelWidth, Math.ceil(size.width)));
      continue;
    }
    labels.push({
      index,
      width: size.width,
      height: lines.length * font.fontSize * DEFAULT_LINE_HEIGHT,
    });
  }
  // placeReferenceLabel starts a right label 24px into the lane, and the
  // container it measures from is the SVG inset by 8px
  // (defaultReferenceContainer): the label ends `edgeInset` from the edge.
  const reserve: ReferenceReserve = {
    right: rightWidth > 0 ? rightWidth + 24 - 8 + edgeInset : 0,
    top: 0,
    labelWidth,
    labels,
    rows: [],
  };
  const rows = packReferenceRows(labels);
  return admitReferenceRows(reserve, rows, referenceLaneHeights(rows).at(-1) ?? 0);
}

/**
 * The figure-level container outside labels stay inside: the SVG inset by
 * 8px, below the top chrome when there is one.
 */
export function defaultReferenceContainer(
  svg: { width: number; height: number },
  topBound?: number,
): Rect {
  return {
    x: 8,
    y: topBound ?? 8,
    width: svg.width - 16,
    height: svg.height - (topBound ?? 8) - 8,
  };
}

/**
 * Pack vertical outside labels into top-lane rows, greedy first-fit in source
 * order: a label joins the first row where its horizontal extent (as placement
 * will position it, centered on its rule and clamped to the plot and
 * container) clears every member by REFERENCE_LANE_GAP. Without `xOf` every
 * label gets its own row. Labels whose rule does not resolve take no row.
 */
export function packReferenceRows(
  labels: ReferenceLaneLabel[],
  xOf?: (index: number) => number | null,
  plot?: { x: number },
  container?: { x: number; width: number },
): ReferenceLaneRow[] {
  const rows: Array<ReferenceLaneRow & { spans: Array<[number, number]> }> = [];
  for (const label of labels) {
    let span: [number, number] | undefined;
    if (xOf && plot && container) {
      const x = xOf(label.index);
      if (x === null) continue;
      const left = Math.min(
        container.x + container.width - label.width,
        Math.max(plot.x, x - label.width / 2),
      );
      span = [left, left + label.width];
    }
    const row =
      span &&
      rows.find((r) =>
        r.spans.every(
          ([start, end]) =>
            span[0] >= end + REFERENCE_LANE_GAP || span[1] + REFERENCE_LANE_GAP <= start,
        ),
      );
    if (row && span) {
      row.members.push(label.index);
      row.spans.push(span);
      row.height = Math.max(row.height, label.height);
    } else rows.push({ members: [label.index], height: label.height, spans: span ? [span] : [] });
  }
  return rows.map(({ members, height }) => ({ members, height }));
}

/** Cumulative lane height through each row, including the pad to the plot. */
export function referenceLaneHeights(rows: ReferenceLaneRow[]): number[] {
  let sum = 0;
  // Same association as the v8 reserve sum, so stacked lanes keep their exact positions.
  return rows.map((row) => (sum = sum + row.height + REFERENCE_LANE_GAP) + REFERENCE_LANE_PAD);
}

/**
 * Admit the leading rows that fit in `laneReserve` and position them flush
 * against the plot. Space the admitted rows do not use stays above them.
 */
export function admitReferenceRows(
  reserve: ReferenceReserve,
  rows: ReferenceLaneRow[],
  laneReserve: number,
): ReferenceReserve & { topLane: boolean } {
  const cumulative = referenceLaneHeights(rows);
  let admitted = 0;
  while (admitted < rows.length && cumulative[admitted] <= laneReserve) admitted++;
  const total = admitted ? cumulative[admitted - 1] : 0;
  let offset = 0;
  const slots = rows.slice(0, admitted).map((row) => {
    const slot = { members: row.members, above: total - offset };
    offset += row.height + REFERENCE_LANE_GAP;
    return slot;
  });
  return { ...reserve, top: laneReserve, rows: slots, topLane: admitted > 0 };
}

export interface ReferenceLanes {
  rightLabels?: ResolvedAnnotation[];
  /** A lane overflowed once already; one warning per compile covers every label. */
  topOverflow?: boolean;
}

/** Opt-in placement leaves the legacy resolver and all un-authored paths untouched. */
export function placeReferenceLabel(
  annotation: RefLineAnnotation,
  resolved: ResolvedAnnotation,
  area: Rect,
  container: Rect,
  reserve: ReferenceReserve,
  lanes: ReferenceLanes,
  measure: AnnotationMeasureTextFn,
  colors?: ThemeColors,
  warn?: (message: string) => void,
  obstacles: PlacementObstacle[] = [],
): void {
  const label = resolved.label;
  const line = resolved.line;
  if (!label || !line || !annotation.labelPlacement) return;
  const horizontal = annotation.y !== undefined;
  const initial = { x: label.x, y: label.y };
  const bounds = () => estimateLabelBounds(label, measure);
  // Containment for this label; an outside label that falls back inside is
  // held to the plot's vertical extent, clear of the lane above it.
  let region = container;
  const fits = (box: Rect) =>
    box.x >= region.x &&
    box.y >= region.y &&
    box.x + box.width <= region.x + region.width &&
    box.y + box.height <= region.y + region.height;
  let target = horizontal ? line.end : line.start;
  let placement = annotation.labelPlacement;

  if (annotation.labelOffset !== undefined) {
    if (!fits(bounds()))
      warn?.(
        '[openchart] Reference labelOffset pins an overflowing label; remove labelOffset to allow automatic containment.',
      );
  } else if (placement === 'outside') {
    const inlineStyle = label.style;
    label.lines = wrapAnnotationText(
      label.text,
      reserve.labelWidth,
      { fontSize: label.style.fontSize, fontWeight: label.style.fontWeight },
      measure,
    );
    label.style = { ...label.style, textAnchor: 'start' };
    const size = bounds();
    // The budget's admitted top-lane row for this label, if any.
    const row =
      horizontal || reserve.topLane === false || resolved.specIndex === undefined
        ? undefined
        : reserve.rows.find((slot) => slot.members.includes(resolved.specIndex!));
    const top = row ? area.y - row.above : Number.NaN;
    if (
      horizontal ? reserve.right === 0 : !row || top < container.y || top + size.height > area.y
    ) {
      // No lane for this label (not admitted by the budget, no reserve at all,
      // or too small a figure): place the wrapped label inside instead.
      label.style = inlineStyle;
      placement = 'auto';
      if (!horizontal) {
        const y = Math.max(container.y, area.y);
        const bottom = Math.min(container.y + container.height, area.y + area.height);
        region = { x: container.x, y, width: container.width, height: Math.max(0, bottom - y) };
      }
      if (!lanes.topOverflow)
        warn?.(
          '[openchart] Outside reference labels exceed their available lane; use shorter labels or a taller figure.',
        );
      lanes.topOverflow = true;
    } else if (horizontal) {
      label.x = container.x + container.width - reserve.right + 24;
      const previous = lanes.rightLabels?.at(-1)?.bounds;
      const rightTop = Math.max(
        area.y,
        line.end.y - size.height / 2,
        previous ? previous.y + previous.height + 8 : area.y,
      );
      label.y += rightTop - bounds().y;
      resolved.bounds = bounds();
      (lanes.rightLabels ??= []).push(resolved);
      // Sweep the stack back from the bottom edge without changing source order.
      // Connector endpoints remain on the corresponding rule after every move.
      const bottom = Math.min(container.y + container.height, area.y + area.height);
      let nextTop = bottom + 8;
      for (const item of [...lanes.rightLabels].reverse()) {
        const box = estimateLabelBounds(item.label!, measure);
        const dy = Math.min(0, nextTop - 8 - box.y - box.height);
        item.label!.y += dy;
        item.bounds = item.label!.bounds = estimateLabelBounds(item.label!, measure);
        nextTop = item.bounds.y;
        if (item.label!.connector)
          item.label!.connector = refreshConnector(item.label!.connector, item.bounds, 0);
      }
      if (nextTop < area.y && !lanes.topOverflow) {
        warn?.(
          '[openchart] Outside reference labels exceed their available lane; use shorter labels or a taller figure.',
        );
        lanes.topOverflow = true;
      }
    } else {
      // Same horizontal extent the budget packed the row with.
      label.x = Math.min(
        container.x + container.width - size.width,
        Math.max(area.x, line.start.x - size.width / 2),
      );
      label.y += top - bounds().y;
    }
  }
  if (placement === 'auto' && annotation.labelOffset === undefined) {
    const original = { x: label.x, y: label.y, anchor: label.style.textAnchor };
    const candidates = horizontal
      ? [
          { x: line.end.x - 4, y: label.y, anchor: 'end' as const },
          { x: line.start.x + 4, y: label.y, anchor: 'start' as const },
        ]
      : [
          { x: label.x, y: line.start.y + 14, anchor: label.style.textAnchor },
          { x: label.x, y: line.end.y - 4, anchor: label.style.textAnchor },
        ];
    const relevant = obstacles.filter((o) => o.kind !== 'area-fill');
    const clear = (box: Rect) => fits(box) && relevant.every((o) => overlapArea(box, o) === 0);
    let found = false;
    for (const candidate of candidates) {
      Object.assign(label, { x: candidate.x, y: candidate.y });
      label.style = { ...label.style, textAnchor: candidate.anchor };
      if (clear(bounds())) {
        found = true;
        break;
      }
    }
    if (!found) {
      Object.assign(label, { x: original.x, y: original.y });
      label.style = { ...label.style, textAnchor: original.anchor };
      const box = bounds();
      // Obstacle edges and containment boundaries are sufficient candidates;
      // no pixel scan or side flip is needed. Bound the search for dense plots.
      const shifts = horizontal
        ? [
            region.x - box.x,
            region.x + region.width - box.x - box.width,
            ...relevant.flatMap((o) => [o.x - box.x - box.width - 4, o.x + o.width - box.x + 4]),
          ]
        : [
            region.y - box.y,
            region.y + region.height - box.y - box.height,
            ...relevant.flatMap((o) => [o.y - box.y - box.height - 4, o.y + o.height - box.y + 4]),
          ];
      for (const shift of [...new Set(shifts)]
        .sort((a, b) => Math.abs(a) - Math.abs(b))
        .slice(0, 64)) {
        label.x = original.x + (horizontal ? shift : 0);
        label.y = original.y + (horizontal ? 0 : shift);
        if (clear(bounds())) {
          found = true;
          break;
        }
      }
      if (!found) {
        label.x = original.x;
        label.y = original.y;
        const shift = horizontal
          ? Math.max(region.x - box.x, Math.min(0, region.x + region.width - box.x - box.width))
          : Math.max(region.y - box.y, Math.min(0, region.y + region.height - box.y - box.height));
        if (horizontal) label.x += shift;
        else label.y += shift;
        // A lane overflow already warned; this advice would point back at 'outside'.
        if (annotation.labelPlacement === 'auto')
          warn?.(
            '[openchart] Reference label has no clear contained position; use labelPlacement: "outside" or shorter text.',
          );
      }
    }
  }
  label.background = colors?.annotationPlate;
  label.bounds = bounds();
  resolved.bounds = label.bounds;
  if (placement === 'outside' || Math.hypot(label.x - initial.x, label.y - initial.y) > 8) {
    // A displaced label points to its rule, never a nearby observation.
    if (placement !== 'outside')
      target = horizontal ? { x: initial.x, y: line.start.y } : { x: line.start.x, y: initial.y };
    label.connector = refreshConnector(
      {
        from: { ...target },
        to: { ...target },
        endpoint: { ...target },
        stroke: resolved.stroke ?? '#666666',
        style: 'straight',
        arrow: false,
        // The whole leader stays left of the right-gutter text, even when a
        // tall neighbor displaces this label. Persist through sweep/tween rebuilds.
        ...(placement === 'outside' && horizontal && annotation.labelOffset === undefined
          ? { labelAttachment: 'left-center' as const }
          : {}),
      },
      label.bounds,
      0,
    );
  }
}
