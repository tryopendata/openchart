/**
 * Mounts one spec into a demo stage with the vanilla package. The chart goes in
 * its own host element inside the stage, so the static SVGs beside it stay put
 * and destroying the mount leaves the stage as the build wrote it. demos.ts
 * loads this module with `import()`, so pages without demos never fetch the library.
 */
import type {
  ChartEventHandlers,
  DarkMode,
  ThemeConfig,
  VizSpec,
} from "@opendata-ai/openchart-core";
import {
  type ChartInstance,
  createBarList,
  createChart,
  createGeoMap,
  createGraph,
  createSankey,
  createTable,
  createTileMap,
  type InteractionMode,
} from "@opendata-ai/openchart-vanilla";
import { chartTheme } from "../lib/demo/chart-theme";
import { DEMO_CLASS } from "../lib/demo/markup";

/** Thrown when a spec cannot be mounted. `cause` is the original error. */
export class DemoMountError extends Error {}

/** The options every mount function takes; chart event handlers ride along for charts only. */
type MountOptions = {
  theme?: ThemeConfig;
  darkMode: DarkMode;
  renderer?: "svg" | "canvas";
  interaction?: InteractionMode;
};

/** How one demo mounts: the page theme, whether the entrance plays, and the demo's host options. */
export type DemoMountRequest = {
  dark: boolean;
  entrance: boolean;
  /** Leave the site chart theme off, so the spec's own theme shows. */
  ownTheme?: boolean;
  /** The renderer for point marks, from the demo's `mount.renderer`. */
  renderer?: "svg" | "canvas";
  /** What the reader may do with the chart's elements. Pass it whenever `handlers` are given, so they never decide it. */
  interaction?: InteractionMode;
  /** Event handlers for a chart or layer spec, such as the controls' event log. */
  handlers?: ChartEventHandlers;
};

/** A mounted demo. */
export type DemoMount = {
  /** The live chart for a chart or layer spec, for updates and exports; null for other types. */
  instance: ChartInstance | null;
  /** Destroys the chart and removes its host, leaving the stage as the build wrote it. */
  destroy(): void;
  /** True while the entrance is still held because the chart has not been seen yet. */
  entranceWaiting(): boolean;
};

/** The library holds an entrance by pausing it through this property on the chart's root. */
const HELD_ENTRANCE = '[style*="--oc-play-state"]';
type Mount = (host: HTMLElement, spec: never, options: MountOptions) => { destroy(): void };

/**
 * The spec as the site draws it: without the attribution link the library adds
 * inside a chart, since this is the library's own site. Use it for every mount
 * and every `update`.
 */
export function withoutWatermark<T extends VizSpec>(spec: T): T {
  return { ...spec, watermark: false };
}

const isChart = (spec: VizSpec) => "mark" in spec || "layer" in spec;

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
  if (isChart(spec)) return createChart as Mount;
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
export function mountDemo(stage: HTMLElement, spec: VizSpec, options: DemoMountRequest): DemoMount {
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
  const unbranded = withoutWatermark(spec);
  const playable = options.entrance ? unbranded : { ...unbranded, animation: false };
  // Other types name some handlers alike with other signatures, so only a chart gets them.
  const handlers = isChart(spec) ? options.handlers : undefined;
  try {
    const instance = mount(host, playable as never, {
      theme: options.ownTheme ? undefined : chartTheme(options.dark),
      darkMode: options.dark ? "force" : "off",
      ...(options.renderer ? { renderer: options.renderer } : {}),
      ...(options.interaction ? { interaction: options.interaction } : {}),
      ...handlers,
    });
    return {
      instance: isChart(spec) ? (instance as ChartInstance) : null,
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
