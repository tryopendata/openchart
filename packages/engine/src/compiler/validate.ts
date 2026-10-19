/**
 * Runtime spec validation.
 *
 * TypeScript catches compile-time errors for specs written in code.
 * This module catches runtime errors for specs coming from JSON, APIs,
 * or Claude-generated output where the TypeScript compiler can't help.
 *
 * Every error includes a machine-readable code and an actionable suggestion
 * so consumers (and LLMs) can fix issues programmatically.
 */
import { jsonPointer, MARK_TYPES, type VizSpec } from '@opendata-ai/openchart-core';
import { collectMarkOptionErrors } from './mark-options';
import { collectRemovedSpecErrors } from './removed-spec-fields';
import type { ValidationError, ValidationResult } from './types';
import { validateBarListSpec } from './validation/barlist';
import { validateChartSpec } from './validation/chart';
import { validateAnimation, validateFieldMetadata } from './validation/common-fields';
import { validateGeoMapSpec } from './validation/geo-map';
import { validateGraphSpec } from './validation/graph';
import { validateLayerSpec } from './validation/layer';
import { validateSankeySpec } from './validation/sankey';
import { validateTableSpec } from './validation/table';
import { validateTileMapSpec } from './validation/tilemap';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a spec at runtime.
 *
 * Checks structure, required fields, encoding rules, data shape, and
 * field type compatibility. Returns structured errors with machine-readable
 * codes and actionable suggestions for each problem found.
 */
function validateAnnotationLayout(
  spec: Record<string, unknown>,
  errors: ValidationError[],
  prefix = '',
): void {
  const responsive = spec.responsive as Record<string, unknown> | undefined;
  const limit =
    responsive && typeof responsive === 'object' ? responsive.compactAnnotationLimit : undefined;
  if (limit != null && (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0)) {
    errors.push({
      code: 'INVALID_VALUE',
      path: `${prefix}/responsive/compactAnnotationLimit`,
      message: 'compactAnnotationLimit must be a nonnegative integer or null',
      suggestion: 'Use null for unlimited inline annotations.',
    });
  }
  if (Array.isArray(spec.annotations)) {
    for (const [index, annotation] of spec.annotations.entries()) {
      for (const field of ['maxWidth', 'subtitleFontSize'] as const) {
        const value = annotation?.[field];
        if (value === undefined || (field === 'maxWidth' && value === null)) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
          errors.push({
            code: 'INVALID_VALUE',
            path: `${prefix}${jsonPointer('annotations', index, field)}`,
            message: `${field} must be a positive finite number`,
            suggestion:
              field === 'maxWidth'
                ? 'Use null for unlimited width.'
                : 'Omit subtitleFontSize to use the default ratio.',
          });
      }
      if (
        annotation?.labelPlacement !== undefined &&
        !['auto', 'start', 'end', 'outside'].includes(annotation.labelPlacement)
      )
        errors.push({
          code: 'INVALID_VALUE',
          path: `${prefix}${jsonPointer('annotations', index, 'labelPlacement')}`,
          message: 'Unknown reference label placement',
          suggestion: 'Use auto, start, end or outside.',
        });
      const bend = annotation?.connector?.bend;
      if (
        bend !== undefined &&
        (typeof bend !== 'number' || !Number.isFinite(bend) || bend < -1 || bend > 1)
      ) {
        errors.push({
          code: 'INVALID_VALUE',
          path: `${prefix}${jsonPointer('annotations', index, 'connector', 'bend')}`,
          message: 'Connector bend must be a finite number between -1 and 1',
          suggestion: 'Omit bend for the automatic curve, or use a number in [-1, 1].',
        });
      }
    }
  }

  if (Array.isArray(spec.layer))
    for (const [index, child] of spec.layer.entries()) {
      if (child && typeof child === 'object' && !Array.isArray(child))
        validateAnnotationLayout(child, errors, `${prefix}/layer/${index}`);
    }
}

function validateSpecShape(spec: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Basic shape check
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return {
      valid: false,
      errors: [
        {
          message: 'Spec error: spec must be a non-null object',
          path: '',
          code: 'INVALID_TYPE',
          suggestion:
            'Pass a spec object with at least a "mark" field for charts, e.g. { mark: "line", data: [...], encoding: {...} }',
        },
      ],
      normalized: null,
    };
  }

  const obj = spec as Record<string, unknown>;
  errors.push(...collectRemovedSpecErrors(obj));
  validateAnnotationLayout(obj, errors);
  validateFieldMetadata(obj, errors);
  if (obj.chrome !== undefined) {
    const chrome = obj.chrome;
    if (!chrome || typeof chrome !== 'object' || Array.isArray(chrome)) {
      errors.push({
        path: '/chrome',
        code: 'INVALID_TYPE',
        message: 'Chrome must be an object of text elements.',
        suggestion: 'Use string text or a text object with a string text property.',
      });
    } else {
      for (const key of ['title', 'subtitle', 'source', 'footer', 'byline', 'eyebrow']) {
        const value = (chrome as Record<string, unknown>)[key];
        if (value === undefined) continue;
        if (
          typeof value !== 'string' &&
          (!value ||
            typeof value !== 'object' ||
            Array.isArray(value) ||
            typeof (value as Record<string, unknown>).text !== 'string')
        ) {
          errors.push({
            path: jsonPointer('chrome', key),
            code: 'INVALID_TYPE',
            message: `${key} must be text or an object with a string text property.`,
            suggestion: 'Preserve authored styling in the object and provide text as a string.',
          });
        }
      }
    }
  }

  // Determine spec type via structural discrimination:
  // - Layer specs have a 'layer' array
  // - Chart specs have a 'mark' field (string or object with type property)
  // - Table specs have type: 'table'
  // - Graph specs have type: 'graph'
  // - Sankey specs have type: 'sankey'
  // - TileMap specs have type: 'tilemap'
  const hasLayer = 'layer' in obj && Array.isArray(obj.layer);
  const hasMark = 'mark' in obj;
  const isTable = obj.type === 'table';
  const isGraph = obj.type === 'graph';
  const isSankey = obj.type === 'sankey';
  const isTileMap = obj.type === 'tilemap';
  const isMap = obj.type === 'map';
  const isBarList = obj.type === 'barlist';
  const isLayer =
    hasLayer && !isTable && !isGraph && !isSankey && !isTileMap && !isMap && !isBarList;
  const isChart =
    hasMark && !hasLayer && !isTable && !isGraph && !isSankey && !isTileMap && !isMap && !isBarList;

  if (
    !isChart &&
    !isTable &&
    !isGraph &&
    !isSankey &&
    !isTileMap &&
    !isMap &&
    !isBarList &&
    !isLayer
  ) {
    // Near-misses for VL composition operators that are unsupported by decision
    if ('hconcat' in obj || 'vconcat' in obj) {
      const key = 'hconcat' in obj ? 'hconcat' : 'vconcat';
      return {
        valid: false,
        errors: [
          {
            message: `Spec error: "${key}" composition is not supported`,
            path: jsonPointer(key),
            code: 'INVALID_VALUE',
            suggestion:
              'Render each chart in its own container instead. For small multiples of the same chart, use the facet encoding channel: encoding.facet = { field, type }',
          },
        ],
        normalized: null,
      };
    }
    if ('facet' in obj && 'spec' in obj) {
      return {
        valid: false,
        errors: [
          {
            message: 'Spec error: the top-level "facet" operator is not supported',
            path: '/facet',
            code: 'INVALID_VALUE',
            suggestion:
              'Use the facet encoding channel on a regular chart spec instead: encoding.facet = { field: "category", type: "nominal" }',
          },
        ],
        normalized: null,
      };
    }
    return {
      valid: false,
      errors: [
        {
          message:
            'Spec error: spec must have a "mark" field for charts, a "layer" array for layered charts, or a "type" field for tables/graphs/sankey/tilemap/map/barlist',
          path: '/mark',
          code: 'MISSING_FIELD',
          suggestion: `Add a "mark" field for charts (e.g. mark: "bar"), a "layer" array for layered charts, or a "type" field (type: "table", type: "graph", type: "sankey", type: "tilemap", type: "map", or type: "barlist"). Valid mark types: ${[...MARK_TYPES].join(', ')}`,
        },
      ],
      normalized: null,
    };
  }

  // For layer specs, validate each child layer recursively
  if (isLayer) {
    validateLayerSpec(obj, errors);
  }

  // For chart specs, validate the mark field
  if (isChart) {
    const mark = obj.mark;
    let markValue: string | undefined;

    if (typeof mark === 'string') {
      markValue = mark;
    } else if (mark && typeof mark === 'object' && !Array.isArray(mark)) {
      markValue = (mark as Record<string, unknown>).type as string | undefined;
    }

    if (!markValue || !MARK_TYPES.has(markValue)) {
      return {
        valid: false,
        errors: [
          {
            message: `Spec error: "${markValue ?? String(mark)}" is not a valid mark type. Valid mark types: ${[...MARK_TYPES].join(', ')}`,
            path: '/mark',
            code: 'INVALID_VALUE',
            suggestion: `Change mark to one of: ${[...MARK_TYPES].join(', ')}`,
          },
        ],
        normalized: null,
      };
    }

    validateChartSpec(obj, errors);
  } else if (isTable) {
    validateTableSpec(obj, errors);
  } else if (isGraph) {
    validateGraphSpec(obj, errors);
  } else if (isSankey) {
    validateSankeySpec(obj, errors);
  } else if (isTileMap) {
    validateTileMapSpec(obj, errors);
  } else if (isMap) {
    validateGeoMapSpec(obj, errors);
  } else if (isBarList) {
    validateBarListSpec(obj, errors);
  }

  // animation is shared by every spec type except graph, so it validates
  // outside the per-spec-type dispatch. Graph carries GraphAnimationSpec,
  // which has no maxMarks -- flagging a bad value there would contradict the
  // generated schema, which rejects the field on a graph outright.
  if (!isGraph) {
    validateAnimation(obj, errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  return {
    valid: true,
    errors: [],
    normalized: spec as VizSpec,
  };
}

/** Validate authored mark contracts before any sugar transformation. */
export function validateSpec(spec: unknown): ValidationResult {
  const result = validateSpecShape(spec);
  const errors = collectMarkOptionErrors(spec);
  return errors.length
    ? { ...result, valid: false, errors: [...result.errors, ...errors], normalized: null }
    : result;
}
