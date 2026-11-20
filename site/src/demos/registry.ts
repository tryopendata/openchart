/** Discovers demo modules under src/demos/ and looks demos up by id. */
import type { DemoDef } from "./types";

/** Thrown when no demo has the requested id. */
export class UnknownDemoError extends Error {}

/** Thrown when two modules define the same demo id. */
export class DuplicateDemoError extends Error {}

/**
 * Returns the demo with this id.
 *
 * @throws {UnknownDemoError} When no demo has the id.
 */
export function getDemo(_id: string): DemoDef {
  throw new Error("not implemented");
}

/** Every registered demo, in id order. */
export function allDemos(): DemoDef[] {
  throw new Error("not implemented");
}
