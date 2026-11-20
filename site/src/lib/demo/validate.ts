/** Validates a demo spec so a bad one fails the build with a readable message. */

/** Thrown when a demo's spec fails validation. The message lists every problem and the demo id. */
export class InvalidDemoError extends Error {}

/**
 * Checks a demo spec.
 *
 * @throws {InvalidDemoError} When the spec is not a valid VizSpec.
 */
export function validateDemo(_id: string, _spec: unknown): void {
  throw new Error("not implemented");
}
