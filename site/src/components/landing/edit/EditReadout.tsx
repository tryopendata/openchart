/**
 * What the edit section's spec says about the callout, and Reset.
 *
 * From 1024px this sits beside the chart: a muted excerpt of the spec's
 * `annotations` (spec-excerpt.ts) with the callout's offset as the one line in
 * ink. Under 1024px the CSS hides everything but that offset line, which sits
 * under the chart with Reset beside it. Either way the offset line is the one
 * `[data-edit-readout]` element and the only live region, so a screen reader
 * hears the reader's move and nothing else; it is silent while the callout
 * moves by itself. Reset and the how-to are in the server HTML holding their
 * space, and the CSS shows them once the island is live (`data-live`), since
 * neither does anything before.
 */
import type { CSSProperties } from "react";
import { type Offset, offsetLineParts } from "./callout-offset";
import { editSpec } from "./edit-spec";
import { calloutExcerpt } from "./spec-excerpt";

export type EditReadoutProps = {
  offset: Offset;
  /** True once the reader has moved the callout from where the spec put it; Reset is off otherwise. */
  resettable: boolean;
  /** True while the callout moves by itself; the offset line is not announced then. */
  busy: boolean;
  onReset: () => void;
};

const excerpt = calloutExcerpt(editSpec);
/** How to move the callout. The chart is one Tab stop, and arriving on it selects the callout. */
const HOW_TO =
  "Drag the callout, or tab to the chart and move it with the arrow keys. Only the callout moves; the rest of the chart stays as written.";

/** A line's nesting depth, for the indent the CSS draws. */
const depthStyle = (depth: number) => ({ "--depth": depth }) as CSSProperties;

/** The offset line: JSON muted, the two numbers in ink, each in a fixed-width cell. */
function OffsetLine({ offset, busy, depth }: { offset: Offset; busy: boolean; depth: number }) {
  return (
    <span
      className="edit-spec-line edit-spec-offset"
      style={depthStyle(depth)}
      data-edit-readout
      aria-live={busy ? "off" : "polite"}
    >
      {offsetLineParts(offset).map((part, index) =>
        part.number ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the line always has the same five runs in the same order.
          <span key={index} className="edit-readout-number">
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </span>
  );
}

/** The spec excerpt with the live offset line, and Reset. */
export function EditReadout({ offset, resettable, busy, onReset }: EditReadoutProps) {
  return (
    <div className="edit-readout">
      <p className="edit-spec-label">What the spec says</p>
      <pre className="edit-spec">
        <code>
          {excerpt.map((line, index) =>
            "offset" in line ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the excerpt is fixed at build time.
              <OffsetLine key={index} offset={offset} busy={busy} depth={line.depth} />
            ) : (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the excerpt is fixed at build time.
                key={index}
                className="edit-spec-line edit-spec-context"
                style={depthStyle(line.depth)}
              >
                {line.text}
              </span>
            ),
          )}
        </code>
      </pre>
      <button type="button" className="btn edit-reset" disabled={!resettable} onClick={onReset}>
        Reset
      </button>
      <p className="edit-how-to">{HOW_TO}</p>
    </div>
  );
}
