/**
 * Validation of playback timing blocks. The same checks run on a race's `race` block and on
 * a `playback` block; the block name goes into every path and message.
 */
import { jsonPointer, type PlaybackConfig } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';
import { didYouMean } from './helpers';

type BlockName = 'race' | 'playback';

const PLAYBACK_OPTIONS = [
  'duration',
  'step',
  'gaps',
  'holdEnd',
  'loop',
  'autoplay',
  'controls',
  'period',
  'labels',
  'trails',
] satisfies (keyof PlaybackConfig)[];

const TIMING_EXAMPLES = { duration: 12000, step: 700, holdEnd: 0 };
const PERIOD_POSITIONS = ['auto', 'center', 'top-right', 'bottom-left'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function invalid(path: string, message: string, suggestion: string): ValidationError {
  return { code: 'INVALID_VALUE', path, message: `Spec error: ${message}`, suggestion };
}

function checkUnknownPlaybackKeys(block: Record<string, unknown>, errors: ValidationError[]): void {
  for (const option of Object.keys(block)) {
    if (PLAYBACK_OPTIONS.some((known) => known === option)) continue;
    const hint = didYouMean(option, PLAYBACK_OPTIONS);
    errors.push(
      invalid(
        jsonPointer('playback', option),
        `Unknown playback option "${option}"`,
        hint
          ? `Check the option name and keep its value.${hint}`
          : `Remove "${option}". Supported playback options are ${PLAYBACK_OPTIONS.join(', ')}.`,
      ),
    );
  }
}

function checkTiming(name: BlockName, block: Record<string, unknown>, errors: ValidationError[]) {
  if (block.duration !== undefined && block.step !== undefined) {
    errors.push(
      invalid(
        `/${name}`,
        `${name}.duration and ${name}.step are mutually exclusive`,
        `Keep duration for the whole ${name} or step for each period. Remove the other option.`,
      ),
    );
  }
  for (const [option, example] of Object.entries(TIMING_EXAMPLES)) {
    const value = block[option];
    if (value === undefined) continue;
    const allowZero = option === 'holdEnd';
    if (isFiniteNumber(value) && value >= 0 && (value > 0 || allowZero)) continue;
    errors.push(
      invalid(
        jsonPointer(name, option),
        `${name}.${option} must be a finite number ${allowZero ? 'of zero or more' : 'greater than zero'}`,
        `Use ${option}: ${example} or omit the option. Times are in milliseconds.`,
      ),
    );
  }
}

function checkGaps(name: BlockName, gaps: unknown, errors: ValidationError[]): void {
  if (gaps === undefined || gaps === 'interpolate' || gaps === 'hold' || gaps === 'drop') return;
  errors.push(
    invalid(
      `/${name}/gaps`,
      `${name}.gaps must be "interpolate", "hold", or "drop"`,
      'Use "interpolate" to fill gaps between observed periods, "hold" to carry the last value, or "drop" to leave values absent.',
    ),
  );
}

function checkSwitches(name: BlockName, block: Record<string, unknown>, errors: ValidationError[]) {
  for (const option of ['loop', 'controls']) {
    if (block[option] === undefined || typeof block[option] === 'boolean') continue;
    errors.push(
      invalid(
        jsonPointer(name, option),
        `${name}.${option} must be true or false`,
        `Use ${option}: false to disable it or ${option}: true to enable it.`,
      ),
    );
  }
  const { autoplay } = block;
  if (autoplay === undefined || autoplay === 'visible' || typeof autoplay === 'boolean') return;
  errors.push(
    invalid(
      `/${name}/autoplay`,
      `${name}.autoplay must be "visible", true, or false`,
      'Use "visible" to start when the chart is in view, true to start immediately, or false to wait for play.',
    ),
  );
}

function checkPeriod(name: BlockName, period: unknown, errors: ValidationError[]): void {
  if (period === undefined || period === false) return;
  if (!isRecord(period)) {
    errors.push(
      invalid(
        `/${name}/period`,
        `${name}.period must be false or an object`,
        'Use period: false to hide the label, period: { format: "%Y" } to format it, or omit period to use the default label.',
      ),
    );
    return;
  }
  if (period.format !== undefined && typeof period.format !== 'string') {
    errors.push(
      invalid(
        `/${name}/period/format`,
        `${name}.period.format must be a string`,
        'Use a format string such as format: "%Y" for temporal years or omit format.',
      ),
    );
  }
  if (name !== 'playback' || period.position === undefined) return;
  if (PERIOD_POSITIONS.some((position) => position === period.position)) return;
  errors.push(
    invalid(
      '/playback/period/position',
      `playback.period.position must be ${PERIOD_POSITIONS.map((p) => `"${p}"`).join(', ')}`,
      'Use "auto" to place the label for the chart type, or omit position.',
    ),
  );
}

function checkHighlights(block: Record<string, unknown>, errors: ValidationError[]): void {
  const { labels, trails } = block;
  if (labels !== undefined && !isStringArray(labels)) {
    errors.push(
      invalid(
        '/playback/labels',
        'playback.labels must be an array of key names',
        'Use labels: ["China", "India"] with values from the key field, or omit labels.',
      ),
    );
  }
  if (trails !== undefined && typeof trails !== 'boolean' && !isStringArray(trails)) {
    errors.push(
      invalid(
        '/playback/trails',
        'playback.trails must be true, false, or an array of key names',
        'Use trails: true for every key, trails: ["China"] for named keys, or omit trails.',
      ),
    );
  }
}

/**
 * Append problems with a playback timing block to `errors` without throwing. Paths and
 * messages name the block (`/race/duration`, `race.duration`), so the race's messages stay
 * as they are. Checks the shared fields in the race's order: duration and step together
 * (path `/<block>`), duration, step and holdEnd values, gaps, loop, controls, autoplay and
 * period (`format`, plus `position` for `playback`).
 *
 * For `playback` it also requires an object, rejects unknown keys at `/playback/<key>` with
 * "Unknown playback option", and checks the `labels` and `trails` shapes. For `race` it
 * checks only the shared fields; race-only fields and unknown keys stay in race-options.
 */
export function validatePlaybackBlock(
  blockName: BlockName,
  value: unknown,
  errors: ValidationError[],
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    if (blockName === 'race') return;
    errors.push({
      code: 'INVALID_TYPE',
      path: '/playback',
      message: 'Spec error: playback must be an object when provided',
      suggestion: 'Use playback: { duration: 12000 } or omit playback to use the defaults.',
    });
    return;
  }

  if (blockName === 'playback') checkUnknownPlaybackKeys(value, errors);
  checkTiming(blockName, value, errors);
  checkGaps(blockName, value.gaps, errors);
  checkSwitches(blockName, value, errors);
  checkPeriod(blockName, value.period, errors);
  if (blockName === 'playback') checkHighlights(value, errors);
}
