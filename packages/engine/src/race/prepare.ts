import type { CompileWarning } from '@opendata-ai/openchart-core';
import { emitSpecWarnings } from '../compile/spec-sugar';
import { compile } from '../compiler/index';
import { resolveFieldFormatter } from '../format/field-format';
import { assignRaceColors } from './colors';
import { buildRaceMatrix } from './matrix';
import { formatPeriodLabels } from './period-labels';
import { createRaceTimeline } from './timeline';
import type { RaceModel } from './types';

export function raceSpecWarning(message: string): CompileWarning {
  return { code: 'RACE_SPEC_WARNING', message };
}

/** @throws A validation error for invalid specs. @throws {RaceDataError} For invalid data. */
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

  const { onWarn } = options;
  const sink = onWarn && ((message: string) => onWarn(raceSpecWarning(message)));
  emitSpecWarnings(warnings, sink);
  const warn = (message: string) => {
    warnings.push(message);
    emitSpecWarnings([message], sink);
  };

  const { data, encoding, race, labels } = normalized;
  const matrix = buildRaceMatrix(data, encoding, race.gaps, warn);
  const periodCount = matrix.periods.length;
  const intervals = periodCount - 1;
  const durationMs =
    race.step === undefined
      ? (race.duration ?? Math.max(8000, Math.min(90000, periodCount * 700)))
      : race.step * intervals;
  if (!Number.isFinite(durationMs)) {
    throw new RangeError(`race.step is too large for ${periodCount} periods. Use a shorter step.`);
  }
  const timeline = createRaceTimeline(matrix, {
    top: race.top,
    swapPeriods: (race.swap / durationMs) * intervals,
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

  return {
    spec: normalized,
    specWatermark:
      typeof spec === 'object' &&
      spec !== null &&
      'watermark' in spec &&
      spec.watermark !== undefined
        ? normalized.watermark
        : undefined,
    matrix,
    timeline,
    colorSlots: assignRaceColors(matrix, timeline, encoding.color, encoding.key.field),
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
