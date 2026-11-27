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

/** A file size for a reader: "912 B", "18 KB" (whole kilobytes), "1.2 MB" (one decimal). */
export function formatBytes(_bytes: number): string {
  throw new Error("formatBytes is not implemented.");
}

/**
 * The status line: empty when idle, "Rendering GIF…" while working, "SVG, 18 KB"
 * when done, "GIF export failed: <reason>" when failed.
 */
export function exportStatusText(_state: ExportState): string {
  throw new Error("exportStatusText is not implemented.");
}
