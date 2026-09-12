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
 * - `theta` is the canonical arc/waffle/parliament value channel in v8; `y` on
 *   those marks is a deprecated alias, expanded into `theta` (and vice versa,
 *   since the engine still reads `y` internally) with a warning
 * - annotation `type: 'rule'` is a deprecated alias for `'refline'`
 * - `aggregate: 'count'` without a field desugars to an aggregate transform
 * - VL sort forms (`'-y'`, value arrays, `{ field, op, order }`) resolve to an
 *   explicit categorical `scale.domain`
 * - encoding-level `bin` / `timeUnit` desugar to transforms (expandEncodingSugar)
 *
 * It also emits deprecation warnings for spec surface removed in v8
 * (`radius`, `shape`, `href`, `order`) and strips the triggering forms so
 * each one warns exactly once per compile, even when layer leaves are
 * re-expanded.
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
export function expandEncodingSugar(
  spec: Record<string, unknown>,
  inheritedData?: DataRow[],
): Record<string, unknown> {
  const encoding = spec.encoding as Record<string, EncodingChannel | undefined> | undefined;
  if (!encoding) return spec;

  const markType = markTypeOf(spec);
  const specData = (Array.isArray(spec.data) ? spec.data : inheritedData) as DataRow[] | undefined;
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
      // A histogram bar needs the bin's *width*, which means both edges. Emit
      // the pair (VL's own `bin_x` / `bin_x_end` naming) and wire the end onto
      // x2, which is what dispatches the binned-bar renderer downstream.
      //
      // All three conditions are load-bearing. Only `bar` (and `range`, `rect`,
      // `rule`) declare x2 in MARK_ENCODING_RULES, and the published schema is
      // `additionalProperties: false`, so stamping x2 onto a binned `point`
      // spec would emit a spec the schema rejects. An ordinal binned channel
      // keeps a band scale and the existing bar path. The `y` channel is
      // excluded because the horizontal (y-binned) histogram doesn't exist yet.
      // The channel type is usually explicit, but it's inferred later in the
      // pipeline when omitted, and this runs before that. Infer it here too,
      // or the canonical histogram spelling with no `type` silently falls
      // through to a band scale whose labels are raw bin edges.
      const resolvedType =
        ch.type ?? (specData && specData.length > 0 ? inferFieldType(specData, field) : undefined);
      const emitInterval = channel === 'x' && resolvedType === 'quantitative' && markType === 'bar';
      const endField = `${outputField}_end`;
      const binTransform: BinTransform = {
        bin: ch.bin === true ? true : (ch.bin as BinParams),
        field,
        as: emitInterval ? [outputField, endField] : outputField,
      };
      generatedTransforms.push(binTransform);

      // Update encoding to reference binned output field, remove bin property
      const { bin: _bin, ...rest } = ch;
      updatedEncoding[channel] = {
        ...rest,
        field: outputField,
        // The axis should read `amount`, not `bin_amount`. Scoped to the same
        // guard: retitling every binned channel would move existing baselines.
        ...(emitInterval && rest.title == null ? { title: field } : {}),
      } as EncodingChannel;
      if (emitInterval) {
        updatedEncoding.x2 = { field: endField, type: 'quantitative' } as EncodingChannel;
      }
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
 * `mark.render` was removed in v8: backend selection is host policy, passed as
 * the `renderer` compile/mount option (mirroring vega-embed). Warned once and
 * stripped so pre-v8 specs keep compiling.
 */
function stripRemovedMarkRender(
  spec: Record<string, unknown>,
  warnings: string[],
): Record<string, unknown> {
  const mark = spec.mark;
  if (!mark || typeof mark !== 'object' || Array.isArray(mark)) return spec;
  if (!('render' in mark)) return spec;
  warnings.push(
    '[openchart] mark.render was removed in v8. This field is stripped for backward compatibility. Pass { renderer } to createChart() or the compile options instead.',
  );
  const { render: _render, ...restMark } = mark as Record<string, unknown>;
  return { ...spec, mark: restMark };
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

/**
 * Rewrite the deprecated annotation `type: 'rule'` to the canonical
 * `'refline'` (they collide with the `rule` mark type otherwise). Runs before
 * validation so the canonical form is all validation/normalization ever sees.
 */
function expandAnnotationSugar(
  spec: Record<string, unknown>,
  warnings: string[],
): Record<string, unknown> {
  const annotations = spec.annotations;
  if (!Array.isArray(annotations) || annotations.length === 0) return spec;

  let changed = false;
  const updated = annotations.map((ann) => {
    if (ann && typeof ann === 'object' && (ann as Record<string, unknown>).type === 'rule') {
      warnings.push("[openchart] annotation type 'rule' is deprecated; use 'refline'.");
      changed = true;
      return { ...(ann as Record<string, unknown>), type: 'refline' };
    }
    return ann;
  });

  return changed ? { ...spec, annotations: updated } : spec;
}

// ---------------------------------------------------------------------------
// Channel-level sugar (value defs, legend, axis null, scheme, theta, dead channels)
// ---------------------------------------------------------------------------

/** Channels declared in the spec types with zero engine implementation, warned and stripped. */
const DEAD_CHANNEL_MESSAGES: Record<string, string> = {
  radius:
    '[openchart] encoding.radius was removed in v8. This channel is stripped for backward compatibility. Use mark.innerRadius / mark.outerRadius to control donut radii.',
  shape:
    '[openchart] encoding.shape was removed in v8. This channel is stripped for backward compatibility. Differentiate series with encoding.color or encoding.strokeDash instead.',
  href: '[openchart] encoding.href was removed in v8. This channel is stripped for backward compatibility. Handle link navigation in the host application instead.',
  order:
    '[openchart] encoding.order was removed in v8. This channel is stripped for backward compatibility. Use encoding.<channel>.sort or pre-sorted data order instead.',
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

    // scale.reverse on the color channel flips the ramp here, at the one place
    // the stops are known. The color scale builders read scale.range directly
    // and never look at reverse (only the positional builders do), so reversing
    // the range is what makes `reverse` mean anything on color -- and it keeps
    // the legend, which resolves its ramp from the same scale.range, in step.
    // Positional channels keep their reverse flag for buildBand/Point/Continuous.
    if (channel === 'color') {
      const colorDef = updated[channel] as Record<string, unknown>;
      const colorScale = colorDef.scale as Record<string, unknown> | undefined;
      if (colorScale?.reverse && Array.isArray(colorScale.range)) {
        const { reverse: _reverse, ...scaleRest } = colorScale;
        updated[channel] = {
          ...colorDef,
          scale: { ...scaleRest, range: [...(colorScale.range as string[])].reverse() },
        };
        changed = true;
      }
    }
  }

  // theta: the canonical arc value channel in v8, shared by waffle and
  // parliament marks (the same part-to-whole value). The engine still reads
  // encoding.y internally, so both directions of the alias converge on y:
  // - theta present -> y is populated from theta (theta wins if both are set,
  //   since it's canonical now)
  // - only y present -> y is kept and theta is populated from it, with a
  //   deprecation warning nudging authors toward theta
  if (markType && (updated.theta || updated.y)) {
    const thetaMark = markType === 'arc' || markType === 'waffle' || markType === 'parliament';
    const hasTheta = updated.theta && typeof updated.theta === 'object';
    const hasY = updated.y && typeof updated.y === 'object';
    if (thetaMark && hasTheta) {
      if (hasY && JSON.stringify(updated.y) !== JSON.stringify(updated.theta)) {
        warnings.push(
          `[openchart] encoding.theta and encoding.y are both set on ${markType}; theta takes precedence and y was dropped.`,
        );
      }
      updated.y = updated.theta;
      changed = true;
    } else if (thetaMark && hasY && !hasTheta) {
      updated.theta = updated.y;
      warnings.push(
        `[openchart] encoding.y on ${markType} marks is deprecated in v8; use encoding.theta for the value channel.`,
      );
      changed = true;
    } else if (hasTheta && !thetaMark) {
      warnings.push(
        '[openchart] encoding.theta is only meaningful on arc, waffle, and parliament marks and was ignored.',
      );
      delete updated.theta;
      changed = true;
    }
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
const COUNT_GROUP_CHANNELS = [
  'x',
  'x2',
  'y',
  'y2',
  'color',
  'detail',
  'strokeDash',
  'facet',
  'row',
  'column',
] as const;

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
// Distribution mark sugar (histogram, density)
// ---------------------------------------------------------------------------

/** Default bin count for `mark: 'histogram'`. */
const HISTOGRAM_DEFAULT_MAXBINS = 20;

/** Output field the normalize pass writes each group's share into. */
const PROPORTION_FIELD = '__proportion';
/** Output field the normalize pass writes each group's total into. */
const GROUP_TOTAL_FIELD = '__group_total';

/**
 * Desugar `mark: 'histogram'` into the canonical Vega-Lite form: a bar with a
 * binned quantitative x and a count aggregate on y.
 *
 * Must run BEFORE `expandEncodingSugar` and `expandCountAggregate` so the
 * `x.bin` and `y.aggregate` it writes are picked up by those passes. The
 * mark-level shorthands are shorthands, not a competing source of truth: an
 * explicit `x.bin` or `y` on the spec always wins.
 */
function expandHistogramMark(spec: Record<string, unknown>): Record<string, unknown> {
  if (markTypeOf(spec) !== 'histogram') return spec;

  const markDef = (typeof spec.mark === 'string' ? {} : { ...(spec.mark as object) }) as Record<
    string,
    unknown
  >;
  const { binCount, normalize, ...restMark } = markDef;

  const encoding = { ...((spec.encoding as Record<string, unknown>) ?? {}) };
  const x = { ...((encoding.x as Record<string, unknown>) ?? {}) };

  if (x.bin == null) {
    x.bin = { maxbins: typeof binCount === 'number' ? binCount : HISTOGRAM_DEFAULT_MAXBINS };
  }
  x.type = x.type ?? 'quantitative';
  encoding.x = x;

  if (encoding.y == null) {
    encoding.y = { aggregate: 'count' };
  }

  const out: Record<string, unknown> = {
    ...spec,
    mark: { ...restMark, type: 'bar' },
    encoding,
  };

  // `normalize` needs each group's total, which no single aggregate op gives:
  // the count aggregate collapses to one row per (bin, group), so the total
  // has to be joined back on afterwards and then divided into.
  if (normalize === true) {
    out.__histogramNormalize = true;
  }
  return out;
}

/** Fill opacity for overlapping density curves. */
const DENSITY_OVERLAP_FILL_OPACITY = 0.4;

/**
 * Fields that partition a distribution into independent curves or bars.
 *
 * `color` is the usual one, but `detail` groups without a visual encoding and
 * has to count too: otherwise two detail groups get pooled into one estimate.
 */
function distributionGroupFields(encoding: Record<string, unknown>): string[] {
  const fields: string[] = [];
  for (const channel of ['color', 'detail'] as const) {
    const ch = encoding[channel] as Record<string, unknown> | undefined;
    if (typeof ch?.field === 'string' && !fields.includes(ch.field)) fields.push(ch.field);
  }
  return fields;
}

/** Output fields the density transform writes, and the encoding then reads. */
const DENSITY_VALUE_FIELD = 'value';
const DENSITY_OUTPUT_FIELD = 'density';

/**
 * Desugar `mark: 'density'` into the canonical form: an area over a prepended
 * `DensityTransform`, with the KDE's output fields wired onto x and y.
 *
 * `interpolate: 'linear'` is deliberate. The estimate already evaluates a few
 * hundred points, so a spline would add shape the estimate does not contain.
 */
function expandDensityMark(spec: Record<string, unknown>): Record<string, unknown> {
  if (markTypeOf(spec) !== 'density') return spec;

  const markDef = (typeof spec.mark === 'string' ? {} : { ...(spec.mark as object) }) as Record<
    string,
    unknown
  >;
  const { bandwidth, cumulative, steps, ...restMark } = markDef;

  const encoding = { ...((spec.encoding as Record<string, unknown>) ?? {}) };
  const x = { ...((encoding.x as Record<string, unknown>) ?? {}) };
  const field = typeof x.field === 'string' ? x.field : undefined;
  // Nothing to estimate over. Leave the spec alone so validation reports the
  // missing required x against MARK_ENCODING_RULES.density, which names the
  // mark the author actually wrote.
  if (field == null) return spec;

  const groupFields = distributionGroupFields(encoding);

  // `as` is written explicitly rather than leaning on runDensity's defaults:
  // the encoding below references these two names, and the coupling would
  // otherwise be invisible across two files.
  const densityTransform: Record<string, unknown> = {
    density: field,
    as: [DENSITY_VALUE_FIELD, DENSITY_OUTPUT_FIELD],
  };
  if (groupFields.length > 0) densityTransform.groupby = groupFields;
  if (typeof bandwidth === 'number') densityTransform.bandwidth = bandwidth;
  if (cumulative === true) densityTransform.cumulative = true;
  if (typeof steps === 'number') densityTransform.steps = steps;

  // The estimate runs over whatever the author's own transforms produced: a
  // filter on the source field has to narrow the sample before the KDE sees
  // it, and after the KDE the source field no longer exists to filter on.
  const transforms = ((spec.transform as Transform[] | undefined) ?? [])
    .slice()
    .concat(densityTransform as unknown as Transform);

  encoding.x = {
    ...x,
    field: DENSITY_VALUE_FIELD,
    type: 'quantitative',
    ...(x.title == null ? { title: field } : {}),
  };
  const y = { ...((encoding.y as Record<string, unknown>) ?? {}) };
  encoding.y = {
    title: cumulative === true ? 'Cumulative share' : 'Density',
    // A density's absolute height is not a quantity readers interpret, so the
    // axis is off unless the author asks for it.
    axis: false,
    ...y,
    field: DENSITY_OUTPUT_FIELD,
    type: 'quantitative',
    // Areas stack by default on a color field; overlapping translucent curves
    // are the whole point of a density comparison.
    stack: y.stack ?? null,
  };

  const out: Record<string, unknown> = {
    ...spec,
    mark: {
      interpolate: 'linear',
      ...(groupFields.length > 0 ? { fillOpacity: DENSITY_OVERLAP_FILL_OPACITY } : {}),
      ...restMark,
      type: 'area',
    },
    encoding,
    transform: transforms,
  };

  // A crosshair reading "value: 3821, density: 0.00012" is noise, and an
  // endpoint label carrying the same number is worse: it lands on the tail of
  // the curve and prints an unreadable float. Both default on for line and
  // area marks, so turn them off unless the author was explicit.
  if (out.crosshair === undefined) out.crosshair = false;
  if (out.endpointLabels === undefined) out.endpointLabels = false;
  return out;
}

/**
 * Apply `mark.normalize` after the count aggregate has been generated.
 *
 * Runs LAST, because it appends to the transform chain the count aggregate
 * produced: join each group's summed count back onto its rows, divide, and
 * repoint y at the share.
 */
function applyHistogramNormalize(spec: Record<string, unknown>): Record<string, unknown> {
  if (spec.__histogramNormalize !== true) return spec;
  const { __histogramNormalize: _flag, ...rest } = spec;

  const encoding = { ...((rest.encoding as Record<string, unknown>) ?? {}) };
  const y = { ...((encoding.y as Record<string, unknown>) ?? {}) };
  const countField = typeof y.field === 'string' ? y.field : '__count';

  // Group by the color field when one is present, so each distribution is
  // normalized against its own total rather than the combined total.
  const groupby = distributionGroupFields(encoding);

  const transforms = ((rest.transform as Transform[] | undefined) ?? []).slice();
  transforms.push({
    joinaggregate: [{ op: 'sum', field: countField, as: GROUP_TOTAL_FIELD }],
    groupby,
  } as Transform);
  transforms.push({
    calculate: { op: '/', field: countField, field2: GROUP_TOTAL_FIELD },
    as: PROPORTION_FIELD,
  } as Transform);

  encoding.y = {
    ...y,
    field: PROPORTION_FIELD,
    type: 'quantitative',
    title: y.title === 'Count' || y.title == null ? 'Share' : y.title,
    // `axis: false` is an author turning the axis off; don't spread it into an
    // object and hand back an axis they asked not to have.
    axis:
      y.axis === false || y.axis === null
        ? y.axis
        : { format: 'percent', ...((y.axis as Record<string, unknown>) ?? {}) },
  };

  return { ...rest, encoding, transform: transforms };
}

// ---------------------------------------------------------------------------
// Composition: chart and layer expansion
// ---------------------------------------------------------------------------

function expandChartSugar(
  spec: Record<string, unknown>,
  warnings: string[],
  inheritedData?: DataRow[],
): Record<string, unknown> {
  let out = unwrapDataValues(spec);
  out = expandTopLevelTitle(out);
  out = expandDescriptionSugar(out);
  out = stripIgnoredKeys(out, warnings);
  out = stripRemovedMarkRender(out, warnings);
  out = applyFixedSizeDefault(out);
  out = expandAnnotationSugar(out, warnings);
  out = expandChannelSugar(out, warnings);
  out = expandHistogramMark(out);
  out = expandDensityMark(out);
  out = expandEncodingSugar(out, inheritedData);
  out = resolveSortSugar(out, inheritedData);
  out = expandCountAggregate(out);
  out = applyHistogramNormalize(out);
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
  out = expandAnnotationSugar(out, warnings);
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
      return expandChartSugar(childObj, warnings, layerData);
    }
    return child;
  });
  return { ...out, layer: expandedChildren };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand deprecated `valueFormat` into `encoding.value.format` for
 * sankey, tilemap, and barlist specs. Encoding-level format wins on conflict.
 */
function expandValueFormatSugar(
  spec: Record<string, unknown>,
  warnings: string[],
): Record<string, unknown> {
  const type = spec.type as string | undefined;
  if (type !== 'sankey' && type !== 'tilemap' && type !== 'barlist') return spec;
  if (typeof spec.valueFormat !== 'string') return spec;

  const encoding = spec.encoding as Record<string, unknown> | undefined;
  const valueCh = encoding?.value as Record<string, unknown> | undefined;

  // Only expand into encoding when encoding.value already exists (the shorthand
  // tilemap/barlist API may not have explicit encoding — the normalizer infers it).
  if (!valueCh || typeof valueCh !== 'object') {
    warnings.push(
      '[openchart] valueFormat is deprecated; set format on the encoding value channel instead (e.g. encoding.value.format).',
    );
    return spec;
  }

  if (valueCh.format !== undefined) {
    const { valueFormat: _vf, ...rest } = spec;
    warnings.push(
      '[openchart] valueFormat is deprecated; the encoding.value.format field takes precedence and valueFormat was ignored.',
    );
    return rest;
  }

  warnings.push(
    '[openchart] valueFormat is deprecated; set format on the encoding value channel instead (e.g. encoding.value.format).',
  );
  const { valueFormat, ...rest } = spec;
  return {
    ...rest,
    encoding: { ...encoding, value: { ...valueCh, format: valueFormat } },
  };
}

/**
 * Expand VL-idiom and encoding-level sugar on a raw chart or layer spec.
 * Non-chart specs (tables, graphs, sankey, tilemap, barlist) get valueFormat
 * expansion only. Deprecation warnings are pushed onto `warnings`; callers
 * surface them (compileChart/compileLayer console.warn each unique message
 * once per compile).
 */
export function expandSpecSugar(
  spec: Record<string, unknown>,
  warnings: string[] = [],
): Record<string, unknown> {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec;
  if (Array.isArray(spec.layer) && typeof spec.type !== 'string') {
    return expandLayerSugar(spec, warnings);
  }
  if (!('mark' in spec)) {
    return expandValueFormatSugar(spec, warnings);
  }
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
