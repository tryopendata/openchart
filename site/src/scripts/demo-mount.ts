/**
 * Mounts one spec into a demo stage with the vanilla package. The chart goes in
 * its own host element inside the stage, so the static SVGs beside it stay put
 * and destroying the mount leaves the stage as the build wrote it. demos.ts
 * loads this module with `import()`, so pages without demos never fetch the library.
 */
import type { DarkMode, ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";
import {
  createBarList,
  createChart,
  createGeoMap,
  createGraph,
  createSankey,
  createTable,
  createTileMap,
} from "@opendata-ai/openchart-vanilla";
import { chartTheme } from "../lib/demo/chart-theme";
import { DEMO_CLASS } from "../lib/demo/markup";

/** Thrown when a spec cannot be mounted. `cause` is the original error. */
export class DemoMountError extends Error {}

type MountOptions = { theme: ThemeConfig; darkMode: DarkMode };

/** A mounted demo. */
export type DemoMount = {
  /** Destroys the chart and removes its host, leaving the stage as the build wrote it. */
  destroy(): void;
  /** True while the entrance is still held because the chart has not been seen yet. */
  entranceWaiting(): boolean;
};

/** The library holds an entrance by pausing it through this property on the chart's root. */
const HELD_ENTRANCE = '[style*="--oc-play-state"]';
type Mount = (host: HTMLElement, spec: never, options: MountOptions) => { destroy(): void };

const MOUNTS_BY_TYPE: Record<string, Mount> = {
  table: createTable,
  graph: createGraph,
  sankey: createSankey,
  tilemap: createTileMap,
  map: createGeoMap,
  barlist: createBarList,
};

/** The mount function for a spec: charts and layers carry `mark` or `layer`, the rest a `type`. */
function mountFor(spec: VizSpec): Mount | undefined {
  if ("mark" in spec || "layer" in spec) return createChart as Mount;
  return MOUNTS_BY_TYPE[String((spec as { type?: unknown }).type)];
}

/**
 * Mounts a live visualization into the stage. This is the one way any page part
 * (demo figures, landing tiles) mounts a chart and plays its entrance on first sight.
 *
 * With `entrance` set, the chart mounts at once with the library's entrance
 * held, and the library plays it the first time at least a quarter of the stage
 * is in view; under reduced motion nothing plays. Mount ahead of the reader
 * (demos.ts does at LEAD_PX) and the entrance still waits. Without `entrance`
 * the chart draws finished, so a remount never replays it.
 *
 * @throws {DemoMountError} When the spec type has no mount function, or mounting throws.
 */
export function mountDemo(
  stage: HTMLElement,
  spec: VizSpec,
  options: { dark: boolean; entrance: boolean },
): DemoMount {
  const mount = mountFor(spec);
  if (!mount) {
    const type = String((spec as { type?: unknown }).type);
    throw new DemoMountError(
      `No mount function for spec type "${type}". Supported: chart, layer, ${Object.keys(MOUNTS_BY_TYPE).join(", ")}.`,
    );
  }
  const host = stage.ownerDocument.createElement("div");
  host.className = DEMO_CLASS.live;
  stage.append(host);
  // No attribution link inside the chart: this is the library's own site.
  const unbranded = { ...spec, watermark: false };
  const playable = options.entrance ? unbranded : { ...unbranded, animation: false };
  try {
    const instance = mount(host, playable as never, {
      theme: chartTheme(options.dark),
      darkMode: options.dark ? "force" : "off",
    });
    return {
      destroy() {
        instance.destroy();
        host.remove();
      },
      entranceWaiting: () =>
        host.matches(HELD_ENTRANCE) || host.querySelector(HELD_ENTRANCE) !== null,
    };
  } catch (error) {
    host.remove();
    const reason = error instanceof Error ? error.message : String(error);
    throw new DemoMountError(`Mounting the spec failed: ${reason}`, { cause: error });
  }
}
