/**
 * Svelte subpath for the 3D graph renderer.
 *
 * Importing this module registers the WebGL renderer with the vanilla graph
 * registry, so a `<Graph />` whose spec sets `dimensions: 3` can mount. It is a
 * side-effect import: there is nothing Svelte-specific here beyond the
 * re-export, and it exists so Svelte hosts never have to reach past
 * `@opendata-ai/openchart-svelte` for a peer (vanilla is a transitive
 * dependency, which strict resolvers refuse to resolve a deep import against).
 *
 * Import it client-side only (three.js touches `window` at module scope):
 *
 * ```ts
 * onMount(() => {
 *   import('@opendata-ai/openchart-svelte/graph-3d');
 * });
 * ```
 */

export * from '@opendata-ai/openchart-vanilla/graph-3d';
