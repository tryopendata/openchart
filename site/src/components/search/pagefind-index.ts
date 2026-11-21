/**
 * Loads Pagefind's browser bundle from the built site. The build writes it to
 * dist/pagefind/ (src/integrations/pagefind.ts), so it is fetched at run time,
 * outside Vite's module graph; the dev server has no index and the import
 * fails. Callers keep the promise and drop it on failure to retry.
 */
import type { PagefindApi } from "../../lib/search/pagefind-types";

/** Where the build writes Pagefind's browser bundle. */
export const PAGEFIND_URL = "/pagefind/pagefind.js";

/**
 * Pagefind, imported and initialised with its filter index loaded, so every
 * search reports match counts per area. Rejects when the bundle cannot load.
 */
export async function loadPagefind(): Promise<PagefindApi> {
  const module: PagefindApi = await import(/* @vite-ignore */ PAGEFIND_URL);
  await module.init();
  await module.filters();
  return module;
}
