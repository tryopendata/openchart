/**
 * Validation of time channels on maps (RFC 2.7): `encoding.time` on geo and tile maps and
 * `points.time` on a geo map's points layer. Checks the time channel's shape and type, the
 * identity each layer plays by, the quantitative value it recolors with, one row per
 * identity and period, matching time types across layers, and the `playback` block.
 */
import { jsonPointer } from '@opendata-ai/openchart-core';
import { type PlaybackTimeType, readPeriod } from '../../playback/periods';
import type { ValidationError } from '../types';
import { validatePlaybackBlock } from './playback';

type Record_ = Record<string, unknown>;

const TIME_TYPES = ['temporal', 'ordinal', 'quantitative'];
/** Playback options that only point charts draw. */
const POINT_ONLY_OPTIONS = ['labels', 'trails'];

/** Rows sharing one identity and one period, as the playback matrix reads periods. */
interface KeyPeriodCell {
  identity: string;
  period: string | number;
  count: number;
}

function isRecord(value: unknown): value is Record_ {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldOf(channel: unknown): string | undefined {
  return isRecord(channel) && typeof channel.field === 'string' ? channel.field : undefined;
}

/** The time type a channel declares, when it's one playback reads. */
function timeTypeOf(channel: unknown): PlaybackTimeType | undefined {
  const type = isRecord(channel) ? channel.type : undefined;
  return typeof type === 'string' && TIME_TYPES.includes(type)
    ? (type as PlaybackTimeType)
    : undefined;
}

function invalid(path: string, message: string, suggestion: string): ValidationError {
  return { code: 'INVALID_VALUE', path, message: `Spec error: ${message}`, suggestion };
}

/** Errors for a time channel without a field or with a type playback can't order. */
function checkTimeChannel(channel: unknown, path: string, errors: ValidationError[]): void {
  if (!fieldOf(channel)) {
    errors.push({
      code: 'MISSING_FIELD',
      path: `${path}/field`,
      message: 'Spec error: a time channel needs a "field" string',
      suggestion:
        'Name the field holding each period, e.g. time: { field: "month", type: "temporal" }.',
    });
    return;
  }
  if (timeTypeOf(channel)) return;
  errors.push(
    invalid(
      `${path}/type`,
      `time type must be one of ${TIME_TYPES.join(', ')}, received ${JSON.stringify((channel as Record_).type)}`,
      'Use temporal for dates and years, quantitative for numbers, ordinal for labels in order.',
    ),
  );
}

/** Rows per identity and period. Rows whose period doesn't read are left to the matrix. */
function countRowsPerCell(
  rows: unknown[],
  identityField: string,
  timeField: string,
  timeType: PlaybackTimeType,
): KeyPeriodCell[] {
  const cells = new Map<string, KeyPeriodCell>();
  for (const row of rows) {
    if (!isRecord(row) || row[identityField] == null) continue;
    const period = readPeriod(row[timeField], timeType);
    if (!period) continue;
    const identity = String(row[identityField]);
    // The matrix keys periods by value, so the year 2020 and the string '2020' differ.
    const cell = `${identity}\u0000${typeof period.value}\u0000${String(period.value)}`;
    const seen = cells.get(cell);
    if (seen) seen.count += 1;
    else cells.set(cell, { identity, period: period.value, count: 1 });
  }
  return [...cells.values()];
}

/** Error for the first identity and period pair more than one row carries. */
function checkUniqueRows(
  rows: unknown,
  identityField: string,
  time: unknown,
  path: string,
  errors: ValidationError[],
): void {
  const timeField = fieldOf(time);
  const timeType = timeTypeOf(time);
  if (!Array.isArray(rows) || !timeField || !timeType) return;
  const collision = countRowsPerCell(rows, identityField, timeField, timeType).find(
    ({ count }) => count > 1,
  );
  if (!collision) return;
  errors.push(
    invalid(
      path,
      `${collision.count} rows have ${identityField} = '${collision.identity}' and ${timeField} = '${String(collision.period)}'. Aggregate them first.`,
      `Aggregate the data so each ${identityField} has one row per ${timeField}.`,
    ),
  );
}

/** Errors for a playback block option only point charts support. */
function checkPlaybackBlock(spec: Record_, errors: ValidationError[]): void {
  validatePlaybackBlock('playback', spec.playback, errors);
  if (!isRecord(spec.playback)) return;
  for (const option of POINT_ONLY_OPTIONS) {
    const value = spec.playback[option];
    if (value === undefined || value === false) continue;
    errors.push(
      invalid(
        jsonPointer('playback', option),
        `playback.${option} is only supported on point charts, not maps`,
        `Remove playback.${option}.`,
      ),
    );
  }
}

/** Errors for `encoding.time` on a geo map's choropleth. */
function checkChoroplethTime(spec: Record_, encoding: Record_, errors: ValidationError[]): void {
  checkTimeChannel(encoding.time, '/encoding/time', errors);
  const keyField = fieldOf(encoding.key);
  if (!keyField) {
    errors.push({
      code: 'MISSING_FIELD',
      path: '/encoding/key',
      message: 'Spec error: a map with encoding.time needs encoding.key',
      suggestion:
        'Add encoding.key: { field: "<join field>" } so each feature can be followed over time.',
    });
  }
  const color = encoding.color;
  if (!isRecord(color) || color.type !== 'quantitative') {
    errors.push(
      invalid(
        '/encoding/color',
        'a map with encoding.time needs a quantitative encoding.color to recolor each period',
        'Set encoding.color to a numeric field with type: "quantitative", or remove encoding.time.',
      ),
    );
  }
  if (keyField) checkUniqueRows(spec.data, keyField, encoding.time, '/data', errors);
}

/** Errors for `points.time` on a geo map's points layer. */
function checkPointsTime(points: Record_, errors: ValidationError[]): void {
  checkTimeChannel(points.time, '/points/time', errors);
  const keyField = fieldOf(points.key);
  if (!keyField) {
    errors.push({
      code: 'MISSING_FIELD',
      path: '/points/key',
      message: 'Spec error: points.time needs points.key',
      suggestion:
        'Add points.key: { field: "<id field>" } so each point can be followed over time.',
    });
  }
  if (keyField) checkUniqueRows(points.data, keyField, points.time, '/points/data', errors);
}

/**
 * Error for a choropleth and points layer that both play but read time differently: one
 * playhead indexes both layers' periods, so they must order periods the same way.
 */
function checkLayersShareTimeType(
  encoding: Record_,
  points: Record_,
  errors: ValidationError[],
): void {
  const featureType = timeTypeOf(encoding.time);
  const pointType = timeTypeOf(points.time);
  if (!featureType || !pointType || featureType === pointType) return;
  errors.push(
    invalid(
      '/points/time/type',
      `encoding.time is ${featureType} but points.time is ${pointType}; both layers play on one timeline`,
      `Give encoding.time and points.time the same type, e.g. both "${featureType}".`,
    ),
  );
}

/**
 * Append errors for a geo map with `encoding.time` or `points.time`: a time channel without a
 * field or with a type other than temporal, ordinal or quantitative; a missing
 * `encoding.key` / `points.key`; a choropleth without a quantitative color; two rows with
 * the same key and period; layers whose time types differ; and problems in the `playback`
 * block. No-op without time.
 */
export function validateGeoMapTime(spec: Record_, errors: ValidationError[]): void {
  const encoding = isRecord(spec.encoding) ? spec.encoding : {};
  const points = isRecord(spec.points) ? spec.points : undefined;
  const choroplethTime = encoding.time != null;
  const pointsTime = points?.time != null;
  if (!choroplethTime && !pointsTime) return;
  if (choroplethTime) checkChoroplethTime(spec, encoding, errors);
  if (points && pointsTime) checkPointsTime(points, errors);
  if (points && choroplethTime && pointsTime) checkLayersShareTimeType(encoding, points, errors);
  checkPlaybackBlock(spec, errors);
}

/** Errors for tile map coloring playback can't shade: categorical color, or a non-numeric value. */
function checkTileColoring(spec: Record_, encoding: Record_, errors: ValidationError[]): void {
  const value = encoding.value;
  // Without a type the static tile map reads the value as quantitative, and so does playback.
  if (isRecord(value) && value.type !== undefined && value.type !== 'quantitative') {
    errors.push(
      invalid(
        '/encoding/value',
        `a tile map with encoding.time needs a quantitative encoding.value, received type ${JSON.stringify(value.type)}`,
        'Set encoding.value to a numeric field with type: "quantitative".',
      ),
    );
  }
  if (encoding.color !== undefined) {
    errors.push(
      invalid(
        '/encoding/color',
        'a tile map with encoding.time shades encoding.value, so it cannot use categorical encoding.color',
        'Remove encoding.color, or remove encoding.time for a categorical tile map.',
      ),
    );
  }
  if (spec.colors !== undefined) {
    errors.push(
      invalid(
        '/colors',
        'a tile map with encoding.time shades encoding.value, so it cannot use categorical colors',
        'Remove colors, or remove encoding.time for a categorical tile map.',
      ),
    );
  }
}

/**
 * Append errors for a tile map with `encoding.time`: a malformed time channel, data that
 * isn't an array of rows, categorical coloring or a non-quantitative value (playback shades a
 * quantitative value), two rows with the same state and period, and problems in the
 * `playback` block. No-op without time.
 */
export function validateTileMapTime(spec: Record_, errors: ValidationError[]): void {
  const encoding = isRecord(spec.encoding) ? spec.encoding : {};
  if (encoding.time == null) return;
  checkTimeChannel(encoding.time, '/encoding/time', errors);
  if (!Array.isArray(spec.data)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: '/data',
      message: 'Spec error: a tile map with encoding.time needs data as an array of rows',
      suggestion:
        'Give one row per state and period, e.g. { state: "CA", month: "2020-04", rate: 5.1 }.',
    });
  }
  checkTileColoring(spec, encoding, errors);
  const stateField = fieldOf(encoding.state);
  if (stateField) checkUniqueRows(spec.data, stateField, encoding.time, '/data', errors);
  checkPlaybackBlock(spec, errors);
}
