/**
 * Typed compile path: validate and normalize a spec of one known kind.
 *
 * The generic `compile()` dispatches on the spec's shape at runtime, so it
 * references every kind's validator and normalizer. A caller that already
 * knows its kind (compileSankey, compileTable, ...) passes it here instead,
 * and a bundler drops the rest.
 */

import { warnAboutAnnotationIds } from './normalize';
import type { ValidationError } from './types';
import {
  collectSpecMarkOptionErrors,
  invalidSpecError,
  isSpecObject,
  nonObjectSpecError,
  validateCommonSpecFields,
  validateSpecAnimation,
} from './validate';

export interface SpecKind<Authored, Normalized> {
  /** The spec's `type` discriminator, e.g. 'sankey'. */
  readonly type: string;
  /** The type's validator, as called by validateSpec. */
  readonly validate: (spec: Record<string, unknown>, errors: ValidationError[]) => void;
  /** The type's normalizer, as called by normalizeSpec. */
  readonly normalize: (spec: Authored, warnings: string[]) => Normalized;
}

/** Check the input before sugar can report errors for a different kind. */
export function assertKindType(
  spec: unknown,
  type: string,
  wrongTypeMessage: string,
): asserts spec is Record<string, unknown> {
  if (!isSpecObject(spec)) throw invalidSpecError([nonObjectSpecError()]);
  if (spec.type !== type) throw new Error(wrongTypeMessage);
}

/** Validate and normalize a spec of one known kind. */
export function compileKind<Authored, Normalized>(
  spec: unknown,
  kind: SpecKind<Authored, Normalized>,
  wrongTypeMessage: string,
): { spec: Normalized; warnings: string[] } {
  assertKindType(spec, kind.type, wrongTypeMessage);

  // Same checks, in the same order, as validateSpec runs for this kind.
  const errors: ValidationError[] = [];
  validateCommonSpecFields(spec, errors);
  kind.validate(spec, errors);
  validateSpecAnimation(spec, errors, kind.type === 'graph');
  const markOptionErrors = collectSpecMarkOptionErrors(spec);
  if (errors.length || markOptionErrors.length) {
    throw invalidSpecError([...errors, ...markOptionErrors]);
  }

  const warnings: string[] = [];
  warnAboutAnnotationIds(spec.annotations, warnings);
  // The discriminator and the kind's validator establish the authored type.
  return { spec: kind.normalize(spec as Authored, warnings), warnings };
}
