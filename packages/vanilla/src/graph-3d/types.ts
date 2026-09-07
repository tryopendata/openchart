/**
 * Shared datum shapes for the 3D adapter.
 *
 * `graphData()` owns these objects: d3-force-3d writes `x/y/z` and `vx/vy/vz`
 * onto them every tick, and three-forcegraph replaces `link.source`/`link.target`
 * with node-object references once the link force initializes. The compiled
 * node/edge hangs off each datum so every accessor is a property read rather
 * than a map lookup on the hot path.
 */

import type { CompiledGraphEdge, CompiledGraphNode } from '@opendata-ai/openchart-engine';
import type { ForceGraph3DInstance } from '3d-force-graph';

/** A node datum handed to `graphData()`. */
export interface Node3D {
  id: string;
  /** The compiled node this datum renders. */
  node: CompiledGraphNode;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

/** A link datum handed to `graphData()`. */
export interface Link3D {
  /** Node id at construction; three-forcegraph swaps in the node object. */
  source: string | Node3D;
  /** Node id at construction; three-forcegraph swaps in the node object. */
  target: string | Node3D;
  /** The compiled edge this datum renders. */
  edge: CompiledGraphEdge;
  /** Index into `compilation.edges`; the key for link objects and emphasis. */
  edgeIndex: number;
}

/** The typed 3d-force-graph instance the adapter drives. */
export type Graph3D = ForceGraph3DInstance<Node3D, Link3D>;

/** Node id of a link endpoint, whether or not the force has resolved it. */
export function endpointId(endpoint: string | Node3D): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}
