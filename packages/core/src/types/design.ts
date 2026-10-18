import type { EditOp } from './events';
import type { DataRow, VizSpec } from './spec';

/** Supplied semantics; the library never invents a measure or uncertainty. */
export interface FieldMetadata {
  /** Explicit imported field type; preserved with the portable document. */
  type?: 'text' | 'number' | 'date';
  /** Identifies an internal, persistent row identity column. */
  role?: 'identity';
  label?: string;
  unit?: string;
  measure?: string;
  provenance?: string;
  /** Percent is encoded 0–100; proportion is encoded 0–1. */
  representation?: 'number' | 'percent' | 'proportion';
  interval?: { lower: string; upper: string };
  statusField?: string;
}

export interface DesignDiagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  status: 'failed' | 'uncheckable';
  path: string;
  viewport: { width: number; height: number };
  message: string;
  origin: 'author' | 'default';
  fix?: SpecPatch;
}

/**
 * Atomic edits guarded by the complete source document. `changes` uses the same
 * `EditOp` semantics as `applyEditTransaction`: `set` replaces a value whose
 * parent exists, `add` also creates missing object containers, and `remove`
 * deletes a value.
 */
export interface SpecPatch {
  label: string;
  /** Canonical source snapshot prevents stale fixes overwriting subsequent edits. */
  precondition: string;
  changes: EditOp[];
}

export type DesignQuestion =
  | 'comparison'
  | 'change'
  | 'distribution'
  | 'composition'
  | 'geography'
  | 'relationships';
export interface CompositionRecommendation {
  id: string;
  title: string;
  reason: string;
  tradeoff: string;
  spec: VizSpec;
}

export interface ObservationIdentity {
  observation: string;
  series?: string;
  persistent: boolean;
}
export interface ReaderObservation extends ObservationIdentity {
  /** Aggregates are visible groups and never imply a raw-row selection. */
  kind?: 'row' | 'aggregate';
  datum: DataRow;
  previous?: DataRow;
  state: 'visible' | 'filtered';
}
export interface ReaderSelection {
  preview: ReaderObservation | null;
  pinned: ReaderObservation[];
  announcement: string;
}

/** Explicit relationships; aggregate groups never masquerade as raw rows. */
export interface DatasetBinding {
  dataset: string;
  entityField: string;
  kind: 'row' | 'group';
  transform?: string;
  groupMembers?: Record<string, Array<string | number>>;
}
