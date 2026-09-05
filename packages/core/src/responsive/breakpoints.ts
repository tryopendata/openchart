/**
 * Responsive breakpoints and layout strategies.
 *
 * Width breakpoints:
 * - compact: < 400px (mobile, small embeds)
 * - medium: 400-700px (tablet, sidebars)
 * - full: > 700px (desktop, full-width)
 *
 * Height classes:
 * - cramped: < 200px (dashboard widgets, thumbnails)
 * - short: 200-350px (embedded panels, short containers)
 * - normal: > 350px (standard containers)
 */

// ---------------------------------------------------------------------------
// Width breakpoint type and detection
// ---------------------------------------------------------------------------

/** Responsive breakpoint based on container width. */
export type Breakpoint = 'compact' | 'medium' | 'full';

/** Breakpoint thresholds in pixels. */
export const BREAKPOINT_COMPACT_MAX = 400;
export const BREAKPOINT_MEDIUM_MAX = 700;

/**
 * Determine the breakpoint for a given container width.
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINT_COMPACT_MAX) return 'compact';
  if (width <= BREAKPOINT_MEDIUM_MAX) return 'medium';
  return 'full';
}

// ---------------------------------------------------------------------------
// Height class type and detection
// ---------------------------------------------------------------------------

/** Height classification based on container height. */
export type HeightClass = 'cramped' | 'short' | 'normal';

/** Height class thresholds in pixels. */
export const HEIGHT_CRAMPED_MAX = 200;
export const HEIGHT_SHORT_MAX = 350;

/**
 * Determine the height class for a given container height.
 */
export function getHeightClass(height: number): HeightClass {
  if (height < HEIGHT_CRAMPED_MAX) return 'cramped';
  if (height <= HEIGHT_SHORT_MAX) return 'short';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Layout strategy
// ---------------------------------------------------------------------------

/** Label display mode at a given breakpoint. */
export type LabelMode = 'all' | 'important' | 'none';

/**
 * Legend position at a given breakpoint. `'top-left'` is a map-only overlay
 * position: the legend floats inside the map area's top-left corner (with its
 * own backdrop) instead of reserving a block of figure height. Charts treat
 * it as the default position.
 */
export type LegendPosition = 'top' | 'top-left' | 'right' | 'bottom' | 'bottom-right' | 'inline';

/** Annotation position strategy. */
export type AnnotationPosition = 'inline' | 'tooltip-only';

/** Axis label density (controls tick count reduction). */
export type AxisLabelDensity = 'full' | 'reduced' | 'minimal';

/** Chrome display mode based on available height. */
export type ChromeMode = 'full' | 'compact' | 'hidden';

/**
 * Layout strategy defining how the visualization adapts to available space.
 * Returned by getLayoutStrategy() based on width breakpoint and height class.
 */
export interface LayoutStrategy {
  /** How data labels are displayed. */
  labelMode: LabelMode;
  /** Where the legend is positioned. */
  legendPosition: LegendPosition;
  /** How annotations are displayed. */
  annotationPosition: AnnotationPosition;
  /** Axis tick density. */
  axisLabelDensity: AxisLabelDensity;
  /** Chrome display mode: full, compact (title only), or hidden. */
  chromeMode: ChromeMode;
  /** Max fraction of container height for legend (0-1). -1 means unlimited. */
  legendMaxHeight: number;
}

/**
 * Get the base layout strategy for a width breakpoint.
 */
function getWidthStrategy(breakpoint: Breakpoint): LayoutStrategy {
  switch (breakpoint) {
    case 'compact':
      return {
        labelMode: 'none',
        legendPosition: 'top',
        annotationPosition: 'tooltip-only',
        axisLabelDensity: 'minimal',
        chromeMode: 'full',
        legendMaxHeight: -1,
      };
    case 'medium':
      return {
        labelMode: 'important',
        legendPosition: 'top',
        annotationPosition: 'inline',
        axisLabelDensity: 'reduced',
        chromeMode: 'full',
        legendMaxHeight: -1,
      };
    case 'full':
      return {
        labelMode: 'all',
        legendPosition: 'top',
        annotationPosition: 'inline',
        axisLabelDensity: 'full',
        chromeMode: 'full',
        legendMaxHeight: -1,
      };
  }
}

/**
 * Apply height constraints to a width-based strategy.
 * Short containers compress chrome and cap legend height.
 * Cramped containers hide chrome and labels entirely.
 */
function applyHeightConstraints(
  strategy: LayoutStrategy,
  heightClass: HeightClass,
): LayoutStrategy {
  if (heightClass === 'normal') return strategy;

  if (heightClass === 'cramped') {
    return {
      ...strategy,
      chromeMode: 'hidden',
      legendMaxHeight: 0,
      labelMode: 'none',
      annotationPosition: 'tooltip-only',
    };
  }

  // short
  return {
    ...strategy,
    chromeMode: 'compact',
    legendMaxHeight: 0.15,
  };
}

/**
 * Get the layout strategy for a given breakpoint and height class.
 *
 * Compact: minimal chrome, no inline labels, legend on top, reduced axes.
 * Medium: moderate labels, legend on top, reduced axes.
 * Full: all labels, legend on top, full axes.
 *
 * Legend position is 'top' at every breakpoint: a top legend reads as a key to
 * the chart before the eye reaches the plot, and it keeps the plotting area
 * full-width instead of surrendering a right-hand column. `legend.position`
 * still overrides it per spec.
 *
 * Height constraints further reduce chrome and legend when container is short.
 */
export function getLayoutStrategy(
  breakpoint: Breakpoint,
  heightClass: HeightClass = 'normal',
): LayoutStrategy {
  const base = getWidthStrategy(breakpoint);
  return applyHeightConstraints(base, heightClass);
}

// ---------------------------------------------------------------------------
// Chrome economy
// ---------------------------------------------------------------------------

/**
 * Height below which gridlines are dropped. A 140px dashboard tile has room
 * for the shape of the series and nothing else; five hairlines behind it are
 * decoration, not structure.
 */
export const HEIGHT_NO_GRID_MAX = 150;

/** Tick-label budget for the x-axis at the compact breakpoint. */
export const COMPACT_MAX_X_TICKS = 3;

/**
 * How much chart chrome a container can afford.
 *
 * Small embeds get the same treatment an editorial designer would give them:
 * drop the grid first, then the axes, and keep only the tick labels that
 * anchor the reader (first, last, and one in between). Every drop is a
 * default — an explicit `axis.grid` / `encoding.*.axis` on the spec wins.
 */
export interface ChromeEconomy {
  /** Draw gridlines by default? False under `HEIGHT_NO_GRID_MAX`. */
  gridlines: boolean;
  /** Draw axes by default? False under `HEIGHT_CRAMPED_MAX`. */
  axes: boolean;
  /** Cap on drawn x-axis tick labels, or undefined for no cap. */
  maxXTicks?: number;
}

/**
 * Resolve the chrome economy for a container size.
 *
 * @param width - Container width in pixels.
 * @param height - Container height in pixels.
 */
export function resolveChromeEconomy(width: number, height: number): ChromeEconomy {
  const economy: ChromeEconomy = {
    gridlines: height >= HEIGHT_NO_GRID_MAX,
    axes: height >= HEIGHT_CRAMPED_MAX,
  };
  if (getBreakpoint(width) === 'compact') economy.maxXTicks = COMPACT_MAX_X_TICKS;
  return economy;
}
