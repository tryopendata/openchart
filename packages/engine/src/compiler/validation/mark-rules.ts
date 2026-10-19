/** Mark-specific chart validation: range, arc center label, calendar, and point size. */
import { inferFieldType, jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { isParseableDate } from './helpers';

// ---------------------------------------------------------------------------
// Range mark validation
// ---------------------------------------------------------------------------

const VALID_RANGE_STYLES = new Set(['dumbbell', 'arrow', 'bar']);

/**
 * Range marks need an orientation-dependent encoding pair: x + x2 when the
 * category axis is y (horizontal, the common editorial form), or y + y2 when
 * the category axis is x (vertical). The static MARK_ENCODING_RULES table
 * can't express "x2 required only when y is categorical", so this check
 * enforces it with errors naming exactly what to add.
 */
export function validateRangeSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const encoding = spec.encoding as Record<string, Record<string, unknown> | undefined>;
  const data = spec.data as Record<string, unknown>[];
  const x = encoding.x;
  const y = encoding.y;
  // Missing x/y already produced MISSING_FIELD errors from the generic loop.
  if (!x?.field || typeof x.field !== 'string' || !y?.field || typeof y.field !== 'string') {
    return;
  }

  const xType = (x.type as string | undefined) ?? inferFieldType(data, x.field);
  const yType = (y.type as string | undefined) ?? inferFieldType(data, y.field);
  const xIsCategory = xType === 'nominal' || xType === 'ordinal';
  const yIsCategory = yType === 'nominal' || yType === 'ordinal';

  if (xIsCategory && yIsCategory) {
    errors.push({
      message:
        'Spec error: range chart requires a quantitative value axis, but both encoding.x and encoding.y are categorical',
      path: '/encoding',
      code: 'ENCODING_MISMATCH',
      suggestion:
        'Map the range start to a quantitative channel: x (with x2 for the end) for horizontal ranges, or y (with y2) for vertical ranges',
    });
    return;
  }
  if (!xIsCategory && !yIsCategory) {
    errors.push({
      message:
        'Spec error: range chart requires a nominal or ordinal category axis, but neither encoding.x nor encoding.y is categorical',
      path: '/encoding',
      code: 'ENCODING_MISMATCH',
      suggestion:
        'Set encoding.y to a nominal field for horizontal ranges (the common form), or encoding.x for vertical ranges',
    });
    return;
  }

  const availableColumns = data.length > 0 ? Object.keys(data[0]).join(', ') : '';
  if (yIsCategory) {
    // Horizontal: x is the range start, x2 the end.
    if (!encoding.x2) {
      errors.push({
        message:
          'Spec error: range chart requires encoding.x2 (the range end) when encoding.y is the category axis, but none was provided',
        path: '/encoding/x2',
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.x2 with the field holding the range's end value, e.g. x2: { field: "endValue" }. Available columns: ${availableColumns}`,
      });
    }
    if (encoding.y2) {
      errors.push({
        message:
          'Spec error: encoding.y2 is not used on a horizontal range chart (category axis on y); the range end belongs on x2',
        path: '/encoding/y2',
        code: 'INVALID_VALUE',
        suggestion:
          'Remove encoding.y2, or move the category to encoding.x and the values to y/y2 for a vertical range chart',
      });
    }
  } else {
    // Vertical: y is the range start, y2 the end.
    if (!encoding.y2) {
      errors.push({
        message:
          'Spec error: range chart requires encoding.y2 (the range end) when encoding.x is the category axis, but none was provided',
        path: '/encoding/y2',
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.y2 with the field holding the range's end value, e.g. y2: { field: "endValue" }. Available columns: ${availableColumns}`,
      });
    }
    if (encoding.x2) {
      errors.push({
        message:
          'Spec error: encoding.x2 is not used on a vertical range chart (category axis on x); the range end belongs on y2',
        path: '/encoding/x2',
        code: 'INVALID_VALUE',
        suggestion:
          'Remove encoding.x2, or move the category to encoding.y and the values to x/x2 for a horizontal range chart',
      });
    }
  }

  // markDef options: style must be one of the known variants.
  const mark = spec.mark;
  if (mark && typeof mark === 'object' && !Array.isArray(mark)) {
    const style = (mark as Record<string, unknown>).style;
    if (style !== undefined && !VALID_RANGE_STYLES.has(style as string)) {
      errors.push({
        message: `Spec error: mark.style "${style}" is not valid for range marks. Must be one of: dumbbell, arrow, bar`,
        path: '/mark/style',
        code: 'INVALID_VALUE',
        suggestion:
          'Use mark: { type: "range", style: "dumbbell" } (default), "arrow" for directional change, or "bar" for a plain floating range bar',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Arc mark validation
// ---------------------------------------------------------------------------

/**
 * `mark.centerLabel` draws into the hole of a donut, so it means nothing on
 * any other mark type. The object form must carry a non-empty `text`.
 */
export function validateCenterLabel(
  spec: Record<string, unknown>,
  markType: unknown,
  errors: ValidationError[],
): void {
  if (!spec.mark || typeof spec.mark !== 'object' || Array.isArray(spec.mark)) return;
  const centerLabel = (spec.mark as Record<string, unknown>).centerLabel;
  if (centerLabel === undefined) return;

  if (markType !== 'arc') {
    errors.push({
      message: `Spec error: mark.centerLabel is only supported on arc (pie/donut) marks, not "${String(markType)}"`,
      path: '/mark/centerLabel',
      code: 'INVALID_VALUE',
      suggestion:
        'Remove mark.centerLabel, or use mark: { type: "arc", innerRadius: 0.6, centerLabel: "..." } for a donut center stat.',
    });
    return;
  }

  const isString = typeof centerLabel === 'string';
  const obj =
    !isString && centerLabel !== null && typeof centerLabel === 'object'
      ? (centerLabel as Record<string, unknown>)
      : undefined;
  const validObject = obj !== undefined && typeof obj.text === 'string' && obj.text.length > 0;
  const validString = isString && (centerLabel as string).length > 0;

  if (!validString && !validObject) {
    errors.push({
      message: `Spec error: mark.centerLabel must be a non-empty string or { text, subtitle? }, got ${JSON.stringify(centerLabel)}`,
      path: '/mark/centerLabel',
      code: 'INVALID_VALUE',
      suggestion:
        'Use centerLabel: "$4.2M" or centerLabel: { text: "$4.2M", subtitle: "Total revenue" }.',
    });
  }

  if (validObject && obj.subtitle !== undefined && typeof obj.subtitle !== 'string') {
    errors.push({
      message: `Spec error: mark.centerLabel.subtitle must be a string, got ${JSON.stringify(obj.subtitle)}`,
      path: '/mark/centerLabel/subtitle',
      code: 'INVALID_VALUE',
      suggestion: 'Use centerLabel: { text: "$4.2M", subtitle: "Total revenue" }.',
    });
  }
}

// ---------------------------------------------------------------------------
// Calendar mark validation
// ---------------------------------------------------------------------------

const VALID_WEEK_STARTS = new Set(['monday', 'sunday']);

/**
 * Calendar heatmaps take daily dates on x and a quantitative value on color;
 * the weeks-x-weekdays geometry is computed internally, so there is no y
 * channel. This check enforces the parts the static MARK_ENCODING_RULES
 * table can't express: no y, a temporal x even when the type is inferred,
 * every date parseable, one row per day (daily granularity), and valid
 * mark-level weekStart/cellRadius options.
 */
export function validateCalendarSpec(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const encoding = spec.encoding as Record<string, Record<string, unknown> | undefined>;
  const data = spec.data as Record<string, unknown>[];

  if (encoding.y) {
    errors.push({
      message:
        'Spec error: calendar chart does not accept encoding.y (the weeks x weekdays layout is computed from the dates)',
      path: '/encoding/y',
      code: 'ENCODING_MISMATCH',
      suggestion:
        'Remove encoding.y. A calendar needs only x (temporal, daily dates) and color (quantitative).',
    });
  }

  // Mark-level options (weekStart / cellRadius) on the MarkDef object form.
  if (spec.mark && typeof spec.mark === 'object') {
    const markDef = spec.mark as Record<string, unknown>;
    if (markDef.weekStart !== undefined && !VALID_WEEK_STARTS.has(markDef.weekStart as string)) {
      errors.push({
        message: `Spec error: mark.weekStart "${markDef.weekStart}" is not a valid week start`,
        path: '/mark/weekStart',
        code: 'INVALID_VALUE',
        suggestion:
          'Use mark: { type: "calendar", weekStart: "monday" } (default, ISO weeks) or "sunday"',
      });
    }
    if (
      markDef.cellRadius !== undefined &&
      (typeof markDef.cellRadius !== 'number' ||
        !Number.isFinite(markDef.cellRadius) ||
        markDef.cellRadius < 0)
    ) {
      errors.push({
        message: `Spec error: mark.cellRadius must be a non-negative number, got ${JSON.stringify(markDef.cellRadius)}`,
        path: '/mark/cellRadius',
        code: 'INVALID_VALUE',
        suggestion:
          'Use a pixel radius like cellRadius: 1 (default) or cellRadius: 0 for square corners',
      });
    }
  }

  const x = encoding.x;
  // Missing x already produced a MISSING_FIELD error from the generic loop.
  if (!x?.field || typeof x.field !== 'string') return;

  // The generic loop rejects a declared non-temporal type against the
  // encoding rules table; this catches the inferred case (type omitted).
  const xType = (x.type as string | undefined) ?? inferFieldType(data, x.field);
  if (xType !== 'temporal') {
    if (!x.type) {
      errors.push({
        message: `Spec error: calendar chart requires temporal encoding.x, but "${x.field}" was inferred as ${xType}`,
        path: '/encoding/x',
        code: 'ENCODING_MISMATCH',
        suggestion: `Provide daily dates in "${x.field}" (ISO 8601 strings like "2024-01-15" or Date objects) and declare x: { field: "${x.field}", type: "temporal" }`,
      });
    }
    return;
  }

  // Transforms (e.g. a timeUnit aggregation) reshape the data before the
  // calendar sees it, so per-row date checks only apply to untransformed specs.
  if (Array.isArray(spec.transform) && spec.transform.length > 0) return;

  // Every date must parse; report the first offender by row index.
  for (let i = 0; i < data.length; i++) {
    const value = data[i][x.field];
    if (value != null && !isParseableDate(value)) {
      errors.push({
        message: `Spec error: encoding.x.field "${x.field}" contains an unparseable date at data[${i}]: ${JSON.stringify(value)}`,
        path: jsonPointer('data', i, x.field),
        code: 'INVALID_VALUE',
        suggestion: `Fix data[${i}].${x.field} to a parseable date (ISO 8601 strings like "2024-01-15" or Date objects)`,
      });
      return;
    }
  }

  // Daily granularity: more than one row on the same UTC day means the data
  // is sub-daily (or duplicated) and cells would silently overwrite.
  const seenDays = new Map<string, number>();
  for (let i = 0; i < data.length; i++) {
    const value = data[i][x.field];
    if (value == null) continue;
    const date = value instanceof Date ? value : new Date(value as string | number);
    if (Number.isNaN(date.getTime())) continue;
    const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    const firstIndex = seenDays.get(dayKey);
    if (firstIndex !== undefined) {
      errors.push({
        message: `Spec error: calendar chart requires daily granularity, but data[${firstIndex}] and data[${i}] fall on the same day (${JSON.stringify(value)})`,
        path: jsonPointer('data', i, x.field),
        code: 'ENCODING_MISMATCH',
        suggestion: `Aggregate to one row per day first, e.g. transform: [{ timeUnit: "yearmonthdate", field: "${x.field}", as: "day" }] plus an aggregate over the value field, or pre-aggregate the data.`,
      });
      return;
    }
    seenDays.set(dayKey, i);
  }
}

// ---------------------------------------------------------------------------
// Point size validation
// ---------------------------------------------------------------------------

/**
 * Ceiling above which a point size is, in practice, always an imported
 * Vega-Lite *area* value rather than an intentional radius. VL defines point
 * `size` as symbol area in px^2 (size: 110 is a ~12px-wide dot); openchart's
 * `mark.size` and `encoding.size` ranges are a radius in px (default 5), so
 * VL-habit values render as chart-swallowing discs. Radii up to the ceiling
 * stay legal: a 50px bubble is enormous but plausible as a deliberate choice.
 */
const MAX_PLAUSIBLE_POINT_RADIUS = 50;

function pointSizeError(tokens: readonly string[], value: number): ValidationError {
  const radius = Math.max(1, Math.round(Math.sqrt(value / Math.PI)));
  return {
    message: `Spec error: ${tokens.join('.')} is a radius in pixels, and ${value} would draw a ${Math.round(value * 2)}px-wide circle. This usually means the value was written in Vega-Lite's units, where point size is an area in px^2.`,
    path: jsonPointer(...tokens),
    code: 'INVALID_VALUE',
    suggestion: `Point sizes are radii in px (default 5, typical 2-12). For the dot a Vega-Lite size of ${value} draws, use ${radius} (r = sqrt(area / pi)).`,
  };
}

/**
 * Guard against Vega-Lite size semantics on point marks -- the same
 * near-miss-VL treatment as `data.url` and string `calculate` expressions:
 * a form that would silently do the wrong thing fails loud with the recipe.
 */
export function validatePointSize(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const markType =
    typeof spec.mark === 'string' ? spec.mark : (spec.mark as Record<string, unknown>)?.type;
  if (markType !== 'point') return;

  if (spec.mark && typeof spec.mark === 'object') {
    const size = (spec.mark as Record<string, unknown>).size;
    if (typeof size === 'number' && size > MAX_PLAUSIBLE_POINT_RADIUS) {
      errors.push(pointSizeError(['mark', 'size'], size));
    }
  }

  const sizeEnc =
    spec.encoding && typeof spec.encoding === 'object'
      ? ((spec.encoding as Record<string, unknown>).size as Record<string, unknown> | undefined)
      : undefined;
  if (!sizeEnc || typeof sizeEnc !== 'object') return;

  if (typeof sizeEnc.value === 'number' && sizeEnc.value > MAX_PLAUSIBLE_POINT_RADIUS) {
    errors.push(pointSizeError(['encoding', 'size', 'value'], sizeEnc.value));
  }

  const range =
    sizeEnc.scale && typeof sizeEnc.scale === 'object'
      ? (sizeEnc.scale as Record<string, unknown>).range
      : undefined;
  if (Array.isArray(range)) {
    const worst = range.find(
      (entry) => typeof entry === 'number' && entry > MAX_PLAUSIBLE_POINT_RADIUS,
    );
    if (typeof worst === 'number') {
      errors.push(pointSizeError(['encoding', 'size', 'scale', 'range'], worst));
    }
  }
}
