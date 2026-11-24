import { type CompileWarning, resolveTheme } from '@opendata-ai/openchart-core';
import { emitSpecWarnings, type WarnSink } from '../compile/spec-sugar';
import { compile } from '../compiler/index';
import { resolveFieldFormatter } from '../format/field-format';
import { assignRaceColors, resolveRaceColors } from './colors';
import { buildRaceMatrix } from './matrix';
import { formatPeriodLabels } from './period-labels';
import { createRaceTimeline } from './timeline';
import type { NormalizedRaceSpec, RaceModel, ResolvedRaceOptions } from './types';

type RaceWarningSink = (warning: CompileWarning) => void;
const warningAdapters = new WeakMap<RaceWarningSink, WarnSink>();

/** Wrap an advisory race diagnostic for compile warning consumers. */
export function raceSpecWarning(message: string): CompileWarning {
  return { code: 'RACE_SPEC_WARNING', message };
}

function createRaceWarn(warnings: string[], onWarn?: RaceWarningSink): WarnSink {
  let adapter = onWarn && warningAdapters.get(onWarn);
  if (onWarn && !adapter) {
    adapter = (message) => onWarn(raceSpecWarning(message));
    warningAdapters.set(onWarn, adapter);
  }
  emitSpecWarnings(warnings, adapter);
  return (message) => {
    warnings.push(message);
    emitSpecWarnings([message], adapter);
  };
}

function resolveDurationMs(race: ResolvedRaceOptions, periodCount: number): number {
  if (race.step === undefined) {
    return race.duration ?? Math.max(8000, Math.min(90000, periodCount * 700));
  }
  const durationMs = race.step * (periodCount - 1);
  if (!Number.isFinite(durationMs)) {
    throw new RangeError(`race.step is too large for ${periodCount} periods. Use a shorter step.`);
  }
  return durationMs;
}

function authoredWatermark(spec: unknown, normalized: boolean): boolean | undefined {
  return typeof spec === 'object' &&
    spec !== null &&
    'watermark' in spec &&
    spec.watermark !== undefined
    ? normalized
    : undefined;
}

const preparedInputs = new WeakMap<
  RaceModel,
  { options: string; columns: unknown[][]; warnings: string[] }
>();

function preparationInputs({ data, encoding, race, labels }: NormalizedRaceSpec) {
  const { duration, step, swap, top, gaps, rescale, period } = race;
  const { time, key, value, label, color } = encoding;
  const colorValue = color && 'value' in color ? color.value : undefined;
  const colorField = color && 'field' in color ? color.field : undefined;
  const options = JSON.stringify([
    time.field,
    time.type,
    time.sort,
    time.format,
    key.field,
    value.field,
    value.format,
    label?.field,
    colorValue,
    colorField,
    duration,
    step,
    swap,
    top,
    gaps,
    typeof rescale === 'object' ? rescale.min : rescale,
    period === false ? false : period.format,
    labels?.format,
  ]);
  const fields = new Set([time.field, key.field, value.field]);
  if (label) fields.add(label.field);
  if (colorField !== undefined) fields.add(colorField);
  // Snapshot the inputs so an in-place edit of the caller's data still rebuilds.
  const columns = [...fields].map((field) =>
    data.map((row) => {
      const value = row[field];
      if (value instanceof Date) return new Date(value.getTime());
      if (typeof value === 'object' && value !== null) return {};
      return value;
    }),
  );
  return { options, columns, warnings: [] as string[] };
}

function sameInputs(
  a: ReturnType<typeof preparationInputs>,
  b: ReturnType<typeof preparationInputs>,
) {
  return (
    a.options === b.options &&
    a.columns.every(
      (column, i) =>
        column.length === b.columns[i]?.length &&
        column.every((value, row) => {
          const previous = b.columns[i][row];
          return value instanceof Date && previous instanceof Date
            ? Object.is(value.getTime(), previous.getTime())
            : Object.is(value, previous);
        }),
    )
  );
}

function prepareRanking({ data, encoding, race, labels }: NormalizedRaceSpec, warn: WarnSink) {
  const matrix = buildRaceMatrix(data, encoding, race.gaps, warn);
  const periodCount = matrix.periods.length;
  const durationMs = resolveDurationMs(race, periodCount);
  const timeline = createRaceTimeline(matrix, {
    top: race.top,
    swapPeriods: (race.swap / durationMs) * (periodCount - 1),
    samplesPerPeriod: 24,
    rescale: race.rescale,
  });
  if (race.top > timeline.top) {
    warn(
      `race.top is ${race.top} but the data has ${timeline.top} distinct keys. Showing at most ${timeline.top}.`,
    );
  }

  const periodFormat = race.period === false ? undefined : race.period.format;
  const periodLabels = formatPeriodLabels(matrix.periods, {
    ...encoding.time,
    format: periodFormat ?? encoding.time.format,
  });
  function* values() {
    for (const series of matrix.values) yield* series;
  }
  const formatValue = resolveFieldFormatter({
    surfaceFormat: labels?.format,
    channelFormat: encoding.value.format,
    values: values(),
  });
  return { matrix, timeline, periodLabels, formatValue };
}

/**
 * Validate and prepare the size-independent race model.
 * @throws {Error} Aggregated spec validation errors or a valid non-race spec.
 * @throws {RaceDataError} Duplicate rows, too few periods, or no finite values.
 * @throws {RangeError} The step multiplied by the period intervals overflows.
 */
export function prepareRace(
  spec: unknown,
  options: { onWarn?: (w: CompileWarning) => void; previousModel?: RaceModel },
): RaceModel {
  const { spec: normalized, warnings } = compile(spec);
  if (!('type' in normalized) || normalized.type !== 'race') {
    throw new Error(
      'prepareRace received a non-race spec. Set type to "race" or use the matching compiler.',
    );
  }

  const warn = createRaceWarn(warnings, options.onWarn);
  const { encoding, race } = normalized;
  const inputs = preparationInputs(normalized);
  const { previousModel } = options;
  const previousInputs = previousModel && preparedInputs.get(previousModel);
  const reusable = previousInputs && sameInputs(inputs, previousInputs) ? previousModel : undefined;
  const { matrix, timeline, periodLabels, formatValue } =
    reusable ??
    prepareRanking(normalized, (message) => {
      inputs.warnings.push(message);
      warn(message);
    });
  if (reusable && previousInputs) {
    inputs.warnings = previousInputs.warnings;
    for (const message of inputs.warnings) warn(message);
  }
  const palette = resolveTheme(normalized.theme).colors.categorical;
  const colorAssignment =
    reusable?.colorAssignment ??
    assignRaceColors(matrix, timeline, encoding.color, encoding.key.field, previousModel);
  const frameColors = resolveRaceColors(colorAssignment.slotsFor(palette.length), palette);

  const model: RaceModel = {
    spec: normalized,
    specWatermark: authoredWatermark(spec, normalized.watermark),
    matrix,
    timeline,
    colorAssignment,
    frameColors,
    periodLabels,
    formatValue,
    playback: {
      durationMs: resolveDurationMs(race, timeline.periodCount),
      holdEndMs: race.holdEnd,
      loop: race.loop,
      autoplay: race.autoplay,
      controls: race.controls,
    },
    warnings,
  };
  preparedInputs.set(model, inputs);
  return model;
}
