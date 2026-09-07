/**
 * `@opendata-ai/openchart-vanilla/graph-3d` — the WebGL graph renderer.
 *
 * Importing this module registers the 3D renderer for `dimensions: 3`; after
 * that, `createGraph()` picks it up on its own. That side effect is the whole
 * point of the separate subpath: three.js (~30MB unpacked) never enters the
 * default bundle, and `createGraph()` never dynamically imports a renderer,
 * because mount is synchronous and every framework wrapper assumes it is.
 *
 * ```ts
 * import { createGraph } from '@opendata-ai/openchart-vanilla';
 * import '@opendata-ai/openchart-vanilla/graph-3d';
 *
 * createGraph(el, { type: 'graph', dimensions: 3, nodes, edges });
 * ```
 *
 * `three`, `3d-force-graph` and `three-spritetext` are optional peer
 * dependencies; install them alongside openchart to use this entry point, and
 * check `npm ls three` shows exactly one copy (two copies fail at runtime with
 * `Cannot read properties of undefined (reading 'VERTEX')`).
 *
 * SSR: the libraries touch `window` at import, so import this module from a
 * client-only path (a `useEffect` dynamic import in React Router / Next).
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { registerGraphRenderer } from '../graph/renderer-registry';
import { createGraph, type GraphInstance, type GraphMountOptions } from '../graph-mount';
import { createGraph3DRenderer } from './mount';

registerGraphRenderer(3, createGraph3DRenderer);

export type { EmphasisInput, EmphasisTargets } from './emphasis';
export { resolveEmphasis } from './emphasis';
export { forceCluster3D } from './forces';
export type { LabelCandidate } from './labels';
export { LABEL_BUDGET_3D, resolveVisibleLabels } from './labels';
export { LINK_WIDTH_MAX_EDGES } from './links';
export type { Camera3D, FlyTarget3D } from './mount';
export { createGraph3DRenderer, FIT_DISTANCE, NODE_FOCUS_DISTANCE } from './mount';

/**
 * Mount a 3D graph without the caller having to set `dimensions: 3` themselves.
 *
 * A thin convenience over `createGraph()`: the spec is forced to three
 * dimensions and everything else — shell, compilation, node-count gate, handle
 * — is the shared path. A graph above `MAX_3D_NODES` still falls back to the 2D
 * renderer with a warning, exactly as `createGraph()` would.
 */
export function createGraph3D(
  container: HTMLElement,
  spec: GraphSpec,
  options?: GraphMountOptions,
): GraphInstance {
  return createGraph(container, { ...spec, dimensions: 3 }, options);
}
