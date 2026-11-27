/**
 * The line a landing figure shows when its lede promises a live chart the
 * reader is not getting: without JavaScript, or when the live code failed to
 * load and the build-time still stays. It is in the server HTML but hidden
 * (demo.css) until `@media (scripting: none)` matches or the island marks it
 * failed, so it takes no space when the live chart loads.
 */

/** The line when the live chart's code did not load. Same wording family as Publish's status line. */
export const LIVE_UNAVAILABLE_TEXT =
  "The live chart did not load, so this is a still. Reload to try again.";

/** The line without JavaScript, where reloading would not help. */
export const NO_SCRIPT_TEXT = "The live chart needs JavaScript, so this is a still.";

export type StillNoteProps = {
  /** True once the live chart's code has failed to load. */
  failed: boolean;
  className?: string;
};

/** The hidden-by-default note under a landing figure's chart. */
export function StillNote({ failed, className }: StillNoteProps) {
  return (
    <p
      className={className ? `still-note ${className}` : "still-note"}
      data-still-note={failed ? "failed" : "no-script"}
    >
      {failed ? LIVE_UNAVAILABLE_TEXT : NO_SCRIPT_TEXT}
    </p>
  );
}
