import type { ChartLayout, TooltipContent, TooltipField } from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import { sharedTooltipFields } from '@opendata-ai/openchart-engine';
import type { TooltipManager } from '../tooltip';
import type { HoverEmphasis } from './hover-emphasis';

/** Shapes that represent individual observations in the trend slice index. */
export function isTrendObservation(mark: ChartLayout['marks'][number]): boolean {
  return mark.type === 'point' || (mark.type === 'rule' && mark.markType === 'area');
}

interface SeriesPoint {
  x: number;
  y: number;
  datum: Record<string, unknown>;
  tooltip?: TooltipContent;
  markId?: string;
}

interface SeriesGroup {
  key: string;
  seriesKey: string;
  markId: string;
  color: string;
  pointsByX: Map<number, SeriesPoint>;
}

/**
 * Vertical distance from a series' point at which the pointer counts as being
 * "on" that series. Beyond it the crosshair and tooltip still track, but no
 * series is raised: without the threshold every crossing of the plot would
 * re-dim the whole chart on the way past.
 */
const EMPHASIS_PROXIMITY_PX = 18;

/** Snap dot radius. */
const SNAP_DOT_RADIUS = 4.5;

export interface CrosshairController {
  /** Remove all listeners. */
  cleanup(): void;
  /** Number of snap positions along x. */
  readonly snapCount: number;
  /**
   * The snap index currently shown, or -1 when nothing is. Pointer and keyboard
   * share it, so stepping with the arrow keys resumes from wherever the pointer
   * left off instead of restarting at the first x.
   */
  readonly currentIndex: number;
  /** Observation and series currently selected by keyboard navigation. */
  readonly focusedMark: { markId: string; datum: Record<string, unknown>; series: string } | null;
  /** Show the slice at a snap index (wraps). Used by keyboard nav. */
  stepTo(index: number): void;
  /** Cycle the emphasized series at the current x by `delta` (wraps). */
  cycleSeries(delta: number): void;
  /** Re-show the current slice. */
  showCurrent(): void;
  /**
   * Hide crosshair, dots, tooltip and emphasis. Pass `true` to also forget the
   * current snap index (Escape / blur, where the reader has left the chart).
   */
  hide(resetIndex?: boolean): void;
}

function snapKey(x: number): number {
  return Math.round(x);
}

function collectSeriesGroups(layout: ChartLayout): SeriesGroup[] {
  // Dedupe within each leaf: area charts emit BOTH an AreaMark and a derived
  // LineMark per series. Without dedupe, single-series area charts show
  // "line-0" / "area-1" in the tooltip instead of the actual data fields.
  // Prefer the line mark (same logic as endpoint-labels).
  const byKey = new Map<string, SeriesGroup>();
  const connectedRows = new Map<string, Set<Record<string, unknown>>>();
  const markTypeByKey = new Map<string, 'line' | 'area'>();
  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    if ((mark.type === 'line' || mark.type === 'area') && mark.dataPoints?.length) {
      // compileLayer namespaces mark keys by original leaf index, independently
      // of paint order. Equal series names in separate leaves are distinct
      // evidence; a band's derived line still shares its leaf's series group.
      const scope = mark.key?.match(/^layer:\d+:/)?.[0] ?? '';
      const segmentOf = (point: { datum: Record<string, unknown>; segment?: unknown }) =>
        typeof point.segment === 'number' ? point.segment : 0;
      const segments = new Map<number, number>();
      for (const point of mark.dataPoints) {
        const segment = segmentOf(point);
        segments.set(segment, (segments.get(segment) ?? 0) + 1);
      }
      const connected = connectedRows.get(scope) ?? new Set<Record<string, unknown>>();
      for (const point of mark.dataPoints)
        if (segments.get(segmentOf(point))! > 1) connected.add(point.datum);
      connectedRows.set(scope, connected);
      const seriesKey = mark.seriesKey ?? '__default__';
      const key = `${scope}${seriesKey}`;
      const existingType = markTypeByKey.get(key);
      if (existingType === 'line' && mark.type === 'area') continue;
      const color = mark.type === 'line' ? mark.stroke : getRepresentativeColor(mark.fill);
      const pointsByX = new Map<number, SeriesPoint>();
      for (const dp of mark.dataPoints) {
        pointsByX.set(snapKey(dp.x), { ...dp });
      }
      byKey.set(key, { key, seriesKey, markId: `${mark.type}-${i}`, color, pointsByX });
      markTypeByKey.set(key, mark.type);
    }
  }
  // Semantic points and isolated area intervals share the trend slice index.
  // Authored point layers remain independent evidence.
  for (const [index, mark] of layout.marks.entries()) {
    if (
      (mark.type !== 'point' && !(mark.type === 'rule' && isTrendObservation(mark))) ||
      mark.aria.decorative
    )
      continue;
    const markId = `${mark.type}-${index}`;
    const scope = mark.key?.match(/^layer:\d+:/)?.[0] ?? '';
    const tooltip = layout.tooltipDescriptors.get(markId);
    if (!tooltip) continue;
    // Visible connected markers duplicate their trend observation. Dedupe
    // only within this leaf; another authored point layer remains evidence.
    if (connectedRows.get(scope)?.has(mark.data)) continue;
    const seriesKey = (mark.type === 'point' ? mark.seriesKey : undefined) ?? '__default__';
    let key = `${scope}${seriesKey}`;
    let group = byKey.get(key);
    const observationX = mark.type === 'point' ? mark.cx : mark.x1;
    const observationY = mark.type === 'point' ? mark.cy : (mark.y1 + mark.y2) / 2;
    const x = snapKey(observationX);
    // Separate observations at the same x remain independent evidence.
    if (group?.pointsByX.has(x) && group.pointsByX.get(x)!.datum !== mark.data) {
      key = `${key}:point:${mark.key ?? index}`;
      group = byKey.get(key);
    }
    if (!group) {
      group = {
        key,
        seriesKey,
        markId,
        color: mark.type === 'point' ? getRepresentativeColor(mark.fill) : mark.stroke,
        pointsByX: new Map(),
      };
      byKey.set(key, group);
    }
    group.pointsByX.set(x, { x: observationX, y: observationY, datum: mark.data, tooltip, markId });
  }
  return Array.from(byKey.values());
}

function collectSnapXs(groups: SeriesGroup[]): number[] {
  const seen = new Set<number>();
  for (const g of groups) {
    for (const k of g.pointsByX.keys()) seen.add(k);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

function findNearestX(sortedXs: number[], x: number): number | null {
  if (sortedXs.length === 0) return null;
  let lo = 0;
  let hi = sortedXs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedXs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  const candidate = sortedXs[lo];
  if (lo > 0) {
    const prev = sortedXs[lo - 1];
    if (Math.abs(prev - x) < Math.abs(candidate - x)) return prev;
  }
  return candidate;
}

function buildSliceTooltip(
  hits: Array<{ group: SeriesGroup; point: SeriesPoint }>,
  emphasisKey: string | null,
): TooltipContent | null {
  if (hits.length === 0) return null;

  const title = hits[0].point.tooltip?.title;
  const fields: TooltipField[] = [];

  const isMulti = hits.length > 1;
  const seriesCounts = new Map<string, number>();
  for (const { group } of hits)
    seriesCounts.set(group.seriesKey, (seriesCounts.get(group.seriesKey) ?? 0) + 1);
  // The stack total is precomputed per x by the engine and carried on every
  // layer's row; take the first one and append it once, below the series rows.
  let total: TooltipField | undefined;

  for (const { group, point } of hits) {
    const tip = point.tooltip;
    if (!tip) continue;
    if (!total) total = tip.fields.find((f) => f.role === 'total');
    const selected = sharedTooltipFields(tip);
    for (const field of selected) {
      const identifySeries = isMulti && group.seriesKey !== '__default__';
      fields.push({
        ...field,
        label: identifySeries
          ? (seriesCounts.get(group.seriesKey) ?? 0) > 1 ||
            selected.length > 1 ||
            field.source?.tooltipIndex !== undefined
            ? `${group.seriesKey} · ${field.label}`
            : group.seriesKey
          : field.label,
        color: field.color ?? group.color,
        ...(emphasisKey === group.key ? { emphasis: true } : {}),
      });
    }
  }

  if (fields.length === 0) return null;
  // A total only reads as a total when there is more than one row to add up.
  if (total && isMulti) fields.push(total);
  return { title, fields };
}

/**
 * Wire snap-to-x multi-series tooltip events for line/area charts.
 * On mousemove over the chart area we find the nearest x in the union of all
 * series, render one snap dot per series at that x, and show one merged
 * tooltip listing every series' value.
 *
 * Returns a controller so keyboard navigation can drive the same crosshair,
 * or `null` when the chart has no snap overlay (bars, pies, scatter).
 */
export function wireVoronoiTooltipEvents(
  svg: SVGElement,
  layout: ChartLayout,
  tooltipManager: TooltipManager,
  emphasis?: HoverEmphasis,
): CrosshairController | null {
  const overlay = svg.querySelector('[data-voronoi-overlay]');
  if (!overlay) return null;

  const groups = collectSeriesGroups(layout);
  if (groups.length === 0) return null;

  const snapXs = collectSnapXs(groups);
  if (snapXs.length === 0) return null;

  const crosshair = svg.querySelector('[data-crosshair]') as SVGLineElement | null;
  const dotsLayer = svg.querySelector('[data-snap-dots]') as SVGGElement | null;

  const dots: SVGCircleElement[] = [];
  if (dotsLayer) {
    while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
    for (const group of groups) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', String(SNAP_DOT_RADIUS));
      circle.setAttribute('fill', layout.theme.colors.background);
      circle.setAttribute('stroke', group.color);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('pointer-events', 'none');
      circle.style.display = 'none';
      dotsLayer.appendChild(circle);
      dots.push(circle);
    }
  }

  // Current snapped x index and the series raised at it, shared by pointer and
  // keyboard so ArrowUp/Down picks up where the pointer left off.
  let currentIndex = -1;
  let currentEmphasis: string | null = null;

  function containerScale(): number {
    const svgEl = svg as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox?.baseVal;
    const scaleX = viewBox?.width && rect.width ? viewBox.width / rect.width : 1;
    return scaleX > 0 ? 1 / scaleX : 1;
  }

  /** Draw crosshair, dots and tooltip for one snapped x. */
  function showAt(
    snappedX: number,
    emphasisKey: string | null,
    viewBoxToContainer: number,
  ): boolean {
    const hits: Array<{ group: SeriesGroup; point: SeriesPoint }> = [];
    let anchorY = 0;
    let anchorCount = 0;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const point = group.pointsByX.get(snappedX);
      const dot = dots[i];
      if (point) {
        hits.push({ group, point });
        anchorY += point.y;
        anchorCount += 1;
        if (dot) {
          dot.setAttribute('cx', String(point.x));
          dot.setAttribute('cy', String(point.y));
          dot.style.display = '';
        }
      } else if (dot) {
        dot.style.display = 'none';
      }
    }

    if (crosshair) {
      crosshair.setAttribute('x1', String(snappedX));
      crosshair.setAttribute('x2', String(snappedX));
      crosshair.style.display = '';
    }

    currentEmphasis = emphasisKey;
    const emphasizedGroup = groups.find((group) => group.key === emphasisKey);
    if (emphasizedGroup) {
      emphasis?.setMark(
        svg.querySelector(
          `[data-mark-id="${emphasizedGroup.pointsByX.get(snappedX)?.markId ?? emphasizedGroup.markId}"]`,
        ),
      );
    } else emphasis?.clear();

    const tooltip = buildSliceTooltip(hits, emphasisKey);
    if (!tooltip) return false;

    const containerAnchorX = snappedX * viewBoxToContainer;
    const containerAnchorY = anchorCount > 0 ? (anchorY / anchorCount) * viewBoxToContainer : 0;
    tooltipManager.show(tooltip, containerAnchorX, containerAnchorY, {
      placement: 'right',
    });
    return true;
  }

  /** Series keys present at a snapped x, in draw order. */
  function keysAt(snappedX: number): string[] {
    const keys: string[] = [];
    for (const group of groups) {
      if (group.pointsByX.has(snappedX)) keys.push(group.key);
    }
    return keys;
  }

  const positionAt = (svgX: number, svgY: number, viewBoxToContainer: number): boolean => {
    const snappedX = findNearestX(snapXs, svgX);
    if (snappedX === null) return false;
    currentIndex = snapXs.indexOf(snappedX);

    // Raise the series the pointer is actually near. Past the threshold the
    // slice still shows, with nothing dimmed.
    let nearestKey: string | null = null;
    let nearestDy = Number.POSITIVE_INFINITY;
    for (const group of groups) {
      const point = group.pointsByX.get(snappedX);
      if (!point) continue;
      const dy = Math.abs(point.y - svgY);
      if (dy < nearestDy) {
        nearestDy = dy;
        nearestKey = group.key;
      }
    }
    const emphasisKey = nearestDy <= EMPHASIS_PROXIMITY_PX ? nearestKey : null;

    return showAt(snappedX, emphasisKey, viewBoxToContainer);
  };

  const toSvgCoords = (clientX: number, clientY: number) => {
    const svgEl = svg as SVGSVGElement;
    const svgRect = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox?.baseVal;
    const scaleX = viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1;
    const scaleY = viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1;
    const svgX = (clientX - svgRect.left) * scaleX;
    const svgY = (clientY - svgRect.top) * scaleY;
    const viewBoxToContainer = scaleX > 0 ? 1 / scaleX : 1;
    return { svgX, svgY, viewBoxToContainer };
  };

  const handleMouseMove = (e: Event) => {
    const me = e as MouseEvent;
    const { svgX, svgY, viewBoxToContainer } = toSvgCoords(me.clientX, me.clientY);
    positionAt(svgX, svgY, viewBoxToContainer);
  };

  const hideAll = (resetIndex = false) => {
    if (crosshair) crosshair.style.display = 'none';
    for (const dot of dots) dot.style.display = 'none';
    tooltipManager.hide();
    currentEmphasis = null;
    if (resetIndex) currentIndex = -1;
    emphasis?.clear();
  };

  // Listeners get the arity-0 wrapper: passing hideAll straight to
  // addEventListener would hand the Event object to `resetIndex`.
  const hideOnPointerOut = () => hideAll();

  /** Show the slice at a snap index (wraps). Shared by pointer and keyboard. */
  function stepTo(index: number): void {
    if (snapXs.length === 0) return;
    const wrapped = ((index % snapXs.length) + snapXs.length) % snapXs.length;
    currentIndex = wrapped;
    const snappedX = snapXs[wrapped];
    // Keep the raised series across steps when it still has a point here.
    const keys = keysAt(snappedX);
    const keep = currentEmphasis && keys.includes(currentEmphasis) ? currentEmphasis : null;
    showAt(snappedX, keep, containerScale());
  }

  const handleTouch = (e: Event) => {
    const te = e as TouchEvent;
    if (te.touches.length === 0) return;
    const t = te.touches[0];
    const { svgX, svgY, viewBoxToContainer } = toSvgCoords(t.clientX, t.clientY);

    positionAt(svgX, svgY, viewBoxToContainer);
  };

  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseleave', hideOnPointerOut);
  overlay.addEventListener('touchstart', handleTouch, { passive: true });
  overlay.addEventListener('touchmove', handleTouch, { passive: true });
  overlay.addEventListener('touchend', hideOnPointerOut);

  return {
    cleanup() {
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('mouseleave', hideOnPointerOut);
      overlay.removeEventListener('touchstart', handleTouch);
      overlay.removeEventListener('touchmove', handleTouch);
      overlay.removeEventListener('touchend', hideOnPointerOut);
    },
    get snapCount() {
      return snapXs.length;
    },
    get currentIndex() {
      return currentIndex;
    },
    get focusedMark() {
      if (currentIndex < 0) return null;
      const x = snapXs[currentIndex];
      const candidates = groups.filter((group) => group.pointsByX.has(x));
      const group =
        candidates.find((candidate) => candidate.key === currentEmphasis) ?? candidates[0];
      const point = group?.pointsByX.get(x);
      return group && point
        ? { markId: point.markId ?? group.markId, datum: point.datum, series: group.seriesKey }
        : null;
    },
    stepTo,
    cycleSeries(delta: number) {
      if (currentIndex < 0) {
        stepTo(0);
        return;
      }
      const snappedX = snapXs[currentIndex];
      const keys = keysAt(snappedX);
      if (keys.length === 0) return;
      const at = currentEmphasis ? keys.indexOf(currentEmphasis) : -1;
      const next = (((at + delta) % keys.length) + keys.length) % keys.length;
      showAt(snappedX, keys[next], containerScale());
    },
    showCurrent() {
      stepTo(currentIndex < 0 ? 0 : currentIndex);
    },
    hide(resetIndex?: boolean) {
      hideAll(resetIndex === true);
    },
  };
}
