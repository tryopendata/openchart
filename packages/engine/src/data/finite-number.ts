/** Read a measured number without treating missing or nonnumeric data as zero. */
export function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
