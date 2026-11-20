/**
 * The two docs collections. `repoDocs` loads exactly the repository's
 * docs/*.md files that declare a section, so contributor docs never meet the
 * schema; `siteDocs` loads the MDX and Markdown pages written for the site.
 * Both use the page id ("<section>/<slug>") as the entry id.
 */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docSchema, repoDocSchema } from "./content/schema";
import { repoDocsDir, repoPages } from "./lib/repo-docs";

/** The page id repoPages assigned to a docs file. */
function repoPageId(file: string): string {
  const id = repoPages().get(file);
  if (!id) throw new Error(`docs/${file} was loaded but is not a published page.`);
  return id;
}

export const collections = {
  repoDocs: defineCollection({
    loader: glob({
      pattern: [...repoPages().keys()],
      base: repoDocsDir(),
      generateId: ({ entry }) => repoPageId(entry),
    }),
    schema: repoDocSchema,
  }),
  siteDocs: defineCollection({
    loader: glob({
      pattern: "**/*.{md,mdx}",
      base: "./src/content/docs",
      // The URL follows the file path; collection.ts checks the folder against `section`.
      generateId: ({ entry }) => entry.replace(/\.mdx?$/, ""),
    }),
    schema: docSchema,
  }),
};
