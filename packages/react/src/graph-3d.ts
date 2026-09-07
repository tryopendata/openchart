/**
 * React subpath for the 3D graph renderer.
 *
 * Importing this module registers the WebGL renderer with the vanilla graph
 * registry, so a `<Graph />` whose spec sets `dimensions: 3` can mount. It is a
 * side-effect import: there is nothing React-specific here beyond the
 * re-export, and it exists so React hosts never have to reach past
 * `@opendata-ai/openchart-react` for a peer.
 *
 * Import it client-side only (three.js touches `window` at module scope):
 *
 * ```ts
 * useEffect(() => {
 *   import('@opendata-ai/openchart-react/graph-3d');
 * }, []);
 * ```
 */

export * from '@opendata-ai/openchart-vanilla/graph-3d';
