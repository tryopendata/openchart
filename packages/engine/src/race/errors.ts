/** The race's name for playback data errors, so race callers keep their `instanceof` checks. */
import { PlaybackDataError } from '../playback/errors';

/** Data that cannot form a race timeline. A `PlaybackDataError` with the race's name. */
export class RaceDataError extends PlaybackDataError {
  override readonly name: string = 'RaceDataError';
}
