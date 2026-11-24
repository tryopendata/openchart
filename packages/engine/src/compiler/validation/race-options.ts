import { jsonPointer, type RaceConfig } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { didYouMean } from './helpers';

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

function checkUnknownRaceKeys(race: Record<string, unknown>, errors: ValidationError[]): void {
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
}

function checkTiming(race: Record<string, unknown>, errors: ValidationError[]): number {
  if (race.duration !== undefined && race.step !== undefined) {
    errors.push({
      code: 'INVALID_VALUE',
      path: '/race',
      message: 'Spec error: race.duration and race.step are mutually exclusive',
      suggestion:
        'Keep duration for the whole race or step for each period. Remove the other option.',
    });
  }

  const timingErrorStart = errors.length;
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
  return timingErrorStart;
}

function checkScale(race: Record<string, unknown>, errors: ValidationError[], topAt: number): void {
  const { top, rescale, gaps } = race;
  if (top !== undefined && (!isFiniteNumber(top) || !Number.isInteger(top) || top < 1)) {
    // Preserve the order of diagnostics. Report top before individual timing values.
    errors.splice(topAt, 0, {
      code: 'INVALID_VALUE',
      path: '/race/top',
      message: 'Spec error: race.top must be an integer of at least 1',
      suggestion: 'Set race.top to the desired number of visible ranks, e.g. top: 10.',
    });
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
}

function checkPeriod(period: unknown, errors: ValidationError[]): void {
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

  checkPeriod(period, errors);
}

export function validateOptions(race: unknown, errors: ValidationError[]): void {
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

  checkUnknownRaceKeys(race, errors);
  const timingErrorStart = checkTiming(race, errors);
  checkScale(race, errors, timingErrorStart);
  validatePlaybackOptions(race, errors);
}
