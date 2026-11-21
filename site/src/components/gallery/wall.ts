/**
 * The gallery as the pages build it: the entries in src/lib/gallery.ts,
 * checked against the demo registry, the docs pages and the Visualizations
 * sections, and placed on the arranged wall. The gallery pages import this, so
 * a broken entry or an order that leaves a hole fails the build naming the
 * entry. Build-time only: it reads the registry and the docs folder through Vite.
 */
import { allDemos } from "../../demos/registry";
import { galleryEntries } from "../../lib/gallery";
import type { GalleryEntry } from "../../lib/gallery-types";
import { assertGalleryEntries } from "./entry-rules";
import { KINDS } from "./kind-words";
import { arrangeWall, type Placement } from "./wall-layout";

/**
 * The served path of every site docs page: src/content/docs/<section>/<slug>.mdx
 * is /docs/<section>/<slug>/. The one list the entry check uses.
 */
export const docsPagePaths: ReadonlySet<string> = new Set(
  Object.keys(import.meta.glob("../../content/docs/*/*.mdx", { query: "?raw" })).map((file) =>
    file.replace(/^\.\.\/\.\.\/content/, "").replace(/\.mdx$/, "/"),
  ),
);

/**
 * Checks entries against the real demo registry, docs pages and sections.
 *
 * @throws {GalleryEntryError} Naming the first entry that breaks a rule.
 */
export function checkGalleryEntries(entries: readonly GalleryEntry[]): void {
  const demoIds = new Set(allDemos().map((demo) => demo.id));
  assertGalleryEntries(entries, {
    hasDemo: (id) => demoIds.has(id),
    hasDocsPage: (path) => docsPagePaths.has(path),
    kinds: KINDS,
  });
}

checkGalleryEntries(galleryEntries);

/**
 * Where each entry sits on the arranged wall, by slug.
 *
 * @throws {WallLayoutError} When the entry order leaves a hole (on load).
 */
export const wallPlacements: ReadonlyMap<string, Placement> = arrangeWall(galleryEntries);
