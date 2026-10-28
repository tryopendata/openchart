import { estimateTextWidth, type MeasureTextFn } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../../compiler/types';
import { resolveFieldFormatter } from '../../format/field-format';
import {
  RANGE_LABEL_FONT_SIZE,
  RANGE_LABEL_FONT_WEIGHT,
  RANGE_LABEL_OFFSET,
  rangeEndpointText,
} from './labels';

/** Outside labels on explicitly composed horizontal ranges must fit the figure. */
export function rangeLabelReserve(spec: NormalizedChartSpec, measureText?: MeasureTextFn): number {
  if (
    spec.markType !== 'range' ||
    spec.labels.content === undefined ||
    spec.labels.density === 'none' ||
    spec.encoding.y?.type === 'quantitative'
  )
    return 0;
  const start = spec.encoding.x,
    end = spec.encoding.x2;
  if (!start || !end) return 0;
  const format = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    channelFormat: start.format,
    values: spec.data.flatMap((row) => [row[start.field], row[end.field]]),
  });
  let width = 0;
  for (const row of spec.data)
    for (const channel of [start, end]) {
      const value = Number(row[channel.field]);
      if (!Number.isFinite(value)) continue;
      const text = rangeEndpointText(
        value,
        format,
        spec.labels.prefix,
        spec.labels.content,
        channel.title ?? channel.field,
        spec.labels.suffix,
      );
      if (text === null) continue;
      width = Math.max(
        width,
        measureText?.(text, RANGE_LABEL_FONT_SIZE, RANGE_LABEL_FONT_WEIGHT).width ??
          estimateTextWidth(text, RANGE_LABEL_FONT_SIZE, RANGE_LABEL_FONT_WEIGHT),
      );
    }
  return (
    width + RANGE_LABEL_OFFSET + ((spec.markDef.style ?? 'dumbbell') === 'dumbbell' ? 6 : 0) + 2
  );
}
