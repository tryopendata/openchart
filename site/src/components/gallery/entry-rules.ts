/**
 * The rules every gallery entry must meet before a page is built from it: a
 * well-formed unique slug, a registered demo, a docs page that exists, a kind
 * that is a Visualizations section and a description short enough for a meta
 * tag. The lookups are passed in, so the rules have no I/O of their own and
 * src/lib/gallery.ts applies them to the real registry and docs.
 */
import type { GalleryEntry } from "../../lib/gallery-types";

/** Thrown when an entry breaks a rule; the message names the entry and the fix. */
export class GalleryEntryError extends Error {}

/** What the rules need to know about the rest of the site. */
export type GalleryLookups = {
  /** Whether a demo with this id is registered. */
  hasDemo(id: string): boolean;
  /** Whether a docs page is served at this path, such as "/docs/maps/choropleth/". */
  hasDocsPage(path: string): boolean;
  /** The Visualizations section ids an entry may be filed under. */
  kinds: readonly string[];
};

/** The longest description a meta tag and a social card show in full. */
export const MAX_DESCRIPTION = 160;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = "src/lib/gallery.ts";

/** Every rule one entry breaks, as sentences naming the fix. */
function problemsWith(entry: GalleryEntry, lookups: GalleryLookups): string[] {
  const problems: string[] = [];
  if (!SLUG.test(entry.slug)) {
    problems.push("its slug must be lowercase letters and digits joined by single hyphens");
  }
  if (!lookups.hasDemo(entry.demo)) {
    problems.push(`no demo has the id "${entry.demo}"; define it under src/demos/`);
  }
  if (!lookups.hasDocsPage(entry.docs)) {
    problems.push(`"${entry.docs}" is not a docs page; use a path like /docs/maps/choropleth/`);
  }
  if (!lookups.kinds.includes(entry.kind)) {
    problems.push(`kind "${entry.kind}" is not one of ${lookups.kinds.join(", ")}`);
  }
  if (entry.description.length > MAX_DESCRIPTION) {
    problems.push(
      `its description is ${entry.description.length} characters; shorten it to ${MAX_DESCRIPTION}`,
    );
  }
  return problems;
}

/**
 * Checks every entry against the rules, and slugs and demos for repeats.
 *
 * @throws {GalleryEntryError} Naming the first entry that breaks a rule, with every rule it breaks.
 */
export function assertGalleryEntries(
  entries: readonly GalleryEntry[],
  lookups: GalleryLookups,
): void {
  const slugs = new Set<string>();
  const demos = new Set<string>();
  for (const entry of entries) {
    const problems = problemsWith(entry, lookups);
    if (slugs.has(entry.slug)) problems.push("another entry already uses this slug");
    if (demos.has(entry.demo)) problems.push(`another entry already shows "${entry.demo}"`);
    if (problems.length > 0) {
      throw new GalleryEntryError(
        `${FILE}: gallery entry "${entry.slug}": ${problems.join("; ")}.`,
      );
    }
    slugs.add(entry.slug);
    demos.add(entry.demo);
  }
}
