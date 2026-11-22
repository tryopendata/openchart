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
import { resolveChromeLayout } from '../layout/shared';
import { outsideBudget } from '../layout/stack';
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
 * Note reserves come from source text before placement. In edit mode
 * (`stableNoteBand`) a drag can pin a label and change the demoted set, and
 * neither the plot nor the SVG clamp may move at commit, so every text
 * annotation reserves its note lines; pinned sources count because fresh
 * compiles cannot tell authored pins from labels pinned by editing. Notes
 * inside the budget (`subtract`) shrink the plot, so they reserve too.
 * Otherwise notes sit outside the budget and the figure grows late by the
 * notes it draws (resolveNoteOverflow), so a chart that folds nothing keeps
 * its authored height instead of carrying an empty band. Facets share this
 * source-level budget. A frozen leaf uses the reserve its layer assembly
 * resolved instead.
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
  const reserveNotes =
    options.stableNoteBand === true ||
    !outsideBudget(resolveChromeLayout(chartSpec, options), 'notes');
  return (height) => {
    const sized = height === options.height ? options : { ...options, height };
    const base = getLayoutStrategy(breakpoint, getHeightClass(height));
    const reserves = measureAuthoredReserves(chartSpec, sized.width, theme, sized.measureText, {
      compactNotes: isCompactContainer(sized) && chartSpec.compactAnnotationLimit != null,
      reserveNotes,
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
