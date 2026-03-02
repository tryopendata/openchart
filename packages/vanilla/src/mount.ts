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
  CompileOptions,
  DarkMode,
  MeasureTextFn,
  TextAnnotation,
  ThemeConfig,
  TooltipContent,
  VizSpec,
} from '@opendata-ai/core';
import { compileChart } from '@opendata-ai/engine';
import { exportCSV, exportPNG, exportSVG, type PNGExportOptions } from './export';
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

export interface ExportOptions extends PNGExportOptions {
  // Extensible for future formats
}

export interface ChartInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: VizSpec): void;
  /** Re-compile at current container dimensions. */
  resize(): void;
  /** Export the chart. */
  export(format: 'svg'): string;
  export(format: 'png', options?: ExportOptions): Promise<Blob>;
  export(format: 'csv'): string;
  export(format: 'svg' | 'png' | 'csv', options?: ExportOptions): string | Promise<Blob>;
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
  specAnnotations: import('@opendata-ai/core').Annotation[],
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
  onAnnotationEdit: (annotation: TextAnnotation, updatedOffset: AnnotationOffset) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const annotationElements = svg.querySelectorAll('.viz-annotation-text');
  const cleanups: Array<() => void> = [];

  // Track active document listeners so cleanup can remove them mid-drag
  let activeDocMouseMove: ((e: MouseEvent) => void) | null = null;
  let activeDocMouseUp: ((e: MouseEvent) => void) | null = null;

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

    const handleMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();

      setDragging(true);

      const startMouseX = mouseEvent.clientX;
      const startMouseY = mouseEvent.clientY;
      const origDx = textAnnotation.offset?.dx ?? 0;
      const origDy = textAnnotation.offset?.dy ?? 0;

      // Compute viewBox scale factors for responsive SVG coordinate conversion
      const svgEl = svg as unknown as SVGSVGElement;
      const viewBox = svgEl.viewBox?.baseVal;
      const svgRect = svg.getBoundingClientRect();
      const scaleX = viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1;
      const scaleY = viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1;

      // Stash connector info for real-time updates
      const connectorLine = annotationG.querySelector('line');
      const origX2 = connectorLine ? Number(connectorLine.getAttribute('x2')) : 0;
      const origY2 = connectorLine ? Number(connectorLine.getAttribute('y2')) : 0;

      // For curved connectors, stash path/polygon elements to hide during drag
      const curvedPath = annotationG.querySelector('path');
      const arrowhead = annotationG.querySelector('polygon');
      const hasCurvedConnector = curvedPath !== null;

      annotationG.style.cursor = 'grabbing';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startMouseX) * scaleX;
        const dy = (moveEvent.clientY - startMouseY) * scaleY;

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
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const deltaX = (upEvent.clientX - startMouseX) * scaleX;
        const deltaY = (upEvent.clientY - startMouseY) * scaleY;
        const newOffset: AnnotationOffset = {
          dx: origDx + deltaX,
          dy: origDy + deltaY,
        };

        // Suppress click if drag actually moved (> 3px threshold)
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          annotationG.addEventListener(
            'click',
            (clickE) => {
              clickE.stopPropagation();
            },
            { capture: true, once: true },
          );
        }

        // Clean up visual state
        annotationG.removeAttribute('transform');
        annotationG.style.cursor = 'grab';

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

        // Remove document listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        activeDocMouseMove = null;
        activeDocMouseUp = null;

        // Fire callback (only if drag actually moved)
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          onAnnotationEdit(textAnnotation, newOffset);
        }

        setDragging(false);
      };

      // Attach document-level listeners for drag tracking
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      activeDocMouseMove = handleMouseMove;
      activeDocMouseUp = handleMouseUp;
    };

    annotationG.addEventListener('mousedown', handleMouseDown);
    cleanups.push(() => annotationG.removeEventListener('mousedown', handleMouseDown));
  }

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
  };
}

// ---------------------------------------------------------------------------
// Legend interactivity
// ---------------------------------------------------------------------------

/**
 * Wire click handlers on legend entries to toggle series visibility.
 * Optionally calls onLegendToggle when a series is toggled.
 * Returns a cleanup function.
 */
function wireLegendInteraction(
  svg: SVGElement,
  _layout: ChartLayout,
  onLegendToggle?: (series: string, visible: boolean) => void,
): () => void {
  const legendEntries = svg.querySelectorAll('[data-legend-index]');
  const cleanups: Array<() => void> = [];

  // Track which series are hidden
  const hiddenSeries = new Set<string>();

  for (const entry of legendEntries) {
    const handleClick = () => {
      const label = entry.getAttribute('data-legend-label');
      if (!label) return;

      if (hiddenSeries.has(label)) {
        hiddenSeries.delete(label);
        entry.setAttribute('opacity', '1');
        entry.setAttribute('aria-label', `${label}: visible`);
        onLegendToggle?.(label, true);
      } else {
        hiddenSeries.add(label);
        entry.setAttribute('opacity', '0.3');
        entry.setAttribute('aria-label', `${label}: hidden`);
        onLegendToggle?.(label, false);
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
  spec: VizSpec,
  options?: MountOptions,
): ChartInstance {
  let currentSpec = spec;
  let currentLayout: ChartLayout;
  let svgElement: SVGElement | null = null;
  let tooltipManager: TooltipManager | null = null;
  let disconnectResize: (() => void) | null = null;
  let cleanupTooltipEvents: (() => void) | null = null;
  let cleanupKeyboardNav: (() => void) | null = null;
  let cleanupLegend: (() => void) | null = null;
  let cleanupChartEvents: (() => void) | null = null;
  let cleanupAnnotationDrag: (() => void) | null = null;
  let srTable: HTMLTableElement | null = null;
  let destroyed = false;
  let isDragging = false;
  let pendingRender = false;

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

    // Wire keyboard navigation
    cleanupKeyboardNav = wireKeyboardNav(
      svgElement,
      container,
      currentLayout.tooltipDescriptors,
      tooltipManager,
      currentLayout,
    );

    // Wire legend interactivity
    cleanupLegend = wireLegendInteraction(svgElement, currentLayout, options?.onLegendToggle);

    // Wire chart event handlers (mark click/hover/leave, annotation click)
    if (
      options?.onMarkClick ||
      options?.onMarkHover ||
      options?.onMarkLeave ||
      options?.onAnnotationClick
    ) {
      const specAnnotations: import('@opendata-ai/core').Annotation[] =
        'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
          ? currentSpec.annotations
          : [];
      cleanupChartEvents = wireChartEvents(svgElement, currentLayout, specAnnotations, options);
    }

    // Wire annotation drag editing
    if (options?.onAnnotationEdit) {
      const dragAnnotations: Annotation[] =
        'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
          ? currentSpec.annotations
          : [];
      cleanupAnnotationDrag = wireAnnotationDrag(
        svgElement,
        dragAnnotations,
        options.onAnnotationEdit,
        (dragging: boolean) => {
          isDragging = dragging;
          if (!dragging && pendingRender) {
            pendingRender = false;
            render();
          }
        },
      );
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

  function update(newSpec: VizSpec): void {
    if (destroyed) return;
    currentSpec = newSpec;
    render();
  }

  function resize(): void {
    if (destroyed) return;
    render();
  }

  function doExport(format: 'svg'): string;
  function doExport(format: 'png', exportOptions?: ExportOptions): Promise<Blob>;
  function doExport(format: 'csv'): string;
  function doExport(
    format: 'svg' | 'png' | 'csv',
    exportOptions?: ExportOptions,
  ): string | Promise<Blob> {
    if (!svgElement) {
      throw new Error('Chart is not rendered yet');
    }

    switch (format) {
      case 'svg':
        return exportSVG(svgElement);
      case 'png':
        return exportPNG(svgElement, exportOptions);
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

    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
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

  // Set up responsive resize
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
  };
}
