/**
 * Chart spec preparation: everything resolved from the authored spec before
 * the theme and layout. Sugar expansion, validation + normalization, data
 * transforms, the active breakpoint override, and the display-mode defaults
 * (animation, crosshair, watermark).
 */

import type {
  Breakpoint,
  ChromeEconomy,
  CompileOptions,
  ResolvedAnimation,
  Transform,
} from '@opendata-ai/openchart-core';
import { getBreakpoint, resolveChromeEconomy } from '@opendata-ai/openchart-core';
import { compile as compileSpec } from '../compiler/index';
import type { NormalizedChartSpec } from '../compiler/types';
import { validatePreparedLabelPlacement } from '../compiler/validation/label-placement';
import { runTransforms } from '../transforms';
import {
  applyBreakpointOverride,
  type BreakpointOverride,
  collectUserExplicit,
} from './breakpoint-overrides';
import {
  applySparklineLabelDefault,
  resolveChartAnimation,
  resolveCrosshair,
  watermarkResolver,
} from './display-defaults';
import type { InternalCompileOptions } from './internal-options';
import { emitSpecWarnings, expandSpecSugar } from './spec-sugar';

/** A chart spec resolved up to (but not including) theme and layout. */
export interface PreparedChart {
  /** The authored spec after sugar expansion. */
  expandedSpec: unknown;
  /** `expandedSpec` viewed as a record, for authored-field lookups. */
  rawSpec: Record<string, unknown>;
  /** Compile options with the spec's fixed width/height applied. */
  options: InternalCompileOptions;
  chartSpec: NormalizedChartSpec;
  breakpoint: Breakpoint;
  /** How much chrome the container can afford. */
  economy: ChromeEconomy;
  /** A breakpoint override authored annotations, so they render inline. */
  annotationsInline: boolean;
  /** Watermark at the container height. */
  watermark: boolean;
  /** Watermark at any container height (facets re-solve at a grown height). */
  watermarkAt: (height: number) => boolean;
  resolvedAnimation: ResolvedAnimation | undefined;
  crosshair: boolean;
}

/**
 * Apply top-level spec `width`/`height` (VL fixed-size sugar) as overrides on
 * the compile options. Returns the options untouched when the spec carries no
 * size.
 */
export function applySpecSize<T extends CompileOptions>(spec: unknown, options: T): T {
  if (!spec || typeof spec !== 'object') return options;
  const sized = spec as Record<string, unknown>;
  if (typeof sized.width !== 'number' && typeof sized.height !== 'number') return options;
  return {
    ...options,
    width: typeof sized.width === 'number' ? sized.width : options.width,
    height: typeof sized.height === 'number' ? sized.height : options.height,
  };
}

export function prepareChartSpec(
  spec: unknown,
  optionsInput: InternalCompileOptions,
): PreparedChart {
  // Expand VL-idiom and encoding-level sugar (data {values}, top-level title,
  // sort-by-value, value defs, scheme names, theta, bin/timeUnit, ...) before
  // validation + normalization, surfacing any deprecation warnings.
  const sugarWarnings: string[] = [];
  const expandedSpec =
    spec && typeof spec === 'object' && !Array.isArray(spec)
      ? expandSpecSugar(spec as Record<string, unknown>, sugarWarnings, false)
      : spec;

  // Top-level width/height are fixed-size overrides (VL alignment): the
  // authored size wins over the container-derived compile options.
  const options = applySpecSize(expandedSpec, optionsInput);

  // Validate + normalize. Normalize-stage warnings (type mismatches,
  // beeswarm point budget, sparkline mark advice) surface through the same
  // console channel as the sugar warnings. Emit both together in one call so
  // dedup spans the whole compile: a message produced by both a sugar pass and
  // a normalize pass prints once, not once per stage.
  const { spec: normalized, warnings: normalizeWarnings } = compileSpec(expandedSpec);
  emitSpecWarnings([...sugarWarnings, ...normalizeWarnings], options.onWarn);

  if ('type' in normalized && normalized.type === 'table') {
    throw new Error('compileChart received a table spec. Use compileTable instead.');
  }
  if ('type' in normalized && normalized.type === 'graph') {
    throw new Error('compileChart received a graph spec. Use compileGraph instead.');
  }
  if ('type' in normalized && normalized.type === 'sankey') {
    throw new Error('compileChart received a sankey spec. Use compileSankey instead.');
  }
  if ('type' in normalized && normalized.type === 'map') {
    throw new Error('compileChart received a map spec. Use compileGeoMap instead.');
  }

  let chartSpec = normalized as NormalizedChartSpec;
  const rawSpec = expandedSpec as Record<string, unknown>;

  // Host mount/compile options override authored spec values.
  let watermark =
    options.watermark ?? (rawSpec.watermark !== undefined ? chartSpec.watermark : true);

  // Run data transforms (filter, bin, calculate, timeUnit) before any other data processing.
  // Transforms are defined on the expanded spec (which includes any auto-generated
  // transforms from encoding-level bin/timeUnit sugar), not the normalized spec,
  // since NormalizedChartSpec doesn't carry the transform field.
  const rawTransforms = rawSpec.transform as Transform[] | undefined;
  if (rawTransforms && rawTransforms.length > 0) {
    chartSpec = { ...chartSpec, data: runTransforms(chartSpec.data, rawTransforms) };
  }

  // Height-dependent responsive state (strategy, watermark, note reserve) is
  // resolved per height by the caller, so a faceted figure that grows to fit
  // its panels re-solves it at the grown height.
  const breakpoint = getBreakpoint(options.width);
  // How much chrome the container can afford: a tile drops its grid, then its
  // axes, and caps x tick labels at compact widths. Explicit axis config wins.
  const economy = resolveChromeEconomy(options.width, options.height);

  const overrides = rawSpec.overrides as Partial<Record<string, BreakpointOverride>> | undefined;
  const bp = overrides?.[breakpoint];

  // Capture explicitness BEFORE applying any overrides.
  chartSpec = { ...chartSpec, userExplicit: collectUserExplicit(rawSpec, bp) };

  let annotationsInline = false;
  if (bp) {
    const applied = applyBreakpointOverride(chartSpec, bp, rawSpec, options);
    chartSpec = applied.chartSpec;
    annotationsInline = applied.annotationsInline;
    if (applied.watermark !== undefined) watermark = applied.watermark;
  }

  chartSpec = applySparklineLabelDefault(chartSpec);
  const placementErrors = validatePreparedLabelPlacement(chartSpec);
  if (placementErrors.length)
    throw new Error(
      `Invalid spec:\n${placementErrors.map((error) => `${error.path}: ${error.message}`).join('\n')}`,
    );
  const resolvedAnimation = resolveChartAnimation(rawSpec, bp, chartSpec);
  const crosshair = resolveCrosshair(rawSpec, bp, chartSpec);

  // Watermark default-off in sparkline mode unless user-explicit.
  if (
    chartSpec.display === 'sparkline' &&
    options.watermark === undefined &&
    !chartSpec.userExplicit.watermark
  ) {
    watermark = false;
    chartSpec = { ...chartSpec, watermark: false };
  }

  const baseWatermark = watermark;
  const watermarkAt = watermarkResolver(baseWatermark, chartSpec, options);
  watermark = watermarkAt(options.height);
  if (!watermark && baseWatermark) chartSpec = { ...chartSpec, watermark: false };

  return {
    expandedSpec,
    rawSpec,
    options,
    chartSpec,
    breakpoint,
    economy,
    annotationsInline,
    watermark,
    watermarkAt,
    resolvedAnimation,
    crosshair,
  };
}
