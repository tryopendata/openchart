/** BarList spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { checkSchemeUnused, didYouMean } from './helpers';

// ---------------------------------------------------------------------------
// BarList validation
// ---------------------------------------------------------------------------

export function validateBarListSpec(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!Array.isArray(spec.data)) {
    errors.push({
      message: 'Spec error: barlist spec requires a "data" array',
      path: '/data',
      code: 'INVALID_TYPE',
      suggestion:
        'Provide data as an array of objects, e.g. data: [{ label: "Category A", value: 42 }]',
    });
    return;
  }

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
      suggestion: 'Each data item should be an object, e.g. { label: "Category A", value: 42 }',
    });
    return;
  }

  if (!spec.encoding || typeof spec.encoding !== 'object') {
    errors.push({
      message:
        'Spec error: barlist spec requires an "encoding" object with label and value channels',
      path: '/encoding',
      code: 'MISSING_FIELD',
      suggestion:
        'Add an encoding object, e.g. encoding: { label: { field: "name", type: "nominal" }, value: { field: "count", type: "quantitative" } }',
    });
    return;
  }

  const encoding = spec.encoding as Record<string, unknown>;
  const dataColumns = new Set(Object.keys(firstRow as Record<string, unknown>));
  const columnList = [...dataColumns];
  const availableColumns = columnList.join(', ');

  for (const channel of ['label', 'value'] as const) {
    const ch = encoding[channel] as Record<string, unknown> | undefined;
    if (!ch || typeof ch !== 'object') {
      errors.push({
        message: `Spec error: barlist encoding requires "${channel}" channel`,
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

  // Validate optional encoding channels
  for (const channel of ['subtitle', 'color', 'tooltip', 'group', 'description'] as const) {
    const ch = encoding[channel] as Record<string, unknown> | undefined;
    if (!ch) continue;
    const field = ch.field;
    if (field && typeof field === 'string' && !dataColumns.has(field)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${field}" does not exist in data. Available columns: ${availableColumns}`,
        path: jsonPointer('encoding', channel, 'field'),
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(field, columnList)}`,
      });
    }
  }

  if (
    spec.sort !== undefined &&
    spec.sort !== null &&
    spec.sort !== 'ascending' &&
    spec.sort !== 'descending'
  )
    errors.push({
      code: 'INVALID_TYPE',
      path: '/sort',
      message: 'Bar list sort must be ascending, descending, or null.',
      suggestion: 'Set sort to ascending, descending, or null.',
    });
  if (
    spec.height !== undefined &&
    spec.height !== 'auto' &&
    (typeof spec.height !== 'number' || !Number.isFinite(spec.height) || spec.height <= 0)
  )
    errors.push({
      code: 'INVALID_TYPE',
      path: '/height',
      message: 'Bar list height must be a positive number or auto.',
      suggestion: 'Use height: auto to fit every row, or a positive pixel height.',
    });
  const group = encoding.group as Record<string, unknown> | undefined;
  if (
    group &&
    (!group.field ||
      typeof group.field !== 'string' ||
      (group.type !== undefined && group.type !== 'nominal' && group.type !== 'ordinal'))
  )
    errors.push({
      code: 'INVALID_TYPE',
      path: '/encoding/group',
      message: 'Bar list group must name a nominal or ordinal field.',
      suggestion: 'Set encoding.group to a field with type nominal or ordinal.',
    });
  const domain = (
    (encoding.value as Record<string, unknown>)?.scale as Record<string, unknown> | undefined
  )?.domain;
  if (
    domain !== undefined &&
    (!Array.isArray(domain) ||
      domain.length !== 2 ||
      !domain.every((value) => typeof value === 'number' && Number.isFinite(value)) ||
      domain[1] <= domain[0])
  )
    errors.push({
      code: 'INVALID_TYPE',
      path: '/encoding/value/scale/domain',
      message: 'Bar list value domain must be two finite numbers in increasing order.',
      suggestion: 'Use a numeric domain such as [0, 1] with lower bound below upper bound.',
    });
  if (spec.annotations !== undefined) {
    if (!Array.isArray(spec.annotations))
      errors.push({
        code: 'INVALID_TYPE',
        path: '/annotations',
        message: 'Bar list annotations must be an array of vertical reference lines.',
        suggestion: 'Use annotations: [{ type: refline, x: 1 }].',
      });
    else
      spec.annotations.forEach((annotation, index) => {
        const item = annotation as Record<string, unknown> | null;
        if (
          !item ||
          item.type !== 'refline' ||
          typeof item.x !== 'number' ||
          !Number.isFinite(item.x) ||
          item.y !== undefined
        )
          errors.push({
            code: 'INVALID_TYPE',
            path: `/annotations/${index}`,
            message:
              'Bar list annotations require type refline and a finite numeric x; y is not supported.',
            suggestion: 'Use { type: refline, x: 1 } and remove y.',
          });
      });
  }

  // Barlist never reads scale.scheme: bars cycle the built-in barlist palette
  checkSchemeUnused(
    encoding,
    errors,
    'bar list colors cycle the built-in barlist palette',
    'Remove scale.scheme. Bar list colors are not configurable via encoding; they cycle the built-in palette.',
  );
}
