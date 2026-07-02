/**
 * Legend row-wrap geometry.
 *
 * Shared helper for measuring how legend entries flow across horizontal rows
 * when wrapped at a max width. Both the main legend compute and the sankey
 * legend compile use this to size their legends — the main legend uses
 * `fittingCount` for truncation decisions, while sankey uses `rowCount` to
 * reserve vertical height.
 *
 * The geometry matches the existing layout exactly: each entry occupies
 * SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP pixels, a new row is
 * started when the accumulated row width plus the next entry would exceed
 * maxWidth (and the current row is non-empty), and rowWidths captures the
 * in-row accumulated width at the point of wrapping.
 */

import type { LegendEntry, TextStyle } from '@opendata-ai/openchart-core';
import { COMPACT_WIDTH, estimateTextWidth } from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
//
// Single source of truth for legend row geometry. Both compute.ts and the
// sankey compile site import these so the wrap math here can never drift from
// the layout math at the call sites.

export const SWATCH_SIZE = 12;
export const SWATCH_GAP = 6;
export const ENTRY_GAP = 16;
/** Tighter inter-entry gap for narrow viewports where every pixel matters. */
export const ENTRY_GAP_COMPACT = 10;

/** Default gap between legend bounds and chart area. Zero on narrow viewports. */
export const LEGEND_GAP = 8;

/** Gap between legend and chart area, responsive to container width. */
export function legendGap(width: number): number {
  return width < COMPACT_WIDTH ? 0 : LEGEND_GAP;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LegendWrapResult {
  /** Total number of rows the entries occupy when wrapped at maxWidth. */
  rowCount: number;
  /** Entries that fit within maxRows (for truncation). Equals entries.length when maxRows is not set or all entries fit. */
  fittingCount: number;
  /** Width (in px) of each row — callers can use for alignment. */
  rowWidths: number[];
  /** Per-entry placement: wrap row and x offset within that row. */
  placements: Array<{ row: number; xOffset: number }>;
}

/**
 * Measure how legend entries wrap across rows at a given max width.
 *
 * @param entries - Legend entries to measure.
 * @param maxWidth - Maximum width (in px) available for a single row.
 * @param labelStyle - Text style used to estimate label widths.
 * @param maxRows - Optional cap used only for the `fittingCount` truncation decision. When provided, `fittingCount` will be the index of the first entry that would spill onto a row beyond `maxRows`. `rowCount` is always the real row count regardless of this cap.
 */
export function measureLegendWrap(
  entries: LegendEntry[],
  maxWidth: number,
  labelStyle: TextStyle,
  maxRows?: number,
  entryGap: number = ENTRY_GAP,
  measure?: (text: string, fontSize: number, fontWeight: number) => number,
): LegendWrapResult {
  if (entries.length === 0) {
    return { rowCount: 0, fittingCount: 0, rowWidths: [], placements: [] };
  }

  const measureWidth = measure ?? estimateTextWidth;

  let rowCount = 1;
  let rowWidth = 0;
  const rowWidths: number[] = [];
  const placements: Array<{ row: number; xOffset: number }> = [];
  let fittingCount = entries.length;
  let fittingCountLocked = false;

  for (let i = 0; i < entries.length; i++) {
    const labelWidth = measureWidth(entries[i].label, labelStyle.fontSize, labelStyle.fontWeight);
    const entryWidth = SWATCH_SIZE + SWATCH_GAP + labelWidth + entryGap;

    if (rowWidth + entryWidth > maxWidth && rowWidth > 0) {
      rowWidths.push(rowWidth);
      rowCount++;
      placements.push({ row: rowCount - 1, xOffset: 0 });
      rowWidth = entryWidth;
      if (!fittingCountLocked && maxRows != null && rowCount > maxRows) {
        fittingCount = i;
        fittingCountLocked = true;
      }
    } else {
      placements.push({ row: rowCount - 1, xOffset: rowWidth });
      rowWidth += entryWidth;
    }
  }

  // Flush the final row width so rowWidths has one entry per row.
  rowWidths.push(rowWidth);

  return { rowCount, fittingCount, rowWidths, placements };
}
