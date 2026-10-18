/**
 * Spec compiler: validate -> normalize pipeline.
 *
 * This is the first stage of the engine: take raw user input (possibly JSON
 * from an API or Claude), validate it, fill in defaults, and produce a
 * NormalizedSpec that the rest of the engine can work with safely.
 */

import { normalizeSpec } from './normalize';
import type { CompileResult, ValidationError } from './types';
import { validateSpec } from './validate';

/** One line per error, prefixed with its JSON Pointer unless the message already names it. */
function formatValidationErrors(errors: readonly ValidationError[]): string {
  return errors
    .map((e) => (e.path && !e.message.includes(e.path) ? `${e.path}: ${e.message}` : e.message))
    .join('\n');
}

/**
 * Compile a raw spec through the validate -> normalize pipeline.
 *
 * @param spec - Raw spec input (unknown type, could be anything).
 * @returns CompileResult with the normalized spec and any warnings.
 * @throws Error if the spec is invalid.
 */
export function compile(spec: unknown): CompileResult {
  const validation = validateSpec(spec);

  if (!validation.valid || !validation.normalized) {
    throw new Error(`Invalid spec:\n${formatValidationErrors(validation.errors)}`);
  }

  const warnings: string[] = [];
  const normalized = normalizeSpec(validation.normalized, warnings);

  return { spec: normalized, warnings };
}

export { flattenLayers, normalizeSpec } from './normalize';
export type {
  CompileResult,
  NormalizedChartSpec,
  NormalizedChrome,
  NormalizedGraphSpec,
  NormalizedSpec,
  NormalizedTableSpec,
  ValidationError,
  ValidationErrorCode,
  ValidationResult,
} from './types';
// Re-export everything
export { validateSpec } from './validate';
