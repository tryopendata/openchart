/**
 * Pre-validation spec sugar expansion.
 *
 * Accepts common Vega-Lite idioms alongside the canonical openchart forms and
 * rewrites them into canonical shape BEFORE validateSpec runs (validation
 * hard-rejects the VL forms, so sugar placed later would be dead code):
 *
 * - `data: { values: [...] }` unwraps to the bare array
 * - top-level `title` / `subtitle` expand into `chrome` (chrome wins on conflict)
 * - top-level `description` folds into `a11y.description` (a11y wins on conflict)
 * - bare value defs (`color/size/opacity: { value }`) move to mark-level props
 * - channel-level `legend: null | config` on color merges into the top-level legend
 * - `axis: null` becomes `axis: false`
 * - `scale: { scheme }` resolves to `scale.range` via the core palette registry
 * - `theta` acts as the arc value channel when `y` is absent (VL pie idiom)
 * - `aggregate: 'count'` without a field desugars to an aggregate transform
 * - VL sort forms (`'-y'`, value arrays, `{ field, op, order }`) resolve to an
 *   explicit categorical `scale.domain`
 * - encoding-level `bin` / `timeUnit` desugar to transforms (expandEncodingSugar)
 *
 * It also emits deprecation warnings for spec surface scheduled for removal in
 * v8 (`radius`, `shape`, `href`, `order`, the implicit multi-series bar/area
 * stack default) and strips or stamps the triggering forms so each one warns
 * exactly once per compile, even when layer leaves are re-expanded.
 *
 * Applied to top-level chart specs (compileChart) and to LayerSpec children
 * (compileLayer) so every sugar works inside layers too.
 */

import type {
  AggregateOp,
  AggregateTransform,
  BinParams,
  BinTransform,
  DataRow,
  EncodingChannel,
  TimeUnit,
  TimeUnitTransform,
  Transform,
} from '@opendata-ai/openchart-core';
import { inferFieldType, resolveSchemeName } from '@opendata-ai/openchart-core';
import { computeAggregate } from '../transforms/aggregate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the mark type string from a raw (unvalidated) spec. */
function markTypeOf(spec: Record<string, unknown>): string | undefined {
  const mark = spec.mark;
  if (typeof mark === 'string') return mark;
  if (mark && typeof mark === 'object' && !Array.isArray(mark)) {
    return (mark as Record<string, unknown>).type as string | undefined;
  }
  return undefined;
}

/** Unique string values of a data column, in data order, skipping nulls. */
function uniqueFieldStrings(data: DataRow[], field: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const raw = row[field];
    if (raw == null) continue;
    const key = String(raw);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Encoding sugar expansion (bin, timeUnit on encoding channels)
// ---------------------------------------------------------------------------

/**
 * Expand encoding-level `bin` and `timeUnit` shorthand into explicit transforms.
 *
 * Vega-Lite allows `encoding.x.bin: true` as sugar for a BinTransform.
 * This function detects those shorthands, generates the corresponding transforms,
 * updates encoding field references to the output field names, and prepends the
 * transforms to the spec's transform array.
 *
 * Mutates nothing; returns a new spec object (shallow copy).
 */
export function expandEncodingSugar(spec: Record<string, unknown>): Record<string, unknown> {
  const encoding = spec.encoding as Record<string, EncodingChannel | undefined> | undefined;
  if (!encoding) return spec;

  const generatedTransforms: Transform[] = [];
  const updatedEncoding = { ...encoding };
  let changed = false;

  for (const channel of Object.keys(encoding)) {
    const ch = encoding[channel];
    if (!ch || !ch.field) continue;

    // Expand bin shorthand
    if (ch.bin != null && ch.bin !== false) {
      const field = ch.field;
      const outputField = `bin_${field}`;
      const binTransform: BinTransform = {
        bin: ch.bin === true ? true : (ch.bin as BinParams),
        field,
        as: outputField,
      };
      generatedTransforms.push(binTransform);

      // Update encoding to reference binned output field, remove bin property
      const { bin: _bin, ...rest } = ch;
      updatedEncoding[channel] = { ...rest, field: outputField } as EncodingChannel;
      changed = true;
    }

    // Expand timeUnit shorthand (read from updated encoding in case bin already ran)
    const current = updatedEncoding[channel] ?? ch;
    if (current.timeUnit) {
      const field = current.field;
      const unit = current.timeUnit as TimeUnit;
      const outputField = `${unit}_${field}`;
      const timeUnitTransform: TimeUnitTransform = {
        timeUnit: unit,
        field,
        as: outputField,
      };
      generatedTransforms.push(timeUnitTransform);

      // Update encoding to reference timeUnit output field, remove timeUnit property
      const { timeUnit: _tu, ...rest } = current;
      updatedEncoding[channel] = { ...rest, field: outputField } as EncodingChannel;
      changed = true;
    }
  }

  if (!changed) return spec;

  // Prepend generated transforms before any user-defined transforms
  const existingTransforms = (spec.transform as Transform[] | undefined) ?? [];
  return {
    ...spec,
    encoding: updatedEncoding,
    transform: [...generatedTransforms, ...existingTransforms],
  };
}

// ---------------------------------------------------------------------------
// Top-level sugar (data wrapper, title, ignored keys, fixed size)
// ---------------------------------------------------------------------------

/** Unwrap the VL `data: { values: [...] }` object form to a bare array. */
function unwrapDataValues(spec: Record<string, unknown>): Record<string, unknown> {
  const data = spec.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const values = (data as Record<string, unknown>).values;
    if (Array.isArray(values)) {
      return { ...spec, data: values };
    }
  }
  return spec;
}

/**
 * Expand the VL top-level `title` (string or `{ text, subtitle }`) and
 * `subtitle` into `chrome`. Authored chrome keys win on conflict. Runs before
 * breakpoint overrides are applied, so a per-breakpoint `overrides.<bp>.chrome`
 * replaces the expanded chrome exactly as it replaces authored chrome.
 */
function expandTopLevelTitle(spec: Record<string, unknown>): Record<string, unknown> {
  if (spec.title === undefined && spec.subtitle === undefined) return spec;

  const expanded: Record<string, unknown> = {};
  const title = spec.title;
  if (typeof title === 'string') {
    expanded.title = title;
  } else if (title && typeof title === 'object' && !Array.isArray(title)) {
    const t = title as { text?: unknown; subtitle?: unknown };
    if (typeof t.text === 'string') expanded.title = t.text;
    if (typeof t.subtitle === 'string') expanded.subtitle = t.subtitle;
  }
  if (typeof spec.subtitle === 'string') expanded.subtitle = spec.subtitle;

  const { title: _title, subtitle: _subtitle, ...rest } = spec;
  const chrome =
    spec.chrome && typeof spec.chrome === 'object' ? (spec.chrome as Record<string, unknown>) : {};
  return { ...rest, chrome: { ...expanded, ...chrome } };
}

/**
 * Fold the top-level `description` (VL's alt-text field) into
 * `a11y.description`. An authored `a11y.description` wins on conflict.
 */
function expandDescriptionSugar(spec: Record<string, unknown>): Record<string, unknown> {
  if (typeof spec.description !== 'string') return spec;
  const { description, ...rest } = spec;
  const a11y =
    spec.a11y && typeof spec.a11y === 'object' ? (spec.a11y as Record<string, unknown>) : {};
  return { ...rest, a11y: { description, ...a11y } };
}

/** Keys accepted for VL compatibility but ignored; warned once and stripped. */
function stripIgnoredKeys(
  spec: Record<string, unknown>,
  warnings: string[],
): Record<string, unknown> {
  if (!('$schema' in spec)) return spec;
  warnings.push(
    '[openchart] "$schema" is accepted for Vega-Lite compatibility but ignored; it can be removed.',
  );
  const { $schema: _schema, ...rest } = spec;
  return rest;
}

/**
 * Fixed-size specs (both `width` and `height` set) imply `responsive: false`
 * unless the user set `responsive` explicitly. The width/height override
 * itself is applied by compileChart/compileLayer on the compile options.
 */
function applyFixedSizeDefault(spec: Record<string, unknown>): Record<string, unknown> {
  if (
    typeof spec.width === 'number' &&
    typeof spec.height === 'number' &&
    spec.responsive === undefined
  ) {
    return { ...spec, responsive: false };
  }
  return spec;
}

// ---------------------------------------------------------------------------
// Channel-level sugar (value defs, legend, axis null, scheme, theta, dead channels)
// ---------------------------------------------------------------------------

/** Channels declared in the spec types with zero engine implementation, warned and stripped. */
const DEAD_CHANNEL_MESSAGES: Record<string, string> = {
  radius:
    '[openchart] encoding.radius is not implemented (silently ignored) and will be removed in v8. Use mark.innerRadius / mark.outerRadius to control donut radii.',
  shape:
    '[openchart] encoding.shape is not implemented (silently ignored) and will be removed in v8. Differentiate series with encoding.color or encoding.strokeDash instead.',
  href: '[openchart] encoding.href is not implemented (silently ignored) and will be removed in v8. Handle link navigation in the host application instead.',
  order:
    '[openchart] encoding.order is not implemented (silently ignored) and will be removed in v8. Use encoding.<channel>.sort or pre-sorted data order instead.',
};

/**
 * Expand channel-level VL sugar. Mark-dependent sugar (value defs, theta) only
 * runs when the spec has a mark, so the same function works on the shared
 * encoding of a LayerSpec (which resolves those per leaf instead).
 */
function expandChannelSugar(
  spec: Record<string, unknown>,
  warnings: string[],
): Record<string, unknown> {
  const encoding = spec.encoding as Record<string, unknown> | undefined;
  if (!encoding || typeof encoding !== 'object') return spec;

  const markType = markTypeOf(spec);
  const updated: Record<string, unknown> = { ...encoding };
  let changed = false;
  let markExtra: Record<string, unknown> | undefined;
  let legendMerge: Record<string, unknown> | undefined;

  // Bare value defs (VL `color: { value }`) -> mark-level properties
  if (markType) {
    for (const channel of ['color', 'size', 'opacity'] as const) {
      const ch = updated[channel] as Record<string, unknown> | undefined;
      if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;
      if (!('value' in ch) || 'condition' in ch || 'field' in ch) continue;
      const value = ch.value;
      markExtra = markExtra ?? {};
      if (channel === 'color') {
        // Lines carry their color on stroke; every other mark family fills.
        if (markType === 'line' && typeof value === 'string') markExtra.stroke = value;
        else markExtra.fill = value;
      } else if (typeof value === 'number') {
        markExtra[channel] = value;
      }
      delete updated[channel];
      changed = true;
    }
  }

  // Channel-level legend on color: `null` hides, a config merges (VL idiom)
  const colorCh = updated.color as Record<string, unknown> | undefined;
  if (
    colorCh &&
    typeof colorCh === 'object' &&
    'legend' in colorCh &&
    colorCh.legend !== undefined
  ) {
    legendMerge =
      colorCh.legend === null ? { show: false } : (colorCh.legend as Record<string, unknown>);
    const { legend: _legend, ...rest } = colorCh;
    updated.color = rest;
    changed = true;
  }

  for (const channel of Object.keys(updated)) {
    const ch = updated[channel] as Record<string, unknown> | undefined;
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;

    // axis: null -> false (VL uses null to hide an axis)
    if (ch.axis === null) {
      updated[channel] = { ...ch, axis: false };
      changed = true;
    }

    // scale.scheme -> scale.range via the core palette registry. Unknown
    // names stay in place for validateSpec to reject with the supported
    // list. An explicit range wins over scheme.
    const current = updated[channel] as Record<string, unknown>;
    const scale = current.scale as Record<string, unknown> | undefined;
    if (scale && typeof scale.scheme === 'string') {
      const stops = resolveSchemeName(scale.scheme);
      if (stops) {
        const { scheme: _scheme, ...scaleRest } = scale;
        updated[channel] = { ...current, scale: { ...scaleRest, range: scale.range ?? stops } };
        changed = true;
      }
    }
  }

  // theta: VL's arc value channel, shared by waffle and parliament marks (the
  // same part-to-whole value). Alias for y when y is absent; ignored (with a
  // warning) when y is present. Canonical in v8.
  if (markType && updated.theta && typeof updated.theta === 'object') {
    const thetaMark = markType === 'arc' || markType === 'waffle' || markType === 'parliament';
    if (thetaMark && !updated.y) {
      updated.y = updated.theta;
    } else if (markType === 'arc') {
      warnings.push(
        '[openchart] encoding.theta is ignored when encoding.y is present on an arc mark; encoding.y wins. theta becomes the canonical arc value channel in v8.',
      );
    } else if (markType === 'waffle') {
      warnings.push(
        '[openchart] encoding.theta is ignored when encoding.y is present on a waffle mark; encoding.y wins.',
      );
    } else if (markType === 'parliament') {
      warnings.push(
        '[openchart] encoding.theta is ignored when encoding.y is present on a parliament mark; encoding.y wins.',
      );
    } else {
      warnings.push(
        '[openchart] encoding.theta is only meaningful on arc, waffle, and parliament marks and was ignored.',
      );
    }
    delete updated.theta;
    changed = true;
  }

  // Parliament: party colors carry real-world meaning (red/blue for US parties)
  // and should never be left to the auto-cycling categorical palette. Nudge the
  // author toward an explicit color scale range when none is set. Warning only,
  // so the chart still renders (with palette colors) if they ignore it.
  if (markType === 'parliament') {
    const parliamentColor = updated.color as Record<string, unknown> | undefined;
    const scale = parliamentColor?.scale as Record<string, unknown> | undefined;
    const hasExplicitColors = Array.isArray(scale?.range) && (scale.range as unknown[]).length > 0;
    if (parliamentColor && 'field' in parliamentColor && !hasExplicitColors) {
      warnings.push(
        '[openchart] parliament chart is using auto-palette colors. Party colors carry meaning; set them explicitly via encoding.color.scale.range (in party order), e.g. color: { field: "party", scale: { range: ["#1b7fa3", "#c44e52"] } }.',
      );
    }
  }

  // Dead channels: warn once and strip (behavior-identical; the engine ignores them)
  for (const channel of Object.keys(DEAD_CHANNEL_MESSAGES)) {
    if (updated[channel] !== undefined) {
      warnings.push(DEAD_CHANNEL_MESSAGES[channel]);
      delete updated[channel];
      changed = true;
    }
  }

  if (!changed) return spec;

  const result: Record<string, unknown> = { ...spec, encoding: updated };
  if (markExtra) {
    const markDef =
      typeof spec.mark === 'string'
        ? { type: spec.mark }
        : { ...(spec.mark as Record<string, unknown>) };
    // Explicit mark-level values win over expanded channel constants
    result.mark = { ...markExtra, ...markDef };
  }
  if (legendMerge) {
    // Top-level legend keys win over the channel-level config
    result.legend = { ...legendMerge, ...(spec.legend as Record<string, unknown> | undefined) };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Count aggregate without a field (VL histogram idiom)
// ---------------------------------------------------------------------------

/** Channels whose fields group the count aggregate (mirrors VL's implicit groupby). */
const COUNT_GROUP_CHANNELS = ['x', 'y', 'color', 'detail', 'strokeDash', 'facet'] as const;

/**
 * Desugar `{ aggregate: 'count' }` (no field) on x/y into an explicit
 * aggregate transform grouped by the other encoded fields, rewriting the
 * channel to the `__count` output field (VL's own convention). Runs after
 * bin/timeUnit expansion so binned fields participate in the groupby, and the
 * transform is appended after user transforms so it counts filtered rows.
 */
function expandCountAggregate(spec: Record<string, unknown>): Record<string, unknown> {
  const encoding = spec.encoding as Record<string, unknown> | undefined;
  if (!encoding || typeof encoding !== 'object') return spec;

  const updated: Record<string, unknown> = { ...encoding };
  let countTransform: AggregateTransform | undefined;

  for (const channel of ['x', 'y'] as const) {
    const ch = updated[channel] as Record<string, unknown> | undefined;
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;
    if (ch.aggregate !== 'count' || ch.field != null) continue;

    const groupby: string[] = [];
    for (const other of COUNT_GROUP_CHANNELS) {
      if (other === channel) continue;
      const otherCh = updated[other] as Record<string, unknown> | undefined;
      if (otherCh && typeof otherCh === 'object' && typeof otherCh.field === 'string') {
        if (!groupby.includes(otherCh.field)) groupby.push(otherCh.field);
      }
    }

    countTransform = { aggregate: [{ op: 'count', field: '__count', as: '__count' }], groupby };
    const { aggregate: _aggregate, ...rest } = ch;
    updated[channel] = {
      ...rest,
      field: '__count',
      type: ch.type ?? 'quantitative',
      title: ch.title ?? 'Count',
    };
  }

  if (!countTransform) return spec;
  const existing = (spec.transform as Transform[] | undefined) ?? [];
  return { ...spec, encoding: updated, transform: [...existing, countTransform] };
}

// ---------------------------------------------------------------------------
// Sort-by-value resolution (VL '-y', value arrays, { field, op, order })
// ---------------------------------------------------------------------------

/**
 * Resolve VL sort forms on categorical channels into an explicit
 * `scale.domain`, which the scale builders already honor. Canonical
 * 'ascending' / 'descending' / null pass through untouched. Skipped (and
 * retried at leaf compile) when the data is not yet known, e.g. layer
 * children inheriting parent data.
 */
function resolveSortSugar(
  spec: Record<string, unknown>,
  inheritedData?: DataRow[],
): Record<string, unknown> {
  const encoding = spec.encoding as Record<string, unknown> | undefined;
  if (!encoding || typeof encoding !== 'object') return spec;
  const data = (Array.isArray(spec.data) ? spec.data : inheritedData) as DataRow[] | undefined;

  const updated: Record<string, unknown> = { ...encoding };
  let changed = false;

  for (const channel of ['x', 'y', 'color'] as const) {
    const ch = updated[channel] as Record<string, unknown> | undefined;
    if (!ch || typeof ch !== 'object' || Array.isArray(ch) || !('sort' in ch)) continue;
    const sort = ch.sort;
    if (sort === undefined || sort === null || sort === 'ascending' || sort === 'descending') {
      continue;
    }

    const field = ch.field as string | undefined;
    const scale = (ch.scale ?? {}) as Record<string, unknown>;

    // An explicit domain wins over sort (matches canonical sort behavior)
    if (scale.domain) {
      const { sort: _sort, ...rest } = ch;
      updated[channel] = rest;
      changed = true;
      continue;
    }
    if (!field || !data || data.length === 0) continue;

    let domain: string[] | undefined;
    if (Array.isArray(sort)) {
      // Value-array sort: listed values first, remaining values in data order
      const present = uniqueFieldStrings(data, field);
      const listed = sort.map(String).filter((v) => present.includes(v));
      const rest = present.filter((v) => !listed.includes(v));
      domain = [...listed, ...rest];
    } else {
      // 'x' | '-x' | 'y' | '-y' or { field, op, order }
      let targetField: string | undefined;
      let op: AggregateOp = 'sum';
      let descending = false;
      let isCount = false;
      if (typeof sort === 'string' && /^-?[xy]$/.test(sort)) {
        descending = sort.startsWith('-');
        const target = updated[sort.replace('-', '')] as Record<string, unknown> | undefined;
        if (!target || typeof target !== 'object') continue;
        targetField = target.field as string | undefined;
        if (target.aggregate === 'count') isCount = true;
        else if (typeof target.aggregate === 'string') op = target.aggregate as AggregateOp;
      } else if (typeof sort === 'object' && 'field' in (sort as object)) {
        const s = sort as { field: string; op?: AggregateOp; order?: string };
        targetField = s.field;
        if (s.op === 'count') isCount = true;
        else if (s.op) op = s.op;
        descending = s.order === 'descending';
      } else {
        // Unknown sort shape: fall back to data order
        const { sort: _sort, ...rest } = ch;
        updated[channel] = rest;
        changed = true;
        continue;
      }
      if (!targetField && !isCount) continue;

      // Aggregate the target values per category (default op: sum, VL aligned)
      const groups = new Map<string, number[]>();
      for (const row of data) {
        const raw = row[field];
        if (raw == null) continue;
        const key = String(raw);
        let bucket = groups.get(key);
        if (!bucket) {
          bucket = [];
          groups.set(key, bucket);
        }
        if (isCount) {
          bucket.push(1);
        } else {
          const value = Number(row[targetField as string]);
          if (Number.isFinite(value)) bucket.push(value);
        }
      }
      const entries = [...groups.entries()].map(
        ([key, values]) => [key, computeAggregate(isCount ? 'count' : op, values)] as const,
      );
      entries.sort((a, b) => (descending ? b[1] - a[1] : a[1] - b[1]));
      domain = entries.map(([key]) => key);
    }

    if (!domain) continue;
    const { sort: _sort, ...rest } = ch;
    updated[channel] = { ...rest, scale: { ...scale, domain } };
    changed = true;
  }

  return changed ? { ...spec, encoding: updated } : spec;
}

// ---------------------------------------------------------------------------
// Stack-default deprecation warning (v8 realigns with VL)
// ---------------------------------------------------------------------------

const STACK_DEFAULT_WARNING =
  "[openchart] The implicit default for multi-series bar/area charts (grouped/overlap) changes to stacked in v8. Set stack explicitly on the value channel: null keeps grouped/overlap, 'zero' opts into stacking.";

/**
 * Warn when a multi-series bar/area chart relies on the implicit stack
 * default that flips in v8, then stamp the current default (`stack: null`)
 * explicitly. The stamp is behavior-identical today (undefined and null both
 * mean grouped/overlap) and keeps the warning to one per compile when layer
 * leaves are re-expanded.
 */
function warnStackDefault(
  spec: Record<string, unknown>,
  warnings: string[],
  inheritedData?: DataRow[],
  parentEncoding?: Record<string, unknown>,
): Record<string, unknown> {
  const markType = markTypeOf(spec);
  if (markType !== 'bar' && markType !== 'area') return spec;

  const ownEncoding = (spec.encoding ?? {}) as Record<string, unknown>;
  const merged = parentEncoding ? { ...parentEncoding, ...ownEncoding } : ownEncoding;
  const color = merged.color as Record<string, unknown> | undefined;
  if (!color || typeof color !== 'object' || typeof color.field !== 'string') return spec;
  const x = merged.x as Record<string, unknown> | undefined;
  const y = merged.y as Record<string, unknown> | undefined;
  if (!x || !y || typeof x.field !== 'string' || typeof y.field !== 'string') return spec;
  if (x.stack !== undefined || y.stack !== undefined) return spec;

  const data = (Array.isArray(spec.data) ? spec.data : inheritedData) as DataRow[] | undefined;
  if (!data || data.length === 0) return spec;

  // Sequential (quantitative) color is not a series grouping; no stacking applies
  const colorType = (color.type as string | undefined) ?? inferFieldType(data, color.field);
  if (colorType === 'quantitative') return spec;

  // The default only matters when some category holds multiple rows. The
  // category axis is x for area/vertical bar and y for horizontal bar.
  const xType = (x.type as string | undefined) ?? inferFieldType(data, x.field);
  const yType = (y.type as string | undefined) ?? inferFieldType(data, y.field);
  let catField: string | undefined;
  if (markType === 'area') catField = x.field;
  else if (yType === 'quantitative') catField = x.field;
  else if (xType === 'quantitative') catField = y.field;
  if (!catField) return spec;

  const seen = new Set<string>();
  let hasDuplicates = false;
  for (const row of data) {
    const raw = row[catField];
    if (raw == null) continue;
    const key = String(raw);
    if (seen.has(key)) {
      hasDuplicates = true;
      break;
    }
    seen.add(key);
  }
  if (!hasDuplicates) return spec;

  warnings.push(STACK_DEFAULT_WARNING);
  const valueKey = catField === x.field ? 'y' : 'x';
  const valueCh = merged[valueKey] as Record<string, unknown>;
  return { ...spec, encoding: { ...ownEncoding, [valueKey]: { ...valueCh, stack: null } } };
}

// ---------------------------------------------------------------------------
// Composition: chart and layer expansion
// ---------------------------------------------------------------------------

function expandChartSugar(
  spec: Record<string, unknown>,
  warnings: string[],
  inheritedData?: DataRow[],
  parentEncoding?: Record<string, unknown>,
): Record<string, unknown> {
  let out = unwrapDataValues(spec);
  out = expandTopLevelTitle(out);
  out = expandDescriptionSugar(out);
  out = stripIgnoredKeys(out, warnings);
  out = applyFixedSizeDefault(out);
  out = expandChannelSugar(out, warnings);
  out = expandEncodingSugar(out);
  out = resolveSortSugar(out, inheritedData);
  out = expandCountAggregate(out);
  out = warnStackDefault(out, warnings, inheritedData, parentEncoding);
  return out;
}

function expandLayerSugar(
  spec: Record<string, unknown>,
  warnings: string[],
  inheritedData?: DataRow[],
  parentEncoding?: Record<string, unknown>,
): Record<string, unknown> {
  let out = unwrapDataValues(spec);
  out = expandTopLevelTitle(out);
  out = stripIgnoredKeys(out, warnings);
  // Shared encoding gets the mark-independent channel sugar (axis, scheme,
  // legend, dead channels) and sort resolution; mark-dependent sugar (value
  // defs, theta) resolves per leaf after encoding inheritance.
  out = expandChannelSugar(out, warnings);
  out = resolveSortSugar(out, inheritedData);

  const layerData = Array.isArray(out.data) ? (out.data as DataRow[]) : inheritedData;
  const ownEncoding = out.encoding as Record<string, unknown> | undefined;
  const mergedEncoding =
    parentEncoding && ownEncoding
      ? { ...parentEncoding, ...ownEncoding }
      : (ownEncoding ?? parentEncoding);

  const layer = out.layer as unknown[];
  const expandedChildren = layer.map((child) => {
    if (!child || typeof child !== 'object' || Array.isArray(child)) return child;
    const childObj = child as Record<string, unknown>;
    if (Array.isArray(childObj.layer)) {
      return expandLayerSugar(childObj, warnings, layerData, mergedEncoding);
    }
    if ('mark' in childObj) {
      return expandChartSugar(childObj, warnings, layerData, mergedEncoding);
    }
    return child;
  });
  return { ...out, layer: expandedChildren };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand VL-idiom and encoding-level sugar on a raw chart or layer spec.
 * Non-chart specs (tables, graphs, sankey, tilemap, barlist) pass through
 * unchanged. Deprecation warnings are pushed onto `warnings`; callers surface
 * them (compileChart/compileLayer console.warn each unique message once per
 * compile).
 */
export function expandSpecSugar(
  spec: Record<string, unknown>,
  warnings: string[] = [],
): Record<string, unknown> {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec;
  if (Array.isArray(spec.layer) && typeof spec.type !== 'string') {
    return expandLayerSugar(spec, warnings);
  }
  if (!('mark' in spec)) return spec;
  return expandChartSugar(spec, warnings);
}

/** Advisory-warning sink: a host callback, or the console.warn default. */
export type WarnSink = (message: string) => void;

const defaultWarnSink: WarnSink = (message) => console.warn(message);

/**
 * Surface sugar/deprecation warnings: emit each unique message once per compile.
 * Duplicates within a compile (e.g. the same dead channel on two layer children)
 * collapse to one warning.
 *
 * The engine is isomorphic and never touches the global `console` on its own:
 * `sink` is the host-provided `CompileOptions.onWarn` when present, so a host can
 * collect, reroute, or silence warnings (SSR, tests, dev overlays). It falls back
 * to `console.warn` only when no sink is passed, preserving the prior behavior.
 */
export function emitSpecWarnings(warnings: string[], sink: WarnSink = defaultWarnSink): void {
  if (warnings.length === 0) return;
  const seen = new Set<string>();
  for (const warning of warnings) {
    if (seen.has(warning)) continue;
    seen.add(warning);
    sink(warning);
  }
}
