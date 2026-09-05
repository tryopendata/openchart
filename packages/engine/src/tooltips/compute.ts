/**
 * Tooltip descriptor computation.
 *
 * Generates a Map of mark-id -> TooltipContent from the spec encoding and marks.
 * Each mark gets a tooltip that shows relevant field values formatted for display.
 * The mark-id keys match the data-mark-id attributes set by the SVG renderer.
 */

import type {
  ArcMark,
  AreaMark,
  DataRow,
  Encoding,
  EncodingChannel,
  LineMark,
  Mark,
  NumberFormatter,
  PointMark,
  RectMark,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  buildTemporalFormatter,
  defaultNumberFormatter,
  formatDate,
  formatPercent,
  getRepresentativeColor,
} from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import { resolveFieldFormatter } from '../format/field-format';
import { fieldIterable } from '../layout/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a raw data value for tooltip display. */
function formatValue(
  value: unknown,
  fieldType?: string,
  formatter?: NumberFormatter | ((v: Date | string | number) => string) | null,
): string {
  if (value == null) return '';

  if (fieldType === 'temporal' || value instanceof Date) {
    if (formatter)
      return (formatter as (v: Date | string | number) => string)(value as Date | string | number);
    return formatDate(value as Date | string | number);
  }

  if (typeof value === 'number') {
    if (formatter) return (formatter as NumberFormatter)(value);
    return defaultNumberFormatter()(value);
  }

  return String(value);
}

/** Resolve the display label for an encoding channel: title > axis.title > field name. */
function resolveLabel(ch: EncodingChannel): string {
  const ax = ch.axis || undefined;
  return ch.title ?? ax?.title ?? ch.field;
}

/** Resolve the format string for an encoding channel: format > axis.format. */
function resolveFormat(ch: EncodingChannel): string | undefined {
  const ax = ch.axis || undefined;
  return ch.format ?? ax?.format;
}

type ChannelFormatter = NumberFormatter | ((v: Date | string | number) => string) | null;

function cacheKey(ch: EncodingChannel): string {
  const fmt = resolveFormat(ch);
  return fmt ? `${ch.field}::${ch.type}::${fmt}` : `${ch.field}::${ch.type}`;
}

/** Build a per-channel formatter cache for tooltip display. */
function buildFormatterCache(
  data: DataRow[],
  channels: EncodingChannel[],
): Map<string, ChannelFormatter> {
  const cache = new Map<string, ChannelFormatter>();
  for (const ch of channels) {
    const key = cacheKey(ch);
    if (cache.has(key)) continue;
    const fmt = resolveFormat(ch);
    if (ch.type === 'temporal') {
      const temporalFmt = buildTemporalFormatter(fmt);
      cache.set(key, temporalFmt ?? null);
    } else if (ch.type === 'quantitative') {
      cache.set(
        key,
        resolveFieldFormatter({
          surfaceFormat: fmt,
          values: fieldIterable(data, ch.field),
        }),
      );
    } else {
      cache.set(key, null);
    }
  }
  return cache;
}

function getFormatter(
  cache: Map<string, ChannelFormatter>,
  ch: EncodingChannel,
): ChannelFormatter | undefined {
  return cache.get(cacheKey(ch));
}

/** Build tooltip fields from explicit tooltip encoding channels. */
function buildExplicitTooltipFields(
  row: DataRow,
  channels: EncodingChannel[],
  formatters: Map<string, ChannelFormatter>,
): TooltipField[] {
  return channels.map((ch) => ({
    label: resolveLabel(ch),
    value: formatValue(row[ch.field], ch.type, getFormatter(formatters, ch)),
  }));
}

/**
 * Build tooltip fields from a data row based on the spec encoding.
 *
 * `titleChannel` is the channel the header already shows; its row is dropped so
 * a single-series line tooltip does not repeat the date under its own heading.
 * An explicit `encoding.tooltip` is always rendered verbatim.
 */
function buildFields(
  row: DataRow,
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
  color?: string,
  titleChannel?: TitleChannel,
): TooltipField[] {
  if (encoding.tooltip) {
    const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
    return buildExplicitTooltipFields(row, channels, formatters);
  }

  const fields: TooltipField[] = [];
  const skipped: TooltipField[] = [];

  if (encoding.color && 'field' in encoding.color) {
    (titleChannel === 'color' ? skipped : fields).push({
      label: resolveLabel(encoding.color),
      value: formatValue(
        row[encoding.color.field],
        encoding.color.type,
        getFormatter(formatters, encoding.color),
      ),
      color,
    });
  }

  if (encoding.y) {
    (titleChannel === 'y' ? skipped : fields).push({
      label: resolveLabel(encoding.y),
      value: formatValue(
        row[encoding.y.field],
        encoding.y.type,
        getFormatter(formatters, encoding.y),
      ),
      color: encoding.color ? undefined : color,
    });
  }

  if (encoding.x) {
    (titleChannel === 'x' ? skipped : fields).push({
      label: resolveLabel(encoding.x),
      value: formatValue(
        row[encoding.x.field],
        encoding.x.type,
        getFormatter(formatters, encoding.x),
      ),
    });
  }

  if (encoding.size && 'field' in encoding.size) {
    fields.push({
      label: resolveLabel(encoding.size),
      value: formatValue(
        row[encoding.size.field],
        encoding.size.type,
        getFormatter(formatters, encoding.size),
      ),
    });
  }

  // Never hand back an empty card: if the title consumed the only channel
  // there was, show the row after all.
  return fields.length > 0 ? fields : skipped;
}

/**
 * Precompute the set of encoded field names for the scatter/bubble title
 * fallback in `getTooltipTitle` (both axes quantitative). Row-invariant for
 * a given encoding, so callers that invoke `getTooltipTitle` once per row
 * build this once and pass it through instead of rebuilding it per row.
 * Returns `undefined` when the fallback branch doesn't apply, matching the
 * `getTooltipTitle` guard it feeds.
 */
function computeEncodedFieldsSet(encoding: Encoding): Set<string> | undefined {
  if (!(encoding.x?.type === 'quantitative' && encoding.y?.type === 'quantitative')) {
    return undefined;
  }
  const encodedFields = new Set<string>();
  for (const ch of [encoding.x, encoding.y, encoding.color, encoding.size, encoding.detail]) {
    if (ch && 'field' in ch) encodedFields.add(ch.field);
  }
  return encodedFields;
}

/** Which encoding channel a tooltip title was taken from, if any. */
type TitleChannel = 'x' | 'y' | 'color';

interface TooltipTitle {
  title?: string;
  /** Set when the title is the whole of a positional/color channel's value, so
   *  the field list can skip it instead of repeating it one line down. */
  channel?: TitleChannel;
}

/** Determine the title for a tooltip based on encoding. */
function getTooltipTitle(
  row: DataRow,
  encoding: Encoding,
  encodedFields?: Set<string>,
): TooltipTitle {
  // Detail channel provides an explicit label (e.g. district name in scatter).
  // Detail is never rendered as a field row, so nothing is consumed.
  if (encoding.detail) {
    return { title: String(row[encoding.detail.field] ?? '') };
  }

  // For charts with a temporal x-axis, use the date as the title
  if (encoding.x?.type === 'temporal') {
    return { title: formatValue(row[encoding.x.field], 'temporal'), channel: 'x' };
  }

  // For nominal x, use the category
  if (encoding.x?.type === 'nominal' || encoding.x?.type === 'ordinal') {
    return { title: String(row[encoding.x.field] ?? ''), channel: 'x' };
  }

  // For nominal y (e.g. horizontal bar charts), use the category
  if (encoding.y?.type === 'nominal' || encoding.y?.type === 'ordinal') {
    return { title: String(row[encoding.y.field] ?? ''), channel: 'y' };
  }

  // For scatter/bubble (both axes quantitative), find a name-like string field
  // in the data row that isn't already used by an encoding channel
  if (encoding.x?.type === 'quantitative' && encoding.y?.type === 'quantitative') {
    const fields = encodedFields ?? computeEncodedFieldsSet(encoding)!;
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (!fields.has(key) && typeof value === 'string') {
        return { title: value };
      }
    }
  }

  // For color-encoded series, use the series name (skip conditional defs)
  if (encoding.color && 'field' in encoding.color) {
    return { title: String(row[encoding.color.field] ?? ''), channel: 'color' };
  }

  return {};
}

// ---------------------------------------------------------------------------
// Per-mark-type tooltip generation
// ---------------------------------------------------------------------------

function tooltipsForLine(
  mark: LineMark,
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
  _markIndex: number,
  encodedFields?: Set<string>,
  stackTotals?: Map<string, TooltipField>,
): Array<[string, TooltipContent]> {
  if (mark.dataPoints) {
    for (const dp of mark.dataPoints) {
      const { title, channel } = getTooltipTitle(dp.datum, encoding, encodedFields);
      const fields = buildFields(dp.datum, encoding, formatters, mark.stroke, channel);
      // A stacked area chart also emits a derived line mark per band, and the
      // crosshair reads the line's tooltip in preference to the area's. The
      // totals map only exists for a non-normalized stack, so this is inert on
      // a plain line chart.
      if (stackTotals && encoding.x) {
        const total = stackTotals.get(stackKeyOf(dp.datum[encoding.x.field]));
        if (total) fields.push(total);
      }
      dp.tooltip = { title, fields };
    }
  }
  return [];
}

function tooltipsForPoint(
  mark: PointMark,
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
  markIndex: number,
  encodedFields?: Set<string>,
): Array<[string, TooltipContent]> {
  const { title, channel } = getTooltipTitle(mark.data, encoding, encodedFields);
  const fields = buildFields(
    mark.data,
    encoding,
    formatters,
    getRepresentativeColor(mark.fill),
    channel,
  );

  return [[`point-${markIndex}`, { title, fields }]];
}

function tooltipsForRect(
  mark: RectMark,
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
  markIndex: number,
  encodedFields?: Set<string>,
  stackTotals?: Map<string, TooltipField>,
): Array<[string, TooltipContent]> {
  const { title, channel } = getTooltipTitle(mark.data, encoding, encodedFields);
  const fields = buildFields(
    mark.data,
    encoding,
    formatters,
    getRepresentativeColor(mark.fill),
    channel,
  );

  const total = mark.stackGroup !== undefined ? stackTotals?.get(mark.stackGroup) : undefined;
  if (total) fields.push(total);

  return [[`rect-${markIndex}`, { title, fields }]];
}

function tooltipsForArc(
  mark: ArcMark,
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
  markIndex: number,
): Array<[string, TooltipContent]> {
  const row = mark.data;
  const fields: TooltipField[] = [];

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  if (colorEnc) {
    const categoryName = String(row[colorEnc.field] ?? '');
    if (encoding.y) {
      fields.push({
        label: categoryName,
        value: formatValue(
          row[encoding.y.field],
          encoding.y.type,
          getFormatter(formatters, encoding.y),
        ),
        color: getRepresentativeColor(mark.fill),
      });
    }
  } else if (encoding.y) {
    fields.push({
      label: resolveLabel(encoding.y),
      value: formatValue(
        row[encoding.y.field],
        encoding.y.type,
        getFormatter(formatters, encoding.y),
      ),
      color: getRepresentativeColor(mark.fill),
    });
  }

  const title = colorEnc ? String(row[colorEnc.field] ?? '') : undefined;

  return [[`arc-${markIndex}`, { title, fields }]];
}

function tooltipsForArea(
  mark: AreaMark,
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
  _markIndex: number,
  encodedFields?: Set<string>,
  stackTotals?: Map<string, TooltipField>,
): Array<[string, TooltipContent]> {
  if (mark.dataPoints) {
    const wantsTotal = mark.stacked === true && mark.stackNormalized !== true;
    for (const dp of mark.dataPoints) {
      const { title, channel } = getTooltipTitle(dp.datum, encoding, encodedFields);
      const fields = buildFields(
        dp.datum,
        encoding,
        formatters,
        getRepresentativeColor(mark.fill),
        channel,
      );
      if (wantsTotal && encoding.x) {
        const total = stackTotals?.get(stackKeyOf(dp.datum[encoding.x.field]));
        if (total) fields.push(total);
      }
      dp.tooltip = { title, fields };
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Stack totals
// ---------------------------------------------------------------------------

/** Label on the stack-sum row. */
const TOTAL_LABEL = 'Total';

/** Stable map key for an x value (Dates are not usable as object keys). */
function stackKeyOf(value: unknown): string {
  return value instanceof Date ? String(value.getTime()) : String(value);
}

/** The quantitative channel of a bar/column encoding, which is what stacks. */
function stackValueChannel(encoding: Encoding): EncodingChannel | undefined {
  if (encoding.y?.type === 'quantitative') return encoding.y;
  if (encoding.x?.type === 'quantitative') return encoding.x;
  return undefined;
}

/** True when the stack is normalized to 100%, where a sum row means nothing. */
function isNormalizedStack(encoding: Encoding): boolean {
  return encoding.y?.stack === 'normalize' || encoding.x?.stack === 'normalize';
}

/**
 * Sum each stacked bar/column group so every segment's tooltip can end with the
 * whole bar's value -- the number the reader is actually comparing across
 * categories, which a stack otherwise hides.
 */
function computeRectStackTotals(
  marks: Mark[],
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
): Map<string, TooltipField> | undefined {
  if (isNormalizedStack(encoding)) return undefined;
  const valueCh = stackValueChannel(encoding);
  if (!valueCh) return undefined;

  const sums = new Map<string, number>();
  for (const mark of marks) {
    if (mark.type !== 'rect' || mark.stackGroup === undefined) continue;
    const value = Number((mark.data as DataRow)[valueCh.field]);
    if (!Number.isFinite(value)) continue;
    sums.set(mark.stackGroup, (sums.get(mark.stackGroup) ?? 0) + value);
  }
  if (sums.size === 0) return undefined;

  const formatter = getFormatter(formatters, valueCh);
  const totals = new Map<string, TooltipField>();
  for (const [group, sum] of sums) {
    totals.set(group, {
      label: TOTAL_LABEL,
      value: formatValue(sum, valueCh.type, formatter),
      role: 'total',
    });
  }
  return totals;
}

/** The same, per x position, for stacked area bands. */
function computeAreaStackTotals(
  marks: Mark[],
  encoding: Encoding,
  formatters: Map<string, ChannelFormatter>,
): Map<string, TooltipField> | undefined {
  const xCh = encoding.x;
  const yCh = encoding.y;
  if (!xCh || !yCh) return undefined;

  const sums = new Map<string, number>();
  for (const mark of marks) {
    if (mark.type !== 'area') continue;
    if (mark.stacked !== true || mark.stackNormalized === true) continue;
    for (const dp of mark.dataPoints ?? []) {
      const value = Number(dp.datum[yCh.field]);
      if (!Number.isFinite(value)) continue;
      const key = stackKeyOf(dp.datum[xCh.field]);
      sums.set(key, (sums.get(key) ?? 0) + value);
    }
  }
  if (sums.size === 0) return undefined;

  const formatter = getFormatter(formatters, yCh);
  const totals = new Map<string, TooltipField>();
  for (const [key, sum] of sums) {
    totals.set(key, {
      label: TOTAL_LABEL,
      value: formatValue(sum, yCh.type, formatter),
      role: 'total',
    });
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Range mark tooltips (start / end / delta)
// ---------------------------------------------------------------------------

/**
 * Build tooltip descriptors for range marks (dumbbell / arrow / range bar).
 *
 * Every mark of a range row (dots, connector rule, bar rect) shares one
 * tooltip showing the start value, the end value, and the signed delta.
 * An explicit `encoding.tooltip` overrides the default field set.
 */
function computeRangeTooltips(
  spec: NormalizedChartSpec,
  marks: Mark[],
): Map<string, TooltipContent> {
  const encoding = spec.encoding as Encoding;
  const descriptors = new Map<string, TooltipContent>();

  const horizontal = encoding.y?.type === 'nominal' || encoding.y?.type === 'ordinal';
  const startCh = horizontal ? encoding.x : encoding.y;
  const endCh = horizontal ? encoding.x2 : encoding.y2;
  if (!startCh || !endCh) return descriptors;

  const allChannels = [startCh, endCh, encoding.color, encoding.tooltip]
    .flat()
    .filter((ch): ch is EncodingChannel => !!ch && 'field' in ch);
  const fmtCache = buildFormatterCache(spec.data, allChannels);
  const startFmt = getFormatter(fmtCache, startCh);
  const encodedFields = computeEncodedFieldsSet(encoding);

  const contentFor = (row: DataRow): TooltipContent => {
    const { title } = getTooltipTitle(row, encoding, encodedFields);
    if (encoding.tooltip) {
      const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
      return { title, fields: buildExplicitTooltipFields(row, channels, fmtCache) };
    }

    const fields: TooltipField[] = [
      {
        label: resolveLabel(startCh),
        value: formatValue(row[startCh.field], startCh.type, getFormatter(fmtCache, startCh)),
      },
      {
        label: resolveLabel(endCh),
        value: formatValue(row[endCh.field], endCh.type, getFormatter(fmtCache, endCh)),
      },
    ];

    const startVal = Number(row[startCh.field]);
    const endVal = Number(row[endCh.field]);
    if (Number.isFinite(startVal) && Number.isFinite(endVal)) {
      const delta = endVal - startVal;
      const formatted = startFmt
        ? (startFmt as NumberFormatter)(delta)
        : defaultNumberFormatter()(delta);
      fields.push({ label: 'Change', value: delta > 0 ? `+${formatted}` : formatted });
    }

    return { title, fields };
  };

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (mark.type !== 'point' && mark.type !== 'rect' && mark.type !== 'rule') continue;
    descriptors.set(`${mark.type}-${i}`, contentFor(mark.data as DataRow));
  }

  return descriptors;
}

/**
 * Compute per-day calendar heatmap tooltips.
 *
 * Data cells get a formatted date title plus the color value; empty cells
 * (missing days, marked decorative by the calendar renderer) get no
 * descriptor at all so no tooltip fires on them. An explicit
 * `encoding.tooltip` overrides the default field set.
 */
function computeCalendarTooltips(
  spec: NormalizedChartSpec,
  marks: Mark[],
): Map<string, TooltipContent> {
  const encoding = spec.encoding as Encoding;
  const descriptors = new Map<string, TooltipContent>();

  const xEnc = encoding.x;
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  if (!xEnc || !colorEnc) return descriptors;

  const allChannels = [
    xEnc,
    colorEnc,
    ...(encoding.tooltip
      ? Array.isArray(encoding.tooltip)
        ? encoding.tooltip
        : [encoding.tooltip]
      : []),
  ].filter((ch): ch is EncodingChannel => !!ch && 'field' in ch);
  const fmtCache = buildFormatterCache(spec.data, allChannels);

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (mark.type !== 'rect' || mark.aria.decorative) continue;
    const row = mark.data as DataRow;

    const title = formatValue(row[xEnc.field], 'temporal', getFormatter(fmtCache, xEnc));
    if (encoding.tooltip) {
      const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
      descriptors.set(`rect-${i}`, {
        title,
        fields: buildExplicitTooltipFields(row, channels, fmtCache),
      });
      continue;
    }

    descriptors.set(`rect-${i}`, {
      title,
      fields: [
        {
          label: resolveLabel(colorEnc),
          value: formatValue(row[colorEnc.field], colorEnc.type, getFormatter(fmtCache, colorEnc)),
          color: getRepresentativeColor(mark.fill),
        },
      ],
    });
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Waffle mark tooltips (one shared tooltip per category)
// ---------------------------------------------------------------------------

/**
 * Build tooltip descriptors for waffle marks.
 *
 * Every cell of a category shares literally one TooltipContent object, so
 * the cells act as a single hover target: moving across a category's cells
 * keeps showing the same tooltip. Content: the category's value plus its
 * "x of N units" cell count. An explicit `encoding.tooltip` overrides the
 * default field set.
 */
function computeWaffleTooltips(
  spec: NormalizedChartSpec,
  marks: Mark[],
): Map<string, TooltipContent> {
  const encoding = spec.encoding as Encoding;
  const descriptors = new Map<string, TooltipContent>();

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const valueCh = encoding.y ?? encoding.x;
  if (!colorEnc || !valueCh) return descriptors;

  const allChannels = [
    valueCh,
    colorEnc,
    ...(encoding.tooltip
      ? Array.isArray(encoding.tooltip)
        ? encoding.tooltip
        : [encoding.tooltip]
      : []),
  ].filter((ch): ch is EncodingChannel => !!ch && 'field' in ch);
  const fmtCache = buildFormatterCache(spec.data, allChannels);

  const units = Math.max(1, Math.round(spec.markDef.units ?? 100));

  const cellCounts = new Map<string, number>();
  for (const mark of marks) {
    if (mark.type !== 'rect') continue;
    const category = String((mark.data as DataRow)[colorEnc.field] ?? '');
    cellCounts.set(category, (cellCounts.get(category) ?? 0) + 1);
  }

  const contentByCategory = new Map<string, TooltipContent>();
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (mark.type !== 'rect') continue;

    const row = mark.data as DataRow;
    const category = String(row[colorEnc.field] ?? '');
    let content = contentByCategory.get(category);
    if (!content) {
      if (encoding.tooltip) {
        const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
        content = { title: category, fields: buildExplicitTooltipFields(row, channels, fmtCache) };
      } else {
        content = {
          title: category,
          fields: [
            {
              label: resolveLabel(valueCh),
              value: formatValue(row[valueCh.field], valueCh.type, getFormatter(fmtCache, valueCh)),
              color: getRepresentativeColor(mark.fill),
            },
            { label: 'Share', value: `${cellCounts.get(category) ?? 0} of ${units} units` },
          ],
        };
      }
      contentByCategory.set(category, content);
    }
    descriptors.set(`rect-${i}`, content);
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Parliament mark tooltips (one shared tooltip per party)
// ---------------------------------------------------------------------------

/**
 * Build tooltip descriptors for parliament (hemicycle) marks.
 *
 * Every seat dot of a party shares one TooltipContent object, so hovering any
 * of a party's seats shows the same tooltip: the seat count and its share of
 * the chamber. Keys match the renderer's `point-${index}` mark ids. The
 * majority line/label (rule/textMark) get no descriptor. An explicit
 * `encoding.tooltip` overrides the default field set.
 */
function computeParliamentTooltips(
  spec: NormalizedChartSpec,
  marks: Mark[],
): Map<string, TooltipContent> {
  const encoding = spec.encoding as Encoding;
  const descriptors = new Map<string, TooltipContent>();

  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const valueCh = encoding.y ?? encoding.x;
  if (!colorEnc || !valueCh) return descriptors;

  const allChannels = [
    valueCh,
    colorEnc,
    ...(encoding.tooltip
      ? Array.isArray(encoding.tooltip)
        ? encoding.tooltip
        : [encoding.tooltip]
      : []),
  ].filter((ch): ch is EncodingChannel => !!ch && 'field' in ch);
  const fmtCache = buildFormatterCache(spec.data, allChannels);

  const seatCounts = new Map<string, number>();
  for (const mark of marks) {
    if (mark.type !== 'point') continue;
    const party = String((mark.data as DataRow)[colorEnc.field] ?? '');
    seatCounts.set(party, (seatCounts.get(party) ?? 0) + 1);
  }
  const totalSeats = [...seatCounts.values()].reduce((s, c) => s + c, 0);

  const contentByParty = new Map<string, TooltipContent>();
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (mark.type !== 'point') continue;

    const row = mark.data as DataRow;
    const party = String(row[colorEnc.field] ?? '');
    let content = contentByParty.get(party);
    if (!content) {
      if (encoding.tooltip) {
        const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
        content = { title: party, fields: buildExplicitTooltipFields(row, channels, fmtCache) };
      } else {
        const count = seatCounts.get(party) ?? 0;
        const share = totalSeats > 0 ? formatPercent(count / totalSeats) : '';
        content = {
          title: party,
          fields: [
            {
              label: resolveLabel(valueCh),
              value: formatValue(row[valueCh.field], valueCh.type, getFormatter(fmtCache, valueCh)),
              color: getRepresentativeColor(mark.fill),
            },
            { label: 'Share', value: share },
          ],
        };
      }
      contentByParty.set(party, content);
    }
    descriptors.set(`point-${i}`, content);
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute tooltip descriptors for all marks in the layout.
 *
 * Returns a Map keyed by data-mark-id (matching the SVG attribute)
 * to TooltipContent objects. The vanilla adapter uses this to show
 * tooltips on hover/tap/keyboard focus.
 */
export function computeTooltipDescriptors(
  spec: NormalizedChartSpec,
  marks: Mark[],
): Map<string, TooltipContent> {
  // Range marks share one start/end/delta tooltip across every mark of a row.
  if (spec.markType === 'range') {
    return computeRangeTooltips(spec, marks);
  }
  // Calendar heatmaps get one date-titled tooltip per data cell; empty
  // (missing-day) cells get none.
  if (spec.markType === 'calendar') {
    return computeCalendarTooltips(spec, marks);
  }

  // Waffle cells share one tooltip per category (the cells act as one target).
  if (spec.markType === 'waffle') {
    return computeWaffleTooltips(spec, marks);
  }

  // Parliament seats share one tooltip per party (all of a party's seats act
  // as one target).
  if (spec.markType === 'parliament') {
    return computeParliamentTooltips(spec, marks);
  }

  const encoding = spec.encoding as Encoding;
  const descriptors = new Map<string, TooltipContent>();

  const allChannels = [
    encoding.x,
    encoding.y,
    encoding.color && 'field' in encoding.color ? encoding.color : undefined,
    encoding.size && 'field' in encoding.size ? encoding.size : undefined,
    ...(encoding.tooltip
      ? Array.isArray(encoding.tooltip)
        ? encoding.tooltip
        : [encoding.tooltip]
      : []),
  ].filter((ch): ch is EncodingChannel => !!ch && 'field' in ch);
  const formatters = buildFormatterCache(spec.data, allChannels);
  const encodedFields = computeEncodedFieldsSet(encoding);
  const rectStackTotals = computeRectStackTotals(marks, encoding, formatters);
  const areaStackTotals = computeAreaStackTotals(marks, encoding, formatters);

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    let entries: Array<[string, TooltipContent]> = [];

    switch (mark.type) {
      case 'line':
        entries = tooltipsForLine(mark, encoding, formatters, i, encodedFields, areaStackTotals);
        break;
      case 'area':
        entries = tooltipsForArea(mark, encoding, formatters, i, encodedFields, areaStackTotals);
        break;
      case 'point':
        entries = tooltipsForPoint(mark, encoding, formatters, i, encodedFields);
        break;
      case 'rect':
        entries = tooltipsForRect(mark, encoding, formatters, i, encodedFields, rectStackTotals);
        break;
      case 'arc':
        entries = tooltipsForArc(mark, encoding, formatters, i);
        break;
    }

    for (const [key, content] of entries) {
      descriptors.set(key, content);
    }
  }

  return descriptors;
}
