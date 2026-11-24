import type {
  A11yMetadata,
  CompileWarning,
  MeasureTextFn,
  Point,
  Rect,
  ResolvedChrome,
} from './layout';
import type { RaceTableColumn } from './spec';
import type { ResolvedTheme } from './theme';

export interface RaceItem {
  key: string;
  label: string;
  color: string;
  value: number;
  valueLabel: string;
  rank: number;
  rankPos: number;
  opacity: number;
  change: number;
}

export interface RaceFrame {
  t: number;
  period: { index: number; value: string | number; label: string };
  items: RaceItem[];
  domain: [number, number];
  summary?: { value: number; label: string };
}

export interface RaceTick {
  value: number;
  label: string;
  opacity: number;
  position: number;
}

export interface RacePlayback {
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  autoplay: 'visible' | boolean;
  controls: boolean;
}

export interface RaceBarStatic {
  plot: Rect;
  clip: Rect;
  nameX: number;
  rowHeight: number;
  barHeight: number;
  cornerRadius: number;
  top: number;
  axisY: number;
  tickFontSize: number;
  period: { x: number; y: number; fontSize: number } | null;
  summary: { x: number; y: number } | null;
}

export interface RaceBarRow {
  key: string;
  color: string;
  opacity: number;
  bar: Rect;
  name: { x: number; y: number; text: string };
  value: { x: number; y: number; text: string; anchor: 'start' | 'end' };
}

export interface RaceBarGeometry {
  mark: 'bar';
  rows: RaceBarRow[];
  ticks: RaceTick[];
  period: { x: number; y: number; fontSize: number; text: string } | null;
  summary: { x: number; y: number; text: string } | null;
}

export interface RaceLineStatic {
  /** Bounds of the line plot in pixels. */
  plot: Rect;
  /** Controls whether the x axis reveals periods as the playhead advances or shows all periods. */
  window: 'reveal' | 'all';
  /** Full period-index domain and its pixel range. Reveal mode narrows the domain per frame. */
  xScale: {
    /** First and last period indices. */
    domain: [number, number];
    /** Left and right x coordinates in pixels. */
    range: [number, number];
  };
  /** Horizontal position of the y axis in pixels. */
  yAxisX: number;
  /** Width reserved to the right of the plot for line-end labels, in pixels. */
  labelGutter: number;
  /** Font size for axis tick labels in pixels. */
  tickFontSize: number;
  /** Visibility and value history for each key that can be drawn. */
  history: Array<{
    /** Index into the race matrix. */
    key: number;
    /** Contiguous intervals in which the series has a visible head. */
    runs: Array<{ start: number; end: number; peakTime: number; peakOpacity: number }>;
    /** Running value bounds at each whole period. */
    mins: number[];
    maxes: number[];
  }>;
}

export interface RaceLineGeometry {
  /** Identifies line geometry in a race frame. */
  mark: 'line';
  /** Series drawn in the current frame. */
  series: Array<{
    /** Stable key for the series. */
    key: string;
    /** Display color for the line and its name. */
    color: string;
    /** Opacity of the series in this frame. */
    opacity: number;
    /** Observed points through the current period, plus the interpolated head. Null marks a gap. */
    points: Array<Point | null>;
    /** Positioned name and value at the line's head. */
    endLabel: {
      /** Horizontal label position in pixels. */
      x: number;
      /** Vertical label position in pixels. */
      y: number;
      /** Series name to display. */
      text: string;
      /** Formatted value at the line's head. */
      value: string;
    };
  }>;
  /** Period ticks on the horizontal axis. */
  xTicks: RaceTick[];
  /** Value ticks on the vertical axis. */
  yTicks: RaceTick[];
  /** Y-axis value domain. It can expand as the playhead advances. */
  domain: [number, number];
}

/** Display data for a cell in a race table row. */
export type RaceTableCell =
  | {
      /** Identifies the rank column. */
      column: 'rank';
      /** Displayed rank for the current period. */
      text: string;
    }
  | {
      /** Identifies the change column. */
      column: 'change';
      /** Rank movement since the previous period, or `new` for a key entering the ranking. */
      direction: 'up' | 'down' | 'same' | 'new';
      /** Display text for the rank change. */
      text: string;
    }
  | {
      /** Identifies the name column. */
      column: 'name';
      /** Series name to display. */
      text: string;
      /** Series color for the chip next to the name. */
      color: string;
    }
  | {
      /** Identifies the inline bar column. */
      column: 'bar';
      /** Left edge of the inline bar in pixels. */
      x: number;
      /** Width of the inline bar in pixels. */
      width: number;
      /** Fill color of the inline bar. */
      color: string;
    }
  | {
      /** Identifies the value or share column. */
      column: 'value' | 'share';
      /** Formatted value or percentage share, according to the column. */
      text: string;
    };

export interface RaceTableStatic {
  /** Height of each row slot in pixels. */
  rowHeight: number;
  /** Height of the header row in pixels. */
  headerHeight: number;
  /** Font size for table text in pixels. */
  fontSize: number;
  /** Columns in display order. */
  columns: Array<{
    /** Column identifier shared by the header and row cells. */
    column: RaceTableColumn;
    /** Horizontal position of the column in pixels. */
    x: number;
    /** Width of the column in pixels. */
    width: number;
  }>;
  /** Header text by column. */
  labels: Record<RaceTableColumn, string>;
}

export interface RaceTableGeometry {
  /** Identifies table geometry in a race frame. */
  mark: 'table';
  /** Rows in draw order. */
  rows: Array<{
    /** Stable key for the row's series. */
    key: string;
    /** Vertical row position in pixels. */
    y: number;
    /** Opacity of the row in this frame. */
    opacity: number;
    /** Cell data in the static column order. */
    cells: RaceTableCell[];
  }>;
}

export type RaceGeometry = RaceBarGeometry | RaceLineGeometry | RaceTableGeometry;

interface RaceLayoutBase {
  width: number;
  height: number;
  chrome: ResolvedChrome;
  theme: ResolvedTheme;
  a11y: A11yMetadata;
  watermark: boolean;
  periods: string[];
  /** Per-key colors resolved for the active theme. Used by `raceGeometryAt` for mark presentation. */
  colors: string[];
  /**
   * Per-key display labels for `raceGeometryAt`, possibly truncated to fit the gutter.
   * `raceFrameAt` uses the matrix's full labels for accessibility and export.
   */
  labels: string[];
  /** Text measurer the layout was computed with; renderers reuse it so chrome wraps identically. */
  measureText?: MeasureTextFn;
  playback: RacePlayback;
  warnings?: CompileWarning[];
  /** Area below chrome where the mark draws. */
  area: Rect;
}

export type RaceLayout =
  | (RaceLayoutBase & { mark: 'bar'; static: RaceBarStatic })
  | (RaceLayoutBase & { mark: 'line'; static: RaceLineStatic })
  | (RaceLayoutBase & { mark: 'table'; static: RaceTableStatic });
