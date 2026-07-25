/**
 * Data-update transitions. Implementation lives in ./transition/ -- this
 * barrel preserves the module's import surface. See ./transition/driver.ts
 * for the top-level docblock.
 */

export { runTransition } from './transition/driver';
export {
  CANVAS_DEFAULT_UPDATE_MAX_MARKS,
  canTransition,
  canTransitionSpecShape,
  DEFAULT_UPDATE_MAX_MARKS,
} from './transition/gate';
export { normalizePointArrays } from './transition/interpolate';
export type {
  CanvasLayerLike,
  GeometrySnapshot,
  SnapshotGeometry,
  TransitionHandle,
} from './transition/types';
