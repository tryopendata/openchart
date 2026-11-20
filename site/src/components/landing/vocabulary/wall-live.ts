/**
 * Brings the wall's tiles to life in the browser. Each tile is server-rendered
 * with static SVGs; when motion is allowed, a tile mounts its live chart the
 * first time it is seen (or hovered, or focused) and plays the library's own
 * entrance once. Under reduced motion the static SVGs stay, except for tiles
 * whose spec type has no static renderer (tables, networks, sankeys): those
 * mount as soon as they near the viewport, without animation, since otherwise
 * they would show nothing. A theme change remounts live tiles in the new theme.
 * Mounting goes through the demo system's `mountDemo`, so a tile is drawn the
 * way the same demo is drawn on its docs page.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { isPageDark, subscribePageTheme } from "../../shared/page-theme";

/** The data attributes the wall's tile markup carries (Vocabulary.astro writes them). */
export const WALL_ATTR = {
  tile: "data-vocabulary-tile",
  stage: "data-wall-stage",
  spec: "data-wall-spec",
  /** On a stage with no static SVG: it mounts whether or not motion is allowed. */
  eager: "data-wall-eager",
  live: "data-wall-live",
  error: "data-wall-error",
} as const;

/** Start mounting a little before a tile scrolls in, so its entrance starts as it appears. */
const LEAD_MARGIN = "80px 0px";
const FAILURE_TEXT = "This chart could not be rendered.";

type Mounter = typeof import("../../../scripts/demo-mount");

type WallTile = {
  id: string;
  tile: HTMLElement;
  stage: HTMLElement;
  eager: boolean;
  live: { destroy(): void } | null;
  played: boolean;
  failed: boolean;
};

export type WallLiveOptions = {
  /** Whether motion is allowed right now: the island answers from `useMotionTools`. */
  motion: () => boolean;
};

function readTile(tile: HTMLElement): WallTile | null {
  const stage = tile.querySelector<HTMLElement>(`[${WALL_ATTR.stage}]`);
  if (!stage) return null;
  return {
    id: tile.getAttribute(WALL_ATTR.tile) || "(unnamed tile)",
    tile,
    stage,
    eager: stage.hasAttribute(WALL_ATTR.eager),
    live: null,
    played: false,
    failed: false,
  };
}

function readSpec(tile: WallTile): VizSpec {
  const text = tile.tile.querySelector(`script[${WALL_ATTR.spec}]`)?.textContent;
  if (!text) throw new Error(`Wall tile "${tile.id}" has no embedded spec.`);
  return JSON.parse(text) as VizSpec;
}

function showFailure(tile: WallTile, error: unknown): void {
  if (tile.failed) return;
  tile.failed = true;
  tile.stage.setAttribute(WALL_ATTR.error, "");
  if (tile.eager) {
    const message = tile.stage.ownerDocument.createElement("p");
    message.className = "wall-placeholder";
    message.textContent = FAILURE_TEXT;
    tile.stage.replaceChildren(message);
  }
  console.error(`Wall tile "${tile.id}" could not be rendered.`, error);
}

function unmount(tile: WallTile): void {
  tile.live?.destroy();
  tile.live = null;
  tile.stage.removeAttribute(WALL_ATTR.live);
}

function mountTile(tile: WallTile, mounter: Mounter, entrance: boolean): void {
  if (tile.live || tile.failed) return;
  try {
    tile.live = mounter.mountDemo(tile.stage, readSpec(tile), { dark: isPageDark(), entrance });
    tile.played = true;
    tile.stage.querySelector(".wall-placeholder")?.remove();
    tile.stage.setAttribute(WALL_ATTR.live, "");
  } catch (error) {
    showFailure(tile, error);
  }
}

/**
 * Watches every tile under `root` and mounts each as described above.
 * Returns a teardown that stops watching and destroys every live chart.
 */
export function startWallLive(root: HTMLElement, options: WallLiveOptions): () => void {
  const tiles = [...root.querySelectorAll<HTMLElement>(`[${WALL_ATTR.tile}]`)]
    .map(readTile)
    .filter((tile): tile is WallTile => tile !== null);
  let mounter: Promise<Mounter> | null = null;
  let stopped = false;

  const withMounter = (tile: WallTile, use: (module: Mounter) => void) => {
    mounter ??= import("../../../scripts/demo-mount");
    mounter
      .then((module) => {
        if (!stopped) use(module);
      })
      .catch((error: unknown) => showFailure(tile, error));
  };

  const request = (tile: WallTile) => {
    const motion = options.motion();
    if (tile.live || tile.failed || (!motion && !tile.eager)) return;
    withMounter(tile, (module) => mountTile(tile, module, motion && !tile.played));
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const tile = tiles.find((candidate) => candidate.tile === entry.target);
        if (tile && entry.isIntersecting) request(tile);
      }
    },
    { rootMargin: LEAD_MARGIN },
  );
  const listeners = tiles.map((tile) => {
    const onApproach = () => request(tile);
    tile.tile.addEventListener("pointerenter", onApproach);
    tile.tile.addEventListener("focusin", onApproach);
    observer.observe(tile.tile);
    return () => {
      tile.tile.removeEventListener("pointerenter", onApproach);
      tile.tile.removeEventListener("focusin", onApproach);
    };
  });

  // A mounted chart has no theme setter, so a theme change rebuilds each live one quietly.
  let dark = isPageDark();
  const stopTheme = subscribePageTheme(() => {
    if (isPageDark() === dark) return;
    dark = isPageDark();
    for (const tile of tiles.filter((candidate) => candidate.live)) {
      unmount(tile);
      withMounter(tile, (module) => mountTile(tile, module, false));
    }
  });

  return () => {
    stopped = true;
    observer.disconnect();
    stopTheme();
    for (const remove of listeners) remove();
    for (const tile of tiles) unmount(tile);
  };
}
