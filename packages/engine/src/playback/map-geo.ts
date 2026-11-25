/**
 * Geo map playback: pivoting the choropleth and points layer over time, the scope that
 * freezes a geo compile's scales over every period, and the fills, points and text each
 * frame reads back from the frozen scales.
 */
import type {
  EncodingChannel,
  GeoMapPointsLayer,
  TooltipContent,
} from '@opendata-ai/openchart-core';
import type { NormalizedGeoMapSpec } from '../geo/types';
import { type PreparedMapSpec, prepareMapSpec, seriesTime } from './map-run';
import {
  contextRow,
  everyPeriodRows,
  hasMissingCell,
  type MapSeries,
  pivotMapSeries,
  rawPeriodValues,
  rowsAtPlayhead,
  SHOWN_PRESENCE,
} from './map-series';
import type {
  GeoMapFrozenScales,
  GeoMapPlaybackScope,
  MapFillFrame,
  MapPointFrame,
} from './map-types';
import type { PlaybackChannel } from './matrix';

/** A geo map spec pivoted for playback. */
export interface GeoPlan {
  prepared: PreparedMapSpec<NormalizedGeoMapSpec>;
  /** The choropleth over time, when `encoding.time` is set. */
  features: MapSeries | null;
  /** The points layer over time, when `points.time` is set. */
  points: MapSeries | null;
  /** The series whose periods the run plays: the choropleth's, else the points'. */
  primary: MapSeries;
  time: EncodingChannel;
}

function pointChannels(points: GeoMapPointsLayer): PlaybackChannel[] {
  // Latitude is always there for a drawn point, so it decides when a point is present.
  const channels: PlaybackChannel[] = [{ name: 'lat', field: points.latitude.field }];
  if (points.size?.type === 'quantitative')
    channels.push({ name: 'size', field: points.size.field });
  if (points.color?.type === 'quantitative') {
    channels.push({ name: 'color', field: points.color.field });
  }
  return channels;
}

/**
 * Validate a geo map spec and pivot each layer that has a time channel. When both play,
 * each layer's period list includes the other's, so one playhead indexes both.
 *
 * @throws The validation error compile throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a key and period.
 * @throws {Error} When neither layer has a time channel; callers check first.
 */
export function planGeoPlayback(spec: unknown, warn: (message: string) => void): GeoPlan {
  const prepared = prepareMapSpec<NormalizedGeoMapSpec>(spec);
  const { encoding, data, points } = prepared.normalized;
  const gaps = prepared.block?.gaps ?? 'interpolate';
  const featureTime = encoding.time;
  const pointTime = points?.time;
  const features =
    featureTime && encoding.key && encoding.color
      ? pivotMapSeries(
          data,
          {
            identity: encoding.key.field,
            time: seriesTime(featureTime),
            channels: [{ name: 'color', field: encoding.color.field }],
            noun: 'features',
          },
          gaps,
          warn,
          points && pointTime ? rawPeriodValues(points.data, pointTime.field) : [],
        )
      : null;
  const pointSeries =
    points && pointTime && points.key
      ? pivotMapSeries(
          points.data,
          {
            identity: points.key.field,
            time: seriesTime(pointTime),
            channels: pointChannels(points),
            noun: 'points',
          },
          gaps,
          warn,
          featureTime ? rawPeriodValues(data, featureTime.field) : [],
        )
      : null;
  const primary = features ?? pointSeries;
  const time = featureTime ?? pointTime;
  if (!primary || !time) {
    throw new Error(
      'Geo map playback needs encoding.time with encoding.key and a color, or points.time with points.key. Map time validation should have rejected this spec.',
    );
  }
  return { prepared, features, points: pointSeries, primary, time };
}

/** The scope that freezes a geo compile's classes, sizes and legend over every period. */
export function geoScope(
  plan: GeoPlan,
  capture?: (scales: GeoMapFrozenScales) => void,
): GeoMapPlaybackScope {
  const { features, points } = plan;
  const last = plan.primary.sampler.matrix.periods.length - 1;
  return {
    colorRows: features ? everyPeriodRows(features) : undefined,
    pointRows: points ? everyPeriodRows(points) : undefined,
    keyRows: features ? rowsAtPlayhead(features, last, false) : undefined,
    noDataEver: features ? hasMissingCell(features) : false,
    capture,
  };
}

/**
 * The spec one frame compiles: the choropleth's rows shown at `t`, and the points shown at
 * `t` or, for the mounted base, every point held at `t` so each has an element to fade.
 */
export function geoFrameSpec(plan: GeoPlan, t: number, holdPoints: boolean): unknown {
  const { expanded } = plan.prepared;
  const frame: Record<string, unknown> = { ...expanded };
  if (plan.features) frame.data = rowsAtPlayhead(plan.features, t, true);
  if (plan.points) {
    frame.points = {
      ...(expanded.points as GeoMapPointsLayer),
      data: rowsAtPlayhead(plan.points, t, !holdPoints),
    };
  }
  return frame;
}

/** Each joined feature's fill at `t`: its class while shown, the no-data fill otherwise. */
export function geoFillsAt(
  series: MapSeries | null,
  scales: GeoMapFrozenScales,
  t: number,
): MapFillFrame[] {
  if (!series) return [];
  const fills: MapFillFrame[] = [];
  for (const [key, keyIndex] of series.keyIndex) {
    const featureId = scales.featureIds.get(key);
    if (featureId === undefined || !series.sampler.everPresent(keyIndex)) continue;
    const { values, presence } = series.sampler.stateAt(keyIndex, t);
    const value = values[0];
    const shown = presence >= SHOWN_PRESENCE && Number.isFinite(value) && scales.classScale;
    fills.push(
      shown && scales.classScale
        ? {
            key: String(featureId),
            fill: scales.classScale.color(value),
            binIndex: scales.classScale.binIndex(value),
            noData: false,
          }
        : { key: String(featureId), fill: scales.neutralFill, noData: true },
    );
  }
  return fills;
}

/** Each point's radius, fill and fade at `t`. */
export function geoPointsAt(
  series: MapSeries | null,
  points: GeoMapPointsLayer | undefined,
  scales: GeoMapFrozenScales,
  t: number,
): MapPointFrame[] {
  if (!series || !points) return [];
  const channels = series.options.channels.map(({ name }) => name);
  const sizeAt = channels.indexOf('size');
  const colorAt = channels.indexOf('color');
  const frames: MapPointFrame[] = [];
  for (const [key, keyIndex] of series.keyIndex) {
    if (!series.sampler.everPresent(keyIndex)) continue;
    const { values, presence } = series.sampler.stateAt(keyIndex, t);
    const color =
      colorAt >= 0
        ? values[colorAt]
        : points.color
          ? contextRow(series, keyIndex, series.sampler.nearestPeriod(t))[points.color.field]
          : undefined;
    frames.push({
      key,
      r: scales.pointRadius(sizeAt >= 0 ? values[sizeAt] : undefined),
      fill: scales.pointFill(color),
      presence,
    });
  }
  return frames;
}

/** The color value a data key shows at a period, formatted, or null when it has none. */
export function geoObservedAt(
  series: MapSeries | null,
  field: string | undefined,
  scales: GeoMapFrozenScales,
  key: string,
  period: number,
): Record<string, string> | null {
  const keyIndex = series?.keyIndex.get(key);
  if (!series || !field || keyIndex === undefined) return null;
  if (!series.sampler.isPresent(keyIndex, period)) return null;
  const value = series.sampler.matrix.values.color[keyIndex][period];
  return { [field]: scales.formatValue(value) };
}

/** What the geo tooltip names for each driven feature. */
export interface GeoTooltipContext {
  plan: GeoPlan;
  scales: GeoMapFrozenScales;
  periodLabels: string[];
  /** Display name per feature id, from the base layout. */
  names: Map<string, string>;
  /** Data key per feature id, the reverse of `scales.featureIds`. */
  keys: Map<string, string>;
}

/**
 * The hovered feature's value at the period nearest `t`, titled with the feature and that
 * period; a gap-filled period says it was estimated. Undefined for features the choropleth
 * playback doesn't drive.
 */
export function geoTooltipAt(
  context: GeoTooltipContext,
  domKey: string,
  t: number,
): TooltipContent | undefined {
  const { plan, scales, periodLabels, names, keys } = context;
  const series = plan.features;
  const color = plan.prepared.normalized.encoding.color;
  if (!series || !color) return undefined;
  const key = keys.get(domKey);
  const keyIndex = key === undefined ? undefined : series.keyIndex.get(key);
  if (keyIndex === undefined) return undefined;
  const period = series.sampler.nearestPeriod(t);
  const present = series.sampler.isPresent(keyIndex, period);
  const estimated = present && !series.sampler.isObserved(keyIndex, period);
  const value = series.sampler.matrix.values.color[keyIndex][period];
  return {
    title: `${names.get(domKey) ?? key}, ${periodLabels[period]}${estimated ? ' (estimated)' : ''}`,
    fields: [
      {
        label: color.title ?? color.field,
        value: present ? scales.formatValue(value) : 'No data',
        role: 'value',
      },
    ],
  };
}

/** The choropleth's shown values at a period, named for the live-region summary. */
export function geoNamedValues(
  series: MapSeries | null,
  scales: GeoMapFrozenScales,
  period: number,
): Array<{ name: string; text: string; value: number }> {
  if (!series) return [];
  const named: Array<{ name: string; text: string; value: number }> = [];
  for (const [key, keyIndex] of series.keyIndex) {
    if (!series.sampler.isPresent(keyIndex, period)) continue;
    const value = series.sampler.matrix.values.color[keyIndex][period];
    named.push({ name: key, text: scales.formatValue(value), value });
  }
  return named;
}
