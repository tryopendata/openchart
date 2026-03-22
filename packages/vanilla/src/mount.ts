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
  ElementEdit,
  GraphSpec,
  MeasureTextFn,
  RangeAnnotation,
  RefLineAnnotation,
  TextAnnotation,
  ThemeConfig,
  TooltipContent,
} from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import {
  exportCSV,
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type JPGExportOptions,
  type SVGExportOptions,
} from './export';
import { observeResize } from './resize-observer';
import { renderChartSVG } from './svg-renderer';
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
}

export interface ExportOptions extends JPGExportOptions {
  // Extensible for future formats (extends JPGExportOptions which extends PNGExportOptions)
}

export interface ChartInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: ChartSpec | GraphSpec): void;
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
// measureText via hidden canvas
// ---------------------------------------------------------------------------

function createMeasureText(): MeasureTextFn {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  return (
    text: string,
    fontSize: number,
    fontWeight?: number,
  ): { width: number; height: number } => {
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    if (!ctx) {
      // Fallback: heuristic estimation
      return { width: text.length * fontSize * 0.6, height: fontSize * 1.2 };
    }

    const weight = fontWeight ?? 400;
    ctx.font = `${weight} ${fontSize}px Inter, sans-serif`;
    const metrics = ctx.measureText(text);
    return {
      width: metrics.width,
      height: fontSize * 1.2,
    };
  };
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
// Voronoi overlay tooltip wiring (nearest-point lookup for line/area charts)
// ---------------------------------------------------------------------------

/** A single data point with pixel coordinates, datum, and pre-computed tooltip. */
interface VoronoiPoint {
  x: number;
  y: number;
  datum: Record<string, unknown>;
  tooltip?: TooltipContent;
  color: string;
}

/**
 * Collect all dataPoints from line and area marks for nearest-point lookup.
 */
function collectVoronoiPoints(layout: ChartLayout): VoronoiPoint[] {
  const points: VoronoiPoint[] = [];
  for (const mark of layout.marks) {
    if ((mark.type === 'line' || mark.type === 'area') && mark.dataPoints) {
      const color = mark.type === 'line' ? mark.stroke : mark.fill;
      for (const dp of mark.dataPoints) {
        points.push({ ...dp, color });
      }
    }
  }
  return points;
}

/**
 * Find the nearest VoronoiPoint to a given (x, y) position using linear scan.
 * Returns null if no points exist.
 */
function findNearestPoint(points: VoronoiPoint[], x: number, y: number): VoronoiPoint | null {
  if (points.length === 0) return null;

  let nearest = points[0];
  let minDist = (points[0].x - x) ** 2 + (points[0].y - y) ** 2;

  for (let i = 1; i < points.length; i++) {
    const dist = (points[i].x - x) ** 2 + (points[i].y - y) ** 2;
    if (dist < minDist) {
      minDist = dist;
      nearest = points[i];
    }
  }

  return nearest;
}

/**
 * Wire voronoi overlay tooltip events for line/area charts.
 * Uses a transparent overlay rect with nearest-point lookup instead of
 * per-point event listeners, eliminating DOM bloat.
 * Returns a cleanup function.
 */
function wireVoronoiTooltipEvents(
  svg: SVGElement,
  layout: ChartLayout,
  tooltipManager: TooltipManager,
): () => void {
  const overlay = svg.querySelector('[data-voronoi-overlay]');
  if (!overlay) return () => {};

  const voronoiPoints = collectVoronoiPoints(layout);
  if (voronoiPoints.length === 0) return () => {};

  const cleanups: Array<() => void> = [];

  const handleMouseMove = (e: Event) => {
    const mouseEvent = e as MouseEvent;
    const svgEl = svg as unknown as SVGSVGElement;
    const svgRect = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox?.baseVal;

    // Convert client coordinates to SVG viewBox coordinates
    const scaleX = viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1;
    const scaleY = viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1;
    const svgX = (mouseEvent.clientX - svgRect.left) * scaleX;
    const svgY = (mouseEvent.clientY - svgRect.top) * scaleY;

    const nearest = findNearestPoint(voronoiPoints, svgX, svgY);
    if (!nearest?.tooltip) return;

    // Show tooltip at the mouse position (relative to container, not SVG viewBox)
    const containerX = mouseEvent.clientX - svgRect.left;
    const containerY = mouseEvent.clientY - svgRect.top;
    tooltipManager.show(nearest.tooltip, containerX, containerY);
  };

  const handleMouseLeave = () => {
    tooltipManager.hide();
  };

  // Touch support
  const handleTouchStart = (e: Event) => {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length > 0) {
      const touch = touchEvent.touches[0];
      const svgEl = svg as unknown as SVGSVGElement;
      const svgRect = svgEl.getBoundingClientRect();
      const viewBox = svgEl.viewBox?.baseVal;

      const scaleX = viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1;
      const scaleY = viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1;
      const svgX = (touch.clientX - svgRect.left) * scaleX;
      const svgY = (touch.clientY - svgRect.top) * scaleY;

      const nearest = findNearestPoint(voronoiPoints, svgX, svgY);
      if (!nearest?.tooltip) return;

      const containerX = touch.clientX - svgRect.left;
      const containerY = touch.clientY - svgRect.top;
      tooltipManager.show(nearest.tooltip, containerX, containerY);
    }
  };

  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseleave', handleMouseLeave);
  overlay.addEventListener('touchstart', handleTouchStart);

  cleanups.push(() => {
    overlay.removeEventListener('mousemove', handleMouseMove);
    overlay.removeEventListener('mouseleave', handleMouseLeave);
    overlay.removeEventListener('touchstart', handleTouchStart);
  });

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
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
    const annotationElements = svg.querySelectorAll('.viz-annotation');

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
  const annotationElements = svg.querySelectorAll('.viz-annotation-text');
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
    const connectorLine = annotationG.querySelector('line.viz-annotation-connector');
    const origX2 = connectorLine ? Number(connectorLine.getAttribute('x2')) : 0;
    const origY2 = connectorLine ? Number(connectorLine.getAttribute('y2')) : 0;

    // For curved connectors, stash path/polygon elements to hide during drag
    const curvedPath = annotationG.querySelector('path.viz-annotation-connector');
    const arrowhead = annotationG.querySelector('polygon.viz-annotation-connector');
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
  const annotationGroups = svg.querySelectorAll('.viz-annotation-text');

  for (const el of annotationGroups) {
    const annotationG = el as SVGGElement;
    const indexStr = annotationG.getAttribute('data-annotation-index');
    if (indexStr === null) continue;

    const index = Number(indexStr);
    const specAnnotation = specAnnotations[index];
    if (!specAnnotation || specAnnotation.type !== 'text') continue;

    const textAnnotation = specAnnotation as TextAnnotation;

    // Find connector line or curved connector to determine endpoints
    const connectorLine = annotationG.querySelector('line.viz-annotation-connector');
    const curvedPath = annotationG.querySelector('path.viz-annotation-connector');
    if (!connectorLine && !curvedPath) continue;

    // Determine connector endpoint positions from the connector element
    let fromX: number, fromY: number, toX: number, toY: number;
    if (connectorLine) {
      fromX = Number(connectorLine.getAttribute('x1'));
      fromY = Number(connectorLine.getAttribute('y1'));
      toX = Number(connectorLine.getAttribute('x2'));
      toY = Number(connectorLine.getAttribute('y2'));
    } else {
      // For curved connectors, get positions from the path data
      // The path starts at M x y, so parse the first coordinates
      const pathD = curvedPath!.getAttribute('d') ?? '';
      const mMatch = pathD.match(/M\s*([\d.e+-]+)\s+([\d.e+-]+)/);
      fromX = mMatch ? Number(mMatch[1]) : 0;
      fromY = mMatch ? Number(mMatch[2]) : 0;
      // For curved connectors, the arrow polygon has the target
      const arrowhead = annotationG.querySelector('polygon.viz-annotation-connector');
      const points = arrowhead?.getAttribute('points') ?? '';
      const firstPoint = points.split(' ')[0] ?? '0,0';
      const [px, py] = firstPoint.split(',');
      toX = Number(px);
      toY = Number(py);
    }

    // Create handles dynamically
    const endpoints: Array<{ name: 'from' | 'to'; cx: number; cy: number }> = [
      { name: 'from', cx: fromX, cy: fromY },
      { name: 'to', cx: toX, cy: toY },
    ];

    const createdHandles: SVGCircleElement[] = [];

    for (const ep of endpoints) {
      const handleEl = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
      handleEl.setAttribute('class', 'viz-connector-handle');
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
    '.viz-annotation-range .viz-annotation-label',
    '.viz-annotation-refline .viz-annotation-label',
  ];

  for (const selector of selectors) {
    const labels = svg.querySelectorAll(selector);

    for (const label of labels) {
      const annotationG = label.closest('.viz-annotation') as SVGGElement | null;
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
  const chromeTexts = svg.querySelectorAll('.viz-chrome text[data-chrome-key]');
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
  const legendG = svg.querySelector('.viz-legend') as SVGGElement | null;
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
 * Wire drag on series label elements (.viz-mark-label[data-series]).
 * On drag end, fires onEdit with the series name and offset.
 * Returns a cleanup function.
 */
function wireSeriesLabelDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const labels = svg.querySelectorAll('.viz-mark-label');
  const cleanups: Array<() => void> = [];

  // Read existing label offsets from the spec
  const labelsConfig = 'labels' in spec ? spec.labels : undefined;

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
 * Legend entries for hidden series stay visible but dimmed (opacity 0.3).
 * Returns a cleanup function.
 */
function wireLegendInteraction(
  svg: SVGElement,
  _layout: ChartLayout,
  onLegendToggle?: (series: string, visible: boolean) => void,
  onEdit?: (edit: ElementEdit) => void,
): () => void {
  const legendEntries = svg.querySelectorAll('[data-legend-index]');
  const cleanups: Array<() => void> = [];

  // Track which series are hidden
  const hiddenSeries = new Set<string>();

  for (const entry of legendEntries) {
    // Skip overflow indicator entries ("+N more")
    if (entry.getAttribute('data-legend-overflow') === 'true') continue;

    const handleClick = () => {
      const label = entry.getAttribute('data-legend-label');
      if (!label) return;

      if (hiddenSeries.has(label)) {
        hiddenSeries.delete(label);
        entry.setAttribute('opacity', '1');
        entry.setAttribute('aria-label', `${label}: visible`);
        onLegendToggle?.(label, true);
        onEdit?.({ type: 'legend-toggle', series: label, hidden: false });
      } else {
        hiddenSeries.add(label);
        entry.setAttribute('opacity', '0.3');
        entry.setAttribute('aria-label', `${label}: hidden`);
        onLegendToggle?.(label, false);
        onEdit?.({ type: 'legend-toggle', series: label, hidden: true });
      }

      // Toggle visibility of marks with matching series.
      // Uses the data-series attribute set by the SVG renderer, which works
      // for all mark types (line, area, rect, arc, point).
      const marks = svg.querySelectorAll('.viz-mark');
      for (const mark of marks) {
        const seriesName = mark.getAttribute('data-series');
        if (!seriesName) continue;

        if (hiddenSeries.has(seriesName)) {
          (mark as SVGElement).style.display = 'none';
        } else {
          (mark as SVGElement).style.display = '';
        }
      }
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
      markElements[focusIndex].classList.remove('viz-mark-focused');
      markElements[focusIndex].removeAttribute('aria-selected');
    }

    focusIndex = index;

    if (focusIndex >= 0 && focusIndex < markElements.length) {
      const el = markElements[focusIndex];
      el.classList.add('viz-mark-focused');
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
  table.className = 'viz-sr-only';
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
export function createChart(
  container: HTMLElement,
  spec: ChartSpec | GraphSpec,
  options?: MountOptions,
): ChartInstance {
  let currentSpec: ChartSpec | GraphSpec = spec;
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
  let srTable: HTMLTableElement | null = null;
  let destroyed = false;
  let isDragging = false;
  let pendingRender = false;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  const measureText = createMeasureText();

  function compile(): ChartLayout {
    const { width, height } = getContainerDimensions();
    const darkMode = resolveDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      measureText,
    };

    return compileChart(currentSpec, compileOpts);
  }

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  function render(): void {
    // Defer re-render if a drag is in progress to avoid destroying the dragged element
    if (isDragging) {
      pendingRender = true;
      return;
    }

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
    svgElement = renderChartSVG(currentLayout, container);
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
      editCleanups.push(wireChromeDrag(svgElement, currentSpec, options.onEdit, setDragging));

      // Legend drag
      editCleanups.push(wireLegendDrag(svgElement, currentSpec, options.onEdit, setDragging));

      // Series label drag
      editCleanups.push(wireSeriesLabelDrag(svgElement, currentSpec, options.onEdit, setDragging));

      cleanupEditDrags = () => {
        for (const cleanup of editCleanups) {
          cleanup();
        }
      };
    }

    // Create hidden data table for screen readers
    srTable = createScreenReaderTable(currentLayout, container);

    // Apply container classes for CSS variable scoping and dark mode
    container.classList.add('viz-root');
    const isDark = resolveDarkMode(options?.darkMode);
    if (isDark) {
      container.classList.add('viz-dark');
    } else {
      container.classList.remove('viz-dark');
    }
  }

  function update(newSpec: ChartSpec | GraphSpec): void {
    if (destroyed) return;
    currentSpec = newSpec;
    render();
  }

  function resize(): void {
    if (destroyed) return;
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

    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
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
    container.classList.remove('viz-dark');
    container.classList.remove('viz-root');
  }

  // Initial render
  render();

  // Set up responsive resize with debounce to avoid full SVG rebuild on every frame
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
      }, 100);
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
  };
}
