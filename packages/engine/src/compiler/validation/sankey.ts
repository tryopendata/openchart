/** Sankey spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { checkSchemeUnused, didYouMean } from './helpers';

// ---------------------------------------------------------------------------
// Sankey validation
// ---------------------------------------------------------------------------

export function validateSankeySpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  // Validate data
  if (!Array.isArray(spec.data)) {
    errors.push({
      message: 'Spec error: sankey spec requires a "data" array',
      path: '/data',
      code: 'INVALID_TYPE',
      suggestion:
        'Provide data as an array of objects, e.g. data: [{ source: "A", target: "B", value: 10 }]',
    });
    return;
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" must be a non-empty array',
      path: '/data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one data row, e.g. data: [{ source: "A", target: "B", value: 10 }]',
    });
    return;
  }

  const firstRow = spec.data[0] as unknown;
  if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
    errors.push({
      message: 'Spec error: each item in "data" must be a plain object',
      path: '/data/0',
      code: 'INVALID_TYPE',
      suggestion:
        'Each data item should be an object, e.g. { source: "A", target: "B", value: 10 }',
    });
    return;
  }

  // Validate encoding
  if (!spec.encoding || typeof spec.encoding !== 'object') {
    errors.push({
      message:
        'Spec error: sankey spec requires an "encoding" object with source, target, and value channels',
      path: '/encoding',
      code: 'MISSING_FIELD',
      suggestion:
        'Add an encoding object, e.g. encoding: { source: { field: "source", type: "nominal" }, target: { field: "target", type: "nominal" }, value: { field: "value", type: "quantitative" } }',
    });
    return;
  }

  const encoding = spec.encoding as Record<string, unknown>;
  const dataColumns = new Set(Object.keys(firstRow as Record<string, unknown>));
  const columnList = [...dataColumns];
  const availableColumns = columnList.join(', ');

  // Required channels
  for (const channel of ['source', 'target', 'value'] as const) {
    const ch = encoding[channel] as Record<string, unknown> | undefined;
    if (!ch || typeof ch !== 'object') {
      errors.push({
        message: `Spec error: sankey encoding requires "${channel}" channel`,
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

  // Sankey never reads scale.scheme: node colors cycle theme.colors.categorical
  checkSchemeUnused(
    encoding,
    errors,
    'sankey node colors cycle the theme categorical palette',
    'Remove scale.scheme. To customize sankey colors, set theme.colors.categorical.',
  );
}
