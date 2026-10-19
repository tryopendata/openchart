/**
 * Host-side sizing for chart mounts: how big the container is, whether the
 * host constrains its height, and how an auto-height figure grows with its
 * chrome. The engine sizes the figure inside the box this module measures.
 */

import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  LayerSpec,
} from '@opendata-ai/openchart-core';
import { isLayerSpec } from '@opendata-ai/openchart-core';
import {
  compileChart,
  compileLayer,
  facetMinHeight,
  legendGap,
} from '@opendata-ai/openchart-engine';

/**
 * Fallback height when the container doesn't constrain height. For
 * auto-height ChartSpec mounts this is the fixed budget for the
 * visualization itself (padding + axes + plot); chrome, the top legend
 * block, and the metrics bar grow the figure on top of it.
 */
export const FALLBACK_HEIGHT = 400;

type MountSpec = ChartSpec | LayerSpec;

export interface ChartSizer {
  /** Container size to compile against. Latches auto-height on first real measure. */
  dimensions(candidate: MountSpec): { width: number; height: number };
  /** Compile at the container size, growing auto-height figures by their chrome. */
  compile(candidate: MountSpec, options: Omit<CompileOptions, 'width' | 'height'>): ChartLayout;
  /** Record the rendered size for the self-induced-resize guard. */
  rendered(layout: ChartLayout): void;
  /**
   * Whether a ResizeObserver fire should re-render. An echo of our own SVG
   * height at an unchanged width is ignored; any other height change on an
   * auto-height mount un-latches it so the next measure re-derives.
   */
  shouldResize(width: number, height: number): boolean;
}

export function createChartSizer(container: HTMLElement): ChartSizer {
  // Auto-height sizing state. `isAutoHeight` latches whether the host
  // constrains the container's height:
  //   null  = unknown — every measurement so far was an all-zero rect
  //           (display:none / detached); keep re-checking each measure.
  //   true  = auto-height — the figure grows with chrome (ChartSpec only).
  //   false = explicit height — fit inside the host's box (today's behavior).
  // The latch matters because the SVG's own style.height gives the container
  // a nonzero rect after the first render, so auto-height cannot be
  // re-derived per measure.
  let isAutoHeight: boolean | null = null;
  let lastRenderedWidth: number | null = null;
  let lastRenderedSvgHeight: number | null = null;
  let lastHostHeight = FALLBACK_HEIGHT;

  function dimensions(candidate: MountSpec): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    const isSparkline = 'display' in candidate && (candidate as ChartSpec).display === 'sparkline';
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
    // Latch auto-height on the first NONZERO measurement: height 0 with a
    // real width means the host doesn't constrain height. An all-zero rect
    // (display:none / detached) stays "unknown" — keep re-checking until the
    // container produces a real measurement.
    if (isAutoHeight === null && (rect.width > 0 || rect.height > 0)) {
      isAutoHeight = rect.height === 0 && rect.width > 0;
    }
    // A min-height host can start with a nonzero box and then grow with its
    // SVG. Do not feed that output height back into chromeLayout: 'grow'.
    const ownHeight =
      lastRenderedSvgHeight !== null && Math.abs(rect.height - lastRenderedSvgHeight) < 0.5;
    if (!ownHeight && rect.height > 0) lastHostHeight = rect.height;

    return {
      width: Math.max(rect.width || 600, 100),
      // Latched-auto mounts always compile against the fixed budget: after
      // the first render the container's measured height is just our own
      // SVG, so reading it back would re-pin whatever we rendered last.
      height:
        isAutoHeight === true
          ? FALLBACK_HEIGHT
          : Math.max(ownHeight ? lastHostHeight : rect.height || FALLBACK_HEIGHT, 100),
    };
  }

  function compileAt(
    width: number,
    height: number,
    candidate: MountSpec,
    options: Omit<CompileOptions, 'width' | 'height'>,
  ): ChartLayout {
    const compileOpts: CompileOptions = { width, height, ...options };
    if (isLayerSpec(candidate)) return compileLayer(candidate, compileOpts);
    return compileChart(candidate, compileOpts);
  }

  function compile(
    candidate: MountSpec,
    options: Omit<CompileOptions, 'width' | 'height'>,
  ): ChartLayout {
    const { width, height } = dimensions(candidate);

    // Auto-height growth applies to ChartSpec mounts only. LayerSpec and
    // sparkline mounts keep the fixed-fallback behavior.
    const growsWithChrome =
      isAutoHeight === true && !isLayerSpec(candidate) && candidate.display !== 'sparkline';
    if (!growsWithChrome) {
      return compileAt(width, height, candidate, options);
    }

    // Bounded convergence loop, max 3 compiles. Chrome height depends on
    // width (text wrap), not height — but the engine's chrome-strip guardrail
    // strips chrome when the residual plot is too small, which makes chrome
    // height-dependent at the budget boundary: growing the figure can
    // un-strip chrome, changing the overheads once more. (Height classes are
    // not the issue — they only strip below 200/350px, and growing from 400
    // moves away from those thresholds.) Pass 3 is accepted unconditionally.
    let layout = compileAt(width, height, candidate, options);
    const overheads = verticalOverheads(layout, width);
    if (overheads > 0) {
      layout = compileAt(width, height + overheads, candidate, options);
      const overheads2 = verticalOverheads(layout, width);
      if (overheads2 !== overheads) {
        layout = compileAt(width, height + overheads2, candidate, options);
      }
    }
    return layout;
  }

  function rendered(layout: ChartLayout): void {
    lastRenderedWidth = layout.dimensions.width;
    lastRenderedSvgHeight = layout.dimensions.height;
  }

  function shouldResize(width: number, height: number): boolean {
    const widthChanged = lastRenderedWidth === null || Math.abs(width - lastRenderedWidth) >= 0.5;
    const selfInducedHeight =
      lastRenderedSvgHeight !== null && Math.abs(height - lastRenderedSvgHeight) < 0.5;
    if (!widthChanged && selfInducedHeight) return false;
    // Self-induced-resize guard, scoped to latched-auto mounts: growing
    // the SVG grows the container, which re-fires the observer. A fire
    // whose height matches the SVG we just rendered (and whose width is
    // unchanged) is our own echo — re-rendering on it would loop; the
    // 16ms debounce alone doesn't break the cycle. Any other height delta
    // is host-driven: un-latch so the next measure re-derives (and
    // re-latches explicit if the container now reports a height that
    // isn't ours). Explicit-height (and not-yet-latched) mounts re-render
    // on every fire.
    if (isAutoHeight === true && !selfInducedHeight) isAutoHeight = null;
    return true;
  }

  return { dimensions, compile, rendered, shouldResize };
}

/**
 * Vertical overheads that grow an auto-height figure beyond the
 * FALLBACK_HEIGHT budget: top+bottom chrome (bottom chrome already includes
 * a bottom legend's reservation), the top legend block (height + gap), and
 * the KPI metrics bar. topPad and the axis gap are plot clearance, not
 * chrome — they stay inside the budget.
 *
 * For faceted charts, extra rows beyond what the base budget can fit
 * also contribute: each additional row needs space for the panel itself
 * plus its header and gap.
 */
function verticalOverheads(layout: ChartLayout, width: number): number {
  // Sum EVERY top legend, not just the primary. A chart can carry a color
  // legend and a size legend; counting one and growing the container by its
  // height alone leaves the other squeezing the plot.
  let topLegendBlock = 0;
  for (const legend of layout.legends ?? [layout.legend]) {
    if (legend.position !== 'top') continue;
    const hasContent =
      legend.type === 'continuous' || legend.type === 'size'
        ? legend.bounds.height > 0
        : 'entries' in legend && legend.entries.length > 0;
    if (hasContent) topLegendBlock += legend.bounds.height + legendGap(width);
  }

  let facetGrowth = 0;
  if (layout.facet) {
    const needed = facetMinHeight(layout.facet.panels.length, layout.facet.columns);
    const budgetForPanels =
      FALLBACK_HEIGHT - layout.chrome.topHeight - layout.chrome.bottomHeight - topLegendBlock;
    if (needed > budgetForPanels) {
      facetGrowth = needed - budgetForPanels;
    }
  }

  return Math.max(
    0,
    layout.chrome.topHeight +
      layout.chrome.bottomHeight +
      topLegendBlock +
      (layout.metrics?.height ?? 0) +
      facetGrowth +
      (layout.chrome.grownHeight !== undefined ? (layout.chrome.noteBandHeight ?? 0) : 0) -
      (layout.chrome.grownHeight ?? 0),
  );
}
