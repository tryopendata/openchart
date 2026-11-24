/** Returns nested steps, each of which divides the next. */
export function valueTickLadder(_span: number): number[] {
  throw new Error('not implemented');
}

/** Returns the period steps [1, 5, 10, 20, 50, 100]. */
export function periodTickLadder(): number[] {
  throw new Error('not implemented');
}

export function crossfadeTicks(
  _domain: [number, number],
  _pxPerUnit: number,
  _ladder: number[],
  _room?: number,
  _fadeFrom?: number,
): Array<{ value: number; opacity: number }> {
  throw new Error('not implemented');
}
