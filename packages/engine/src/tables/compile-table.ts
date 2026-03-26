/**
 * Table compilation pipeline.
 *
 * Takes a NormalizedTableSpec and produces a fully resolved TableLayout:
 *   resolve columns -> build search index -> sort data -> filter by search ->
 *   paginate -> format visible cells -> apply visual enhancements -> return
 */

import type {
  CellStyle,
  ColumnConfig,
  CompileTableOptions,
  PaginationState,
  ResolvedColumn,
  ResolvedTheme,
  TableCell,
  TableLayout,
  TableRow,
} from '@opendata-ai/openchart-core';
import { computeChrome, estimateTextWidth } from '@opendata-ai/openchart-core';

import { resolveAnimation } from '../compiler/animation';
import type { NormalizedTableSpec } from '../compiler/types';
import { computeBarCell, computeColumnMax, computeColumnMin } from './bar-column';
import { computeCategoryColors } from './category-colors';
import { formatCell } from './format-cells';
import { computeHeatmapColors } from './heatmap';
import { paginateData } from './pagination';
import { buildSearchIndex, filterBySearch } from './search';
import { sortData } from './sort';
import { computeSparklineForRow, type SparklineData } from './sparkline';

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/**
 * Determine the cell type for a column based on its config.
 * Precedence: sparkline > bar > heatmap > image > flag > categoryColors > text
 */
function determineCellType(col: ColumnConfig): ResolvedColumn['cellType'] {
  if (col.sparkline) return 'sparkline';
  if (col.bar) return 'bar';
  if (col.heatmap) return 'heatmap';
  if (col.image) return 'image';
  if (col.flag) return 'flag';
  if (col.categoryColors) return 'category';
  return 'text';
}

/**
 * Infer alignment for a column.
 * Explicit align wins. Otherwise: right for numeric data, left for everything else.
 */
function inferAlignment(
  col: ColumnConfig,
  data: Record<string, unknown>[],
): 'left' | 'center' | 'right' {
  if (col.align) return col.align;

  // Check first non-null value in the data
  for (const row of data) {
    const val = row[col.key];
    if (val != null) {
      return typeof val === 'number' ? 'right' : 'left';
    }
  }
  return 'left';
}

/**
 * Estimate the needed width for a column by measuring header and data values.
 * Samples up to 100 rows for estimation.
 */
function estimateColumnWidth(
  col: ColumnConfig,
  data: Record<string, unknown>[],
  fontSize: number,
): number {
  const MIN_WIDTH = 60;
  const PADDING = 24; // cell padding

  // Visual columns get fixed widths (they render graphics, not text)
  if (col.sparkline) return 140;
  if (col.image) return (col.image.width ?? 24) + PADDING;
  if (col.flag) return 60;

  // Header width
  const label = col.label ?? col.key;
  const headerWidth = estimateTextWidth(label, fontSize, 600) + PADDING;

  // Sample data values
  const sampleSize = Math.min(100, data.length);
  let maxDataWidth = 0;

  for (let i = 0; i < sampleSize; i++) {
    const val = data[i][col.key];
    const text = val == null ? '' : String(val);
    const width = estimateTextWidth(text, fontSize, 400) + PADDING;
    if (width > maxDataWidth) maxDataWidth = width;
  }

  return Math.max(MIN_WIDTH, headerWidth, maxDataWidth);
}

/**
 * Resolve all columns: compute widths, types, alignment.
 */
function resolveColumns(
  columns: ColumnConfig[],
  data: Record<string, unknown>[],
  totalWidth: number,
  theme: ResolvedTheme,
): ResolvedColumn[] {
  const fontSize = theme.fonts.sizes.body;

  // Compute natural widths and identify fixed-width visual columns.
  // Visual columns (sparkline, image, flag) get fixed sizes; only text
  // columns participate in proportional scaling to fill the container.
  const isFixed = columns.map((col) => !!(col.sparkline || col.image || col.flag));

  const naturalWidths = columns.map((col) => {
    if (col.width) {
      // Parse explicit width
      if (col.width.endsWith('px')) {
        return parseInt(col.width, 10) || 100;
      }
      if (col.width.endsWith('%')) {
        return (parseFloat(col.width) / 100) * totalWidth || 100;
      }
      return parseInt(col.width, 10) || 100;
    }
    return estimateColumnWidth(col, data, fontSize);
  });

  // Fixed columns keep their natural width; remaining space goes to text columns
  const fixedTotal = naturalWidths.reduce((sum, w, i) => sum + (isFixed[i] ? w : 0), 0);
  const flexTotal = naturalWidths.reduce((sum, w, i) => sum + (isFixed[i] ? 0 : w), 0);
  const remainingWidth = totalWidth - fixedTotal;
  const flexScale = flexTotal > 0 && remainingWidth > 0 ? remainingWidth / flexTotal : 1;

  return columns.map((col, i) => ({
    key: col.key,
    label: col.label ?? col.key,
    width: Math.max(60, isFixed[i] ? naturalWidths[i] : Math.round(naturalWidths[i] * flexScale)),
    sortable: col.sortable ?? true,
    align: inferAlignment(col, data),
    cellType: determineCellType(col),
  }));
}

// ---------------------------------------------------------------------------
// Cell building
// ---------------------------------------------------------------------------

/**
 * Build a fully resolved TableCell from a data value and column config.
 */
function buildCell(
  value: unknown,
  column: ColumnConfig,
  resolvedColumn: ResolvedColumn,
  heatmapStyle: CellStyle | undefined,
  categoryStyle: CellStyle | undefined,
  barData:
    | { barPercent: number; barOffset: number; barColor: string; isNegative: boolean }
    | undefined,
  sparklineData: SparklineData | null,
): TableCell {
  const base = formatCell(value, column);

  // Apply font variant for number columns
  if (typeof value === 'number') {
    base.style = { ...base.style, fontVariant: 'tabular-nums' };
  }

  const cellType = resolvedColumn.cellType;

  switch (cellType) {
    case 'heatmap': {
      const merged = heatmapStyle ? { ...base.style, ...heatmapStyle } : base.style;
      return {
        ...base,
        cellType: 'heatmap',
        style: merged,
      };
    }
    case 'category': {
      const merged = categoryStyle ? { ...base.style, ...categoryStyle } : base.style;
      return {
        ...base,
        cellType: 'category',
        style: merged,
      };
    }
    case 'bar': {
      return {
        ...base,
        cellType: 'bar',
        barWidth: barData?.barPercent ?? 0,
        barOffset: barData?.barOffset ?? 0,
        barColor: barData?.barColor ?? '#ccc',
        isNegative: barData?.isNegative ?? false,
      };
    }
    case 'sparkline': {
      return {
        ...base,
        cellType: 'sparkline',
        sparklineData,
      };
    }
    case 'image': {
      const src = typeof value === 'string' ? value : '';
      const imgConfig = column.image ?? {};
      return {
        ...base,
        cellType: 'image',
        src,
        imageWidth: imgConfig.width ?? 24,
        imageHeight: imgConfig.height ?? 24,
        rounded: imgConfig.rounded ?? false,
      };
    }
    case 'flag': {
      const code = typeof value === 'string' ? value : '';
      return {
        ...base,
        cellType: 'flag',
        countryCode: code,
      };
    }
    default: {
      return {
        ...base,
        cellType: 'text',
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Compile a normalized table spec into a TableLayout.
 *
 * Pipeline:
 * 1. Resolve columns (widths, types, alignment)
 * 2. Build search index
 * 3. Sort data
 * 4. Filter by search
 * 5. Paginate
 * 6. Format visible cells and apply visual enhancements
 * 7. Return TableLayout
 */
export function compileTableLayout(
  spec: NormalizedTableSpec,
  options: CompileTableOptions,
  theme: ResolvedTheme,
): TableLayout {
  const data = spec.data;
  const darkMode = theme.isDark;

  // 1. Resolve columns
  const resolvedColumns = resolveColumns(spec.columns, data, options.width, theme);

  // 2. Build search index (over full dataset, using original indices)
  const searchIndex = spec.search
    ? buildSearchIndex(data, spec.columns)
    : new Map<number, string>();

  // 3. Track original indices through the pipeline
  let currentData = data;
  let originalIndices = data.map((_, i) => i);

  // 4. Sort
  if (options.sort) {
    const sorted = sortData(currentData, options.sort);
    // Map sorted originalIndices back through our current index mapping
    originalIndices = sorted.originalIndices.map((i) => originalIndices[i]);
    currentData = sorted.data;
  }

  // 5. Filter by search
  if (spec.search && options.search) {
    const filtered = filterBySearch(currentData, options.search, searchIndex, originalIndices);
    currentData = filtered.data;
    originalIndices = filtered.indices;
  }

  const totalFiltered = currentData.length;

  // 6. Paginate
  let pageSize = 0;
  let currentPage = 0;
  let paginationState: PaginationState | undefined;

  if (spec.pagination) {
    pageSize =
      options.pageSize ?? (typeof spec.pagination === 'object' ? spec.pagination.pageSize : 25);
    currentPage = options.page ?? 0;
    const paginated = paginateData(currentData, currentPage, pageSize);

    // Slice indices too
    const start = paginated.page * pageSize;
    const end = start + paginated.rows.length;
    const pageIndices = originalIndices.slice(start, end);

    currentData = paginated.rows;
    originalIndices = pageIndices;

    paginationState = {
      page: paginated.page,
      pageSize,
      totalRows: paginated.totalRows,
      totalPages: paginated.totalPages,
    };
  }

  // 7. Pre-compute visual enhancements for visible data columns
  // We need heatmap/category colors computed over the FULL dataset, then
  // applied only to visible rows.
  const heatmapMaps = new Map<string, Map<number, CellStyle>>();
  const categoryMaps = new Map<string, Map<number, CellStyle>>();
  const barMaxes = new Map<string, number>();
  const barMins = new Map<string, number>();

  for (let c = 0; c < spec.columns.length; c++) {
    const col = spec.columns[c];
    const resolved = resolvedColumns[c];

    if (resolved.cellType === 'heatmap' && col.heatmap) {
      heatmapMaps.set(col.key, computeHeatmapColors(data, col, theme, darkMode));
    }
    if (resolved.cellType === 'category' && col.categoryColors) {
      categoryMaps.set(col.key, computeCategoryColors(data, col, theme, darkMode));
    }
    if (resolved.cellType === 'bar' && col.bar) {
      barMaxes.set(col.key, computeColumnMax(data, col.key));
      barMins.set(col.key, computeColumnMin(data, col.key));
    }
  }

  // 8. Build rows from visible data
  const rows: TableRow[] = currentData.map((row, i) => {
    const origIdx = originalIndices[i];
    const rowId = spec.rowKey ? String(row[spec.rowKey] ?? origIdx) : String(origIdx);

    const cells: TableCell[] = spec.columns.map((col, c) => {
      const resolved = resolvedColumns[c];
      const value = row[col.key];

      // Lookup visual enhancement data
      const heatmapStyle = heatmapMaps.get(col.key)?.get(origIdx);
      const categoryStyle = categoryMaps.get(col.key)?.get(origIdx);

      let barData:
        | { barPercent: number; barOffset: number; barColor: string; isNegative: boolean }
        | undefined;
      if (resolved.cellType === 'bar' && col.bar && typeof value === 'number') {
        barData = computeBarCell(
          value,
          col.bar,
          barMaxes.get(col.key) ?? 0,
          barMins.get(col.key) ?? 0,
          theme,
          darkMode,
        );
      }

      let sparklineData: SparklineData | null = null;
      if (resolved.cellType === 'sparkline' && col.sparkline) {
        sparklineData = computeSparklineForRow(row, col.key, col.sparkline, theme, darkMode);
      }

      return buildCell(value, col, resolved, heatmapStyle, categoryStyle, barData, sparklineData);
    });

    return { id: rowId, cells, data: row };
  });

  // 9. Compute chrome
  const chrome = computeChrome(
    {
      title: spec.chrome.title,
      subtitle: spec.chrome.subtitle,
      source: spec.chrome.source,
      byline: spec.chrome.byline,
      footer: spec.chrome.footer,
    },
    theme,
    options.width,
    options.measureText,
  );

  // 10. Build a11y
  const titleText = spec.chrome.title?.text ?? '';
  const caption = titleText ? `Table: ${titleText}` : `Data table with ${data.length} rows`;

  return {
    chrome,
    columns: resolvedColumns,
    rows,
    sort: options.sort,
    pagination: paginationState,
    search: {
      enabled: spec.search,
      placeholder: 'Search...',
      query: options.search ?? '',
    },
    stickyFirstColumn: spec.stickyFirstColumn,
    compact: spec.compact,
    a11y: {
      caption,
      summary: `${resolvedColumns.length} columns, ${totalFiltered} rows`,
    },
    theme,
    animation: resolveAnimation(spec.animation),
  };
}
