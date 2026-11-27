/**
 * What a screen reader gets from the published chart: the alt text and the data
 * table the library generates, as strings the page can set at build time.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";

/** The generated alt text and the data table's header and rows. */
export type ScreenReaderContent = { altText: string; header: string[]; rows: string[][] };

/** The chart's generated alt text and data table, every cell as a string. */
export function screenReaderContent(_spec: ChartSpec): ScreenReaderContent {
  throw new Error("screenReaderContent is not implemented.");
}
