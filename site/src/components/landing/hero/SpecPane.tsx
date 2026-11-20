/**
 * The spec pane: the current step's spec as formatted lines, tokens tinted by
 * kind, and the lines this step added marked with `data-spec-added` (CSS draws
 * the accent rule on their leading edge). Under 700px the pane collapses to the
 * added lines; the rest stay in the DOM, hidden by CSS, so the full spec is
 * always in the page text. Indentation is padding, so a wrapped line hangs under
 * its own start.
 */
import { type CSSProperties, forwardRef, useId, useState } from "react";
import type { MarkedSpecLine, SpecToken } from "./spec-lines";

export type SpecPaneProps = { lines: MarkedSpecLine[]; stepLabel: string };

function Token({ token }: { token: SpecToken }) {
  return <span className={`spec-${token.kind}`}>{token.text}</span>;
}

function Line({ line }: { line: MarkedSpecLine }) {
  return (
    <span
      className="hero-spec-line"
      style={{ "--depth": line.depth } as CSSProperties}
      data-spec-added={line.added ? "" : undefined}
    >
      {line.tokens.map((token, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a line's tokens never reorder.
        <Token key={index} token={token} />
      ))}
    </span>
  );
}

/** The pane; the ref is the scrolling `<pre>`, which the reveal scrolls to the added lines. */
export const SpecPane = forwardRef<HTMLElement, SpecPaneProps>(function SpecPane(
  { lines, stepLabel },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const paneId = useId();
  return (
    <div className="hero-spec" data-expanded={expanded ? "" : undefined}>
      <section
        ref={ref}
        id={paneId}
        className="hero-spec-code"
        data-hero-spec
        aria-label={`Spec as of step: ${stepLabel}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the pane scrolls, and a scrolling region must take keyboard focus (axe scrollable-region-focusable).
        tabIndex={0}
      >
        <pre>
          <code>
            {lines.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position in the spec.
              <Line key={index} line={line} />
            ))}
          </code>
        </pre>
      </section>
      <button
        type="button"
        className="hero-spec-toggle"
        aria-controls={paneId}
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? "Show changed lines" : "Show full spec"}
      </button>
    </div>
  );
});
