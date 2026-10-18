/**
 * Responsive state that depends on the container height: layout strategy,
 * watermark, authored reserves, and the note band. Resolved once per height so
 * a faceted figure that grows to fit its panels re-solves it at the new height.
 */

import type {
  Breakpoint,
  CompileOptions,
  LayoutStrategy,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  BREAKPOINT_COMPACT_MAX,
  getHeightClass,
  getLayoutStrategy,
  HEIGHT_CRAMPED_MAX,
} from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import { type AuthoredReserves, measureAuthoredReserves } from '../layout/budget';
import type { InternalCompileOptions } from './internal-options';

/** Responsive state resolved for one container height. */
export interface HeightContext {
  options: InternalCompileOptions;
  strategy: LayoutStrategy;
  watermark: boolean;
  reserves: AuthoredReserves;
  /** Note band reserved below the plot. */
  noteReserve: number;
}

/**
 * Compact-width container tall enough for inline callouts: where the compact
 * annotation limit applies. Shorter containers stay tooltip-only.
 */
export function isCompactContainer(options: CompileOptions): boolean {
  return options.width < BREAKPOINT_COMPACT_MAX && options.height >= HEIGHT_CRAMPED_MAX;
}

/**
 * Everything that depends on the container height, resolved once per height.
 * Reserves come from source text before placement. A drag can pin a label and
 * change the demoted set; neither the plot nor the SVG clamp may move at
 * commit. Include pinned sources because fresh compiles cannot distinguish
 * authored pins from labels pinned by editing. Facets share this source-level
 * budget. A frozen leaf uses the reserve its layer assembly resolved instead.
 */
export function heightContextResolver(params: {
  options: InternalCompileOptions;
  breakpoint: Breakpoint;
  chartSpec: NormalizedChartSpec;
  theme: ResolvedTheme;
  annotationsInline: boolean;
  watermarkAt: (height: number) => boolean;
}): (height: number) => HeightContext {
  const { options, breakpoint, chartSpec, theme, annotationsInline, watermarkAt } = params;
  return (height) => {
    const sized = height === options.height ? options : { ...options, height };
    const base = getLayoutStrategy(breakpoint, getHeightClass(height));
    const reserves = measureAuthoredReserves(chartSpec, sized.width, theme, sized.measureText, {
      compactNotes: isCompactContainer(sized) && chartSpec.compactAnnotationLimit != null,
    });
    return {
      options: sized,
      strategy: annotationsInline ? { ...base, annotationPosition: 'inline' } : base,
      watermark: watermarkAt(height),
      reserves,
      noteReserve: options.frozenBudget
        ? (options.frozenBudget.noteReserve ?? 0)
        : Math.max(0, reserves.noteBand),
    };
  };
}
