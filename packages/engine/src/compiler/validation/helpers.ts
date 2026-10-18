/** Shared validation helpers: field-type checks, did-you-mean column suggestions, and color scheme name checks. */
import {
  jsonPointer,
  resolveSchemeName,
  SEQUENTIAL_PALETTES,
  SUPPORTED_SCHEME_NAMES,
} from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const VALID_FIELD_TYPES = new Set<string>([
  'quantitative',
  'temporal',
  'nominal',
  'ordinal',
]);

/** Check if a value looks like a parseable date. */
export function isParseableDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') {
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  }
  if (typeof value === 'number') return true;
  return false;
}

/** Check if a value is numeric. */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    const n = Number(value);
    return !Number.isNaN(n) && Number.isFinite(n);
  }
  return false;
}

/**
 * Levenshtein edit distance between two strings (case-insensitive). Used to
 * turn a misspelled field reference into a "did you mean" repair hint.
 */
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Single-row DP: prev[j] holds distance for the previous source char.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Given a misspelled field name and the actual data columns, return the nearest
 * column when it is close enough to be a plausible typo, else undefined.
 *
 * The threshold scales with word length (at most ~40% of the target length, and
 * never more than 3 edits) so short columns don't match unrelated names.
 */
function nearestColumn(field: string, columns: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const column of columns) {
    const distance = editDistance(field, column);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = column;
    }
  }
  if (best === undefined) return undefined;
  const threshold = Math.min(3, Math.max(1, Math.floor(best.length * 0.4)));
  return bestDistance <= threshold ? best : undefined;
}

/**
 * Build the "did you mean" clause appended to DATA_FIELD_MISSING suggestions.
 * Returns an empty string when no column is a plausible near-match.
 */
export function didYouMean(field: string, columns: string[]): string {
  const match = nearestColumn(field, columns);
  return match ? ` Did you mean "${match}"?` : '';
}

/**
 * Push an INVALID_VALUE error when a channel carries an unrecognized
 * scale.scheme name. Chart specs are the only family that consumes schemes
 * this way: known names (including VL aliases) resolve via the core palette
 * registry and are expanded to scale.range by the pre-validation sugar pass,
 * so `resolveSchemeName` failing means the name is unknown.
 */
export function checkSchemeName(
  channelObj: Record<string, unknown>,
  channelPath: readonly string[],
  errors: ValidationError[],
): void {
  const scale = channelObj.scale as Record<string, unknown> | undefined;
  if (scale && typeof scale.scheme === 'string' && !resolveSchemeName(scale.scheme)) {
    errors.push({
      message: `Spec error: ${channelPath.join('.')}.scale.scheme "${scale.scheme}" is not a supported scheme name`,
      path: jsonPointer(...channelPath, 'scale', 'scheme'),
      code: 'INVALID_VALUE',
      suggestion: `Use one of the supported scheme names: ${[...SUPPORTED_SCHEME_NAMES].join(', ')}. Or provide explicit colors via scale.range.`,
    });
  }
}

/**
 * Push an INVALID_VALUE error when any channel of an encoding block carries a
 * scale.scheme on a spec family whose compile path never reads it. Even a
 * known scheme name is dead config there — silently accepting it would leave
 * the author believing they chose the colors.
 */
export function checkSchemeUnused(
  encoding: Record<string, unknown>,
  errors: ValidationError[],
  familyNote: string,
  suggestion: string,
): void {
  for (const [channel, ch] of Object.entries(encoding)) {
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;
    const scale = (ch as Record<string, unknown>).scale as Record<string, unknown> | undefined;
    if (scale && typeof scale.scheme === 'string') {
      errors.push({
        message: `Spec error: encoding.${channel}.scale.scheme has no effect — ${familyNote}`,
        path: jsonPointer('encoding', channel, 'scale', 'scheme'),
        code: 'INVALID_VALUE',
        suggestion,
      });
    }
  }
}

/** Palette names the map compile path actually supports (sequential only). */
export const MAP_PALETTE_NAMES = Object.keys(SEQUENTIAL_PALETTES).join(', ');

/**
 * Map color channels resolve scale.scheme against SEQUENTIAL_PALETTES with a
 * silent fallback to blue — a typo'd scheme would render the default palette
 * with no signal. Reject names outside the map's supported set here instead.
 * Categorical channels never read schemes at all (colors come from
 * scale.domain/scale.range), so any scheme there is dead config.
 */
export function checkMapSchemeName(
  channelObj: Record<string, unknown>,
  channelPath: readonly string[],
  errors: ValidationError[],
): void {
  const scale = channelObj.scale as Record<string, unknown> | undefined;
  if (!scale || typeof scale.scheme !== 'string') return;

  if (channelObj.type === 'nominal' || channelObj.type === 'ordinal') {
    errors.push({
      message: `Spec error: ${channelPath.join('.')}.scale.scheme has no effect — categorical map colors come from scale.range and scale.domain`,
      path: jsonPointer(...channelPath, 'scale', 'scheme'),
      code: 'INVALID_VALUE',
      suggestion:
        'Remove scale.scheme. To customize categorical map colors, provide explicit colors via scale.range (with scale.domain for category order).',
    });
    return;
  }

  if (!(scale.scheme in SEQUENTIAL_PALETTES)) {
    errors.push({
      message: `Spec error: ${channelPath.join('.')}.scale.scheme "${scale.scheme}" is not a supported map palette`,
      path: jsonPointer(...channelPath, 'scale', 'scheme'),
      code: 'INVALID_VALUE',
      suggestion: `Maps support the sequential palettes: ${MAP_PALETTE_NAMES}. The default is "blue".`,
    });
  }
}
