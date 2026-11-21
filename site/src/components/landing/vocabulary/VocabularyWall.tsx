/**
 * The VocabularyWall island: the purpose filter above the wall of tiles. The
 * tiles are server-rendered by Vocabulary.astro and passed in as children, so
 * their static content reaches the page once and never travels as island props;
 * the page's demo script mounts their live charts. The island owns the filter
 * state and keeps it in the URL hash, shows and hides tiles (refiling them with
 * Flip when motion is allowed), draws the rules and names in, and scales the
 * live charts to their cells. The filter buttons render only once the island
 * runs: without JavaScript they would do nothing, and the wall shows every tile.
 */
import { type ReactNode, useEffect, useReducer, useRef, useState } from "react";
import type { SectionId } from "../../../config";
import { useHydrated } from "../../shared/use-hydrated";
import { useMotionTools } from "../../shared/use-motion-tools";
import { observeTileScale } from "./tile-scale";
import {
  isTileShown,
  parseWallHash,
  TILE_ATTR,
  type WallFilter,
  wallFilterReducer,
  wallHash,
} from "./wall-filter";
import { finishRefile, refile, waveIn } from "./wall-motion";

/** One filter button: an intent, its label and how many tiles it has. */
export type WallIntentOption = { id: SectionId; label: string; count: number };

export type VocabularyWallProps = {
  intents: WallIntentOption[];
  /** The number of tiles on the wall, shown beside "All". */
  total: number;
  /** The id of the section the wall sits in, scrolled to when a link's hash names a filter. */
  sectionId: string;
  /** The server-rendered tile grid. */
  children?: ReactNode;
};

const tilesIn = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(`[${TILE_ATTR}]`)];

function announcement(filter: WallFilter, intents: WallIntentOption[], total: number): string {
  if (filter === "all") return `Showing all ${total} charts.`;
  const intent = intents.find((candidate) => candidate.id === filter);
  const count = intent?.count ?? 0;
  const noun = count === 1 ? "chart" : "charts";
  return `Showing ${count} ${intent?.label.toLowerCase() ?? filter} ${noun}.`;
}

export function VocabularyWall({ intents, total, sectionId, children }: VocabularyWallProps) {
  const [filter, dispatch] = useReducer(wallFilterReducer, "all");
  const ready = useHydrated();
  const [announced, setAnnounced] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const tools = useMotionTools();
  const applied = useRef<WallFilter>("all");

  useEffect(() => {
    // A link such as /#vocabulary=maps, on arrival or within the page: filter, then
    // bring the wall into view, since no element carries that id for the browser to find.
    const follow = () => {
      if (parseWallHash(window.location.hash) === null) return;
      dispatch({ type: "hash", hash: window.location.hash });
      // Instant: a smooth scroll in flight when GSAP refreshes its triggers is put back.
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [sectionId]);

  useEffect(() => {
    const root = gridRef.current;
    if (root) return observeTileScale(root);
  }, []);

  useEffect(() => {
    const root = gridRef.current;
    if (!root || !tools) return;
    const context = tools.gsap.context(() => waveIn(tools, tilesIn(root)));
    return () => {
      finishRefile(tools, tilesIn(root));
      context.revert();
    };
  }, [tools]);

  useEffect(() => {
    const root = gridRef.current;
    if (!root || applied.current === filter) return;
    applied.current = filter;
    const tiles = tilesIn(root);
    const apply = () => {
      for (const tile of tiles) {
        tile.hidden = !isTileShown(tile.dataset.intent as SectionId, filter);
      }
    };
    if (tools) refile(tools, tiles, apply);
    else apply();
    setAnnounced(announcement(filter, intents, total));
  }, [filter, tools, intents, total]);

  const choose = (next: WallFilter) => {
    dispatch({ type: "choose", filter: next });
    window.history.replaceState(null, "", wallHash(next));
  };

  const options: { id: WallFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    ...intents,
  ];

  return (
    <div className="wall">
      <div className="wall-filter-slot">
        {ready ? (
          <fieldset className="wall-filter">
            <legend className="sr-only">Show charts for one purpose</legend>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="wall-filter-button"
                aria-pressed={filter === option.id}
                onClick={() => choose(option.id)}
              >
                {option.label}
                <span className="wall-count" aria-hidden="true">
                  {option.count}
                </span>
              </button>
            ))}
          </fieldset>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
      <div ref={gridRef}>{children}</div>
    </div>
  );
}
