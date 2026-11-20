/**
 * The copy button for text a React island already holds. It renders only once
 * hydrated, so the server HTML has no button that can't work, and it says
 * "Copied" or "Copy failed" for two seconds, as every copy button on the site does.
 * Astro-only markup uses `data-copy` from `@steamfield/ui/copy` instead.
 */
import { useCopy } from "@steamfield/ui/react/copy";
import { useEffect, useState } from "react";

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

export function CopyText({ text, label, className = "copy-chip" }: CopyTextProps) {
  const [hydrated, setHydrated] = useState(false);
  const { copy, copied, failed } = useCopy();
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null;
  return (
    <button type="button" className={className} aria-label={label} onClick={() => void copy(text)}>
      <span aria-live="polite">{buttonText(copied, failed)}</span>
    </button>
  );
}
