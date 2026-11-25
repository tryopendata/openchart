/**
 * The frozen frame: the envelope spec (every present, gap-filled matrix cell across all
 * periods) compiled once, with the playback overrides of RFC section 3.2 applied.
 */
import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  DataRow,
  Encoding,
  LegendLayout,
  MarkType,
} from '@opendata-ai/openchart-core';
import { pointFillOpacity } from '../charts/scatter/compute';
import { freezePointRenderSpec } from '../charts/scatter/playback-spec';
import { compileChartInternal } from '../compile/chart';
import type { FrameCapture } from '../compile/internal-options';
import { resolveFieldFormatter } from '../format/field-format';
import { summedStackFields, tallestStackRows } from './bar-playback';
import { channelField, isDrawnChannel, matrixChannelEncoding } from './channels';
import type { FrozenChartFrame } from './chart-types';
import type { PlaybackMatrix } from './matrix';

/**
 * Whether a key has a finite value on every drawn matrix channel at a period. Carried
 * channels (tooltip numbers) don't count: a key without one is still drawn.
 */
export function isCellPresent(matrix: PlaybackMatrix, keyIndex: number, period: number): boolean {
  for (const [name, series] of Object.entries(matrix.values)) {
    if (isDrawnChannel(name) && !Number.isFinite(series[keyIndex][period])) return false;
  }
  return true;
}

/** How many keys are present in each period, in period order. */
export function presentCountsByPeriod(matrix: PlaybackMatrix): number[] {
  return matrix.periods.map((_, period) => {
    let count = 0;
    for (let key = 0; key < matrix.keys.length; key++) {
      if (isCellPresent(matrix, key, period)) count++;
    }
    return count;
  });
}

/** The most keys present in any one period. */
export function largestPeriodCount(matrix: PlaybackMatrix): number {
  return Math.max(0, ...presentCountsByPeriod(matrix));
}

/** The authored mark type, from either `mark: 'point'` or `mark: { type: 'point' }`. */
export function specMarkType(spec: ChartSpec): MarkType {
  return (typeof spec.mark === 'string' ? spec.mark : spec.mark.type) as MarkType;
}

function envelopeRows(spec: ChartSpec, matrix: PlaybackMatrix): DataRow[] {
  const encoding = spec.encoding as Encoding & { time?: unknown };
  const keyField = channelField(encoding.key);
  const timeField = channelField(encoding.time);
  const channels = Object.entries(matrix.values).map(([name, series]) => ({
    field: matrixChannelEncoding(encoding, name)?.field ?? name,
    series,
  }));
  const rows: DataRow[] = [];
  matrix.keys.forEach((key, keyIndex) => {
    matrix.periods.forEach((period, periodIndex) => {
      if (!isCellPresent(matrix, keyIndex, periodIndex)) return;
      const row: DataRow = { ...matrix.statics[keyIndex] };
      if (keyField) row[keyField] = key;
      if (timeField) row[timeField] = period.value;
      for (const { field, series } of channels) {
        const value = series[keyIndex][periodIndex];
        if (Number.isFinite(value)) row[field] = value;
      }
      rows.push(row);
    });
  });
  return rows;
}

/**
 * Build the envelope: `spec` with `data` replaced by one row per present, gap-filled cell
 * (statics attached, the time field set to the cell's period), `encoding.time`, `playback`
 * and `hiddenSeries` removed, and the playback overrides applied (no trendline). `transform`
 * is dropped too, since the matrix was built from rows the transforms already produced.
 * Hidden series stay in the envelope so hiding one never moves an axis. A stacked bar keeps
 * each category's tallest period only (`tallestStackRows`), so its axis isn't sized from
 * every period stacked together.
 *
 * When no cell is present (every row filtered out, or no drawable values), the envelope
 * keeps the spec's own data and transforms so the frame compiles the chart's empty state.
 *
 * The matrix's channels are named after the encoding channels they feed (`x`, `y`, `size`
 * for points; `x` for horizontal bars), each reading that channel's field, and its
 * statics carry the color, key and other nominal fields.
 */
export function buildEnvelopeSpec(spec: ChartSpec, matrix: PlaybackMatrix): ChartSpec {
  const {
    playback: _playback,
    hiddenSeries: _hiddenSeries,
    transform,
    ...rest
  } = spec as ChartSpec & { transform?: unknown };
  const { time: _time, ...encoding } = spec.encoding as Encoding & { time?: unknown };
  const mark =
    specMarkType(spec) === 'point'
      ? { ...(typeof spec.mark === 'string' ? { type: spec.mark } : spec.mark), trendline: false }
      : spec.mark;
  const rows = envelopeRows(spec, matrix);
  if (rows.length === 0)
    return { ...rest, mark, encoding, transform, data: spec.data } as ChartSpec;
  const stack = summedStackFields(spec);
  const timeField = channelField((spec.encoding as Encoding & { time?: unknown }).time);
  const data = stack && timeField ? tallestStackRows(rows, stack, timeField) : rows;
  return { ...rest, mark, encoding, data } as ChartSpec;
}

function resolveFormatters(
  spec: ChartSpec,
  matrix: PlaybackMatrix,
): Record<string, (value: number) => string> {
  const formatters: Record<string, (value: number) => string> = {};
  for (const [name, series] of Object.entries(matrix.values)) {
    const channel = matrixChannelEncoding(spec.encoding, name);
    const field = channel?.field ?? name;
    const values = series.flatMap((keyValues) => [...keyValues].filter(Number.isFinite));
    formatters[field] = resolveFieldFormatter({ channelFormat: channel?.format, values });
  }
  return formatters;
}

/** A legend with the hidden series' entries inactive, as an ordinary compile marks them. */
function withHiddenEntries(legend: LegendLayout, hidden: ReadonlySet<string>): LegendLayout {
  if (!('entries' in legend) || legend.channel === 'size') return legend;
  return {
    ...legend,
    entries: legend.entries.map((entry) =>
      hidden.has(entry.label) ? { ...entry, active: false } : entry,
    ),
  };
}

/** The envelope layout without marks, with `hiddenSeries` applied to the legend only. */
function frameLayout(layout: ChartLayout, hiddenSeries: string[] | undefined): ChartLayout {
  const frame = { ...layout, marks: [], tooltipDescriptors: new Map() };
  if (!hiddenSeries?.length) return frame;
  const hidden = new Set(hiddenSeries);
  return {
    ...frame,
    legend: withHiddenEntries(layout.legend, hidden),
    legends: layout.legends.map((legend) => withHiddenEntries(legend, hidden)),
  };
}

/**
 * Compile the envelope once at the given size and theme and keep what must stay still for
 * the run: layout without marks, scales, plot area, label plan, theme, the point opacity
 * for the largest per-period key count, and one formatter per field over all values.
 *
 * @throws The validation error `compileChart` throws when the envelope spec is invalid.
 * @throws {Error} When the envelope compiled as a faceted chart, which has no single frame.
 */
export function freezeChartFrame(
  spec: ChartSpec,
  options: CompileOptions,
  matrix: PlaybackMatrix,
): FrozenChartFrame {
  const capture: FrameCapture = {};
  const layout = compileChartInternal(buildEnvelopeSpec(spec, matrix), {
    ...options,
    frameCapture: capture,
  });
  const { scales, chartArea, renderSpec, strategy, labelPlan } = capture;
  if (!scales || !chartArea || !renderSpec || !strategy) {
    throw new Error(
      'The playback envelope compiled without a single plot (a faceted chart?). Remove facet from a spec with encoding.time.',
    );
  }
  const isPoint = renderSpec.markType === 'point';
  const pointOpacity = renderSpec.markDef.opacity ?? pointFillOpacity(largestPeriodCount(matrix));
  const frame = frameLayout(layout, spec.hiddenSeries);
  return {
    layout: frame,
    scales,
    chartArea,
    labelPlan,
    theme: frame.theme,
    pointOpacity,
    formatters: resolveFormatters(spec, matrix),
    spec: isPoint ? freezePointRenderSpec(renderSpec, pointOpacity) : renderSpec,
    strategy,
  };
}
