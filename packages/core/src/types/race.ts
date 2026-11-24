import type { A11yMetadata, CompileWarning, Point, Rect, ResolvedChrome } from './layout';
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
  top: number;
  axisY: number;
  period: { x: number; y: number; fontSize: number } | null;
  summary: { x: number; y: number } | null;
}

export interface RaceBarRow {
  key: string;
  color: string;
  opacity: number;
  bar: Rect;
  name: { x: number; y: number; text: string };
  value: { x: number; y: number; text: string };
}

export interface RaceBarGeometry {
  mark: 'bar';
  rows: RaceBarRow[];
  ticks: RaceTick[];
  period: { x: number; y: number; fontSize: number; text: string } | null;
  summary: { x: number; y: number; text: string } | null;
}

export interface RaceLineStatic {
  plot: Rect;
  /** Full period-index domain and its pixel range. Reveal mode shortens the domain each frame. */
  xScale: { domain: [number, number]; range: [number, number] };
}

export interface RaceLineGeometry {
  mark: 'line';
  series: Array<{
    key: string;
    color: string;
    opacity: number;
    /** Observed points through the current period, plus the interpolated head. Null marks a gap. */
    points: Array<Point | null>;
    endLabel: { x: number; y: number; text: string };
  }>;
  xTicks: RaceTick[];
  yTicks: RaceTick[];
}

export interface RaceTableStatic {
  rowHeight: number;
  /** Columns in display order. Positions and widths are in pixels. */
  columns: Array<{ column: RaceTableColumn; x: number; width: number }>;
}

export interface RaceTableGeometry {
  mark: 'table';
  /** Rows in draw order. Cells align with the static column order. */
  rows: Array<{ key: string; y: number; opacity: number; cells: string[] }>;
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
  playback: RacePlayback;
  warnings?: CompileWarning[];
  /** Area below chrome where the mark draws. */
  area: Rect;
}

export type RaceLayout =
  | (RaceLayoutBase & { mark: 'bar'; static: RaceBarStatic })
  | (RaceLayoutBase & { mark: 'line'; static: RaceLineStatic })
  | (RaceLayoutBase & { mark: 'table'; static: RaceTableStatic });
