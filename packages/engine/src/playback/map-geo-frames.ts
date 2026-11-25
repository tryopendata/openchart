/**
 * Geo map frames at a playhead: each joined feature's fill (stepped class colors, with the
 * RFC 3.5 crossfade to and from no data) and each point's radius, fill and fade, read back
 * from the frozen scales. Accessible labels carry the values of the nearest period.
 */
import type { GeoMapPointsLayer } from '@opendata-ai/openchart-core';
import type { GeoPlaybackContext } from './map-geo';
import { contextRow, type MapSeries, SHOWN_PRESENCE } from './map-series';
import type { GeoMapFrozenScales, MapFillFrame, MapPointFrame } from './map-types';

/** A feature's accessible label, matching the static compile's wording. */
function featureAriaLabel(name: string | undefined, featureId: string, valueText?: string) {
  if (!name) return featureId;
  return `${name}: ${valueText ?? 'no data'}`;
}

/** The formatted value a choropleth key shows at a period, or undefined without one. */
export function geoValueText(
  series: MapSeries,
  scales: GeoMapFrozenScales,
  keyIndex: number,
  period: number,
): string | undefined {
  if (!series.sampler.isPresent(keyIndex, period)) return undefined;
  return scales.formatValue(series.sampler.matrix.values.color[keyIndex][period]);
}

/**
 * One feature's paint for a value at a presence. Class colors step (a blend would show a
 * color the legend doesn't have), so a feature entering or leaving keeps its held class
 * color and fades it over the no-data treatment instead.
 */
function featurePaint(
  scales: GeoMapFrozenScales,
  value: number,
  presence: number,
): Omit<MapFillFrame, 'key' | 'ariaLabel'> {
  const { classScale } = scales;
  const noData = { fill: scales.neutralFill, noData: true };
  if (!classScale || !Number.isFinite(value) || presence <= 0) return noData;
  const shown = presence >= SHOWN_PRESENCE;
  const classed = {
    fill: classScale.color(value),
    noData: !shown,
    ...(shown ? { binIndex: classScale.binIndex(value) } : {}),
  };
  if (presence >= 1) return classed;
  return { ...classed, fade: { opacity: presence, noDataFill: scales.neutralFill } };
}

/** Each joined feature's fill at `t`: its class while shown, the no-data fill otherwise. */
export function geoFillsAt(context: GeoPlaybackContext, t: number): MapFillFrame[] {
  const { plan, scales, names } = context;
  const series = plan.features;
  if (!series) return [];
  const period = series.sampler.nearestPeriod(t);
  const fills: MapFillFrame[] = [];
  for (const [key, keyIndex] of series.keyIndex) {
    const featureId = scales.featureIds.get(key);
    if (featureId === undefined || !series.sampler.everPresent(keyIndex)) continue;
    const { values, presence } = series.sampler.stateAt(keyIndex, t);
    const id = String(featureId);
    fills.push({
      key: id,
      ...featurePaint(scales, values[0], presence),
      ariaLabel: featureAriaLabel(
        names.get(id),
        id,
        geoValueText(series, scales, keyIndex, period),
      ),
    });
  }
  return fills;
}

/** A point's color value at `t`: its color channel, else its category from the source row. */
function pointColor(
  series: MapSeries,
  points: GeoMapPointsLayer,
  keyIndex: number,
  values: number[],
  t: number,
): unknown {
  const colorAt = series.options.channels.findIndex(({ name }) => name === 'color');
  if (colorAt >= 0) return values[colorAt];
  if (!points.color) return undefined;
  return contextRow(series, keyIndex, series.sampler.nearestPeriod(t))[points.color.field];
}

/** Each point's radius, fill and fade at `t`. */
export function geoPointsAt(context: GeoPlaybackContext, t: number): MapPointFrame[] {
  const { plan, scales } = context;
  const series = plan.points;
  const points = plan.prepared.normalized.points;
  if (!series || !points) return [];
  const sizeAt = series.options.channels.findIndex(({ name }) => name === 'size');
  const period = series.sampler.nearestPeriod(t);
  const frames: MapPointFrame[] = [];
  for (const [key, keyIndex] of series.keyIndex) {
    if (!series.sampler.everPresent(keyIndex)) continue;
    const { values, presence } = series.sampler.stateAt(keyIndex, t);
    frames.push({
      key,
      r: scales.pointRadius(sizeAt >= 0 ? values[sizeAt] : undefined),
      fill: scales.pointFill(pointColor(series, points, keyIndex, values, t)),
      presence,
      ariaLabel: series.sampler.isPresent(keyIndex, period) ? key : `${key}: no data`,
    });
  }
  return frames;
}
