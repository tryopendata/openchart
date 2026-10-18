/** Table spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { didYouMean } from './helpers';

// ---------------------------------------------------------------------------
// Table validation
// ---------------------------------------------------------------------------

export function validateTableSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  if (!Array.isArray(spec.data)) {
    errors.push({
      message: 'Spec error: "data" must be an array',
      path: '/data',
      code: 'INVALID_TYPE',
      suggestion: 'Provide data as an array of objects, e.g. data: [{ name: "Alice", age: 30 }]',
    });
    return;
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" must be a non-empty array',
      path: '/data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one data row to the data array',
    });
    return;
  }

  if (!Array.isArray(spec.columns)) {
    errors.push({
      message: 'Spec error: table spec requires a "columns" array',
      path: '/columns',
      code: 'MISSING_FIELD',
      suggestion:
        'Add a columns array defining which data fields to display, e.g. columns: [{ key: "name" }, { key: "age" }]',
    });
    return;
  }

  const data = spec.data as Record<string, unknown>[];
  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
    errors.push({
      message: 'Spec error: each item in "data" must be a plain object',
      path: '/data/0',
      code: 'INVALID_TYPE',
      suggestion:
        'Each data item should be an object with key-value pairs, e.g. { name: "Alice", age: 30 }',
    });
    return;
  }

  const dataColumns = new Set(Object.keys(firstRow as Record<string, unknown>));
  const columnList = [...dataColumns];
  const availableColumns = columnList.join(', ');
  const columns = spec.columns as Record<string, unknown>[];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (!col || typeof col !== 'object') {
      errors.push({
        message: `Spec error: columns[${i}] must be an object`,
        path: jsonPointer('columns', i),
        code: 'INVALID_TYPE',
        suggestion: 'Each column entry should be an object, e.g. { key: "fieldName" }',
      });
      continue;
    }

    // Check key exists
    if (!col.key || typeof col.key !== 'string') {
      errors.push({
        message: `Spec error: columns[${i}] must have a "key" string`,
        path: jsonPointer('columns', i, 'key'),
        code: 'MISSING_FIELD',
        suggestion: `Add a key referencing a data field. Available columns: ${availableColumns}`,
      });
      continue;
    }

    // Check key references a field in data
    if (!dataColumns.has(col.key as string)) {
      errors.push({
        message: `Spec error: columns[${i}].key "${col.key}" does not exist in data. Available columns: ${availableColumns}`,
        path: jsonPointer('columns', i, 'key'),
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(col.key as string, columnList)}`,
      });
    }

    // Check at most one visual enhancement
    const visuals = ['heatmap', 'bar', 'sparkline', 'image', 'flag', 'categoryColors'].filter(
      (v) => col[v] != null && col[v] !== false,
    );
    if (visuals.length > 1) {
      errors.push({
        message: `Spec error: columns[${i}] has multiple visual features (${visuals.join(', ')}). Only one is allowed per column.`,
        path: jsonPointer('columns', i),
        code: 'INVALID_VALUE',
        suggestion: `Keep only one visual feature per column. Remove all but one of: ${visuals.join(', ')}`,
      });
    }
  }
}
