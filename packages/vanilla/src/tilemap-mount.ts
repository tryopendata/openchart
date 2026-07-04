/**
 * TileMap mount API: the main entry point for vanilla JS tilemap usage.
 *
 * createTileMap() takes a container, TileMapSpec, and options, compiles the
 * tilemap, renders it as SVG, sets up responsive resizing, tooltip interaction,
 * and returns a TileMapInstance with update/resize/export/destroy.
 */

import type {
  CompileOptions,
  DarkMode,
  ThemeConfig,
  TileMapLayout,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import { compileTileMap } from '@opendata-ai/openchart-engine';
import { cancelAnimations, setupAnimationCleanup } from './animation';
import {
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type JPGExportOptions,
  type SVGExportOptions,
} from './export';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import { observeResize } from './resize-observer';
import { renderTileMapSVG } from './tilemap-renderer';
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TileMapMountOptions {
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
  /** Callback when a tile is clicked. */
  onTileClick?: (tile: {
    stateCode: string;
    stateName: string;
    value: number | null;
    data: Record<string, unknown>;
  }) => void;
  /** Callback when a tile is hovered (null on mouse leave). */
  onTileHover?: (
    tile: {
      stateCode: string;
      stateName: string;
      value: number | null;
      data: Record<string, unknown>;
    } | null,
  ) => void;
}

export interface TileMapInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: TileMapSpec): void;
  /** Re-compile at current container dimensions. */
  resize(): void;
  /** Export the tilemap. */
  export(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    options?: JPGExportOptions | SVGExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  /** Remove all DOM elements and disconnect observers. */
  destroy(): void;
  /** The current compiled layout. */
  readonly layout: TileMapLayout;
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
 * Create a tilemap instance from a spec and mount it into a container.
 */
export function createTileMap(
  container: HTMLElement,
  spec: TileMapSpec,
  options?: TileMapMountOptions,
): TileMapInstance {
  let currentSpec = spec;
  let currentLayout: TileMapLayout;
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

  // Apply the root class up front so getComputedStyle sees --oc-font-family
  // before the text measurer is built.
  container.classList.add('oc-tilemap-root');
  const fontFamily = options?.theme?.fonts?.family ?? resolveFontFamily(container);
  const measureText = createMeasureText(fontFamily);
  let renderGen = 0;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width || 600, 100);
    // Height is derived from content by the compiler (tight viewBox),
    // so pass a large value to ensure width is the binding constraint.
    return { width, height: width };
  }

  function compile(): TileMapLayout {
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

    return compileTileMap(currentSpec, compileOpts);
  }

  // ---------------------------------------------------------------------------
  // Tooltip and interaction wiring
  // ---------------------------------------------------------------------------

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: TileMapLayout): () => void {
    const cleanups: Array<() => void> = [];

    // Wire tooltip on tile elements
    const tileElements = svg.querySelectorAll('.oc-tilemap-tile');
    for (const el of tileElements) {
      const stateCode = el.getAttribute('data-state');
      if (!stateCode) continue;

      const content = layout.tooltipDescriptors.get(stateCode);
      const tile = layout.tiles.find((t) => t.stateCode === stateCode);

      const handleMouseEnter = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        if (content && tooltipManager && options?.tooltip !== false) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        if (tile) {
          options?.onTileHover?.({
            stateCode: tile.stateCode,
            stateName: tile.data.stateName as string,
            value: tile.value,
            data: tile.data,
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
        tooltipManager?.hide();
        options?.onTileHover?.(null);
      };

      const handleClick = () => {
        if (tile) {
          options?.onTileClick?.({
            stateCode: tile.stateCode,
            stateName: tile.data.stateName as string,
            value: tile.value,
            data: tile.data,
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
    const newSvg = renderTileMapSVG(currentLayout, { animate });
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
    if (animate && currentLayout.animation?.enabled) {
      animationCleanup = setupAnimationCleanup(newSvg, () => {
        // On animation complete, check if resize was pending
        if (pendingResize && !destroyed) {
          pendingResize = false;
          resize();
        }
      });
    }

    renderGen += 1;
    container.dataset.ocRenderGen = String(renderGen);
  }

  function update(newSpec: TileMapSpec): void {
    currentSpec = newSpec;
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
    container.classList.remove('oc-tilemap-root', 'oc-dark');
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  // Root class was applied before the measurer was built (see above); dark
  // mode class still applies here.
  if (resolveDarkMode(options?.darkMode)) {
    container.classList.add('oc-dark');
  }

  // Initial compile and render (animate on first mount)
  currentLayout = compile();
  render(true);

  // Recompile once after webfonts load so labels aren't stuck measured
  // against fallback metrics on real devices.
  const fontsPending = scheduleFontReload(
    fontFamily,
    () => !destroyed,
    () => {
      resize();
      container.dataset.ocFontsState = 'ready';
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
    get layout(): TileMapLayout {
      return currentLayout;
    },
  };
}
