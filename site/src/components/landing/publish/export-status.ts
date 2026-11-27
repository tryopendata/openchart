/**
 * The publish section's export status line: what an export in progress, done or
 * failed reads as. Pure, so PublishDesk only runs exports and shows this text.
 */

/** A format the publish section exports. */
export type ExportFormat = "svg" | "png" | "csv" | "gif";

/** Where the last export stands. */
export type ExportState =
  | { kind: "idle" }
  | { kind: "working"; format: ExportFormat }
  | { kind: "done"; format: ExportFormat; bytes: number }
  | { kind: "failed"; format: ExportFormat; reason: string };

const KILOBYTE = 1000;
const MEGABYTE = 1000 * KILOBYTE;

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

/**
 * The status line: empty when idle, "Rendering GIF…" while working, "SVG, 18 KB"
 * when done, "GIF export failed: <reason>" when failed.
 */
export function exportStatusText(state: ExportState): string {
  switch (state.kind) {
    case "idle":
      return "";
    case "working":
      return `Rendering ${formatName(state.format)}…`;
    case "done":
      return `${formatName(state.format)}, ${formatBytes(state.bytes)}`;
    case "failed":
      return `${formatName(state.format)} export failed: ${state.reason}`;
  }
}
