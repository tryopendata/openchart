import { createRenderContext, pageIdScope } from './render-context';
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
  TooltipContent,
} from '@opendata-ai/openchart-core';
import { BREAKPOINT_COMPACT_MAX, BREAKPOINT_MEDIUM_MAX } from '@opendata-ai/openchart-core';
import { compileTileMap } from '@opendata-ai/openchart-engine';
import { cancelAnimations } from './animation';
import { createEntranceLifecycle } from './entrance-lifecycle';
import {
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
  type JPGExportOptions,
  type SVGExportOptions,
} from './export';
import type { GIFExportOptions } from './export-gif';
import { exportEntranceGIF } from './export-gif-lazy';
import {
  captureMarkFocus,
  type NavigableMark,
  restoreMarkFocus,
  wireMarkNavigation,
} from './interactions/mark-navigation';
import { createMeasureText, resolveFontFamily, scheduleFontReload } from './measure-text';
import {
  type ElementTween,
  type ElementTweenHandle,
  numAttr,
  runElementTweens,
} from './motion/element-tween';
import { tileMapPlaybackAdapter } from './playback/map-adapters';
import { createMapPlaybackHost } from './playback/map-playback-host';
import type { PlaybackController } from './playback/types';
import { observeResize } from './resize-observer';
import { resolveDarkMode } from './resolve-dark-mode';
import { prepareSettledExportTheme } from './theme-style-block';
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
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  /** Show the OpenChart watermark. Defaults to true. */
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
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg' | 'gif',
    options?: JPGExportOptions | SVGExportOptions | GIFExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  /** Remove all DOM elements and disconnect observers. */
  destroy(): void;
  /** The current compiled layout. */
  readonly layout: TileMapLayout;
  /** Playback controls for a spec with a time channel; null when the spec has none. */
  readonly playback: PlaybackController | null;
}

// ---------------------------------------------------------------------------
// Update tween
// ---------------------------------------------------------------------------

/** A tile's paint as drawn right now (mid-tween values included). */
interface TilePaint {
  fill: string | null;
  fillOpacity: number | undefined;
  /** Inline `fill` of the code label, then the value label. */
  labels: string[];
}

const styleFill = (el: Element) =>
  (el as Element & ElementCSSInlineStyle).style.getPropertyValue('fill');

function captureTiles(svg: SVGSVGElement | null): Map<string, TilePaint> {
  const tiles = new Map<string, TilePaint>();
  if (!svg) return tiles;
  for (const tile of svg.querySelectorAll('.oc-tilemap-tile[data-state]')) {
    const rect = tile.querySelector('rect');
    tiles.set(tile.getAttribute('data-state')!, {
      fill: rect?.getAttribute('fill') ?? null,
      fillOpacity: rect ? numAttr(rect, 'fill-opacity') : undefined,
      labels: [...tile.querySelectorAll('text')].map(styleFill),
    });
  }
  return tiles;
}

/** Geography is fixed, so tiles only recolour: fill, fill-opacity, label colour. */
function buildTileTweens(prev: Map<string, TilePaint>, svg: SVGSVGElement): ElementTween[] {
  const tweens: ElementTween[] = [];
  for (const tile of svg.querySelectorAll('.oc-tilemap-tile[data-state]')) {
    const before = prev.get(tile.getAttribute('data-state')!);
    if (!before) continue;
    const rect = tile.querySelector('rect');
    if (rect) {
      const fill = rect.getAttribute('fill');
      if (before.fill && fill && before.fill !== fill) {
        tweens.push({ kind: 'color', el: rect, attr: 'fill', from: before.fill, to: fill });
      }
      const opacity = numAttr(rect, 'fill-opacity');
      if (
        before.fillOpacity !== undefined &&
        opacity !== undefined &&
        before.fillOpacity !== opacity
      ) {
        tweens.push({
          kind: 'number',
          el: rect,
          attr: 'fill-opacity',
          from: before.fillOpacity,
          to: opacity,
        });
      }
    }
    const labels = tile.querySelectorAll('text');
    labels.forEach((label, i) => {
      const from = before.labels[i];
      const to = styleFill(label);
      if (from && to && from !== to) {
        tweens.push({ kind: 'color', el: label, attr: 'fill', from, to, style: true });
      }
    });
  }
  return tweens;
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
  // Owed until a render has a tile with data: a tile map mounted before its
  // data arrives enters on the first update that brings some.
  // Waiting (held until seen): every re-render re-arms it on the new SVG.
  // Playing: resizes defer and replay after it settles; updates snap.
  const entrance = createEntranceLifecycle({ onDeferredResize: () => resize() });
  // Re-shows the hovered tile's tooltip; playback calls it when the period changes.
  let refreshHoveredTooltip: (() => void) | null = null;
  // A time spec's motion is the playback itself: no entrance, no update tween.
  const playback = createMapPlaybackHost(container, tileMapPlaybackAdapter, {
    onPeriodChange: () => refreshHoveredTooltip?.(),
  });
  // In-flight data-update tween; every render() and destroy() snaps it.
  let updateTween: ElementTweenHandle | null = null;

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

  function getContainerDimensions(candidate = currentSpec): { width: number; height: number } {
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
      // The playback controls strip sits below the SVG, inside the host's box.
      return { width, height: Math.max(rect.height - playback.stripHeight(candidate), 100) };
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

  function compile(candidate = currentSpec, measure = measureText): TileMapLayout {
    const { width, height } = getContainerDimensions(candidate);
    const darkMode = resolveDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      watermark: options?.watermark,
      measureText: measure,
    };

    return playback.isPlaybackSpec(candidate)
      ? playback.compile(candidate, compileOpts)
      : compileTileMap(candidate, compileOpts);
  }

  // ---------------------------------------------------------------------------
  // Tooltip and interaction wiring
  // ---------------------------------------------------------------------------

  /**
   * Show `content()` at the pointer, and keep showing the hovered tile's current content
   * there as playback moves the period.
   */
  function showTooltipAt(
    svg: SVGSVGElement,
    content: () => TooltipContent | undefined,
    event: MouseEvent,
  ): void {
    const svgRect = svg.getBoundingClientRect();
    const x = event.clientX - svgRect.left;
    const y = event.clientY - svgRect.top;
    refreshHoveredTooltip = () => {
      const shown = content();
      if (shown && tooltipManager && options?.tooltip !== false) tooltipManager.show(shown, x, y);
    };
    refreshHoveredTooltip();
  }

  function hideTooltip(): void {
    refreshHoveredTooltip = null;
    tooltipManager?.hide();
  }

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: TileMapLayout): () => void {
    const cleanups: Array<() => void> = [];
    const navigation: NavigableMark[] = [];
    let activeLeave: (() => void) | null = null;

    const tilesByStateCode = new Map<string, (typeof layout.tiles)[number]>();
    for (const t of layout.tiles) {
      if (!tilesByStateCode.has(t.stateCode)) tilesByStateCode.set(t.stateCode, t);
    }

    // Wire tooltip on tile elements. The group carries the hover state so the
    // dim rule can be a single class toggle rather than 51 of them.
    const tilesGroup = svg.querySelector('.oc-tilemap-tiles');
    const tileElements = svg.querySelectorAll('.oc-tilemap-tile');
    for (const el of tileElements) {
      const stateCode = el.getAttribute('data-state');
      if (!stateCode) continue;

      const tooltipContent = () => layout.tooltipDescriptors.get(stateCode);
      const tile = tilesByStateCode.get(stateCode);

      const handleMouseEnter = (e: Event) => {
        activeLeave?.();
        activeLeave = handleMouseLeave;
        const mouseEvent = e as MouseEvent;
        tilesGroup?.classList.add('oc-hover-active');
        el.classList.add('oc-tilemap-tile--hover');
        showTooltipAt(svg, tooltipContent, mouseEvent);
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
        showTooltipAt(svg, tooltipContent, e as MouseEvent);
      };

      const handleMouseLeave = () => {
        if (activeLeave !== handleMouseLeave) return;
        activeLeave = null;
        tilesGroup?.classList.remove('oc-hover-active');
        el.classList.remove('oc-tilemap-tile--hover');
        hideTooltip();
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

      navigation.push({
        element: el,
        key: stateCode,
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

    cleanups.push(wireMarkNavigation(svg, navigation));
    return () => {
      activeLeave?.();
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Render + update
  // ---------------------------------------------------------------------------

  function render(): void {
    const focusedMark = captureMarkFocus(svgElement);
    hideTooltip();
    updateTween?.cancel();
    updateTween = null;
    // Cancel the running entrance; one still waiting to be seen re-arms.
    entrance.reset();
    const hasData = currentLayout.tiles.some((tile) => tile.hasData);
    const animate = entrance.claim(
      hasData,
      !!currentLayout.animation?.enter && !playback.isPlaybackSpec(currentSpec),
    );

    // Remove old SVG
    if (svgElement) {
      if (cleanupTooltipEvents) {
        cleanupTooltipEvents();
        cleanupTooltipEvents = null;
      }
      svgElement.remove();
    }

    // Render new SVG
    const newSvg = renderTileMapSVG(currentLayout, {
      context: createRenderContext({ ids: pageIdScope }),
      animate,
    });
    container.appendChild(newSvg);
    svgElement = newSvg;
    playback.render({
      svg: newSvg,
      layout: currentLayout,
      spec: currentSpec,
      darkMode: resolveDarkMode(options?.darkMode),
    });

    // Wire interactions
    cleanupTooltipEvents = wireTooltipAndInteraction(newSvg, currentLayout);

    // Setup tooltips if enabled
    if (options?.tooltip !== false) {
      if (!tooltipManager) {
        tooltipManager = createTooltipManager(container);
      }
    }

    // The entrance holds paused until the chart scrolls into view; cleanup
    // starts when it plays. Under reduced motion nothing plays, so no
    // entrance window opens.
    if (animate && currentLayout.animation?.enter) {
      entrance.arm({ container, root: newSvg, trigger: currentLayout.animation.enter.trigger });
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
    if (svgElement) restoreMarkFocus(svgElement, focusedMark);
  }

  function update(newSpec: TileMapSpec): void {
    if (destroyed) return;
    // Compile before adopting an edit: a rejected spec must leave the last
    // valid view, its interactions, and future resize/export calls intact.
    const nextFont = resolveEffectiveFont(newSpec);
    const nextMeasure = nextFont === fontFamily ? measureText : createMeasureText(nextFont);
    const nextLayout = compile(newSpec, nextMeasure);
    currentSpec = newSpec;
    fontFamily = nextFont;
    measureText = nextMeasure;

    // Read the tiles as drawn before render() snaps any in-flight tween, so
    // an interrupting update continues from what is on screen.
    const update = playback.isPlaybackSpec(newSpec) ? undefined : nextLayout.animation?.update;
    const prevTiles =
      update && !entrance.playing && !entrance.waiting ? captureTiles(svgElement) : null;

    currentLayout = nextLayout;
    // An update while the entrance waits to be seen re-arms it on the new
    // data; one while it plays snaps.
    render();

    // No tween when this render armed the entrance (the map's first data).
    if (update && prevTiles?.size && svgElement && !entrance.waiting && !entrance.playing) {
      updateTween = runElementTweens(buildTileTweens(prevTiles, svgElement), {
        update,
        exit: nextLayout.animation?.exit,
        maxMarks: update.maxMarks,
      });
    }
  }

  function resize(): void {
    if (destroyed) return;

    // If the entrance is playing, queue the resize for after it settles
    if (!entrance.admitResize()) return;

    currentLayout = compile();
    render();
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  function exportChart(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg' | 'gif',
    options_?: JPGExportOptions | SVGExportOptions | GIFExportOptions,
  ): string | Promise<Blob> | Promise<string> {
    if (!svgElement) return '';
    const playbackGIF =
      format === 'gif' &&
      playback.exportGIF(svgElement, {
        theme: currentLayout.theme,
        ...(options_ as GIFExportOptions | undefined),
      });
    if (playbackGIF) return playbackGIF;

    // Export settled geometry, independent of transient hover and animation.
    // Only the GIF keeps the entrance stamps its frame sampler reads; it drops
    // `oc-animate` so nothing plays on the detached copy.
    const animate = format === 'gif';
    const terminalSvg = renderTileMapSVG(currentLayout, {
      context: createRenderContext({ ids: pageIdScope }),
      animate,
    });
    if (animate) cancelAnimations(terminalSvg);
    // A time map exports the frame on screen.
    playback.drawFrame(terminalSvg);
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
      case 'gif':
        return exportEntranceGIF(terminalSvg, currentLayout.animation, resolvedOptions);
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

    // Cancel the running entrance and any update tween
    entrance.destroy();
    playback.destroy();
    updateTween?.cancel();
    updateTween = null;

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
  render();

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
  if (options?.autoResize !== false) {
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
    get playback(): PlaybackController | null {
      return playback.controller;
    },
  };
}
