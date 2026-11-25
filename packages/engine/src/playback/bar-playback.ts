/**
 * Bar-specific envelope rows for playback. The envelope holds every period's rows at once, so
 * a stacked bar axis would sum each category's segments across all periods. These rows keep
 * one period per category instead: the one whose stack is tallest, so the frozen value axis
 * fits the tallest stack any single frame draws.
 */
import type { ChartSpec, DataRow, Encoding, EncodingChannel } from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';

/** The fields of a bar chart whose value axis is sized from summed stacks. */
export interface SummedStackFields {
  value: string;
  category: string;
  color: string;
}

const STACK_MODES = new Set<unknown>([true, 'zero', 'center']);
const CATEGORY_TYPES = new Set<unknown>(['nominal', 'ordinal', 'temporal']);

function fieldOf(channel: unknown): EncodingChannel | undefined {
  if (typeof channel !== 'object' || channel === null) return undefined;
  return typeof (channel as { field?: unknown }).field === 'string'
    ? (channel as EncodingChannel)
    : undefined;
}

/**
 * Whether the scale builder sums a stacked bar's segments into its value domain, and from
 * which fields: the same test `layout/scales.ts` applies (an explicit stack, or a temporal
 * category with the stack left unset). Normalized stacks are left out since their domain is
 * always [0, 1], and mirrored bars never stack.
 */
export function summedStackFields(spec: ChartSpec): SummedStackFields | undefined {
  const mark = typeof spec.mark === 'string' ? { type: spec.mark } : spec.mark;
  if (mark.type !== 'bar' || (mark as { mirror?: boolean }).mirror === true) return undefined;
  const encoding = spec.encoding as Encoding;
  const color = fieldOf(encoding.color);
  const x = fieldOf(encoding.x);
  const y = fieldOf(encoding.y);
  if (!color || !x || !y) return undefined;
  const horizontal = x.type === 'quantitative';
  const value = horizontal ? x : y;
  const category = horizontal ? y : x;
  if (value.type !== 'quantitative' || !CATEGORY_TYPES.has(category.type)) return undefined;
  const summed =
    STACK_MODES.has(value.stack) || (category.type === 'temporal' && value.stack === undefined);
  if (!summed) return undefined;
  return { value: value.field, category: category.field, color: color.field };
}

/** Each category's period with the largest sum of positive values. */
function tallestPeriods(
  rows: DataRow[],
  fields: SummedStackFields,
  timeField: string,
): Map<string, unknown> {
  const sums = new Map<string, Map<unknown, number>>();
  for (const row of rows) {
    const value = finiteNumber(row[fields.value]);
    if (value === undefined || value <= 0) continue;
    const category = String(row[fields.category] ?? '');
    const byPeriod = sums.get(category) ?? new Map<unknown, number>();
    byPeriod.set(row[timeField], (byPeriod.get(row[timeField]) ?? 0) + value);
    sums.set(category, byPeriod);
  }
  const tallest = new Map<string, unknown>();
  for (const [category, byPeriod] of sums) {
    let best = -Infinity;
    for (const [period, sum] of byPeriod) {
      if (sum > best) {
        best = sum;
        tallest.set(category, period);
      }
    }
  }
  return tallest;
}

/**
 * Envelope rows for a summed stack, in the original row order: every row from its
 * category's tallest period, every negative row (stacks only sum positives, and the axis
 * floor comes from single values), and one zero-valued row for each color and category
 * pair missing from those, so every key still reaches the color and category domains.
 *
 * @param timeField - Field holding each envelope row's period value.
 */
export function tallestStackRows(
  rows: DataRow[],
  fields: SummedStackFields,
  timeField: string,
): DataRow[] {
  const tallest = tallestPeriods(rows, fields, timeField);
  const keyOf = (row: DataRow) =>
    `${String(row[fields.color] ?? '')}|${String(row[fields.category] ?? '')}`;
  const inTallest = (row: DataRow) =>
    row[timeField] === tallest.get(String(row[fields.category] ?? ''));
  const keysKept = new Set(rows.filter(inTallest).map(keyOf));
  const kept: DataRow[] = [];
  for (const row of rows) {
    const value = finiteNumber(row[fields.value]);
    if (inTallest(row) || (value !== undefined && value < 0)) {
      keysKept.add(keyOf(row));
      kept.push(row);
      continue;
    }
    const key = keyOf(row);
    if (keysKept.has(key)) continue;
    keysKept.add(key);
    kept.push({ ...row, [fields.value]: 0 });
  }
  return kept;
}
