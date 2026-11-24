import {
  jsonPointer,
  type RaceConfig,
  type RaceMarkType,
  type RaceTableColumn,
} from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { didYouMean } from './helpers';

const MARK_OPTIONS: Record<RaceMarkType, string> = {
  bar: 'cornerRadius',
  line: 'window',
  table: 'columns',
};

const TABLE_COLUMNS: readonly string[] = [
  'rank',
  'change',
  'name',
  'bar',
  'value',
  'share',
] satisfies RaceTableColumn[];

const RACE_OPTIONS = [
  'top',
  'duration',
  'step',
  'swap',
  'rescale',
  'gaps',
  'holdEnd',
  'loop',
  'autoplay',
  'controls',
  'period',
  'summary',
] satisfies (keyof RaceConfig)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateEncoding(encoding: unknown, errors: ValidationError[]): void {
  if (!isRecord(encoding)) {
    errors.push({
      code: encoding === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE',
      path: '/encoding',
      message: 'Spec error: a race requires an "encoding" object',
      suggestion:
        'Add an encoding object with time, key, and value channels that name data fields.',
    });
    return;
  }

  const examples = { time: 'year', key: 'country', value: 'gdp' };
  for (const [channel, example] of Object.entries(examples)) {
    const definition = encoding[channel];
    if (!isRecord(definition)) {
      errors.push({
        code: definition === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE',
        path: jsonPointer('encoding', channel),
        message:
          definition === undefined
            ? `Spec error: race encoding requires a "${channel}" channel`
            : `Spec error: encoding.${channel} must be an object`,
        suggestion: `Add encoding.${channel} with a field from your data, e.g. { field: "${example}" }.`,
      });
      continue;
    }

    const { field, type } = definition;
    if (typeof field !== 'string' || field.trim() === '') {
      errors.push({
        code: field === undefined ? 'MISSING_FIELD' : 'INVALID_TYPE',
        path: jsonPointer('encoding', channel, 'field'),
        message: `Spec error: encoding.${channel} requires a non-empty "field" string`,
        suggestion: `Set encoding.${channel}.field to the name of a column in your data, e.g. "${example}".`,
      });
    }

    if (channel === 'value' && type !== undefined && type !== 'quantitative') {
      errors.push({
        code: 'ENCODING_MISMATCH',
        path: '/encoding/value/type',
        message: `Spec error: encoding.value.type must be "quantitative"${typeof type === 'string' ? `, received "${type}"` : ''}`,
        suggestion:
          'Set encoding.value.type to "quantitative" or omit it, and rank a numeric column.',
      });
    }

    if (
      channel === 'time' &&
      type !== undefined &&
      type !== 'temporal' &&
      type !== 'ordinal' &&
      type !== 'quantitative'
    ) {
      errors.push({
        code: 'ENCODING_MISMATCH',
        path: '/encoding/time/type',
        message: 'Spec error: encoding.time.type must be "temporal", "ordinal", or "quantitative"',
        suggestion:
          'Use "temporal" for dates or years, "ordinal" for ordered categories, or "quantitative" for numbers.',
      });
    }
  }
}

function validateMarkOptions(
  type: RaceMarkType,
  definition: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const { cornerRadius, window, columns } = definition;
  if (
    type === 'bar' &&
    cornerRadius !== undefined &&
    (!isFiniteNumber(cornerRadius) || cornerRadius < 0)
  ) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/mark/cornerRadius',
      message: 'Spec error: mark.cornerRadius must be a finite, non-negative number of pixels',
      suggestion: 'Use cornerRadius: 4 for rounded corners or omit it for square corners.',
    });
  }
  if (type === 'line' && window !== undefined && window !== 'reveal' && window !== 'all') {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/mark/window',
      message: 'Spec error: mark.window must be "reveal" or "all"',
      suggestion: 'Use "reveal" to extend the axis to the playhead or "all" to show the full span.',
    });
  }
  if (
    type === 'table' &&
    columns !== undefined &&
    !(
      Array.isArray(columns) &&
      [...columns].every((column) => typeof column === 'string' && TABLE_COLUMNS.includes(column))
    )
  ) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/mark/columns',
      message: 'Spec error: mark.columns must be an array of supported table column names',
      suggestion:
        'Choose columns from "rank", "change", "name", "bar", "value", "share" in display order, or omit columns for the defaults.',
    });
  }
}

function validateMark(mark: unknown, errors: ValidationError[]): void {
  const definition = isRecord(mark) ? mark : undefined;
  const type = definition ? definition.type : mark;
  if (type !== 'bar' && type !== 'line' && type !== 'table') {
    errors.push({
      code:
        type === undefined
          ? 'MISSING_FIELD'
          : typeof type === 'string'
            ? 'INVALID_VALUE'
            : 'INVALID_TYPE',
      path: definition ? '/mark/type' : '/mark',
      message:
        typeof type === 'string'
          ? `Spec error: "${type}" is an unsupported race mark. Use "bar", "line", or "table".`
          : 'Spec error: a race mark must be "bar", "line", or "table"',
      suggestion:
        'Use mark: "bar" for horizontal bars, or set mark.type to "bar", "line", or "table".',
    });
    return;
  }

  if (!definition) return;
  const supported = MARK_OPTIONS[type];
  for (const option of Object.keys(definition)) {
    if (option === 'type' || option === supported) continue;
    errors.push({
      code: 'INVALID_VALUE',
      path: jsonPointer('mark', option),
      message: `Spec error: unknown option "${option}" on the race "${type}" mark`,
      suggestion: `Remove "${option}". The "${type}" mark supports "${supported}".${didYouMean(option, [supported])}`,
    });
  }
  validateMarkOptions(type, definition, errors);
}

function validatePlaybackOptions(race: Record<string, unknown>, errors: ValidationError[]): void {
  for (const option of ['loop', 'controls']) {
    if (race[option] === undefined || typeof race[option] === 'boolean') continue;
    errors.push({
      code: 'INVALID_VALUE',
      path: jsonPointer('race', option),
      message: `Spec error: race.${option} must be true or false`,
      suggestion: `Use ${option}: false to disable it or ${option}: true to enable it.`,
    });
  }

  const { autoplay, summary, period } = race;
  if (autoplay !== undefined && autoplay !== 'visible' && typeof autoplay !== 'boolean') {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/autoplay',
      message: 'Spec error: race.autoplay must be "visible", true, or false',
      suggestion:
        'Use "visible" to start when the chart is in view, true to start immediately, or false to wait for play.',
    });
  }
  if (summary !== undefined && summary !== 'sum' && summary !== false) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/summary',
      message: 'Spec error: race.summary must be "sum" or false',
      suggestion: 'Use "sum" to show the total for visible items or false to hide the summary.',
    });
  }

  if (period === undefined || period === false) return;
  if (!isRecord(period)) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/period',
      message: 'Spec error: race.period must be false or an object',
      suggestion:
        'Use period: false to hide the label, period: { format: "%Y" } to format it, or omit period to use the default label.',
    });
    return;
  }
  if (period.format !== undefined && typeof period.format !== 'string') {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/period/format',
      message: 'Spec error: race.period.format must be a string',
      suggestion: 'Use a format string such as format: "%Y" for temporal years or omit format.',
    });
  }
  if (period.position !== undefined && period.position !== 'auto') {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/period/position',
      message: 'Spec error: race.period.position must be "auto"',
      suggestion: 'Use position: "auto" or omit position to let the chart place the label.',
    });
  }
}

function validateOptions(race: unknown, errors: ValidationError[]): void {
  if (race === undefined) return;
  if (!isRecord(race)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: '/race',
      message: 'Spec error: race must be an object when provided',
      suggestion: 'Use race: { top: 10 } or omit race to use the defaults.',
    });
    return;
  }

  for (const option of Object.keys(race)) {
    if (RACE_OPTIONS.some((known) => known === option)) continue;
    const hint = didYouMean(option, RACE_OPTIONS);
    errors.push({
      code: 'INVALID_VALUE',
      path: jsonPointer('race', option),
      message: `Spec error: Unknown race option "${option}"`,
      suggestion: hint
        ? `Check the option name and keep its value.${hint}`
        : `Remove "${option}". Supported race options are ${RACE_OPTIONS.join(', ')}.`,
    });
  }

  const { duration, step, top, rescale, gaps } = race;
  if (duration !== undefined && step !== undefined) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race',
      message: 'Spec error: race.duration and race.step are mutually exclusive',
      suggestion:
        'Keep duration for the whole race or step for each period. Remove the other option.',
    });
  }

  if (top !== undefined && (!isFiniteNumber(top) || !Number.isInteger(top) || top < 1)) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/top',
      message: 'Spec error: race.top must be an integer of at least 1',
      suggestion: 'Set race.top to the desired number of visible ranks, e.g. top: 10.',
    });
  }

  const timingExamples = { duration: 12000, step: 700, swap: 0, holdEnd: 0 };
  for (const [option, example] of Object.entries(timingExamples)) {
    const value = race[option];
    if (value === undefined) continue;
    const allowZero = option === 'swap' || option === 'holdEnd';
    if (!isFiniteNumber(value) || value < 0 || (value === 0 && !allowZero)) {
      errors.push({
        code: 'INVALID_VALUE',
        path: jsonPointer('race', option),
        message: `Spec error: race.${option} must be a finite number ${allowZero ? 'of zero or more' : 'greater than zero'}`,
        suggestion: `Use ${option}: ${example} or omit the option. Times are in milliseconds.`,
      });
    }
  }

  if (
    rescale !== undefined &&
    rescale !== 'frame' &&
    rescale !== 'fixed' &&
    !(isRecord(rescale) && isFiniteNumber(rescale.min))
  ) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/rescale',
      message: 'Spec error: race.rescale must be "frame", "fixed", or an object with a finite min',
      suggestion:
        'Use "frame" to follow visible values, "fixed" to keep one scale, or { min: 100 } to set a floor on the maximum.',
    });
  }

  if (gaps !== undefined && gaps !== 'interpolate' && gaps !== 'hold' && gaps !== 'drop') {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race/gaps',
      message: 'Spec error: race.gaps must be "interpolate", "hold", or "drop"',
      suggestion:
        'Use "interpolate" to fill gaps between observed periods, "hold" to carry the last value, or "drop" to leave values absent.',
    });
  }
  validatePlaybackOptions(race, errors);
}

export function validateRaceSpec(spec: Record<string, unknown>, errors: ValidationError[]): void {
  if (!Array.isArray(spec.data)) {
    errors.push({
      code: 'INVALID_TYPE',
      path: '/data',
      message: 'Spec error: a race requires a "data" array',
      suggestion: 'Provide data as an array of rows with one row per key and period.',
    });
  } else {
    for (const [index, row] of spec.data.entries()) {
      if (isRecord(row)) continue;
      errors.push({
        code: 'INVALID_TYPE',
        path: jsonPointer('data', index),
        message: 'Spec error: each race data row must be an object',
        suggestion: `Replace or remove row ${index + 1}. Each row should name the fields used by time, key, and value.`,
      });
    }
  }

  validateEncoding(spec.encoding, errors);
  validateMark(spec.mark, errors);
  validateOptions(spec.race, errors);

  if (Object.hasOwn(spec, 'transform')) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/transform',
      message:
        "Race specs don't support transform yet. Aggregate your data to one row per key and period before passing it in.",
      suggestion: 'Remove transform and put the aggregated rows in data.',
    });
  }
}
