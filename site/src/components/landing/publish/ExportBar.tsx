/**
 * The export buttons under the published chart and the status line beside
 * them, with room at the end for the GIF actions. Buttons stay disabled until
 * the live chart is in and while an export runs, so the server HTML carries
 * them disabled.
 */
import type { ReactNode } from "react";
import { type ExportFormat, type ExportState, exportStatusText } from "./export-status";

/** The formats offered, in button order. */
const FORMATS: readonly ExportFormat[] = ["svg", "png", "csv", "gif"];

export type ExportBarProps = {
  /** True once the live chart can export. */
  ready: boolean;
  state: ExportState;
  onExport: (format: ExportFormat) => void;
  /** Actions for an exported GIF, set at the end of the row. */
  children?: ReactNode;
};

/** A group of plain bordered buttons, one per format, and a polite status line. */
export function ExportBar({ ready, state, onExport, children }: ExportBarProps) {
  const busy = state.kind === "working";
  return (
    <div className="publish-exports">
      {/* biome-ignore lint/a11y/useSemanticElements: the buttons act on the chart, not a form, and the page contract (tests/build.test.ts) reads the explicit role. */}
      <div role="group" aria-label="Export this chart" className="publish-export-buttons">
        {FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            className="btn publish-export-button"
            disabled={!ready || busy}
            onClick={() => onExport(format)}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
      <p role="status" className="publish-export-status" data-state={state.kind}>
        {exportStatusText(state)}
      </p>
      {children}
    </div>
  );
}
