/** Validation of a race's `race` block and of the `playback` block a race may carry instead. */
import { jsonPointer, type RaceConfig } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { didYouMean } from './helpers';
import { validatePlaybackBlock } from './playback';

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

/** Field order of race block errors. '' is the block itself (duration and step together). */
const RACE_ERROR_ORDER = [
  '',
  'top',
  'duration',
  'step',
  'swap',
  'holdEnd',
  'rescale',
  'gaps',
  'loop',
  'controls',
  'autoplay',
  'summary',
  'period',
];

const CHART_ONLY_PLAYBACK_OPTIONS = ['labels', 'trails'];

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

function checkSwap(swap: unknown, errors: ValidationError[]): void {
  if (swap === undefined || (isFiniteNumber(swap) && swap >= 0)) return;
  errors.push({
    code: 'INVALID_VALUE',
    path: '/race/swap',
    message: 'Spec error: race.swap must be a finite number of zero or more',
    suggestion: 'Use swap: 0 or omit the option. Times are in milliseconds.',
  });
}

function checkScale(race: Record<string, unknown>, errors: ValidationError[]): void {
  const { top, rescale } = race;
  if (top !== undefined && (!isFiniteNumber(top) || !Number.isInteger(top) || top < 1)) {
    errors.push({
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
}

function checkSummary(summary: unknown, errors: ValidationError[]): void {
  if (summary === undefined || summary === 'sum' || summary === false) return;
  errors.push({
    code: 'INVALID_VALUE',
    path: '/race/summary',
    message: 'Spec error: race.summary must be "sum" or false',
    suggestion: 'Use "sum" to show the total for visible items or false to hide the summary.',
  });
}

/** The race block field an error path names: `/race/period/format` gives `period`, `/race` gives ''. */
function raceField(path: string): string {
  return path.split('/')[2] ?? '';
}

/** Shared and race-only field checks, reported in the race's field order. */
function checkRaceFields(race: Record<string, unknown>, errors: ValidationError[]): void {
  const fieldErrors: ValidationError[] = [];
  validatePlaybackBlock('race', race, fieldErrors);
  checkScale(race, fieldErrors);
  checkSwap(race.swap, fieldErrors);
  checkSummary(race.summary, fieldErrors);
  const rank = (error: ValidationError) => RACE_ERROR_ORDER.indexOf(raceField(error.path));
  errors.push(...fieldErrors.sort((a, b) => rank(a) - rank(b)));
}

/** Duration in one block and step in the other, reported at the playback field. */
function checkTimingAcrossBlocks(
  race: Record<string, unknown>,
  playback: Record<string, unknown>,
  errors: ValidationError[],
): void {
  for (const [raceField, playbackField] of [
    ['duration', 'step'],
    ['step', 'duration'],
  ]) {
    if (race[raceField] === undefined || playback[playbackField] === undefined) continue;
    errors.push({
      code: 'INVALID_VALUE',
      path: jsonPointer('playback', playbackField),
      message: `Spec error: duration and step are mutually exclusive across race and playback (race.${raceField}, playback.${playbackField})`,
      suggestion:
        'Keep duration for the whole race or step for each period, in one block. Remove the other option.',
    });
  }
}

function checkPlaybackAgainstRace(
  race: unknown,
  playback: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (isRecord(race)) checkTimingAcrossBlocks(race, playback, errors);
  for (const field of Object.keys(playback)) {
    if (CHART_ONLY_PLAYBACK_OPTIONS.includes(field)) {
      errors.push({
        code: 'INVALID_VALUE',
        path: jsonPointer('playback', field),
        message: `Spec error: playback.${field} applies to point and circle charts only`,
        suggestion: `Remove playback.${field} from the race spec.`,
      });
    } else if (isRecord(race) && race[field] !== undefined && playback[field] !== undefined) {
      errors.push({
        code: 'INVALID_VALUE',
        path: jsonPointer('playback', field),
        message: `Spec error: ${field} is set in both race and playback`,
        suggestion: `Keep ${field} in one block. Remove it from race or from playback.`,
      });
    }
  }
}

/**
 * Append problems with a race's `race` block to `errors` without throwing: unknown options
 * first, then each field's problems in the race's field order.
 */
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
  checkRaceFields(race, errors);
}

/**
 * Append problems with a race's top-level `playback` block to `errors` without throwing:
 * the shared playback checks, the chart-only `labels` and `trails`, and any field also set
 * in `race`, each at `/playback/<field>`.
 */
export function validateRacePlayback(
  race: unknown,
  playback: unknown,
  errors: ValidationError[],
): void {
  if (playback === undefined) return;
  validatePlaybackBlock('playback', playback, errors);
  if (isRecord(playback)) checkPlaybackAgainstRace(race, playback, errors);
}
