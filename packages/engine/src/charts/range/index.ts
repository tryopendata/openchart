/**
 * Range chart module (dumbbell / arrow / range bar).
 *
 * Exports the range chart renderer and computation functions.
 */

import type { PointMark } from '@opendata-ai/openchart-core';
import { resolveFieldFormatter } from '../../format/field-format';
import type { ChartRenderer } from '../registry';
import { computeRangeMarks, resolveRangeOrientation } from './compute';
import { computeRangeLabels, type RangeDotPair } from './labels';

// ---------------------------------------------------------------------------
// Range chart renderer
// ---------------------------------------------------------------------------

/**
 * Range chart renderer.
 *
 * Produces connector/shaft/bar spans plus dot pairs (dumbbell style).
 * Both-end value labels are attached to the dumbbell dot marks; arrow and
 * bar styles have no dot anchors and render without value labels.
 */
export const rangeRenderer: ChartRenderer = (spec, scales, chartArea, strategy, theme) => {
  const marks = computeRangeMarks(spec, scales, chartArea, strategy, theme);

  const style = spec.markDef.style ?? 'dumbbell';
  if (style !== 'dumbbell') return marks;

  // Dumbbell dots are emitted in (start, end) order per row; pair them up
  // for the both-end label pass.
  const dots = marks.filter((m): m is PointMark => m.type === 'point');
  const pairs: RangeDotPair[] = [];
  for (let i = 0; i + 1 < dots.length; i += 2) {
    pairs.push({ start: dots[i], end: dots[i + 1] });
  }

  const orientation = resolveRangeOrientation(scales);
  const horizontal = orientation !== 'vertical';
  const encoding = spec.encoding;
  const startChannel = horizontal ? encoding.x : encoding.y;
  const endChannel = horizontal ? encoding.x2 : encoding.y2;

  const startField = startChannel && 'field' in startChannel ? startChannel.field : undefined;
  const endField = endChannel && 'field' in endChannel ? endChannel.field : undefined;
  const startValues = startField ? spec.data.map((r) => r[startField]) : [];
  const endValues = endField ? spec.data.map((r) => r[endField]) : [];
  const labelFormatter = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    channelFormat: startChannel && 'format' in startChannel ? startChannel.format : undefined,
    values: [...startValues, ...endValues],
  });
  const labels = computeRangeLabels(
    pairs,
    horizontal,
    spec.labels.density,
    spec.labels.prefix,
    labelFormatter,
    startField,
    endField,
  );

  // Attach labels back onto their dots via the index carried through the
  // label pass (pairIndex * 2 = start dot, pairIndex * 2 + 1 = end dot).
  for (const label of labels) {
    if (label.index === undefined) continue;
    const pair = pairs[Math.floor(label.index / 2)];
    if (!pair) continue;
    const dot = label.index % 2 === 0 ? pair.start : pair.end;
    dot.label = label;
  }

  return marks;
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export { computeRangeMarks, resolveRangeOrientation } from './compute';
export type { RangeDotPair } from './labels';
export { computeRangeLabels } from './labels';
