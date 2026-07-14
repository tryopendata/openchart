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
  ChartEventHandlers,
  ChartLayout,
  ChartSpec,
  CompileOptions,
  DarkMode,
  DataRow,
  ElementRef,
  GraphSpec,
  LayerSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { isGraphSpec, isLayerSpec } from '@opendata-ai/openchart-core';
import {
  compileChart,
  compileLayer,
  facetMinHeight,
  legendGap,
} from '@opendata-ai/openchart-engine';
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
import {
  buildElementRef,
  createScreenReaderTable,
  findElementByRef,
  getEditableElements,
  getElementText,
  isTextEditable,
  refsEqual,
  renderSelectionOverlay,
  wireAnnotationDrag,
  wireAnnotationLabelDrag,
  wireChartEvents,
  wireChromeDrag,
  wireConnectorEndpointDrag,
  wireKeyboardNav,
  wireLegendDrag,
  wireLegendInteraction,
  wireSeriesLabelDrag,
  wireTooltipEvents,
  wireVoronoiTooltipEvents,
} from './interactions';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
import { createSeriesSearch, type SeriesSearchController } from './series-search';
import { renderChartSVG } from './svg-renderer';
import { createTextEditOverlay } from './text-edit-overlay';
import { stampThemeProperties } from './theme-tokens';
import { createTooltipManager, type TooltipManager } from './tooltip';
import { canTransition, type GeometrySnapshot, runTransition } from './transition';
import { createYouDrawIt, type YouDrawItController } from './you-draw-it';

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
  /** Set highlight values on the color encoding and re-render. Pass null to clear. */
  setHighlight(values: string[] | null): void;
  /**
   * Reset a "you draw it" (`youDrawIt`) drawing: clears the reader's guess and
   * returns to the drawing state. No-op when youDrawIt isn't enabled.
   */
  resetDrawing(): void;
  /**
   * Reveal a "you draw it" drawing programmatically (equivalent to the
   * skip-to-reveal button). No-op when youDrawIt isn't enabled.
   */
  revealDrawing(): void;
}

// ---------------------------------------------------------------------------
// Container sizing
// ---------------------------------------------------------------------------

/**
 * Fallback height when the container doesn't constrain height. For
 * auto-height ChartSpec mounts this is the fixed budget for the
 * visualization itself (padding + axes + plot); chrome, the top legend
 * block, and the metrics bar grow the figure on top of it.
 */
const FALLBACK_HEIGHT = 400;

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Editable element helpers
// ---------------------------------------------------------------------------

const EDITABLE_HOVER_CSS = `
.oc-editable-hover {
  outline: 1.5px solid rgba(79, 70, 229, 0.35);
  outline-offset: 2px;
  border-radius: 2px;
}
`;

function makeEditable(svg: SVGElement): void {
  svg.setAttribute('tabindex', '0');
  svg.style.outline = 'none';

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EDITABLE_HOVER_CSS;
  svg.insertBefore(style, svg.firstChild);
}

function hasEditingCallbacks(opts?: MountOptions): boolean {
  return !!(opts?.onEdit || opts?.onSelect || opts?.onDeselect || opts?.onTextEdit);
}

// ---------------------------------------------------------------------------
// Series search helpers
// ---------------------------------------------------------------------------

/** The authored encoding.color.highlight as an array (empty when unset). */
function authoredHighlight(spec: ChartSpec | LayerSpec | GraphSpec): string[] {
  if (isLayerSpec(spec) || isGraphSpec(spec as unknown as Record<string, unknown>)) return [];
  const colorEnc = (spec as ChartSpec).encoding?.color;
  if (!colorEnc || typeof colorEnc !== 'object' || !('field' in colorEnc)) return [];
  const raw = (colorEnc as { highlight?: string | string[] }).highlight;
  if (raw == null) return [];
  return Array.isArray(raw) ? [...raw] : [raw];
}

/** True when the spec enables the series search input. */
function wantsSeriesSearch(spec: ChartSpec | LayerSpec | GraphSpec): boolean {
  if (isLayerSpec(spec) || isGraphSpec(spec as unknown as Record<string, unknown>)) return false;
  return !!(spec as ChartSpec).seriesSearch;
}

/** True when the spec enables the "you draw it" interactive format. */
function wantsYouDrawIt(spec: ChartSpec | LayerSpec | GraphSpec): boolean {
  if (isLayerSpec(spec) || isGraphSpec(spec as unknown as Record<string, unknown>)) return false;
  return !!(spec as ChartSpec).youDrawIt;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a chart instance from a spec and mount it into a container.
 */
export function createChart<TData extends DataRow = DataRow>(
  container: HTMLElement,
  spec: ChartSpec<TData> | LayerSpec<TData> | GraphSpec,
  options?: MountOptions,
): ChartInstance {
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

  // Auto-height sizing state. `isAutoHeight` latches whether the host
  // constrains the container's height:
  //   null  = unknown — every measurement so far was an all-zero rect
  //           (display:none / detached); keep re-checking each measure.
  //   true  = auto-height — the figure grows with chrome (ChartSpec only).
  //   false = explicit height — fit inside the host's box (today's behavior).
  // The latch matters because the SVG's own style.height gives the container
  // a nonzero rect after the first render, so auto-height cannot be
  // re-derived per measure.
  let isAutoHeight: boolean | null = null;
  let lastRenderedWidth: number | null = null;
  let lastRenderedSvgHeight: number | null = null;

  // Data-update transition state
  let transitionHandle: import('./transition').TransitionHandle | null = null;
  let transitionSnapshot: GeometrySnapshot | null = null;

  // Set when webfonts have loaded and a recompile is owed to reflect final font
  // metrics. The next render() that actually recompiles flips
  // data-oc-fonts-state to 'ready' and clears this. Deferring the flip (rather
  // than setting it right after resize()) keeps the attribute honest when the
  // entrance animation makes resize() defer to pendingResize.
  let fontsReloadPending = false;

  // Selection and text editing state
  let selectedElement: ElementRef | null = options?.selectedElement ?? null;
  let overlayElement: SVGGElement | null = null;
  let isTextEditingActive = false;

  // Runtime legend-toggle state
  const runtimeHiddenSeries = new Set<string>();
  const runtimeShownSeries = new Set<string>();
  let textEditCleanup: (() => void) | null = null;

  // Series search state. The control persists across renders (so focus and
  // chips survive the re-render each selection triggers); the baseline is the
  // authored encoding.color.highlight, captured before setHighlight mutates
  // currentSpec, so clearing the search restores it exactly.
  let seriesSearch: SeriesSearchController | null = null;
  let searchBaseline: string[] = authoredHighlight(currentSpec);
  let editSuppressWarned = false;

  // "You draw it" state. The controller persists across renders so the reader's
  // in-progress guess (and revealed state) survive the re-render each resize
  // triggers; update() re-syncs geometry and re-wires pointer capture.
  let youDrawIt: YouDrawItController | null = null;
  let ydiEditSuppressWarned = false;

  // Apply the root class up front so getComputedStyle can read --oc-font-family
  // before we build the text measurer.
  container.classList.add('oc-root');

  // Resolve the effective font family the way compile() will. compile merges
  // { ...spec.theme, ...options.theme }, so options.theme wins over the
  // spec-level theme; fall back to the container's computed font. Measuring
  // against a different font than compile renders (e.g. a spec that sets
  // theme.fonts.family) desyncs layout metrics and the font-reload watcher.
  function resolveEffectiveFont(): string {
    return (
      options?.theme?.fonts?.family ??
      currentSpec.theme?.fonts?.family ??
      resolveFontFamily(container)
    );
  }
  let fontFamily = resolveEffectiveFont();
  let measureText = createMeasureText(fontFamily);
  let renderGen = 0;

  // ---------------------------------------------------------------------------
  // Compilation
  // ---------------------------------------------------------------------------

  function compileAt(width: number, height: number): ChartLayout {
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
   * Vertical overheads that grow an auto-height figure beyond the
   * FALLBACK_HEIGHT budget: top+bottom chrome (bottom chrome already includes
   * a bottom legend's reservation), the top legend block (height + gap), and
   * the KPI metrics bar. topPad and the axis gap are plot clearance, not
   * chrome — they stay inside the budget.
   *
   * For faceted charts, extra rows beyond what the base budget can fit
   * also contribute: each additional row needs space for the panel itself
   * plus its header and gap.
   */
  function verticalOverheads(layout: ChartLayout, width: number): number {
    // Sum EVERY top legend, not just the primary. A chart can carry a color
    // legend and a size legend; counting one and growing the container by its
    // height alone leaves the other squeezing the plot.
    let topLegendBlock = 0;
    for (const legend of layout.legends ?? [layout.legend]) {
      if (legend.position !== 'top') continue;
      const hasContent =
        legend.type === 'continuous' || legend.type === 'size'
          ? legend.bounds.height > 0
          : 'entries' in legend && legend.entries.length > 0;
      if (hasContent) topLegendBlock += legend.bounds.height + legendGap(width);
    }

    let facetGrowth = 0;
    if (layout.facet) {
      const needed = facetMinHeight(layout.facet.panels.length, layout.facet.columns);
      const budgetForPanels =
        FALLBACK_HEIGHT - layout.chrome.topHeight - layout.chrome.bottomHeight - topLegendBlock;
      if (needed > budgetForPanels) {
        facetGrowth = needed - budgetForPanels;
      }
    }

    return (
      layout.chrome.topHeight +
      layout.chrome.bottomHeight +
      topLegendBlock +
      (layout.metrics?.height ?? 0) +
      facetGrowth
    );
  }

  function compile(): ChartLayout {
    const { width, height } = getContainerDimensions();

    // Auto-height growth applies to ChartSpec mounts only. GraphSpec,
    // LayerSpec, and sparkline mounts keep the fixed-fallback behavior.
    const growsWithChrome =
      isAutoHeight === true &&
      !isLayerSpec(currentSpec) &&
      !isGraphSpec(currentSpec as unknown as Record<string, unknown>) &&
      (currentSpec as ChartSpec).display !== 'sparkline';
    if (!growsWithChrome) {
      return compileAt(width, height);
    }

    // Bounded convergence loop, max 3 compiles. Chrome height depends on
    // width (text wrap), not height — but the engine's chrome-strip guardrail
    // strips chrome when the residual plot is too small, which makes chrome
    // height-dependent at the budget boundary: growing the figure can
    // un-strip chrome, changing the overheads once more. (Height classes are
    // not the issue — they only strip below 200/350px, and growing from 400
    // moves away from those thresholds.) Pass 3 is accepted unconditionally.
    let layout = compileAt(width, height);
    const overheads = verticalOverheads(layout, width);
    if (overheads > 0) {
      layout = compileAt(width, height + overheads);
      const overheads2 = verticalOverheads(layout, width);
      if (overheads2 !== overheads) {
        layout = compileAt(width, height + overheads2);
      }
    }
    return layout;
  }

  function withRuntimeHidden<T extends { hiddenSeries?: string[]; annotations?: Annotation[] }>(
    spec: T,
  ): T {
    if (runtimeHiddenSeries.size === 0 && runtimeShownSeries.size === 0) return spec;
    const userHidden = spec.hiddenSeries ?? [];
    const finalHidden = new Set<string>(userHidden);
    for (const s of runtimeHiddenSeries) finalHidden.add(s);
    for (const s of runtimeShownSeries) finalHidden.delete(s);
    const out: T = { ...spec, hiddenSeries: Array.from(finalHidden) };
    if (finalHidden.size > 0 && spec.annotations) {
      const filtered = spec.annotations.filter((a) => a.type !== 'text');
      out.annotations = filtered.length > 0 ? filtered : undefined;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Legend toggle
  // ---------------------------------------------------------------------------

  function countSeries(spec: ChartSpec | GraphSpec | LayerSpec): number {
    if (isLayerSpec(spec)) return Infinity;
    const enc = (spec as ChartSpec).encoding;
    const colorEnc = enc?.color;
    if (!colorEnc || 'condition' in colorEnc) return Infinity;
    if (!('field' in colorEnc) || !colorEnc.field) return Infinity;
    if (colorEnc.type === 'quantitative') return Infinity;
    const field = colorEnc.field;
    const seen = new Set<string>();
    for (const row of (spec as ChartSpec).data ?? []) {
      seen.add(String((row as Record<string, unknown>)[field]));
    }
    return seen.size;
  }

  function isSeriesHidden(series: string): boolean {
    if (runtimeShownSeries.has(series)) return false;
    if (runtimeHiddenSeries.has(series)) return true;
    const userHidden = (currentSpec as { hiddenSeries?: string[] }).hiddenSeries ?? [];
    return userHidden.includes(series);
  }

  function toggleSeriesVisibility(series: string): boolean {
    const wasHidden = isSeriesHidden(series);
    if (!wasHidden) {
      const total = countSeries(currentSpec);
      if (Number.isFinite(total)) {
        const userHidden = new Set((currentSpec as { hiddenSeries?: string[] }).hiddenSeries ?? []);
        let visibleAfter = 0;
        const seriesField = getColorField(currentSpec);
        if (seriesField) {
          const allSeries = new Set<string>();
          for (const row of (currentSpec as ChartSpec).data ?? []) {
            allSeries.add(String((row as Record<string, unknown>)[seriesField]));
          }
          for (const s of allSeries) {
            if (s === series) continue;
            if (runtimeShownSeries.has(s)) {
              visibleAfter++;
              continue;
            }
            if (runtimeHiddenSeries.has(s)) continue;
            if (!userHidden.has(s)) visibleAfter++;
          }
        }
        if (visibleAfter === 0) return false;
      }
    }
    if (wasHidden) {
      runtimeHiddenSeries.delete(series);
      const userHidden = (currentSpec as { hiddenSeries?: string[] }).hiddenSeries ?? [];
      if (userHidden.includes(series)) runtimeShownSeries.add(series);
    } else {
      runtimeShownSeries.delete(series);
      runtimeHiddenSeries.add(series);
    }
    render();
    return !wasHidden;
  }

  function getColorField(spec: ChartSpec | GraphSpec | LayerSpec): string | undefined {
    if (isLayerSpec(spec)) return undefined;
    const colorEnc = (spec as ChartSpec).encoding?.color;
    if (!colorEnc || 'condition' in colorEnc) return undefined;
    if (!('field' in colorEnc) || !colorEnc.field) return undefined;
    return colorEnc.field;
  }

  // ---------------------------------------------------------------------------
  // Container dimensions
  // ---------------------------------------------------------------------------

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
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
    // Latch auto-height on the first NONZERO measurement: height 0 with a
    // real width means the host doesn't constrain height. An all-zero rect
    // (display:none / detached) stays "unknown" — keep re-checking until the
    // container produces a real measurement.
    if (isAutoHeight === null && (rect.width > 0 || rect.height > 0)) {
      isAutoHeight = rect.height === 0 && rect.width > 0;
    }

    return {
      width: Math.max(rect.width || 600, 100),
      // Latched-auto mounts always compile against the fixed budget: after
      // the first render the container's measured height is just our own
      // SVG, so reading it back would re-pin whatever we rendered last.
      height:
        isAutoHeight === true ? FALLBACK_HEIGHT : Math.max(rect.height || FALLBACK_HEIGHT, 100),
    };
  }

  // ---------------------------------------------------------------------------
  // Selection & text editing
  // ---------------------------------------------------------------------------

  function getSpecAnnotations(): Annotation[] {
    return 'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
      ? currentSpec.annotations
      : [];
  }

  function selectElement(ref: ElementRef): void {
    if (!svgElement) return;

    const target = findElementByRef(svgElement, ref);
    if (!target) return;

    if (selectedElement && !refsEqual(selectedElement, ref)) {
      deselectElement();
    }

    selectedElement = ref;
    overlayElement = renderSelectionOverlay(svgElement, ref, currentLayout);
    options?.onSelect?.(ref);

    (svgElement as SVGSVGElement).focus();
  }

  function deselectElement(): void {
    if (!selectedElement) return;

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

  function enterTextEditing(): void {
    if (!svgElement || !selectedElement || isTextEditingActive) return;

    const specAnnotations = getSpecAnnotations();
    if (!isTextEditable(selectedElement, specAnnotations)) return;

    const currentText = getElementText(selectedElement, currentSpec);
    if (currentText === null) return;

    const target = findElementByRef(svgElement, selectedElement);
    if (!target) return;

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

  function wireSelectionEvents(): () => void {
    if (!svgElement) return () => {};

    const svg = svgElement;
    const cleanups: Array<() => void> = [];

    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as Element;

      if (isTextEditingActive) return;

      const specAnnotations = getSpecAnnotations();
      const ref = buildElementRef(target, specAnnotations);

      if (ref) {
        selectElement(ref);
      } else {
        deselectElement();
      }
    };

    svg.addEventListener('click', handleClick);
    cleanups.push(() => svg.removeEventListener('click', handleClick));

    const handleMouseEnter = (e: Event) => {
      const target = (e.target as Element).closest(
        '[data-annotation-index], [data-chrome-key], .oc-mark-label[data-series], .oc-legend:not(.oc-legend--size), [data-legend-index]',
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

    const handleDblClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as Element;
      const specAnnotations = getSpecAnnotations();
      const ref = buildElementRef(target, specAnnotations);

      if (ref && isTextEditable(ref, specAnnotations)) {
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
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (isTextEditingActive && textEditCleanup) {
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

  // ---------------------------------------------------------------------------
  // Render cycle
  // ---------------------------------------------------------------------------

  function render(): void {
    if (isDragging) {
      pendingRender = true;
      return;
    }

    // Cancel any in-progress data-update transition
    if (transitionHandle) {
      transitionHandle.cancel();
      transitionHandle = null;
    }

    // Cancel any in-progress entrance animations before tearing down
    if (cleanupAnimations) {
      cleanupAnimations();
      cleanupAnimations = null;
    }
    cancelAnimations(svgElement);

    // Clean up previous render
    cleanupTooltipEvents?.();
    cleanupTooltipEvents = null;
    cleanupVoronoiEvents?.();
    cleanupVoronoiEvents = null;
    cleanupKeyboardNav?.();
    cleanupKeyboardNav = null;
    cleanupLegend?.();
    cleanupLegend = null;
    cleanupChartEvents?.();
    cleanupChartEvents = null;
    cleanupAnnotationDrag?.();
    cleanupAnnotationDrag = null;
    cleanupEditDrags?.();
    cleanupEditDrags = null;
    cleanupSelection?.();
    cleanupSelection = null;
    cleanupKeyboardEdit?.();
    cleanupKeyboardEdit = null;
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
    // Recorded for the ResizeObserver's self-induced-resize guard.
    lastRenderedWidth = currentLayout.dimensions.width;
    lastRenderedSvgHeight = currentLayout.dimensions.height;
    const shouldAnimate = isFirstRender && !!currentLayout.animation?.enter;
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

    // Wire keyboard navigation. Skipped when the author hid the chart from
    // assistive technology (a11y.hidden): a hidden chart must not be a tab stop.
    if (!currentLayout.a11y.hidden) {
      cleanupKeyboardNav = wireKeyboardNav(
        svgElement,
        container,
        currentLayout.tooltipDescriptors,
        tooltipManager,
        currentLayout,
      );
    }

    // seriesSearch and edit mode are mutually exclusive per instance: when
    // the spec enables seriesSearch, edit interactions are suppressed
    // (search wins -- the engine already reserved the search band).
    const editSuppressed = wantsSeriesSearch(currentSpec);
    if (
      editSuppressed &&
      !editSuppressWarned &&
      (hasEditingCallbacks(options) || options?.onAnnotationEdit)
    ) {
      editSuppressWarned = true;
      console.warn(
        '[openchart] seriesSearch and edit mode are mutually exclusive; edit interactions are disabled while seriesSearch is enabled.',
      );
    }

    // Wire legend interactivity
    cleanupLegend = wireLegendInteraction(
      svgElement,
      currentLayout,
      toggleSeriesVisibility,
      options?.onLegendToggle,
      editSuppressed ? undefined : options?.onEdit,
    );

    // Wire chart event handlers (mark click/hover/leave, annotation click)
    if (
      options?.onMarkClick ||
      options?.onMarkHover ||
      options?.onMarkLeave ||
      options?.onAnnotationClick
    ) {
      const specAnnotations: Annotation[] =
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

    const dragAnnotations: Annotation[] =
      'annotations' in currentSpec && Array.isArray(currentSpec.annotations)
        ? currentSpec.annotations
        : [];

    // Wire annotation drag editing
    if (!editSuppressed && (options?.onAnnotationEdit || options?.onEdit)) {
      cleanupAnnotationDrag = wireAnnotationDrag(
        svgElement,
        dragAnnotations,
        options?.onAnnotationEdit,
        options?.onEdit,
        setDragging,
      );
    }

    // Wire all edit drag handlers when onEdit is provided
    if (!editSuppressed && options?.onEdit) {
      const editCleanups: Array<() => void> = [];

      editCleanups.push(
        wireConnectorEndpointDrag(svgElement, dragAnnotations, options.onEdit, setDragging),
      );
      editCleanups.push(
        wireAnnotationLabelDrag(svgElement, dragAnnotations, options.onEdit, setDragging),
      );

      const editSpec = currentSpec as ChartSpec | GraphSpec;
      editCleanups.push(wireChromeDrag(svgElement, editSpec, options.onEdit, setDragging));
      editCleanups.push(wireLegendDrag(svgElement, editSpec, options.onEdit, setDragging));
      editCleanups.push(wireSeriesLabelDrag(svgElement, editSpec, options.onEdit, setDragging));

      cleanupEditDrags = () => {
        for (const cleanup of editCleanups) {
          cleanup();
        }
      };
    }

    // Wire selection and keyboard edit events when editing callbacks are provided
    if (!editSuppressed && hasEditingCallbacks(options)) {
      makeEditable(svgElement);
      cleanupSelection = wireSelectionEvents();
      cleanupKeyboardEdit = wireKeyboardEditEvents();

      if (selectedElement) {
        const target = findElementByRef(svgElement, selectedElement);
        if (target) {
          overlayElement = renderSelectionOverlay(svgElement, selectedElement, currentLayout);
        } else {
          selectedElement = null;
          overlayElement = null;
        }
      }
    }

    // Create hidden data table for screen readers (not when the author hid
    // the chart from assistive technology)
    if (!currentLayout.a11y.hidden) {
      srTable = createScreenReaderTable(currentLayout, container);
    }

    // Mount/refresh the series search overlay on its reserved band. Created
    // once and kept across renders so typing focus and chips survive the
    // re-render each selection triggers.
    if (currentLayout.seriesSearch) {
      if (!seriesSearch) {
        seriesSearch = createSeriesSearch({ container, onChange: handleSearchChange });
      }
      seriesSearch.update(currentLayout.seriesSearch, svgElement);
    } else if (seriesSearch) {
      if (wantsSeriesSearch(currentSpec)) {
        // The layout stripped the band (e.g. hidden chrome mode at cramped
        // sizes) but the spec still wants search: keep the control and its
        // chips, just hide it until the band comes back.
        seriesSearch.hide();
      } else {
        seriesSearch.destroy();
        seriesSearch = null;
      }
    }

    // Mount/refresh the "you draw it" overlay. Created once and kept across
    // renders so the reader's in-progress guess survives each resize's
    // re-render. Mutually exclusive with edit mode: when editing callbacks are
    // present, youDrawIt is disabled (warn once) per plans 11/17's rule.
    const ydiEditConflict = wantsYouDrawIt(currentSpec) && hasEditingCallbacks(options);
    if (ydiEditConflict && !ydiEditSuppressWarned) {
      ydiEditSuppressWarned = true;
      console.warn(
        '[openchart] youDrawIt and edit mode are mutually exclusive; youDrawIt is disabled while editing callbacks are provided.',
      );
    }
    if (currentLayout.youDrawIt && !ydiEditConflict) {
      if (!youDrawIt) {
        youDrawIt = createYouDrawIt({ container, onReveal: options?.onReveal });
      }
      youDrawIt.update(currentLayout.youDrawIt, svgElement as SVGSVGElement);
    } else if (youDrawIt) {
      if (wantsYouDrawIt(currentSpec) && !ydiEditConflict) {
        // Layout stripped the config (e.g. empty data at this size) but the
        // spec still wants it: keep the controller (and its guess), just hide.
        youDrawIt.hide();
      } else {
        youDrawIt.destroy();
        youDrawIt = null;
      }
    }

    // Apply container classes for CSS variable scoping and dark mode
    container.classList.add('oc-root');
    const isDark = resolveDarkMode(options?.darkMode);
    if (isDark) {
      container.classList.add('oc-dark');
    } else {
      container.classList.remove('oc-dark');
    }

    // Stamp resolved theme as CSS custom properties on the container
    // so CSS consumers read from the same source of truth as the JS engine.
    stampThemeProperties(container, currentLayout.theme);

    // Set up animation cleanup on first render only
    if (shouldAnimate && svgElement) {
      cleanupAnimations = setupAnimationCleanup(svgElement, () => {
        cleanupAnimations = null;
        if (pendingResize) {
          pendingResize = false;
          resize();
        }
      });
    }
    // Bump the render generation so tests (and consumers) can observe every
    // full recompile, including the post-font-load one.
    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);

    // This render recompiled with the loaded webfonts, so the layout now
    // reflects final font metrics. Publish 'ready' only now (not right after
    // the fonts-ready resize(), which may have deferred to pendingResize while
    // the entrance animation was still running).
    if (fontsReloadPending) {
      fontsReloadPending = false;
      container.dataset.ocFontsState = 'ready';
    }

    if (isFirstRender) {
      isFirstRender = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API methods
  // ---------------------------------------------------------------------------

  function update(newSpec: ChartSpec | GraphSpec, updateOpts?: UpdateOptions): void {
    if (destroyed) return;

    // Capture pre-update state for transition gating
    const prevSpec = currentSpec;
    const prevLayout = currentLayout;
    const entranceWasRunning = cleanupAnimations != null;

    // Snapshot in-flight transition geometry before render() cancels it.
    // This enables retargeting: the next transition starts from the
    // interrupted position instead of snapping to the previous final state.
    if (transitionHandle?.running) {
      transitionSnapshot = transitionHandle.snapshot();
    }

    currentSpec = newSpec;
    // A new spec can change theme.fonts.family; rebuild the measurer so layout
    // measures the font compile will actually render with.
    const nextFont = resolveEffectiveFont();
    if (nextFont !== fontFamily) {
      fontFamily = nextFont;
      measureText = createMeasureText(fontFamily);
    }
    runtimeHiddenSeries.clear();
    runtimeShownSeries.clear();
    // The new spec is the source of truth: re-capture the authored highlight
    // baseline and drop any search selections layered on the previous spec.
    searchBaseline = authoredHighlight(newSpec);
    seriesSearch?.setSelected([]);
    // A new spec re-arms the conflict warnings (youDrawIt/edit and
    // seriesSearch/edit) so a newly-introduced conflict warns once again.
    ydiEditSuppressWarned = false;
    editSuppressWarned = false;
    if (updateOpts && 'selectedElement' in updateOpts) {
      selectedElement = updateOpts.selectedElement ?? null;
    }
    render();

    // After render, check if we can run a smooth transition instead of the
    // instant swap that render() already performed.
    if (
      svgElement &&
      canTransition({
        prevLayout,
        nextLayout: currentLayout,
        prevSpec,
        nextSpec: newSpec,
        isFirstRender: false,
        entranceInFlight: entranceWasRunning,
      })
    ) {
      // Consume snapshot (if any) for retargeting, then clear
      const snapshot = transitionSnapshot;
      transitionSnapshot = null;

      transitionHandle = runTransition({
        svg: svgElement as SVGSVGElement,
        prevLayout,
        nextLayout: currentLayout,
        animation: currentLayout.animation!,
        fromSnapshot: snapshot ?? undefined,
        onComplete: () => {
          transitionHandle = null;
        },
      });
    } else {
      // No transition started; clear any stale snapshot
      transitionSnapshot = null;
    }
  }

  function resize(): void {
    if (destroyed) return;
    if (cleanupAnimations) {
      pendingResize = true;
      return;
    }
    render();
  }

  /**
   * Apply a search selection change: the effective highlight is the authored
   * baseline plus the selected values, so clearing every chip restores the
   * authored highlight exactly. Fires onHighlightChange on every change.
   */
  function handleSearchChange(selected: string[]): void {
    const merged = [...searchBaseline];
    for (const v of selected) {
      if (!merged.includes(v)) merged.push(v);
    }
    setHighlight(merged.length > 0 ? merged : null);
    options?.onHighlightChange?.(merged);
  }

  function setHighlight(values: string[] | null): void {
    if (destroyed) return;
    if (isLayerSpec(currentSpec) || isGraphSpec(currentSpec as unknown as Record<string, unknown>))
      return;
    const spec = currentSpec as ChartSpec;
    const colorEnc = spec.encoding?.color;
    if (!colorEnc || typeof colorEnc !== 'object' || !('field' in colorEnc)) return;
    const current = (colorEnc as { highlight?: string | string[] }).highlight;
    if (!values?.length && !current) return;
    const updatedColor = { ...colorEnc };
    if (values && values.length > 0) {
      updatedColor.highlight = values;
    } else {
      delete updatedColor.highlight;
    }
    currentSpec = {
      ...spec,
      encoding: { ...spec.encoding, color: updatedColor },
    } as ChartSpec;
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

    // Cancel any in-progress data-update transition
    if (transitionHandle) {
      transitionHandle.cancel();
      transitionHandle = null;
    }
    transitionSnapshot = null;

    if (cleanupAnimations) {
      cleanupAnimations();
      cleanupAnimations = null;
      pendingResize = false;
    }
    cancelAnimations(svgElement);

    cleanupTooltipEvents?.();
    cleanupTooltipEvents = null;
    cleanupVoronoiEvents?.();
    cleanupVoronoiEvents = null;
    cleanupKeyboardNav?.();
    cleanupKeyboardNav = null;
    cleanupLegend?.();
    cleanupLegend = null;
    cleanupChartEvents?.();
    cleanupChartEvents = null;
    cleanupAnnotationDrag?.();
    cleanupAnnotationDrag = null;
    cleanupEditDrags?.();
    cleanupEditDrags = null;
    cleanupSelection?.();
    cleanupSelection = null;
    cleanupKeyboardEdit?.();
    cleanupKeyboardEdit = null;
    if (textEditCleanup) {
      textEditCleanup();
      textEditCleanup = null;
      isTextEditingActive = false;
    }
    selectedElement = null;
    overlayElement = null;
    if (seriesSearch) {
      seriesSearch.destroy();
      seriesSearch = null;
    }
    if (youDrawIt) {
      youDrawIt.destroy();
      youDrawIt = null;
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
    container.classList.remove('oc-dark');
    container.classList.remove('oc-root');
  }

  // Initial render
  render();

  // Recompile once after webfonts load. On real devices the primary font
  // (e.g. Inter via display=swap) often swaps in after first paint, changing
  // text metrics; without a re-measure, titles wrap wrong and labels collide.
  // Desktop Chrome has the font cached, so it renders 'ready' immediately.
  const pending = scheduleFontReload(
    fontFamily,
    () => !destroyed,
    () => {
      // Mark the reload owed, then trigger a recompile. render() flips the
      // attribute to 'ready' once it actually recompiles — including the
      // pendingResize replay after the entrance animation finishes.
      fontsReloadPending = true;
      resize();
    },
  );
  container.dataset.ocFontsState = pending ? 'pending' : 'ready';

  // Set up responsive resize
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, (width, height) => {
      // Self-induced-resize guard, scoped to latched-auto mounts: growing
      // the SVG grows the container, which re-fires this observer. A fire
      // whose height matches the SVG we just rendered (and whose width is
      // unchanged) is our own echo — re-rendering on it would loop; the
      // 16ms debounce alone doesn't break the cycle.
      if (isAutoHeight === true) {
        const widthChanged = width !== lastRenderedWidth;
        const selfInducedHeight = height === lastRenderedSvgHeight;
        if (!widthChanged && selfInducedHeight) return;
        if (!selfInducedHeight) {
          // Any other height delta is host-driven: un-latch so the next
          // measure re-derives (and re-latches explicit if the container
          // now reports a height that isn't ours).
          isAutoHeight = null;
        }
        resize();
        return;
      }
      // Explicit-height (and not-yet-latched) mounts keep today's
      // re-render-on-every-fire behavior.
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
    setHighlight,
    resetDrawing(): void {
      if (destroyed) return;
      youDrawIt?.reset();
    },
    revealDrawing(): void {
      if (destroyed) return;
      youDrawIt?.reveal();
    },
  };
}
