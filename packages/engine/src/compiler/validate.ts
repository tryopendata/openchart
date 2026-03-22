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
  MARK_ENCODING_RULES,
  MARK_TYPES,
  type MarkType,
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

// ---------------------------------------------------------------------------
// Chart validation
// ---------------------------------------------------------------------------

function validateChartSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const markType =
    typeof spec.mark === 'string' ? spec.mark : (spec.mark as Record<string, unknown>)?.type;

  // Check data
  if (!Array.isArray(spec.data)) {
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
  const availableColumns = [...dataColumns].join(', ');

  // Validate required channels
  for (const [channel, rule] of Object.entries(rules)) {
    if (rule.required && !encoding[channel]) {
      const allowedTypes = rule.allowedTypes.join(' or ');
      errors.push({
        message: `Spec error: ${markType} chart requires encoding.${channel} but none was provided`,
        path: `encoding.${channel}`,
        code: 'MISSING_FIELD',
        suggestion: `Add encoding.${channel} with a field from your data (${availableColumns}) and type (${allowedTypes}). Example: ${channel}: { field: "${[...dataColumns][0] ?? 'myField'}", type: "${rule.allowedTypes[0]}" }`,
      });
    }
  }

  // Validate provided channels
  for (const [channel, channelSpec] of Object.entries(encoding)) {
    if (!channelSpec || typeof channelSpec !== 'object') continue;

    const channelObj = channelSpec as Record<string, unknown>;
    const channelRule = rules[channel as keyof typeof rules];

    // Check field exists
    if (!channelObj.field || typeof channelObj.field !== 'string') {
      errors.push({
        message: `Spec error: encoding.${channel} must have a "field" string`,
        path: `encoding.${channel}.field`,
        code: 'MISSING_FIELD',
        suggestion: `Add a field name from your data columns: ${availableColumns}`,
      });
      continue;
    }

    // Check field references a column in data
    if (!dataColumns.has(channelObj.field)) {
      errors.push({
        message: `Spec error: encoding.${channel}.field "${channelObj.field}" does not exist in data. Available columns: ${availableColumns}`,
        path: `encoding.${channel}.field`,
        code: 'DATA_FIELD_MISSING',
        suggestion: `Use one of the available data columns: ${availableColumns}`,
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
  const availableColumns = [...dataColumns].join(', ');
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
        suggestion: `Use one of the available data columns: ${availableColumns}`,
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
        suggestion: `Use one of the existing node ids: ${[...nodeIds].slice(0, 5).join(', ')}${nodeIds.size > 5 ? '...' : ''}`,
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
        suggestion: `Use one of the existing node ids: ${[...nodeIds].slice(0, 5).join(', ')}${nodeIds.size > 5 ? '...' : ''}`,
      });
    }
  }

  // Validate encoding fields exist on at least the first node/edge
  if (spec.encoding && typeof spec.encoding === 'object') {
    const encoding = spec.encoding as Record<string, unknown>;
    const firstNode = nodes[0] as Record<string, unknown>;
    const firstEdge = edges.length > 0 ? (edges[0] as Record<string, unknown>) : null;
    const nodeFields = firstNode ? new Set(Object.keys(firstNode)) : new Set<string>();
    const edgeFields = firstEdge ? new Set(Object.keys(firstEdge)) : new Set<string>();

    const nodeChannels = ['nodeColor', 'nodeSize', 'nodeLabel'] as const;
    for (const channel of nodeChannels) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (ch?.field && typeof ch.field === 'string' && !nodeFields.has(ch.field)) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist on nodes. Available fields: ${[...nodeFields].join(', ')}`,
          path: `encoding.${channel}.field`,
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the node fields: ${[...nodeFields].join(', ')}`,
        });
      }
    }

    const edgeChannels = ['edgeColor', 'edgeWidth'] as const;
    for (const channel of edgeChannels) {
      const ch = encoding[channel] as Record<string, unknown> | undefined;
      if (ch?.field && typeof ch.field === 'string' && firstEdge && !edgeFields.has(ch.field)) {
        errors.push({
          message: `Spec error: encoding.${channel}.field "${ch.field}" does not exist on edges. Available fields: ${[...edgeFields].join(', ')}`,
          path: `encoding.${channel}.field`,
          code: 'DATA_FIELD_MISSING',
          suggestion: `Use one of the edge fields: ${[...edgeFields].join(', ')}`,
        });
      }
    }
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
  // - Chart specs have a 'mark' field (string or object with type property)
  // - Table specs have type: 'table'
  // - Graph specs have type: 'graph'
  const hasMark = 'mark' in obj;
  const isTable = obj.type === 'table';
  const isGraph = obj.type === 'graph';
  const isChart = hasMark && !isTable && !isGraph;

  if (!isChart && !isTable && !isGraph) {
    return {
      valid: false,
      errors: [
        {
          message:
            'Spec error: spec must have a "mark" field for charts or a "type" field for tables/graphs',
          path: 'mark',
          code: 'MISSING_FIELD',
          suggestion: `Add a "mark" field for charts (e.g. mark: "bar") or a "type" field for tables/graphs (type: "table" or type: "graph"). Valid mark types: ${[...MARK_TYPES].join(', ')}`,
        },
      ],
      normalized: null,
    };
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
