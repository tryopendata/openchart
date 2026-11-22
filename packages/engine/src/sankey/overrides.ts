/**
 * Breakpoint overrides for sankey specs (`spec.overrides[breakpoint]`).
 *
 * Mirrors the chart pipeline: the block for the container's breakpoint
 * (compact under 400px, medium 400 to 700px) merges over the top-level spec
 * before validation. `chrome` merges one level deep so a phone override can
 * swap the title without dropping the source line; every other field
 * replaces its top-level value.
 */

import type { SankeySpec } from '@opendata-ai/openchart-core';
import { getBreakpoint } from '@opendata-ai/openchart-core';

/** One breakpoint's override block. */
type SankeyOverrideBlock = NonNullable<NonNullable<SankeySpec['overrides']>['compact']>;

/**
 * Return the spec with the override block for `width`'s breakpoint merged in.
 * A spec without a block for that breakpoint comes back unchanged (same
 * object). Malformed `overrides` are left for the validator to report.
 */
export function applySankeyOverride(
  spec: Record<string, unknown>,
  width: number,
): Record<string, unknown> {
  const overrides = spec.overrides;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return spec;
  const breakpoint = getBreakpoint(width);
  if (breakpoint === 'full') return spec;
  const block = (overrides as Record<string, unknown>)[breakpoint];
  if (!block || typeof block !== 'object' || Array.isArray(block)) return spec;

  const { chrome, ...rest } = block as SankeyOverrideBlock;
  const merged: Record<string, unknown> = { ...spec, ...rest };
  if (chrome) {
    const baseChrome =
      spec.chrome && typeof spec.chrome === 'object'
        ? (spec.chrome as Record<string, unknown>)
        : {};
    merged.chrome = { ...baseChrome, ...chrome };
  }
  return merged;
}
