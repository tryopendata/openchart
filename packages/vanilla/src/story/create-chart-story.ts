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
import { type ChartInstance, createChart, type MountOptions } from '../mount';
import { canTransitionSpecShape } from '../transition';
import {
  type Camera,
  camerasClose,
  dampCamera,
  FULL_VIEW,
  fitTarget,
  interpolateCamera,
  scrubCamera,
  type ViewBoxSize,
} from './camera-math';
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
  const { spec, steps, triggerPosition = 0.4, cameraMode = 'step' } = options;
  // The story machinery is spec-shape agnostic (it only deep-merges patches
  // and hands specs to `update()`, which accepts the non-generic union).
  // Widen once here so the internal helpers don't have to thread `TData`
  // through a discriminated union that TS can't narrow across variants.
  const baseSpec = spec as StorySpec;

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

  /** Fit a step's camera (data-coordinate or raw target, or full view) into the viewBox. */
  function fittedCameraForStep(step: StoryStep | undefined, vb: ViewBoxSize): Camera {
    if (!step?.camera) return fitTarget(FULL_VIEW(vb), vb);
    const target = isDataCameraTarget(step.camera)
      ? resolveCameraTarget(instance.layout, step.camera)
      : step.camera;
    return fitTarget(target, vb);
  }

  // ---- Scrub-mode camera: self-stopping damping loop toward a live target ---
  // Step mode eases discretely on step change (the tween above). Scrub mode
  // reads continuous `stepProgress` and dwells on the active target through a
  // hold zone, transitioning in the tail of the span. The two modes never run
  // at once; the settle loop and the step tween are mutually exclusive drivers.
  let scrubCurrent: Camera | null = null;
  let scrubTarget: Camera | null = null;
  let settleRaf = 0;
  let settling = false;

  function stopSettle(): void {
    if (settling) {
      cancelAnimationFrame(settleRaf);
      settling = false;
    }
  }

  function startSettle(): void {
    if (settling) return;
    settling = true;
    let last = performance.now();
    const tick = (now: number): void => {
      const target = scrubTarget;
      const current = scrubCurrent;
      const vb = readViewBox(container);
      if (!target || !current || !vb) {
        settling = false;
        return;
      }
      const dt = Math.min(now - last, 64);
      last = now;
      const next = dampCamera(current, target, storyMotion.cameraTau, dt);
      scrubCurrent = next;
      applyStoryCamera(container, next, vb);
      if (camerasClose(next, target)) {
        scrubCurrent = target;
        applyStoryCamera(container, target, vb);
        settling = false;
        return;
      }
      settleRaf = requestAnimationFrame(tick);
    };
    settleRaf = requestAnimationFrame(tick);
  }

  /** Step-mode camera: retargetable eased tween on step change. */
  function applyCameraForStep(step: StoryStep | undefined, snap: boolean): void {
    const vb = readViewBox(container);
    if (!vb) return;
    cameraTween.to(fittedCameraForStep(step, vb), { snap: snap || prefersReducedMotion() });
  }

  /** Scrub-mode camera: continuous, driven by the scroll frame's stepProgress. */
  function applyScrubCamera(frame: { step: number; stepProgress: number }): void {
    const vb = readViewBox(container);
    if (!vb) return;
    const fitted = steps.map((step) => fittedCameraForStep(step, vb));
    if (fitted.length === 0) return;

    if (prefersReducedMotion()) {
      const clamped = Math.min(Math.max(frame.step, 0), fitted.length - 1);
      stopSettle();
      scrubCurrent = fitted[clamped]!;
      applyStoryCamera(container, scrubCurrent, vb);
      return;
    }

    scrubTarget = scrubCamera(
      frame.step,
      frame.stepProgress,
      fitted,
      0.65,
      easingFns.easeInOutCubic,
    );
    if (scrubCurrent === null) scrubCurrent = scrubTarget;
    startSettle();
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
      !isFirst &&
      !editModeRequested &&
      prevSpec !== null &&
      canTransitionSpecShape(prevSpec, nextSpec);

    const applyUpdate = () => instance.update(nextSpec);

    if (isFirst || willLikelyMorph || editModeRequested) {
      applyUpdate();
    } else {
      // Outside the morph gate (re-encode, type change, etc.): no step may
      // visibly snap, so crossfade the whole chart instead.
      crossfadeUpdate(container, applyUpdate, { reducedMotion: prefersReducedMotion() });
    }

    // Step mode drives the camera on each discrete step change. Scrub mode
    // drives it continuously from the scroll frame instead (see the scroll
    // subscription below), so it skips the discrete step tween here.
    if (cameraMode === 'step') applyCameraForStep(steps[clamped], isFirst);
  }

  const scrollDriver = editModeRequested ? null : createScrollDriver({ triggerPosition });
  let unsubscribeScroll: (() => void) | null = null;
  if (scrollDriver) {
    unsubscribeScroll = scrollDriver.progress.subscribe((frame) => {
      if (frame.step < 0) return;
      // Discrete spec steps always advance at step boundaries; the v1 non-goal
      // is continuous DATA morph scrubbing, not camera scrub. In scrub mode the
      // camera additionally follows the continuous frame.
      goTo(frame.step);
      if (cameraMode === 'scrub') applyScrubCamera(frame);
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
      stopSettle();
      instance.destroy();
    },
  };
}
