/**
 * A post's lead chart on the blog index and tag pages: the shared tile
 * specimen (components/shared/tiles/) of the post's `lead` demo, laid out at
 * the blog's tile size (lead-tile-size.ts). PostList.astro sizes the cell and keeps the live chart
 * at the static one's scale.
 */
import { tileChartHtml } from "../shared/tiles/tile-markup";
import { LEAD_TILE_SIZE } from "./lead-tile-size";

/** Prefix for the lead tiles' static SVG ids, distinct from the wall's ("w"). */
const LEAD_DOM_PREFIX = "lead";

/**
 * The stage and embedded spec of a post's lead chart.
 *
 * @throws {Error} Naming the post's file and its `lead` when the demo is unknown or invalid.
 */
export function leadTileHtml(slug: string, demoId: string, pageShared: Set<string>): string {
  try {
    return tileChartHtml(demoId, pageShared, { size: LEAD_TILE_SIZE, domPrefix: LEAD_DOM_PREFIX });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`src/content/blog/${slug}: lead "${demoId}": ${reason}`, { cause: error });
  }
}
