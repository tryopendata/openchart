import type { ChartLayout, ChartSpec, Mark } from '@opendata-ai/openchart-core';
import { generateAltText, generateDataTable, MAX_SR_TABLE_ROWS } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';

/**
 * Accessibility for a chart. An author-provided description (a11y.description,
 * or top-level `description` folded in by the sugar expansion) replaces the
 * auto-generated alt text; auto-generation stays the fallback. A faceted
 * figure mentions its panels in the generated text.
 */
export function buildChartA11y(
  chartSpec: NormalizedChartSpec,
  marks: Mark[],
  facet?: { panelCount: number; field: string },
): ChartLayout['a11y'] {
  const generated = () => {
    const base = generateAltText(
      {
        mark: chartSpec.markType,
        data: chartSpec.data,
        encoding: chartSpec.encoding,
        chrome: chartSpec.chrome,
      } as ChartSpec,
      chartSpec.data,
    );
    return facet ? `${base} Faceted into ${facet.panelCount} panels by ${facet.field}.` : base;
  };
  const altText = chartSpec.a11y?.description ?? generated();
  const dataTableFallback = generateDataTable(
    {
      mark: chartSpec.markType,
      data: chartSpec.data,
      encoding: chartSpec.encoding,
    } as ChartSpec,
    chartSpec.data,
  );
  return {
    altText,
    dataTableFallback,
    ...(chartSpec.data.length > MAX_SR_TABLE_ROWS ? { totalRows: chartSpec.data.length } : {}),
    role: 'img',
    keyboardNavigable: marks.length > 0,
    ...(chartSpec.a11y?.hidden ? { hidden: true } : {}),
  };
}
