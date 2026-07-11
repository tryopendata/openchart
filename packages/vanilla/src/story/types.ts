import type { ChartSpec, DataRow, GraphSpec, LayerSpec } from '@opendata-ai/openchart-core';
import type { CameraTarget } from './camera-math';

/** A spec a story can drive: same union `ChartInstance.update()` accepts. */
export type StorySpec<TData extends DataRow = DataRow> =
  | ChartSpec<TData>
  | LayerSpec<TData>
  | GraphSpec;

/** Deep-partial patch applied onto the accumulated spec at each step. */
export type StorySpecPatch = Record<string, unknown>;

/**
 * One step in a story. Patches are cumulative: step N's effective spec is
 * the base spec with patches 0..N applied in order.
 */
export interface StoryStep {
  /** Deep-partial patch merged onto the running spec. Omit for a no-op step. */
  spec?: StorySpecPatch;
  /**
   * Emphasis sugar: sets `encoding.color.highlight`. Equivalent to
   * `spec: { encoding: { color: { highlight: [...] } } }` but doesn't
   * require the caller to know the color field is nested under `encoding`.
   * Pass `null` to clear a highlight set by an earlier step.
   */
  highlight?: string[] | null;
  /**
   * Pan/zoom the camera to a data-coordinate region (resolved via the
   * chart's compiled scales) or a raw viewBox-space `CameraTarget`. Pass
   * `null`/omit to return to the full viewBox.
   */
  camera?: StoryCameraStep | null;
}

/** Data-coordinate camera target: resolved to viewBox space via the chart's scales. */
export interface StoryDataCameraTarget {
  /** x-domain range to frame, in data units (or category names for ordinal scales). */
  x?: [unknown, unknown];
  /** y-domain range to frame, in data units (or category names for ordinal scales). */
  y?: [unknown, unknown];
  /** ViewBox units of padding added around the resolved rect. Default 24. */
  padding?: number;
}

export type StoryCameraStep = StoryDataCameraTarget | CameraTarget;

export interface ChartStoryOptions<TData extends DataRow = DataRow> {
  spec: StorySpec<TData>;
  steps: StoryStep[];
  /** Fraction of viewport height where the scroll trigger line sits. Default 0.4. */
  triggerPosition?: number;
  /** Camera driving mode. Step mode (default) eases on step change; scrub follows scroll continuously. */
  cameraMode?: 'step' | 'scrub';
}

export interface ChartStoryInstance {
  /** Jump directly to a step index, applying patches 0..n and animating the diff. */
  goTo(index: number): void;
  /** Register a step element so the built-in scroll driver advances the story on scroll. */
  registerStep(index: number, el: HTMLElement | null): (el: HTMLElement | null) => void;
  /** Register the scrolling container that wraps all step elements. */
  setContainer(el: HTMLElement | null): void;
  /** Current step index. -1 before any step has activated. */
  readonly currentStep: number;
  /** Total number of steps. */
  readonly totalSteps: number;
  /** Tear down the scroll driver, camera, and underlying chart instance. */
  destroy(): void;
}
