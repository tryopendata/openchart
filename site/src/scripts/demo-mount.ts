/** Mounts one spec into a demo stage with the vanilla package. */
import type { VizSpec } from "@opendata-ai/openchart-core";

/** Thrown when a spec cannot be mounted. `cause` is the original error. */
export class DemoMountError extends Error {}

/**
 * Mounts a live visualization into the stage.
 *
 * @throws {DemoMountError} When the spec type has no mount function, or mounting throws.
 */
export function mountDemo(
  _stage: HTMLElement,
  _spec: VizSpec,
  _options: { dark: boolean; entrance: boolean },
): { destroy(): void } {
  throw new Error("not implemented");
}
