import type { PlaybackPeriodPosition, PlaybackTimingConfig } from '@opendata-ai/openchart-core';
import type { PlaybackGaps } from './matrix';

/** Playback timing with every default applied. */
export interface ResolvedPlayback {
  /** Total run length at 1×, excluding the end hold. */
  durationMs: number;
  holdEndMs: number;
  loop: boolean;
  autoplay: 'visible' | boolean;
  controls: boolean;
  gaps: PlaybackGaps;
  /** False hides the period label. `format` is set only when authored here. */
  period: false | { format?: string; position: PlaybackPeriodPosition };
}

/**
 * Apply the shared playback defaults: holdEnd 1500, loop false, autoplay "visible",
 * controls true, gaps "interpolate", period { position: "auto" }. Duration is `step x
 * (periods - 1)` when step is set, else the authored duration, else periods x 700 clamped
 * to 8000..90000 (the race's rule).
 *
 * @param blockName Names the block in the step overflow message. Defaults to `playback`.
 * @throws {RangeError} `<blockName>.step is too large for N periods. Use a shorter step.`
 */
export function resolvePlayback(
  block: PlaybackTimingConfig | undefined,
  periodCount: number,
  blockName: 'race' | 'playback' = 'playback',
): ResolvedPlayback {
  void block;
  void periodCount;
  void blockName;
  throw new Error('not implemented');
}
