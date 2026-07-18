import type { CompileOptions } from '@opendata-ai/openchart-core';

import type { NormalizedChrome } from '../compiler/types';

/** Convert NormalizedChrome back to a Chrome-compatible shape for computeChrome. */
export function chromeToInput(
  chrome: NormalizedChrome,
): import('@opendata-ai/openchart-core').Chrome {
  return {
    eyebrow: chrome.eyebrow,
    title: chrome.title,
    subtitle: chrome.subtitle,
    source: chrome.source,
    byline: chrome.byline,
    footer: chrome.footer,
    brand: chrome.brand,
  };
}

/**
 * Scale padding based on the smaller container dimension.
 * At >= 500px, padding is unchanged. At <= 200px, padding is halved (min 4px).
 * Linear interpolation between 200-500px.
 */
export function scalePadding(basePadding: number, width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (minDim >= 500) return basePadding;
  if (minDim <= 200) return Math.max(Math.round(basePadding * 0.5), 4);
  const t = (minDim - 200) / 300;
  return Math.max(Math.round(basePadding * (0.5 + t * 0.5)), 4);
}

/**
 * Compute the bottom margin contribution from chrome.
 * Padding always applies (gap between x-axis ticks and the chrome below).
 * bottomHeight is additive on top.
 */
export function bottomMargin(bottomHeight: number, padding: number, xAxisHeight: number): number {
  return padding + bottomHeight + xAxisHeight;
}

/**
 * Vertical breathing room added to the inline-tick label height so the
 * topmost tick has clearance from chrome.
 */
export const INLINE_TICK_OVERHANG_PAD = 6;

/**
 * Resolve the effective chrome-layout mode for a spec.
 *
 * `'subtract'` (default): chrome occupies part of the height budget, shrinking
 * the plot. `'grow'`: the plot keeps the full height budget and the final SVG
 * grows by the chrome height.
 *
 * Spec-level `chromeLayout` wins over the compile-option default. Faceted specs
 * never grow in v1: faceting already grows the SVG for short panels, and
 * composing both growth mechanisms is out of scope, so faceted specs are pinned
 * to `'subtract'`.
 */
export function resolveChromeLayout(
  spec: { chromeLayout?: 'subtract' | 'grow'; encoding?: unknown } | undefined,
  options: Pick<CompileOptions, 'chromeLayout'> | undefined,
): 'subtract' | 'grow' {
  const encoding = spec?.encoding as
    | { facet?: unknown; row?: unknown; column?: unknown }
    | undefined;
  const isFaceted = !!(encoding?.facet || encoding?.row || encoding?.column);
  if (isFaceted) return 'subtract';
  return spec?.chromeLayout ?? options?.chromeLayout ?? 'subtract';
}
