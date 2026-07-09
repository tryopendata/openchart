/**
 * BarList mount API: the main entry point for vanilla JS barlist usage.
 *
 * createBarList() takes a container, BarListSpec, and options, compiles the
 * barlist, renders it as SVG, sets up responsive resizing, tooltip interaction,
 * and returns a BarListInstance with update/resize/export/destroy.
 */

import type {
  BarListLayout,
  BarListSpec,
  CompileOptions,
  DarkMode,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { compileBarList } from '@opendata-ai/openchart-engine';
import { cancelAnimations, setupAnimationCleanup } from './animation';
import { renderBarListSVG } from './barlist-renderer';
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
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BarListMountOptions {
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  responsive?: boolean;
  watermark?: boolean;
  tooltip?: boolean;
  onRowClick?: (row: { label: string; value: number; data: Record<string, unknown> }) => void;
  onRowHover?: (
    row: { label: string; value: number; data: Record<string, unknown> } | null,
  ) => void;
}

export interface BarListInstance {
  update(spec: BarListSpec): void;
  resize(): void;
  export(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg',
    options?: JPGExportOptions | SVGExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  destroy(): void;
  readonly layout: BarListLayout;
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

export function createBarList(
  container: HTMLElement,
  spec: BarListSpec,
  options?: BarListMountOptions,
): BarListInstance {
  let currentSpec = spec;
  let currentLayout: BarListLayout;
  let destroyed = false;

  let svgElement: SVGSVGElement | null = null;
  let tooltipManager: TooltipManager | null = null;
  let cleanupTooltipEvents: (() => void) | null = null;
  let disconnectResize: (() => void) | null = null;
  let animationCleanup: (() => void) | null = null;
  let pendingResize = false;

  // Set when webfonts have loaded and a recompile is owed. The next render()
  // that recompiles flips data-oc-fonts-state to 'ready' and clears this, so
  // the attribute stays honest when resize() defers to pendingResize during
  // the entrance animation.
  let fontsReloadPending = false;

  // Apply the root class up front so getComputedStyle sees --oc-font-family
  // before the text measurer is built.
  container.classList.add('oc-barlist-root');

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

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  function compile(): BarListLayout {
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

    const layout = compileBarList(currentSpec, compileOpts);

    // Auto-size height to content so few-row lists don't leave empty space.
    if (layout.rows.length > 0) {
      const lastRow = layout.rows[layout.rows.length - 1];
      const contentBottom =
        lastRow.y + lastRow.height + layout.chrome.bottomHeight + layout.theme.spacing.padding;
      if (contentBottom < layout.height) {
        layout.height = contentBottom;
        layout.area.height =
          contentBottom - layout.area.y - layout.chrome.bottomHeight - layout.theme.spacing.padding;
      }
    }

    return layout;
  }

  function wireTooltipAndInteraction(svg: SVGSVGElement, layout: BarListLayout): () => void {
    const cleanups: Array<() => void> = [];

    const rowElements = svg.querySelectorAll('.oc-barlist-row');
    for (const el of rowElements) {
      const indexStr = el.getAttribute('data-row-index');
      if (indexStr === null) continue;

      const content = layout.tooltipDescriptors.get(indexStr);
      const row = layout.rows[Number(indexStr)];

      const handleMouseEnter = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        if (content && tooltipManager && options?.tooltip !== false) {
          const svgRect = svg.getBoundingClientRect();
          const x = mouseEvent.clientX - svgRect.left;
          const y = mouseEvent.clientY - svgRect.top;
          tooltipManager.show(content, x, y);
        }
        if (row) {
          options?.onRowHover?.({
            label: row.label.text,
            value: row.value,
            data: row.data,
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
        options?.onRowHover?.(null);
      };

      const handleClick = () => {
        if (row) {
          options?.onRowClick?.({
            label: row.label.text,
            value: row.value,
            data: row.data,
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
      for (const cleanup of cleanups) cleanup();
    };
  }

  function render(animate = false): void {
    if (animationCleanup) {
      animationCleanup();
      animationCleanup = null;
    }

    if (svgElement) {
      if (cleanupTooltipEvents) {
        cleanupTooltipEvents();
        cleanupTooltipEvents = null;
      }
      svgElement.remove();
    }

    const newSvg = renderBarListSVG(currentLayout, { animate });
    container.appendChild(newSvg);
    svgElement = newSvg;

    cleanupTooltipEvents = wireTooltipAndInteraction(newSvg, currentLayout);

    if (options?.tooltip !== false) {
      if (!tooltipManager) {
        tooltipManager = createTooltipManager(container);
      }
    }

    if (currentLayout.animation?.enter) {
      animationCleanup = setupAnimationCleanup(newSvg, () => {
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

  function update(newSpec: BarListSpec): void {
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
    if (animationCleanup) {
      pendingResize = true;
      return;
    }
    currentLayout = compile();
    render();
  }

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

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    if (animationCleanup) {
      cancelAnimations(svgElement);
      animationCleanup();
      animationCleanup = null;
    }

    if (cleanupTooltipEvents) {
      cleanupTooltipEvents();
      cleanupTooltipEvents = null;
    }

    if (svgElement) {
      svgElement.remove();
      svgElement = null;
    }

    if (tooltipManager) {
      tooltipManager.destroy();
      tooltipManager = null;
    }

    if (disconnectResize) {
      disconnectResize();
      disconnectResize = null;
    }

    container.classList.remove('oc-barlist-root', 'oc-dark');
  }

  // Initialize
  if (resolveDarkMode(options?.darkMode)) {
    container.classList.add('oc-dark');
  }

  currentLayout = compile();
  render(true);

  // Recompile once after webfonts load so row labels aren't stuck measured
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

  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => resize());
  }

  return {
    update,
    resize,
    export: exportChart,
    destroy,
    get layout(): BarListLayout {
      return currentLayout;
    },
  };
}
