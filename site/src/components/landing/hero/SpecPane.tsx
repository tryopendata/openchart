/**
 * The spec pane: the current step's spec as formatted lines, tokens tinted by
 * kind, and the lines this step added marked with `data-spec-added` (CSS draws
 * the accent rule on their leading edge). A folded line (the theme preset)
 * keeps its full lines in the page, hidden; once hydrated, its fold opens them
 * in place. Under 700px, and only once hydrated, the pane collapses to the
 * added lines with a toggle to show the rest; without JavaScript the whole spec
 * shows. Indentation is padding, so a wrapped line hangs under its own start.
 */
import { type CSSProperties, forwardRef, useId, useState } from "react";
import type { MarkedSpecLine, SpecLine, SpecToken } from "../../../landing/spec-lines";

export type SpecPaneProps = {
  lines: MarkedSpecLine[];
  stepLabel: string;
  /** True once the island has hydrated: the fold and the phone collapse need a working button. */
  hydrated: boolean;
  /** Called when the reader scrolls, touches or focuses the pane, which stops the sequence. */
  onInteract: () => void;
};

function Token({ token }: { token: SpecToken }) {
  return <span className={`spec-${token.kind}`}>{token.text}</span>;
}

function Tokens({ tokens }: { tokens: SpecToken[] }) {
  return tokens.map((token, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a line's tokens never reorder.
    <Token key={index} token={token} />
  ));
}

function Line({ line, added, hidden }: { line: SpecLine; added: boolean; hidden?: boolean }) {
  return (
    <span
      className="hero-spec-line"
      style={{ "--depth": line.depth } as CSSProperties}
      data-spec-added={added ? "" : undefined}
      hidden={hidden}
    >
      <Tokens tokens={line.tokens} />
    </span>
  );
}

/** A folded line, and the lines it stands for (hidden until opened). */
function FoldedLine({ line, hydrated }: { line: MarkedSpecLine; hydrated: boolean }) {
  const [open, setOpen] = useState(false);
  const folded = line.folded ?? [];
  const fold = line.tokens.find((token) => token.kind === "fold");
  return (
    <>
      <span
        className="hero-spec-line"
        style={{ "--depth": line.depth } as CSSProperties}
        data-spec-added={line.added ? "" : undefined}
        hidden={open}
      >
        {line.tokens.map((token, index) =>
          token === fold && hydrated ? (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: a line's tokens never reorder.
              key={index}
              type="button"
              className="spec-fold spec-fold-button"
              aria-expanded={open}
              aria-label={`Show the ${folded.length} lines folded here`}
              onClick={() => setOpen(true)}
            >
              {token.text}
            </button>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: a line's tokens never reorder.
            <Token key={index} token={token} />
          ),
        )}
      </span>
      {folded.map((child, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position in the fold.
        <Line key={index} line={child} added={false} hidden={!open} />
      ))}
    </>
  );
}

/** The pane; the ref is the scrolling region, which the reveal scrolls to the added lines. */
export const SpecPane = forwardRef<HTMLElement, SpecPaneProps>(function SpecPane(
  { lines, stepLabel, hydrated, onInteract },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const paneId = useId();
  return (
    <div
      className="hero-spec"
      data-collapsible={hydrated ? "" : undefined}
      data-expanded={expanded ? "" : undefined}
    >
      <section
        ref={ref}
        id={paneId}
        className="hero-spec-code"
        data-hero-spec
        aria-label={`Spec as of step: ${stepLabel}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the pane scrolls, and a scrolling region must take keyboard focus (axe scrollable-region-focusable).
        tabIndex={0}
        onWheel={onInteract}
        onPointerDown={onInteract}
        onTouchStart={onInteract}
        onFocus={onInteract}
      >
        <pre>
          <code>
            {lines.map((line, index) =>
              line.folded ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position in the spec.
                <FoldedLine key={index} line={line} hydrated={hydrated} />
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position in the spec.
                <Line key={index} line={line} added={line.added} />
              ),
            )}
          </code>
        </pre>
      </section>
      {hydrated ? (
        <button
          type="button"
          className="hero-spec-toggle"
          aria-controls={paneId}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show changed lines" : "Show full spec"}
        </button>
      ) : null}
    </div>
  );
});
