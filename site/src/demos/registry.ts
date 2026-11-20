/**
 * Discovers demo modules under src/demos/ and looks demos up by id. Any module
 * in this folder that exports a `defineDemo` value is picked up, so adding a demo
 * never means editing a shared list. The index is built when this module loads,
 * so a duplicate id fails the build on the first page that renders a demo.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import type { DemoDef } from "./types";

/** Thrown when no demo has the requested id. */
export class UnknownDemoError extends Error {}

/** Thrown when two modules define the same demo id. */
export class DuplicateDemoError extends Error {}

/** A module's exports, keyed by the path `import.meta.glob` found it at. */
export type DemoModules = Record<string, Record<string, unknown>>;

// defineDemo returns its argument unchanged, so its values are recognised by shape.
function isDemoDef(value: unknown): value is DemoDef {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DemoDef>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.spec === "object" &&
    typeof candidate.source === "object"
  );
}

/**
 * Indexes every demo the modules export by id.
 *
 * @throws {DuplicateDemoError} When two exports share an id, naming both modules.
 */
export function indexDemos(modules: DemoModules): ReadonlyMap<string, DemoDef> {
  const demos = new Map<string, DemoDef>();
  const definedIn = new Map<string, string>();
  for (const [path, exports] of Object.entries(modules)) {
    for (const demo of Object.values(exports).filter(isDemoDef)) {
      // A module may export one demo under two names (a named and a default export).
      if (demos.get(demo.id) === demo) continue;
      const earlier = definedIn.get(demo.id);
      if (earlier) {
        throw new DuplicateDemoError(
          `Demo id "${demo.id}" is defined in both ${earlier} and ${path}. Rename one of them.`,
        );
      }
      demos.set(demo.id, demo);
      definedIn.set(demo.id, path);
    }
  }
  return demos;
}

const registered = indexDemos(
  import.meta.glob<Record<string, unknown>>(
    // types, registry and source are the demo plumbing, not demo modules.
    ["./**/*.ts", "!./types.ts", "!./registry.ts", "!./source.ts", "!./**/*.test.ts"],
    { eager: true },
  ),
);

/**
 * Returns the demo with this id.
 *
 * @throws {UnknownDemoError} When no demo has the id.
 */
export function getDemo(id: string): DemoDef {
  const demo = registered.get(id);
  if (!demo) {
    throw new UnknownDemoError(
      `No demo has the id "${id}". Define it with defineDemo in a module under src/demos/.`,
    );
  }
  return demo;
}

/**
 * The spec of the demo with this id, which the Markdown exports inline in place of `<Demo />`.
 *
 * @throws {UnknownDemoError} When no demo has the id.
 */
export function demoSpec(id: string): VizSpec {
  return getDemo(id).spec;
}

/** Every registered demo, in id order. */
export function allDemos(): DemoDef[] {
  return [...registered.values()].sort((a, b) => a.id.localeCompare(b.id));
}
