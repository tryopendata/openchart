/**
 * The spec as the hero's second story: a native `<details>` under the chart,
 * closed by default, so the page reads as a graphic first. Closed, its summary
 * shows "View the spec" and one muted mono line, the line the current step adds
 * that says the most. Open, it holds the spec pane with the step's added lines
 * marked and a Copy button for the step's whole spec. Without JavaScript the
 * details still opens on the finished spec; autoplay never opens it.
 */
import { forwardRef, useState } from "react";
import { CopyText } from "../../shared/CopyText";
import type { DeskStep } from "./desk-step";
import { SpecPane } from "./SpecPane";

export type SpecDisclosureProps = {
  step: DeskStep;
  /** True once the island has hydrated. */
  hydrated: boolean;
  /** Called when the reader opens the spec, or scrolls, touches or focuses it. */
  onInteract: () => void;
  /** Called with the new state each time the reader opens or closes it. */
  onToggle: (open: boolean) => void;
};

/** The disclosure; the ref is the spec pane's scrolling region. */
export const SpecDisclosure = forwardRef<HTMLElement, SpecDisclosureProps>(function SpecDisclosure(
  { step, hydrated, onInteract, onToggle },
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
        if (isOpen) onInteract();
      }}
    >
      <summary className="hero-spec-summary">
        <span className="hero-spec-summary-label">{open ? "Hide the spec" : "View the spec"}</span>
        {open ? null : (
          <code className="hero-spec-teaser" aria-hidden="true">
            <span className="hero-spec-teaser-mark">+</span> {step.teaser}
          </code>
        )}
      </summary>
      <div className="hero-spec-body">
        <div className="hero-spec-head">
          <span className="hero-spec-head-label">Spec as of: {step.label.toLowerCase()}</span>
          <CopyText
            text={JSON.stringify(step.spec, null, 2)}
            label="Copy this step's spec"
            className="copy-chip"
          />
        </div>
        <SpecPane
          ref={ref}
          lines={step.lines}
          stepLabel={step.label}
          hydrated={hydrated}
          onInteract={onInteract}
        />
      </div>
    </details>
  );
});
