/** Validation of mirrored bars (`mark: { type: 'bar', mirror: true }`). */
import { mirrorSideValues, quoteSideValues } from '../../charts/bar/mirror-sides';
import type { ValidationError } from '../types';

type Channel = Record<string, unknown> | undefined;

/**
 * Append errors for a mirrored bar spec: no color field, a color field without exactly two
 * distinct values in untransformed data, vertical bars (a quantitative y), and any authored `stack` on the value
 * channel (checked on the authored value, `null` and `false` included). Called only for
 * specs with `mark.mirror: true`.
 */
export function validateMirror(spec: Record<string, unknown>, errors: ValidationError[]): void {
  const encoding = (spec.encoding ?? {}) as Record<string, Channel>;
  checkColor(encoding.color, spec.data, spec.transform, errors);
  checkOrientation(encoding, errors);
  checkStack(encoding.x, errors);
}

/**
 * The color channel must name a field with exactly two distinct values in the data. The count
 * is skipped when the spec has transforms, which run after validation.
 */
function checkColor(
  color: Channel,
  data: unknown,
  transform: unknown,
  errors: ValidationError[],
): void {
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
  // Transforms decide the sides (a filter drops a 'Total', a calculate derives the field), so
  // the compile warns on the transformed rows instead.
  if (!Array.isArray(data) || transform !== undefined) return;
  const values = mirrorSideValues(data, field);
  if (values.length === 2) return;
  errors.push({
    code: 'INVALID_VALUE',
    path: '/encoding/color',
    message: `mark.mirror needs a color field with exactly two values; "${field}" has ${values.length} (${quoteSideValues(values)}).`,
    suggestion: 'Filter the data to two groups, or drop mirror for more than two.',
  });
}

/**
 * Mirrored bars are horizontal. Types are inferred after validation, so only an authored
 * quantitative y, or an authored non-quantitative x, is known to be wrong here.
 */
function checkOrientation(encoding: Record<string, Channel>, errors: ValidationError[]): void {
  const yType = encoding.y?.type;
  const xType = encoding.x?.type;
  let problem: string | undefined;
  if (yType === 'quantitative') problem = 'y is quantitative, which draws vertical bars';
  else if (xType !== undefined && xType !== 'quantitative')
    problem = `x is ${JSON.stringify(xType)}, but the bar lengths need a quantitative x`;
  if (!problem) return;
  errors.push({
    code: 'ENCODING_MISMATCH',
    path: '/mark/mirror',
    message: `mark.mirror works only on horizontal bars; ${problem}.`,
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
