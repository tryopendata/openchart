import type { ClassScale } from '../legend/continuous';

/** d3 threshold classes include their lower edge and exclude their upper edge. */
export function classIntervalText(
  scale: ClassScale,
  index: number,
  format: (value: number) => string,
): string {
  const lower = index > 0 ? scale.breaks[index - 1] : undefined;
  const upper = scale.breaks[index];
  if (lower === undefined && upper === undefined) return 'All finite values';
  if (lower === undefined) return `Less than ${format(upper!)}`;
  if (upper === undefined) return `${format(lower)} or greater`;
  return `${format(lower)} inclusive to ${format(upper)} exclusive`;
}

/** B3 candidate: supplied field semantics give the static key a readable name and unit. */
export function mapLegendCaptionCandidate(
  channel: import('@opendata-ai/openchart-core').EncodingChannel,
  metadata?: import('@opendata-ai/openchart-core').FieldMetadata,
): { title: string; unit?: string } {
  const format = channel.format;
  const formatUnit =
    typeof format === 'string'
      ? format.includes('%')
        ? '%'
        : format.includes('$')
          ? '$'
          : undefined
      : undefined;
  return {
    title: channel.title ?? metadata?.label ?? channel.field,
    unit: metadata?.unit ?? formatUnit,
  };
}
