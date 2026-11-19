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
    validatePhaseTiming(value as Record<string, unknown>, ['animation', phase], errors);
  }

  const enter = config.enter;
  if (enter && typeof enter === 'object' && !Array.isArray(enter)) {
    const trigger = (enter as Record<string, unknown>).trigger;
    if (trigger !== undefined && trigger !== 'visible' && trigger !== 'mount') {
      errors.push({
        message: `Spec error: animation.enter.trigger must be 'visible' or 'mount', got ${JSON.stringify(trigger)}`,
        path: '/animation/enter/trigger',
        code: 'INVALID_VALUE',
        suggestion:
          "Use animation: { enter: { trigger: 'mount' } } to play the entrance at mount, or omit trigger to play it when the chart scrolls into view.",
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

const ANIMATION_EASES = ['smooth', 'snappy', 'gentle'];
const TIMING_SUGGESTION = 'Use a named preset or separate valid spring and tween phase settings.';

/**
 * Check one motion phase's timing fields: `spring` (not combined with
 * duration/ease, finite positive parameters), a finite nonnegative `duration`,
 * and `ease` from the preset names. Shared by chart and graph animation.
 */
function validatePhaseTiming(
  settings: Record<string, unknown>,
  path: readonly string[],
  errors: ValidationError[],
): void {
  if (settings.spring !== undefined) {
    if (settings.duration !== undefined || settings.ease !== undefined) {
      errors.push({
        code: 'INVALID_VALUE',
        suggestion: TIMING_SUGGESTION,
        path: jsonPointer(...path),
        message: 'A phase cannot combine spring with duration or ease.',
      });
    }
    if (!settings.spring || typeof settings.spring !== 'object' || Array.isArray(settings.spring)) {
      errors.push({
        code: 'INVALID_VALUE',
        suggestion: TIMING_SUGGESTION,
        path: jsonPointer(...path, 'spring'),
        message: 'Spring must be a configuration object.',
      });
    } else {
      for (const [key, number] of Object.entries(settings.spring)) {
        const known = ['stiffness', 'damping', 'mass'].includes(key);
        if (known && number === undefined) continue;
        if (!known || typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
          errors.push({
            code: 'INVALID_VALUE',
            suggestion: TIMING_SUGGESTION,
            path: jsonPointer(...path, 'spring', key),
            message: 'Spring parameters must be finite positive stiffness, damping, or mass.',
          });
        }
      }
    }
  }
  validateDuration(settings.duration, path, errors);
  validateEase(settings.ease, path, errors);
}

function validateDuration(
  duration: unknown,
  path: readonly string[],
  errors: ValidationError[],
): void {
  if (
    duration !== undefined &&
    (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)
  ) {
    errors.push({
      code: 'INVALID_VALUE',
      suggestion: TIMING_SUGGESTION,
      path: jsonPointer(...path, 'duration'),
      message: 'Animation duration must be finite and nonnegative.',
    });
  }
}

function validateEase(ease: unknown, path: readonly string[], errors: ValidationError[]): void {
  if (ease !== undefined && !ANIMATION_EASES.includes(ease as string)) {
    errors.push({
      code: 'INVALID_VALUE',
      suggestion: "Use ease: 'smooth', 'snappy', or 'gentle'.",
      path: jsonPointer(...path, 'ease'),
      message: `Animation ease must be 'smooth', 'snappy', or 'gentle', got ${JSON.stringify(ease)}.`,
    });
  }
}

/**
 * Validate a graph's `animation` (GraphAnimationSpec). enter/update/exit take
 * the chart phase timing rules; enter also takes `trigger` and an on/off
 * `stagger`. The deprecated object form of `stagger` is not an error: it is
 * ignored, and normalize warns about it. camera/hover take duration and ease
 * (camera's duration may also be 'auto').
 */
export function validateGraphAnimation(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const animation = spec.animation;
  if (animation === undefined || typeof animation === 'boolean') return;
  if (!animation || typeof animation !== 'object' || Array.isArray(animation)) {
    errors.push({
      code: 'INVALID_VALUE',
      suggestion:
        'Use animation: false to turn graph motion off, or an object to configure phases.',
      path: '/animation',
      message: 'Graph animation must be a boolean or an object.',
    });
    return;
  }
  const config = animation as Record<string, unknown>;
  for (const phase of ['enter', 'update', 'exit']) {
    const value = config[phase];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const settings = value as Record<string, unknown>;
    validatePhaseTiming(settings, ['animation', phase], errors);
    if (phase !== 'enter') continue;
    const stagger = settings.stagger;
    if (
      stagger !== undefined &&
      typeof stagger !== 'boolean' &&
      (!stagger || typeof stagger !== 'object' || Array.isArray(stagger))
    ) {
      errors.push({
        code: 'INVALID_VALUE',
        suggestion: 'graphs order their reveal by layout; use stagger: true or false',
        path: '/animation/enter/stagger',
        message: `Graph animation.enter.stagger must be true or false, got ${JSON.stringify(stagger)}.`,
      });
    }
    const trigger = settings.trigger;
    if (trigger !== undefined && trigger !== 'visible' && trigger !== 'mount') {
      errors.push({
        code: 'INVALID_VALUE',
        suggestion:
          "Use animation: { enter: { trigger: 'mount' } } to play the reveal at mount, or omit trigger to play it when the graph scrolls into view.",
        path: '/animation/enter/trigger',
        message: `Spec error: animation.enter.trigger must be 'visible' or 'mount', got ${JSON.stringify(trigger)}`,
      });
    }
  }
  for (const behavior of ['camera', 'hover']) {
    const value = config[behavior];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const settings = value as Record<string, unknown>;
    if (!(behavior === 'camera' && settings.duration === 'auto')) {
      validateDuration(settings.duration, ['animation', behavior], errors);
    }
    validateEase(settings.ease, ['animation', behavior], errors);
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
