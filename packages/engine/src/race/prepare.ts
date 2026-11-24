import { type CompileWarning, resolveTheme } from '@opendata-ai/openchart-core';
import { emitSpecWarnings, type WarnSink } from '../compile/spec-sugar';
import { compile } from '../compiler/index';
import { resolveFieldFormatter } from '../format/field-format';
import { assignRaceColors, resolveRaceColors } from './colors';
import { buildRaceMatrix } from './matrix';
import { formatPeriodLabels } from './period-labels';
import { createRaceTimeline } from './timeline';
import type { RaceModel, ResolvedRaceOptions } from './types';

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

/**
 * Validate and prepare the size-independent race model.
 * @throws {Error} Aggregated spec validation errors or a valid non-race spec.
 * @throws {RaceDataError} Duplicate rows, too few periods, or no finite values.
 * @throws {RangeError} The step multiplied by the period intervals overflows.
 */
export function prepareRace(
  spec: unknown,
  options: { onWarn?: (w: CompileWarning) => void },
): RaceModel {
  const { spec: normalized, warnings } = compile(spec);
  if (!('type' in normalized) || normalized.type !== 'race') {
    throw new Error(
      'prepareRace received a non-race spec. Set type to "race" or use the matching compiler.',
    );
  }

  const warn = createRaceWarn(warnings, options.onWarn);
  const { data, encoding, race, labels } = normalized;
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
  const colorSlots = assignRaceColors(matrix, timeline, encoding.color, encoding.key.field);
  const frameColors = resolveRaceColors(
    colorSlots,
    resolveTheme(normalized.theme).colors.categorical,
  );

  return {
    spec: normalized,
    specWatermark: authoredWatermark(spec, normalized.watermark),
    matrix,
    timeline,
    colorSlots,
    frameColors,
    periodLabels,
    formatValue,
    playback: {
      durationMs,
      holdEndMs: race.holdEnd,
      loop: race.loop,
      autoplay: race.autoplay,
      controls: race.controls,
    },
    warnings,
  };
}
