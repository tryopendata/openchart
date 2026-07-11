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
} from '@opendata-ai/openchart-core';
import { resolvePosition } from '../annotations/position';
import type { ResolvedScales } from '../layout/scales';

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
): ResolvedYouDrawIt | undefined {
  if (!config || !scales.x) return undefined;

  const targetLine = marks.find((m): m is LineMark => m.type === 'line');
  if (!targetLine || targetLine.points.length === 0) return undefined;

  const fromX = resolvePosition(config.from, scales.x);
  if (fromX === null) return undefined;

  const sampleXs = targetLine.points
    .map((p) => p.x)
    .filter((x) => x >= fromX - 0.5)
    .sort((a, b) => a - b);
  if (sampleXs.length === 0) return undefined;

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

  return {
    fromX,
    area: chartArea,
    sampleXs,
    prompt: config.prompt ?? 'Draw your guess',
    revealLabel: config.revealLabel ?? 'Show me',
    lineColor: targetLine.stroke,
    targetKey: targetLine.key ?? 'series',
    ...(comparisonPoints ? { comparisonPoints } : {}),
  };
}
