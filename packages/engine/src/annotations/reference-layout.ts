import type {
  Annotation,
  Rect,
  RefLineAnnotation,
  ResolvedAnnotation,
  ThemeColors,
} from '@opendata-ai/openchart-core';
import { overlapArea } from '@opendata-ai/openchart-core';
import { type AnnotationMeasureTextFn, estimateLabelBounds, refreshConnector } from './geometry';
import type { PlacementObstacle } from './placement';
import { wrapAnnotationText } from './wrap-text';

export interface ReferenceReserve {
  right: number;
  top: number;
  labelWidth: number;
}

/** The reserve depends only on authored labels and container width, never placement results. */
export function referenceLabelReserve(
  annotations: Annotation[],
  width: number,
  measure: AnnotationMeasureTextFn,
): ReferenceReserve {
  const outside = annotations.filter(
    (a): a is RefLineAnnotation =>
      a.type === 'refline' && a.labelPlacement === 'outside' && !!a.label,
  );
  const labelWidth = Math.max(24, Math.min(160, width * 0.25));
  const vertical = outside.filter((a) => a.y === undefined);
  const top = vertical.reduce(
    (height, a) =>
      height +
      wrapAnnotationText(
        a.label!,
        labelWidth,
        { fontSize: a.fontSize ?? 11, fontWeight: a.fontWeight ?? 400 },
        measure,
      ).length *
        (a.fontSize ?? 11) *
        1.3 +
      8,
    0,
  );
  return {
    right: outside.some((a) => a.y !== undefined) ? labelWidth + 32 : 0,
    top: top ? top + 24 : 0,
    labelWidth,
  };
}

export interface ReferenceLanes {
  rightLabels?: ResolvedAnnotation[];
  topBottom?: number;
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
  const fits = (box: Rect) =>
    box.x >= container.x &&
    box.y >= container.y &&
    box.x + box.width <= container.x + container.width &&
    box.y + box.height <= container.y + container.height;
  let target = horizontal ? line.end : line.start;

  if (annotation.labelOffset !== undefined) {
    if (!fits(bounds()))
      warn?.(
        '[openchart] Reference labelOffset pins an overflowing label; remove labelOffset to allow automatic containment.',
      );
  } else if (annotation.labelPlacement === 'outside') {
    label.lines = wrapAnnotationText(
      label.text,
      reserve.labelWidth,
      { fontSize: label.style.fontSize, fontWeight: label.style.fontWeight },
      measure,
    );
    label.style = { ...label.style, textAnchor: 'start' };
    const size = bounds();
    if (horizontal) {
      label.x = container.x + container.width - reserve.right + 24;
      const previous = lanes.rightLabels?.at(-1)?.bounds;
      const top = Math.max(
        area.y,
        line.end.y - size.height / 2,
        previous ? previous.y + previous.height + 8 : area.y,
      );
      label.y += top - bounds().y;
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
      if (nextTop < area.y)
        warn?.(
          '[openchart] Outside reference labels exceed their available lane; use shorter labels or a taller figure.',
        );
    } else {
      label.x = Math.min(
        container.x + container.width - size.width,
        Math.max(area.x, line.start.x - size.width / 2),
      );
      const top = lanes.topBottom ?? area.y - reserve.top;
      label.y += top - bounds().y;
      lanes.topBottom = top + size.height + 8;
    }
  } else if (annotation.labelPlacement === 'auto') {
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
            container.x - box.x,
            container.x + container.width - box.x - box.width,
            ...relevant.flatMap((o) => [o.x - box.x - box.width - 4, o.x + o.width - box.x + 4]),
          ]
        : [
            container.y - box.y,
            container.y + container.height - box.y - box.height,
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
          ? Math.max(
              container.x - box.x,
              Math.min(0, container.x + container.width - box.x - box.width),
            )
          : Math.max(
              container.y - box.y,
              Math.min(0, container.y + container.height - box.y - box.height),
            );
        if (horizontal) label.x += shift;
        else label.y += shift;
        warn?.(
          '[openchart] Reference label has no clear contained position; use labelPlacement: "outside" or shorter text.',
        );
      }
    }
  }
  label.background = colors?.annotationPlate;
  label.bounds = bounds();
  resolved.bounds = label.bounds;
  if (
    annotation.labelPlacement === 'outside' ||
    Math.hypot(label.x - initial.x, label.y - initial.y) > 8
  ) {
    // A displaced label points to its rule, never a nearby observation.
    if (annotation.labelPlacement !== 'outside')
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
        ...(annotation.labelPlacement === 'outside' &&
        horizontal &&
        annotation.labelOffset === undefined
          ? { labelAttachment: 'left-center' as const }
          : {}),
      },
      label.bounds,
      0,
    );
  }
}
