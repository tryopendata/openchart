/**
 * The copy button for text a React island already holds. It renders only once
 * hydrated, so the server HTML has no button that can't work, and it says
 * "Copied" or "Copy failed" for two seconds, as every copy button on the site does.
 * Astro-only markup uses `data-copy` from `@steamfield/ui/copy` instead. Like
 * those buttons, it dispatches a bubbling `sf:copy` event whose `detail.ok` says
 * whether the clipboard took the text, which is what landing analytics listens for.
 */

import { useCopy } from "@steamfield/ui/react/copy";
import { useRef } from "react";
import { useHydrated } from "./use-hydrated";

type CopyTextProps = {
  text: string;
  /** The accessible name, such as "Copy install command". */
  label: string;
  className?: string;
};

function buttonText(copied: boolean, failed: boolean): string {
  if (copied) return "Copied";
  return failed ? "Copy failed" : "Copy";
}

export function CopyText({ text, label, className = "copy-button" }: CopyTextProps) {
  const hydrated = useHydrated();
  const { copy, copied, failed } = useCopy();
  const button = useRef<HTMLButtonElement>(null);
  if (!hydrated) return null;
  const onClick = async () => {
    const ok = await copy(text);
    button.current?.dispatchEvent(new CustomEvent("sf:copy", { bubbles: true, detail: { ok } }));
  };
  return (
    <button
      ref={button}
      type="button"
      className={className}
      aria-label={label}
      onClick={() => void onClick()}
    >
      <span aria-live="polite">{buttonText(copied, failed)}</span>
    </button>
  );
}
