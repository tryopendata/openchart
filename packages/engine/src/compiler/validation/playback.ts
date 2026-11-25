import type { ValidationError } from '../types';

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
  blockName: 'race' | 'playback',
  value: unknown,
  errors: ValidationError[],
): void {
  void blockName;
  void value;
  void errors;
  throw new Error('not implemented');
}
