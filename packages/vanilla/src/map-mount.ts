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
import { renderMapSVG } from './map-renderer';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
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
  let pendingResize = false;

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

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width || 600, 100);
    // Maps use a roughly square aspect ratio; let the compiler derive the
    // tight content height from the projection and chrome.
    return { width, height: width };
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
  // Render + update
  // ---------------------------------------------------------------------------

  function render(animate = false): void {
    // Cancel running animations
    if (animationCleanup) {
      animationCleanup();
      animationCleanup = null;
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

    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);

    if (fontsReloadPending) {
      fontsReloadPending = false;
      container.dataset.ocFontsState = 'ready';
    }

    // Emit compile warnings
    for (const warning of currentLayout.warnings) {
      console.warn(`[openchart] ${warning.code}: ${warning.message}`);
    }
  }

  function update(newSpec: MapSpec): void {
    currentSpec = newSpec;
    const nextFont = resolveEffectiveFont();
    if (nextFont !== fontFamily) {
      fontFamily = nextFont;
      measureText = createMeasureText(fontFamily);
    }
    currentLayout = compile();
    render();
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
  };
}
