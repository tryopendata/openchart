import { inferFieldType } from '@opendata-ai/openchart-core';
import { finiteNumber } from '../../data/finite-number';
import type { NormalizedChartSpec, ValidationError } from '../types';

/** Reject unsupported authored surfaces rather than silently ignoring them. */
export function validateLabelPlacement(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const mark =
    typeof spec.mark === 'string' ? spec.mark : (spec.mark as Record<string, unknown>)?.type;
  const encoding = (spec.encoding ?? {}) as Record<string, Record<string, unknown>>;
  const error = (path: string, message: string) =>
    errors.push({
      path,
      message: `Spec error: ${message}`,
      code: 'INVALID_VALUE',
      suggestion: 'Remove this option or use a supported chart and placement.',
    });
  for (const channel of ['x', 'y']) {
    const axis = encoding[channel]?.axis;
    if (!axis || typeof axis !== 'object') continue;
    const config = axis as Record<string, unknown>;
    if (
      config.titleAngle !== undefined &&
      (typeof config.titleAngle !== 'number' || !Number.isFinite(config.titleAngle))
    ) {
      error(`/encoding/${channel}/axis/titleAngle`, 'titleAngle must be a finite angle in degrees');
    }
    if (
      config.titleAnchor !== undefined &&
      !['start', 'middle', 'end'].includes(String(config.titleAnchor))
    ) {
      error(`/encoding/${channel}/axis/titleAnchor`, 'titleAnchor must be start, middle, or end');
    }
  }
  const labels = spec.labels as Record<string, unknown> | undefined;
  if (labels && typeof labels === 'object' && labels.placement !== undefined) {
    const placement = labels.placement;
    if (!['adaptive', 'inside', 'outside', 'column'].includes(String(placement)))
      error('/labels/placement', 'use adaptive, inside, outside, or column');
    else if (mark !== 'bar')
      error(
        '/labels/placement',
        'value placement applies only to horizontal bars and vertical columns',
      );
    else if (placement === 'column') {
      // Transforms/encoding aggregates may collapse raw duplicate categories.
      // Shape validation does not execute them; prepared compilation checks the
      // already transformed rows once, after normalization and overrides.
      const deferred =
        (Array.isArray(spec.transform) && spec.transform.length > 0) ||
        encoding.x?.aggregate !== undefined ||
        encoding.y?.aggregate !== undefined;
      if (!deferred && !simpleColumnRows(spec)) error('/labels/placement', COLUMN_REQUIREMENT);
    }
  }
  const endpoint = spec.endpointLabels;
  if (!endpoint || typeof endpoint !== 'object') return;
  const config = endpoint as Record<string, unknown>;
  const stackedArea =
    mark === 'area' &&
    !!encoding.color?.field &&
    encoding.y?.stack !== null &&
    encoding.y?.stack !== false;
  if (config.anchor !== undefined && !['boundary', 'band'].includes(String(config.anchor)))
    error('/endpointLabels/anchor', 'use boundary or band');
  else if (config.anchor === 'band' && !stackedArea)
    error('/endpointLabels/anchor', 'band anchors require a stacked area');
  if (config.placement !== undefined && !['end', 'interior'].includes(String(config.placement)))
    error('/endpointLabels/placement', 'use end or interior');
  else if (config.placement === 'interior' && !stackedArea)
    error('/endpointLabels/placement', 'interior series labels require a stacked area');
}

const COLUMN_REQUIREMENT =
  'column requires a simple horizontal bar with one value per category in each facet; grouped, stacked and ranged bars are unsupported';

function simpleColumnRows(spec: Record<string, unknown>): boolean {
  const encoding = (spec.encoding ?? {}) as Record<string, Record<string, unknown>>;
  const rows = (Array.isArray(spec.data) ? spec.data : []) as Record<string, unknown>[];
  const category = encoding.y;
  const categoryField = category?.field;
  const valueField = encoding.x?.field;
  if (typeof categoryField !== 'string' || typeof valueField !== 'string') return false;
  const categoryType = category.type ?? inferFieldType(rows, categoryField);
  const valueType = encoding.x.type ?? inferFieldType(rows, valueField);
  if (!['nominal', 'ordinal'].includes(String(categoryType)) || valueType !== 'quantitative')
    return false;
  if (
    encoding.detail?.field ||
    encoding.xOffset ||
    encoding.yOffset ||
    encoding.x2 ||
    encoding.y2 ||
    encoding.x?.stack === 'normalize' ||
    encoding.x?.stack === 'center'
  )
    return false;
  const facetFields = [encoding.facet?.field, encoding.row?.field, encoding.column?.field].filter(
    (field): field is string => typeof field === 'string',
  );
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    if (finiteNumber(row[valueField]) === undefined) continue;
    const panel = JSON.stringify(facetFields.map((field) => row[field]));
    const values = seen.get(panel) ?? new Set<string>();
    // Bar geometry groups rendered category identity as strings too.
    const value = String(row[categoryField] ?? '');
    if (values.has(value)) return false;
    values.add(value);
    seen.set(panel, values);
  }
  return true;
}

/** Validate cardinality on prepared data without evaluating a transform again. */
export function validatePreparedLabelPlacement(spec: NormalizedChartSpec): ValidationError[] {
  if (
    spec.labels.placement !== 'column' ||
    simpleColumnRows(spec as unknown as Record<string, unknown>)
  )
    return [];
  return [
    {
      path: '/labels/placement',
      message: `Spec error: ${COLUMN_REQUIREMENT}`,
      code: 'INVALID_VALUE',
      suggestion: 'Use outside labels or provide one measured value per category in each panel.',
    },
  ];
}
