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
import { BREAKPOINT_COMPACT_MAX, BREAKPOINT_MEDIUM_MAX } from '@opendata-ai/openchart-core';
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
// Responsive tile sizing
// ---------------------------------------------------------------------------

// The state grid is 8 rows tall (see engine/tilemap/layout.ts GRID_ROWS).
// TILEMAP_TILE_GAP must match the gap passed to computeTilePositions in
// compile-tilemap.ts (currently 5) so the mount's height budget matches the
// grid the compiler builds.
const TILEMAP_GRID_ROWS = 8;
const TILEMAP_TILE_GAP = 5;
// Generous vertical reserve for chrome (title/subtitle/source) + padding +
// legend. Intentionally over-reserved: on narrow widths we WANT tile size to be
// bound by width, so any excess height budget just lets the map grow taller
// (which is the desired mobile behavior) rather than starving the tiles.
const TILEMAP_CHROME_RESERVE = 180;

/**
 * Target tile size (px) for a given container width. Drives the height budget
 * on non-desktop widths so the 8-row grid isn't starved to tiny tiles after
 * chrome is subtracted from a square drawing area. Width still caps the actual
 * tile size, so these are ceilings the layout grows toward, not guarantees.
 */
function pickTargetTileSize(width: number): number {
  if (width < BREAKPOINT_COMPACT_MAX) return 34; // compact / mobile
  return 40; // medium (tablet, sidebars)
}

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

  // Latches whether the host constrains our height. Measured once, on the
  // first render that produces a real rect: height 0 with a real width means
  // the host is auto-height and we pick our own budget. Any other height is
  // an explicit box we must fit inside. Re-reading this after the first paint
  // would just measure our own SVG, so the value has to latch.
  let isAutoHeight: boolean | null = null;

  // Set when webfonts have loaded and a recompile is owed. The next render()
  // that recompiles flips data-oc-fonts-state to 'ready' and clears this, so
  // the attribute stays honest when resize() defers to pendingResize during
  // the entrance animation.
  let fontsReloadPending = false;

  // Apply the root class up front so getComputedStyle sees --oc-font-family
  // before the text measurer is built.
  container.classList.add('oc-tilemap-root');

  // Resolve the effective font the way compile() will: compile merges
  // { ...spec.theme, ...options.theme }, so options.theme wins over the
  // spec-level theme; fall back to the container's computed font. Measuring a
  // different font than gets rendered desyncs layout metrics and the reload watcher.
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

    if (isAutoHeight === null && (rect.width > 0 || rect.height > 0)) {
      isAutoHeight = rect.height === 0 && rect.width > 0;
    }

    // An explicit host height is a hard budget: the compiler derives a tight
    // content height from whatever we pass, so handing it the container's own
    // height keeps the SVG inside its box instead of overflowing onto whatever
    // sits below it.
    if (isAutoHeight === false && rect.height > 0) {
      return { width, height: Math.max(rect.height, 100) };
    }

    // Auto-height host: pick our own budget. The compiler derives its own tight
    // content height and treats the passed height as a cap. On desktop, a square
    // budget (height = width) keeps tiles from ballooning (the 8-row grid becomes
    // the binding constraint at ~width/8). Below desktop, a square budget starves
    // the grid after chrome, so give it a height budget sized to a comfortable
    // target tile instead — the map then grows taller as needed rather than
    // shrinking the tiles.
    if (width >= BREAKPOINT_MEDIUM_MAX) {
      return { width, height: width };
    }
    const targetTile = pickTargetTileSize(width);
    const height =
      targetTile * TILEMAP_GRID_ROWS +
      TILEMAP_TILE_GAP * (TILEMAP_GRID_ROWS - 1) +
      TILEMAP_CHROME_RESERVE;
    return { width, height };
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
    if (animate && currentLayout.animation?.enter) {
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

    // This render recompiled with the loaded webfonts; publish 'ready' now
    // rather than right after the fonts-ready resize() (which may have deferred
    // to pendingResize during the entrance animation).
    if (fontsReloadPending) {
      fontsReloadPending = false;
      container.dataset.ocFontsState = 'ready';
    }
  }

  function update(newSpec: TileMapSpec): void {
    currentSpec = newSpec;
    // A new spec can change theme.fonts.family; rebuild the measurer so layout
    // measures the font compile will actually render with.
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
      // Mark the reload owed, then recompile. render() flips the attribute to
      // 'ready' once it actually recompiles, including the pendingResize replay
      // after the entrance animation finishes.
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
    get layout(): TileMapLayout {
      return currentLayout;
    },
  };
}
