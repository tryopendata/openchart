/**
 * Builds the Pagefind search index into dist/pagefind/ at the end of every
 * `astro build`, so production (Pages runs `astro build`), CI, the probe build
 * and the browser tests all ship an index. Pagefind indexes only the elements
 * that carry `searchBodyAttrs` (src/lib/search-index.ts). Any error Pagefind
 * reports fails the build.
 */
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import * as pagefind from "pagefind";

/** Thrown when Pagefind cannot build the index. The message lists Pagefind's own errors. */
export class SearchIndexError extends Error {}

/** Fails with Pagefind's errors from one step, naming the step. */
function assertNoErrors(step: string, errors: readonly string[]): void {
  if (errors.length === 0) return;
  throw new SearchIndexError(
    `Pagefind could not ${step} the search index: ${errors.join("; ")}. Check that dist/ holds the built pages.`,
  );
}

/** Indexes the built site in `dist` and writes the index to `<dist>/pagefind`. Returns how many HTML files Pagefind read. */
async function writeSearchIndex(dist: string): Promise<number> {
  try {
    const { index, errors } = await pagefind.createIndex({});
    assertNoErrors("create", errors);
    if (!index) throw new SearchIndexError("Pagefind created no index and reported no error.");
    const added = await index.addDirectory({ path: dist });
    assertNoErrors("add pages to", added.errors);
    const written = await index.writeFiles({ outputPath: `${dist}/pagefind` });
    assertNoErrors("write", written.errors);
    return added.page_count;
  } finally {
    await pagefind.close();
  }
}

/** The Astro integration. Register it last, so it indexes the finished output. */
export function pagefindIntegration(): AstroIntegration {
  return {
    name: "openchart:pagefind",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const dist = fileURLToPath(dir).replace(/\/$/, "");
        let pages: number;
        try {
          pages = await writeSearchIndex(dist);
        } catch (error) {
          if (error instanceof SearchIndexError) throw error;
          throw new SearchIndexError(`Pagefind failed while indexing ${dist}.`, { cause: error });
        }
        // Pagefind reads every page and indexes only those with a search body.
        logger.info(`Pagefind read ${pages} pages and wrote the index to ${dist}/pagefind`);
      },
    },
  };
}
