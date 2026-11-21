/**
 * Which theme the page is in, for islands that mount charts. The head script and
 * the theme toggle put `dark` or `light` on `<html>`; with neither, the system
 * preference decides, as in global.css. A mounted chart has no theme setter, so
 * charts re-create when this changes. The server renders light, like the static
 * SVG's default. Every island reads the theme through this module.
 */
import type { DarkMode, ThemeConfig } from "@opendata-ai/openchart-core";
import { useMemo, useSyncExternalStore } from "react";
import { chartTheme } from "../../lib/demo/chart-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** True while the page shows its dark theme. For DOM code outside React; islands use `usePageDark`. */
export function isPageDark(): boolean {
  const { classList } = document.documentElement;
  if (classList.contains("dark")) return true;
  if (classList.contains("light")) return false;
  return matchMedia(DARK_QUERY).matches;
}

/** Calls `change` whenever the page theme may have changed (toggle or system preference). Returns an unsubscribe. */
export function subscribePageTheme(change: () => void): () => void {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const query = matchMedia(DARK_QUERY);
  query.addEventListener("change", change);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", change);
  };
}

/** True while the page shows its dark theme. False on the server. */
export function usePageDark(): boolean {
  return useSyncExternalStore(subscribePageTheme, isPageDark, () => false);
}

/** The site's chart theme and dark mode for the page's current theme, stable between renders. */
export function usePageChartTheme(): { theme: ThemeConfig; darkMode: DarkMode; dark: boolean } {
  const dark = usePageDark();
  return useMemo(
    () => ({ theme: chartTheme(dark), darkMode: dark ? "force" : "off", dark }),
    [dark],
  );
}
