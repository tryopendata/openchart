/** The race's matrix: the shared playback matrix with one `value` channel plus labels and colors. */
import type { DataRow, RaceEncoding } from '@opendata-ai/openchart-core';
import { PlaybackDataError } from '../playback/errors';
import { buildPlaybackMatrix, type PlaybackMatrix } from '../playback/matrix';
import { RaceDataError } from './errors';
import type { RaceMatrix, ResolvedRaceOptions } from './types';

const VALUE_CHANNEL = 'value';
const MANY_KEYS_ADVICE =
  'can slow race rank precomputation. Filter to the keys that can reach the top N, or aggregate the rest into an "Other" key.';

function buildValueMatrix(
  rows: DataRow[],
  encoding: RaceEncoding,
  staticFields: string[],
  gaps: ResolvedRaceOptions['gaps'],
  warn: (message: string) => void,
): PlaybackMatrix {
  try {
    return buildPlaybackMatrix(
      rows,
      {
        identity: encoding.key.field,
        time: encoding.time,
        channels: [{ name: VALUE_CHANNEL, field: encoding.value.field }],
        staticFields,
        requireTwoPeriods: true,
        noun: 'keys',
        manyKeysAdvice: MANY_KEYS_ADVICE,
      },
      gaps,
      warn,
    );
  } catch (error) {
    if (!(error instanceof PlaybackDataError)) throw error;
    throw new RaceDataError(error.code, error.message, { cause: error });
  }
}

/**
 * Pivots long rows into a dense matrix with interpolate, hold, or drop applied to interior gaps.
 * Quantitative periods sort numerically. Temporal periods sort by year when all are numeric,
 * or by epoch milliseconds when any is a date. Ordinals follow a sort array, reverse first-seen
 * order for `descending`, or first-seen order.
 * Warns about skipped rows, non-finite values, and more than 500 distinct keys.
 *
 * @throws {RaceDataError} DUPLICATE_KEY_PERIOD, TOO_FEW_PERIODS, NO_VALUES
 */
export function buildRaceMatrix(
  rows: DataRow[],
  encoding: RaceEncoding,
  gaps: ResolvedRaceOptions['gaps'],
  warn: (message: string) => void,
): RaceMatrix {
  const labelField = encoding.label?.field;
  const colorField = encoding.color && 'field' in encoding.color ? encoding.color.field : undefined;
  const staticFields = [labelField, colorField].filter((field) => field !== undefined);
  const matrix = buildValueMatrix(rows, encoding, staticFields, gaps, warn);

  const labels = matrix.keys.map((key, index) => {
    const label = labelField === undefined ? undefined : matrix.statics[index][labelField];
    return label == null ? key : String(label);
  });
  const colorValues = matrix.statics.map((statics) => {
    const color = colorField === undefined ? undefined : statics[colorField];
    return color == null ? null : String(color);
  });
  return {
    periods: matrix.periods,
    keys: matrix.keys,
    labels,
    colorValues,
    values: matrix.values[VALUE_CHANNEL],
  };
}
