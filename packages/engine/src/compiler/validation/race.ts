import { jsonPointer, type RaceMarkType, type RaceTableColumn } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { didYouMean } from './helpers';
import { validateOptions } from './race-options';

const MARK_OPTIONS: Record<RaceMarkType, string> = {
  bar: 'cornerRadius',
  line: 'window',
  table: 'columns',
};

const TABLE_COLUMNS: readonly string[] = [
  'rank',
  'change',
  'name',
  'bar',
  'value',
  'share',
] satisfies RaceTableColumn[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateEncodingType(channel: string, type: unknown, errors: ValidationError[]): void {
  if (type === undefined) return;
  if (channel === 'value' && type !== 'quantitative') {
    errors.push({
      code: 'ENCODING_MISMATCH',
      path: '/encoding/value/type',
      message: `Spec error: encoding.value.type must be "quantitative"${typeof type === 'string' ? `, received "${type}"` : ''}`,
      suggestion:
        'Set encoding.value.type to "quantitative" or omit it, and rank a numeric column.',
    });
  }
  if (channel === 'time' && type !== 'temporal' && type !== 'ordinal' && type !== 'quantitative') {
    errors.push({
      code: 'ENCODING_MISMATCH',
      path: '/encoding/time/type',
      message: 'Spec error: encoding.time.type must be "temporal", "ordinal", or "quantitative"',
      suggestion:
        'Use "temporal" for dates or years, "ordinal" for ordered categories, or "quantitative" for numbers.',
    });
  }
}

function validateEncoding(encoding: unknown, errors: ValidationError[]): void {
  if (!isRecord(encoding)) {
    errors.push({
      code: encoding === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE',
      path: '/encoding',
      message: 'Spec error: a race requires an "encoding" object',
      suggestion:
        'Add an encoding object with time, key, and value channels that name data fields.',
    });
    return;
  }

  for (const [channel, example] of Object.entries({ time: 'year', key: 'country', value: 'gdp' })) {
    const definition = encoding[channel];
    if (!isRecord(definition)) {
      errors.push({
        code: definition === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE',
        path: jsonPointer('encoding', channel),
        message:
          definition === undefined
            ? `Spec error: race encoding requires a "${channel}" channel`
            : `Spec error: encoding.${channel} must be an object`,
        suggestion: `Add encoding.${channel} with a field from your data, e.g. { field: "${example}" }.`,
      });
      continue;
    }

    const { field, type } = definition;
    if (typeof field !== 'string' || field.trim() === '') {
      errors.push({
        code: field === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE',
        path: jsonPointer('encoding', channel, 'field'),
        message: `Spec error: encoding.${channel} requires a non-empty "field" string`,
        suggestion: `Set encoding.${channel}.field to the name of a column in your data, e.g. "${example}".`,
      });
    }
    validateEncodingType(channel, type, errors);
  }
}

function validateTableColumns(columns: unknown, errors: ValidationError[]): void {
  if (
    columns === undefined ||
    (Array.isArray(columns) &&
      columns.length > 0 &&
      new Set(columns).size === columns.length &&
      [...columns].every((column) => typeof column === 'string' && TABLE_COLUMNS.includes(column)))
  ) {
    return;
  }

  errors.push({
    code: 'INVALID_VALUE',
    path: '/mark/columns',
    message:
      'Spec error: mark.columns must be a non-empty array of supported table column names. Each column must be unique.',
    suggestion:
      'Choose one or more distinct columns from "rank", "change", "name", "bar", "value", "share" in display order, or omit columns for the defaults.',
  });
}

function validateMarkOptions(
  type: RaceMarkType,
  definition: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const { cornerRadius, window, columns } = definition;
  if (
    type === 'bar' &&
    cornerRadius !== undefined &&
    (typeof cornerRadius !== 'number' || !Number.isFinite(cornerRadius) || cornerRadius < 0)
  ) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/mark/cornerRadius',
      message: 'Spec error: mark.cornerRadius must be a finite, non-negative number of pixels',
      suggestion: 'Use cornerRadius: 4 for rounded corners or omit it for square corners.',
    });
  }
  if (type === 'line' && window !== undefined && window !== 'reveal' && window !== 'all') {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/mark/window',
      message: 'Spec error: mark.window must be "reveal" or "all"',
      suggestion: 'Use "reveal" to extend the axis to the playhead or "all" to show the full span.',
    });
  }
  if (type === 'table') validateTableColumns(columns, errors);
}

function validateMark(mark: unknown, errors: ValidationError[]): void {
  const definition = isRecord(mark) ? mark : undefined;
  const type = definition ? definition.type : mark;
  if (type !== 'bar' && type !== 'line' && type !== 'table') {
    errors.push({
      code:
        type === undefined
          ? 'MISSING_FIELD'
          : typeof type === 'string'
            ? 'INVALID_VALUE'
            : 'INVALID_TYPE',
      path: definition ? '/mark/type' : '/mark',
      message:
        typeof type === 'string'
          ? `Spec error: "${type}" is an unsupported race mark. Use "bar", "line", or "table".`
          : 'Spec error: a race mark must be "bar", "line", or "table"',
      suggestion:
        'Use mark: "bar" for horizontal bars, or set mark.type to "bar", "line", or "table".',
    });
    return;
  }

  if (!definition) return;
  const supported = MARK_OPTIONS[type];
  for (const option of Object.keys(definition)) {
    if (option === 'type' || option === supported) continue;
    errors.push({
      code: 'INVALID_VALUE',
      path: jsonPointer('mark', option),
      message: `Spec error: unknown option "${option}" on the race "${type}" mark`,
      suggestion: `Remove "${option}". The "${type}" mark supports "${supported}".${didYouMean(option, [supported])}`,
    });
  }
  validateMarkOptions(type, definition, errors);
}

function validateData(data: unknown, errors: ValidationError[]): void {
  if (!Array.isArray(data)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: '/data',
      message: 'Spec error: a race requires a "data" array',
      suggestion: 'Provide data as an array of rows with one row per key and period.',
    });
    return;
  }

  let firstInvalidRow = -1;
  let invalidCount = 0;
  for (let index = 0; index < data.length; index++) {
    if (isRecord(data[index])) continue;
    if (firstInvalidRow === -1) firstInvalidRow = index;
    invalidCount++;
  }

  if (firstInvalidRow === -1) return;
  const invalidRows = invalidCount === 1 ? 'is not an object' : 'are not objects';
  const otherRows = invalidCount > 1 ? ' and the other non-object rows' : '';
  errors.push({
    code: 'INVALID_TYPE',
    path: jsonPointer('data', firstInvalidRow),
    message: `Spec error: each race data row must be an object. ${invalidCount} of ${data.length} rows ${invalidRows}.`,
    suggestion: `Replace or remove row ${firstInvalidRow + 1}${otherRows}. Each row should name the fields used by time, key, and value.`,
  });
}

/**
 * Append race spec shape problems as ValidationErrors to `errors` without throwing.
 * The race matrix checks data values, duplicate key/period pairs, and period counts.
 */
export function validateRaceSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  validateData(spec.data, errors);
  validateEncoding(spec.encoding, errors);
  validateMark(spec.mark, errors);
  validateOptions(spec.race, errors);

  if (Object.hasOwn(spec, 'transform')) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/transform',
      message:
        "Race specs don't support transform yet. Aggregate your data to one row per key and period before passing it in.",
      suggestion: 'Remove transform and put the aggregated rows in data.',
    });
  }
}
