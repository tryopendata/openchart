/**
 * Map mount API: the main entry point for vanilla JS map usage.
 *
 * createMap() takes a container, MapSpec, and options, compiles the
 * map, renders it as SVG, sets up responsive resizing, tooltip interaction,
 * and returns a MapInstance with update/resize/export/destroy.
 */

import type {
  CompileOptions,
  DarkMode,
  MapLayout,
  MapSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { compileMap } from '@opendata-ai/openchart-engine';
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
  focusTargetForFeatures,
  type MapCameraOptions,
} from './map-camera';
import { renderMapSVG } from './map-renderer';
import { captureFeatureFills, runMapFillTransition } from './map-transition';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
import type { Camera } from './story/camera-math';
import { interpolateCamera } from './story/camera-math';
import type { Tween } from './story/tween';
import { createTween, easingFns, storyMotion } from './story/tween';
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapMountOptions {
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
  /** Callback when a feature is clicked. */
  onMarkClick?: (feature: {
    id: string | number;
    name?: string;
    data: Record<string, unknown> | null;
  }) => void;
  /** Callback when a feature is hovered (null on mouse leave). */
  onMarkHover?: (
    feature: {
      id: string | number;
      name?: string;
      data: Record<string, unknown> | null;
    } | null,
  ) => void;
}

export interface MapInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: MapSpec): void;
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
  readonly layout: MapLayout;
  /** Zoom to one or more features by ID. */
  zoomTo(featureId: string | number | Array<string | number>, opts?: MapCameraOptions): void;
  /** Pan to a feature keeping the current zoom level. */
  panTo(featureId: string | number, opts?: MapCameraOptions): void;
  /** Fit the camera to an arbitrary bounding box, or reset to full view if no target. */
  fitBounds(
    target?: { x: number; y: number; width: number; height: number; padding?: number },
    opts?: MapCameraOptions,
  ): void;
  /** Reset the camera to the full map view. */
  resetView(opts?: MapCameraOptions): void;
  /** Get a snapshot of the current camera state. */
  getCamera(): Camera;
  /** Set the camera to an exact state (no animation). */
  setCamera(camera: Camera): void;
}

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  );
}

function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a map instance from a spec and mount it into a container.
 */
export function createMap(
  container: HTMLElement,
  spec: MapSpec,
  options?: MapMountOptions,
): MapInstance {
  let currentSpec = spec;
  let currentLayout: MapLayout;
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

  function compile(): MapLayout {
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

    return compileMap(currentSpec, compileOpts);
  }

  // ---------------------------------------------------------------------------
  // Tooltip and interaction wiring
  // ---------------------------------------------------------------------------

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: MapLayout): () => void {
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

    // Remove old SVG
    if (svgElement) {
      if (cleanupTooltipEvents) {
        cleanupTooltipEvents();
        cleanupTooltipEvents = null;
      }
      svgElement.remove();
    }

    // Render new SVG
    const newSvg = renderMapSVG(currentLayout, { animate });
    container.appendChild(newSvg);
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
    if (animate && currentLayout.animation?.enter) {
      animationCleanup = setupAnimationCleanup(newSvg, () => {
        if (pendingResize && !destroyed) {
          pendingResize = false;
          resize();
        }
      });
    }

    // Re-apply camera transform after render if zoomed or focused
    if (currentCamera.k > 1 + 1e-3 || currentFocusIds) {
      applyMapCamera(newSvg, currentCamera, currentLayout);
    }

    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);

    if (fontsReloadPending) {
      fontsReloadPending = false;
      container.dataset.ocFontsState = 'ready';
    }

    // On first render, snap to declarative focus if present
    if (isFirstRender && currentLayout.focus) {
      const target = currentLayout.focus.target;
      currentFocusIds = [...currentLayout.focus.ids];
      const cam = cameraForTarget(currentLayout, target);
      currentCamera = cam;
      if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
    }
    isFirstRender = false;
  }

  function update(newSpec: MapSpec): void {
    currentSpec = newSpec;
    const nextFont = resolveEffectiveFont();
    if (nextFont !== fontFamily) {
      fontFamily = nextFont;
      measureText = createMeasureText(fontFamily);
    }

    // Capture current fills before re-render
    const shouldAnimate =
      !animationCleanup && currentLayout.animation?.update && !prefersReducedMotion();
    const prevFills = shouldAnimate ? captureFeatureFills(svgElement) : null;

    // Remember previous focus to detect changes
    const prevFocusIds = currentFocusIds ? currentFocusIds.map(String).sort().join(',') : null;
    const prevFocusPadding = currentLayout.focus?.target.padding ?? null;

    currentLayout = compile();
    render();

    // Run fill tween if conditions met
    if (
      shouldAnimate &&
      prevFills &&
      prevFills.size > 0 &&
      svgElement &&
      currentLayout.animation?.update
    ) {
      fillTransitionHandle = runMapFillTransition(svgElement, prevFills, {
        duration: currentLayout.animation.update.duration,
      });
    }

    // Declarative focus from spec: tween camera if focus changed
    const nextFocus = currentLayout.focus;
    const nextFocusIds = nextFocus ? nextFocus.ids.map(String).sort().join(',') : null;
    const nextFocusPadding = nextFocus?.target.padding ?? null;

    if (nextFocusIds !== prevFocusIds || nextFocusPadding !== prevFocusPadding) {
      if (nextFocus) {
        currentFocusIds = [...nextFocus.ids];
        const cam = cameraForTarget(currentLayout, nextFocus.target);
        const duration = prefersReducedMotion() ? 0 : storyMotion.camera;
        if (duration === 0) {
          currentCamera = cam;
          if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
        } else {
          animateCamera(cam, duration);
        }
      } else if (prevFocusIds !== null) {
        // Focus cleared: tween back to full view
        currentFocusIds = null;
        const cam = cameraForTarget(currentLayout, null);
        const duration = prefersReducedMotion() ? 0 : storyMotion.camera;
        if (duration === 0) {
          currentCamera = cam;
          if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
        } else {
          animateCamera(cam, duration);
        }
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

    currentLayout = compile();
    render();

    // Re-resolve camera against new layout dimensions (layout focus or imperative)
    if (currentLayout.focus) {
      currentFocusIds = [...currentLayout.focus.ids];
      currentCamera = cameraForTarget(currentLayout, currentLayout.focus.target);
      if (svgElement) applyMapCamera(svgElement, currentCamera, currentLayout);
    } else if (currentFocusIds) {
      currentCamera = resolveCamera();
      if (svgElement) applyMapCamera(svgElement, currentCamera, currentLayout);
    }
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
    get layout(): MapLayout {
      return currentLayout;
    },
    zoomTo(featureId: string | number | Array<string | number>, opts?: MapCameraOptions): void {
      const ids = Array.isArray(featureId) ? featureId : [featureId];
      const target = focusTargetForFeatures(currentLayout, ids, opts?.padding ?? 16);
      if (!target) {
        console.warn(`[openchart] zoomTo: no features found for ids: ${ids.join(', ')}`);
        return;
      }
      currentFocusIds = ids;
      const cam = cameraForTarget(currentLayout, target);
      const duration = opts?.duration ?? storyMotion.camera;
      if (duration === 0 || prefersReducedMotion()) {
        currentCamera = cam;
        if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
        updateA11yLive(ids);
      } else {
        animateCamera(cam, duration);
        updateA11yLive(ids);
      }
    },
    panTo(featureId: string | number, opts?: MapCameraOptions): void {
      const target = focusTargetForFeatures(currentLayout, [featureId], opts?.padding ?? 16);
      if (!target) {
        console.warn(`[openchart] panTo: no feature found for id: ${featureId}`);
        return;
      }
      currentFocusIds = [featureId];
      // Keep current zoom level
      const cam = cameraForTarget(currentLayout, target);
      cam.k = currentCamera.k;
      const duration = opts?.duration ?? storyMotion.camera;
      if (duration === 0 || prefersReducedMotion()) {
        currentCamera = cam;
        if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
        updateA11yLive([featureId]);
      } else {
        animateCamera(cam, duration);
        updateA11yLive([featureId]);
      }
    },
    fitBounds(
      target?: { x: number; y: number; width: number; height: number; padding?: number },
      opts?: MapCameraOptions,
    ): void {
      currentFocusIds = null;
      const cam = cameraForTarget(currentLayout, target ?? null);
      const duration = opts?.duration ?? storyMotion.camera;
      if (duration === 0 || prefersReducedMotion()) {
        currentCamera = cam;
        if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
      } else {
        animateCamera(cam, duration);
      }
    },
    resetView(opts?: MapCameraOptions): void {
      currentFocusIds = null;
      const cam = cameraForTarget(currentLayout, null);
      const duration = opts?.duration ?? storyMotion.camera;
      if (duration === 0 || prefersReducedMotion()) {
        currentCamera = cam;
        if (svgElement) applyMapCamera(svgElement, cam, currentLayout);
        updateA11yLive(null);
      } else {
        animateCamera(cam, duration);
        updateA11yLive(null);
      }
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
