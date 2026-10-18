/** Validation for fields shared across spec kinds: animation and field metadata. */
import { encodePointerToken, jsonPointer } from '@opendata-ai/openchart-core';
import type { ValidationError } from '../types';

/**
 * Validate the `animation` field for the spec types that carry `AnimationSpec`
 * (everything except graph, which uses the narrower `GraphAnimationSpec`).
 * Only checks values the renderer cannot recover from; unknown keys stay
 * permissive (the generated JSON schema is the whitelist).
 */
export function validateAnimation(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const animation = spec.animation;
  if (typeof animation === 'string' && !['fluid', 'subtle'].includes(animation)) {
    errors.push({
      code: 'INVALID_VALUE',
      suggestion: 'Use a named preset or separate valid spring and tween phase settings.',
      path: '/animation',
      message: 'Unknown animation preset.',
    });
  }
  if (!animation || typeof animation !== 'object' || Array.isArray(animation)) return;

  const config = animation as Record<string, unknown>;
  if (config.preset !== undefined && !['fluid', 'subtle'].includes(String(config.preset))) {
    errors.push({
      code: 'INVALID_VALUE',
      suggestion: 'Use a named preset or separate valid spring and tween phase settings.',
      path: '/animation/preset',
      message: 'Animation preset must be fluid or subtle.',
    });
  }
  for (const phase of ['enter', 'update', 'exit']) {
    const value = config[phase];
    if (!value || typeof value !== 'object') continue;
    const settings = value as Record<string, unknown>;
    if (settings.spring !== undefined) {
      if (settings.duration !== undefined || settings.ease !== undefined) {
        errors.push({
          code: 'INVALID_VALUE',
          suggestion: 'Use a named preset or separate valid spring and tween phase settings.',
          path: jsonPointer('animation', phase),
          message: 'A phase cannot combine spring with duration or ease.',
        });
      }
      if (
        !settings.spring ||
        typeof settings.spring !== 'object' ||
        Array.isArray(settings.spring)
      ) {
        errors.push({
          code: 'INVALID_VALUE',
          suggestion: 'Use a named preset or separate valid spring and tween phase settings.',
          path: jsonPointer('animation', phase, 'spring'),
          message: 'Spring must be a configuration object.',
        });
      } else {
        for (const [key, number] of Object.entries(settings.spring)) {
          const known = ['stiffness', 'damping', 'mass'].includes(key);
          if (known && number === undefined) continue;
          if (!known || typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
            errors.push({
              code: 'INVALID_VALUE',
              suggestion: 'Use a named preset or separate valid spring and tween phase settings.',
              path: jsonPointer('animation', phase, 'spring', key),
              message: 'Spring parameters must be finite positive stiffness, damping, or mass.',
            });
          }
        }
      }
    }
    if (
      settings.duration !== undefined &&
      (typeof settings.duration !== 'number' ||
        !Number.isFinite(settings.duration) ||
        settings.duration < 0)
    ) {
      errors.push({
        code: 'INVALID_VALUE',
        suggestion: 'Use a named preset or separate valid spring and tween phase settings.',
        path: jsonPointer('animation', phase, 'duration'),
        message: 'Animation duration must be finite and nonnegative.',
      });
    }
  }

  const update = (animation as Record<string, unknown>).update;
  if (!update || typeof update !== 'object' || Array.isArray(update)) return;

  const maxMarks = (update as Record<string, unknown>).maxMarks;
  if (maxMarks === undefined) return;

  // Rejects anything below 1, not just anything <= 0: the resolver floors the
  // value, so a fractional cap like 0.5 would become 0 and silently disable
  // every update transition on the chart.
  if (typeof maxMarks !== 'number' || !Number.isFinite(maxMarks) || maxMarks < 1) {
    errors.push({
      message: `Spec error: animation.update.maxMarks must be a number >= 1, got ${JSON.stringify(maxMarks)}`,
      path: '/animation/update/maxMarks',
      code: 'INVALID_VALUE',
      suggestion:
        'Set animation.update.maxMarks to the largest mark count that should still tween, e.g. animation: { update: { maxMarks: 5000 } }. Omit it to use the default of 500.',
    });
  }
}

/** Validate optional field semantics before any host can display imported metadata. */
export function validateFieldMetadata(
  obj: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (obj.fields === undefined) return;
  const fail = (path: string, message: string) =>
    errors.push({
      path,
      message,
      code: 'INVALID_VALUE',
      suggestion:
        'Use string labels, units and field references, and documented metadata enum values.',
    });
  if (!obj.fields || typeof obj.fields !== 'object' || Array.isArray(obj.fields)) {
    fail('/fields', 'Field metadata must be an object keyed by field name.');
    return;
  }
  for (const [field, value] of Object.entries(obj.fields)) {
    const path = jsonPointer('fields', field);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(path, 'Field metadata must be an object.');
      continue;
    }
    const metadata = value as Record<string, unknown>;
    for (const key of ['label', 'unit', 'measure', 'provenance', 'statusField']) {
      if (metadata[key] !== undefined && typeof metadata[key] !== 'string')
        fail(`${path}/${encodePointerToken(key)}`, `${key} must be a string.`);
    }
    for (const [key, values] of Object.entries({
      type: ['text', 'number', 'date'],
      role: ['identity'],
      representation: ['number', 'percent', 'proportion'],
    })) {
      if (metadata[key] !== undefined && !values.includes(metadata[key] as string))
        fail(`${path}/${encodePointerToken(key)}`, `${key} must be one of ${values.join(', ')}.`);
    }
    if (metadata.interval !== undefined) {
      const interval = metadata.interval as Record<string, unknown> | null;
      if (
        !interval ||
        typeof interval !== 'object' ||
        Array.isArray(interval) ||
        typeof interval.lower !== 'string' ||
        !interval.lower ||
        typeof interval.upper !== 'string' ||
        !interval.upper
      ) {
        fail(`${path}/interval`, 'Interval lower and upper must name supplied numeric fields.');
      } else if (Array.isArray(obj.data)) {
        for (const [index, row] of obj.data.entries()) {
          if (!row || typeof row !== 'object') continue;
          const lower = row[interval.lower];
          const upper = row[interval.upper];
          if (
            [lower, upper].some(
              (bound) => bound != null && (typeof bound !== 'number' || !Number.isFinite(bound)),
            ) ||
            (typeof lower === 'number' && typeof upper === 'number' && lower > upper)
          ) {
            fail(
              `${path}/interval`,
              `Row ${index + 1} must supply finite interval bounds with lower <= upper, or missing values.`,
            );
            break;
          }
        }
      }
    }
  }
}
