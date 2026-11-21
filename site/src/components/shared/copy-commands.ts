/**
 * Wires the server-rendered command Copy buttons (`CopyCommand` from
 * @steamfield/ui/react/copy) inside one landing section. The buttons stay hidden
 * without JavaScript; on a failed copy the library selects the command, and the
 * message tells the reader how to finish by hand.
 */
import { enhanceCopyButtons } from "@steamfield/ui/copy";

/** Shown and announced when the clipboard refuses a copy. */
export const COPY_FAILED_MESSAGE = "Copy failed. The command is selected: press Ctrl+C or Cmd+C.";

/** Wires every command Copy button in the section with this id. Does nothing when the section is absent. */
export function enhanceSectionCopy(sectionId: string): void {
  const section = document.getElementById(sectionId);
  if (!section) return;
  enhanceCopyButtons(section, { messages: { failed: () => COPY_FAILED_MESSAGE } });
}
