/**
 * What a screen reader gets from the published chart: the library's own alt
 * text and data table, unchanged, so the panel shows exactly what the chart
 * hands assistive tech. Cells become strings the way the library's hidden
 * table writes them (`String`, empty for a missing value); the spec's field
 * names and values are chosen to read well that way (publish-spec.ts).
 */
import {
  type ChartSpec,
  type DataRow,
  type EncodingChannel,
  generateAltText,
  generateDataTable,
} from "@opendata-ai/openchart-core";

/** The generated alt text and the data table's header and rows. */
export type ScreenReaderContent = { altText: string; header: string[]; rows: string[][] };

/** A table cell as text, the way the library's hidden table writes it. */
function asCell(value: unknown): string {
  return String(value ?? "");
}

/** The rows a spec carries inline. */
function inlineRows(spec: ChartSpec): DataRow[] {
  if (!Array.isArray(spec.data)) {
    throw new Error("screenReaderContent needs the spec's data inline as an array of rows.");
  }
  return spec.data as DataRow[];
}

/**
 * The chart's generated alt text and data table, every cell as a string.
 *
 * @throws Error when the spec's data is not an inline array of rows, since a
 *   build-time panel has nothing to read from a URL.
 */
export function screenReaderContent(spec: ChartSpec): ScreenReaderContent {
  const data = inlineRows(spec);
  const [header = [], ...rows] = generateDataTable(spec, data);
  return {
    altText: generateAltText(spec, data),
    header: header.map(asCell),
    rows: rows.map((row) => row.map(asCell)),
  };
}

/**
 * Which table columns hold numbers (fields on a quantitative channel), in the
 * table's column order, so the page can right-align them.
 */
export function numericColumns(spec: ChartSpec): boolean[] {
  const { x, y, color, size } = spec.encoding;
  const channels = [x, y, color, size].filter(
    (channel): channel is EncodingChannel => !!channel && "field" in channel,
  );
  const header = generateDataTable(spec, []).at(0) ?? [];
  return header.map((field) =>
    channels.some((channel) => channel.field === field && channel.type === "quantitative"),
  );
}
