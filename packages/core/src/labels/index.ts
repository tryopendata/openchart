/**
 * Labels module barrel export.
 */

export type { LabelCandidate, LabelPriority, OffsetStrategy } from './collision';
export {
  computeLabelBounds,
  detectCollision,
  EXTENDED_OFFSET_STRATEGIES,
  OFFSET_STRATEGIES,
  overlapArea,
  resolveCollisions,
} from './collision';
