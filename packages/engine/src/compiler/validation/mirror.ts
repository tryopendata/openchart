/** Validation of mirrored bars (`mark: { type: 'bar', mirror: true }`). */
import type { ValidationError } from '../types';

type Channel = Record<string, unknown> | undefined;

/**
 * Append errors for a mirrored bar spec: no color field, a color field without exactly two
 * distinct values, vertical bars (a quantitative y), and any authored `stack` on the value
 * channel (checked on the authored value, `null` and `false` included). Called only for
 * specs with `mark.mirror: true`.
 */
export function validateMirror(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const encoding = (spec.encoding ?? {}) as Record<string, Channel>;
  checkColor(encoding.color, spec.data, errors);
  checkOrientation(encoding, errors);
  checkStack(encoding.x, errors);
}

/** The color channel must name a field with exactly two distinct values in the data. */
function checkColor(color: Channel, data: unknown, errors: ValidationError[]): void {
  const field = typeof color?.field === 'string' ? color.field : undefined;
  if (!field) {
    errors.push({
      code: 'MISSING_FIELD',
      path: '/encoding/color',
      message: 'mark.mirror needs a color field that splits the bars into two halves.',
      suggestion:
        'Add encoding.color with a two-valued nominal field, e.g. { "field": "sex", "type": "nominal" }.',
    });
    return;
  }
  if (!Array.isArray(data)) return;
  const values = new Set<string>();
  for (const row of data) {
    if (row && typeof row === 'object') values.add(String((row as Record<string, unknown>)[field]));
  }
  if (values.size === 2) return;
  const shown = [...values].slice(0, 5).join(', ');
  errors.push({
    code: 'INVALID_VALUE',
    path: '/encoding/color',
    message: `mark.mirror needs a color field with exactly two values; "${field}" has ${values.size} (${shown}).`,
    suggestion: 'Filter the data to two groups, or drop mirror for more than two.',
  });
}

/** Mirrored bars are horizontal: a quantitative x and a categorical y. */
function checkOrientation(encoding: Record<string, Channel>, errors: ValidationError[]): void {
  const vertical = encoding.y?.type === 'quantitative' || encoding.x?.type !== 'quantitative';
  if (!vertical) return;
  errors.push({
    code: 'ENCODING_MISMATCH',
    path: '/mark/mirror',
    message:
      'mark.mirror works only on horizontal bars; this spec draws vertical bars (quantitative y).',
    suggestion: 'Put the values on x (quantitative) and the categories on y (nominal or ordinal).',
  });
}

/** Mirrored bars never stack, so any authored stack is rejected, even null or false. */
function checkStack(x: Channel, errors: ValidationError[]): void {
  if (!x || !Object.hasOwn(x, 'stack')) return;
  errors.push({
    code: 'INVALID_VALUE',
    path: '/encoding/x/stack',
    message: `encoding.x.stack (${JSON.stringify(x.stack)}) can't be combined with mark.mirror; mirrored bars never stack.`,
    suggestion: 'Remove encoding.x.stack.',
  });
}
