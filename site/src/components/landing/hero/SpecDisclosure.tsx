/**
 * The spec as the hero's second story: a native `<details>` under the stage,
 * closed by default, so the page reads as a graphic first. Closed, its summary
 * shows "View the spec" and one muted mono line (prefixed with `+` when the
 * active view differs from its baseline). Open, it holds the spec pane with
 * added lines marked and a Copy button for the active view's full JSON spec.
 * Without JavaScript the details still opens on the default view's spec.
 */
import { forwardRef, useState } from "react";
import type { HeroSpecDiff } from "../../../landing/hero";
import { CopyText } from "../../shared/CopyText";
import { SpecPane } from "./SpecPane";

/** Props for `SpecDisclosure`. */
export type SpecDisclosureProps = {
  /** Formatted spec lines, diff status, teaser, label and raw spec for the active view. */
  diff: HeroSpecDiff;
  /** True once the island has hydrated. */
  hydrated: boolean;
  /** Called with the new state each time the reader opens or closes the disclosure. */
  onToggle: (open: boolean) => void;
};

/** The disclosure; the ref is the spec pane's scrolling region. */
export const SpecDisclosure = forwardRef<HTMLElement, SpecDisclosureProps>(function SpecDisclosure(
  { diff, hydrated, onToggle },
  ref,
) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="hero-spec-details"
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        setOpen(isOpen);
        onToggle(isOpen);
      }}
    >
      <summary className="hero-spec-summary">
        <span className="hero-spec-summary-label">{open ? "Hide the spec" : "View the spec"}</span>
        {open ? null : (
          <code className="hero-spec-teaser" aria-hidden="true">
            {diff.hasDiff ? (
              <>
                <span className="hero-spec-teaser-mark">+</span>{" "}
              </>
            ) : null}
            {diff.teaser}
          </code>
        )}
      </summary>
      <div className="hero-spec-body">
        <div className="hero-spec-head">
          <span className="hero-spec-head-label">Spec: {diff.label}</span>
          <CopyText text={JSON.stringify(diff.spec, null, 2)} label="Copy this spec" />
        </div>
        <SpecPane ref={ref} lines={diff.lines} label={diff.label} hydrated={hydrated} />
      </div>
    </details>
  );
});
