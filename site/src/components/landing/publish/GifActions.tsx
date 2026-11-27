/**
 * What a reader can do with an exported GIF shown in place: save it, or go back
 * to the live chart. Saving is a plain link, so the GIF never downloads unasked.
 */
import type { ShownGif } from "./use-chart-export";

export type GifActionsProps = {
  gif: ShownGif;
  onClose: () => void;
};

/** A "Download GIF" link and a "Back to the live chart" button. */
export function GifActions({ gif, onClose }: GifActionsProps) {
  return (
    <div className="publish-gif-actions">
      <a className="btn" href={gif.url} download={gif.fileName}>
        Download GIF
      </a>
      <button type="button" className="btn" onClick={onClose}>
        Back to the live chart
      </button>
    </div>
  );
}
