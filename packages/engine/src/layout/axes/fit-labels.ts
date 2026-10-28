import type { AxisTick } from '@opendata-ai/openchart-core';

/** Fit gutter ticks without changing their values, positions or full labels. */
export function fitAxisLabels(
  ticks: AxisTick[],
  width: number,
  measure: (text: string) => number,
): { ticks: AxisTick[]; shortened: boolean } {
  let shortened = false;
  const fitted = ticks.map((tick) => {
    const fullLabel =
      tick.fullLabel ?? (tick.subtitle ? `${tick.label}  ${tick.subtitle}` : tick.label);
    if (measure(fullLabel) <= width) return tick;
    shortened = true;
    let left = 0,
      right = [...fullLabel].length;
    const characters = [...fullLabel];
    if (measure('…') > width) return { ...tick, label: '', subtitle: undefined, fullLabel };
    while (left < right) {
      const middle = Math.ceil((left + right) / 2);
      if (measure(`${characters.slice(0, middle).join('')}…`) <= width) left = middle;
      else right = middle - 1;
    }
    return {
      ...tick,
      label: `${characters.slice(0, left).join('')}…`,
      subtitle: undefined,
      fullLabel,
    };
  });
  return { ticks: fitted, shortened };
}
