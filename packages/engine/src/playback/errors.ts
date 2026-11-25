/**
 * The error type for data that cannot form a playback matrix. Spec problems go through
 * validation instead; this covers what only the rows reveal.
 */

/** Codes for data that cannot form a playback matrix. */
export type PlaybackDataErrorCode = 'DUPLICATE_KEY_PERIOD' | 'TOO_FEW_PERIODS' | 'NO_VALUES';

/** Data that cannot form a playback timeline. The race's `RaceDataError` extends it. */
export class PlaybackDataError extends Error {
  override readonly name: string = 'PlaybackDataError';

  constructor(
    readonly code: PlaybackDataErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
