/**
 * Breakpoint overrides for sankey specs (`spec.overrides[breakpoint]`).
 *
 * Mirrors the chart pipeline: the block for the container's breakpoint
 * (compact under 400px, medium 400 to 700px) merges over the top-level spec
 * before validation. Only the fields in {@link SANKEY_OVERRIDE_FIELDS} are
 * copied. `chrome` merges one level deep so a phone override can swap the title
 * without dropping the source line; every other field replaces its top-level
 * value.
 */

import { getBreakpoint } from '@opendata-ai/openchart-core';

/** The fields a sankey override block may set. */
export const SANKEY_OVERRIDE_FIELDS = [
  'chrome',
  'other',
  'nodeSort',
  'nodeLabelAlign',
  'nodePadding',
] as const;

/** The breakpoints a sankey override block may name. */
export const SANKEY_OVERRIDE_BREAKPOINTS = ['compact', 'medium'] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Return the spec with the override block for `width`'s breakpoint merged in.
 * A spec without a block for that breakpoint comes back unchanged (same
 * object). Keys outside {@link SANKEY_OVERRIDE_FIELDS} are never copied; the
 * validator reports them.
 */
export function applySankeyOverride(
  spec: Record<string, unknown>,
  width: number,
): Record<string, unknown> {
  if (!isPlainObject(spec.overrides)) return spec;
  const breakpoint = getBreakpoint(width);
  if (breakpoint === 'full') return spec;
  const block = spec.overrides[breakpoint];
  if (!isPlainObject(block)) return spec;

  const merged: Record<string, unknown> = { ...spec };
  for (const field of SANKEY_OVERRIDE_FIELDS) {
    if (block[field] === undefined) continue;
    merged[field] =
      field === 'chrome' && isPlainObject(block.chrome)
        ? { ...(isPlainObject(spec.chrome) ? spec.chrome : {}), ...block.chrome }
        : block[field];
  }
  return merged;
}
