/** Layer spec validation, with errors re-rooted from merged leaves to the authored parent. */
import { jsonPointer, MARK_TYPES } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { validateChartSpec } from './chart';

// ---------------------------------------------------------------------------
// Layer validation
// ---------------------------------------------------------------------------

/**
 * Re-root an error from a merged layer leaf. Values the leaf inherits (shared
 * data, or an encoding channel it does not override) point at the parent that
 * authored them; everything else points into the leaf.
 */
function rootLeafPath(
  path: string,
  parentPrefix: string,
  leafPrefix: string,
  leaf: Record<string, unknown>,
  inheritsData: boolean,
): string {
  const [, first, second] = path.split('/');
  const leafEncoding = leaf.encoding as Record<string, unknown> | undefined;
  const inherited =
    (first === 'data' && inheritsData) ||
    (first === 'encoding' &&
      second !== undefined &&
      !Object.hasOwn(leafEncoding ?? {}, second.replace(/~1/g, '/').replace(/~0/g, '~')));
  return `${inherited ? parentPrefix : leafPrefix}${path}`;
}

export function validateLayerSpec(
  spec: Record<string, unknown>,
  errors: ValidationError[],
  prefix = '',
): void {
  const layer = spec.layer as unknown[];

  if (layer.length === 0) {
    errors.push({
      message: 'Spec error: "layer" must be a non-empty array',
      path: `${prefix}/layer`,
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one layer with a mark and encoding',
    });
    return;
  }

  for (let i = 0; i < layer.length; i++) {
    const child = layer[i];
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      errors.push({
        message: `Spec error: layer[${i}] must be an object`,
        path: `${prefix}${jsonPointer('layer', i)}`,
        code: 'INVALID_TYPE',
        suggestion:
          'Each layer must be a chart spec (with mark) or a nested layer spec (with layer)',
      });
      continue;
    }

    const childObj = child as Record<string, unknown>;
    const isNestedLayer = 'layer' in childObj && Array.isArray(childObj.layer);
    const isChildChart = 'mark' in childObj;

    if (!isNestedLayer && !isChildChart) {
      errors.push({
        message: `Spec error: layer[${i}] must have a "mark" field or a "layer" array`,
        path: `${prefix}${jsonPointer('layer', i)}`,
        code: 'MISSING_FIELD',
        suggestion:
          'Each layer must be a chart spec (with mark + encoding) or a nested layer spec (with layer array)',
      });
      continue;
    }

    if (isNestedLayer) {
      validateLayerSpec(childObj, errors, `${prefix}${jsonPointer('layer', i)}`);
    } else if (isChildChart) {
      // Validate mark type
      const mark = childObj.mark;
      let markValue: string | undefined;
      if (typeof mark === 'string') {
        markValue = mark;
      } else if (mark && typeof mark === 'object' && !Array.isArray(mark)) {
        markValue = (mark as Record<string, unknown>).type as string | undefined;
      }

      if (!markValue || !MARK_TYPES.has(markValue)) {
        errors.push({
          message: `Spec error: layer[${i}].mark "${markValue ?? String(mark)}" is not a valid mark type`,
          path: `${prefix}${jsonPointer('layer', i, 'mark')}`,
          code: 'INVALID_VALUE',
          suggestion: `Change mark to one of: ${[...MARK_TYPES].join(', ')}`,
        });
        continue;
      }

      // Child layers can inherit data and encoding from parent, so only validate
      // if the child has its own data (or the parent provides shared data).
      const hasOwnData = Array.isArray(childObj.data) && (childObj.data as unknown[]).length > 0;
      const parentHasData = Array.isArray(spec.data) && (spec.data as unknown[]).length > 0;

      if (hasOwnData || parentHasData) {
        // Build a merged spec for validation purposes
        const mergedForValidation = { ...childObj };
        if (!hasOwnData && parentHasData) {
          mergedForValidation.data = spec.data;
        }
        // Merge encoding: parent fields are inherited unless child overrides
        if (spec.encoding && typeof spec.encoding === 'object') {
          mergedForValidation.encoding = {
            ...(spec.encoding as Record<string, unknown>),
            ...((childObj.encoding as Record<string, unknown>) ?? {}),
          };
        }
        if (mergedForValidation.data && mergedForValidation.encoding) {
          const leafErrors: ValidationError[] = [];
          validateChartSpec(mergedForValidation, leafErrors);
          const leafPrefix = `${prefix}${jsonPointer('layer', i)}`;
          for (const error of leafErrors)
            errors.push({
              ...error,
              path: rootLeafPath(error.path, prefix, leafPrefix, childObj, !hasOwnData),
            });
        }
      }
    }
  }
}
