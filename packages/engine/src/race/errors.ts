/** Data that cannot form a race timeline. */
export class RaceDataError extends Error {
  override readonly name = 'RaceDataError';

  constructor(
    readonly code: 'DUPLICATE_KEY_PERIOD' | 'TOO_FEW_PERIODS' | 'NO_VALUES',
    message: string,
  ) {
    super(message);
  }
}
