/** Playback timing defaults shared by the race and the playback charts and maps. */
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

const DEFAULT_HOLD_END_MS = 1500;
const DEFAULT_MS_PER_PERIOD = 700;
const MIN_DEFAULT_DURATION_MS = 8000;
const MAX_DEFAULT_DURATION_MS = 90000;

function resolveDurationMs(
  block: PlaybackTimingConfig,
  periodCount: number,
  blockName: string,
): number {
  if (block.step === undefined) {
    return (
      block.duration ??
      Math.max(
        MIN_DEFAULT_DURATION_MS,
        Math.min(MAX_DEFAULT_DURATION_MS, periodCount * DEFAULT_MS_PER_PERIOD),
      )
    );
  }
  const durationMs = block.step * (periodCount - 1);
  if (!Number.isFinite(durationMs)) {
    throw new RangeError(
      `${blockName}.step is too large for ${periodCount} periods. Use a shorter step.`,
    );
  }
  return durationMs;
}

function resolvePeriod(period: PlaybackTimingConfig['period']): ResolvedPlayback['period'] {
  if (period === false) return false;
  const position = period?.position ?? 'auto';
  return period?.format === undefined ? { position } : { format: period.format, position };
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
  const timing = block ?? {};
  return {
    durationMs: resolveDurationMs(timing, periodCount, blockName),
    holdEndMs: timing.holdEnd ?? DEFAULT_HOLD_END_MS,
    loop: timing.loop ?? false,
    autoplay: timing.autoplay ?? 'visible',
    controls: timing.controls ?? true,
    gaps: timing.gaps ?? 'interpolate',
    period: resolvePeriod(timing.period),
  };
}
