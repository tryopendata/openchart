/**
 * Geo map playback planning: pivoting the choropleth and points layer over time, the scope
 * that freezes a geo compile's scales over every period, the spec one frame compiles, and
 * the context frames and tooltips read back (see map-geo-frames.ts and map-geo-tooltips.ts).
 */
import type { EncodingChannel, GeoMapLayout, GeoMapPointsLayer } from '@opendata-ai/openchart-core';
import { GEO_MAP_KIND, GEO_MAP_WRONG_TYPE } from '../geo/compile-geo-map';
import type { NormalizedGeoMapSpec } from '../geo/types';
import { type PreparedMapSpec, prepareMapSpec, seriesTime } from './map-run';
import {
  everyPeriodRows,
  hasMissingCell,
  type MapSeries,
  parsedPeriodValues,
  pivotMapSeries,
  rowsAtPlayhead,
} from './map-series';
import type { GeoMapFrozenScales, GeoMapPlaybackScope } from './map-types';
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

/** What geo frames and tooltips read: the plan, the frozen scales and the feature names. */
export interface GeoPlaybackContext {
  plan: GeoPlan;
  scales: GeoMapFrozenScales;
  periodLabels: string[];
  /** Display name per feature id, for the features the base layout names. */
  names: Map<string, string>;
  /** Data key per feature id, the reverse of `scales.featureIds`. */
  keys: Map<string, string>;
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
  const prepared = prepareMapSpec(spec, GEO_MAP_KIND, GEO_MAP_WRONG_TYPE);
  const { encoding, data, points } = prepared.normalized;
  const gaps = prepared.block?.gaps ?? 'interpolate';
  const featureTime = encoding.time && seriesTime(encoding.time);
  const pointTime = points?.time && seriesTime(points.time);
  const features =
    featureTime && encoding.key && encoding.color
      ? pivotMapSeries(
          data,
          {
            identity: encoding.key.field,
            time: featureTime,
            channels: [{ name: 'color', field: encoding.color.field }],
            noun: 'features',
          },
          gaps,
          warn,
          points && pointTime ? parsedPeriodValues(points.data, pointTime) : [],
        )
      : null;
  const pointSeries =
    points && pointTime && points.key
      ? pivotMapSeries(
          points.data,
          {
            identity: points.key.field,
            time: pointTime,
            channels: pointChannels(points),
            noun: 'points',
          },
          gaps,
          warn,
          featureTime ? parsedPeriodValues(data, featureTime) : [],
        )
      : null;
  const primary = features ?? pointSeries;
  const time = encoding.time ?? points?.time;
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

/**
 * The context geo frames and tooltips read. Features without a name are left out of
 * `names`, so readers fall back to the data key.
 */
export function geoPlaybackContext(
  plan: GeoPlan,
  scales: GeoMapFrozenScales,
  periodLabels: string[],
  layout: GeoMapLayout,
): GeoPlaybackContext {
  const names = new Map<string, string>();
  for (const mark of layout.features) {
    if (mark.name) names.set(String(mark.id), mark.name);
  }
  const keys = new Map([...scales.featureIds].map(([key, id]) => [String(id), key]));
  return { plan, scales, periodLabels, names, keys };
}
