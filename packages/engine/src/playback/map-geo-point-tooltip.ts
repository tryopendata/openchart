/**
 * A geo map point's tooltip at a playhead: the same fields the static point tooltip lists
 * (`points.tooltip`, else the key, color and size), read from the point's row at the
 * nearest period with the playing channels' values substituted, each number in its own
 * channel's format.
 */
import {
  buildD3Formatter,
  type DataRow,
  type EncodingChannel,
  formatNumber,
  type GeoMapPointsLayer,
  type TooltipContent,
  type TooltipField,
} from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';
import type { GeoPlaybackContext } from './map-geo';
import { contextRow, type MapSeries } from './map-series';

/**
 * A point's row at a period: its nearest source row with each playing channel's value at
 * that period, null where the point is absent so its numbers read "No data".
 */
function pointRowAt(series: MapSeries, keyIndex: number, period: number): DataRow {
  const { sampler } = series;
  const present = sampler.isPresent(keyIndex, period);
  const row: DataRow = { ...contextRow(series, keyIndex, period) };
  for (const { name, field } of series.options.channels) {
    row[field] = present ? sampler.matrix.values[name][keyIndex][period] : null;
  }
  return row;
}

/** A quantitative value in the channel's own format, else the default number format. */
function formatQuantitative(channel: EncodingChannel, value: unknown): string {
  const number = finiteNumber(value);
  if (number === undefined) return 'No data';
  return (buildD3Formatter(channel.format) ?? formatNumber)(number);
}

/** One channel's field, or none for a non-numeric channel without a value. */
function channelField(
  channel: EncodingChannel,
  row: DataRow,
  role: TooltipField['role'],
  source: NonNullable<TooltipField['source']>['channel'],
): TooltipField | undefined {
  const value = row[channel.field];
  const quantitative = channel.type === 'quantitative';
  if (value == null && !quantitative) return undefined;
  return {
    label: channel.title ?? channel.field,
    value: quantitative ? formatQuantitative(channel, value) : String(value),
    role,
    source: { field: channel.field, channel: source },
  };
}

/** The fields the static point tooltip lists, read from `row`. */
function pointFields(points: GeoMapPointsLayer, row: DataRow): TooltipField[] {
  const listed = points.tooltip;
  if (listed) {
    const channels = Array.isArray(listed) ? listed : [listed];
    return channels.flatMap((channel) => channelField(channel, row, 'value', 'tooltip') ?? []);
  }
  const fields = [
    points.key && channelField(points.key, row, 'series', 'key'),
    points.color && channelField(points.color, row, 'value', 'color'),
    points.size && channelField({ ...points.size, type: 'quantitative' }, row, 'value', 'size'),
  ];
  return fields.filter((field): field is TooltipField => field !== undefined && field !== null);
}

/**
 * The hovered point's tooltip at the period nearest `t`, titled with its key and that
 * period. Undefined for points the playback doesn't drive.
 */
export function pointTooltipAt(
  context: GeoPlaybackContext,
  key: string,
  t: number,
): TooltipContent | undefined {
  const { plan, periodLabels } = context;
  const series = plan.points;
  const points = plan.prepared.normalized.points;
  const keyIndex = series?.keyIndex.get(key);
  if (!series || !points || keyIndex === undefined) return undefined;
  const period = series.sampler.nearestPeriod(t);
  const { sampler } = series;
  const estimated = sampler.isPresent(keyIndex, period) && !sampler.isObserved(keyIndex, period);
  return {
    title: `${key}, ${periodLabels[period]}${estimated ? ' (estimated)' : ''}`,
    fields: pointFields(points, pointRowAt(series, keyIndex, period)),
  };
}
