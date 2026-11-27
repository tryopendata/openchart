/**
 * The words of the publish section's status line, as pure functions: what an
 * export in progress, finished or failed reads as, the reason a failure gives,
 * and the line shown when the chart library never loaded. The export runner
 * (use-chart-export.ts) decides the state; this module only phrases it.
 */

/** A format the publish section exports. */
export type ExportFormat = "svg" | "png" | "csv" | "gif";

/** Where the last export stands. `fileName` is the name the download is offered under. */
export type ExportState =
  | { kind: "idle" }
  | { kind: "working"; format: ExportFormat }
  | { kind: "done"; format: ExportFormat; bytes: number; fileName: string }
  | { kind: "failed"; format: ExportFormat; reason: string };

/** The status line when the chart library did not load, so no export can run. */
export const LIBRARY_UNAVAILABLE_TEXT =
  "Exports need the chart library, which did not load. Reload to try again.";

const KILOBYTE = 1000;
const MEGABYTE = 1000 * KILOBYTE;

/** Formats that draw pixels, so the wait reads as rendering rather than exporting. */
const RENDERED_FORMATS: ReadonlySet<ExportFormat> = new Set(["png", "gif"]);

/** Messages browsers and the library give when a lazily loaded chunk fails to arrive. */
const CHUNK_LOAD_FAILURE =
  /dynamically imported module|importing a module script failed|failed to load the gifenc encoder/i;

/** A file size for a reader: "912 B", "18 KB" (whole kilobytes), "1.2 MB" (one decimal). */
export function formatBytes(bytes: number): string {
  if (bytes < KILOBYTE) return `${bytes} B`;
  if (bytes < MEGABYTE) return `${Math.round(bytes / KILOBYTE)} KB`;
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

/** The format's name as a button and the status line write it. */
function formatName(format: ExportFormat): string {
  return format.toUpperCase();
}

/** True when `error`, or any error in its `cause` chain, is a chunk that did not download. */
function isChunkLoadFailure(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.name === "ChunkLoadError" || CHUNK_LOAD_FAILURE.test(current.message)) return true;
  }
  return false;
}

/**
 * Why an export failed, for the status line: a missing chunk says what did not
 * download and what to do; anything else gives the error's own message.
 */
export function failureReason(format: ExportFormat, error: unknown): string {
  if (isChunkLoadFailure(error)) {
    const missing = format === "gif" ? "the encoder" : "part of the chart library";
    return `${missing} did not download. Reload the page and try again.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/**
 * The status line: empty when idle, "Exporting CSV…" or "Rendering GIF…" while
 * working, "Download started: openchart-wind-solar-coal.svg (18 KB)" once the
 * download is handed to the browser (the page cannot see whether the file was
 * kept, so it never claims the file was saved), a pointer to the GIF shown in place when a GIF is done, and
 * "GIF export failed: <reason>" when an export fails.
 */
export function exportStatusText(state: ExportState): string {
  switch (state.kind) {
    case "idle":
      return "";
    case "working":
      return `${RENDERED_FORMATS.has(state.format) ? "Rendering" : "Exporting"} ${formatName(state.format)}…`;
    case "done":
      return state.format === "gif"
        ? `GIF ready in place of the chart (${formatBytes(state.bytes)}). Download it or go back below.`
        : `Download started: ${state.fileName} (${formatBytes(state.bytes)})`;
    case "failed":
      return `${formatName(state.format)} export failed: ${state.reason}`;
  }
}
