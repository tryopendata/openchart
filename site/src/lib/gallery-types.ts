/**
 * The examples gallery's data contract, shared by the entry list
 * (src/lib/gallery.ts), the gallery pages, the social card route and the build
 * tests. Neither side defines its own.
 */
import type { VisualizationSectionId } from "../config";

/** One graphic in the gallery: a tile on /examples/ and a page at /examples/<slug>/. */
export type GalleryEntry = {
  /** URL segment under /examples/: lowercase letters, digits, hyphens. Unique. */
  slug: string;
  /** A registered demo id. Its spec's chrome.title is the headline the tile shows. */
  demo: string;
  /** The Visualizations section it is filed under; the filter uses it. */
  kind: VisualizationSectionId;
  /** The detail page's h1 and the tile's label: what the graphic shows, not a slogan. */
  title: string;
  /** At most 160 characters. Meta description, social card text and the detail page lede. */
  description: string;
  /** An existing docs page, /docs/<section>/<slug>/. */
  docs: string;
  /** "wide" spans two columns from 900px. Default "standard". */
  size?: "standard" | "wide";
  /** The Ladle story this ports, as "<page-slug>#<demo-id>", when it ports one. */
  ladle?: string;
};

/** A Visualizations section the gallery leaves out on purpose, and why. */
export type GalleryGap = { kind: VisualizationSectionId; reason: string };

/** The tile's layout size in px, static and live. */
export const GALLERY_TILE_SIZE = { width: 360, height: 240 } as const;

/** The key the gallery's filter lives under in the URL hash: `#kind=maps`. */
export const GALLERY_HASH_KEY = "kind";
