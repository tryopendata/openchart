import type { SpecPatch, VizSpec } from '@opendata-ai/openchart-core';
import { applyEditTransaction } from '@opendata-ai/openchart-core';

export interface AppliedSpecPatch {
  spec: VizSpec;
  /** Undoes the patch; its precondition is the patched document. */
  inverse: SpecPatch;
}

/**
 * Apply a patch atomically through `applyEditTransaction`. Throws when the
 * document changed since the patch was produced or any operation is invalid;
 * the input spec is never mutated.
 */
export function applySpecPatch(spec: VizSpec, patch: SpecPatch): AppliedSpecPatch {
  if (JSON.stringify(spec) !== patch.precondition)
    throw new Error('This suggestion is stale. Review the current document again.');
  const result = applyEditTransaction(spec, { ops: patch.changes });
  if (!result.ok)
    throw new Error(
      `Patch operation ${result.error.opIndex} at "${result.error.path}" failed: ${result.error.reason}`,
    );
  return {
    spec: result.spec,
    inverse: {
      label: `Undo: ${patch.label}`,
      precondition: JSON.stringify(result.spec),
      changes: result.inverse.ops,
    },
  };
}
