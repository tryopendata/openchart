import type { NumberFormatter } from '@opendata-ai/openchart-core';
import { computeFieldFormatContext, isYearContext } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import { finiteNumber } from '../data/finite-number';
import { resolveFieldFormatter } from '../format/field-format';
import { endpointPrecisionStep } from './precision';

export function endpointFormatter(
  spec: NormalizedChartSpec,
  displayedValues: Iterable<unknown>,
): NumberFormatter {
  const config = typeof spec.endpointLabels === 'object' ? spec.endpointLabels : undefined;
  const valueField = config?.valueField ?? spec.encoding.y?.field;
  const values = Array.from(displayedValues);
  const step = endpointPrecisionStep(values);
  const context = computeFieldFormatContext(
    valueField ? spec.data.map((row) => row[valueField]) : [],
  );
  const maxAbs = Math.max(
    0,
    ...values.flatMap((value) => {
      const number = finiteNumber(value);
      return number === undefined ? [] : [Math.abs(number)];
    }),
  );
  const axis = spec.encoding.y?.axis;
  const axisFormat = axis && typeof axis === 'object' ? axis.format : undefined;
  const explicit = config?.format || axisFormat || spec.encoding.y?.format;
  // Core's tick-step formatter deliberately trims zeroes. Endpoint values need
  // fixed displayed precision, while year and compact contexts retain their semantics.
  const fallbackFormat =
    !explicit && maxAbs < 1000 && !isYearContext(context)
      ? `,.${Math.round(-Math.log10(step))}f`
      : undefined;
  return resolveFieldFormatter({
    surfaceFormat: config?.format || axisFormat || fallbackFormat,
    channelFormat: spec.encoding.y?.format,
    values: valueField ? spec.data.map((row) => row[valueField]) : [],
    // Raw-unit precision must not turn compact magnitudes into full integers.
    step: maxAbs < 1000 ? step : undefined,
  });
}
