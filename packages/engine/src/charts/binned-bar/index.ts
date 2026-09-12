/**
 * Binned bar (histogram) renderer.
 *
 * Dispatched by `resolveRendererKey` as `'bar:binned'` when a bar's x is
 * quantitative and carries a matching x2 — the shape the bin transform emits.
 */

import type { Mark } from '@opendata-ai/openchart-core';
import type { ChartRenderer } from '../registry';
import { computeBinnedBarMarks } from './compute';

export { computeBinnedBarMarks, OVERLAP_FILL_OPACITY } from './compute';

export const binnedBarRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) =>
  computeBinnedBarMarks(spec, scales, chartArea, strategy, theme) as Mark[];
