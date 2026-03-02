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
  LineMark,
  Mark,
  PointMark,
  RectMark,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/core';
import { formatDate, formatNumber } from '@opendata-ai/core';
import { format as d3Format } from 'd3-format';

import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a raw data value for tooltip display. */
function formatValue(value: unknown, fieldType?: string, format?: string): string {
  if (value == null) return '';

  if (fieldType === 'temporal' || value instanceof Date) {
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

/** Build tooltip fields from a data row based on the spec encoding. */
function buildFields(row: DataRow, encoding: Encoding, color?: string): TooltipField[] {
  const fields: TooltipField[] = [];

  // Y-axis value (the "main" value in most charts)
  if (encoding.y) {
    fields.push({
      label: encoding.y.axis?.label ?? encoding.y.field,
      value: formatValue(row[encoding.y.field], encoding.y.type, encoding.y.axis?.format),
      color,
    });
  }

  // X-axis value (often the category or date)
  if (encoding.x) {
    fields.push({
      label: encoding.x.axis?.label ?? encoding.x.field,
      value: formatValue(row[encoding.x.field], encoding.x.type, encoding.x.axis?.format),
    });
  }

  // Size (for scatter/bubble)
  if (encoding.size) {
    fields.push({
      label: encoding.size.axis?.label ?? encoding.size.field,
      value: formatValue(row[encoding.size.field], encoding.size.type, encoding.size.axis?.format),
    });
  }

  return fields;
}

/** Determine the title for a tooltip based on encoding. */
function getTooltipTitle(row: DataRow, encoding: Encoding): string | undefined {
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

  // For color-encoded series, use the series name
  if (encoding.color) {
    return String(row[encoding.color.field] ?? '');
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Per-mark-type tooltip generation
// ---------------------------------------------------------------------------

function tooltipsForLine(
  _mark: LineMark,
  _encoding: Encoding,
  _markIndex: number,
): Array<[string, TooltipContent]> {
  // Line marks themselves don't get individual tooltips.
  // The point marks at each data point handle that.
  return [];
}

function tooltipsForPoint(
  mark: PointMark,
  encoding: Encoding,
  markIndex: number,
): Array<[string, TooltipContent]> {
  const title = getTooltipTitle(mark.data, encoding);
  const fields = buildFields(mark.data, encoding, mark.fill);

  return [[`point-${markIndex}`, { title, fields }]];
}

function tooltipsForRect(
  mark: RectMark,
  encoding: Encoding,
  markIndex: number,
): Array<[string, TooltipContent]> {
  const title = getTooltipTitle(mark.data, encoding);
  const fields = buildFields(mark.data, encoding, mark.fill);

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
  if (encoding.color) {
    const categoryName = String(row[encoding.color.field] ?? '');
    if (encoding.y) {
      fields.push({
        label: categoryName,
        value: formatValue(row[encoding.y.field], encoding.y.type, encoding.y.axis?.format),
        color: mark.fill,
      });
    }
  } else if (encoding.y) {
    fields.push({
      label: encoding.y.field,
      value: formatValue(row[encoding.y.field], encoding.y.type, encoding.y.axis?.format),
      color: mark.fill,
    });
  }

  const title = encoding.color ? String(row[encoding.color.field] ?? '') : undefined;

  return [[`arc-${markIndex}`, { title, fields }]];
}

function tooltipsForArea(
  _mark: AreaMark,
  _encoding: Encoding,
  _markIndex: number,
): Array<[string, TooltipContent]> {
  // Area marks are background fills; point marks on top handle tooltips.
  return [];
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
