import type { ValidationError } from '../types';

export function validateFrame(
  spec: Record<string, unknown>,
  errors: ValidationError[],
  prefix = '',
): void {
  if (spec.frame === undefined) return;
  const frame = spec.frame;
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    errors.push({
      code: 'INVALID_VALUE',
      path: `${prefix}/frame`,
      message: 'frame must contain finite nonnegative left/right gutters.',
      suggestion: 'Use frame: { left: 48, right: 96 }.',
    });
    return;
  }
  for (const [key, value] of Object.entries(frame)) {
    if (['left', 'right'].includes(key) && value === undefined) continue;
    if (
      !['left', 'right'].includes(key) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0
    )
      errors.push({
        code: 'INVALID_VALUE',
        path: `${prefix}/frame/${key}`,
        message: 'Frame gutters must be finite nonnegative left/right values.',
        suggestion: 'Use CSS pixel values of zero or greater for left and right.',
      });
  }
}
