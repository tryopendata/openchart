/**
 * Breakpoint-conditional spec overrides (`spec.overrides[breakpoint]`).
 *
 * The user-explicit descriptor is captured before any override applies, so it
 * reflects the union of "user wrote this at top level" and "user wrote this in
 * the active breakpoint override."
 */

import type { ChartSpecOverride } from '@opendata-ai/openchart-core';
import { normalizeAnnotations } from '../compiler/normalize';
import type { NormalizedChartSpec } from '../compiler/types';
import type { InternalCompileOptions } from './internal-options';
import { emitSpecWarnings } from './spec-sugar';

/** One breakpoint's override block, with the encoding left open for merging. */
export type BreakpointOverride = ChartSpecOverride & { encoding?: unknown };

type AxisEncoding = { x?: { axis?: unknown }; y?: { axis?: unknown } } | undefined;

// chrome: {} (empty object) is not "explicit" — it's an idiom users write to
// silence defaults. Require at least one chrome key set to count as opt-in.
const hasChromeKeys = (v: unknown): boolean =>
  !!v && typeof v === 'object' && Object.keys(v as Record<string, unknown>).length > 0;

/**
 * Build the userExplicit descriptor. Sparkline display mode reads this to
 * decide whether to suppress chrome/axes/legend/etc. by default vs. respecting
 * an explicit user opt-in. Precedence: explicit at any level wins.
 */
export function collectUserExplicit(
  rawSpec: Record<string, unknown>,
  bp: BreakpointOverride | undefined,
): NormalizedChartSpec['userExplicit'] {
  const rawEncoding = rawSpec.encoding as AxisEncoding;
  const bpEncoding = bp?.encoding as AxisEncoding;
  return {
    chrome: hasChromeKeys(rawSpec.chrome) || hasChromeKeys(bp?.chrome),
    legend: rawSpec.legend !== undefined || bp?.legend !== undefined,
    endpointLabels: rawSpec.endpointLabels !== undefined || bp?.endpointLabels !== undefined,
    // Axis explicitness tracks "user opted IN to render the axis" — `axis: false`
    // is an explicit opt-OUT and must not flip these flags on. Sparkline mode
    // reads them to decide whether to reserve axis space; treating `false` as
    // explicit would leave a phantom gutter for an axis that won't render.
    xAxis:
      (rawEncoding?.x?.axis !== undefined && rawEncoding.x.axis !== false) ||
      (bpEncoding?.x?.axis !== undefined && bpEncoding.x.axis !== false),
    yAxis:
      (rawEncoding?.y?.axis !== undefined && rawEncoding.y.axis !== false) ||
      (bpEncoding?.y?.axis !== undefined && bpEncoding.y.axis !== false),
    labels: rawSpec.labels !== undefined || bp?.labels !== undefined,
    animation: rawSpec.animation !== undefined || bp?.animation !== undefined,
    watermark: rawSpec.watermark !== undefined || bp?.watermark !== undefined,
    crosshair: rawSpec.crosshair !== undefined || bp?.crosshair !== undefined,
  };
}

/** Result of applying one breakpoint override. */
export interface AppliedOverride {
  chartSpec: NormalizedChartSpec;
  /** The override authored annotations, so they render inline at this breakpoint. */
  annotationsInline: boolean;
  /** Watermark the override sets, when the host left it to the spec. */
  watermark?: boolean;
}

/**
 * Merge a breakpoint override into a normalized chart spec. Channels merge
 * per-key, and `axis` and `scale` deep-merge one level so a breakpoint can set
 * `axis: { title: 'foo' }` without dropping the base spec's `axis.tickCount`.
 */
export function applyBreakpointOverride(
  base: NormalizedChartSpec,
  bp: BreakpointOverride,
  rawSpec: Record<string, unknown>,
  options: InternalCompileOptions,
): AppliedOverride {
  let chartSpec = base;
  let annotationsInline = false;
  let watermark: boolean | undefined;

  if (bp.endpointLabels !== undefined)
    chartSpec = { ...chartSpec, endpointLabels: bp.endpointLabels };
  if (bp.chrome) {
    chartSpec = {
      ...chartSpec,
      chrome: {
        ...chartSpec.chrome,
        ...(bp.chrome as NormalizedChartSpec['chrome']),
      },
    };
  }
  if (bp.labels !== undefined) {
    if (typeof bp.labels === 'boolean') {
      chartSpec = {
        ...chartSpec,
        labels: bp.labels
          ? { density: 'auto', format: '', prefix: '' }
          : { density: 'none', format: '', prefix: '' },
      };
    } else {
      chartSpec = {
        ...chartSpec,
        labels: {
          ...chartSpec.labels,
          ...(bp.labels as NormalizedChartSpec['labels']),
        },
      };
    }
  }
  if (bp.legend) {
    chartSpec = {
      ...chartSpec,
      legend: {
        ...chartSpec.legend,
        ...(bp.legend as NormalizedChartSpec['legend']),
      },
    };
  }
  if (bp.annotations) {
    const annotationWarnings: string[] = [];
    chartSpec = {
      ...chartSpec,
      annotations: normalizeAnnotations(bp.annotations, annotationWarnings),
    };
    emitSpecWarnings(annotationWarnings, options.onWarn);
    // User explicitly provided annotations at this breakpoint — override the
    // responsive strategy so they render inline instead of being stripped.
    annotationsInline = true;
    // The default compact limit would demote the annotations the author just
    // wrote for this breakpoint; only an explicit limit still applies.
    const authoredLimit =
      typeof rawSpec.responsive === 'object' &&
      rawSpec.responsive !== null &&
      (rawSpec.responsive as Record<string, unknown>).compactAnnotationLimit !== undefined;
    if (!authoredLimit) chartSpec = { ...chartSpec, compactAnnotationLimit: null };
  }
  // New override branches for sparkline mode and related fields:
  if (bp.display !== undefined) {
    chartSpec = {
      ...chartSpec,
      display: bp.display as NormalizedChartSpec['display'],
    };
  }
  if (bp.encoding !== undefined) {
    // Merge encoding so a breakpoint can flip on/off encoding.x.axis or
    // encoding.y.axis (used by sparkline display mode to opt back in to
    // axes at a specific breakpoint).
    chartSpec = {
      ...chartSpec,
      encoding: mergeEncoding(
        chartSpec.encoding,
        bp.encoding as Record<string, Record<string, unknown> | undefined>,
      ),
    };
  }
  if (options.watermark === undefined && typeof bp.watermark === 'boolean') {
    // ChartSpec carries this in its normalized shape; the returned value
    // controls chrome computation and rendering.
    watermark = bp.watermark;
    chartSpec = { ...chartSpec, watermark };
  }

  return { chartSpec, annotationsInline, watermark };
}

const NESTED_CHANNEL_KEYS = ['axis', 'scale'];

function mergeEncoding(
  base: NormalizedChartSpec['encoding'],
  bpEnc: Record<string, Record<string, unknown> | undefined>,
): NormalizedChartSpec['encoding'] {
  const mergedEncoding = { ...base } as Record<string, Record<string, unknown> | undefined>;
  for (const channel of Object.keys(bpEnc)) {
    const baseCh = mergedEncoding[channel];
    const bpCh = bpEnc[channel];
    if (bpCh && baseCh) {
      const merged: Record<string, unknown> = { ...baseCh, ...bpCh };
      for (const key of NESTED_CHANNEL_KEYS) {
        const baseNested = baseCh[key];
        const bpNested = bpCh[key];
        if (
          baseNested &&
          bpNested &&
          typeof baseNested === 'object' &&
          typeof bpNested === 'object' &&
          !Array.isArray(baseNested) &&
          !Array.isArray(bpNested)
        ) {
          merged[key] = { ...baseNested, ...bpNested };
        }
      }
      mergedEncoding[channel] = merged;
    } else if (bpCh) {
      mergedEncoding[channel] = bpCh;
    }
  }
  return mergedEncoding as unknown as NormalizedChartSpec['encoding'];
}
