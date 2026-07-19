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

import {
  type FieldType,
  inferFieldType,
  MARK_ENCODING_RULES,
  MARK_TYPES,
  type MarkType,
  resolveSchemeName,
  SEQUENTIAL_PALETTES,
  SUPPORTED_SCHEME_NAMES,
  type VizSpec,
} from '@opendata-ai/openchart-core';

import type { ValidationError, ValidationResult } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_FIELD_TYPES = new Set<string>(['quantitative', 'temporal', 'nominal', 'ordinal']);

const VALID_DARK_MODES = new Set<string>(['auto', 'force', 'off']);

/** Check if a value looks like a parseable date. */
function isParseableDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') {
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  }
  if (typeof value === 'number') return true;
  return false;
}

/** Check if a value is numeric. */
function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    const n = Number(value);
    return !Number.isNaN(n) && Number.isFinite(n);
  }
  return false;
}

/**
 * Levenshtein edit distance between two strings (case-insensitive). Used to
 * turn a misspelled field reference into a "did you mean" repair hint.
 */
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Single-row DP: prev[j] holds distance for the previous source char.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Given a misspelled field name and the actual data columns, return the nearest
 * column when it is close enough to be a plausible typo, else undefined.
 *
 * The threshold scales with word length (at most ~40% of the target length, and
 * never more than 3 edits) so short columns don't match unrelated names.
 */
function nearestColumn(field: string, columns: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const column of columns) {
    const distance = editDistance(field, column);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = column;
    }
  }
  if (best === undefined) return undefined;
  const threshold = Math.min(3, Math.max(1, Math.floor(best.length * 0.4)));
  return bestDistance <= threshold ? best : undefined;
}

/**
 * Build the "did you mean" clause appended to DATA_FIELD_MISSING suggestions.
 * Returns an empty string when no column is a plausible near-match.
 */
function didYouMean(field: string, columns: string[]): string {
  const match = nearestColumn(field, columns);
  return match ? ` Did you mean "${match}"?` : '';
}

/**
 * Push an INVALID_VALUE error when a channel carries an unrecognized
 * scale.scheme name. Chart specs are the only family that consumes schemes
 * this way: known names (including VL aliases) resolve via the core palette
 * registry and are expanded to scale.range by the pre-validation sugar pass,
 * so `resolveSchemeName` failing means the name is unknown.
 */
function checkSchemeName(
  channelObj: Record<string, unknown>,
  channelPath: string,
  errors: ValidationError[],
): void {
  const scale = channelObj.scale as Record<string, unknown> | undefined;
  if (scale && typeof scale.scheme === 'string' && !resolveSchemeName(scale.scheme)) {
    errors.push({
      message: `Spec error: ${channelPath}.scale.scheme "${scale.scheme}" is not a supported scheme name`,
      path: `${channelPath}.scale.scheme`,
      code: 'INVALID_VALUE',
      suggestion: `Use one of the supported scheme names: ${[...SUPPORTED_SCHEME_NAMES].join(', ')}. Or provide explicit colors via scale.range.`,
    });
  }
}

/**
 * Push an INVALID_VALUE error when any channel of an encoding block carries a
 * scale.scheme on a spec family whose compile path never reads it. Even a
 * known scheme name is dead config there — silently accepting it would leave
 * the author believing they chose the colors.
 */
function checkSchemeUnused(
  encoding: Record<string, unknown>,
  errors: ValidationError[],
  familyNote: string,
  suggestion: string,
): void {
  for (const [channel, ch] of Object.entries(encoding)) {
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;
    const scale = (ch as Record<string, unknown>).scale as Record<string, unknown> | undefined;
    if (scale && typeof scale.scheme === 'string') {
      errors.push({
        message: `Spec error: encoding.${channel}.scale.scheme has no effect — ${familyNote}`,
        path: `encoding.${channel}.scale.scheme`,
        code: 'INVALID_VALUE',
        suggestion,
      });
    }
  }
}

/** Palette names the map compile path actually supports (sequential only). */
const MAP_PALETTE_NAMES = Object.keys(SEQUENTIAL_PALETTES).join(', ');

/**
 * Map color channels resolve scale.scheme against SEQUENTIAL_PALETTES with a
 * silent fallback to blue — a typo'd scheme would render the default palette
 * with no signal. Reject names outside the map's supported set here instead.
 * Categorical channels never read schemes at all (colors come from
 * scale.domain/scale.range), so any scheme there is dead config.
 */
function checkMapSchemeName(
  channelObj: Record<string, unknown>,
  channelPath: string,
  errors: ValidationError[],
): void {
  const scale = channelObj.scale as Record<string, unknown> | undefined;
  if (!scale || typeof scale.scheme !== 'string') return;

  if (channelObj.type === 'nominal' || channelObj.type === 'ordinal') {
    errors.push({
      message: `Spec error: ${channelPath}.scale.scheme has no effect — categorical map colors come from scale.range and scale.domain`,
      path: `${channelPath}.scale.scheme`,
      code: 'INVALID_VALUE',
      suggestion:
        'Remove scale.scheme. To customize categorical map colors, provide explicit colors via scale.range (with scale.domain for category order).',
    });
    return;
  }

  if (!(scale.scheme in SEQUENTIAL_PALETTES)) {
    errors.push({
      message: `Spec error: ${channelPath}.scale.scheme "${scale.scheme}" is not a supported map palette`,
      path: `${channelPath}.scale.scheme`,
      code: 'INVALID_VALUE',
      suggestion: `Maps support the sequential palettes: ${MAP_PALETTE_NAMES}. The default is "blue".`,
    });
  }
}

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
function validateRangeSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
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
      path: 'encoding',
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
      path: 'encoding',
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
        path: 'encoding.x2',
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.x2 with the field holding the range's end value, e.g. x2: { field: "endValue" }. Available columns: ${availableColumns}`,
      });
    }
    if (encoding.y2) {
      errors.push({
        message:
          'Spec error: encoding.y2 is not used on a horizontal range chart (category axis on y); the range end belongs on x2',
        path: 'encoding.y2',
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
        path: 'encoding.y2',
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.y2 with the field holding the range's end value, e.g. y2: { field: "endValue" }. Available columns: ${availableColumns}`,
      });
    }
    if (encoding.x2) {
      errors.push({
        message:
          'Spec error: encoding.x2 is not used on a vertical range chart (category axis on x); the range end belongs on y2',
        path: 'encoding.x2',
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
        path: 'mark.style',
        code: 'INVALID_VALUE',
        suggestion:
          'Use mark: { type: "range", style: "dumbbell" } (default), "arrow" for directional change, or "bar" for a plain floating range bar',
      });
    }
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
function validateCalendarSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const encoding = spec.encoding as Record<string, Record<string, unknown> | undefined>;
  const data = spec.data as Record<string, unknown>[];

  if (encoding.y) {
    errors.push({
      message:
        'Spec error: calendar chart does not accept encoding.y (the weeks x weekdays layout is computed from the dates)',
      path: 'encoding.y',
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
        path: 'mark.weekStart',
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
        path: 'mark.cellRadius',
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
        path: 'encoding.x',
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
        path: `data[${i}].${x.field}`,
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
        path: `data[${i}].${x.field}`,
        code: 'ENCODING_MISMATCH',
        suggestion: `Aggregate to one row per day first, e.g. transform: [{ timeUnit: "yearmonthdate", field: "${x.field}", as: "day" }] plus an aggregate over the value field, or pre-aggregate the data.`,
      });
      return;
    }
    seenDays.set(dayKey, i);
  }
}

// ---------------------------------------------------------------------------
// Chart validation
// ---------------------------------------------------------------------------

function validateChartSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const markType =
    typeof spec.mark === 'string' ? spec.mark : (spec.mark as Record<string, unknown>)?.type;

  // Check data
  if (!Array.isArray(spec.data)) {
    // Near-miss: the VL `data: { url }` form. Fetching is out of scope for a
    // rendering library, so reject it with a pointed message. The `{ values }`
    // form is unwrapped by the pre-validation sugar expansion and never
    // reaches this check on the compile path.
    if (spec.data && typeof spec.data === 'object' && 'url' in (spec.data as object)) {
      errors.push({
        message: 'Spec error: data.url is not supported (openchart does not fetch remote data)',
        path: 'data.url',
        code: 'INVALID_VALUE',
        suggestion:
          'Fetch the data in your application and provide the rows inline: data: [...] or data: { values: [...] }',
      });
      return;
    }
    errors.push({
      message: 'Spec error: "data" must be an array',
      path: 'data',
      code: 'INVALID_TYPE',
      suggestion: 'Provide data as an array of objects, e.g. data: [{ x: 1, y: 2 }]',
    });
    return; // Can't validate further without data
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" must be a non-empty array',
      path: 'data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one data row, e.g. data: [{ x: 1, y: 2 }]',
    });
    return;
  }

  // Validate data entries are objects
  const firstRow = spec.data[0] as unknown;
  if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
    errors.push({
      message: 'Spec error: each item in "data" must be a plain object',
      path: 'data[0]',
      code: 'INVALID_TYPE',
      suggestion:
        'Each data item should be an object with key-value pairs, e.g. { name: "Alice", value: 10 }',
    });
    return;
  }

  // Check encoding exists
  if (!spec.encoding || typeof spec.encoding !== 'object') {
    const rules = MARK_ENCODING_RULES[markType as MarkType];
    const requiredChannels = Object.entries(rules)
      .filter(([, rule]) => rule.required)
      .map(([ch]) => ch);
    errors.push({
      message: `Spec error: ${markType} chart requires an "encoding" object`,
      path: 'encoding',
      code: 'MISSING_FIELD',
      suggestion: `Add an encoding object with required channels: ${requiredChannels.join(', ')}. Example: encoding: { ${requiredChannels.map((ch) => `${ch}: { field: "...", type: "..." }`).join(', ')} }`,
    });
    return;
  }

  const rules = MARK_ENCODING_RULES[markType as MarkType];
  const encoding = spec.encoding as Record<string, unknown>;
  const dataColumns = new Set(Object.keys(firstRow as Record<string, unknown>));
  const columnList = [...dataColumns];
  const availableColumns = columnList.join(', ');

  // Validate required channels. Arc's canonical channel is theta; waffle and
  // parliament still key on y with theta as an alias. For backward compat,
  // validateSpec (a public entry point that callers may invoke on un-expanded
  // specs) accepts y as satisfying a theta requirement and vice versa on
  // theta-capable marks.
  const THETA_MARKS = new Set(['arc', 'waffle', 'parliament']);
  const isThetaMark = THETA_MARKS.has(markType as string);
  for (const [channel, rule] of Object.entries(rules)) {
    if (!rule.required) continue;
    const satisfiedByAlias =
      isThetaMark && ((channel === 'theta' && encoding.y) || (channel === 'y' && encoding.theta));
    if (!encoding[channel] && !satisfiedByAlias) {
      const allowedTypes = rule.allowedTypes.join(' or ');
      const suggestedChannel = channel === 'y' && isThetaMark ? 'theta' : channel;
      errors.push({
        message: `Spec error: ${markType} chart requires encoding.${suggestedChannel} but none was provided`,
        path: `encoding.${suggestedChannel}`,
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.${suggestedChannel} with a field from your data (${availableColumns}) and type (${allowedTypes}). Example: ${suggestedChannel}: { field: "${[...dataColumns][0] ?? 'myField'}", type: "${rule.allowedTypes[0]}" }`,
      });
    }
  }

  // Beeswarm axis combination: the channel rules mark both axes optional, so
  // enforce the shape here. Exactly one positional channel is the quantitative
  // value axis; the other, when present, is the nominal/ordinal lane channel.
  // Only declared types are checked; omitted types are inferred later.
  if (markType === 'beeswarm') {
    const xChannel = encoding.x as Record<string, unknown> | undefined;
    const yChannel = encoding.y as Record<string, unknown> | undefined;
    const xType = xChannel?.type as string | undefined;
    const yType = yChannel?.type as string | undefined;
    if (!xChannel && !yChannel) {
      errors.push({
        message:
          'Spec error: beeswarm chart requires a quantitative encoding.x or encoding.y (the value axis)',
        path: 'encoding',
        code: 'MISSING_FIELD',
        suggestion: `Add the value axis, e.g. x: { field: "${[...dataColumns][0] ?? 'myField'}", type: "quantitative" }. Optionally add a nominal channel on the other axis for grouped swarms.`,
      });
    } else if (xType === 'quantitative' && yType === 'quantitative') {
      errors.push({
        message:
          'Spec error: beeswarm chart accepts only one quantitative axis (the value axis), but both encoding.x and encoding.y are quantitative',
        path: 'encoding',
        code: 'ENCODING_MISMATCH',
        suggestion:
          'Keep the value axis quantitative and change the other channel to nominal/ordinal (grouped swarm lanes), or remove it for a single swarm. For two quantitative axes use mark: "point".',
      });
    } else if (
      xType !== 'quantitative' &&
      yType !== 'quantitative' &&
      (!xChannel || !!xType) &&
      (!yChannel || !!yType)
    ) {
      errors.push({
        message:
          'Spec error: beeswarm chart requires one quantitative axis (the value axis), but neither encoding.x nor encoding.y is quantitative',
        path: 'encoding',
        code: 'ENCODING_MISMATCH',
        suggestion:
          'Set the value axis to type: "quantitative" (x for a horizontal swarm, y for a vertical one).',
      });
    }
  }

  // Range marks: orientation-dependent x2/y2 requirement + mark.style options
  if (markType === 'range') {
    validateRangeSpec(spec, errors);
  }

  // Calendar marks: temporal daily x, no y, parseable dates, mark options
  if (markType === 'calendar') {
    validateCalendarSpec(spec, errors);
  }

  // Near-miss: VL's string expression form of calculate. A restricted string
  // grammar is deliberately not supported (decision: structured form only);
  // point authors at the structured equivalent instead.
  if (Array.isArray(spec.transform)) {
    const transforms = spec.transform as Record<string, unknown>[];
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      if (t && typeof t === 'object' && typeof t.calculate === 'string') {
        errors.push({
          message: `Spec error: transform[${i}].calculate must be a structured expression object, not a string`,
          path: `transform[${i}].calculate`,
          code: 'INVALID_TYPE',
          suggestion:
            'Use the structured form for single operations, e.g. calculate: { op: "/", field: "a", field2: "b" } with as: "ratio". For running or grouped computations use the window or aggregate transforms.',
        });
      }
    }
  }

  // Collect fields that transforms will create, so we don't reject them
  const transformFields = new Set<string>();
  if (Array.isArray(spec.transform)) {
    for (const t of spec.transform as Record<string, unknown>[]) {
      // filter/bin/calculate/timeUnit/fold write their output(s) to `as`.
      if (typeof t.as === 'string') transformFields.add(t.as);
      if (Array.isArray(t.as)) {
        for (const f of t.as) {
          if (typeof f === 'string') transformFields.add(f);
        }
      }
      // aggregate/window carry their output field names inside their op arrays,
      // and aggregate preserves its groupby fields on the output rows.
      const opList = (t.aggregate ?? t.window) as Record<string, unknown>[] | undefined;
      if (Array.isArray(opList)) {
        for (const op of opList) {
          if (op && typeof op.as === 'string') transformFields.add(op.as);
        }
      }
      if (Array.isArray(t.groupby)) {
        for (const g of t.groupby) {
          if (typeof g === 'string') transformFields.add(g);
        }
      }
    }
  }

  // Validate provided channels
  for (const [channel, channelSpec] of Object.entries(encoding)) {
    if (!channelSpec || typeof channelSpec !== 'object') continue;

    // Tooltip can be an array of encoding channels
    if (channel === 'tooltip' && Array.isArray(channelSpec)) {
      for (let i = 0; i < channelSpec.length; i++) {
        const elem = channelSpec[i] as Record<string, unknown> | null;
        if (!elem || typeof elem !== 'object') continue;
        if (!elem.field || typeof elem.field !== 'string') {
          errors.push({
            message: `Spec error: encoding.tooltip[${i}] must have a "field" string`,
            path: `encoding.tooltip[${i}].field`,
            code: 'MISSING_FIELD',
            suggestion: `Add a field name from your data columns: ${availableColumns}`,
          });
          continue;
        }
        if (!dataColumns.has(elem.field) && !transformFields.has(elem.field)) {
          errors.push({
            message: `Spec error: encoding.tooltip[${i}].field "${elem.field}" does not exist in data. Available columns: ${availableColumns}`,
            path: `encoding.tooltip[${i}].field`,
            code: 'DATA_FIELD_MISSING',
            suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(elem.field, columnList)}`,
          });
        }
        if (elem.type && !VALID_FIELD_TYPES.has(elem.type as string)) {
          errors.push({
            message: `Spec error: encoding.tooltip[${i}].type "${elem.type}" is not valid. Must be one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
            path: `encoding.tooltip[${i}].type`,
            code: 'INVALID_VALUE',
            suggestion: `Use one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
          });
        }
      }
      continue;
    }

    const channelObj = channelSpec as Record<string, unknown>;
    const channelRule = rules[channel as keyof typeof rules];

    // Skip ConditionalValueDef channels (they have 'condition' instead of 'field')
    if ('condition' in channelObj) continue;

    // Check field exists
    if (!channelObj.field || typeof channelObj.field !== 'string') {
      errors.push({
        message: `Spec error: encoding.${channel} must have a "field" string`,
        path: `encoding.${channel}.field`,
        code: 'MISSING_FIELD',
        suggestion: `For constant colors, use mark.fill (e.g., mark: { type: "bar", fill: "#1b7fa3" }) instead of encoding.${channel}. Encoding channels require a data field: ${availableColumns}`,
      });
      continue;
    }

    // Check field references a column in data (or will be created by a transform)
    if (!dataColumns.has(channelObj.field) && !transformFields.has(channelObj.field)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${channelObj.field}" does not exist in data. Available columns: ${availableColumns}`,
        path: `encoding.${channel}.field`,
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(channelObj.field, columnList)}`,
      });
    }

    // Check field type is valid
    if (channelObj.type && !VALID_FIELD_TYPES.has(channelObj.type as string)) {
      errors.push({
        message: `Spec error: encoding.${channel}.type "${channelObj.type}" is not valid. Must be one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
        path: `encoding.${channel}.type`,
        code: 'INVALID_VALUE',
        suggestion: `Use one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
      });
    }

    // Check scale.scheme names. Known names (including VL aliases) are
    // resolved to palette ranges by the pre-validation sugar expansion, so a
    // scheme surviving to this point on the compile path is an unknown name.
    checkSchemeName(channelObj, `encoding.${channel}`, errors);

    // Check field type is allowed for this channel
    if (channelRule && channelObj.type && channelRule.allowedTypes.length > 0) {
      if (!channelRule.allowedTypes.includes(channelObj.type as FieldType)) {
        errors.push({
          message: `Spec error: encoding.${channel} for ${markType} chart does not accept type "${channelObj.type}". Allowed types: ${channelRule.allowedTypes.join(', ')}`,
          path: `encoding.${channel}.type`,
          code: 'ENCODING_MISMATCH',
          suggestion: `Change encoding.${channel}.type to one of: ${channelRule.allowedTypes.join(', ')}`,
        });
      }
    }

    // Check field values match declared type
    if (channelObj.type && channelObj.field && dataColumns.has(channelObj.field as string)) {
      const data = spec.data as Record<string, unknown>[];
      const fieldName = channelObj.field as string;
      const fieldType = channelObj.type as string;
      // Sample up to 5 values for type checking
      const sampleSize = Math.min(5, data.length);

      if (fieldType === 'temporal') {
        let nonDateCount = 0;
        for (let i = 0; i < sampleSize; i++) {
          const val = data[i][fieldName];
          if (val != null && !isParseableDate(val)) {
            nonDateCount++;
          }
        }
        if (nonDateCount > 0) {
          errors.push({
            message: `Spec error: encoding.${channel}.field "${fieldName}" is declared as temporal but contains non-date values`,
            path: `encoding.${channel}`,
            code: 'ENCODING_MISMATCH',
            suggestion: `Either change the type to "nominal" or ensure "${fieldName}" values are parseable dates (ISO 8601 strings like "2024-01-15" or Date objects)`,
          });
        }
      }

      if (fieldType === 'quantitative') {
        let nonNumericCount = 0;
        for (let i = 0; i < sampleSize; i++) {
          const val = data[i][fieldName];
          if (val != null && !isNumeric(val)) {
            nonNumericCount++;
          }
        }
        if (nonNumericCount > 0) {
          errors.push({
            message: `Spec error: encoding.${channel}.field "${fieldName}" is declared as quantitative but contains non-numeric values`,
            path: `encoding.${channel}`,
            code: 'ENCODING_MISMATCH',
            suggestion: `Either change the type to "nominal" or ensure "${fieldName}" values are numbers`,
          });
        }
      }
    }
  }

  // Validate highlight on the color channel
  if (encoding) {
    const colorCh = (encoding as Record<string, Record<string, unknown> | undefined>).color;
    if (colorCh && colorCh.highlight != null) {
      const hlVal = colorCh.highlight;
      const isValidType =
        typeof hlVal === 'string' ||
        (Array.isArray(hlVal) && hlVal.every((v: unknown) => typeof v === 'string'));
      if (!isValidType) {
        errors.push({
          message: 'Spec error: encoding.color.highlight must be a string or array of strings',
          path: 'encoding.color.highlight',
          code: 'INVALID_TYPE',
          suggestion: 'Provide a series name (string) or an array of series names.',
        });
      } else {
        const colorType =
          (colorCh.type as string | undefined) ??
          (colorCh.field && Array.isArray(spec.data) && spec.data.length > 0
            ? inferFieldType(spec.data as Record<string, unknown>[], colorCh.field as string)
            : undefined);
        if (colorType === 'quantitative') {
          errors.push({
            message:
              'Spec error: encoding.color.highlight is not supported on quantitative color channels',
            path: 'encoding.color.highlight',
            code: 'INVALID_VALUE',
            suggestion:
              'Highlight works with nominal/ordinal color (categorical series). Remove highlight or change encoding.color.type to nominal.',
          });
        }
      }
    }
  }

  // Validate facet channel if provided
  if (encoding.facet && typeof encoding.facet === 'object') {
    const facet = encoding.facet as Record<string, unknown>;
    if (!facet.field || typeof facet.field !== 'string') {
      errors.push({
        message: 'Spec error: encoding.facet.field is required and must be a non-empty string',
        path: 'encoding.facet.field',
        code: 'MISSING_FIELD',
        suggestion:
          'Add a field property to encoding.facet (e.g. { field: "category", type: "nominal" })',
      });
    } else if (
      !dataColumns.has(facet.field as string) &&
      !transformFields.has(facet.field as string)
    ) {
      errors.push({
        message: `Spec error: encoding.facet.field "${facet.field}" does not exist in data. Available columns: ${availableColumns}`,
        path: 'encoding.facet.field',
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(facet.field as string, columnList)}`,
      });
    }
    if (!facet.type || (facet.type !== 'nominal' && facet.type !== 'ordinal')) {
      errors.push({
        message: `Spec error: encoding.facet.type must be "nominal" or "ordinal"${facet.type ? `, got "${facet.type}"` : ''}`,
        path: 'encoding.facet.type',
        code: facet.type ? 'INVALID_VALUE' : 'MISSING_FIELD',
        suggestion: 'Set encoding.facet.type to "nominal" or "ordinal"',
      });
    }
    if (facet.columns !== undefined) {
      const cols = Number(facet.columns);
      if (!Number.isInteger(cols) || cols < 1) {
        errors.push({
          message: 'Spec error: encoding.facet.columns must be a positive integer',
          path: 'encoding.facet.columns',
          code: 'INVALID_VALUE',
          suggestion: 'Set columns to a positive integer (e.g. 3)',
        });
      }
    }
  }

  // Validate row/column facet channels
  for (const channel of ['row', 'column'] as const) {
    const ch = (encoding as Record<string, unknown>)[channel];
    if (ch && typeof ch === 'object') {
      const facetCh = ch as Record<string, unknown>;
      if (!facetCh.field || typeof facetCh.field !== 'string') {
        errors.push({
          message: `Spec error: encoding.${channel}.field is required and must be a non-empty string`,
          path: `encoding.${channel}.field`,
          code: 'MISSING_FIELD',
          suggestion: `Add a field property to encoding.${channel} (e.g. { field: "category", type: "nominal" })`,
        });
      } else if (
        !dataColumns.has(facetCh.field as string) &&
        !transformFields.has(facetCh.field as string)
      ) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${facetCh.field}" does not exist in data. Available columns: ${availableColumns}`,
          path: `encoding.${channel}.field`,
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(facetCh.field as string, columnList)}`,
        });
      }
      if (!facetCh.type || (facetCh.type !== 'nominal' && facetCh.type !== 'ordinal')) {
        errors.push({
          message: `Spec error: encoding.${channel}.type must be "nominal" or "ordinal"${facetCh.type ? `, got "${facetCh.type}"` : ''}`,
          path: `encoding.${channel}.type`,
          code: facetCh.type ? 'INVALID_VALUE' : 'MISSING_FIELD',
          suggestion: `Set encoding.${channel}.type to "nominal" or "ordinal"`,
        });
      }
      if (encoding.facet && typeof encoding.facet === 'object') {
        errors.push({
          message: `Spec error: encoding.${channel} and encoding.facet cannot be used together`,
          path: `encoding.${channel}`,
          code: 'INVALID_VALUE',
          suggestion: `Use either encoding.${channel} or encoding.facet, not both`,
        });
      }
      const otherChannel = channel === 'row' ? 'column' : 'row';
      if ((encoding as Record<string, unknown>)[otherChannel]) {
        errors.push({
          message:
            'Spec error: encoding.row and encoding.column cannot be used together (cross-product faceting is not yet supported)',
          path: `encoding.${channel}`,
          code: 'INVALID_VALUE',
          suggestion: 'Use encoding.facet with columns for grid layout, or use only row or column',
        });
      }
    }
  }

  // Validate darkMode if provided
  if (spec.darkMode !== undefined && !VALID_DARK_MODES.has(spec.darkMode as string)) {
    errors.push({
      message: `Spec error: darkMode must be "auto", "force", or "off"`,
      path: 'darkMode',
      code: 'INVALID_VALUE',
      suggestion:
        'Use one of: "auto" (system preference), "force" (always dark), or "off" (always light)',
    });
  }

  // Validate youDrawIt: line marks only, single-series only, "from" required.
  if (spec.youDrawIt !== undefined && spec.youDrawIt !== false) {
    if (markType !== 'line') {
      errors.push({
        message: `Spec error: youDrawIt is only supported on line charts, but mark is "${markType}"`,
        path: 'youDrawIt',
        code: 'ENCODING_MISMATCH',
        suggestion: 'Remove youDrawIt or change mark to "line".',
      });
    } else {
      const config = spec.youDrawIt as Record<string, unknown>;
      if (
        typeof config !== 'object' ||
        Array.isArray(config) ||
        (config.from !== 0 && !config.from)
      ) {
        errors.push({
          message: 'Spec error: youDrawIt.from is required (the x value where drawing starts)',
          path: 'youDrawIt.from',
          code: 'MISSING_FIELD',
          suggestion:
            'Set youDrawIt.from to an x value from your data, e.g. youDrawIt: { from: "2010" }',
        });
      } else if (typeof config.from !== 'string' && typeof config.from !== 'number') {
        errors.push({
          message: 'Spec error: youDrawIt.from must be a string or number',
          path: 'youDrawIt.from',
          code: 'INVALID_TYPE',
          suggestion: 'Provide the x value as a string or number matching your data.',
        });
      }

      const data = Array.isArray(spec.data) ? (spec.data as Record<string, unknown>[]) : [];
      const colorCh = encoding?.color as Record<string, unknown> | undefined;
      if (colorCh && typeof colorCh === 'object' && typeof colorCh.field === 'string') {
        const colorType =
          (colorCh.type as string | undefined) ?? inferFieldType(data, colorCh.field);
        if (colorType !== 'quantitative') {
          const distinct = new Set(data.map((row) => row[colorCh.field as string]));
          if (distinct.size > 1) {
            errors.push({
              message:
                'Spec error: youDrawIt only supports single-series line charts, but encoding.color has multiple distinct values',
              path: 'youDrawIt',
              code: 'ENCODING_MISMATCH',
              suggestion:
                'Remove encoding.color (or filter the data to one series) to use youDrawIt.',
            });
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Table validation
// ---------------------------------------------------------------------------

function validateTableSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  if (!Array.isArray(spec.data)) {
    errors.push({
      message: 'Spec error: "data" must be an array',
      path: 'data',
      code: 'INVALID_TYPE',
      suggestion: 'Provide data as an array of objects, e.g. data: [{ name: "Alice", age: 30 }]',
    });
    return;
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" must be a non-empty array',
      path: 'data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one data row to the data array',
    });
    return;
  }

  if (!Array.isArray(spec.columns)) {
    errors.push({
      message: 'Spec error: table spec requires a "columns" array',
      path: 'columns',
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
      path: 'data[0]',
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
        path: `columns[${i}]`,
        code: 'INVALID_TYPE',
        suggestion: 'Each column entry should be an object, e.g. { key: "fieldName" }',
      });
      continue;
    }

    // Check key exists
    if (!col.key || typeof col.key !== 'string') {
      errors.push({
        message: `Spec error: columns[${i}] must have a "key" string`,
        path: `columns[${i}].key`,
        code: 'MISSING_FIELD',
        suggestion: `Add a key referencing a data field. Available columns: ${availableColumns}`,
      });
      continue;
    }

    // Check key references a field in data
    if (!dataColumns.has(col.key as string)) {
      errors.push({
        message: `Spec error: columns[${i}].key "${col.key}" does not exist in data. Available columns: ${availableColumns}`,
        path: `columns[${i}].key`,
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
        path: `columns[${i}]`,
        code: 'INVALID_VALUE',
        suggestion: `Keep only one visual feature per column. Remove all but one of: ${visuals.join(', ')}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Graph validation
// ---------------------------------------------------------------------------

function validateGraphSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  // Validate nodes array exists and is non-empty
  if (!Array.isArray(spec.nodes)) {
    errors.push({
      message: 'Spec error: graph spec requires a "nodes" array',
      path: 'nodes',
      code: 'MISSING_FIELD',
      suggestion:
        'Add a nodes array with objects that have an "id" field, e.g. nodes: [{ id: "a" }, { id: "b" }]',
    });
    return; // Can't validate further without nodes
  }

  if (spec.nodes.length === 0) {
    errors.push({
      message: 'Spec error: "nodes" must be a non-empty array',
      path: 'nodes',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one node, e.g. nodes: [{ id: "a" }]',
    });
    return;
  }

  // Validate each node has a string id
  const nodeIds = new Set<string>();
  const nodes = spec.nodes as Record<string, unknown>[];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      errors.push({
        message: `Spec error: nodes[${i}] must be an object`,
        path: `nodes[${i}]`,
        code: 'INVALID_TYPE',
        suggestion: 'Each node must be an object with at least an "id" field, e.g. { id: "a" }',
      });
      continue;
    }
    if (typeof node.id !== 'string' || node.id === '') {
      errors.push({
        message: `Spec error: nodes[${i}] must have a non-empty string "id" field`,
        path: `nodes[${i}].id`,
        code: 'MISSING_FIELD',
        suggestion: 'Add a string id to the node, e.g. { id: "node1" }',
      });
    } else {
      nodeIds.add(node.id);
    }
  }

  // Validate edges array exists
  if (!Array.isArray(spec.edges)) {
    errors.push({
      message: 'Spec error: graph spec requires an "edges" array',
      path: 'edges',
      code: 'MISSING_FIELD',
      suggestion: 'Add an edges array (can be empty), e.g. edges: [{ source: "a", target: "b" }]',
    });
    return;
  }

  // Validate each edge has string source and target that reference existing nodes
  const edges = spec.edges as Record<string, unknown>[];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || typeof edge !== 'object') {
      errors.push({
        message: `Spec error: edges[${i}] must be an object`,
        path: `edges[${i}]`,
        code: 'INVALID_TYPE',
        suggestion:
          'Each edge must be an object with "source" and "target" fields, e.g. { source: "a", target: "b" }',
      });
      continue;
    }

    if (typeof edge.source !== 'string' || edge.source === '') {
      errors.push({
        message: `Spec error: edges[${i}] must have a non-empty string "source" field`,
        path: `edges[${i}].source`,
        code: 'MISSING_FIELD',
        suggestion: 'Add a source node id, e.g. { source: "a", target: "b" }',
      });
    } else if (nodeIds.size > 0 && !nodeIds.has(edge.source)) {
      errors.push({
        message: `Spec error: edges[${i}].source "${edge.source}" does not reference an existing node id`,
        path: `edges[${i}].source`,
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the existing node ids: ${[...nodeIds].slice(0, 5).join(', ')}${nodeIds.size > 5 ? '...' : ''}.${didYouMean(edge.source, [...nodeIds])}`,
      });
    }

    if (typeof edge.target !== 'string' || edge.target === '') {
      errors.push({
        message: `Spec error: edges[${i}] must have a non-empty string "target" field`,
        path: `edges[${i}].target`,
        code: 'MISSING_FIELD',
        suggestion: 'Add a target node id, e.g. { source: "a", target: "b" }',
      });
    } else if (nodeIds.size > 0 && !nodeIds.has(edge.target)) {
      errors.push({
        message: `Spec error: edges[${i}].target "${edge.target}" does not reference an existing node id`,
        path: `edges[${i}].target`,
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the existing node ids: ${[...nodeIds].slice(0, 5).join(', ')}${nodeIds.size > 5 ? '...' : ''}.${didYouMean(edge.target, [...nodeIds])}`,
      });
    }
  }

  // Validate encoding fields against the FULL union of keys across ALL
  // nodes/edges. Sparse fields (present only on edges[3]) must not hard-fail;
  // first-row sampling would just move the cliff and make failures
  // data-order-dependent. Object.keys over 50k rows is cheap.
  if (spec.encoding && typeof spec.encoding === 'object') {
    const encoding = spec.encoding as Record<string, unknown>;
    const nodeFields = new Set<string>();
    for (const node of nodes) {
      if (node && typeof node === 'object') {
        for (const key of Object.keys(node as Record<string, unknown>)) nodeFields.add(key);
      }
    }
    const edgeFields = new Set<string>();
    for (const edge of edges) {
      if (edge && typeof edge === 'object') {
        for (const key of Object.keys(edge as Record<string, unknown>)) edgeFields.add(key);
      }
    }

    const nodeChannels = [
      'nodeColor',
      'nodeSize',
      'nodeOpacity',
      'nodeLabel',
      'nodeLabelPriority',
    ] as const;
    for (const channel of nodeChannels) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (
        ch?.field &&
        typeof ch.field === 'string' &&
        nodes.length > 0 &&
        !nodeFields.has(ch.field)
      ) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist on nodes. Available fields: ${[...nodeFields].join(', ')}`,
          path: `encoding.${channel}.field`,
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the node fields: ${[...nodeFields].join(', ')}.${didYouMean(ch.field, [...nodeFields])}`,
        });
      }
    }

    const edgeChannels = ['edgeColor', 'edgeWidth', 'edgeStyle'] as const;
    for (const channel of edgeChannels) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (
        ch?.field &&
        typeof ch.field === 'string' &&
        edges.length > 0 &&
        !edgeFields.has(ch.field)
      ) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist on edges. Available fields: ${[...edgeFields].join(', ')}`,
          path: `encoding.${channel}.field`,
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the edge fields: ${[...edgeFields].join(', ')}.${didYouMean(ch.field, [...edgeFields])}`,
        });
      }
    }

    // Graph never reads scale.scheme: colors come from scale.range/scale.domain
    checkSchemeUnused(
      encoding,
      errors,
      'graph colors come from scale.range and scale.domain',
      'Remove scale.scheme. To customize graph colors, provide explicit colors via scale.range.',
    );
  }

  // Validate layout type if specified
  if (spec.layout && typeof spec.layout === 'object') {
    const layout = spec.layout as Record<string, unknown>;
    if (layout.type && layout.type !== 'force') {
      errors.push({
        message: `Spec error: layout.type "${layout.type}" is not supported. Only "force" is currently supported`,
        path: 'layout.type',
        code: 'INVALID_VALUE',
        suggestion:
          'Use layout.type: "force" or omit the layout field to use the default force layout',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Sankey validation
// ---------------------------------------------------------------------------

function validateSankeySpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  // Validate data
  if (!Array.isArray(spec.data)) {
    errors.push({
      message: 'Spec error: sankey spec requires a "data" array',
      path: 'data',
      code: 'INVALID_TYPE',
      suggestion:
        'Provide data as an array of objects, e.g. data: [{ source: "A", target: "B", value: 10 }]',
    });
    return;
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" must be a non-empty array',
      path: 'data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one data row, e.g. data: [{ source: "A", target: "B", value: 10 }]',
    });
    return;
  }

  const firstRow = spec.data[0] as unknown;
  if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
    errors.push({
      message: 'Spec error: each item in "data" must be a plain object',
      path: 'data[0]',
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
      path: 'encoding',
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
        path: `encoding.${channel}`,
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.${channel} with a field from your data (${availableColumns}). Example: ${channel}: { field: "${columnList[0] ?? 'myField'}", type: "${channel === 'value' ? 'quantitative' : 'nominal'}" }`,
      });
      continue;
    }

    if (!ch.field || typeof ch.field !== 'string') {
      errors.push({
        message: `Spec error: encoding.${channel} must have a "field" string`,
        path: `encoding.${channel}.field`,
        code: 'MISSING_FIELD',
        suggestion: `Add a field name from your data columns: ${availableColumns}`,
      });
      continue;
    }

    if (!dataColumns.has(ch.field as string)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist in data. Available columns: ${availableColumns}`,
        path: `encoding.${channel}.field`,
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

  // Validate darkMode if provided
  if (spec.darkMode !== undefined && !VALID_DARK_MODES.has(spec.darkMode as string)) {
    errors.push({
      message: 'Spec error: darkMode must be "auto", "force", or "off"',
      path: 'darkMode',
      code: 'INVALID_VALUE',
      suggestion:
        'Use one of: "auto" (system preference), "force" (always dark), or "off" (always light)',
    });
  }
}

// ---------------------------------------------------------------------------
// TileMap validation
// ---------------------------------------------------------------------------

function validateTileMapSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  // Validate data (can be record or array)
  if (!spec.data || typeof spec.data !== 'object') {
    errors.push({
      message: 'Spec error: tilemap spec requires a "data" field (record or array)',
      path: 'data',
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
      path: 'data',
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
        path: 'data',
        code: 'EMPTY_DATA',
        suggestion: 'Add at least one data row',
      });
      return;
    }

    const firstRow = spec.data[0] as unknown;
    if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
      errors.push({
        message: 'Spec error: each item in "data" must be a plain object',
        path: 'data[0]',
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
        path: 'encoding',
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
          path: `encoding.${channel}`,
          code: 'MISSING_FIELD',
          suggestion: `Add encoding.${channel} with a field from your data (${availableColumns}). Example: ${channel}: { field: "${columnList[0] ?? 'myField'}", type: "${channel === 'value' ? 'quantitative' : 'nominal'}" }`,
        });
        continue;
      }

      if (!ch.field || typeof ch.field !== 'string') {
        errors.push({
          message: `Spec error: encoding.${channel} must have a "field" string`,
          path: `encoding.${channel}.field`,
          code: 'MISSING_FIELD',
          suggestion: `Add a field name from your data columns: ${availableColumns}`,
        });
        continue;
      }

      if (!dataColumns.has(ch.field as string)) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist in data. Available columns: ${availableColumns}`,
          path: `encoding.${channel}.field`,
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

  // Validate darkMode if provided
  if (spec.darkMode !== undefined && !VALID_DARK_MODES.has(spec.darkMode as string)) {
    errors.push({
      message: 'Spec error: darkMode must be "auto", "force", or "off"',
      path: 'darkMode',
      code: 'INVALID_VALUE',
      suggestion:
        'Use one of: "auto" (system preference), "force" (always dark), or "off" (always light)',
    });
  }
}

// ---------------------------------------------------------------------------
// Map validation
// ---------------------------------------------------------------------------

function validateMapSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  if (!spec.geo || typeof spec.geo !== 'object') {
    errors.push({
      message: 'Spec error: map spec requires a "geo" object with a TopoJSON "features" field',
      path: 'geo',
      code: 'MISSING_FIELD',
      suggestion: 'Add a geo object, e.g. geo: { features: topoJsonData, projection: "identity" }',
    });
    return;
  }

  const geo = spec.geo as Record<string, unknown>;
  if (!geo.features) {
    errors.push({
      message: 'Spec error: geo requires a "features" field containing TopoJSON topology',
      path: 'geo.features',
      code: 'MISSING_FIELD',
      suggestion:
        'Import a TopoJSON file and pass it as geo.features, e.g. import topo from "us-atlas/states-albers-10m.json"',
    });
    return;
  }

  if (!spec.encoding || typeof spec.encoding !== 'object') {
    errors.push({
      message: 'Spec error: map spec requires an "encoding" object with key and color channels',
      path: 'encoding',
      code: 'MISSING_FIELD',
      suggestion:
        'Add an encoding object, e.g. encoding: { key: { field: "id", type: "nominal" }, color: { field: "value", type: "quantitative" } }',
    });
    return;
  }

  // Map color channels resolve scale.scheme against the sequential palettes
  // with a silent blue fallback; reject unsupported names here instead.
  const mapEncoding = spec.encoding as Record<string, unknown>;
  if (mapEncoding.color && typeof mapEncoding.color === 'object') {
    checkMapSchemeName(mapEncoding.color as Record<string, unknown>, 'encoding.color', errors);
  }
  if (spec.points && typeof spec.points === 'object') {
    const pointsLayer = spec.points as Record<string, unknown>;
    if (pointsLayer.color && typeof pointsLayer.color === 'object') {
      checkMapSchemeName(pointsLayer.color as Record<string, unknown>, 'points.color', errors);
    }
  }

  // Validate geo.focus if present
  if ('focus' in geo && geo.focus !== undefined && geo.focus !== null) {
    const focus = geo.focus;
    if (typeof focus === 'string' || typeof focus === 'number') {
      // valid: single id
    } else if (Array.isArray(focus)) {
      for (let i = 0; i < focus.length; i++) {
        if (typeof focus[i] !== 'string' && typeof focus[i] !== 'number') {
          errors.push({
            message: `Spec error: geo.focus array element [${i}] must be a string or number`,
            path: `geo.focus[${i}]`,
            code: 'INVALID_TYPE',
            suggestion: 'Each element in the focus array should be a feature id (string or number)',
          });
        }
      }
    } else if (typeof focus === 'object') {
      const focusObj = focus as Record<string, unknown>;
      if ('points' in focusObj) {
        // Points form: { points: true | { field, value }, padding? } fits the
        // point layer's cluster (all points, or a matching subset).
        const pts = focusObj.points;
        const isSubset =
          typeof pts === 'object' &&
          pts !== null &&
          typeof (pts as Record<string, unknown>).field === 'string' &&
          'value' in (pts as Record<string, unknown>);
        if (pts !== true && !isSubset) {
          errors.push({
            message:
              'Spec error: geo.focus.points must be true or { field: string, value: string | number }',
            path: 'geo.focus.points',
            code: 'INVALID_TYPE',
            suggestion:
              'Use { points: true } to fit all points, or { points: { field: "rating", value: "F" } } to fit a subset.',
          });
        }
        if (focusObj.padding !== undefined && typeof focusObj.padding !== 'number') {
          errors.push({
            message: 'Spec error: geo.focus.padding must be a number',
            path: 'geo.focus.padding',
            code: 'INVALID_TYPE',
            suggestion: 'Provide padding as a number in map-local units, e.g. padding: 16',
          });
        }
      } else if (!('features' in focusObj) || focusObj.features == null) {
        errors.push({
          message: 'Spec error: geo.focus object must have a "features" or "points" property',
          path: 'geo.focus.features',
          code: 'MISSING_FIELD',
          suggestion:
            'Provide feature id(s) to focus on, e.g. { features: "36", padding: 32 }, or { points: true } to fit the point cluster.',
        });
      } else {
        const feats = focusObj.features;
        if (typeof feats !== 'string' && typeof feats !== 'number' && !Array.isArray(feats)) {
          errors.push({
            message:
              'Spec error: geo.focus.features must be a string, number, or array of strings/numbers',
            path: 'geo.focus.features',
            code: 'INVALID_TYPE',
            suggestion: 'Use a feature id or array of ids, e.g. "36" or ["36", "34"]',
          });
        } else if (Array.isArray(feats)) {
          for (let i = 0; i < feats.length; i++) {
            if (typeof feats[i] !== 'string' && typeof feats[i] !== 'number') {
              errors.push({
                message: `Spec error: geo.focus.features[${i}] must be a string or number`,
                path: `geo.focus.features[${i}]`,
                code: 'INVALID_TYPE',
                suggestion: 'Each element should be a feature id (string or number)',
              });
            }
          }
        }
        if (focusObj.padding !== undefined && typeof focusObj.padding !== 'number') {
          errors.push({
            message: 'Spec error: geo.focus.padding must be a number',
            path: 'geo.focus.padding',
            code: 'INVALID_TYPE',
            suggestion: 'Provide padding as a number in map-local units, e.g. padding: 32',
          });
        }
      }
    } else {
      errors.push({
        message:
          'Spec error: geo.focus must be a string, number, array of ids, or object with { features, padding? } or { points: true, padding? }',
        path: 'geo.focus',
        code: 'INVALID_TYPE',
        suggestion:
          'Use a feature id, array of ids, { features: "36", padding: 16 }, or { points: true }. Pass null to clear focus.',
      });
    }
  }

  const encoding = spec.encoding as Record<string, unknown>;
  const hasPoints = spec.points && typeof spec.points === 'object' && !Array.isArray(spec.points);

  // key is required unless basemap-only mode (points present + empty/no choropleth data)
  const specData = spec.data as unknown[] | undefined;
  const isBasemapOnly = hasPoints && (!specData || specData.length === 0);
  const keyCh = encoding.key as Record<string, unknown> | undefined;
  if (!isBasemapOnly) {
    if (!keyCh || typeof keyCh !== 'object') {
      errors.push({
        message: 'Spec error: map encoding requires "key" channel',
        path: 'encoding.key',
        code: 'MISSING_FIELD',
        suggestion: 'Add encoding.key, e.g. key: { field: "id", type: "nominal" }',
      });
    } else if (!keyCh.field || typeof keyCh.field !== 'string') {
      errors.push({
        message: 'Spec error: encoding.key must have a "field" string',
        path: 'encoding.key.field',
        code: 'MISSING_FIELD',
        suggestion: 'Add a field name, e.g. key: { field: "id" }',
      });
    }
  }

  // color is required UNLESS points is present (basemap-only mode)
  const colorCh = encoding.color as Record<string, unknown> | undefined;
  if (!hasPoints) {
    if (!colorCh || typeof colorCh !== 'object') {
      errors.push({
        message:
          'Spec error: map encoding requires "color" channel (or add a "points" layer for basemap-only mode)',
        path: 'encoding.color',
        code: 'MISSING_FIELD',
        suggestion: 'Add encoding.color, e.g. color: { field: "value", type: "quantitative" }',
      });
    } else if (!colorCh.field || typeof colorCh.field !== 'string') {
      errors.push({
        message: 'Spec error: encoding.color must have a "field" string',
        path: 'encoding.color.field',
        code: 'MISSING_FIELD',
        suggestion: 'Add a field name, e.g. color: { field: "value" }',
      });
    }
  } else if (
    colorCh &&
    typeof colorCh === 'object' &&
    (!colorCh.field || typeof colorCh.field !== 'string')
  ) {
    errors.push({
      message: 'Spec error: encoding.color must have a "field" string when provided',
      path: 'encoding.color.field',
      code: 'MISSING_FIELD',
      suggestion: 'Add a field name, e.g. color: { field: "value" }',
    });
  }

  // Validate points layer if present
  if (hasPoints) {
    const points = spec.points as Record<string, unknown>;
    if (!Array.isArray(points.data)) {
      errors.push({
        message: 'Spec error: points.data must be an array of data rows',
        path: 'points.data',
        code: 'INVALID_TYPE',
        suggestion: 'Provide data as an array of objects with lat/lng fields',
      });
    }
    for (const ch of ['longitude', 'latitude'] as const) {
      const enc = points[ch] as Record<string, unknown> | undefined;
      if (!enc || typeof enc !== 'object') {
        errors.push({
          message: `Spec error: points requires "${ch}" encoding channel`,
          path: `points.${ch}`,
          code: 'MISSING_FIELD',
          suggestion: `Add points.${ch}, e.g. ${ch}: { field: "${ch === 'longitude' ? 'lon' : 'lat'}", type: "quantitative" }`,
        });
      } else if (!enc.field || typeof enc.field !== 'string') {
        errors.push({
          message: `Spec error: points.${ch} must have a "field" string`,
          path: `points.${ch}.field`,
          code: 'MISSING_FIELD',
          suggestion: `Add a field name, e.g. ${ch}: { field: "${ch === 'longitude' ? 'lon' : 'lat'}" }`,
        });
      }
    }
    for (const ch of ['size', 'color', 'key'] as const) {
      const enc = points[ch] as Record<string, unknown> | undefined;
      if (enc && typeof enc === 'object' && (!enc.field || typeof enc.field !== 'string')) {
        errors.push({
          message: `Spec error: points.${ch} must have a "field" string when provided`,
          path: `points.${ch}.field`,
          code: 'MISSING_FIELD',
          suggestion: `Add a field name, e.g. ${ch}: { field: "myField" }`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// BarList validation
// ---------------------------------------------------------------------------

function validateBarListSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  if (!Array.isArray(spec.data)) {
    errors.push({
      message: 'Spec error: barlist spec requires a "data" array',
      path: 'data',
      code: 'INVALID_TYPE',
      suggestion:
        'Provide data as an array of objects, e.g. data: [{ label: "Category A", value: 42 }]',
    });
    return;
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" array must be non-empty',
      path: 'data',
      code: 'EMPTY_DATA',
      suggestion: 'Add at least one data row',
    });
    return;
  }

  const firstRow = spec.data[0] as unknown;
  if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
    errors.push({
      message: 'Spec error: each item in "data" must be a plain object',
      path: 'data[0]',
      code: 'INVALID_TYPE',
      suggestion: 'Each data item should be an object, e.g. { label: "Category A", value: 42 }',
    });
    return;
  }

  if (!spec.encoding || typeof spec.encoding !== 'object') {
    errors.push({
      message:
        'Spec error: barlist spec requires an "encoding" object with label and value channels',
      path: 'encoding',
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
        path: `encoding.${channel}`,
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.${channel} with a field from your data (${availableColumns}). Example: ${channel}: { field: "${columnList[0] ?? 'myField'}", type: "${channel === 'value' ? 'quantitative' : 'nominal'}" }`,
      });
      continue;
    }

    if (!ch.field || typeof ch.field !== 'string') {
      errors.push({
        message: `Spec error: encoding.${channel} must have a "field" string`,
        path: `encoding.${channel}.field`,
        code: 'MISSING_FIELD',
        suggestion: `Add a field name from your data columns: ${availableColumns}`,
      });
      continue;
    }

    if (!dataColumns.has(ch.field as string)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist in data. Available columns: ${availableColumns}`,
        path: `encoding.${channel}.field`,
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(ch.field as string, columnList)}`,
      });
    }
  }

  // Validate optional encoding channels
  for (const channel of ['subtitle', 'color', 'tooltip'] as const) {
    const ch = encoding[channel] as Record<string, unknown> | undefined;
    if (!ch) continue;
    const field = ch.field;
    if (field && typeof field === 'string' && !dataColumns.has(field)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${field}" does not exist in data. Available columns: ${availableColumns}`,
        path: `encoding.${channel}.field`,
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(field, columnList)}`,
      });
    }
  }

  // Barlist never reads scale.scheme: bars cycle the built-in barlist palette
  checkSchemeUnused(
    encoding,
    errors,
    'bar list colors cycle the built-in barlist palette',
    'Remove scale.scheme. Bar list colors are not configurable via encoding; they cycle the built-in palette.',
  );

  if (spec.darkMode !== undefined && !VALID_DARK_MODES.has(spec.darkMode as string)) {
    errors.push({
      message: 'Spec error: darkMode must be "auto", "force", or "off"',
      path: 'darkMode',
      code: 'INVALID_VALUE',
      suggestion:
        'Use one of: "auto" (system preference), "force" (always dark), or "off" (always light)',
    });
  }
}

// ---------------------------------------------------------------------------
// Layer validation
// ---------------------------------------------------------------------------

function validateLayerSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const layer = spec.layer as unknown[];

  if (layer.length === 0) {
    errors.push({
      message: 'Spec error: "layer" must be a non-empty array',
      path: 'layer',
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
        path: `layer[${i}]`,
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
        path: `layer[${i}]`,
        code: 'MISSING_FIELD',
        suggestion:
          'Each layer must be a chart spec (with mark + encoding) or a nested layer spec (with layer array)',
      });
      continue;
    }

    if (isNestedLayer) {
      validateLayerSpec(childObj, errors);
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
          path: `layer[${i}].mark`,
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
          validateChartSpec(mergedForValidation, errors);
        }
      }
    }
  }
}

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
export function validateSpec(spec: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Basic shape check
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return {
      valid: false,
      errors: [
        {
          message: 'Spec error: spec must be a non-null object',
          code: 'INVALID_TYPE',
          suggestion:
            'Pass a spec object with at least a "mark" field for charts, e.g. { mark: "line", data: [...], encoding: {...} }',
        },
      ],
      normalized: null,
    };
  }

  const obj = spec as Record<string, unknown>;

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
            path: key,
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
            path: 'facet',
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
          path: 'mark',
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
            path: 'mark',
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
    validateMapSpec(obj, errors);
  } else if (isBarList) {
    validateBarListSpec(obj, errors);
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
