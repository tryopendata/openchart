/**
 * Reads and writes one value inside a parsed spec by its key path. The copy
 * buttons read folded values back out of a spec, and the mount script writes
 * shared values into one.
 */
import type { SpecPath } from "./markup";

/** Thrown when a path does not lead to a value in the spec. */
export class SpecPathError extends Error {}

type Container = Record<string | number, unknown>;

function isContainer(value: unknown): value is Container {
  return typeof value === "object" && value !== null;
}

/** The object or array holding the path's last key. */
function parentOf(root: unknown, path: SpecPath): Container {
  let current = root;
  for (const key of path.slice(0, -1)) {
    if (!isContainer(current)) break;
    current = current[key];
  }
  if (!isContainer(current) || path.length === 0) {
    throw new SpecPathError(`The spec has no value at ${JSON.stringify(path)}.`);
  }
  return current;
}

/**
 * The value at the path.
 *
 * @throws {SpecPathError} When the path is empty or leads nowhere.
 */
export function valueAt(root: unknown, path: SpecPath): unknown {
  const parent = parentOf(root, path);
  const key = path[path.length - 1] as string | number;
  if (!(key in parent))
    throw new SpecPathError(`The spec has no value at ${JSON.stringify(path)}.`);
  return parent[key];
}

/**
 * Replaces the value at the path, in place.
 *
 * @throws {SpecPathError} When the path is empty or its parent does not exist.
 */
export function setValueAt(root: unknown, path: SpecPath, value: unknown): void {
  parentOf(root, path)[path[path.length - 1] as string | number] = value;
}
