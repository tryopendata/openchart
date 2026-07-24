/**
 * Re-export shim: the spatial index moved to `../spatial-index` and is now
 * generic over any `{ x, y, radius }` entry so the scatter canvas layer can
 * reuse it. Graph call sites get the node-typed instantiation.
 */
import { SpatialIndex as GenericSpatialIndex } from '../spatial-index';
import type { PositionedNode } from './types';

export type { SpatialEntry } from '../spatial-index';

/** Quadtree index over positioned graph nodes. */
export class SpatialIndex extends GenericSpatialIndex<PositionedNode> {}
