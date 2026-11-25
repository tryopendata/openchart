/**
 * Tile map playback: pivoting the state values over time, the scope that freezes a tile
 * compile's value scale over every period, and the tile paint each frame reads back.
 */
import type { EncodingChannel, TileMapTileMark, TooltipContent } from '@opendata-ai/openchart-core';
import type { NormalizedTileMapSpec } from '../tilemap/types';
import { type PreparedMapSpec, prepareMapSpec, seriesTime } from './map-run';
import {
  everyPeriodRows,
  hasMissingCell,
  type MapSeries,
  pivotMapSeries,
  rowsAtPlayhead,
  SHOWN_PRESENCE,
} from './map-series';
import type { MapFillFrame, TileMapFrozenTiles, TileMapPlaybackScope } from './map-types';

/** A tile map spec pivoted for playback. */
export interface TilePlan {
  prepared: PreparedMapSpec<NormalizedTileMapSpec>;
  series: MapSeries;
  time: EncodingChannel;
  /** The value field the tiles encode. */
  valueField: string;
}

/**
 * Validate a tile map spec and pivot its values by state and period.
 *
 * @throws The validation error compile throws for an invalid spec.
 * @throws {PlaybackDataError} DUPLICATE_KEY_PERIOD when two rows share a state and period.
 * @throws {Error} When the spec has no time channel; callers check first.
 */
export function planTilePlayback(spec: unknown, warn: (message: string) => void): TilePlan {
  const prepared = prepareMapSpec<NormalizedTileMapSpec>(spec);
  const { encoding, data } = prepared.normalized;
  const time = encoding.time;
  if (!time) {
    throw new Error(
      'Tile map playback needs encoding.time. Map time validation should have rejected this spec.',
    );
  }
  const series = pivotMapSeries(
    data,
    {
      identity: encoding.state.field,
      time: seriesTime(time),
      channels: [{ name: 'value', field: encoding.value.field }],
      noun: 'states',
    },
    prepared.block?.gaps ?? 'interpolate',
    warn,
  );
  return { prepared, series, time, valueField: encoding.value.field };
}

/** The scope that freezes a tile compile's value scale and legend over every period. */
export function tileScope(
  plan: TilePlan,
  capture?: (tiles: TileMapFrozenTiles) => void,
): TileMapPlaybackScope {
  return {
    valueRows: everyPeriodRows(plan.series),
    noDataEver: hasMissingCell(plan.series),
    capture,
  };
}

/** The spec one frame compiles: the states shown at `t`. */
export function tileFrameSpec(plan: TilePlan, t: number): unknown {
  const rows = rowsAtPlayhead(plan.series, t, true);
  const { encoding } = plan.prepared.normalized;
  // Tile validation rejects empty data; one row with no value draws the same empty grid.
  const firstKey = plan.series.keyIndex.keys().next().value ?? '';
  const data = rows.length
    ? rows
    : [{ [encoding.state.field]: firstKey, [encoding.value.field]: null }];
  return { ...plan.prepared.expanded, data };
}

/** A tile mark's paint as a frame entry. */
function tileFill(tile: TileMapTileMark): MapFillFrame {
  return {
    key: tile.stateCode,
    fill: tile.fill,
    fillOpacity: tile.fillOpacity,
    stroke: tile.stroke,
    noData: !tile.hasData,
    labels: {
      codeFill: tile.label.style.fill,
      valueText: tile.valueLabel.text,
      valueFill: tile.valueLabel.style.fill,
    },
  };
}

/** Each drawn tile's paint at `t`: its value's shade while shown, the empty tile otherwise. */
export function tileFillsAt(
  series: MapSeries,
  tiles: TileMapFrozenTiles,
  drawn: ReadonlySet<string>,
  t: number,
): MapFillFrame[] {
  const fills: MapFillFrame[] = [];
  for (const [key, keyIndex] of series.keyIndex) {
    if (!drawn.has(key) || !series.sampler.everPresent(keyIndex)) continue;
    const { values, presence } = series.sampler.stateAt(keyIndex, t);
    const value = presence >= SHOWN_PRESENCE && Number.isFinite(values[0]) ? values[0] : null;
    fills.push(tileFill(tiles.tileAt(key, value)));
  }
  return fills;
}

/** The value a state shows at a period, formatted as its tile prints it, or null. */
export function tileObservedAt(
  plan: TilePlan,
  tiles: TileMapFrozenTiles,
  key: string,
  period: number,
): Record<string, string> | null {
  const keyIndex = plan.series.keyIndex.get(key);
  if (keyIndex === undefined || !plan.series.sampler.isPresent(keyIndex, period)) return null;
  const value = plan.series.sampler.matrix.values.value[keyIndex][period];
  return { [plan.valueField]: tiles.tileAt(key, value).formattedValue };
}

/**
 * The hovered state's value at the period nearest `t`, titled with the state and that
 * period; a gap-filled period says it was estimated. Undefined for states without data.
 */
export function tileTooltipAt(
  plan: TilePlan,
  tiles: TileMapFrozenTiles,
  periodLabels: string[],
  stateCode: string,
  t: number,
): TooltipContent | undefined {
  const { series } = plan;
  const keyIndex = series.keyIndex.get(stateCode);
  if (keyIndex === undefined) return undefined;
  const period = series.sampler.nearestPeriod(t);
  const present = series.sampler.isPresent(keyIndex, period);
  const estimated = present && !series.sampler.isObserved(keyIndex, period);
  const tile = tiles.tileAt(
    stateCode,
    present ? series.sampler.matrix.values.value[keyIndex][period] : null,
  );
  const name = String(tile.data.stateName ?? stateCode);
  const value = plan.prepared.normalized.encoding.value;
  return {
    title: `${name}, ${periodLabels[period]}${estimated ? ' (estimated)' : ''}`,
    fields: [
      {
        label: value.title ?? value.field,
        value: present ? tile.formattedValue : 'No data',
        role: 'value',
      },
    ],
  };
}

/** The states' values at a period, named for the live-region summary. */
export function tileNamedValues(
  plan: TilePlan,
  tiles: TileMapFrozenTiles,
  period: number,
): Array<{ name: string; text: string; value: number }> {
  const named: Array<{ name: string; text: string; value: number }> = [];
  for (const [key, keyIndex] of plan.series.keyIndex) {
    if (!plan.series.sampler.isPresent(keyIndex, period)) continue;
    const value = plan.series.sampler.matrix.values.value[keyIndex][period];
    const tile = tiles.tileAt(key, value);
    named.push({ name: String(tile.data.stateName ?? key), text: tile.formattedValue, value });
  }
  return named;
}
