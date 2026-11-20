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
 * Mounts a live visualization into the stage. The entrance animation is off unless
 * `entrance` is set, so a finished static chart is never replaced by one drawing itself in.
 *
 * @throws {DemoMountError} When the spec type has no mount function, or mounting throws.
 */
export function mountDemo(
  stage: HTMLElement,
  spec: VizSpec,
  options: { dark: boolean; entrance: boolean },
): { destroy(): void } {
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
    };
  } catch (error) {
    host.remove();
    const reason = error instanceof Error ? error.message : String(error);
    throw new DemoMountError(`Mounting the spec failed: ${reason}`, { cause: error });
  }
}
