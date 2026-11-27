/**
 * Under the edit section's chart: the one spec line the callout's position
 * writes, with its two numbers set in ink against muted JSON, and Reset.
 */
import { type Offset, offsetLineParts } from "./callout-offset";

export type EditReadoutProps = {
  offset: Offset;
  /** True once the reader has moved the callout from where the spec put it; Reset is off otherwise. */
  resettable: boolean;
  /** True while the callout moves by itself, so a screen reader is not read every frame. */
  busy: boolean;
  onReset: () => void;
};

/** The live spec line and the Reset button. */
export function EditReadout({ offset, resettable, busy, onReset }: EditReadoutProps) {
  return (
    <div className="edit-controls">
      <p className="edit-readout" data-edit-readout aria-live="polite" aria-busy={busy}>
        <code>
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
        </code>
      </p>
      <button type="button" className="btn edit-reset" disabled={!resettable} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
