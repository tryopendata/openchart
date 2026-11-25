/** Finding rows that share an identity and a period, read the way the playback matrix reads them. */
import { type PlaybackTimeType, readPeriod } from './periods';

/** An identity and period more than one row carries. */
export interface DuplicateCell {
  identity: string;
  period: string | number;
  count: number;
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The first identity and period pair (in first-seen order) that more than one row carries,
 * with its row count. Periods are read with `readPeriod`, so a period of the year 2020 and
 * one of the string '2020' stay apart, as they do in the matrix. Rows with no identity
 * (`identityOf` returns undefined) or whose period doesn't read are skipped.
 */
export function firstDuplicateCell(
  rows: unknown[],
  identityOf: (row: Record<string, unknown>) => string | undefined,
  time: { field: string; type: PlaybackTimeType },
): DuplicateCell | undefined {
  const cells = new Map<string, DuplicateCell>();
  for (const row of rows) {
    if (!isRow(row)) continue;
    const identity = identityOf(row);
    if (identity === undefined) continue;
    const period = readPeriod(row[time.field], time.type);
    if (!period) continue;
    const cell = `${identity}\u0000${typeof period.value}\u0000${String(period.value)}`;
    const seen = cells.get(cell);
    if (seen) seen.count += 1;
    else cells.set(cell, { identity, period: period.value, count: 1 });
  }
  for (const cell of cells.values()) {
    if (cell.count > 1) return cell;
  }
  return undefined;
}
