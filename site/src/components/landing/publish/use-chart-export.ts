/**
 * The publish section's export runner: exports the live chart one format at a
 * time, downloads SVG, PNG and CSV, keeps an exported GIF as a `blob:` URL to
 * show in place, and tracks the status line's state. It owns every `blob:` URL
 * it makes: a download's is revoked a few seconds after the click (or at the
 * next export or unmount), the GIF's when it is replaced, dismissed or the
 * island unmounts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type ChartInstance, exportChartFile, exportFileName } from "./chart-file";
import { type ExportFormat, type ExportState, failureReason } from "./export-status";

/** An exported GIF shown in place of the live chart. */
export type ShownGif = { url: string; fileName: string };

/** What the export runner gives the island. */
export type ChartExport = {
  state: ExportState;
  gif: ShownGif | null;
  /** Exports the chart in `format`; a GIF is shown, every other format downloads. Ignored while one runs. */
  run: (format: ExportFormat) => Promise<void>;
  /** Drops the shown GIF, returning to the live chart. Does nothing while an export runs. */
  closeGif: () => void;
};

/** How long a download's `blob:` URL outlives the click; revoking sooner can cancel the save. */
const DOWNLOAD_URL_LIFETIME_MS = 5000;

/** Starts saving `url` under `fileName` through a temporary link. */
function clickDownload(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

/** The page's background colour, so a GIF of a dark chart is not set on white. */
function pageBackground(): string {
  return getComputedStyle(document.body).backgroundColor;
}

/** The download URL still alive, if any, and the timer that will revoke it. */
type PendingDownload = { url: string; timer: ReturnType<typeof setTimeout> };

/** Owns the latest download's `blob:` URL: one at a time, revoked late enough for the save to start. */
function useDownloads() {
  const pending = useRef<PendingDownload | null>(null);

  const release = useCallback(() => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    URL.revokeObjectURL(pending.current.url);
    pending.current = null;
  }, []);

  const download = useCallback(
    (blob: Blob, fileName: string) => {
      release();
      const url = URL.createObjectURL(blob);
      clickDownload(url, fileName);
      pending.current = { url, timer: setTimeout(release, DOWNLOAD_URL_LIFETIME_MS) };
    },
    [release],
  );

  return { download, release };
}

/** Owns the shown GIF's `blob:` URL: revoked whenever the GIF is replaced or dropped. */
function useShownGif() {
  const [gif, setGif] = useState<ShownGif | null>(null);
  const url = useRef<string | null>(null);

  const show = useCallback((next: ShownGif | null) => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = next?.url ?? null;
    setGif(next);
  }, []);

  return { gif, show };
}

/**
 * Exports the chart `getChart` returns on request.
 *
 * One export runs at a time. Each run carries an id; unmounting supersedes it,
 * and a superseded run's result is dropped. Failures never throw out of `run`:
 * they set a `failed` state (the status line says so) and log the error with
 * its cause, leaving the live chart in place.
 */
export function useChartExport(getChart: () => ChartInstance | null): ChartExport {
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  const { gif, show: showGif } = useShownGif();
  const { download, release } = useDownloads();
  const latestRun = useRef(0);
  const running = useRef(false);

  useEffect(
    () => () => {
      latestRun.current += 1;
      running.current = false;
      showGif(null);
      release();
    },
    [showGif, release],
  );

  const run = useCallback(
    async (format: ExportFormat) => {
      if (running.current) return;
      running.current = true;
      latestRun.current += 1;
      const id = latestRun.current;
      const current = () => latestRun.current === id;
      setState({ kind: "working", format });
      try {
        const chart = getChart();
        if (!chart) throw new Error("the live chart has not mounted");
        const blob = await exportChartFile(chart, format, { backgroundColor: pageBackground() });
        if (!current()) return;
        const fileName = exportFileName(format);
        if (format === "gif") showGif({ url: URL.createObjectURL(blob), fileName });
        else download(blob, fileName);
        setState({ kind: "done", format, bytes: blob.size, fileName });
      } catch (error) {
        if (!current()) return;
        console.error(`Publish section: the ${format.toUpperCase()} export failed.`, error);
        setState({ kind: "failed", format, reason: failureReason(format, error) });
      } finally {
        if (current()) running.current = false;
      }
    },
    [getChart, showGif, download],
  );

  const closeGif = useCallback(() => {
    // A GIF rendering now would land after the reader went back; Back is disabled meanwhile.
    if (running.current) return;
    showGif(null);
    setState({ kind: "idle" });
  }, [showGif]);

  return { state, gif, run, closeGif };
}
