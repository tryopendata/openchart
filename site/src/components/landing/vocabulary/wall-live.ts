/**
 * Brings the wall's tiles to life. Each tile is server-rendered with static
 * content (SVGs, a table, or a line naming the chart); when a tile comes into
 * view its live chart mounts and, when motion is allowed, plays the library's
 * entrance the first time. Under reduced motion only tiles without static SVGs
 * (tables, sankeys, networks) mount, without animation. Mounts start at most one
 * per animation frame and at most MAX_LIVE charts are live: past that, the live
 * tile furthest out of view goes back to its static content. A theme change
 * remounts the tiles in view, one per frame; the rest remount when next seen.
 *
 * Every mount goes through `mountTileChart`, the one place the demo system's
 * mount is called, so the shared mount lifecycle can replace it in one edit.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { isPageDark, subscribePageTheme } from "../../shared/page-theme";
import { createWallSpecSource, type WallSpecSource } from "./wall-spec-source";
import { WALL_SPECS_URL } from "./wall-specs";

/** The data attributes the wall's tile markup carries (Vocabulary.astro writes them). */
export const WALL_ATTR = {
  tile: "data-vocabulary-tile",
  stage: "data-wall-stage",
  /** On a stage with no static SVG: it mounts whether or not motion is allowed. */
  eager: "data-wall-eager",
  /** Set while the stage shows its live chart; CSS hides the static content then. */
  live: "data-wall-live",
} as const;

/** Live charts at once; the rest show their static content. */
export const MAX_LIVE = 10;
/** Start mounting a little before a tile scrolls in, so its entrance starts as it appears. */
const LEAD_MARGIN = "80px 0px";
const FAILURE_TEXT = "This chart could not be rendered.";
/** The line a stage without static SVGs shows (lib/demo/markup.ts, DEMO_CLASS.placeholder). */
const PLACEHOLDER = ".demo-placeholder";

/** A mounted tile chart. */
export type TileChart = { destroy(): void };
export type TileMountOptions = { dark: boolean; entrance: boolean };

/** Mounts one tile's chart through the demo system, loading its mount module on first use. */
export async function mountTileChart(
  stage: HTMLElement,
  spec: VizSpec,
  options: TileMountOptions,
): Promise<TileChart> {
  const { mountDemo } = await import("../../../scripts/demo-mount");
  return mountDemo(stage, spec, options);
}

export type WallLiveOptions = {
  /** Whether motion is allowed: the island answers from `prefersReducedMotion`. */
  motion: () => boolean;
  /** Where tile specs come from. Default: the wall's JSON document. */
  specs?: WallSpecSource;
  /** Runs a callback on the next frame and returns a cancel. Default: requestAnimationFrame. */
  nextFrame?: (run: () => void) => () => void;
};

type WallTile = {
  id: string;
  tile: HTMLElement;
  stage: HTMLElement;
  eager: boolean;
  /** Has static content to fall back to, so it may be sent back to it. */
  evictable: boolean;
  visible: boolean;
  queued: boolean;
  pending: boolean;
  live: TileChart | null;
  played: boolean;
  failed: boolean;
};

function readTile(tile: HTMLElement): WallTile | null {
  const stage = tile.querySelector<HTMLElement>(`[${WALL_ATTR.stage}]`);
  if (!stage) return null;
  return {
    id: tile.getAttribute(WALL_ATTR.tile) || "(unnamed tile)",
    tile,
    stage,
    eager: stage.hasAttribute(WALL_ATTR.eager),
    evictable: stage.querySelector(PLACEHOLDER) === null,
    visible: false,
    queued: false,
    pending: false,
    live: null,
    played: false,
    failed: false,
  };
}

const animationFrame = (run: () => void) => {
  const id = requestAnimationFrame(run);
  return () => cancelAnimationFrame(id);
};

/**
 * Watches every tile under `root` and mounts each as described above.
 * Returns a teardown that stops watching and destroys every live chart.
 */
export function startWallLive(root: HTMLElement, options: WallLiveOptions): () => void {
  const specs = options.specs ?? createWallSpecSource(WALL_SPECS_URL);
  const nextFrame = options.nextFrame ?? animationFrame;
  const tiles = [...root.querySelectorAll<HTMLElement>(`[${WALL_ATTR.tile}]`)]
    .map(readTile)
    .filter((tile): tile is WallTile => tile !== null);
  const queue: WallTile[] = [];
  let cancelFrame: (() => void) | null = null;
  let stopped = false;

  const showFailure = (tile: WallTile, error: unknown) => {
    tile.failed = true;
    // A tile with static content keeps it; a tile that only had its placeholder line says so.
    const placeholder = tile.stage.querySelector(PLACEHOLDER);
    if (placeholder) placeholder.textContent = FAILURE_TEXT;
    console.error(`Wall tile "${tile.id}" could not be rendered.`, error);
  };

  const unmount = (tile: WallTile) => {
    tile.live?.destroy();
    tile.live = null;
    tile.stage.removeAttribute(WALL_ATTR.live);
  };

  const liveCount = () => tiles.filter((tile) => tile.live || tile.pending).length;

  /** Frees a slot by sending an evictable tile out of view back to its static content. */
  const makeRoom = () => {
    if (liveCount() < MAX_LIVE) return true;
    const out = tiles.find((tile) => tile.live && tile.evictable && !tile.visible);
    if (!out) return false;
    unmount(out);
    return true;
  };

  const mount = async (tile: WallTile) => {
    tile.pending = true;
    const entrance = options.motion() && !tile.played;
    let themed = false;
    try {
      const spec = await specs.spec(tile.id);
      themed = isPageDark();
      const chart = await mountTileChart(tile.stage, spec, { dark: themed, entrance });
      if (stopped) {
        chart.destroy();
        return;
      }
      tile.live = chart;
      tile.played = true;
      tile.stage.setAttribute(WALL_ATTR.live, "");
    } catch (error) {
      if (!stopped) showFailure(tile, error);
    } finally {
      tile.pending = false;
    }
    // The theme flipped while this chart was mounting: draw it again in the new one.
    if (tile.live && themed !== isPageDark()) {
      unmount(tile);
      request(tile);
    }
  };

  /** Starts the next queued mount, then schedules the one after on the following frame. */
  const runQueue = () => {
    cancelFrame = null;
    const next = queue.shift();
    if (!next) return;
    next.queued = false;
    if (next.visible && !next.live && !next.pending && !next.failed && makeRoom()) {
      void mount(next);
    }
    if (queue.length > 0) cancelFrame = nextFrame(runQueue);
  };

  const request = (tile: WallTile) => {
    if (stopped || tile.live || tile.pending || tile.queued || tile.failed) return;
    if (!tile.eager && !options.motion()) return;
    tile.queued = true;
    queue.push(tile);
    cancelFrame ??= nextFrame(runQueue);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const tile = tiles.find((candidate) => candidate.tile === entry.target);
        if (!tile) continue;
        tile.visible = entry.isIntersecting;
        if (tile.visible) request(tile);
      }
    },
    { rootMargin: LEAD_MARGIN },
  );
  for (const tile of tiles) observer.observe(tile.tile);

  // A mounted chart has no theme setter: tiles in view remount, the rest when next seen.
  let dark = isPageDark();
  const stopTheme = subscribePageTheme(() => {
    if (isPageDark() === dark) return;
    dark = isPageDark();
    for (const tile of tiles.filter((candidate) => candidate.live)) {
      unmount(tile);
      if (tile.visible) request(tile);
    }
  });

  return () => {
    stopped = true;
    cancelFrame?.();
    observer.disconnect();
    stopTheme();
    for (const tile of tiles) unmount(tile);
  };
}
