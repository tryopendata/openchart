/** Re-export shim: motion primitives moved to `../motion/tween` and are now shared with the scatter canvas layer. */

export type { TweenOptions } from '../motion/tween';
export {
  createTween,
  cubicInOut,
  cubicOut,
  linear,
  prefersReducedMotion,
  resolveEase,
} from '../motion/tween';
