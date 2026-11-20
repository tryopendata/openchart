/**
 * The VocabularyWall island: the intent filter above the wall of tiles. The
 * tiles themselves are server-rendered by Vocabulary.astro and passed in as
 * children, so their static SVGs reach the page once and never travel as island
 * props. The island owns the filter state, keeps it in the URL hash, shows and
 * hides tiles (refiling them with Flip when motion is allowed) and starts the
 * tiles' live charts.
 */
import { type ReactNode, useEffect, useReducer, useRef, useState } from "react";
import type { SectionId } from "../../../config";
import { useMotionTools } from "../../shared/use-motion-tools";
import { observeTileScale } from "./tile-scale";
import { isTileShown, type WallFilter, wallFilterReducer, wallHash } from "./wall-filter";
import { startWallLive, WALL_ATTR } from "./wall-live";
import { refile, waveIn } from "./wall-motion";

/** One filter button: an intent, its label and how many tiles it has. */
export type WallIntentOption = { id: SectionId; label: string; count: number };

export type VocabularyWallProps = {
  intents: WallIntentOption[];
  /** The number of tiles on the wall, shown beside "All". */
  total: number;
  /** The server-rendered tile grid. */
  children?: ReactNode;
};

const tilesIn = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>(`[${WALL_ATTR.tile}]`),
];

function announcement(filter: WallFilter, intents: WallIntentOption[], total: number): string {
  if (filter === "all") return `Showing all ${total} charts.`;
  const intent = intents.find((candidate) => candidate.id === filter);
  return `Showing ${intent?.count ?? 0} ${intent?.label.toLowerCase() ?? filter} charts.`;
}

export function VocabularyWall({ intents, total, children }: VocabularyWallProps) {
  const [filter, dispatch] = useReducer(wallFilterReducer, "all");
  const [announced, setAnnounced] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const tools = useMotionTools();
  const flip = useRef<{ kill(): unknown } | null>(null);
  const applied = useRef<WallFilter>("all");

  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    return observeTileScale(root);
  }, []);

  // Restarts when motion arrives or leaves, so tiles already in view mount with the right choice.
  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    return startWallLive(root, { motion: () => tools !== null });
  }, [tools]);

  useEffect(() => {
    const root = gridRef.current;
    if (!root || !tools) return;
    const context = tools.gsap.context(() => waveIn(tools, tilesIn(root)));
    return () => context.revert();
  }, [tools]);

  useEffect(() => {
    const read = () => dispatch({ type: "hash", hash: window.location.hash });
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

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
    flip.current?.kill();
    flip.current = null;
    if (tools) flip.current = refile(tools, tiles, apply);
    else apply();
  }, [filter, tools]);

  const choose = (next: WallFilter) => {
    dispatch({ type: "choose", filter: next });
    setAnnounced(announcement(next, intents, total));
    window.history.replaceState(null, "", wallHash(next));
  };

  const options: { id: WallFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    ...intents,
  ];

  return (
    <div className="wall">
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
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
      <div ref={gridRef}>{children}</div>
    </div>
  );
}
