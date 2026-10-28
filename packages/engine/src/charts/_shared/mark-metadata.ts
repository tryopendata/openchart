import type { DataRow, Encoding, Mark, MarkType } from '@opendata-ai/openchart-core';
import { buildTemporalFormatter, formatDate } from '@opendata-ai/openchart-core';
import { resolveFieldFormatter } from '../../format/field-format';

const RESERVED_SUFFIXES = new Set([
  'mark',
  'mark-id',
  'series',
  'key',
  'theme',
  'display',
  'animation-index',
  'row-index',
  'navigation-key',
  'note-marker-index',
  'note-spec-index',
]);

export function identityForRows(encoding: Encoding, rows: DataRow[]): Record<string, string> {
  const identity: Record<string, string> = {};
  const fields = new Set<string>();
  for (const name of ['x', 'y', 'color', 'detail', 'key'] as const) {
    const channel = encoding[name];
    if (!channel || !('field' in channel)) continue;
    if ((name === 'x' || name === 'y') && channel.type === 'quantitative') continue;
    fields.add(channel.field);
  }
  for (const field of fields) {
    const value = rows[0]?.[field];
    // A series path only claims identity fields shared by all its observations.
    if (
      value == null ||
      !rows.every((row) => row[field] != null && String(row[field]) === String(value))
    )
      continue;
    let suffix = field.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (RESERVED_SUFFIXES.has(suffix)) suffix = `field-${suffix}`;
    identity[suffix] = String(value);
  }
  return identity;
}

export function descriptionForRows(
  encoding: Encoding,
  rows: DataRow[],
  warnings: string[],
  series?: string,
): string | undefined {
  const channel = encoding.description;
  if (!channel) return undefined;
  if ('value' in channel) return channel.value;
  const value = rows[0]?.[channel.field];
  if (!rows.every((row) => Object.is(row[channel.field], value))) {
    warnings.push(
      `[openchart] encoding.description has mixed values in series "${series ?? 'series'}"; no series description was emitted.`,
    );
    return undefined;
  }
  if (value == null) return undefined;
  if (channel.type === 'temporal' || value instanceof Date) {
    const format = buildTemporalFormatter(channel.format);
    return format
      ? format(value as Date | string | number)
      : formatDate(value as Date | string | number);
  }
  if (typeof value === 'number')
    return resolveFieldFormatter({
      channelFormat: channel.format,
      values: rows.map((row) => row[channel.field]),
    })(value);
  return String(value);
}

/** Attach row provenance after geometry computation, before tooltips and a11y.
 * authoredDescription is distinct from aria.description and from generated labels.
 */
export function attachMarkMetadata(
  marks: Mark[],
  encoding: Encoding,
  sourceMarkType: MarkType,
  warnings: string[],
): void {
  for (const mark of marks) {
    if (
      (sourceMarkType === 'range' && mark.type === 'point') ||
      ((sourceMarkType === 'lollipop' || sourceMarkType === 'circle') && mark.type === 'rect')
    )
      mark.aria = { ...mark.aria, decorative: true };
    if (mark.aria.decorative) continue;
    const rows: DataRow[] = mark.type === 'line' || mark.type === 'area' ? mark.data : [mark.data];
    if (!rows.length) continue;
    mark.markType =
      (sourceMarkType === 'line' || sourceMarkType === 'area') && mark.type === 'point'
        ? 'point'
        : sourceMarkType;
    mark.identity = identityForRows(encoding, rows);
    const description = descriptionForRows(
      encoding,
      rows,
      warnings,
      'seriesKey' in mark ? mark.seriesKey : undefined,
    );
    if (description !== undefined) {
      mark.authoredDescription = description;
      mark.aria = { ...mark.aria, label: description };
    }
  }
}
