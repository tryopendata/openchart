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
  PointMark,
  RectMark,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  buildTemporalFormatter,
  formatDate,
  formatNumber,
  getRepresentativeColor,
} from '@opendata-ai/openchart-core';
import { format as d3Format } from 'd3-format';

import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a raw data value for tooltip display. */
function formatValue(value: unknown, fieldType?: string, format?: string): string {
  if (value == null) return '';

  if (fieldType === 'temporal' || value instanceof Date) {
    const temporalFmt = buildTemporalFormatter(format);
    if (temporalFmt) return temporalFmt(value as Date | string | number);
    return formatDate(value as Date | string | number);
  }

  if (typeof value === 'number') {
    if (format) {
      try {
        return d3Format(format)(value);
      } catch {
        return formatNumber(value);
      }
    }
    return formatNumber(value);
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

/** Build tooltip fields from explicit tooltip encoding channels. */
function buildExplicitTooltipFields(row: DataRow, channels: EncodingChannel[]): TooltipField[] {
  return channels.map((ch) => ({
    label: resolveLabel(ch),
    value: formatValue(row[ch.field], ch.type, resolveFormat(ch)),
  }));
}

/** Build tooltip fields from a data row based on the spec encoding. */
function buildFields(row: DataRow, encoding: Encoding, color?: string): TooltipField[] {
  if (encoding.tooltip) {
    const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
    return buildExplicitTooltipFields(row, channels);
  }

  const fields: TooltipField[] = [];

  // Color/series field (e.g. "Source: Coal") so the user knows which series
  if (encoding.color && 'field' in encoding.color) {
    fields.push({
      label: resolveLabel(encoding.color),
      value: formatValue(
        row[encoding.color.field],
        encoding.color.type,
        resolveFormat(encoding.color),
      ),
      color,
    });
  }

  // Y-axis value (the "main" value in most charts)
  if (encoding.y) {
    fields.push({
      label: resolveLabel(encoding.y),
      value: formatValue(row[encoding.y.field], encoding.y.type, resolveFormat(encoding.y)),
      color: encoding.color ? undefined : color,
    });
  }

  // X-axis value (often the category or date)
  if (encoding.x) {
    fields.push({
      label: resolveLabel(encoding.x),
      value: formatValue(row[encoding.x.field], encoding.x.type, resolveFormat(encoding.x)),
    });
  }

  // Size (for scatter/bubble) - skip conditional size definitions
  if (encoding.size && 'field' in encoding.size) {
    fields.push({
      label: resolveLabel(encoding.size),
      value: formatValue(
        row[encoding.size.field],
        encoding.size.type,
        resolveFormat(encoding.size),
      ),
    });
  }

  return fields;
}

/** Determine the title for a tooltip based on encoding. */
function getTooltipTitle(row: DataRow, encoding: Encoding): string | undefined {
  // Detail channel provides an explicit label (e.g. district name in scatter)
  if (encoding.detail) {
    return String(row[encoding.detail.field] ?? '');
  }

  // For charts with a temporal x-axis, use the date as the title
  if (encoding.x?.type === 'temporal') {
    return formatValue(row[encoding.x.field], 'temporal');
  }

  // For nominal x, use the category
  if (encoding.x?.type === 'nominal' || encoding.x?.type === 'ordinal') {
    return String(row[encoding.x.field] ?? '');
  }

  // For nominal y (e.g. horizontal bar charts), use the category
  if (encoding.y?.type === 'nominal' || encoding.y?.type === 'ordinal') {
    return String(row[encoding.y.field] ?? '');
  }

  // For scatter/bubble (both axes quantitative), find a name-like string field
  // in the data row that isn't already used by an encoding channel
  if (encoding.x?.type === 'quantitative' && encoding.y?.type === 'quantitative') {
    const encodedFields = new Set(
      [encoding.x, encoding.y, encoding.color, encoding.size, encoding.detail]
        .filter((ch): ch is EncodingChannel => !!ch && 'field' in ch)
        .map((ch) => ch.field),
    );
    for (const [key, value] of Object.entries(row)) {
      if (!encodedFields.has(key) && typeof value === 'string') {
        return value;
      }
    }
  }

  // For color-encoded series, use the series name (skip conditional defs)
  if (encoding.color && 'field' in encoding.color) {
    return String(row[encoding.color.field] ?? '');
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Per-mark-type tooltip generation
// ---------------------------------------------------------------------------

function tooltipsForLine(
  mark: LineMark,
  encoding: Encoding,
  _markIndex: number,
): Array<[string, TooltipContent]> {
  // Populate tooltip content on each dataPoint for voronoi overlay lookup.
  // Line marks don't emit per-mark tooltip descriptors (the overlay handles it).
  if (mark.dataPoints) {
    for (const dp of mark.dataPoints) {
      dp.tooltip = {
        title: getTooltipTitle(dp.datum, encoding),
        fields: buildFields(dp.datum, encoding, mark.stroke),
      };
    }
  }
  return [];
}

function tooltipsForPoint(
  mark: PointMark,
  encoding: Encoding,
  markIndex: number,
): Array<[string, TooltipContent]> {
  const title = getTooltipTitle(mark.data, encoding);
  const fields = buildFields(mark.data, encoding, getRepresentativeColor(mark.fill));

  return [[`point-${markIndex}`, { title, fields }]];
}

function tooltipsForRect(
  mark: RectMark,
  encoding: Encoding,
  markIndex: number,
): Array<[string, TooltipContent]> {
  const title = getTooltipTitle(mark.data, encoding);
  const fields = buildFields(mark.data, encoding, getRepresentativeColor(mark.fill));

  return [[`rect-${markIndex}`, { title, fields }]];
}

function tooltipsForArc(
  mark: ArcMark,
  encoding: Encoding,
  markIndex: number,
): Array<[string, TooltipContent]> {
  const row = mark.data;
  const fields: TooltipField[] = [];

  // For pie/donut, show the category and its value
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  if (colorEnc) {
    const categoryName = String(row[colorEnc.field] ?? '');
    if (encoding.y) {
      fields.push({
        label: categoryName,
        value: formatValue(row[encoding.y.field], encoding.y.type, resolveFormat(encoding.y)),
        color: getRepresentativeColor(mark.fill),
      });
    }
  } else if (encoding.y) {
    fields.push({
      label: resolveLabel(encoding.y),
      value: formatValue(row[encoding.y.field], encoding.y.type, resolveFormat(encoding.y)),
      color: getRepresentativeColor(mark.fill),
    });
  }

  const title = colorEnc ? String(row[colorEnc.field] ?? '') : undefined;

  return [[`arc-${markIndex}`, { title, fields }]];
}

function tooltipsForArea(
  mark: AreaMark,
  encoding: Encoding,
  _markIndex: number,
): Array<[string, TooltipContent]> {
  // Populate tooltip content on each dataPoint for voronoi overlay lookup.
  // Area marks don't emit per-mark tooltip descriptors (the overlay handles it).
  if (mark.dataPoints) {
    for (const dp of mark.dataPoints) {
      dp.tooltip = {
        title: getTooltipTitle(dp.datum, encoding),
        fields: buildFields(dp.datum, encoding, getRepresentativeColor(mark.fill)),
      };
    }
  }
  return [];
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

  const contentFor = (row: DataRow): TooltipContent => {
    const title = getTooltipTitle(row, encoding);
    if (encoding.tooltip) {
      const channels = Array.isArray(encoding.tooltip) ? encoding.tooltip : [encoding.tooltip];
      return { title, fields: buildExplicitTooltipFields(row, channels) };
    }

    const fields: TooltipField[] = [
      {
        label: resolveLabel(startCh),
        value: formatValue(row[startCh.field], startCh.type, resolveFormat(startCh)),
      },
      {
        label: resolveLabel(endCh),
        value: formatValue(row[endCh.field], endCh.type, resolveFormat(endCh)),
      },
    ];

    const startVal = Number(row[startCh.field]);
    const endVal = Number(row[endCh.field]);
    if (Number.isFinite(startVal) && Number.isFinite(endVal)) {
      const delta = endVal - startVal;
      const formatted = formatValue(delta, 'quantitative', resolveFormat(startCh));
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

  const units = Math.max(1, Math.round(spec.markDef.units ?? 100));

  // Cell counts per category come straight from the computed marks.
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
        content = { title: category, fields: buildExplicitTooltipFields(row, channels) };
      } else {
        content = {
          title: category,
          fields: [
            {
              label: resolveLabel(valueCh),
              value: formatValue(row[valueCh.field], valueCh.type, resolveFormat(valueCh)),
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

  // Waffle cells share one tooltip per category (the cells act as one target).
  if (spec.markType === 'waffle') {
    return computeWaffleTooltips(spec, marks);
  }

  const encoding = spec.encoding as Encoding;
  const descriptors = new Map<string, TooltipContent>();

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    let entries: Array<[string, TooltipContent]> = [];

    switch (mark.type) {
      case 'line':
        entries = tooltipsForLine(mark, encoding, i);
        break;
      case 'area':
        entries = tooltipsForArea(mark, encoding, i);
        break;
      case 'point':
        entries = tooltipsForPoint(mark, encoding, i);
        break;
      case 'rect':
        entries = tooltipsForRect(mark, encoding, i);
        break;
      case 'arc':
        entries = tooltipsForArc(mark, encoding, i);
        break;
    }

    for (const [key, content] of entries) {
      descriptors.set(key, content);
    }
  }

  return descriptors;
}
