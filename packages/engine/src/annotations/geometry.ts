/**
 * Geometry utilities for annotation text bounds, connector origins, and offsets.
 */

import type {
  AnnotationAnchor,
  AnnotationOffset,
  Rect,
  ResolvedLabel,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import {
  ANCHOR_OFFSET,
  ARROWHEAD_HALF_WIDTH,
  ARROWHEAD_LENGTH,
  CONNECTOR_STANDOFF,
  connectorIsDrawable,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_LINE_HEIGHT,
  DROP_LINE_TOP_GAP,
  TARGET_LABEL_REACH,
  TARGET_LABEL_STANDOFF,
} from './constants';
import { BOLD_SPAN_FONT_WEIGHT, parseAnnotationSpans } from './rich-text';

/**
 * Measure one run of text at a given size and weight.
 *
 * Deliberately takes no `fontFamily`: neither implementation could use one.
 * `heuristicMeasure` below is family-blind, and the real canvas measurer gets its
 * family from the `createMeasureText(fontFamily)` closure, not per call -- so a
 * family passed here would be silently dropped while implying the opposite.
 * `style.fontFamily` on a *resolved label* is a different thing: that one is real
 * and gets rendered.
 */
export type AnnotationMeasureTextFn = (
  text: string,
  font: { fontSize: number; fontWeight: number },
) => number;

export const heuristicMeasure: AnnotationMeasureTextFn = (text, { fontSize, fontWeight }) =>
  estimateTextWidth(text, fontSize, fontWeight);

/**
 * Width of one line of annotation text, `**bold**` spans included: each span is
 * measured at its own weight and the widths are summed. Measuring the raw string
 * would count the `**` markers and use one weight for the whole line, so bounds,
 * collisions, placement, and connector exits would all be wrong for rich text.
 */
export function measureRichLine(
  line: string,
  style: { fontSize: number; fontWeight: number },
  measure: AnnotationMeasureTextFn,
): number {
  const spans = parseAnnotationSpans(line);
  let width = 0;
  for (const span of spans) {
    width += measure(span.text, {
      fontSize: style.fontSize,
      fontWeight: span.bold ? BOLD_SPAN_FONT_WEIGHT : style.fontWeight,
    });
  }
  return width;
}

/**
 * Compute the bounding box of a text block, aware of textAnchor and multi-line layout.
 * labelY is the first-line baseline.
 */
export function computeTextBlockBounds(
  labelX: number,
  labelY: number,
  text: string,
  style: {
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    textAnchor?: 'start' | 'middle' | 'end';
    fontFamily?: string;
  },
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): Rect {
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map((line) => measureRichLine(line, style, measure)));
  const height =
    style.fontSize + (lines.length - 1) * style.fontSize * style.lineHeight + style.fontSize * 0.3;

  let x: number;
  if (style.textAnchor === 'middle') {
    x = labelX - maxWidth / 2;
  } else if (style.textAnchor === 'end') {
    x = labelX - maxWidth;
  } else {
    x = labelX;
  }

  return {
    x,
    y: labelY - style.fontSize,
    width: maxWidth,
    height,
  };
}

export function unionRects(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Apply anchor direction to compute label offset from data point.
 * Returns { dx, dy } pixel offsets.
 */
export function computeAnchorOffset(
  anchor: AnnotationAnchor | undefined,
  _px: number,
  py: number,
  chartArea: Rect,
): { dx: number; dy: number } {
  if (!anchor || anchor === 'auto') {
    // Auto: place above if in the lower half, below if upper half
    const isUpperHalf = py < chartArea.y + chartArea.height / 2;
    return isUpperHalf
      ? { dx: ANCHOR_OFFSET, dy: ANCHOR_OFFSET } // below-right
      : { dx: ANCHOR_OFFSET, dy: -ANCHOR_OFFSET }; // above-right
  }

  switch (anchor) {
    case 'top':
      return { dx: 0, dy: -ANCHOR_OFFSET };
    case 'bottom':
      return { dx: 0, dy: ANCHOR_OFFSET };
    case 'left':
      return { dx: -ANCHOR_OFFSET, dy: 0 };
    case 'right':
      return { dx: ANCHOR_OFFSET, dy: 0 };
  }
}

/** Apply user offset on top of computed anchor offset. */
export function applyOffset(
  base: { dx: number; dy: number },
  offset: AnnotationOffset | undefined,
): { dx: number; dy: number } {
  if (!offset) return base;
  return {
    dx: base.dx + (offset.dx ?? 0),
    dy: base.dy + (offset.dy ?? 0),
  };
}

/** Inflation applied to the label box before intersecting the connector ray. */
const BOX_INFLATE = 2;

/**
 * Compute where a connector leaves the annotation's text block on its way to the
 * target. Casts a ray from the box center toward the target, intersects the
 * (slightly inflated) box, then advances `standoff` px along the ray so the line
 * never touches the glyphs.
 *
 * Returns `null` when the target sits inside the inflated box (a connector would
 * cross its own text) or when the standoff would overshoot the target.
 */
export function connectorExit(
  bounds: Rect,
  targetX: number,
  targetY: number,
  standoff = CONNECTOR_STANDOFF,
): { x: number; y: number; exit: 'horizontal' | 'vertical' } | null {
  const box = {
    x: bounds.x - BOX_INFLATE,
    y: bounds.y - BOX_INFLATE,
    width: bounds.width + BOX_INFLATE * 2,
    height: bounds.height + BOX_INFLATE * 2,
  };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const halfW = box.width / 2;
  const halfH = box.height / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;

  // Target inside the inflated box: any connector would cross the text.
  if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) return null;
  if (dx === 0 && dy === 0) return null;

  // Parametric ray: center + t * (dx, dy). Find the smallest t that lands on an
  // edge of the box, and which axis that edge belongs to.
  const tx = halfW > 0 && dx !== 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = halfH > 0 && dy !== 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  if (!Number.isFinite(t)) return null;

  const exit: 'horizontal' | 'vertical' = tx <= ty ? 'horizontal' : 'vertical';

  const edgeX = cx + dx * t;
  const edgeY = cy + dy * t;

  // Advance along the ray by the standoff distance.
  const rayLen = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / rayLen;
  const uy = dy / rayLen;

  // Overshoot guard: the standoff must not push the origin past the target.
  // Measure edge-to-target in pixels rather than scaling the ray by (1 - t):
  // t is a ratio of box extents, so that form understates the clearance when the
  // ray leaves through the long side of a wide label, and killed connectors that
  // had ample room. Whether the line is long enough to be worth drawing is
  // decided downstream against MIN_CONNECTOR_LENGTH, once the marker pullback is
  // known — this guard only rejects a standoff that would overshoot the target.
  const edgeToTarget = Math.hypot(targetX - edgeX, targetY - edgeY);
  if (standoff >= edgeToTarget) return null;

  const x = edgeX + ux * standoff;
  const y = edgeY + uy * standoff;

  return { x, y, exit };
}

/** Estimate the bounding box of an annotation label using its resolved style. */
export function estimateLabelBounds(
  label: ResolvedLabel,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): Rect {
  const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
  const fontWeight = label.style.fontWeight ?? DEFAULT_ANNOTATION_FONT_WEIGHT;
  return computeTextBlockBounds(
    label.x,
    label.y,
    label.lines?.join('\n') ?? label.text,
    {
      fontSize,
      fontWeight,
      lineHeight: label.style.lineHeight ?? DEFAULT_LINE_HEIGHT,
      textAnchor: label.style.textAnchor ?? 'start',
      fontFamily: label.style.fontFamily,
    },
    measure,
  );
}

/** Arrowhead triangle points: tip + two base corners. */
export interface ArrowheadPoints {
  tip: { x: number; y: number };
  baseLeft: { x: number; y: number };
  baseRight: { x: number; y: number };
}

// Both live in `constants.ts` (the min-length gate has to reason about the
// arrowhead's stroke budget, and constants.ts can't import from here without a
// cycle). Re-exported so the renderer's import path doesn't move.
export { ARROWHEAD_HALF_WIDTH, ARROWHEAD_LENGTH };

/**
 * Compute arrowhead triangle geometry at a connector endpoint.
 * Returns the tip (at the endpoint) and two base corners perpendicular to the
 * tangent direction.
 *
 * @param tipX - X coordinate of the arrowhead tip
 * @param tipY - Y coordinate of the arrowhead tip
 * @param tangentX - X component of the tangent direction (toward the tip)
 * @param tangentY - Y component of the tangent direction (toward the tip)
 * @param length - Arrow length along the tangent (default ARROWHEAD_LENGTH)
 * @param halfWidth - Arrow half-width perpendicular to tangent (default ARROWHEAD_HALF_WIDTH)
 */
export function computeArrowheadPoints(
  tipX: number,
  tipY: number,
  tangentX: number,
  tangentY: number,
  length = ARROWHEAD_LENGTH,
  halfWidth = ARROWHEAD_HALF_WIDTH,
): ArrowheadPoints {
  const tLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
  const ux = tangentX / tLen;
  const uy = tangentY / tLen;

  const baseX = tipX - ux * length;
  const baseY = tipY - uy * length;

  const px = -uy;
  const py = ux;

  return {
    tip: { x: tipX, y: tipY },
    baseLeft: { x: baseX + px * halfWidth, y: baseY + py * halfWidth },
    baseRight: { x: baseX - px * halfWidth, y: baseY - py * halfWidth },
  };
}

/**
 * Distance the connector's data-point end is pulled back so the line stops short
 * of the endpoint marker instead of piercing it.
 */
export function connectorPullbackGap(markerRadius: number, arrow: boolean): number {
  return arrow ? Math.max(markerRadius + 2, 2) : Math.max(markerRadius + 3, 4);
}

/**
 * Rebuild a connector's geometry against a (possibly moved) annotation bounds.
 *
 * `from` comes from the ray-box exit; `to` is recomputed by pulling back from
 * `connector.endpoint` — never from the already-pulled-back `to`, which would
 * shrink the line a little more on every pass.
 *
 * Returns `undefined` when the connector should be suppressed: the target sits
 * inside the text block, or the resulting line is shorter than
 * `MIN_CONNECTOR_LENGTH`.
 */
export function automaticControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  exit?: 'horizontal' | 'vertical',
  bend = 0,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const vertical = exit ? exit === 'vertical' : Math.abs(dy) >= Math.abs(dx);
  const x = from.x + dx * (vertical ? 0.2 : 0.6);
  const y = from.y + dy * (vertical ? 0.6 : 0.2);
  // len * normal = (dy, -dx), including a degenerate chord. Preserve exact
  // floating-point output when bend is omitted or zero.
  return bend === 0 ? { x, y } : { x: x + bend * dy, y: y - bend * dx };
}

/**
 * Pull a connector's data end back from `endpoint` by `gap`. A straight line
 * shortens along its chord. A curve is shaped to the real endpoint and then
 * shortened along its own end tangent (control -> endpoint), so the tail still
 * aims at the marker; shortening along the chord bends the tail off it.
 */
export function pullBackConnector(
  from: { x: number; y: number },
  endpoint: { x: number; y: number },
  gap: number,
  curve?: { exit?: 'horizontal' | 'vertical'; bend?: number },
): { to: { x: number; y: number }; control?: { x: number; y: number } } {
  const control = curve ? automaticControlPoint(from, endpoint, curve.exit, curve.bend) : undefined;
  const pullback = (origin: { x: number; y: number }) => {
    const dx = endpoint.x - origin.x;
    const dy = endpoint.y - origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist > 0
      ? { x: endpoint.x - (dx / dist) * gap, y: endpoint.y - (dy / dist) * gap }
      : null;
  };
  const to = (control && pullback(control)) ?? pullback(from) ?? { ...endpoint };
  return control ? { to, control } : { to };
}

type Connector = NonNullable<ResolvedLabel['connector']>;

/** Point at parameter `t` along the drawn connector: its chord, or the rendered quadratic. */
function connectorPointAt(connector: Connector, t: number): { x: number; y: number } {
  const { from, to, control } = connector;
  if (connector.style !== 'curve' || !control)
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/** First parameter at which the drawn connector enters `box`; undefined when it never does. */
function connectorEntry(connector: Connector, box: Rect): number | undefined {
  const inside = (p: { x: number; y: number }) =>
    p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;
  // A leader that starts inside the label has no clear stretch to keep.
  if (inside(connector.from)) return undefined;
  if (connector.style !== 'curve' || !connector.control) {
    // Liang-Barsky clip of the chord against the box.
    const { from, to } = connector;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let t0 = 0;
    let t1 = 1;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    return clip(-dx, from.x - box.x) &&
      clip(dx, box.x + box.width - from.x) &&
      clip(-dy, from.y - box.y) &&
      clip(dy, box.y + box.height - from.y)
      ? t0
      : undefined;
  }
  // A quadratic: find the first sampled step inside, then bisect to the edge.
  const steps = 64;
  for (let i = 1; i <= steps; i++) {
    if (!inside(connectorPointAt(connector, i / steps))) continue;
    let lo = (i - 1) / steps;
    let hi = i / steps;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (inside(connectorPointAt(connector, mid))) hi = mid;
      else lo = mid;
    }
    return hi;
  }
  return undefined;
}

/**
 * Stop a connector's data end where it would strike through the target's own
 * value label, a standoff short of the label box. Only labels within
 * `TARGET_LABEL_REACH` of the data point count: a value label elsewhere on the
 * leader's path is a placement concern, not a reason to cut the line short. A
 * curve is split at the cut (de Casteljau), so the kept part keeps its shape.
 *
 * Returns `undefined` when no target label is crossed, `null` when the line
 * left before the label is too short to draw, else the shortened connector
 * carrying the label as `targetLabel` for later rebuilds.
 */
export function stopAtTargetLabel(
  connector: Connector,
  labels: readonly Rect[],
): Connector | null | undefined {
  const endpoint = connector.endpoint ?? connector.to;
  let cut: { t: number; label: Rect } | undefined;
  for (const label of labels) {
    const gapX = Math.max(label.x - endpoint.x, 0, endpoint.x - (label.x + label.width));
    const gapY = Math.max(label.y - endpoint.y, 0, endpoint.y - (label.y + label.height));
    if (Math.hypot(gapX, gapY) > TARGET_LABEL_REACH) continue;
    const t = connectorEntry(connector, {
      x: label.x - TARGET_LABEL_STANDOFF,
      y: label.y - TARGET_LABEL_STANDOFF,
      width: label.width + 2 * TARGET_LABEL_STANDOFF,
      height: label.height + 2 * TARGET_LABEL_STANDOFF,
    });
    if (t !== undefined && (!cut || t < cut.t)) cut = { t, label };
  }
  if (!cut) return undefined;
  const to = connectorPointAt(connector, cut.t);
  const { from, control } = connector;
  if (!connectorIsDrawable(Math.hypot(to.x - from.x, to.y - from.y), connector.arrow)) return null;
  const { x, y, width, height } = cut.label;
  return {
    ...connector,
    to,
    ...(connector.style === 'curve' && control
      ? {
          control: {
            x: from.x + (control.x - from.x) * cut.t,
            y: from.y + (control.y - from.y) * cut.t,
          },
        }
      : {}),
    targetLabel: { x, y, width, height },
  };
}

export function refreshConnector(
  connector: Connector,
  bounds: Rect,
  markerRadius: number,
  keepVisible = false,
): ResolvedLabel['connector'] {
  const rebuilt = rebuildConnector(connector, bounds, markerRadius, keepVisible);
  if (!rebuilt?.targetLabel) return rebuilt;
  const stopped = stopAtTargetLabel(rebuilt, [rebuilt.targetLabel]);
  if (stopped === null) return keepVisible ? rebuilt : undefined;
  return stopped ?? rebuilt;
}

function rebuildConnector(
  connector: Connector,
  bounds: Rect,
  markerRadius: number,
  keepVisible: boolean,
): ResolvedLabel['connector'] {
  // `endpoint` is the un-pulled-back data point, and the only valid basis for a
  // rebuild: pulling back from `to` (already pulled back) shrinks the line a
  // little more on every pass. Every resolver sets it, but the field is optional
  // on the public `ResolvedLabel` type, so a layout from another producer could
  // omit it — bail rather than silently compound the error.
  if (!connector.endpoint) return undefined;
  const endpoint = connector.endpoint;

  // A drop-line is not a leader: it's a vertical rule pinned to the data point's
  // x, running from just above the label box down to the marker. Rebuilding it
  // from a ray-box exit tilts it into a diagonal (which the renderer draws with
  // shape-rendering: crispEdges, assuming axis alignment), and the
  // MIN_CONNECTOR_LENGTH rule below would delete it outright once the label sits
  // near its point.
  //
  // This mirrors `resolveDropLineAnnotation`'s formula exactly — `from` above the
  // label top, `to` pulled back from the point — so a nudged drop-line keeps the
  // same geometry it resolved with, just at the label's new position.
  if (connector.style === 'drop-line') {
    const gap = connectorPullbackGap(markerRadius, false);
    return {
      ...connector,
      from: {
        x: endpoint.x + (connector.fromOffset?.dx ?? 0),
        y: bounds.y - DROP_LINE_TOP_GAP + (connector.fromOffset?.dy ?? 0),
      },
      to: { x: endpoint.x, y: endpoint.y - gap },
      exit: 'vertical',
    };
  }

  const exit =
    (connector.labelAttachment === 'left-center'
      ? {
          x: bounds.x - BOX_INFLATE - CONNECTOR_STANDOFF,
          y: bounds.y + bounds.height / 2,
          exit: 'horizontal' as const,
        }
      : connectorExit(bounds, endpoint.x, endpoint.y)) ??
    (keepVisible
      ? {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
          exit: connector.exit ?? ('horizontal' as const),
        }
      : null);
  if (!exit) return undefined;

  // Re-apply the author's from-end nudge BEFORE the pullback, so the pullback
  // direction is measured from the real origin -- exactly as
  // `resolveTextAnnotation` does on first resolve.
  const from = {
    x: exit.x + (connector.fromOffset?.dx ?? 0),
    y: exit.y + (connector.fromOffset?.dy ?? 0),
  };

  const { to, control } = pullBackConnector(
    from,
    endpoint,
    connectorPullbackGap(markerRadius, connector.arrow),
    connector.style === 'curve' ? { exit: exit.exit, bend: connector.bend } : undefined,
  );

  // Min-length check runs AFTER the pullback: a near-degenerate line can flip
  // direction once its end is pulled back, and checking first would miss it.
  const lx = to.x - from.x;
  const ly = to.y - from.y;
  if (!keepVisible && !connectorIsDrawable(Math.sqrt(lx * lx + ly * ly), connector.arrow))
    return undefined;

  return {
    ...connector,
    from,
    to,
    exit: exit.exit,
    ...(control ? { control } : {}),
  };
}
