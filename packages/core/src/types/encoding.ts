/**
 * Per-mark-type encoding validation rules.
 *
 * Defines which encoding channels are required vs optional for each mark type.
 * The engine compiler uses these rules to validate specs at runtime (TypeScript
 * catches compile-time errors; these catch runtime JSON from Claude or APIs).
 */

import type { FieldType, MarkType } from './spec';

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
  x2?: ChannelRule;
  y2?: ChannelRule;
  color: ChannelRule;
  size: ChannelRule;
  shape?: ChannelRule;
  opacity?: ChannelRule;
  strokeDash?: ChannelRule;
  text?: ChannelRule;
  tooltip?: ChannelRule;
  href?: ChannelRule;
  order?: ChannelRule;
  theta?: ChannelRule;
  radius?: ChannelRule;
  detail: ChannelRule;
}

// ---------------------------------------------------------------------------
// Mark encoding rules
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
 * Encoding rules per mark type.
 *
 * Defines which channels are required and what field types they accept.
 * The compiler uses this map to validate user specs at runtime.
 *
 * Key design decisions:
 * - line/area: x is temporal/ordinal (the axis), y is quantitative (the value)
 * - bar: covers both horizontal and vertical orientations, so both axes accept
 *   all relevant types. The engine validates the combination later (one axis
 *   must be quantitative).
 * - arc: no x axis; y is the value (quantitative), color is the category
 * - circle: y is the category, x is quantitative
 * - point: both axes are quantitative
 * - text/rule: fully optional positioning
 * - tick/rect: both axes required, any type
 */
export const MARK_ENCODING_RULES: Record<MarkType, EncodingRule> = {
  bar: {
    x: required('quantitative', 'nominal', 'ordinal', 'temporal'),
    y: required('quantitative', 'nominal', 'ordinal'),
    x2: optional('quantitative'),
    y2: optional('quantitative'),
    color: optional('nominal', 'ordinal', 'quantitative'),
    size: optional(),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
  line: {
    x: required('temporal', 'ordinal'),
    y: required('quantitative'),
    color: optional('nominal', 'ordinal', 'quantitative'),
    size: optional(),
    opacity: optional('quantitative'),
    strokeDash: optional('nominal', 'ordinal'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
  area: {
    x: required('temporal', 'ordinal'),
    y: required('quantitative'),
    y2: optional('quantitative'),
    color: optional('nominal', 'ordinal', 'quantitative'),
    size: optional(),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
  point: {
    x: required('quantitative', 'temporal', 'nominal', 'ordinal'),
    y: required('quantitative', 'temporal', 'nominal', 'ordinal'),
    color: optional('nominal', 'ordinal', 'quantitative'),
    size: optional('quantitative'),
    shape: optional('nominal', 'ordinal'),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
  circle: {
    x: required('quantitative'),
    y: required('nominal', 'ordinal'),
    color: optional('nominal', 'ordinal', 'quantitative'),
    size: optional('quantitative'),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
  lollipop: {
    x: required('quantitative'),
    y: required('nominal', 'ordinal'),
    color: optional('nominal', 'ordinal', 'quantitative'),
    size: optional('quantitative'),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
  arc: {
    x: optional(),
    y: required('quantitative'),
    color: required('nominal', 'ordinal'),
    size: optional(),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    theta: optional('quantitative'),
    radius: optional('quantitative'),
    detail: optional('nominal'),
  },
  text: {
    x: optional(),
    y: optional(),
    color: optional(),
    size: optional('quantitative'),
    opacity: optional('quantitative'),
    text: required(),
    tooltip: optional(),
    href: optional(),
    detail: optional('nominal'),
  },
  rule: {
    x: optional(),
    y: optional(),
    x2: optional(),
    y2: optional(),
    color: optional(),
    size: optional(),
    opacity: optional('quantitative'),
    strokeDash: optional('nominal', 'ordinal'),
    tooltip: optional(),
    href: optional(),
    detail: optional('nominal'),
  },
  tick: {
    x: required(),
    y: required(),
    color: optional(),
    size: optional(),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    detail: optional('nominal'),
  },
  rect: {
    x: required(),
    y: required(),
    x2: optional(),
    y2: optional(),
    color: optional(),
    size: optional(),
    opacity: optional('quantitative'),
    tooltip: optional(),
    href: optional(),
    order: optional('quantitative', 'ordinal'),
    detail: optional('nominal'),
  },
};

/** @deprecated Use MARK_ENCODING_RULES instead. */
export const CHART_ENCODING_RULES = MARK_ENCODING_RULES;

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
