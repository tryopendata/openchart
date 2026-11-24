/**
 * Mounts one spec into a demo stage with the vanilla package. The chart goes in
 * its own host element inside the stage, so the static SVGs beside it stay put
 * and destroying the mount leaves the stage as the build wrote it. demos.ts
 * loads this module with `import()`, so pages without demos never fetch the library.
 */
import {
  type ChartEventHandlers,
  type DarkMode,
  isChartSpec,
  isLayerSpec,
  isRaceSpec,
  type RaceSpec,
  type ThemeConfig,
  type VizSpec,
} from "@opendata-ai/openchart-core";
import {
  createBarList,
  createChart,
  createGeoMap,
  createGraph,
  createRace,
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
  /** Updates a live chart, layer or race with a compatible spec. */
  update?(spec: VizSpec): void;
  /** Rebuilds a race for the new theme at the same playhead. */
  setTheme?(dark: boolean): void;
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
function withoutWatermark<T extends VizSpec>(spec: T): T {
  return { ...spec, watermark: false };
}

// This module is loaded with import(), so core's predicates add nothing to the up-front bundle.
const isChart = (spec: VizSpec) => isChartSpec(spec) || isLayerSpec(spec);

const MOUNTS_BY_TYPE: Record<string, Mount> = {
  table: createTable,
  graph: createGraph,
  sankey: createSankey,
  tilemap: createTileMap,
  map: createGeoMap,
  barlist: createBarList,
};

function mountRaceDemo(host: HTMLElement, spec: RaceSpec, { dark, ownTheme }: DemoMountRequest) {
  const mount = (spec: RaceSpec, dark: boolean) =>
    createRace(host, spec, {
      theme: ownTheme ? undefined : chartTheme(dark),
      darkMode: dark ? "force" : "off",
    });
  let current = spec;
  let race = mount(current, dark);
  // At t=0 a paused player and a player waiting to be seen report the same state.
  let usedControls = false;
  const listeners = new AbortController();
  const noteControlUse = () => {
    usedControls = true;
  };
  for (const event of ["click", "input", "keydown"]) {
    host.addEventListener(event, noteControlUse, { capture: true, signal: listeners.signal });
  }
  return {
    destroy() {
      listeners.abort();
      race.destroy();
    },
    update(next: VizSpec) {
      if (!isRaceSpec(next))
        throw new DemoMountError("A race demo can only update to a race spec.");
      const unbranded = withoutWatermark(next);
      race.update(unbranded);
      current = unbranded;
    },
    setTheme(dark: boolean) {
      const { t, playing } = race.getState();
      const restorePlayback = usedControls || playing || t !== 0;
      const themed = restorePlayback
        ? mount({ ...current, race: { ...current.race, autoplay: false } }, dark)
        : mount(current, dark);
      race.destroy();
      race = themed;
      if (restorePlayback) {
        if (race.getState().t !== t) race.seek(t);
        if (playing) race.play();
      }
    },
  };
}

function mountVisualization(
  host: HTMLElement,
  spec: VizSpec,
  options: DemoMountRequest,
): Pick<DemoMount, "destroy" | "update" | "setTheme"> {
  const unbranded = withoutWatermark(spec);
  // Races have their own playback settings. The demo's entrance flag only applies to charts.
  if (isRaceSpec(unbranded)) return mountRaceDemo(host, unbranded, options);
  const theme = options.ownTheme ? undefined : chartTheme(options.dark);
  const darkMode: DarkMode = options.dark ? "force" : "off";
  const playable: VizSpec = options.entrance ? unbranded : { ...unbranded, animation: false };
  const mountOptions = {
    theme,
    darkMode,
    renderer: options.renderer,
    interaction: options.interaction,
  };
  if (isChart(playable)) {
    const chart = createChart(host, playable, { ...mountOptions, ...options.handlers });
    return {
      destroy: chart.destroy,
      update(next: VizSpec) {
        if (!isChart(next))
          throw new DemoMountError("A chart demo can only update to a chart or layer spec.");
        chart.update(withoutWatermark(next));
      },
    };
  }
  const type = String((playable as { type?: unknown }).type);
  const mount = MOUNTS_BY_TYPE[type];
  if (!mount) {
    throw new DemoMountError(
      `No mount function for spec type "${type}". Supported: chart, layer, race, ${Object.keys(MOUNTS_BY_TYPE).join(", ")}.`,
    );
  }
  return mount(host, playable as never, mountOptions);
}

/**
 * Mounts a live visualization into the stage. This is the one way any page part
 * (demo figures, landing tiles) mounts a chart and plays its entrance on first sight.
 *
 * With `entrance` set, the chart mounts at once with the library's entrance
 * held, and the library plays it the first time at least a quarter of the stage
 * is in view; under reduced motion nothing plays. Mount ahead of the reader
 * (demos.ts does at LEAD_PX) and the entrance still waits. Without `entrance`
 * the chart draws finished, so a remount never replays it. Races use their own
 * playback settings with either value of `entrance`.
 *
 * @throws {DemoMountError} When the spec type has no mount function, or mounting throws.
 */
export function mountDemo(stage: HTMLElement, spec: VizSpec, options: DemoMountRequest): DemoMount {
  const host = stage.ownerDocument.createElement("div");
  host.className = DEMO_CLASS.live;
  stage.append(host);
  try {
    const instance = mountVisualization(host, spec, options);
    return {
      update: instance.update,
      setTheme: instance.setTheme,
      destroy() {
        instance.destroy();
        host.remove();
      },
      entranceWaiting: () =>
        host.matches(HELD_ENTRANCE) || host.querySelector(HELD_ENTRANCE) !== null,
    };
  } catch (error) {
    host.remove();
    if (error instanceof DemoMountError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new DemoMountError(`Mounting the spec failed: ${reason}`, { cause: error });
  }
}

/** The formats a demo's download buttons offer. */
export type ExportFormat = "svg" | "png" | "csv";

/** The light page's paper, `--color-canvas` in global.css: downloads get it as an opaque background. */
const LIGHT_PAPER = "#ffffff";
const MIME_TYPES: Record<ExportFormat, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  csv: "text/csv",
};

/** The theme a download renders with: the site's light chart theme on opaque paper, or the spec's own. */
function exportTheme(ownTheme: boolean): ThemeConfig | undefined {
  if (ownTheme) return undefined;
  const light = chartTheme(false);
  return { ...light, colors: { ...light.colors, background: LIGHT_PAPER } };
}

/**
 * The demo's chart as a file to download. It renders a separate copy, out of
 * sight at the stage's size, in the light theme on opaque paper, whatever theme
 * the page is in, so the file reads the same wherever it is opened; the live
 * chart is left as it is. The copy is destroyed once the export finishes or fails.
 *
 * @throws {DemoMountError} When the spec is not a chart or layer spec.
 */
export async function exportDemo(
  stage: HTMLElement,
  spec: VizSpec,
  format: ExportFormat,
  { ownTheme = false }: { ownTheme?: boolean } = {},
): Promise<Blob> {
  if (!isChart(spec)) {
    throw new DemoMountError("Only chart and layer specs export from a demo's download buttons.");
  }
  const host = stage.ownerDocument.createElement("div");
  const { width, height } = stage.getBoundingClientRect();
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position: fixed; left: -10000px; top: 0; visibility: hidden";
  // Without a layout box (no layout engine), the library falls back to its default size.
  if (width > 0) host.style.width = `${width}px`;
  if (height > 0) host.style.height = `${height}px`;
  stage.ownerDocument.body.append(host);
  try {
    const chart = createChart(host, { ...withoutWatermark(spec), animation: false } as never, {
      theme: exportTheme(ownTheme),
      darkMode: "off",
      autoResize: false,
    });
    try {
      if (format === "png") return await chart.export("png");
      const text = format === "svg" ? chart.export("svg") : chart.export("csv");
      return new Blob([text], { type: MIME_TYPES[format] });
    } finally {
      chart.destroy();
    }
  } finally {
    host.remove();
  }
}
