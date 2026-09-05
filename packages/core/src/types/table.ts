/**
 * Table column configuration types.
 *
 * These types define how individual columns in a TableSpec are displayed,
 * formatted, and enhanced with visual features like heatmaps, bars,
 * sparklines, images, and category colors.
 */

// ---------------------------------------------------------------------------
// Column visual feature configs
// ---------------------------------------------------------------------------

/** Heatmap coloring configuration for a table column. */
export interface HeatmapColumnConfig {
  /**
   * Color palette name or array of color stops.
   * Uses sequential palette from theme if a string name is provided.
   */
  palette?: string | string[];
  /** Explicit domain [min, max] for the color scale. Auto-derived from data if omitted. */
  domain?: [number, number];
  /**
   * Use a different field's values for coloring while displaying this column's values.
   * Useful for coloring a label column based on a numeric column.
   */
  colorByField?: string;
}

/** Inline bar configuration for a table column. */
export interface BarColumnConfig {
  /** Maximum value for the bar scale. Auto-derived from data if omitted. */
  maxValue?: number;
  /** Bar fill color. Uses the first categorical palette color if omitted. */
  color?: string;
}

/** Inline sparkline configuration for a table column. */
export interface SparklineColumnConfig {
  /** Sparkline chart type. Defaults to "line". */
  type?: 'line' | 'bar' | 'column';
  /** Field containing the array of values to plot. */
  valuesField?: string;
  /** Sparkline color. Uses the first categorical palette color if omitted. */
  color?: string;
  /**
   * Value domain each row's sparkline is normalized against.
   *
   * - `'shared'` (default): one extent computed across every row, so row
   *   heights are comparable down the column.
   * - `'row'`: each row normalized against its own min/max, which maximises
   *   shape at the cost of comparability (use for small-magnitude series).
   * - `[min, max]`: an explicit extent.
   */
  domain?: 'shared' | 'row' | [number, number];
}

/** Delta (change) chip configuration for a table column. */
export interface DeltaColumnConfig {
  /**
   * Flip the color valence: negative values read as positive.
   * Use for metrics where down is good (churn, latency, cost).
   */
  invert?: boolean;
}

/** Image cell configuration for a table column. */
export interface ImageColumnConfig {
  /** Image width in pixels. Defaults to 24. */
  width?: number;
  /** Image height in pixels. Defaults to 24. */
  height?: number;
  /** Whether to apply border-radius for rounded/circular images. */
  rounded?: boolean;
}

/** Category color mapping for a table column. Maps category values to CSS colors. */
export type CategoryColorsConfig = Record<string, string>;

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

/**
 * Configuration for a single table column.
 *
 * At minimum, `key` identifies the data field. All other properties
 * control display, sorting, formatting, and visual features.
 *
 * Only one visual feature (heatmap, bar, sparkline, delta, image, flag,
 * categoryColors) should be active per column. If multiple are provided, the
 * engine picks the first one in this precedence order:
 * sparkline > bar > delta > heatmap > image > flag > categoryColors.
 */
export interface ColumnConfig {
  /** Data field key (must match a key in the data rows). */
  key: string;
  /** Display label for the column header. Defaults to the key if omitted. */
  label?: string;
  /** Whether this column is sortable. Defaults to true. */
  sortable?: boolean;
  /** Text alignment in the column. Defaults to "left" for text, "right" for numbers. */
  align?: 'left' | 'center' | 'right';
  /** Explicit column width (CSS value like "200px" or "20%"). Auto-sized if omitted. */
  width?: string;
  /**
   * Number/date format string (d3-format or d3-time-format), or a semantic
   * keyword: `'percent'`, `'currency'`, `'ordinal'`, `'compact'`.
   * e.g. ",.0f", "%Y-%m-%d", "percent".
   *
   * Tables show full precision by default; `'compact'` opts a column into the
   * chart-surface abbreviation (1.2k, 3.4M).
   */
  format?: string;
  /**
   * Field type, Vega-Lite style. Drives alignment (quantitative right,
   * everything else left) and which columns the total row sums.
   * Inferred from the data when omitted.
   */
  type?: 'quantitative' | 'nominal' | 'ordinal' | 'temporal';
  /**
   * Mobile priority for cards mode (below 400px): 1 renders first and spans
   * the row, 2 renders as a label/value pair, 3 is hidden. Defaults to 2
   * (1 for the first column).
   */
  priority?: 1 | 2 | 3;

  // Visual features (pick at most one per column)

  /** Heatmap: color the cell background based on numeric value. */
  heatmap?: HeatmapColumnConfig;
  /** Inline bar: render a proportional bar in the cell. */
  bar?: BarColumnConfig;
  /** Sparkline: render a mini line/bar chart in the cell. */
  sparkline?: SparklineColumnConfig;
  /** Image: render the cell value as an image URL. */
  image?: ImageColumnConfig;
  /** Flag: render the cell value as a country flag emoji or image. */
  flag?: boolean;
  /** Delta: render the value as a signed, colored change chip (up 2.4%). */
  delta?: boolean | DeltaColumnConfig;
  /** Category colors: color-code the cell based on its categorical value. */
  categoryColors?: CategoryColorsConfig;
  /** When true, auto-assign palette colors to values not in categoryColors. Default: false. */
  autoAssign?: boolean;
}
