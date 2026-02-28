/**
 * Per-chart-type encoding validation rules.
 *
 * Defines which encoding channels are required vs optional for each chart type.
 * The engine compiler uses these rules to validate specs at runtime (TypeScript
 * catches compile-time errors; these catch runtime JSON from Claude or APIs).
 */

import type { ChartType, FieldType } from './spec';

// ---------------------------------------------------------------------------
// Encoding rule types
// ---------------------------------------------------------------------------

/** Constraint on what field types are valid for an encoding channel. */
export interface ChannelRule {
  /** Whether this channel is required for the chart type. */
  required: boolean;
  /** Allowed field types. If empty, any field type is accepted. */
  allowedTypes: FieldType[];
}

/** Encoding rules for a single chart type: which channels are required/optional. */
export interface EncodingRule {
  x: ChannelRule;
  y: ChannelRule;
  color: ChannelRule;
  size: ChannelRule;
  detail: ChannelRule;
}

// ---------------------------------------------------------------------------
// Chart encoding rules
// ---------------------------------------------------------------------------

/** Helper to create a required channel rule. */
function required(...types: FieldType[]): ChannelRule {
  return { required: true, allowedTypes: types };
}

/** Helper to create an optional channel rule. */
function optional(...types: FieldType[]): ChannelRule {
  return { required: false, allowedTypes: types };
}

/**
 * Encoding rules per chart type.
 *
 * Defines which channels are required and what field types they accept.
 * The compiler uses this map to validate user specs at runtime.
 *
 * Key design decisions:
 * - line/area: x is temporal/ordinal (the axis), y is quantitative (the value)
 * - bar: horizontal bars, so y is the category axis, x is the value
 * - column: vertical columns, so x is the category axis, y is the value
 * - pie/donut: no x axis; y is the value (quantitative), color is the category
 * - dot: y is the category, x is quantitative
 * - scatter: both axes are quantitative
 */
export const CHART_ENCODING_RULES: Record<ChartType, EncodingRule> = {
  line: {
    x: required('temporal', 'ordinal'),
    y: required('quantitative'),
    color: optional('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  area: {
    x: required('temporal', 'ordinal'),
    y: required('quantitative'),
    color: optional('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  bar: {
    x: required('quantitative'),
    y: required('nominal', 'ordinal'),
    color: optional('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  column: {
    x: required('nominal', 'ordinal', 'temporal'),
    y: required('quantitative'),
    color: optional('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  pie: {
    x: optional(),
    y: required('quantitative'),
    color: required('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  donut: {
    x: optional(),
    y: required('quantitative'),
    color: required('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  dot: {
    x: required('quantitative'),
    y: required('nominal', 'ordinal'),
    color: optional('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
  scatter: {
    x: required('quantitative'),
    y: required('quantitative'),
    color: optional('nominal', 'ordinal'),
    size: optional('quantitative'),
    detail: optional('nominal'),
  },
};

// ---------------------------------------------------------------------------
// Graph encoding rules
// ---------------------------------------------------------------------------

/** Encoding rule for a single graph visual channel. */
export interface GraphChannelRule {
  /** Whether this channel is required. */
  required: boolean;
  /** Allowed field types. Empty means any type. */
  allowedTypes: FieldType[];
}

/**
 * Encoding rules for graph visualizations.
 *
 * All graph encoding channels are optional since a graph can be rendered
 * with just nodes and edges (uniform appearance). Encoding channels add
 * visual differentiation based on data fields.
 */
export const GRAPH_ENCODING_RULES: Record<string, GraphChannelRule> = {
  nodeColor: { required: false, allowedTypes: ['nominal', 'ordinal'] },
  nodeSize: { required: false, allowedTypes: ['quantitative'] },
  edgeColor: { required: false, allowedTypes: ['nominal', 'ordinal'] },
  edgeWidth: { required: false, allowedTypes: ['quantitative'] },
  nodeLabel: { required: false, allowedTypes: [] },
};
