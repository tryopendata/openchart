/**
 * The eager part of site search, loaded on every page by BaseLayout. It wires
 * the header trigger and the keyboard shortcuts, then loads the dialog code
 * with a dynamic import on first use, so no search code ships up front. The
 * build test holds this module, with its static imports, to 2 KB gzipped.
 *
 * Stub: it wires nothing yet, so the trigger stays hidden (see Search.astro).
 */
export {};
