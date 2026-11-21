/**
 * The examples gallery's entries, in wall order, and the Visualizations
 * sections it leaves out. /examples/, each /examples/<slug>/ page, the social
 * cards and the search index all derive from this list.
 *
 * phase-5-stub: two entries on existing tier-1 demos until lane a fills the gallery.
 */
import type { GalleryEntry, GalleryGap } from "./gallery-types";

/** Every gallery entry, in the order the wall shows them. */
export const galleryEntries: readonly GalleryEntry[] = [
  {
    slug: "most-populous-countries",
    demo: "comparison/bar-sorted",
    kind: "comparison",
    title: "The ten most populous countries",
    description: "A sorted bar chart of the ten most populous countries in 2025.",
    docs: "/docs/comparison/bar/",
  },
  {
    slug: "unemployment-by-state",
    demo: "maps/choropleth-basic",
    kind: "maps",
    title: "Unemployment rate by state",
    description: "A choropleth of the unemployment rate in each US state.",
    docs: "/docs/maps/choropleth/",
  },
];

/** Visualizations sections with no gallery entry, each with the reason. */
export const GALLERY_GAPS: readonly GalleryGap[] = [];
