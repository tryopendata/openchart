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
  /** Set highlight values on the color encoding and re-render. Pass null to clear. */
  setHighlight(values: string[] | null): void;
}

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
    if (!colorEnc || 'condition' in colorEnc || colorEnc.type === 'quantitative') return Infinity;
    if (!('field' in colorEnc) || !colorEnc.field) return Infinity;
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
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
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
    const shouldAnimate = isFirstRender && !!currentLayout.animation?.enabled;
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
    if (hasEditingCallbacks(options)) {
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
    if (updateOpts && 'selectedElement' in updateOpts) {
      selectedElement = updateOpts.selectedElement ?? null;
    }
    render();
  }

  function resize(): void {
    if (destroyed) return;
    if (cleanupAnimations) {
      pendingResize = true;
      return;
    }
    render();
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
    setHighlight,
  };
}
