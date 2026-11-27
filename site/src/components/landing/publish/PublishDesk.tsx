/**
 * The publish section's island: the live chart at article width with its export
 * buttons and status line. It imports the published spec itself, so the spec is
 * not repeated in the page as a prop.
 */
import type { ReactNode } from "react";

export type PublishDeskProps = {
  /** The static SVGs of the published chart, in both themes. */
  children?: ReactNode;
};

/** The published chart and its exports. */
export function PublishDesk({ children }: PublishDeskProps) {
  return <div data-publish-chart>{children}</div>;
}
