import type { ChartLayout, TooltipContent } from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import type { TooltipManager } from '../tooltip';

interface SeriesPoint {
  x: number;
  y: number;
  datum: Record<string, unknown>;
  tooltip?: TooltipContent;
}

interface SeriesGroup {
  seriesKey: string;
  color: string;
  pointsByX: Map<number, SeriesPoint>;
}

function snapKey(x: number): number {
  return Math.round(x);
}

function collectSeriesGroups(layout: ChartLayout): SeriesGroup[] {
  // Dedupe by seriesKey: area charts emit BOTH an AreaMark and a derived
  // LineMark per series. Without dedupe, single-series area charts show
  // "line-0" / "area-1" in the tooltip instead of the actual data fields.
  // Prefer the line mark (same logic as endpoint-labels).
  const byKey = new Map<string, SeriesGroup>();
  const markTypeByKey = new Map<string, 'line' | 'area'>();
  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    if ((mark.type === 'line' || mark.type === 'area') && mark.dataPoints?.length) {
      const key = mark.seriesKey ?? '__default__';
      const existingType = markTypeByKey.get(key);
      if (existingType === 'line' && mark.type === 'area') continue;
      const color = mark.type === 'line' ? mark.stroke : getRepresentativeColor(mark.fill);
      const pointsByX = new Map<number, SeriesPoint>();
      for (const dp of mark.dataPoints) {
        pointsByX.set(snapKey(dp.x), { ...dp });
      }
      byKey.set(key, { seriesKey: key, color, pointsByX });
      markTypeByKey.set(key, mark.type);
    }
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
): TooltipContent | null {
  if (hits.length === 0) return null;

  const title = hits[0].point.tooltip?.title;
  const fields: Array<{ label: string; value: string; color?: string }> = [];

  const isMulti = hits.length > 1;
  for (const { group, point } of hits) {
    const tip = point.tooltip;
    if (!tip) continue;
    if (isMulti) {
      const yField =
        tip.fields.find((f) => !f.color && f.label !== title) ??
        tip.fields[tip.fields.length - 1] ??
        null;
      if (!yField) continue;
      fields.push({
        label: group.seriesKey,
        value: yField.value,
        color: group.color,
      });
    } else {
      for (const f of tip.fields) {
        fields.push({ ...f, color: f.color ?? group.color });
      }
    }
  }

  if (fields.length === 0) return null;
  return { title, fields };
}

/**
 * Wire snap-to-x multi-series tooltip events for line/area charts.
 * On mousemove over the chart area we find the nearest x in the union of all
 * series, render one snap dot per series at that x, and show one merged
 * tooltip listing every series' value.
 */
export function wireVoronoiTooltipEvents(
  svg: SVGElement,
  layout: ChartLayout,
  tooltipManager: TooltipManager,
): () => void {
  const overlay = svg.querySelector('[data-voronoi-overlay]');
  if (!overlay) return () => {};

  const groups = collectSeriesGroups(layout);
  if (groups.length === 0) return () => {};

  const snapXs = collectSnapXs(groups);
  if (snapXs.length === 0) return () => {};

  const crosshair = svg.querySelector('[data-crosshair]') as SVGLineElement | null;
  const dotsLayer = svg.querySelector('[data-snap-dots]') as SVGGElement | null;

  const dots: SVGCircleElement[] = [];
  if (dotsLayer) {
    while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
    for (const group of groups) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', layout.theme.colors.background);
      circle.setAttribute('stroke', group.color);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('pointer-events', 'none');
      circle.style.display = 'none';
      dotsLayer.appendChild(circle);
      dots.push(circle);
    }
  }

  const positionAt = (svgX: number, _svgY: number, viewBoxToContainer: number): boolean => {
    const snappedX = findNearestX(snapXs, svgX);
    if (snappedX === null) return false;

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

    const tooltip = buildSliceTooltip(hits);
    if (!tooltip) return false;

    const containerAnchorX = snappedX * viewBoxToContainer;
    const containerAnchorY = anchorCount > 0 ? (anchorY / anchorCount) * viewBoxToContainer : 0;
    tooltipManager.show(tooltip, containerAnchorX, containerAnchorY, {
      placement: 'right',
    });
    return true;
  };

  const toSvgCoords = (clientX: number, clientY: number) => {
    const svgEl = svg as unknown as SVGSVGElement;
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

  const hideAll = () => {
    if (crosshair) crosshair.style.display = 'none';
    for (const dot of dots) dot.style.display = 'none';
    tooltipManager.hide();
  };

  const handleTouch = (e: Event) => {
    const te = e as TouchEvent;
    if (te.touches.length === 0) return;
    const t = te.touches[0];
    const { svgX, svgY, viewBoxToContainer } = toSvgCoords(t.clientX, t.clientY);
    if (te.cancelable) te.preventDefault();
    positionAt(svgX, svgY, viewBoxToContainer);
  };

  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseleave', hideAll);
  overlay.addEventListener('touchstart', handleTouch, { passive: false });
  overlay.addEventListener('touchmove', handleTouch, { passive: false });
  overlay.addEventListener('touchend', hideAll);

  return () => {
    overlay.removeEventListener('mousemove', handleMouseMove);
    overlay.removeEventListener('mouseleave', hideAll);
    overlay.removeEventListener('touchstart', handleTouch);
    overlay.removeEventListener('touchmove', handleTouch);
    overlay.removeEventListener('touchend', hideAll);
  };
}
