/**
 * How the gallery names its kinds in sentences: the noun for one graphic of a
 * kind and for several, the live-region line a filter change reads out, and
 * the heading over an entry's related tiles. The labels on buttons come from
 * `docsAreas`; these are the words that read naturally after a number.
 */
import { docsAreas, type VisualizationSectionId } from "../../config";
import type { TileFilter } from "../shared/tiles/tile-filter";

const SECTIONS = docsAreas.find((area) => area.id === "visualizations")?.sections ?? [];

/** Every kind in the order the docs list them, which the filter row follows. */
export const KINDS: readonly VisualizationSectionId[] = SECTIONS.map((section) => section.id);

/** A kind's label as the docs print it: "Change over time". */
export function kindLabel(kind: VisualizationSectionId): string {
  return SECTIONS.find((section) => section.id === kind)?.label ?? kind;
}

/** A kind's noun, singular then plural. */
const NOUNS: Record<VisualizationSectionId, readonly [string, string]> = {
  comparison: ["comparison chart", "comparison charts"],
  "change-over-time": ["chart of change over time", "charts of change over time"],
  "part-to-whole": ["part-to-whole chart", "part-to-whole charts"],
  distribution: ["distribution chart", "distribution charts"],
  correlation: ["correlation chart", "correlation charts"],
  flow: ["flow diagram", "flow diagrams"],
  maps: ["map", "maps"],
  tables: ["table", "tables"],
  composition: ["combined chart", "combined charts"],
};

/** "4 maps", "1 table": a count followed by the kind's noun. */
export function countOf(kind: VisualizationSectionId, count: number): string {
  const [one, many] = NOUNS[kind];
  return `${count} ${count === 1 ? one : many}`;
}

/** The sentence the filter's live region reads after a change: "Showing 4 maps." */
export function filterAnnouncement(
  filter: TileFilter<VisualizationSectionId>,
  count: number,
): string {
  if (filter === "all") return `Showing all ${count} graphics.`;
  return `Showing ${countOf(filter, count)}.`;
}

/** The heading over an entry page's related tiles: "More maps", or "More examples" when they mix kinds. */
export function relatedHeading(kind: VisualizationSectionId, allSameKind: boolean): string {
  if (!allSameKind) return "More examples";
  const [, many] = NOUNS[kind];
  return `More ${many}`;
}
