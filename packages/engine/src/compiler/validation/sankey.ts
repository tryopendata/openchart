/** Sankey spec validation. */
import { jsonPointer } from '@opendata-ai/openchart-core';
import { SANKEY_OVERRIDE_BREAKPOINTS, SANKEY_OVERRIDE_FIELDS } from '../../sankey/overrides';
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

  validateSankeyOverrides(spec.overrides, errors);
}

/**
 * Check `overrides`: an object keyed by breakpoint (compact, medium), each
 * block an object holding only the fields a sankey override may set, each of
 * the right type. Every block is checked at every width, so a mistake in the
 * phone block fails on desktop too.
 */
function validateSankeyOverrides(overrides: unknown, errors: ValidationError[]): void {
  if (overrides === undefined) return;
  if (!isPlainObject(overrides)) {
    errors.push({
      message: 'Spec error: sankey "overrides" must be an object keyed by breakpoint',
      path: '/overrides',
      code: 'INVALID_TYPE',
      suggestion:
        'Use overrides: { compact: { other: 0.05 } }. Valid breakpoints: compact, medium.',
    });
    return;
  }
  const breakpoints: readonly string[] = SANKEY_OVERRIDE_BREAKPOINTS;
  for (const [breakpoint, block] of Object.entries(overrides)) {
    if (!breakpoints.includes(breakpoint)) {
      errors.push({
        message: `Spec error: sankey overrides has unknown breakpoint "${breakpoint}"`,
        path: jsonPointer('overrides', breakpoint),
        code: 'INVALID_VALUE',
        suggestion: `Valid breakpoints: compact (under 400px), medium (400 to 700px).${didYouMean(breakpoint, [...breakpoints])}`,
      });
      continue;
    }
    if (!isPlainObject(block)) {
      errors.push({
        message: `Spec error: overrides.${breakpoint} must be an object`,
        path: jsonPointer('overrides', breakpoint),
        code: 'INVALID_TYPE',
        suggestion: `Use overrides.${breakpoint}: { other: 0.05 }`,
      });
      continue;
    }
    validateOverrideBlock(breakpoint, block, errors);
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const LABEL_ALIGNS = ['auto', 'left', 'right'];

/** Why a field's value is wrong, or null when it is fine. */
const OVERRIDE_FIELD_CHECKS: Record<string, (value: unknown) => string | null> = {
  chrome: (value) => (isPlainObject(value) ? null : 'must be a chrome object'),
  other: (value) => {
    const threshold = isPlainObject(value) ? value.threshold : value;
    if (typeof threshold !== 'number' || !(threshold > 0 && threshold < 1)) {
      return 'must be a share between 0 and 1, or { threshold, label }';
    }
    if (isPlainObject(value) && value.label !== undefined && typeof value.label !== 'string') {
      return 'label must be a string';
    }
    return null;
  },
  nodeSort: (value) =>
    Array.isArray(value) && value.every((id) => typeof id === 'string')
      ? null
      : 'must be an array of node ids',
  nodeLabelAlign: (value) =>
    typeof value === 'string' && LABEL_ALIGNS.includes(value)
      ? null
      : 'must be "auto", "left" or "right"',
  nodePadding: (value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? null
      : 'must be a number of pixels, 0 or more',
};

/** Check one breakpoint's block field by field. */
function validateOverrideBlock(
  breakpoint: string,
  block: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const fields: readonly string[] = SANKEY_OVERRIDE_FIELDS;
  for (const [field, value] of Object.entries(block)) {
    const path = jsonPointer('overrides', breakpoint, field);
    if (!fields.includes(field)) {
      errors.push({
        message: `Spec error: overrides.${breakpoint} cannot set "${field}"`,
        path,
        code: 'INVALID_VALUE',
        suggestion: `A sankey override may set ${fields.join(', ')}.${didYouMean(field, [...fields])}`,
      });
      continue;
    }
    const problem = OVERRIDE_FIELD_CHECKS[field](value);
    if (problem) {
      errors.push({
        message: `Spec error: overrides.${breakpoint}.${field} ${problem}, got ${JSON.stringify(value)}`,
        path,
        code: 'INVALID_TYPE',
        suggestion: `Fix overrides.${breakpoint}.${field}, or remove it to keep the top-level value.`,
      });
    }
  }
}
