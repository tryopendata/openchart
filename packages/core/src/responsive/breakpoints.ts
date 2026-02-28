/**
 * Responsive breakpoints and layout strategies.
 *
 * Three breakpoints based on container width:
 * - compact: < 400px (mobile, small embeds)
 * - medium: 400-700px (tablet, sidebars)
 * - full: > 700px (desktop, full-width)
 */

// ---------------------------------------------------------------------------
// Breakpoint type and detection
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
// Layout strategy
// ---------------------------------------------------------------------------

/** Label display mode at a given breakpoint. */
export type LabelMode = 'all' | 'important' | 'none';

/** Legend position at a given breakpoint. */
export type LegendPosition = 'top' | 'right' | 'bottom' | 'bottom-right' | 'inline';

/** Annotation position strategy. */
export type AnnotationPosition = 'inline' | 'tooltip-only';

/** Axis label density (controls tick count reduction). */
export type AxisLabelDensity = 'full' | 'reduced' | 'minimal';

/**
 * Layout strategy defining how the visualization adapts to available space.
 * Returned by getLayoutStrategy() based on the current breakpoint.
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
}

/**
 * Get the layout strategy for a given breakpoint.
 *
 * Compact: minimal chrome, no inline labels, legend on top, reduced axes.
 * Medium: moderate labels, legend on top, reduced axes.
 * Full: all labels, legend on right, full axes.
 */
export function getLayoutStrategy(breakpoint: Breakpoint): LayoutStrategy {
  switch (breakpoint) {
    case 'compact':
      return {
        labelMode: 'none',
        legendPosition: 'top',
        annotationPosition: 'tooltip-only',
        axisLabelDensity: 'minimal',
      };
    case 'medium':
      return {
        labelMode: 'important',
        legendPosition: 'top',
        annotationPosition: 'inline',
        axisLabelDensity: 'reduced',
      };
    case 'full':
      return {
        labelMode: 'all',
        legendPosition: 'right',
        annotationPosition: 'inline',
        axisLabelDensity: 'full',
      };
  }
}
