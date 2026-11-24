/** Returns nested steps, each of which divides the next. */
export function valueTickLadder(span: number): number[] {
  const ladder: number[] = [];
  if (span <= 0 || !Number.isFinite(span)) return ladder;

  const decade = Math.floor(Math.log10(span));
  for (let exponent = decade - 2; exponent <= decade + 1; exponent++) {
    for (const multiplier of [1, 5]) {
      const step = Number(`${multiplier}e${exponent}`);
      if (step === 0 || !Number.isFinite(step)) continue;
      ladder.push(step);
      if (step >= span) return ladder;
    }
  }
  return ladder;
}

/** Returns nested steps in period units. */
export function periodTickLadder(): number[] {
  return [1, 5, 10, 50, 100, 500];
}

/**
 * Crossfades ticks from adjacent ladder steps. `room` is the pixel spacing at
 * which a step becomes active, and `fadeFrom` is where finer ticks start to appear.
 */
export function crossfadeTicks(
  domain: [number, number],
  pxPerUnit: number,
  ladder: number[],
  room = 64,
  fadeFrom = 40,
): Array<{ value: number; opacity: number }> {
  if (ladder.length === 0) return [];
  const firstWithRoom = ladder.findIndex((step) => step * pxPerUnit >= room);
  const active = firstWithRoom === -1 ? ladder.length - 1 : firstWithRoom;
  const finer = ladder[active - 1];
  const weight =
    finer === undefined
      ? 0
      : Math.max(0, Math.min(1, (finer * pxPerUnit - fadeFrom) / (room - fadeFrom)));

  const [min, max] = domain;
  const opacities = new Map<number, number>();
  const addTicks = (step: number, opacity: number) => {
    if (opacity === 0) return;
    const start = Math.floor(min / step);
    const end = Math.ceil(max / step);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return;

    // Multiply the decimal digits as integers so shared ticks round to the same value.
    const [coefficient, exponent] = step.toExponential().split('e');
    const [whole, fraction = ''] = coefficient.split('.');
    const digits = BigInt(whole + fraction);
    const power = Number(exponent) - fraction.length;
    for (let index = start; index <= end; index++) {
      const value = Number(`${BigInt(index) * digits}e${power}`);
      if (value >= min && value <= max) {
        opacities.set(value, Math.min(1, (opacities.get(value) ?? 0) + opacity));
      }
    }
  };
  addTicks(ladder[active], 1 - weight);
  if (finer !== undefined) addTicks(finer, weight);

  return [...opacities]
    .filter(([, opacity]) => opacity > 0.01)
    .sort(([a], [b]) => a - b)
    .map(([value, opacity]) => ({ value, opacity }));
}
