import type { ValidationError } from '../types';

export function validateRaceSpec(_spec: Record<string, unknown>, _errors: ValidationError[]): void {
  // Race-specific validation is supplied by the validation lane.
}
