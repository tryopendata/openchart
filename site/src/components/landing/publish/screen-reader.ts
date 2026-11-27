/**
 * What a screen reader gets from the published chart: the alt text and the data
 * table the library generates, as strings the page can set at build time.
 * Headers use each channel's title, and cells read as a person would say them:
 * dates as years or months, numbers without float noise.
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

/** The most decimals a table number keeps; past this the digits are float noise. */
const MAX_DECIMALS = 2;
const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** The channels `generateDataTable` reads, one per field, in its column order. */
function tableChannels(spec: ChartSpec): EncodingChannel[] {
  const { x, y, color, size } = spec.encoding;
  const channels = [x, y, color, size].filter(
    (channel): channel is EncodingChannel => !!channel && "field" in channel,
  );
  return channels.filter(
    (channel, index) => channels.findIndex((other) => other.field === channel.field) === index,
  );
}

/** A date as a reader would say it: the year alone on Jan 1, the month on the 1st, else the day. */
function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  if (date.getUTCDate() !== 1) return DAY_FORMAT.format(date);
  if (date.getUTCMonth() !== 0) return MONTH_FORMAT.format(date);
  return String(date.getUTCFullYear());
}

/** Decimals `value` needs once float noise past `MAX_DECIMALS` is dropped: 15.299999 needs 1. */
function decimalsOf(value: number): number {
  const [, fraction = ""] = String(Number(value.toFixed(MAX_DECIMALS))).split(".");
  return fraction.length;
}

/**
 * One column's cell formatter. Dates read as dates; numbers take the column's
 * widest precision, so 9 sits under 31.2 as 9.0.
 */
function columnFormatter(
  values: unknown[],
  channel: EncodingChannel | undefined,
): (value: unknown) => string {
  if (channel?.type === "temporal") return (value) => (value == null ? "" : formatDate(value));
  const numbers = values.filter((value): value is number => typeof value === "number");
  const decimals = Math.max(0, ...numbers.map(decimalsOf));
  const format = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (value) => {
    if (value == null) return "";
    return typeof value === "number" ? format.format(value) : String(value);
  };
}

/** Which table columns hold numbers (quantitative channels), in the table's column order. */
export function numericColumns(spec: ChartSpec): boolean[] {
  return tableChannels(spec).map((channel) => channel.type === "quantitative");
}

/**
 * The chart's generated alt text and data table, every cell as a string.
 *
 * @throws Error when the spec's data is not an inline array of rows, since a
 *   build-time panel has nothing to read from a URL.
 */
export function screenReaderContent(spec: ChartSpec): ScreenReaderContent {
  if (!Array.isArray(spec.data)) {
    throw new Error("screenReaderContent needs the spec's data inline as an array of rows.");
  }
  const data = spec.data as DataRow[];
  const [fields = [], ...valueRows] = generateDataTable(spec, data);
  const channels = tableChannels(spec);
  const channelOf = (field: unknown) => channels.find((channel) => channel.field === field);
  const formatters = fields.map((field, index) =>
    columnFormatter(
      valueRows.map((row) => row[index]),
      channelOf(field),
    ),
  );
  return {
    altText: generateAltText(spec, data),
    header: fields.map((field) => channelOf(field)?.title ?? String(field)),
    rows: valueRows.map((row) => row.map((value, index) => formatters[index]?.(value) ?? "")),
  };
}
