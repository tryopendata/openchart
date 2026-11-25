/** Tooltip content for a mark on a playback chart. */
import type { TooltipContent, TooltipField } from '@opendata-ai/openchart-core';
import type { ChartPlayback } from '@opendata-ai/openchart-engine';

/** Appended to the title of a period whose values were filled rather than observed. */
const ESTIMATED_SUFFIX = 'estimated';

/** Maps each encoded field name to its channel title, first channel to name a field wins. */
function channelTitlesByField(playback: ChartPlayback): Map<string, string> {
  const titles = new Map<string, string>();
  const channels = Object.values(playback.frame.spec.encoding ?? {});
  for (const channel of channels) {
    if (!channel?.field || !channel.title || titles.has(channel.field)) continue;
    titles.set(channel.field, channel.title);
  }
  return titles;
}

/**
 * The hovered key's observed values at the period nearest `t`, titled with the key and that
 * period's label, never interpolated numbers. Each field is labelled with the title of the
 * encoding channel that reads it (`playback.frame.spec.encoding`), else the field name. A
 * gap-filled period says it was estimated.
 * Returns content with no fields when the key has no values near `t`.
 */
export function playbackTooltip(playback: ChartPlayback, key: string, t: number): TooltipContent {
  const observed = playback.observedAt(key, t);
  if (!observed) return { title: key, fields: [] };

  const titles = channelTitlesByField(playback);
  const fields: TooltipField[] = Object.entries(observed.values).map(([field, value]) => ({
    label: titles.get(field) ?? field,
    value,
  }));
  const period = observed.filled
    ? `${observed.periodLabel} (${ESTIMATED_SUFFIX})`
    : observed.periodLabel;
  return { title: `${key}, ${period}`, fields };
}
