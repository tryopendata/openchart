/**
 * Mount API: the main entry point for vanilla JS usage.
 *
 * createChart() takes a container, spec, and options, compiles the chart,
 * renders it as SVG, sets up responsive resizing, tooltip interaction
 * (mouse/touch/keyboard), keyboard navigation between data points,
 * and returns a ChartInstance with update/resize/export/destroy methods.
 */

import type {
  Annotation,
  AnnotationOffset,
  ChartEventHandlers,
  ChartLayout,
  ChartSpec,
  ChromeKey,
  CompileOptions,
  DarkMode,
  DataRow,
  ElementEdit,
  ElementRef,
  GraphSpec,
  LayerSpec,
  RangeAnnotation,
  RefLineAnnotation,
  TextAnnotation,
  ThemeConfig,
  TooltipContent,
} from '@opendata-ai/openchart-core';
import { elementRef, getRepresentativeColor, isLayerSpec } from '@opendata-ai/openchart-core';
import { compileChart, compileLayer } from '@opendata-ai/openchart-engine';
import { cancelAnimations, setupAnimationCleanup } from './animation';
import {
  exportCSV,
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type JPGExportOptions,
  type SVGExportOptions,
} from './export';
import { createMeasureText } from './measure-text';
import { observeResize } from './resize-observer';
import { renderChartSVG } from './svg-renderer';
import { createTextEditOverlay } from './text-edit-overlay';
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MountOptions extends ChartEventHandlers {
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting: "auto" (system pref), "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a data point is clicked. @deprecated Use onMarkClick instead. */
  onDataPointClick?: (data: Record<string, unknown>) => void;
  /** Enable responsive resizing. Defaults to true. */
  responsive?: boolean;
  /** Show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Initial selected element. */
  selectedElement?: ElementRef;
}

export interface UpdateOptions {
  /** Override the selected element after update. When omitted, preserves current selection. */
  selectedElement?: ElementRef;
}

export interface ExportOptions extends JPGExportOptions {
  // Extensible for future formats (extends JPGExportOptions which extends PNGExportOptions)
}

export interface ChartInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: ChartSpec | LayerSpec | GraphSpec, options?: UpdateOptions): void;
  /** Re-compile at current container dimensions. */
  resize(): void;
  /** Export the chart. */
  export(format: 'svg'): string;
  export(format: 'svg-with-fonts', options?: SVGExportOptions): Promise<string>;
  export(format: 'png', options?: ExportOptions): Promise<Blob>;
  export(format: 'jpg', options?: ExportOptions): Promise<Blob>;
  export(format: 'csv'): string;
  export(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg' | 'csv',
    options?: ExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  /** Remove all DOM elements and disconnect observers. */
  destroy(): void;
  /** The current compiled layout (for hooks / debugging). */
  readonly layout: ChartLayout;
  /** Get the currently selected element, or null if none. */
  getSelectedElement(): ElementRef | null;
  /** Programmatically select an element. Silent no-op if element not found. */
  select(ref: ElementRef): void;
  /** Deselect the current element. */
  deselect(): void;
  /** Whether inline text editing is active. */
  readonly isEditing: boolean;
}

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  // "auto": check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tooltip event wiring
// ---------------------------------------------------------------------------

/**
 * Wire tooltip events on mark elements inside an SVG.
 * Returns a cleanup function to remove all listeners.
 */
function wireTooltipEvents(
  svg: SVGElement,
  tooltipDescriptors: Map<string, TooltipContent>,
  tooltipManager: TooltipManager,
): () => void {
  const markElements = svg.querySelectorAll('[data-mark-id]');
  const cleanups: Array<() => void> = [];

  for (const el of markElements) {
    const markId = el.getAttribute('data-mark-id');
    if (!markId) continue;

    const content = tooltipDescriptors.get(markId);
    if (!content) continue;

    // Mouse enter -> show tooltip
    const handleMouseEnter = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const svgRect = svg.getBoundingClientRect();
      const x = mouseEvent.clientX - svgRect.left;
      const y = mouseEvent.clientY - svgRect.top;
      tooltipManager.show(content, x, y);
    };

    // Mouse move -> reposition tooltip
    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const svgRect = svg.getBoundingClientRect();
      const x = mouseEvent.clientX - svgRect.left;
      const y = mouseEvent.clientY - svgRect.top;
      tooltipManager.show(content, x, y);
    };

    // Mouse leave -> hide tooltip
    const handleMouseLeave = () => {
      tooltipManager.hide();
    };

    // Touch: tap to show
    const handleTouchStart = (e: Event) => {
      const touchEvent = e as TouchEvent;
      if (touchEvent.touches.length > 0) {
        const touch = touchEvent.touches[0];
        const svgRect = svg.getBoundingClientRect();
        const x = touch.clientX - svgRect.left;
        const y = touch.clientY - svgRect.top;
        tooltipManager.show(content, x, y);
      }
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('touchstart', handleTouchStart);

    cleanups.push(() => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('touchstart', handleTouchStart);
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Voronoi overlay tooltip wiring (x-snap multi-series lookup for line/area charts)
// ---------------------------------------------------------------------------

interface SeriesPoint {
  x: number;
  y: number;
  datum: Record<string, unknown>;
  tooltip?: TooltipContent;
}

interface SeriesGroup {
  seriesKey: string;
  color: string;
  /**
   * Per-series lookup keyed by the rounded pixel x of each data point.
   * Keys are integers so two series whose pixel x's came from independent
   * scale calls can still match at the snapped x. Replaces an older O(n)
   * `points.find(p => p.x === snappedX)` that broke under float drift.
   */
  pointsByX: Map<number, SeriesPoint>;
}

/** Round a pixel x to the integer used as the lookup key. */
function snapKey(x: number): number {
  return Math.round(x);
}

/**
 * Group line/area dataPoints by series so the tooltip can show all series
 * values at a single snapped x position.
 */
function collectSeriesGroups(layout: ChartLayout): SeriesGroup[] {
  const groups: SeriesGroup[] = [];
  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    if ((mark.type === 'line' || mark.type === 'area') && mark.dataPoints?.length) {
      const color = mark.type === 'line' ? mark.stroke : getRepresentativeColor(mark.fill);
      const pointsByX = new Map<number, SeriesPoint>();
      for (const dp of mark.dataPoints) {
        // Last write wins for identical rounded keys (rare; would only happen
        // on dense temporal scales where two points share a pixel column).
        pointsByX.set(snapKey(dp.x), { ...dp });
      }
      groups.push({
        seriesKey: mark.seriesKey ?? `${mark.type}-${i}`,
        color,
        pointsByX,
      });
    }
  }
  return groups;
}

/** All unique snap-key x positions across all series, sorted ascending. */
function collectSnapXs(groups: SeriesGroup[]): number[] {
  const seen = new Set<number>();
  for (const g of groups) {
    for (const k of g.pointsByX.keys()) seen.add(k);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/** Binary-search the closest x in a sorted array. */
function findNearestX(sortedXs: number[], x: number): number | null {
  if (sortedXs.length === 0) return null;
  let lo = 0;
  let hi = sortedXs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedXs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  // lo is the first index where sortedXs[lo] >= x; check the prior element too.
  const candidate = sortedXs[lo];
  if (lo > 0) {
    const prev = sortedXs[lo - 1];
    if (Math.abs(prev - x) < Math.abs(candidate - x)) return prev;
  }
  return candidate;
}

/**
 * Build one merged tooltip from all series points at the snapped x.
 * The title comes from the first series' tooltip (typically the x-axis label,
 * which is identical across series at a given x). Each series contributes one
 * row whose label is the series name (or its y-axis title for single-series)
 * and whose value is the formatted y-value.
 */
function buildSliceTooltip(
  hits: Array<{ group: SeriesGroup; point: SeriesPoint }>,
): TooltipContent | null {
  if (hits.length === 0) return null;

  // Title: take the first hit's title (x value); same across series at this x.
  const title = hits[0].point.tooltip?.title;
  const fields: Array<{ label: string; value: string; color?: string }> = [];

  // Multi-series: one row per series, label = series name, value = y-value.
  // The per-point tooltip already has fields in [color/series, y, x] order;
  // for multi-series we want a single row per series so we pull the y field.
  const isMulti = hits.length > 1;
  for (const { group, point } of hits) {
    const tip = point.tooltip;
    if (!tip) continue;
    if (isMulti) {
      // Find the y field: in buildFields, when there's a color encoding the
      // first field is the series name and the second is y. Without a color
      // encoding the y field is first. Prefer the y-row (we want a numeric
      // value, not the series name itself).
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
      // Single-series: pass through the per-point fields verbatim.
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
function wireVoronoiTooltipEvents(
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

  // One <circle> per series, hidden until mouse enters. Each circle keeps its
  // series color so multi-series charts read correctly without re-paint flicker.
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

    // Anchor the tooltip at the snapped x in container space so the card
    // sits beside the line. Use the average series y so multi-series tooltips
    // stay vertically centered against the data.
    const containerAnchorX = snappedX * viewBoxToContainer;
    const containerAnchorY = anchorCount > 0 ? (anchorY / anchorCount) * viewBoxToContainer : 0;
    // 'right' centers the tooltip vertically on the anchor; floating-ui's
    // flip() middleware swaps it to 'left' near the right edge so the card
    // never overflows the container.
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
    // Inverse scale to map viewBox units back into container pixels.
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
    // preventDefault keeps a finger drag across the chart from scrolling the
    // page, so the snap-tooltip reads naturally on mobile. Skipped if the
    // listener can't be added as non-passive (older Safari).
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

// ---------------------------------------------------------------------------
// Chart event wiring (click, hover, leave on marks; legend toggle; annotation click)
// ---------------------------------------------------------------------------

/**
 * Build a map from data-mark-id to { datum, series } so event handlers
 * can look up the data row associated with a clicked/hovered mark element.
 */
function buildMarkDataMap(
  layout: ChartLayout,
): Map<string, { datum: Record<string, unknown>; series?: string }> {
  const map = new Map<string, { datum: Record<string, unknown>; series?: string }>();

  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    switch (mark.type) {
      case 'line':
        map.set(`line-${mark.seriesKey ?? i}`, {
          // For line marks, data is an array. Use the first row as representative.
          datum: mark.data[0] ?? {},
          series: mark.seriesKey,
        });
        break;
      case 'area':
        map.set(`area-${mark.seriesKey ?? i}`, {
          datum: mark.data[0] ?? {},
          series: mark.seriesKey,
        });
        break;
      case 'rect':
        map.set(`rect-${i}`, { datum: mark.data });
        break;
      case 'arc':
        map.set(`arc-${i}`, { datum: mark.data });
        break;
      case 'point':
        map.set(`point-${i}`, { datum: mark.data });
        break;
    }
  }

  return map;
}

/**
 * Wire chart event handlers (onMarkClick, onMarkHover, onMarkLeave) to mark
 * elements, onLegendToggle to legend entries, and onAnnotationClick to annotation
 * elements inside an SVG.
 *
 * Returns a cleanup function to remove all listeners.
 */
function wireChartEvents(
  svg: SVGElement,
  layout: ChartLayout,
  specAnnotations: import('@opendata-ai/openchart-core').Annotation[],
  handlers: ChartEventHandlers,
): () => void {
  const cleanups: Array<() => void> = [];
  const markDataMap = buildMarkDataMap(layout);

  // Wire mark click/hover/leave events
  if (handlers.onMarkClick || handlers.onMarkHover || handlers.onMarkLeave) {
    const markElements = svg.querySelectorAll('[data-mark-id]');

    for (const el of markElements) {
      const markId = el.getAttribute('data-mark-id');
      if (!markId) continue;

      const markInfo = markDataMap.get(markId);
      if (!markInfo) continue;

      const series = markInfo.series ?? el.getAttribute('data-series') ?? undefined;

      if (handlers.onMarkClick) {
        const handleClick = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          handlers.onMarkClick!({
            datum: markInfo.datum,
            series,
            position: {
              x: mouseEvent.clientX - svgRect.left,
              y: mouseEvent.clientY - svgRect.top,
            },
            event: mouseEvent,
          });
        };
        el.addEventListener('click', handleClick);
        cleanups.push(() => el.removeEventListener('click', handleClick));
      }

      if (handlers.onMarkHover) {
        const handleEnter = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          handlers.onMarkHover!({
            datum: markInfo.datum,
            series,
            position: {
              x: mouseEvent.clientX - svgRect.left,
              y: mouseEvent.clientY - svgRect.top,
            },
            event: mouseEvent,
          });
        };
        el.addEventListener('mouseenter', handleEnter);
        cleanups.push(() => el.removeEventListener('mouseenter', handleEnter));
      }

      if (handlers.onMarkLeave) {
        const handleLeave = () => {
          handlers.onMarkLeave!();
        };
        el.addEventListener('mouseleave', handleLeave);
        cleanups.push(() => el.removeEventListener('mouseleave', handleLeave));
      }
    }
  }

  // Wire annotation click events
  if (handlers.onAnnotationClick) {
    const annotationElements = svg.querySelectorAll('.oc-annotation');

    for (let i = 0; i < annotationElements.length; i++) {
      const el = annotationElements[i];
      const specAnnotation = specAnnotations[i];
      if (!specAnnotation) continue;

      const handleClick = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        handlers.onAnnotationClick!(specAnnotation, mouseEvent);
      };

      el.addEventListener('click', handleClick);
      cleanups.push(() => el.removeEventListener('click', handleClick));
    }
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Shared drag handler utility
// ---------------------------------------------------------------------------

interface DragConfig {
  element: SVGElement;
  svg: SVGSVGElement;
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number, moved: boolean) => void;
  setDragging: (dragging: boolean) => void;
  threshold?: number; // default: 3
}

/**
 * Reusable drag handler for SVG elements.
 * Handles mouse and touch events, viewBox scaling, threshold detection,
 * click suppression after drag, and cursor state.
 *
 * Returns a cleanup function that removes all listeners.
 */
function createDragHandler(config: DragConfig): () => void {
  const { element, svg, onMove, onEnd, setDragging, threshold = 3 } = config;
  const cleanups: Array<() => void> = [];

  // Track active document listeners so cleanup can remove them mid-drag
  let activeDocMouseMove: ((e: MouseEvent) => void) | null = null;
  let activeDocMouseUp: ((e: MouseEvent) => void) | null = null;
  let activeDocTouchMove: ((e: TouchEvent) => void) | null = null;
  let activeDocTouchEnd: ((e: TouchEvent) => void) | null = null;
  let activeDocTouchCancel: ((e: TouchEvent) => void) | null = null;

  function getScale(): { scaleX: number; scaleY: number } {
    const viewBox = svg.viewBox?.baseVal;
    const svgRect = svg.getBoundingClientRect();
    return {
      scaleX: viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1,
      scaleY: viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1,
    };
  }

  function startDrag(startX: number, startY: number): void {
    setDragging(true);
    const { scaleX, scaleY } = getScale();

    element.style.cursor = 'grabbing';
    // Prevent text selection during drag
    svg.style.userSelect = 'none';

    const handleMove = (clientX: number, clientY: number) => {
      const dx = (clientX - startX) * scaleX;
      const dy = (clientY - startY) * scaleY;
      onMove(dx, dy);
    };

    const cleanupDocListeners = () => {
      if (activeDocMouseMove) {
        document.removeEventListener('mousemove', activeDocMouseMove);
        activeDocMouseMove = null;
      }
      if (activeDocMouseUp) {
        document.removeEventListener('mouseup', activeDocMouseUp);
        activeDocMouseUp = null;
      }
      if (activeDocTouchMove) {
        document.removeEventListener('touchmove', activeDocTouchMove);
        activeDocTouchMove = null;
      }
      if (activeDocTouchEnd) {
        document.removeEventListener('touchend', activeDocTouchEnd);
        activeDocTouchEnd = null;
      }
      if (activeDocTouchCancel) {
        document.removeEventListener('touchcancel', activeDocTouchCancel);
        activeDocTouchCancel = null;
      }
    };

    const handleEnd = (clientX: number, clientY: number) => {
      const dx = (clientX - startX) * scaleX;
      const dy = (clientY - startY) * scaleY;
      const moved = Math.abs(dx) > threshold || Math.abs(dy) > threshold;

      onEnd(dx, dy, moved);

      // Suppress click if drag actually moved
      if (moved) {
        element.addEventListener(
          'click',
          (clickE) => {
            clickE.stopPropagation();
          },
          { capture: true, once: true },
        );
      }

      element.style.cursor = 'grab';
      svg.style.userSelect = '';

      cleanupDocListeners();
      setDragging(false);
    };

    // Mouse listeners
    const onMouseMove = (moveEvent: MouseEvent) => {
      handleMove(moveEvent.clientX, moveEvent.clientY);
    };
    const onMouseUp = (upEvent: MouseEvent) => {
      handleEnd(upEvent.clientX, upEvent.clientY);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    activeDocMouseMove = onMouseMove;
    activeDocMouseUp = onMouseUp;

    // Touch listeners
    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        moveEvent.preventDefault();
        handleMove(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
      }
    };
    const onTouchEnd = (endEvent: TouchEvent) => {
      const touch = endEvent.changedTouches[0];
      if (touch) {
        handleEnd(touch.clientX, touch.clientY);
      } else {
        handleEnd(startX, startY);
      }
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    activeDocTouchMove = onTouchMove;
    activeDocTouchEnd = onTouchEnd;
    activeDocTouchCancel = onTouchEnd;
  }

  // Mouse down handler
  const handleMouseDown = (e: Event) => {
    const mouseEvent = e as MouseEvent;
    mouseEvent.preventDefault();
    startDrag(mouseEvent.clientX, mouseEvent.clientY);
  };

  // Touch start handler
  const handleTouchStart = (e: Event) => {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length === 1) {
      touchEvent.preventDefault();
      startDrag(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
    }
  };

  element.addEventListener('mousedown', handleMouseDown);
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  cleanups.push(() => {
    element.removeEventListener('mousedown', handleMouseDown);
    element.removeEventListener('touchstart', handleTouchStart);
  });

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    // Clean up any active document listeners (mid-drag unmount)
    if (activeDocMouseMove) {
      document.removeEventListener('mousemove', activeDocMouseMove);
      activeDocMouseMove = null;
    }
    if (activeDocMouseUp) {
      document.removeEventListener('mouseup', activeDocMouseUp);
      activeDocMouseUp = null;
    }
    if (activeDocTouchMove) {
      document.removeEventListener('touchmove', activeDocTouchMove);
      activeDocTouchMove = null;
    }
    if (activeDocTouchEnd) {
      document.removeEventListener('touchend', activeDocTouchEnd);
      activeDocTouchEnd = null;
    }
    if (activeDocTouchCancel) {
      document.removeEventListener('touchcancel', activeDocTouchCancel);
      activeDocTouchCancel = null;
    }
    // Restore user-select in case of mid-drag cleanup
    svg.style.userSelect = '';
  };
}

// ---------------------------------------------------------------------------
// Annotation drag editing
// ---------------------------------------------------------------------------

/**
 * Wire drag-to-reposition on text annotation labels.
 * Only activates for text annotations (not range or refline).
 * During drag, applies a CSS transform for real-time visual feedback and
 * counter-adjusts straight connector endpoints so the data-point end stays fixed.
 * On mouseup, fires the callback with the updated offset values.
 *
 * Returns a cleanup function to remove all listeners.
 */
function wireAnnotationDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onAnnotationEdit:
    | ((annotation: TextAnnotation, updatedOffset: AnnotationOffset) => void)
    | undefined,
  onEdit: ((edit: ElementEdit) => void) | undefined,
  setDragging: (dragging: boolean) => void,
): () => void {
  const annotationElements = svg.querySelectorAll('.oc-annotation-text');
  const cleanups: Array<() => void> = [];

  for (const el of annotationElements) {
    const indexStr = el.getAttribute('data-annotation-index');
    if (indexStr === null) continue;

    const index = Number(indexStr);
    const specAnnotation = specAnnotations[index];
    if (!specAnnotation || specAnnotation.type !== 'text') continue;

    const textAnnotation = specAnnotation as TextAnnotation;
    const annotationG = el as SVGGElement;

    // Visual affordance: show grab cursor
    annotationG.style.cursor = 'grab';

    // Stash connector info for real-time updates during drag
    const connectorLine = annotationG.querySelector('line.oc-annotation-connector');
    const origX2 = connectorLine ? Number(connectorLine.getAttribute('x2')) : 0;
    const origY2 = connectorLine ? Number(connectorLine.getAttribute('y2')) : 0;

    // For curved connectors, stash path/polygon elements to hide during drag
    const curvedPath = annotationG.querySelector('path.oc-annotation-connector');
    const arrowhead = annotationG.querySelector('polygon.oc-annotation-connector');
    const hasCurvedConnector = curvedPath !== null;

    const origDx = textAnnotation.offset?.dx ?? 0;
    const origDy = textAnnotation.offset?.dy ?? 0;

    const cleanup = createDragHandler({
      element: annotationG,
      svg: svg as unknown as SVGSVGElement,
      onMove: (dx, dy) => {
        // Move the entire annotation group
        annotationG.setAttribute('transform', `translate(${dx}, ${dy})`);

        // For straight connectors, counter-adjust the data-point end
        if (connectorLine && !hasCurvedConnector) {
          connectorLine.setAttribute('x2', String(origX2 - dx));
          connectorLine.setAttribute('y2', String(origY2 - dy));
        }

        // Hide curved connector elements during drag
        if (hasCurvedConnector) {
          if (curvedPath) curvedPath.setAttribute('display', 'none');
          if (arrowhead) arrowhead.setAttribute('display', 'none');
        }
      },
      onEnd: (dx, dy, moved) => {
        // Clean up visual state
        annotationG.removeAttribute('transform');

        // Restore straight connector to original values
        if (connectorLine && !hasCurvedConnector) {
          connectorLine.setAttribute('x2', String(origX2));
          connectorLine.setAttribute('y2', String(origY2));
        }

        // Restore curved connector elements
        if (hasCurvedConnector) {
          if (curvedPath) curvedPath.removeAttribute('display');
          if (arrowhead) arrowhead.removeAttribute('display');
        }

        if (moved) {
          const newOffset: AnnotationOffset = {
            dx: origDx + dx,
            dy: origDy + dy,
          };
          // Fire legacy callback
          onAnnotationEdit?.(textAnnotation, newOffset);
          // Fire unified edit callback
          onEdit?.({ type: 'annotation', annotation: textAnnotation, offset: newOffset });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Connector endpoint drag
// ---------------------------------------------------------------------------

/**
 * Wire drag on connector endpoint handles for text annotations.
 * Dynamically creates invisible handle circles at connector endpoints
 * so they only exist when editing is active (not in every chart).
 * During drag, updates the handle position and the connector line endpoints.
 * On end, fires onEdit with the accumulated endpoint offset.
 *
 * Shows handles on hover over the parent annotation group.
 * Returns a cleanup function that removes handles and all listeners.
 */
function wireConnectorEndpointDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const cleanups: Array<() => void> = [];
  const annotationGroups = svg.querySelectorAll('.oc-annotation-text');

  for (const el of annotationGroups) {
    const annotationG = el as SVGGElement;
    const indexStr = annotationG.getAttribute('data-annotation-index');
    if (indexStr === null) continue;

    const index = Number(indexStr);
    const specAnnotation = specAnnotations[index];
    if (!specAnnotation || specAnnotation.type !== 'text') continue;

    const textAnnotation = specAnnotation as TextAnnotation;

    // Find connector line or curved connector to determine endpoints
    const connectorLine = annotationG.querySelector('line.oc-annotation-connector');
    const curvedPath = annotationG.querySelector('path.oc-annotation-connector');
    if (!connectorLine && !curvedPath) continue;

    // Determine connector endpoint positions from the connector element
    let fromX: number, fromY: number, toX: number, toY: number;
    if (connectorLine) {
      fromX = Number(connectorLine.getAttribute('x1')) || 0;
      fromY = Number(connectorLine.getAttribute('y1')) || 0;
      toX = Number(connectorLine.getAttribute('x2')) || 0;
      toY = Number(connectorLine.getAttribute('y2')) || 0;
    } else {
      // For curved connectors, get positions from the path data
      // The path starts at M x y, so parse the first coordinates
      const pathD = curvedPath!.getAttribute('d') ?? '';
      const mMatch = pathD.match(/M\s*([\d.e+-]+)\s+([\d.e+-]+)/);
      fromX = mMatch ? Number(mMatch[1]) : 0;
      fromY = mMatch ? Number(mMatch[2]) : 0;
      // For curved connectors, the arrow polygon has the target
      const arrowhead = annotationG.querySelector('polygon.oc-annotation-connector');
      const points = arrowhead?.getAttribute('points') ?? '';
      const firstPoint = points.split(' ')[0] ?? '0,0';
      const [px, py] = firstPoint.split(',');
      toX = Number(px) || 0;
      toY = Number(py) || 0;
    }

    // Create handles dynamically
    const endpoints: Array<{ name: 'from' | 'to'; cx: number; cy: number }> = [
      { name: 'from', cx: fromX, cy: fromY },
      { name: 'to', cx: toX, cy: toY },
    ];

    const createdHandles: SVGCircleElement[] = [];

    for (const ep of endpoints) {
      // Skip endpoints with invalid coordinates to prevent NaN in SVG attributes
      if (!Number.isFinite(ep.cx) || !Number.isFinite(ep.cy)) continue;

      const handleEl = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
      handleEl.setAttribute('class', 'oc-connector-handle');
      handleEl.setAttribute('data-endpoint', ep.name);
      handleEl.setAttribute('cx', String(ep.cx));
      handleEl.setAttribute('cy', String(ep.cy));
      handleEl.setAttribute('r', '4');
      handleEl.setAttribute('opacity', '0');
      handleEl.setAttribute('fill', 'currentColor');
      handleEl.setAttribute('stroke', 'currentColor');
      annotationG.appendChild(handleEl);
      createdHandles.push(handleEl);

      const origCx = ep.cx;
      const origCy = ep.cy;

      // Prevent parent annotation drag from firing
      const stopProp = (e: Event) => {
        e.stopPropagation();
      };
      handleEl.addEventListener('mousedown', stopProp);
      handleEl.addEventListener('touchstart', stopProp);
      cleanups.push(() => {
        handleEl.removeEventListener('mousedown', stopProp);
        handleEl.removeEventListener('touchstart', stopProp);
      });

      const cleanup = createDragHandler({
        element: handleEl,
        svg: svg as unknown as SVGSVGElement,
        onMove: (dx, dy) => {
          handleEl.setAttribute('cx', String(origCx + dx));
          handleEl.setAttribute('cy', String(origCy + dy));

          if (connectorLine) {
            if (ep.name === 'from') {
              connectorLine.setAttribute('x1', String(origCx + dx));
              connectorLine.setAttribute('y1', String(origCy + dy));
            } else {
              connectorLine.setAttribute('x2', String(origCx + dx));
              connectorLine.setAttribute('y2', String(origCy + dy));
            }
          }
        },
        onEnd: (dx, dy, moved) => {
          handleEl.setAttribute('cx', String(origCx));
          handleEl.setAttribute('cy', String(origCy));

          if (connectorLine) {
            if (ep.name === 'from') {
              connectorLine.setAttribute('x1', String(origCx));
              connectorLine.setAttribute('y1', String(origCy));
            } else {
              connectorLine.setAttribute('x2', String(origCx));
              connectorLine.setAttribute('y2', String(origCy));
            }
          }

          if (moved) {
            const existingOffset = textAnnotation.connectorOffset?.[ep.name];
            const origEndDx = existingOffset?.dx ?? 0;
            const origEndDy = existingOffset?.dy ?? 0;
            onEdit({
              type: 'annotation-connector',
              annotation: textAnnotation,
              endpoint: ep.name,
              offset: { dx: origEndDx + dx, dy: origEndDy + dy },
            });
          }
        },
        setDragging,
      });

      cleanups.push(cleanup);
    }

    // Wire hover to show/hide handles
    const showHandles = () => {
      for (const h of createdHandles) {
        h.setAttribute('opacity', '0.6');
      }
    };
    const hideHandles = () => {
      for (const h of createdHandles) {
        h.setAttribute('opacity', '0');
      }
    };

    annotationG.addEventListener('mouseenter', showHandles);
    annotationG.addEventListener('mouseleave', hideHandles);
    cleanups.push(() => {
      annotationG.removeEventListener('mouseenter', showHandles);
      annotationG.removeEventListener('mouseleave', hideHandles);
      // Remove dynamically created handles
      for (const h of createdHandles) {
        h.remove();
      }
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Range/refline annotation label drag
// ---------------------------------------------------------------------------

/**
 * Wire drag on range and refline annotation labels.
 * On drag end, fires onEdit with the label offset.
 * Returns a cleanup function.
 */
function wireAnnotationLabelDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const cleanups: Array<() => void> = [];

  // Target range and refline annotation labels
  const selectors = [
    '.oc-annotation-range .oc-annotation-label',
    '.oc-annotation-refline .oc-annotation-label',
  ];

  for (const selector of selectors) {
    const labels = svg.querySelectorAll(selector);

    for (const label of labels) {
      const annotationG = label.closest('.oc-annotation') as SVGGElement | null;
      if (!annotationG) continue;

      const indexStr = annotationG.getAttribute('data-annotation-index');
      if (indexStr === null) continue;

      const index = Number(indexStr);
      const specAnnotation = specAnnotations[index];
      if (!specAnnotation) continue;

      const labelEl = label as SVGTextElement;
      labelEl.style.cursor = 'grab';

      const isRange = specAnnotation.type === 'range';
      const existingLabelOffset = isRange
        ? (specAnnotation as RangeAnnotation).labelOffset
        : (specAnnotation as RefLineAnnotation).labelOffset;
      const origLabelDx = existingLabelOffset?.dx ?? 0;
      const origLabelDy = existingLabelOffset?.dy ?? 0;

      const cleanup = createDragHandler({
        element: labelEl,
        svg: svg as unknown as SVGSVGElement,
        onMove: (dx, dy) => {
          (labelEl as SVGElement & ElementCSSInlineStyle).style.transform =
            `translate(${dx}px, ${dy}px)`;
        },
        onEnd: (dx, dy, moved) => {
          (labelEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

          if (moved) {
            if (isRange) {
              onEdit({
                type: 'range-label',
                annotation: specAnnotation as RangeAnnotation,
                labelOffset: { dx: origLabelDx + dx, dy: origLabelDy + dy },
              });
            } else {
              onEdit({
                type: 'refline-label',
                annotation: specAnnotation as RefLineAnnotation,
                labelOffset: { dx: origLabelDx + dx, dy: origLabelDy + dy },
              });
            }
          }
        },
        setDragging,
      });

      cleanups.push(cleanup);
    }
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Chrome text drag
// ---------------------------------------------------------------------------

/**
 * Wire drag on chrome text elements (title, subtitle, source, byline, footer).
 * On drag end, fires onEdit with the chrome key, text, and offset.
 * Returns a cleanup function.
 */
function wireChromeDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const chromeTexts = svg.querySelectorAll('.oc-chrome text[data-chrome-key]');
  const cleanups: Array<() => void> = [];

  // Read existing chrome offsets from the spec
  const chromeConfig = 'chrome' in spec ? spec.chrome : undefined;

  for (const el of chromeTexts) {
    const textEl = el as SVGTextElement;
    const key = textEl.getAttribute('data-chrome-key') as ChromeKey;
    if (!key) continue;

    // Read existing offset for this chrome element
    const chromeEntry = chromeConfig?.[key];
    const existingOffset =
      typeof chromeEntry === 'object' && chromeEntry !== null ? chromeEntry.offset : undefined;
    const origChromeDx = existingOffset?.dx ?? 0;
    const origChromeDy = existingOffset?.dy ?? 0;

    textEl.style.cursor = 'grab';

    const cleanup = createDragHandler({
      element: textEl,
      svg: svg as unknown as SVGSVGElement,
      onMove: (dx, dy) => {
        (textEl as SVGElement & ElementCSSInlineStyle).style.transform =
          `translate(${dx}px, ${dy}px)`;
      },
      onEnd: (dx, dy, moved) => {
        (textEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

        if (moved) {
          onEdit({
            type: 'chrome',
            key,
            text: textEl.textContent ?? '',
            offset: { dx: origChromeDx + dx, dy: origChromeDy + dy },
          });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Legend drag
// ---------------------------------------------------------------------------

/**
 * Wire drag on the legend group.
 * Click suppression prevents legend toggle from firing after a drag.
 * On drag end, fires onEdit with the legend offset.
 * Returns a cleanup function.
 */
function wireLegendDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const legendG = svg.querySelector('.oc-legend') as SVGGElement | null;
  if (!legendG) return () => {};

  const cleanups: Array<() => void> = [];

  // Read existing legend offset from the spec
  const legendConfig = 'legend' in spec ? spec.legend : undefined;
  const origLegendDx = legendConfig?.offset?.dx ?? 0;
  const origLegendDy = legendConfig?.offset?.dy ?? 0;

  // Set grab cursor on the legend background, not on entry elements
  legendG.style.cursor = 'grab';

  const cleanup = createDragHandler({
    element: legendG,
    svg: svg as unknown as SVGSVGElement,
    onMove: (dx, dy) => {
      (legendG as SVGElement & ElementCSSInlineStyle).style.transform =
        `translate(${dx}px, ${dy}px)`;
    },
    onEnd: (dx, dy, moved) => {
      (legendG as SVGElement & ElementCSSInlineStyle).style.transform = '';

      if (moved) {
        onEdit({ type: 'legend', offset: { dx: origLegendDx + dx, dy: origLegendDy + dy } });
      }
    },
    setDragging,
  });

  cleanups.push(cleanup);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Series label drag
// ---------------------------------------------------------------------------

/**
 * Wire drag on series label elements (.oc-mark-label[data-series]).
 * On drag end, fires onEdit with the series name and offset.
 * Returns a cleanup function.
 */
function wireSeriesLabelDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const labels = svg.querySelectorAll('.oc-mark-label');
  const cleanups: Array<() => void> = [];

  // Read existing label offsets from the spec (skip boolean shorthand)
  const rawLabels = 'labels' in spec ? spec.labels : undefined;
  const labelsConfig = typeof rawLabels === 'object' ? rawLabels : undefined;

  for (const label of labels) {
    const labelEl = label as SVGTextElement;
    // Check label itself first, then fall back to the parent mark group's data-series
    const series =
      labelEl.getAttribute('data-series') ??
      labelEl.closest('[data-series]')?.getAttribute('data-series');
    if (!series) continue;

    // Read existing offset for this series label
    const existingSeriesOffset = labelsConfig?.offsets?.[series];
    const origSeriesDx = existingSeriesOffset?.dx ?? 0;
    const origSeriesDy = existingSeriesOffset?.dy ?? 0;

    labelEl.style.cursor = 'grab';

    const cleanup = createDragHandler({
      element: labelEl,
      svg: svg as unknown as SVGSVGElement,
      onMove: (dx, dy) => {
        (labelEl as SVGElement & ElementCSSInlineStyle).style.transform =
          `translate(${dx}px, ${dy}px)`;
      },
      onEnd: (dx, dy, moved) => {
        (labelEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

        if (moved) {
          onEdit({
            type: 'series-label',
            series,
            offset: { dx: origSeriesDx + dx, dy: origSeriesDy + dy },
          });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Legend interactivity
// ---------------------------------------------------------------------------

/**
 * Wire click handlers on legend entries to toggle series visibility.
 * Fires onEdit with { type: 'legend-toggle', series, hidden } for each toggle,
 * and optionally calls the legacy onLegendToggle callback.
 *
 * Toggling a series mutates `currentSpec.hiddenSeries` and triggers a full
 * re-render so the engine rebalances the y-scale to the visible series and
 * removes endpoint labels, markers, annotations, and any series-bound chrome
 * for the hidden ones. Hiding marks via CSS doesn't rescale the axis or
 * suppress the per-series UI, which is why a recompile is the correct path.
 *
 * Returns a cleanup function.
 */
function wireLegendInteraction(
  svg: SVGElement,
  _layout: ChartLayout,
  toggleSeries: (series: string) => boolean,
  onLegendToggle?: (series: string, visible: boolean) => void,
  onEdit?: (edit: ElementEdit) => void,
): () => void {
  const legendEntries = svg.querySelectorAll('[data-legend-index]');
  const cleanups: Array<() => void> = [];

  for (const entry of legendEntries) {
    // Skip overflow indicator entries ("+N more")
    if (entry.getAttribute('data-legend-overflow') === 'true') continue;

    const handleClick = () => {
      const label = entry.getAttribute('data-legend-label');
      if (!label) return;

      const nowHidden = toggleSeries(label);
      onLegendToggle?.(label, !nowHidden);
      onEdit?.({ type: 'legend-toggle', series: label, hidden: nowHidden });
      // Visual state on the legend entry itself comes back via the next
      // render's CSS hook (`.oc-legend-entry-hidden`); no DOM mutation here.
    };

    entry.addEventListener('click', handleClick);
    cleanups.push(() => entry.removeEventListener('click', handleClick));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

/**
 * Wire keyboard navigation on the SVG element.
 * Arrow keys move focus between mark elements. Enter/Space shows tooltip.
 * Escape hides tooltip. Returns a cleanup function.
 */
function wireKeyboardNav(
  svg: SVGElement,
  container: HTMLElement,
  tooltipDescriptors: Map<string, TooltipContent>,
  tooltipManager: TooltipManager,
  layout: ChartLayout,
): () => void {
  // Make container focusable
  container.setAttribute('tabindex', '0');
  container.setAttribute('aria-roledescription', 'chart');
  container.setAttribute('aria-label', layout.a11y.altText);

  // Collect navigable mark elements (those with tooltip content)
  const markElements: SVGElement[] = [];
  const allMarkEls = svg.querySelectorAll('[data-mark-id]');
  for (const el of allMarkEls) {
    const markId = el.getAttribute('data-mark-id');
    if (markId && tooltipDescriptors.has(markId)) {
      markElements.push(el as SVGElement);
    }
  }

  let focusIndex = -1;

  function highlightMark(index: number): void {
    // Remove previous highlight
    if (focusIndex >= 0 && focusIndex < markElements.length) {
      markElements[focusIndex].classList.remove('oc-mark-focused');
      markElements[focusIndex].removeAttribute('aria-selected');
    }

    focusIndex = index;

    if (focusIndex >= 0 && focusIndex < markElements.length) {
      const el = markElements[focusIndex];
      el.classList.add('oc-mark-focused');
      el.setAttribute('aria-selected', 'true');
    }
  }

  function showTooltipForFocused(): void {
    if (focusIndex < 0 || focusIndex >= markElements.length) return;

    const el = markElements[focusIndex];
    const markId = el.getAttribute('data-mark-id');
    if (!markId) return;

    const content = tooltipDescriptors.get(markId);
    if (!content) return;

    // Position tooltip near the mark element
    const bbox = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = bbox.left + bbox.width / 2 - containerRect.left;
    const y = bbox.top - containerRect.top;
    tooltipManager.show(content, x, y);
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (markElements.length === 0) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusIndex < markElements.length - 1 ? focusIndex + 1 : 0;
        highlightMark(next);
        showTooltipForFocused();
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusIndex > 0 ? focusIndex - 1 : markElements.length - 1;
        highlightMark(prev);
        showTooltipForFocused();
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (focusIndex >= 0) {
          showTooltipForFocused();
        } else if (markElements.length > 0) {
          highlightMark(0);
          showTooltipForFocused();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        tooltipManager.hide();
        highlightMark(-1);
        break;
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    container.removeAttribute('tabindex');
    container.removeAttribute('aria-roledescription');
    container.removeAttribute('aria-label');
  };
}

// ---------------------------------------------------------------------------
// Hidden data table for screen readers
// ---------------------------------------------------------------------------

/**
 * Create a visually-hidden data table from the chart's a11y fallback data.
 * Returns the table element (append to container) and a cleanup function.
 */
function createScreenReaderTable(
  layout: ChartLayout,
  container: HTMLElement,
): HTMLTableElement | null {
  const data = layout.a11y.dataTableFallback;
  if (!data || data.length === 0) return null;

  const table = document.createElement('table');
  table.className = 'oc-sr-only';
  // Inline critical SR-only styles so the table stays hidden even when the
  // external stylesheet isn't loaded (e.g. CDN / esm.sh usage).
  table.style.position = 'absolute';
  table.style.width = '1px';
  table.style.height = '1px';
  table.style.padding = '0';
  table.style.margin = '-1px';
  table.style.overflow = 'hidden';
  table.style.clipPath = 'inset(50%)';
  table.style.whiteSpace = 'nowrap';
  table.style.borderWidth = '0';
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', `Data table: ${layout.a11y.altText}`);

  // First row is headers
  if (data.length > 0) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = data[0] as unknown[];
    for (const header of headers) {
      const th = document.createElement('th');
      th.textContent = String(header ?? '');
      th.setAttribute('scope', 'col');
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
  }

  // Remaining rows are data
  if (data.length > 1) {
    const tbody = document.createElement('tbody');
    for (let i = 1; i < data.length; i++) {
      const tr = document.createElement('tr');
      const cells = data[i] as unknown[];
      for (const cell of cells) {
        const td = document.createElement('td');
        td.textContent = String(cell ?? '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  container.appendChild(table);
  return table;
}

// ---------------------------------------------------------------------------
// Editable element helpers
// ---------------------------------------------------------------------------

/** CSS for editable hover feedback, injected into the SVG as a <style> element. */
const EDITABLE_HOVER_CSS = `
.oc-editable-hover {
  outline: 1.5px solid rgba(79, 70, 229, 0.35);
  outline-offset: 2px;
  border-radius: 2px;
}
`;

/**
 * Inject editable styles into an SVG element and make it focusable.
 * Called when any editing callback is provided.
 */
function makeEditable(svg: SVGElement): void {
  svg.setAttribute('tabindex', '0');
  svg.style.outline = 'none';

  // Inject hover style into SVG defs
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EDITABLE_HOVER_CSS;
  svg.insertBefore(style, svg.firstChild);
}

/**
 * Check whether any editing-related callback is provided in the options.
 */
function hasEditingCallbacks(opts?: MountOptions): boolean {
  return !!(opts?.onEdit || opts?.onSelect || opts?.onDeselect || opts?.onTextEdit);
}

/**
 * Find a DOM element inside the SVG that matches the given ElementRef.
 */
function findElementByRef(svg: SVGElement, ref: ElementRef): SVGElement | null {
  switch (ref.type) {
    case 'annotation': {
      // Prefer id-based lookup when available
      if (ref.id) {
        const byId = svg.querySelector(`[data-annotation-id="${ref.id}"]`);
        if (byId) return byId as SVGElement;
      }
      return svg.querySelector(`[data-annotation-index="${ref.index}"]`) as SVGElement | null;
    }
    case 'chrome':
      return svg.querySelector(`[data-chrome-key="${ref.key}"]`) as SVGElement | null;
    case 'series-label':
      return svg.querySelector(`.oc-mark-label[data-series="${ref.series}"]`) as SVGElement | null;
    case 'legend':
      return svg.querySelector('.oc-legend') as SVGElement | null;
    case 'legend-entry':
      return svg.querySelector(`[data-legend-index="${ref.index}"]`) as SVGElement | null;
  }
}

/**
 * Build an ElementRef from a DOM element's data attributes.
 * Walks up the tree to find the closest editable ancestor if needed.
 */
function buildElementRef(element: Element, _specAnnotations: Annotation[]): ElementRef | null {
  // Check for annotation
  const annotationEl = element.closest('[data-annotation-index]');
  if (annotationEl) {
    const index = Number(annotationEl.getAttribute('data-annotation-index'));
    const id = annotationEl.getAttribute('data-annotation-id') ?? undefined;
    return elementRef.annotation(index, id);
  }

  // Check for chrome
  const chromeEl = element.closest('[data-chrome-key]');
  if (chromeEl) {
    const key = chromeEl.getAttribute('data-chrome-key') as ChromeKey;
    if (key) return elementRef.chrome(key);
  }

  // Check for series label
  const seriesLabelEl = element.closest('.oc-mark-label[data-series]');
  if (seriesLabelEl) {
    const series = seriesLabelEl.getAttribute('data-series');
    if (series) return elementRef.seriesLabel(series);
  }

  // Check for legend entry
  const legendEntryEl = element.closest('[data-legend-index]');
  if (legendEntryEl) {
    const index = Number(legendEntryEl.getAttribute('data-legend-index'));
    const series = legendEntryEl.getAttribute('data-legend-label') ?? '';
    return elementRef.legendEntry(series, index);
  }

  // Check for legend group
  const legendEl = element.closest('.oc-legend');
  if (legendEl) return elementRef.legend();

  return null;
}

/**
 * Get an ordered list of all editable ElementRefs from the current spec and layout.
 * Order: chrome (title, subtitle, source, byline, footer), annotations by index,
 * series labels alphabetical, legend.
 */
function getEditableElements(
  spec: ChartSpec | LayerSpec | GraphSpec,
  layout: ChartLayout,
): ElementRef[] {
  const refs: ElementRef[] = [];

  // Chrome keys in display order
  const chromeKeys: ChromeKey[] = ['title', 'subtitle', 'source', 'byline', 'footer'];
  for (const key of chromeKeys) {
    if (layout.chrome[key]) {
      refs.push(elementRef.chrome(key));
    }
  }

  // Annotations by index
  const annotations: Annotation[] =
    'annotations' in spec && Array.isArray(spec.annotations) ? spec.annotations : [];
  for (let i = 0; i < annotations.length; i++) {
    refs.push(elementRef.annotation(i, annotations[i].id));
  }

  // Series labels (alphabetical)
  const seriesLabels: string[] = [];
  for (const mark of layout.marks) {
    if (mark.type === 'line' && mark.label?.visible && mark.seriesKey) {
      seriesLabels.push(mark.seriesKey);
    }
  }
  seriesLabels.sort();
  for (const series of seriesLabels) {
    refs.push(elementRef.seriesLabel(series));
  }

  // Legend
  if ('entries' in layout.legend && layout.legend.entries.length > 0) {
    refs.push(elementRef.legend());
  }

  return refs;
}

/**
 * Check if an ElementRef points to a text-editable element (chrome text or text annotation).
 */
function isTextEditable(ref: ElementRef, specAnnotations: Annotation[]): boolean {
  if (ref.type === 'chrome') return true;
  if (ref.type === 'annotation') {
    const annotation = specAnnotations[ref.index];
    return annotation?.type === 'text';
  }
  return false;
}

/**
 * Get the current text content for an element ref.
 */
function getElementText(ref: ElementRef, spec: ChartSpec | LayerSpec | GraphSpec): string | null {
  if (ref.type === 'chrome') {
    const chromeConfig = 'chrome' in spec ? spec.chrome : undefined;
    if (!chromeConfig) return null;
    const entry = chromeConfig[ref.key];
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && entry !== null && 'text' in entry) {
      return (entry as { text: string }).text;
    }
    return null;
  }
  if (ref.type === 'annotation') {
    const annotations: Annotation[] =
      'annotations' in spec && Array.isArray(spec.annotations) ? spec.annotations : [];
    const annotation = annotations[ref.index];
    if (annotation?.type === 'text') return (annotation as TextAnnotation).text ?? null;
    if (annotation?.label) return annotation.label;
    return null;
  }
  return null;
}

/**
 * Compare two ElementRefs for equality.
 */
function refsEqual(a: ElementRef | null, b: ElementRef | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'annotation': {
      const bAnno = b as typeof a;
      if (a.id && bAnno.id) return a.id === bAnno.id;
      return a.index === bAnno.index;
    }
    case 'chrome':
      return a.key === (b as typeof a).key;
    case 'series-label':
      return a.series === (b as typeof a).series;
    case 'legend':
      return true;
    case 'legend-entry': {
      const bEntry = b as typeof a;
      return a.index === bEntry.index && a.series === bEntry.series;
    }
  }
}

/**
 * Render a selection overlay rectangle around a target element.
 * Returns the overlay group element.
 */
function renderSelectionOverlay(
  svg: SVGElement,
  ref: ElementRef,
  layout: ChartLayout,
): SVGGElement | null {
  const target = findElementByRef(svg, ref);
  if (!target) return null;

  const bbox = (target as SVGGraphicsElement).getBBox();
  const padding = 4;

  // Resolve accent color from theme
  const accentColor = layout.theme.colors.categorical?.[0] ?? '#4f46e5';

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'oc-selection-overlay');

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(bbox.x - padding));
  rect.setAttribute('y', String(bbox.y - padding));
  rect.setAttribute('width', String(bbox.width + padding * 2));
  rect.setAttribute('height', String(bbox.height + padding * 2));
  rect.setAttribute('rx', '3');
  rect.setAttribute('fill', 'transparent');
  rect.setAttribute('stroke', accentColor);
  rect.setAttribute('stroke-width', '1.5');
  rect.setAttribute('pointer-events', 'none');

  g.appendChild(rect);
  svg.appendChild(g);

  return g;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a chart instance from a spec and mount it into a container.
 *
 * @param container - The DOM element to render into.
 * @param spec - The visualization spec.
 * @param options - Mount options (theme, darkMode, responsive, etc.).
 * @returns A ChartInstance with update/resize/export/destroy methods.
 */
export function createChart<TData extends DataRow = DataRow>(
  container: HTMLElement,
  spec: ChartSpec<TData> | LayerSpec<TData> | GraphSpec,
  options?: MountOptions,
): ChartInstance {
  // currentSpec uses the non-generic union internally so update() (which is
  // intentionally non-generic) can assign freely. The generic only constrains
  // what consumers can pass at the call site.
  let currentSpec: ChartSpec | LayerSpec | GraphSpec = spec as ChartSpec | LayerSpec | GraphSpec;
  let currentLayout: ChartLayout;
  let svgElement: SVGElement | null = null;
  let tooltipManager: TooltipManager | null = null;
  let disconnectResize: (() => void) | null = null;
  let cleanupTooltipEvents: (() => void) | null = null;
  let cleanupVoronoiEvents: (() => void) | null = null;
  let cleanupKeyboardNav: (() => void) | null = null;
  let cleanupLegend: (() => void) | null = null;
  let cleanupChartEvents: (() => void) | null = null;
  let cleanupAnnotationDrag: (() => void) | null = null;
  let cleanupEditDrags: (() => void) | null = null;
  let cleanupSelection: (() => void) | null = null;
  let cleanupKeyboardEdit: (() => void) | null = null;
  let srTable: HTMLTableElement | null = null;
  let destroyed = false;
  let isDragging = false;
  let pendingRender = false;

  // Animation state
  let isFirstRender = true;
  let cleanupAnimations: (() => void) | null = null;
  let pendingResize = false;

  // Selection and text editing state
  let selectedElement: ElementRef | null = options?.selectedElement ?? null;
  let overlayElement: SVGGElement | null = null;
  let isTextEditingActive = false;

  // Runtime legend-toggle state. The user's spec is the source of truth for
  // initially-hidden series; this set tracks runtime overrides from legend
  // clicks. The two are merged each compile so the engine sees the union.
  const runtimeHiddenSeries = new Set<string>();
  let textEditCleanup: (() => void) | null = null;

  const measureText = createMeasureText();

  function compile(): ChartLayout {
    const { width, height } = getContainerDimensions();
    const darkMode = resolveDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      watermark: options?.watermark,
      measureText,
    };

    if (isLayerSpec(currentSpec)) {
      return compileLayer(withRuntimeHidden(currentSpec as LayerSpec) as LayerSpec, compileOpts);
    }
    return compileChart(withRuntimeHidden(currentSpec) as ChartSpec | GraphSpec, compileOpts);
  }

  /**
   * Merge runtime legend-toggle overrides into the spec for compilation.
   * Returns the spec unchanged when no overrides are active so the common
   * path doesn't allocate.
   *
   * Annotations are suppressed while any series is runtime-hidden. They were
   * authored against the full dataset (their x/y values anchor to specific
   * data points), and a rebalanced y-scale or a hidden anchor series would
   * make them point at the wrong place. Restoring all series restores the
   * authored state, so annotations come back automatically.
   */
  function withRuntimeHidden<T extends { hiddenSeries?: string[]; annotations?: Annotation[] }>(
    spec: T,
  ): T {
    if (runtimeHiddenSeries.size === 0) return spec;
    const userHidden = spec.hiddenSeries ?? [];
    const merged = Array.from(new Set([...userHidden, ...runtimeHiddenSeries]));
    return { ...spec, hiddenSeries: merged, annotations: undefined };
  }

  /**
   * Count the distinct color-encoded series in the user's spec. Used to
   * gate the all-series-off case on toggle.
   */
  function countSeries(spec: ChartSpec | GraphSpec | LayerSpec): number {
    if (isLayerSpec(spec)) return Infinity; // layered specs: don't gate
    const enc = (spec as ChartSpec).encoding;
    const colorEnc = enc?.color;
    if (!colorEnc || 'condition' in colorEnc || colorEnc.type === 'quantitative') return Infinity;
    if (!('field' in colorEnc) || !colorEnc.field) return Infinity;
    const field = colorEnc.field;
    const seen = new Set<string>();
    for (const row of (spec as ChartSpec).data ?? []) {
      seen.add(String((row as Record<string, unknown>)[field]));
    }
    return seen.size;
  }

  /**
   * Toggle a series' visibility from a legend click. Returns true when the
   * series is now hidden (post-toggle), false when visible. Triggers a full
   * re-render so the engine rebalances the y-scale and refreshes endpoint
   * labels, markers, and series-bound annotations.
   *
   * Refuses to hide the last visible series — an empty chart with a dimmed
   * legend is a worse outcome than a no-op click. The legend visual still
   * reflects state from the previous render in that case.
   */
  function toggleSeriesVisibility(series: string): boolean {
    const isCurrentlyHidden = runtimeHiddenSeries.has(series);
    if (!isCurrentlyHidden) {
      const total = countSeries(currentSpec);
      const userHidden = new Set((currentSpec as { hiddenSeries?: string[] }).hiddenSeries ?? []);
      const hiddenCount = new Set([...userHidden, ...runtimeHiddenSeries, series]).size;
      if (hiddenCount >= total) return false; // would hide everything; bail
    }
    let nowHidden: boolean;
    if (isCurrentlyHidden) {
      runtimeHiddenSeries.delete(series);
      nowHidden = false;
    } else {
      runtimeHiddenSeries.add(series);
      nowHidden = true;
    }
    render();
    return nowHidden;
  }

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    // Sparkline mode allows tiny containers (KPI cards, inline strips). Drop
    // the standard floor and, when the wrapper has auto-height (collapsed to 0
    // because we haven't rendered yet), measure the parent that the user sized
    // explicitly. Without this, a <div style={{height: 40}}><Chart/></div>
    // would still render at the fallback height because oc-chart-root has
    // width:100% but no intrinsic height.
    const isSparkline =
      'display' in currentSpec && (currentSpec as ChartSpec).display === 'sparkline';
    if (isSparkline) {
      let width = rect.width;
      let height = rect.height;
      if (!height && container.parentElement) {
        const parentRect = container.parentElement.getBoundingClientRect();
        height = parentRect.height;
        if (!width) width = parentRect.width;
      }
      return {
        width: Math.max(width || 200, 30),
        height: Math.max(height || 40, 20),
      };
    }
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  /** Get the current spec's annotations array. */
  function getSpecAnnotations(): Annotation[] {
    return 'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
      ? currentSpec.annotations
      : [];
  }

  /** Select an element: render overlay, fire onSelect, update state. */
  function selectElement(ref: ElementRef): void {
    if (!svgElement) return;

    // Confirm the target element exists before deselecting the previous one
    const target = findElementByRef(svgElement, ref);
    if (!target) return;

    // Deselect previous if different
    if (selectedElement && !refsEqual(selectedElement, ref)) {
      deselectElement();
    }

    selectedElement = ref;
    overlayElement = renderSelectionOverlay(svgElement, ref, currentLayout);
    options?.onSelect?.(ref);

    // Focus SVG for keyboard events
    (svgElement as SVGSVGElement).focus();
  }

  /** Deselect the current element: remove overlay, fire onDeselect, clear state. */
  function deselectElement(): void {
    if (!selectedElement) return;

    // Cancel text editing if active
    if (isTextEditingActive && textEditCleanup) {
      textEditCleanup();
      textEditCleanup = null;
      isTextEditingActive = false;
    }

    const prev = selectedElement;
    selectedElement = null;

    if (overlayElement?.parentNode) {
      overlayElement.parentNode.removeChild(overlayElement);
    }
    overlayElement = null;

    options?.onDeselect?.(prev);
  }

  /** Enter text editing mode for the currently selected element. */
  function enterTextEditing(): void {
    if (!svgElement || !selectedElement || isTextEditingActive) return;

    const specAnnotations = getSpecAnnotations();
    if (!isTextEditable(selectedElement, specAnnotations)) return;

    const currentText = getElementText(selectedElement, currentSpec);
    if (currentText === null) return;

    // Find the text element within the selected element
    const target = findElementByRef(svgElement, selectedElement);
    if (!target) return;

    // The target might be a group; find the actual text element
    const textEl = target.tagName === 'text' ? target : target.querySelector('text');
    if (!textEl) return;

    isTextEditingActive = true;
    const editRef = selectedElement;

    const overlay = createTextEditOverlay({
      container,
      svg: svgElement as SVGSVGElement,
      targetElement: textEl as SVGElement,
      currentText,
      onCommit: (newText: string) => {
        isTextEditingActive = false;
        textEditCleanup = null;

        if (newText !== currentText) {
          // Fire text edit callbacks
          options?.onTextEdit?.(editRef, currentText, newText);
          options?.onEdit?.({
            type: 'text-edit',
            element: editRef,
            oldText: currentText,
            newText,
          });
        }
      },
      onCancel: () => {
        isTextEditingActive = false;
        textEditCleanup = null;
      },
    });

    textEditCleanup = overlay.destroy;
  }

  /**
   * Wire click-based selection events on the SVG.
   * Uses event delegation for efficiency.
   */
  function wireSelectionEvents(): () => void {
    if (!svgElement) return () => {};

    const svg = svgElement;
    const cleanups: Array<() => void> = [];

    // Click handler for selection
    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as Element;

      // Don't interfere with text editing
      if (isTextEditingActive) return;

      const specAnnotations = getSpecAnnotations();
      const ref = buildElementRef(target, specAnnotations);

      if (ref) {
        // Clicked on an editable element
        selectElement(ref);
      } else {
        // Clicked on empty area / non-editable element, deselect
        deselectElement();
      }
    };

    svg.addEventListener('click', handleClick);
    cleanups.push(() => svg.removeEventListener('click', handleClick));

    // Hover feedback on editable elements
    const handleMouseEnter = (e: Event) => {
      const target = (e.target as Element).closest(
        '[data-annotation-index], [data-chrome-key], .oc-mark-label[data-series], .oc-legend, [data-legend-index]',
      );
      if (target) {
        (target as SVGElement).classList.add('oc-editable-hover');
      }
    };

    const handleMouseLeave = (e: Event) => {
      const target = (e.target as Element).closest('.oc-editable-hover');
      if (target) {
        (target as SVGElement).classList.remove('oc-editable-hover');
      }
    };

    svg.addEventListener('mouseenter', handleMouseEnter, true);
    svg.addEventListener('mouseleave', handleMouseLeave, true);
    cleanups.push(() => {
      svg.removeEventListener('mouseenter', handleMouseEnter, true);
      svg.removeEventListener('mouseleave', handleMouseLeave, true);
    });

    // Double-click to enter text editing
    const handleDblClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as Element;
      const specAnnotations = getSpecAnnotations();
      const ref = buildElementRef(target, specAnnotations);

      if (ref && isTextEditable(ref, specAnnotations)) {
        // Select first if not already selected
        if (!refsEqual(selectedElement, ref)) {
          selectElement(ref);
        }
        enterTextEditing();
      }
    };

    svg.addEventListener('dblclick', handleDblClick);
    cleanups.push(() => svg.removeEventListener('dblclick', handleDblClick));

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  /**
   * Wire keyboard events for edit actions on the SVG.
   * Delete/Backspace -> delete, Escape -> cancel/deselect, Tab -> cycle, Enter -> text edit.
   */
  function wireKeyboardEditEvents(): () => void {
    if (!svgElement) return () => {};

    const svg = svgElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      const specAnnotations = getSpecAnnotations();

      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          if (selectedElement && !isTextEditingActive) {
            e.preventDefault();
            options?.onEdit?.({ type: 'delete', element: selectedElement });
            // Stay selected (consumer decides whether to remove the element)
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (isTextEditingActive && textEditCleanup) {
            // Cancel text editing, remain selected
            textEditCleanup();
            textEditCleanup = null;
            isTextEditingActive = false;
          } else if (selectedElement) {
            deselectElement();
          }
          break;
        }

        case 'ArrowDown':
        case 'ArrowRight': {
          if (!isTextEditingActive && selectedElement) {
            e.preventDefault();
            const editables = getEditableElements(currentSpec, currentLayout);
            if (editables.length === 0) break;

            const currentIndex = editables.findIndex((r) => refsEqual(r, selectedElement));
            const nextIndex = currentIndex >= editables.length - 1 ? 0 : currentIndex + 1;

            selectElement(editables[nextIndex]);
          }
          break;
        }

        case 'ArrowUp':
        case 'ArrowLeft': {
          if (!isTextEditingActive && selectedElement) {
            e.preventDefault();
            const editables = getEditableElements(currentSpec, currentLayout);
            if (editables.length === 0) break;

            const currentIndex = editables.findIndex((r) => refsEqual(r, selectedElement));
            const nextIndex = currentIndex <= 0 ? editables.length - 1 : currentIndex - 1;

            selectElement(editables[nextIndex]);
          }
          break;
        }

        case 'Enter': {
          if (selectedElement && !isTextEditingActive) {
            if (isTextEditable(selectedElement, specAnnotations)) {
              e.preventDefault();
              enterTextEditing();
            }
          }
          break;
        }
      }
    };

    svg.addEventListener('keydown', handleKeyDown);

    return () => {
      svg.removeEventListener('keydown', handleKeyDown);
    };
  }

  function render(): void {
    // Defer re-render if a drag is in progress to avoid destroying the dragged element
    if (isDragging) {
      pendingRender = true;
      return;
    }

    // Cancel any in-progress entrance animations before tearing down
    if (cleanupAnimations) {
      cleanupAnimations();
      cleanupAnimations = null;
    }
    cancelAnimations(svgElement);

    // Clean up previous render
    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
    }
    if (cleanupVoronoiEvents) {
      cleanupVoronoiEvents();
      cleanupVoronoiEvents = null;
    }
    if (cleanupKeyboardNav) {
      cleanupKeyboardNav();
      cleanupKeyboardNav = null;
    }
    if (cleanupLegend) {
      cleanupLegend();
      cleanupLegend = null;
    }
    if (cleanupChartEvents) {
      cleanupChartEvents();
      cleanupChartEvents = null;
    }
    if (cleanupAnnotationDrag) {
      cleanupAnnotationDrag();
      cleanupAnnotationDrag = null;
    }
    if (cleanupEditDrags) {
      cleanupEditDrags();
      cleanupEditDrags = null;
    }
    if (cleanupSelection) {
      cleanupSelection();
      cleanupSelection = null;
    }
    if (cleanupKeyboardEdit) {
      cleanupKeyboardEdit();
      cleanupKeyboardEdit = null;
    }
    if (textEditCleanup) {
      textEditCleanup();
      textEditCleanup = null;
      isTextEditingActive = false;
    }
    overlayElement = null;
    if (svgElement?.parentNode) {
      svgElement.parentNode.removeChild(svgElement);
    }
    if (tooltipManager) {
      tooltipManager.destroy();
    }
    if (srTable?.parentNode) {
      srTable.parentNode.removeChild(srTable);
      srTable = null;
    }

    currentLayout = compile();
    const shouldAnimate = isFirstRender && !!currentLayout.animation?.enabled;
    // Crosshair is resolved by the engine (handles sparkline default-off,
    // user-explicit precedence, breakpoint overrides). Mount just reads it.
    const crosshair = !!currentLayout.crosshair;
    svgElement = renderChartSVG(currentLayout, container, {
      animate: shouldAnimate,
      crosshair,
    });
    tooltipManager = createTooltipManager(container);

    // Wire tooltip events on mark elements
    cleanupTooltipEvents = wireTooltipEvents(
      svgElement,
      currentLayout.tooltipDescriptors,
      tooltipManager,
    );

    // Wire voronoi overlay tooltip events for line/area charts
    cleanupVoronoiEvents = wireVoronoiTooltipEvents(svgElement, currentLayout, tooltipManager);

    // Wire keyboard navigation
    cleanupKeyboardNav = wireKeyboardNav(
      svgElement,
      container,
      currentLayout.tooltipDescriptors,
      tooltipManager,
      currentLayout,
    );

    // Wire legend interactivity
    cleanupLegend = wireLegendInteraction(
      svgElement,
      currentLayout,
      toggleSeriesVisibility,
      options?.onLegendToggle,
      options?.onEdit,
    );

    // Wire chart event handlers (mark click/hover/leave, annotation click)
    if (
      options?.onMarkClick ||
      options?.onMarkHover ||
      options?.onMarkLeave ||
      options?.onAnnotationClick
    ) {
      const specAnnotations: import('@opendata-ai/openchart-core').Annotation[] =
        'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
          ? currentSpec.annotations
          : [];
      cleanupChartEvents = wireChartEvents(svgElement, currentLayout, specAnnotations, options);
    }

    // Shared setDragging callback for all drag handlers
    const setDragging = (dragging: boolean) => {
      isDragging = dragging;
      if (!dragging && pendingRender) {
        pendingRender = false;
        render();
      }
    };

    // Shared annotation list for drag handlers (computed once)
    const dragAnnotations: Annotation[] =
      'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
        ? currentSpec.annotations
        : [];

    // Wire annotation drag editing (activates when onAnnotationEdit or onEdit is provided)
    if (options?.onAnnotationEdit || options?.onEdit) {
      cleanupAnnotationDrag = wireAnnotationDrag(
        svgElement,
        dragAnnotations,
        options?.onAnnotationEdit,
        options?.onEdit,
        setDragging,
      );
    }

    // Wire all edit drag handlers when onEdit is provided
    if (options?.onEdit) {
      const editCleanups: Array<() => void> = [];

      // Connector endpoint drag
      editCleanups.push(
        wireConnectorEndpointDrag(svgElement, dragAnnotations, options.onEdit, setDragging),
      );

      // Range/refline annotation label drag
      editCleanups.push(
        wireAnnotationLabelDrag(svgElement, dragAnnotations, options.onEdit, setDragging),
      );

      // Chrome text drag
      const editSpec = currentSpec as ChartSpec | GraphSpec;
      editCleanups.push(wireChromeDrag(svgElement, editSpec, options.onEdit, setDragging));

      // Legend drag
      editCleanups.push(wireLegendDrag(svgElement, editSpec, options.onEdit, setDragging));

      // Series label drag
      editCleanups.push(wireSeriesLabelDrag(svgElement, editSpec, options.onEdit, setDragging));

      cleanupEditDrags = () => {
        for (const cleanup of editCleanups) {
          cleanup();
        }
      };
    }

    // Wire selection and keyboard edit events when editing callbacks are provided
    if (hasEditingCallbacks(options)) {
      makeEditable(svgElement);
      cleanupSelection = wireSelectionEvents();
      cleanupKeyboardEdit = wireKeyboardEditEvents();

      // Restore selection overlay after re-render
      if (selectedElement) {
        const target = findElementByRef(svgElement, selectedElement);
        if (target) {
          overlayElement = renderSelectionOverlay(svgElement, selectedElement, currentLayout);
        } else {
          // Element no longer exists in DOM, clear selection silently
          selectedElement = null;
          overlayElement = null;
        }
      }
    }

    // Create hidden data table for screen readers
    srTable = createScreenReaderTable(currentLayout, container);

    // Apply container classes for CSS variable scoping and dark mode
    container.classList.add('oc-root');
    const isDark = resolveDarkMode(options?.darkMode);
    if (isDark) {
      container.classList.add('oc-dark');
    } else {
      container.classList.remove('oc-dark');
    }

    // Set up animation cleanup on first render only.
    // onComplete fires when animations finish naturally (not on cancellation/destroy).
    // It nulls out cleanupAnimations so resizes work after the animation window,
    // and replays any resize that was skipped mid-animation.
    if (shouldAnimate && svgElement) {
      cleanupAnimations = setupAnimationCleanup(svgElement, () => {
        cleanupAnimations = null;
        if (pendingResize) {
          pendingResize = false;
          resize();
        }
      });
    }
    if (isFirstRender) {
      isFirstRender = false;
    }
  }

  function update(newSpec: ChartSpec | GraphSpec, updateOpts?: UpdateOptions): void {
    if (destroyed) return;
    currentSpec = newSpec;
    if (updateOpts && 'selectedElement' in updateOpts) {
      selectedElement = updateOpts.selectedElement ?? null;
    }
    render();
  }

  function resize(): void {
    if (destroyed) return;
    // Skip resize during entrance animation. The resize observer fires
    // immediately when the container first enters DOM layout, and re-rendering
    // would destroy the animated SVG. Resizes during this window are queued
    // and replayed once the animation completes via the onComplete callback.
    if (cleanupAnimations) {
      pendingResize = true;
      return;
    }
    render();
  }

  function doExport(format: 'svg'): string;
  function doExport(format: 'svg-with-fonts', exportOptions?: SVGExportOptions): Promise<string>;
  function doExport(format: 'png', exportOptions?: ExportOptions): Promise<Blob>;
  function doExport(format: 'jpg', exportOptions?: ExportOptions): Promise<Blob>;
  function doExport(format: 'csv'): string;
  function doExport(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg' | 'csv',
    exportOptions?: ExportOptions,
  ): string | Promise<Blob> | Promise<string> {
    if (!svgElement) {
      throw new Error('Chart is not rendered yet');
    }

    switch (format) {
      case 'svg':
        return exportSVG(svgElement);
      case 'svg-with-fonts':
        return exportSVGWithFonts(svgElement, exportOptions);
      case 'png':
        return exportPNG(svgElement, exportOptions);
      case 'jpg':
        return exportJPG(svgElement, exportOptions);
      case 'csv':
        return exportCSV(
          'data' in currentSpec && Array.isArray(currentSpec.data) ? currentSpec.data : [],
        );
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    // Cancel entrance animations (cancellation does not fire onComplete)
    if (cleanupAnimations) {
      cleanupAnimations();
      cleanupAnimations = null;
      pendingResize = false;
    }
    cancelAnimations(svgElement);

    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
    }
    if (cleanupVoronoiEvents) {
      cleanupVoronoiEvents();
      cleanupVoronoiEvents = null;
    }
    if (cleanupKeyboardNav) {
      cleanupKeyboardNav();
      cleanupKeyboardNav = null;
    }
    if (cleanupLegend) {
      cleanupLegend();
      cleanupLegend = null;
    }
    if (cleanupChartEvents) {
      cleanupChartEvents();
      cleanupChartEvents = null;
    }
    if (cleanupAnnotationDrag) {
      cleanupAnnotationDrag();
      cleanupAnnotationDrag = null;
    }
    if (cleanupEditDrags) {
      cleanupEditDrags();
      cleanupEditDrags = null;
    }
    if (cleanupSelection) {
      cleanupSelection();
      cleanupSelection = null;
    }
    if (cleanupKeyboardEdit) {
      cleanupKeyboardEdit();
      cleanupKeyboardEdit = null;
    }
    if (textEditCleanup) {
      textEditCleanup();
      textEditCleanup = null;
      isTextEditingActive = false;
    }
    selectedElement = null;
    overlayElement = null;
    if (disconnectResize) {
      disconnectResize();
      disconnectResize = null;
    }
    if (tooltipManager) {
      tooltipManager.destroy();
      tooltipManager = null;
    }
    if (svgElement?.parentNode) {
      svgElement.parentNode.removeChild(svgElement);
      svgElement = null;
    }
    if (srTable?.parentNode) {
      srTable.parentNode.removeChild(srTable);
      srTable = null;
    }
    container.classList.remove('oc-dark');
    container.classList.remove('oc-root');
  }

  // Initial render
  render();

  // Set up responsive resize. The observeResize helper already debounces at
  // ~60fps (16ms) internally, which is sufficient to coalesce a drag-burst
  // into a single render without additive delay.
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => {
      resize();
    });
  }

  return {
    update,
    resize,
    export: doExport,
    destroy,
    get layout() {
      return currentLayout;
    },
    getSelectedElement(): ElementRef | null {
      return selectedElement;
    },
    select(ref: ElementRef): void {
      if (destroyed) return;
      selectElement(ref);
    },
    deselect(): void {
      if (destroyed) return;
      deselectElement();
    },
    get isEditing(): boolean {
      return isTextEditingActive;
    },
  };
}
