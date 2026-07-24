/**
 * Automatic alt text generation for chart accessibility.
 *
 * Produces human-readable descriptions of chart content for screen readers
 * and a tabular fallback for data access.
 */

import type { ChartSpec, DataRow } from '../types/spec';
import { MARK_DISPLAY_NAMES, resolveMarkDef, resolveMarkType } from '../types/spec';

// ---------------------------------------------------------------------------
// Alt text generation
// ---------------------------------------------------------------------------

/**
 * Generate alt text describing a chart's content.
 *
 * Produces a description like:
 * "Line chart showing GDP Growth Rate from 2020 to 2024 with 2 series (US, UK)"
 *
 * @param spec - The chart spec.
 * @param data - The data array.
 */
export function generateAltText(spec: ChartSpec, data: DataRow[]): string {
  const markType = resolveMarkType(spec.mark);
  const markDef = resolveMarkDef(spec.mark);
  let chartName = MARK_DISPLAY_NAMES[markType] ?? `${markType} chart`;

  // Special case: donut detection
  if (markType === 'arc' && markDef.innerRadius && markDef.innerRadius > 0) {
    chartName = 'Donut chart';
  }

  const parts: string[] = [chartName];

  // Add title context if present
  const title = spec.chrome?.title;
  if (title) {
    const titleText = typeof title === 'string' ? title : title.text;
    parts.push(`showing ${titleText}`);
  }

  // Waffle: name the unit framing. Per-category "x of N units" phrasing
  // lives on the mark aria labels; the chart-level text carries the total.
  if (markType === 'waffle') {
    const units = markDef.units ?? 100;
    parts.push(`dividing ${units} units`);
  }

  // Parliament: name the total seat count and the majority threshold, the two
  // numbers a reader most wants. Per-party seat counts live on the seat marks'
  // aria labels; this carries the overall framing.
  if (markType === 'parliament') {
    const valueField = spec.encoding.theta?.field ?? spec.encoding.y?.field;
    if (valueField) {
      const totalSeats = data.reduce((sum, d) => {
        const v = Number(d[valueField]);
        return sum + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0);
      if (totalSeats > 0) {
        const majority = Math.floor(totalSeats / 2) + 1;
        parts.push(`with ${totalSeats} seats, ${majority} needed for a majority`);
      }
    }
  }

  // Beeswarm: name the distribution fields (value axis + optional lane).
  // Skips the generic x-axis description below, which would either say
  // nothing (quantitative value axis) or repeat the lane count.
  if (markType === 'beeswarm') {
    const xIsValue = spec.encoding.x?.type === 'quantitative';
    const valueField = xIsValue ? spec.encoding.x?.field : spec.encoding.y?.field;
    const laneField = xIsValue ? spec.encoding.y?.field : spec.encoding.x?.field;
    if (valueField) {
      parts.push(
        `plotting the distribution of ${valueField}${laneField ? ` by ${laneField}` : ''}`,
      );
    }
  }

  // Describe the data range
  if (spec.encoding.x && markType !== 'beeswarm' && data.length > 0) {
    const field = spec.encoding.x.field;
    const values = data.map((d) => d[field]).filter((v) => v != null);

    if (values.length > 0) {
      if (spec.encoding.x.type === 'temporal') {
        const dates = values.map((v) => (v instanceof Date ? v : new Date(String(v))));
        const validDates = dates.filter((d) => !Number.isNaN(d.getTime()));
        if (validDates.length >= 2) {
          validDates.sort((a, b) => a.getTime() - b.getTime());
          const first = validDates[0].getUTCFullYear();
          const last = validDates[validDates.length - 1].getUTCFullYear();
          if (first !== last) {
            parts.push(`from ${first} to ${last}`);
          }
        }
      } else if (spec.encoding.x.type === 'nominal' || spec.encoding.x.type === 'ordinal') {
        const uniqueValues = [...new Set(values.map(String))];
        parts.push(`across ${uniqueValues.length} categories`);
      }
    }
  }

  // Describe series if color encoding is present
  if (spec.encoding.color && 'field' in spec.encoding.color && data.length > 0) {
    const colorField = spec.encoding.color.field;
    const uniqueSeries = [...new Set(data.map((d) => String(d[colorField])).filter(Boolean))];
    if (uniqueSeries.length > 0) {
      parts.push(`with ${uniqueSeries.length} series (${uniqueSeries.join(', ')})`);
    }
  }

  // Add data point count
  parts.push(`(${data.length} data points)`);

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Data table fallback
// ---------------------------------------------------------------------------

/**
 * Maximum number of data rows in the screen-reader table. A 50k-point scatter
 * would otherwise put 50k hidden rows in the DOM.
 */
export const MAX_SR_TABLE_ROWS = 1000;

/**
 * Generate a tabular data fallback for screen readers.
 *
 * Returns a 2D array where the first row is headers and subsequent
 * rows are data values. Only includes fields referenced in the encoding.
 *
 * Data rows are capped at MAX_SR_TABLE_ROWS (the header row does not count
 * against the cap). SCOPE: this caps the chart compile path only. Graph,
 * sankey, tilemap and map build their `dataTableFallback` independently and
 * stay uncapped.
 *
 * @param spec - The chart spec.
 * @param data - The data array.
 */
export function generateDataTable(spec: ChartSpec, data: DataRow[]): unknown[][] {
  // Collect fields from encoding
  const fields: string[] = [];
  const encoding = spec.encoding;

  if (encoding.x) fields.push(encoding.x.field);
  if (encoding.y) fields.push(encoding.y.field);
  if (encoding.color && 'field' in encoding.color) fields.push(encoding.color.field);
  if (encoding.size && 'field' in encoding.size) fields.push(encoding.size.field);

  // Deduplicate
  const uniqueFields = [...new Set(fields)];

  if (uniqueFields.length === 0) return [];

  // Header row
  const headers = uniqueFields;

  // Data rows
  const rows = data
    .slice(0, MAX_SR_TABLE_ROWS)
    .map((row) => uniqueFields.map((field) => row[field] ?? ''));

  return [headers, ...rows];
}
