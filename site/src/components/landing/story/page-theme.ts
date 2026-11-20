/**
 * Which theme the page is in, for islands that mount charts: the head script and
 * the theme toggle put `dark` or `light` on `<html>`, and a mounted chart has no
 * theme setter, so charts re-create when this changes. The server renders light,
 * like the static SVG's default.
 */
import type { DarkMode, ThemeConfig } from "@opendata-ai/openchart-core";
import { useMemo, useSyncExternalStore } from "react";
import { chartTheme } from "../../../lib/demo/chart-theme";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDarkPage = () => document.documentElement.classList.contains("dark");

/** True while the page shows its dark theme. */
export function usePageDark(): boolean {
  return useSyncExternalStore(subscribe, isDarkPage, () => false);
}

/** The site's chart theme and dark mode for the page's current theme, stable between renders. */
export function usePageChartTheme(): { theme: ThemeConfig; darkMode: DarkMode; dark: boolean } {
  const dark = usePageDark();
  return useMemo(
    () => ({ theme: chartTheme(dark), darkMode: dark ? "force" : "off", dark }),
    [dark],
  );
}
