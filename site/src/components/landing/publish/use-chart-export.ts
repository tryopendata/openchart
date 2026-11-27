/**
 * The publish section's export runner: exports the live chart, downloads SVG,
 * PNG and CSV, keeps an exported GIF as a `blob:` URL to show in place, and
 * tracks the status line's state. It owns that URL and revokes it when the GIF
 * is replaced, dismissed or the island unmounts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type ChartInstance, exportChartFile, exportFileName } from "./chart-file";
import type { ExportFormat, ExportState } from "./export-status";

/** An exported GIF shown in place of the live chart. */
export type ShownGif = { url: string; fileName: string };

/** What the export runner gives the island. */
export type ChartExport = {
  state: ExportState;
  gif: ShownGif | null;
  /** Exports the chart in `format`; a GIF is shown, every other format downloads. */
  run: (format: ExportFormat) => Promise<void>;
  /** Drops the shown GIF, returning to the live chart. */
  closeGif: () => void;
};

/** Saves `blob` under `fileName` through a temporary link. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url));
}

/** The page's background colour, so a GIF of a dark chart is not set on white. */
function pageBackground(): string {
  return getComputedStyle(document.body).backgroundColor;
}

/** A failure's message for the status line, without the stack. */
function reasonOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

/**
 * Exports the chart `getChart` returns on request.
 *
 * Failures never throw out of `run`: they set a `failed` state (the status line
 * says so) and log the cause, leaving the live chart in place.
 */
export function useChartExport(getChart: () => ChartInstance | null): ChartExport {
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  const [gif, setGif] = useState<ShownGif | null>(null);
  const gifUrl = useRef<string | null>(null);
  const mounted = useRef(true);

  const showGif = useCallback((next: ShownGif | null) => {
    if (gifUrl.current) URL.revokeObjectURL(gifUrl.current);
    gifUrl.current = next?.url ?? null;
    setGif(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      showGif(null);
    };
  }, [showGif]);

  const run = useCallback(
    async (format: ExportFormat) => {
      setState({ kind: "working", format });
      try {
        const chart = getChart();
        if (!chart) throw new Error("the live chart has not mounted");
        const blob = await exportChartFile(chart, format, { backgroundColor: pageBackground() });
        // An island gone mid-export has nowhere to show or save the file.
        if (!mounted.current) return;
        const fileName = exportFileName(format);
        if (format === "gif") showGif({ url: URL.createObjectURL(blob), fileName });
        else downloadBlob(blob, fileName);
        setState({ kind: "done", format, bytes: blob.size });
      } catch (error) {
        console.error(`Publish section: the ${format.toUpperCase()} export failed.`, error);
        setState({ kind: "failed", format, reason: reasonOf(error) });
      }
    },
    [getChart, showGif],
  );

  const closeGif = useCallback(() => {
    showGif(null);
    setState({ kind: "idle" });
  }, [showGif]);

  return { state, gif, run, closeGif };
}
