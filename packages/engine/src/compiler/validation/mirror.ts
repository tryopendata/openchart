/** Validation of mirrored bars (`mark: { type: 'bar', mirror: true }`). */
import type { ValidationError } from '../types';

/**
 * Append errors for a mirrored bar spec: no color field, a color field without exactly two
 * distinct values, vertical bars (a quantitative y), and any authored `stack` on the value
 * channel (checked on the authored value, `null` and `false` included). Called only for
 * specs with `mark.mirror: true`.
 */
export function validateMirror(spec: Record<string, unknown>, errors: ValidationError[]): void {
  void spec;
  void errors;
  throw new Error('not implemented');
}
