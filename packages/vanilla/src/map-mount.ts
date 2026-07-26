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
  applyMapCamera,
  cameraForTarget,
  FOCUS_DIM_OPACITY,
  focusTargetForFeatures,
  type GeoMapCameraOptions,
} from './map-camera';
import { renderMapSVG } from './map-renderer';
import { captureMapSnapshot, runMapFillTransition } from './map-transition';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
import { resolveDarkMode } from './resolve-dark-mode';
import type { Camera } from './story/camera-math';
import { interpolateCamera } from './story/camera-math';
import type { Tween } from './story/tween';
import { createTween, easingFns, storyMotion } from './story/tween';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeoMapMarkEvent = {
  kind: 'feature' | 'point';
  id: string | number;
  name?: string;
  data: Record<string, unknown> | null;
};

export interface GeoMapMountOptions {
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting: "auto" (system pref), "force", or "off". */
  darkMode?: DarkMode;
  /** Enable responsive resizing. Defaults to true. */
  responsive?: boolean;
  /** Show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Show tooltips on hover. Defaults to true. */
  tooltip?: boolean;
  /** Callback when a feature or point is clicked. */
  onMarkClick?: (event: GeoMapMarkEvent) => void;
  /** Callback when a feature or point is hovered (null on mouse leave). */
  onMarkHover?: (event: GeoMapMarkEvent | null) => void;
}

export interface GeoMapInstance {
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
  getCamera(): Camera;
  /** Set the camera to an exact state (no animation). */
  setCamera(camera: Camera): void;
}

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

  // Track whether this is the first render (for snap-to-focus).
  let isFirstRender = true;

  // Set when webfonts have loaded and a recompile is owed.
  let fontsReloadPending = false;

  // Apply the root class up front so getComputedStyle sees --oc-font-family
  container.classList.add('oc-map-root');

  // Resolve the effective font the same way compile() will.
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

  function compile(): GeoMapLayout {
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

    return compileGeoMap(currentSpec, compileOpts);
  }

  // ---------------------------------------------------------------------------
  // Tooltip and interaction wiring
  // ---------------------------------------------------------------------------

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: GeoMapLayout): () => void {
    const cleanups: Array<() => void> = [];

    const featureElements = svg.querySelectorAll('.oc-map-feature');
    for (const el of featureElements) {
      const featureId = el.getAttribute('data-feature-id');
      if (!featureId) continue;

      const content = layout.tooltipDescriptors.get(featureId);
      const feature = layout.features.find((f) => String(f.id) === featureId);

      const handleMouseEnter = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty('cursor', 'pointer');
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty('filter', 'brightness(1.1)');
        if (content && tooltipManager && options?.tooltip !== false) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        if (feature) {
          options?.onMarkHover?.({
            kind: 'feature',
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
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('cursor');
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('filter');
        tooltipManager?.hide();
        options?.onMarkHover?.(null);
      };

      const handleClick = () => {
        if (feature) {
          options?.onMarkClick?.({
            kind: 'feature',
            id: feature.id,
            name: feature.name,
            data: feature.data,
          });
        }
      };

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

    // Wire point interactions
    const pointMarksByKey = new Map(layout.pointMarks.map((p) => [p.key, p]));
    const pointElements = svg.querySelectorAll('.oc-map-point');
    for (const el of pointElements) {
      const pointKey = el.getAttribute('data-point-key');
      if (!pointKey) continue;

      const content = layout.tooltipDescriptors.get(`point:${pointKey}`);
      const pointMark = pointMarksByKey.get(pointKey);

      const handlePointMouseEnter = (e: Event) => {
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
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('cursor');
        (el as SVGElement & ElementCSSInlineStyle).style.removeProperty('filter');
        tooltipManager?.hide();
        options?.onMarkHover?.(null);
      };

      const handlePointClick = () => {
        if (pointMark) {
          options?.onMarkClick?.({
            kind: 'point',
            id: pointKey,
            data: pointMark.data,
          });
        }
      };

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

    return () => {
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
      const target = focusTargetForFeatures(currentLayout, currentFocusIds);
      return cameraForTarget(currentLayout, target);
    }
    return cameraForTarget(currentLayout, null);
  }

  function animateCamera(target: Camera, duration: number): void {
    if (cameraTween) cameraTween.cancel();
    cameraTween = createTween<Camera>({
      initial: currentCamera,
      lerp: interpolateCamera,
      duration,
      ease: easingFns.easeInOutCubic,
      onFrame(cam) {
        currentCamera = cam;
        if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
      },
    });
    cameraTween.to(target);
  }

  function driveCamera(cam: Camera, duration: number): void {
    if (duration === 0 || prefersReducedMotion()) {
      currentCamera = cam;
      if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
    } else {
      animateCamera(cam, duration);
    }
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

  function applyFocusDim(ids: Array<string | number> | null): void {
    if (!svgElement) return;
    const features = svgElement.querySelectorAll('.oc-map-feature');
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
    const newSvg = renderMapSVG(currentLayout, { animate });

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

    // Wire interactions
    cleanupTooltipEvents = wireTooltipAndInteraction(newSvg, currentLayout);

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
  }

  function update(newSpec: GeoMapSpec): void {
    currentSpec = newSpec;
    const nextFont = resolveEffectiveFont();
    if (nextFont !== fontFamily) {
      fontFamily = nextFont;
      measureText = createMeasureText(fontFamily);
    }

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

    currentLayout = compile();
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
    if (cameraTween) {
      cameraTween.cancel();
      cameraTween = null;
    }

    currentLayout = compile();
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
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  function exportChart(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    options_?: JPGExportOptions | SVGExportOptions,
  ): string | Promise<Blob> | Promise<string> {
    if (!svgElement) return '';

    switch (format) {
      case 'svg':
        return exportSVG(svgElement);
      case 'svg-with-fonts':
        return exportSVGWithFonts(svgElement);
      case 'png':
        return exportPNG(svgElement, options_ as JPGExportOptions);
      case 'jpg':
        return exportJPG(svgElement, options_ as JPGExportOptions);
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
    if (cameraTween) {
      cameraTween.cancel();
      cameraTween = null;
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
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => {
      resize();
    });
  }

  return {
    update,
    resize,
    export: exportChart,
    destroy,
    get layout(): GeoMapLayout {
      return currentLayout;
    },
    zoomTo(featureId: string | number | Array<string | number>, opts?: GeoMapCameraOptions): void {
      const ids = Array.isArray(featureId) ? featureId : [featureId];
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
      currentFocusIds = null;
      const cam = cameraForTarget(currentLayout, target ?? null);
      driveCamera(cam, opts?.duration ?? storyMotion.camera);
      applyFocusDim(null);
    },
    resetView(opts?: GeoMapCameraOptions): void {
      currentFocusIds = null;
      const cam = cameraForTarget(currentLayout, null);
      driveCamera(cam, opts?.duration ?? storyMotion.camera);
      applyFocusDim(null);
      updateA11yLive(null);
    },
    getCamera(): Camera {
      return { ...currentCamera };
    },
    setCamera(camera: Camera): void {
      currentCamera = camera;
      currentFocusIds = null;
      if (svgElement) applyMapCamera(svgElement, camera, currentLayout);
    },
  };
}
