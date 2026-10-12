import type { DataRow, FieldMetadata, VizSpec } from '@opendata-ai/openchart-core';
import { csvParseRows, tsvParseRows } from 'd3-dsv';

export type FieldType = 'text' | 'number' | 'date';
export interface ImportedData {
  rows: DataRow[];
  fields: Record<string, FieldType>;
  key: string;
}

export const MAX_IMPORT_BYTES = 5_000_000;
export const MAX_IMPORT_ROWS = 20_000;

/** Apply the same limit to files, pasted text, JSON, and recovered drafts. */
export function checkImportSize(text: string): void {
  if (new Blob([text]).size > MAX_IMPORT_BYTES)
    throw new Error('Choose a document smaller than 5 MB.');
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))
    return false;
  const day = value.slice(0, 10);
  const midnight = new Date(`${day}T00:00:00Z`);
  return (
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(midnight.getTime()) &&
    midnight.toISOString().slice(0, 10) === day
  );
}

/** Field types are document metadata, never transient inspector state. */
export function fieldType(
  data: DataRow[],
  field: string,
  fields?: Record<string, FieldMetadata>,
): FieldType {
  return fields?.[field]?.type ?? inferField(data.map((row) => row[field]));
}

/** Only strict, unambiguous numbers/dates are inferred. Leading-zero IDs stay text. */
export function inferField(values: unknown[]): FieldType {
  const present = values.filter((value) => value !== '' && value != null).map(String);
  if (
    present.length &&
    present.every(
      (value) =>
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value)),
    )
  )
    return 'number';
  if (present.length && present.every(validDate)) return 'date';
  return 'text';
}

export function coerceField(value: unknown, type: FieldType): unknown {
  if (value === '' || value == null) return null;
  if (type === 'text') return String(value);
  if (type === 'number') {
    const source = String(value).trim();
    const number =
      source && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(source)
        ? Number(source)
        : Number.NaN;
    if (!Number.isFinite(number))
      throw new Error(`“${String(value)}” is not a number. Correct the value or choose Text.`);
    return number;
  }
  if (!validDate(String(value)))
    throw new Error(
      `“${String(value)}” is not a valid ISO date. Use YYYY-MM-DD or a timestamp with a time zone.`,
    );
  return new Date(String(value)).toISOString();
}

export function importDelimited(
  text: string,
  id: () => string = () => crypto.randomUUID(),
): ImportedData {
  checkImportSize(text);
  const rows = (text.split(/\r?\n/, 1)[0].includes('\t') ? tsvParseRows : csvParseRows)(
    text.replace(/^\uFEFF/, ''),
  );
  const headers = rows.shift()?.map((value) => value.trim());
  if (
    !headers?.length ||
    headers.some((value) => !value) ||
    new Set(headers).size !== headers.length
  )
    throw new Error('Give every column a unique, nonempty heading.');
  const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
  if (headers.some((header) => unsafe.has(header)))
    throw new Error('Rename the reserved column heading before importing.');
  const populated = rows.filter((row) => row.some((value) => value !== ''));
  if (!populated.length) throw new Error('Add at least one data row below the headings.');
  if (populated.length > MAX_IMPORT_ROWS)
    throw new Error('This workbench accepts up to 20,000 rows.');
  if (populated.some((row) => row.length !== headers.length))
    throw new Error(
      'Every row must have the same number of columns as the headings. Check delimiters and quoted values.',
    );
  const expandedHeaders =
    populated.length * headers.reduce((sum, header) => sum + JSON.stringify(header).length + 3, 0);
  if (expandedHeaders + text.length > 5 * MAX_IMPORT_BYTES)
    throw new Error(
      'Column headings repeated across these rows exceed the document limit. Shorten headings or reduce the data.',
    );
  const fields = Object.fromEntries(
    headers.map((header, index) => [header, inferField(populated.map((row) => row[index]))]),
  );
  let key = '_rowId';
  while (headers.includes(key)) key = `_${key}`;
  const imported = {
    key,
    fields,
    rows: populated.map((row) =>
      Object.fromEntries([
        [key, id()],
        ...headers.map((header, index) => [header, coerceField(row[index], fields[header])]),
      ]),
    ),
  };
  checkImportSize(JSON.stringify(imported.rows));
  return imported;
}

export interface DocumentHistory<T = VizSpec> {
  past: T[];
  present: T;
  future: T[];
}
export function editDocument(
  history: DocumentHistory<VizSpec>,
  next: VizSpec,
): DocumentHistory<VizSpec>;
export function editDocument<T>(history: DocumentHistory<T>, next: T): DocumentHistory<T>;
export function editDocument<T>(history: DocumentHistory<T>, next: T): DocumentHistory<T> {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return { past: [...history.past, history.present].slice(-100), present: next, future: [] };
}
export function undoDocument<T>(history: DocumentHistory<T>): DocumentHistory<T> {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}
export function redoDocument<T>(history: DocumentHistory<T>): DocumentHistory<T> {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
