import type { ColumnConfig } from '@openchart/core';
import { describe, expect, it } from 'vitest';
import { formatCell, formatValueForSearch } from '../format-cells';

describe('formatCell', () => {
  it('formats null as empty string', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(null, col);
    expect(result.formattedValue).toBe('');
    expect(result.value).toBeNull();
  });

  it('formats undefined as empty string', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(undefined, col);
    expect(result.formattedValue).toBe('');
    expect(result.value).toBeUndefined();
  });

  it('applies d3-format string to numbers', () => {
    const col: ColumnConfig = { key: 'x', format: ',.0f' };
    const result = formatCell(1234567, col);
    expect(result.formattedValue).toBe('1,234,567');
  });

  it('applies d3-format with dollar sign', () => {
    const col: ColumnConfig = { key: 'x', format: '$,.2f' };
    const result = formatCell(1234.5, col);
    expect(result.formattedValue).toBe('$1,234.50');
  });

  it('applies d3-format with percentage', () => {
    const col: ColumnConfig = { key: 'x', format: '.1%' };
    const result = formatCell(0.456, col);
    expect(result.formattedValue).toBe('45.6%');
  });

  it('auto-formats numbers without explicit format', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(42, col);
    // Should produce some formatted string (formatNumber)
    expect(result.formattedValue).toBeTruthy();
    expect(typeof result.formattedValue).toBe('string');
  });

  it('formats Date values', () => {
    const col: ColumnConfig = { key: 'x' };
    const date = new Date('2023-06-15');
    const result = formatCell(date, col);
    expect(result.formattedValue).toBeTruthy();
    expect(typeof result.formattedValue).toBe('string');
  });

  it('handles NaN gracefully (not numeric, falls through to String)', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(NaN, col);
    // NaN is not isFinite, so falls through to String(NaN)
    expect(result.formattedValue).toBe('NaN');
  });

  it('handles Infinity gracefully (not numeric, falls through to String)', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(Infinity, col);
    expect(result.formattedValue).toBe('Infinity');
  });

  it('handles -Infinity gracefully', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(-Infinity, col);
    expect(result.formattedValue).toBe('-Infinity');
  });

  it('does not crash on invalid d3-format string', () => {
    const col: ColumnConfig = { key: 'x', format: '%%%invalid%%%' };
    // Should not throw, falls through to auto-format
    const result = formatCell(42, col);
    expect(result.formattedValue).toBeTruthy();
  });

  it('formats plain strings as-is', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell('hello world', col);
    expect(result.formattedValue).toBe('hello world');
  });

  it('formats booleans as strings', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(true, col);
    expect(result.formattedValue).toBe('true');
  });

  it('preserves raw value in output', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell(42, col);
    expect(result.value).toBe(42);
  });

  it('returns empty style object', () => {
    const col: ColumnConfig = { key: 'x' };
    const result = formatCell('test', col);
    expect(result.style).toBeDefined();
  });

  it('d3-format string ignored for non-numeric values', () => {
    const col: ColumnConfig = { key: 'x', format: ',.0f' };
    const result = formatCell('not a number', col);
    expect(result.formattedValue).toBe('not a number');
  });
});

describe('formatValueForSearch', () => {
  it('returns empty string for null', () => {
    const col: ColumnConfig = { key: 'x' };
    expect(formatValueForSearch(null, col)).toBe('');
  });

  it('formats numbers with d3-format for search', () => {
    const col: ColumnConfig = { key: 'x', format: ',.0f' };
    expect(formatValueForSearch(1234, col)).toBe('1,234');
  });

  it('falls back to String for non-numeric values', () => {
    const col: ColumnConfig = { key: 'x' };
    expect(formatValueForSearch('hello', col)).toBe('hello');
  });
});
