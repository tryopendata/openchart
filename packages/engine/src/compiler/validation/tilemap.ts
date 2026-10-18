/** TileMap spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { checkSchemeUnused, didYouMean, MAP_PALETTE_NAMES } from './helpers';

// ---------------------------------------------------------------------------
// TileMap validation
// ---------------------------------------------------------------------------

export function validateTileMapSpec(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  // Validate data (can be record or array)
  if (!spec.data || typeof spec.data !== 'object') {
    errors.push({
      message: 'Spec error: tilemap spec requires a "data" field (record or array)',
      path: '/data',
      code: 'INVALID_TYPE',
      suggestion:
        'Provide data as either a record mapping state codes to values (e.g. { "CA": 12000, "TX": 8500 }) or an array of objects with state and value fields',
    });
    return;
  }

  // If data is an object (record), validate it has at least one entry
  if (!Array.isArray(spec.data) && Object.keys(spec.data as Record<string, unknown>).length === 0) {
    errors.push({
      message: 'Spec error: "data" must have at least one entry',
      path: '/data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one state-value pair, e.g. { "CA": 12000 }',
    });
    return;
  }

  // If data is an array, validate it's non-empty
  if (Array.isArray(spec.data)) {
    if (spec.data.length === 0) {
      errors.push({
        message: 'Spec error: "data" array must be non-empty',
        path: '/data',
        code: 'EMPTY_DATA',
        suggestion: 'Add at least one data row',
      });
      return;
    }

    const firstRow = spec.data[0] as unknown;
    if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
      errors.push({
        message: 'Spec error: each item in "data" must be a plain object',
        path: '/data/0',
        code: 'INVALID_TYPE',
        suggestion: 'Each data item should be an object, e.g. { state: "CA", value: 12000 }',
      });
      return;
    }

    // If data is array, encoding is required
    if (!spec.encoding || typeof spec.encoding !== 'object') {
      errors.push({
        message:
          'Spec error: tilemap spec with array data requires an "encoding" object with state and value channels',
        path: '/encoding',
        code: 'MISSING_FIELD',
        suggestion:
          'Add an encoding object, e.g. encoding: { state: { field: "state", type: "nominal" }, value: { field: "value", type: "quantitative" } }',
      });
      return;
    }

    const encoding = spec.encoding as Record<string, unknown>;
    const dataColumns = new Set(Object.keys(firstRow as Record<string, unknown>));
    const columnList = [...dataColumns];
    const availableColumns = columnList.join(', ');

    // Required channels
    for (const channel of ['state', 'value'] as const) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (!ch || typeof ch !== 'object') {
        errors.push({
          message: `Spec error: tilemap encoding requires "${channel}" channel`,
          path: jsonPointer('encoding', channel),
          code: 'MISSING_FIELD',
          suggestion: `Add encoding.${channel} with a field from your data (${availableColumns}). Example: ${channel}: { field: "${columnList[0] ?? 'myField'}", type: "${channel === 'value' ? 'quantitative' : 'nominal'}" }`,
        });
        continue;
      }

      if (!ch.field || typeof ch.field !== 'string') {
        errors.push({
          message: `Spec error: encoding.${channel} must have a "field" string`,
          path: jsonPointer('encoding', channel, 'field'),
          code: 'MISSING_FIELD',
          suggestion: `Add a field name from your data columns: ${availableColumns}`,
        });
        continue;
      }

      if (!dataColumns.has(ch.field as string)) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist in data. Available columns: ${availableColumns}`,
          path: jsonPointer('encoding', channel, 'field'),
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(ch.field as string, columnList)}`,
        });
      }
    }
  }

  // Tilemap never reads scale.scheme: fills come from the top-level palette
  // prop (encoding may be present in both record-map and array-data modes)
  if (spec.encoding && typeof spec.encoding === 'object') {
    checkSchemeUnused(
      spec.encoding as Record<string, unknown>,
      errors,
      'tilemap fills come from the top-level palette property',
      `Remove scale.scheme and set the top-level palette property instead, e.g. palette: "green". Supported: ${MAP_PALETTE_NAMES}.`,
    );
  }
}
