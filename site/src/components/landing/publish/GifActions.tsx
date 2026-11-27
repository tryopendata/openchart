/**
 * What a reader can do with an exported GIF shown in place: save it, or go back
 * to the live chart. Saving is a plain link, so the GIF never downloads unasked.
 * The row is always in the layout, empty until there is a GIF, so showing one
 * does not push the article down.
 */
import type { ShownGif } from "./use-chart-export";

export type GifActionsProps = {
  gif: ShownGif | null;
  /** True while an export runs: going back then would let a new GIF land over the live chart. */
  busy: boolean;
  onClose: () => void;
};

/** A "Download GIF" link and a "Back to the live chart" button, or the empty reserved row. */
export function GifActions({ gif, busy, onClose }: GifActionsProps) {
  return (
    <div className="publish-gif-actions">
      {gif ? (
        <>
          <a className="btn" href={gif.url} download={gif.fileName}>
            Download GIF
          </a>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Back to the live chart
          </button>
        </>
      ) : null}
    </div>
  );
}
