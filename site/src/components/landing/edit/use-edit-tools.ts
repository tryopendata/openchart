/**
 * Loads the edit section's live-chart tools (edit-tools.ts) lazily: the edit
 * rule, which applies transactions with the chart library's core, the gesture
 * guard and the touch relay. Loaded here, core arrives with the chart library
 * the live chart loads anyway, and the page's up-front JavaScript carries none
 * of it. The island keeps the static chart until these are in, so an edit
 * chart never shows without the rules that decide its edits.
 */
import { useEffect, useState } from "react";

/** The tools as edit-tools.ts exports them. */
export type EditTools = typeof import("./edit-tools");

/** The tools once loaded; null while loading, or for good if they fail to load. */
export function useEditTools(): EditTools | null {
  const [tools, setTools] = useState<EditTools | null>(null);
  useEffect(() => {
    let active = true;
    import("./edit-tools").then(
      (loaded) => {
        if (active) setTools(loaded);
      },
      (error: unknown) => {
        // The static chart stays: without the rules no edit could apply.
        console.error(
          "Edit section: the edit rules could not be loaded; showing the static chart.",
          error,
        );
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return tools;
}
