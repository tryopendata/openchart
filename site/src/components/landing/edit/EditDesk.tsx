/**
 * The edit section's island: a chart in the library's edit mode whose one
 * callout the reader can drag or nudge, the spec line that changes, and Reset.
 */
import type { ReactNode } from "react";

/** The static SVGs the island shows until the chart is live. */
export type EditDeskProps = {
  children?: ReactNode;
};

/** The editable chart with its readout and Reset. */
export function EditDesk({ children }: EditDeskProps) {
  return <div data-edit-chart>{children}</div>;
}
