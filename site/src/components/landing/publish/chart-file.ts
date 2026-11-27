/**
 * Turns a mounted chart's export into a file: the library's `export` result as
 * a Blob, with the file name and type the publish section downloads it under.
 * The chart arrives as a parameter, so nothing here loads the library.
 */
import type { ChartHandle } from "@opendata-ai/openchart-react";
import type { ExportFormat } from "./export-status";

/** A mounted chart instance, the object `chart.export` lives on. */
export type ChartInstance = NonNullable<ChartHandle["instance"]>;

/** The word every exported file name carries after `openchart-`. */
const FILE_SLUG = "wind-solar-coal";

const MIME_TYPES: Record<ExportFormat, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  csv: "text/csv",
  gif: "image/gif",
};

/** Options for the GIF: plays once and holds the last frame, on the page's background. */
export type GifOptions = { backgroundColor: string };

/** The download name for an export, such as `openchart-wind-solar-coal.svg`. */
export function exportFileName(format: ExportFormat): string {
  return `openchart-${FILE_SLUG}.${format}`;
}

/**
 * The chart exported as a Blob of the format's type. SVG and CSV come back from
 * the library as text and are wrapped; PNG and GIF are already Blobs.
 *
 * @throws whatever the library's export throws or rejects with, for example when
 *   the chart has not rendered or `gifenc` cannot load.
 */
export async function exportChartFile(
  chart: ChartInstance,
  format: ExportFormat,
  gif: GifOptions,
): Promise<Blob> {
  const type = MIME_TYPES[format];
  switch (format) {
    case "svg":
      return new Blob([chart.export("svg")], { type });
    case "csv":
      return new Blob([chart.export("csv")], { type });
    case "png":
      return chart.export("png");
    case "gif":
      return chart.export("gif", { loop: false, backgroundColor: gif.backgroundColor });
  }
}
