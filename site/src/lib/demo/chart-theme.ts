/**
 * The theme every chart on the site renders with, so charts match the page:
 * the site's sans and mono, the page ink for text, and a transparent background
 * so the figure shows the page behind it in either theme.
 */
import type { ThemeConfig } from "@opendata-ai/openchart-core";

const SANS = '"Schibsted Grotesk Variable", "Schibsted Grotesk", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const INK = { light: "#101010", dark: "#f2f2ee" };

/** The site's chart theme for the light or dark page. */
export function chartTheme(dark: boolean): ThemeConfig {
  return {
    fonts: { family: SANS, mono: MONO },
    colors: { background: "transparent", text: dark ? INK.dark : INK.light },
  };
}
