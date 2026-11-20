/**
 * Whether the page is in its dark theme, kept current as the reader toggles it.
 * The theme lives on `<html>` as a `dark` or `light` class (set by the head script
 * and the toggle); with neither, the system preference decides, as in global.css.
 */
import { useSyncExternalStore } from "react";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isPageDark(): boolean {
  const { classList } = document.documentElement;
  if (classList.contains("dark")) return true;
  if (classList.contains("light")) return false;
  return matchMedia(DARK_QUERY).matches;
}

function subscribe(change: () => void): () => void {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const query = matchMedia(DARK_QUERY);
  query.addEventListener("change", change);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", change);
  };
}

/** True while the page shows its dark theme. False on the server, which renders both themes. */
export function usePageDark(): boolean {
  return useSyncExternalStore(subscribe, isPageDark, () => false);
}
