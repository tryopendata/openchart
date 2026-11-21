/**
 * A post's lead chart on the blog index and tag pages: the shared tile
 * specimen (components/shared/tiles/) of the post's `lead` demo, laid out at
 * the blog's tile size (lead-tile-size.ts). PostList.astro sizes the cell and
 * keeps the live chart at the static one's scale.
 */
import { isGraphSpec, isSankeySpec, isTableSpec, type VizSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../demos/registry";
import { tileChartHtml } from "../shared/tiles/tile-markup";
import { LEAD_TILE_SIZE } from "./lead-tile-size";

/** Prefix for the lead tiles' static SVG ids, distinct from the wall's ("w"). */
const LEAD_DOM_PREFIX = "lead";

/**
 * Lead kinds whose tile needs styles that live only in landing-wall.css today
 * (a table's first rows, the placeholder line a sankey or graph shows), so the
 * blog index would draw them unstyled. Lifted once the tile styles are shared.
 */
const UNSTYLED_KINDS: readonly [string, (spec: VizSpec) => boolean][] = [
  ["a table", isTableSpec],
  ["a sankey", isSankeySpec],
  ["a graph", isGraphSpec],
];

/**
 * The stage and embedded spec of a post's lead chart.
 *
 * @throws {Error} Naming the post's file and its `lead` when the demo is unknown or invalid,
 * or is a table, sankey or graph, which the blog's tile styles don't cover yet.
 */
export function leadTileHtml(slug: string, demoId: string, pageShared: Set<string>): string {
  const where = `src/content/blog/${slug}: lead "${demoId}"`;
  try {
    const unstyled = UNSTYLED_KINDS.find(([, test]) => test(getDemo(demoId).spec));
    if (unstyled) {
      throw new Error(
        `is ${unstyled[0]}, which the blog index can't draw as a tile yet. Lead with a chart demo.`,
      );
    }
    return tileChartHtml(demoId, pageShared, { size: LEAD_TILE_SIZE, domPrefix: LEAD_DOM_PREFIX });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${where}: ${reason}`, { cause: error });
  }
}
