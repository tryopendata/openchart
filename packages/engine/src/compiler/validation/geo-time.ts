/**
 * Validation of time channels on maps (RFC 2.7): `encoding.time` on geo and tile maps and
 * `points.time` on a geo map's points layer. Checks the time channel's shape and type, the
 * identity each layer plays by, the quantitative value it recolors with, one row per
 * identity and period, and the `playback` block.
 */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { validatePlaybackBlock } from './playback';

type Record_ = Record<string, unknown>;

const TIME_TYPES = ['temporal', 'ordinal', 'quantitative'];
/** Playback options that only point charts draw. */
const POINT_ONLY_OPTIONS = ['labels', 'trails'];

function isRecord(value: unknown): value is Record_ {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldOf(channel: unknown): string | undefined {
  return isRecord(channel) && typeof channel.field === 'string' ? channel.field : undefined;
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
  const type = (channel as Record_).type;
  if (typeof type === 'string' && TIME_TYPES.includes(type)) return;
  errors.push(
    invalid(
      `${path}/type`,
      `time type must be one of ${TIME_TYPES.join(', ')}, received ${JSON.stringify(type)}`,
      'Use temporal for dates and years, quantitative for numbers, ordinal for labels in order.',
    ),
  );
}

/** Error for the first identity and period pair more than one row carries. */
function checkUniqueRows(
  rows: unknown,
  identityField: string,
  timeField: string,
  path: string,
  errors: ValidationError[],
): void {
  if (!Array.isArray(rows)) return;
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isRecord(row) || row[timeField] == null || row[identityField] == null) continue;
    const cell = `${String(row[identityField])}\u0000${String(row[timeField])}`;
    if (!seen.has(cell)) {
      seen.add(cell);
      continue;
    }
    errors.push(
      invalid(
        path,
        `2 rows have ${identityField} = '${String(row[identityField])}' and ${timeField} = ${String(row[timeField])}. Aggregate them first.`,
        `Aggregate the data so each ${identityField} has one row per ${timeField}.`,
      ),
    );
    return;
  }
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
  const timeField = fieldOf(encoding.time);
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
  if (keyField && timeField) checkUniqueRows(spec.data, keyField, timeField, '/data', errors);
}

/** Errors for `points.time` on a geo map's points layer. */
function checkPointsTime(points: Record_, errors: ValidationError[]): void {
  const timeField = fieldOf(points.time);
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
  if (keyField && timeField) {
    checkUniqueRows(points.data, keyField, timeField, '/points/data', errors);
  }
}

/**
 * Append errors for a geo map with `encoding.time` or `points.time`: a time channel without a
 * field or with a type other than temporal, ordinal or quantitative; a missing
 * `encoding.key` / `points.key`; a choropleth without a quantitative color; two rows with
 * the same key and period; and problems in the `playback` block. No-op without time.
 */
export function validateGeoMapTime(spec: Record_, errors: ValidationError[]): void {
  const encoding = isRecord(spec.encoding) ? spec.encoding : {};
  const points = isRecord(spec.points) ? spec.points : undefined;
  const choroplethTime = encoding.time != null;
  const pointsTime = points?.time != null;
  if (!choroplethTime && !pointsTime) return;
  if (choroplethTime) checkChoroplethTime(spec, encoding, errors);
  if (points && pointsTime) checkPointsTime(points, errors);
  checkPlaybackBlock(spec, errors);
}

/**
 * Append errors for a tile map with `encoding.time`: a malformed time channel, data that
 * isn't an array of rows, categorical coloring (playback shades a quantitative value), two
 * rows with the same state and period, and problems in the `playback` block. No-op without time.
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
  const value = encoding.value;
  if (
    encoding.color !== undefined ||
    spec.colors !== undefined ||
    (isRecord(value) && value.type !== 'quantitative')
  ) {
    errors.push(
      invalid(
        '/encoding/value',
        'a tile map with encoding.time needs a quantitative encoding.value and no categorical color',
        'Set encoding.value to a numeric field with type: "quantitative", and remove encoding.color and colors.',
      ),
    );
  }
  const stateField = fieldOf(encoding.state);
  const timeField = fieldOf(encoding.time);
  if (stateField && timeField) checkUniqueRows(spec.data, stateField, timeField, '/data', errors);
  checkPlaybackBlock(spec, errors);
}
