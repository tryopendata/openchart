import type { GeoLabelAffine, GeoLabelOverlay } from '@opendata-ai/openchart-core';
import { type ReaderHostEvent, registerReaderHost } from './interactions/reader-arbitration';
import {
  createMapLabelInventory,
  type LabelInventoryOptions,
  mergeGeoLabelInventory,
} from './map-label-inventory';
import {
  describeGeoLabelInventory,
  mapLabelAffine,
  projectAcceptedGeoOverlay,
  renderGeoLabelOverlay,
  resolveMapLabelOverlay,
} from './map-labels';
import { cameraForGeoView, createMapViewCameras } from './map-view-camera';
import {
  applyGeoDetailVisibility,
  findGeoViewScene,
  geoViewMapLayout,
  renderGeoViewNotes,
} from './map-view-renderer';
import { createRenderContext, pageIdScope } from './render-context';
/**
 * Map mount API: the main entry point for vanilla JS map usage.
 *
 * createGeoMap() takes a container, GeoMapSpec, and options, compiles the
 * map, renders it as SVG, sets up responsive resizing, tooltip interaction,
 * and returns a GeoMapInstance with update/resize/export/destroy.
 */

import type {
  CompileOptions,
  DarkMode,
  GeoMapLayout,
  GeoMapSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { compileGeoMap } from '@opendata-ai/openchart-engine';
import { cancelAnimations, setupAnimationCleanup } from './animation';
import {
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type JPGExportOptions,
  type SVGExportOptions,
} from './export';
import {
  captureMarkFocus,
  type NavigableMark,
  restoreMarkFocus,
  wireMarkNavigation,
} from './interactions/mark-navigation';
import {
  applyMapCamera,
  cameraForTarget,
  clampMapCamera,
  ensureMapClip,
  FOCUS_DIM_OPACITY,
  focusTargetForFeatures,
  type GeoMapCameraOptions,
  resolveMapZoom,
} from './map-camera';
import { renderMapSVG } from './map-renderer';
import { captureMapSnapshot, runMapFillTransition } from './map-transition';
import { createMapZoomController, type MapZoomController } from './map-zoom';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
import { resolveDarkMode } from './resolve-dark-mode';
import type { Camera } from './story/camera-math';
import { interpolateCamera } from './story/camera-math';
import type { Tween } from './story/tween';
import { createTween, easingFns, storyMotion } from './story/tween';
import { prepareSettledExportTheme } from './theme-style-block';
import { createTooltipManager, type TooltipManager } from './tooltip';

/**
 * A stable string for a resolved focus, used to detect focus changes between
 * `update()` calls. Includes the target rect (rounded) so a points focus
 * (which has empty ids) still re-fits when the fitted cluster moves; ids alone
 * would miss that. `null` focus -> null (no camera target).
 */
function focusSignature(focus: GeoMapLayout['focus']): string | null {
  if (!focus) return null;
  const t = focus.target;
  const ids = focus.ids.map(String).sort().join(',');
  return `${ids}|${Math.round(t.x)},${Math.round(t.y)},${Math.round(t.width)},${Math.round(t.height)},${t.padding}`;
}

/**
 * Where a raised feature came from, so leaving puts it back.
 *
 * SVG has no z-index: the only way to draw a hovered feature's outline over its
 * neighbours is to move it to the end of the group. That destroys paint order,
 * which the entrance animation and the border meshes both depend on, so the
 * original next sibling is remembered and restored on leave.
 */
const featureOrigin = new WeakMap<Element, Element | null>();

function raiseFeature(el: Element, svg: SVGElement): void {
  // Re-appending restarts the element's CSS entrance keyframe. While the map is
  // still animating in, keep paint order and settle for the outline class
  // alone -- a hover this early is worth less than the entrance stuttering.
  if (svg.classList.contains('oc-animate')) return;
  const parent = el.parentNode;
  if (!parent || el === parent.lastChild) return;
  if (!featureOrigin.has(el)) {
    featureOrigin.set(el, el.nextSibling as Element | null);
  }
  parent.appendChild(el);
}

function restoreFeatureOrder(el: Element): void {
  const parent = el.parentNode;
  if (!parent || !featureOrigin.has(el)) return;
  const next = featureOrigin.get(el) ?? null;
  featureOrigin.delete(el);
  if (next && next.parentNode === parent) {
    parent.insertBefore(el, next);
  } else if (!next) {
    parent.appendChild(el);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeoMapMarkEvent = {
  kind: 'feature' | 'point';
  id: string | number;
  name?: string;
  data: Record<string, unknown> | null;
  viewId?: string;
  layerId?: string;
};

export interface GeoMapCameraChangeMeta {
  viewId: string;
}

export interface GeoMapMountOptions {
  /** Optional host for the visible Map places and notes disclosure. */
  labelInventory?: LabelInventoryOptions;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting: "auto" (system pref), "force", or "off". */
  darkMode?: DarkMode;
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  /** Show the OpenData watermark. Defaults to true. */
  watermark?: boolean;
  /** Show tooltips on hover. Defaults to true. */
  tooltip?: boolean;
  /** Callback when a feature or point is clicked. */
  onMarkClick?: (event: GeoMapMarkEvent) => void;
  /** Callback when a feature or point is hovered (null on mouse leave). */
  onMarkHover?: (event: GeoMapMarkEvent | null) => void;
  /**
   * Called whenever the camera moves: reader zoom/pan (`geo.zoom`), the
   * imperative camera API, and focus changes. Fires on every frame of an
   * animated move. `cx`/`cy` are the view center in map-frame units, `k` the
   * zoom factor (1 = full map).
   */
  onCameraChange?: (camera: Camera, meta?: GeoMapCameraChangeMeta) => void;
}

export interface GeoMapInstance {
  /** Replace the disclosure host without resetting the camera or map. */
  setLabelInventory(options?: LabelInventoryOptions): void;
  /** Re-compile and re-render with a new spec. */
  update(spec: GeoMapSpec): void;
  /** Re-compile at current container dimensions. */
  resize(): void;
  /** Export the map. */
  export(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    options?: JPGExportOptions | SVGExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  /** Remove all DOM elements and disconnect observers. */
  destroy(): void;
  /** The current compiled layout. */
  readonly layout: GeoMapLayout;
  /** Zoom to one or more features by ID. */
  zoomTo(featureId: string | number | Array<string | number>, opts?: GeoMapCameraOptions): void;
  /** Pan to a feature keeping the current zoom level. */
  panTo(featureId: string | number, opts?: GeoMapCameraOptions): void;
  /** Fit the camera to an arbitrary bounding box, or reset to full view if no target. */
  fitBounds(
    target?: { x: number; y: number; width: number; height: number; padding?: number },
    opts?: GeoMapCameraOptions,
  ): void;
  /** Reset the camera to the full map view. */
  resetView(opts?: GeoMapCameraOptions): void;
  /** Get a snapshot of the current camera state. */
  getCamera(viewId?: string): Camera;
  /** Defensive snapshots of every current view camera, including root. */
  getCameras(): Readonly<Record<string, Camera>>;
  /** Set the camera to an exact state (no animation). */
  setCamera(camera: Camera, options?: { viewId?: string }): void;
}

/** Tween length for button, key, and double-click zoom steps. */
const USER_ZOOM_MS = 250;

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a map instance from a spec and mount it into a container.
 */
export function createGeoMap(
  container: HTMLElement,
  spec: GeoMapSpec,
  options?: GeoMapMountOptions,
): GeoMapInstance {
  let currentSpec = spec;
  let currentLayout: GeoMapLayout;
  let destroyed = false;
  let readerOwned = false;
  const readerListeners = new Set<(event: ReaderHostEvent) => void>();
  const emitReader = (kind: ReaderHostEvent['kind']) => {
    for (const listener of readerListeners) listener({ kind });
  };
  let unregisterReader: (() => void) | undefined;
  const labelInventory = createMapLabelInventory(container, options?.labelInventory);
  let acceptedOverlay: GeoLabelOverlay | undefined;
  let acceptedAffine: GeoLabelAffine = { k: 1, tx: 0, ty: 0 };
  let labelSettleFrame: number | null = null;
  let labelGesture = false;
  function cancelLabelSettle() {
    if (labelSettleFrame !== null) cancelAnimationFrame(labelSettleFrame);
    labelSettleFrame = null;
  }
  function settleLabels() {
    cancelLabelSettle();
    if (destroyed || !svgElement) return;
    if (currentLayout.views) {
      for (const view of currentLayout.views) settleViewLabels(view.viewId);
      refreshViewInventory();
      return;
    }
    acceptedOverlay = resolveMapLabelOverlay(currentLayout, currentCamera);
    acceptedAffine = mapLabelAffine(currentCamera, currentLayout);
    if (acceptedOverlay) renderGeoLabelOverlay(svgElement, currentLayout, acceptedOverlay);
    labelInventory.update(svgElement, acceptedOverlay?.inventory ?? [], currentLayout.theme);
  }
  function scheduleLabelSettle() {
    if (!currentLayout.labels || labelGesture || cameraTween || labelSettleFrame !== null) return;
    labelSettleFrame = requestAnimationFrame(() => {
      labelSettleFrame = null;
      settleLabels();
    });
  }

  // DOM
  let svgElement: SVGSVGElement | null = null;

  // Subsystems
  let tooltipManager: TooltipManager | null = null;
  let cleanupTooltipEvents: (() => void) | null = null;
  let disconnectResize: (() => void) | null = null;

  // Animation state
  let animationCleanup: (() => void) | null = null;
  let fillTransitionHandle: { cancel: () => void } | null = null;
  let pendingResize = false;

  // Camera state
  let currentCamera: Camera = { cx: 0, cy: 0, k: 1 };
  let currentFocusIds: Array<string | number> | null = null;
  let cameraTween: Tween<Camera> | null = null;
  const viewOverlays = new Map<string, { overlay: GeoLabelOverlay; affine: GeoLabelAffine }>();
  const viewCameras = createMapViewCameras(
    (viewId, cam) => {
      if (!svgElement) return;
      const view = currentLayout.views?.find((view) => view.viewId === viewId);
      if (!view) return;
      const scene = findGeoViewScene(svgElement, viewId);
      if (!scene) return;
      const frame = geoViewMapLayout(currentLayout, view);
      applyMapCamera(scene, cam, frame);
      applyGeoDetailVisibility(scene, cam.k);
      const accepted = viewOverlays.get(viewId);
      if (accepted)
        renderGeoLabelOverlay(
          scene,
          frame,
          projectAcceptedGeoOverlay(
            accepted.overlay,
            accepted.affine,
            mapLabelAffine(cam, frame),
            frame,
          ),
        );
      insetZoomControllers.get(viewId)?.onCamera();
      emitReader('camera');
      options?.onCameraChange?.({ ...cam }, { viewId });
    },
    (viewId) => {
      settleViewLabels(viewId);
      refreshViewInventory();
    },
  );
  function settleViewLabels(viewId: string) {
    if (!svgElement) return;
    const view = currentLayout.views?.find((view) => view.viewId === viewId);
    if (!view) return;
    const frame = geoViewMapLayout(currentLayout, view),
      cam = viewId === 'root' ? currentCamera : viewCameras.get(viewId);
    const overlay = resolveMapLabelOverlay(frame, cam);
    if (!overlay) {
      viewOverlays.delete(viewId);
      return;
    }
    viewOverlays.set(viewId, { overlay, affine: mapLabelAffine(cam, frame) });
    const scene = findGeoViewScene(svgElement, viewId);
    if (scene) renderGeoLabelOverlay(scene, frame, { ...overlay, notes: [] });
  }
  function refreshViewInventory() {
    if (svgElement && currentLayout.views)
      renderGeoViewNotes(
        svgElement,
        currentLayout,
        new Map([...viewOverlays].map(([id, value]) => [id, value.overlay])),
      );
    if (svgElement)
      labelInventory.update(
        svgElement,
        mergeGeoLabelInventory(
          [...viewOverlays.values()].flatMap((value) => value.overlay.inventory),
        ),
        currentLayout.theme,
      );
  }

  // Reader zoom/pan (geo.zoom). Created lazily on the first render with zoom on.
  let zoomController: MapZoomController | null = null;
  const insetZoomControllers = new Map<string, MapZoomController>();
  function syncInsetZoomControllers() {
    const views = currentLayout.views?.filter((view) => view.viewId !== 'root') ?? [];
    const ids = new Set(views.map((view) => view.viewId));
    for (const [id, controller] of insetZoomControllers)
      if (!ids.has(id)) {
        controller.destroy();
        insetZoomControllers.delete(id);
      }
    for (const view of views) {
      let controller = insetZoomControllers.get(view.viewId);
      if (!controller) {
        const id = view.viewId;
        controller = createMapZoomController({
          container,
          viewId: id,
          viewLabel: view.label?.lines.map((line) => line.text).join(' ') ?? id,
          getSvg: () => svgElement,
          getScene: () => (svgElement ? findGeoViewScene(svgElement, id) : null),
          getFocusTarget: () => (svgElement ? findGeoViewScene(svgElement, id) : null),
          getLayout: () => geoViewMapLayout(currentLayout, viewCameras.view(id)),
          getConfig: () => resolveMapZoom(currentSpec.geo?.zoom),
          getCamera: () => viewCameras.get(id),
          setCamera: (camera) => viewCameras.set(id, camera, false),
          animateCamera: (camera) => driveInset(id, camera, USER_ZOOM_MS),
          reset: () => {
            const view = viewCameras.view(id);
            driveInset(id, cameraForGeoView({ ...view, focus: null }), USER_ZOOM_MS);
          },
          hideTooltip: () => tooltipManager?.hide(),
          onGestureStart() {
            labelGesture = true;
            emitReader('gesture-start');
          },
          onGestureEnd() {
            labelGesture = false;
            viewCameras.settle(id);
            emitReader('gesture-end');
          },
        });
        insetZoomControllers.set(id, controller);
      }
      controller.onRender(false);
    }
  }

  // Track whether this is the first render (for snap-to-focus).
  let isFirstRender = true;

  // Set when webfonts have loaded and a recompile is owed.
  let fontsReloadPending = false;

  // Apply the root class up front so getComputedStyle sees --oc-font-family
  container.classList.add('oc-map-root');

  // Resolve the effective font the same way compile() will.
  function resolveEffectiveFont(candidate = currentSpec): string {
    return (
      options?.theme?.fonts?.family ??
      candidate.theme?.fonts?.family ??
      resolveFontFamily(container)
    );
  }
  let fontFamily = resolveEffectiveFont();
  let measureText = createMeasureText(fontFamily);
  let renderGen = 0;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  let isAutoHeight: boolean | null = null;

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width || 600, 100);

    if (isAutoHeight === null && (rect.width > 0 || rect.height > 0)) {
      isAutoHeight = rect.height === 0 && rect.width > 0;
    }

    // Explicit host height is a hard budget: return it as-is so the
    // compiler keeps the SVG inside its box.
    if (isAutoHeight === false && rect.height > 0) {
      return { width, height: Math.max(rect.height, 100) };
    }

    // Auto-height host: pick our own budget.
    return { width, height: Math.round(width * 0.625) };
  }

  function compile(candidate = currentSpec, measure = measureText): GeoMapLayout {
    const { width, height } = getContainerDimensions();
    const darkMode = resolveDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      watermark: options?.watermark,
      measureText: measure,
      // An unconstrained host must grow around wrapped titles and sources.
      // Treating the aspect-ratio budget as the entire SVG can leave only a
      // few pixels for geography on phones. Explicit heights remain a hard
      // budget, as they are in dashboards and scrollytelling panels.
      chromeLayout: isAutoHeight === true ? 'grow' : 'subtract',
    };

    return compileGeoMap(candidate, compileOpts);
  }

  // ---------------------------------------------------------------------------
  // Tooltip and interaction wiring
  // ---------------------------------------------------------------------------

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: GeoMapLayout): () => void {
    const cleanups: Array<() => void> = [];
    const navigation: NavigableMark[] = [];
    let activeLeave: (() => void) | null = null;

    const featuresById = new Map<string, (typeof layout.features)[number]>();
    for (const f of layout.features) {
      const key = String(f.id);
      if (!featuresById.has(key)) featuresById.set(key, f);
    }

    const featureElements = svg.querySelectorAll('.oc-map-feature');
    for (const el of featureElements) {
      const featureId = el.getAttribute('data-feature-id');
      if (!featureId) continue;

      const content = layout.tooltipDescriptors.get(featureId);
      const viewId = el.closest('[data-geo-view-id]')?.getAttribute('data-geo-view-id');
      const scoped = currentLayout.views?.find((view) => view.viewId === viewId);
      const feature = scoped
        ? scoped.features.find((feature) => String(feature.id) === featureId)
        : featuresById.get(featureId);
      const scope = currentLayout.views && viewId ? { viewId } : {};

      const handleMouseEnter = (e: Event) => {
        activeLeave?.();
        activeLeave = handleMouseLeave;
        const mouseEvent = e as MouseEvent;
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty('cursor', 'pointer');
        // Reparenting a focused SVG node drops native keyboard focus.
        if (document.activeElement !== el) raiseFeature(el, svg);
        el.classList.add('oc-map-feature--hover');
        if (content && tooltipManager && options?.tooltip !== false) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        if (feature) {
          options?.onMarkHover?.({
            kind: 'feature',
            ...scope,
            id: feature.id,
            name: feature.name,
            data: feature.data,
          });
        }
      };

      const handleMouseMove = (e: Event) => {
        if (content && tooltipManager && options?.tooltip !== false) {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
      };

      const handleMouseLeave = () => {
        if (activeLeave !== handleMouseLeave) return;
        activeLeave = null;
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('cursor');
        el.classList.remove('oc-map-feature--hover');
        restoreFeatureOrder(el);
        tooltipManager?.hide();
        options?.onMarkHover?.(null);
      };

      const handleClick = () => {
        if (feature) {
          options?.onMarkClick?.({
            kind: 'feature',
            ...scope,
            id: feature.id,
            name: feature.name,
            data: feature.data,
          });
        }
      };

      navigation.push({
        element: el,
        key: viewId ? `view:${viewId}:feature:${featureId}` : `feature:${featureId}`,
        enter: handleMouseEnter,
        leave: handleMouseLeave,
        activate: handleClick,
      });
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mousemove', handleMouseMove);
      el.addEventListener('mouseleave', handleMouseLeave);
      el.addEventListener('click', handleClick);

      cleanups.push(() => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('mouseleave', handleMouseLeave);
        el.removeEventListener('click', handleClick);
      });
    }

    // Legend-bin hover: the one place dim-the-rest earns its keep on a map.
    // Hovering a swatch is a deliberate "show me this class" gesture, unlike a
    // pointer crossing features, where dimming 3000 paths per move is a
    // repaint storm and a visible pulse.
    const featuresGroup = svg.querySelector('.oc-map-features');
    if (featuresGroup) {
      for (const bin of svg.querySelectorAll('.oc-legend-bin[data-bin-index]')) {
        const index = bin.getAttribute('data-bin-index');
        if (index === null) continue;
        const enter = () => featuresGroup.setAttribute('data-hover', index);
        const leave = () => featuresGroup.removeAttribute('data-hover');
        bin.addEventListener('mouseenter', enter);
        bin.addEventListener('mouseleave', leave);
        cleanups.push(() => {
          bin.removeEventListener('mouseenter', enter);
          bin.removeEventListener('mouseleave', leave);
          featuresGroup.removeAttribute('data-hover');
        });
      }
    }

    // Wire point interactions
    const pointMarksByKey = new Map(layout.pointMarks.map((p) => [p.key, p]));
    const pointElements = svg.querySelectorAll('.oc-map-point');
    for (const el of pointElements) {
      const pointKey = el.getAttribute('data-point-key');
      if (!pointKey) continue;

      const content = layout.tooltipDescriptors.get(`point:${pointKey}`);
      const viewId = el.closest('[data-geo-view-id]')?.getAttribute('data-geo-view-id');
      const scoped = currentLayout.views?.find((view) => view.viewId === viewId);
      const pointMark = scoped
        ? scoped.pointMarks.find((point) => point.key === pointKey)
        : pointMarksByKey.get(pointKey);
      const scope = currentLayout.views && viewId ? { viewId } : {};

      const handlePointMouseEnter = (e: Event) => {
        activeLeave?.();
        activeLeave = handlePointMouseLeave;
        const mouseEvent = e as MouseEvent;
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty('cursor', 'pointer');
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty('filter', 'brightness(1.15)');
        if (content && tooltipManager && options?.tooltip !== false) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        if (pointMark) {
          options?.onMarkHover?.({
            kind: 'point',
            ...scope,
            id: pointKey,
            data: pointMark.data,
          });
        }
      };

      const handlePointMouseMove = (e: Event) => {
        if (content && tooltipManager && options?.tooltip !== false) {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
      };

      const handlePointMouseLeave = () => {
        if (activeLeave !== handlePointMouseLeave) return;
        activeLeave = null;
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('cursor');
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('filter');
        tooltipManager?.hide();
        options?.onMarkHover?.(null);
      };

      const handlePointClick = () => {
        if (pointMark) {
          options?.onMarkClick?.({
            kind: 'point',
            ...scope,
            id: pointKey,
            data: pointMark.data,
          });
        }
      };

      navigation.push({
        element: el,
        key: viewId ? `view:${viewId}:point:${pointKey}` : `point:${pointKey}`,
        enter: handlePointMouseEnter,
        leave: handlePointMouseLeave,
        activate: handlePointClick,
      });
      el.addEventListener('mouseenter', handlePointMouseEnter);
      el.addEventListener('mousemove', handlePointMouseMove);
      el.addEventListener('mouseleave', handlePointMouseLeave);
      el.addEventListener('click', handlePointClick);

      cleanups.push(() => {
        el.removeEventListener('mouseenter', handlePointMouseEnter);
        el.removeEventListener('mousemove', handlePointMouseMove);
        el.removeEventListener('mouseleave', handlePointMouseLeave);
        el.removeEventListener('click', handlePointClick);
      });
    }

    cleanups.push(wireMarkNavigation(svg, navigation));
    return () => {
      activeLeave?.();
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------

  function resolveCamera(): Camera {
    if (currentFocusIds && currentFocusIds.length > 0) {
      // Prefer the compiled focus target (carries the spec-declared padding)
      // over recomputing with the default padding of 16.
      const lf = currentLayout.focus;
      if (lf && lf.ids.length === currentFocusIds.length) {
        const lfSet = new Set(lf.ids.map(String));
        if (currentFocusIds.every((id) => lfSet.has(String(id)))) {
          return cameraForTarget(currentLayout, lf.target);
        }
      }
      const target = focusTargetForFeatures(currentLayout, currentFocusIds);
      return cameraForTarget(currentLayout, target);
    }
    return cameraForTarget(currentLayout, null);
  }

  /** The one place the live camera changes after mount. */
  function commitCamera(cam: Camera): void {
    currentCamera = cam;
    if (currentLayout.views && viewCameras.has('root')) viewCameras.seed('root', cam);
    if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
    if (svgElement && currentLayout.views) {
      const root = currentLayout.views.find((view) => view.viewId === 'root');
      if (root) {
        const scene = findGeoViewScene(svgElement, 'root');
        if (scene) {
          applyGeoDetailVisibility(scene, cam.k);
          const accepted = viewOverlays.get('root'),
            frame = geoViewMapLayout(currentLayout, root);
          if (accepted)
            renderGeoLabelOverlay(
              scene,
              frame,
              projectAcceptedGeoOverlay(
                accepted.overlay,
                accepted.affine,
                mapLabelAffine(cam, frame),
                frame,
              ),
            );
        }
      }
    }
    if (svgElement && !currentLayout.views && acceptedOverlay && currentLayout.labels) {
      renderGeoLabelOverlay(
        svgElement,
        currentLayout,
        projectAcceptedGeoOverlay(
          acceptedOverlay,
          acceptedAffine,
          mapLabelAffine(cam, currentLayout),
          currentLayout,
        ),
      );
    }
    scheduleLabelSettle();
    zoomController?.onCamera();
    emitReader('camera');
    if (currentLayout.views) options?.onCameraChange?.({ ...cam }, { viewId: 'root' });
    else options?.onCameraChange?.({ ...cam });
  }

  function cancelCameraTween(): void {
    if (cameraTween) {
      cameraTween.cancel();
      cameraTween = null;
    }
  }

  function animateCamera(target: Camera, duration: number): void {
    if (cameraTween) cameraTween.cancel();
    cameraTween = createTween<Camera>({
      initial: currentCamera,
      lerp: interpolateCamera,
      duration,
      ease: easingFns.easeInOutCubic,
      onFrame(cam) {
        commitCamera(cam);
      },
      onComplete() {
        cameraTween = null;
        settleLabels();
      },
    });
    cameraTween.to(target);
  }

  function driveCamera(cam: Camera, duration: number): void {
    if (duration === 0 || prefersReducedMotion()) {
      cancelCameraTween();
      commitCamera(cam);
    } else {
      animateCamera(cam, duration);
    }
  }

  function resetCamera(duration: number): void {
    currentFocusIds = null;
    const cam = cameraForTarget(currentLayout, null);
    driveCamera(cam, duration);
    applyFocusDim(null);
    updateA11yLive(null);
  }

  /**
   * Keep a free (non-focus) camera on the same part of the map when the map
   * frame changes size: camera units are map-frame pixels, so they scale with
   * the frame.
   */
  function rescaleFreeCamera(prev: { width: number; height: number }): void {
    const next = currentLayout.mapSize;
    if (!prev.width || !prev.height || (prev.width === next.width && prev.height === next.height)) {
      return;
    }
    const scaled = {
      cx: (currentCamera.cx * next.width) / prev.width,
      cy: (currentCamera.cy * next.height) / prev.height,
      k: currentCamera.k,
    };
    const zoom = resolveMapZoom(currentSpec.geo?.zoom);
    currentCamera = zoom ? clampMapCamera(scaled, next, zoom.maxZoom) : scaled;
  }

  function syncZoomController(restoreFocus: boolean): void {
    const zoom = resolveMapZoom(currentSpec.geo?.zoom);
    if (!zoom && !zoomController) return;
    if (!zoomController) {
      zoomController = createMapZoomController({
        container,
        getSvg: () => svgElement,
        getScene: () => (svgElement ? findGeoViewScene(svgElement, 'root') : null),
        getLayout: () => {
          const root = currentLayout.views?.find((view) => view.viewId === 'root');
          return root ? geoViewMapLayout(currentLayout, root) : currentLayout;
        },
        getConfig: () => resolveMapZoom(currentSpec.geo?.zoom),
        getCamera: () => ({ ...currentCamera }),
        setCamera(cam) {
          // A reader gesture takes the camera off any focus target, so a
          // resize keeps their view instead of snapping back to the focus.
          cancelCameraTween();
          currentFocusIds = null;
          commitCamera(cam);
        },
        animateCamera(cam) {
          currentFocusIds = null;
          driveCamera(cam, USER_ZOOM_MS);
        },
        reset: () => resetCamera(USER_ZOOM_MS),
        hideTooltip: () => tooltipManager?.hide(),
        onGestureStart() {
          labelGesture = true;
          emitReader('gesture-start');
          cancelLabelSettle();
        },
        onGestureEnd() {
          labelGesture = false;
          emitReader('gesture-end');
          scheduleLabelSettle();
        },
      });
    }
    zoomController.onRender(restoreFocus);
  }

  function updateA11yLive(ids: Array<string | number> | null): void {
    let liveEl = container.querySelector('.oc-map-live') as HTMLElement | null;
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.className = 'oc-map-live oc-sr-only';
      liveEl.setAttribute('aria-live', 'polite');
      container.appendChild(liveEl);
    }
    if (!ids || ids.length === 0) {
      liveEl.textContent = 'Showing full map';
      return;
    }
    const names = ids.map((id) => {
      const f = currentLayout.features.find((feat) => String(feat.id) === String(id));
      return f?.name ?? String(id);
    });
    liveEl.textContent = `Zoomed to ${names.join(', ')}`;
  }

  function applyFocusDim(ids: Array<string | number> | null, target = svgElement): void {
    if (!target) return;
    const features = (findGeoViewScene(target, 'root') ?? target).querySelectorAll(
      '.oc-map-feature',
    );
    if (!ids || ids.length === 0) {
      for (const el of features) {
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('opacity');
      }
      return;
    }
    const focusSet = new Set(ids.map(String));
    for (const el of features) {
      const fid = el.getAttribute('data-feature-id');
      (el as SVGElement & ElementCSSInlineStyle).style.setProperty(
        'opacity',
        fid && focusSet.has(fid) ? '1' : String(FOCUS_DIM_OPACITY),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Render + update
  // ---------------------------------------------------------------------------

  function render(animate = false): void {
    const focusedMark = captureMarkFocus(svgElement);
    tooltipManager?.hide();
    // Cancel running animations
    if (animationCleanup) {
      animationCleanup();
      animationCleanup = null;
    }
    if (fillTransitionHandle) {
      fillTransitionHandle.cancel();
      fillTransitionHandle = null;
    }

    // Render new SVG before removing old to avoid a paint gap
    const oldSvg = svgElement;
    const oldSvgHadFocus = !!oldSvg && document.activeElement === oldSvg;
    viewCameras.update(currentLayout.views ?? []);
    for (const id of viewOverlays.keys()) if (!viewCameras.has(id)) viewOverlays.delete(id);
    const newSvg = renderMapSVG(currentLayout, {
      context: createRenderContext({ ids: pageIdScope }),
      animate,
    });

    if (oldSvg) {
      if (cleanupTooltipEvents) {
        cleanupTooltipEvents();
        cleanupTooltipEvents = null;
      }
      container.replaceChild(newSvg, oldSvg);
    } else {
      container.appendChild(newSvg);
    }
    svgElement = newSvg;
    const labelDesc = newSvg.querySelector('desc[data-geo-label-inventory]');
    if (labelDesc) {
      newSvg.removeAttribute('aria-describedby');
      labelDesc.remove();
    }

    // Wire interactions
    cleanupTooltipEvents = readerOwned ? null : wireTooltipAndInteraction(newSvg, currentLayout);

    // Setup tooltips if enabled
    if (options?.tooltip !== false) {
      if (!tooltipManager) {
        tooltipManager = createTooltipManager(container);
      }
    }

    // Setup animation cleanup only when actually animating
    const isAnimating = animate && !!currentLayout.animation?.enter;
    if (isAnimating) {
      animationCleanup = setupAnimationCleanup(newSvg, () => {
        animationCleanup = null;
        if (pendingResize && !destroyed) {
          pendingResize = false;
          resize();
        }
        // Apply deferred focus dim after animation completes
        if (currentFocusIds && currentFocusIds.length > 0) {
          applyFocusDim(currentFocusIds);
        }
      });
    }

    // Re-apply camera transform after render if zoomed or focused
    if (currentCamera.k > 1 + 1e-3 || (currentFocusIds && currentFocusIds.length > 0)) {
      applyMapCamera(newSvg, currentCamera, currentLayout);
    }

    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);

    if (fontsReloadPending) {
      fontsReloadPending = false;
      container.dataset.ocFontsState = 'ready';
    }

    // On first render, initialize the camera so subsequent tweens start
    // from the correct position (not the {0,0,1} default).
    if (isFirstRender) {
      if (currentLayout.focus) {
        const target = currentLayout.focus.target;
        currentFocusIds = [...currentLayout.focus.ids];
        const cam = cameraForTarget(currentLayout, target);
        currentCamera = cam;
        if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
        if (!isAnimating) applyFocusDim(currentFocusIds);
      } else {
        currentCamera = cameraForTarget(currentLayout, null);
      }
    }
    isFirstRender = false;
    if (currentLayout.views) {
      viewCameras.seed('root', currentCamera);
      for (const view of currentLayout.views) {
        const scene = findGeoViewScene(newSvg, view.viewId);
        if (scene) {
          const camera = view.viewId === 'root' ? currentCamera : viewCameras.get(view.viewId);
          applyMapCamera(scene, camera, geoViewMapLayout(currentLayout, view));
          applyGeoDetailVisibility(scene, camera.k);
        }
      }
    }

    syncZoomController(oldSvgHadFocus);
    syncInsetZoomControllers();
    if (svgElement) restoreMarkFocus(svgElement, focusedMark);
    settleLabels();
    emitReader('layout');
  }

  function update(newSpec: GeoMapSpec): void {
    if (destroyed) return;
    // Compile before adopting an edit: a rejected spec must leave the last
    // valid view, its interactions, and future resize/export calls intact.
    const nextFont = resolveEffectiveFont(newSpec);
    const nextMeasure = nextFont === fontFamily ? measureText : createMeasureText(nextFont);
    const nextLayout = compile(newSpec, nextMeasure);
    currentSpec = newSpec;
    fontFamily = nextFont;
    measureText = nextMeasure;

    // Capture paint + point geometry optimistically; gate the tween on the
    // *new* layout's animation config after compile
    const canAnimate = !animationCleanup && !prefersReducedMotion();
    const prevPaint = canAnimate ? captureMapSnapshot(svgElement) : null;

    // Remember previous focus to detect changes. The signature includes the
    // target rect, not just ids+padding, so a points-focus ({ points: true },
    // which resolves to empty ids) still re-fits the camera when the fitted
    // cluster moves between steps.
    const prevFocusIds = currentFocusIds ? currentFocusIds.map(String).sort().join(',') : null;
    const prevFocusSig = focusSignature(currentLayout.focus);
    const prevMapSize = currentLayout.mapSize;

    currentLayout = nextLayout;
    if (!currentFocusIds) rescaleFreeCamera(prevMapSize);
    render();

    // Run the update tween if the *new* layout enables update animation
    if (
      canAnimate &&
      prevPaint &&
      (prevPaint.fills.size > 0 || prevPaint.points.size > 0) &&
      svgElement &&
      currentLayout.animation?.update
    ) {
      fillTransitionHandle = runMapFillTransition(svgElement, prevPaint, {
        duration: currentLayout.animation.update.duration,
      });
    }

    // Declarative focus from spec: tween camera if focus changed
    const nextFocus = currentLayout.focus;
    const nextFocusSig = focusSignature(nextFocus);

    if (nextFocusSig !== prevFocusSig) {
      if (nextFocus) {
        currentFocusIds = [...nextFocus.ids];
        const cam = cameraForTarget(currentLayout, nextFocus.target);
        driveCamera(cam, prefersReducedMotion() ? 0 : storyMotion.camera);
        applyFocusDim(currentFocusIds);
      } else if (prevFocusIds !== null) {
        currentFocusIds = null;
        const cam = cameraForTarget(currentLayout, null);
        driveCamera(cam, prefersReducedMotion() ? 0 : storyMotion.camera);
        applyFocusDim(null);
      }
    }
  }

  function resize(): void {
    if (destroyed) return;
    // If animation is running, queue the resize for after it completes
    if (animationCleanup) {
      pendingResize = true;
      return;
    }

    // Cancel any running camera tween: the resize recomputes the camera for the
    // new dimensions, and a stale tween would overwrite it on the next frame.
    cancelCameraTween();

    const prevMapSize = currentLayout.mapSize;
    currentLayout = compile();
    if (!currentFocusIds) rescaleFreeCamera(prevMapSize);
    render();

    // Re-resolve camera against new layout dimensions.
    // Imperative focus (set via zoomTo/panTo) takes precedence over declarative.
    if (currentFocusIds && currentFocusIds.length > 0) {
      currentCamera = resolveCamera();
      if (svgElement) applyMapCamera(svgElement, currentCamera, currentLayout);
    } else if (currentLayout.focus) {
      currentFocusIds = [...currentLayout.focus.ids];
      currentCamera = cameraForTarget(currentLayout, currentLayout.focus.target);
      if (svgElement) applyMapCamera(svgElement, currentCamera, currentLayout);
    }
    applyFocusDim(currentFocusIds);
    zoomController?.onCamera();
    if (currentLayout.views) {
      viewCameras.seed('root', currentCamera);
      const root = svgElement && findGeoViewScene(svgElement, 'root');
      if (root) applyGeoDetailVisibility(root, currentCamera.k);
    }
    settleLabels();
    emitReader('camera');
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  function exportChart(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    options_?: JPGExportOptions | SVGExportOptions,
  ): string | Promise<Blob> | Promise<string> {
    if (!svgElement) return '';

    // Export settled geometry, independent of transient hover and animation.
    const terminalSvg = renderMapSVG(currentLayout, {
      context: createRenderContext({ ids: pageIdScope }),
      animate: false,
    });
    if (currentLayout.views) {
      const overlays = new Map<string, GeoLabelOverlay>();
      const inventory: NonNullable<GeoMapLayout['labels']>['initialOverlay']['inventory'] = [];
      for (const view of currentLayout.views) {
        const scene = findGeoViewScene(terminalSvg, view.viewId);
        if (!scene) continue;
        const frame = geoViewMapLayout(currentLayout, view);
        const camera = view.viewId === 'root' ? currentCamera : viewCameras.get(view.viewId);
        applyMapCamera(scene, camera, frame);
        applyGeoDetailVisibility(scene, camera.k);
        const overlay = resolveMapLabelOverlay(frame, camera);
        if (overlay) {
          renderGeoLabelOverlay(scene, frame, { ...overlay, notes: [] });
          overlays.set(view.viewId, overlay);
          inventory.push(...overlay.inventory);
        }
      }
      renderGeoViewNotes(terminalSvg, currentLayout, overlays);
      describeGeoLabelInventory(terminalSvg, {
        labels: [],
        leaders: [],
        markers: [],
        notes: [],
        inventory: mergeGeoLabelInventory(inventory),
      });
    } else {
      applyMapCamera(terminalSvg, currentCamera, currentLayout);
      const exportOverlay = resolveMapLabelOverlay(currentLayout, currentCamera);
      if (exportOverlay) {
        renderGeoLabelOverlay(terminalSvg, currentLayout, exportOverlay);
        describeGeoLabelInventory(terminalSvg, exportOverlay);
      }
      const clip = svgElement.querySelector('.oc-map-group')?.getAttribute('clip-path');
      if (clip) {
        const clipId = clip.slice(5, -1);
        ensureMapClip(terminalSvg, currentLayout, clipId);
        terminalSvg.querySelector('.oc-map-group')?.setAttribute('clip-path', clip);
      }
    }
    applyFocusDim(currentFocusIds, terminalSvg);
    const resolvedOptions = { theme: currentLayout.theme, ...options_ };
    prepareSettledExportTheme(svgElement, terminalSvg, resolvedOptions.theme, !!options_?.theme);

    switch (format) {
      case 'svg':
        return exportSVG(terminalSvg);
      case 'svg-with-fonts':
        return exportSVGWithFonts(terminalSvg, resolvedOptions);
      case 'png':
        return exportPNG(terminalSvg, resolvedOptions);
      case 'jpg':
        return exportJPG(terminalSvg, resolvedOptions);
      default:
        return '';
    }
  }

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    emitReader('destroy');
    unregisterReader?.();
    readerListeners.clear();
    cancelLabelSettle();
    viewCameras.destroy();
    for (const controller of insetZoomControllers.values()) controller.destroy();
    insetZoomControllers.clear();
    labelInventory.destroy();

    // Cancel running animations
    if (animationCleanup) {
      cancelAnimations(svgElement);
      animationCleanup();
      animationCleanup = null;
    }
    if (fillTransitionHandle) {
      fillTransitionHandle.cancel();
      fillTransitionHandle = null;
    }
    cancelCameraTween();
    if (zoomController) {
      zoomController.destroy();
      zoomController = null;
    }

    // Clean up events
    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
    }

    // Remove SVG
    if (svgElement) {
      svgElement.remove();
      svgElement = null;
    }

    // Remove a11y live region
    const liveEl = container.querySelector('.oc-map-live');
    if (liveEl) liveEl.remove();

    // Unmount tooltip manager
    if (tooltipManager) {
      tooltipManager.destroy();
      tooltipManager = null;
    }

    // Disconnect resize observer
    if (disconnectResize) {
      disconnectResize();
      disconnectResize = null;
    }

    // Remove root classes
    container.classList.remove('oc-map-root', 'oc-dark');
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  if (resolveDarkMode(options?.darkMode)) {
    container.classList.add('oc-dark');
  }

  // Initial compile and render (animate on first mount)
  currentLayout = compile();
  render(true);

  // Recompile once after webfonts load
  const fontsPending = scheduleFontReload(
    fontFamily,
    () => !destroyed,
    () => {
      fontsReloadPending = true;
      resize();
    },
  );
  container.dataset.ocFontsState = fontsPending ? 'pending' : 'ready';

  // Setup responsive resizing
  if (options?.autoResize !== false) {
    disconnectResize = observeResize(container, () => {
      resize();
    });
  }

  function scopedView(options?: GeoMapCameraOptions, ids?: Array<string | number>) {
    const id = options?.viewId ?? 'root';
    if (id !== 'root' && !viewCameras.has(id))
      throw new Error(
        `Unknown map view "${id}". Available views: root, ${
          currentLayout.views
            ?.filter((v) => v.viewId !== 'root')
            .map((v) => v.viewId)
            .join(', ') ?? ''
        }.`,
      );
    if (currentLayout.views && ids) {
      const matches = currentLayout.views.filter((view) =>
        ids.some((id) => view.features.some((feature) => String(feature.id) === String(id))),
      );
      if (!options?.viewId && matches.length > 1)
        throw new Error(
          `Feature focus is ambiguous across views ${matches.map((view) => view.viewId).join(', ')}. Pass viewId explicitly.`,
        );
      const view = currentLayout.views.find((view) => view.viewId === id)!;
      const missing = ids.filter(
        (id) => !view.features.some((feature) => String(feature.id) === String(id)),
      );
      if (missing.length)
        throw new Error(
          `Features ${missing.join(', ')} are absent from map view "${id}". Available matching views: ${matches.map((view) => view.viewId).join(', ') || 'none'}. Pass viewId explicitly.`,
        );
    }
    return id;
  }
  function driveInset(viewId: string, camera: Camera, duration: number) {
    if (prefersReducedMotion() || duration === 0) viewCameras.set(viewId, camera);
    else viewCameras.animate(viewId, camera, duration);
  }
  const instance: GeoMapInstance = {
    update,
    resize,
    export: exportChart,
    setLabelInventory(next) {
      if (!destroyed) labelInventory.setOptions(next);
    },
    destroy,
    get layout(): GeoMapLayout {
      return currentLayout;
    },
    zoomTo(featureId: string | number | Array<string | number>, opts?: GeoMapCameraOptions): void {
      const ids = Array.isArray(featureId) ? featureId : [featureId];
      const viewId = scopedView(opts, ids);
      if (viewId !== 'root') {
        const view = viewCameras.view(viewId),
          frame = geoViewMapLayout(currentLayout, view);
        const target = focusTargetForFeatures(frame, ids, opts?.padding ?? 16);
        if (target)
          driveInset(viewId, cameraForGeoView(view, target), opts?.duration ?? storyMotion.camera);
        return;
      }
      const target = focusTargetForFeatures(currentLayout, ids, opts?.padding ?? 16);
      if (!target) {
        console.warn(`[openchart] zoomTo: no features found for ids: ${ids.join(', ')}`);
        return;
      }
      currentFocusIds = ids;
      const cam = cameraForTarget(currentLayout, target);
      driveCamera(cam, opts?.duration ?? storyMotion.camera);
      applyFocusDim(ids);
      updateA11yLive(ids);
    },
    panTo(featureId: string | number, opts?: GeoMapCameraOptions): void {
      const viewId = scopedView(opts, [featureId]);
      if (viewId !== 'root') {
        const view = viewCameras.view(viewId),
          frame = geoViewMapLayout(currentLayout, view),
          target = focusTargetForFeatures(frame, [featureId], opts?.padding ?? 16);
        if (target)
          driveInset(
            viewId,
            {
              cx: target.x + target.width / 2,
              cy: target.y + target.height / 2,
              k: viewCameras.get(viewId).k,
            },
            opts?.duration ?? storyMotion.camera,
          );
        return;
      }
      const target = focusTargetForFeatures(currentLayout, [featureId], opts?.padding ?? 16);
      if (!target) {
        console.warn(`[openchart] panTo: no feature found for id: ${featureId}`);
        return;
      }
      const cam: Camera = {
        cx: target.x + target.width / 2,
        cy: target.y + target.height / 2,
        k: currentCamera.k,
      };
      driveCamera(cam, opts?.duration ?? storyMotion.camera);
      updateA11yLive([featureId]);
    },
    fitBounds(
      target?: { x: number; y: number; width: number; height: number; padding?: number },
      opts?: GeoMapCameraOptions,
    ): void {
      const viewId = scopedView(opts);
      if (viewId !== 'root') {
        const view = viewCameras.view(viewId);
        driveInset(
          viewId,
          cameraForGeoView({ ...view, focus: null }, target),
          opts?.duration ?? storyMotion.camera,
        );
        return;
      }
      currentFocusIds = null;
      const cam = cameraForTarget(currentLayout, target ?? null);
      driveCamera(cam, opts?.duration ?? storyMotion.camera);
      applyFocusDim(null);
    },
    resetView(opts?: GeoMapCameraOptions): void {
      const viewId = scopedView(opts);
      if (viewId !== 'root') {
        const view = viewCameras.view(viewId);
        driveInset(
          viewId,
          cameraForGeoView({ ...view, focus: null }),
          opts?.duration ?? storyMotion.camera,
        );
        return;
      }
      resetCamera(opts?.duration ?? storyMotion.camera);
    },
    getCamera(viewId = 'root'): Camera {
      if (viewId !== 'root') return viewCameras.get(viewId);
      return { ...currentCamera };
    },
    getCameras() {
      return { ...viewCameras.snapshots(), root: { ...currentCamera } };
    },
    setCamera(camera: Camera, options?: { viewId?: string }): void {
      if (options?.viewId && options.viewId !== 'root') {
        viewCameras.set(options.viewId, camera);
        return;
      }
      cancelCameraTween();
      currentFocusIds = null;
      commitCamera(camera);
    },
  };
  unregisterReader = registerReaderHost(instance, {
    getSpec: () => currentSpec,
    isEditing: () => false,
    subscribe(listener) {
      readerListeners.add(listener);
      return () => readerListeners.delete(listener);
    },
    suspendNavigation() {
      readerOwned = true;
      cleanupTooltipEvents?.();
      cleanupTooltipEvents = null;
      tooltipManager?.hide();
      return () => {
        readerOwned = false;
        if (!destroyed && svgElement)
          cleanupTooltipEvents = wireTooltipAndInteraction(svgElement, currentLayout);
      };
    },
  });
  return instance;
}
