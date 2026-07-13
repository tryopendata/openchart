/**
 * Cell value formatting for table columns.
 *
 * Handles number formatting (d3-format), date formatting, and
 * null/undefined values. Produces the formattedValue string and
 * base style for each cell.
 */

import type { CellStyle, ColumnConfig, TableCellBase } from '@opendata-ai/openchart-core';
import {
  buildD3Formatter,
  defaultNumberFormatter,
  formatDate,
  resolveNumberFormatter,
} from '@opendata-ai/openchart-core';

/**
 * Check if a value is numeric (finite number or parseable numeric string).
 */
function isNumericValue(value: unknown): value is number {
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
}

/**
 * Check if a value is a date.
 */
function isDateValue(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return false;
}

/**
 * Format a raw cell value into a display string with styling.
 *
 * Formatting precedence:
 * 1. null/undefined -> ""
 * 2. column.format (d3-format string) for numbers
 * 3. Auto-format: numbers via formatNumber, dates via formatDate
 * 4. Fallback: String(value)
 */
export function formatCell(value: unknown, column: ColumnConfig): TableCellBase {
  const style: CellStyle = {};

  // Null/undefined -> empty
  if (value == null) {
    return {
      value,
      formattedValue: '',
      style,
    };
  }

  // If column has a format string and value is numeric
  if (column.format && isNumericValue(value)) {
    const formatter =
      resolveNumberFormatter(column.format, { surface: 'table' }) ??
      buildD3Formatter(column.format);
    if (formatter) {
      return {
        value,
        formattedValue: formatter(value),
        style,
      };
    }
  }

  // Auto-format numbers (tables get full precision, no compact notation)
  if (isNumericValue(value)) {
    return {
      value,
      formattedValue: defaultNumberFormatter({ surface: 'table' })(value),
      style,
    };
  }

  // Auto-format dates
  if (isDateValue(value)) {
    return {
      value,
      formattedValue: formatDate(value as Date),
      style,
    };
  }

  // String and everything else
  return {
    value,
    formattedValue: String(value),
    style,
  };
}

/**
 * Format a value into a string for search indexing.
 * Uses d3-format for numeric columns, otherwise String().
 */
export function formatValueForSearch(value: unknown, column: ColumnConfig): string {
  if (value == null) return '';

  if (column.format && isNumericValue(value)) {
    const formatter =
      resolveNumberFormatter(column.format, { surface: 'table' }) ??
      buildD3Formatter(column.format);
    if (formatter) {
      return formatter(value);
    }
  }

  if (isNumericValue(value)) {
    return defaultNumberFormatter({ surface: 'table' })(value);
  }

  return String(value);
}
