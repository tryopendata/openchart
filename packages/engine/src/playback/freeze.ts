/**
 * The frozen frame: the envelope spec (every present, gap-filled matrix cell across all
 * periods) compiled once, with the playback overrides of RFC section 3.2 applied.
 */
import type {
  ChartSpec,
  CompileOptions,
  DataRow,
  Encoding,
  MarkType,
} from '@opendata-ai/openchart-core';
import { pointFillOpacity } from '../charts/scatter/compute';
import { channelField, freezePointRenderSpec } from '../charts/scatter/playback-spec';
import { compileChartInternal } from '../compile/chart';
import type { FrameCapture } from '../compile/internal-options';
import { resolveFieldFormatter } from '../format/field-format';
import type { FrozenChartFrame } from './chart-types';
import type { PlaybackMatrix } from './matrix';

/** Whether a key has a finite value on every matrix channel at a period. */
export function isCellPresent(matrix: PlaybackMatrix, keyIndex: number, period: number): boolean {
  for (const series of Object.values(matrix.values)) {
    if (!Number.isFinite(series[keyIndex][period])) return false;
  }
  return true;
}

/** The most keys present in any one period. */
export function largestPeriodCount(matrix: PlaybackMatrix): number {
  let largest = 0;
  for (let period = 0; period < matrix.periods.length; period++) {
    let count = 0;
    for (let key = 0; key < matrix.keys.length; key++) {
      if (isCellPresent(matrix, key, period)) count++;
    }
    largest = Math.max(largest, count);
  }
  return largest;
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
    field: channelField(encoding[name as keyof Encoding]) ?? name,
    series,
  }));
  const rows: DataRow[] = [];
  matrix.keys.forEach((key, keyIndex) => {
    matrix.periods.forEach((period, periodIndex) => {
      if (!isCellPresent(matrix, keyIndex, periodIndex)) return;
      const row: DataRow = { ...matrix.statics[keyIndex] };
      if (keyField) row[keyField] = key;
      if (timeField) row[timeField] = period.value;
      for (const { field, series } of channels) row[field] = series[keyIndex][periodIndex];
      rows.push(row);
    });
  });
  return rows;
}

/**
 * Build the envelope: `spec` with `data` replaced by one row per present, gap-filled cell
 * (statics attached, the time field set to the cell's period), `encoding.time` and
 * `playback` removed, and the playback overrides applied (no trendline). `transform` is
 * dropped too, since the matrix was built from rows the transforms already produced.
 *
 * The matrix's channels are named after the encoding channels they feed (`x`, `y`, `size`
 * for points; `x` for horizontal bars), each reading that channel's field, and its
 * statics carry the color, key and other nominal fields.
 */
export function buildEnvelopeSpec(spec: ChartSpec, matrix: PlaybackMatrix): ChartSpec {
  const {
    playback: _playback,
    transform: _transform,
    ...rest
  } = spec as ChartSpec & {
    transform?: unknown;
  };
  const { time: _time, ...encoding } = spec.encoding as Encoding & { time?: unknown };
  const mark =
    specMarkType(spec) === 'point'
      ? { ...(typeof spec.mark === 'string' ? { type: spec.mark } : spec.mark), trendline: false }
      : spec.mark;
  return { ...rest, mark, encoding, data: envelopeRows(spec, matrix) } as ChartSpec;
}

function resolveFormatters(
  spec: ChartSpec,
  matrix: PlaybackMatrix,
): Record<string, (value: number) => string> {
  const formatters: Record<string, (value: number) => string> = {};
  for (const [name, series] of Object.entries(matrix.values)) {
    const channel = spec.encoding[name as keyof Encoding] as { field?: string; format?: string };
    const field = channel?.field ?? name;
    const values = series.flatMap((keyValues) => [...keyValues].filter(Number.isFinite));
    formatters[field] = resolveFieldFormatter({ channelFormat: channel?.format, values });
  }
  return formatters;
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
  return {
    layout: { ...layout, marks: [], tooltipDescriptors: new Map() },
    scales,
    chartArea,
    labelPlan,
    theme: layout.theme,
    pointOpacity,
    formatters: resolveFormatters(spec, matrix),
    spec: isPoint ? freezePointRenderSpec(renderSpec, pointOpacity) : renderSpec,
    strategy,
  };
}
