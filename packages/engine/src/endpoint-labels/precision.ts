import { finiteNumber } from '../data/finite-number';

/** Precision belongs to the displayed endpoint set, not the entire series. */
export function endpointPrecisionStep(values: Iterable<unknown>): number {
  let precision = 0;
  for (const raw of values) {
    const value = finiteNumber(raw);
    if (value === undefined) continue;
    // Decimal strings include exponent notation for very small source values.
    const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
    const decimals = (coefficient.split('.')[1]?.length ?? 0) - Number(exponent);
    precision = Math.max(precision, Math.min(2, decimals));
  }
  return 10 ** -precision;
}
