/** Chart spec validation: mark, encoding, data shape, and field type compatibility. */
import {
  type FieldType,
  inferFieldType,
  jsonPointer,
  MARK_ENCODING_RULES,
  type MarkType,
} from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { validateFrame } from './frame';
import {
  checkSchemeName,
  didYouMean,
  isNumeric,
  isParseableDate,
  VALID_FIELD_TYPES,
} from './helpers';
import { validateLabelPlacement } from './label-placement';
import {
  validateCalendarSpec,
  validateCenterLabel,
  validateErrorbarSpec,
  validatePointSize,
  validateRangeSpec,
} from './mark-rules';

// ---------------------------------------------------------------------------
// Chart validation
// ---------------------------------------------------------------------------

export function validateChartSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  validateLabelPlacement(spec, errors);
  validateFrame(spec, errors);
  const markType =
    typeof spec.mark === 'string' ? spec.mark : (spec.mark as Record<string, unknown>)?.type;

  if (spec.encoding && typeof spec.encoding === 'object') {
    for (const [name, raw] of Object.entries(spec.encoding)) {
      if (!raw || typeof raw !== 'object' || !('interval' in raw)) continue;
      const channel = raw as Record<string, unknown>;
      const interval = channel.interval;
      if (interval === undefined) continue;
      const validValue =
        typeof interval === 'number'
          ? Number.isFinite(interval) && interval > 0
          : typeof interval === 'string' &&
            ['day', 'week', 'month', 'quarter', 'year'].includes(interval);
      if (
        !validValue ||
        !['bar', 'rect', 'errorbar'].includes(String(markType)) ||
        !['x', 'y', 'x2', 'y2'].includes(name) ||
        channel.type !== 'temporal'
      )
        errors.push({
          code: 'INVALID_VALUE',
          path: jsonPointer('encoding', name, 'interval'),
          message:
            'interval requires a temporal position channel of bar, rect or errorbar and a calendar unit or finite positive milliseconds.',
          suggestion:
            'Use day, week, month, quarter, year, or a positive millisecond interval on a temporal position channel.',
        });
    }
  }

  // Check data
  if (!Array.isArray(spec.data)) {
    // Near-miss: the VL `data: { url }` form. Fetching is out of scope for a
    // rendering library, so reject it with a pointed message. The `{ values }`
    // form is unwrapped by the pre-validation sugar expansion and never
    // reaches this check on the compile path.
    if (spec.data && typeof spec.data === 'object' && 'url' in (spec.data as object)) {
      errors.push({
        message: 'Spec error: data.url is not supported (openchart does not fetch remote data)',
        path: '/data/url',
        code: 'INVALID_VALUE',
        suggestion:
          'Fetch the data in your application and provide the rows inline: data: [...] or data: { values: [...] }',
      });
      return;
    }
    errors.push({
      message: 'Spec error: "data" must be an array',
      path: '/data',
      code: 'INVALID_TYPE',
      suggestion: 'Provide data as an array of objects, e.g. data: [{ x: 1, y: 2 }]',
    });
    return; // Can't validate further without data
  }

  if (spec.data.length === 0) {
    errors.push({
      message: 'Spec error: "data" must be a non-empty array',
      path: '/data',
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
      path: '/data/0',
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
      path: '/encoding',
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
        path: jsonPointer('encoding', suggestedChannel),
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
        path: '/encoding',
        code: 'MISSING_FIELD',
        suggestion: `Add the value axis, e.g. x: { field: "${[...dataColumns][0] ?? 'myField'}", type: "quantitative" }. Optionally add a nominal channel on the other axis for grouped swarms.`,
      });
    } else if (xType === 'quantitative' && yType === 'quantitative') {
      errors.push({
        message:
          'Spec error: beeswarm chart accepts only one quantitative axis (the value axis), but both encoding.x and encoding.y are quantitative',
        path: '/encoding',
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
        path: '/encoding',
        code: 'ENCODING_MISMATCH',
        suggestion:
          'Set the value axis to type: "quantitative" (x for a horizontal swarm, y for a vertical one).',
      });
    }
  }

  // Donut center stat: arc-only, and the object form needs a text string.
  validateCenterLabel(spec, markType, errors);

  if (markType === 'errorbar') validateErrorbarSpec(spec, errors);

  // Range marks: orientation-dependent x2/y2 requirement + mark.style options
  if (markType === 'range') {
    validateRangeSpec(spec, errors);
  }

  // Calendar marks: temporal daily x, no y, parseable dates, mark options
  if (markType === 'calendar') {
    validateCalendarSpec(spec, errors);
  }

  // Point sizes that only make sense as Vega-Lite areas fail loud with the
  // radius conversion, before they render as chart-swallowing discs.
  validatePointSize(spec, errors);

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
          path: jsonPointer('transform', i, 'calculate'),
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
      const opList = (t.aggregate ?? t.window ?? t.joinaggregate) as
        | Record<string, unknown>[]
        | undefined;
      if (Array.isArray(opList)) {
        for (const op of opList) {
          if (op && typeof op.as === 'string') transformFields.add(op.as);
        }
      }
      // The density transform defaults its two outputs when `as` is omitted.
      if (typeof t.density === 'string' && t.as == null) {
        transformFields.add('value');
        transformFields.add('density');
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
            path: jsonPointer('encoding', 'tooltip', i, 'field'),
            code: 'MISSING_FIELD',
            suggestion: `Add a field name from your data columns: ${availableColumns}`,
          });
          continue;
        }
        if (!dataColumns.has(elem.field) && !transformFields.has(elem.field)) {
          errors.push({
            message: `Spec error: encoding.tooltip[${i}].field "${elem.field}" does not exist in data. Available columns: ${availableColumns}`,
            path: jsonPointer('encoding', 'tooltip', i, 'field'),
            code: 'DATA_FIELD_MISSING',
            suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(elem.field, columnList)}`,
          });
        }
        if (elem.type && !VALID_FIELD_TYPES.has(elem.type as string)) {
          errors.push({
            message: `Spec error: encoding.tooltip[${i}].type "${elem.type}" is not valid. Must be one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
            path: jsonPointer('encoding', 'tooltip', i, 'type'),
            code: 'INVALID_VALUE',
            suggestion: `Use one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
          });
        }
      }
      continue;
    }

    const channelObj = channelSpec as Record<string, unknown>;
    const channelRule = rules[channel as keyof typeof rules];

    if (channel === 'description' && 'value' in channelObj) {
      if (typeof channelObj.value !== 'string' || 'field' in channelObj)
        errors.push({
          message: 'Spec error: encoding.description must be a field reference or a string value',
          path: '/encoding/description',
          code: 'INVALID_VALUE',
          suggestion: 'Use description: { field: "text" } or { value: "Description" }',
        });
      continue;
    }

    // Skip ConditionalValueDef channels (they have 'condition' instead of 'field')
    if ('condition' in channelObj) continue;

    // Check field exists
    if (!channelObj.field || typeof channelObj.field !== 'string') {
      errors.push({
        message: `Spec error: encoding.${channel} must have a "field" string`,
        path: jsonPointer('encoding', channel, 'field'),
        code: 'MISSING_FIELD',
        suggestion: `For constant colors, use mark.fill (e.g., mark: { type: "bar", fill: "#1b7fa3" }) instead of encoding.${channel}. Encoding channels require a data field: ${availableColumns}`,
      });
      continue;
    }

    // Check field references a column in data (or will be created by a transform)
    if (!dataColumns.has(channelObj.field) && !transformFields.has(channelObj.field)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${channelObj.field}" does not exist in data. Available columns: ${availableColumns}`,
        path: jsonPointer('encoding', channel, 'field'),
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(channelObj.field, columnList)}`,
      });
    }

    // Check field type is valid
    if (channelObj.type && !VALID_FIELD_TYPES.has(channelObj.type as string)) {
      errors.push({
        message: `Spec error: encoding.${channel}.type "${channelObj.type}" is not valid. Must be one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
        path: jsonPointer('encoding', channel, 'type'),
        code: 'INVALID_VALUE',
        suggestion: `Use one of: ${[...VALID_FIELD_TYPES].join(', ')}`,
      });
    }

    // Check scale.scheme names. Known names (including VL aliases) are
    // resolved to palette ranges by the pre-validation sugar expansion, so a
    // scheme surviving to this point on the compile path is an unknown name.
    checkSchemeName(channelObj, ['encoding', channel], errors);

    // Check field type is allowed for this channel
    if (channelRule && channelObj.type && channelRule.allowedTypes.length > 0) {
      if (!channelRule.allowedTypes.includes(channelObj.type as FieldType)) {
        errors.push({
          message: `Spec error: encoding.${channel} for ${markType} chart does not accept type "${channelObj.type}". Allowed types: ${channelRule.allowedTypes.join(', ')}`,
          path: jsonPointer('encoding', channel, 'type'),
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
            path: jsonPointer('encoding', channel),
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
            path: jsonPointer('encoding', channel),
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
          path: '/encoding/color/highlight',
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
            path: '/encoding/color/highlight',
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
        path: '/encoding/facet/field',
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
        path: '/encoding/facet/field',
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(facet.field as string, columnList)}`,
      });
    }
    if (!facet.type || (facet.type !== 'nominal' && facet.type !== 'ordinal')) {
      errors.push({
        message: `Spec error: encoding.facet.type must be "nominal" or "ordinal"${facet.type ? `, got "${facet.type}"` : ''}`,
        path: '/encoding/facet/type',
        code: facet.type ? 'INVALID_VALUE' : 'MISSING_FIELD',
        suggestion: 'Set encoding.facet.type to "nominal" or "ordinal"',
      });
    }
    if (facet.columns !== undefined) {
      const cols = Number(facet.columns);
      if (!Number.isInteger(cols) || cols < 1) {
        errors.push({
          message: 'Spec error: encoding.facet.columns must be a positive integer',
          path: '/encoding/facet/columns',
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
          path: jsonPointer('encoding', channel, 'field'),
          code: 'MISSING_FIELD',
          suggestion: `Add a field property to encoding.${channel} (e.g. { field: "category", type: "nominal" })`,
        });
      } else if (
        !dataColumns.has(facetCh.field as string) &&
        !transformFields.has(facetCh.field as string)
      ) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${facetCh.field}" does not exist in data. Available columns: ${availableColumns}`,
          path: jsonPointer('encoding', channel, 'field'),
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the available data columns: ${availableColumns}.${didYouMean(facetCh.field as string, columnList)}`,
        });
      }
      if (!facetCh.type || (facetCh.type !== 'nominal' && facetCh.type !== 'ordinal')) {
        errors.push({
          message: `Spec error: encoding.${channel}.type must be "nominal" or "ordinal"${facetCh.type ? `, got "${facetCh.type}"` : ''}`,
          path: jsonPointer('encoding', channel, 'type'),
          code: facetCh.type ? 'INVALID_VALUE' : 'MISSING_FIELD',
          suggestion: `Set encoding.${channel}.type to "nominal" or "ordinal"`,
        });
      }
      if (encoding.facet && typeof encoding.facet === 'object') {
        errors.push({
          message: `Spec error: encoding.${channel} and encoding.facet cannot be used together`,
          path: jsonPointer('encoding', channel),
          code: 'INVALID_VALUE',
          suggestion: `Use either encoding.${channel} or encoding.facet, not both`,
        });
      }
      const otherChannel = channel === 'row' ? 'column' : 'row';
      if ((encoding as Record<string, unknown>)[otherChannel]) {
        errors.push({
          message:
            'Spec error: encoding.row and encoding.column cannot be used together (cross-product faceting is not yet supported)',
          path: jsonPointer('encoding', channel),
          code: 'INVALID_VALUE',
          suggestion: 'Use encoding.facet with columns for grid layout, or use only row or column',
        });
      }
    }
  }

  // Validate youDrawIt: line marks only, single-series only, "from" required.
  if (spec.youDrawIt !== undefined && spec.youDrawIt !== false) {
    if (markType !== 'line') {
      errors.push({
        message: `Spec error: youDrawIt is only supported on line charts, but mark is "${markType}"`,
        path: '/youDrawIt',
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
          path: '/youDrawIt/from',
          code: 'MISSING_FIELD',
          suggestion:
            'Set youDrawIt.from to an x value from your data, e.g. youDrawIt: { from: "2010" }',
        });
      } else if (typeof config.from !== 'string' && typeof config.from !== 'number') {
        errors.push({
          message: 'Spec error: youDrawIt.from must be a string or number',
          path: '/youDrawIt/from',
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
              path: '/youDrawIt',
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
