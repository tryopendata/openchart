/**
 * "You draw it" resolution: computes the pixel geometry the vanilla adapter
 * needs to render the hatched drawing region, capture pointer input, and
 * mask/reveal the real line.
 *
 * Runs AFTER marks are computed (needs the target LineMark's pixel points)
 * and needs the x scale to resolve `from` to a pixel position. Single-series
 * line charts only; validateSpec rejects other combinations before this runs.
 */

import type {
  LineMark,
  Mark,
  Point,
  Rect,
  ResolvedYouDrawIt,
  YouDrawItConfig,
  YouDrawItSample,
} from '@opendata-ai/openchart-core';
import { resolvePosition } from '../annotations/position';
import type { ResolvedScales } from '../layout/scales';

/**
 * Linear-invert two reference pixels through the y scale so the vanilla layer
 * can map a drawn pixel-y back to a data value without the scale object.
 * `.invert()` exists on continuous scales (linear/log/time/pow/sqrt/symlog);
 * for band/ordinal y (never valid with a quantitative line here) it is
 * undefined and this returns undefined, so onReveal falls back to pixel
 * fractions.
 */
function resolveYInvert(scaleY: ResolvedScales['y'], area: Rect): ResolvedYouDrawIt['yInvert'] {
  if (!scaleY) return undefined;
  const invert = (scaleY.scale as { invert?: (px: number) => number }).invert;
  if (typeof invert !== 'function') return undefined;
  const topData = invert.call(scaleY.scale, area.y);
  const bottomData = invert.call(scaleY.scale, area.y + area.height);
  if (!Number.isFinite(topData) || !Number.isFinite(bottomData)) return undefined;
  return {
    topPixel: area.y,
    bottomPixel: area.y + area.height,
    topData,
    bottomData,
  };
}

/**
 * Resolve `youDrawIt` into pixel geometry, or undefined when the config is
 * absent, no line mark was produced (e.g. empty data), or `from` doesn't
 * resolve to a position on the x scale.
 */
export function resolveYouDrawIt(
  config: YouDrawItConfig | undefined,
  marks: Mark[],
  scales: ResolvedScales,
  chartArea: Rect,
  xField: string | undefined,
): ResolvedYouDrawIt | undefined {
  if (!config || !scales.x) return undefined;

  const targetLine = marks.find((m): m is LineMark => m.type === 'line');
  if (!targetLine || targetLine.points.length === 0) return undefined;

  const fromX = resolvePosition(config.from, scales.x);
  if (fromX === null) return undefined;

  // Pair each pixel-x sample at/after `from` with its data-x value, so the
  // vanilla layer can report the guess in data coordinates on reveal. Prefer
  // dataPoints (carries the original datum) and fall back to the raw point x
  // when dataPoints is absent (e.g. a single-point degenerate line).
  const seen = new Set<number>();
  const samples: YouDrawItSample[] = [];
  if (targetLine.dataPoints?.length) {
    for (const dp of targetLine.dataPoints) {
      if (dp.x < fromX - 0.5) continue;
      if (seen.has(dp.x)) continue;
      seen.add(dp.x);
      const raw = xField ? dp.datum[xField] : undefined;
      const xValue = typeof raw === 'string' || typeof raw === 'number' ? raw : dp.x;
      samples.push({ px: dp.x, xValue });
    }
  }
  if (samples.length === 0) {
    // No dataPoints (or none past `from`): fall back to geometric point xs so
    // drawing still snaps, reporting pixel x as the identity when we can't
    // recover the data value.
    for (const p of targetLine.points) {
      if (p.x < fromX - 0.5) continue;
      if (seen.has(p.x)) continue;
      seen.add(p.x);
      samples.push({ px: p.x, xValue: p.x });
    }
  }
  samples.sort((a, b) => a.px - b.px);
  if (samples.length === 0) return undefined;

  let comparisonPoints: Point[] | undefined;
  if (config.comparisonLine && config.comparisonLine.length > 0) {
    const resolved: Point[] = [];
    for (const { x, y } of config.comparisonLine) {
      const px = resolvePosition(x, scales.x);
      const py = scales.y ? resolvePosition(y, scales.y) : null;
      if (px !== null && py !== null) resolved.push({ x: px, y: py });
    }
    if (resolved.length > 0) {
      resolved.sort((a, b) => a.x - b.x);
      comparisonPoints = resolved;
    }
  }

  const yInvert = resolveYInvert(scales.y, chartArea);

  return {
    fromX,
    area: chartArea,
    samples,
    prompt: config.prompt ?? 'Draw your guess',
    revealLabel: config.revealLabel ?? 'Show me',
    lineColor: targetLine.stroke,
    targetSeriesKey: targetLine.seriesKey,
    ...(yInvert ? { yInvert } : {}),
    ...(comparisonPoints ? { comparisonPoints } : {}),
  };
}
