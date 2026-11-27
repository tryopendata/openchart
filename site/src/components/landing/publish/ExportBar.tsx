/**
 * The export buttons under the published chart, the status line beside them
 * and, below, the row the GIF actions sit in. Buttons are `disabled` until the
 * live chart is in, so the server HTML carries them disabled. While an export
 * runs they are only `aria-disabled` and ignore clicks, so the button a reader
 * pressed keeps keyboard focus. The status line stays one line (cut off with
 * the full text in `title`), so the figure never changes height.
 */
import type { ReactNode, RefObject } from "react";
import {
  type ExportFormat,
  type ExportState,
  exportStatusText,
  LIBRARY_UNAVAILABLE_TEXT,
} from "./export-status";

/** The formats offered, in button order. */
const FORMATS: readonly ExportFormat[] = ["svg", "png", "csv", "gif"];

export type ExportBarProps = {
  /** True once the live chart can export. */
  ready: boolean;
  /** True when the chart library did not load, so no export will ever be ready. */
  libraryFailed: boolean;
  state: ExportState;
  onExport: (format: ExportFormat) => void;
  /** The GIF button, so focus can return to it after the GIF is dismissed. */
  gifButtonRef: RefObject<HTMLButtonElement | null>;
  /** The GIF actions row, rendered under the buttons. */
  children?: ReactNode;
};

/** A group of plain bordered buttons, one per format, and a polite status line. */
export function ExportBar({
  ready,
  libraryFailed,
  state,
  onExport,
  gifButtonRef,
  children,
}: ExportBarProps) {
  const busy = state.kind === "working";
  const status = libraryFailed ? LIBRARY_UNAVAILABLE_TEXT : exportStatusText(state);
  return (
    <div className="publish-exports">
      {/* biome-ignore lint/a11y/useSemanticElements: the buttons act on the chart, not a form, and the page contract (tests/build.test.ts) reads the explicit role. */}
      <div role="group" aria-label="Export this chart" className="publish-export-buttons">
        {FORMATS.map((format) => (
          <button
            key={format}
            ref={format === "gif" ? gifButtonRef : undefined}
            type="button"
            className="btn publish-export-button"
            disabled={!ready}
            aria-disabled={busy ? "true" : undefined}
            onClick={() => {
              if (!busy) onExport(format);
            }}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
      <p
        role="status"
        className="publish-export-status"
        data-state={libraryFailed ? "failed" : state.kind}
        title={status || undefined}
      >
        {status}
      </p>
      {children}
    </div>
  );
}
