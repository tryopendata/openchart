/**
 * `@opendata-ai/openchart-vanilla/story`: scrollytelling story API.
 *
 * A story is a base spec plus an ordered list of steps; each step is a
 * deep-partial spec patch. Scrolling to step N applies patches 0..N to the
 * base and animates the diff -- marks morph when the data-update-transitions
 * gate passes, otherwise the whole chart crossfades so no step ever
 * visibly snaps. See plans/design-evolution/11-scrollytelling.md.
 */

export type { Camera, CameraTarget, ViewBoxSize } from './camera-math';
export {
  camerasClose,
  cameraTransform,
  damp,
  dampCamera,
  fitTarget,
  FULL_VIEW,
  interpolateCamera,
  scrubCamera,
} from './camera-math';
export { createChartStory } from './create-chart-story';
export { crossfadeUpdate } from './crossfade';
export type { ScrollyFrame, ScrollyFrameGeometry } from './progress-math';
export { computeProgress, framesEqual, quantizeFrame } from './progress-math';
export { isDataCameraTarget, resolveCameraTarget } from './resolve-camera-target';
export type { ScrollDriver, ScrollDriverOptions, ScrollyProgressStore } from './scroll-driver';
export { createScrollDriver } from './scroll-driver';
export type { EasingFn, Tween, TweenConfig } from './tween';
export { clamp01, createTween, easingFns, lerp, storyMotion } from './tween';
export type {
  ChartStoryInstance,
  ChartStoryOptions,
  StoryCameraStep,
  StoryDataCameraTarget,
  StorySpec,
  StorySpecPatch,
  StoryStep,
} from './types';
