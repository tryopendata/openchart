/**
 * `createChartStory`: a base spec plus an ordered list of deep-partial
 * patch steps, driven by scroll (built-in `ScrollDriver`) or directly via
 * `goTo(n)`.
 *
 * Animation-clock ownership (decision baked 2026-07-11, see
 * plans/design-evolution/11-scrollytelling.md): the data-update-transitions
 * driver in `../transition.ts` owns mark morphing; the ported tween in
 * `./tween.ts` owns camera and any scalar story-level animation. They never
 * animate the same property. `goTo` calls `ChartInstance.update()`, which
 * internally decides morph-vs-instant-swap via `canTransition`; this module
 * predicts that decision ahead of time (`canTransitionSpecShape`) only to
 * decide whether to arm the crossfade fallback, and separately drives the
 * camera tween. It does not bridge the two clocks.
 */

import type { DataRow } from '@opendata-ai/openchart-core';
import { deepMergeSpec } from '@opendata-ai/openchart-core';
import { createChart, type ChartInstance, type MountOptions } from '../mount';
import { canTransitionSpecShape } from '../transition';
import { fitTarget, FULL_VIEW, interpolateCamera, type Camera } from './camera-math';
import { crossfadeUpdate } from './crossfade';
import { isDataCameraTarget, resolveCameraTarget } from './resolve-camera-target';
import { createScrollDriver } from './scroll-driver';
import { applyStoryCamera, readViewBox } from './story-camera';
import { createTween, easingFns, storyMotion } from './tween';
import type {
  ChartStoryInstance,
  ChartStoryOptions,
  StorySpec,
  StorySpecPatch,
  StoryStep,
} from './types';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Merge a step's `highlight` sugar into its `spec` patch as `encoding.color.highlight`. */
function stepToPatch(step: StoryStep): StorySpecPatch {
  let patch = step.spec ?? {};
  if ('highlight' in step) {
    patch = deepMergeSpec(patch, {
      encoding: { color: { highlight: step.highlight ?? undefined } },
    });
  }
  return patch;
}

/** Apply patches 0..index (inclusive) onto the base spec, cumulatively. */
function resolveSpecAtStep(base: StorySpec, steps: StoryStep[], index: number): StorySpec {
  let spec: StorySpec = base;
  for (let i = 0; i <= index && i < steps.length; i++) {
    spec = deepMergeSpec(spec, stepToPatch(steps[i]!));
  }
  return spec;
}

/**
 * Create a scrollytelling story bound to a container. Mounts a chart with
 * the base spec, then drives it through cumulative patch steps as the
 * reader scrolls (or via `goTo`).
 *
 * `editMode` (any of `onEdit`/`onSelect`/`onDeselect`/`onTextEdit` on
 * `mountOptions`) and an active story are mutually exclusive in v1: passing
 * both warns once and disables the story's own drive loop, matching the
 * seriesSearch/edit-mode precedent in `mount.ts`.
 */
export function createChartStory<TData extends DataRow = DataRow>(
  container: HTMLElement,
  options: ChartStoryOptions<TData>,
  mountOptions?: MountOptions,
): ChartStoryInstance {
  const { spec: baseSpec, steps, triggerPosition = 0.4, cameraMode = 'step' } = options;

  const editModeRequested = !!(
    mountOptions?.onEdit ||
    mountOptions?.onSelect ||
    mountOptions?.onDeselect ||
    mountOptions?.onTextEdit
  );
  if (editModeRequested) {
    console.warn(
      '[openchart] a chart story and edit mode are mutually exclusive; the story will not drive updates while editing callbacks are active.',
    );
  }

  let currentStep = -1;
  let destroyed = false;

  const initialSpec = resolveSpecAtStep(baseSpec, steps, 0);
  const instance: ChartInstance = createChart(container, initialSpec, mountOptions);

  const cameraTween = createTween<Camera>({
    initial: { cx: 0, cy: 0, k: 1 },
    lerp: interpolateCamera,
    duration: storyMotion.camera,
    ease: easingFns.easeInOutCubic,
    onFrame: (camera) => {
      const vb = readViewBox(container);
      if (vb) applyStoryCamera(container, camera, vb);
    },
  });

  function applyCameraForStep(step: StoryStep | undefined, snap: boolean): void {
    const vb = readViewBox(container);
    if (!vb) return;

    if (!step?.camera) {
      cameraTween.to(fitTarget(FULL_VIEW(vb), vb), { snap: snap || prefersReducedMotion() });
      return;
    }

    const target = isDataCameraTarget(step.camera)
      ? resolveCameraTarget(instance.layout, step.camera)
      : step.camera;
    cameraTween.to(fitTarget(target, vb), { snap: snap || prefersReducedMotion() });
  }

  function goTo(index: number): void {
    if (destroyed) return;
    const clamped = Math.max(0, Math.min(index, steps.length - 1));
    if (clamped === currentStep) return;

    const isFirst = currentStep === -1;
    currentStep = clamped;

    const prevSpec = isFirst ? null : resolveSpecAtStep(baseSpec, steps, clamped - 1);
    const nextSpec = resolveSpecAtStep(baseSpec, steps, clamped);

    const willLikelyMorph =
      !isFirst && !editModeRequested && prevSpec !== null && canTransitionSpecShape(prevSpec, nextSpec);

    const applyUpdate = () => instance.update(nextSpec);

    if (isFirst || willLikelyMorph || editModeRequested) {
      applyUpdate();
    } else {
      // Outside the morph gate (re-encode, type change, etc.): no step may
      // visibly snap, so crossfade the whole chart instead.
      crossfadeUpdate(container, applyUpdate, { reducedMotion: prefersReducedMotion() });
    }

    applyCameraForStep(steps[clamped], isFirst);
  }

  const scrollDriver = editModeRequested ? null : createScrollDriver({ triggerPosition });
  let unsubscribeScroll: (() => void) | null = null;
  if (scrollDriver) {
    unsubscribeScroll = scrollDriver.progress.subscribe((frame) => {
      if (frame.step < 0) return;
      if (cameraMode === 'scrub') {
        // Scrub mode still advances discrete spec steps at step boundaries;
        // only the camera reads continuous stepProgress (v1 non-goal is
        // continuous DATA morph scrubbing, not camera scrub -- see plan
        // scope: "Should: camera scrub mode").
        goTo(frame.step);
      } else {
        goTo(frame.step);
      }
    });
  }

  return {
    goTo,
    registerStep(index, el) {
      scrollDriver?.registerStep(index, el);
      return (nextEl: HTMLElement | null) => scrollDriver?.registerStep(index, nextEl);
    },
    setContainer(el) {
      scrollDriver?.setContainer(el);
    },
    get currentStep() {
      return currentStep;
    },
    get totalSteps() {
      return steps.length;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeScroll?.();
      scrollDriver?.destroy();
      cameraTween.cancel();
      instance.destroy();
    },
  };
}
