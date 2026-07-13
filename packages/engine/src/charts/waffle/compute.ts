/**
 * Waffle chart mark computation.
 *
 * A unit grid ("3 in 100 people") for part-to-whole counts. Category values
 * aggregate by the nominal color field, normalize to `markDef.units` cells
 * via largest-remainder rounding (cells always sum exactly to units), and
 * fill the grid bottom-left to top-right by rows, matching how readers count.
 *
 * Geometry: square cells with a gap of cell/6, grid centered in the chart
 * area. No positional scales are consumed; the value comes straight from the
 * data (the `theta` channel aliases to `y` in the sugar pass, same as arc).
 *
 * Zero-cell categories are legitimate: a nonzero share can round to 0 cells
 * and there is deliberately no minimum-1-cell rule (a floor would distort the
 * other categories). The legend still lists the category because legend
 * entries derive from data, not marks.
 */

import type {
  DataRow,
  Encoding,
  LayoutStrategy,
  MarkAria,
  Rect,
  RectMark,
} from '@opendata-ai/openchart-core';
import { formatPercent } from '@opendata-ai/openchart-core';

import { serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default total cell count (the "out of 100" framing). */
const DEFAULT_UNITS = 100;

/** Default column count (10x10 grid at the default units). */
const DEFAULT_COLUMNS = 10;

/** Default cell corner radius (px). Subtle rounding; cells stay data-crisp. */
const DEFAULT_CORNER_RADIUS = 1;

/** Gap between cells as a fraction of the cell size. */
const GAP_FRACTION = 1 / 6;

// ---------------------------------------------------------------------------
// Largest-remainder rounding
// ---------------------------------------------------------------------------

/**
 * Allocate `units` integer cells across `values` proportionally using the
 * largest-remainder method, so the result always sums exactly to `units`.
 *
 * Tiebreak is deterministic and never depends on map iteration order:
 * equal remainders break by larger raw value, then by stable input index.
 * Non-finite and negative values allocate 0 cells.
 */
export function largestRemainderCells(values: number[], units: number): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((sum, v) => sum + v, 0);
  const cells = new Array<number>(values.length).fill(0);
  if (total <= 0 || units <= 0) return cells;

  const quotas = clean.map((v) => (v / total) * units);
  let allocated = 0;
  for (let i = 0; i < quotas.length; i++) {
    cells[i] = Math.floor(quotas[i]);
    allocated += cells[i];
  }

  // Distribute the leftover cells to the largest remainders. Ties break by
  // larger raw value, then smaller input index (stable and deterministic).
  const order = quotas
    .map((q, i) => ({ remainder: q - Math.floor(q), value: clean[i], index: i }))
    .sort((a, b) => b.remainder - a.remainder || b.value - a.value || a.index - b.index);
  for (let k = 0; k < units - allocated; k++) {
    cells[order[k].index] += 1;
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute waffle cell marks from a normalized chart spec.
 *
 * Categories come from the color field (aggregated in data order, matching
 * pie), the share value from the quantitative y channel (theta pre-aliased
 * to y). Emits one RectMark per cell in fill order (bottom-left to top-right
 * by rows), which also drives the entrance-stagger sweep.
 */
export function computeWaffleMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  _strategy: LayoutStrategy,
): RectMark[] {
  const encoding = spec.encoding as Encoding;

  const valueChannel = encoding.y ?? encoding.x;
  const colorField = encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;
  if (!valueChannel || !colorField) return [];

  // Aggregate values by category, preserving data order (drives cell order,
  // color assignment, and the legend, which derives the same order from data).
  const categoryTotals = new Map<string, number>();
  const categoryRows = new Map<string, DataRow>();
  for (const row of spec.data) {
    const cat = String(row[colorField] ?? '');
    const val = Number(row[valueChannel.field] ?? 0);
    if (!Number.isFinite(val) || val < 0) continue;

    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + val);
    if (!categoryRows.has(cat)) {
      categoryRows.set(cat, row);
    }
  }

  const categories = [...categoryTotals.keys()];
  const values = categories.map((cat) => categoryTotals.get(cat)!);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (categories.length === 0 || total <= 0) return [];

  const units = Math.max(1, Math.round(spec.markDef.units ?? DEFAULT_UNITS));
  const columns = Math.max(1, Math.round(spec.markDef.columns ?? DEFAULT_COLUMNS));
  const rows = Math.ceil(units / columns);

  const cellCounts = largestRemainderCells(values, units);

  // Square cells with gap = cell/6: grid width = columns*cell + (columns-1)*gap.
  // Solve for the cell size on both axes and take the smaller so the grid
  // stays square and inside the chart area, then center it.
  const cell = Math.min(
    chartArea.width / (columns + (columns - 1) * GAP_FRACTION),
    chartArea.height / (rows + (rows - 1) * GAP_FRACTION),
  );
  if (!(cell > 0)) return [];

  const gap = cell * GAP_FRACTION;
  const step = cell + gap;
  const gridWidth = columns * cell + (columns - 1) * gap;
  const gridHeight = rows * cell + (rows - 1) * gap;
  const originX = chartArea.x + (chartArea.width - gridWidth) / 2;
  // Top edge of the bottom row; rows fill upward from here.
  const bottomRowY = chartArea.y + (chartArea.height - gridHeight) / 2 + gridHeight - cell;

  const cornerRadius =
    spec.markDef.cornerRadius === 'pill'
      ? cell / 2
      : (spec.markDef.cornerRadius ?? DEFAULT_CORNER_RADIUS);

  const marks: RectMark[] = [];
  let cellIndex = 0;

  for (let c = 0; c < categories.length; c++) {
    const category = categories[c];
    const count = cellCounts[c];
    const value = categoryTotals.get(category)!;
    const percentStr = total > 0 ? formatPercent(value / total) : '0%';
    const row = categoryRows.get(category)!;
    const catKey = serializeKeyValue(category);
    const fill = getColor(scales, category);

    // One SR stop per category: the first cell carries the label, the rest
    // are decorative duplicates (100 cells would drown screen reader users).
    const aria: MarkAria = {
      label: `${category}: ${count} of ${units} units (${percentStr})`,
    };

    for (let k = 0; k < count; k++, cellIndex++) {
      const col = cellIndex % columns;
      const gridRow = Math.floor(cellIndex / columns); // 0 = bottom row

      marks.push({
        type: 'rect',
        key: `${catKey}|${k}`,
        x: originX + col * step,
        y: bottomRowY - gridRow * step,
        width: cell,
        height: cell,
        fill,
        cornerRadius,
        data: row as Record<string, unknown>,
        aria: k === 0 ? aria : { ...aria, decorative: true },
      });
    }
  }

  return marks;
}
