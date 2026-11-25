/**
 * How a point chart with `encoding.time` maps onto the playback matrix, and the render
 * spec its frames draw from: which encoding channels become numeric matrix channels,
 * which fields ride along as per-key statics, and the frozen size domain and fill opacity.
 */
import type { Encoding, EncodingChannel } from '@opendata-ai/openchart-core';
import { buildSizeScale, SIZE_SCALE_DEFAULTS } from '../../compile/size-scale';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { PlaybackChannel } from '../../playback/matrix';

/** Encoding channels whose quantitative values playback interpolates. */
const NUMERIC_CHANNELS = ['x', 'y', 'size', 'color'] as const;

/** Channels that never feed a frame's rows: time is the period, key the identity. */
const IDENTITY_CHANNELS = new Set(['time', 'key']);

function fieldChannel(channel: unknown): EncodingChannel | undefined {
  if (typeof channel !== 'object' || channel === null) return undefined;
  return typeof (channel as { field?: unknown }).field === 'string'
    ? (channel as EncodingChannel)
    : undefined;
}

/** The field a channel reads, or undefined for an absent or constant channel. */
export function channelField(channel: unknown): string | undefined {
  return fieldChannel(channel)?.field;
}

/**
 * The matrix channels a point chart's frames read: x, y, size and color when they encode
 * a quantitative field, named after the channel. A log scale makes the channel log.
 */
export function pointPlaybackChannels(encoding: Encoding): PlaybackChannel[] {
  const channels: PlaybackChannel[] = [];
  for (const name of NUMERIC_CHANNELS) {
    const channel = fieldChannel(encoding[name]);
    if (!channel || channel.type !== 'quantitative') continue;
    channels.push({ name, field: channel.field, log: channel.scale?.type === 'log' });
  }
  return channels;
}

/**
 * Every other field the encoding reads (nominal color, detail, tooltip fields, non-numeric
 * positions), carried per key as its last non-null value.
 */
export function pointStaticFields(encoding: Encoding, channels: PlaybackChannel[]): string[] {
  const numeric = new Set(channels.map(({ field }) => field));
  const fields = new Set<string>();
  for (const [name, value] of Object.entries(encoding)) {
    if (IDENTITY_CHANNELS.has(name)) continue;
    for (const channel of Array.isArray(value) ? value : [value]) {
      const field = channelField(channel);
      if (field && !numeric.has(field)) fields.add(field);
    }
  }
  return [...fields];
}

/**
 * The render spec point frames draw from: the envelope's spec with the size domain
 * pinned to the envelope's extent (unless authored) and the fill opacity fixed, so each
 * frame's handful of rows draws against the same radii and opacity as every other frame.
 */
export function freezePointRenderSpec(
  renderSpec: NormalizedChartSpec,
  pointOpacity: number,
): NormalizedChartSpec {
  const size = fieldChannel(renderSpec.encoding.size);
  const sizeScale = size?.scale?.domain
    ? null
    : buildSizeScale(size, renderSpec.data, SIZE_SCALE_DEFAULTS.point);
  const encoding =
    size && sizeScale
      ? {
          ...renderSpec.encoding,
          size: { ...size, scale: { ...size.scale, domain: sizeScale.domain } },
        }
      : renderSpec.encoding;
  return {
    ...renderSpec,
    encoding,
    markDef: { ...renderSpec.markDef, opacity: pointOpacity },
  };
}
