/**
 * How a chart with `encoding.time` maps onto the playback matrix: which encoding channels
 * become numeric matrix channels, which fields ride along as per-key statics, and which
 * field identifies a mark from one period to the next. Point charts are the first consumer;
 * bars read the same mapping with their derived `color|category` identity.
 */
import type { DataRow, Encoding, EncodingChannel, MarkType } from '@opendata-ai/openchart-core';
import { serializeKeyValue } from '../compiler/keys';
import type { PlaybackChannel } from './matrix';

/** Encoding channels whose quantitative values position or size a point. */
const POINT_DRAWN_CHANNELS = ['x', 'y', 'size', 'color'] as const;

/** A bar's length is its only interpolated value; its color is part of its identity. */
const BAR_DRAWN_CHANNELS = ['x', 'y'] as const;

/** Channels that never feed a frame's rows: time is the period, key the identity. */
const IDENTITY_CHANNELS = new Set(['time', 'key']);

/**
 * Prefix for matrix channels that carry a quantitative field the mark doesn't draw with
 * (tooltip numbers, text). Presence ignores them: a key without one is still drawn.
 */
const CARRIED_CHANNEL_PREFIX = 'field:';

/** Row field holding a bar's derived `color|category` identity. */
const DERIVED_KEY_FIELD = '__playbackKey';

function fieldChannel(channel: unknown): EncodingChannel | undefined {
  if (typeof channel !== 'object' || channel === null) return undefined;
  return typeof (channel as { field?: unknown }).field === 'string'
    ? (channel as EncodingChannel)
    : undefined;
}

function encodedChannels(encoding: Encoding): Array<[string, EncodingChannel]> {
  const entries: Array<[string, EncodingChannel]> = [];
  for (const [name, value] of Object.entries(encoding)) {
    if (IDENTITY_CHANNELS.has(name)) continue;
    for (const candidate of Array.isArray(value) ? value : [value]) {
      const channel = fieldChannel(candidate);
      if (channel) entries.push([name, channel]);
    }
  }
  return entries;
}

/** The field a channel reads, or undefined for an absent or constant channel. */
export function channelField(channel: unknown): string | undefined {
  return fieldChannel(channel)?.field;
}

/** Whether a matrix channel decides presence (it draws the mark) rather than riding along. */
export function isDrawnChannel(name: string): boolean {
  return !name.startsWith(CARRIED_CHANNEL_PREFIX);
}

/**
 * The encoding channel behind a matrix channel name: the named encoding channel for drawn
 * channels, the first channel reading the field for carried ones.
 */
export function matrixChannelEncoding(
  encoding: Encoding,
  name: string,
): EncodingChannel | undefined {
  if (isDrawnChannel(name)) return fieldChannel(encoding[name as keyof Encoding]);
  const field = name.slice(CARRIED_CHANNEL_PREFIX.length);
  return encodedChannels(encoding).find(([, channel]) => channel.field === field)?.[1];
}

/**
 * The matrix channels a chart's frames read. Drawn channels are named after the encoding
 * channel (x, y, size and color for points; the value axis for bars) when quantitative,
 * and are log when their scale is. Every other quantitative field becomes a carried
 * channel, so tooltips read each period's own value.
 */
export function playbackChannels(markType: MarkType, encoding: Encoding): PlaybackChannel[] {
  const drawnNames = markType === 'bar' ? BAR_DRAWN_CHANNELS : POINT_DRAWN_CHANNELS;
  const channels: PlaybackChannel[] = [];
  for (const name of drawnNames) {
    const channel = fieldChannel(encoding[name]);
    if (!channel || channel.type !== 'quantitative') continue;
    channels.push({ name, field: channel.field, log: channel.scale?.type === 'log' });
  }
  const used = new Set(channels.map(({ field }) => field));
  for (const [, channel] of encodedChannels(encoding)) {
    if (channel.type !== 'quantitative' || used.has(channel.field)) continue;
    used.add(channel.field);
    channels.push({ name: `${CARRIED_CHANNEL_PREFIX}${channel.field}`, field: channel.field });
  }
  return channels;
}

/**
 * Every non-numeric field the encoding reads (nominal color, category, detail, tooltip
 * labels), carried per key as its last non-null value.
 */
export function playbackStaticFields(encoding: Encoding, channels: PlaybackChannel[]): string[] {
  const numeric = new Set(channels.map(({ field }) => field));
  const fields = new Set<string>();
  for (const [, channel] of encodedChannels(encoding)) {
    if (!numeric.has(channel.field)) fields.add(channel.field);
  }
  return [...fields];
}

/** How rows are identified across periods. */
export interface PlaybackIdentity {
  /** Row field the matrix pivots on. */
  field: string;
  /** Rows with the identity field present (bars add their derived key). */
  rows: DataRow[];
}

/**
 * The identity of each row: `encoding.key` for points and circles, and for bars the
 * `color|category` key the bar renderers stamp, so matrix keys match the marks' keys.
 * Returns undefined when the spec names no identity, which validation already rejects.
 */
export function playbackIdentity(
  markType: MarkType,
  encoding: Encoding,
  rows: DataRow[],
): PlaybackIdentity | undefined {
  if (markType !== 'bar') {
    const field = channelField(encoding.key);
    return field ? { field, rows } : undefined;
  }
  const horizontal = fieldChannel(encoding.x)?.type === 'quantitative';
  const categoryField = channelField(horizontal ? encoding.y : encoding.x);
  if (!categoryField) return undefined;
  const colorField = channelField(encoding.color);
  const keyOf = (row: DataRow) =>
    `${colorField ? String(row[colorField] ?? '') : ''}|${serializeKeyValue(row[categoryField])}`;
  return {
    field: DERIVED_KEY_FIELD,
    rows: rows.map((row) => ({ ...row, [DERIVED_KEY_FIELD]: keyOf(row) })),
  };
}
