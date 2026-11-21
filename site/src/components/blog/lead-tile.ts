/**
 * A post's lead chart on the blog index and tag pages: the shared tile
 * specimen (components/shared/tiles/) of the post's `lead` demo, laid out at
 * the blog's tile size (lead-tile-size.ts), styled by the shared tiles.css.
 * Any demo may lead: a table or sankey shows its fallback table and a network
 * its placeholder line until the live chart mounts.
 */
import type { TileRequest } from "../shared/tiles/tile-files";
import { tileChartHtml, tileRequests } from "../shared/tiles/tile-markup";
import { LEAD_TILE_SIZE } from "./lead-tile-size";

/**
 * The stage and embedded spec of a post's lead chart.
 *
 * @throws {Error} Naming the post's file and its `lead` when the demo is unknown or invalid.
 */
export function leadTileHtml(slug: string, demoId: string, pageShared: Set<string>): string {
  try {
    return tileChartHtml(demoId, pageShared, { size: LEAD_TILE_SIZE });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`src/content/blog/${slug}: lead "${demoId}": ${reason}`, { cause: error });
  }
}

/** The static tile files the posts' lead charts show. */
export function leadTileRequests(leads: readonly string[]): TileRequest[] {
  return leads.flatMap((demo) => tileRequests(demo, { size: LEAD_TILE_SIZE }));
}
