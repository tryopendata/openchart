/**
 * What the edit section's spec says about the callout, and Reset.
 *
 * From 1024px this sits beside the chart: a muted excerpt of the spec's
 * `annotations` (spec-excerpt.ts) with the callout's offset as the one line in
 * ink. Under 1024px the CSS hides everything but that offset line, which sits
 * under the chart with Reset beside it. Either way the offset line is the one
 * `[data-edit-readout]` element and the only live region, so a screen reader
 * hears the move and nothing else.
 */
import type { CSSProperties } from "react";
import { type Offset, offsetLineParts } from "./callout-offset";
import { editSpec } from "./edit-spec";
import { calloutExcerpt } from "./spec-excerpt";

export type EditReadoutProps = {
  offset: Offset;
  /** True once the reader has moved the callout from where the spec put it; Reset is off otherwise. */
  resettable: boolean;
  /** True while the callout moves by itself, so a screen reader is not read every frame. */
  busy: boolean;
  onReset: () => void;
};

const excerpt = calloutExcerpt(editSpec);

/** A line's nesting depth, for the indent the CSS draws. */
const depthStyle = (depth: number) => ({ "--depth": depth }) as CSSProperties;

/** The offset line: JSON muted, the two numbers in ink, each in a fixed-width cell. */
function OffsetLine({ offset, busy, depth }: { offset: Offset; busy: boolean; depth: number }) {
  return (
    <span
      className="edit-spec-line edit-spec-offset"
      style={depthStyle(depth)}
      data-edit-readout
      aria-live="polite"
      aria-busy={busy}
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
    </div>
  );
}
