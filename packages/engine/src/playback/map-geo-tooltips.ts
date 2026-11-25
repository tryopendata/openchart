/**
 * What a geo map playback tells readers at a playhead: the hovered feature's or point's
 * values at the nearest period, and the choropleth's named values for the live-region
 * summary.
 */
import type { TooltipContent } from '@opendata-ai/openchart-core';
import type { GeoPlaybackContext } from './map-geo';
import { geoValueText } from './map-geo-frames';
import { pointTooltipAt } from './map-geo-point-tooltip';
import type { NamedValue } from './map-run';
import type { MapSeries } from './map-series';

/** DOM key prefix the geo compile gives point tooltips. */
const POINT_KEY_PREFIX = 'point:';

/** "Texas, Feb 2020", with "(estimated)" when the period's value was gap-filled. */
function periodTitle(
  context: GeoPlaybackContext,
  series: MapSeries,
  name: string,
  keyIndex: number,
  period: number,
): string {
  const estimated =
    series.sampler.isPresent(keyIndex, period) && !series.sampler.isObserved(keyIndex, period);
  return `${name}, ${context.periodLabels[period]}${estimated ? ' (estimated)' : ''}`;
}

/** The hovered feature's color value at the period nearest `t`. */
function featureTooltipAt(
  context: GeoPlaybackContext,
  featureId: string,
  t: number,
): TooltipContent | undefined {
  const { plan, scales, names, keys } = context;
  const series = plan.features;
  const color = plan.prepared.normalized.encoding.color;
  const key = keys.get(featureId);
  if (!series || !color || key === undefined) return undefined;
  const keyIndex = series.keyIndex.get(key);
  if (keyIndex === undefined) return undefined;
  const period = series.sampler.nearestPeriod(t);
  const name = names.get(featureId) || key;
  const valueText = geoValueText(series, scales, keyIndex, period);
  return {
    title: periodTitle(context, series, name, keyIndex, period),
    fields: [{ label: color.title ?? color.field, value: valueText ?? 'No data', role: 'value' }],
  };
}

/**
 * The tooltip for a DOM key (a feature id or `point:<key>`) at the period nearest `t`,
 * titled with the feature or point and that period; a gap-filled period says it was
 * estimated and an absent one says "No data". Undefined for keys the playback doesn't drive.
 */
export function geoTooltipAt(
  context: GeoPlaybackContext,
  domKey: string,
  t: number,
): TooltipContent | undefined {
  if (domKey.startsWith(POINT_KEY_PREFIX)) {
    return pointTooltipAt(context, domKey.slice(POINT_KEY_PREFIX.length), t);
  }
  return featureTooltipAt(context, domKey, t);
}

/** The choropleth's shown values at a period, named by feature for the live-region summary. */
export function geoNamedValues(context: GeoPlaybackContext, period: number): NamedValue[] {
  const { plan, scales, names } = context;
  const series = plan.features;
  if (!series) return [];
  const named: NamedValue[] = [];
  for (const [key, keyIndex] of series.keyIndex) {
    if (!series.sampler.isPresent(keyIndex, period)) continue;
    const value = series.sampler.matrix.values.color[keyIndex][period];
    const featureId = scales.featureIds.get(key);
    const name = (featureId === undefined ? undefined : names.get(String(featureId))) || key;
    named.push({ name, text: scales.formatValue(value), value });
  }
  return named;
}
