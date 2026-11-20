/** The theme every chart on the site renders with, so charts match the page. */
import type { ThemeConfig } from "@opendata-ai/openchart-core";

/** The site's chart theme for the light or dark page. */
export function chartTheme(_dark: boolean): ThemeConfig {
  throw new Error("not implemented");
}
