/** Tooltip content for a mark on a playback chart. */
import type { TooltipContent, TooltipField } from '@opendata-ai/openchart-core';
import type { ChartPlayback, ObservedValues } from '@opendata-ai/openchart-engine';

/** Appended to the title of a period whose values were filled rather than observed. */
const ESTIMATED_SUFFIX = 'estimated';

/** The parts of an encoding channel the tooltip reads. */
interface ChannelFields {
  field?: string;
  type?: string;
  title?: string;
}

function encodingOf(playback: ChartPlayback): Record<string, ChannelFields | undefined> {
  return (playback.frame.spec.encoding ?? {}) as Record<string, ChannelFields | undefined>;
}

/** Maps each encoded field name to its channel title, first channel to name a field wins. */
function channelTitlesByField(playback: ChartPlayback): Map<string, string> {
  const titles = new Map<string, string>();
  for (const channel of Object.values(encodingOf(playback))) {
    if (!channel?.field || !channel.title || titles.has(channel.field)) continue;
    titles.set(channel.field, channel.title);
  }
  return titles;
}

/**
 * The fields that name a bar to a reader: its category (the positional channel that isn't
 * quantitative) and its color series when there is one. The engine's bar key joins the same
 * values into an internal `color|category` identity.
 */
function barNameFields(playback: ChartPlayback): string[] {
  const encoding = encodingOf(playback);
  const category = [encoding.x, encoding.y].find(
    (channel) => channel?.field && channel.type !== 'quantitative',
  );
  return [category?.field, encoding.color?.field].filter(
    (field): field is string => field !== undefined,
  );
}

/** What the title calls `key`: a bar's category and color values, else the key itself. */
function markName(playback: ChartPlayback, key: string, observed: ObservedValues): string {
  const mark = playback.base.marks.find((candidate) => String(candidate.key) === key);
  if (mark?.type !== 'rect') return key;
  const names = barNameFields(playback)
    .map((field) => observed.values[field])
    .filter((value) => value !== undefined && value !== '');
  return names.length ? names.join(', ') : key;
}

/**
 * The hovered key's observed values at the period nearest `t`, titled with the mark's name
 * and that period's label, never interpolated numbers. A bar is named by its category and
 * color values, a point by its key. Each field is labelled with the title of the encoding
 * channel that reads it (`playback.frame.spec.encoding`), else the field name. A
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
  return { title: `${markName(playback, key, observed)}, ${period}`, fields };
}
