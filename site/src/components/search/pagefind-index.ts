/**
 * Loads Pagefind's browser bundle from the built site. The build writes it to
 * dist/pagefind/ (src/integrations/pagefind.ts), so it is fetched at run time,
 * outside Vite's module graph; the dev server has no index and the import fails.
 * One load per page: every caller shares the same promise, failure included.
 */
import type { PagefindApi } from "../../lib/search/pagefind-types";

/** Where the build writes Pagefind's browser bundle. */
export const PAGEFIND_URL = "/pagefind/pagefind.js";

let pagefind: Promise<PagefindApi> | undefined;

/** Pagefind, imported and initialised. Rejects when the bundle cannot load. */
export function loadPagefind(): Promise<PagefindApi> {
  pagefind ??= importPagefind();
  return pagefind;
}

async function importPagefind(): Promise<PagefindApi> {
  const module: PagefindApi = await import(/* @vite-ignore */ PAGEFIND_URL);
  await module.init();
  return module;
}
