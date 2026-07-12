import { clamp01 } from './tween';

/**
 * Pure math for continuous scrollytelling progress. The `ScrollDriver`
 * measures DOM rects and feeds them here. Ported from
 * opendata/shared/lib/scrolly/progress-math.ts.
 */

export interface ScrollyFrame {
  /** Geometric active step; -1 while the trigger line is above step 0 */
  step: number;
  /** 0..1 progress of the trigger line through the active step's span */
  stepProgress: number;
  /** 0..1 traversal from first step top to last step bottom */
  progress: number;
  direction: 'down' | 'up';
}

export type ScrollyFrameGeometry = Omit<ScrollyFrame, 'direction'>;

/**
 * Compute the geometric frame from viewport-relative step tops.
 *
 * @param tops viewport-relative step top offsets, ordered by step index
 * @param lastBottom viewport-relative bottom of the final step
 * @param triggerY the trigger line's viewport y (innerHeight * triggerPosition)
 */
export function computeProgress(
  tops: number[],
  lastBottom: number,
  triggerY: number,
): ScrollyFrameGeometry {
  const n = tops.length;
  if (n === 0 || triggerY < tops[0]!) {
    return { step: -1, stepProgress: 0, progress: 0 };
  }

  let step = n - 1;
  for (let i = 0; i < n - 1; i++) {
    if (triggerY < tops[i + 1]!) {
      step = i;
      break;
    }
  }

  const stepTop = tops[step]!;
  const spanEnd = step < n - 1 ? tops[step + 1]! : lastBottom;
  const span = Math.max(spanEnd - stepTop, 1);
  const firstTop = tops[0]!;

  return {
    step,
    stepProgress: clamp01((triggerY - stepTop) / span),
    progress: clamp01((triggerY - firstTop) / Math.max(lastBottom - firstTop, 1)),
  };
}

/**
 * Reduced-motion variant: no scrubbing. `stepProgress` pins to 0 and overall
 * progress quantizes to the step's start fraction, so consumers see discrete
 * snaps only.
 */
export function quantizeFrame(
  frame: ScrollyFrameGeometry,
  totalSteps: number,
): ScrollyFrameGeometry {
  if (frame.step < 0 || totalSteps <= 0) {
    return { step: frame.step, stepProgress: 0, progress: 0 };
  }
  return {
    step: frame.step,
    stepProgress: 0,
    progress: clamp01(frame.step / totalSteps),
  };
}

export function framesEqual(a: ScrollyFrame | null, b: ScrollyFrame): boolean {
  return (
    a !== null &&
    a.step === b.step &&
    a.stepProgress === b.stepProgress &&
    a.progress === b.progress &&
    a.direction === b.direction
  );
}
