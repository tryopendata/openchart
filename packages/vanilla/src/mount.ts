import { annotationSource } from './interactions/edit-transactions';
import { type ReaderHostEvent, registerReaderHost } from './interactions/reader-arbitration';
import { wireRowHover } from './interactions/row-hover';
import { createRenderContext, pageIdScope } from './render-context';
import { canTransitionSpecShape } from './transition/gate';
import { reconcileSVG } from './transition/reconcile';
import { sampleLayout } from './transition/scene';
/**
 * Mount API: the main entry point for vanilla JS usage.
 *
 * createChart() takes a container, spec, and options, compiles the chart,
 * renders it as SVG, sets up responsive resizing, tooltip interaction
 * (mouse/touch/keyboard), keyboard navigation between data points,
 * and returns a ChartInstance with update/resize/export/destroy methods.
 */

import type {
  ChartLayout,
  ChartSpec,
  DataRow,
  ElementRef,
  LayerSpec,
} from '@opendata-ai/openchart-core';
import { isLayerSpec } from '@opendata-ai/openchart-core';
import { resolveLayerTheme } from '@opendata-ai/openchart-engine';
import { cancelAnimations, computeAnimationDuration, setupAnimationCleanup } from './animation';
import { createEditSession } from './chart-editing';
import { createChartExporter } from './chart-export';
import { createChartSizer } from './chart-sizing';
import {
  createHoverEmphasis,
  createScreenReaderTable,
  wireAnchorDrag,
  wireAnnotationDrag,
  wireAnnotationLabelDrag,
  wireChartEvents,
  wireChromeDrag,
  wireConnectorEndpointDrag,
  wireEndpointLabelHover,
  wireKeyboardNav,
  wireLegendDrag,
  wireLegendInteraction,
  wireTooltipEvents,
  wireVoronoiTooltipEvents,
} from './interactions';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import {
  type ChartInstance,
  type MountOptions,
  resolveInteractionMode,
  type UpdateOptions,
} from './mount-types';
import { observeResize } from './resize-observer';
import { resolveDarkMode } from './resolve-dark-mode';
import type { EntranceHandle } from './scatter-canvas/entrance';
import { wireCanvasInteractions } from './scatter-canvas/interactions';
import { createScatterCanvasLayer, type ScatterCanvasLayer } from './scatter-canvas/layer';
import { createSeriesSearch, type SeriesSearchController } from './series-search';
import { createSeriesVisibility } from './series-visibility';
import { renderChartSVG } from './svg-renderer';
import { readWithoutThemeStamp, stampThemeProperties } from './theme-tokens';
import { createTooltipManager, type TooltipManager } from './tooltip';
import { canTransition, runTransition, type TransitionHandle } from './transition';
import { createYouDrawIt, type YouDrawItController } from './you-draw-it';

export {
  type ChartInstance,
  type ExportOptions,
  type InteractionMode,
  type MountOptions,
  resolveInteractionMode,
  type UpdateOptions,
} from './mount-types';

// ---------------------------------------------------------------------------
// Series search helpers
// ---------------------------------------------------------------------------

/** The authored encoding.color.highlight as an array (empty when unset). */
function authoredHighlight(spec: ChartSpec | LayerSpec): string[] {
  if (isLayerSpec(spec)) return [];
  const colorEnc = (spec as ChartSpec).encoding?.color;
  if (!colorEnc || typeof colorEnc !== 'object' || !('field' in colorEnc)) return [];
  const raw = (colorEnc as { highlight?: string | string[] }).highlight;
  if (raw == null) return [];
  return Array.isArray(raw) ? [...raw] : [raw];
}

/** True when the spec enables the series search input. */
function wantsSeriesSearch(spec: ChartSpec | LayerSpec): boolean {
  if (isLayerSpec(spec)) return false;
  return !!(spec as ChartSpec).seriesSearch;
}

/** True when the spec enables the "you draw it" interactive format. */
function wantsYouDrawIt(spec: ChartSpec | LayerSpec): boolean {
  if (isLayerSpec(spec)) return false;
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
  spec: ChartSpec<TData> | LayerSpec<TData>,
  options?: MountOptions,
): ChartInstance {
  let currentSpec: ChartSpec | LayerSpec = spec as ChartSpec | LayerSpec;
  // Resolved once: every selection/edit gate below reads these, never the raw options.
  const interaction = resolveInteractionMode(options);
  const selectable = interaction !== 'read';
  const editing = interaction === 'edit';
  if (options?.interaction === 'edit' && !options.onEdit) {
    console.warn(
      "[openchart] interaction: 'edit' was set without an onEdit handler; edit gestures will run but their transactions have no sink.",
    );
  }
  let currentLayout: ChartLayout;
  let svgElement: SVGElement | null = null;
  let tooltipManager: TooltipManager | null = null;
  let disconnectResize: (() => void) | null = null;
  // Canvas mark layer, present only while currentLayout.markRenderMode is
  // 'canvas'. render() is a full teardown/rebuild, so StrictMode double-mounts
  // and resizes need no canvas-specific handling beyond destroying it here.
  let canvasLayer: ScatterCanvasLayer | null = null;
  let canvasEntrance: EntranceHandle | null = null;
  let warnedCanvasEditMode = false;
  let srTableWrapper: HTMLElement | null = null;
  let destroyed = false;
  let isDragging = false;
  let pendingRender = false;
  let gestureWidth = 0;

  // Animation state
  let isFirstRender = true;
  let cleanupAnimations: (() => void) | null = null;
  let pendingResize = false;

  // Data-update transition state
  let transitionHandle: TransitionHandle | null = null;

  // Set when webfonts have loaded and a recompile is owed to reflect final font
  // metrics. The next render() that actually recompiles flips
  // data-oc-fonts-state to 'ready' and clears this. Deferring the flip (rather
  // than setting it right after resize()) keeps the attribute honest when the
  // entrance animation makes resize() defer to pendingResize.
  let fontsReloadPending = false;

  const sizer = createChartSizer(container);
  const visibility = createSeriesVisibility();

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

  // Use the compiler's primary leaf ownership before the host override so
  // measurement and font readiness agree with the rendered layer theme.
  function resolveEffectiveFont(candidate = currentSpec): string {
    const theme = isLayerSpec(candidate) ? resolveLayerTheme(candidate) : candidate.theme;
    return (
      options?.theme?.fonts?.family ??
      theme?.fonts?.family ??
      readWithoutThemeStamp(container, '--oc-font-family', () => resolveFontFamily(container))
    );
  }
  let fontFamily = resolveEffectiveFont();
  let measureText = createMeasureText(fontFamily);
  let renderGen = 0;
  let fontWatchGeneration = 0;

  // Teardown for everything one render wires up. render() runs it before
  // rebuilding and destroy() runs it on the way out, newest first.
  let readerOwnsNavigation = false;
  let disposeNavigation: (() => void) | undefined;
  let restoreNavigation: (() => void) | undefined;
  const readerListeners = new Set<(event: ReaderHostEvent) => void>();
  const readerEvent = (kind: ReaderHostEvent['kind']) => {
    for (const listener of [...readerListeners]) listener({ kind });
  };
  let unregisterReaderHost: (() => void) | undefined;
  const renderDisposers: Array<() => void> = [];
  function track(dispose: () => void): void {
    renderDisposers.push(dispose);
  }
  function disposeRender(): void {
    for (let dispose = renderDisposers.pop(); dispose; dispose = renderDisposers.pop()) dispose();
  }

  // ---------------------------------------------------------------------------
  // Compilation
  // ---------------------------------------------------------------------------

  function compile(candidate = currentSpec, measure = measureText, runtime = true): ChartLayout {
    return sizer.compile(runtime ? visibility.apply(candidate) : candidate, {
      theme: options?.theme,
      darkMode: resolveDarkMode(options?.darkMode),
      renderer: options?.renderer,
      watermark: options?.watermark,
      measureText: measure,
    });
  }

  function toggleSeriesVisibility(series: string): boolean {
    const hidden = visibility.toggle(currentSpec, series);
    if (hidden === null) return false;
    render();
    return hidden;
  }

  // ---------------------------------------------------------------------------
  // Selection & text editing
  // ---------------------------------------------------------------------------

  const edits = createEditSession({
    container,
    options,
    selectable,
    editing,
    spec: () => currentSpec,
    layout: () => currentLayout,
    svg: () => svgElement,
    destroyed: () => destroyed,
  });

  // ---------------------------------------------------------------------------
  // Render cycle
  // ---------------------------------------------------------------------------

  function render(retainScene = false, prepared?: ChartLayout): void {
    const retainedSVG = retainScene ? svgElement : null;
    if (isDragging) {
      pendingRender = true;
      return;
    }

    const nextLayout = prepared ?? compile();

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
    canvasEntrance?.cancel();
    canvasEntrance = null;
    cancelAnimations(svgElement);

    // Clean up previous render
    disposeRender();
    edits.detach();
    if (!retainedSVG && svgElement?.parentNode) {
      svgElement.parentNode.removeChild(svgElement);
    }
    if (tooltipManager) {
      tooltipManager.destroy();
    }
    if (srTableWrapper?.parentNode) {
      srTableWrapper.parentNode.removeChild(srTableWrapper);
      srTableWrapper = null;
    }

    currentLayout = nextLayout;
    // Recorded for the ResizeObserver's self-induced-resize guard.
    sizer.rendered(currentLayout);
    const shouldAnimate = isFirstRender && !!currentLayout.animation?.enter;
    const crosshair = !!currentLayout.crosshair;

    // Canvas mark mode: the canvas is created BEFORE the SVG so DOM order puts
    // it underneath (both are positioned, so DOM order decides paint order).
    const canvasMode = currentLayout.markRenderMode === 'canvas';
    if (canvasMode) {
      const layer = createScatterCanvasLayer(container, currentLayout);
      canvasLayer = layer;
      renderDisposers.push(() => {
        layer.destroy();
        canvasLayer = null;
      });
      // Compatible updates keep the SVG in place, so appending the new canvas
      // would paint its opaque background over the retained chrome and axes.
      if (retainedSVG) container.insertBefore(canvasLayer.canvas, retainedSVG);
      canvasLayer.repaint();

      // Point marks are pixels on a canvas, not selectable elements, so
      // per-mark edit selection is unavailable. Annotation, chrome, and legend
      // editing still work -- those stay in the SVG. Warned once per mount.
      if (!warnedCanvasEditMode && selectable) {
        warnedCanvasEditMode = true;
        console.warn(
          'openchart: canvas mark mode does not support per-mark edit selection. ' +
            'Annotation, chrome, and legend editing still work. ' +
            "Pass renderer: 'svg' to createChart() if you need to select individual points.",
        );
      }
    }

    const sceneHost = retainedSVG ? document.createElement('div') : container;
    svgElement = renderChartSVG(currentLayout, sceneHost, {
      context: createRenderContext({ ids: pageIdScope }),
      animate: shouldAnimate,
      crosshair,
      canvasMarks: canvasMode,
    });
    if (retainedSVG && svgElement) {
      reconcileSVG(retainedSVG, svgElement);
      svgElement = retainedSVG;
    }
    tooltipManager = createTooltipManager(container);

    // Canvas hit-testing replaces per-element listeners for point marks.
    // wireTooltipEvents below still runs and is simply inert for points --
    // canvas mode emits no [data-mark-id] circles for it to bind to.
    if (canvasMode && canvasLayer) {
      track(
        wireCanvasInteractions({
          layer: canvasLayer,
          svg: svgElement,
          tooltipDescriptors: currentLayout.tooltipDescriptors,
          tooltipManager,
          options,
        }),
      );
    }

    // Shared hover language: mark hover, legend hover and the crosshair all
    // route through this one controller so they cannot contradict each other.
    const hoverEmphasis = createHoverEmphasis(svgElement, currentLayout);
    track(() => hoverEmphasis.destroy());

    const wireNavigation = () => {
      if (!svgElement || !tooltipManager || readerOwnsNavigation || destroyed) return;
      const cleanups: Array<() => void> = [];
      cleanups.push(
        wireTooltipEvents(
          svgElement,
          currentLayout.tooltipDescriptors,
          tooltipManager,
          hoverEmphasis,
        ),
      );
      const crosshairController = wireVoronoiTooltipEvents(
        svgElement,
        currentLayout,
        tooltipManager,
        hoverEmphasis,
      );
      if (crosshairController) cleanups.push(() => crosshairController.cleanup());
      const keyboardEditing = !wantsSeriesSearch(currentSpec) && editing;
      if (!currentLayout.a11y.hidden && !keyboardEditing)
        cleanups.push(
          wireKeyboardNav(
            svgElement,
            container,
            currentLayout.tooltipDescriptors,
            tooltipManager,
            currentLayout,
            { crosshair: crosshairController, onFocus: options?.onMarkFocus },
          ),
        );
      disposeNavigation = () => {
        for (const cleanup of cleanups.splice(0)) cleanup();
        tooltipManager?.hide();
        hoverEmphasis.clear();
        disposeNavigation = undefined;
      };
    };
    restoreNavigation = wireNavigation;
    wireNavigation();
    track(() => {
      disposeNavigation?.();
      restoreNavigation = undefined;
    });
    track(wireEndpointLabelHover(svgElement, hoverEmphasis));

    if (
      options?.rowHover &&
      !editing &&
      !('layer' in currentSpec) &&
      (typeof currentSpec.mark === 'string' ? currentSpec.mark : currentSpec.mark.type) === 'bar' &&
      !currentSpec.encoding.color
    ) {
      track(wireRowHover(svgElement, container, currentLayout));
    }

    // seriesSearch and edit mode are mutually exclusive per instance: when
    // the spec enables seriesSearch, edit interactions are suppressed
    // (search wins -- the engine already reserved the search band).
    const editSuppressed = wantsSeriesSearch(currentSpec);
    if (editSuppressed && !editSuppressWarned && selectable) {
      editSuppressWarned = true;
      console.warn(
        '[openchart] seriesSearch and edit mode are mutually exclusive; edit interactions are disabled while seriesSearch is enabled.',
      );
    }

    const authoredAnnotations = annotationSource(currentSpec);
    for (const el of svgElement.querySelectorAll('[data-annotation-index]')) {
      el.setAttribute(
        'data-annotation-path',
        `${authoredAnnotations.path}/${el.getAttribute('data-annotation-index')}`,
      );
    }

    for (const el of svgElement.querySelectorAll('[data-note-spec-index]')) {
      el.setAttribute(
        'data-note-path',
        `${authoredAnnotations.path}/${el.getAttribute('data-note-spec-index')}`,
      );
    }

    // Wire legend interactivity
    track(
      wireLegendInteraction(
        svgElement,
        currentLayout,
        toggleSeriesVisibility,
        options?.onLegendToggle,
        hoverEmphasis,
      ),
    );

    // Wire chart event handlers (mark click/hover/leave, annotation click)
    if (
      options?.onMarkClick ||
      options?.onMarkHover ||
      options?.onMarkLeave ||
      options?.onAnnotationClick
    ) {
      const specAnnotations = edits.annotations();
      track(wireChartEvents(svgElement, currentLayout, specAnnotations, options));
    }

    // Shared setDragging callback for all drag handlers
    const setDragging = (dragging: boolean) => {
      if (dragging) gestureWidth = sizer.dimensions(currentSpec).width;
      isDragging = dragging;
      if (!dragging && pendingRender) {
        pendingRender = false;
        render();
      }
    };

    const dragAnnotations = edits.annotations();

    // Wire annotation drag editing
    if (!editSuppressed && editing) {
      track(
        wireAnnotationDrag(
          svgElement,
          dragAnnotations,
          edits.emit,
          setDragging,
          currentLayout,
          currentSpec,
        ),
      );
    }

    // Wire all edit drag handlers in edit mode
    if (!editSuppressed && editing) {
      const onEditFn = edits.emit;

      track(
        wireConnectorEndpointDrag(
          svgElement,
          dragAnnotations,
          onEditFn,
          setDragging,
          currentLayout,
          currentSpec,
        ),
      );
      track(wireAnnotationLabelDrag(svgElement, dragAnnotations, onEditFn, setDragging));

      if (currentLayout.xInvert && currentLayout.yInvert) {
        track(wireAnchorDrag(svgElement, dragAnnotations, currentLayout, onEditFn, setDragging));
      }

      const editSpec = currentSpec as ChartSpec;
      track(wireChromeDrag(svgElement, editSpec, onEditFn, setDragging));
      track(wireLegendDrag(svgElement, editSpec, onEditFn, setDragging));
    }

    // Wire selection and keyboard selection/edit events in select and edit modes
    if (!editSuppressed && selectable) {
      edits.attach(svgElement);
    }

    // Create hidden data table for screen readers (not when the author hid
    // the chart from assistive technology)
    if (
      !currentLayout.a11y.hidden &&
      (!('a11y' in currentSpec) || currentSpec.a11y?.table !== false)
    ) {
      srTableWrapper = createScreenReaderTable(currentLayout, container);
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
    // re-render. Mutually exclusive with selection/editing: outside read mode,
    // youDrawIt is disabled (warn once) per plans 11/17's rule.
    const ydiEditConflict = wantsYouDrawIt(currentSpec) && selectable;
    if (ydiEditConflict && !ydiEditSuppressWarned) {
      ydiEditSuppressWarned = true;
      console.warn(
        "[openchart] youDrawIt and edit mode are mutually exclusive; youDrawIt is disabled unless interaction is 'read'.",
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
      // Canvas mode animates points on the canvas scheduler, not via CSS, so
      // the cleanup timer must be told how long that actually takes. The
      // DOM-counting estimate sees no point elements and would fire early.
      let entranceTotalMs: number | undefined;
      if (canvasMode && canvasLayer && currentLayout.animation?.enter) {
        canvasEntrance = canvasLayer.playEntrance(currentLayout.animation.enter);
        if (canvasEntrance) {
          // Take the longer of the two clocks: the SVG side still animates
          // axes, chrome, and annotations on its own schedule.
          entranceTotalMs = Math.max(
            computeAnimationDuration(svgElement),
            canvasEntrance.totalMs + (currentLayout.animation.annotationDelay ?? 0) + 500,
          );
        }
      }

      cleanupAnimations = setupAnimationCleanup(
        svgElement,
        () => {
          cleanupAnimations = null;
          canvasEntrance = null;
          if (pendingResize) {
            pendingResize = false;
            resize();
          }
        },
        entranceTotalMs,
      );
    }
    // Bump the render generation so tests (and consumers) can observe every
    // full recompile, including the post-font-load one.
    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);
    readerEvent('layout');

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

  function update(newSpec: ChartSpec | LayerSpec, updateOpts?: UpdateOptions): void {
    doUpdate(newSpec, updateOpts, false);
  }

  /**
   * Re-render with a new spec and start a MANUAL transition the caller drives via
   * `handle.step(elapsedMs)`. Returns the handle, or null when no transition
   * applies (unchanged shape, first render, etc. — the render already swapped
   * instantly). Used by headless frame capture (GIF export of a spec-swap
   * stepper) to sample the update tween deterministically. No rAF runs.
   */
  function beginManualUpdate(newSpec: ChartSpec | LayerSpec): TransitionHandle | null {
    return doUpdate(newSpec, undefined, true);
  }

  function doUpdate(
    newSpec: ChartSpec | LayerSpec,
    updateOpts: UpdateOptions | undefined,
    manual: boolean,
    layoutOnly = false,
  ): TransitionHandle | null {
    if (destroyed) return null;

    edits.flush();
    if (destroyed) return null;
    // A controlled host may commit the flushed nudge synchronously.
    if (layoutOnly) newSpec = currentSpec;
    if (isDragging) {
      if (layoutOnly && sizer.dimensions(currentSpec).width === gestureWidth) {
        pendingRender = true;
        return null;
      }
      pendingRender = false;
      svgElement?.dispatchEvent(new Event('oc-cancel-drag'));
    }

    // Capture pre-update state for transition gating
    const prevSpec = currentSpec;
    const prevLayout = currentLayout;
    const entranceWasRunning = cleanupAnimations != null;
    const settledAnnotations = edits.takeSettled(prevLayout, layoutOnly);

    const nextFont = resolveEffectiveFont(newSpec);
    const fontChanged = nextFont !== fontFamily;
    const nextMeasure = fontChanged ? createMeasureText(nextFont) : measureText;
    const nextLayout = compile(newSpec, nextMeasure, layoutOnly);
    // Capture only after compilation succeeds, before render() cancels the
    // current motion. A rejected edit must not leave geometry for a later update.
    const snapshot = transitionHandle?.running ? transitionHandle.snapshot() : undefined;
    if (updateOpts && Object.hasOwn(updateOpts, 'revision')) edits.setRevision(updateOpts.revision);
    currentSpec = newSpec;
    fontFamily = nextFont;
    measureText = nextMeasure;
    if (!layoutOnly) {
      visibility.clear();
    }
    // The new spec is the source of truth: re-capture the authored highlight
    // baseline and drop any search selections layered on the previous spec.
    if (!layoutOnly) {
      searchBaseline = authoredHighlight(newSpec);
      seriesSearch?.setSelected([]);
    }
    // A new spec re-arms the conflict warnings (youDrawIt/edit and
    // seriesSearch/edit) so a newly-introduced conflict warns once again.
    ydiEditSuppressWarned = false;
    editSuppressWarned = false;
    if (updateOpts && 'selectedElement' in updateOpts) {
      edits.setSelection(updateOpts.selectedElement);
    }
    render(canTransitionSpecShape(prevSpec, newSpec), nextLayout);
    if (fontChanged) watchCurrentFont();

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
      const handle = runTransition({
        svg: svgElement as SVGSVGElement,
        prevLayout,
        nextLayout: currentLayout,
        animation: currentLayout.animation!,
        fromSnapshot: snapshot,
        settledAnnotations,
        manual,
        // render() above already rebuilt the layer for the NEXT layout, so this
        // is the destination-mode layer the tween writes into.
        canvas: canvasLayer ?? undefined,
        onComplete: () => {
          transitionHandle = null;
        },
      });
      // Keep the sampled scene available to readers for both clocks. Manual
      // callers still own step/cancel; a cancelled handle is ignored by sampling.
      transitionHandle = handle;
      return handle;
    }
    return null;
  }

  function resize(): void {
    if (destroyed) return;
    if (cleanupAnimations) {
      // Canvas mode cancels the entrance and re-renders immediately instead of
      // deferring. The SVG is fluid (`.oc-chart { width: 100% }`) while the
      // canvas is sized in fixed layout pixels, so deferring would leave the
      // two layers visibly out of register for the rest of the entrance.
      if (canvasEntrance) {
        cleanupAnimations();
        cleanupAnimations = null;
        canvasEntrance.cancel();
        canvasEntrance = null;
        render();
        return;
      }
      pendingResize = true;
      return;
    }
    doUpdate(currentSpec as ChartSpec, undefined, false, true);
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
    if (isLayerSpec(currentSpec)) return;
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

  const doExport = createChartExporter(() => ({
    svgElement,
    canvasLayer,
    currentLayout,
    currentSpec,
  }));

  function destroy(): void {
    edits.flush();
    if (destroyed) return;
    destroyed = true;
    readerEvent('destroy');
    unregisterReaderHost?.();
    readerListeners.clear();

    // Cancel any in-progress data-update transition
    if (transitionHandle) {
      transitionHandle.cancel();
      transitionHandle = null;
    }
    if (cleanupAnimations) {
      cleanupAnimations();
      cleanupAnimations = null;
      pendingResize = false;
    }
    cancelAnimations(svgElement);

    // Cancel before destroying the layer, matching render()/resize(). The
    // layer's own destroy() stops the scheduler, so this is not a live timer;
    // what it drops is this closure's reference to the layer state, whose
    // typed arrays scale with the point count.
    canvasEntrance?.cancel();
    canvasEntrance = null;
    disposeRender();
    edits.destroy();
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
    if (srTableWrapper?.parentNode) {
      srTableWrapper.parentNode.removeChild(srTableWrapper);
      srTableWrapper = null;
    }
    container.classList.remove('oc-dark');
    container.classList.remove('oc-root');
  }

  // Initial render
  render();

  // Track the effective font after initial mount and spec updates. A delayed
  // promise for a superseded font must not recompile the current chart.
  function watchCurrentFont(): void {
    const generation = ++fontWatchGeneration;
    const pending = scheduleFontReload(
      fontFamily,
      () => !destroyed && generation === fontWatchGeneration,
      () => {
        // render() marks ready only after the new metrics actually compile,
        // including deferred resize work during an entrance animation.
        fontsReloadPending = true;
        resize();
      },
    );
    container.dataset.ocFontsState = pending ? 'pending' : 'ready';
  }
  watchCurrentFont();

  // Set up responsive resize
  if (options?.autoResize !== false) {
    disconnectResize = observeResize(container, (width, height) => {
      if (sizer.shouldResize(width, height)) resize();
    });
  }

  const instance: ChartInstance = {
    update,
    beginManualUpdate,
    resize,
    sampleLayout: () =>
      sampleLayout(
        currentLayout,
        transitionHandle?.running ? transitionHandle.snapshot() : undefined,
      ),
    export: doExport,
    destroy,
    get layout() {
      return currentLayout;
    },
    getSelectedElement(): ElementRef | null {
      return edits.selected;
    },
    select(ref: ElementRef): void {
      if (destroyed) return;
      edits.select(ref);
    },
    deselect(): void {
      if (destroyed) return;
      edits.deselect();
    },
    get isTextEditing(): boolean {
      return edits.isTextEditing;
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
  unregisterReaderHost = registerReaderHost(instance, {
    isEditing: () => selectable || edits.isTextEditing,
    getSpec: () => currentSpec,
    suspendNavigation() {
      readerOwnsNavigation = true;
      disposeNavigation?.();
      return () => {
        readerOwnsNavigation = false;
        if (!destroyed) restoreNavigation?.();
      };
    },
    subscribe(listener) {
      readerListeners.add(listener);
      return () => {
        readerListeners.delete(listener);
      };
    },
  });
  return instance;
}
