/**
 * Loads the edit section's edit rules (`acceptedOffset`) lazily. They apply
 * transactions with the chart library's core, which would otherwise ride in the
 * page's up-front JavaScript; loaded here, core arrives with the chart library
 * the live chart loads anyway. Until the rules are in, no edit can arrive: the
 * chart that emits edits comes from the same lazy load.
 */
import { useEffect, useState } from "react";

/** The rule deciding which edits apply, as edit-state.ts exports it. */
export type EditRule = typeof import("./edit-state").acceptedOffset;

/** `acceptedOffset` once loaded; null while loading, or for good if it fails to load. */
export function useEditRules(): EditRule | null {
  const [rule, setRule] = useState<EditRule | null>(null);
  useEffect(() => {
    let active = true;
    import("./edit-state").then(
      (rules) => {
        // A function in state must be wrapped, or React calls it as an updater.
        if (active) setRule(() => rules.acceptedOffset);
      },
      (error: unknown) => {
        // The chart stays as authored: with no rules, every edit is refused.
        console.error("Edit section: the edit rules could not be loaded; edits are off.", error);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return rule;
}
